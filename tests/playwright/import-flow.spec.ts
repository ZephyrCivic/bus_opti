import path from 'node:path';
import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SAMPLE_GTFS_PATH = path.resolve(process.cwd(), 'data/GTFS-JP(gunmachuo).zip');
const TELEMETRY_STORAGE_KEY = 'bus-opti.telemetry.events';

const SAVED_PROJECT_PAYLOAD = {
  projectVersion: 1,
  gtfs: {
    version: 1,
    sourceName: 'sample-saved-project.json',
    importedAt: '2025-10-01T00:00:00.000Z',
    tables: {
      'routes.txt': {
        name: 'routes.txt',
        rows: [
          {
            route_id: 'R1',
            route_short_name: 'R1',
            route_long_name: '市内循環線',
            route_color: '004C97',
            route_text_color: 'FFFFFF',
          },
        ],
      },
      'stops.txt': {
        name: 'stops.txt',
        rows: [
          { stop_id: 'S1', stop_name: '中央駅', stop_lat: '35.0000', stop_lon: '139.0000' },
          { stop_id: 'S2', stop_name: '市役所前', stop_lat: '35.0100', stop_lon: '139.0100' },
        ],
      },
      'trips.txt': {
        name: 'trips.txt',
        rows: [
          {
            route_id: 'R1',
            service_id: 'WKDAY',
            trip_id: 'T1',
            shape_id: 'shape-1',
            trip_headsign: '中央駅ゆき',
            direction_id: '0',
          },
        ],
      },
      'stop_times.txt': {
        name: 'stop_times.txt',
        rows: [
          {
            trip_id: 'T1',
            stop_sequence: '1',
            stop_id: 'S1',
            arrival_time: '07:00:00',
            departure_time: '07:00:00',
          },
          {
            trip_id: 'T1',
            stop_sequence: '2',
            stop_id: 'S2',
            arrival_time: '07:12:00',
            departure_time: '07:12:00',
          },
        ],
      },
      'shapes.txt': {
        name: 'shapes.txt',
        rows: [
          { shape_id: 'shape-1', shape_pt_lat: '35.0000', shape_pt_lon: '139.0000', shape_pt_sequence: '1' },
          { shape_id: 'shape-1', shape_pt_lat: '35.0100', shape_pt_lon: '139.0100', shape_pt_sequence: '2' },
        ],
      },
    },
    missingFiles: [],
    summary: [
      { metric: '停留所', value: 2, description: '停留所数' },
      { metric: '便数', value: 1, description: '取込便数' },
    ],
    alerts: [],
  },
    manual: {
      depots: [],
      reliefPoints: [],
      deadheadRules: [],
      drivers: [],
      laborRules: [],
      vehicleTypes: [],
      vehicles: [],
      blockMeta: {},
      linking: {
        enabled: true,
        minTurnaroundMin: 10,
        maxConnectRadiusM: 100,
        allowParentStation: true,
      },
    },
};

const SAVED_PROJECT_FILE = {
  name: 'sample-project.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(SAVED_PROJECT_PAYLOAD, null, 2)),
};

async function getTelemetryEvents(page: Page): Promise<Array<{ type: string; payload?: Record<string, unknown> }>> {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    try {
      return raw ? (JSON.parse(raw) as Array<{ type: string; payload?: Record<string, unknown> }>) : [];
    } catch {
      return [];
    }
  }, TELEMETRY_STORAGE_KEY);
}

test.describe('Import 導線', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage?.clear();
      } catch {
        // ignore
      }
    });
    await page.goto('/bus_opti/');
  });

  test('GTFS ZIP を読み込む導線でサマリー表示と手動入力セクションへ遷移できる', async ({ page }) => {
    test.setTimeout(120_000);

    const zipInput = page.locator('input[type="file"][accept=".zip"]');
    await expect(zipInput).toBeHidden();

    await zipInput.setInputFiles(SAMPLE_GTFS_PATH);

    await expect(page.getByText('状態: 完了', { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('取込サマリー', { exact: true })).toBeVisible();
    await expect(page.getByText('行路編集対象の便（系統）の選択')).toBeVisible();

    const selectionLocator = page.getByText('選択中:', { exact: false });
    await expect(selectionLocator).toBeVisible();
    const selectionText = await selectionLocator.innerText();
    expect(selectionText).toMatch(/選択中: \d+ \/ \d+ 便（系統）/);

    await expect.poll(async () => {
      const events = await getTelemetryEvents(page);
      return events.filter((event) => event.type === 'import.route-filter.updated').length;
    }).toBeGreaterThan(0);

    const manualButton = page.getByRole('main').getByRole('button', { name: '制約条件（手動入力）' });
    await expect(manualButton).toBeEnabled();
    await manualButton.click();

    await expect(page.locator('[data-section="manual"][data-active="true"]').first()).toBeVisible();

    await expect.poll(async () => {
      const events = await getTelemetryEvents(page);
      return events.filter((event) => event.type === 'import.open-manual').length;
    }).toBeGreaterThan(0);
  });

  test('保存データから再開する導線でサマリー表示と手動入力セクションへの導線が動作する', async ({ page }) => {
    const savedInput = page.locator('input[type="file"][accept="application/json,.json"]');
    await expect(savedInput).toBeHidden();

    await savedInput.setInputFiles(SAVED_PROJECT_FILE);

    await expect(page.getByText('状態: 完了', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('取込サマリー', { exact: true })).toBeVisible();
    await expect(page.getByText('選択中: 1 / 1 便（系統）')).toBeVisible();

    await expect.poll(async () => {
      const events = await getTelemetryEvents(page);
      return events.filter((event) => event.type === 'import.route-filter.updated').length;
    }).toBeGreaterThan(0);

    const manualButton = page.getByRole('main').getByRole('button', { name: '制約条件（手動入力）' });
    await expect(manualButton).toBeEnabled();
    await manualButton.click();

    await expect(page.locator('[data-section="manual"][data-active="true"]').first()).toBeVisible();

    await expect.poll(async () => {
      const events = await getTelemetryEvents(page);
      return events.filter((event) => event.type === 'import.open-manual').length;
    }).toBeGreaterThan(0);

    const events = await getTelemetryEvents(page);
    const lastRouteEvent = [...events].reverse().find((event) => event.type === 'import.route-filter.updated');
    expect(lastRouteEvent?.payload?.routeCount).toBe(1);
    expect(lastRouteEvent?.payload?.sourceName).toBe('sample-saved-project.json');
  });
});
