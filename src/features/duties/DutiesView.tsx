/**
 * src/features/duties/DutiesView.tsx
 * 勤務（Duty）編集のハブとなる画面。タイムライン操作、ブロック一覧、Duty リスト、詳細インスペクターを統合する。
 */
import { useCallback, useMemo, useRef } from 'react';

import type { TimelineInteractionEvent, TimelineLane, TimelineSelection, TimelineSegment, TimelineSegmentDragEvent } from '@/features/timeline/types';
import { parseTimeLabel } from '@/features/timeline/timeScale';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { Duty, DutySegment } from '@/types';

import { BlockSummaryCard } from './components/BlockSummaryCard';
import { DutyListCard } from './components/DutyListCard';
import ManualCheckCard from './components/ManualCheckCard';
import { InspectorCard } from './components/InspectorCard';
import { DutyTimelineCard } from './components/DutyTimelineCard';
import { UnassignedSegmentsCard } from './components/UnassignedSegmentsCard';
import { DutyCsvPreview } from './components/DutyCsvPreview';
import { useDutyPlan } from './hooks/useDutyPlan';
import { computeUnassignedRanges } from '@/services/duty/unassigned';
import { useDutySelectionState, type SegmentSelection } from './hooks/useDutySelectionState';
import { useDutyTimelineData, type DutyTimelineMeta } from './hooks/useDutyTimelineData';
import { useDutyTimelineControls } from './hooks/useDutyTimelineControls';
import { useDutyKeyboardShortcuts } from './hooks/useDutyKeyboardShortcuts';
import { useDutyCrudActions } from './hooks/useDutyCrudActions';
import { useDutyCsvHandlers } from './hooks/useDutyCsvHandlers';
import { UnassignedRange } from '@/services/duty/unassigned';
import { toast } from 'sonner';
import { buildDutiesCsv } from '@/services/export/dutiesCsv';

export default function DutiesView(): JSX.Element {
  const { result, dutyState, dutyActions, manual } = useGtfsImport();
  const { plan, tripIndex, tripLookup, blockTripMinutes } = useDutyPlan({ result, manual });
  const unassignedRanges = useMemo(
    () => computeUnassignedRanges(plan, dutyState.duties),
    [plan, dutyState.duties],
  );

  const {
    selectedBlockId,
    setSelectedBlockId,
    selectedDutyId,
    setSelectedDutyId,
    selectedSegment,
    setSelectedSegment,
    startTripId,
    setStartTripId,
    endTripId,
    setEndTripId,
    defaultDriverId,
    setDefaultDriverId,
    selectedDuty,
    selectedSegmentDetail,
    selectedMetrics,
    dutyWarnings,
    warningTotals,
    filteredTrips,
    segmentCount,
    driverCount,
  } = useDutySelectionState({
    dutyState,
    plan,
    tripLookup,
    manual,
  });

  const dutyTimelineLanes = useDutyTimelineData(dutyState.duties, tripLookup);

  const blockTimelineLanes = useMemo<TimelineLane[]>(() => {
    return plan.summaries
      .map((summary) => {
        const trips = blockTripMinutes.get(summary.blockId) ?? [];

        let segments: TimelineSegment[];
        if (trips.length > 0) {
          segments = trips.map((trip, index) => ({
            id: `${summary.blockId}-${trip.tripId}-${index}`,
            label: trip.tripId,
            startMinutes: trip.startMinutes,
            endMinutes: trip.endMinutes,
            color: 'var(--primary)',
          }));
        } else {
          const startMinutes = parseTimeLabel(summary.firstTripStart);
          const endMinutes = parseTimeLabel(summary.lastTripEnd);
          if (startMinutes === undefined || endMinutes === undefined) {
            return null;
          }
          segments = [
            {
              id: `${summary.blockId}-window`,
              label: `${summary.firstTripStart} → ${summary.lastTripEnd}`,
              startMinutes,
              endMinutes: Math.max(endMinutes, startMinutes + 1),
              color: 'var(--primary)',
            },
          ];
        }

        if (segments.length === 0) return null;

        const lane: TimelineLane = {
          id: summary.blockId,
          label: `${summary.blockId}（${summary.tripCount}便）`,
          segments,
        };
        return lane;
      })
      .filter((lane): lane is TimelineLane => lane !== null);
  }, [blockTripMinutes, plan.summaries]);

  const {
    timelinePixelsPerMinute,
    setTimelinePixelsPerMinute,
    handleTimelineInteraction,
    handleTimelineSegmentDrag,
    handleTimelineSelect,
    handleDutySelect,
    handleSegmentSelect,
  } = useDutyTimelineControls({
    blockTripMinutes,
    dutyActions,
    tripIndex,
    onSelectDuty: setSelectedDutyId,
    onSelectSegment: setSelectedSegment,
    onSelectBlock: setSelectedBlockId,
    onStartTripChange: setStartTripId,
    onEndTripChange: setEndTripId,
  });

  useDutyKeyboardShortcuts({
    dutyState,
    selectedDutyId,
    selectedSegment,
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
    dutyActions,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    handleAdd,
    handleMove,
    handleDelete,
    handleAutoCorrect,
    handleUndo,
    handleRedo,
  } = useDutyCrudActions({
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
  });

  const { handleImportFile, handleExport, handleImportClick } = useDutyCsvHandlers({
    dutyActions,
    dutyState,
    tripIndex,
    tripLookup,
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
  });

  const previewTimestamp = useMemo(
    () => new Date().toISOString(),
    [dutyState.duties, dutyState.settings],
  );

  const csvPreview = useMemo(
    () =>
      buildDutiesCsv(dutyState.duties, {
        dutySettings: dutyState.settings,
        tripLookup,
        generatedAt: new Date(previewTimestamp),
      }),
    [dutyState.duties, dutyState.settings, tripLookup, previewTimestamp],
  );

  const csvPreviewGeneratedAt = useMemo(
    () => new Date(previewTimestamp).toLocaleString('ja-JP'),
    [previewTimestamp],
  );

  const handleBlockSelect = useCallback(
    (blockId: string) => {
      setSelectedBlockId(blockId);
      setStartTripId(null);
      setEndTripId(null);
      if (!selectedDuty || selectedDuty.segments.some((segment) => segment.blockId === blockId)) {
        setSelectedSegment((prev) => (prev && prev.dutyId === selectedDutyId ? prev : null));
      } else {
        setSelectedSegment(null);
      }
    },
    [selectedDuty, selectedDutyId, setEndTripId, setSelectedBlockId, setSelectedSegment, setStartTripId],
  );

  const handleTimelineInteractionCallback = useCallback(
    (interaction: TimelineInteractionEvent) => handleTimelineInteraction(interaction),
    [handleTimelineInteraction],
  );

  const handleTimelineSegmentDragCallback = useCallback(
    (event: TimelineSegmentDragEvent<DutyTimelineMeta>) => handleTimelineSegmentDrag(event),
    [handleTimelineSegmentDrag],
  );

  const handleTimelineSelectCallback = useCallback(
    (selectionArg: TimelineSelection) => handleTimelineSelect(selectionArg),
    [handleTimelineSelect],
  );

  const triggerImportClick = useCallback(
    () => handleImportClick(fileInputRef.current),
    [handleImportClick],
  );

  const handleDutySelectFromList = useCallback(
    (duty: Duty) => handleDutySelect(duty),
    [handleDutySelect],
  );

  const handleSegmentSelectFromList = useCallback(
    (duty: Duty, segment: DutySegment) => handleSegmentSelect(duty, segment),
    [handleSegmentSelect],
  );

  const handleSelectUnassignedRange = useCallback(
    (range: UnassignedRange) => {
      setSelectedBlockId(range.blockId);
      setStartTripId(range.startTripId);
      setEndTripId(range.endTripId);
      setSelectedSegment(null);
      toast.info(`未割当区間 ${range.blockId} (${range.startTripId}→${range.endTripId}) を選択しました。区間を追加してください。`);
    },
    [setEndTripId, setSelectedBlockId, setSelectedSegment, setStartTripId],
  );

  const selectedWarningSummary = selectedDuty ? dutyWarnings.get(selectedDuty.id) : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">勤務編集</h2>
        <p className="text-sm text-muted-foreground">
          ブロック推定結果をもとに Duty を作成・調整します。タイムラインで区間を編集し、一覧とインスペクターで詳細を確認してください。
        </p>
      </div>

      <DutyTimelineCard
        ref={fileInputRef}
        heading="タイムライン編集"
        description="ブロックをドラッグ＆ドロップして Duty を構成します。必要に応じて CSV の入出力も実行できます。"
        onImportClick={triggerImportClick}
        onImportFile={handleImportFile}
        onExport={handleExport}
        onAdd={handleAdd}
        onMove={handleMove}
        onDelete={handleDelete}
        onAutoCorrect={handleAutoCorrect}
        onUndo={handleUndo}
        onRedo={handleRedo}
        lanes={dutyTimelineLanes}
        pixelsPerMinute={timelinePixelsPerMinute}
        onInteraction={handleTimelineInteractionCallback}
        onSegmentDrag={handleTimelineSegmentDragCallback}
        onSelect={handleTimelineSelectCallback}
        warningTotals={warningTotals}
        blockLanes={blockTimelineLanes}
        onBlockSelect={handleBlockSelect}
        selectedBlockId={selectedBlockId}
        selectedDutyId={selectedDutyId}
        selectedSegmentId={selectedSegment?.segmentId ?? null}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <BlockSummaryCard
            plan={plan}
            selectedBlockId={selectedBlockId}
            onSelectBlock={handleBlockSelect}
            filteredTrips={filteredTrips}
            startTripId={startTripId}
            endTripId={endTripId}
            onStartTripChange={(value) => setStartTripId(value)}
            onEndTripChange={(value) => setEndTripId(value)}
            onAdd={handleAdd}
            onMove={handleMove}
            onDelete={handleDelete}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
          <UnassignedSegmentsCard ranges={unassignedRanges} onSelectRange={handleSelectUnassignedRange} />
          <ManualCheckCard manual={manual} plan={plan} duties={dutyState.duties} />
        </div>
        <div className="space-y-4">
          <DutyListCard
            duties={dutyState.duties}
            dutyWarnings={dutyWarnings}
            selectedDutyId={selectedDutyId}
            selectedSegmentId={selectedSegment?.segmentId ?? null}
            onSelectDuty={handleDutySelectFromList}
            onSelectSegment={handleSegmentSelectFromList}
          />
          <InspectorCard
            defaultDriverId={defaultDriverId}
            onDefaultDriverChange={(value) => setDefaultDriverId(value)}
            dutyCount={dutyState.duties.length}
            segmentCount={segmentCount}
            driverCount={driverCount}
            selectedDuty={selectedDuty}
            selectedSegment={selectedSegment}
            selectedSegmentDetail={selectedSegmentDetail}
            selectedMetrics={selectedMetrics}
            warningSummary={selectedWarningSummary}
            onAutoCorrect={handleAutoCorrect}
            driverOptions={manual.drivers}
          />
          <DutyCsvPreview
            csv={csvPreview.csv}
            rowCount={csvPreview.rowCount}
            fileName={csvPreview.fileName}
            generatedAt={csvPreviewGeneratedAt}
          />
        </div>
      </div>
    </div>
  );
}
















