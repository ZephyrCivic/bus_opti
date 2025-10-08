/**
 * src/features/timeline/timeScale.ts
 * ガント描画に利用する時間スケール計算・補助関数を提供する。
 */
import type { TimelineLane } from './types';

export interface TimelineBounds {
  startMinutes: number;
  endMinutes: number;
}

export interface TimelineTick {
  minutes: number;
  position: number;
  label: string;
}

export const DEFAULT_PIXELS_PER_MINUTE = 2;

export function computeTimelineBounds(lanes: TimelineLane[]): TimelineBounds {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const lane of lanes) {
    for (const segment of lane.segments) {
      if (Number.isFinite(segment.startMinutes)) {
        min = Math.min(min, segment.startMinutes);
      }
      if (Number.isFinite(segment.endMinutes)) {
        max = Math.max(max, segment.endMinutes);
      }
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { startMinutes: 0, endMinutes: 60 };
  }

  if (min === max) {
    return { startMinutes: Math.max(0, min - 30), endMinutes: max + 30 };
  }

  return { startMinutes: Math.max(0, min), endMinutes: max };
}

export function minutesToPosition(
  minutes: number,
  bounds: TimelineBounds,
  pixelsPerMinute: number,
): number {
  const clamped = Math.max(bounds.startMinutes, Math.min(minutes, bounds.endMinutes));
  return (clamped - bounds.startMinutes) * pixelsPerMinute;
}

export function generateTicks(
  bounds: TimelineBounds,
  pixelsPerMinute: number,
  stepMinutes = 60,
): TimelineTick[] {
  if (bounds.endMinutes <= bounds.startMinutes || stepMinutes <= 0) {
    return [];
  }

  const startTick = Math.floor(bounds.startMinutes / stepMinutes) * stepMinutes;
  const ticks: TimelineTick[] = [];
  for (let value = startTick; value <= bounds.endMinutes; value += stepMinutes) {
    const label = formatMinutesAsTime(value);
    const position = minutesToPosition(value, bounds, pixelsPerMinute);
    ticks.push({ minutes: value, position, label });
  }
  return ticks;
}

export function parseTimeLabel(value: string | undefined | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.trim().match(/^(\d+):(\d{2})$/);
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

export function formatMinutesAsTime(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = Math.abs(safe % 60);
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
