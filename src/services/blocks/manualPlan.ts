import type { BlockCsvRow, BlockPlan, BlockSummary } from './blockBuilder';
import { evaluateBlockWarnings, countWarnings } from './blockBuilder';

export interface ManualPlanConfig {
  minTurnaroundMin: number;
  maxGapMinutes: number;
}

export interface ManualConnection {
  fromBlockId: string;
  toBlockId: string;
  serviceId?: string;
  serviceDayIndex: number;
  gapMinutes: number;
  resultingTripCount: number;
}

export interface BlockConnectionCandidate {
  blockId: string;
  gapMinutes: number;
  serviceId?: string;
  firstTripStart: string;
  tripCount: number;
}

export interface ConnectBlocksResult {
  plan: BlockPlan;
  connection: ManualConnection;
}

export function cloneBlockPlan(plan: BlockPlan): BlockPlan {
  return {
    summaries: plan.summaries.map((summary) => ({
      ...summary,
      gaps: [...summary.gaps],
      warningCounts: { ...summary.warningCounts },
      warnings: summary.warnings ? [...summary.warnings] : undefined,
    })),
    csvRows: plan.csvRows.map((row) => ({ ...row })),
    unassignedTripIds: [...plan.unassignedTripIds],
    totalTripCount: plan.totalTripCount,
    assignedTripCount: plan.assignedTripCount,
    coverageRatio: plan.coverageRatio,
    maxTurnGapMinutes: plan.maxTurnGapMinutes,
  };
}

export function connectBlocksPlan(
  plan: BlockPlan,
  fromBlockId: string,
  toBlockId: string,
  config: ManualPlanConfig,
): ConnectBlocksResult | null {
  if (fromBlockId === toBlockId) {
    return null;
  }

  const fromSummary = plan.summaries.find((summary) => summary.blockId === fromBlockId);
  const toSummary = plan.summaries.find((summary) => summary.blockId === toBlockId);
  if (!fromSummary || !toSummary) {
    return null;
  }

  if (fromSummary.serviceDayIndex !== toSummary.serviceDayIndex) {
    return null;
  }
  if (fromSummary.serviceId && toSummary.serviceId && fromSummary.serviceId !== toSummary.serviceId) {
    return null;
  }

  const gapMinutes = computeGapMinutes(fromSummary.lastTripEnd, toSummary.firstTripStart);
  if (gapMinutes === null) {
    return null;
  }
  if (gapMinutes < config.minTurnaroundMin || gapMinutes > config.maxGapMinutes) {
    return null;
  }

  const nextPlan = cloneBlockPlan(plan);
  const fromRows = nextPlan.csvRows.filter((row) => row.blockId === fromBlockId).sort((a, b) => a.seq - b.seq);
  const toRows = nextPlan.csvRows.filter((row) => row.blockId === toBlockId).sort((a, b) => a.seq - b.seq);
  if (fromRows.length === 0 || toRows.length === 0) {
    return null;
  }

  const combinedRows = [...fromRows, ...toRows];
  const orderedRows = combinedRows.sort((a, b) => {
    const aStart = toMinutes(a.tripStart) ?? 0;
    const bStart = toMinutes(b.tripStart) ?? 0;
    if (aStart === bStart) {
      return a.seq - b.seq;
    }
    return aStart - bStart;
  });

  for (let index = 0; index < orderedRows.length; index += 1) {
    orderedRows[index]!.seq = index + 1;
    orderedRows[index]!.blockId = fromBlockId;
  }

  nextPlan.csvRows = [
    ...nextPlan.csvRows.filter((row) => row.blockId !== fromBlockId && row.blockId !== toBlockId),
    ...orderedRows,
  ];

  const updatedSummary = buildSummaryForRows(
    fromBlockId,
    orderedRows,
    fromSummary.serviceId,
    fromSummary.serviceDayIndex,
    config.minTurnaroundMin,
  );
  const summaries = nextPlan.summaries.filter((summary) => summary.blockId !== fromBlockId && summary.blockId !== toBlockId);
  summaries.push(updatedSummary);
  summaries.sort((a, b) => {
    if (a.serviceDayIndex === b.serviceDayIndex) {
      return a.firstTripStart.localeCompare(b.firstTripStart);
    }
    return a.serviceDayIndex - b.serviceDayIndex;
  });
  nextPlan.summaries = summaries;

  return {
    plan: nextPlan,
    connection: {
      fromBlockId,
      toBlockId,
      serviceId: fromSummary.serviceId ?? toSummary.serviceId,
      serviceDayIndex: fromSummary.serviceDayIndex,
      gapMinutes,
      resultingTripCount: orderedRows.length,
    },
  };
}

export function getConnectionCandidates(
  plan: BlockPlan,
  sourceBlockId: string,
  config: ManualPlanConfig,
): BlockConnectionCandidate[] {
  const sourceSummary = plan.summaries.find((summary) => summary.blockId === sourceBlockId);
  if (!sourceSummary) {
    return [];
  }
  const candidates: BlockConnectionCandidate[] = [];
  for (const summary of plan.summaries) {
    if (summary.blockId === sourceBlockId) {
      continue;
    }
    if (summary.serviceDayIndex !== sourceSummary.serviceDayIndex) {
      continue;
    }
    if (summary.serviceId && sourceSummary.serviceId && summary.serviceId !== sourceSummary.serviceId) {
      continue;
    }
    const gapMinutes = computeGapMinutes(sourceSummary.lastTripEnd, summary.firstTripStart);
    if (gapMinutes === null) {
      continue;
    }
    if (gapMinutes < config.minTurnaroundMin || gapMinutes > config.maxGapMinutes) {
      continue;
    }
    candidates.push({
      blockId: summary.blockId,
      gapMinutes,
      serviceId: summary.serviceId,
      firstTripStart: summary.firstTripStart,
      tripCount: summary.tripCount,
    });
  }
  candidates.sort((a, b) => {
    if (a.gapMinutes === b.gapMinutes) {
      return a.blockId.localeCompare(b.blockId);
    }
    return a.gapMinutes - b.gapMinutes;
  });
  return candidates.slice(0, 8);
}

function buildSummaryForRows(
  blockId: string,
  rows: BlockCsvRow[],
  serviceId: string | undefined,
  serviceDayIndex: number,
  minTurnaroundMin: number,
): BlockSummary {
  if (rows.length === 0) {
    throw new Error('Block rows must not be empty.');
  }
  const gaps = computeGaps(rows);
  const warnings = evaluateBlockWarnings(rows, minTurnaroundMin);
  const warningCounts = countWarnings(warnings);
  const averageGap = gaps.length > 0 ? gaps.reduce((acc, gap) => acc + gap, 0) / gaps.length : 0;
  const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  return {
    blockId,
    serviceId,
    serviceDayIndex,
    tripCount: rows.length,
    firstTripStart: rows[0]!.tripStart,
    lastTripEnd: rows[rows.length - 1]!.tripEnd,
    gaps,
    overlapScore: Number(averageGap.toFixed(2)),
    gapWarnings: warnings.filter((warning) => warning.code === 'BLK_TURN_SHORT').length,
    warningCounts,
    warnings,
  };
}

function computeGaps(rows: BlockCsvRow[]): number[] {
  const sorted = [...rows].sort((a, b) => {
    const startA = toMinutes(a.tripStart) ?? 0;
    const startB = toMinutes(b.tripStart) ?? 0;
    return startA - startB;
  });
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const previousEnd = toMinutes(previous.tripEnd);
    const currentStart = toMinutes(current.tripStart);
    if (previousEnd !== null && currentStart !== null) {
      const gap = currentStart - previousEnd;
      if (gap >= 0) {
        gaps.push(gap);
      }
    }
  }
  return gaps;
}

function computeGapMinutes(endTime: string, nextStart: string): number | null {
  const end = toMinutes(endTime);
  const start = toMinutes(nextStart);
  if (end === null || start === null) {
    return null;
  }
  const gap = start - end;
  return gap >= 0 ? gap : null;
}

function toMinutes(label: string | undefined): number | null {
  if (!label) {
    return null;
  }
  const match = label.trim().match(/^(\d+):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}
