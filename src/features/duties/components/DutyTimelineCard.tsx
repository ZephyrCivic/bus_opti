/**
 * src/features/duties/components/DutyTimelineCard.tsx
 * Duty タイムライン操作用のカード。CSV 入出力と区間操作、タイムライン描画をまとめて提供する。
 */
import { forwardRef, useCallback, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, SVGProps as ReactSVGProps } from 'react';
import { PauseCircle, BusFront, GripHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ExportBar from '@/components/export/ExportBar';
import TimelineGantt, { type TimelineExternalPreviewContext } from '@/features/timeline/TimelineGantt';
import type {
  TimelineInteractionEvent,
  TimelineLane,
  TimelineSelection,
  TimelineSegmentDragEvent,
  TimelineExternalDropEvent,
  TimelineExternalDragOverEvent,
} from '@/features/timeline/types';
import { useOptionalDragBus } from '@/features/timeline/dragBus';
import type { DutyTimelineMeta } from '../hooks/useDutyTimelineData';

type BlockTimelineMeta = {
  kind: 'block-trip';
  blockId: string;
  tripId: string;
  serviceDayIndex: number;
};

interface DutyTimelineCardProps {
  heading?: string;
  description?: string;
  onImportClick: () => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onAdd: () => void;
  onAddBreak: () => void;
  onAddDeadhead: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAutoCorrect: () => void;
  onUndo: () => void;
  onRedo: () => void;
  lanes: TimelineLane<DutyTimelineMeta>[];
  pixelsPerMinute: number;
  onInteraction: (event: TimelineInteractionEvent) => void;
  onSegmentDrag: (event: TimelineSegmentDragEvent<DutyTimelineMeta>) => void;
  onSelect: (selection: TimelineSelection) => void;
  warningTotals?: { hard: number; soft: number };
  blockLanes?: TimelineLane<BlockTimelineMeta>[];
  onBlockSelect?: (blockId: string) => void;
  selectedBlockId?: string | null;
  selectedDutyId?: string | null;
  selectedSegmentId?: string | null;
  showWarnings?: boolean;
  onExternalDrop?: (event: TimelineExternalDropEvent<DutyTimelineMeta>) => boolean | void;
  onExternalDragOver?: (event: TimelineExternalDragOverEvent<DutyTimelineMeta>) => void;
}

export const DutyTimelineCard = forwardRef<HTMLInputElement, DutyTimelineCardProps>(
  (
    {
      heading = 'Duty タイムライン',
      description = 'ブロックをドラッグして区間を編集し、CSV の読み書きで外部ツールとも連携できます。',
      onImportClick,
      onImportFile,
      onExport,
      onAdd,
      onAddBreak,
      onAddDeadhead,
      onMove,
      onDelete,
      onAutoCorrect,
      onUndo,
      onRedo,
      lanes,
      pixelsPerMinute,
      onInteraction,
      onSegmentDrag,
      onSelect,
      warningTotals,
      blockLanes,
      onBlockSelect,
      selectedBlockId,
      selectedDutyId,
      selectedSegmentId,
      showWarnings = true,
      onExternalDrop,
      onExternalDragOver,
    },
    fileInputRef,
  ) => {
    const [scrollLeft, setScrollLeft] = useState(0);
    const hasBlockTimeline = useMemo(() => (blockLanes?.length ?? 0) > 0, [blockLanes]);
    const dragBus = useOptionalDragBus();

    const handleScrollSync = useCallback((offset: number) => {
      setScrollLeft((previous) => {
        if (Math.abs(previous - offset) < 1) {
          return previous;
        }
        return offset;
      });
    }, []);

    const handleBlockTimelineSelect = useCallback(
      (selection: TimelineSelection) => {
        if (!onBlockSelect) {
          return;
        }
        onBlockSelect(selection.laneId);
      },
      [onBlockSelect],
    );

    const getBlockSegmentProps = useCallback(
      (lane: TimelineLane<BlockTimelineMeta>, segment: TimelineLane<BlockTimelineMeta>['segments'][number]) => {
        if (!dragBus) {
          return {};
        }
        const meta = segment.meta;
        if (!meta || meta.kind !== 'block-trip') {
          return {};
        }
        return {
          onPointerDown: (event: ReactPointerEvent<SVGGElement>) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            dragBus.beginDrag(
              {
                type: 'block-trip',
                blockId: meta.blockId,
                tripId: meta.tripId,
                serviceDayIndex: meta.serviceDayIndex,
                startMinutes: segment.startMinutes,
                endMinutes: segment.endMinutes,
              },
              {
                origin: { laneId: lane.id, segmentId: segment.id },
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                initialPosition: { clientX: event.clientX, clientY: event.clientY },
              },
            );
          },
          className: 'cursor-grab',
        } as ReactSVGProps<SVGGElement>;
      },
      [dragBus],
    );

    const renderDropPreview = useCallback(
      (context: TimelineExternalPreviewContext<DutyTimelineMeta>) => {
        const payload = context.session.payload;
        let previewStart: number | null = null;
        let previewEnd: number | null = null;

        if (payload.type === 'block-trip') {
          previewStart = payload.startMinutes;
          previewEnd = payload.endMinutes;
        } else if (payload.type === 'block-trip-range' || payload.type === 'unassigned-range') {
          previewStart = payload.startMinutes;
          previewEnd = payload.endMinutes;
        } else if (payload.type === 'break-token' || payload.type === 'deadhead-token') {
          const baseStart = context.minutes ?? context.bounds.startMinutes;
          const durationMinutes = Math.max(payload.durationMinutes ?? 15, 5);
          previewStart = baseStart;
          previewEnd = baseStart + durationMinutes;
        } else {
          return null;
        }

        if (previewStart === null || previewEnd === null) {
          return null;
        }

        const durationMinutes = Math.max(previewEnd - previewStart, 0);
        const widthPx = Math.max(durationMinutes * context.pixelsPerMinute, 4);
        const clampedWidth = Math.min(widthPx, context.timelineWidth);

        const originMinutes = context.isNewLane && context.minutes !== null
          ? context.minutes
          : previewStart;
        const rawLeft = (originMinutes - context.bounds.startMinutes) * context.pixelsPerMinute;
        const safeLeft = Number.isFinite(rawLeft) ? rawLeft : 0;
        const maxLeft = Math.max(context.timelineWidth - clampedWidth, 0);
        const left = Math.min(Math.max(safeLeft, 0), maxLeft);

        return (
          <div
            className="pointer-events-none absolute top-[10px] h-[calc(100%-20px)] rounded bg-primary/25 ring-2 ring-primary/60"
            style={{ left, width: clampedWidth }}
          />
        );
      },
      [],
    );

    const handleBreakTokenPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!dragBus || event.button !== 0) {
          return;
        }
        event.preventDefault();
        dragBus.beginDrag(
          {
            type: 'break-token',
            durationMinutes: 15,
          },
          {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            initialPosition: { clientX: event.clientX, clientY: event.clientY },
          },
        );
      },
      [dragBus],
    );

    const handleDeadheadTokenPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!dragBus || event.button !== 0) {
          return;
        }
        event.preventDefault();
        dragBus.beginDrag(
          {
            type: 'deadhead-token',
            durationMinutes: 20,
          },
          {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            initialPosition: { clientX: event.clientX, clientY: event.clientY },
          },
        );
      },
      [dragBus],
    );

    const actions = useMemo(
      () => {
        const list = [
          { id: 'add', label: '区間を追加', onClick: onAdd },
          { id: 'add-break', label: '休憩を追加', onClick: onAddBreak },
          { id: 'add-deadhead', label: '回送を追加', onClick: onAddDeadhead },
          { id: 'move', label: '区間を移動', onClick: onMove },
          { id: 'delete', label: '区間を削除', onClick: onDelete },
        ];
        if (showWarnings) {
          list.push({ id: 'autocorrect', label: '区間を調整', onClick: onAutoCorrect });
        }
        list.push(
          { id: 'undo', label: '元に戻す', onClick: onUndo },
          { id: 'redo', label: 'やり直す', onClick: onRedo },
        );
        return list;
      },
      [onAdd, onAddBreak, onAddDeadhead, onMove, onDelete, onAutoCorrect, onUndo, onRedo, showWarnings],
    );

    return (
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{heading}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onImportFile(file);
                  event.target.value = '';
                }
              }}
            />
            <Button variant="outline" onClick={onImportClick}>
              CSV を読み込む
            </Button>
            <Button onClick={onExport}>CSV を書き出す</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showWarnings && warningTotals ? (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">警告件数</span>
              <Badge variant={warningTotals.hard > 0 ? 'destructive' : 'outline'}>重大 {warningTotals.hard}</Badge>
              <Badge variant={warningTotals.soft > 0 ? 'secondary' : 'outline'}>注意 {warningTotals.soft}</Badge>
            </div>
          ) : null}
          <ExportBar actions={actions} />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>ドラッグトークン:</span>
            <button
              type="button"
              onPointerDown={handleBreakTokenPointerDown}
              className="inline-flex cursor-grab items-center gap-2 rounded border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-2 font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              title="Duty に休憩をドラッグして追加"
            >
              <PauseCircle className="h-4 w-4" aria-hidden="true" />
              休憩トークン
            </button>
            <button
              type="button"
              onPointerDown={handleDeadheadTokenPointerDown}
              className="inline-flex cursor-grab items-center gap-2 rounded border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-2 font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              title="Duty に回送をドラッグして追加"
            >
              <BusFront className="h-4 w-4" aria-hidden="true" />
              回送トークン
            </button>
          </div>
          {hasBlockTimeline ? (
            <div className="space-y-2" data-testid="vehicle-timeline">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>車両ビュー（行路タイムライン）</span>
                <span>Shift+スクロールでズーム、Alt+スクロールでパン</span>
              </div>
              <TimelineGantt
                lanes={blockLanes!}
                pixelsPerMinute={pixelsPerMinute}
                onInteraction={onInteraction}
                selectedLaneId={selectedBlockId ?? undefined}
                onSelect={handleBlockTimelineSelect}
                emptyMessage="ブロックのタイムラインがありません。"
                scrollLeft={scrollLeft}
                onScrollLeftChange={handleScrollSync}
                enableInternalSegmentDrag={false}
                getSegmentProps={getBlockSegmentProps}
              />
            </div>
          ) : null}
          <div className="space-y-2" data-testid="driver-timeline">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>乗務ビュー（Dutyタイムライン）</span>
              <span>Shift+スクロールでズーム、Alt+スクロールでパン</span>
            </div>
            <TimelineGantt
              lanes={lanes}
              pixelsPerMinute={pixelsPerMinute}
              emptyMessage="Duty を追加するとタイムラインに表示されます。"
              onInteraction={onInteraction}
              onSegmentDrag={onSegmentDrag}
              onSelect={onSelect}
              selectedLaneId={selectedDutyId ?? undefined}
              selectedSegmentId={selectedSegmentId ?? undefined}
              scrollLeft={scrollLeft}
              onScrollLeftChange={handleScrollSync}
              onExternalDrop={onExternalDrop}
              onExternalDragOver={onExternalDragOver}
              renderExternalPreview={renderDropPreview}
            />
          </div>
        </CardContent>
      </Card>
    );
  },
);

DutyTimelineCard.displayName = 'DutyTimelineCard';

