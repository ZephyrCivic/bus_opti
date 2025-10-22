import test from 'node:test';
import assert from 'node:assert/strict';

import type { BlockPlan } from '../src/services/blocks/blockBuilder';
import { computeUnassignedRanges } from '../src/services/duty/unassigned';
import type { Duty } from '../src/types';

const plan: BlockPlan = {
  summaries: [
    {
      blockId: 'BLOCK_A',
      serviceId: 'WKD',
      serviceDayIndex: 0,
      tripCount: 3,
      firstTripStart: '08:00',
      lastTripEnd: '09:30',
      gaps: [15, 15],
      overlapScore: 15,
      gapWarnings: 0,
      warningCounts: { critical: 0, warn: 0, info: 0 },
    },
  ],
  csvRows: [
    { blockId: 'BLOCK_A', seq: 1, tripId: 'TRIP_1', tripStart: '08:00', tripEnd: '08:30' },
    { blockId: 'BLOCK_A', seq: 2, tripId: 'TRIP_2', tripStart: '08:45', tripEnd: '09:10' },
    { blockId: 'BLOCK_A', seq: 3, tripId: 'TRIP_3', tripStart: '09:15', tripEnd: '09:30' },
  ],
  unassignedTripIds: [],
  totalTripCount: 3,
  assignedTripCount: 3,
  coverageRatio: 1,
  maxTurnGapMinutes: 30,
};

test('computeUnassignedRanges returns entire block when no duties', () => {
  const ranges = computeUnassignedRanges(plan, []);
  assert.equal(ranges.length, 1);
  const range = ranges[0]!;
  assert.equal(range.blockId, 'BLOCK_A');
  assert.equal(range.startTripId, 'TRIP_1');
  assert.equal(range.endTripId, 'TRIP_3');
  assert.equal(range.tripCount, 3);
});

test('computeUnassignedRanges excludes assigned sequences', () => {
  const duties: Duty[] = [
    {
      id: 'DUTY_1',
      driverId: 'DRV',
      segments: [
        {
          id: 'SEG_1',
          blockId: 'BLOCK_A',
          startTripId: 'TRIP_2',
          endTripId: 'TRIP_2',
          startSequence: 2,
          endSequence: 2,
        },
      ],
    },
  ];
  const ranges = computeUnassignedRanges(plan, duties);
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0]!.startTripId, 'TRIP_1');
  assert.equal(ranges[0]!.endTripId, 'TRIP_1');
  assert.equal(ranges[1]!.startTripId, 'TRIP_3');
  assert.equal(ranges[1]!.endTripId, 'TRIP_3');
});
