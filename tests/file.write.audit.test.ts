/**
 * tests/file.write.audit.test.ts
 * 目的: ファイル書き込み権限と監査整備ドキュメントの主要項目が記載されていることを検証する。
 * 方針: docs/specs/file-write-audit.md を読み込み、権限モデル・ディレクトリ制御・監査フロー・リスクを確認する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const memo = readFileSync(resolve('docs/specs/file-write-audit.md'), 'utf8');

test('ドキュメントタイトルと背景が含まれている', () => {
  assert.match(memo, /ファイル書き込み権限と監査整備/);
  assert.match(memo, /## 背景/);
});

test('権限モデルのロールが列挙されている', () => {
  assert.match(memo, /roles\.downloadExport/);
  assert.match(memo, /roles\.writeAudit/);
  assert.match(memo, /roles\.releasePublisher/);
});

test('書き込み先ディレクトリの表が記載されている', () => {
  assert.match(memo, /## 書き込み先ディレクトリと制御/);
  assert.match(memo, /docs\/diff-baselines/);
  assert.match(memo, /docs\/releases/);
});

test('監査フローとリスク対策節が存在する', () => {
  assert.match(memo, /## 監査フロー/);
  assert.match(memo, /## リスクと対策/);
  assert.match(memo, /CI で/);
});
