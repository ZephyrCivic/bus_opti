import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';
import { waitForManualBlocksPlan } from './utils/blocksHelpers';

test.describe('G2: 自動確定なし', () => {
  test('ブロック連結は手動操作がない限り行われない', async ({ page }) => {
    await importSampleGtfs(page);
    await page.locator('button[data-section="blocks"]').click();

    const snapshot = await waitForManualBlocksPlan(page);
    expect(snapshot.summaries.length).toBe(0);
    expect(snapshot.unassignedTripIds.length).toBeGreaterThan(0);
    expect(snapshot.connections).toHaveLength(0);

    await page.waitForTimeout(2_000);
    const after = await waitForManualBlocksPlan(page);
    expect(after.connections).toHaveLength(0);
    expect(after.summaries.length).toBe(0);
    expect(after.unassignedTripIds.length).toBeGreaterThan(0);
  });
});
