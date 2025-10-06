/**
 * tests/readme.product.test.ts
 * READMEがプロジェクト目的とMVP前提の見出しを保持しているかを検証する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'readme.md');

test('README has project purpose heading', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.ok(text.includes('## プロジェクトの目的'));
});

test('README has MVP spec heading', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.ok(text.includes('## MVPの前提（仕様）'));
});
