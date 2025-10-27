/**
 * src/features/duties/hooks/useDutyCrudActions.ts
 * Duty 操作（追加・移動・削除・自動調整・Undo/Redo）に関わるハンドラを提供する。
 * DutiesView からは必要な状態を引数として渡すだけで済むようにまとめている。
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

import type { DutyEditorActions } from '@/services/import/GtfsImportProvider';
import type { DeadheadRule, Duty } from '@/types';
import type { BlockTripSequenceIndex } from '@/services/duty/dutyState';
import type { BlockTripLookup } from '@/services/duty/dutyMetrics';
import { toMinutes } from '@/services/duty/dutyMetrics';
import type { SegmentSelection } from './useDutySelectionState';
import { evaluateTripSelection, selectionErrorToMessage, inferBlockCandidates } from '../utils/tripSelection';
import { isStepOne } from '@/config/appStep';

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
  selectedDuty: Duty | null;
  setSelectedSegment: (selection: SegmentSelection | null) => void;
  setSelectedBlockId?: (blockId: string | null) => void;
  setStartTripId?: (tripId: string | null) => void;
  setEndTripId?: (tripId: string | null) => void;
  startTripId: string | null;
  endTripId: string | null;
  deadheadRules: DeadheadRule[];
}

interface DutyCrudResult {
  handleAdd: () => void;
  handleAddBreak: () => void;
  handleAddDeadhead: () => void;
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
    deadheadRules,
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

  const handleAddBreak = useCallback(() => {
    if (!selectedDutyId || !selectedDuty) {
      toast.error('休憩を追加する Duty を選択してください。');
      return;
    }
    const resultRange = selectionResult();
    if (!resultRange.ok) {
      toast.error('休憩の開始と終了となる便を選択してください。');
      return;
    }
    const { blockId, startTripId, endTripId } = resultRange.selection;
    if (startTripId === endTripId) {
      toast.error('休憩には開始・終了で異なる便を指定してください。');
      return;
    }

    const previousSegment = selectedDuty.segments.find(
      (segment) => (segment.kind ?? 'drive') !== 'break' && segment.endTripId === startTripId,
    );
    if (!previousSegment) {
      toast.error('指定した開始便で終了する区間が見つかりません。');
      return;
    }
    const nextSegment = selectedDuty.segments.find(
      (segment) => (segment.kind ?? 'drive') !== 'break' && segment.startTripId === endTripId,
    );
    if (!nextSegment) {
      toast.error('指定した終了便で開始する区間が見つかりません。');
      return;
    }

    const blockTrips = tripLookup.get(blockId);
    const startRow = blockTrips?.get(startTripId);
    const endRow = blockTrips?.get(endTripId);
    const startMinutes = toMinutes(startRow?.tripEnd);
    const endMinutes = toMinutes(endRow?.tripStart);
    if (startMinutes === undefined || endMinutes === undefined) {
      toast.error('便の時刻情報が不足しているため休憩を設定できません。');
      return;
    }
    const breakMinutes = endMinutes - startMinutes;
    if (breakMinutes <= 0) {
      toast.error('指定した便の間に休憩を挿入できる余裕がありません。');
      return;
    }

    try {
      dutyActions.addSegment(
        {
          dutyId: selectedDutyId,
          blockId,
          startTripId,
          endTripId,
          kind: 'break',
        },
        tripIndex,
      );
      toast.success(`休憩（約${Math.round(breakMinutes)}分）を追加しました。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '休憩の追加に失敗しました。');
    }
  }, [dutyActions, selectedDuty, selectedDutyId, selectionResult, tripIndex, tripLookup]);

  const handleAddDeadhead = useCallback(() => {
    if (!selectedDutyId || !selectedDuty) {
      toast.error('回送を追加する Duty を選択してください。');
      return;
    }
    const resultRange = selectionResult();
    if (!resultRange.ok) {
      toast.error('回送の開始と終了となる便を選択してください。');
      return;
    }
    const { blockId, startTripId: startId, endTripId: endId } = resultRange.selection;
    if (startId === endId) {
      return;
    }

    const previousSegment = selectedDuty.segments.find(
      (segment) => (segment.kind ?? 'drive') !== 'break' && segment.endTripId === startId,
    );
    if (!previousSegment) {
      toast.error('指定した開始便で終了する区間が見つかりません。');
      return;
    }
    const nextSegment = selectedDuty.segments.find(
      (segment) => (segment.kind ?? 'drive') !== 'break' && segment.startTripId === endId,
    );
    if (!nextSegment) {
      toast.error('指定した終了便で開始する区間が見つかりません。');
      return;
    }

    const blockTrips = tripLookup.get(blockId);
    const startRow = blockTrips?.get(startId);
    const endRow = blockTrips?.get(endId);
    const fromStopId = startRow?.toStopId;
    const toStopId = endRow?.fromStopId;
    if (!fromStopId || !toStopId) {
      toast.error('回送区間の停留所情報が不足しています。');
      return;
    }

    const startMinutes = toMinutes(startRow?.tripEnd);
    const endMinutes = toMinutes(endRow?.tripStart);
    if (startMinutes === undefined || endMinutes === undefined) {
      toast.error('便の時刻情報が不足しているため回送を設定できません。');
      return;
    }
    const gapMinutes = endMinutes - startMinutes;
    if (gapMinutes <= 0) {
      toast.error('指定した便の間に回送を挿入できる余裕がありません。');
      return;
    }

    const matchedRule = deadheadRules.find((rule) => rule.fromId === fromStopId && rule.toId === toStopId);
    let deadheadMinutes = matchedRule?.travelTimeMin ?? gapMinutes;
    if (!Number.isFinite(deadheadMinutes) || deadheadMinutes <= 0) {
      deadheadMinutes = gapMinutes;
    }
    if (deadheadMinutes > gapMinutes) {
      toast.info('deadhead_rules の所要時間がギャップを超えているため、ギャップ時間を使用します。');
      deadheadMinutes = gapMinutes;
    } else if (!matchedRule) {
      toast.info('deadhead_rules.csv に該当ルールが見つからなかったため、ギャップ時間を使用します。');
    }

    try {
      dutyActions.addSegment(
        {
          dutyId: selectedDutyId,
          blockId,
          startTripId: startId,
          endTripId: endId,
          kind: 'deadhead',
          deadheadMinutes,
          deadheadRuleId: matchedRule ? `${matchedRule.fromId}->${matchedRule.toId}` : undefined,
          deadheadFromStopId: fromStopId,
          deadheadToStopId: toStopId,
        },
        tripIndex,
      );
      toast.success(`回送（約${Math.round(deadheadMinutes)}分）を追加しました。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '回送の追加に失敗しました。');
    }
  }, [deadheadRules, dutyActions, selectedDuty, selectedDutyId, selectionResult, tripIndex, tripLookup]);

  const handleMove = useCallback(() => {
    if (!selectedSegment) {
      toast.error('移動する区間を選んでください。');
      return;
    }
    const currentSegment =
      selectedDuty?.segments.find((segment) => segment.id === selectedSegment.segmentId) ?? null;
    if ((currentSegment?.kind ?? 'drive') === 'break' || (currentSegment?.kind ?? 'drive') === 'deadhead') {
      toast.error('休憩や回送区間は移動できません。削除して再追加してください。');
      return;
    }
    const resultRange = selectionResult();
    let selection = resultRange.ok ? resultRange.selection : null;
    if (!resultRange.ok) {
      // 候補推定（承認ガード）
      const candidates = inferBlockCandidates(startTripId, endTripId, tripIndex, currentSegment?.blockId);
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
  }, [dutyActions, endTripId, selectedDuty, selectedSegment, selectionResult, setEndTripId, setSelectedBlockId, setSelectedSegment, setStartTripId, startTripId, tripIndex]);

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
    if (isStepOne) {
      toast.info('Step1 では自動調整は提供していません。区間は手動で編集してください。');
      return;
    }
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

  return { handleAdd, handleAddBreak, handleAddDeadhead, handleMove, handleDelete, handleAutoCorrect, handleUndo, handleRedo };
}

