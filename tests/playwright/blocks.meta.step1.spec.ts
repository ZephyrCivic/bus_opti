import { expect, test } from '@playwright/test';
import { readDownload } from './utils/downloadHelpers';

import { importSampleGtfs } from './utils/importHelpers';
import { waitForManualBlocksPlan } from './utils/blocksHelpers';

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    console.log(`[console:${message.type()}] ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error}`);
  });
});

test('Block metadata is recorded and exported in Step1', async ({ page }) => {
  await importSampleGtfs(page);
  await page.locator('button[data-section="blocks"]').click();

  await waitForManualBlocksPlan(page);
  const firstRow = page.locator('table tbody tr[data-block-id]').first();
  await expect(firstRow).toBeVisible();

  const blockId = await firstRow.getAttribute('data-block-id');
  expect(blockId).not.toBeNull();

  const vehicleTypeInput = firstRow.locator('input[placeholder="例: M"]');
  const vehicleIdInput = firstRow.locator('input[placeholder="例: BUS_001"]');

  await vehicleTypeInput.fill('TYPE_E2E');
  await vehicleIdInput.fill('BUS_E2E_01');

  await expect.poll(async () => {
    return page.evaluate((targetBlockId) => {
      const testWindow = window as typeof window & {
        __TEST_MANUAL_INPUTS?: { blockMeta?: Record<string, { vehicleTypeId?: string; vehicleId?: string }> };
      };
      const meta = testWindow.__TEST_MANUAL_INPUTS?.blockMeta ?? {};
      return meta[targetBlockId ?? ''] ?? null;
    }, blockId);
  }).toEqual({ vehicleTypeId: 'TYPE_E2E', vehicleId: 'BUS_E2E_01' });

  await page.locator('button[data-section="manual"]').click();
  await page.locator('button[data-section="blocks"]').click();

  const refreshedRow = page.locator(`table tbody tr[data-block-id="${blockId}"]`).first();
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
