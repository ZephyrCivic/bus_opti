/**
 * tests/dashboard.kpi-ux.design.test.ts
 * 目的: KPI × UX パネル拡張仕様メモの主要項目が記載されていることを検証する。
 * 方針: docs/specs/kpi-ux-panel.md を読み込み、背景・UI構成・実装ステップ・リスクを照合する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const memo = readFileSync(resolve('docs/specs/kpi-ux-panel.md'), 'utf8');

test('仕様メモにタイトルと背景が含まれている', () => {
  assert.match(memo, /KPI × UX パネル拡張 仕様メモ/);
  assert.match(memo, /## 背景/);
  assert.match(memo, /## ゴール/);
});

test('UI構成とデータソース節が存在する', () => {
  assert.match(memo, /## UI構成案/);
  assert.match(memo, /グラフセクション/);
  assert.match(memo, /## データソースと整合/);
});

test('実装ステップとテスト戦略が記載されている', () => {
  assert.match(memo, /## 実装ステップ案/);
  assert.match(memo, /## テスト戦略/);
});

test('リスクとロードマップ節が含まれている', () => {
  assert.match(memo, /## リスクと対策/);
  assert.match(memo, /## ロードマップ/);
});
