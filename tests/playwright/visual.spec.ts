import { test, expect } from '@playwright/test';

test.describe('Visual snapshots', () => {
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

