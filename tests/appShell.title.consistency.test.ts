/**
 * tests/appShell.title.consistency.test.ts
 * アプリ名の表記ゆれを防止するため、index.html と CLI スモークテストを突き合わせる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { APP_NAME } from '../src/components/layout/AppShell';
import { EXPECTED_TITLE } from '../tools/chromeSmoke';

const indexHtml = readFileSync(resolve('index.html'), 'utf8');

test('index.html の title が APP_NAME と一致する', () => {
  const match = indexHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(match, 'index.html に title 要素が存在する');
  assert.equal(match[1], APP_NAME);
});

test('Chrome スモーク期待値と APP_NAME が一致する', () => {
  assert.equal(EXPECTED_TITLE, APP_NAME);
});
