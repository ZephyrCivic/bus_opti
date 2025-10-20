/**
 * tests/settings.ui.draft-apply.test.ts
 * 設定UI仕様の要件と、Undo/Redo によるロールバック最小ケースを担保する軽量テスト。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createDutyEditState, replaceDutyState, undoLastAction } from '@/services/duty/dutyState';

const spec = readFileSync(resolve('docs/specs/settings-ui.md'), 'utf8');

test('settings UI spec documents draft/apply/rollback requirements', () => {
  assert.match(spec, /設定UI仕様/);
  assert.match(spec, /ドラフト/);
  assert.match(spec, /適用/);
  assert.match(spec, /ロールバック/);
  assert.match(spec, /由来バッジ/);
  assert.match(spec, /労務ルール/);
});

test('replaceDutyState + undoLastAction enables rollback of applied duties', () => {
  const base = createDutyEditState();
  const applied = replaceDutyState(base, [{ id: 'DUTY_001', segments: [] }]);

  assert.equal(applied.duties.length, 1);
  assert.equal(applied.undoStack.length > 0, true);

  const rolledBack = undoLastAction(applied);
  assert.equal(rolledBack.duties.length, 0);
  assert.equal(rolledBack.redoStack.length > 0, true);
});
