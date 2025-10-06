/**
 * src/services/duty/history.ts
 * Utilities to capture undo snapshots and restore previous Duty states.
 */
import type { Duty, DutyEditState } from '@/types';

export function captureSnapshot(state: DutyEditState): Duty[] | undefined {
  if (state.settings.undoStackLimit < 1) {
    return undefined;
  }
  return cloneDuties(state.duties);
}

export function applySnapshot(state: DutyEditState, snapshot: Duty[] | undefined): DutyEditState {
  if (!snapshot) {
    return state;
  }
  return {
    duties: cloneDuties(snapshot),
    settings: state.settings,
  };
}

export function cloneDuties(duties: Duty[]): Duty[] {
  return duties.map((duty) => ({
    ...duty,
    segments: duty.segments.map((segment) => ({ ...segment })),
  }));
}
