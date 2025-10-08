/**
 * tests/docs.todo2.test.ts
 * 目的: docs/TODO_2.md に想定セクションとP0タスクが記載されていることを検証する軽量テスト。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const text = readFileSync(resolve('docs/TODO_2.md'), 'utf8');

test('タイトルとモットーが含まれる', () => {
  assert.match(text, /TODO_2（デプロイ前の仕上げ）/);
  assert.match(text, /Small, clear, safe steps/);
});

test('P0 セクションに主要タスクが列挙されている', () => {
  assert.match(text, /P0（最優先・SLA/);
  assert.match(text, /タイトル表記の統一/);
  assert.match(text, /CI に型検査を追加/);
  assert.match(text, /CI に本番ビルドを追加/);
});

test('検証コマンドが記載されている', () => {
  assert.match(text, /npm test/);
  assert.match(text, /npm run typecheck/);
  assert.match(text, /npx tsx tools\/chromeDevtoolsCli\.ts evaluate/);
});

