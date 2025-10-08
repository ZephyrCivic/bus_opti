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

/**
 * FrequencyExpansionInfo
 * Reports the outcome of frequencies.txt expansion into concrete trips.
 */
export interface FrequencyExpansionInfo {
  templateTrips: number;
  generatedTrips: number;
  warnings: string[];
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

  const frequencyInfo = expandFrequenciesInTables(tables);

  const baseSummary = buildSummary(tables);
  const { alerts, extraSummary } = buildAlertsAndAugments(tables, frequencyInfo);
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

function sanitizeTripId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toPositiveInteger(value: unknown): number | null {
  const numeric = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function parseTimeToSeconds(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function formatSeconds(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? -1 : 1;
  const absSeconds = Math.max(0, Math.floor(Math.abs(totalSeconds)));
  const hours = Math.floor(absSeconds / 3600) * sign;
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;
  const hh = String(Math.abs(hours)).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hours < 0 ? '-' : ''}${hh}:${mm}:${ss}`;
}

function findBaseStartSeconds(stopTimes: Record<string, string>[]): number | null {
  for (const row of stopTimes) {
    const departure = parseTimeToSeconds(row['departure_time']);
    const arrival = parseTimeToSeconds(row['arrival_time']);
    if (departure !== null) {
      return departure;
    }
    if (arrival !== null) {
      return arrival;
    }
  }
  return null;
}

function cloneStopTimeRow(
  template: Record<string, string>,
  tripId: string,
  offsetSeconds: number,
  warnings: string[],
): Record<string, string> {
  const clone: Record<string, string> = { ...template, trip_id: tripId };
  const arrival = parseTimeToSeconds(template['arrival_time']);
  if (arrival !== null) {
    const shifted = arrival + offsetSeconds;
    if (shifted < 0) {
      warnings.push(`trip_id=${tripId} の arrival_time が負の時刻になりました。0に切り上げました。`);
      clone['arrival_time'] = formatSeconds(0);
    } else {
      clone['arrival_time'] = formatSeconds(shifted);
    }
  }

  const departure = parseTimeToSeconds(template['departure_time']);
  if (departure !== null) {
    const shifted = departure + offsetSeconds;
    if (shifted < 0) {
      warnings.push(`trip_id=${tripId} の departure_time が負の時刻になりました。0に切り上げました。`);
      clone['departure_time'] = formatSeconds(0);
    } else {
      clone['departure_time'] = formatSeconds(shifted);
    }
  }

  return clone;
}

export function expandFrequenciesInTables(tables: Record<string, GtfsTable>): FrequencyExpansionInfo {
  const frequenciesTable = tables['frequencies.txt'];
  const tripsTable = tables['trips.txt'];
  const stopTimesTable = tables['stop_times.txt'];

  if (!frequenciesTable || frequenciesTable.rows.length === 0 || !tripsTable || !stopTimesTable) {
    return { templateTrips: 0, generatedTrips: 0, warnings: [] };
  }

  const warnings: string[] = [];
  const templateTripIds = new Set<string>();

  for (const row of frequenciesTable.rows) {
    const tripId = sanitizeTripId(row.trip_id);
    if (tripId) {
      templateTripIds.add(tripId);
    } else {
      warnings.push('frequencies.txt の行に trip_id がありません。');
    }
  }

  if (templateTripIds.size === 0) {
    return { templateTrips: 0, generatedTrips: 0, warnings };
  }

  const baseTripRows = new Map<string, Record<string, string>>();
  const remainingTrips: Record<string, string>[] = [];
  for (const row of tripsTable.rows) {
    const tripId = sanitizeTripId(row.trip_id);
    if (tripId && templateTripIds.has(tripId)) {
      baseTripRows.set(tripId, row);
    } else {
      remainingTrips.push(row);
    }
  }

  const baseStopTimes = new Map<string, Record<string, string>[]>(); // sorted by stop_sequence later
  const remainingStopTimes: Record<string, string>[] = [];
  for (const row of stopTimesTable.rows) {
    const tripId = sanitizeTripId(row.trip_id);
    if (tripId && templateTripIds.has(tripId)) {
      const collection = baseStopTimes.get(tripId) ?? [];
      collection.push(row);
      baseStopTimes.set(tripId, collection);
    } else {
      remainingStopTimes.push(row);
    }
  }

  const generatedTrips: Record<string, string>[] = [];
  const generatedStopTimes: Record<string, string>[] = [];
  const cloneCounters = new Map<string, number>();
  const generatedPerTrip = new Map<string, number>();

  for (const row of frequenciesTable.rows) {
    const tripId = sanitizeTripId(row.trip_id);
    if (!tripId) {
      continue;
    }
    const baseTrip = baseTripRows.get(tripId);
    if (!baseTrip) {
      warnings.push(`frequencies.txt: trip_id=${tripId} に対応する trips.txt 行が見つかりません。`);
      continue;
    }
    const templateStopTimes = baseStopTimes.get(tripId);
    if (!templateStopTimes || templateStopTimes.length === 0) {
      warnings.push(`frequencies.txt: trip_id=${tripId} に対応する stop_times が見つかりません。`);
      continue;
    }

    const headwaySeconds = toPositiveInteger(row.headway_secs);
    if (headwaySeconds === null) {
      warnings.push(`frequencies.txt: trip_id=${tripId} の headway_secs が不正です。`);
      continue;
    }

    const startSeconds = parseTimeToSeconds(row.start_time);
    const endSeconds = parseTimeToSeconds(row.end_time);
    if (startSeconds === null || endSeconds === null) {
      warnings.push(`frequencies.txt: trip_id=${tripId} の start_time/end_time が不正です。`);
      continue;
    }
    if (endSeconds <= startSeconds) {
      warnings.push(`frequencies.txt: trip_id=${tripId} の end_time は start_time より後でなければなりません。`);
      continue;
    }

    const sortedTemplateStops = templateStopTimes
      .slice()
      .sort((a, b) => {
        const seqA = Number.parseInt(String(a.stop_sequence ?? '0'), 10);
        const seqB = Number.parseInt(String(b.stop_sequence ?? '0'), 10);
        return (Number.isFinite(seqA) ? seqA : 0) - (Number.isFinite(seqB) ? seqB : 0);
      });

    const baseStartSeconds = findBaseStartSeconds(sortedTemplateStops);
    if (baseStartSeconds === null) {
      warnings.push(`frequencies.txt: trip_id=${tripId} の stop_times に有効な出発時刻がありません。`);
      continue;
    }

    let iterationStart = startSeconds;
    while (iterationStart < endSeconds) {
      const cloneIndex = cloneCounters.get(tripId) ?? 0;
      const cloneTripId = `${tripId}#${cloneIndex}`;
      cloneCounters.set(tripId, cloneIndex + 1);

      generatedTrips.push({ ...baseTrip, trip_id: cloneTripId });
      generatedPerTrip.set(tripId, (generatedPerTrip.get(tripId) ?? 0) + 1);

      const offsetSeconds = iterationStart - baseStartSeconds;
      for (const stopRow of sortedTemplateStops) {
        generatedStopTimes.push(cloneStopTimeRow(stopRow, cloneTripId, offsetSeconds, warnings));
      }

      iterationStart += headwaySeconds;
    }
  }

  for (const tripId of templateTripIds) {
    if ((generatedPerTrip.get(tripId) ?? 0) === 0) {
      const trip = baseTripRows.get(tripId);
      if (trip) {
        remainingTrips.push(trip);
      }
      const stops = baseStopTimes.get(tripId);
      if (stops) {
        remainingStopTimes.push(...stops);
      }
    }
  }

  tripsTable.rows = [...remainingTrips, ...generatedTrips];
  stopTimesTable.rows = [...remainingStopTimes, ...generatedStopTimes];

  return {
    templateTrips: baseTripRows.size,
    generatedTrips: generatedTrips.length,
    warnings,
  };
}
// Additional detection for strong warnings and extra summary items
function buildAlertsAndAugments(
  tables: Record<string, GtfsTable>,
  frequencyInfo?: FrequencyExpansionInfo,
): { alerts: string[]; extraSummary: GtfsImportSummaryItem[] } {
  const alerts: string[] = [...(frequencyInfo?.warnings ?? [])];
  const extraSummary: GtfsImportSummaryItem[] = [];

  const frequencies = tables['frequencies.txt']?.rows ?? [];
  if (frequencies.length > 0) {
    extraSummary.push({ metric: 'Frequencies rows', value: frequencies.length, description: 'frequencies.txt の行数' });
  }
  if (frequencyInfo) {
    if (frequencyInfo.generatedTrips > 0) {
      extraSummary.push({
        metric: 'Frequencies expanded',
        value: frequencyInfo.generatedTrips,
        description: `${frequencyInfo.templateTrips} 件のテンプレート trip から生成した静的便数`,
      });
    } else if (frequencies.length > 0 && frequencyInfo.templateTrips === 0) {
      alerts.push('frequencies.txt を検出しましたが、対応する trips/stop_times が見つからず展開できませんでした。');
    }
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
    alerts.push('stop_times.txt に 24時超の時刻表記（例: 25:10:00）を検出。アプリ側で日跨ぎ時刻を 24:00 形式へ正規化済みです。');
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
