import { expect, test } from '@playwright/test';

import { importSampleGtfs } from './utils/importHelpers';
import { waitForManualBlocksPlan } from './utils/blocksHelpers';
import { waitForDutyTestHooks } from './utils/dutyHelpers';
import { readDownload } from './utils/downloadHelpers';

async function addDriver(page: import('@playwright/test').Page, driverId: string, name: string): Promise<void> {
  await page.locator('#driver-id').fill(driverId);
  await page.locator('#driver-name').fill(name);
  const driversCard = page.getByTestId('manual-drivers-card').first();
  await expect(driversCard).toBeVisible();
  await driversCard.scrollIntoViewIfNeeded();
  await driversCard.getByRole('button', { name: '追加' }).click();
  await expect(driversCard.locator('table')).toContainText(driverId);
}

test('Step1 基本フロー: 未割当便確認→行路連結→Duty作成→driver_id入力→CSV出力', async ({ page }) => {
  await importSampleGtfs(page);

  await page.locator('button[data-section="manual"]').click();
  await addDriver(page, 'DRIVER_E2E', 'テスト乗務員');

  await page.locator('button[data-section="blocks"]').click();
  await waitForManualBlocksPlan(page);
  const getManualSummaryCount = async () =>
    page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: { plan: { summaries: Array<unknown> } };
      };
      return testWindow.__TEST_BLOCKS_MANUAL_PLAN?.plan.summaries.length ?? 0;
    });

  const createBlockFromUnassignedViaUi = async () => {
    const beforeCount = await getManualSummaryCount();
    const firstRow = page.locator('[data-testid="blocks-unassigned-table"] tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.getByRole('button', { name: '新規行路', exact: true }).click();
    await expect.poll(getManualSummaryCount).toBeGreaterThan(beforeCount);
  };

  // Create blocks until at least一組の連結候補が見つかる
  await createBlockFromUnassignedViaUi();
  let connection: { from: string; to: string } | null = null;
  for (let attempts = 0; attempts < 10; attempts += 1) {
    connection = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: {
          plan: { summaries: Array<{ blockId: string }> };
          getCandidates: (blockId: string) => Array<{ blockId: string }>;
        };
      };
      const snapshot = testWindow.__TEST_BLOCKS_MANUAL_PLAN;
      if (!snapshot) {
        throw new Error('Manual plan snapshot is unavailable.');
      }
      const [firstSummary] = snapshot.plan.summaries;
      if (!firstSummary) {
        return null;
      }
      const candidates = snapshot.getCandidates(firstSummary.blockId);
      const target = candidates[0];
      if (!target) {
        return null;
      }
      return { from: firstSummary.blockId, to: target.blockId };
    });
    if (connection) {
      break;
    }
    await createBlockFromUnassignedViaUi();
  }
  if (!connection) {
    throw new Error('Unable to find connectable blocks after multiple attempts.');
  }

  await page.selectOption('[data-testid="blocks-manual-from"]', connection.from);
  await page.selectOption('[data-testid="blocks-manual-to"]', connection.to);
  await page.locator('[data-testid="blocks-manual-connect"]').click();

  await expect.poll(async () =>
    page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_BLOCKS_MANUAL_PLAN?: { connections: Array<unknown> };
      };
      return testWindow.__TEST_BLOCKS_MANUAL_PLAN?.connections.length ?? 0;
    }),
  ).toBeGreaterThan(0);

  await page.locator('button[data-section="duties"]').click();
  await waitForDutyTestHooks(page);
  await page.fill('#default-driver', 'DRIVER_E2E');

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: {
        plan: { csvRows: Array<{ blockId: string; tripId: string }> };
        tripIndex: unknown;
      };
      __TEST_DUTY_ACTIONS?: {
        addSegment: (
          input: {
            blockId: string;
            startTripId: string;
            endTripId: string;
            dutyId?: string;
            driverId?: string;
          },
          index: unknown,
        ) => void;
      };
    };
    const plan = testWindow.__TEST_DUTY_PLAN;
    const actions = testWindow.__TEST_DUTY_ACTIONS;
    if (!plan || !actions) {
      throw new Error('Duty plan or actions are unavailable.');
    }
    const firstRow = plan.plan.csvRows[0];
    if (!firstRow) {
      throw new Error('No trips available for duty creation.');
    }
    actions.addSegment(
      {
        blockId: firstRow.blockId,
        startTripId: firstRow.tripId,
        endTripId: firstRow.tripId,
        driverId: 'DRIVER_E2E',
      },
      plan.tripIndex,
    );
  });

  const dutyItem = page.locator('[data-testid="duty-item"]').first();
  await expect(dutyItem).toBeVisible();
  await expect(dutyItem).toContainText('DRIVER_E2E');

  const dutyExportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^CSV を書き出す$/ }).first().click();
  const confirmDialog = page.getByTestId('export-confirmation-dialog');
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.locator('[data-testid="export-confirm-continue"]').click();
  const dutyExport = await dutyExportDownload;
  const dutyCsv = await readDownload(dutyExport);
  expect(dutyCsv).toContain('driver_id');
  expect(dutyCsv).toContain('DRIVER_E2E');
});
