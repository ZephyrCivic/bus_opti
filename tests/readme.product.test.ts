/**
 * tests/readme.product.test.ts
 * README の要点（目的とクイックスタート）が明記されているかを検証。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'readme.md');

test('README has project purpose heading (日本語)', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.ok(text.includes('## プロジェクトの目的'));
});

test('README has quick start heading', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.ok(text.includes('## クイックスタート'));
});

