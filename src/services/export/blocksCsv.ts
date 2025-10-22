/**
 * src/services/export/blocksCsv.ts
 * Builds Blocks CSV content (header + rows) enriched with export metadata.
 */
import type { BlockPlan } from '@/services/blocks/blockBuilder';
import type { LinkingSettings } from '@/types';

export interface BuildBlocksCsvOptions {
  generatedAt?: Date;
  linking: LinkingSettings;
}

export interface BlocksCsvExport {
  csv: string;
  fileName: string;
  generatedAt: string;
  settingsHash: string;
  rowCount: number;
}

const FILE_NAME_PREFIX = 'blocks';

export function buildBlocksCsv(plan: BlockPlan, options: BuildBlocksCsvOptions): BlocksCsvExport {
  const generatedAt = (options.generatedAt ?? new Date()).toISOString();
  const settingsHash = createSettingsHash(plan, options.linking);
  const warningCountsByBlock = new Map(
    plan.summaries.map((summary) => [
      summary.blockId,
      summary.warningCounts ?? { critical: 0, warn: 0, info: 0 },
    ]),
  );

  const header = [
    'block_id',
    'seq',
    'trip_id',
    'trip_start',
    'trip_end',
    'from_stop_id',
    'to_stop_id',
    'service_id',
    'generated_at',
    'settings_hash',
    'violations_summary',
    'violations_hard',
    'violations_soft',
  ].join(',');

  const rows = plan.csvRows.map((row) => {
    const warningCounts = warningCountsByBlock.get(row.blockId) ?? { critical: 0, warn: 0, info: 0 };
    const violationsHard = warningCounts.critical ?? 0;
    const violationsSoft = warningCounts.warn ?? 0;
    const violationsSummary = `H:${violationsHard};S:${violationsSoft}`;
    const cells = [
      row.blockId,
      String(row.seq),
      row.tripId,
      row.tripStart,
      row.tripEnd,
      row.fromStopId ?? '',
      row.toStopId ?? '',
      row.serviceId ?? '',
      generatedAt,
      settingsHash,
      violationsSummary,
      String(violationsHard),
      String(violationsSoft),
    ];
    return cells.map(csvEscape).join(',');
  });

  const csv = [header, ...rows].join('\n');
  const fileName = `${FILE_NAME_PREFIX}-${formatTimestampForFileName(generatedAt)}.csv`;

  return {
    csv,
    fileName,
    generatedAt,
    settingsHash,
    rowCount: rows.length,
  };
}

function createSettingsHash(plan: BlockPlan, linking: LinkingSettings): string {
  const payload = JSON.stringify({
    maxTurnGapMinutes: plan.maxTurnGapMinutes,
    linking: {
      enabled: linking.enabled,
      minTurnaroundMin: linking.minTurnaroundMin,
      maxConnectRadiusM: linking.maxConnectRadiusM,
      allowParentStation: linking.allowParentStation,
    },
  });
  return hashString(payload);
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
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
  // iso expected e.g. 2025-10-07T12:34:56.789Z
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return iso.replace(/[^0-9]+/g, '').slice(0, 14) || 'export';
  }
  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function formatSettingsHash(plan: BlockPlan, linking: LinkingSettings): string {
  return createSettingsHash(plan, linking);
}
