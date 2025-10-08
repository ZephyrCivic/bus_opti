/**
 * src/features/blocks/hooks/useBlocksPlan.ts
 * Provides BlocksView with filtered block plan, service-day grouping, and overlap detection.
 */

import { useMemo } from 'react';
import type { BlockPlan } from '@/services/blocks/blockBuilder';

export interface BlockOverlap {
  blockId: string;
  overlapMinutes: number;
}

export interface BlocksByDay {
  dayIndex: number;
  label: string;
  summaries: BlockPlan['summaries'];
}

export interface UseBlocksPlanOptions {
  activeDay?: number;
}

export interface UseBlocksPlanResult {
  days: BlocksByDay[];
  allDays: BlocksByDay[];
  overlaps: Map<string, BlockOverlap[]>;
}

export function useBlocksPlan(plan: BlockPlan, options?: UseBlocksPlanOptions): UseBlocksPlanResult {
  const allDays = useMemo(() => {
    const buckets = new Map<number, BlockPlan['summaries']>();
    for (const summary of plan.summaries) {
      const list = buckets.get(summary.serviceDayIndex) ?? [];
      list.push(summary);
      buckets.set(summary.serviceDayIndex, list);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayIndex, summaries]) => ({
        dayIndex,
        label: `Day ${dayIndex + 1}`,
        summaries,
      }));
  }, [plan.summaries]);

  const overlaps = useMemo(() => {
    const map = new Map<string, BlockOverlap[]>();
    const summariesByDay = new Map<number, BlockPlan['summaries']>();
    for (const summary of plan.summaries) {
      const list = summariesByDay.get(summary.serviceDayIndex) ?? [];
      list.push(summary);
      summariesByDay.set(summary.serviceDayIndex, list);
    }
    for (const [, summaries] of summariesByDay.entries()) {
      const overlapsForDay = computeOverlaps(summaries);
      for (const entry of overlapsForDay) {
        const list = map.get(entry.blockId) ?? [];
        list.push({ ...entry, blockId: entry.blockId });
        map.set(entry.blockId, list);
      }
    }
    return map;
  }, [plan.summaries]);

  const activeDay = options?.activeDay;
  const days = useMemo(() => {
    if (activeDay === undefined) {
      return allDays;
    }
    return allDays.filter((day) => day.dayIndex === activeDay);
  }, [activeDay, allDays]);

  return {
    days,
    allDays,
    overlaps,
  };
}

function computeOverlaps(summaries: BlockPlan['summaries']): Array<{ blockId: string; overlapMinutes: number }> {
  const overlaps: Array<{ blockId: string; overlapMinutes: number }> = [];
  for (let index = 0; index < summaries.length; index += 1) {
    const current = summaries[index]!;
    let overlapMinutes = 0;
    for (let inner = 0; inner < summaries.length; inner += 1) {
      if (inner === index) {
        continue;
      }
      overlapMinutes += computeSummaryOverlap(current, summaries[inner]!);
    }
    if (overlapMinutes > 0) {
      overlaps.push({ blockId: current.blockId, overlapMinutes: Number(overlapMinutes.toFixed(2)) });
    }
  }
  return overlaps;
}

function computeSummaryOverlap(a: BlockPlan['summaries'][number], b: BlockPlan['summaries'][number]): number {
  const startA = parseHH(a.firstTripStart);
  const endA = parseHH(a.lastTripEnd);
  const startB = parseHH(b.firstTripStart);
  const endB = parseHH(b.lastTripEnd);
  if (startA === undefined || endA === undefined || startB === undefined || endB === undefined) {
    return 0;
  }
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  return Math.max(0, overlapEnd - overlapStart);
}

function parseHH(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }
  return hours * 60 + minutes;
}

export default useBlocksPlan;
