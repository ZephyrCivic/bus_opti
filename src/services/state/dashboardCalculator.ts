import type {
  DashboardAlert,
  DashboardAlertHistoryEntry,
  DashboardData,
  DashboardDailyMetric,
  DayOfWeek,
  Driver,
  Route,
  Schedule,
  WorkloadItem,
  DutySettings,
} from '../../../src/types';
import { DEFAULT_DUTY_SETTINGS } from '@/services/duty/constants';

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
  settings?: Pick<DutySettings, 'maxUnassignedPercentage' | 'maxNightShiftVariance'>,
): DashboardData {
  const thresholds = settings
    ? { maxUnassignedPercentage: settings.maxUnassignedPercentage, maxNightShiftVariance: settings.maxNightShiftVariance }
    : {
        maxUnassignedPercentage: DEFAULT_DUTY_SETTINGS.maxUnassignedPercentage,
        maxNightShiftVariance: DEFAULT_DUTY_SETTINGS.maxNightShiftVariance,
      };

  const routeById = new Map<string, Route & { day: DayOfWeek }>();
  for (const r of routes) routeById.set(r.id, r);

  const dayStats = new Map<DayOfWeek, { totalPositions: number; assigned: number; unassigned: number; hours: number }>();
  const ensureDayStats = (day: DayOfWeek) => {
    const existing = dayStats.get(day);
    if (existing) {
      return existing;
    }
    const created = { totalPositions: 0, assigned: 0, unassigned: 0, hours: 0 };
    dayStats.set(day, created);
    return created;
  };

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
    if (!r) {
      continue;
    }
    totalHours += routeHours(r);
    assignedCountByRoute.set(a.routeId, (assignedCountByRoute.get(a.routeId) ?? 0) + 1);
    const stats = ensureDayStats(r.day);
    stats.assigned += 1;
    stats.hours += routeHours(r);
  }

  const unassignedRoutes: string[] = [];
  let totalRequiredDrivers = 0;
  for (const r of routes) {
    const need = Math.max(1, r.requiredDrivers ?? 1);
    totalRequiredDrivers += need;
    const have = assignedCountByRoute.get(r.id) ?? 0;
    for (let i = 0; i < Math.max(0, need - have); i += 1) {
      unassignedRoutes.push(r.id);
    }
    const stats = ensureDayStats(r.day);
    stats.totalPositions += need;
    const missing = Math.max(0, need - have);
    stats.unassigned += missing;
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
  const coveragePercentage = totalRequiredDrivers === 0
    ? 100
    : Math.max(0, Math.round((1 - (unassignedRoutes.length / totalRequiredDrivers)) * 100));
  const unassignedPercentage = totalRequiredDrivers === 0
    ? 0
    : Math.round((unassignedRoutes.length / totalRequiredDrivers) * 100);

  const alerts: DashboardAlert[] = [];
  if (coveragePercentage < 100 - thresholds.maxUnassignedPercentage) {
    alerts.push({
      id: 'coverage-low',
      severity: 'warning',
      message: `カバレッジが ${coveragePercentage}% です（目標 ${100 - thresholds.maxUnassignedPercentage}% 以上）。`,
    });
  }
  if (unassignedPercentage > thresholds.maxUnassignedPercentage) {
    alerts.push({
      id: 'unassigned-exceeds',
      severity: 'critical',
      message: `未割当率が ${unassignedPercentage}% です（許容 ${thresholds.maxUnassignedPercentage}% 以下）。`,
    });
  }
  const fairnessFloor = Math.max(0, 100 - thresholds.maxNightShiftVariance);
  if (fairnessScore < fairnessFloor) {
    alerts.push({
      id: 'fairness-imbalance',
      severity: 'warning',
      message: `公平性スコアが ${fairnessScore}（許容 ${fairnessFloor} 以上）です。割当のバランスを見直してください。`,
    });
  }

  const dailyMetrics: DashboardDailyMetric[] = Array.from(dayStats.entries()).map(([day, stats]) => {
    const coverage = stats.totalPositions === 0
      ? 100
      : Math.max(0, Math.round(((stats.totalPositions - stats.unassigned) / stats.totalPositions) * 100));
    return {
      label: day,
      totalShifts: stats.assigned,
      totalHours: Number(stats.hours.toFixed(2)),
      unassignedCount: stats.unassigned,
      coveragePercentage: coverage,
    };
  });

  const alertHistory: DashboardAlertHistoryEntry[] = dailyMetrics
    .map((metric) => {
      const historyAlerts: DashboardAlert[] = [];
      if (metric.coveragePercentage < 100 - thresholds.maxUnassignedPercentage) {
        historyAlerts.push({
          id: 'coverage-low',
          severity: 'warning',
          message: `カバレッジが ${metric.coveragePercentage}% です（目標 ${100 - thresholds.maxUnassignedPercentage}% 以上）。`,
        });
      }
      const unassignedPercentageForDay = metric.totalShifts + metric.unassignedCount === 0
        ? 0
        : Math.round((metric.unassignedCount / (metric.totalShifts + metric.unassignedCount)) * 100);
      if (unassignedPercentageForDay > thresholds.maxUnassignedPercentage) {
        historyAlerts.push({
          id: 'unassigned-exceeds',
          severity: 'critical',
          message: `未割当率が ${unassignedPercentageForDay}% です（許容 ${thresholds.maxUnassignedPercentage}% 以下）。`,
        });
      }
      return { label: metric.label, alerts: historyAlerts };
    })
    .filter((entry) => entry.alerts.length > 0);

  return {
    summary: {
      totalShifts,
      totalHours: Number(totalHours.toFixed(2)),
      unassignedCount: unassignedRoutes.length,
      fairnessScore,
      coveragePercentage,
    },
    workloadAnalysis,
    driverWorkloads: workloadAnalysis,
    unassignedRoutes,
    alerts,
    dailyMetrics,
    alertHistory,
  };
}

export default calculateDashboardMetrics;
