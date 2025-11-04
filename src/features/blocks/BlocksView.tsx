/**
 * src/features/blocks/BlocksView.tsx
 * 行路編集に特化した最小UI。検証OFFモードで自由な結合・区間挿入が可能。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import clsx from 'clsx';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TimelineGantt, {
  type TimelineLaneContextMenuEvent,
  type TimelineLaneProps,
  type TimelineSegmentContextMenuEvent,
} from '@/features/timeline/TimelineGantt';
import { DEFAULT_PIXELS_PER_MINUTE, parseTimeLabel } from '@/features/timeline/timeScale';
import type { TimelineLane, TimelineSegment, TimelineSegmentDragEvent } from '@/features/timeline/types';
import { DragBusProvider, useOptionalDragBus } from '@/features/timeline/dragBus';
import {
  buildBlocksPlan,
  buildSingleTripBlockSeed,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockCsvRow,
  type BlockPlan,
  type BlockSummary,
} from '@/services/blocks/blockBuilder';
import { splitBlockPlan, cloneBlockPlan } from '@/services/blocks/manualPlan';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { useBlocksPlan } from './hooks/useBlocksPlan';
import { useManualBlocksPlan } from './hooks/useManualBlocksPlan';
import { isStepOne } from '@/config/appStep';
import { downloadCsv } from '@/utils/downloadCsv';
import { toast } from 'sonner';
import MapView from '@/features/explorer/MapView';
import { buildExplorerDataset } from '@/features/explorer/mapData';
import { buildBlocksIntervalsCsv, type IntervalLike } from '@/services/export/blocksIntervalsCsv';
import { recordAuditEvent } from '@/services/audit/auditLog';

const DEFAULT_INTERVAL_MINUTES = 10;
const DEADHEAD_COLOR = '#60a5fa';
const BREAK_COLOR = '#f97316';

const createIntervalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

interface BlockInterval {
  id: string;
  kind: 'break' | 'deadhead';
  startMinutes: number;
  endMinutes: number;
  anchorTripId?: string;
  position?: 'before' | 'after' | 'absolute';
  note?: string;
}

type BlockTimelineSegmentMeta =
  | {
      type: 'trip';
      blockId: string;
      tripId: string;
      seq: number;
      startMinutes: number;
      endMinutes: number;
    }
  | {
      type: 'break' | 'deadhead';
      blockId: string;
      intervalId: string;
      startMinutes: number;
      endMinutes: number;
    };

type BlockContextMenuState =
  | {
      type: 'lane';
      blockId: string;
      minutes: number;
      position: { x: number; y: number };
    }
  | {
      type: 'trip';
      blockId: string;
      tripId: string;
      canSplit: boolean;
      position: { x: number; y: number };
    }
  | {
      type: 'interval';
      blockId: string;
      intervalId: string;
      kind: 'break' | 'deadhead';
      position: { x: number; y: number };
    };
export default function BlocksView(): JSX.Element {
  const { result, manual, manualBlockPlan, setManualBlockPlan } = useGtfsImport();
  const turnGap = DEFAULT_MAX_TURN_GAP_MINUTES;
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [fromBlockId, setFromBlockId] = useState<string>('');
  const [toBlockId, setToBlockId] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [blockIntervals, setBlockIntervals] = useState<Record<string, BlockInterval[]>>({});
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<BlockContextMenuState | null>(null);
  const [mapRouteId, setMapRouteId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [globalDropActive, setGlobalDropActive] = useState(false);

  const initialPlan = useMemo<BlockPlan>(() => {
    if (manualBlockPlan) {
      return cloneBlockPlan(manualBlockPlan);
    }
    return buildBlocksPlan(result, {
      maxTurnGapMinutes: turnGap,
      minTurnaroundMinutes: manual.linking.minTurnaroundMin,
      linkingEnabled: false,
      diagnosticsEnabled: !isStepOne,
      startUnassigned: isStepOne,
    });
  }, [manualBlockPlan, result, turnGap, manual.linking.minTurnaroundMin, manual.linking.enabled]);

  const manualPlanConfig = useMemo(
    () => ({
      minTurnaroundMin: 0,
      maxGapMinutes: Number.MAX_SAFE_INTEGER,
      validationMode: 'off' as const,
    }),
    [],
  );

  const manualPlanState = useManualBlocksPlan(initialPlan, manualPlanConfig);
  const { days, allDays, overlaps } = useBlocksPlan(manualPlanState.plan, {
    activeDay: activeDayIndex ?? undefined,
  });

  const latestPlanRef = useRef(manualPlanState.plan);

  useEffect(() => {
    latestPlanRef.current = manualPlanState.plan;
  }, [manualPlanState.plan]);

  useEffect(
    () => () => {
      setManualBlockPlan(cloneBlockPlan(latestPlanRef.current));
    },
    [setManualBlockPlan],
  );

  useEffect(() => {
    if (allDays.length === 0) {
      if (activeDayIndex !== null) setActiveDayIndex(null);
      return;
    }
    const firstDay = allDays[0]!.dayIndex;
    if (activeDayIndex === null || !allDays.some((day) => day.dayIndex === activeDayIndex)) {
      setActiveDayIndex(firstDay);
    }
  }, [allDays, activeDayIndex]);

  const overlapMinutesByBlock = useMemo(() => {
    const map = new Map<string, number>();
    for (const summary of manualPlanState.plan.summaries) {
      const total = (overlaps.get(summary.blockId) ?? []).reduce(
        (accumulator, entry) => accumulator + entry.overlapMinutes,
        0,
      );
      map.set(summary.blockId, Number(total.toFixed(2)));
    }
    return map;
  }, [manualPlanState.plan.summaries, overlaps]);

  const visibleSummaries = useMemo(() => days.flatMap((day) => day.summaries), [days]);

  const blockRowsById = useMemo(() => {
    const map = new Map<string, BlockCsvRow[]>();
    for (const row of manualPlanState.plan.csvRows) {
      const list = map.get(row.blockId);
      if (list) {
        list.push(row);
      } else {
        map.set(row.blockId, [row]);
      }
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => a.seq - b.seq);
    }
    return map;
  }, [manualPlanState.plan.csvRows]);
  const timelineLanes = useMemo<TimelineLane<BlockTimelineSegmentMeta>[]>(() => {
    return visibleSummaries.reduce<TimelineLane<BlockTimelineSegmentMeta>[]>((lanes, summary) => {
      const laneLabel = `${summary.blockId}（便数 ${summary.tripCount}）`;
      const overlapMinutes = overlapMinutesByBlock.get(summary.blockId) ?? 0;
      const baseColor = overlapMinutes > 0 ? 'var(--destructive)' : 'var(--primary)';

      const rows = blockRowsById.get(summary.blockId) ?? [];
      const tripSegments: TimelineSegment<BlockTimelineSegmentMeta>[] = rows.reduce(
        (segments, row) => {
          const startMinutes = parseTimeLabel(row.tripStart);
          const endMinutes = parseTimeLabel(row.tripEnd);
          if (startMinutes === undefined || endMinutes === undefined) {
            return segments;
          }
          const safeEnd = Math.max(endMinutes, startMinutes + 1);
          segments.push({
            id: `${row.blockId}-${row.tripId}`,
            label: row.tripId,
            startMinutes,
            endMinutes: safeEnd,
            color: baseColor,
            meta: {
              type: 'trip',
              blockId: row.blockId,
              tripId: row.tripId,
              seq: row.seq,
              startMinutes,
              endMinutes: safeEnd,
            },
          });
          return segments;
        },
        [] as TimelineSegment<BlockTimelineSegmentMeta>[],
      );

      const intervalSegments: TimelineSegment<BlockTimelineSegmentMeta>[] = (blockIntervals[summary.blockId] ?? []).map(
        (interval) => {
          const safeEnd = Math.max(interval.endMinutes, interval.startMinutes + 1);
          const durationMinutes = Math.max(1, Math.round(safeEnd - interval.startMinutes));
          return {
            id: interval.id,
            label: `${interval.kind === 'break' ? '休憩' : '回送'} ${durationMinutes}分`,
            startMinutes: interval.startMinutes,
            endMinutes: safeEnd,
            color: interval.kind === 'break' ? BREAK_COLOR : DEADHEAD_COLOR,
            meta: {
              type: interval.kind,
              blockId: summary.blockId,
              intervalId: interval.id,
              startMinutes: interval.startMinutes,
              endMinutes: safeEnd,
            },
          };
        },
      );

      const segments = [...tripSegments, ...intervalSegments].sort((a, b) => a.startMinutes - b.startMinutes);

      if (segments.length === 0) {
        const startMinutes = parseTimeLabel(summary.firstTripStart);
        const endMinutes = parseTimeLabel(summary.lastTripEnd);
        if (startMinutes === undefined || endMinutes === undefined) {
          return lanes;
        }
        const safeEnd = Math.max(endMinutes, startMinutes + 1);
        segments.push({
          id: `${summary.blockId}-window`,
          label: `${summary.firstTripStart} ~ ${summary.lastTripEnd}`,
          startMinutes,
          endMinutes: safeEnd,
          color: 'var(--muted-foreground)',
          meta: {
            type: 'trip',
            blockId: summary.blockId,
            tripId: `${summary.blockId}-window`,
            seq: 0,
            startMinutes,
            endMinutes: safeEnd,
          },
        });
      }

      lanes.push({ id: summary.blockId, label: laneLabel, segments });
      return lanes;
    }, []);
  }, [visibleSummaries, blockIntervals, overlapMinutesByBlock, blockRowsById]);

  const handleFromChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setFromBlockId(event.target.value);
    setManualStatus(null);
  };

  const handleToChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setToBlockId(event.target.value);
    setManualStatus(null);
  };
  const handleConnect = () => {
    if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) {
      setManualStatus({ type: 'error', message: '連結元・連結先を正しく選択してください。' });
      return;
    }
    const success = manualPlanState.connect(fromBlockId, toBlockId);
    if (success) {
      setManualStatus({ type: 'success', message: `${fromBlockId} と ${toBlockId} を連結しました。` });
      recordAuditEvent('blocks_manual_connect', { fromBlockId, toBlockId, validationMode: 'off' });
    } else {
      setManualStatus({ type: 'error', message: '連結できませんでした。サービス日や時刻を確認してください。' });
    }
  };

  const handleUndo = () => {
    const undone = manualPlanState.undoLastConnection();
    if (undone) {
      setManualStatus({ type: 'success', message: '直前の連結を取り消しました。' });
    } else {
      setManualStatus({ type: 'error', message: '取り消す連結はありません。' });
    }
  };

  const getTripTimes = useCallback(
    (blockId: string, tripId: string): { start: number; end: number } | null => {
      const rows = blockRowsById.get(blockId) ?? [];
      const row = rows.find((entry) => entry.tripId === tripId);
      if (!row) return null;
      const start = parseTimeLabel(row.tripStart);
      const end = parseTimeLabel(row.tripEnd);
      if (start === undefined || end === undefined) return null;
      return { start, end };
    },
    [blockRowsById],
  );

  const handleAddInterval = useCallback(
    (blockId: string, kind: 'break' | 'deadhead', minutes: number) => {
      const summary = manualPlanState.plan.summaries.find((entry) => entry.blockId === blockId);
      const blockStart = summary ? parseTimeLabel(summary.firstTripStart) ?? 0 : 0;
      const blockEnd = summary ? parseTimeLabel(summary.lastTripEnd) ?? 24 * 60 : 24 * 60;
      const start = Math.max(blockStart, Math.min(minutes, blockEnd - 1));
      const end = Math.min(blockEnd, start + DEFAULT_INTERVAL_MINUTES);
      const interval: BlockInterval = {
        id: createIntervalId(),
        kind,
        startMinutes: Number(start.toFixed(2)),
        endMinutes: Number(end.toFixed(2)),
        position: 'absolute',
      };
      setBlockIntervals((current) => ({
        ...current,
        [blockId]: [...(current[blockId] ?? []), interval],
      }));
      setContextMenu(null);
      toast.success(kind === 'break' ? '休憩区間を追加しました。' : '回送区間を追加しました。');
    },
    [manualPlanState.plan.summaries],
  );

  const handleAddAnchoredInterval = useCallback(
    (blockId: string, tripId: string, position: 'before' | 'after', kind: 'break' | 'deadhead') => {
      const times = getTripTimes(blockId, tripId);
      if (!times) {
        toast.error('便の時刻が取得できませんでした。');
        return;
      }
      const duration = DEFAULT_INTERVAL_MINUTES;
      let start = position === 'after' ? times.end : Math.max(0, times.start - duration);
      let end = position === 'after' ? Math.min(24 * 60, times.end + duration) : times.start;
      if (end <= start) end = start + 1;
      const interval: BlockInterval = {
        id: createIntervalId(),
        kind,
        startMinutes: Number(start.toFixed(2)),
        endMinutes: Number(end.toFixed(2)),
        anchorTripId: tripId,
        position,
      };
      setBlockIntervals((current) => ({
        ...current,
        [blockId]: [...(current[blockId] ?? []), interval],
      }));
      setContextMenu(null);
      toast.success(`${position === 'after' ? '後ろに' : '前に'}${kind === 'break' ? '休憩' : '回送'}を追加しました。`);
    },
    [getTripTimes],
  );

  const handleRemoveInterval = useCallback((blockId: string, intervalId: string) => {
    setBlockIntervals((current) => {
      const existing = current[blockId];
      if (!existing) return current;
      const nextIntervals = existing.filter((interval) => interval.id !== intervalId);
      if (nextIntervals.length === 0) {
        const { [blockId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [blockId]: nextIntervals };
    });
    setContextMenu(null);
    toast.success('区間を削除しました。');
  }, []);
  const handleTimelineSegmentDrag = useCallback(
    (event: TimelineSegmentDragEvent<BlockTimelineSegmentMeta>) => {
      const meta = event.segment.meta;
      if (!meta) return;
      if (meta.type === 'trip') {
        toast.info('便の直接移動は未対応です。行路を結合する際はラベルまたは便のドラッグ＆ドロップを使用してください。');
        return;
      }
      let updated = false;
      setBlockIntervals((current) => {
        const intervals = current[meta.blockId];
        if (!intervals) return current;
        const index = intervals.findIndex((interval) => interval.id === meta.intervalId);
        if (index === -1) return current;
        const summary = manualPlanState.plan.summaries.find((entry) => entry.blockId === meta.blockId);
        const blockStart = summary ? parseTimeLabel(summary.firstTripStart) ?? 0 : 0;
        const blockEnd = summary ? parseTimeLabel(summary.lastTripEnd) ?? 24 * 60 : 24 * 60;
        const target = { ...intervals[index]! };
        const originalDuration = Math.max(1, target.endMinutes - target.startMinutes);

        if (event.mode === 'move') {
          let nextStart = target.startMinutes + event.deltaMinutes;
          nextStart = Math.max(blockStart, Math.min(nextStart, blockEnd - originalDuration));
          target.startMinutes = Number(nextStart.toFixed(2));
          target.endMinutes = Number(Math.min(blockEnd, nextStart + originalDuration).toFixed(2));
        } else if (event.mode === 'resize-start') {
          let nextStart = target.startMinutes + event.deltaMinutes;
          nextStart = Math.max(blockStart, Math.min(nextStart, target.endMinutes - 1));
          target.startMinutes = Number(nextStart.toFixed(2));
        } else if (event.mode === 'resize-end') {
          let nextEnd = target.endMinutes + event.deltaMinutes;
          nextEnd = Math.min(blockEnd, Math.max(nextEnd, target.startMinutes + 1));
          target.endMinutes = Number(nextEnd.toFixed(2));
        }

        if (
          target.startMinutes === intervals[index]!.startMinutes &&
          target.endMinutes === intervals[index]!.endMinutes
        ) {
          return current;
        }
        const nextIntervals = [...intervals];
        nextIntervals[index] = target;
        updated = true;
        return { ...current, [meta.blockId]: nextIntervals };
      });
      if (updated) {
        toast.success('区間を更新しました。');
      }
    },
    [manualPlanState.plan.summaries],
  );

  const handleSegmentContextMenu = useCallback(
    (event: TimelineSegmentContextMenuEvent<BlockTimelineSegmentMeta>) => {
      const meta = event.segment.meta;
      if (!meta) return;
      if (meta.type === 'trip') {
        setContextMenu({
          type: 'trip',
          blockId: meta.blockId,
          tripId: meta.tripId,
          canSplit: meta.seq > 1,
          position: { x: event.clientX, y: event.clientY },
        });
        return;
      }
      setContextMenu({
        type: 'interval',
        blockId: meta.blockId,
        intervalId: meta.intervalId,
        kind: meta.type,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [],
  );

  const handleLaneContextMenu = useCallback((event: TimelineLaneContextMenuEvent) => {
    setContextMenu({
      type: 'lane',
      blockId: event.laneId,
      minutes: event.minutes,
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  const dragBus = useOptionalDragBus();

  const getSegmentPropsForDrag = useCallback(
    (lane: TimelineLane<BlockTimelineSegmentMeta>, segment: TimelineSegment<BlockTimelineSegmentMeta>) => {
      const meta = segment.meta;
      if (!dragBus || !meta || meta.type !== 'trip') {
        return {};
      }
      return {
        onPointerDown: (event: React.PointerEvent<SVGGElement>) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          dragBus.beginDrag(
            {
              type: 'block-trip',
              blockId: meta.blockId,
              tripId: meta.tripId,
              serviceDayIndex: 0,
              startMinutes: segment.startMinutes,
              endMinutes: segment.endMinutes,
            },
            {
              origin: { laneId: lane.id, segmentId: segment.id },
              pointerId: (event as unknown as PointerEvent).pointerId,
              pointerType: (event as unknown as PointerEvent).pointerType,
              initialPosition: { clientX: event.clientX, clientY: event.clientY },
            },
          );
        },
        className: 'cursor-grab',
      } as React.SVGProps<SVGGElement>;
    },
    [dragBus],
  );
  const handleExternalDrop = useCallback(
    (event: import('@/features/timeline/types').TimelineExternalDropEvent<BlockTimelineSegmentMeta>) => {
      if (!event || event.payload.type !== 'block-trip') {
        return false;
      }
      const sourceBlockId = event.payload.blockId;
      const targetBlockId = event.laneId;
      if (!targetBlockId || targetBlockId === sourceBlockId) {
        return false;
      }
      const preview = splitBlockPlan(manualPlanState.plan, sourceBlockId, event.payload.tripId, manualPlanConfig);
      let newBlockId = sourceBlockId;
      if (preview) {
        const split = manualPlanState.splitBlock(sourceBlockId, event.payload.tripId);
        if (split) {
          newBlockId = preview.newBlockId;
        }
      }
      const connected = manualPlanState.connect(newBlockId, targetBlockId);
      if (connected) {
        toast.success(`${newBlockId} を ${targetBlockId} に結合しました（検証OFF）`);
        recordAuditEvent('blocks_manual_connect_drop', {
          fromBlockId: newBlockId,
          toBlockId: targetBlockId,
          validationMode: 'off',
        });
        return true;
      }
      toast.info('結合できませんでした。便を右クリックして分離してから再度お試しください。');
      return false;
    },
    [manualPlanConfig, manualPlanState],
  );

  const getLaneProps = useCallback(
    (lane: TimelineLane<BlockTimelineSegmentMeta>): TimelineLaneProps => {
      const isDropTarget = dropTargetBlockId === lane.id;
      const isDragging = draggingBlockId === lane.id;
      return {
        labelProps: {
          draggable: true,
          onDragStart: (event) => {
            event.dataTransfer.setData('application/x-block-id', lane.id);
            event.dataTransfer.setData('text/plain', lane.id);
            event.dataTransfer.effectAllowed = 'move';
            setDraggingBlockId(lane.id);
            setDropTargetBlockId(null);
            setManualStatus(null);
          },
          onDragEnd: () => {
            setDraggingBlockId(null);
            setDropTargetBlockId(null);
          },
          className: clsx(
            isDropTarget && 'bg-muted/40',
            isDragging && 'ring-1 ring-primary/60',
            'cursor-grab',
          ),
        },
        trackProps: {
          onDragOver: (event) => {
            const sourceId = event.dataTransfer.getData('application/x-block-id');
            if (sourceId && sourceId !== lane.id) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'link';
              if (dropTargetBlockId !== lane.id) {
                setDropTargetBlockId(lane.id);
              }
            }
          },
          onDragLeave: () => {
            setDropTargetBlockId((current) => (current === lane.id ? null : current));
          },
          onDrop: (event) => {
            const sourceId = event.dataTransfer.getData('application/x-block-id');
            if (sourceId && sourceId !== lane.id) {
              event.preventDefault();
              setDropTargetBlockId(null);
              setDraggingBlockId(null);
              const success = manualPlanState.connect(sourceId, lane.id);
              if (success) {
                toast.success(`${sourceId} と ${lane.id} を連結しました（検証OFF）`);
                recordAuditEvent('blocks_manual_connect_label', { fromBlockId: sourceId, toBlockId: lane.id });
              } else {
                toast.error('連結できませんでした。From/To を確認してください。');
              }
            }
          },
          className: clsx(isDropTarget && 'ring-2 ring-primary/50'),
        },
      };
    },
    [dropTargetBlockId, draggingBlockId, manualPlanState],
  );

  const handleSelectDay = (index: number | null) => {
    setActiveDayIndex(index);
  };

  const handleExportIntervals = () => {
    const exportMap: Record<string, IntervalLike[]> = {};
    for (const [blockId, list] of Object.entries(blockIntervals)) {
      exportMap[blockId] = list.map((interval) => ({
        id: interval.id,
        kind: interval.kind,
        startMinutes: interval.startMinutes,
        endMinutes: interval.endMinutes,
        anchorTripId: interval.anchorTripId,
        position: interval.position,
        note: interval.note,
      }));
    }
    const exportResult = buildBlocksIntervalsCsv(exportMap);
    downloadCsv(exportResult.csv, exportResult.fileName);
    recordAuditEvent('blocks_intervals_export', { rowCount: exportResult.rowCount });
    toast.success('blocks_intervals.csv を出力しました。');
  };

  const openRouteOnMap = (tripId: string) => {
    if (!result) {
      toast.error('GTFS データを読み込んでください。');
      return;
    }
    const tripsTable = result.tables['trips.txt'];
    const row = tripsTable?.rows.find((entry: Record<string, unknown>) => String(entry.trip_id ?? '').trim() === tripId);
    const routeId = row ? String(row.route_id ?? '').trim() : '';
    if (!routeId) {
      toast.info('route_id を取得できませんでした。');
      return;
    }
    setMapRouteId(routeId);
    setMapOpen(true);
    setContextMenu(null);
  };

  const validationBanner = (
    <Card className="border-yellow-400/60 bg-yellow-100/40 dark:bg-yellow-900/20">
      <CardContent className="p-4 text-sm">
        <p className="font-medium text-yellow-900 dark:text-yellow-100">検証OFFモードで作業中です。</p>
        <p className="text-yellow-800/80 dark:text-yellow-100/80">
          サービス日や時刻の整合はチェックされません。出力前に必要に応じて手動で見直してください。
        </p>
      </CardContent>
    </Card>
  );
  const contextMenuNode = contextMenu ? (
    <div
      className="fixed z-50 min-w-[16rem] rounded-md border bg-popover p-1 text-sm shadow-md"
      style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
      role="menu"
    >
      {contextMenu.type === 'lane' ? (
        <div className="flex flex-col">
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => handleAddInterval(contextMenu.blockId, 'break', contextMenu.minutes)}
          >
            この位置に休憩を追加（10分）
          </button>
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => handleAddInterval(contextMenu.blockId, 'deadhead', contextMenu.minutes)}
          >
            この位置に回送を追加（10分）
          </button>
        </div>
      ) : null}
      {contextMenu.type === 'trip' ? (
        <div className="flex flex-col">
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => handleAddAnchoredInterval(contextMenu.blockId, contextMenu.tripId, 'before', 'break')}
          >
            この便の前に休憩を追加
          </button>
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => handleAddAnchoredInterval(contextMenu.blockId, contextMenu.tripId, 'after', 'break')}
          >
            この便の後に休憩を追加（10分）
          </button>
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => handleAddAnchoredInterval(contextMenu.blockId, contextMenu.tripId, 'before', 'deadhead')}
          >
            この便の前に回送を追加
          </button>
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => handleAddAnchoredInterval(contextMenu.blockId, contextMenu.tripId, 'after', 'deadhead')}
          >
            この便の後に回送を追加
          </button>
          <button
            type="button"
            className={clsx(
              'px-3 py-2 text-left focus:outline-none',
              contextMenu.canSplit ? 'hover:bg-muted' : 'cursor-not-allowed text-muted-foreground',
            )}
            onClick={() => {
              if (contextMenu.canSplit) {
                const split = manualPlanState.splitBlock(contextMenu.blockId, contextMenu.tripId);
                if (split) {
                  toast.success('便以降を新しい行路に分離しました。');
                } else {
                  toast.error('分離できませんでした。');
                }
                setContextMenu(null);
              }
            }}
            disabled={!contextMenu.canSplit}
          >
            {contextMenu.canSplit ? 'この便から新しい行路へ分離' : '最初の便は分離できません'}
          </button>
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
            onClick={() => openRouteOnMap(contextMenu.tripId)}
          >
            この便のルートを地図で表示
          </button>
        </div>
      ) : null}
      {contextMenu.type === 'interval' ? (
        <button
          type="button"
          className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
          onClick={() => handleRemoveInterval(contextMenu.blockId, contextMenu.intervalId)}
        >
          {contextMenu.kind === 'break' ? '休憩を削除' : '回送を削除'}
        </button>
      ) : null}
    </div>
  ) : null;

  const newLaneDropZone = (
    <div
      className="mt-4 rounded-md border border-dashed border-muted-foreground/60 p-4 text-center text-sm text-muted-foreground"
      onDragOver={(event) => {
        const types = Array.from(event.dataTransfer?.types ?? []);
        const isTripDrag = types.includes('application/x-trip-id') || types.includes('text/plain');
        if (isTripDrag) {
          event.preventDefault();
          if (!globalDropActive) setGlobalDropActive(true);
        }
      }}
      onDragLeave={() => {
        if (globalDropActive) setGlobalDropActive(false);
      }}
      onDrop={(event) => {
        const tripId = event.dataTransfer?.getData('application/x-trip-id') ?? event.dataTransfer?.getData('text/plain');
        if (!tripId) return;
        event.preventDefault();
        setGlobalDropActive(false);
        if (!result) {
          toast.error('GTFS データが読み込まれていません。');
          return;
        }
        const seed = buildSingleTripBlockSeed(result, tripId);
        if (!seed) {
          toast.error('便の情報を取得できませんでした。');
          return;
        }
        const created = manualPlanState.createBlockFromTrip(seed);
        if (created) {
          toast.success(`便 ${tripId} から新しい行路を作成しました。`);
        } else {
          toast.info('既に行路に含まれています。');
        }
      }}
    >
      新しい行路を作成する場合は便をここへドロップしてください。
    </div>
  );
  return (
    <DragBusProvider>
      <div
        className="relative space-y-6"
        data-testid="blocks-view-root"
        onContextMenu={() => {
          if (contextMenu) {
            setContextMenu(null);
          }
        }}
      >
        {validationBanner}

        <SummaryPanel plan={manualPlanState.plan} overlapMinutesByBlock={overlapMinutesByBlock} />

        <ManualConnectPanel
          manualPlanState={manualPlanState}
          fromBlockId={fromBlockId}
          toBlockId={toBlockId}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onConnect={handleConnect}
          onUndo={handleUndo}
          manualStatus={manualStatus}
        />

        <Card>
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>日別タイムライン</CardTitle>
              <CardDescription>行路ラベルをドラッグ＆ドロップで結合し、右クリックで休憩や回送を挿入できます。</CardDescription>
            </div>
            <Badge variant="outline">検証: OFF</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <DayFilter days={allDays} activeDay={activeDayIndex} onSelect={handleSelectDay} />
            <TimelineGantt
              lanes={timelineLanes}
              selectedLaneId={dropTargetBlockId ?? undefined}
              pixelsPerMinute={DEFAULT_PIXELS_PER_MINUTE}
              emptyMessage="タイムラインに表示できる行路がありません。"
              getLaneProps={getLaneProps}
              onSegmentDrag={handleTimelineSegmentDrag}
              onSegmentContextMenu={handleSegmentContextMenu}
              onLaneContextMenu={handleLaneContextMenu}
              onExternalDrop={handleExternalDrop}
              onExternalDragOver={() => {}}
              getSegmentProps={getSegmentPropsForDrag}
            />
            {newLaneDropZone}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={handleExportIntervals} disabled={Object.keys(blockIntervals).length === 0}>
            blocks_intervals.csv を出力
          </Button>
        </div>

        <UnassignedTable
          unassigned={manualPlanState.plan.unassignedTripIds}
          onCreateBlock={(tripId) => {
            if (!result) {
              toast.error('GTFS データが読み込まれていません。');
              return;
            }
            const seed = buildSingleTripBlockSeed(result, tripId);
            if (!seed) {
              toast.error('便の情報を取得できませんでした。');
              return;
            }
            const created = manualPlanState.createBlockFromTrip(seed);
            if (created) {
              toast.success(`便 ${tripId} を新しい行路に追加しました。`);
            } else {
              toast.info('既に行路に含まれています。');
            }
          }}
        />

        {contextMenuNode}

        {globalDropActive ? (
          <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
            <div className="mx-4 w-full max-w-3xl rounded-xl border-4 border-dashed border-primary/60 bg-primary/5 p-6 text-center text-sm text-primary">
              新しい行路として追加：このエリアでドロップすると便から新しい行路を作成します。
            </div>
          </div>
        ) : null}

        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>ルート地図</DialogTitle>
            </DialogHeader>
            {result && mapRouteId ? (
              <MapView
                dataset={buildExplorerDataset(result, { routeIds: [mapRouteId] })}
                onSelect={() => {}}
                showDepots={false}
                showReliefPoints={false}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">GTFS データが未読み込みです。</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DragBusProvider>
  );
}
interface SummaryPanelProps {
  plan: BlockPlan;
  overlapMinutesByBlock: Map<string, number>;
}

function SummaryPanel({ plan, overlapMinutesByBlock }: SummaryPanelProps): JSX.Element {
  const totalBlocks = plan.summaries.length;
  const totalTrips = plan.totalTripCount;
  const coverage = plan.coverageRatio * 100;
  const overlapTotal = Array.from(overlapMinutesByBlock.values()).reduce((acc, value) => acc + value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>サマリー</CardTitle>
        <CardDescription>行路生成の状況（検証OFF）</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="行路数" value={`${totalBlocks}`} />
        <StatCard label="便数" value={`${totalTrips}`} />
        <StatCard label="カバレッジ" value={`${coverage.toFixed(1)} %`} />
        <StatCard label="重複合計(分)" value={overlapTotal.toFixed(1)} trend="destructive" />
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  trend?: 'default' | 'secondary' | 'outline' | 'destructive';
}

function StatCard({ label, value, trend = 'outline' }: StatCardProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/60 p-4">
      <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
      <Badge variant={trend} className="w-fit text-base">
        {value}
      </Badge>
    </div>
  );
}

interface ManualConnectPanelProps {
  manualPlanState: ReturnType<typeof useManualBlocksPlan>;
  fromBlockId: string;
  toBlockId: string;
  onFromChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onToChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onConnect: () => void;
  onUndo: () => void;
  manualStatus: { type: 'success' | 'error'; message: string } | null;
}

function ManualConnectPanel({
  manualPlanState,
  fromBlockId,
  toBlockId,
  onFromChange,
  onToChange,
  onConnect,
  onUndo,
  manualStatus,
}: ManualConnectPanelProps): JSX.Element {
  const options = manualPlanState.plan.summaries;
  const canUndo = manualPlanState.connections.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>手動連結（検証OFF）</CardTitle>
          <CardDescription>From/To を選ぶか、タイムラインのラベルをドラッグ＆ドロップしてください。</CardDescription>
        </div>
        <Badge variant="outline">連結数: {manualPlanState.connections.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="blocks-manual-from" className="text-sm font-medium text-muted-foreground">
              連結元ブロック
            </label>
            <select
              id="blocks-manual-from"
              data-testid="blocks-manual-from"
              value={fromBlockId}
              onChange={onFromChange}
              className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">選択してください</option>
              {options.map((summary) => (
                <option key={summary.blockId} value={summary.blockId}>
                  {formatBlockOption(summary)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="blocks-manual-to" className="text-sm font-medium text-muted-foreground">
              連結先ブロック
            </label>
            <select
              id="blocks-manual-to"
              data-testid="blocks-manual-to"
              value={toBlockId}
              onChange={onToChange}
              className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">選択してください</option>
              {options
                .filter((summary) => summary.blockId !== fromBlockId)
                .map((summary) => (
                  <option key={summary.blockId} value={summary.blockId}>
                    {formatBlockOption(summary)}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" data-testid="blocks-manual-connect" onClick={onConnect}>
              連結
            </Button>
            <Button type="button" data-testid="blocks-manual-undo" onClick={onUndo} variant="outline" disabled={!canUndo}>
              取り消し
            </Button>
          </div>
        </div>
        {manualStatus ? (
          <p
            className={clsx(
              'text-sm',
              manualStatus.type === 'success' ? 'text-emerald-600' : 'text-destructive',
            )}
            data-testid="blocks-manual-status"
          >
            {manualStatus.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface DayFilterProps {
  days: ReturnType<typeof useBlocksPlan>['allDays'];
  activeDay: number | null;
  onSelect: (index: number | null) => void;
}

function DayFilter({ days, activeDay, onSelect }: DayFilterProps): JSX.Element {
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">表示可能なサービス日がありません。</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {days.map((day) => (
        <Button
          key={day.dayIndex}
          size="sm"
          variant={activeDay === day.dayIndex ? 'default' : 'outline'}
          onClick={() => onSelect(day.dayIndex)}
        >
          {day.label}
        </Button>
      ))}
      <Button size="sm" variant={activeDay === null ? 'default' : 'outline'} onClick={() => onSelect(null)}>
        全日表示
      </Button>
    </div>
  );
}

interface UnassignedTableProps {
  unassigned: string[];
  onCreateBlock?: (tripId: string) => void;
}

function UnassignedTable({ unassigned, onCreateBlock }: UnassignedTableProps): JSX.Element {
  const [isDropActive, setDropActive] = useState(false);

  const allowDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (unassigned.length === 0) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDropActive) {
      setDropActive(true);
    }
  };

  const resetDropState = () => {
    if (isDropActive) {
      setDropActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (unassigned.length === 0) {
      return;
    }
    event.preventDefault();
    resetDropState();
    const tripId =
      event.dataTransfer?.getData('application/x-trip-id') ?? event.dataTransfer?.getData('text/plain');
    if (tripId) {
      onCreateBlock?.(tripId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>未割当の便</CardTitle>
        <CardDescription>便をドラッグすると新しい行路を作成できます。ボタンから単独で作成することも可能です。</CardDescription>
      </CardHeader>
      <CardContent>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">未割当の便はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className={clsx(
                'mb-4 rounded-md border border-dashed p-4 text-sm transition',
                isDropActive ? 'border-primary bg-primary/10 text-primary-foreground' : 'border-border/70 bg-muted/30',
              )}
              onDragOver={allowDrop}
              onDragEnter={allowDrop}
              onDragLeave={resetDropState}
              onDrop={handleDrop}
              data-testid="blocks-unassigned-dropzone"
            >
              未割当の便をここへドラッグすると新しい行路を作成します。
            </div>
            <div className="space-y-2">
              {unassigned.map((tripId) => (
                <div key={tripId} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <button
                    type="button"
                    className="cursor-grab text-primary"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer?.setData('application/x-trip-id', tripId);
                      event.dataTransfer?.setData('text/plain', tripId);
                      event.dataTransfer?.setDragImage(event.currentTarget, 0, 0);
                      event.dataTransfer.effectAllowed = 'copy';
                      setDropActive(true);
                    }}
                    onDragEnd={resetDropState}
                  >
                    {tripId}
                  </button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onCreateBlock?.(tripId)}>
                    新しい行路を作成
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatBlockOption(summary: BlockSummary): string {
  return `${formatServiceDay(summary.serviceDayIndex)} - ${summary.blockId}（便数 ${summary.tripCount}）`;
}

function formatServiceDay(index: number): string {
  return `サービス日 ${index + 1}`;
}


