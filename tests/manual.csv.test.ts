/**
 * tests/manual.csv.test.ts
 * Verifies manual CSV round-trip for depots / relief points / deadhead rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  depotsToCsv,
  csvToDepots,
  reliefPointsToCsv,
  csvToReliefPoints,
  deadheadRulesToCsv,
  csvToDeadheadRules,
  driversToCsv,
  csvToDrivers,
} from '../src/services/manual/manualCsv';

test('depots CSV round-trip preserves numeric fields', () => {
  const csv = depotsToCsv([
    {
      depotId: 'DEPOT_MAIN',
      name: '中央車庫',
      lat: 36.389,
      lon: 139.06,
      openTime: '05:00',
      closeTime: '24:00',
      minTurnaroundMin: 15,
    },
  ]);
  const parsed = csvToDepots(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.depotId, 'DEPOT_MAIN');
  assert.equal(parsed[0]?.minTurnaroundMin, 15);
});

test('relief points CSV handles optional fields', () => {
  const csv = reliefPointsToCsv([
    {
      reliefId: 'RELIEF_A',
      name: '駅前',
      lat: 36.4,
      lon: 139.1,
      stopId: 'STOP_A',
      walkTimeToStopMin: 3,
      allowedWindow: '05:00-24:00',
    },
  ]);
  const parsed = csvToReliefPoints(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.reliefId, 'RELIEF_A');
  assert.equal(parsed[0]?.walkTimeToStopMin, 3);
});

test('deadhead rules CSV enforces numeric values', () => {
  const csv = deadheadRulesToCsv([
    {
      fromId: 'DEPOT_MAIN',
      toId: 'STOP_MAIN',
      mode: 'bus',
      travelTimeMin: 20,
      distanceKm: 12.5,
      allowedWindow: '',
    },
  ]);
  const parsed = csvToDeadheadRules(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.mode, 'bus');
  assert.equal(parsed[0]?.distanceKm, 12.5);
});

test('drivers CSV round-trip preserves identifiers', () => {
  const csv = driversToCsv([
    { driverId: 'DRV_A', name: 'Alice' },
    { driverId: 'DRV_B', name: 'Bob' },
  ]);
  const parsed = csvToDrivers(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.driverId, 'DRV_A');
  assert.equal(parsed[1]?.name, 'Bob');
});

test('drivers CSV parser detects duplicate ids', () => {
  const csv = `driver_id,name\nDRV_A,Alice\nDRV_A,Bob\n`;
  assert.throws(() => csvToDrivers(csv), /duplicated/i);
});
