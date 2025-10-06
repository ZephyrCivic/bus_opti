/**
 * tests/readme.product.test.ts
 * README にプロダクト概要とMVP仕様の見出しが存在することを確認する最小テスト。
 * 目的: 仕様ドキュメントの基本的な整合性（見出しの有無）を自動チェックする。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'readme.md');

test('README has product overview heading', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.match(text, /##\s*プロダクト概要（MVP）/);
});

test('README has MVP spec heading', () => {
  const text = readFileSync(readmePath, 'utf8');
  assert.match(text, /##\s*MVP仕様（再整理）/);
});

