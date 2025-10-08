/**
 * src/features/duties/DutiesView.tsx
 * Duty編集画面のコンテナ。独自フックで集約した状態とハンドラを用いて、各カードを組み合わせたUIを描画する。
 */
import { useCallback, useRef } from 'react';

import type { TimelineInteractionEvent, TimelineSelection, TimelineSegmentDragEvent } from '@/features/timeline/types';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { Duty, DutySegment } from '@/types';

import { BlockSummaryCard } from './components/BlockSummaryCard';
import { DutyListCard } from './components/DutyListCard';
import ManualCheckCard from './components/ManualCheckCard';
import { InspectorCard } from './components/InspectorCard';
import { DutyTimelineCard } from './components/DutyTimelineCard';
import { useDutyPlan } from './hooks/useDutyPlan';
import { useDutySelectionState, type SegmentSelection } from './hooks/useDutySelectionState';
import { useDutyTimelineData, type DutyTimelineMeta } from './hooks/useDutyTimelineData';
import { useDutyTimelineControls } from './hooks/useDutyTimelineControls';
import { useDutyKeyboardShortcuts } from './hooks/useDutyKeyboardShortcuts';
import { useDutyCrudActions } from './hooks/useDutyCrudActions';
import { useDutyCsvHandlers } from './hooks/useDutyCsvHandlers';

export default function DutiesView(): JSX.Element {
  const { result, dutyState, dutyActions, manual } = useGtfsImport();
  const { plan, tripIndex, tripLookup, blockTripMinutes } = useDutyPlan({ result, manual });

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
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
  });

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

  return (
    <div className="space-y-6">
      <DutyTimelineCard
        ref={fileInputRef}
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
          <ManualCheckCard manual={manual} plan={plan} duties={dutyState.duties} />
        </div>
        <div className="space-y-4">
          <DutyListCard
            duties={dutyState.duties}
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
            onAutoCorrect={handleAutoCorrect}
            driverOptions={manual.drivers}
          />
        </div>
      </div>
    </div>
  );
}


