/**
 * tests/dashboardCalculator.test.ts
 * 手動割当後の KPI 計算が想定どおりに更新されるかを検証する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDashboardMetrics } from '../src/services/state/dashboardCalculator';
import type { Schedule, Driver, DayOfWeek, Route } from '../../src/types';

const drivers: Driver[] = [
  { id: 'd1', name: 'Driver 1', availability: ['月', '火', '水', '木', '金'], preferences: { vacationDays: [] } },
  { id: 'd2', name: 'Driver 2', availability: ['月', '火', '水', '木', '金'], preferences: { vacationDays: [] } },
];

const baseRoutes: Route[] = [
  { id: 'r1', name: 'Route 1', startTime: '08:00', endTime: '12:00', requiredDrivers: 1, day: '月', startLocation: 'A', endLocation: 'B' },
  { id: 'r2', name: 'Route 2', startTime: '13:00', endTime: '17:00', requiredDrivers: 1, day: '月', startLocation: 'A', endLocation: 'B' },
];

const expand = (routes: Route[]): Array<Route & { day: DayOfWeek }> => {
  return routes.map((route) => ({ ...route, id: `${route.id}-${route.day}`, day: route.day as DayOfWeek }));
};

test('calculateDashboardMetrics aggregates hours and unassigned routes', () => {
  const schedule: Schedule = {
    '月': [
      { routeId: 'r1-月', driverId: 'd1' },
    ],
  };

  const dashboard = calculateDashboardMetrics(schedule, expand(baseRoutes), drivers);

  assert.equal(dashboard.summary.totalShifts, 1);
  assert.equal(dashboard.summary.unassignedCount, 1);
  assert.equal(dashboard.workloadAnalysis.find((w) => w.driverId === 'd1')?.shiftCount, 1);
  assert.equal(dashboard.workloadAnalysis.find((w) => w.driverId === 'd2')?.shiftCount, 0);
  const totalHours = dashboard.summary.totalHours;
  assert.ok(totalHours > 0);
  assert.equal(dashboard.summary.coveragePercentage, 50);
  assert.ok(dashboard.alerts.some((alert) => alert.id === 'coverage-low'));
  assert.ok(dashboard.alerts.some((alert) => alert.id === 'unassigned-exceeds'));
  assert.equal(dashboard.driverWorkloads.length, dashboard.workloadAnalysis.length);
  assert.ok(dashboard.dailyMetrics.length > 0);
  const monday = dashboard.dailyMetrics.find((metric) => metric.label === '月');
  assert.ok(monday);
  assert.equal(monday.unassignedCount, 1);
});

test('calculateDashboardMetrics returns fairness 100 when workloads equal', () => {
  const schedule: Schedule = {
    '月': [
      { routeId: 'r1-月', driverId: 'd1' },
      { routeId: 'r2-月', driverId: 'd2' },
    ],
  };

  const dashboard = calculateDashboardMetrics(schedule, expand(baseRoutes), drivers);

  assert.equal(dashboard.summary.unassignedCount, 0);
  assert.equal(dashboard.summary.totalShifts, 2);
  assert.equal(dashboard.summary.fairnessScore, 100);
  assert.equal(dashboard.summary.coveragePercentage, 100);
  assert.deepEqual(dashboard.alerts, []);
  assert.equal(dashboard.dailyMetrics.length, 1);
  assert.equal(dashboard.dailyMetrics[0]?.coveragePercentage, 100);
});

test('calculateDashboardMetrics flags fairness imbalance when thresholds exceeded', () => {
  const schedule: Schedule = {
    '月': [
      { routeId: 'r1-月', driverId: 'd1' },
      { routeId: 'r2-月', driverId: 'd1' },
    ],
  };

  const dashboard = calculateDashboardMetrics(schedule, expand(baseRoutes), drivers, {
    maxUnassignedPercentage: 10,
    maxNightShiftVariance: 5,
  });

  assert.equal(dashboard.summary.fairnessScore, 0);
  assert.ok(dashboard.alerts.some((alert) => alert.id === 'fairness-imbalance'));
  assert.ok(Array.isArray(dashboard.alertHistory));
});
