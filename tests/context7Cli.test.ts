/**
 * tests/context7Cli.test.ts
 * Context7 CLI parser tests to ensure argument handling and URL builders stay stable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseContext7Args,
  buildSearchUrl,
  buildDocsUrl,
} from '../tools/context7Cli';

test('parseContext7Args resolves search query with tokens flag', () => {
  const options = parseContext7Args(['resolve', 'react', '--tokens', '800']);
  assert.equal(options.command, 'resolve');
  assert.equal(options.query, 'react');
  assert.equal(options.tokens, 800);
});

test('buildSearchUrl percent-encodes query', () => {
  const url = buildSearchUrl('react hooks');
  assert.equal(url, 'https://context7.com/api/search?query=react%20hooks');
});

test('buildDocsUrl trims leading slash', () => {
  const url = buildDocsUrl('/websites/react_dev', 500);
  assert.equal(url, 'https://context7.com/api/v1/websites/react_dev?tokens=500');
});

test('parseContext7Args docs command requires libraryId', () => {
  assert.throws(
    () => parseContext7Args(['docs']),
    /libraryId/,
  );
});
