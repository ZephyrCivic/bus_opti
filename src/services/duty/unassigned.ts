import type { BlockPlan, BlockCsvRow } from '@/services/blocks/blockBuilder';
import type { Duty } from '@/types';

export interface UnassignedRange {
  blockId: string;
  startTripId: string;
  endTripId: string;
  startSequence: number;
  endSequence: number;
  tripCount: number;
  firstDeparture: string;
  lastArrival: string;
}

export function computeUnassignedRanges(plan: BlockPlan, duties: Duty[]): UnassignedRange[] {
  const rowsByBlock = groupRowsByBlock(plan.csvRows);
  const assignedByBlock = buildAssignedSequences(duties);
  const ranges: UnassignedRange[] = [];

  for (const [blockId, rows] of rowsByBlock) {
    const assigned = assignedByBlock.get(blockId) ?? new Set<number>();
    const sortedRows = [...rows].sort((a, b) => a.seq - b.seq);
    let index = 0;
    while (index < sortedRows.length) {
      const row = sortedRows[index]!;
      if (assigned.has(row.seq)) {
        index += 1;
        continue;
      }
      let endIndex = index;
      while (endIndex + 1 < sortedRows.length) {
        const nextRow = sortedRows[endIndex + 1]!;
        if (assigned.has(nextRow.seq)) {
          break;
        }
        endIndex += 1;
      }
      const startRow = sortedRows[index]!;
      const endRow = sortedRows[endIndex]!;
      ranges.push({
        blockId,
        startTripId: startRow.tripId,
        endTripId: endRow.tripId,
        startSequence: startRow.seq,
        endSequence: endRow.seq,
        tripCount: endIndex - index + 1,
        firstDeparture: startRow.tripStart,
        lastArrival: endRow.tripEnd,
      });
      index = endIndex + 1;
    }
  }

  ranges.sort((a, b) => {
    if (a.blockId === b.blockId) {
      return a.startSequence - b.startSequence;
    }
    return a.blockId.localeCompare(b.blockId);
  });
  return ranges;
}

function groupRowsByBlock(rows: BlockCsvRow[]): Map<string, BlockCsvRow[]> {
  const map = new Map<string, BlockCsvRow[]>();
  for (const row of rows) {
    const list = map.get(row.blockId) ?? [];
    list.push(row);
    map.set(row.blockId, list);
  }
  return map;
}

function buildAssignedSequences(duties: Duty[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const duty of duties) {
    for (const segment of duty.segments) {
      let set = map.get(segment.blockId);
      if (!set) {
        set = new Set<number>();
        map.set(segment.blockId, set);
      }
      for (let seq = segment.startSequence; seq <= segment.endSequence; seq += 1) {
        set.add(seq);
      }
    }
  }
  return map;
}
