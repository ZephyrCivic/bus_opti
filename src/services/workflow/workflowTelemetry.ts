/**
 * src/services/workflow/workflowTelemetry.ts
 * Step1 ではワークフロー計測を行わないため、各関数は no-op として振る舞う。
 */

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

const EMPTY_STATS: WorkflowStats = {
  total: 0,
  medianLinkToWarningsMs: null,
  medianWarningsToSaveMs: null,
  medianLinkToSaveMs: null,
  recent: [],
};

const CSV_HEADER = [
  'session_id',
  'started_at',
  'warnings_at',
  'saved_at',
  'link_to_warnings_ms',
  'warnings_to_save_ms',
  'link_to_save_ms',
  'hard_warnings',
  'soft_warnings',
  'unassigned',
  'coverage_percentage',
  'fairness_score',
  'export_type',
  'export_file_name',
].join(',');

export function ensureWorkflowSession(_summary: WorkflowSummary): void {
  // Step1 では計測しない
}

export function markWorkflowWarningsViewed(_summary: WorkflowSummary): void {
  // Step1 では計測しない
}

export function completeWorkflowSave(_summary: WorkflowSummary, _context: WorkflowSaveContext): void {
  // Step1 では計測しない
}

export function getWorkflowSessions(): WorkflowSessionRecord[] {
  return [];
}

export function getWorkflowStats(): WorkflowStats {
  return EMPTY_STATS;
}

export function exportWorkflowSessionsCsv(_records: WorkflowSessionRecord[] = []): string {
  return `${CSV_HEADER}\n`;
}

export function subscribeWorkflowTelemetry(_listener: () => void): () => void {
  return () => {
    // no-op
  };
}

export function clearWorkflowTelemetry(): void {
  // Step1 では計測しない
}
