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

export function pushSnapshot(stack: Duty[][], snapshot: Duty[], limit: number): Duty[][] {
  if (limit < 1) {
    return [];
  }
  const next = [...stack, cloneDuties(snapshot)];
  const overflow = next.length - limit;
  if (overflow > 0) {
    return next.slice(overflow);
  }
  return next;
}

export function popSnapshot(stack: Duty[][]): { stack: Duty[][]; snapshot: Duty[] } | undefined {
  if (stack.length === 0) {
    return undefined;
  }
  const nextStack = stack.slice(0, -1);
  const snapshot = stack[stack.length - 1]!;
  return { stack: nextStack, snapshot: cloneDuties(snapshot) };
}

export function cloneDuties(duties: Duty[]): Duty[] {
  return duties.map((duty) => ({
    ...duty,
    segments: duty.segments.map((segment) => ({ ...segment })),
  }));
}
