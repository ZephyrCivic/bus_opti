/**
 * tests/duty.dashboard.test.ts
 * Ensures duty dashboard summary logic produces the expected metrics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDutyDashboard, type DutyTimelineSummary } from '../src/services/dashboard/dutyDashboard';

test('computeDutyDashboard aggregates totals and unassigned duties', () => {
  const duties: DutyTimelineSummary[] = [
    { id: 'D1', driverId: 'alice', startMinutes: 480, endMinutes: 600 }, // 2h
    { id: 'D2', driverId: 'bob', startMinutes: 540, endMinutes: 720 },   // 3h
    { id: 'D3', startMinutes: 600, endMinutes: 660 }, // unassigned
  ];

  const dashboard = computeDutyDashboard(duties);

  assert.equal(dashboard.summary.totalShifts, 2);
  assert.equal(dashboard.summary.unassignedCount, 1);
  assert.equal(dashboard.summary.totalHours, 5); // 2 + 3
  assert.equal(dashboard.summary.coveragePercentage, 67);
  assert.ok(dashboard.alerts.length >= 1);
  assert.equal(dashboard.workloads.length, 2);
  assert.equal(dashboard.dailyMetrics.length, 1);
  assert.equal(dashboard.dailyMetrics[0]?.unassignedCount, 1);
  const alice = dashboard.workloads.find((w) => w.driverId === 'alice');
  assert.ok(alice);
  assert.equal(alice.hours, 2);
  assert.ok(dashboard.alertHistory.length >= 1);
});

test('computeDutyDashboard fairness decreases with imbalance', () => {
  const balanced: DutyTimelineSummary[] = [
    { id: 'D1', driverId: 'alice', startMinutes: 480, endMinutes: 600 },
    { id: 'D2', driverId: 'bob', startMinutes: 600, endMinutes: 720 },
  ];
  const imbalanced: DutyTimelineSummary[] = [
    { id: 'D1', driverId: 'alice', startMinutes: 480, endMinutes: 600 },
    { id: 'D2', driverId: 'alice', startMinutes: 610, endMinutes: 700 },
    { id: 'D3', driverId: 'bob', startMinutes: 600, endMinutes: 720 },
  ];

  const balancedScore = computeDutyDashboard(balanced).summary.fairnessScore;
  const imbalancedResult = computeDutyDashboard(imbalanced, { maxUnassignedPercentage: 10, maxNightShiftVariance: 5 });
  const imbalancedScore = imbalancedResult.summary.fairnessScore;

  assert.equal(balancedScore, 100);
  assert.ok(imbalancedScore < balancedScore);
  assert.ok(imbalancedResult.alerts.some((alert) => alert.id === 'fairness-imbalance'));
  assert.ok(Array.isArray(imbalancedResult.alertHistory));
});
