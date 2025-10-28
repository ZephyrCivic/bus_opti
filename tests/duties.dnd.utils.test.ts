/**
 * tests/duties.dnd.utils.test.ts
 * Drag & Drop 補助関数のスナップ動作をユニットテストし、Duty DnD 改修の回帰を防ぐ。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDropRangeForTrips, resolveGapAroundMinutesForTrips } from '../src/features/duties/utils/dnd';

const SAMPLE_TRIPS: Array<{ tripId: string; startMinutes: number; endMinutes: number }> = [
  { tripId: 'T1', startMinutes: 300, endMinutes: 360 },
  { tripId: 'T2', startMinutes: 380, endMinutes: 430 },
  { tripId: 'T3', startMinutes: 460, endMinutes: 520 },
];

test('resolveDropRangeForTrips keeps original ids when minutes not provided', () => {
  const result = resolveDropRangeForTrips(SAMPLE_TRIPS, 'T1', 'T2', null);
  assert.deepEqual(result, { startTripId: 'T1', endTripId: 'T2' });
});

test('resolveDropRangeForTrips snaps span to nearest index', () => {
  const result = resolveDropRangeForTrips(SAMPLE_TRIPS, 'T1', 'T2', 470);
  assert.deepEqual(result, { startTripId: 'T2', endTripId: 'T3' });
});

test('resolveGapAroundMinutesForTrips returns surrounding gap when minutes fall between trips', () => {
  const result = resolveGapAroundMinutesForTrips(SAMPLE_TRIPS, 450);
  assert.ok(result);
  assert.equal(result!.startTripId, 'T2');
  assert.equal(result!.endTripId, 'T3');
  assert.equal(result!.gapMinutes, 460 - 430);
});

test('resolveGapAroundMinutesForTrips returns null when minutes outside range', () => {
  const result = resolveGapAroundMinutesForTrips(SAMPLE_TRIPS, 200);
  assert.equal(result, null);
});
