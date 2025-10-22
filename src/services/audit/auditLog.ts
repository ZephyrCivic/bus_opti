/**
 * src/services/audit/auditLog.ts
 * Records export events for audit purposes. Browser builds persist to localStorage,
 * Node/test environments keep an in-memory log for assertions or offline processing.
 */

export interface AuditEvent {
  action: 'export';
  entity: string;
  fileName: string;
  format: 'csv';
  rowCount?: number;
  generatedAt?: string;
  settingsHash?: string;
  warnings?: { hard: number; soft: number };
  timestamp: string;
}

const LOCAL_STORAGE_KEY = 'audit:events';
const GLOBAL_STORE_KEY = '__AUDIT_LOG__';
const MAX_LOCAL_STORAGE_EVENTS = 50;

export interface RecordAuditParams {
  entity: string;
  fileName: string;
  rowCount?: number;
  generatedAt?: string;
  settingsHash?: string;
  warnings?: { hard: number; soft: number };
  timestamp?: string;
}

export function recordAuditEvent(params: RecordAuditParams): void {
  const event: AuditEvent = {
    action: 'export',
    entity: params.entity,
    fileName: params.fileName,
    format: 'csv',
    rowCount: params.rowCount,
    generatedAt: params.generatedAt,
    settingsHash: params.settingsHash,
    warnings: params.warnings,
    timestamp: params.timestamp ?? new Date().toISOString(),
  };

  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    appendToLocalStorage(event);
    return;
  }

  appendToGlobalStore(event);
}

export function getAuditEvents(): AuditEvent[] {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AuditEvent[]) : [];
    } catch {
      return [];
    }
  }
  const store = (globalThis as Record<string, unknown>)[GLOBAL_STORE_KEY];
  return Array.isArray(store) ? (store as AuditEvent[]) : [];
}

export function clearAuditEvents(): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  (globalThis as Record<string, unknown>)[GLOBAL_STORE_KEY] = [];
}

function appendToLocalStorage(event: AuditEvent): void {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: AuditEvent[] = raw ? (JSON.parse(raw) as AuditEvent[]) : [];
    list.push(event);
    while (list.length > MAX_LOCAL_STORAGE_EVENTS) {
      list.shift();
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage might be unavailable or quota exceeded; ignore to keep UI responsive.
  }
}

function appendToGlobalStore(event: AuditEvent): void {
  const store = (globalThis as Record<string, unknown>)[GLOBAL_STORE_KEY];
  if (Array.isArray(store)) {
    store.push(event);
    return;
  }
  (globalThis as Record<string, unknown>)[GLOBAL_STORE_KEY] = [event];
}
