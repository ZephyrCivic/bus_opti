/**
 * tests/chromeDevtoolsCli.test.ts
 * Validates Chrome DevTools CLI argument parsing so CLI invocations remain ergonomic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChromeArgs } from '../tools/chromeDevtoolsCli';

test('parseChromeArgs defaults to help with no args', () => {
  const options = parseChromeArgs([]);
  assert.equal(options.command, 'help');
  assert.equal(options.chromePath.endsWith('chrome.exe') || options.chromePath.endsWith('google-chrome'), true);
  assert.equal(options.remotePort, 9222);
});

test('parseChromeArgs evaluate applies overrides', () => {
  const options = parseChromeArgs([
    'evaluate',
    '--chrome-path',
    'C:/Chrome/App/chrome.exe',
    '--remote-port',
    '9229',
    '--url',
    'https://example.com',
    '--expression',
    'document.title',
    '--headed',
    '--keep-browser',
    '--poll-timeout',
    '2000',
    '--poll-interval',
    '50',
  ]);
  assert.equal(options.command, 'evaluate');
  assert.equal(options.chromePath, 'C:/Chrome/App/chrome.exe');
  assert.equal(options.remotePort, 9229);
  assert.equal(options.url, 'https://example.com');
  assert.equal(options.expression, 'document.title');
  assert.equal(options.headless, false);
  assert.equal(options.keepBrowser, true);
  assert.equal(options.pollTimeout, 2000);
  assert.equal(options.pollInterval, 50);
});

test('parseChromeArgs screenshot sets output defaults', () => {
  const options = parseChromeArgs([
    'screenshot',
    '--url',
    'https://example.com',
    '--output',
    'demo.png',
    '--full-page',
  ]);
  assert.equal(options.command, 'screenshot');
  assert.equal(options.url, 'https://example.com');
  assert.equal(options.outputPath, 'demo.png');
  assert.equal(options.fullPage, true);
});
