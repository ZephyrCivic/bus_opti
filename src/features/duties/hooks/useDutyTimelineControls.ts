/**
 * src/features/duties/hooks/useDutyTimelineControls.ts
 * TimelineGantt 操作（ズーム・ドラッグ・クリック選択）に伴う状態更新ロジックをまとめる。
 * DutiesView からはコールバックを受け取り、選択状態の更新を集中管理する。
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import type { Duty, DutySegment } from '@/types';
import type { BlockTripSequenceIndex } from '@/services/duty/dutyState';
import type { TimelineInteractionEvent, TimelineSelection, TimelineSegmentDragEvent } from '@/features/timeline/types';
import { DEFAULT_PIXELS_PER_MINUTE } from '@/features/timeline/timeScale';
import { applySegmentDrag, type DutyTimelineTrip } from '@/features/duties/utils/timelineSnap';
import type { DutyEditorActions } from '@/services/import/GtfsImportProvider';
import type { DutyTimelineMeta } from './useDutyTimelineData';
import type { SegmentSelection } from './useDutySelectionState';

interface DutyTimelineControlsParams {
  blockTripMinutes: Map<string, DutyTimelineTrip[]>;
  dutyActions: DutyEditorActions;
  tripIndex: BlockTripSequenceIndex;
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
}

export function useDutyTimelineControls(params: DutyTimelineControlsParams): DutyTimelineControlsResult {
  const {
    blockTripMinutes,
    dutyActions,
    tripIndex,
    onSelectDuty,
    onSelectSegment,
    onSelectBlock,
    onStartTripChange,
    onEndTripChange,
    selectedBlockId,
  } = params;

  const [timelinePixelsPerMinute, setTimelinePixelsPerMinute] = useState(DEFAULT_PIXELS_PER_MINUTE);

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
      if (meta.kind === 'break') {
        toast.info('休憩区間はドラッグできません。');
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

  return {
    timelinePixelsPerMinute,
    setTimelinePixelsPerMinute,
    handleTimelineInteraction,
    handleTimelineSegmentDrag,
    handleTimelineSelect,
    handleDutySelect,
    handleSegmentSelect,
  };
}
