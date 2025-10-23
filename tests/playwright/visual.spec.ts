import { test, expect } from '@playwright/test';

const appStepEnv = process.env.APP_STEP ?? process.env.VITE_APP_STEP ?? '1';
const isStepOne = String(appStepEnv).trim() === '1';

test.describe('Visual snapshots', () => {
  test.skip(isStepOne, 'Step1 では KPI/警告 UI を非表示にしており既存スナップショットと整合しないためスキップ。');

  test('home page layout', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main');
    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });

  test('navigate: blocks section', async ({ page }) => {
    await page.goto('/');
    // Prefer desktop nav first
    const navBtn = page.locator('aside nav button[data-section="blocks"]').first();
    if (await navBtn.count()) {
      await navBtn.click();
    } else {
      // Fallback to mobile select
      const select = page.locator('#app-mobile-nav');
      await select.selectOption('blocks');
    }
    await page.waitForSelector('main');
    await expect(page).toHaveScreenshot('blocks.png', { fullPage: true });
  });
});
