/**
 * src/services/export/blocksIntervalsCsv.ts
 * Export helper for Blocks intervals (break/deadhead) anchored to trips.
 */

export type IntervalPosition = 'before' | 'after' | 'absolute';

export interface IntervalLike {
  id: string;
  kind: 'break' | 'deadhead';
  startMinutes: number; // [0, 24*60]
  endMinutes: number;   // > startMinutes
  anchorTripId?: string;
  position?: IntervalPosition;
  note?: string;
}

export interface BlocksIntervalsCsvExport {
  csv: string;
  fileName: string;
  generatedAt: string;
  rowCount: number;
}

export function buildBlocksIntervalsCsv(
  intervalsByBlock: Record<string, IntervalLike[]>,
  options?: { generatedAt?: Date },
): BlocksIntervalsCsvExport {
  const generatedAt = (options?.generatedAt ?? new Date()).toISOString();
  const header = [
    'block_id',
    'anchor_trip_id',
    'position',
    'kind',
    'start_time',
    'end_time',
    'note',
    'generated_at',
  ].join(',');

  const rows: string[] = [];
  for (const [blockId, list] of Object.entries(intervalsByBlock)) {
    for (const interval of list) {
      const cells = [
        blockId,
        interval.anchorTripId ?? '',
        interval.position ?? 'absolute',
        interval.kind,
        minutesToLabel(interval.startMinutes),
        minutesToLabel(interval.endMinutes),
        interval.note ?? '',
        generatedAt,
      ];
      rows.push(cells.map(csvEscape).join(','));
    }
  }

  const csv = [header, ...rows].join('\n');
  const fileName = `blocks_intervals-${formatTimestampForFileName(generatedAt)}.csv`;
  return { csv, fileName, generatedAt, rowCount: rows.length };
}

function minutesToLabel(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.floor(mins)));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
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

function formatTimestampForFileName(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return iso.replace(/[^0-9]+/g, '').slice(0, 14) || 'export';
  }
  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

