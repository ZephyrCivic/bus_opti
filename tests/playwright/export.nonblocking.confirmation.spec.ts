import { expect, test } from '@playwright/test';

import { importSampleGtfs } from './utils/importHelpers';

test.describe('G8: 非ブロッキング出力確認', () => {
  test('確認ダイアログ表示中もナビゲーションできる', async ({ page }) => {
    await importSampleGtfs(page);

    await page.locator('button[data-section="diff"]').click();
    await expect(page.locator('button[data-section="diff"][data-active="true"]')).toBeVisible();

    await page.getByRole('button', { name: '取込結果を保存' }).click();

    const dialog = page.getByRole('dialog', { name: '取込結果を保存しますか？' });
    await expect(dialog).toBeVisible();

    // ダイアログ表示中でも他セクションへ移動できる（非モーダル確認の証明）
    await page.locator('button[data-section="import"]').click();
    await expect(page.locator('button[data-section="import"][data-active="true"]')).toBeVisible();

    const dialogTitle = await page.evaluate(() => (window as typeof window & { __EXPORT_CONFIRM__?: string | null }).__EXPORT_CONFIRM__ ?? null);
    expect(dialogTitle).toBe('取込結果を保存しますか？');

    await dialog.locator('[data-testid="export-confirm-cancel"]').click();
    await expect(dialog).toBeHidden();
  });
});
