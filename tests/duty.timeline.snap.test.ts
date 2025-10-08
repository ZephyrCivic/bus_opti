/**
 * tests/duty.timeline.snap.test.ts
 * 目的: Duty タイムラインのドラッグスナップ計算が期待通りに動作することを確認する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applySegmentDrag, type DutyTimelineTrip } from '../src/features/duties/utils/timelineSnap';

const sampleTrips: DutyTimelineTrip[] = [
  { tripId: 'T1', startMinutes: 480, endMinutes: 510 },
  { tripId: 'T2', startMinutes: 540, endMinutes: 570 },
  { tripId: 'T3', startMinutes: 600, endMinutes: 630 },
  { tripId: 'T4', startMinutes: 660, endMinutes: 690 },
];

test('move drag snaps to nearest trip boundaries', () => {
  const result = applySegmentDrag({
    trips: sampleTrips,
    startTripId: 'T1',
    endTripId: 'T2',
    mode: 'move',
    deltaMinutes: 125,
  });
  assert.equal(result.startTripId, 'T3');
  assert.equal(result.endTripId, 'T4');
});

test('move drag clamps within available trips', () => {
  const result = applySegmentDrag({
    trips: sampleTrips,
    startTripId: 'T3',
    endTripId: 'T4',
    mode: 'move',
    deltaMinutes: 200,
  });
  assert.equal(result.startTripId, 'T3');
  assert.equal(result.endTripId, 'T4');
});

test('resize-start snaps and preserves order', () => {
  const result = applySegmentDrag({
    trips: sampleTrips,
    startTripId: 'T1',
    endTripId: 'T3',
    mode: 'resize-start',
    deltaMinutes: 130,
  });
  assert.equal(result.startTripId, 'T3');
  assert.equal(result.endTripId, 'T3');
});

test('resize-end snaps to later trip', () => {
  const result = applySegmentDrag({
    trips: sampleTrips,
    startTripId: 'T1',
    endTripId: 'T2',
    mode: 'resize-end',
    deltaMinutes: 150,
  });
  assert.equal(result.startTripId, 'T1');
  assert.equal(result.endTripId, 'T4');
});
