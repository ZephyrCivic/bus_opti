/**
 * src/services/duty/validators.ts
 * Validation helpers to ensure Duty segments remain consistent and non-overlapping.
 */
import type { Duty, DutySegment } from '@/types';
import type { BlockTripSequenceIndex, SegmentRangeInput } from './types';

export function resolveRange(input: SegmentRangeInput, tripIndex: BlockTripSequenceIndex): {
  startSequence: number;
  endSequence: number;
} {
  const block = tripIndex.get(input.blockId);
  if (!block) {
    throw new Error(`block ${input.blockId} に一致するTripが見つかりません。`);
  }
  const startSequence = block.get(input.startTripId);
  if (startSequence === undefined) {
    throw new Error(`trip ${input.startTripId} は block ${input.blockId} に含まれていません。`);
  }
  const endSequence = block.get(input.endTripId);
  if (endSequence === undefined) {
    throw new Error(`trip ${input.endTripId} は block ${input.blockId} に含まれていません。`);
  }
  if (startSequence > endSequence) {
    throw new Error('セグメントの開始は終了より前である必要があります。');
  }
  return { startSequence, endSequence };
}

export function ensureBlockConsistency(duty: Duty, blockId: string): void {
  const hasDifferentBlock = duty.segments.some((segment) => segment.blockId !== blockId);
  if (hasDifferentBlock) {
    throw new Error('1つのDutyでは同じBlockのみ扱えます。');
  }
}

export function ensureNoOverlap(
  segments: DutySegment[],
  candidate: DutySegment,
  ignoreId?: string,
): void {
  for (const segment of segments) {
    if (segment.id === ignoreId || segment.blockId !== candidate.blockId) {
      continue;
    }
    const overlaps = candidate.startSequence <= segment.endSequence && candidate.endSequence >= segment.startSequence;
    if (overlaps) {
      throw new Error('同一Block内でセグメントが重複しています。');
    }
  }
}

