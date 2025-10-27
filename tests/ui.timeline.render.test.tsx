/**
 * tests/ui.timeline.render.test.ts
 * TimelineGantt の最小描画要件を軽量に検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import TimelineGantt from '../src/features/timeline/TimelineGantt';
import type { TimelineLane } from '../src/features/timeline/types';

test('TimelineGantt renders lanes, segments, and hour ticks', () => {
  const lanes: TimelineLane[] = [
    {
      id: 'lane-1',
      label: 'Block A',
      tag: { label: 'L', title: '想定車両タイプ: L' },
      segments: [
        { id: 'seg-1', label: 'Trip A', startMinutes: 480, endMinutes: 540 },
        { id: 'seg-2', label: 'Trip B', startMinutes: 600, endMinutes: 660 },
      ],
    },
    {
      id: 'lane-2',
      label: 'Block B',
      segments: [{ id: 'seg-3', label: 'Trip C', startMinutes: 1500, endMinutes: 1560 }],
    },
  ];

  const markup = renderToStaticMarkup(
    <TimelineGantt lanes={lanes} selectedLaneId="lane-1" selectedSegmentId="seg-1" />,
  );

  assert.match(markup, /Block A/);
  assert.match(markup, /Trip A/);
  assert.match(markup, /data-lane-tag="L"/);
  assert.match(markup, /svg/);
  assert.match(markup, /08:00/);
  assert.match(markup, /26:00/);
});
