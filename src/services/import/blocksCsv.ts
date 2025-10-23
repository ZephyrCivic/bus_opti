/**
 * src/services/import/blocksCsv.ts
 * Parses Blocks CSV exports back into BlockPlan structures for round-trip workflows.
 */
import Papa from 'papaparse';

import {
  type BlockCsvRow,
  type BlockPlan,
  type BlockSummary,
  type BlockWarningCounts,
  DEFAULT_MAX_TURN_GAP_MINUTES,
} from '@/services/blocks/blockBuilder';

export interface ParsedBlocksCsv {
  plan: BlockPlan;
  generatedAt?: string;
  settingsHash?: string;
}

export function parseBlocksCsv(csv: string): ParsedBlocksCsv {
  const result = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'Blocks CSV の解析に失敗しました。');
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  if (rows.length === 0) {
    return {
      plan: {
        summaries: [],
        csvRows: [],
        unassignedTripIds: [],
        totalTripCount: 0,
        assignedTripCount: 0,
        coverageRatio: 0,
        maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES,
      },
    };
  }

  const csvRows: BlockCsvRow[] = [];
  const warningCounts = new Map<string, BlockWarningCounts>();
  let generatedAt: string | undefined;
  let settingsHash: string | undefined;

  for (const raw of rows) {
    const blockId = requireString(raw.block_id, 'block_id');
    const seq = parsePositiveInteger(raw.seq, 'seq');
    const tripId = requireString(raw.trip_id, 'trip_id');
    const tripStart = requireString(raw.trip_start, 'trip_start');
    const tripEnd = requireString(raw.trip_end, 'trip_end');

    const row: BlockCsvRow = {
      blockId,
      seq,
      tripId,
      tripStart,
      tripEnd,
      fromStopId: optionalString(raw.from_stop_id),
      toStopId: optionalString(raw.to_stop_id),
      serviceId: optionalString(raw.service_id),
    };
    csvRows.push(row);

    if (generatedAt === undefined) {
      generatedAt = optionalString(raw.generated_at) ?? undefined;
    }
    if (settingsHash === undefined) {
      settingsHash = optionalString(raw.settings_hash) ?? undefined;
    }

    const hard = parseInteger(raw.violations_hard);
    const soft = parseInteger(raw.violations_soft);
    warningCounts.set(blockId, {
      critical: hard,
      warn: soft,
      info: 0,
    });
  }

  csvRows.sort((a, b) => (a.blockId === b.blockId ? a.seq - b.seq : a.blockId.localeCompare(b.blockId)));

  const summaries = buildSummaries(csvRows, warningCounts);

  return {
    plan: {
      summaries,
      csvRows,
      unassignedTripIds: [],
      totalTripCount: csvRows.length,
      assignedTripCount: csvRows.length,
      coverageRatio: csvRows.length === 0 ? 0 : 1,
      maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES,
    },
    generatedAt,
    settingsHash,
  };
}

function buildSummaries(
  rows: BlockCsvRow[],
  warningCounts: Map<string, BlockWarningCounts>,
): BlockSummary[] {
  const byBlock = new Map<string, BlockCsvRow[]>();
  for (const row of rows) {
    const list = byBlock.get(row.blockId) ?? [];
    list.push(row);
    byBlock.set(row.blockId, list);
  }

  const summaries: BlockSummary[] = [];
  for (const [blockId, group] of byBlock.entries()) {
    const sorted = group.slice().sort((a, b) => a.seq - b.seq);
    const gaps: number[] = [];
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      const previousEnd = toMinutes(previous.tripEnd);
      const currentStart = toMinutes(current.tripStart);
      if (previousEnd !== undefined && currentStart !== undefined) {
        const gap = currentStart - previousEnd;
        if (gap >= 0) {
          gaps.push(gap);
        }
      }
    }

    const warnings = warningCounts.get(blockId) ?? { critical: 0, warn: 0, info: 0 };

    summaries.push({
      blockId,
      serviceId: sorted[0]?.serviceId,
      serviceDayIndex: 0,
      tripCount: sorted.length,
      firstTripStart: sorted[0]?.tripStart ?? '',
      lastTripEnd: sorted.at(-1)?.tripEnd ?? '',
      gaps,
      overlapScore: gaps.length > 0 ? Number((gaps.reduce((acc, value) => acc + value, 0) / gaps.length).toFixed(2)) : 0,
      gapWarnings: warnings.warn,
      warningCounts: warnings,
      warnings: [],
    });
  }

  summaries.sort((a, b) => a.blockId.localeCompare(b.blockId));
  return summaries;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function requireString(value: unknown, field: string): string {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${field} 列が空です。`);
  }
  return normalized;
}

function parsePositiveInteger(value: unknown, field: string): number {
  const numeric = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(numeric) || numeric < 1) {
    throw new Error(`${field} 列は 1以上の整数である必要があります。`);
  }
  return numeric;
}

function parseInteger(value: unknown): number {
  const numeric = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toMinutes(label: string | undefined): number | undefined {
  if (!label) {
    return undefined;
  }
  const match = label.match(/^(\d+):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }
  return hours * 60 + minutes;
}
