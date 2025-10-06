/**
 * tests/encodingScanCli.test.ts
 * 文字化け検出CLIのコアロジック（scanPaths）が想定どおり動作するか検証する。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { scanPaths } from '../tools/encodingScanCli';

test('scanPaths flags invalid UTF-8 sequence', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'encoding-scan-'));
  try {
    const badFile = path.join(tempDir, 'bad.txt');
    writeFileSync(badFile, Buffer.from([0xff, 0xfe, 0x41]));

    const results = await scanPaths([badFile]);
    assert.equal(results.length, 1);
    assert.equal(results[0].issues[0].type, 'INVALID_UTF8');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanPaths detects replacement characters', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'encoding-scan-'));
  try {
    const suspect = path.join(tempDir, 'suspect.md');
    const replacementChar = String.fromCharCode(0xfffd);
    writeFileSync(suspect, `テキストに${replacementChar}が混在しています。`, 'utf8');

    const results = await scanPaths([suspect]);
    assert.equal(results.length, 1);
    assert.equal(results[0].issues.some((issue) => issue.type === 'REPLACEMENT_CHAR'), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanPaths ignores clean UTF-8 file', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'encoding-scan-'));
  try {
    const ok = path.join(tempDir, 'ok.txt');
    writeFileSync(ok, '正常なテキストです。', 'utf8');

    const results = await scanPaths([ok]);
    assert.equal(results.length, 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
