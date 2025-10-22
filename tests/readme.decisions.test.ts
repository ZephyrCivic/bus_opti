/**
 * tests/readme.decisions.test.ts
 * README に重要な設計上の合意（スコープ）キーワードが載っているかを検証。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const text = readFileSync(resolve('readme.md'), 'utf8');

test('Block の目標達成率は 70~80% を明記', () => {
  assert.match(text, /(70[~]?80%|70\?80%)/);
});

test('Duty ルールに 中拘束 と 交代地点制約 を含む', () => {
  assert.match(text, /中拘束/);
  assert.match(text, /交代地点制約/);
});

test('MapLibre をデフォルトと明記', () => {
  assert.match(text, /MapLibre/);
});
