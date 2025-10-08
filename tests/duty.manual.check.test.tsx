/**
 * tests/duty.manual.check.test.tsx
 * Verifies ManualCheckCard renders Relief / Deadhead summaries and reflects Duty usage counts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ManualCheckCard from '../src/features/duties/components/ManualCheckCard';
import type { ManualInputs, Duty } from '../src/types';
import type { BlockPlan } from '../src/services/blocks/blockBuilder';

const manual: ManualInputs = {
  depots: [{ depotId: 'DEPOT_A', name: 'Depot A', lat: 35.0, lon: 139.0, minTurnaroundMin: 10 }],
  reliefPoints: [
    { reliefId: 'RELIEF_USED', name: 'Used Stop', lat: 35.1, lon: 139.1, stopId: 'STOP_USED' },
    { reliefId: 'RELIEF_IDLE', name: 'Idle Stop', lat: 35.2, lon: 139.2 },
  ],
  deadheadRules: [
    { fromId: 'DEPOT_A', toId: 'RELIEF_USED', mode: 'bus', travelTimeMin: 12 },
  ],
  drivers: [{ driverId: 'DRIVER_A', name: 'Alice' }],
  linking: { enabled: true, minTurnaroundMin: 10, maxConnectRadiusM: 100, allowParentStation: true },
};

const plan: BlockPlan = {
  summaries: [],
  csvRows: [
    {
      blockId: 'BLOCK_1',
      seq: 1,
      tripId: 'TRIP_START',
      tripStart: '08:00',
      tripEnd: '08:20',
      fromStopId: 'STOP_USED',
      toStopId: 'STOP_MID',
      serviceId: 'WEEKDAY',
    },
    {
      blockId: 'BLOCK_1',
      seq: 2,
      tripId: 'TRIP_END',
      tripStart: '08:20',
      tripEnd: '08:50',
      fromStopId: 'STOP_MID',
      toStopId: 'STOP_USED',
      serviceId: 'WEEKDAY',
    },
  ],
  unassignedTripIds: [],
  totalTripCount: 2,
  assignedTripCount: 2,
  coverageRatio: 1,
  maxTurnGapMinutes: 15,
};

const duties: Duty[] = [
  {
    id: 'DUTY_001',
    driverId: 'DRIVER_A',
    segments: [
      {
        id: 'SEG_001',
        blockId: 'BLOCK_1',
        startTripId: 'TRIP_START',
        endTripId: 'TRIP_END',
        startSequence: 1,
        endSequence: 2,
      },
    ],
  },
];

test('ManualCheckCard shows relief usage counts and deadhead summary', () => {
  const markup = renderToStaticMarkup(
    <ManualCheckCard manual={manual} plan={plan} duties={duties} />,
  );

  assert.match(markup, /Relief \/ Deadhead チェック/);
  assert.match(markup, /Relief 2 \/ Duty使用 1/);
  assert.match(markup, /RELIEF_USED/);
  assert.match(markup, /1 件/);
  assert.match(markup, /RELIEF_IDLE/);
  assert.match(markup, /0 件/);
  assert.match(markup, /Deadhead 1/);
  assert.match(markup, /DEPOT_A/);
  assert.match(markup, /Drivers 1/);
});
