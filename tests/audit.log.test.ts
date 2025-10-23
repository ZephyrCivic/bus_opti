/**
 * tests/audit.log.test.ts
 * Verifies audit logger collects export events in non-browser environments.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearAuditEvents,
  getAuditEvents,
  recordAuditEvent,
} from '../src/services/audit/auditLog';

test('recordAuditEvent appends export events', () => {
  clearAuditEvents();

  recordAuditEvent({
    entity: 'duties',
    fileName: 'duties-20251021-041000.csv',
    rowCount: 3,
    generatedAt: '2025-10-21T04:10:00.000Z',
    settingsHash: 'deadbeef',
    warnings: { hard: 1, soft: 2 },
    timestamp: '2025-10-21T04:10:05.000Z',
  });

  const events = getAuditEvents();
  assert.equal(events.length, 1);
  const event = events[0]!;
  assert.equal(event.action, 'export');
  assert.equal(event.entity, 'duties');
  if (event.action === 'export') {
    assert.equal(event.fileName, 'duties-20251021-041000.csv');
    assert.equal(event.warnings?.hard, 1);
    assert.equal(event.warnings?.soft, 2);
  }

  clearAuditEvents();
  assert.equal(getAuditEvents().length, 0);
});
