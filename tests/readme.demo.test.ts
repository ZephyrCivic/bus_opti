/**
 * tests/readme.demo.test.ts
 * README に 60秒デモ手順と留意点が記載されているかを検証する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'readme.md');

test('README has 60秒デモ section', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.match(text, /##\s*60秒デモ/);
});

test('README demo section lists precautions', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.match(text, /留意点/);
  assert.match(text, /Reset/);
});
