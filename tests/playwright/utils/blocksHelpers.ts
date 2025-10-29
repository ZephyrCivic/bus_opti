import type { Page } from '@playwright/test';

interface ManualPlanSnapshot {
  summaries: Array<{
    blockId: string;
    serviceDayIndex: number;
    serviceId?: string;
    firstTripStart: string;
    lastTripEnd: string;
  }>;
  connections: Array<{ fromBlockId: string; toBlockId: string }>;
  unassignedTripIds: string[];
}

export async function waitForManualBlocksPlan(page: Page): Promise<ManualPlanSnapshot> {
  await page.waitForFunction(() => {
    const testWindow = window as typeof window & {
      __TEST_BLOCKS_MANUAL_PLAN?: {
        plan: unknown;
        connections: unknown[];
      };
    };
    return Boolean(testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan);
  }, { timeout: 30_000 });

  return page.evaluate(() => {
    const testWindow = window as typeof window & {
      __TEST_BLOCKS_MANUAL_PLAN?: {
        plan: {
          summaries: Array<{
            blockId: string;
            serviceDayIndex: number;
            serviceId?: string;
            firstTripStart: string;
            lastTripEnd: string;
          }>;
          unassignedTripIds: string[];
        };
        connections: Array<{
          fromBlockId: string;
          toBlockId: string;
        }>;
      };
    };
    const snapshot = testWindow.__TEST_BLOCKS_MANUAL_PLAN;
    if (!snapshot) {
      throw new Error('Manual plan snapshot is not available.');
    }
    return {
      summaries: snapshot.plan.summaries.map((summary) => ({
        blockId: summary.blockId,
        serviceDayIndex: summary.serviceDayIndex,
        serviceId: summary.serviceId,
        firstTripStart: summary.firstTripStart,
        lastTripEnd: summary.lastTripEnd,
      })),
      connections: snapshot.connections.map((entry) => ({
        fromBlockId: entry.fromBlockId,
        toBlockId: entry.toBlockId,
      })),
      unassignedTripIds: [...snapshot.plan.unassignedTripIds],
    };
  });
}
