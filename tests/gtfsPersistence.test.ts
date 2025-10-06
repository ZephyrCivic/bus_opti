/**
 * tests/gtfsPersistence.test.ts
 * Round-trip test for SavedGtfsImport serialization.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { toSaved, fromSaved } from '../src/services/import/gtfsPersistence';
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
