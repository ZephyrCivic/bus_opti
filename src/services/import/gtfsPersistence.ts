/**
 * src/services/import/gtfsPersistence.ts
 * Serialize/deserialize GTFS import results for manual save/load.
 * Keep schema simple and versioned to allow future changes.
 */
import type { GtfsImportResult, GtfsTable } from './gtfsParser';

export interface SavedGtfsImportV1 {
  version: 1;
  sourceName: string;
  importedAt: string; // ISO string
  tables: Record<string, { name: string; rows: Record<string, string>[] }>;
  missingFiles: string[];
  summary: { metric: string; value: number; description: string }[];
}

export type SavedGtfsImport = SavedGtfsImportV1;

export function toSaved(result: GtfsImportResult): SavedGtfsImportV1 {
  const { sourceName, importedAt, tables, missingFiles, summary } = result;
  const safeTables: Record<string, GtfsTable> = {};
  for (const [k, v] of Object.entries(tables)) {
    safeTables[k] = { name: v.name, rows: v.rows };
  }
  return {
    version: 1,
    sourceName,
    importedAt: result.importedAt.toISOString(),
    tables: safeTables,
    missingFiles: [...missingFiles],
    summary: summary.map((s) => ({ metric: s.metric, value: s.value, description: s.description })),
  };
}

export function fromSaved(saved: SavedGtfsImport): GtfsImportResult {
  if (!saved || (saved as SavedGtfsImportV1).version !== 1) {
    throw new Error('未対応の保存形式です。');
  }
  return {
    tables: saved.tables,
    missingFiles: saved.missingFiles,
    summary: saved.summary,
    sourceName: saved.sourceName,
    importedAt: new Date(saved.importedAt),
  };
}

export function downloadSavedJson(saved: SavedGtfsImport, fileName?: string): void {
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? defaultFileName(saved.sourceName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function defaultFileName(sourceName?: string): string {
  const ts = new Date();
  const yyyy = ts.getFullYear();
  const mm = String(ts.getMonth() + 1).padStart(2, '0');
  const dd = String(ts.getDate()).padStart(2, '0');
  const hh = String(ts.getHours()).padStart(2, '0');
  const mi = String(ts.getMinutes()).padStart(2, '0');
  const base = (sourceName?.replace(/\.[^.]+$/, '') || 'gtfs-import').replace(/[^A-Za-z0-9_-]+/g, '-');
  return `${base}-${yyyy}${mm}${dd}-${hh}${mi}.json`;
}
