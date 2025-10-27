import test from 'node:test';
import assert from 'node:assert/strict';

import type { GtfsImportResult } from '../src/services/import/gtfsParser';
import { buildSingleTripBlockSeed } from '../src/services/blocks/blockBuilder';

const mockGtfs: GtfsImportResult = {
  tables: {
    'trips.txt': {
      name: 'trips.txt',
      rows: [
        { trip_id: 'TRIP_001', service_id: 'WKD' },
      ],
    },
    'stop_times.txt': {
      name: 'stop_times.txt',
      rows: [
        { trip_id: 'TRIP_001', stop_sequence: '1', departure_time: '08:00:00', arrival_time: '08:00:00', stop_id: 'STOP_A' },
        { trip_id: 'TRIP_001', stop_sequence: '2', departure_time: '08:30:00', arrival_time: '08:30:00', stop_id: 'STOP_B' },
      ],
    },
  },
  missingFiles: [],
  summary: [],
  alerts: [],
  sourceName: 'mock',
  importedAt: new Date(0),
};

test('buildSingleTripBlockSeed returns schedule data for a valid trip', () => {
  const seed = buildSingleTripBlockSeed(mockGtfs, 'TRIP_001');
  assert.ok(seed);
  assert.equal(seed?.tripStart, '08:00');
  assert.equal(seed?.tripEnd, '08:30');
  assert.equal(seed?.serviceId, 'WKD');
  assert.equal(seed?.serviceDayIndex, 0);
  assert.equal(seed?.fromStopId, 'STOP_A');
  assert.equal(seed?.toStopId, 'STOP_B');
});

test('buildSingleTripBlockSeed returns null for unknown trips', () => {
  const seed = buildSingleTripBlockSeed(mockGtfs, 'TRIP_UNKNOWN');
  assert.equal(seed, null);
});
