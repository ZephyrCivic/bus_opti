/**
 * src/services/workflow/workflowTelemetry.ts
 * 「連結→警告確認→保存」ワークフローの所要時間を記録・集計するユーティリティ。
 */

import { sanitizeAuditValue } from '@/services/privacy/redaction';

export type WorkflowStage = 'link' | 'warnings' | 'save';

export interface WorkflowSummary {
  hardWarnings: number;
  softWarnings: number;
  unassigned: number;
  coveragePercentage?: number;
  fairnessScore?: number;
}

export interface WorkflowSaveContext {
  exportType: string;
  fileName?: string;
}

interface WorkflowSessionState {
  id: string;
  startedAt: string;
  summary: WorkflowSummary;
  warningsAt?: string;
  warningsSummary?: WorkflowSummary;
}

export interface WorkflowSessionRecord {
  id: string;
  startedAt: string;
  warningsAt?: string;
  savedAt: string;
  linkToWarningsMs?: number;
  warningsToSaveMs?: number;
  linkToSaveMs: number;
  summary: WorkflowSummary;
  warningsSummary?: WorkflowSummary;
  saveSummary: WorkflowSummary;
  context: WorkflowSaveContext;
}

export interface WorkflowStats {
  total: number;
  medianLinkToWarningsMs: number | null;
  medianWarningsToSaveMs: number | null;
  medianLinkToSaveMs: number | null;
  recent: WorkflowSessionRecord[];
}

const HISTORY_STORAGE_KEY = 'workflow.telemetry.history';
const SESSION_STORAGE_KEY = 'workflow.telemetry.current';
const GLOBAL_HISTORY_KEY = '__WORKFLOW_HISTORY__';
const GLOBAL_SESSION_KEY = '__WORKFLOW_SESSION__';
const MAX_HISTORY = 100;

type Listener = () => void;
const listeners = new Set<Listener>();

export function ensureWorkflowSession(summary: WorkflowSummary): void {
  if (!hasActiveWarnings(summary)) {
    return;
  }
  const current = loadCurrentSession();
  if (current) {
    saveCurrentSession({ ...current, summary });
    notify();
    return;
  }
  const session: WorkflowSessionState = {
    id: createSessionId(),
    startedAt: nowIso(),
    summary,
  };
  saveCurrentSession(session);
  notify();
}

export function markWorkflowWarningsViewed(summary: WorkflowSummary): void {
  let current = loadCurrentSession();
  if (!current) {
    if (!hasActiveWarnings(summary)) {
      return;
    }
    current = {
      id: createSessionId(),
      startedAt: nowIso(),
      summary,
    };
  }
  if (!current.warningsAt) {
    current.warningsAt = nowIso();
    current.warningsSummary = summary;
    saveCurrentSession(current);
    notify();
  }
}

export function completeWorkflowSave(summary: WorkflowSummary, context: WorkflowSaveContext): void {
  const now = nowIso();
  let current = loadCurrentSession();
  if (!current) {
    current = {
      id: createSessionId(),
      startedAt: now,
      summary,
    };
  }
  const savedAt = now;
  const warningsAt = current.warningsAt;
  const linkToSaveMs = diffMs(current.startedAt, savedAt);
  const record: WorkflowSessionRecord = {
    id: current.id,
    startedAt: current.startedAt,
    warningsAt,
    savedAt,
    linkToWarningsMs: warningsAt ? diffMs(current.startedAt, warningsAt) : undefined,
    warningsToSaveMs: warningsAt ? diffMs(warningsAt, savedAt) : undefined,
    linkToSaveMs,
    summary: current.summary,
    warningsSummary: current.warningsSummary,
    saveSummary: summary,
    context: {
      exportType: sanitizeAuditValue(context.exportType) || 'unknown',
      fileName: context.fileName ? sanitizeAuditValue(context.fileName) : undefined,
    },
  };

  const history = loadHistory();
  history.push(record);
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
  saveHistory(history);
  saveCurrentSession(null);
  notify();
}

export function getWorkflowSessions(): WorkflowSessionRecord[] {
  return loadHistory();
}

export function getWorkflowStats(): WorkflowStats {
  const history = loadHistory();
  if (history.length === 0) {
    return {
      total: 0,
      medianLinkToWarningsMs: null,
      medianWarningsToSaveMs: null,
      medianLinkToSaveMs: null,
      recent: [],
    };
  }
  const linkToWarnings = history.map((entry) => entry.linkToWarningsMs).filter(isNumber);
  const warningsToSave = history.map((entry) => entry.warningsToSaveMs).filter(isNumber);
  const linkToSave = history.map((entry) => entry.linkToSaveMs).filter(isNumber);
  return {
    total: history.length,
    medianLinkToWarningsMs: linkToWarnings.length > 0 ? median(linkToWarnings) : null,
    medianWarningsToSaveMs: warningsToSave.length > 0 ? median(warningsToSave) : null,
    medianLinkToSaveMs: linkToSave.length > 0 ? median(linkToSave) : null,
    recent: history.slice(-5).reverse(),
  };
}

export function exportWorkflowSessionsCsv(records: WorkflowSessionRecord[] = loadHistory()): string {
  const header = [
    'session_id',
    'started_at',
    'warnings_viewed_at',
    'saved_at',
    'link_to_warnings_ms',
    'warnings_to_save_ms',
    'link_to_save_ms',
    'hard_warnings_start',
    'soft_warnings_start',
    'unassigned_start',
    'hard_warnings_save',
    'soft_warnings_save',
    'unassigned_save',
    'coverage_save',
    'fairness_save',
    'export_type',
    'file_name',
  ].join(',');

  const body = records
    .map((entry) => {
      const fields = [
        entry.id,
        entry.startedAt,
        entry.warningsAt ?? '',
        entry.savedAt,
        toCsvNumber(entry.linkToWarningsMs),
        toCsvNumber(entry.warningsToSaveMs),
        toCsvNumber(entry.linkToSaveMs),
        String(entry.summary.hardWarnings),
        String(entry.summary.softWarnings),
        String(entry.summary.unassigned),
        String(entry.saveSummary.hardWarnings),
        String(entry.saveSummary.softWarnings),
        String(entry.saveSummary.unassigned),
        entry.saveSummary.coveragePercentage !== undefined ? String(entry.saveSummary.coveragePercentage) : '',
        entry.saveSummary.fairnessScore !== undefined ? String(entry.saveSummary.fairnessScore) : '',
        entry.context.exportType,
        entry.context.fileName ?? '',
      ];
      return fields.map(csvEscape).join(',');
    })
    .join('\n');

  return [header, body].filter(Boolean).join('\n');
}

export function subscribeWorkflowTelemetry(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearWorkflowTelemetry(): void {
  saveHistory([]);
  saveCurrentSession(null);
  notify();
}

function hasActiveWarnings(summary: WorkflowSummary): boolean {
  return summary.hardWarnings + summary.softWarnings > 0 || summary.unassigned > 0;
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function diffMs(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return 0;
  }
  return Math.max(0, to - from);
}

function toCsvNumber(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  return String(value);
}

function csvEscape(value: string): string {
  if (value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  if (value.includes(',') || value.includes('\n')) {
    return `"${value}"`;
  }
  return value;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // no-op
    }
  }
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadHistory(): WorkflowSessionRecord[] {
  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as WorkflowSessionRecord[]) : [];
    } catch {
      return [];
    }
  }
  const store = (globalThis as Record<string, unknown>)[GLOBAL_HISTORY_KEY];
  return Array.isArray(store) ? (store as WorkflowSessionRecord[]) : [];
}

function saveHistory(records: WorkflowSessionRecord[]): void {
  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
      return;
    } catch {
      // ignore write failure
    }
  }
  (globalThis as Record<string, unknown>)[GLOBAL_HISTORY_KEY] = records;
}

function loadCurrentSession(): WorkflowSessionState | null {
  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as WorkflowSessionState;
      }
    } catch {
      return null;
    }
  }
  const store = (globalThis as Record<string, unknown>)[GLOBAL_SESSION_KEY];
  return store && typeof store === 'object' ? (store as WorkflowSessionState) : null;
}

function saveCurrentSession(state: WorkflowSessionState | null): void {
  if (hasLocalStorage()) {
    try {
      if (!state) {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
      }
      return;
    } catch {
      // ignore write failure
    }
  }
  if (!state) {
    delete (globalThis as Record<string, unknown>)[GLOBAL_SESSION_KEY];
  } else {
    (globalThis as Record<string, unknown>)[GLOBAL_SESSION_KEY] = state;
  }
}
