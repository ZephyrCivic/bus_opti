import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureWorkflowSession,
  markWorkflowWarningsViewed,
  completeWorkflowSave,
  getWorkflowSessions,
  getWorkflowStats,
  exportWorkflowSessionsCsv,
  clearWorkflowTelemetry,
} from '../src/services/workflow/workflowTelemetry';

test('workflow telemetry records session and computes stats', () => {
  clearWorkflowTelemetry();

  const summary = { hardWarnings: 1, softWarnings: 0, unassigned: 0 } as const;
  ensureWorkflowSession(summary);
  markWorkflowWarningsViewed(summary);
  completeWorkflowSave(summary, { exportType: 'unit-test' });

  const sessions = getWorkflowSessions();
  assert.equal(sessions.length, 1);
  const session = sessions[0]!;
  assert.equal(session.summary.hardWarnings, 1);
  assert.equal(session.context.exportType, 'unit-test');
  assert.ok(session.linkToSaveMs >= 0);

  const stats = getWorkflowStats();
  assert.equal(stats.total, 1);
  assert.equal(stats.medianLinkToSaveMs, session.linkToSaveMs);

  const csv = exportWorkflowSessionsCsv();
  assert.ok(csv.includes('session_id'));
  assert.ok(csv.includes('unit-test'));
});

test('clearWorkflowTelemetry removes history', () => {
  clearWorkflowTelemetry();
  const sessions = getWorkflowSessions();
  assert.equal(sessions.length, 0);
});
