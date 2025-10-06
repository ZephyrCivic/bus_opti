/**
 * tests/playwrightCli.test.ts
 * Ensures Playwright CLI argument parsing stays predictable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaywrightArgs } from '../tools/playwrightCli';

test('parsePlaywrightArgs uses defaults when called without args', () => {
  const options = parsePlaywrightArgs([]);
  assert.equal(options.command, 'help');
  assert.equal(options.browser, 'chromium');
  assert.equal(options.timeout, 30000);
});

test('parsePlaywrightArgs screenshot populates url and output', () => {
  const options = parsePlaywrightArgs(['screenshot', '--url', 'https://example.com', '--output', 'shot.png']);
  assert.equal(options.command, 'screenshot');
  assert.equal(options.url, 'https://example.com');
  assert.equal(options.outputPath, 'shot.png');
  assert.equal(options.fullPage, false);
});

test('parsePlaywrightArgs evaluate requires script', () => {
  assert.throws(
    () => parsePlaywrightArgs(['evaluate', '--url', 'https://example.com']),
    /requires --script/,
  );
});
