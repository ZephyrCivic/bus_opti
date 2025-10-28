import type { DutyTimelineTrip } from './timelineSnap';

export function resolveDropRangeForTrips(
  trips: DutyTimelineTrip[] | undefined,
  startTripId: string,
  endTripId: string,
  minutes: number | null | undefined,
): { startTripId: string; endTripId: string } {
  if (!trips || trips.length === 0 || minutes === null || !Number.isFinite(minutes)) {
    return { startTripId, endTripId };
  }
  const startIndex = trips.findIndex((trip) => trip.tripId === startTripId);
  const endIndex = trips.findIndex((trip) => trip.tripId === endTripId);
  const span = startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex ? endIndex - startIndex : 0;

  let targetIndex = trips.findIndex((trip) => minutes >= trip.startMinutes && minutes <= trip.endMinutes);
  if (targetIndex === -1) {
    let nearest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < trips.length; index += 1) {
      const diff = Math.abs(trips[index]!.startMinutes - minutes);
      if (diff < nearest) {
        nearest = diff;
        targetIndex = index;
      }
    }
  }
  if (targetIndex === -1) {
    return { startTripId, endTripId };
  }
  let nextStartIndex = targetIndex;
  if (span > 0 && nextStartIndex + span >= trips.length) {
    nextStartIndex = Math.max(0, trips.length - (span + 1));
  }
  if (nextStartIndex < 0) {
    nextStartIndex = 0;
  }
  const nextEndIndex = Math.min(nextStartIndex + span, trips.length - 1);
  const nextStartTripId = trips[nextStartIndex]?.tripId ?? startTripId;
  const nextEndTripId = trips[nextEndIndex]?.tripId ?? endTripId;
  return {
    startTripId: nextStartTripId,
    endTripId: nextEndTripId,
  };
}

export function resolveGapAroundMinutesForTrips(
  trips: DutyTimelineTrip[] | undefined,
  minutes: number | null | undefined,
): { startTripId: string; endTripId: string; gapMinutes: number } | null {
  if (!trips || trips.length < 2 || minutes === null || !Number.isFinite(minutes)) {
    return null;
  }
  let previous: DutyTimelineTrip | null = null;
  let next: DutyTimelineTrip | null = null;
  for (const trip of trips) {
    if (trip.endMinutes <= minutes) {
      previous = trip;
      continue;
    }
    next = trip;
    break;
  }
  if (!previous || !next) {
    return null;
  }
  if (previous.tripId === next.tripId) {
    return null;
  }
  const gapMinutes = Math.max(next.startMinutes - previous.endMinutes, 0);
  if (gapMinutes <= 0) {
    return null;
  }
  return {
    startTripId: previous.tripId,
    endTripId: next.tripId,
    gapMinutes,
  };
}
