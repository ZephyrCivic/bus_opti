import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeDriverName, REDACTED_LABEL } from '../src/services/privacy/redaction';
import { driversToCsv, csvToDrivers } from '../src/services/manual/manualCsv';

test('sanitizeDriverName redacts non-empty strings', () => {
  const result = sanitizeDriverName('山田太郎');
  assert.equal(result.value, REDACTED_LABEL);
  assert.equal(result.redacted, true);
});

test('sanitizeDriverName ignores already redacted label', () => {
  const result = sanitizeDriverName(REDACTED_LABEL);
  assert.equal(result.value, REDACTED_LABEL);
  assert.equal(result.redacted, false);
});

test('csvToDrivers anonymizes imported names', () => {
  const csv = 'driver_id,name\nDRV001,山田太郎\n';
  const drivers = csvToDrivers(csv);
  assert.equal(drivers.length, 1);
  assert.equal(drivers[0]?.driverId, 'DRV001');
  assert.equal(drivers[0]?.name, REDACTED_LABEL);
});

test('driversToCsv outputs redacted name', () => {
  const csv = driversToCsv([
    { driverId: 'DRV001', name: '山田太郎' },
    { driverId: 'DRV002', name: '' },
  ]);
  const rows = csv.split('\n');
  assert.equal(rows[1], `DRV001,${REDACTED_LABEL}`);
  assert.equal(rows[2], 'DRV002,');
});
