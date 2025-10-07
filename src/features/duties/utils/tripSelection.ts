/**
 * src/features/duties/utils/tripSelection.ts
 * Validates block trip selections and exposes reusable error messaging to keep DutiesView lean.
 */
import type { BlockTripSequenceIndex } from '@/services/duty/types';

export type TripSelectionError =
  | 'missingBlock'
  | 'missingTripEndpoints'
  | 'blockHasNoTrips'
  | 'endpointOutsideBlock'
  | 'startAfterEnd';

export interface TripSelectionRequest {
  selectedBlockId: string | null;
  startTripId: string | null;
  endTripId: string | null;
  tripIndex: BlockTripSequenceIndex;
}

export interface TripSelectionSuccess {
  ok: true;
  selection: {
    blockId: string;
    startTripId: string;
    endTripId: string;
  };
}

export interface TripSelectionFailure {
  ok: false;
  reason: TripSelectionError;
}

export type TripSelectionResult = TripSelectionSuccess | TripSelectionFailure;

export function evaluateTripSelection(
  request: TripSelectionRequest,
): TripSelectionResult {
  const { selectedBlockId, startTripId, endTripId, tripIndex } = request;

  if (!selectedBlockId) {
    return { ok: false, reason: 'missingBlock' };
  }

  if (!startTripId || !endTripId) {
    return { ok: false, reason: 'missingTripEndpoints' };
  }

  const blockTrips = tripIndex.get(selectedBlockId);
  if (!blockTrips) {
    return { ok: false, reason: 'blockHasNoTrips' };
  }

  const startSeq = blockTrips.get(startTripId);
  const endSeq = blockTrips.get(endTripId);
  if (startSeq === undefined || endSeq === undefined) {
    return { ok: false, reason: 'endpointOutsideBlock' };
  }

  if (startSeq > endSeq) {
    return { ok: false, reason: 'startAfterEnd' };
  }

  return {
    ok: true,
    selection: {
      blockId: selectedBlockId,
      startTripId,
      endTripId,
    },
  };
}

export function selectionErrorToMessage(reason: TripSelectionError): string {
  switch (reason) {
    case 'missingBlock':
      return 'Blockを選択してください。';
    case 'missingTripEndpoints':
      return '開始と終了のTripを選択してください。';
    case 'blockHasNoTrips':
      return '選択したBlockに対応するTripが見つかりません。';
    case 'endpointOutsideBlock':
      return '選択したTripはBlockに含まれていません。';
    case 'startAfterEnd':
      return '開始Tripは終了Tripより前を選んでください。';
    default:
      return '選択内容を確認してください。';
  }
}
