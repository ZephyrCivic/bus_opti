/**
 * tests/duty.baseline.history.test.ts
 * Ensures baseline history storage handles add/load/clear operations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addBaselineHistory,
  clearBaselineHistory,
  loadBaselineHistory,
  type BaselineHistoryEntry,
} from '@/services/dashboard/baselineHistory';
import type { ScheduleState } from '@/types';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const sampleState = (id: string): ScheduleState => ({
  schedule: { Day: [{ routeId: `R-${id}`, driverId: `D-${id}` }] },
  dashboard: {
    summary: {
      totalShifts: 1,
      totalHours: 4,
      unassignedCount: 0,
      fairnessScore: 100,
      coveragePercentage: 100,
    },
    workloadAnalysis: [],
    driverWorkloads: [],
    unassignedRoutes: [],
    alerts: [],
    dailyMetrics: [],
    alertHistory: [],
  },
});

test('addBaselineHistory stores entries and enforces max size', () => {
  const storage = new MemoryStorage();
  let entries: BaselineHistoryEntry[] = [];
  for (let index = 0; index < 12; index += 1) {
    entries = addBaselineHistory(sampleState(String(index)), { fileName: `file-${index}.json`, savedAt: `2025-10-08T00:0${index}:00Z` }, storage, 5);
  }

  assert.equal(entries.length, 5);
  assert.ok(entries.every((entry, idx) => entry.fileName === `file-${11 - idx}.json`), 'entries should be most recent first');

  const loaded = loadBaselineHistory(storage);
  assert.deepEqual(loaded.map((entry) => entry.fileName), entries.map((entry) => entry.fileName));
});

test('clearBaselineHistory removes entries', () => {
  const storage = new MemoryStorage();
  addBaselineHistory(sampleState('A'), { fileName: 'file-a.json' }, storage);
  assert.ok(loadBaselineHistory(storage).length > 0);
  clearBaselineHistory(storage);
  assert.equal(loadBaselineHistory(storage).length, 0);
});

test('loadBaselineHistory tolerates malformed data', () => {
  const storage = new MemoryStorage();
  storage.setItem('dutyBaselineHistory:v1', 'not-json');
  assert.equal(loadBaselineHistory(storage).length, 0);
});
