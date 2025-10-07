/**
 * tests/readme.devserver.test.ts
 * README にローカル開発サーバーの起動手順が明記されているかを検証する最小テスト。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'readme.md');

test('README mentions dev server command', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.match(text, /npm\s+run\s+dev/);
});

test('README mentions build and preview', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.match(text, /npm\s+run\s+build/);
  assert.match(text, /npm\s+run\s+preview/);
});

