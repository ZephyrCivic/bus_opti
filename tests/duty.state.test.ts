/**
 * tests/duty.state.test.ts
 * Duty editing state transition tests covering add/move/delete/undo invariants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDutySegment,
  buildTripIndexFromPlan,
  buildTripIndexFromCsv,
  createDutyEditState,
  deleteDutySegment,
  moveDutySegment,
  undoLastAction,
  type AddDutySegmentInput,
  type BlockTripSequenceIndex,
  type MoveDutySegmentInput,
} from '@/services/duty/dutyState';
import type { BlockCsvRow, BlockPlan } from '@/services/blocks/blockBuilder';

function createIndexFromSequences(sequences: Record<string, string[]>): BlockTripSequenceIndex {
  const rows: BlockCsvRow[] = [];
  for (const [blockId, trips] of Object.entries(sequences)) {
    trips.forEach((tripId, idx) => {
      rows.push({
        blockId,
        seq: idx + 1,
        tripId,
        tripStart: '00:00',
        tripEnd: '00:30',
        fromStopId: undefined,
        toStopId: undefined,
        serviceId: undefined,
      });
    });
  }
  return buildTripIndexFromCsv(rows);
}

test('addDutySegment creates a new duty with deterministic ids', () => {
  const index = createIndexFromSequences({ BLOCK_001: ['T1', 'T2', 'T3'] });
  const initial = createDutyEditState();
  const input: AddDutySegmentInput = {
    blockId: 'BLOCK_001',
    startTripId: 'T1',
    endTripId: 'T2',
  };

  const next = addDutySegment(initial, input, index);
  assert.equal(next.duties.length, 1);
  assert.equal(next.duties[0].id, 'DUTY_001');
  assert.equal(next.duties[0].segments[0].id, 'SEG_001');
});

test('addDutySegment refuses overlaps within the same block', () => {
  const index = createIndexFromSequences({ BLOCK_001: ['T1', 'T2', 'T3'] });
  const state = addDutySegment(
    createDutyEditState(),
    { blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T2' },
    index,
  );

  assert.throws(() =>
    addDutySegment(state, { dutyId: 'DUTY_001', blockId: 'BLOCK_001', startTripId: 'T2', endTripId: 'T3' }, index),
  /重複/,
  );
});

test('moveDutySegment keeps ordering and updates sequences', () => {
  const index = createIndexFromSequences({ BLOCK_001: ['T1', 'T2', 'T3', 'T4'] });
  const state = addDutySegment(
    createDutyEditState(),
    { blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T2' },
    index,
  );

  const moved = moveDutySegment(
    state,
    {
      dutyId: 'DUTY_001',
      segmentId: 'SEG_001',
      blockId: 'BLOCK_001',
      startTripId: 'T2',
      endTripId: 'T4',
    },
    index,
  );

  const segment = moved.duties[0].segments[0];
  assert.equal(segment.startTripId, 'T2');
  assert.equal(segment.endTripId, 'T4');
  assert.equal(segment.startSequence, 2);
  assert.equal(segment.endSequence, 4);
});

test('deleteDutySegment removes duty when no segments remain', () => {
  const index = createIndexFromSequences({ BLOCK_001: ['T1', 'T2'] });
  const state = addDutySegment(
    createDutyEditState(),
    { blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T2' },
    index,
  );

  const afterDelete = deleteDutySegment(state, { dutyId: 'DUTY_001', segmentId: 'SEG_001' });
  assert.equal(afterDelete.duties.length, 0);
});

test('undoLastAction restores previous snapshot once', () => {
  const index = createIndexFromSequences({ BLOCK_001: ['T1', 'T2', 'T3'] });
  const initial = createDutyEditState();
  const first = addDutySegment(initial, { blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T1' }, index);
  const second = addDutySegment(first, { blockId: 'BLOCK_001', startTripId: 'T2', endTripId: 'T3' }, index);

  const undone = undoLastAction(second);
  assert.equal(undone.duties.length, 1);
  assert.equal(undone.duties[0].segments.length, 1);
  assert.equal(undone.duties[0].segments[0].startTripId, 'T1');

  const noRetry = undoLastAction(undone);
  assert.strictEqual(noRetry, undone);
});

test('moveDutySegment rejects changing blockId in MVP scope', () => {
  const index = createIndexFromSequences({ BLOCK_001: ['T1', 'T2'], BLOCK_002: ['T10', 'T11'] });
  const state = addDutySegment(
    createDutyEditState(),
    { blockId: 'BLOCK_001', startTripId: 'T1', endTripId: 'T2' },
    index,
  );

  const move: MoveDutySegmentInput = {
    dutyId: 'DUTY_001',
    segmentId: 'SEG_001',
    blockId: 'BLOCK_002',
    startTripId: 'T10',
    endTripId: 'T11',
  };

  assert.throws(() => moveDutySegment(state, move, index), /同一Block/);
});

function indexToRecord(index: BlockTripSequenceIndex): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [blockId, tripMap] of index.entries()) {
    result[blockId] = {};
    for (const [tripId, seq] of tripMap.entries()) {
      result[blockId]![tripId] = seq;
    }
  }
  return result;
}

test('buildTripIndexFromPlan mirrors csvRows content', () => {
  const rows: BlockCsvRow[] = [
    { blockId: 'BLOCK_001', seq: 1, tripId: 'T1', tripStart: '00:00', tripEnd: '00:10', fromStopId: undefined, toStopId: undefined, serviceId: undefined },
    { blockId: 'BLOCK_001', seq: 2, tripId: 'T2', tripStart: '00:10', tripEnd: '00:20', fromStopId: undefined, toStopId: undefined, serviceId: undefined },
    { blockId: 'BLOCK_002', seq: 1, tripId: 'T9', tripStart: '00:00', tripEnd: '00:15', fromStopId: undefined, toStopId: undefined, serviceId: undefined },
  ];
  const plan: BlockPlan = {
    summaries: [],
    csvRows: rows,
    unassignedTripIds: [],
    totalTripCount: rows.length,
    assignedTripCount: rows.length,
    coverageRatio: 1,
    maxTurnGapMinutes: 15,
  };

  const fromPlan = buildTripIndexFromPlan(plan);
  const fromCsv = buildTripIndexFromCsv(rows);

  assert.deepEqual(indexToRecord(fromPlan), indexToRecord(fromCsv));
});
