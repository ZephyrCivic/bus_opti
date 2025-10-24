/**
 * src/features/duties/hooks/useDutySelectionState.ts
 * DutyView 内の選択状態（Block/Duty/Segment）と派生メトリクスを集中管理する。
 * Manual入力の変更やDuty一覧更新時のフォールバック処理もここで扱う。
 */
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import type { Duty, DutyEditState, DutySegment, ManualInputs } from '@/types';
import type { BlockPlan } from '@/services/blocks/blockBuilder';
import type { BlockTripLookup, DutyWarningSummary } from '@/services/duty/dutyMetrics';
import { computeDutyMetrics, summarizeDutyWarnings } from '@/services/duty/dutyMetrics';
import { isStepOne } from '@/config/appStep';

export interface SegmentSelection {
  dutyId: string;
  segmentId: string;
}

export interface DutySelectionState {
  selectedBlockId: string | null;
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  selectedDutyId: string | null;
  setSelectedDutyId: Dispatch<SetStateAction<string | null>>;
  selectedSegment: SegmentSelection | null;
  setSelectedSegment: Dispatch<SetStateAction<SegmentSelection | null>>;
  startTripId: string | null;
  setStartTripId: Dispatch<SetStateAction<string | null>>;
  endTripId: string | null;
  setEndTripId: Dispatch<SetStateAction<string | null>>;
  defaultDriverId: string;
  setDefaultDriverId: Dispatch<SetStateAction<string>>;
  selectedDuty: Duty | null;
  selectedSegmentDetail: DutySegment | null;
  selectedMetrics: ReturnType<typeof computeDutyMetrics> | undefined;
  dutyWarnings: Map<string, DutyWarningSummary>;
  warningTotals: { hard: number; soft: number };
  filteredTrips: BlockPlan['csvRows'];
  segmentCount: number;
  driverCount: number;
}

interface DutySelectionParams {
  dutyState: DutyEditState;
  plan: BlockPlan;
  tripLookup: BlockTripLookup;
  manual: ManualInputs;
}

export function useDutySelectionState(params: DutySelectionParams): DutySelectionState {
  const { dutyState, plan, tripLookup, manual } = params;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => plan.summaries.at(0)?.blockId ?? null);
  const [selectedDutyId, setSelectedDutyId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<SegmentSelection | null>(null);
  const [startTripId, setStartTripId] = useState<string | null>(null);
  const [endTripId, setEndTripId] = useState<string | null>(null);
  const [defaultDriverId, setDefaultDriverId] = useState('');

  useEffect(() => {
    if (manual.drivers.length === 0) {
      if (defaultDriverId !== '') {
        setDefaultDriverId('');
      }
      return;
    }
    const exists = manual.drivers.some((driver) => driver.driverId === defaultDriverId);
    if (!exists) {
      setDefaultDriverId(manual.drivers[0]?.driverId ?? '');
    }
  }, [manual.drivers, defaultDriverId]);

  useEffect(() => {
    if (dutyState.duties.length === 0) {
      setSelectedDutyId(null);
      setSelectedSegment(null);
      return;
    }
    const current = selectedDutyId
      ? dutyState.duties.find((duty) => duty.id === selectedDutyId)
      : undefined;
    if (!current) {
      const fallback = dutyState.duties[0]!;
      setSelectedDutyId(fallback.id);
      const firstSegment = fallback.segments[0];
      if (firstSegment) {
        setSelectedBlockId(firstSegment.blockId);
        setStartTripId(firstSegment.startTripId);
        setEndTripId(firstSegment.endTripId);
      }
      setSelectedSegment(null);
      return;
    }
    if (selectedSegment) {
      const exists = current.segments.some((segment) => segment.id === selectedSegment.segmentId);
      if (!exists) {
        setSelectedSegment(null);
      }
    }
  }, [dutyState.duties, selectedDutyId, selectedSegment]);

  const dutyMetricsMap = useMemo(() => {
    if (isStepOne) {
      return new Map<
        string,
        {
          metrics: ReturnType<typeof computeDutyMetrics>;
          warnings: DutyWarningSummary;
        }
      >();
    }
    const map = new Map<
      string,
      {
        metrics: ReturnType<typeof computeDutyMetrics>;
        warnings: DutyWarningSummary;
      }
    >();
    for (const duty of dutyState.duties) {
      const metrics = computeDutyMetrics(duty, tripLookup, dutyState.settings);
      map.set(duty.id, {
        metrics,
        warnings: summarizeDutyWarnings(metrics),
      });
    }
    return map;
  }, [dutyState.duties, tripLookup, dutyState.settings]);

  const warningTotals = useMemo(() => {
    if (isStepOne) return { hard: 0, soft: 0 };
    let hard = 0;
    let soft = 0;
    for (const { warnings } of dutyMetricsMap.values()) {
      hard += warnings.hard;
      soft += warnings.soft;
    }
    return { hard, soft };
  }, [dutyMetricsMap]);

  const selectedDuty = useMemo(
    () => (selectedDutyId ? dutyState.duties.find((duty) => duty.id === selectedDutyId) ?? null : null),
    [dutyState.duties, selectedDutyId],
  );

  const selectedMetrics = isStepOne ? undefined : selectedDuty ? dutyMetricsMap.get(selectedDuty.id)?.metrics : undefined;

  const selectedSegmentDetail = useMemo(() => {
    if (!selectedSegment) {
      return null;
    }
    return (
      dutyState.duties
        .find((duty) => duty.id === selectedSegment.dutyId)?.segments
        .find((segment) => segment.id === selectedSegment.segmentId) ?? null
    );
  }, [dutyState.duties, selectedSegment]);

  const filteredTrips = useMemo(() => {
    if (!selectedBlockId) {
      return [] as BlockPlan['csvRows'];
    }
    return plan.csvRows
      .filter((row) => row.blockId === selectedBlockId)
      .sort((a, b) => a.seq - b.seq);
  }, [plan.csvRows, selectedBlockId]);

  const segmentCount = useMemo(
    () => dutyState.duties.reduce((acc, duty) => acc + duty.segments.length, 0),
    [dutyState.duties],
  );

  const driverCount = useMemo(() => {
    const drivers = new Set<string>();
    for (const duty of dutyState.duties) {
      if (duty.driverId) {
        drivers.add(duty.driverId);
      }
    }
    return drivers.size;
  }, [dutyState.duties]);

  useEffect(() => {
    if (!selectedBlockId && plan.summaries.length > 0) {
      const first = plan.summaries[0];
      setSelectedBlockId(first.blockId);
      const trips = plan.csvRows
        .filter((row) => row.blockId === first.blockId)
        .sort((a, b) => a.seq - b.seq);
      setStartTripId(trips[0]?.tripId ?? null);
      setEndTripId(trips[trips.length - 1]?.tripId ?? null);
    }
  }, [plan.csvRows, plan.summaries, selectedBlockId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_BIVIEW_SYNC?: { driver: number; vehicle: number };
    };
    if (!testWindow.__TEST_BIVIEW_SYNC) {
      const now = performance.now();
      testWindow.__TEST_BIVIEW_SYNC = { driver: now, vehicle: now };
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_BIVIEW_SYNC?: { driver: number; vehicle: number };
    };
    const current = testWindow.__TEST_BIVIEW_SYNC ?? { driver: 0, vehicle: 0 };
    testWindow.__TEST_BIVIEW_SYNC = { driver: current.driver, vehicle: performance.now() };
  }, [selectedBlockId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_BIVIEW_SYNC?: { driver: number; vehicle: number };
    };
    const current = testWindow.__TEST_BIVIEW_SYNC ?? { driver: 0, vehicle: 0 };
    testWindow.__TEST_BIVIEW_SYNC = { driver: performance.now(), vehicle: current.vehicle };
  }, [selectedDutyId, selectedSegment]);

  return {
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
    dutyWarnings: isStepOne
      ? new Map()
      : new Map([...dutyMetricsMap.entries()].map(([key, value]) => [key, value.warnings])),
    warningTotals,
    filteredTrips,
    segmentCount,
    driverCount,
  };
}
