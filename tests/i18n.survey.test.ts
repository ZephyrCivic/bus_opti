/**
 * tests/i18n.survey.test.ts
 * 目的: i18n 対応調査メモの主要セクションが記載されていることを検証する。
 * 方針: docs/specs/i18n-survey.md を読み込み、背景・対応範囲・ロードマップ・リスクを確認する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const memo = readFileSync(resolve('docs/specs/i18n-survey.md'), 'utf8');

test('i18n 調査メモのタイトルと背景が含まれる', () => {
  assert.match(memo, /i18n 対応調査メモ/);
  assert.match(memo, /## 背景/);
});

test('対応範囲と優先言語が定義されている', () => {
  assert.match(memo, /## 対応範囲と優先言語/);
  assert.match(memo, /日本語/);
  assert.match(memo, /英語/);
});

test('ロードマップ案とリスクが記載されている', () => {
  assert.match(memo, /## 実装ロードマップ案/);
  assert.match(memo, /## リスクと観点/);
});

test('関連資料節でドキュメント参照が記載されている', () => {
  assert.match(memo, /## 関連資料/);
  assert.match(memo, /docs\/specs\/diff-export-rollout\.md/);
});
