/**
 * tests/duty.tripSelection.test.ts
 * Validates trip selection helper to guarantee consistent error handling in DutiesView.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateTripSelection,
  selectionErrorToMessage,
  inferBlockCandidates,
} from '@/features/duties/utils/tripSelection';
import type { BlockTripSequenceIndex } from '@/services/duty/types';

const buildIndex = (): BlockTripSequenceIndex =>
  new Map([
    [
      'BLOCK_1',
      new Map([
        ['TRIP_A', 1],
        ['TRIP_B', 2],
        ['TRIP_C', 3],
      ]),
    ],
  ]);

test('evaluateTripSelection rejects when block is not chosen', () => {
  const result = evaluateTripSelection({
    selectedBlockId: null,
    startTripId: 'TRIP_A',
    endTripId: 'TRIP_B',
    tripIndex: buildIndex(),
  });

  assert.deepEqual(result, { ok: false, reason: 'missingBlock' });
  assert.equal(selectionErrorToMessage(result.reason), 'Blockを選択してください。');
});

test('evaluateTripSelection rejects when endpoints are missing', () => {
  const result = evaluateTripSelection({
    selectedBlockId: 'BLOCK_1',
    startTripId: null,
    endTripId: null,
    tripIndex: buildIndex(),
  });

  assert.deepEqual(result, { ok: false, reason: 'missingTripEndpoints' });
});

test('evaluateTripSelection rejects when block is not indexed', () => {
  const result = evaluateTripSelection({
    selectedBlockId: 'BLOCK_2',
    startTripId: 'TRIP_A',
    endTripId: 'TRIP_B',
    tripIndex: buildIndex(),
  });

  assert.deepEqual(result, { ok: false, reason: 'blockHasNoTrips' });
});

test('evaluateTripSelection rejects when endpoints fall outside the block', () => {
  const result = evaluateTripSelection({
    selectedBlockId: 'BLOCK_1',
    startTripId: 'TRIP_A',
    endTripId: 'TRIP_Z',
    tripIndex: buildIndex(),
  });

  assert.deepEqual(result, { ok: false, reason: 'endpointOutsideBlock' });
});

test('evaluateTripSelection rejects when start trip is after end trip', () => {
  const result = evaluateTripSelection({
    selectedBlockId: 'BLOCK_1',
    startTripId: 'TRIP_C',
    endTripId: 'TRIP_A',
    tripIndex: buildIndex(),
  });

  assert.deepEqual(result, { ok: false, reason: 'startAfterEnd' });
  assert.equal(selectionErrorToMessage(result.reason), '開始Tripは終了Tripより前を選んでください。');
});

test('evaluateTripSelection returns selection when inputs are valid', () => {
  const result = evaluateTripSelection({
    selectedBlockId: 'BLOCK_1',
    startTripId: 'TRIP_A',
    endTripId: 'TRIP_C',
    tripIndex: buildIndex(),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.selection, {
      blockId: 'BLOCK_1',
      startTripId: 'TRIP_A',
      endTripId: 'TRIP_C',
    });
  }
});

test('inferBlockCandidates lists candidates and supports exclusion', () => {
  const index: BlockTripSequenceIndex = new Map([
    [
      'BLOCK_X',
      new Map([
        ['TRIP_A', 1],
        ['TRIP_B', 2],
      ]),
    ],
    [
      'BLOCK_Y',
      new Map([
        ['TRIP_A', 5],
        ['TRIP_B', 6],
      ]),
    ],
  ]);

  const all = inferBlockCandidates('TRIP_A', 'TRIP_B', index);
  assert.deepEqual(new Set(all), new Set(['BLOCK_X', 'BLOCK_Y']));

  const excludeX = inferBlockCandidates('TRIP_A', 'TRIP_B', index, 'BLOCK_X');
  assert.deepEqual(excludeX, ['BLOCK_Y']);
});
