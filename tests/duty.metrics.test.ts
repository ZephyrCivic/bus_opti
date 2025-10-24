/**
 * tests/duty.metrics.test.ts
 * Duty KPI helper tests to ensure dutyMetrics utilities respect configuration limits.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTripLookup,
  computeDutyMetrics,
  formatMinutes,
} from '@/services/duty/dutyMetrics';
import { DEFAULT_DUTY_SETTINGS } from '@/services/duty/dutyState';
import type { BlockCsvRow } from '@/services/blocks/blockBuilder';
import type { Duty } from '@/types';

const baseRows: BlockCsvRow[] = [
  {
    blockId: 'BLOCK_001',
    seq: 1,
    tripId: 'TRIP_A',
    tripStart: '08:00',
    tripEnd: '08:45',
    fromStopId: 'STOP_A',
    toStopId: 'STOP_B',
    serviceId: 'WKD',
  },
  {
    blockId: 'BLOCK_001',
    seq: 2,
    tripId: 'TRIP_B',
    tripStart: '09:00',
    tripEnd: '09:30',
    fromStopId: 'STOP_B',
    toStopId: 'STOP_C',
    serviceId: 'WKD',
  },
  {
    blockId: 'BLOCK_001',
    seq: 3,
    tripId: 'TRIP_C',
    tripStart: '10:00',
    tripEnd: '11:00',
    fromStopId: 'STOP_C',
    toStopId: 'STOP_D',
    serviceId: 'WKD',
  },
];

const lookup = buildTripLookup(baseRows);

function makeDuty(segmentTuples: Array<[string, string]>): Duty {
  return {
    id: 'DUTY_001',
    segments: segmentTuples.map(([startTripId, endTripId], index) => ({
      id: 'SEG_' + String(index + 1).padStart(3, '0'),
      blockId: 'BLOCK_001',
      startTripId,
      endTripId,
      startSequence: index * 10 + 1,
      endSequence: index * 10 + 2,
    })),
  };
}

test('computeDutyMetrics derives durations and respects limits', () => {
  const duty = makeDuty([
    ['TRIP_A', 'TRIP_B'],
    ['TRIP_C', 'TRIP_C'],
  ]);

  const metrics = computeDutyMetrics(duty, lookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(formatMinutes(metrics.longestContinuousMinutes), '1時間30分');
  assert.equal(formatMinutes(metrics.totalSpanMinutes), '3時間');
  assert.equal(formatMinutes(metrics.shortestBreakMinutes ?? undefined), '30分');
  assert.equal(metrics.warnings.exceedsContinuous, false);
  assert.equal(metrics.warnings.exceedsDailySpan, false);
  assert.equal(metrics.warnings.insufficientBreak, false);
});

test('computeDutyMetrics flags continuous driving beyond limit', () => {
  const longRows: BlockCsvRow[] = [
    {
      blockId: 'BLOCK_002',
      seq: 1,
      tripId: 'LONG_START',
      tripStart: '05:00',
      tripEnd: '05:10',
      fromStopId: 'A',
      toStopId: 'B',
      serviceId: 'WKD',
    },
    {
      blockId: 'BLOCK_002',
      seq: 2,
      tripId: 'LONG_END',
      tripStart: '05:10',
      tripEnd: '10:30',
      fromStopId: 'B',
      toStopId: 'C',
      serviceId: 'WKD',
    },
  ];
  const longLookup = buildTripLookup(longRows);
  const duty = {
    id: 'DUTY_LONG',
    segments: [
      {
        id: 'SEG_001',
        blockId: 'BLOCK_002',
        startTripId: 'LONG_START',
        endTripId: 'LONG_END',
        startSequence: 1,
        endSequence: 2,
      },
    ],
  } satisfies Duty;

  const metrics = computeDutyMetrics(duty, longLookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(metrics.warnings.exceedsContinuous, true);
  assert.equal(formatMinutes(metrics.longestContinuousMinutes), '5時間30分');
});

test('computeDutyMetrics flags insufficient break duration', () => {
  const duty = makeDuty([
    ['TRIP_A', 'TRIP_A'],
    ['TRIP_B', 'TRIP_B'],
  ]);

  const metrics = computeDutyMetrics(duty, lookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(metrics.warnings.insufficientBreak, true);
  assert.equal(formatMinutes(metrics.shortestBreakMinutes ?? undefined), '15分');
});

test('computeDutyMetrics treats deadhead segments as連続運転', () => {
  const duty: Duty = {
    id: 'DUTY_DEADHEAD',
    segments: [
      {
        id: 'SEG_001',
        blockId: 'BLOCK_001',
        startTripId: 'TRIP_A',
        endTripId: 'TRIP_A',
        startSequence: 1,
        endSequence: 1,
      },
      {
        id: 'SEG_002',
        blockId: 'BLOCK_001',
        startTripId: 'TRIP_A',
        endTripId: 'TRIP_B',
        startSequence: 2,
        endSequence: 3,
        kind: 'deadhead',
        deadheadMinutes: 15,
      },
      {
        id: 'SEG_003',
        blockId: 'BLOCK_001',
        startTripId: 'TRIP_B',
        endTripId: 'TRIP_B',
        startSequence: 4,
        endSequence: 4,
      },
    ],
  };

  const metrics = computeDutyMetrics(duty, lookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(formatMinutes(metrics.longestContinuousMinutes), '1時間30分');
  assert.equal(formatMinutes(metrics.shortestBreakMinutes ?? undefined), '-');
  assert.equal(metrics.warnings.insufficientBreak, false);
});

test('computeDutyMetrics flags total span beyond daily limit', () => {
  const spanRows: BlockCsvRow[] = [
    { blockId: 'BLOCK_003', seq: 1, tripId: 'S1', tripStart: '04:00', tripEnd: '04:10', fromStopId: 'S', toStopId: 'T', serviceId: 'WKD' },
    { blockId: 'BLOCK_003', seq: 2, tripId: 'S2', tripStart: '12:00', tripEnd: '22:30', fromStopId: 'T', toStopId: 'U', serviceId: 'WKD' },
  ];
  const spanLookup = buildTripLookup(spanRows);
  const duty = {
    id: 'DUTY_SPAN',
    segments: [
      { id: 'SEG_001', blockId: 'BLOCK_003', startTripId: 'S1', endTripId: 'S1', startSequence: 1, endSequence: 1 },
      { id: 'SEG_002', blockId: 'BLOCK_003', startTripId: 'S2', endTripId: 'S2', startSequence: 2, endSequence: 2 },
    ],
  } satisfies Duty;

  const metrics = computeDutyMetrics(duty, spanLookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(metrics.warnings.exceedsDailySpan, true);
  assert.equal(formatMinutes(metrics.totalSpanMinutes), '18時間30分');
});

test('computeDutyMetrics handles 24:00 notation across midnight', () => {
  const overnightRows: BlockCsvRow[] = [
    { blockId: 'BLOCK_NIGHT', seq: 1, tripId: 'N1', tripStart: '23:30', tripEnd: '24:10', fromStopId: 'SA', toStopId: 'SB', serviceId: 'WKD' },
    { blockId: 'BLOCK_NIGHT', seq: 2, tripId: 'N2', tripStart: '24:20', tripEnd: '25:00', fromStopId: 'SB', toStopId: 'SC', serviceId: 'WKD' },
  ];
  const overnightLookup = buildTripLookup(overnightRows);
  const duty = {
    id: 'DUTY_NIGHT',
    segments: [
      { id: 'SEG_N1', blockId: 'BLOCK_NIGHT', startTripId: 'N1', endTripId: 'N1', startSequence: 1, endSequence: 1 },
      { id: 'SEG_N2', blockId: 'BLOCK_NIGHT', startTripId: 'N2', endTripId: 'N2', startSequence: 2, endSequence: 2 },
    ],
  } satisfies Duty;

  const metrics = computeDutyMetrics(duty, overnightLookup, DEFAULT_DUTY_SETTINGS);
  assert.equal(metrics.warnings.exceedsDailySpan, false);
  assert.equal(formatMinutes(metrics.totalSpanMinutes), '1時間30分');
  assert.equal(formatMinutes(metrics.shortestBreakMinutes ?? undefined), '10分');
  assert.equal(metrics.warnings.insufficientBreak, true);
});
