/**
 * src/services/duty/dutyState.ts
 * Backwards-compatible barrel export for legacy imports.
 */
export { DEFAULT_DUTY_SETTINGS } from './constants';
export {
  createDutyEditState,
  addDutySegment,
  moveDutySegment,
  deleteDutySegment,
  undoLastAction,
  replaceDutyState,
  buildTripIndexFromPlan,
  buildTripIndexFromCsv,
  type BlockTripSequenceIndex,
  type AddDutySegmentInput,
  type MoveDutySegmentInput,
  type DeleteDutySegmentInput,
} from './state';

