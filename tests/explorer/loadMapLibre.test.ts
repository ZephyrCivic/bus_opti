/**
 * tests/explorer/loadMapLibre.test.ts
 * Ensures MapLibre dynamic import stays cached and only resolves once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadMapLibre,
  restoreMapLibreImporter,
  setMapLibreImporter,
} from '../../src/features/explorer/loadMapLibre';

test('loadMapLibre caches the importer promise', async (t) => {
  t.after(() => {
    restoreMapLibreImporter();
  });

  let loadCount = 0;
  const fakeModule = {
    Map: class {},
    NavigationControl: class {},
  } as unknown as typeof import('maplibre-gl');

  setMapLibreImporter(async () => {
    loadCount += 1;
    return fakeModule;
  });

  const first = await loadMapLibre();
  const second = await loadMapLibre();

  assert.strictEqual(loadCount, 1, 'dynamic importer should run once');
  assert.strictEqual(first, fakeModule);
  assert.strictEqual(second, fakeModule);
});
