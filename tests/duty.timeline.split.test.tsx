/**
 * tests/duty.timeline.split.test.tsx
 * Verifies that DutyTimelineCard renders synchronized Vehicle/Driver timelines.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { DutyTimelineCard } from '../src/features/duties/components/DutyTimelineCard';
import type { DutyTimelineMeta } from '../src/features/duties/hooks/useDutyTimelineData';
import type { TimelineLane } from '../src/features/timeline/types';
import type { TimelineSegmentDragEvent, TimelineInteractionEvent, TimelineSelection } from '../src/features/timeline/types';

const noop = () => {};
const noopWithArg = (..._args: unknown[]) => {};

test('DutyTimelineCard renders Vehicle/Driver timelines with shared configuration', () => {
  const blockLanes: TimelineLane[] = [
    {
      id: 'BLOCK-1',
      label: 'BLOCK-1（2便）',
      segments: [
        { id: 'BLOCK-1-seg-1', label: 'TRIP-1', startMinutes: 480, endMinutes: 510 },
        { id: 'BLOCK-1-seg-2', label: 'TRIP-2', startMinutes: 520, endMinutes: 560 },
      ],
    },
  ];

  const dutyLanes: TimelineLane<DutyTimelineMeta>[] = [
    {
      id: 'DUTY-1',
      label: 'DUTY-1',
      segments: [
        {
          id: 'DUTY-1-seg',
          label: 'TRIP-1 → TRIP-2',
          startMinutes: 480,
          endMinutes: 560,
          meta: {
            dutyId: 'DUTY-1',
            segmentId: 'DUTY-1-seg',
            blockId: 'BLOCK-1',
            startTripId: 'TRIP-1',
            endTripId: 'TRIP-2',
          },
        },
      ],
    },
  ];

  const markup = renderToStaticMarkup(
    <DutyTimelineCard
      onImportClick={noop}
      onImportFile={(file: File) => {
        noopWithArg(file);
      }}
      onExport={noop}
      onAdd={noop}
      onMove={noop}
      onDelete={noop}
      onAutoCorrect={noop}
      onUndo={noop}
      onRedo={noop}
      lanes={dutyLanes}
      pixelsPerMinute={1}
      onInteraction={(event: TimelineInteractionEvent) => {
        void event;
      }}
      onSegmentDrag={(event: TimelineSegmentDragEvent<DutyTimelineMeta>) => {
        noopWithArg(event);
      }}
      onSelect={(selection: TimelineSelection) => {
        noopWithArg(selection);
      }}
      blockLanes={blockLanes}
      onBlockSelect={noopWithArg}
      selectedBlockId="BLOCK-1"
      selectedDutyId="DUTY-1"
      selectedSegmentId="DUTY-1-seg"
    />,
  );

  assert.match(markup, /Vehicleビュー（Blockタイムライン）/);
  assert.match(markup, /Driverビュー（Dutyタイムライン）/);
  assert.match(markup, /BLOCK-1/);
  assert.match(markup, /DUTY-1/);
});
