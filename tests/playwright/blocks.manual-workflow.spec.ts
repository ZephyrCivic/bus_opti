import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';

test.describe('G4: 手動操作ワークフロー', () => {
  test('ブロック連結と Duty 編集が手動操作で完結する', async ({ page }) => {
    await importSampleGtfs(page);

    // ---- Blocks: manual connection / undo ----
    await page.locator('button[data-section="blocks"]').click();

    const fromOptions = await page.locator('[data-testid="blocks-manual-from"] option').all();
    let selectedFrom: string | null = null;
    let selectedTo: string | null = null;
    for (const option of fromOptions) {
      const value = await option.getAttribute('value');
      if (!value) {
        continue;
      }
      await page.selectOption('[data-testid="blocks-manual-from"]', value);
      await page.waitForTimeout(100);
      const toOptions = await page.locator('[data-testid="blocks-manual-to"] option').all();
      for (const toOption of toOptions) {
        const toValue = await toOption.getAttribute('value');
        if (!toValue) {
          continue;
        }
        selectedFrom = value;
        selectedTo = toValue;
        break;
      }
      if (selectedFrom && selectedTo) {
        break;
      }
    }
    if (!selectedFrom || !selectedTo) {
      throw new Error('連結可能なブロック候補が見つかりません。');
    }

    await page.selectOption('[data-testid="blocks-manual-from"]', selectedFrom);
    await page.selectOption('[data-testid="blocks-manual-to"]', selectedTo);
    await page.locator('[data-testid="blocks-manual-connect"]').click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const testWindow = window as typeof window & {
          __TEST_BLOCKS_MANUAL_PLAN?: { connections: Array<unknown> };
        };
        return testWindow.__TEST_BLOCKS_MANUAL_PLAN?.connections.length ?? 0;
      });
    }).toBe(1);

    await page.locator('[data-testid="blocks-manual-undo"]').click();
    await expect.poll(async () => {
      return page.evaluate(() => {
        const testWindow = window as typeof window & {
          __TEST_BLOCKS_MANUAL_PLAN?: { connections: Array<unknown> };
        };
        return testWindow.__TEST_BLOCKS_MANUAL_PLAN?.connections.length ?? 0;
      });
    }).toBe(0);

    // ---- Duties: add / move / delete / undo / redo ----
    await page.locator('button[data-section="duties"]').click();

    const dutyConfig = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __TEST_DUTY_PLAN?: {
          plan: {
            csvRows: Array<{
              blockId: string;
              tripId: string;
              seq: number;
            }>;
          };
        };
      };
      const planData = testWindow.__TEST_DUTY_PLAN?.plan;
      if (!planData) {
        throw new Error('Duty plan data is not available.');
      }
      const grouped = new Map<string, Array<{ tripId: string; seq: number }>>();
      for (const row of planData.csvRows) {
        const list = grouped.get(row.blockId) ?? [];
        list.push({ tripId: row.tripId, seq: row.seq });
        grouped.set(row.blockId, list);
      }
      const entries = [...grouped.entries()]
        .map(([blockId, rows]) => ({ blockId, rows: rows.sort((a, b) => a.seq - b.seq) }))
        .filter((entry) => entry.rows.length > 0);
      if (entries.length < 2) {
        throw new Error('十分な行路データがありません。');
      }
      const primary = entries.sort((a, b) => b.rows.length - a.rows.length)[0]!;
      const target = entries.find((entry) => entry.blockId !== primary.blockId) ?? entries[1]!;
      return {
        primaryBlockId: primary.blockId,
        startTripId: primary.rows[0]!.tripId,
        endTripId: primary.rows[primary.rows.length - 1]!.tripId,
        targetBlockId: target.blockId,
        targetTripId: target.rows[0]!.tripId,
      };
    });

    await page.locator(`[data-testid="duty-block-row"][data-block-id="${dutyConfig.primaryBlockId}"]`).click();

    await page.locator('[data-testid="duty-start-trigger"]').click();
    await page.locator(`[data-testid="duty-start-option"][data-trip-id="${dutyConfig.startTripId}"]`).click();
    await page.locator('[data-testid="duty-end-trigger"]').click();
    await page.locator(`[data-testid="duty-end-option"][data-trip-id="${dutyConfig.endTripId}"]`).click();

    await page.locator('[data-testid="duty-add-segment"]').click();
    await expect(page.locator('[data-duty-id="DUTY_001"]')).toBeVisible();

    await page.locator('[data-testid="duty-segment"]').first().click();
    await page.locator(`[data-testid="duty-block-row"][data-block-id="${dutyConfig.targetBlockId}"]`).click();

    await page.locator('[data-testid="duty-start-trigger"]').click();
    await page.locator(`[data-testid="duty-start-option"][data-trip-id="${dutyConfig.targetTripId}"]`).click();
    await page.locator('[data-testid="duty-end-trigger"]').click();
    await page.locator(`[data-testid="duty-end-option"][data-trip-id="${dutyConfig.targetTripId}"]`).click();

    await page.locator('[data-testid="duty-segment"]').first().click();
    await page.locator('[data-testid="duty-move-segment"]').click();
    await expect(page.locator('[data-testid="duty-segment"]').first()).toHaveAttribute('data-block-id', dutyConfig.targetBlockId);

    await page.locator('[data-testid="duty-segment"]').first().click();
    await page.locator('[data-testid="duty-delete-segment"]').click();
    await expect(page.locator('[data-testid="duty-empty-message"]')).toBeVisible();

    await page.locator('[data-testid="duty-undo"]').click();
    await expect(page.locator('[data-duty-id="DUTY_001"]')).toBeVisible();

    await page.locator('[data-testid="duty-redo"]').click();
    await expect(page.locator('[data-testid="duty-empty-message"]')).toBeVisible();
  });
});
