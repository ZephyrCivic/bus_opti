/**
 * src/services/dashboard/saveHistory.ts
 * Stores JSON/CSV 保存イベントの簡易履歴。
 */

export type SaveHistoryType = 'saved-result' | 'project';

export interface SaveHistoryEntry {
  id: string;
  type: SaveHistoryType;
  fileName: string;
  savedAt: string;
  warnings?: { hard: number; soft: number };
}

const STORAGE_KEY = 'diff:saveHistory:v1';
const GLOBAL_KEY = '__DIFF_SAVE_HISTORY__';
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

function ensureId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseHistory(raw: string | null): SaveHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SaveHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyHistory(entries: SaveHistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

function loadFromGlobal(): SaveHistoryEntry[] {
  const store = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  return Array.isArray(store) ? (store as SaveHistoryEntry[]) : [];
}

function persistToGlobal(entries: SaveHistoryEntry[]): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = entries;
}

export function loadSaveHistory(storage?: StorageLike): SaveHistoryEntry[] {
  const target = resolveStorage(storage);
  if (target) {
    return parseHistory(target.getItem(STORAGE_KEY));
  }
  return loadFromGlobal();
}

function persist(entries: SaveHistoryEntry[], storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (target) {
    try {
      target.setItem(STORAGE_KEY, stringifyHistory(entries));
    } catch {
      // ignore quota errors
    }
    return;
  }
  persistToGlobal(entries);
}

export function addSaveHistory(
  entry: Omit<SaveHistoryEntry, 'id' | 'savedAt'> & { savedAt?: string },
  storage?: StorageLike,
  maxEntries = MAX_ENTRIES,
): SaveHistoryEntry[] {
  const existing = loadSaveHistory(storage);
  const record: SaveHistoryEntry = {
    id: ensureId(),
    savedAt: entry.savedAt ?? new Date().toISOString(),
    type: entry.type,
    fileName: entry.fileName,
    warnings: entry.warnings,
  };
  const next = [record, ...existing].slice(0, maxEntries);
  persist(next, storage);
  return next;
}

export function clearSaveHistory(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (target) {
    try {
      target.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  persistToGlobal([]);
}

