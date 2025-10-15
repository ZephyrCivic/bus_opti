/**
 * tests/encoding.blocksView.test.ts
 * Guards BlocksView.tsx against full-width tildes that break encoding scan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('BlocksView timeline label uses ASCII tilde', () => {
  const source = readFileSync(resolve('src/features/blocks/BlocksView.tsx'), 'utf8');
  assert.ok(!source.includes('\uFF5E'), 'BlocksView.tsx should not contain full-width tilde (U+FF5E)');
});
