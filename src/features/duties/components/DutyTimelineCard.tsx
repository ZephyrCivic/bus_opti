/**
 * src/features/duties/components/DutyTimelineCard.tsx
 * Duty タイムライン領域のレイアウトと操作ボタンをまとめたプレゼンテーショナルコンポーネント。
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
import type { TimelineInteractionEvent, TimelineLane, TimelineSelection, TimelineSegmentDragEvent } from '@/features/timeline/types';
import type { DutyTimelineMeta } from '../hooks/useDutyTimelineData';

interface DutyTimelineCardProps {
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
            <CardTitle>Duty タイムライン</CardTitle>
            <CardDescription>仕業の区間と時間帯を俯瞰します。バーをクリックするとInspectorが更新されます。</CardDescription>
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
            <Button variant="outline" onClick={onImportClick}>CSV を読み込む</Button>
            <Button onClick={onExport}>CSV を出力</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExportBar
            actions={[
              { id: 'add', label: '区間を追加', onClick: onAdd },
              { id: 'move', label: '区間を移動', onClick: onMove },
              { id: 'delete', label: '区間を削除', onClick: onDelete },
              { id: 'autocorrect', label: '自動調整', onClick: onAutoCorrect },
              { id: 'undo', label: 'Undo', onClick: onUndo },
              { id: 'redo', label: 'Redo', onClick: onRedo },
            ]}
          />
          <TimelineGantt
            lanes={lanes}
            pixelsPerMinute={pixelsPerMinute}
            emptyMessage="Duties を追加するとタイムラインが表示されます。"
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

