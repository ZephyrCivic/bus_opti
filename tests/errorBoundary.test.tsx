/**
 * tests/errorBoundary.test.tsx
 * ErrorBoundary が例外を捕捉してフォールバックを描画することを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ErrorBoundary } from '../src/components/layout/ErrorBoundary';

const FALLBACK_TEXT = 'fallback rendered';

test('ErrorBoundary.getDerivedStateFromError returns hasError=true', () => {
  const state = ErrorBoundary.getDerivedStateFromError(new Error('kaboom'));
  assert.deepEqual(state, { hasError: true });
});

test('ErrorBoundary render returns fallback when hasError=true', () => {
  class TestBoundary extends ErrorBoundary {
    constructor() {
      super({ fallback: <div>{FALLBACK_TEXT}</div>, children: <div>child</div> });
      this.state = { hasError: true };
    }
  }
  const boundary = new TestBoundary();
  const output = boundary.render();
  const markup = renderToStaticMarkup(<>{output}</>);
  assert.match(markup, new RegExp(FALLBACK_TEXT));
});

test('ErrorBoundary render returns children when hasError=false', () => {
  class TestBoundary extends ErrorBoundary {
    constructor() {
      super({ fallback: <div>{FALLBACK_TEXT}</div>, children: <div>all good</div> });
      this.state = { hasError: false };
    }
  }
  const boundary = new TestBoundary();
  const output = boundary.render();
  const markup = renderToStaticMarkup(<>{output}</>);
  assert.match(markup, /all good/);
});
