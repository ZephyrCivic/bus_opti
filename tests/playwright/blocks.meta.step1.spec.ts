import { expect, test } from '@playwright/test';
import { readDownload } from './utils/downloadHelpers';

import { importSampleGtfs } from './utils/importHelpers';
import { waitForManualBlocksPlan } from './utils/blocksHelpers';

test('Block metadata is recorded and exported in Step1', async ({ page }) => {
  await importSampleGtfs(page);
  await page.locator('button[data-section="blocks"]').click();

  await waitForManualBlocksPlan(page);
  const blockRows = page.locator('table tbody tr[data-block-id]');
  if (await blockRows.count() === 0) {
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: { plan: { unassignedTripIds: string[] } };
        __TEST_BLOCKS_CREATE_FROM_TRIP?: (tripId: string) => boolean;
      };
      const firstTrip = testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan.unassignedTripIds[0];
      if (firstTrip) {
        testWindow.__TEST_BLOCKS_CREATE_FROM_TRIP?.(firstTrip);
      }
    });
    await page.waitForFunction(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: { plan: { summaries: unknown[] } };
      };
      return (testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan.summaries.length ?? 0) > 0;
    });
  }

  const firstRow = blockRows.first();
  await expect(firstRow).toBeVisible();
  const blockId = await firstRow.getAttribute('data-block-id');
  expect(blockId).not.toBeNull();

  const vehicleTypeInput = firstRow.locator('input[placeholder="例: M"]');
  const vehicleIdInput = firstRow.locator('input[placeholder="例: BUS_001"]');

  await vehicleTypeInput.evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, 'TYPE_E2E');

  await vehicleIdInput.evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, 'BUS_E2E_01');

  await expect(vehicleTypeInput).toHaveValue('TYPE_E2E');
  await expect(vehicleIdInput).toHaveValue('BUS_E2E_01');

  await page.locator('button[data-section="manual"]').click();
  await page.locator('button[data-section="blocks"]').click();
  await waitForManualBlocksPlan(page);
  const refreshedRow = page.locator(`table tbody tr[data-block-id='${blockId}']`).first();
  await expect(refreshedRow.locator('input[placeholder="例: M"]')).toHaveValue('TYPE_E2E');
  await expect(refreshedRow.locator('input[placeholder="例: BUS_001"]')).toHaveValue('BUS_E2E_01');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'blocks_meta.csv を出力' }).click();
  const confirmDialog = page.getByTestId('export-confirmation-dialog');
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.locator('[data-testid="export-confirm-continue"]').click();
  const download = await downloadPromise;
  const csv = await readDownload(download);

  expect(csv).toContain('block_id,vehicle_type_id,vehicle_id');
  expect(csv).toContain(`${blockId},TYPE_E2E,BUS_E2E_01`);
});
