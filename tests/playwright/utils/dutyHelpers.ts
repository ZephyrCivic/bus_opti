import type { Page } from '@playwright/test';

interface DutyInjectionPayload {
  blockId: string;
  startTripId: string;
  endTripId: string;
  startSequence: number;
  endSequence: number;
  durationMinutes: number;
}

export async function waitForDutyTestHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: unknown;
      __TEST_DUTY_ACTIONS?: unknown;
    };
    return Boolean(testWindow.__TEST_DUTY_PLAN && testWindow.__TEST_DUTY_ACTIONS);
  }, { timeout: 30_000 });
}

export async function prepareLongDutyForWarnings(page: Page): Promise<DutyInjectionPayload> {
  return page.evaluate(() => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: {
        plan: {
          csvRows: Array<{
            blockId: string;
            tripId: string;
            seq: number;
            tripStart: string;
            tripEnd: string;
          }>;
        };
      };
    };
    const plan = testWindow.__TEST_DUTY_PLAN;
    if (!plan) {
      throw new Error('Duty plan is not available for tests.');
    }
    const grouped = new Map<string, Array<{ seq: number; tripId: string; start: string; end: string }>>();
    for (const row of plan.plan.csvRows) {
      const list = grouped.get(row.blockId) ?? [];
      list.push({ seq: row.seq, tripId: row.tripId, start: row.tripStart, end: row.tripEnd });
      grouped.set(row.blockId, list);
    }
    let selectedBlockId: string | null = null;
    let selectedTripId: string | null = null;
    let selectedSequence = 0;
    let selectedDuration = -Infinity;

    const toMinutes = (label: string): number => {
      const [hours, minutes] = label.split(':').map((part) => Number.parseInt(part, 10));
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return Number.NaN;
      }
      return hours * 60 + minutes;
    };

    for (const [blockId, rows] of grouped.entries()) {
      for (const row of rows) {
        const startMinutes = toMinutes(row.start);
        const endMinutes = toMinutes(row.end);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
          continue;
        }
        const duration = endMinutes - startMinutes;
        if (duration > selectedDuration) {
          selectedDuration = duration;
          selectedBlockId = blockId;
          selectedTripId = row.tripId;
          selectedSequence = row.seq;
        }
      }
    }

    if (!selectedBlockId || !selectedTripId || selectedDuration <= 0) {
      throw new Error('Unable to determine a suitable block for warnings.');
    }

    return {
      blockId: selectedBlockId,
      startTripId: selectedTripId,
      endTripId: selectedTripId,
      startSequence: selectedSequence,
      endSequence: selectedSequence,
      durationMinutes: selectedDuration,
    };
  });
}

export async function injectDutyWithThresholds(
  page: Page,
  payload: DutyInjectionPayload,
  thresholds?: { maxContinuousMinutes?: number; maxDailyMinutes?: number; minBreakMinutes?: number },
): Promise<void> {
  await page.evaluate((input) => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_ACTIONS?: {
        replace: (duties: Array<{
          id: string;
          driverId?: string | null;
          segments: Array<{
            id: string;
            blockId: string;
            startTripId: string;
            endTripId: string;
            startSequence: number;
            endSequence: number;
          }>;
        }>) => void;
        updateSettings: (settings: Partial<{
          maxContinuousMinutes: number;
          maxDailyMinutes: number;
          minBreakMinutes: number;
        }>) => void;
      };
    };
    const actions = testWindow.__TEST_DUTY_ACTIONS;
    if (!actions) {
      throw new Error('Duty actions test hook is not available.');
    }
    actions.replace([
      {
        id: 'DUTY_TEST_WARNING',
        driverId: 'DRIVER_WARNING',
        segments: [
          {
            id: 'SEG_WARNING',
            blockId: input.blockId,
            startTripId: input.startTripId,
            endTripId: input.endTripId,
            startSequence: input.startSequence,
            endSequence: input.endSequence,
          },
        ],
      },
    ]);
    actions.updateSettings({
      maxContinuousMinutes: input.thresholds.maxContinuousMinutes,
      maxDailyMinutes: input.thresholds.maxDailyMinutes,
      minBreakMinutes: input.thresholds.minBreakMinutes,
    });
  }, {
    blockId: payload.blockId,
    startTripId: payload.startTripId,
    endTripId: payload.endTripId,
    startSequence: payload.startSequence,
    endSequence: payload.endSequence,
    thresholds: {
      maxContinuousMinutes: thresholds?.maxContinuousMinutes ?? Math.max(1, payload.durationMinutes - 15),
      maxDailyMinutes: thresholds?.maxDailyMinutes ?? Math.max(1, payload.durationMinutes - 5),
      minBreakMinutes: thresholds?.minBreakMinutes ?? 30,
    },
  });
}

export async function setupBiViewDuty(page: Page): Promise<{ initialBlockId: string; swappedBlockId: string }> {
  return page.evaluate(() => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: {
        plan: {
          csvRows: Array<{ blockId: string; tripId: string; seq: number }>;
        };
      };
      __TEST_DUTY_ACTIONS?: {
        replace: (duties: Array<{
          id: string;
          driverId: string;
          segments: Array<{
            id: string;
            blockId: string;
            startTripId: string;
            endTripId: string;
            startSequence: number;
            endSequence: number;
          }>;
        }>) => void;
      };
      __TEST_BIVIEW_TARGET?: {
        primarySegment: {
          id: string;
          blockId: string;
          startTripId: string;
          endTripId: string;
          startSequence: number;
          endSequence: number;
        };
        secondarySegment: {
          id: string;
          blockId: string;
          startTripId: string;
          endTripId: string;
          startSequence: number;
          endSequence: number;
        };
      };
    };
    const plan = testWindow.__TEST_DUTY_PLAN;
    const actions = testWindow.__TEST_DUTY_ACTIONS;
    if (!plan || !actions) {
      throw new Error('Duty plan or actions are not available for tests.');
    }
    const grouped = new Map<string, Array<{ tripId: string; seq: number }>>();
    for (const row of plan.plan.csvRows) {
      const list = grouped.get(row.blockId) ?? [];
      list.push({ tripId: row.tripId, seq: row.seq });
      grouped.set(row.blockId, list);
    }
    const entries = [...grouped.entries()].filter(([, rows]) => rows.length > 0);
    if (entries.length < 2) {
      throw new Error('Bi-view test requires at least two blocks with trips.');
    }
    const [blockA, rowsA] = entries[0]!;
    const [blockB, rowsB] = entries[1]!;
    const primarySegment = {
      id: 'SEG_SYNC_1',
      blockId: blockA,
      startTripId: rowsA[0]!.tripId,
      endTripId: rowsA[0]!.tripId,
      startSequence: rowsA[0]!.seq,
      endSequence: rowsA[0]!.seq,
    };
    const secondarySegment = {
      id: 'SEG_SYNC_2',
      blockId: blockB,
      startTripId: rowsB[0]!.tripId,
      endTripId: rowsB[0]!.tripId,
      startSequence: rowsB[0]!.seq,
      endSequence: rowsB[0]!.seq,
    };
    actions.replace([
      {
        id: 'DUTY_SYNC',
        driverId: 'DRIVER_SYNC',
        segments: [primarySegment, secondarySegment],
      },
    ]);
    testWindow.__TEST_BIVIEW_TARGET = { primarySegment, secondarySegment };
    return { initialBlockId: primarySegment.blockId, swappedBlockId: secondarySegment.blockId };
  });
}
