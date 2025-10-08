/**
 * src/features/duties/utils/timelineSnap.ts
 * Provides helpers to snap Duty timeline interactions (drag/move/resize) to valid Trip boundaries.
 */

import type { TimelineSegmentDragMode } from '@/features/timeline/types';

export interface DutyTimelineTrip {
  tripId: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SegmentDragContext {
  trips: DutyTimelineTrip[];
  startTripId: string;
  endTripId: string;
  mode: TimelineSegmentDragMode;
  deltaMinutes: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const findNearestIndex = (
  trips: DutyTimelineTrip[],
  target: number,
  accessor: 'start' | 'end',
): number => {
  let nearestIndex = 0;
  let nearestDiff = Number.POSITIVE_INFINITY;
  trips.forEach((trip, index) => {
    const minutes = accessor === 'start' ? trip.startMinutes : trip.endMinutes;
    if (minutes === undefined || Number.isNaN(minutes)) {
      return;
    }
    const diff = Math.abs(minutes - target);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIndex = index;
    }
  });
  return nearestIndex;
};

export function applySegmentDrag(context: SegmentDragContext): { startTripId: string; endTripId: string } {
  const { trips, startTripId, endTripId, mode, deltaMinutes } = context;
  if (trips.length === 0) {
    return { startTripId, endTripId };
  }

  const currentStartIndex = trips.findIndex((trip) => trip.tripId === startTripId);
  const currentEndIndex = trips.findIndex((trip) => trip.tripId === endTripId);
  if (currentStartIndex === -1 || currentEndIndex === -1 || currentEndIndex < currentStartIndex) {
    return { startTripId, endTripId };
  }

  const span = currentEndIndex - currentStartIndex;
  let nextStartIndex = currentStartIndex;
  let nextEndIndex = currentEndIndex;

  if (mode === 'move') {
    const targetStart = trips[currentStartIndex].startMinutes + deltaMinutes;
    const candidate = findNearestIndex(trips, targetStart, 'start');
    const maxStart = Math.max(0, trips.length - (span + 1));
    nextStartIndex = clamp(candidate, 0, maxStart);
    nextEndIndex = nextStartIndex + span;
  } else if (mode === 'resize-start') {
    const targetStart = trips[currentStartIndex].startMinutes + deltaMinutes;
    const candidate = findNearestIndex(trips, targetStart, 'start');
    nextStartIndex = clamp(candidate, 0, currentEndIndex);
  } else if (mode === 'resize-end') {
    const targetEnd = trips[currentEndIndex].endMinutes + deltaMinutes;
    const candidate = findNearestIndex(trips, targetEnd, 'end');
    nextEndIndex = clamp(candidate, currentStartIndex, trips.length - 1);
  }

  if (nextStartIndex > nextEndIndex) {
    if (mode === 'resize-start') {
      nextStartIndex = nextEndIndex;
    } else {
      nextEndIndex = nextStartIndex;
    }
  }

  return {
    startTripId: trips[nextStartIndex]?.tripId ?? startTripId,
    endTripId: trips[nextEndIndex]?.tripId ?? endTripId,
  };
}
