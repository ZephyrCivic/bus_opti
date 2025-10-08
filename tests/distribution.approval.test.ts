/**
 * tests/distribution.approval.test.ts
 * 目的: 配布物優先度と承認フロードキュメントの主要項目が記載されていることを検証する。
 * 方針: docs/specs/distribution-approval.md を読み込み、優先度・承認ステップ・チェックリストを確認する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doc = readFileSync(resolve('docs/specs/distribution-approval.md'), 'utf8');

test('配布物優先度と承認フローのタイトルと背景が含まれる', () => {
  assert.match(doc, /配布物優先度と承認フロー/);
  assert.match(doc, /## 背景/);
  assert.match(doc, /## 対象配布物と優先度/);
});

test('優先度リストに社内運用パックと外部顧客リリースパックが含まれる', () => {
  assert.match(doc, /社内運用パック/);
  assert.match(doc, /外部顧客リリースパック/);
});

test('承認フロー表の主要ロールが記載されている', () => {
  assert.match(doc, /QA リード/);
  assert.match(doc, /Ops マネージャ/);
  assert.match(doc, /コンプライアンス担当/);
});

test('チェックリストとコミュニケーション節が存在する', () => {
  assert.match(doc, /承認前チェックリスト/);
  assert.match(doc, /コミュニケーションと記録/);
  assert.match(doc, /config\.py/);
});
