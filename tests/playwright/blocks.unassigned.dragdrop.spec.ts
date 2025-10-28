import { expect, test } from '@playwright/test';

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

test('Step1 で未割当便をドラッグして新しい行路を作成できる', async ({ page }) => {
  await importSampleGtfs(page);
  await page.locator('button[data-section="blocks"]').click();

  await waitForManualBlocksPlan(page);

  const unassignedTable = page.getByTestId('blocks-unassigned-table');
  await expect(unassignedTable).toBeVisible();

  const unassignedRows = unassignedTable.locator('tbody tr');
  await expect(unassignedRows.first()).toBeVisible();

  const firstTripRow = unassignedRows.first();
  const firstTripId = (await firstTripRow.locator('td').first().innerText()).trim();
  expect(firstTripId).not.toHaveLength(0);

  const dropTarget = page.getByTestId('blocks-view-root');
  await expect(dropTarget).toBeVisible();

  const initialPlanState = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __TEST_BLOCKS_MANUAL_PLAN?: {
        plan: { summaries: Array<{ blockId: string }>; unassignedTripIds: string[] };
      };
    };
    return {
      summaryCount: testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan?.summaries?.length ?? 0,
      unassignedCount: testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan?.unassignedTripIds?.length ?? 0,
    };
  });
  expect(initialPlanState.summaryCount).toBe(0);
  expect(initialPlanState.unassignedCount).toBeGreaterThan(0);
  const expectedUnassignedCount = Math.max(0, initialPlanState.unassignedCount - 1);

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await firstTripRow.dispatchEvent('dragstart', { dataTransfer });
  await dropTarget.dispatchEvent('dragenter', { dataTransfer, bubbles: true });
  await dropTarget.dispatchEvent('dragover', { dataTransfer, bubbles: true });
  await dropTarget.dispatchEvent('drop', { dataTransfer, bubbles: true });
  await firstTripRow.dispatchEvent('dragend', { dataTransfer });
  await dataTransfer.dispose();

  await expect(page.getByText('新しい行路', { exact: false })).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: {
          plan: { summaries: Array<{ blockId: string }>; unassignedTripIds: string[] };
        };
      };
      return {
        summaryCount: testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan?.summaries?.length ?? 0,
        unassignedCount: testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan?.unassignedTripIds?.length ?? 0,
      };
    });
  }).toEqual({ summaryCount: 1, unassignedCount: expectedUnassignedCount });

  await expect(page.locator('table tbody tr[data-block-id]')).toHaveCount(1);
});
