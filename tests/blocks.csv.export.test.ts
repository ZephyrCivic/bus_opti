/**
 * tests/blocks.csv.export.test.ts
 * Ensures Blocks CSV export includes metadata columns and stable hashing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBlocksCsv } from '../src/services/export/blocksCsv';
import { buildBlocksPlan } from '../src/services/blocks/blockBuilder';
import type { GtfsImportResult } from '../src/services/import/gtfsParser';
import type { LinkingSettings } from '../src/types';

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
    alerts: [],
  } as GtfsImportResult;
}

const linkingSettings: LinkingSettings = {
  enabled: true,
  minTurnaroundMin: 15,
  maxConnectRadiusM: 120,
  allowParentStation: true,
};

test('buildBlocksCsv outputs metadata columns and deterministic hash', () => {
  const result = baseResult();
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_1', service_id: 'WEEKDAY' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_1', stop_sequence: '1', stop_id: 'STOP_A', departure_time: '05:00' },
    { trip_id: 'TRIP_1', stop_sequence: '2', stop_id: 'STOP_B', arrival_time: '05:30' },
  ];

  const plan = buildBlocksPlan(result);
  const generatedAt = new Date('2025-10-07T12:34:56Z');
  const exportData = buildBlocksCsv(plan, { linking: linkingSettings, generatedAt });

  const expectedCsv = [
    'block_id,seq,trip_id,trip_start,trip_end,from_stop_id,to_stop_id,service_id,generated_at,settings_hash,violations_summary,violations_hard,violations_soft',
    'BLOCK_001,1,TRIP_1,05:00,05:30,STOP_A,STOP_B,WEEKDAY,2025-10-07T12:34:56.000Z,195fa463,H:0;S:0,0,0',
  ].join('\n');

  assert.equal(exportData.rowCount, 1);
  assert.equal(exportData.generatedAt, '2025-10-07T12:34:56.000Z');
  assert.equal(exportData.fileName, 'blocks-20251007-123456.csv');
  assert.equal(exportData.settingsHash, '195fa463');
  assert.equal(exportData.csv, expectedCsv);
});
