/**
 * tests/export.bar.test.tsx
 * Lightweight snapshot-style check for ExportBar rendering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import ExportBar from '../src/components/export/ExportBar';

test('ExportBar renders provided action labels', () => {
  const markup = renderToStaticMarkup(
    <ExportBar
      actions={[
        { id: 'blocks', label: 'Blocks CSV', onClick: () => {} },
        { id: 'duties', label: 'Duties CSV', onClick: () => {} },
      ]}
    />,
  );

  assert.match(markup, /Blocks CSV/);
  assert.match(markup, /Duties CSV/);
  assert.match(markup, /button/);
});

test('ExportBar shows fallback when no actions supplied', () => {
  const markup = renderToStaticMarkup(<ExportBar actions={[]} />);
  assert.match(markup, /エクスポート可能な項目はありません/);
});
