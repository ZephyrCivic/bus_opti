import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';
import { injectDutyWithThresholds, prepareLongDutyForWarnings, waitForDutyTestHooks } from './utils/dutyHelpers';

async function ensureWarningsPresent(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('button[data-section="dashboard"]').click();
  await page.waitForSelector('text=重大', { timeout: 10_000 });
  await page.waitForSelector('text=注意', { timeout: 10_000 });
}

test.describe.skip('G1: 保存導線（Step2ダッシュボード依存のためskip）', () => {
  test('警告があっても保存ボタンは常時有効', async ({ page }) => {
    await importSampleGtfs(page);
    await waitForDutyTestHooks(page);
    const payload = await prepareLongDutyForWarnings(page);
    await injectDutyWithThresholds(page, payload, {
      maxContinuousMinutes: Math.max(1, payload.durationMinutes - 10),
      maxDailyMinutes: Math.max(1, payload.durationMinutes - 20),
    });

    await ensureWarningsPresent(page);

    await page.locator('button[data-section="diff"]').click();
    await expect(page.locator('[data-section="diff"][data-active="true"]')).toBeVisible();

    const savedButton = page.getByRole('button', { name: '取込結果を保存' });
    const projectButton = page.getByRole('button', { name: 'プロジェクト保存' });

    await expect(savedButton).toBeEnabled();
    await expect(projectButton).toBeEnabled();

    const sections = ['import', 'explorer', 'blocks', 'duties', 'dashboard', 'manual'] as const;
    for (const sectionId of sections) {
      await page.locator(`button[data-section="${sectionId}"]`).click();
      await expect(page.locator(`button[data-section="diff"]`)).toBeVisible();
    }
  });
});
