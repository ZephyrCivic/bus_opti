import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const deployDoc = readFileSync(resolve('docs/DEPLOY.md'), 'utf8');

test('DEPLOY.md describes GitHub Pages workflow', () => {
  assert.match(deployDoc, /GitHub Pages/);
  assert.match(deployDoc, /actions-gh-pages/);
});


