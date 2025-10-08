/**
 * src/features/dashboard/useScheduleDiff.ts
 * Hook to compute schedule diff using GtfsImportProvider state and last baseline snapshot.
 */
import { useMemo, useState } from 'react';
import { diffSchedules, type ScheduleDiffResult } from '@/services/state/scheduleDiff';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { ScheduleState } from '@/types';
import { computeDutyDashboard } from '@/services/dashboard/dutyDashboard';
import { buildDutyScheduleState } from '@/services/dashboard/dutyBaseline';

export interface UseScheduleDiffResult {
  baseline: ScheduleState | null;
  setBaseline: (state: ScheduleState) => void;
  diff: ScheduleDiffResult | null;
}

export function useScheduleDiff(): UseScheduleDiffResult {
  const { dutyState } = useGtfsImport();
  const [baseline, setBaselineState] = useState<ScheduleState | null>(null);

  const dutySummaries = useMemo(
    () =>
      dutyState.duties.map((duty) => ({
        id: duty.id,
        driverId: duty.driverId,
      })),
    [dutyState.duties],
  );

  const dashboard = useMemo(
    () =>
      computeDutyDashboard(dutySummaries, {
        maxUnassignedPercentage: dutyState.settings.maxUnassignedPercentage,
        maxNightShiftVariance: dutyState.settings.maxNightShiftVariance,
      }),
    [dutySummaries, dutyState.settings.maxNightShiftVariance, dutyState.settings.maxUnassignedPercentage],
  );

  const current: ScheduleState = useMemo(
    () => buildDutyScheduleState(dutyState.duties, dashboard),
    [dutyState.duties, dashboard],
  );

  const diff = useMemo(() => {
    if (!baseline) {
      return null;
    }
    return diffSchedules(current, baseline);
  }, [baseline, current]);

  const setBaseline = (state: ScheduleState) => {
    setBaselineState(state);
  };

  return { baseline, setBaseline, diff };
}

export default useScheduleDiff;
