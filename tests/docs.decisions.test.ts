/**
 * tests/docs.decisions.test.ts
 * 決定事項ドキュメントと実装補遺の存在・主要キーワードを検証する最小テスト。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const decisions = readFileSync(resolve('docs/DECISIONS_2025-10-06.md'), 'utf8');
const addendum = readFileSync(resolve('docs/ImplementationChecklist.addendum_2025-10-06.md'), 'utf8');

test('DECISIONS includes 70〜80% and MapLibre and gunmachuo', () => {
  assert.match(decisions, /70〜80%/);
  assert.match(decisions, /MapLibre/);
  assert.match(decisions, /GTFS-JP\(gunmachuo\)\.zip/);
});

test('DECISIONS includes CSV schema fields', () => {
  assert.match(decisions, /block_id, seq, trip_id/);
  assert.match(decisions, /duty_id, seq, block_id/);
  assert.match(decisions, /driver_id/);
});

test('Implementation addendum includes 中拘束 and 交代地点制約', () => {
  assert.match(addendum, /中拘束/);
  assert.match(addendum, /交代地点制約/);
});

