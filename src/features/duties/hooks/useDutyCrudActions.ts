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
import { evaluateTripSelection, selectionErrorToMessage } from '../utils/tripSelection';

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
    if (!resultRange.ok) {
      toast.error(selectionErrorToMessage(resultRange.reason));
      return;
    }
    try {
      dutyActions.moveSegment(
        {
          dutyId: selectedSegment.dutyId,
          segmentId: selectedSegment.segmentId,
          blockId: resultRange.selection.blockId,
          startTripId: resultRange.selection.startTripId,
          endTripId: resultRange.selection.endTripId,
        },
        tripIndex,
      );
      toast.success('区間を移動しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の移動に失敗しました。');
    }
  }, [dutyActions, selectedSegment, selectionResult, tripIndex]);

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
