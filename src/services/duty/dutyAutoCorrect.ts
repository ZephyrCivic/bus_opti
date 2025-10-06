/**
 * src/services/duty/dutyAutoCorrect.ts
 * Provides heuristic auto-correction utilities to satisfy Duty rules by trimming conflicting segments.
 */
import type { Duty } from '@/types';
import {
  computeDutyMetrics,
  enrichDutySegments,

  type BlockTripLookup,
} from '@/services/duty/dutyMetrics';
import type { DutySettings } from '@/types';

interface AutoCorrectionResult {
  duty: Duty;
  changed: boolean;
}

export function autoCorrectDuty(
  duty: Duty,
  lookup: BlockTripLookup,
  settings: DutySettings,
): AutoCorrectionResult {
  let current = cloneDuty(duty);
  let changed = false;

  for (let iterations = 0; iterations < 10; iterations += 1) {
    const metrics = computeDutyMetrics(current, lookup, settings);
    if (!metrics.warnings.exceedsContinuous && !metrics.warnings.insufficientBreak && !metrics.warnings.exceedsDailySpan) {
      return { duty: current, changed };
    }

    if (metrics.warnings.exceedsContinuous) {
      const segments = enrichDutySegments(current, lookup);
      const longest = segments.reduce((acc, segment) => {
        const duration = segment.endMinutes - segment.startMinutes;
        if (!acc || duration > acc.duration) {
          return { id: segment.id, duration };
        }
        return acc;
      }, null as { id: string; duration: number } | null);
      if (!longest) break;
      current = removeSegment(current, longest.id);
      changed = true;
      continue;
    }

    if (metrics.warnings.insufficientBreak) {
      const segments = enrichDutySegments(current, lookup);
      let smallestGapId: string | null = null;
      let smallestGap = Number.POSITIVE_INFINITY;
      for (let index = 1; index < segments.length; index += 1) {
        const gap = segments[index].startMinutes - segments[index - 1].endMinutes;
        if (gap >= 0 && gap < smallestGap) {
          smallestGap = gap;
          smallestGapId = segments[index].id;
        }
      }
      if (!smallestGapId) break;
      current = removeSegment(current, smallestGapId);
      changed = true;
      continue;
    }

    if (metrics.warnings.exceedsDailySpan) {
      const segments = enrichDutySegments(current, lookup);
      if (segments.length === 0) break;
      const last = segments[segments.length - 1];
      current = removeSegment(current, last.id);
      changed = true;
      continue;
    }
  }

  return { duty: current, changed };
}

function cloneDuty(duty: Duty): Duty {
  return {
    id: duty.id,
    driverId: duty.driverId,
    segments: duty.segments.map((segment) => ({ ...segment })),
  };
}

function removeSegment(duty: Duty, segmentId: string): Duty {
  const nextSegments = duty.segments.filter((segment) => segment.id !== segmentId);
  return {
    ...duty,
    segments: nextSegments,
  };
}