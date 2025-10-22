/**
 * src/features/duties/components/DutyTimelineCard.tsx
 * Duty タイムライン操作用のカード。CSV 入出力と区間操作、タイムライン描画をまとめて提供する。
 */
import { forwardRef, useCallback, useMemo, useState } from 'react';

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
import TimelineGantt from '@/features/timeline/TimelineGantt';
import type {
  TimelineInteractionEvent,
  TimelineLane,
  TimelineSelection,
  TimelineSegmentDragEvent,
} from '@/features/timeline/types';
import type { DutyTimelineMeta } from '../hooks/useDutyTimelineData';

interface DutyTimelineCardProps {
  heading?: string;
  description?: string;
  onImportClick: () => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onAdd: () => void;
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
  blockLanes?: TimelineLane[];
  onBlockSelect?: (blockId: string) => void;
  selectedBlockId?: string | null;
  selectedDutyId?: string | null;
  selectedSegmentId?: string | null;
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
    },
    fileInputRef,
  ) => {
    const [scrollLeft, setScrollLeft] = useState(0);

    const hasBlockTimeline = useMemo(() => (blockLanes?.length ?? 0) > 0, [blockLanes]);

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
          {warningTotals ? (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">警告件数</span>
              <Badge variant={warningTotals.hard > 0 ? 'destructive' : 'outline'}>重大 {warningTotals.hard}</Badge>
              <Badge variant={warningTotals.soft > 0 ? 'secondary' : 'outline'}>注意 {warningTotals.soft}</Badge>
            </div>
          ) : null}
          <ExportBar
            actions={[
              { id: 'add', label: '区間を追加', onClick: onAdd },
              { id: 'move', label: '区間を移動', onClick: onMove },
              { id: 'delete', label: '区間を削除', onClick: onDelete },
              { id: 'autocorrect', label: '区間を調整', onClick: onAutoCorrect },
              { id: 'undo', label: '元に戻す', onClick: onUndo },
              { id: 'redo', label: 'やり直す', onClick: onRedo },
            ]}
          />
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
            />
          </div>
        </CardContent>
      </Card>
    );
  },
);

DutyTimelineCard.displayName = 'DutyTimelineCard';

