/**
 * src/services/import/gtfsParser.ts
 * Parses GTFS ZIP archives (stops/trips/stop_times/shapes) and derives summary metrics.
 * Keeps parsing synchronous per file to simplify error handling while returning structured results.
 */
import JSZip from 'jszip';
import Papa from 'papaparse';

const REQUIRED_FILES = ['stops.txt', 'trips.txt', 'stop_times.txt'] as const;
const OPTIONAL_FILES = ['shapes.txt'] as const;

export interface GtfsTable {
  name: string;
  rows: Record<string, string>[];
}

export interface GtfsImportSummaryItem {
  metric: string;
  value: number;
  description: string;
}

export interface GtfsImportResult {
  tables: Record<string, GtfsTable>;
  missingFiles: string[];
  summary: GtfsImportSummaryItem[];
  alerts: string[];
  sourceName: string;
  importedAt: Date;
}

export class GtfsImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GtfsImportError';
  }
}

export async function parseGtfsArchive(file: File | Blob): Promise<GtfsImportResult> {
  const zip = await loadZip(file);
  const missingFiles: string[] = [];
  const tables: Record<string, GtfsTable> = {};

  for (const filename of REQUIRED_FILES) {
    const table = await loadTable(zip, filename);
    if (!table) {
      missingFiles.push(filename);
      continue;
    }
    tables[filename] = table;
  }

  for (const filename of OPTIONAL_FILES) {
    const table = await loadTable(zip, filename);
    if (!table) {
      missingFiles.push(filename);
      continue;
    }
    tables[filename] = table;
  }

  // Detect but do not require frequencies.txt; if present we will warn the user.
  const frequencies = await loadTable(zip, 'frequencies.txt');
  if (frequencies) {
    tables['frequencies.txt'] = frequencies;
  }

  if (missingFiles.some((filename) => REQUIRED_FILES.includes(filename as typeof REQUIRED_FILES[number]))) {
    throw new GtfsImportError(`必須ファイルが不足しています: ${missingFiles.join(', ')}`);
  }

  const baseSummary = buildSummary(tables);
  const { alerts, extraSummary } = buildAlertsAndAugments(tables);
  const summary = [...baseSummary, ...extraSummary];

  return {
    tables,
    missingFiles: missingFiles.filter((name) => OPTIONAL_FILES.includes(name as typeof OPTIONAL_FILES[number])),
    summary,
    alerts,
    sourceName: getFileName(file),
    importedAt: new Date(),
  };
}

async function loadZip(file: File | Blob): Promise<JSZip> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await JSZip.loadAsync(arrayBuffer);
  } catch (error) {
    throw new GtfsImportError('ZIPファイルの読み込みに失敗しました。ファイルが破損していないか確認してください。');
  }
}

async function loadTable(zip: JSZip, filename: string): Promise<GtfsTable | null> {
  const entry = zip.file(filename);
  if (!entry) {
    return null;
  }

  try {
    const text = await entry.async('string');
    const rows = parseCsv(text);
    return { name: filename, rows };
  } catch (error) {
    throw new GtfsImportError(`${filename} の解析に失敗しました: ${(error as Error).message}`);
  }
}

function parseCsv(content: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(`${firstError.message} @ row ${firstError.row}`);
  }

  return result.data;
}

function buildSummary(tables: Record<string, GtfsTable>): GtfsImportSummaryItem[] {
  const stops = tables['stops.txt']?.rows ?? [];
  const trips = tables['trips.txt']?.rows ?? [];

  const routeIds = new Set<string>();
  const serviceIds = new Set<string>();

  for (const trip of trips) {
    if (trip.route_id) {
      routeIds.add(trip.route_id);
    }
    if (trip.service_id) {
      serviceIds.add(trip.service_id);
    }
  }

  return [
    {
      metric: 'Stops',
      value: stops.length,
      description: '停留所（stops.txt 行数）',
    },
    {
      metric: 'Trips',
      value: trips.length,
      description: '便数（trips.txt 行数）',
    },
    {
      metric: 'Routes',
      value: routeIds.size,
      description: '路線数（route_id のユニーク数）',
    },
    {
      metric: 'Service IDs',
      value: serviceIds.size,
      description: 'サービス日（service_id のユニーク数）',
    },
  ];
}

function getFileName(file: File | Blob): string {
  if ('name' in file && file.name) {
    return file.name;
  }
  return 'GTFS.zip';
}

// Additional detection for strong warnings and extra summary items
function buildAlertsAndAugments(tables: Record<string, GtfsTable>): { alerts: string[]; extraSummary: GtfsImportSummaryItem[] } {
  const alerts: string[] = [];
  const extraSummary: GtfsImportSummaryItem[] = [];

  const frequencies = tables['frequencies.txt']?.rows ?? [];
  if (frequencies.length > 0) {
    extraSummary.push({ metric: 'Frequencies', value: frequencies.length, description: 'frequencies.txt の行数' });
    alerts.push('frequencies.txt を検出: 等間隔運行は連結/拘束計算前に静的便へ展開が必要（現状は未展開）。');
  }

  const stopTimes = tables['stop_times.txt']?.rows ?? [];
  let over24 = 0;
  for (const row of stopTimes) {
    const at = (row as any)['arrival_time'];
    const dt = (row as any)['departure_time'];
    if (isOver24Notation(at) || isOver24Notation(dt)) over24 += 1;
  }
  if (over24 > 0) {
    extraSummary.push({ metric: 'Stop times >24h', value: over24, description: 'HH>24 の時刻表記の行数' });
    alerts.push('stop_times.txt に 24時超の時刻表記（例: 25:10:00）を検出。日跨ぎ正規化が未実装のため、Duty計算が不正確の可能性。');
  }

  return { alerts, extraSummary };
}

function isOver24Notation(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = value.match(/^(\d{2,}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return false;
  const hh = Number(m[1]);
  return Number.isFinite(hh) && hh >= 24;
}
