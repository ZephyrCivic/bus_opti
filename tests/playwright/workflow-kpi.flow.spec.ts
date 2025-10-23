import { expect, test } from '@playwright/test';

import { importSampleGtfs } from './utils/importHelpers';
import { injectDutyWithThresholds, prepareLongDutyForWarnings, waitForDutyTestHooks } from './utils/dutyHelpers';

const appStepEnv = process.env.APP_STEP ?? process.env.VITE_APP_STEP ?? '1';
// Step1 では KPI UI を非表示にするため、KPI シナリオはスキップする。
const isStepOne = String(appStepEnv).trim() === '1';

test.describe('G10: ワークフロー KPI 計測', () => {
  test.skip(isStepOne, 'Step1 では KPI カードを非表示にしているため、このシナリオは無効。');

  test('保存完了後にワークフローKPIカードが更新される', async ({ page }) => {
    await importSampleGtfs(page);
    await waitForDutyTestHooks(page);
    const payload = await prepareLongDutyForWarnings(page);
    await injectDutyWithThresholds(page, payload);

    // 警告確認ステージ（ダッシュボード閲覧）
    await page.locator('button[data-section="dashboard"]').click();
    await expect(page.getByText('ワークフロー KPI ログ')).toBeVisible();

    // 差分画面で保存を実行
    await page.locator('button[data-section="diff"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '取込結果を保存' }).click();
    const dialog = page.getByRole('dialog', { name: '取込結果を保存しますか？' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '続行して出力' }).click();
    await downloadPromise;
    await expect(dialog).toBeHidden();

    // ダッシュボードに戻ってKPI更新を確認
    await page.locator('button[data-section="dashboard"]').click();
    await expect(page.getByText('計測 1 件')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('連結→保存 (中央値)').locator('..')).toContainText('秒');
    await expect(page.getByText('直近の計測')).toBeVisible();
  });
});
