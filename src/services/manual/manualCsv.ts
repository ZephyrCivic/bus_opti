/**
 * src/services/manual/manualCsv.ts
 * CSV round-trip utilities for manual depots / relief points / deadhead rules.
 */
import Papa from 'papaparse';
import type { Depot, ReliefPoint, DeadheadRule, ManualDriver } from '@/types';

export interface ManualCsvSet {
  depots: string;
  reliefPoints: string;
  deadheadRules: string;
  drivers?: string;
}

export function depotsToCsv(depots: Depot[]): string {
  const rows = depots.map((depot) => ({
    depot_id: depot.depotId,
    name: depot.name,
    lat: depot.lat,
    lon: depot.lon,
    open_time: depot.openTime ?? '',
    close_time: depot.closeTime ?? '',
    min_turnaround_min: depot.minTurnaroundMin ?? '',
  }));
  return Papa.unparse(rows, { newline: '\n' });
}

export function reliefPointsToCsv(points: ReliefPoint[]): string {
  const rows = points.map((point) => ({
    relief_id: point.reliefId,
    name: point.name,
    lat: point.lat,
    lon: point.lon,
    stop_id: point.stopId ?? '',
    walk_time_to_stop_min: point.walkTimeToStopMin ?? '',
    allowed_window: point.allowedWindow ?? '',
  }));
  return Papa.unparse(rows, { newline: '\n' });
}

export function deadheadRulesToCsv(rules: DeadheadRule[]): string {
  const rows = rules.map((rule) => ({
    from_id: rule.fromId,
    to_id: rule.toId,
    mode: rule.mode,
    travel_time_min: rule.travelTimeMin,
    distance_km: rule.distanceKm ?? '',
    allowed_window: rule.allowedWindow ?? '',
  }));
  return Papa.unparse(rows, { newline: '\n' });
}

export function driversToCsv(drivers: ManualDriver[]): string {
  const rows = drivers.map((driver) => ({
    driver_id: driver.driverId,
    name: driver.name ?? '',
  }));
  return Papa.unparse(rows, { newline: '\n' });
}

export function csvToDepots(csv: string): Depot[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV parse error');
  }
  return result.data.map((row) => {
    const depotId = String(row.depot_id ?? '').trim();
    if (!depotId) {
      throw new Error('depot_id is required');
    }
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`lat/lon must be numeric (depot_id=${depotId})`);
    }
    const minTurnaround = row.min_turnaround_min;
    const parsedMinTurnaround = minTurnaround === '' || minTurnaround === undefined ? undefined : Number(minTurnaround);
    if (parsedMinTurnaround !== undefined && !Number.isFinite(parsedMinTurnaround)) {
      throw new Error(`min_turnaround_min must be numeric (depot_id=${depotId})`);
    }
    return {
      depotId,
      name: String(row.name ?? '').trim(),
      lat,
      lon,
      openTime: normalizeOptionalString(row.open_time),
      closeTime: normalizeOptionalString(row.close_time),
      minTurnaroundMin: parsedMinTurnaround,
    };
  });
}

export function csvToReliefPoints(csv: string): ReliefPoint[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV parse error');
  }
  return result.data.map((row) => {
    const reliefId = String(row.relief_id ?? '').trim();
    if (!reliefId) {
      throw new Error('relief_id is required');
    }
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`lat/lon must be numeric (relief_id=${reliefId})`);
    }
    const walkTimeRaw = row.walk_time_to_stop_min;
    const walkTime =
      walkTimeRaw === '' || walkTimeRaw === undefined ? undefined : Number(walkTimeRaw);
    if (walkTime !== undefined && !Number.isFinite(walkTime)) {
      throw new Error(`walk_time_to_stop_min must be numeric (relief_id=${reliefId})`);
    }
    return {
      reliefId,
      name: String(row.name ?? '').trim(),
      lat,
      lon,
      stopId: normalizeOptionalString(row.stop_id),
      walkTimeToStopMin: walkTime,
      allowedWindow: normalizeOptionalString(row.allowed_window),
    };
  });
}

export function csvToDeadheadRules(csv: string): DeadheadRule[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV parse error');
  }
  return result.data.map((row) => {
    const fromId = String(row.from_id ?? '').trim();
    const toId = String(row.to_id ?? '').trim();
    const mode = String(row.mode ?? '').trim();
    if (!fromId || !toId) {
      throw new Error('from_id and to_id are required');
    }
    if (!isDeadheadMode(mode)) {
      throw new Error(`mode must be walk/bus/other (from_id=${fromId}, to_id=${toId})`);
    }
    const travel = Number(row.travel_time_min);
    if (!Number.isFinite(travel)) {
      throw new Error(`travel_time_min must be numeric (from_id=${fromId}, to_id=${toId})`);
    }
    const distanceRaw = row.distance_km;
    const distance =
      distanceRaw === '' || distanceRaw === undefined ? undefined : Number(distanceRaw);
    if (distance !== undefined && !Number.isFinite(distance)) {
      throw new Error(`distance_km must be numeric (from_id=${fromId}, to_id=${toId})`);
    }
    return {
      fromId,
      toId,
      mode,
      travelTimeMin: travel,
      distanceKm: distance,
      allowedWindow: normalizeOptionalString(row.allowed_window),
    };
  });
}

export function csvToDrivers(csv: string): ManualDriver[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV parse error');
  }
  const seen = new Set<string>();
  return result.data.map((row) => {
    const driverId = String(row.driver_id ?? '').trim();
    if (!driverId) {
      throw new Error('driver_id is required');
    }
    if (seen.has(driverId)) {
      throw new Error(`driver_id is duplicated: ${driverId}`);
    }
    seen.add(driverId);
    return {
      driverId,
      name: String(row.name ?? '').trim(),
    };
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isDeadheadMode(value: string): value is DeadheadRule['mode'] {
  return value === 'walk' || value === 'bus' || value === 'other';
}
