/**
 * tests/duties.csv.roundtrip.test.ts
 * Ensures Duties CSV export parses back and re-exports without losing warning summaries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDutiesCsv } from '../src/services/export/dutiesCsv';
import { parseDutiesCsv } from '../src/services/import/dutiesCsv';
import { parseBlocksCsv } from '../src/services/import/blocksCsv';
import { buildBlocksCsv } from '../src/services/export/blocksCsv';
import { buildTripIndexFromPlan } from '../src/services/duty/dutyState';
import { buildTripLookup } from '../src/services/duty/dutyMetrics';
import type { Duty, DutySettings, LinkingSettings } from '../src/types';
import type { BlockPlan } from '../src/services/blocks/blockBuilder';

const dutySettings: DutySettings = {
  maxContinuousMinutes: 50,
  minBreakMinutes: 20,
  maxDailyMinutes: 90,
  undoStackLimit: 50,
  maxUnassignedPercentage: 0,
  maxNightShiftVariance: 0,
};

const linkingSettings: LinkingSettings = {
  enabled: true,
  minTurnaroundMin: 10,
  maxConnectRadiusM: 100,
  allowParentStation: true,
};

function createBlockPlan(): BlockPlan {
  return {
    summaries: [
      {
        blockId: 'BLOCK_ROUND',
        serviceId: 'WKD',
        serviceDayIndex: 0,
        tripCount: 2,
        firstTripStart: '08:00',
        lastTripEnd: '10:00',
        gaps: [10],
        overlapScore: 10,
        gapWarnings: 1,
        warningCounts: { critical: 0, warn: 1, info: 0 },
      },
    ],
    csvRows: [
      {
        blockId: 'BLOCK_ROUND',
        seq: 1,
        tripId: 'TRIP_A',
        tripStart: '08:00',
        tripEnd: '09:00',
        fromStopId: 'STOP_A',
        toStopId: 'STOP_B',
        serviceId: 'WKD',
      },
      {
        blockId: 'BLOCK_ROUND',
        seq: 2,
        tripId: 'TRIP_B',
        tripStart: '09:10',
        tripEnd: '10:00',
        fromStopId: 'STOP_B',
        toStopId: 'STOP_C',
        serviceId: 'WKD',
      },
    ],
    unassignedTripIds: [],
    totalTripCount: 2,
    assignedTripCount: 2,
    coverageRatio: 1,
    maxTurnGapMinutes: 15,
  };
}

const duties: Duty[] = [
  {
    id: 'DUTY_WARN',
    driverId: 'DRV_01',
    segments: [
      {
        id: 'SEG_001',
        blockId: 'BLOCK_ROUND',
        startTripId: 'TRIP_A',
        endTripId: 'TRIP_A',
        startSequence: 1,
        endSequence: 1,
      },
      {
        id: 'SEG_002',
        blockId: 'BLOCK_ROUND',
        startTripId: 'TRIP_B',
        endTripId: 'TRIP_B',
        startSequence: 2,
        endSequence: 2,
      },
    ],
  },
];

test('duties CSV round-trip keeps warning summary counts', () => {
  const blockPlan = createBlockPlan();
  const blockExport = buildBlocksCsv(blockPlan, { linking: linkingSettings, generatedAt: new Date('2025-10-21T04:00:00Z') });
  const parsedBlocks = parseBlocksCsv(blockExport.csv);
  const tripLookup = buildTripLookup(parsedBlocks.plan.csvRows);
  const tripIndex = buildTripIndexFromPlan(parsedBlocks.plan);

  const generatedAt = new Date('2025-10-21T04:10:00Z');
  const exportData = buildDutiesCsv(duties, { dutySettings, generatedAt, tripLookup });

  assert.match(exportData.csv, /H:2;S:1/);

  const parsed = parseDutiesCsv(exportData.csv, tripIndex);
  assert.equal(parsed.duties.length, 1);
  assert.equal(parsed.generatedAt, '2025-10-21T04:10:00.000Z');

  const reExport = buildDutiesCsv(parsed.duties, {
    dutySettings,
    generatedAt: parsed.generatedAt ? new Date(parsed.generatedAt) : generatedAt,
    tripLookup,
  });

  assert.equal(reExport.csv, exportData.csv);
  assert.equal(reExport.settingsHash, exportData.settingsHash);
  assert.equal(reExport.rowCount, exportData.rowCount);
});
