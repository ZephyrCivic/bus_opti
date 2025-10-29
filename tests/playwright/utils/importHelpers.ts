import type { Page } from '@playwright/test';
import { SAMPLE_GTFS_ZIP } from './testData';

export async function importSampleGtfs(page: Page, options: { clearStorage?: boolean } = {}): Promise<void> {
  if (options.clearStorage !== false) {
    await page.addInitScript(() => {
      try {
        window.localStorage?.clear();
      } catch {
        // ignore storage errors in tests
      }
    });
  }
  const targetPath = '/bus_opti/';
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await page.goto(targetPath);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
    }
  }
  if (lastError) {
    throw lastError;
  }
  const fileInput = page.locator('input[type="file"][accept=".zip"]');
  await fileInput.setInputFiles(SAMPLE_GTFS_ZIP);
  await page.waitForSelector('text=取込サマリー', { timeout: 60_000 });
}
