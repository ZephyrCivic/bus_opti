/**
 * tests/diff.export.rollout.test.ts
 * 目的: Diff / Export ロールアウト計画ドキュメントの重要項目が記載されていることを検証する。
 * 方針: docs/specs/diff-export-rollout.md を読み込み、フェーズ構成・リスク対策・KPI/チェックリストを確認する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rollout = readFileSync(resolve('docs/specs/diff-export-rollout.md'), 'utf8');

test('ロールアウト計画のタイトルと背景が記載されている', () => {
  assert.match(rollout, /Diff \/ Export ロールアウト計画/);
  assert.match(rollout, /## 背景/);
  assert.match(rollout, /## 前提・準備/);
});

test('フェーズ0〜3が順番に列挙されている', () => {
  assert.match(rollout, /フェーズ0: 開発チーム内 QA/);
  assert.match(rollout, /フェーズ1: 社内パイロット/);
  assert.match(rollout, /フェーズ2: 顧客限定公開/);
  assert.match(rollout, /フェーズ3: 一般提供/);
});

test('リスク対策とサポート体制が含まれている', () => {
  assert.match(rollout, /## リスクと対策/);
  assert.match(rollout, /権限設定漏れ/);
  assert.match(rollout, /サポート & コミュニケーション/);
});

test('KPI と監査チェックリストが定義されている', () => {
  assert.match(rollout, /Export 成功率/);
  assert.match(rollout, /チェックリスト/);
  assert.match(rollout, /config\.py/);
});
