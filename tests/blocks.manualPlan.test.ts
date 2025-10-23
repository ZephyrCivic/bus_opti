import test from 'node:test';
import assert from 'node:assert/strict';

import type { BlockPlan } from '../src/services/blocks/blockBuilder';
import {
  connectBlocksPlan,
  getConnectionCandidates,
  type ManualPlanConfig,
} from '../src/services/blocks/manualPlan';

function createPlan(): BlockPlan {
  return {
    summaries: [
      {
        blockId: 'BLOCK_A',
        serviceId: 'WKD',
        serviceDayIndex: 0,
        tripCount: 2,
        firstTripStart: '08:00',
        lastTripEnd: '09:00',
        gaps: [15],
        overlapScore: 15,
        gapWarnings: 0,
        warningCounts: { critical: 0, warn: 0, info: 0 },
        warnings: [],
      },
      {
        blockId: 'BLOCK_B',
        serviceId: 'WKD',
        serviceDayIndex: 0,
        tripCount: 1,
        firstTripStart: '09:20',
        lastTripEnd: '10:00',
        gaps: [],
        overlapScore: 0,
        gapWarnings: 0,
        warningCounts: { critical: 0, warn: 0, info: 0 },
        warnings: [],
      },
    ],
    csvRows: [
      { blockId: 'BLOCK_A', seq: 1, tripId: 'TRIP_A1', tripStart: '08:00', tripEnd: '08:30', fromStopId: 'STOP_A', toStopId: 'STOP_B', serviceId: 'WKD' },
      { blockId: 'BLOCK_A', seq: 2, tripId: 'TRIP_A2', tripStart: '08:45', tripEnd: '09:00', fromStopId: 'STOP_B', toStopId: 'STOP_C', serviceId: 'WKD' },
      { blockId: 'BLOCK_B', seq: 1, tripId: 'TRIP_B1', tripStart: '09:20', tripEnd: '10:00', fromStopId: 'STOP_C', toStopId: 'STOP_D', serviceId: 'WKD' },
    ],
    unassignedTripIds: [],
    totalTripCount: 3,
    assignedTripCount: 3,
    coverageRatio: 1,
    maxTurnGapMinutes: 30,
  };
}

const config: ManualPlanConfig = {
  minTurnaroundMin: 10,
  maxGapMinutes: 60,
};

test('connectBlocksPlan merges blocks and preserves ordering', () => {
  const plan = createPlan();
  const result = connectBlocksPlan(plan, 'BLOCK_A', 'BLOCK_B', config);
  assert.ok(result, 'connection should succeed');
  const { plan: next, connection } = result!;
  assert.equal(next.summaries.length, 1);
  const merged = next.summaries[0]!;
  assert.equal(merged.blockId, 'BLOCK_A');
  assert.equal(merged.tripCount, 3);
  assert.ok(next.csvRows.every((row) => row.blockId === 'BLOCK_A'));
  assert.equal(connection.gapMinutes, 20);
  assert.equal(connection.resultingTripCount, 3);
  // original plan should remain untouched
  assert.equal(plan.summaries.length, 2);
});

test('getConnectionCandidates returns sorted candidates within thresholds', () => {
  const plan = createPlan();
  plan.summaries.push({
    blockId: 'BLOCK_C',
    serviceId: 'WKD',
    serviceDayIndex: 0,
    tripCount: 1,
    firstTripStart: '11:00',
    lastTripEnd: '12:00',
    gaps: [],
    overlapScore: 0,
    gapWarnings: 0,
    warningCounts: { critical: 0, warn: 0, info: 0 },
    warnings: [],
  });
  plan.csvRows.push({
    blockId: 'BLOCK_C',
    seq: 1,
    tripId: 'TRIP_C1',
    tripStart: '11:00',
    tripEnd: '12:00',
    fromStopId: 'STOP_E',
    toStopId: 'STOP_F',
    serviceId: 'WKD',
  });
  const candidates = getConnectionCandidates(plan, 'BLOCK_A', config);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.blockId, 'BLOCK_B');
});

