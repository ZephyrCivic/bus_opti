/**
 * tests/diff.export.scope.test.ts
 * 目的: Diff / Export スコープ確定メモが存在し、主要決定事項が記録されていることを検証する。
 * 方針: docs/specs/diff-export-scope.md を読み込み、スコープ・非スコープ・DoD キーワードを照合する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const memo = readFileSync(resolve('docs/specs/diff-export-scope.md'), 'utf8');

test('Diff / Export スコープ確定メモの決定事項が記載されている', () => {
  assert.match(memo, /Diff \/ Export スコープ確定メモ/);
  assert.match(memo, /JSON エクスポート/);
  assert.match(memo, /スクリーンショット共有/);
  assert.match(memo, /権限管理/);
});

test('非スコープ項目が明記されている', () => {
  assert.match(memo, /非スコープ/);
  assert.match(memo, /リアルタイム共同編集/);
  assert.match(memo, /自動アップロード/);
});

test('DoD 整合ポイントが列挙されている', () => {
  assert.match(memo, /DoD 整合/);
  assert.match(memo, /CSV 以外（JSON）の出力フロー/);
  assert.match(memo, /履歴管理 UI/);
  assert.match(memo, /権限チェック/);
});
