/**
 * tests/docs.todo.ui.test.ts
 * 目的: ガントUI関連のTODOが追加されていることを軽量に検証する。
 * 方針: docs/TODO.md にキーワードと対象ファイルの記載があるかを確認。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const todo = readFileSync(resolve('docs/TODO.md'), 'utf8');

test('P0 にガントタイムライン最小UIが記載されている', () => {
  assert.match(todo, /ガントタイムライン最小UI/);
  assert.match(todo, /SVGベース/);
  assert.match(todo, /BlocksView/);
  assert.match(todo, /DutiesView/);
});

test('P1 にガントUIの操作強化が記載されている', () => {
  assert.match(todo, /ガントUIの操作強化/);
  assert.match(todo, /D&D|ドラッグ/);
  assert.match(todo, /ズーム|パン/);
});

