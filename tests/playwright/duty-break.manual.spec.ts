import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';
import { waitForDutyTestHooks } from './utils/dutyHelpers';

const appStepEnv = process.env.APP_STEP ?? process.env.VITE_APP_STEP ?? '1';
const isStepOne = String(appStepEnv).trim() === '1';

test.describe('S1: Duty 休憩操作', () => {
  test.skip(!isStepOne, 'Step2 以降では別タスクで休憩UIを再構成予定のため、このテストはStep1専用。');

  test('休憩を挿入してすぐに削除できる', async ({ page }) => {
    test.setTimeout(45_000);
    page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
    page.on('pageerror', (error) => console.log('[pageerror]', error.message));
    await importSampleGtfs(page);
    await waitForDutyTestHooks(page);

    await page.locator('button[data-section="duties"]').click();
    await page.waitForSelector('[data-testid="driver-timeline"]', { timeout: 60_000 });

    const startTrigger = page.locator('[data-testid="duty-start-trigger"]');
    const endTrigger = page.locator('[data-testid="duty-end-trigger"]');

    // 1本目の区間（最初の便のみ）
    await startTrigger.click();
    await page.locator('[data-testid="duty-start-option"]').first().click();
    await endTrigger.click();
    await page.locator('[data-testid="duty-end-option"]').first().click();
    await page.locator('[data-testid="duty-add-segment"]').click();

    // 2本目の区間（同一ブロック内の次の便ではなく、間隔を空けた便にする）
    await startTrigger.click();
    const startOptions = page.locator('[data-testid="duty-start-option"]');
    const optionCount = await startOptions.count();
    expect(optionCount).toBeGreaterThan(2);
    await startOptions.nth(2).click();
    await endTrigger.click();
    const endOptions = page.locator('[data-testid="duty-end-option"]');
    await endOptions.nth(2).click();
    await page.locator('[data-testid="duty-add-segment"]').click();

    // 休憩対象の開始（最初の区間の終端）と再開（2本目の区間の開始）を選択
    await startTrigger.click();
    await page.locator('[data-testid="duty-start-option"]').first().click();
    await endTrigger.click();
    await endOptions.nth(2).click();

    await page.locator('button:has-text("休憩を追加")').click();

    const breakLocator = page.locator('[data-testid="driver-timeline"] >> text=休憩');
    await expect(breakLocator.first()).toBeVisible();

    // 休憩を選択して削除
    await breakLocator.first().click();
    await page.locator('[data-testid="duty-delete-segment"]').click();

    await expect(breakLocator).toHaveCount(0);
  });
});

