/**
 * tests/gtfs.frequencies.test.ts
 * Validates frequencies.txt expansion into concrete trips and stop times.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { expandFrequenciesInTables, type GtfsTable } from '@/services/import/gtfsParser';

function createTables(): Record<string, GtfsTable> {
  return {
    'trips.txt': {
      name: 'trips.txt',
      rows: [
        { trip_id: 'T_BASE', service_id: 'WEEKDAY', route_id: 'R1' },
      ],
    },
    'stop_times.txt': {
      name: 'stop_times.txt',
      rows: [
        { trip_id: 'T_BASE', stop_sequence: '1', stop_id: 'STOP_A', departure_time: '08:00:00', arrival_time: '08:00:00' },
        { trip_id: 'T_BASE', stop_sequence: '2', stop_id: 'STOP_B', arrival_time: '08:20:00', departure_time: '08:20:00' },
        { trip_id: 'T_BASE', stop_sequence: '3', stop_id: 'STOP_C', arrival_time: '08:40:00' },
      ],
    },
    'frequencies.txt': {
      name: 'frequencies.txt',
      rows: [
        { trip_id: 'T_BASE', start_time: '08:00:00', end_time: '09:00:00', headway_secs: '900', exact_times: '1' },
      ],
    },
  };
}

test('expandFrequenciesInTables expands exact_times=1 into static trips', () => {
  const tables = createTables();
  const info = expandFrequenciesInTables(tables);

  assert.equal(info.templateTrips, 1);
  assert.equal(info.generatedTrips, 4, '08:00-09:00 with 15min headway generates four trips');
  assert.deepEqual(info.warnings, []);

  const trips = tables['trips.txt'].rows;
  assert.equal(trips.length, 4);
  const tripIds = trips.map((row) => row.trip_id).sort();
  assert.deepEqual(tripIds, ['T_BASE#0', 'T_BASE#1', 'T_BASE#2', 'T_BASE#3']);
  assert.ok(trips.every((row) => row.service_id === 'WEEKDAY'));

  const stopTimes = tables['stop_times.txt'].rows.filter((row) => row.trip_id?.startsWith('T_BASE#'));
  assert.equal(stopTimes.length, 12, 'three stops per generated trip');

  const firstTripStops = stopTimes.filter((row) => row.trip_id === 'T_BASE#0').sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  assert.equal(firstTripStops[0]?.departure_time, '08:00:00');
  assert.equal(firstTripStops[firstTripStops.length - 1]?.arrival_time, '08:40:00');

  const secondTripStops = stopTimes.filter((row) => row.trip_id === 'T_BASE#1').sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  assert.equal(secondTripStops[0]?.departure_time, '08:15:00');
  assert.equal(secondTripStops[secondTripStops.length - 1]?.arrival_time, '08:55:00');
});

test('expandFrequenciesInTables handles exact_times=0 by shifting equally', () => {
  const tables = createTables();
  tables['frequencies.txt'].rows = [
    { trip_id: 'T_BASE', start_time: '18:00:00', end_time: '19:00:00', headway_secs: '1200', exact_times: '0' },
  ];

  const info = expandFrequenciesInTables(tables);
  assert.equal(info.generatedTrips, 3);

  const tripIds = tables['trips.txt'].rows.map((row) => row.trip_id).sort();
  assert.deepEqual(tripIds, ['T_BASE#0', 'T_BASE#1', 'T_BASE#2']);

  const lastTripStops = tables['stop_times.txt'].rows
    .filter((row) => row.trip_id === 'T_BASE#2')
    .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  assert.equal(lastTripStops[0]?.departure_time, '18:40:00');
  assert.equal(lastTripStops[lastTripStops.length - 1]?.arrival_time, '19:20:00');
});
