/**
 * src/services/dashboard/dutyDashboard.ts
 * Computes dashboard summary metrics from Duty timeline data.
 */
import type { DutySettings, WorkloadItem } from '@/types';
import { DEFAULT_DUTY_SETTINGS } from '@/services/duty/constants';

export interface DutyTimelineSummary {
  id: string;
  driverId?: string;
  startMinutes?: number;
  endMinutes?: number;
}

export interface DutyDashboardAlert {
  id: 'coverage-low' | 'unassigned-exceeds' | 'fairness-imbalance';
  severity: 'warning' | 'critical';
  message: string;
}

export interface DutyDashboardDailyMetric {
  label: string;
  dayIndex: number;
  totalShifts: number;
  totalHours: number;
  unassignedCount: number;
  coveragePercentage: number;
}

export interface DutyDashboardAlertHistoryEntry {
  label: string;
  dayIndex: number;
  alerts: DutyDashboardAlert[];
}

export interface DutyDashboardResult {
  summary: {
    totalShifts: number;
    totalHours: number;
    unassignedCount: number;
    fairnessScore: number;
    coveragePercentage: number;
  };
  workloads: WorkloadItem[];
  dailyMetrics: DutyDashboardDailyMetric[];
  alertHistory: DutyDashboardAlertHistoryEntry[];
  alerts: DutyDashboardAlert[];
}

export function computeDutyDashboard(
  duties: DutyTimelineSummary[],
  settings?: Pick<DutySettings, 'maxUnassignedPercentage' | 'maxNightShiftVariance'>,
): DutyDashboardResult {
  if (duties.length === 0) {
    return {
      summary: {
        totalShifts: 0,
        totalHours: 0,
        unassignedCount: 0,
        fairnessScore: 100,
        coveragePercentage: 100,
      },
      workloads: [],
      dailyMetrics: [],
      alertHistory: [],
      alerts: [],
    };
  }

  const thresholds = settings
    ? {
        maxUnassignedPercentage: settings.maxUnassignedPercentage,
        maxNightShiftVariance: settings.maxNightShiftVariance,
      }
    : {
        maxUnassignedPercentage: DEFAULT_DUTY_SETTINGS.maxUnassignedPercentage,
        maxNightShiftVariance: DEFAULT_DUTY_SETTINGS.maxNightShiftVariance,
      };

  let assignedShifts = 0;
  let totalHours = 0;
  let unassigned = 0;

  const shiftsByDriver = new Map<string, { shifts: number; hours: number }>();
  const dailyStats = new Map<number, { total: number; assigned: number; unassigned: number; hours: number }>();
  const ensureDayStats = (index: number) => {
    const existing = dailyStats.get(index);
    if (existing) {
      return existing;
    }
    const created = { total: 0, assigned: 0, unassigned: 0, hours: 0 };
    dailyStats.set(index, created);
    return created;
  };

  for (const duty of duties) {
    const dayIndex = Number.isFinite(duty.startMinutes) ? Math.max(0, Math.floor((duty.startMinutes ?? 0) / 1440)) : 0;
    const stats = ensureDayStats(dayIndex);
    stats.total += 1;

    const durationMinutes = computeDutyDuration(duty.startMinutes, duty.endMinutes);
    const durationHours = durationMinutes / 60;

    if (!duty.driverId) {
      unassigned += 1;
      stats.unassigned += 1;
      continue;
    }

    assignedShifts += 1;
    totalHours += durationHours;
    stats.assigned += 1;
    stats.hours += durationHours;

    const current = shiftsByDriver.get(duty.driverId) ?? { shifts: 0, hours: 0 };
    current.shifts += 1;
    current.hours += durationHours;
    shiftsByDriver.set(duty.driverId, current);
  }

  const totalDuties = assignedShifts + unassigned;
  const workloads: WorkloadItem[] = Array.from(shiftsByDriver.entries()).map(([driverId, info]) => ({
    driverId,
    shiftCount: info.shifts,
    hours: Number(info.hours.toFixed(2)),
  }));

  const fairnessScore = computeFairness(workloads);
  const coveragePercentage = totalDuties === 0 ? 100 : Math.max(0, Math.round((assignedShifts / totalDuties) * 100));
  const unassignedPercentage = totalDuties === 0 ? 0 : Math.round((unassigned / totalDuties) * 100);

  const alerts: DutyDashboardAlert[] = [];
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

  const dailyMetrics: DutyDashboardDailyMetric[] = Array.from(dailyStats.entries()).map(([dayIndex, stats]) => {
    const coverage = stats.total === 0
      ? 100
      : Math.max(0, Math.round(((stats.total - stats.unassigned) / stats.total) * 100));
    return {
      label: `Day ${dayIndex + 1}`,
      dayIndex,
      totalShifts: stats.assigned,
      totalHours: Number(stats.hours.toFixed(2)),
      unassignedCount: stats.unassigned,
      coveragePercentage: coverage,
    };
  });

  const alertHistory: DutyDashboardAlertHistoryEntry[] = dailyMetrics
    .map((metric) => {
      const historyAlerts: DutyDashboardAlert[] = [];
      if (metric.coveragePercentage < 100 - thresholds.maxUnassignedPercentage) {
        historyAlerts.push({
          id: 'coverage-low',
          severity: 'warning',
          message: `カバレッジが ${metric.coveragePercentage}% です（目標 ${100 - thresholds.maxUnassignedPercentage}% 以上）。`,
        });
      }
      const totalForDay = metric.totalShifts + metric.unassignedCount;
      const unassignedPct = totalForDay === 0 ? 0 : Math.round((metric.unassignedCount / totalForDay) * 100);
      if (unassignedPct > thresholds.maxUnassignedPercentage) {
        historyAlerts.push({
          id: 'unassigned-exceeds',
          severity: 'critical',
          message: `未割当率が ${unassignedPct}% です（許容 ${thresholds.maxUnassignedPercentage}% 以下）。`,
        });
      }
      return { label: metric.label, dayIndex: metric.dayIndex, alerts: historyAlerts };
    })
    .filter((entry) => entry.alerts.length > 0);

  return {
    summary: {
      totalShifts: assignedShifts,
      totalHours: Number(totalHours.toFixed(2)),
      unassignedCount: unassigned,
      fairnessScore,
      coveragePercentage,
    },
    workloads,
    dailyMetrics,
    alertHistory,
    alerts,
  };
}

function computeDutyDuration(startMinutes?: number, endMinutes?: number): number {
  if (typeof startMinutes !== 'number' || typeof endMinutes !== 'number') {
    return 0;
  }
  const duration = endMinutes - startMinutes;
  return duration > 0 ? duration : 0;
}

function computeFairness(workloads: WorkloadItem[]): number {
  if (workloads.length === 0) {
    return 100;
  }
  const counts = workloads.map((w) => w.shiftCount);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  if (max === 0 || max === min) {
    return 100;
  }
  const spread = max - min;
  const ratio = spread / Math.max(1, max);
  return Math.max(0, Math.round(100 - ratio * 100));
}
