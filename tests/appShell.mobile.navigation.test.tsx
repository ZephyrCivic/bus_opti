/**
 * tests/appShell.mobile.navigation.test.tsx
 * AppShell がモバイル選択 UI とデスクトップボタンを両方レンダリングすることを検証する。
 * ナビゲーション改修の退行を早期に検知するため、主要セクションの option / data-section をチェックする。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { NavigationSection } from '../src/components/layout/AppShell';
import AppShell from '../src/components/layout/AppShell';

const SECTIONS_UNDER_TEST: NavigationSection[] = [
  { id: 'import', label: 'GTFS取込' },
  { id: 'blocks', label: '系統計画' },
  { id: 'duties', label: '乗務計画' },
  { id: 'dashboard', label: '指標ダッシュボード' },
  { id: 'diff', label: '差分確認' },
  { id: 'manual', label: '手動設定' },
];

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('AppShell renders mobile select with all navigation options', () => {
  const markup = renderToStaticMarkup(
    <AppShell sections={SECTIONS_UNDER_TEST} activeSection="import" onSectionSelect={() => undefined}>
      <div>content</div>
    </AppShell>,
  );

  assert.match(markup, /id="app-mobile-nav"/, 'mobile select should exist');

  for (const section of SECTIONS_UNDER_TEST) {
    const escapedLabel = escapeRegExp(section.label);
    assert.match(markup, new RegExp(`value="${section.id}"`), `option for ${section.id} should exist`);
    assert.match(
      markup,
      new RegExp(`>${escapedLabel}`),
      `option label "${section.label}" should be rendered`,
    );
    assert.match(
      markup,
      new RegExp(`data-section="${section.id}"`),
      `desktop nav button for ${section.id} should exist`,
    );
  }
});

