/**
 * tests/docs.decisions.test.ts
 * 決定事項ドキュメント（DECISIONS）とREADMEの整合を軽量に確認。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const decisions = readFileSync(resolve('docs/DECISIONS_2025-10-06.md'), 'utf8');
const readme = readFileSync(resolve('readme.md'), 'utf8');

test('DECISIONS includes 70-80% and MapLibre and gunmachuo', () => {
  // 70〜80%（全角チルダ/半角チルダ/旧表記）いずれも許容
  assert.match(decisions, /(70[〜~]?80%|70\?80%)/);
  assert.match(decisions, /MapLibre/);
  assert.match(decisions, /GTFS-JP\(gunmachuo\)\.zip/);
});

test('DECISIONS includes CSV schema fields', () => {
  assert.match(decisions, /block_id, seq, trip_id/);
  assert.match(decisions, /duty_id, seq, block_id/);
  assert.match(decisions, /driver_id/);
});

test('README includes 中拘束 and 交代地点制約', () => {
  assert.match(readme, /中拘束/);
  assert.match(readme, /交代地点制約/);
});
