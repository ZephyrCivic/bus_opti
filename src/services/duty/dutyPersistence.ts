/**
 * src/services/duty/dutyPersistence.ts
 * Serializes DutyEditState to localStorage and restores it on app start.
 * Keeps undo/redo stacks out of storage and sanitizes payloads before persisting.
 */
import type { Duty, DutyEditState, DutySegment, DutySettings } from '@/types';
import { DEFAULT_DUTY_SETTINGS } from './constants';

export interface StoredDutyStateV1 {
  version: 1;
  savedAt: string;
  settings: DutySettings;
  duties: Duty[];
}

export type StoredDutyState = StoredDutyStateV1;

export const DUTY_STORAGE_KEY = 'dutyEditState:v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveDutyState(state: DutyEditState, storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) {
    return;
  }
  const payload: StoredDutyStateV1 = {
    version: 1,
    savedAt: new Date().toISOString(),
    settings: sanitizeSettings(state.settings),
    duties: state.duties.map(cloneDuty),
  };
  try {
    target.setItem(DUTY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable; ignore to avoid crashing the UI.
  }
}

export function loadDutyState(storage?: StorageLike): StoredDutyStateV1 | undefined {
  const target = resolveStorage(storage);
  if (!target) {
    return undefined;
  }
  const raw = target.getItem(DUTY_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as StoredDutyState;
    if (!parsed || parsed.version !== 1) {
      target.removeItem(DUTY_STORAGE_KEY);
      return undefined;
    }
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      settings: sanitizeSettings(parsed.settings),
      duties: Array.isArray(parsed.duties) ? parsed.duties.map(cloneDuty) : [],
    };
  } catch {
    target.removeItem(DUTY_STORAGE_KEY);
    return undefined;
  }
}

export function clearDutyState(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) {
    return;
  }
  try {
    target.removeItem(DUTY_STORAGE_KEY);
  } catch {
    // 念のため swallow
  }
}

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) {
    return storage;
  }
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function cloneDuty(duty: Duty): Duty {
  return {
    id: duty.id,
    driverId: duty.driverId ?? undefined,
    segments: duty.segments.map(cloneSegment),
  };
}

function cloneSegment(segment: DutySegment): DutySegment {
  return {
    id: segment.id,
    blockId: segment.blockId,
    startTripId: segment.startTripId,
    endTripId: segment.endTripId,
    startSequence: segment.startSequence,
    endSequence: segment.endSequence,
  };
}

function sanitizeSettings(settings: DutySettings | undefined): DutySettings {
  const base = { ...DEFAULT_DUTY_SETTINGS };
  if (!settings) {
    return base;
  }
  return {
    maxContinuousMinutes: ensureFinite(settings.maxContinuousMinutes, base.maxContinuousMinutes),
    minBreakMinutes: ensureFinite(settings.minBreakMinutes, base.minBreakMinutes),
    maxDailyMinutes: ensureFinite(settings.maxDailyMinutes, base.maxDailyMinutes),
    undoStackLimit: ensureFinite(settings.undoStackLimit, base.undoStackLimit),
    maxUnassignedPercentage: ensureFinite(settings.maxUnassignedPercentage, base.maxUnassignedPercentage),
    maxNightShiftVariance: ensureFinite(settings.maxNightShiftVariance, base.maxNightShiftVariance),
  };
}

function ensureFinite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}
