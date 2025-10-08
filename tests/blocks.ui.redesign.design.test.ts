/**
 * tests/blocks.ui.redesign.design.test.ts
 * 目的: ブロック画面 UI リデザイン設計メモの主要項目が揃っていることを検証する。
 * 方針: docs/specs/block-ui-redesign.md を読み込み、ゴール・UI構成・実装ステップ・リスクを照合する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const memo = readFileSync(resolve('docs/specs/block-ui-redesign.md'), 'utf8');

test('設計メモのタイトルと背景が含まれている', () => {
  assert.match(memo, /ブロック画面 UI リデザイン設計メモ/);
  assert.match(memo, /## 背景/);
  assert.match(memo, /## ゴール/);
});

test('UI構成案とデータ要件節が存在する', () => {
  assert.match(memo, /## UI構成案/);
  assert.match(memo, /サービス日別タイムライン/);
  assert.match(memo, /## データ要件/);
});

test('実装ステップ案とリスク節が記載されている', () => {
  assert.match(memo, /## 実装ステップ案/);
  assert.match(memo, /## リスクと対策/);
});

test('ロードマップ節が含まれている', () => {
  assert.match(memo, /## ロードマップ（目安）/);
});
