/**
 * src/features/duties/DutiesView.tsx
 * Renders the three-pane Duty editing interface with block summaries, duty list,
 * and inspector panel wired to DutyEditState actions.
 */
import { useCallback, useMemo, useState } from 'react';
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

interface SegmentSelection {
  dutyId: string;
  segmentId: string;
}

export default function DutiesView(): JSX.Element {
  const { result, dutyState, dutyActions } = useGtfsImport();

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
      toast.error('Dutyを選択してください。');
      return;
    }
    const changed = dutyActions.autoCorrect(selectedDuty.id, tripLookup);
    if (changed) {
      toast.success('Dutyを自動補正しました。');
      setSelectedSegment(null);
    } else {
      toast.info('補正対象の違反は見つかりませんでした。');
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

  const ensureSelection = (): { blockId: string; start: string; end: string } | null => {
    if (!selectedBlockId) {
      toast.error('Blockを選択してください。');
      return null;
    }
    if (!startTripId || !endTripId) {
      toast.error('開始と終了のTripを選択してください。');
      return null;
    }
    const blockTrips = tripIndex.get(selectedBlockId);
    if (!blockTrips) {
      toast.error('選択したBlockに対応するTripが見つかりません。');
      return null;
    }
    const startSeq = blockTrips.get(startTripId);
    const endSeq = blockTrips.get(endTripId);
    if (startSeq === undefined || endSeq === undefined) {
      toast.error('選択したTripがBlockに含まれていません。');
      return null;
    }
    if (startSeq > endSeq) {
      toast.error('開始Tripは終了Tripより前を選択してください。');
      return null;
    }
    return { blockId: selectedBlockId, start: startTripId, end: endTripId };
  };

  const handleAdd = () => {
    const selection = ensureSelection();
    if (!selection) return;
    try {
      dutyActions.addSegment(
        {
          blockId: selection.blockId,
          startTripId: selection.start,
          endTripId: selection.end,
          dutyId: selectedDutyId ?? undefined,
          driverId: defaultDriverId || undefined,
        },
        tripIndex,
      );
      toast.success('セグメントを追加しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '追加に失敗しました。');
    }
  };

  const handleMove = () => {
    if (!selectedSegment) {
      toast.error('移動するセグメントを選択してください。');
      return;
    }
    const selection = ensureSelection();
    if (!selection) return;
    try {
      dutyActions.moveSegment(
        {
          dutyId: selectedSegment.dutyId,
          segmentId: selectedSegment.segmentId,
          blockId: selection.blockId,
          startTripId: selection.start,
          endTripId: selection.end,
        },
        tripIndex,
      );
      toast.success('セグメントを移動しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移動に失敗しました。');
    }
  };

  const handleDelete = () => {
    if (!selectedSegment) {
      toast.error('削除するセグメントを選択してください。');
      return;
    }
    try {
      dutyActions.deleteSegment({ dutyId: selectedSegment.dutyId, segmentId: selectedSegment.segmentId });
      setSelectedSegment(null);
      toast.success('セグメントを削除しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました。');
    }
  };

  const handleUndo = () => {
    dutyActions.undo();
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

