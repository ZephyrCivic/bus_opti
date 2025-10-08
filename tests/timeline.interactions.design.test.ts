/**
 * tests/timeline.interactions.design.test.ts
 * 目的: Timeline インタラクション拡張メモの主要項目が記載されていることを確認する。
 * 方針: docs/specs/timeline-interactions.md を読み込み、DoD要件、ユースケース、実装ステップを照合する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const memo = readFileSync(resolve('docs/specs/timeline-interactions.md'), 'utf8');

test('設計メモのタイトルと背景・ゴールが含まれる', () => {
  assert.match(memo, /Timeline インタラクション拡張 設計メモ/);
  assert.match(memo, /## 背景とゴール/);
  assert.match(memo, /DoD では以下を満たす/);
});

test('ユースケースとコンポーネント設計が記載されている', () => {
  assert.match(memo, /## ユースケース/);
  assert.match(memo, /Duty セグメントの移動/);
  assert.match(memo, /## コンポーネント設計/);
});

test('実装ステップとリスク節が含まれている', () => {
  assert.match(memo, /## 実装ステップ案/);
  assert.match(memo, /## リスク・課題/);
});
