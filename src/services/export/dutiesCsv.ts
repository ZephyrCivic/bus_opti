/**
 * src/services/export/dutiesCsv.ts
 * Builds Duties CSV content with export metadata and duty configuration hash.
 */
import type { Duty, DutySegment, DutySettings } from '@/types';
import { computeDutyMetrics, type BlockTripLookup } from '@/services/duty/dutyMetrics';

export interface BuildDutiesCsvOptions {
  generatedAt?: Date;
  dutySettings: DutySettings;
  tripLookup?: BlockTripLookup;
}

export interface DutiesCsvExport {
  csv: string;
  fileName: string;
  generatedAt: string;
  settingsHash: string;
  rowCount: number;
}

const FILE_NAME_PREFIX = 'duties';

export function buildDutiesCsv(duties: Duty[], options: BuildDutiesCsvOptions): DutiesCsvExport {
  const generatedAt = (options.generatedAt ?? new Date()).toISOString();
  const settingsHash = createSettingsHash(options.dutySettings);

  const header = [
    'duty_id',
    'seq',
    'block_id',
    'segment_start_trip_id',
    'segment_end_trip_id',
    'driver_id',
    'generated_at',
    'settings_hash',
    'violations_summary',
    'violations_hard',
    'violations_soft',
  ].join(',');

  const rows: string[] = [];
  for (const duty of duties) {
    const driverId = duty.driverId ?? '';
    const segments = sortSegments(duty.segments);
    const dutyWarnings = summarizeDutyWarnings(duty, options.tripLookup, options.dutySettings);
    const violationsSummary = `H:${dutyWarnings.critical};S:${dutyWarnings.warn}`;
    segments.forEach((segment, index) => {
      rows.push(
        [
          duty.id,
          String(index + 1),
          segment.blockId,
          segment.startTripId,
          segment.endTripId,
          driverId,
          generatedAt,
          settingsHash,
          violationsSummary,
          String(dutyWarnings.critical),
          String(dutyWarnings.warn),
        ].map(csvEscape).join(','),
      );
    });

    if (segments.length === 0) {
      rows.push(
        [
          duty.id,
          '1',
          '',
          '',
          '',
          driverId,
          generatedAt,
          settingsHash,
          violationsSummary,
          String(dutyWarnings.critical),
          String(dutyWarnings.warn),
        ].map(csvEscape).join(','),
      );
    }
  }

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

function sortSegments(segments: DutySegment[]): DutySegment[] {
  return segments.slice().sort((a, b) => {
    if (a.startSequence !== b.startSequence) {
      return a.startSequence - b.startSequence;
    }
    return a.id.localeCompare(b.id);
  });
}

function createSettingsHash(settings: DutySettings): string {
  const payload = JSON.stringify({
    maxContinuousMinutes: settings.maxContinuousMinutes,
    minBreakMinutes: settings.minBreakMinutes,
    maxDailyMinutes: settings.maxDailyMinutes,
    undoStackLimit: settings.undoStackLimit,
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
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return iso.replace(/[^0-9]+/g, '').slice(0, 14) || 'duties';
  }
  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

interface DutyWarningCounts {
  critical: number;
  warn: number;
  info: number;
}

function summarizeDutyWarnings(
  duty: Duty,
  lookup: BlockTripLookup | undefined,
  settings: DutySettings,
): DutyWarningCounts {
  if (!lookup) {
    return { critical: 0, warn: 0, info: 0 };
  }
  const metrics = computeDutyMetrics(duty, lookup, settings);
  const critical =
    (metrics.warnings.exceedsContinuous ? 1 : 0) +
    (metrics.warnings.exceedsDailySpan ? 1 : 0);
  const warn = metrics.warnings.insufficientBreak ? 1 : 0;
  return { critical, warn, info: 0 };
}


