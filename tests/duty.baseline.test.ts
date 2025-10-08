/**
 * tests/duty.baseline.test.ts
 * Verifies conversion of Duty assignments into ScheduleState baseline snapshots.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDutyScheduleState } from '../src/services/dashboard/dutyBaseline';
import type { Duty } from '../src/types';
import type { DutyDashboardResult } from '../src/services/dashboard/dutyDashboard';

const duties: Duty[] = [
  {
    id: 'DUTY_A',
    driverId: 'alice',
    segments: [],
  },
  {
    id: 'DUTY_B',
    driverId: undefined,
    segments: [],
  },
];

const dashboard: DutyDashboardResult = {
  summary: {
    totalShifts: 2,
    totalHours: 10,
    unassignedCount: 1,
    fairnessScore: 90,
    coveragePercentage: 67,
  },
  workloads: [
    { driverId: 'alice', shiftCount: 1, hours: 5 },
  ],
  dailyMetrics: [],
  alertHistory: [],
  alerts: [],
};

test('buildDutyScheduleState maps duties into schedule entries', () => {
  const state = buildDutyScheduleState(duties, dashboard);
  const dayEntries = state.schedule?.Day ?? state.schedule?.['Day'];
  assert.ok(Array.isArray(dayEntries));
  assert.equal(dayEntries?.length, 1);
  assert.deepEqual(dayEntries?.[0], { routeId: 'DUTY_A', driverId: 'alice' });
  assert.equal(state.dashboard.summary.totalShifts, 2);
  assert.equal(state.dashboard.summary.coveragePercentage, 67);
  assert.deepEqual(state.dashboard.unassignedRoutes, ['DUTY_B']);
  assert.deepEqual(state.dashboard.alerts, []);
});
