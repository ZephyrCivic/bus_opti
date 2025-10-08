/**
 * tests/duty.workflow.test.ts
 * Covers duty editing workflows: redo stack behaviour, driver propagation,
 * CSV round-trip, KPI warnings, and auto-correction heuristics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDutySegment,
  buildTripIndexFromCsv,
  createDutyEditState,
  redoLastAction,
  undoLastAction,
} from '@/services/duty/dutyState';
import { buildTripLookup, computeDutyMetrics } from '@/services/duty/dutyMetrics';
import { buildDutiesCsv } from '@/services/export/dutiesCsv';
import { parseDutiesCsv } from '@/services/import/dutiesCsv';
import { autoCorrectDuty } from '@/services/duty/dutyAutoCorrect';
import type { BlockCsvRow } from '@/services/blocks/blockBuilder';

test('duty workflow maintains drivers, manages redo stack, and corrects KPI violations', () => {
  const rows: BlockCsvRow[] = [
    { blockId: 'BLOCK_A', seq: 1, tripId: 'TRIP_1', tripStart: '08:00', tripEnd: '09:30', fromStopId: 'STOP_1', toStopId: 'STOP_2', serviceId: 'S1' },
    { blockId: 'BLOCK_A', seq: 2, tripId: 'TRIP_2', tripStart: '09:40', tripEnd: '11:30', fromStopId: 'STOP_2', toStopId: 'STOP_3', serviceId: 'S1' },
    { blockId: 'BLOCK_A', seq: 3, tripId: 'TRIP_3', tripStart: '11:40', tripEnd: '14:30', fromStopId: 'STOP_3', toStopId: 'STOP_4', serviceId: 'S1' },
    { blockId: 'BLOCK_A', seq: 4, tripId: 'TRIP_4', tripStart: '14:40', tripEnd: '15:20', fromStopId: 'STOP_4', toStopId: 'STOP_5', serviceId: 'S1' },
    { blockId: 'BLOCK_A', seq: 5, tripId: 'TRIP_5', tripStart: '15:30', tripEnd: '16:40', fromStopId: 'STOP_5', toStopId: 'STOP_6', serviceId: 'S1' },
    { blockId: 'BLOCK_A', seq: 6, tripId: 'TRIP_6', tripStart: '17:30', tripEnd: '18:00', fromStopId: 'STOP_6', toStopId: 'STOP_7', serviceId: 'S1' },
  ];
  const index = buildTripIndexFromCsv(rows);
  const lookup = buildTripLookup(rows);

  let state = createDutyEditState({ maxDailyMinutes: 500 });
  state = addDutySegment(
    state,
    { blockId: 'BLOCK_A', startTripId: 'TRIP_1', endTripId: 'TRIP_3', driverId: 'DRV_A' },
    index,
  );
  const dutyId = state.duties[0]!.id;
  assert.equal(state.duties[0]?.driverId, 'DRV_A');

  state = addDutySegment(
    state,
    { dutyId, blockId: 'BLOCK_A', startTripId: 'TRIP_4', endTripId: 'TRIP_5', driverId: 'DRV_B' },
    index,
  );
  assert.equal(state.duties[0]?.segments.length, 2);
  assert.equal(state.duties[0]?.driverId, 'DRV_B');

  const undone = undoLastAction(state);
  assert.equal(undone.duties[0]?.segments.length, 1);
  assert.equal(undone.duties[0]?.driverId, 'DRV_A', 'undo restores previous driver assignment');

  const redone = redoLastAction(undone);
  assert.equal(redone.duties[0]?.segments.length, 2);
  assert.equal(redone.duties[0]?.driverId, 'DRV_B', 'redo reapplies latest driver update');

  const extended = addDutySegment(
    redone,
    { dutyId, blockId: 'BLOCK_A', startTripId: 'TRIP_6', endTripId: 'TRIP_6' },
    index,
  );
  const afterRedo = redoLastAction(extended);
  assert.strictEqual(afterRedo, extended, 'redo stack clears after fresh action');

  const metrics = computeDutyMetrics(extended.duties[0]!, lookup, extended.settings);
  assert.equal(metrics.warnings.exceedsContinuous, true, 'long continuous segment should raise warning');
  assert.equal(metrics.warnings.insufficientBreak, true, '10分休憩は閾値未満');
  assert.ok(
    typeof metrics.shortestBreakMinutes === 'number' && metrics.shortestBreakMinutes < extended.settings.minBreakMinutes,
    'shortest break is below configuration threshold',
  );

  const exportData = buildDutiesCsv(extended.duties, {
    dutySettings: extended.settings,
    generatedAt: new Date('2025-10-08T12:00:00Z'),
  });
  const parsed = parseDutiesCsv(exportData.csv, index);
  assert.equal(parsed.duties.length, extended.duties.length);
  const parsedDuty = parsed.duties.find((entry) => entry.id === dutyId);
  assert.ok(parsedDuty);
  assert.equal(parsedDuty!.driverId, extended.duties[0]?.driverId);

  const autoCorrected = autoCorrectDuty(parsedDuty!, lookup, extended.settings);
  assert.equal(autoCorrected.changed, true, 'auto-correct should remove violating segment');
  assert.ok(autoCorrected.duty.segments.length < parsedDuty!.segments.length);

  const correctedMetrics = computeDutyMetrics(autoCorrected.duty, lookup, extended.settings);
  assert.equal(correctedMetrics.warnings.exceedsContinuous, false);
  assert.equal(correctedMetrics.warnings.insufficientBreak, false);
  assert.equal(correctedMetrics.warnings.exceedsDailySpan, false);
});
