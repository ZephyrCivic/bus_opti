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
  subscribeWorkflowTelemetry,
} from '../src/services/workflow/workflowTelemetry';

test('workflow telemetry is disabled in Step1', () => {
  clearWorkflowTelemetry();

  const summary = { hardWarnings: 1, softWarnings: 2, unassigned: 3 } as const;
  ensureWorkflowSession(summary);
  markWorkflowWarningsViewed(summary);
  completeWorkflowSave(summary, { exportType: 'unit-test' });

  const sessions = getWorkflowSessions();
  assert.equal(sessions.length, 0);

  const stats = getWorkflowStats();
  assert.deepEqual(stats, {
    total: 0,
    medianLinkToWarningsMs: null,
    medianWarningsToSaveMs: null,
    medianLinkToSaveMs: null,
    recent: [],
  });

  const csv = exportWorkflowSessionsCsv();
  assert.equal(csv.trimEnd(), 'session_id,started_at,warnings_at,saved_at,link_to_warnings_ms,warnings_to_save_ms,link_to_save_ms,hard_warnings,soft_warnings,unassigned,coverage_percentage,fairness_score,export_type,export_file_name');
});

test('subscribeWorkflowTelemetry returns a disposable no-op', () => {
  let called = 0;
  const unsubscribe = subscribeWorkflowTelemetry(() => {
    called += 1;
  });
  unsubscribe();
  assert.equal(called, 0);
});
