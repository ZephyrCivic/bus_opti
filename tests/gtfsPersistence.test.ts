/**
 * tests/gtfsPersistence.test.ts
 * Round-trip test for SavedGtfsImport serialization.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { toSaved, fromSaved, toSavedProject, fromSavedProject } from '../src/services/import/gtfsPersistence';
import type { ManualInputs } from '../src/types';
import type { GtfsImportResult } from '../src/services/import/gtfsParser';

const sample: GtfsImportResult = {
  sourceName: 'sample.zip',
  importedAt: new Date('2025-09-01T12:34:56Z'),
  tables: {
    'stops.txt': { name: 'stops.txt', rows: [{ stop_id: 'A', stop_name: 'Alpha' }] as any },
    'trips.txt': { name: 'trips.txt', rows: [{ trip_id: 'T1', route_id: 'R1', service_id: 'S1' }] as any },
    'stop_times.txt': { name: 'stop_times.txt', rows: [{ trip_id: 'T1', stop_id: 'A', stop_sequence: '1' }] as any },
  },
  missingFiles: ['shapes.txt'],
  summary: [
    { metric: 'Stops', value: 1, description: 'stops rows' },
    { metric: 'Trips', value: 1, description: 'trips rows' },
  ],
  alerts: [],
};

test('gtfsPersistence round-trip', () => {
  const saved = toSaved(sample);
  const restored = fromSaved(saved);
  assert.equal(restored.sourceName, sample.sourceName);
  assert.equal(restored.importedAt.toISOString(), sample.importedAt.toISOString());
  assert.ok('stops.txt' in restored.tables);
  assert.equal(restored.tables['stops.txt'].rows.length, 1);
  assert.equal(restored.summary.length, sample.summary.length);
});

test('projectPersistence round-trip (GTFS + manual)', () => {
  const manual: ManualInputs = {
    depots: [{ depotId: 'D1', name: 'Depot A', lat: 35.0, lon: 139.0, minTurnaroundMin: 10 }],
    reliefPoints: [{ reliefId: 'RP1', name: 'Relief', lat: 35.1, lon: 139.1, stopId: 'A', walkTimeToStopMin: 5 }],
    deadheadRules: [{ fromId: 'D1', toId: 'RP1', mode: 'walk', travelTimeMin: 6 }],
    drivers: [{ driverId: 'DRV1', name: 'Driver One' }],
    linking: { enabled: true, minTurnaroundMin: 10, maxConnectRadiusM: 100, allowParentStation: true },
  };
  const saved = toSavedProject(sample, manual);
  const restored = fromSavedProject(saved);
  // GTFS
  assert.equal(restored.gtfs.sourceName, sample.sourceName);
  assert.equal(restored.gtfs.tables['stops.txt'].rows.length, 1);
  // Manual
  assert.equal(restored.manual.depots.length, 1);
  assert.equal(restored.manual.reliefPoints.length, 1);
  assert.equal(restored.manual.deadheadRules.length, 1);
  assert.equal(restored.manual.drivers.length, 1);
  assert.equal(restored.manual.linking.minTurnaroundMin, 10);
  assert.equal(restored.manual.linking.enabled, true);
});
