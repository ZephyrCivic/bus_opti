/**
 * src/features/duties/components/DutyTimelineCard.tsx
 * Duty タイムライン操作用のカード。CSV 入出力と区間操作、タイムライン描画をまとめて提供する。
 */
import { forwardRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    },
    fileInputRef,
  ) => {
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
          <TimelineGantt
            lanes={lanes}
            pixelsPerMinute={pixelsPerMinute}
            emptyMessage="Duty を追加するとタイムラインに表示されます。"
            onInteraction={onInteraction}
            onSegmentDrag={onSegmentDrag}
            onSelect={onSelect}
          />
        </CardContent>
      </Card>
    );
  },
);

DutyTimelineCard.displayName = 'DutyTimelineCard';

