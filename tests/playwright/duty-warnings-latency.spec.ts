import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const appStepEnv = process.env.APP_STEP ?? process.env.VITE_APP_STEP ?? '1';
const isStepOne = String(appStepEnv).trim() === '1';

test.skip(
  isStepOne,
  'Step1 では Duty 警告 UI を非表示にしているため、この警告表示レイテンシテストは対象外。',
);

function toMinutes(label: string): number {
  const [hours, minutes] = label.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid time label: ${label}`);
  }
  return hours * 60 + minutes;
}

function formatLatency(value: number): string {
  return `${value.toFixed(1)}ms`;
}

test('Duty warnings surface within 1s after tightening thresholds', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ = true;
  });

  await page.goto('/bus_opti/');

  await page.locator('input[type="file"]').first().setInputFiles(path.join(ROOT_DIR, 'data', 'GTFS-JP(gunmachuo).zip'));
  await page.waitForSelector('table:has-text("trips.txt")', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: unknown;
      __TEST_DUTY_ACTIONS?: unknown;
    };
    return Boolean(testWindow.__TEST_DUTY_PLAN && testWindow.__TEST_DUTY_ACTIONS);
  }, { timeout: 30_000 });

  const blockData = await page.evaluate(() => {
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
    const grouped = new Map<string, Array<{ tripId: string; seq: number; start: string; end: string }>>();
    for (const row of plan.plan.csvRows) {
      const list = grouped.get(row.blockId) ?? [];
      list.push({ tripId: row.tripId, seq: row.seq, start: row.tripStart, end: row.tripEnd });
      grouped.set(row.blockId, list);
    }
    const sorted = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
    const [blockId, rows] = sorted[0] ?? [];
    if (!blockId || !rows || rows.length === 0) {
      throw new Error('No block data available for duty injection.');
    }
    return { blockId, rows };
  });

  const segmentDurations = (blockData.rows as Array<{ tripId: string; seq: number; start: string; end: string }>).map((row) => ({
    ...row,
    duration: toMinutes(row.end) - toMinutes(row.start),
  }));
  segmentDurations.sort((a, b) => b.duration - a.duration);
  const primary = segmentDurations[0];
  if (!primary || primary.duration <= 0) {
    throw new Error('Unable to find a valid trip segment for latency test.');
  }

  await page.waitForFunction(() => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_ACTIONS?: unknown;
    };
    return Boolean(testWindow.__TEST_DUTY_ACTIONS);
  }, { timeout: 10_000 });

  await page.evaluate((payload) => {
    const testWindow = window as typeof window & {
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
        updateSettings: (settings: Partial<{
          maxContinuousMinutes: number;
          minBreakMinutes: number;
          maxDailyMinutes: number;
        }>) => void;
      };
    };
    const actions = testWindow.__TEST_DUTY_ACTIONS;
    if (!actions) {
      throw new Error('Duty actions test hook is not available.');
    }
    actions.replace([payload.duty]);
    actions.updateSettings({ maxContinuousMinutes: 600, minBreakMinutes: 0, maxDailyMinutes: 1440 });
  }, {
    duty: {
      id: 'DUTY_001',
      driverId: 'DRIVER_001',
      segments: [
        {
          id: 'SEG_001',
          blockId: blockData.blockId,
          startTripId: primary.tripId,
          endTripId: primary.tripId,
          startSequence: primary.seq,
          endSequence: primary.seq,
        },
      ],
    },
  });

  await page.locator('button[data-section="duties"]').click();
  await page.waitForSelector('text=DUTY_001');
  await page.locator('div', { hasText: 'DUTY_001' }).first().click();

  const warningList = page.locator('ul.text-destructive');
  await expect(warningList).toHaveCount(0);

  const start = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __DUTY_WARNING_TEST?: { start: number };
      __TEST_DUTY_ACTIONS?: {
        updateSettings: (settings: Partial<{ maxContinuousMinutes: number }>) => void;
      };
    };
    const actions = testWindow.__TEST_DUTY_ACTIONS;
    if (!actions) {
      throw new Error('Duty actions test hook is not available.');
    }
    const now = performance.now();
    testWindow.__DUTY_WARNING_TEST = { start: now };
    actions.updateSettings({ maxContinuousMinutes: 10 });
    return now;
  });

  const endHandle = await page.waitForFunction(() => {
    const list = document.querySelector('ul.text-destructive');
    if (list && list.children.length > 0) {
      return performance.now();
    }
    return false;
  });
  const end = await endHandle.jsonValue();
  const latency = Number(end) - start;

  await expect(warningList).toHaveCount(1);
  expect(latency, `Warning latency ${formatLatency(latency)} exceeded 1s`).toBeLessThan(1_000);
});
