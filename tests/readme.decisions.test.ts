/**
 * tests/readme.decisions.test.ts
 * README に今回の合意事項（5点）が反映されているかを確認する最小テスト。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readmePath = resolve(process.cwd(), 'readme.md');
const text = readFileSync(readmePath, 'utf8');

test('Block候補の目標が70〜80%で据え置き', () => {
  assert.match(text, /70〜80%/);
});

test('Dutyルールに中拘束と交代地点制約を含む', () => {
  assert.match(text, /中拘束/);
  assert.match(text, /交代地点制約/);
});

test('サンプルフィードがgunmachuoで明記される', () => {
  assert.match(text, /GTFS-JP\(gunmachuo\)\.zip/);
});

test('MapLibre をデフォルトと明記', () => {
  assert.match(text, /MapLibre/);
});

