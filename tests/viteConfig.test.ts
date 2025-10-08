/**
 * tests/viteConfig.test.ts
 * Guards the GitHub Pages base path switching logic for the Vite config.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import viteConfig from '../vite.config';

test('production mode uses GitHub Pages base path', () => {
  const config = viteConfig({ mode: 'production', command: 'build', isSsrBuild: false, isPreview: false });
  assert.equal(config.base, '/bus_opti/');
});

test('development mode keeps root base path for dev server', () => {
  const config = viteConfig({ mode: 'development', command: 'serve', isSsrBuild: false, isPreview: false });
  assert.equal(config.base, '/');
});
