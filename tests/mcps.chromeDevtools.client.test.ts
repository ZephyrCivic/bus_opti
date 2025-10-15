/**
 * tests/mcps.chromeDevtools.client.test.ts
 * Validates ChromeDevtoolsClient default argument resolution.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ChromeDevtoolsClient } from '../tools/mcps/chrome-devtools/client';

test('ChromeDevtoolsClient.defaultArgs resolves entry under the home directory', () => {
  const originalArgs = process.env.MCP_CHROME_DEVTOOLS_ARGS;
  const originalEntry = process.env.MCP_CHROME_DEVTOOLS_ENTRY;
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;

  delete process.env.MCP_CHROME_DEVTOOLS_ARGS;
  delete process.env.MCP_CHROME_DEVTOOLS_ENTRY;

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-devtools-client-'));
  const fakeHome = path.join(tempRoot, 'home');
  const entryDir = path.join(fakeHome, '.codex', 'mcp', 'chrome-dev', 'build', 'src');
  fs.mkdirSync(entryDir, { recursive: true });
  const entryFile = path.join(entryDir, 'index.js');
  fs.writeFileSync(entryFile, '// stub entry\n', 'utf8');

  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;

  try {
    const expected = path.resolve(entryFile);
    const args = ChromeDevtoolsClient.defaultArgs();
    assert.deepEqual(args, [expected]);
  } finally {
    if (originalArgs === undefined) {
      delete process.env.MCP_CHROME_DEVTOOLS_ARGS;
    } else {
      process.env.MCP_CHROME_DEVTOOLS_ARGS = originalArgs;
    }

    if (originalEntry === undefined) {
      delete process.env.MCP_CHROME_DEVTOOLS_ENTRY;
    } else {
      process.env.MCP_CHROME_DEVTOOLS_ENTRY = originalEntry;
    }

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
