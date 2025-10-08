/**
 * tests/duties.csv.import.test.ts
 * Verifies Duties CSV import parsing against block trip sequence indices.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDutiesCsv } from '@/services/import/dutiesCsv';
import { buildTripIndexFromCsv } from '@/services/duty/dutyState';
import type { BlockCsvRow } from '@/services/blocks/blockBuilder';

function createIndex(): ReturnType<typeof buildTripIndexFromCsv> {
  const rows: BlockCsvRow[] = [
    { blockId: 'BLOCK_001', seq: 1, tripId: 'TRIP_A', tripStart: '08:00', tripEnd: '08:20', fromStopId: 'STOP_A', toStopId: 'STOP_B', serviceId: 'S1' },
    { blockId: 'BLOCK_001', seq: 2, tripId: 'TRIP_B', tripStart: '08:30', tripEnd: '08:50', fromStopId: 'STOP_B', toStopId: 'STOP_C', serviceId: 'S1' },
    { blockId: 'BLOCK_001', seq: 3, tripId: 'TRIP_C', tripStart: '09:00', tripEnd: '09:30', fromStopId: 'STOP_C', toStopId: 'STOP_D', serviceId: 'S1' },
    { blockId: 'BLOCK_002', seq: 1, tripId: 'TRIP_X', tripStart: '07:00', tripEnd: '07:20', fromStopId: 'STOP_X', toStopId: 'STOP_Y', serviceId: 'S1' },
  ];
  return buildTripIndexFromCsv(rows);
}

test('parseDutiesCsv builds duties with sequence numbers', () => {
  const index = createIndex();
  const csv = [
    'duty_id,seq,block_id,segment_start_trip_id,segment_end_trip_id,driver_id,generated_at,settings_hash',
    'DUTY_001,1,BLOCK_001,TRIP_A,TRIP_B,DRV_A,2025-10-07T10:00:00Z,hash001',
    'DUTY_001,2,BLOCK_001,TRIP_C,TRIP_C,DRV_A,2025-10-07T10:00:00Z,hash001',
  ].join('\n');

  const parsed = parseDutiesCsv(csv, index);
  assert.equal(parsed.duties.length, 1);
  assert.equal(parsed.generatedAt, '2025-10-07T10:00:00Z');
  assert.equal(parsed.settingsHash, 'hash001');

  const duty = parsed.duties[0]!;
  assert.equal(duty.id, 'DUTY_001');
  assert.equal(duty.driverId, 'DRV_A');
  assert.equal(duty.segments.length, 2);
  assert.equal(duty.segments[0]?.startSequence, 1);
  assert.equal(duty.segments[0]?.endSequence, 2);
  assert.equal(duty.segments[1]?.startTripId, 'TRIP_C');
  assert.equal(duty.segments[1]?.startSequence, 3);
});

test('parseDutiesCsv supports empty duties', () => {
  const index = createIndex();
  const csv = [
    'duty_id,seq,block_id,segment_start_trip_id,segment_end_trip_id,driver_id,generated_at,settings_hash',
    'DUTY_EMPTY,1,,,,,2025-10-07T10:00:00Z,hash001',
  ].join('\n');

  const parsed = parseDutiesCsv(csv, index);
  assert.equal(parsed.duties.length, 1);
  const duty = parsed.duties[0]!;
  assert.equal(duty.id, 'DUTY_EMPTY');
  assert.equal(duty.segments.length, 0);
});

test('parseDutiesCsv throws when block_id is unknown', () => {
  const index = createIndex();
  const csv = [
    'duty_id,seq,block_id,segment_start_trip_id,segment_end_trip_id,driver_id,generated_at,settings_hash',
    'DUTY_002,1,BLOCK_999,TRIP_A,TRIP_B,,,hash001',
  ].join('\n');

  assert.throws(() => parseDutiesCsv(csv, index), /block_id=BLOCK_999/);
});
