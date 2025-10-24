/**
 * src/services/duty/types.ts
 * Shared type declarations for Duty state transitions.
 */
import type { DutySettings, DutySegmentKind } from '@/types';

export interface SegmentRangeInput {
  blockId: string;
  startTripId: string;
  endTripId: string;
  kind?: DutySegmentKind;
  breakUntilTripId?: string;
  deadheadMinutes?: number;
  deadheadRuleId?: string;
  deadheadFromStopId?: string;
  deadheadToStopId?: string;
}

export interface AddDutySegmentInput extends SegmentRangeInput {
  dutyId?: string;
  driverId?: string;
}

export interface MoveDutySegmentInput extends SegmentRangeInput {
  dutyId: string;
  segmentId: string;
}

export interface DeleteDutySegmentInput {
  dutyId: string;
  segmentId: string;
}

export type BlockTripSequenceIndex = Map<string, Map<string, number>>;

export interface DutyStateConfig {
  settings?: Partial<DutySettings>;
}
