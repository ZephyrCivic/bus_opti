/**
 * tests/config.defaults.test.ts
 * Verifies Python config defaults and TypeScript DEFAULT_DUTY_SETTINGS stay in sync.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEFAULT_DUTY_SETTINGS } from '../src/services/duty/dutyState';

const configPath = resolve(process.cwd(), 'config.py');
const configText = readFileSync(configPath, 'utf8');

function readConfigValue(name: string): number {
  const pattern = new RegExp(`${name}\\s*=\\s*(\\d+)`);
  const match = configText.match(pattern);
  if (!match) {
    throw new Error(`config.py に ${name} が見つかりません`);
  }
  return Number.parseInt(match[1]!, 10);
}

test('DEFAULT_DUTY_SETTINGS mirrors config.py values', () => {
  const configDefaults = {
    maxContinuousMinutes: readConfigValue('DUTY_MAX_CONTINUOUS_MINUTES'),
    minBreakMinutes: readConfigValue('DUTY_MIN_BREAK_MINUTES'),
    maxDailyMinutes: readConfigValue('DUTY_MAX_DAILY_MINUTES'),
    undoStackLimit: readConfigValue('DUTY_UNDO_STACK_LIMIT'),
    maxUnassignedPercentage: readConfigValue('DUTY_MAX_UNASSIGNED_PERCENTAGE'),
    maxNightShiftVariance: readConfigValue('DUTY_MAX_NIGHT_SHIFT_VARIANCE'),
  };

  assert.deepEqual(DEFAULT_DUTY_SETTINGS, configDefaults);
});
