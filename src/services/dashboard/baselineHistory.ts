/**
 * src/services/dashboard/baselineHistory.ts
 * Stores and retrieves Diff baseline history in localStorage.
 */
import type { DashboardAlert, ScheduleState } from '@/types';

export interface BaselineHistoryEntry {
  id: string;
  savedAt: string;
  fileName: string;
  summary: {
    totalShifts: number;
    unassignedCount: number;
    fairnessScore: number;
    coveragePercentage: number;
  };
  alerts: DashboardAlert[];
  state: ScheduleState;
}

const HISTORY_KEY = 'dutyBaselineHistory:v1';
const MAX_ENTRIES = 10;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  return window.localStorage;
}

function safeParseHistory(value: string | null): BaselineHistoryEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as BaselineHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function safeStringifyHistory(entries: BaselineHistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

function ensureId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `baseline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadBaselineHistory(storage?: StorageLike): BaselineHistoryEntry[] {
  const target = resolveStorage(storage);
  if (!target) return [];
  return safeParseHistory(target.getItem(HISTORY_KEY));
}

function persist(entries: BaselineHistoryEntry[], storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem(HISTORY_KEY, safeStringifyHistory(entries));
  } catch {
    // ignore write errors (e.g. quota exceeded)
  }
}

export function clearBaselineHistory(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function addBaselineHistory(
  state: ScheduleState,
  options: { fileName: string; savedAt?: string },
  storage?: StorageLike,
  maxEntries = MAX_ENTRIES,
): BaselineHistoryEntry[] {
  const entries = loadBaselineHistory(storage);
  const entry: BaselineHistoryEntry = {
    id: ensureId(),
    savedAt: options.savedAt ?? new Date().toISOString(),
    fileName: options.fileName,
    summary: {
      totalShifts: state.dashboard.summary.totalShifts,
      unassignedCount: state.dashboard.summary.unassignedCount,
      fairnessScore: state.dashboard.summary.fairnessScore,
      coveragePercentage: state.dashboard.summary.coveragePercentage,
    },
    alerts: state.dashboard.alerts ?? [],
    state,
  };
  const next = [entry, ...entries].slice(0, maxEntries);
  persist(next, storage);
  return next;
}
