import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';

test.describe.skip('G5: ブロック警告の可視化（Step2機能のためStep1ではskip）', () => {
  test('警告件数とツールチップを表示する', async ({ page }) => {
    await importSampleGtfs(page);

    await page.locator('button[data-section="blocks"]').click();

    const connectionPair = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: {
          plan?: {
            summaries?: Array<{
              blockId: string;
              warningCounts?: { warn?: number };
            }>;
          };
          getCandidates: (blockId: string) => Array<{ blockId: string; gapMinutes: number }>;
          connections: Array<unknown>;
        };
      };
      const manualPlan = testWindow.__TEST_BLOCKS_MANUAL_PLAN;
      if (!manualPlan?.plan?.summaries) {
        throw new Error('Manual plan data is unavailable.');
      }
      for (const summary of manualPlan.plan.summaries) {
        const candidates = manualPlan.getCandidates(summary.blockId);
        const shortGap = candidates.find((candidate) => candidate.gapMinutes < 10);
        if (shortGap) {
          return { fromBlockId: summary.blockId, toBlockId: shortGap.blockId };
        }
      }
      throw new Error('ギャップが 10 分未満の候補が見つかりませんでした。');
    });

    await page.selectOption('[data-testid="blocks-manual-from"]', connectionPair.fromBlockId);
    await page.selectOption('[data-testid="blocks-manual-to"]', connectionPair.toBlockId);
    await page.locator('[data-testid="blocks-manual-connect"]').click();

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const testWindow = window as typeof window & {
            __TEST_BLOCKS_MANUAL_PLAN?: { connections: Array<unknown> };
          };
          return testWindow.__TEST_BLOCKS_MANUAL_PLAN?.connections.length ?? 0;
        });
      })
      .toBeGreaterThan(0);

    await page.waitForSelector('[data-testid="blocks-warning-cell"]');
    const warningCell = page.locator('[data-testid="blocks-warning-cell"]').first();
    await expect(warningCell).toBeVisible();
    await expect(warningCell).toContainText('H ');
    await expect(warningCell).toContainText('S ');

    await warningCell.hover();
    const tooltip = page.locator('[data-testid^="blocks-warning-tooltip-"]').last();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('ターン間隔');
  });
});
