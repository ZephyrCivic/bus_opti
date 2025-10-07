/**
 * src/features/duties/DutiesView.tsx
 * Renders the three-pane Duty editing interface with block summaries, duty list,
 * and inspector panel wired to DutyEditState actions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  buildBlocksPlan,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockPlan,
} from '@/services/blocks/blockBuilder';
import {
  buildTripIndexFromPlan,
  type BlockTripSequenceIndex,
} from '@/services/duty/dutyState';
import { buildTripLookup, computeDutyMetrics } from '@/services/duty/dutyMetrics';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { Duty, DutySegment } from '@/types';

import { BlockSummaryCard } from './components/BlockSummaryCard';
import { DutyListCard } from './components/DutyListCard';
import { InspectorCard } from './components/InspectorCard';
import {
  evaluateTripSelection,
  selectionErrorToMessage,
} from './utils/tripSelection';

interface SegmentSelection {
  dutyId: string;
  segmentId: string;
}

export default function DutiesView(): JSX.Element {
  const { result, dutyState, dutyActions } = useGtfsImport();
  const undoAction = dutyActions.undo;
  const redoAction = dutyActions.redo;

  const plan = useMemo<BlockPlan>(
    () => buildBlocksPlan(result, { maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES }),
    [result],
  );
  const tripIndex = useMemo<BlockTripSequenceIndex>(() => buildTripIndexFromPlan(plan), [plan]);
  const tripLookup = useMemo(() => buildTripLookup(plan.csvRows), [plan.csvRows]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => plan.summaries.at(0)?.blockId ?? null);
  const [selectedDutyId, setSelectedDutyId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<SegmentSelection | null>(null);
  const [startTripId, setStartTripId] = useState<string | null>(null);
  const [endTripId, setEndTripId] = useState<string | null>(null);
  const [defaultDriverId, setDefaultDriverId] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      const key = event.key.toLowerCase();
      if (key === 'y') {
        event.preventDefault();
        redoAction();
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoAction();
        } else {
          undoAction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [redoAction, undoAction]);

  const selectedDuty = selectedDutyId ? dutyState.duties.find((duty) => duty.id === selectedDutyId) ?? null : null;
  const selectedMetrics = useMemo(
    () => (selectedDuty ? computeDutyMetrics(selectedDuty, tripLookup, dutyState.settings) : undefined),
    [selectedDuty, tripLookup, dutyState.settings],
  );

  const filteredTrips = useMemo(() => {
    if (!selectedBlockId) {
      return [];
    }
    return plan.csvRows
      .filter((row) => row.blockId === selectedBlockId)
      .sort((a, b) => a.seq - b.seq);
  }, [plan.csvRows, selectedBlockId]);

  const segmentCount = dutyState.duties.reduce((acc, duty) => acc + duty.segments.length, 0);

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
  }, [selectedDuty, dutyActions, tripLookup]);

  const handleBlockSelect = (blockId: string) => {
    setSelectedBlockId(blockId);
    setStartTripId(null);
    setEndTripId(null);
    if (!selectedDuty || selectedDuty.segments.some((segment) => segment.blockId === blockId)) {
      setSelectedSegment((prev) => (prev && prev.dutyId === selectedDutyId ? prev : null));
    }
  };

  const handleDutySelect = (duty: Duty) => {
    setSelectedDutyId(duty.id);
    if (duty.segments.length > 0) {
      setSelectedBlockId(duty.segments[0]!.blockId);
    }
  };

  const handleSegmentSelect = (duty: Duty, segment: DutySegment) => {
    setSelectedDutyId(duty.id);
    setSelectedSegment({ dutyId: duty.id, segmentId: segment.id });
    setSelectedBlockId(segment.blockId);
    setStartTripId(segment.startTripId);
    setEndTripId(segment.endTripId);
  };

  const handleAdd = () => {
    const selectionResult = evaluateTripSelection({
      selectedBlockId,
      startTripId,
      endTripId,
      tripIndex,
    });
    if (!selectionResult.ok) {
      toast.error(selectionErrorToMessage(selectionResult.reason));
      return;
    }

    try {
      dutyActions.addSegment(
        {
          blockId: selectionResult.selection.blockId,
          startTripId: selectionResult.selection.startTripId,
          endTripId: selectionResult.selection.endTripId,
          dutyId: selectedDutyId ?? undefined,
          driverId: defaultDriverId || undefined,
        },
        tripIndex,
      );
      toast.success('区間を追加しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の追加に失敗しました。');
    }
  };

  const handleMove = () => {
    if (!selectedSegment) {
      toast.error('移動する区間を選んでください。');
      return;
    }

    const selectionResult = evaluateTripSelection({
      selectedBlockId,
      startTripId,
      endTripId,
      tripIndex,
    });
    if (!selectionResult.ok) {
      toast.error(selectionErrorToMessage(selectionResult.reason));
      return;
    }

    try {
      dutyActions.moveSegment(
        {
          dutyId: selectedSegment.dutyId,
          segmentId: selectedSegment.segmentId,
          blockId: selectionResult.selection.blockId,
          startTripId: selectionResult.selection.startTripId,
          endTripId: selectionResult.selection.endTripId,
        },
        tripIndex,
      );
      toast.success('区間を移動しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の移動に失敗しました。');
    }
  };

  const handleDelete = () => {
    if (!selectedSegment) {
      toast.error('削除する区間を選んでください。');
      return;
    }
    try {
      dutyActions.deleteSegment({ dutyId: selectedSegment.dutyId, segmentId: selectedSegment.segmentId });
      setSelectedSegment(null);
      toast.success('区間を削除しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '区間の削除に失敗しました。');
    }
  };

  const handleUndo = () => {
    undoAction();
  };

  const handleRedo = () => {
    redoAction();
  };

  const selectedSegmentDetail = selectedSegment
    ? dutyState.duties
        .find((duty) => duty.id === selectedSegment.dutyId)?.segments
        .find((segment) => segment.id === selectedSegment.segmentId) ?? null
    : null;

  const driverCount = new Set(dutyState.duties.map((duty) => duty.driverId).filter(Boolean)).size;
  const selectedSegmentId = selectedSegment?.segmentId ?? null;
  const handleStartTripChange = (value: string) => setStartTripId(value);
  const handleEndTripChange = (value: string) => setEndTripId(value);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
      <BlockSummaryCard
        plan={plan}
        selectedBlockId={selectedBlockId}
        onSelectBlock={handleBlockSelect}
        filteredTrips={filteredTrips}
        startTripId={startTripId}
        endTripId={endTripId}
        onStartTripChange={handleStartTripChange}
        onEndTripChange={handleEndTripChange}
        onAdd={handleAdd}
        onMove={handleMove}
        onDelete={handleDelete}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      <DutyListCard
        duties={dutyState.duties}
        selectedDutyId={selectedDutyId}
        selectedSegmentId={selectedSegmentId}
        onSelectDuty={handleDutySelect}
        onSelectSegment={handleSegmentSelect}
      />
      <InspectorCard
        defaultDriverId={defaultDriverId}
        onDefaultDriverChange={setDefaultDriverId}
        dutyCount={dutyState.duties.length}
        segmentCount={segmentCount}
        driverCount={driverCount}
        selectedDuty={selectedDuty}
        selectedSegment={selectedSegment}
        selectedSegmentDetail={selectedSegmentDetail}
        selectedMetrics={selectedMetrics}
        onAutoCorrect={handleAutoCorrect}
      />
    </div>
  );
}
