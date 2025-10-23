/**
 * src/features/duties/hooks/useDutyCrudActions.ts
 * Duty 操作（追加・移動・削除・自動調整・Undo/Redo）に関わるハンドラを提供する。
 * DutiesView からは必要な状態を引数として渡すだけで済むようにまとめている。
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

import type { DutyEditorActions } from '@/services/import/GtfsImportProvider';
import type { BlockTripSequenceIndex } from '@/services/duty/dutyState';
import type { BlockTripLookup } from '@/services/duty/dutyMetrics';
import type { SegmentSelection } from './useDutySelectionState';
import { evaluateTripSelection, selectionErrorToMessage, inferBlockCandidates } from '../utils/tripSelection';

// 既存ロジックのフォールバック：候補が1件のみのときだけ自動推定する
function inferSingleBlockFromTrips(
  startTripId: string | null,
  endTripId: string | null,
  tripIndex: BlockTripSequenceIndex,
  excludeBlockId?: string,
): { blockId: string; startTripId: string; endTripId: string } | null {
  const candidates = inferBlockCandidates(startTripId, endTripId, tripIndex, excludeBlockId);
  if (candidates.length === 1 && startTripId && endTripId) {
    return { blockId: candidates[0]!, startTripId, endTripId };
  }
  return null;
}

interface DutyCrudParams {
  dutyActions: DutyEditorActions;
  tripIndex: BlockTripSequenceIndex;
  tripLookup: BlockTripLookup;
  selectedBlockId: string | null;
  selectedDutyId: string | null;
  selectedSegment: SegmentSelection | null;
  defaultDriverId: string;
  selectedDuty: { id: string } | null;
  setSelectedSegment: (selection: SegmentSelection | null) => void;
  setSelectedBlockId?: (blockId: string | null) => void;
  setStartTripId?: (tripId: string | null) => void;
  setEndTripId?: (tripId: string | null) => void;
  startTripId: string | null;
  endTripId: string | null;
}

interface DutyCrudResult {
  handleAdd: () => void;
  handleMove: () => void;
  handleDelete: () => void;
  handleAutoCorrect: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

export function useDutyCrudActions(params: DutyCrudParams): DutyCrudResult {
  const {
    dutyActions,
    tripIndex,
    tripLookup,
    selectedBlockId,
    selectedDutyId,
    selectedSegment,
    defaultDriverId,
    selectedDuty,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
    startTripId,
    endTripId,
  } = params;

  const selectionResult = useCallback(() => {
    return evaluateTripSelection({
      selectedBlockId,
      startTripId,
      endTripId,
      tripIndex,
    });
  }, [endTripId, selectedBlockId, startTripId, tripIndex]);

  const handleAdd = useCallback(() => {
    const resultRange = selectionResult();
    if (!resultRange.ok) {
      toast.error(selectionErrorToMessage(resultRange.reason));
      return;
    }
    try {
      dutyActions.addSegment(
        {
          blockId: resultRange.selection.blockId,
          startTripId: resultRange.selection.startTripId,
          endTripId: resultRange.selection.endTripId,
          dutyId: selectedDutyId ?? undefined,
          driverId: defaultDriverId || undefined,
        },
        tripIndex,
      );
      toast.success('区間を追加しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の追加に失敗しました。');
    }
  }, [defaultDriverId, dutyActions, selectedDutyId, selectionResult, tripIndex]);

  const handleMove = useCallback(() => {
    if (!selectedSegment) {
      toast.error('移動する区間を選んでください。');
      return;
    }
    const resultRange = selectionResult();
    let selection = resultRange.ok ? resultRange.selection : null;
    if (!resultRange.ok) {
      // 候補推定（承認ガード）
      const candidates = inferBlockCandidates(startTripId, endTripId, tripIndex, selectedSegment.blockId);
      if (candidates.length === 1 && startTripId && endTripId) {
        selection = { blockId: candidates[0]!, startTripId, endTripId };
      } else {
        if (candidates.length > 1) {
          toast.info(`複数のブロック候補があります。ブロック一覧から選択して再実行してください: ${candidates.join(', ')}`);
        } else {
          toast.error(selectionErrorToMessage(resultRange.reason));
        }
        return;
      }
    }
    if (!selection) {
      toast.error('選択内容を確認してください。');
      return;
    }
    try {
      dutyActions.moveSegment(
        {
          dutyId: selectedSegment.dutyId,
          segmentId: selectedSegment.segmentId,
          blockId: selection.blockId,
          startTripId: selection.startTripId,
          endTripId: selection.endTripId,
        },
        tripIndex,
      );
      // 移動後の選択同期（G4要件）：UI 側の選択状態を移動先に合わせる
      setSelectedSegment({ dutyId: selectedSegment.dutyId, segmentId: selectedSegment.segmentId });
      setSelectedBlockId?.(selection.blockId);
      setStartTripId?.(selection.startTripId);
      setEndTripId?.(selection.endTripId);
      toast.success('区間を移動しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の移動に失敗しました。');
    }
  }, [dutyActions, endTripId, selectedSegment, selectionResult, setEndTripId, setSelectedBlockId, setSelectedSegment, setStartTripId, startTripId, tripIndex]);

  const handleDelete = useCallback(() => {
    if (!selectedSegment) {
      toast.error('削除する区間を選んでください。');
      return;
    }
    try {
      dutyActions.deleteSegment({
        dutyId: selectedSegment.dutyId,
        segmentId: selectedSegment.segmentId,
      });
      setSelectedSegment(null);
      toast.success('区間を削除しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の削除に失敗しました。');
    }
  }, [dutyActions, selectedSegment, setSelectedSegment]);

  const handleAutoCorrect = useCallback(() => {
    if (!selectedDuty) {
      toast.error('乗務を選んでください。');
      return;
    }
    const changed = dutyActions.autoCorrect(selectedDuty.id, tripLookup);
    if (changed) {
      toast.success('乗務の内容を自動調整しました。');
      setSelectedSegment(null);
    } else {
      toast.info('調整が必要な項目は見つかりませんでした。');
    }
  }, [dutyActions, selectedDuty, setSelectedSegment, tripLookup]);

  const handleUndo = useCallback(() => dutyActions.undo(), [dutyActions]);
  const handleRedo = useCallback(() => dutyActions.redo(), [dutyActions]);

  return { handleAdd, handleMove, handleDelete, handleAutoCorrect, handleUndo, handleRedo };
}
