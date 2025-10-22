/**
 * src/features/duties/hooks/useDutyPlan.ts
 * Composes block計画とDuty編集関連の派生データを一箇所にまとめ、ビュー側に渡す。
 * ブロック連結設定やCSV行からタイムライン計算に必要なメタ情報を算出する。
 */
import { useEffect, useMemo } from 'react';

import {
  buildBlocksPlan,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockPlan,
} from '@/services/blocks/blockBuilder';
import {
  buildTripIndexFromPlan,
  type BlockTripSequenceIndex,
} from '@/services/duty/dutyState';
import {
  buildTripLookup,
  type BlockTripLookup,
} from '@/services/duty/dutyMetrics';
import { parseTimeLabel } from '@/features/timeline/timeScale';
import type { DutyTimelineTrip } from '@/features/duties/utils/timelineSnap';
import type { ManualInputs } from '@/types';
import type { GtfsImportResult } from '@/services/import/gtfsParser';

export interface DutyPlanData {
  plan: BlockPlan;
  tripIndex: BlockTripSequenceIndex;
  tripLookup: BlockTripLookup;
  blockTripMinutes: Map<string, DutyTimelineTrip[]>;
}

interface DutyPlanParams {
  result: GtfsImportResult | undefined;
  manual: ManualInputs;
}

export function buildDutyPlanData(result: GtfsImportResult | undefined, manual: ManualInputs): DutyPlanData {
  const plan = buildBlocksPlan(result, {
    maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES,
    linkingEnabled: manual.linking.enabled,
    minTurnaroundMinutes: manual.linking.minTurnaroundMin,
  });
  const tripIndex = buildTripIndexFromPlan(plan);
  const tripLookup = buildTripLookup(plan.csvRows);
  const blockTripMinutes = computeBlockTripMinutes(plan);
  return { plan, tripIndex, tripLookup, blockTripMinutes };
}

export function useDutyPlan({ result, manual }: DutyPlanParams): DutyPlanData {
  const data = useMemo(
    () => buildDutyPlanData(result, manual),
    [result, manual],
  );

  const { plan, tripIndex, tripLookup, blockTripMinutes } = data;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: DutyPlanData;
    };
    testWindow.__TEST_DUTY_PLAN = { plan, tripIndex, tripLookup, blockTripMinutes };
  }, [plan, tripIndex, tripLookup, blockTripMinutes]);

  return { plan, tripIndex, tripLookup, blockTripMinutes };
}

function computeBlockTripMinutes(plan: BlockPlan): Map<string, DutyTimelineTrip[]> {
  const map = new Map<string, DutyTimelineTrip[]>();
  for (const row of plan.csvRows) {
    const startMinutes = parseTimeLabel(row.tripStart);
    const endMinutes = parseTimeLabel(row.tripEnd);
    if (startMinutes === undefined || endMinutes === undefined) {
      continue;
    }
    const list = map.get(row.blockId) ?? [];
    list.push({
      tripId: row.tripId,
      startMinutes,
      endMinutes,
    });
    map.set(row.blockId, list);
  }
  for (const trips of map.values()) {
    trips.sort((a, b) => a.startMinutes - b.startMinutes);
  }
  return map;
}
