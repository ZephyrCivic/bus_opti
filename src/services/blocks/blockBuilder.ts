/**
 * src/services/blocks/blockBuilder.ts
 * Builds Greedy block assignments from GTFS trips/stop_times with configurable turn gaps.
 */
import type { GtfsImportResult, GtfsTable } from '../import/gtfsParser';

export interface BlockCsvRow {
  blockId: string;
  seq: number;
  tripId: string;
  tripStart: string;
  tripEnd: string;
  fromStopId?: string;
  toStopId?: string;
  serviceId?: string;
}

export interface BlockSummary {
  blockId: string;
  serviceId?: string;
  serviceDayIndex: number;
  tripCount: number;
  firstTripStart: string;
  lastTripEnd: string;
  gaps: number[];
  overlapScore?: number;
  gapWarnings?: number;
}

export interface BlockPlan {
  summaries: BlockSummary[];
  csvRows: BlockCsvRow[];
  unassignedTripIds: string[];
  totalTripCount: number;
  assignedTripCount: number;
  coverageRatio: number;
  maxTurnGapMinutes: number;
}

export interface BuildBlocksOptions {
  maxTurnGapMinutes?: number;
  linkingEnabled?: boolean;
}

export const DEFAULT_MAX_TURN_GAP_MINUTES = 15;

interface TripSchedule {
  tripId: string;
  serviceId?: string;
  serviceDayIndex: number;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  fromStopId?: string;
  toStopId?: string;
}

interface StopTimeRow {
  sequence: number;
  arrival: number | null;
  departure: number | null;
  stopId?: string;
}

interface OpenBlock {
  summary: BlockSummary;
  lastEndMinutes: number;
}

export function buildBlocksPlan(result?: GtfsImportResult, options?: BuildBlocksOptions): BlockPlan {
  const maxTurnGapMinutes = Math.max(0, options?.maxTurnGapMinutes ?? DEFAULT_MAX_TURN_GAP_MINUTES);
  const linkingEnabled = options?.linkingEnabled ?? true;

  if (!result) {
    return emptyPlan(maxTurnGapMinutes);
  }

  const tripsTable = result.tables['trips.txt'];
  const stopTimesTable = result.tables['stop_times.txt'];

  if (!tripsTable || !stopTimesTable) {
    return emptyPlan(maxTurnGapMinutes);
  }

  const tripServiceMap = buildTripServiceMap(tripsTable);
  const stopTimesByTrip = groupStopTimesByTrip(stopTimesTable);

  const schedules: TripSchedule[] = [];
  for (const [tripId, rows] of stopTimesByTrip) {
    const schedule = buildTripSchedule(tripId, rows, tripServiceMap.get(tripId));
    if (schedule) {
      schedules.push(schedule);
    }
  }

  schedules.sort((a, b) => a.startMinutes - b.startMinutes || a.tripId.localeCompare(b.tripId));

  const csvRows: BlockCsvRow[] = [];
  const summaries: BlockSummary[] = [];
  const unassignedTripIds: string[] = [];
  const openBlocks: OpenBlock[] = [];

  for (const schedule of schedules) {
    const candidate = linkingEnabled ? findAttachableBlock(openBlocks, schedule, maxTurnGapMinutes) : null;
    if (candidate) {
      attachTrip(candidate, schedule, csvRows);
      continue;
    }
    createNewBlock(openBlocks, summaries, schedule, csvRows);
  }

  const assignedTripIds = new Set(csvRows.map((row) => row.tripId));
  for (const schedule of schedules) {
    if (!assignedTripIds.has(schedule.tripId)) {
      unassignedTripIds.push(schedule.tripId);
    }
  }

  const assignedTripCount = assignedTripIds.size;
  const totalTripCount = schedules.length;
  const coverageRatio = totalTripCount === 0 ? 0 : assignedTripCount / totalTripCount;

  return {
    summaries,
    csvRows,
    unassignedTripIds,
    totalTripCount,
    assignedTripCount,
    coverageRatio,
    maxTurnGapMinutes,
  };
}

function emptyPlan(maxTurnGapMinutes: number): BlockPlan {
  return {
    summaries: [],
    csvRows: [],
    unassignedTripIds: [],
    totalTripCount: 0,
    assignedTripCount: 0,
    coverageRatio: 0,
    maxTurnGapMinutes,
  };
}

function buildTripServiceMap(tripsTable: GtfsTable): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>();
  for (const row of tripsTable.rows) {
    const tripId = sanitizeId(row.trip_id);
    if (!tripId) {
      continue;
    }
    const serviceId = sanitizeId(row.service_id) ?? undefined;
    map.set(tripId, serviceId);
  }
  return map;
}

function groupStopTimesByTrip(table: GtfsTable): Map<string, StopTimeRow[]> {
  const grouped = new Map<string, StopTimeRow[]>();
  for (const row of table.rows) {
    const tripId = sanitizeId(row.trip_id);
    if (!tripId) {
      continue;
    }
    const sequence = toNumber(row.stop_sequence) ?? Number.POSITIVE_INFINITY;
    const arrival = parseGtfsTime(row.arrival_time);
    const departure = parseGtfsTime(row.departure_time);
    const stopId = sanitizeId(row.stop_id) ?? undefined;
    const rows = grouped.get(tripId) ?? [];
    rows.push({ sequence, arrival, departure, stopId });
    grouped.set(tripId, rows);
  }
  return grouped;
}

function buildTripSchedule(tripId: string, rows: StopTimeRow[], serviceId?: string): TripSchedule | null {
  if (rows.length === 0) {
    return null;
  }
  const sorted = rows.slice().sort((a, b) => a.sequence - b.sequence);
  const normalized = normalizeStopTimeRows(sorted);

  const first = normalized.find((row) => row.departure !== null || row.arrival !== null);
  const last = [...normalized].reverse().find((row) => row.arrival !== null || row.departure !== null);

  if (!first || !last) {
    return null;
  }

  const startMinutes = first.departure ?? first.arrival;
  const endMinutes = last.arrival ?? last.departure;

  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) {
    return null;
  }

  const serviceDayIndex = Math.floor(startMinutes / 1440);

  return {
    tripId,
    serviceId,
    serviceDayIndex,
    startMinutes,
    endMinutes,
    startTime: formatGtfsTime(startMinutes),
    endTime: formatGtfsTime(endMinutes),
    fromStopId: first.stopId,
    toStopId: last.stopId,
  };
}

function normalizeStopTimeRows(rows: StopTimeRow[]): StopTimeRow[] {
  let offset = 0;
  let lastSeen: number | null = null;

  const adjust = (value: number | null): number | null => {
    if (value === null) {
      return null;
    }
    let candidate = value + offset;
    if (lastSeen !== null && candidate < lastSeen) {
      offset += 1440;
      candidate = value + offset;
    }
    if (lastSeen === null || candidate > lastSeen) {
      lastSeen = candidate;
    }
    return candidate;
  };

  return rows.map((row) => {
    const arrival = adjust(row.arrival);
    const departure = adjust(row.departure);
    return {
      ...row,
      arrival,
      departure,
    };
  });
}
function findAttachableBlock(blocks: OpenBlock[], schedule: TripSchedule, maxTurnGapMinutes: number): OpenBlock | null {
  let best: OpenBlock | null = null;
  for (const block of blocks) {
    if (!isSameService(block.summary.serviceId, schedule.serviceId)) {
      continue;
    }
    if (block.summary.serviceDayIndex !== schedule.serviceDayIndex) {
      continue;
    }
    const gap = schedule.startMinutes - block.lastEndMinutes;
    if (gap < 0 || gap > maxTurnGapMinutes) {
      continue;
    }
    if (!best || gap < schedule.startMinutes - best.lastEndMinutes) {
      best = block;
    }
  }
  return best;
}

function attachTrip(block: OpenBlock, schedule: TripSchedule, csvRows: BlockCsvRow[]): void {
  const summary = block.summary;
  const seq = summary.tripCount + 1;
  const gap = schedule.startMinutes - block.lastEndMinutes;
  if (gap >= 0) {
    summary.gaps.push(gap);
  }
  summary.tripCount = seq;
  summary.lastTripEnd = schedule.endTime;
  updateSummaryOverlaps(summary, schedule.startMinutes, schedule.endMinutes);

  csvRows.push(makeCsvRow(summary.blockId, seq, schedule));

  block.lastEndMinutes = schedule.endMinutes;
}

function createNewBlock(blocks: OpenBlock[], summaries: BlockSummary[], schedule: TripSchedule, csvRows: BlockCsvRow[]): void {
  const blockId = formatBlockId(summaries.length + 1);
  const summary: BlockSummary = {
    blockId,
    serviceId: schedule.serviceId,
    serviceDayIndex: schedule.serviceDayIndex,
    tripCount: 0,
    firstTripStart: schedule.startTime,
    lastTripEnd: schedule.endTime,
    gaps: [],
  };

  const open: OpenBlock = {
    summary,
    lastEndMinutes: schedule.endMinutes,
  };

  summaries.push(summary);
  blocks.push(open);

  attachTrip(open, schedule, csvRows);
}

function updateSummaryOverlaps(summary: BlockSummary, startMinutes: number, endMinutes: number): void {
  const duration = Math.max(0, endMinutes - startMinutes);
  const gapWarnings = summary.gaps.filter((gap) => gap > 0).length;
  summary.gapWarnings = gapWarnings;
  if (duration === 0) {
    return;
  }
  const averageGap = summary.gaps.length > 0
    ? summary.gaps.reduce((acc, value) => acc + value, 0) / summary.gaps.length
    : 0;
  summary.overlapScore = Number(averageGap.toFixed(2));
}
function makeCsvRow(blockId: string, seq: number, schedule: TripSchedule): BlockCsvRow {
  return {
    blockId,
    seq,
    tripId: schedule.tripId,
    tripStart: schedule.startTime,
    tripEnd: schedule.endTime,
    fromStopId: schedule.fromStopId,
    toStopId: schedule.toStopId,
    serviceId: schedule.serviceId,
  };
}

function isSameService(a?: string, b?: string): boolean {
  if (!a || !b) {
    return !a && !b;
  }
  return a === b;
}

function sanitizeId(value: string | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGtfsTime(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = value.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return hours * 60 + minutes + Math.floor(seconds / 60);
}

function formatGtfsTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatBlockId(index: number): string {
  return `BLOCK_${String(index).padStart(3, '0')}`;
}
