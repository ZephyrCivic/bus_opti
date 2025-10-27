/**
 * src/services/import/gtfsPersistence.ts
 * Serialize/deserialize GTFS import results for manual save/load.
 * Keep schema simple and versioned to allow future changes.
 */
import type { GtfsImportResult, GtfsTable } from './gtfsParser';
import type { ManualInputs } from '@/types';

export interface SavedGtfsImportV1 {
  version: 1;
  sourceName: string;
  importedAt: string; // ISO string
  tables: Record<string, { name: string; rows: Record<string, string>[] }>;
  missingFiles: string[];
  summary: { metric: string; value: number; description: string }[];
  alerts?: string[];
}

export type SavedGtfsImport = SavedGtfsImportV1;

export function toSaved(result: GtfsImportResult): SavedGtfsImportV1 {
  const { sourceName, importedAt, tables, missingFiles, summary, alerts } = result;
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
    alerts: alerts ? [...alerts] : undefined,
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
    alerts: saved.alerts ?? [],
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

// ---- Project-level save (GTFS + manual inputs) ----
export interface SavedProjectV1 {
  projectVersion: 1;
  gtfs: SavedGtfsImportV1;
  manual: ManualInputs;
}

export type SavedProject = SavedProjectV1 | SavedGtfsImportV1; // allow legacy GTFS-only JSON

export function toSavedProject(gtfs: GtfsImportResult, manual: ManualInputs): SavedProjectV1 {
  return { projectVersion: 1, gtfs: toSaved(gtfs), manual };
}

export function fromSavedProject(payload: unknown): { gtfs: GtfsImportResult; manual: ManualInputs } {
  const defaultManual: ManualInputs = {
    depots: [],
    reliefPoints: [],
    deadheadRules: [],
    drivers: [],
    laborRules: [],
    vehicleTypes: [],
    vehicles: [],
    blockMeta: {},
    linking: { enabled: true, minTurnaroundMin: 10, maxConnectRadiusM: 100, allowParentStation: true },
  };
  const any = payload as any;
  // Legacy GTFS-only
  if (any && typeof any === 'object' && 'version' in any && !(any as any).projectVersion) {
    return { gtfs: fromSaved(any as SavedGtfsImportV1), manual: hydrateManual(undefined, defaultManual) };
  }
  if (any && typeof any === 'object' && (any as any).projectVersion === 1 && (any as any).gtfs) {
    const manual = (any as SavedProjectV1).manual;
    return { gtfs: fromSaved((any as SavedProjectV1).gtfs), manual: hydrateManual(manual, defaultManual) };
  }
  throw new Error('未対応の保存フォーマットです');
}

export function downloadProjectJson(saved: SavedProjectV1, fileName?: string): void {
  const source = saved.gtfs?.sourceName ?? 'project';
  const name = fileName ?? defaultFileName(source).replace('gtfs-import', 'project');
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function hydrateManual(manual: ManualInputs | undefined, defaults: ManualInputs): ManualInputs {
  const baseLinking = { ...defaults.linking };
  if (!manual) {
    return {
      depots: [],
      reliefPoints: [],
      deadheadRules: [],
      drivers: [],
      laborRules: [],
      vehicleTypes: [],
      vehicles: [],
      blockMeta: {},
      linking: baseLinking,
    };
  }
  return {
    depots: manual.depots ? [...manual.depots] : [],
    reliefPoints: manual.reliefPoints ? [...manual.reliefPoints] : [],
    deadheadRules: manual.deadheadRules ? [...manual.deadheadRules] : [],
    drivers: manual.drivers ? [...manual.drivers] : [],
    laborRules: manual.laborRules ? [...manual.laborRules] : [],
    vehicleTypes: manual.vehicleTypes ? [...manual.vehicleTypes] : [],
    vehicles: manual.vehicles ? [...manual.vehicles] : [],
    blockMeta: manual.blockMeta ? { ...manual.blockMeta } : {},
    linking: manual.linking ? { ...manual.linking } : baseLinking,
  };
}
