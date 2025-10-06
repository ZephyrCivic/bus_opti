import type { DayOfWeek, DashboardData, Schedule, ScheduleState } from '../../../src/types';

export interface ScheduleDiffResult {
  added: Array<{ day: DayOfWeek; routeId: string; driverId: string }>;
  removed: Array<{ day: DayOfWeek; routeId: string; driverId: string }>;
  reassigned: Array<{ day: DayOfWeek; routeId: string; fromDriverId: string; toDriverId: string }>;
  unchangedCount: number;
  metricsDelta: {
    totalShifts: number;
    totalHours: number;
    unassigned: number;
    fairnessScore: number;
  };
}

type FlatAssign = { key: string; day: DayOfWeek; routeId: string; driverId: string };

function flatten(schedule: Schedule | null | undefined): FlatAssign[] {
  if (!schedule) return [];
  const out: FlatAssign[] = [];
  for (const [day, list] of Object.entries(schedule)) {
    for (const item of list ?? []) {
      const key = `${day}|${item.routeId}`;
      out.push({ key, day: day as DayOfWeek, routeId: item.routeId, driverId: item.driverId });
    }
  }
  return out;
}

function indexByKey(items: FlatAssign[]): Map<string, FlatAssign> {
  const m = new Map<string, FlatAssign>();
  for (const it of items) m.set(it.key, it);
  return m;
}

function summaryDelta(current: DashboardData, baseline: DashboardData) {
  return {
    totalShifts: (current.summary?.totalShifts ?? 0) - (baseline.summary?.totalShifts ?? 0),
    totalHours: (current.summary?.totalHours ?? 0) - (baseline.summary?.totalHours ?? 0),
    unassigned: (current.summary?.unassignedCount ?? 0) - (baseline.summary?.unassignedCount ?? 0),
    fairnessScore: (current.summary?.fairnessScore ?? 0) - (baseline.summary?.fairnessScore ?? 0),
  };
}

export function diffSchedules(current: ScheduleState, baseline: ScheduleState): ScheduleDiffResult {
  const cur = flatten(current?.schedule);
  const base = flatten(baseline?.schedule);
  const curIdx = indexByKey(cur);
  const baseIdx = indexByKey(base);

  const added: ScheduleDiffResult['added'] = [];
  const removed: ScheduleDiffResult['removed'] = [];
  const reassigned: ScheduleDiffResult['reassigned'] = [];
  let unchangedCount = 0;

  const keys = new Set<string>([...curIdx.keys(), ...baseIdx.keys()]);
  for (const key of keys) {
    const a = baseIdx.get(key);
    const b = curIdx.get(key);
    if (a && !b) {
      removed.push({ day: a.day, routeId: a.routeId, driverId: a.driverId });
    } else if (!a && b) {
      added.push({ day: b.day, routeId: b.routeId, driverId: b.driverId });
    } else if (a && b) {
      if (a.driverId !== b.driverId) {
        reassigned.push({ day: a.day, routeId: a.routeId, fromDriverId: a.driverId, toDriverId: b.driverId });
      } else {
        unchangedCount += 1;
      }
    }
  }

  return {
    added,
    removed,
    reassigned,
    unchangedCount,
    metricsDelta: summaryDelta(current.dashboard, baseline.dashboard),
  };
}

export default diffSchedules;

