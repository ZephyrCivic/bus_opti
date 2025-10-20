/**
 * tests/output.confirmation.docs.test.ts
 * 出力時確認仕様が非ブロッキング要件と監査ログ要件を満たすことを文書ベースで確認する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const spec = readFileSync(resolve('docs/specs/output-confirmation.md'), 'utf8');

test('output confirmation spec enforces non-blocking confirmation', () => {
  assert.match(spec, /非ブロッキング|ブロックしない/);
  assert.match(spec, /50ms以内|Escで閉じる|Enterで続行/);
  assert.match(spec, /続行/);
  assert.match(spec, /キャンセル/);
});

test('output confirmation spec records audit requirements', () => {
  assert.match(spec, /監査ログ/);
  assert.match(spec, /出力時刻/);
  assert.match(spec, /実行者ID/);
});
