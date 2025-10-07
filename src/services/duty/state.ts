/**
 * src/services/duty/state.ts
 * Combines Duty state creation, segment transitions (add/move/delete),
 * and undo handling using dedicated helper modules.
 */
import type { Duty, DutyEditState, DutySegment, DutySettings } from '@/types';
import type { BlockCsvRow, BlockPlan } from '@/services/blocks/blockBuilder';

import { DEFAULT_DUTY_SETTINGS } from './constants';
import { buildTripIndexFromCsv, buildTripIndexFromPlan, type BlockTripSequenceIndex } from './indexing';
import {
  type AddDutySegmentInput,
  type DeleteDutySegmentInput,
  type MoveDutySegmentInput,
  type SegmentRangeInput,
} from './types';
import { captureSnapshot, cloneDuties, popSnapshot, pushSnapshot } from './history';
import { ensureBlockConsistency, ensureNoOverlap, resolveRange } from './validators';

export type { BlockTripSequenceIndex, AddDutySegmentInput, MoveDutySegmentInput, DeleteDutySegmentInput } from './types';

export function createDutyEditState(settings?: Partial<DutySettings>): DutyEditState {
  const resolved = {
    ...DEFAULT_DUTY_SETTINGS,
    ...settings,
  };
  return {
    duties: [],
    settings: resolved,
    undoStack: [],
    redoStack: [],
  };
}

export { buildTripIndexFromPlan, buildTripIndexFromCsv };

export function addDutySegment(
  state: DutyEditState,
  input: AddDutySegmentInput,
  tripIndex: BlockTripSequenceIndex,
): DutyEditState {
  const dutiesClone = cloneDuties(state.duties);
  const targetDuty = input.dutyId ? dutiesClone.find((duty) => duty.id === input.dutyId) : undefined;

  if (input.dutyId && !targetDuty) {
    throw new Error(`duty ${input.dutyId} が見つかりません。`);
  }

  const { startSequence, endSequence } = resolveRange(input, tripIndex);
  const segment = createSegment(targetDuty, input, startSequence, endSequence);

  if (targetDuty) {
    ensureBlockConsistency(targetDuty, input.blockId);
    ensureNoOverlap(targetDuty.segments, segment);
    targetDuty.segments = insertSegment(targetDuty.segments.filter((entry) => entry.id !== segment.id), segment);
    if (input.driverId) {
      targetDuty.driverId = input.driverId;
    }
  } else {
    dutiesClone.push({
      id: generateDutyId(dutiesClone),
      driverId: input.driverId,
      segments: [segment],
    });
  }

  return createNextState(state, dutiesClone);
}

export function moveDutySegment(
  state: DutyEditState,
  input: MoveDutySegmentInput,
  tripIndex: BlockTripSequenceIndex,
): DutyEditState {
  const dutiesClone = cloneDuties(state.duties);
  const duty = dutiesClone.find((entry) => entry.id === input.dutyId);
  if (!duty) {
    throw new Error(`duty ${input.dutyId} が見つかりません。`);
  }
  const segment = duty.segments.find((entry) => entry.id === input.segmentId);
  if (!segment) {
    throw new Error(`segment ${input.segmentId} が見つかりません。`);
  }
  if (segment.blockId !== input.blockId) {
    throw new Error('MVPでは同一Blockのみ移動できます。');
  }

  const { startSequence, endSequence } = resolveRange(input, tripIndex);
  const updated = {
    ...segment,
    startTripId: input.startTripId,
    endTripId: input.endTripId,
    startSequence,
    endSequence,
  };

  ensureNoOverlap(duty.segments, updated, segment.id);
  duty.segments = insertSegment(
    duty.segments.filter((entry) => entry.id !== segment.id),
    updated,
  );

  return createNextState(state, dutiesClone);
}

export function deleteDutySegment(
  state: DutyEditState,
  input: DeleteDutySegmentInput,
): DutyEditState {
  const dutiesClone = cloneDuties(state.duties);
  const dutyIndex = dutiesClone.findIndex((entry) => entry.id === input.dutyId);
  if (dutyIndex === -1) {
    throw new Error(`duty ${input.dutyId} が見つかりません。`);
  }

  const duty = dutiesClone[dutyIndex];
  const nextSegments = duty.segments.filter((segment) => segment.id !== input.segmentId);
  if (nextSegments.length === duty.segments.length) {
    throw new Error(`segment ${input.segmentId} が見つかりません。`);
  }

  if (nextSegments.length === 0) {
    dutiesClone.splice(dutyIndex, 1);
  } else {
    duty.segments = nextSegments;
  }

  return createNextState(state, dutiesClone);
}

export function undoLastAction(state: DutyEditState): DutyEditState {
  const result = popSnapshot(state.undoStack);
  if (!result) {
    return state;
  }
  const redoStack = pushSnapshot(state.redoStack, state.duties, state.settings.undoStackLimit);
  return {
    duties: result.snapshot,
    settings: state.settings,
    undoStack: result.stack,
    redoStack,
  };
}

export function redoLastAction(state: DutyEditState): DutyEditState {
  const result = popSnapshot(state.redoStack);
  if (!result) {
    return state;
  }
  const undoStack = pushSnapshot(state.undoStack, state.duties, state.settings.undoStackLimit);
  return {
    duties: result.snapshot,
    settings: state.settings,
    undoStack,
    redoStack: result.stack,
  };
}

export function replaceDutyState(
  state: DutyEditState,
  duties: Duty[],
): DutyEditState {
  return createNextState(state, cloneDuties(duties));
}

function createNextState(state: DutyEditState, duties: Duty[]): DutyEditState {
  const limit = state.settings.undoStackLimit;
  if (limit < 1) {
    return {
      duties,
      settings: state.settings,
      undoStack: [],
      redoStack: [],
    };
  }

  const snapshot = captureSnapshot(state);
  const undoStack = snapshot
    ? pushSnapshot(state.undoStack, snapshot, limit)
    : state.undoStack.slice();
  return {
    duties,
    settings: state.settings,
    undoStack,
    redoStack: [],
  };
}

function createSegment(
  duty: Duty | undefined,
  input: SegmentRangeInput,
  startSequence: number,
  endSequence: number,
): DutySegment {
  return {
    id: generateSegmentId(duty),
    blockId: input.blockId,
    startTripId: input.startTripId,
    endTripId: input.endTripId,
    startSequence,
    endSequence,
  };
}

function insertSegment(segments: DutySegment[], segment: DutySegment): DutySegment[] {
  const next = [...segments, segment];
  next.sort((a, b) => (a.startSequence === b.startSequence ? a.endSequence - b.endSequence : a.startSequence - b.startSequence));
  return next;
}

function generateDutyId(duties: Duty[]): string {
  let max = 0;
  for (const duty of duties) {
    const match = duty.id.match(/^DUTY_(\d{3,})$/);
    if (match) {
      const value = Number.parseInt(match[1]!, 10);
      if (!Number.isNaN(value)) {
        max = Math.max(max, value);
      }
    }
  }
  return formatDutyId(max + 1);
}

function generateSegmentId(duty?: Duty): string {
  const segments = duty?.segments ?? [];
  let max = 0;
  for (const segment of segments) {
    const match = segment.id.match(/^SEG_(\d{3,})$/);
    if (match) {
      const value = Number.parseInt(match[1]!, 10);
      if (!Number.isNaN(value)) {
        max = Math.max(max, value);
      }
    }
  }
  return `SEG_${String(max + 1).padStart(3, '0')}`;
}

function formatDutyId(value: number): string {
  return `DUTY_${String(value).padStart(3, '0')}`;
}
