/**
 * tests/blocks.plan.overlap.test.tsx
 * useBlocksPlan のサービス日グルーピングと重複計算を確認する。\n */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { useBlocksPlan } from '../src/features/blocks/hooks/useBlocksPlan';
import type { BlockPlan } from '../src/services/blocks/blockBuilder';

const plan: BlockPlan = {
  summaries: [
    {
      blockId: 'BLOCK_A',
      serviceId: 'WEEKDAY',
      serviceDayIndex: 0,
      tripCount: 2,
      firstTripStart: '08:00',
      lastTripEnd: '09:00',
      gaps: [],
    },
    {
      blockId: 'BLOCK_B',
      serviceId: 'WEEKDAY',
      serviceDayIndex: 0,
      tripCount: 2,
      firstTripStart: '08:30',
      lastTripEnd: '09:45',
      gaps: [],
    },
    {
      blockId: 'BLOCK_C',
      serviceId: 'SATURDAY',
      serviceDayIndex: 1,
      tripCount: 1,
      firstTripStart: '07:00',
      lastTripEnd: '08:00',
      gaps: [],
    },
  ],
  csvRows: [],
  unassignedTripIds: [],
  totalTripCount: 3,
  assignedTripCount: 3,
  coverageRatio: 1,
  maxTurnGapMinutes: 15,
};

interface InspectProps {
  activeDay?: number;
}

function InspectUseBlocksPlan({ activeDay }: InspectProps): JSX.Element {
  const { days, allDays, overlaps } = useBlocksPlan(plan, { activeDay });
  const visibleBlockIds = new Set<string>();
  for (const day of days) {
    for (const summary of day.summaries) {
      visibleBlockIds.add(summary.blockId);
    }
  }
  const overlapA = visibleBlockIds.has('BLOCK_A')
    ? (overlaps.get('BLOCK_A') ?? []).reduce((acc, entry) => acc + entry.overlapMinutes, 0)
    : 0;
  const overlapB = visibleBlockIds.has('BLOCK_B')
    ? (overlaps.get('BLOCK_B') ?? []).reduce((acc, entry) => acc + entry.overlapMinutes, 0)
    : 0;
  return (
    <div
      data-days={days.map((day) => day.label).join('|')}
      data-all-days={allDays.length}
      data-overlap-a={overlapA.toFixed(2)}
      data-overlap-b={overlapB.toFixed(2)}
    />
  );
}

function readAttribute(markup: string, name: string): string {
  const pattern = new RegExp(`data-${name}="([^"]*)"`);
  const match = markup.match(pattern);
  if (!match) {
    throw new Error(`attribute ${name} not found in ${markup}`);
  }
  return match[1] ?? '';
}

test('useBlocksPlan returns all service days by default and detects overlaps', () => {
  const markup = renderToStaticMarkup(<InspectUseBlocksPlan />);
  assert.equal(readAttribute(markup, 'all-days'), '2');
  assert.equal(readAttribute(markup, 'days'), 'Day 1|Day 2');
  assert.equal(readAttribute(markup, 'overlap-a'), '30.00');
  assert.equal(readAttribute(markup, 'overlap-b'), '30.00');
});

test('useBlocksPlan filters by activeDay option', () => {
  const markup = renderToStaticMarkup(<InspectUseBlocksPlan activeDay={1} />);
  assert.equal(readAttribute(markup, 'days'), 'Day 2');
  assert.equal(readAttribute(markup, 'overlap-a'), '0.00');
  assert.equal(readAttribute(markup, 'overlap-b'), '0.00');
});
