/**
 * src/features/duties/hooks/useDutyTimelineData.ts
 * Duty 一覧から TimelineGantt 向けのレーン構造を生成する。
 * Duty 選択情報に依存しない派生データをメモ化し、再計算コストを抑える。
 */
import { useMemo } from 'react';

import type { Duty } from '@/types';
import { enrichDutySegments, formatMinutes, type BlockTripLookup } from '@/services/duty/dutyMetrics';
import type { TimelineLane } from '@/features/timeline/types';

export interface DutyTimelineMeta {
  dutyId: string;
  segmentId: string;
  blockId: string;
  startTripId: string;
  endTripId: string;
  kind: 'drive' | 'break' | 'deadhead';
  breakUntilTripId?: string;
  deadheadMinutes?: number;
}

export function useDutyTimelineData(duties: Duty[], tripLookup: BlockTripLookup): TimelineLane<DutyTimelineMeta>[] {
  return useMemo(() => {
    return duties.map((duty) => {
      const enriched = enrichDutySegments(duty, tripLookup);
      const segments = enriched.map((segment) => ({
        id: segment.id,
        label: (() => {
          const kind = segment.kind ?? 'drive';
          if (kind === 'break') {
            return `休憩 ${formatMinutes(Math.max(segment.endMinutes - segment.startMinutes, 0))}`;
          }
          if (kind === 'deadhead') {
            const minutes = segment.deadheadMinutes ?? Math.max(segment.endMinutes - segment.startMinutes, 0);
            return `回送 ${formatMinutes(minutes)}`;
          }
          return `${segment.startTripId} → ${segment.endTripId}`;
        })(),
        startMinutes: segment.startMinutes,
        endMinutes: segment.endMinutes,
        color: (() => {
          const kind = segment.kind ?? 'drive';
          if (kind === 'break') {
            return 'var(--muted)';
          }
          if (kind === 'deadhead') {
            return 'var(--secondary)';
          }
          return 'var(--primary)';
        })(),
        meta: {
          dutyId: duty.id,
          segmentId: segment.id,
          blockId: segment.blockId,
          startTripId: segment.startTripId,
          endTripId: segment.endTripId,
          kind: (segment.kind ?? 'drive') as 'drive' | 'break' | 'deadhead',
          breakUntilTripId: segment.breakUntilTripId,
          deadheadMinutes: segment.deadheadMinutes,
        } satisfies DutyTimelineMeta,
      }));
      return {
        id: duty.id,
        label: duty.driverId ? `${duty.id} (${duty.driverId})` : duty.id,
        segments,
      };
    });
  }, [duties, tripLookup]);
}
