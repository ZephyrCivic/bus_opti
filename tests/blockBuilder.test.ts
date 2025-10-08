/**
 * tests/blockBuilder.test.ts
 * Verifies Greedy block assignment behaviour and coverage metrics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBlocksPlan,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockPlan,
} from '../src/services/blocks/blockBuilder';
import type { GtfsImportResult } from '../src/services/import/gtfsParser';

function baseResult(): GtfsImportResult {
  return {
    sourceName: 'sample.zip',
    importedAt: new Date('2025-10-01T00:00:00Z'),
    tables: {
      'stops.txt': { name: 'stops.txt', rows: [] },
      'trips.txt': { name: 'trips.txt', rows: [] },
      'stop_times.txt': { name: 'stop_times.txt', rows: [] },
    },
    missingFiles: [],
    summary: [],
  } as GtfsImportResult;
}

test('buildBlocksPlan groups trips by service within the default turn gap', () => {
  const result = baseResult();
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_A', service_id: 'WEEKDAY' },
    { trip_id: 'TRIP_B', service_id: 'WEEKDAY' },
    { trip_id: 'TRIP_C', service_id: 'WEEKDAY' },
    { trip_id: 'TRIP_D', service_id: 'WEEKEND' },
  ];
  result.tables['stop_times.txt'].rows = [
    // Trip A 08:00-09:00
    { trip_id: 'TRIP_A', stop_sequence: '1', stop_id: 'STOP_1', departure_time: '08:00' },
    { trip_id: 'TRIP_A', stop_sequence: '2', stop_id: 'STOP_2', arrival_time: '09:00' },
    // Trip B 09:10-09:50 (gap 10 min)
    { trip_id: 'TRIP_B', stop_sequence: '1', stop_id: 'STOP_2', departure_time: '09:10' },
    { trip_id: 'TRIP_B', stop_sequence: '2', stop_id: 'STOP_3', arrival_time: '09:50' },
    // Trip C 11:00-12:00 (gap 70 min -> new block)
    { trip_id: 'TRIP_C', stop_sequence: '1', stop_id: 'STOP_3', departure_time: '11:00' },
    { trip_id: 'TRIP_C', stop_sequence: '2', stop_id: 'STOP_4', arrival_time: '12:00' },
    // Trip D 08:30-10:00 weekend (different service -> separate block)
    { trip_id: 'TRIP_D', stop_sequence: '1', stop_id: 'STOP_5', departure_time: '08:30' },
    { trip_id: 'TRIP_D', stop_sequence: '2', stop_id: 'STOP_6', arrival_time: '10:00' },
  ];

  const plan = buildBlocksPlan(result);
  assert.equal(plan.maxTurnGapMinutes, DEFAULT_MAX_TURN_GAP_MINUTES);
  assert.equal(plan.totalTripCount, 4);
  assert.equal(plan.assignedTripCount, 4);
  assert.equal(plan.csvRows.length, 4);
  assert.equal(plan.summaries.length, 3, 'two weekday blocks + one weekend block');

  const firstBlock = plan.summaries.find((summary) => summary.blockId === 'BLOCK_001');
  assert.ok(firstBlock);
  assert.equal(firstBlock?.tripCount, 2, 'TRIP_A and TRIP_B share BLOCK_001');
  assert.equal(firstBlock?.serviceId, 'WEEKDAY');
  assert.equal(firstBlock?.serviceDayIndex, 0);
  assert.deepEqual(firstBlock?.firstTripStart, '08:00');
  assert.deepEqual(firstBlock?.lastTripEnd, '09:50');

  const secondBlock = plan.summaries.find((summary) => summary.blockId === 'BLOCK_002');
  assert.ok(secondBlock);
  assert.equal(secondBlock?.tripCount, 1, 'TRIP_C starts a new weekday block because gap exceeds limit');

  const weekendBlock = plan.summaries.find((summary) => summary.serviceId === 'WEEKEND');
  assert.ok(weekendBlock);
  assert.equal(weekendBlock?.tripCount, 1);
  assert.equal(weekendBlock?.serviceDayIndex, 0);

  assert.deepEqual(plan.unassignedTripIds, []);
});

test('buildBlocksPlan respects custom max turn gap and filters invalid stop_times', () => {
  const result = baseResult();
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_X', service_id: 'SPECIAL' },
    { trip_id: 'TRIP_Y', service_id: 'SPECIAL' },
    { trip_id: 'TRIP_Z', service_id: 'SPECIAL' },
  ];
  result.tables['stop_times.txt'].rows = [
    // Trip X 05:00-05:30
    { trip_id: 'TRIP_X', stop_sequence: '1', stop_id: 'STOP_A', departure_time: '05:00' },
    { trip_id: 'TRIP_X', stop_sequence: '2', stop_id: 'STOP_B', arrival_time: '05:30' },
    // Trip Y large gap 05:31-06:00 but will be accepted when max gap is 40
    { trip_id: 'TRIP_Y', stop_sequence: '1', stop_id: 'STOP_B', departure_time: '05:50' },
    { trip_id: 'TRIP_Y', stop_sequence: '2', stop_id: 'STOP_C', arrival_time: '06:20' },
    // Trip Z missing times -> ignored
    { trip_id: 'TRIP_Z', stop_sequence: '1', stop_id: 'STOP_C' },
  ];

  const plan = buildBlocksPlan(result, { maxTurnGapMinutes: 40 });
  assert.equal(plan.totalTripCount, 2, 'TRIP_Z is ignored because it lacks schedule data');
  assert.equal(plan.assignedTripCount, 2);
  assert.equal(plan.summaries.length, 1, 'custom gap keeps both trips in a single block');
  assert.equal(plan.summaries[0].serviceDayIndex, 0);
  assert.deepEqual(plan.unassignedTripIds, []);

  const csv = plan.csvRows;
  assert.equal(csv[0].blockId, 'BLOCK_001');
  assert.equal(csv[0].seq, 1);
  assert.equal(csv[0].tripId, 'TRIP_X');
  assert.equal(csv[0].fromStopId, 'STOP_A');
  assert.equal(csv[1].seq, 2);
  assert.equal(csv[1].tripId, 'TRIP_Y');
});


test('buildBlocksPlan splits blocks across service days even with zero gap', () => {
  const result = baseResult();
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_LATE', service_id: 'WEEKDAY' },
    { trip_id: 'TRIP_AFTER_MID', service_id: 'WEEKDAY' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_LATE', stop_sequence: '1', stop_id: 'STOP_1', departure_time: '23:50' },
    { trip_id: 'TRIP_LATE', stop_sequence: '2', stop_id: 'STOP_2', arrival_time: '24:10' },
    { trip_id: 'TRIP_AFTER_MID', stop_sequence: '1', stop_id: 'STOP_2', departure_time: '24:15' },
    { trip_id: 'TRIP_AFTER_MID', stop_sequence: '2', stop_id: 'STOP_3', arrival_time: '24:45' },
  ];

  const plan = buildBlocksPlan(result);
  assert.equal(plan.totalTripCount, 2);
  assert.equal(plan.assignedTripCount, 2);
  assert.equal(plan.summaries.length, 2, 'Trips split into separate blocks around midnight');

  const day0 = plan.summaries.find((summary) => summary.serviceDayIndex === 0);
  const day1 = plan.summaries.find((summary) => summary.serviceDayIndex === 1);
  assert.ok(day0);
  assert.ok(day1);
  assert.equal(day0?.tripCount, 1);
  assert.equal(day1?.tripCount, 1);
});

test('buildBlocksPlan normalises overnight trips to 24h notation', () => {
  const result = baseResult();
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_OVERNIGHT', service_id: 'WEEKDAY' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_OVERNIGHT', stop_sequence: '1', stop_id: 'STOP_A', departure_time: '23:50' },
    { trip_id: 'TRIP_OVERNIGHT', stop_sequence: '2', stop_id: 'STOP_B', arrival_time: '00:10', departure_time: '00:12' },
    { trip_id: 'TRIP_OVERNIGHT', stop_sequence: '3', stop_id: 'STOP_C', arrival_time: '00:30' },
  ];

  const plan = buildBlocksPlan(result);
  assert.equal(plan.totalTripCount, 1);
  assert.equal(plan.summaries.length, 1);
  const summary = plan.summaries[0];
  assert.ok(summary);
  assert.equal(summary.serviceDayIndex, 0, 'overnight trip still belongs to the departure service day');
  assert.equal(summary.firstTripStart, '23:50');
  assert.equal(summary.lastTripEnd, '24:30');

  const csvRow = plan.csvRows[0];
  assert.equal(csvRow.tripStart, '23:50');
  assert.equal(csvRow.tripEnd, '24:30');
});

test('buildBlocksPlan honours linkingEnabled flag', () => {
  const result = baseResult();
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_ONE', service_id: 'WEEKDAY' },
    { trip_id: 'TRIP_TWO', service_id: 'WEEKDAY' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_ONE', stop_sequence: '1', stop_id: 'STOP_A', departure_time: '07:00' },
    { trip_id: 'TRIP_ONE', stop_sequence: '2', stop_id: 'STOP_B', arrival_time: '08:00' },
    { trip_id: 'TRIP_TWO', stop_sequence: '1', stop_id: 'STOP_B', departure_time: '08:05' },
    { trip_id: 'TRIP_TWO', stop_sequence: '2', stop_id: 'STOP_C', arrival_time: '09:00' },
  ];

  const enabledPlan = buildBlocksPlan(result, { linkingEnabled: true });
  assert.equal(enabledPlan.summaries.length, 1, 'enabled linking connects trips into single block');
  assert.equal(enabledPlan.summaries[0]?.tripCount, 2);

  const disabledPlan = buildBlocksPlan(result, { linkingEnabled: false });
  assert.equal(disabledPlan.summaries.length, 2, 'disabled linking keeps trips separate');
  assert.equal(disabledPlan.summaries[0]?.tripCount, 1);
  assert.equal(disabledPlan.summaries[1]?.tripCount, 1);
});
