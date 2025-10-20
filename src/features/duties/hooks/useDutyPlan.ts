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

export function useDutyPlan({ result, manual }: DutyPlanParams): DutyPlanData {
  const plan = useMemo<BlockPlan>(
    () =>
      buildBlocksPlan(result, {
        maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES,
        linkingEnabled: manual.linking.enabled,
      }),
    [result, manual.linking.enabled],
  );

  const tripIndex = useMemo<BlockTripSequenceIndex>(() => buildTripIndexFromPlan(plan), [plan]);
  const tripLookup = useMemo<BlockTripLookup>(() => buildTripLookup(plan.csvRows), [plan.csvRows]);

  const blockTripMinutes = useMemo(() => {
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
  }, [plan.csvRows]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __PLAYWRIGHT__?: boolean;
      __TEST_DUTY_PLAN?: DutyPlanData;
    };
    if (!testWindow.__PLAYWRIGHT__) {
      return;
    }
    testWindow.__TEST_DUTY_PLAN = { plan, tripIndex, tripLookup, blockTripMinutes };
  }, [plan, tripIndex, tripLookup, blockTripMinutes]);

  return { plan, tripIndex, tripLookup, blockTripMinutes };
}
