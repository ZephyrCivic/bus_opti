import type { DashboardData, DayOfWeek, Driver, Route, Schedule, WorkloadItem } from '../../../src/types';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => Number.parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function routeHours(route?: Route): number {
  if (!route) return 0;
  const minutes = Math.max(0, toMinutes(route.endTime) - toMinutes(route.startTime));
  return minutes / 60;
}

function computeFairness(workloads: WorkloadItem[]): number {
  if (workloads.length === 0) return 100;
  const counts = workloads.map((w) => w.shiftCount);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  if (max === 0) return 100;
  if (max === min) return 100;
  // Simple spread-based fairness: 100 when equal, approaches 0 as spread grows.
  const spread = max - min;
  const ratio = spread / Math.max(1, max);
  return Math.max(0, Math.round(100 - ratio * 100));
}

export function calculateDashboardMetrics(
  schedule: Schedule | null,
  routes: Array<Route & { day: DayOfWeek }>,
  drivers: Driver[],
): DashboardData {
  const routeById = new Map<string, Route & { day: DayOfWeek }>();
  for (const r of routes) routeById.set(r.id, r);

  const assignments: Array<{ day: DayOfWeek; routeId: string; driverId: string }> = [];
  if (schedule) {
    for (const [day, items] of Object.entries(schedule)) {
      for (const a of items ?? []) {
        assignments.push({ day: day as DayOfWeek, routeId: a.routeId, driverId: a.driverId });
      }
    }
  }

  const totalShifts = assignments.length;
  const assignedCountByRoute = new Map<string, number>();
  let totalHours = 0;
  for (const a of assignments) {
    const r = routeById.get(a.routeId);
    totalHours += routeHours(r);
    assignedCountByRoute.set(a.routeId, (assignedCountByRoute.get(a.routeId) ?? 0) + 1);
  }

  const unassignedRoutes: string[] = [];
  for (const r of routes) {
    const need = Math.max(1, r.requiredDrivers ?? 1);
    const have = assignedCountByRoute.get(r.id) ?? 0;
    for (let i = 0; i < Math.max(0, need - have); i += 1) {
      unassignedRoutes.push(r.id);
    }
  }

  const shiftCountByDriver = new Map<string, number>();
  const hoursByDriver = new Map<string, number>();
  for (const a of assignments) {
    const r = routeById.get(a.routeId);
    const hours = routeHours(r);
    shiftCountByDriver.set(a.driverId, (shiftCountByDriver.get(a.driverId) ?? 0) + 1);
    hoursByDriver.set(a.driverId, (hoursByDriver.get(a.driverId) ?? 0) + hours);
  }

  const workloadAnalysis: WorkloadItem[] = drivers.map((d) => ({
    driverId: d.id,
    shiftCount: shiftCountByDriver.get(d.id) ?? 0,
    hours: Number((hoursByDriver.get(d.id) ?? 0).toFixed(2)),
  }));

  const fairnessScore = computeFairness(workloadAnalysis);

  return {
    summary: {
      totalShifts,
      totalHours: Number(totalHours.toFixed(2)),
      unassignedCount: unassignedRoutes.length,
      fairnessScore,
    },
    workloadAnalysis,
    unassignedRoutes,
  };
}

export default calculateDashboardMetrics;

