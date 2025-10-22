import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

test('Explorer interactions are responsive', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ = true;
  });

  await page.goto('/bus_opti/');

  await page.locator('input[type="file"]').first().setInputFiles(path.join(ROOT_DIR, 'data', 'GTFS-JP(gunmachuo).zip'));
  await page.waitForSelector('table:has-text("trips.txt")', { timeout: 30_000 });

  await page.locator('button[data-section="explorer"]').click();
  await page.waitForFunction(() => Boolean((window as typeof window & { __EXPLORER_TEST?: unknown }).__EXPLORER_TEST), {
    timeout: 30_000,
  });

  const summary = await page.evaluate(() => {
    const hooks = (window as typeof window & {
      __EXPLORER_TEST?: {
        getDatasetSummary(): { routeCount: number; stopCount: number };
      };
    }).__EXPLORER_TEST;
    if (!hooks) {
      throw new Error('Explorer dataset hooks are not available.');
    }
    return hooks.getDatasetSummary();
  });
  expect(summary.routeCount, 'Route options should be available after import').toBeGreaterThan(0);
  expect(summary.stopCount, 'Stops should be present after import').toBeGreaterThan(0);

  const results = await page.evaluate(async () => {
    const hooks = (window as typeof window & {
      __EXPLORER_TEST?: {
        measurePan(): Promise<number>;
        measureZoom(): Promise<number>;
      };
    }).__EXPLORER_TEST;
    if (!hooks) {
      throw new Error('Explorer test hooks are not available.');
    }
    const panMs = await hooks.measurePan();
    const zoomMs = await hooks.measureZoom();
    return { panMs, zoomMs };
  });

  console.info(
    JSON.stringify({
      explorerPanMs: Number(results.panMs.toFixed(2)),
      explorerZoomMs: Number(results.zoomMs.toFixed(2)),
    }),
  );

  expect(results.panMs, `Pan latency ${results.panMs.toFixed(1)}ms exceeded 1s`).toBeLessThan(1_000);
  expect(results.zoomMs, `Zoom latency ${results.zoomMs.toFixed(1)}ms exceeded 1s`).toBeLessThan(1_000);
});
