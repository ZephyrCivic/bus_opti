/**
 * tests/duty.persistence.test.ts
 * Duty persistence helpers for localStorage save/load behaviours.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { saveDutyState, loadDutyState, clearDutyState, DUTY_STORAGE_KEY } from '@/services/duty/dutyPersistence';
import { createDutyEditState } from '@/services/duty/dutyState';

interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  snapshot(): Record<string, string>;
}

function createMockStorage(initial?: Record<string, string>): MockStorage {
  const map = new Map<string, string>(initial ? Object.entries(initial) : undefined);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    snapshot: () => Object.fromEntries(map.entries()),
  };
}

test('saveDutyState persists duties without undo history', () => {
  const storage = createMockStorage();
  const state = createDutyEditState();
  state.settings.maxDailyMinutes = Number.NaN;
  state.duties = [{
    id: 'DUTY_010',
    driverId: 'DRV_A',
    segments: [{
      id: 'SEG_001',
      blockId: 'BLOCK_001',
      startTripId: 'TRIP_A',
      endTripId: 'TRIP_B',
      startSequence: 1,
      endSequence: 2,
    }],
  }];
  state.undoStack = [[state.duties[0]]];

  saveDutyState(state, storage);
  const raw = storage.getItem(DUTY_STORAGE_KEY);
  assert.ok(raw, 'payload should be stored');
  const parsed = JSON.parse(raw!);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.duties.length, 1);
  assert.equal(parsed.duties[0].segments.length, 1);
  assert.ok(!('undoStack' in parsed), 'undoStack should not be persisted');

  const restored = loadDutyState(storage);
  assert.ok(restored, 'restored payload exists');
  assert.equal(restored!.duties[0]?.id, 'DUTY_010');
  assert.equal(restored!.duties[0]?.segments[0]?.startSequence, 1);
  assert.equal(restored!.settings.maxDailyMinutes, 780, 'NaN should fall back to default');
  assert.notStrictEqual(restored!.duties[0], state.duties[0], 'restored duties should be cloned');
});

test('loadDutyState drops malformed JSON entries', () => {
  const storage = createMockStorage({ [DUTY_STORAGE_KEY]: '{invalid' });
  const restored = loadDutyState(storage);
  assert.equal(restored, undefined);
  assert.equal(storage.getItem(DUTY_STORAGE_KEY), null);
});

test('clearDutyState removes stored snapshot', () => {
  const storage = createMockStorage({ [DUTY_STORAGE_KEY]: '{"version":1}' });
  clearDutyState(storage);
  assert.equal(storage.getItem(DUTY_STORAGE_KEY), null);
});
