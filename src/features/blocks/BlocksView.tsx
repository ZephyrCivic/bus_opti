/**
 * src/features/blocks/BlocksView.tsx
 * ブロック（行路）編集結果を確認し、ターン間隔や重複状況を把握する画面。
 * タイムライン、統計カード、詳細テーブル、未割当便一覧を提供する。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TimelineGantt, {
  type TimelineLaneContextMenuEvent,
  type TimelineLaneProps,
  type TimelineSegmentContextMenuEvent,
} from '@/features/timeline/TimelineGantt';
import { DEFAULT_PIXELS_PER_MINUTE, parseTimeLabel } from '@/features/timeline/timeScale';
import type { TimelineLane, TimelineSegment, TimelineSegmentDragEvent } from '@/features/timeline/types';
import {
  buildBlocksPlan,
  buildSingleTripBlockSeed,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockCsvRow,
  type BlockPlan,
  type BlockSummary,
} from '@/services/blocks/blockBuilder';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { useBlocksPlan } from './hooks/useBlocksPlan';
import { useManualBlocksPlan } from './hooks/useManualBlocksPlan';
import { isStepOne } from '@/config/appStep';
import { buildBlocksMetaCsv } from '@/services/export/blocksMetaCsv';
import { downloadCsv } from '@/utils/downloadCsv';
import { useExportConfirmation } from '@/components/export/ExportConfirmationProvider';
import { recordAuditEvent } from '@/services/audit/auditLog';
import { toast } from 'sonner';
import type { BlockMetaEntry } from '@/types';
import { cloneBlockPlan } from '@/services/blocks/manualPlan';

const TIMELINE_AXIS_LABELS = {
  block: '行路ID',
  vehicle: '車両ID',
} as const;

type TimelineAxisMode = keyof typeof TIMELINE_AXIS_LABELS;

const DEFAULT_INTERVAL_MINUTES = 10;
const DEADHEAD_COLOR = '#60a5fa';
const BREAK_COLOR = '#f97316';

interface BlockInterval {
  id: string;
  kind: 'break' | 'deadhead';
  startMinutes: number;
  endMinutes: number;
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
  const { result, manual, setManual, manualBlockPlan, setManualBlockPlan } = useGtfsImport();
  const turnGap = DEFAULT_MAX_TURN_GAP_MINUTES;
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [fromBlockId, setFromBlockId] = useState<string>('');
  const [toBlockId, setToBlockId] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [timelineAxis, setTimelineAxis] = useState<TimelineAxisMode>('block');
  const [globalDropActive, setGlobalDropActive] = useState(false);
  const [blockIntervals, setBlockIntervals] = useState<Record<string, BlockInterval[]>>({});
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<BlockContextMenuState | null>(null);
  const blockMeta = manual.blockMeta ?? {};
  const vehicleTypeOptions = useMemo(
    () =>
      manual.vehicleTypes.map((type) => ({
        value: type.typeId,
        label: type.name ? `${type.typeId}（${type.name}）` : type.typeId,
      })),
    [manual.vehicleTypes],
  );
  const vehicleIdOptions = useMemo(
    () =>
      manual.vehicles.map((vehicle) => ({
        value: vehicle.vehicleId,
        label: vehicle.vehicleTypeId ? `${vehicle.vehicleId}（${vehicle.vehicleTypeId}）` : vehicle.vehicleId,
      })),
    [manual.vehicles],
  );
  const { requestConfirmation } = useExportConfirmation();

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
    }),
    [],
  );
  const manualPlanState = useManualBlocksPlan(initialPlan, manualPlanConfig);
  const { days, allDays, overlaps } = useBlocksPlan(manualPlanState.plan, { activeDay: activeDayIndex ?? undefined });

  useEffect(
    () => () => {
      setManualBlockPlan(cloneBlockPlan(manualPlanState.plan));
    },
    [manualPlanState.plan, setManualBlockPlan],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_BLOCKS_CREATE_FROM_TRIP?: (tripId: string) => boolean;
    };
    testWindow.__TEST_BLOCKS_CREATE_FROM_TRIP = (tripId: string) => {
      if (!result) {
        console.debug('[test:createBlockFromTrip] result not ready');
        return false;
      }
      const seed = buildSingleTripBlockSeed(result, tripId);
      if (!seed) {
        console.debug('[test:createBlockFromTrip] seed not found', tripId);
        return false;
      }
      const hasTrip = manualPlanState.plan.unassignedTripIds.includes(tripId);
      console.debug(
        '[test:createBlockFromTrip] attempt',
        tripId,
        'unassignedIncludes',
        hasTrip,
        'unassignedCount',
        manualPlanState.plan.unassignedTripIds.length,
      );
      const created = manualPlanState.createBlockFromTrip(seed);
      console.debug('[test:createBlockFromTrip] created', tripId, created);
      return created;
    };
    return () => {
      const globalWindow = window as typeof window & {
        __TEST_BLOCKS_CREATE_FROM_TRIP?: (tripId: string) => boolean;
      };
      delete globalWindow.__TEST_BLOCKS_CREATE_FROM_TRIP;
    };
  }, [manualPlanState.createBlockFromTrip, result]);

  useEffect(() => {
    const blockIds = new Set(manualPlanState.plan.summaries.map((summary) => summary.blockId));
    setFromBlockId((current) => (current && !blockIds.has(current) ? '' : current));
  setToBlockId((current) => (current && !blockIds.has(current) ? '' : current));
}, [manualPlanState.plan]);

  useEffect(() => {
    const validBlockIds = new Set(manualPlanState.plan.summaries.map((summary) => summary.blockId));
    setBlockIntervals((current) => {
      const entries = Object.entries(current).filter(([blockId]) => validBlockIds.has(blockId));
      if (entries.length === Object.keys(current).length) {
        return current;
      }
      const next: Record<string, BlockInterval[]> = {};
      for (const [blockId, intervals] of entries) {
        next[blockId] = intervals;
      }
      return next;
    });
    setContextMenu((state) => {
      if (!state) {
        return state;
      }
      if (!validBlockIds.has(state.blockId)) {
        return null;
      }
      return state;
    });
  }, [manualPlanState.plan.summaries]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleGlobalClose = () => setContextMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClose);
    window.addEventListener('contextmenu', handleGlobalClose);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleGlobalClose);
      window.removeEventListener('contextmenu', handleGlobalClose);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    const validBlockIds = new Set(manualPlanState.plan.summaries.map((summary) => summary.blockId));
    setManual((prev) => {
      const prevMeta = prev.blockMeta ?? {};
      let changed = false;
      const nextMeta: Record<string, BlockMetaEntry> = {};
      for (const [blockId, entry] of Object.entries(prevMeta)) {
        if (validBlockIds.has(blockId)) {
          nextMeta[blockId] = entry;
        } else {
          changed = true;
        }
      }
      if (!changed) {
        return prev;
      }
      return { ...prev, blockMeta: nextMeta };
    });
  }, [manualPlanState.plan.summaries, setManual]);

  const manualBlockSummaries = useMemo(
    () =>
      [...manualPlanState.plan.summaries].sort((a, b) => {
        if (a.serviceDayIndex !== b.serviceDayIndex) {
          return a.serviceDayIndex - b.serviceDayIndex;
        }
        return a.firstTripStart.localeCompare(b.firstTripStart);
      }),
    [manualPlanState.plan],
  );

  const summaryByBlockId = useMemo(() => {
    return new Map(manualPlanState.plan.summaries.map((summary) => [summary.blockId, summary] as const));
  }, [manualPlanState.plan.summaries]);

  const manualToSummaries = useMemo(() => {
    if (!fromBlockId) {
      return manualBlockSummaries;
    }
    const candidates = manualPlanState.candidatesFor(fromBlockId);
    if (!candidates || candidates.length === 0) {
      return [];
    }
    const candidateIds = new Set(candidates.map((candidate) => candidate.blockId));
    return manualBlockSummaries.filter((summary) => candidateIds.has(summary.blockId));
  }, [manualBlockSummaries, manualPlanState.candidatesFor, fromBlockId]);

  const handleFromChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFromBlockId(value);
    setManualStatus(null);
    setToBlockId('');
  };

  const handleToChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setToBlockId(value);
    setManualStatus(null);
  };

  const handleConnect = () => {
    if (!fromBlockId || !toBlockId) {
      setManualStatus({ type: 'error', message: '連結元と連結先を選択してください。' });
      return;
    }
    const succeeded = manualPlanState.connect(fromBlockId, toBlockId);
    if (succeeded) {
      setManualStatus({ type: 'success', message: `${fromBlockId} と ${toBlockId} を連結しました。` });
      setToBlockId('');
    } else {
      setManualStatus({ type: 'error', message: '連結できませんでした。サービス日と時刻を確認してください。' });
    }
  };

  const connectBlocksByTimeline = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) {
        return;
      }
      const succeeded = manualPlanState.connect(sourceId, targetId);
      if (succeeded) {
        setManualStatus({ type: 'success', message: `${sourceId} と ${targetId} を連結しました。` });
        toast.success(`${sourceId} と ${targetId} を連結しました。`);
      } else {
        setManualStatus({ type: 'error', message: '連結できませんでした。サービス日と時刻を確認してください。' });
        toast.error('連結できませんでした。サービス日と時刻を確認してください。');
      }
    },
    [manualPlanState],
  );

  const handleSplitBlock = useCallback(
    (blockId: string, tripId: string) => {
      const split = manualPlanState.splitBlock(blockId, tripId);
      setContextMenu(null);
      if (split) {
        toast.success(`便 ${tripId} 以降を新しい行路として分離しました。`);
      } else {
        toast.error('分離できませんでした。対象の便と行路を確認してください。');
      }
    },
    [manualPlanState],
  );

  const handleAddInterval = useCallback(
    (blockId: string, kind: 'break' | 'deadhead', minutes: number) => {
      const summary = summaryByBlockId.get(blockId);
      const blockStart = summary ? parseTimeLabel(summary.firstTripStart) ?? 0 : 0;
      const blockEnd = summary ? parseTimeLabel(summary.lastTripEnd) ?? 24 * 60 : 24 * 60;
      const minBound = Math.max(0, Math.min(blockStart, minutes) - 60);
      const maxBound = Math.min(24 * 60, Math.max(blockEnd, minutes) + 60);
      let start = Math.max(minBound, Math.min(minutes, maxBound - 1));
      let end = start + DEFAULT_INTERVAL_MINUTES;
      if (end > maxBound) {
        end = maxBound;
        start = Math.max(minBound, end - DEFAULT_INTERVAL_MINUTES);
      }
      if (end <= start) {
        end = Math.min(maxBound, start + 1);
      }
      const interval: BlockInterval = {
        id: `interval-${crypto.randomUUID()}`,
        kind,
        startMinutes: Number(start.toFixed(2)),
        endMinutes: Number(end.toFixed(2)),
      };
      setBlockIntervals((current) => {
        const next = { ...current };
        const existing = next[blockId] ?? [];
        next[blockId] = [...existing, interval];
        return next;
      });
      setContextMenu(null);
      toast.success(kind === 'break' ? '休憩区間を追加しました。' : '回送区間を追加しました。');
    },
    [summaryByBlockId],
  );

  const handleRemoveInterval = useCallback((blockId: string, intervalId: string) => {
    setBlockIntervals((current) => {
      const existing = current[blockId];
      if (!existing) {
        return current;
      }
      const nextIntervals = existing.filter((interval) => interval.id !== intervalId);
      const next = { ...current };
      if (nextIntervals.length > 0) {
        next[blockId] = nextIntervals;
      } else {
        delete next[blockId];
      }
      return next;
    });
    setContextMenu(null);
    toast.success('区間を削除しました。');
  }, []);

  const handleTimelineSegmentDrag = useCallback(
    (event: TimelineSegmentDragEvent<BlockTimelineSegmentMeta>) => {
      const meta = event.segment.meta;
      if (!meta) {
        return;
      }
      if (meta.type === 'trip') {
        toast.info('便の位置はタイムライン上で直接移動できません。');
        return;
      }
      let updated = false;
      setBlockIntervals((current) => {
        const intervals = current[meta.blockId];
        if (!intervals) {
          return current;
        }
        const index = intervals.findIndex((interval) => interval.id === meta.intervalId);
        if (index === -1) {
          return current;
        }
        const summary = summaryByBlockId.get(meta.blockId);
        const blockStart = summary ? parseTimeLabel(summary.firstTripStart) ?? 0 : 0;
        const blockEnd = summary ? parseTimeLabel(summary.lastTripEnd) ?? 24 * 60 : 24 * 60;
        const minBound = Math.max(0, blockStart - 60);
        const maxBound = Math.min(24 * 60, blockEnd + 60);
        const target = { ...intervals[index]! };
        const originalDuration = Math.max(1, target.endMinutes - target.startMinutes);

        if (event.mode === 'move') {
          let nextStart = target.startMinutes + event.deltaMinutes;
          nextStart = Math.max(minBound, Math.min(nextStart, maxBound - originalDuration));
          const nextEnd = Math.min(maxBound, nextStart + originalDuration);
          target.startMinutes = Number(nextStart.toFixed(2));
          target.endMinutes = Number(nextEnd.toFixed(2));
        } else if (event.mode === 'resize-start') {
          let nextStart = target.startMinutes + event.deltaMinutes;
          nextStart = Math.max(minBound, Math.min(nextStart, target.endMinutes - 1));
          target.startMinutes = Number(nextStart.toFixed(2));
        } else if (event.mode === 'resize-end') {
          let nextEnd = target.endMinutes + event.deltaMinutes;
          nextEnd = Math.min(maxBound, Math.max(nextEnd, target.startMinutes + 1));
          target.endMinutes = Number(nextEnd.toFixed(2));
        }

        if (target.endMinutes - target.startMinutes < 1) {
          target.endMinutes = Number((target.startMinutes + 1).toFixed(2));
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
    [summaryByBlockId],
  );

  const handleSegmentContextMenu = useCallback(
    (event: TimelineSegmentContextMenuEvent<BlockTimelineSegmentMeta>) => {
      const meta = event.segment.meta;
      if (!meta) {
        return;
      }
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
      if (meta.type === 'break' || meta.type === 'deadhead') {
        setContextMenu({
          type: 'interval',
          blockId: meta.blockId,
          intervalId: meta.intervalId,
          kind: meta.type,
          position: { x: event.clientX, y: event.clientY },
        });
      }
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
              connectBlocksByTimeline(sourceId, lane.id);
            }
          },
          className: clsx(isDropTarget && 'ring-2 ring-primary/50'),
        },
      };
    },
    [dropTargetBlockId, draggingBlockId, connectBlocksByTimeline],
  );

  const handleUndo = () => {
    const undone = manualPlanState.undoLastConnection();
    if (undone) {
      setManualStatus({ type: 'success', message: '直前の連結を取り消しました。' });
    } else {
      setManualStatus({ type: 'error', message: '取り消す連結がありません。' });
    }
  };

  const handleCreateBlockFromTrip = useCallback(
    (tripId: string) => {
      if (!result) {
        toast.error('GTFSデータが読み込まれていません。');
        return;
      }
      const seed = buildSingleTripBlockSeed(result, tripId);
      if (!seed) {
        toast.error(`便 ${tripId} の情報を復元できませんでした。`);
        return;
      }
      const created = manualPlanState.createBlockFromTrip(seed);
      if (created) {
        toast.success(`便 ${tripId} から新しい行路を作成しました。`);
      } else {
        toast.info('この便は既に行路に割り当てられています。');
      }
    },
    [manualPlanState, result],
  );

  const handleBlockMetaChange = useCallback(
    (blockId: string, field: 'vehicleTypeId' | 'vehicleId', value: string) => {
      const normalized = value.trim();
      setManual((prev) => {
        const prevMeta = prev.blockMeta ?? {};
        const currentEntry = prevMeta[blockId] ?? {};
        const nextEntry: BlockMetaEntry = { ...currentEntry };

        if (field === 'vehicleTypeId') {
          if (normalized.length > 0) {
            nextEntry.vehicleTypeId = normalized;
          } else {
            delete nextEntry.vehicleTypeId;
          }
        } else if (field === 'vehicleId') {
          if (normalized.length > 0) {
            nextEntry.vehicleId = normalized;
          } else {
            delete nextEntry.vehicleId;
          }
        }

        const hasValue =
          (nextEntry.vehicleTypeId && nextEntry.vehicleTypeId.length > 0) ||
          (nextEntry.vehicleId && nextEntry.vehicleId.length > 0);

        const prevEntry = prevMeta[blockId];
        if (!hasValue) {
          if (!prevEntry) {
            return prev;
          }
          const { [blockId]: _removed, ...rest } = prevMeta;
          return { ...prev, blockMeta: rest };
        }

        if (
          prevEntry?.vehicleTypeId === nextEntry.vehicleTypeId &&
          prevEntry?.vehicleId === nextEntry.vehicleId
        ) {
          return prev;
        }

        return {
          ...prev,
          blockMeta: {
            ...prevMeta,
            [blockId]: nextEntry,
          },
        };
      });
    },
    [setManual],
  );

  const handleExportMeta = useCallback(() => {
    if (manualPlanState.plan.summaries.length === 0) {
      toast.info('行路が存在しないため、出力できるデータがありません。');
      return;
    }
    const preview = buildBlocksMetaCsv({
      plan: manualPlanState.plan,
      blockMeta,
    });
    requestConfirmation({
      title: 'blocks_meta.csv を出力しますか？',
      description: '行路ごとの車両タイプ・車両IDの記録を CSV で保存します。',
      summary: {
        hardWarnings: 0,
        softWarnings: 0,
        unassigned: manualPlanState.plan.unassignedTripIds.length,
      },
      context: { entity: 'blocks', exportType: 'blocks-meta-csv', fileName: preview.fileName },
      onConfirm: () => {
        const latest = buildBlocksMetaCsv({
          plan: manualPlanState.plan,
          blockMeta,
        });
        downloadCsv({ fileName: latest.fileName, content: latest.csv });
        recordAuditEvent({
          entity: 'blocks',
          fileName: latest.fileName,
          rowCount: latest.rowCount,
          generatedAt: latest.generatedAt,
          format: 'csv',
        });
        toast.success(`blocks_meta.csv をダウンロードしました（${latest.rowCount} 行）。`);
      },
    });
  }, [blockMeta, manualPlanState.plan, requestConfirmation]);

  const canConnect = fromBlockId !== '' && toBlockId !== '';
  const canUndo = manualPlanState.connections.length > 0;

  useEffect(() => {
    if (toBlockId && !manualToSummaries.some((summary) => summary.blockId === toBlockId)) {
      setToBlockId('');
    }
  }, [manualToSummaries, toBlockId]);

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
  }, [manualPlanState.plan, overlaps]);

  const visibleSummaries = useMemo(
    () => days.flatMap((day) => day.summaries),
    [days],
  );

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
      const meta = blockMeta[summary.blockId];
      const laneLabel = formatTimelineLaneLabel(summary, meta, timelineAxis);
      const vehicleTypeLabel = meta?.vehicleTypeId?.trim();
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
          const duration = Math.max(interval.endMinutes - interval.startMinutes, 0);
          const minutesLabel = Math.max(1, Math.round(duration));
          const safeEnd = Math.max(interval.endMinutes, interval.startMinutes + 1);
          return {
            id: interval.id,
            label: `${interval.kind === 'break' ? '休憩' : '回送'} ${minutesLabel}分`,
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

      const segments = [...tripSegments, ...intervalSegments].sort(
        (a, b) => a.startMinutes - b.startMinutes,
      );

      if (segments.length === 0) {
        const startMinutes = parseTimeLabel(summary.firstTripStart);
        const endMinutes = parseTimeLabel(summary.lastTripEnd);
        if (startMinutes === undefined || endMinutes === undefined) {
          return lanes;
        }
        const safeEnd = Math.max(endMinutes, startMinutes + 1);
        segments.push({
          id: `${summary.blockId}-window`,
          label:
            timelineAxis === 'vehicle'
              ? `${summary.blockId}: ${summary.firstTripStart} ~ ${summary.lastTripEnd}`
              : `${summary.firstTripStart} ~ ${summary.lastTripEnd}`,
          startMinutes,
          endMinutes: safeEnd,
          color: baseColor,
          meta: {
            type: 'trip',
            blockId: summary.blockId,
            tripId: `${summary.blockId}-window`,
            seq: 1,
            startMinutes,
            endMinutes: safeEnd,
          },
        });
      }

      lanes.push({
        id: summary.blockId,
        label: laneLabel,
        tag: vehicleTypeLabel
          ? {
              label: vehicleTypeLabel,
              title: `想定車両タイプ: ${vehicleTypeLabel}`,
            }
          : undefined,
        segments,
      });
      return lanes;
    }, []);
  }, [
    visibleSummaries,
    blockRowsById,
    blockIntervals,
    overlapMinutesByBlock,
    blockMeta,
    timelineAxis,
  ]);

  return (
    <div
      className="relative space-y-6"
      data-testid="blocks-view-root"
      onDragOver={(event) => {
        // 未割当便のドラッグ時のみドロップを許可
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
        const tripId =
          event.dataTransfer?.getData('application/x-trip-id') ?? event.dataTransfer?.getData('text/plain');
        if (tripId) {
          event.preventDefault();
          setGlobalDropActive(false);
          // 未割当便→新規行路の作成を実行
          void (async () => {
            try {
              const seed = await buildSingleTripBlockSeed(result, tripId);
              if (!seed) {
                toast.error(`trip_id=${tripId} の行路シードを生成できませんでした。`);
                return;
              }
              const created = manualPlanState.createBlockFromTrip(seed);
              if (created) {
                toast.success('新しい行路を作成しました。');
              } else {
                toast.error('新しい行路を作成できませんでした。割当済みの可能性があります。');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : '行路の作成に失敗しました。';
              toast.error(message);
            }
          })();
        }
      }}
    >
      {contextMenu ? (
        <div
          className="fixed z-50 min-w-[220px] overflow-hidden rounded-md border border-border/60 bg-card shadow-lg"
          style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div className="flex flex-col text-sm">
            {contextMenu.type === 'lane' ? (
              <>
                <button
                  type="button"
                  className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
                  onClick={() => handleAddInterval(contextMenu.blockId, 'break', contextMenu.minutes)}
                >
                  休憩をこの位置に追加
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-left hover:bg-muted focus:outline-none"
                  onClick={() => handleAddInterval(contextMenu.blockId, 'deadhead', contextMenu.minutes)}
                >
                  回送をこの位置に追加
                </button>
              </>
            ) : null}
            {contextMenu.type === 'trip' ? (
              <button
                type="button"
                className={clsx(
                  'px-3 py-2 text-left focus:outline-none',
                  contextMenu.canSplit ? 'hover:bg-muted' : 'cursor-not-allowed text-muted-foreground',
                )}
                onClick={() => {
                  if (contextMenu.canSplit) {
                    handleSplitBlock(contextMenu.blockId, contextMenu.tripId);
                  }
                }}
                disabled={!contextMenu.canSplit}
              >
                {contextMenu.canSplit ? 'この便から新しい行路へ分離' : '最初の便は分離できません'}
              </button>
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
        </div>
      ) : null}

      {globalDropActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="mx-4 w-full max-w-3xl rounded-xl border-4 border-dashed border-primary/60 bg-primary/5 p-6 text-center text-sm text-primary">
            未割当の便をここにドロップすると、新規行路を作成します。
          </div>
        </div>
      ) : null}
      <div>
        <h2 className="text-lg font-semibold">行路編集</h2>
        <p className="text-sm text-muted-foreground">
          GTFS 取込データの便を可視化し、ターン間隔（現在 {manualPlanState.plan.maxTurnGapMinutes} 分）と重複状況を確認します。手動連結の判断材料として活用してください。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>手動連結（最小UI）</CardTitle>
            <CardDescription>
              Step1 では From/To 選択に加えて、タイムライン左側の行路ラベルをドラッグ＆ドロップするとブロック同士を連結できます。
              未割当便をタイムラインへドラッグすると新規行路カードを作成できます。
              画面全体がドロップターゲットになっているため、未割当便の行をそのままタイムラインへドロップしてください。
            </CardDescription>
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
                onChange={handleFromChange}
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">選択してください</option>
                {manualBlockSummaries.map((summary) => (
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
                onChange={handleToChange}
                disabled={fromBlockId === ''}
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">選択してください</option>
                {manualToSummaries
                  .filter((summary) => summary.blockId !== fromBlockId)
                  .map((summary) => (
                    <option key={summary.blockId} value={summary.blockId}>
                      {formatBlockOption(summary)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                data-testid="blocks-manual-connect"
                onClick={handleConnect}
                disabled={!canConnect}
              >
                連結
              </Button>
              <Button
                type="button"
                data-testid="blocks-manual-undo"
                onClick={handleUndo}
                variant="outline"
                disabled={!canUndo}
              >
                取り消し
              </Button>
            </div>
          </div>
          {manualStatus && (
            <p
              className={`text-sm ${
                manualStatus.type === 'success' ? 'text-emerald-600' : 'text-destructive'
              }`}
              data-testid="blocks-manual-status"
            >
              {manualStatus.message}
            </p>
          )}
        </CardContent>
      </Card>

        <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>日別タイムライン</CardTitle>
            <CardDescription>サービス日ごとのブロック稼働時間と重複を視覚化します（表示軸は行路ID/車両IDで切替可能）。</CardDescription>
          </div>
          <Badge variant="outline">サービス日数: {allDays.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {allDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">サービス日の集計がありません。GTFS フィードを取り込んでください。</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {allDays.map((day) => (
                    <Button
                      key={day.dayIndex}
                      size="sm"
                      variant={activeDayIndex === day.dayIndex ? 'default' : 'outline'}
                      onClick={() => setActiveDayIndex(day.dayIndex)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>表示軸</span>
                  <div className="flex items-center gap-1" role="group" aria-label="タイムライン表示軸">
                    {(Object.keys(TIMELINE_AXIS_LABELS) as TimelineAxisMode[]).map((axis) => (
                      <Button
                        key={axis}
                        type="button"
                        size="sm"
                        variant={timelineAxis === axis ? 'default' : 'outline'}
                        className="h-7 px-3 text-xs"
                        aria-pressed={timelineAxis === axis}
                        onClick={() => setTimelineAxis(axis)}
                      >
                        {TIMELINE_AXIS_LABELS[axis]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <TimelineGantt
                lanes={timelineLanes}
                selectedLaneId={dropTargetBlockId ?? undefined}
                pixelsPerMinute={DEFAULT_PIXELS_PER_MINUTE}
                emptyMessage="選択したサービス日に表示できるブロックがありません。"
                getLaneProps={getLaneProps}
                onSegmentDrag={handleTimelineSegmentDrag}
                onSegmentContextMenu={handleSegmentContextMenu}
                onLaneContextMenu={handleLaneContextMenu}
              />
            </>
          )}
        </CardContent>
      </Card>

      <BlocksTable
        summaries={manualPlanState.plan.summaries}
        overlapMinutesByBlock={overlapMinutesByBlock}
        blockMeta={blockMeta}
        vehicleTypeOptions={vehicleTypeOptions}
        vehicleIdOptions={vehicleIdOptions}
        onUpdateBlockMeta={handleBlockMetaChange}
        onExportMeta={handleExportMeta}
      />
      <UnassignedTable
        unassigned={manualPlanState.plan.unassignedTripIds}
        onCreateBlock={handleCreateBlockFromTrip}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  trend?: 'default' | 'secondary' | 'outline';
}

function StatCard({ label, value, trend = 'outline' }: StatCardProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-4">
      <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
      <Badge variant={trend} className="w-fit text-base">
        {value}
      </Badge>
    </div>
  );
}

interface BlocksTableProps {
  summaries: BlockSummary[];
  overlapMinutesByBlock: Map<string, number>;
  blockMeta: Record<string, BlockMetaEntry | undefined>;
  vehicleTypeOptions: Array<{ value: string; label: string }>;
  vehicleIdOptions: Array<{ value: string; label: string }>;
  onUpdateBlockMeta: (blockId: string, field: 'vehicleTypeId' | 'vehicleId', value: string) => void;
  onExportMeta: () => void;
}

function BlocksTable({
  summaries,
  overlapMinutesByBlock,
  blockMeta,
  vehicleTypeOptions,
  vehicleIdOptions,
  onUpdateBlockMeta,
  onExportMeta,
}: BlocksTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>ブロック一覧</CardTitle>
          <CardDescription>
            行路単位で想定車両タイプ・車両IDを記録し、CSV へ出力できます。未入力のままでも保存・出力は可能です。
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onExportMeta} disabled={summaries.length === 0}>
            blocks_meta.csv を出力
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">ブロックの計算結果がありません。GTFS フィードを取り込んでください。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>行路ID</TableHead>
                  <TableHead>サービスID</TableHead>
                  <TableHead>サービス日</TableHead>
                  <TableHead>便数</TableHead>
                  <TableHead>想定車両タイプ</TableHead>
                  <TableHead>車両ID</TableHead>
                  <TableHead>始発時刻</TableHead>
                  <TableHead>最終時刻</TableHead>
                  <TableHead>平均ターン (分)</TableHead>
                  <TableHead>最大ターン (分)</TableHead>
                  <TableHead>重複合計 (分)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((summary) => {
                  const averageGap =
                    summary.gaps.length === 0
                      ? 0
                      : Math.round(summary.gaps.reduce((acc, gap) => acc + gap, 0) / summary.gaps.length);
                  const maxGap = summary.gaps.length === 0 ? 0 : Math.max(...summary.gaps);
                  const overlapMinutes = overlapMinutesByBlock.get(summary.blockId) ?? 0;
                  const meta = blockMeta[summary.blockId] ?? {};
                  return (
                    <TableRow key={summary.blockId} data-block-id={summary.blockId}>
                      <TableCell className="font-medium">{summary.blockId}</TableCell>
                      <TableCell>{summary.serviceId ?? '未設定'}</TableCell>
                      <TableCell>{formatServiceDay(summary.serviceDayIndex)}</TableCell>
                      <TableCell>{summary.tripCount}</TableCell>
                      <TableCell className="min-w-[10rem]">
                        <Input
                          value={meta.vehicleTypeId ?? ''}
                          onChange={(event) =>
                            onUpdateBlockMeta(summary.blockId, 'vehicleTypeId', event.target.value)
                          }
                          placeholder="例: M"
                          list="block-meta-vehicle-type-options"
                          autoComplete="off"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="min-w-[10rem]">
                        <Input
                          value={meta.vehicleId ?? ''}
                          onChange={(event) =>
                            onUpdateBlockMeta(summary.blockId, 'vehicleId', event.target.value)
                          }
                          placeholder="例: BUS_001"
                          list="block-meta-vehicle-id-options"
                          autoComplete="off"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>{summary.firstTripStart}</TableCell>
                      <TableCell>{summary.lastTripEnd}</TableCell>
                      <TableCell>{averageGap}</TableCell>
                      <TableCell>{maxGap}</TableCell>
                      <TableCell>{overlapMinutes.toFixed(1)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <datalist id="block-meta-vehicle-type-options">
              {vehicleTypeOptions.map((option) => (
                <option key={option.value} value={option.value} label={option.label} />
              ))}
            </datalist>
            <datalist id="block-meta-vehicle-id-options">
              {vehicleIdOptions.map((option) => (
                <option key={option.value} value={option.value} label={option.label} />
              ))}
            </datalist>
          </div>
        )}
      </CardContent>
    </Card>
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
        <CardTitle>未割当 便</CardTitle>
        <CardDescription>
          ブロックに割り当てられていない便を一覧で確認できます。便をタイムラインへドラッグすると新規行路カードが作成されます（各行の「新規行路」ボタンでも同じ処理を実行できます）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">未割当の便はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className={`mb-4 rounded-md border border-dashed p-4 text-sm ${
                isDropActive ? 'border-primary bg-primary/10 text-primary-foreground' : 'border-border/70 bg-muted/30'
              }`}
              onDragOver={allowDrop}
              onDragEnter={allowDrop}
              onDragLeave={resetDropState}
              onDrop={handleDrop}
              data-testid="blocks-unassigned-dropzone"
            >
              未割当便をここにドラッグすると、新規行路カードを作成できます。
            </div>
            <Table data-testid="blocks-unassigned-table">
              <TableHeader>
                <TableRow>
                  <TableHead>trip_id</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassigned.map((tripId) => (
                  <TableRow
                    key={tripId}
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
                    <TableCell>{tripId}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => onCreateBlock?.(tripId)}>
                        新規行路
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function formatBlockOption(summary: BlockSummary): string {
  return `${formatServiceDay(summary.serviceDayIndex)} - ${summary.blockId}（便 ${summary.tripCount} 件）`;
}

function formatServiceDay(index: number): string {
  return `サービス日 ${index + 1}`;
}

function formatTimelineLaneLabel(
  summary: BlockSummary,
  meta: BlockMetaEntry | undefined,
  axis: TimelineAxisMode,
): string {
  if (axis === 'vehicle') {
    const vehicleId = meta?.vehicleId?.trim();
    if (vehicleId && vehicleId.length > 0) {
      return `${vehicleId}（行路 ${summary.blockId}）`;
    }
    return `${summary.blockId}（車両未設定）`;
  }
  return `${summary.blockId}（便 ${summary.tripCount} 件）`;
}
