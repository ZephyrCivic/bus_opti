import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';
import { setupBiViewDuty, waitForDutyTestHooks } from './utils/dutyHelpers';

test.describe('G3: 二面ビュー同期', () => {
  test('Vehicle/Driver タイムラインが200ms以内に同期する', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    const consoleLogs: string[] = [];
    page.on('console', (message) => {
      consoleLogs.push(`${message.type()}:${message.text()}`);
    });

    await importSampleGtfs(page);
    await waitForDutyTestHooks(page);
    const { initialBlockId, swappedBlockId } = await setupBiViewDuty(page);

    await page.locator('button[data-section="duties"]').click();
    try {
      await page.waitForSelector('[data-testid="driver-timeline"]', { timeout: 30_000 });
    } catch (error) {
      throw new Error(`Duty タイムラインが表示されませんでした。pageErrors=${errors.join('|')} consoleLogs=${consoleLogs.join('|')}`);
    }

    await page.waitForTimeout(500);

    const exposureCheck = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BIVIEW_SYNC?: unknown;
        __TEST_DUTY_SELECTION_CTRL?: unknown;
      };
      return {
        hasSync: Boolean(testWindow.__TEST_BIVIEW_SYNC),
        hasSelectionCtrl: Boolean(testWindow.__TEST_DUTY_SELECTION_CTRL),
      };
    });
    if (!exposureCheck.hasSync || !exposureCheck.hasSelectionCtrl) {
      const debugKeys = await page.evaluate(() => Object.keys(window).filter((key) => key.startsWith('__TEST')));
      throw new Error(
        `テスト用の同期ハンドルが初期化されていません (sync=${exposureCheck.hasSync}, selection=${exposureCheck.hasSelectionCtrl}) keys=${debugKeys.join(',')} errors=${errors.join('|')}`,
      );
    }

    const startTime = await page.evaluate(() => performance.now());

    await page.evaluate(
      (swapId) => {
        const testWindow = window as typeof window & {
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
          __TEST_DUTY_SELECTION_CTRL?: {
            setBlock: (id: string | null) => void;
            setDuty: (id: string | null) => void;
            setSegment: (selection: { dutyId: string; segmentId: string } | null) => void;
          };
        };
        const payload = testWindow.__TEST_BIVIEW_TARGET;
        const actions = testWindow.__TEST_DUTY_ACTIONS;
        const selection = testWindow.__TEST_DUTY_SELECTION_CTRL;
        if (!payload || !actions) {
          throw new Error('Bi-view payload or actions unavailable.');
        }
        const nextPrimary = {
          ...payload.secondarySegment,
          id: payload.primarySegment.id,
        };
        const nextSecondary = {
          ...payload.primarySegment,
          id: payload.secondarySegment.id,
        };
        actions.replace([
          {
            id: 'DUTY_SYNC',
            driverId: 'DRIVER_SYNC',
            segments: [nextPrimary, nextSecondary],
          },
        ]);
        selection?.setBlock(swapId);
        selection?.setDuty('DUTY_SYNC');
        selection?.setSegment(null);
        testWindow.__TEST_BIVIEW_TARGET = {
          primarySegment: nextPrimary,
          secondarySegment: nextSecondary,
        };
      },
      swappedBlockId,
    );

    const latencies = await page.evaluate((start) => {
      const testWindow = window as typeof window & {
        __TEST_BIVIEW_SYNC?: { driver: number; vehicle: number };
      };
      return new Promise<{ driverLatency: number; vehicleLatency: number }>((resolve) => {
        requestAnimationFrame(() => {
          const sync = testWindow.__TEST_BIVIEW_SYNC ?? { driver: Number.POSITIVE_INFINITY, vehicle: Number.POSITIVE_INFINITY };
          resolve({
            driverLatency: sync.driver - start,
            vehicleLatency: sync.vehicle - start,
          });
        });
      });
    }, startTime);

    expect(latencies.driverLatency).toBeLessThan(200);
    expect(latencies.vehicleLatency).toBeLessThan(200);
  });
});
