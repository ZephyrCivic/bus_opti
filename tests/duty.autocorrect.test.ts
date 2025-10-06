/**
 * tests/duty.autocorrect.test.ts
 * Auto-correction heuristics should trim segments to satisfy configured constraints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { autoCorrectDuty } from '@/services/duty/dutyAutoCorrect';
import { buildTripLookup } from '@/services/duty/dutyMetrics';
import { DEFAULT_DUTY_SETTINGS } from '@/services/duty/dutyState';
import type { Duty } from '@/types';
import type { BlockCsvRow } from '@/services/blocks/blockBuilder';

const rows: BlockCsvRow[] = [
  { blockId: 'BLOCK_001', seq: 1, tripId: 'T1', tripStart: '05:00', tripEnd: '05:30', fromStopId: 'A', toStopId: 'B', serviceId: 'WKD' },
  { blockId: 'BLOCK_001', seq: 2, tripId: 'T2', tripStart: '05:30', tripEnd: '10:30', fromStopId: 'B', toStopId: 'C', serviceId: 'WKD' },
  { blockId: 'BLOCK_001', seq: 3, tripId: 'T3', tripStart: '10:40', tripEnd: '11:00', fromStopId: 'C', toStopId: 'D', serviceId: 'WKD' },
];

const lookup = buildTripLookup(rows);

const duty: Duty = {
  id: 'DUTY_001',
  segments: [
    { id: 'SEG_001', blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T2', startSequence: 1, endSequence: 2 },
    { id: 'SEG_002', blockId: 'BLOCK_001', startTripId: 'T3', endTripId: 'T3', startSequence: 3, endSequence: 3 },
  ],
};

test('autoCorrectDuty removes segment exceeding continuous limit', () => {
  const { duty: corrected, changed } = autoCorrectDuty(duty, lookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(changed, true);
  assert.equal(corrected.segments.length, 1);
  assert.equal(corrected.segments[0].id, 'SEG_002');
});

test('autoCorrectDuty returns unchanged duty when already valid', () => {
  const validDuty: Duty = {
    id: 'DUTY_OK',
    segments: [
      { id: 'SEG_A', blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T1', startSequence: 1, endSequence: 1 },
    ],
  };
  const result = autoCorrectDuty(validDuty, lookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(result.changed, false);
  assert.deepEqual(result.duty.segments, validDuty.segments);
});