import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBlocksMetaCsv } from '../src/services/export/blocksMetaCsv';
import type { BlockPlan } from '../src/services/blocks/blockBuilder';

const samplePlan: BlockPlan = {
  summaries: [
    {
      blockId: 'BLOCK_001',
      serviceId: 'WEEKDAY',
      serviceDayIndex: 0,
      tripCount: 3,
      firstTripStart: '06:30',
      lastTripEnd: '09:10',
      gaps: [15, 20],
      overlapScore: 0,
      gapWarnings: 0,
      warningCounts: { critical: 0, warn: 0, info: 0 },
      warnings: [],
    },
    {
      blockId: 'BLOCK_002',
      serviceId: 'WEEKDAY',
      serviceDayIndex: 0,
      tripCount: 2,
      firstTripStart: '07:00',
      lastTripEnd: '08:30',
      gaps: [10],
      overlapScore: 0,
      gapWarnings: 0,
      warningCounts: { critical: 0, warn: 0, info: 0 },
      warnings: [],
    },
  ],
  csvRows: [],
  unassignedTripIds: ['TRIP_X01'],
  totalTripCount: 5,
  assignedTripCount: 5,
  coverageRatio: 1,
  maxTurnGapMinutes: 15,
};

test('buildBlocksMetaCsv outputs sorted rows with optional values', () => {
  const result = buildBlocksMetaCsv({
    plan: samplePlan,
    blockMeta: {
      BLOCK_002: { vehicleTypeId: 'M', vehicleId: 'BUS_002' },
      BLOCK_001: { vehicleId: 'BUS_001' },
    },
  });

  assert.match(result.fileName, /^blocks_meta-\d{8}-\d{6}\.csv$/);
  assert.equal(result.rowCount, 2);

  const lines = result.csv.trim().split('\n');
  assert.equal(lines[0], 'block_id,vehicle_type_id,vehicle_id');
  assert.equal(lines[1], 'BLOCK_001,,BUS_001');
  assert.equal(lines[2], 'BLOCK_002,M,BUS_002');
});

test('buildBlocksMetaCsv fills blanks when metadata is missing', () => {
  const result = buildBlocksMetaCsv({
    plan: samplePlan,
    blockMeta: {},
  });

  const lines = result.csv.trim().split('\n');
  assert.equal(lines[0], 'block_id,vehicle_type_id,vehicle_id');
  assert.equal(lines[1], 'BLOCK_001,,');
  assert.equal(lines[2], 'BLOCK_002,,');
});
