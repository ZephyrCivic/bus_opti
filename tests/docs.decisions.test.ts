/**
 * tests/docs.decisions.test.ts
 * DECISIONS と README の整合チェック（軽量）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const decisions = readFileSync(resolve('docs/DECISIONS_2025-10-06.md'), 'utf8');
const readme = readFileSync(resolve('readme.md'), 'utf8');

test('DECISIONS includes 70~80% and MapLibre and gunmachuo', () => {
  // 許容: ~ / 〜 / ～ / ?
  assert.match(decisions, /(70[?~〜～]?80%|70\?80%)/);
  assert.match(decisions, /MapLibre/);
  assert.match(decisions, /GTFS-JP\(gunmachuo\)\.zip/);
});

test('DECISIONS includes CSV schema fields', () => {
  assert.match(decisions, /block_id, seq, trip_id/);
  assert.match(decisions, /duty_id, seq, block_id/);
  assert.match(decisions, /driver_id/);
});

test('DECISIONS documents block replacement policy', () => {
  assert.match(decisions, /直列差し替え/);
  assert.match(decisions, /迂回差し替え/);
  assert.match(decisions, /DEFAULT_MAX_TURN_GAP_MINUTES/);
});

test('DECISIONS documents duty generation reassessment', () => {
  assert.match(decisions, /Duty生成タイミング再評価/);
  assert.match(decisions, /段階的再生成/);
  assert.match(decisions, /初期テンプレート生成/);
});

test('DECISIONS documents global KPI policy', () => {
  assert.match(decisions, /全体KPIポリシー/);
  assert.match(decisions, /稼働カバレッジ/);
  assert.match(decisions, /労務健全性/);
  assert.match(decisions, /公平性/);
});

test('DECISIONS documents KPI threshold modal design', () => {
  assert.match(decisions, /KPI閾値設定モーダル/);
  assert.match(decisions, /KPI_THRESHOLDS/);
  assert.match(decisions, /KPI設定/);
});

test('DECISIONS documents driver data quality policy', () => {
  assert.match(decisions, /Driversデータ品質ポリシー/);
  assert.match(decisions, /DRV_###/);
  assert.match(decisions, /ダミー行/);
});

test('README includes 中拘束 and 交代地点制約', () => {
  assert.match(readme, /中拘束/);
  assert.match(readme, /交代地点制約/);
});
