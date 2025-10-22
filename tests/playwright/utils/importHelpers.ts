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
  await page.goto('/bus_opti/');
  const fileInput = page.locator('input[type="file"][accept=".zip"]');
  await fileInput.setInputFiles(SAMPLE_GTFS_ZIP);
  await page.waitForSelector('text=取込サマリー', { timeout: 60_000 });
}
