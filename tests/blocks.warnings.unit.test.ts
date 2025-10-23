import test from 'node:test';
import assert from 'node:assert/strict';

import type { BlockCsvRow } from '../src/services/blocks/blockBuilder';
import { evaluateBlockWarnings, countWarnings } from '../src/services/blocks/blockBuilder';

function buildRows(values: Array<{ seq: number; tripId: string; start: string; end: string; serviceId?: string }>): BlockCsvRow[] {
  return values.map((entry) => ({
    blockId: 'BLOCK_X',
    seq: entry.seq,
    tripId: entry.tripId,
    tripStart: entry.start,
    tripEnd: entry.end,
    serviceId: entry.serviceId,
  }));
}

test('evaluateBlockWarnings detects short turn warnings', () => {
  const rows = buildRows([
    { seq: 1, tripId: 'TRIP_A', start: '08:00', end: '08:30', serviceId: 'WKD' },
    { seq: 2, tripId: 'TRIP_B', start: '08:35', end: '09:10', serviceId: 'WKD' },
  ]);
  const warnings = evaluateBlockWarnings(rows, 10);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.code, 'BLK_TURN_SHORT');
  assert.equal(warnings[0]?.severity, 'warn');
  const counts = countWarnings(warnings);
  assert.equal(counts.warn, 1);
});

test('evaluateBlockWarnings detects negative gap as critical', () => {
  const rows = buildRows([
    { seq: 1, tripId: 'TRIP_A', start: '08:00', end: '08:30', serviceId: 'WKD' },
    { seq: 2, tripId: 'TRIP_B', start: '08:20', end: '09:10', serviceId: 'WKD' },
  ]);
  const warnings = evaluateBlockWarnings(rows, 10);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.code, 'BLK_NEG_GAP');
  assert.equal(warnings[0]?.severity, 'critical');
  assert.ok((warnings[0]?.gapMinutes ?? 0) < 0);
  const counts = countWarnings(warnings);
  assert.equal(counts.critical, 1);
});

test('evaluateBlockWarnings detects service mismatch', () => {
  const rows = buildRows([
    { seq: 1, tripId: 'TRIP_A', start: '08:00', end: '08:30', serviceId: 'WKD' },
    { seq: 2, tripId: 'TRIP_B', start: '09:00', end: '09:30', serviceId: 'SAT' },
  ]);
  const warnings = evaluateBlockWarnings(rows, 10);
  const mismatch = warnings.find((warning) => warning.code === 'BLK_SVC_MISMATCH');
  assert.ok(mismatch, 'service mismatch warning should be present');
  assert.equal(mismatch?.severity, 'critical');
});
