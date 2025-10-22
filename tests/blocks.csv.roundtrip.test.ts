/**
 * tests/blocks.csv.roundtrip.test.ts
 * Ensures Blocks CSV exports round-trip through the parser without losing warning metadata.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBlocksCsv } from '../src/services/export/blocksCsv';
import type { BlockPlan } from '../src/services/blocks/blockBuilder';
import { parseBlocksCsv } from '../src/services/import/blocksCsv';
import type { LinkingSettings } from '../src/types';

const linkingSettings: LinkingSettings = {
  enabled: true,
  minTurnaroundMin: 10,
  maxConnectRadiusM: 100,
  allowParentStation: true,
};

function createSamplePlan(): BlockPlan {
  return {
    summaries: [
      {
        blockId: 'BLOCK_A',
        serviceId: 'WKD',
        serviceDayIndex: 0,
        tripCount: 2,
        firstTripStart: '08:00',
        lastTripEnd: '09:00',
        gaps: [5],
        overlapScore: 5,
        gapWarnings: 1,
        warningCounts: { critical: 1, warn: 2, info: 0 },
      },
      {
        blockId: 'BLOCK_B',
        serviceId: 'WKD',
        serviceDayIndex: 0,
        tripCount: 1,
        firstTripStart: '10:00',
        lastTripEnd: '10:30',
        gaps: [],
        overlapScore: 0,
        gapWarnings: 0,
        warningCounts: { critical: 0, warn: 0, info: 0 },
      },
    ],
    csvRows: [
      {
        blockId: 'BLOCK_A',
        seq: 1,
        tripId: 'TRIP_100',
        tripStart: '08:00',
        tripEnd: '08:30',
        fromStopId: 'STOP_A',
        toStopId: 'STOP_B',
        serviceId: 'WKD',
      },
      {
        blockId: 'BLOCK_A',
        seq: 2,
        tripId: 'TRIP_101',
        tripStart: '08:35',
        tripEnd: '09:00',
        fromStopId: 'STOP_B',
        toStopId: 'STOP_C',
        serviceId: 'WKD',
      },
      {
        blockId: 'BLOCK_B',
        seq: 1,
        tripId: 'TRIP_200',
        tripStart: '10:00',
        tripEnd: '10:30',
        fromStopId: 'STOP_X',
        toStopId: 'STOP_Y',
        serviceId: 'WKD',
      },
    ],
    unassignedTripIds: [],
    totalTripCount: 3,
    assignedTripCount: 3,
    coverageRatio: 1,
    maxTurnGapMinutes: 15,
  };
}

test('blocks CSV export -> parse -> export retains warning metadata', () => {
  const plan = createSamplePlan();
  const generatedAt = new Date('2025-10-21T03:12:45Z');
  const original = buildBlocksCsv(plan, { linking: linkingSettings, generatedAt });

  const parsed = parseBlocksCsv(original.csv);
  assert.equal(parsed.plan.csvRows.length, 3);
  const parsedSummary = parsed.plan.summaries.find((summary) => summary.blockId === 'BLOCK_A');
  assert.ok(parsedSummary);
  assert.equal(parsedSummary!.warningCounts.critical, 1);
  assert.equal(parsedSummary!.warningCounts.warn, 2);

  const reExport = buildBlocksCsv(parsed.plan, {
    linking: linkingSettings,
    generatedAt: parsed.generatedAt ? new Date(parsed.generatedAt) : generatedAt,
  });

  assert.equal(reExport.csv, original.csv);
  assert.equal(reExport.settingsHash, original.settingsHash);
  assert.equal(reExport.rowCount, original.rowCount);
});
