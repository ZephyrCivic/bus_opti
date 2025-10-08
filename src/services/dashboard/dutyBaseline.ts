/**
 * src/services/dashboard/dutyBaseline.ts
 * Utilities to convert Duty assignments into ScheduleState baseline snapshots.
 */
import type { Duty, Schedule, ScheduleState } from '@/types';
import type { DutyDashboardResult } from './dutyDashboard';

const DEFAULT_DAY: string = 'Day';

export function buildDutyScheduleState(duties: Duty[], dashboard: DutyDashboardResult): ScheduleState {
  const schedule: Schedule = { [DEFAULT_DAY]: [] };

  for (const duty of duties) {
    if (!duty.driverId) {
      continue;
    }
    schedule[DEFAULT_DAY]!.push({
      routeId: duty.id,
      driverId: duty.driverId,
    });
  }

  return {
    schedule,
    dashboard: {
      summary: {
        totalShifts: dashboard.summary.totalShifts,
        totalHours: dashboard.summary.totalHours,
        unassignedCount: dashboard.summary.unassignedCount,
        fairnessScore: dashboard.summary.fairnessScore,
        coveragePercentage: dashboard.summary.coveragePercentage,
      },
      workloadAnalysis: dashboard.workloads,
      driverWorkloads: dashboard.workloads,
      unassignedRoutes: duties.filter((duty) => !duty.driverId).map((duty) => duty.id),
      alerts: dashboard.alerts,
      dailyMetrics: dashboard.dailyMetrics,
      alertHistory: dashboard.alertHistory,
    },
  };
}

export function downloadBaseline(state: ScheduleState, fileName = 'duty-baseline.json'): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
