import { expect, test } from '@playwright/test';

import { importSampleGtfs } from './utils/importHelpers';
import { waitForDutyTestHooks } from './utils/dutyHelpers';

const appStepEnv = process.env.APP_STEP ?? process.env.VITE_APP_STEP ?? '1';
const isStepOne = String(appStepEnv).trim() === '1';

test.describe.skip('S1: Duty 回送操作（Step2仕様のため現在はskip）', () => {

  test('回送を挿入して削除できる', async ({ page }) => {
    test.setTimeout(45_000);
    await importSampleGtfs(page);
    await waitForDutyTestHooks(page);

    await page.locator('button[data-section="duties"]').click();
    await page.waitForSelector('[data-testid="driver-timeline"]', { timeout: 60_000 });

    const gapInfo = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_DUTY_PLAN?: {
          plan: {
            summaries: Array<{ blockId: string }>;
            csvRows: Array<{
              blockId: string;
              seq: number;
              tripId: string;
              fromStopId?: string;
              toStopId?: string;
            }>;
          };
        };
      };
      const plan = testWindow.__TEST_DUTY_PLAN?.plan;
      if (!plan || plan.summaries.length === 0) {
        throw new Error('Duty plan が初期化されていません。');
      }
      const blockId = plan.summaries[0]!.blockId;
      const rows = plan.csvRows
        .filter((row) => row.blockId === blockId)
        .sort((a, b) => a.seq - b.seq);
      if (rows.length < 2) {
        throw new Error('回送を検証できる十分な便がありません。');
      }
      return {
        blockId,
        firstTripId: rows[0]!.tripId,
        secondTripId: rows[1]!.tripId,
        fromStopId: rows[0]!.toStopId ?? '',
        toStopId: rows[1]!.fromStopId ?? '',
      };
    });

    await page.locator('button[data-section="manual"]').click();
    await page.fill('#dh-from', gapInfo.fromStopId);
    await page.fill('#dh-to', gapInfo.toStopId);
    await page.fill('#dh-time', '10');
    await page.locator('[data-testid="deadhead-add-rule"]').click();

    await page.locator('button[data-section="duties"]').click();
    await page.waitForSelector('[data-testid="driver-timeline"]', { timeout: 30_000 });

    const startTrigger = page.locator('[data-testid="duty-start-trigger"]');
    const endTrigger = page.locator('[data-testid="duty-end-trigger"]');

    await startTrigger.click();
    await page.locator('[data-testid="duty-start-option"]').first().click();
    await endTrigger.click();
    await page.locator('[data-testid="duty-end-option"]').first().click();
    await page.locator('[data-testid="duty-add-segment"]').click();

    await startTrigger.click();
    const startOptions = page.locator('[data-testid="duty-start-option"]');
    await startOptions.nth(1).click();
    await endTrigger.click();
    const endOptions = page.locator('[data-testid="duty-end-option"]');
    await endOptions.nth(1).click();
    await page.locator('[data-testid="duty-add-segment"]').click();

    await startTrigger.click();
    await page.locator('[data-testid="duty-start-option"]').first().click();
    await endTrigger.click();
    await endOptions.nth(1).click();

    await page.locator('button:has-text("回送を追加")').first().click();

    const deadheadLocator = page.locator('[data-testid="driver-timeline"] >> text=回送');
    await expect(deadheadLocator.first()).toBeVisible();

    await deadheadLocator.first().click();
    await page.locator('[data-testid="duty-delete-segment"]').click();
    await expect(deadheadLocator).toHaveCount(0);
  });
});
