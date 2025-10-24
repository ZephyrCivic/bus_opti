/**
 * src/services/duty/dutyMetrics.ts
 * Duty KPI helper utilities to analyse DutyEditState segments against configuration limits.
 */
import type { Duty, DutySegment, DutySettings } from '@/types';
import type { BlockCsvRow } from '@/services/blocks/blockBuilder';

export interface DutyMetrics {
  totalSpanMinutes?: number;
  longestContinuousMinutes?: number;
  shortestBreakMinutes?: number | null;
  warnings: {
    exceedsDailySpan: boolean;
    exceedsContinuous: boolean;
    insufficientBreak: boolean;
  };
}

export type BlockTripLookup = Map<string, Map<string, BlockCsvRow>>;

export function buildTripLookup(rows: BlockCsvRow[]): BlockTripLookup {
  const lookup: BlockTripLookup = new Map();
  for (const row of rows) {
    const block = lookup.get(row.blockId) ?? new Map<string, BlockCsvRow>();
    block.set(row.tripId, row);
    lookup.set(row.blockId, block);
  }
  return lookup;
}

export function computeDutyMetrics(
  duty: Duty,
  lookup: BlockTripLookup,
  settings: DutySettings,
): DutyMetrics {
  const segmentsWithTiming = duty.segments
    .map((segment) => enrichSegmentTiming(segment, lookup))
    .filter((entry): entry is Required<EnrichedSegment> => entry.startMinutes !== undefined && entry.endMinutes !== undefined)
    .sort((a, b) => a.startSequence - b.startSequence);

  if (segmentsWithTiming.length === 0) {
    return {
      totalSpanMinutes: undefined,
      longestContinuousMinutes: undefined,
      shortestBreakMinutes: null,
      warnings: {
        exceedsDailySpan: false,
        exceedsContinuous: false,
        insufficientBreak: false,
      },
    };
  }

  let totalSpan: number | undefined =
    segmentsWithTiming[segmentsWithTiming.length - 1].endMinutes - segmentsWithTiming[0].startMinutes;
  if (typeof totalSpan === 'number' && totalSpan < 0) {
    totalSpan = undefined;
  }

  let longestContinuous = 0;
  let currentContinuous = 0;
  let shortestBreak: number | null = null;
  let lastEndMinutes: number | null = null;
  let lastKind: 'drive' | 'break' | null = null;

  for (const segment of segmentsWithTiming) {
    const kind = segment.kind ?? 'drive';
    const duration = segment.endMinutes - segment.startMinutes;
    if (kind === 'break') {
      if (duration >= 0) {
        if (shortestBreak === null || duration < shortestBreak) {
          shortestBreak = duration;
        }
      }
      currentContinuous = 0;
      lastEndMinutes = segment.endMinutes;
      lastKind = 'break';
      continue;
    }

    if (lastEndMinutes !== null) {
      const gap = segment.startMinutes - lastEndMinutes;
      if (gap > 0 && lastKind !== 'break') {
        if (shortestBreak === null || gap < shortestBreak) {
          shortestBreak = gap;
        }
        currentContinuous = 0;
      }
    }

    if (duration > 0) {
      currentContinuous += duration;
      if (currentContinuous > longestContinuous) {
        longestContinuous = currentContinuous;
      }
    }

    lastEndMinutes = segment.endMinutes;
    lastKind = 'drive';
  }

  const longestContinuousMinutes = longestContinuous > 0 ? longestContinuous : undefined;

  const warnings = {
    exceedsDailySpan: typeof totalSpan === 'number' ? totalSpan > settings.maxDailyMinutes : false,
    exceedsContinuous: typeof longestContinuousMinutes === 'number' ? longestContinuousMinutes > settings.maxContinuousMinutes : false,
    insufficientBreak:
      shortestBreak !== null && typeof shortestBreak === 'number'
        ? shortestBreak < settings.minBreakMinutes
        : false,
  };

  return {
    totalSpanMinutes: totalSpan,
    longestContinuousMinutes,
    shortestBreakMinutes: shortestBreak,
    warnings,
  };
}

interface EnrichedSegment extends DutySegment {
  startMinutes?: number;
  endMinutes?: number;
}

export function enrichSegmentTiming(segment: DutySegment, lookup: BlockTripLookup): EnrichedSegment {
  const kind = segment.kind ?? 'drive';
  const block = lookup.get(segment.blockId);

  if (kind === 'break') {
    const startTrip = block?.get(segment.startTripId);
    const resumeTrip = block?.get(segment.breakUntilTripId ?? segment.endTripId);
    return {
      ...segment,
      startMinutes: toMinutes(startTrip?.tripEnd),
      endMinutes: toMinutes(resumeTrip?.tripStart),
    };
  }

  if (kind === 'deadhead') {
    const startTrip = block?.get(segment.startTripId);
    const resumeTrip = block?.get(segment.endTripId);
    const startMinutes = toMinutes(startTrip?.tripEnd ?? startTrip?.tripStart);
    let endMinutes: number | undefined;
    if (typeof segment.deadheadMinutes === 'number' && startMinutes !== undefined) {
      endMinutes = startMinutes + segment.deadheadMinutes;
    } else {
      endMinutes = toMinutes(resumeTrip?.tripStart);
    }
    const normalizedMinutes =
      typeof segment.deadheadMinutes === 'number'
        ? segment.deadheadMinutes
        : startMinutes !== undefined && endMinutes !== undefined
          ? Math.max(endMinutes - startMinutes, 0)
          : undefined;
    return {
      ...segment,
      deadheadMinutes: normalizedMinutes,
      startMinutes,
      endMinutes,
    };
  }

  const startTrip = block?.get(segment.startTripId);
  const endTrip = block?.get(segment.endTripId);
  return {
    ...segment,
    startMinutes: toMinutes(startTrip?.tripStart),
    endMinutes: toMinutes(endTrip?.tripEnd),
  };
}

export function toMinutes(time?: string): number | undefined {
  if (!time) {
    return undefined;
  }
  const match = time.match(/^(\d+):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }
  return hours * 60 + minutes;
}

export function formatMinutes(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  const hours = Math.floor(value / 60);
  const minutes = Math.abs(value % 60);
  if (hours === 0) {
    return `${minutes}分`;
  }
  if (minutes === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${minutes}分`;
}

export function enrichDutySegments(duty: Duty, lookup: BlockTripLookup): Required<EnrichedSegment>[] {
  return duty.segments
    .map((segment) => enrichSegmentTiming(segment, lookup))
    .filter((entry): entry is Required<EnrichedSegment> => entry.startMinutes !== undefined && entry.endMinutes !== undefined)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export interface DutyWarningSummary {
  hard: number;
  soft: number;
  messages: { level: 'hard' | 'soft'; message: string }[];
}

export function summarizeDutyWarnings(metrics: DutyMetrics): DutyWarningSummary {
  const messages: { level: 'hard' | 'soft'; message: string }[] = [];
  let hard = 0;
  let soft = 0;
  if (metrics.warnings.exceedsDailySpan) {
    messages.push({ level: 'hard', message: '一日の拘束時間が上限を超えています。' });
    hard += 1;
  }
  if (metrics.warnings.exceedsContinuous) {
    messages.push({ level: 'soft', message: '連続運転時間が上限を超えています。' });
    soft += 1;
  }
  if (metrics.warnings.insufficientBreak) {
    messages.push({ level: 'soft', message: '休憩時間が規定より短い区間があります。' });
    soft += 1;
  }
  return { hard, soft, messages };
}
