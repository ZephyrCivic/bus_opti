/**
 * tests/duties.csv.export.test.ts
 * Verifies Duties CSV export includes configuration hash and generated timestamp.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDutiesCsv } from '../src/services/export/dutiesCsv';
import type { Duty, DutySettings } from '../src/types';

const duties: Duty[] = [
  {
    id: 'DUTY_001',
    driverId: 'DRIVER_A',
    segments: [
      {
        id: 'SEG_001',
        blockId: 'BLOCK_001',
        startTripId: 'TRIP_A',
        endTripId: 'TRIP_B',
        startSequence: 1,
        endSequence: 2,
      },
      {
        id: 'SEG_002',
        blockId: 'BLOCK_001',
        startTripId: 'TRIP_C',
        endTripId: 'TRIP_C',
        startSequence: 3,
        endSequence: 3,
      },
    ],
  },
  {
    id: 'DUTY_EMPTY',
    driverId: undefined,
    segments: [],
  },
];

const dutySettings: DutySettings = {
  maxContinuousMinutes: 240,
  minBreakMinutes: 30,
  maxDailyMinutes: 780,
  undoStackLimit: 50,
};

test('buildDutiesCsv outputs rows with metadata and settings hash', () => {
  const generatedAt = new Date('2025-10-07T15:00:00Z');
  const exportData = buildDutiesCsv(duties, { dutySettings, generatedAt });

  const expectedCsv = [
    'duty_id,seq,block_id,segment_start_trip_id,segment_end_trip_id,driver_id,generated_at,settings_hash,violations_summary,violations_hard,violations_soft',
    'DUTY_001,1,BLOCK_001,TRIP_A,TRIP_B,DRIVER_A,2025-10-07T15:00:00.000Z,1989780b,H:0;S:0,0,0',
    'DUTY_001,2,BLOCK_001,TRIP_C,TRIP_C,DRIVER_A,2025-10-07T15:00:00.000Z,1989780b,H:0;S:0,0,0',
    'DUTY_EMPTY,1,,,,,2025-10-07T15:00:00.000Z,1989780b,H:0;S:0,0,0',
  ].join('\n');

  assert.equal(exportData.rowCount, 3, 'two segments + one empty duty row');
  assert.equal(exportData.generatedAt, '2025-10-07T15:00:00.000Z');
  assert.equal(exportData.fileName, 'duties-20251007-150000.csv');
  assert.equal(exportData.settingsHash, '1989780b');
  assert.equal(exportData.csv, expectedCsv);
});
