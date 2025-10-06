/**
 * tests/scheduleDiff.test.ts
 * scheduleDiff の差分算出ロジックが期待通り動作することを検証する。
 * Undo/Redo とは独立した純粋関数を守ることで回帰を防ぐ意図。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSchedules } from '../src/services/state/scheduleDiff';
import type { Schedule, DashboardData } from '../src/types';

const emptyDashboard: DashboardData = {
  summary: {
    totalShifts: 0,
    totalHours: 0,
    unassignedCount: 0,
    fairnessScore: 0,
  },
  workloadAnalysis: [],
  unassignedRoutes: [],
};

test('diffSchedules detects added and reassigned shifts', () => {
  const baselineSchedule: Schedule = {
    '月': [
      { routeId: 'r1', driverId: 'd1' },
      { routeId: 'r2', driverId: 'd2' },
    ],
  };
  const baselineDashboard: DashboardData = {
    summary: {
      totalShifts: 2,
      totalHours: 16,
      unassignedCount: 0,
      fairnessScore: 80,
    },
    workloadAnalysis: [],
    unassignedRoutes: [],
  };

  const currentSchedule: Schedule = {
    '月': [
      { routeId: 'r1', driverId: 'd3' },
      { routeId: 'r3', driverId: 'd4' },
    ],
  };
  const currentDashboard: DashboardData = {
    summary: {
      totalShifts: 2,
      totalHours: 18,
      unassignedCount: 1,
      fairnessScore: 75,
    },
    workloadAnalysis: [],
    unassignedRoutes: [],
  };

  const result = diffSchedules(
    { schedule: currentSchedule, dashboard: currentDashboard },
    { schedule: baselineSchedule, dashboard: baselineDashboard },
  );

  assert.strictEqual(result.added.length, 1);
  assert.deepStrictEqual(result.added[0], { day: '月', routeId: 'r3', driverId: 'd4' });
  assert.strictEqual(result.removed.length, 1);
  assert.deepStrictEqual(result.removed[0], { day: '月', routeId: 'r2', driverId: 'd2' });
  assert.strictEqual(result.reassigned.length, 1);
  assert.deepStrictEqual(result.reassigned[0], { day: '月', routeId: 'r1', fromDriverId: 'd1', toDriverId: 'd3' });
  assert.strictEqual(result.unchangedCount, 0);
  assert.strictEqual(result.metricsDelta.totalShifts, 0);
  assert.strictEqual(result.metricsDelta.totalHours, 2);
  assert.strictEqual(result.metricsDelta.unassigned, 1);
  assert.strictEqual(result.metricsDelta.fairnessScore, -5);
});

test('diffSchedules handles empty schedules without error', () => {
  const result = diffSchedules(
    { schedule: null, dashboard: emptyDashboard },
    { schedule: null, dashboard: emptyDashboard },
  );

  assert.strictEqual(result.added.length, 0);
  assert.strictEqual(result.removed.length, 0);
  assert.strictEqual(result.reassigned.length, 0);
  assert.strictEqual(result.unchangedCount, 0);
  assert.strictEqual(result.metricsDelta.totalShifts, 0);
  assert.strictEqual(result.metricsDelta.totalHours, 0);
  assert.strictEqual(result.metricsDelta.unassigned, 0);
  assert.strictEqual(result.metricsDelta.fairnessScore, 0);
});
