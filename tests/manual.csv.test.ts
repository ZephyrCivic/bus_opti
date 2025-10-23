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
  vehicleTypesToCsv,
  csvToVehicleTypes,
  vehiclesToCsv,
  csvToVehicles,
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
  assert.equal(parsed[1]?.name, '匿名化済');
});

test('drivers CSV parser detects duplicate ids', () => {
  const csv = `driver_id,name\nDRV_A,Alice\nDRV_A,Bob\n`;
  assert.throws(() => csvToDrivers(csv), /duplicated/i);
});

test('vehicle types CSV round-trip handles boolean and numeric fields', () => {
  const csv = vehicleTypesToCsv([
    {
      typeId: 'LARGE',
      name: '大型',
      wheelchairAccessible: true,
      lowFloor: false,
      capacitySeated: 45,
      capacityTotal: 70,
      tags: '高速,都市間',
    },
  ]);
  const parsed = csvToVehicleTypes(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.typeId, 'LARGE');
  assert.equal(parsed[0]?.wheelchairAccessible, true);
  assert.equal(parsed[0]?.lowFloor, false);
  assert.equal(parsed[0]?.capacitySeated, 45);
  assert.equal(parsed[0]?.capacityTotal, 70);
  assert.equal(parsed[0]?.tags, '高速,都市間');
});

test('vehicles CSV round-trip preserves references and optional fields', () => {
  const csv = vehiclesToCsv([
    {
      vehicleId: 'BUS_001',
      vehicleTypeId: 'LARGE',
      depotId: 'DEPOT_A',
      seats: 45,
      wheelchairAccessible: true,
      lowFloor: true,
      notes: '予備車両',
    },
  ]);
  const parsed = csvToVehicles(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.vehicleId, 'BUS_001');
  assert.equal(parsed[0]?.vehicleTypeId, 'LARGE');
  assert.equal(parsed[0]?.depotId, 'DEPOT_A');
  assert.equal(parsed[0]?.seats, 45);
  assert.equal(parsed[0]?.wheelchairAccessible, true);
  assert.equal(parsed[0]?.lowFloor, true);
  assert.equal(parsed[0]?.notes, '予備車両');
});

test('vehicles CSV parser requires vehicle_type', () => {
  const csv = `vehicle_id,vehicle_type\nBUS_001,\n`;
  assert.throws(() => csvToVehicles(csv), /vehicle_type is required/);
});
