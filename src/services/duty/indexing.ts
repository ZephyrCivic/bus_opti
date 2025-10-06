/**
 * src/services/duty/indexing.ts
 * Helpers to build trip sequence indices from block plans or CSV rows.
 */
import type { BlockCsvRow, BlockPlan } from '@/services/blocks/blockBuilder';

export type BlockTripSequenceIndex = Map<string, Map<string, number>>;

export function buildTripIndexFromPlan(plan: BlockPlan): BlockTripSequenceIndex {
  return buildTripIndexFromCsv(plan.csvRows);
}

export function buildTripIndexFromCsv(rows: BlockCsvRow[]): BlockTripSequenceIndex {
  const index: BlockTripSequenceIndex = new Map();
  for (const row of rows) {
    let tripMap = index.get(row.blockId);
    if (!tripMap) {
      tripMap = new Map<string, number>();
      index.set(row.blockId, tripMap);
    }
    tripMap.set(row.tripId, row.seq);
  }
  return index;
}

