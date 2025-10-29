/**
 * src/features/duties/hooks/useDutyTimelineControls.ts
 * TimelineGantt 操作（ズーム・ドラッグ・クリック選択）に伴う状態更新ロジックをまとめる。
 * DutiesView からはコールバックを受け取り、選択状態の更新を集中管理する。
 */
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { Duty, DutySegment } from '@/types';
import type { BlockTripSequenceIndex } from '@/services/duty/dutyState';
import type {
  TimelineInteractionEvent,
  TimelineSelection,
  TimelineSegmentDragEvent,
  TimelineExternalDropEvent,
  TimelineExternalDragOverEvent,
} from '@/features/timeline/types';
import { DEFAULT_PIXELS_PER_MINUTE } from '@/features/timeline/timeScale';
import { applySegmentDrag, type DutyTimelineTrip } from '@/features/duties/utils/timelineSnap';
import { resolveDropRangeForTrips, resolveGapAroundMinutesForTrips } from '@/features/duties/utils/dnd';
import type { DutyEditorActions } from '@/services/import/GtfsImportProvider';
import type { DutyTimelineMeta } from './useDutyTimelineData';
import type { SegmentSelection } from './useDutySelectionState';
import { TIMELINE_NEW_LANE_ID } from '@/features/timeline/TimelineGantt';
import type { BlockTripLookup } from '@/services/duty/dutyMetrics';
import { toMinutes } from '@/services/duty/dutyMetrics';
import { recordTelemetryEvent } from '@/services/telemetry/telemetry';

interface DutyTimelineControlsParams {
  blockTripMinutes: Map<string, DutyTimelineTrip[]>;
  dutyActions: DutyEditorActions;
  tripIndex: BlockTripSequenceIndex;
  tripLookup: BlockTripLookup;
  duties: Duty[];
  onSelectDuty: (id: string) => void;
  onSelectSegment: (selection: SegmentSelection | null) => void;
  onSelectBlock: (blockId: string | null) => void;
  onStartTripChange: (tripId: string | null) => void;
  onEndTripChange: (tripId: string | null) => void;
  selectedBlockId: string | null;
}

interface DutyTimelineControlsResult {
  timelinePixelsPerMinute: number;
  setTimelinePixelsPerMinute: (value: number) => void;
  handleTimelineInteraction: (interaction: TimelineInteractionEvent) => void;
  handleTimelineSegmentDrag: (event: TimelineSegmentDragEvent<DutyTimelineMeta>) => void;
  handleTimelineSelect: (selection: TimelineSelection) => void;
  handleDutySelect: (duty: Duty) => void;
  handleSegmentSelect: (duty: Duty, segment: DutySegment) => void;
  handleExternalDrop: (event: TimelineExternalDropEvent<DutyTimelineMeta>) => boolean;
  handleExternalDragOver: (event: TimelineExternalDragOverEvent<DutyTimelineMeta>) => void;
}

export function useDutyTimelineControls(params: DutyTimelineControlsParams): DutyTimelineControlsResult {
  const {
    blockTripMinutes,
    dutyActions,
    tripIndex,
    tripLookup,
    duties,
    onSelectDuty,
    onSelectSegment,
    onSelectBlock,
    onStartTripChange,
    onEndTripChange,
    selectedBlockId,
  } = params;

  const [timelinePixelsPerMinute, setTimelinePixelsPerMinute] = useState(DEFAULT_PIXELS_PER_MINUTE);

  const dutiesById = useMemo(() => {
    return new Map(duties.map((duty) => [duty.id, duty]));
  }, [duties]);

  const emitDropEvent = useCallback((payload: Record<string, unknown>) => {
    recordTelemetryEvent({
      type: 'duty.dnd.drop',
      payload,
    });
  }, []);

  const clampPixelsPerMinute = useCallback((value: number) => {
    const MIN = 0.5;
    const MAX = 6;
    return Math.min(MAX, Math.max(MIN, value));
  }, []);

  const handleTimelineInteraction = useCallback(
    (interaction: TimelineInteractionEvent) => {
      if (interaction.type !== 'zoom') {
        return;
      }
      setTimelinePixelsPerMinute((prev) => {
        const factor = interaction.delta > 0 ? 0.9 : 1.1;
        const next = clampPixelsPerMinute(prev * factor);
        return Number(next.toFixed(3));
      });
    },
    [clampPixelsPerMinute],
  );

  const handleTimelineSegmentDrag = useCallback(
    (event: TimelineSegmentDragEvent<DutyTimelineMeta>) => {
      const meta = event.segment.meta;
      if (!meta) {
        return;
      }
      if (meta.kind === 'break' || meta.kind === 'deadhead') {
        toast.info('休憩や回送区間はドラッグできません。');
        return;
      }
      const trips = blockTripMinutes.get(meta.blockId);
      if (!trips || trips.length === 0) {
        return;
      }
      const snapped = applySegmentDrag({
        trips,
        startTripId: meta.startTripId,
        endTripId: meta.endTripId,
        mode: event.mode,
        deltaMinutes: event.deltaMinutes,
      });
      if (snapped.startTripId === meta.startTripId && snapped.endTripId === meta.endTripId) {
        return;
      }
      try {
        dutyActions.moveSegment(
          {
            dutyId: meta.dutyId,
            segmentId: meta.segmentId,
            blockId: meta.blockId,
            startTripId: snapped.startTripId,
            endTripId: snapped.endTripId,
          },
          tripIndex,
        );
        onSelectDuty(meta.dutyId);
        onSelectSegment({ dutyId: meta.dutyId, segmentId: meta.segmentId });
        onSelectBlock(meta.blockId);
        onStartTripChange(snapped.startTripId);
        onEndTripChange(snapped.endTripId);
        toast.success('タイムラインを更新しました。');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'ドラッグ操作に失敗しました。');
      }
    },
    [blockTripMinutes, dutyActions, onEndTripChange, onSelectBlock, onSelectDuty, onSelectSegment, onStartTripChange, tripIndex],
  );

  const handleTimelineSelect = useCallback(
    (selection: TimelineSelection) => {
      onSelectDuty(selection.laneId);
      if (selection.segment?.meta && typeof selection.segment.meta === 'object') {
        const meta = selection.segment.meta as {
          segmentId?: string;
          blockId?: string;
          startTripId?: string;
          endTripId?: string;
        };
        const segmentId = meta.segmentId ?? selection.segment.id;
        onSelectSegment({ dutyId: selection.laneId, segmentId });
        if (meta.blockId && (!selectedBlockId || selectedBlockId === meta.blockId)) {
          onSelectBlock(meta.blockId);
          if (meta.startTripId) {
            onStartTripChange(meta.startTripId);
          }
          if (meta.endTripId) {
            onEndTripChange(meta.endTripId);
          }
        }
      } else if (selection.segmentId) {
        onSelectSegment({ dutyId: selection.laneId, segmentId: selection.segmentId });
      }
    },
    [onEndTripChange, onSelectBlock, onSelectDuty, onSelectSegment, onStartTripChange, selectedBlockId],
  );

  const handleDutySelect = useCallback(
    (duty: Duty) => {
      onSelectDuty(duty.id);
      if (duty.segments.length > 0 && (!selectedBlockId || selectedBlockId === duty.segments[0]!.blockId)) {
        onSelectBlock(duty.segments[0]!.blockId);
      }
    },
    [onSelectBlock, onSelectDuty, selectedBlockId],
  );

  const handleSegmentSelect = useCallback(
    (duty: Duty, segment: DutySegment) => {
      onSelectDuty(duty.id);
      onSelectSegment({ dutyId: duty.id, segmentId: segment.id });
      const shouldSyncBlock = !selectedBlockId || selectedBlockId === segment.blockId;
      if (shouldSyncBlock) {
        onSelectBlock(segment.blockId);
        onStartTripChange(segment.startTripId);
        onEndTripChange(segment.endTripId);
      }
    },
    [onEndTripChange, onSelectBlock, onSelectDuty, onSelectSegment, onStartTripChange, selectedBlockId],
  );

  const resolveDropRange = useCallback(
    (blockId: string, startTripId: string, endTripId: string, minutes: number | null | undefined) => {
      return resolveDropRangeForTrips(blockTripMinutes.get(blockId), startTripId, endTripId, minutes);
    },
    [blockTripMinutes],
  );

  const resolveGapAroundMinutes = useCallback(
    (blockId: string, minutes: number | null | undefined) => {
      return resolveGapAroundMinutesForTrips(blockTripMinutes.get(blockId), minutes);
    },
    [blockTripMinutes],
  );

  const handleExternalDrop = useCallback(
    (event: TimelineExternalDropEvent<DutyTimelineMeta>) => {
      const { payload, laneId, minutes, isNewLane } = event;
      const dutyId = !isNewLane && laneId !== TIMELINE_NEW_LANE_ID ? laneId : undefined;

      const applyRangeAndSelect = (
        targetDutyId: string | undefined,
        blockId: string,
        range: { startTripId: string; endTripId: string },
      ) => {
        onSelectBlock(blockId);
        onStartTripChange(range.startTripId);
        onEndTripChange(range.endTripId);
        if (targetDutyId) {
          onSelectDuty(targetDutyId);
        }
      };

      if (payload.type === 'block-trip' || payload.type === 'block-trip-range' || payload.type === 'unassigned-range') {
        const baseStartTripId =
          payload.type === 'block-trip' ? payload.tripId : payload.startTripId;
        const baseEndTripId =
          payload.type === 'block-trip' ? payload.tripId : payload.endTripId;
        const resolvedRange = resolveDropRange(payload.blockId, baseStartTripId, baseEndTripId, minutes);
        try {
          dutyActions.addSegment(
            {
              blockId: payload.blockId,
              startTripId: resolvedRange.startTripId,
              endTripId: resolvedRange.endTripId,
              dutyId,
            },
            tripIndex,
          );
          applyRangeAndSelect(dutyId, payload.blockId, resolvedRange);
          toast.success('ブロック行路をDutyに追加しました。');
          emitDropEvent({
            kind: payload.type,
            blockId: payload.blockId,
            startTripId: resolvedRange.startTripId,
            endTripId: resolvedRange.endTripId,
            dutyId: dutyId ?? null,
          });
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Dutyへの追加に失敗しました。');
          return false;
        }
      }

      if (payload.type === 'duty-segment') {
        const targetRange = resolveDropRange(payload.blockId, payload.startTripId, payload.endTripId, minutes);
        if (!dutyId) {
          try {
            dutyActions.addSegment(
              {
                blockId: payload.blockId,
                startTripId: targetRange.startTripId,
                endTripId: targetRange.endTripId,
              },
              tripIndex,
            );
            dutyActions.deleteSegment({
              dutyId: payload.dutyId,
              segmentId: payload.segmentId,
            });
            applyRangeAndSelect(undefined, payload.blockId, targetRange);
            onSelectSegment(null);
            toast.success('セグメントを新しいDutyとして作成しました。');
            emitDropEvent({
              kind: payload.type,
              blockId: payload.blockId,
              startTripId: targetRange.startTripId,
              endTripId: targetRange.endTripId,
              dutyId: null,
              sourceDutyId: payload.dutyId,
            });
            return true;
          } catch (error) {
            toast.error(error instanceof Error ? error.message : '新しいDutyへの移動に失敗しました。');
            return false;
          }
        }

        if (dutyId === payload.dutyId) {
          if (
            targetRange.startTripId === payload.startTripId &&
            targetRange.endTripId === payload.endTripId
          ) {
            return false;
          }
          try {
            dutyActions.moveSegment(
              {
                dutyId: payload.dutyId,
                segmentId: payload.segmentId,
                blockId: payload.blockId,
                startTripId: targetRange.startTripId,
                endTripId: targetRange.endTripId,
              },
              tripIndex,
            );
            applyRangeAndSelect(payload.dutyId, payload.blockId, targetRange);
            onSelectSegment({ dutyId: payload.dutyId, segmentId: payload.segmentId });
            toast.success('セグメントを移動しました。');
            return true;
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'セグメントの移動に失敗しました。');
            return false;
          }
        }
        try {
          dutyActions.addSegment(
            {
              blockId: payload.blockId,
              startTripId: targetRange.startTripId,
              endTripId: targetRange.endTripId,
              dutyId,
            },
            tripIndex,
          );
          dutyActions.deleteSegment({
            dutyId: payload.dutyId,
            segmentId: payload.segmentId,
          });
          applyRangeAndSelect(dutyId, payload.blockId, targetRange);
          onSelectSegment(null);
          toast.success('セグメントを移動しました。');
          emitDropEvent({
            kind: payload.type,
            blockId: payload.blockId,
            startTripId: targetRange.startTripId,
            endTripId: targetRange.endTripId,
            dutyId,
            sourceDutyId: payload.dutyId,
          });
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'セグメントの移動に失敗しました。');
          return false;
        }
      }

      if (payload.type === 'break-token') {
        if (!dutyId) {
          toast.info('休憩トークンは既存Duty上にドロップしてください。');
          return false;
        }
        const duty = dutiesById.get(dutyId);
        if (!duty) {
          toast.error('対象のDutyが見つかりません。');
          return false;
        }
        const candidateBlockIds: string[] = [];
        if (event.segment?.meta?.blockId) {
          candidateBlockIds.push(event.segment.meta.blockId);
        }
        for (const segment of duty.segments) {
          if (!candidateBlockIds.includes(segment.blockId)) {
            candidateBlockIds.push(segment.blockId);
          }
        }
        let gapBlockId: string | null = null;
        let gapResult: ReturnType<typeof resolveGapAroundMinutes> = null;
        for (const blockId of candidateBlockIds) {
          const detectedGap = resolveGapAroundMinutes(blockId, minutes);
          if (detectedGap) {
            gapBlockId = blockId;
            gapResult = detectedGap;
            break;
          }
        }
        if (!gapResult || !gapBlockId) {
          toast.info('ドロップ位置に休憩を挿入できるギャップが見つかりません。');
          return false;
        }
        const gap = gapResult;
        const hasPreceding = duty.segments.some(
          (segment) => (segment.kind ?? 'drive') !== 'break' && segment.endTripId === gap.startTripId,
        );
        const hasFollowing = duty.segments.some(
          (segment) => (segment.kind ?? 'drive') !== 'break' && segment.startTripId === gap.endTripId,
        );
        if (!hasPreceding || !hasFollowing) {
          toast.info('連続する運行区間の間にのみ休憩を追加できます。');
          return false;
        }
        try {
          dutyActions.addSegment(
            {
              dutyId,
              blockId: gapBlockId,
              startTripId: gap.startTripId,
              endTripId: gap.endTripId,
              breakUntilTripId: gap.endTripId,
              kind: 'break',
            },
            tripIndex,
          );
          applyRangeAndSelect(dutyId, gapBlockId, { startTripId: gap.startTripId, endTripId: gap.endTripId });
          toast.success('休憩を追加しました。');
          emitDropEvent({
            kind: payload.type,
            blockId: gapBlockId,
            startTripId: gap.startTripId,
            endTripId: gap.endTripId,
            dutyId,
            gapMinutes: gap.gapMinutes,
          });
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '休憩の追加に失敗しました。');
          return false;
        }
      }

      if (payload.type === 'deadhead-token') {
        if (!dutyId) {
          toast.info('回送トークンは既存Duty上にドロップしてください。');
          return false;
        }
        const duty = dutiesById.get(dutyId);
        if (!duty) {
          toast.error('対象のDutyが見つかりません。');
          return false;
        }
        const candidateBlockIds: string[] = [];
        if (event.segment?.meta?.blockId) {
          candidateBlockIds.push(event.segment.meta.blockId);
        }
        for (const segment of duty.segments) {
          if (!candidateBlockIds.includes(segment.blockId)) {
            candidateBlockIds.push(segment.blockId);
          }
        }
        let gapBlockId: string | null = null;
        let gapResult: ReturnType<typeof resolveGapAroundMinutes> = null;
        for (const blockId of candidateBlockIds) {
          const detectedGap = resolveGapAroundMinutes(blockId, minutes);
          if (detectedGap) {
            gapBlockId = blockId;
            gapResult = detectedGap;
            break;
          }
        }
        if (!gapResult || !gapBlockId) {
          toast.info('ドロップ位置に回送を挿入できるギャップが見つかりません。');
          return false;
        }
        const gap = gapResult;
        const block = tripLookup.get(gapBlockId);
        const startRow = block?.get(gap.startTripId);
        const endRow = block?.get(gap.endTripId);
        const startMinutes = toMinutes(startRow?.tripEnd ?? startRow?.tripStart);
        const endMinutes = toMinutes(endRow?.tripStart ?? endRow?.tripEnd);
        const gapMinutes = typeof startMinutes === 'number' && typeof endMinutes === 'number'
          ? Math.max(endMinutes - startMinutes, 0)
          : gap.gapMinutes;
        if (!startRow || !endRow || !startRow.toStopId || !endRow.fromStopId || !Number.isFinite(gapMinutes) || gapMinutes <= 0) {
          toast.info('回送を追加するための条件が満たされていません。');
          return false;
        }
        try {
          dutyActions.addSegment(
            {
              dutyId,
              blockId: gapBlockId,
              startTripId: gap.startTripId,
              endTripId: gap.endTripId,
              kind: 'deadhead',
              deadheadMinutes: gapMinutes,
              deadheadFromStopId: startRow.toStopId,
              deadheadToStopId: endRow.fromStopId,
            },
            tripIndex,
          );
          applyRangeAndSelect(dutyId, gapBlockId, { startTripId: gap.startTripId, endTripId: gap.endTripId });
          toast.success(`回送（約${Math.round(gapMinutes)}分）を追加しました。`);
          emitDropEvent({
            kind: payload.type,
            blockId: gapBlockId,
            startTripId: gap.startTripId,
            endTripId: gap.endTripId,
            dutyId,
            deadheadMinutes: gapMinutes,
          });
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '回送の追加に失敗しました。');
          return false;
        }
      }

      toast.info('このドラッグペイロードには未対応です。');
      return false;
    },
    [
      dutyActions,
      dutiesById,
      onEndTripChange,
      onSelectBlock,
      onSelectDuty,
      onSelectSegment,
      onStartTripChange,
      resolveGapAroundMinutes,
      resolveDropRange,
      tripIndex,
      tripLookup,
      emitDropEvent,
    ],
  );

  const handleExternalDragOver = useCallback(
    (event: TimelineExternalDragOverEvent<DutyTimelineMeta>) => {
      if (!event.laneId || event.laneId === TIMELINE_NEW_LANE_ID || event.isNewLane) {
        return;
      }
      onSelectDuty(event.laneId);
      if (event.payload.type === 'block-trip' || event.payload.type === 'block-trip-range') {
        onSelectBlock(event.payload.blockId);
      } else if (event.payload.type === 'duty-segment' || event.payload.type === 'unassigned-range') {
        onSelectBlock(event.payload.blockId);
      }
    },
    [onSelectBlock, onSelectDuty],
  );

  return {
    timelinePixelsPerMinute,
    setTimelinePixelsPerMinute,
    handleTimelineInteraction,
    handleTimelineSegmentDrag,
    handleTimelineSelect,
    handleDutySelect,
    handleSegmentSelect,
    handleExternalDrop,
    handleExternalDragOver,
  };
}
