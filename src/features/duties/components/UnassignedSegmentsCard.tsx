import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOptionalDragBus } from '@/features/timeline/dragBus';
import type { DutyTimelineTrip } from '@/features/duties/utils/timelineSnap';
import type { UnassignedRange } from '@/services/duty/unassigned';

interface UnassignedSegmentsCardProps {
  ranges: UnassignedRange[];
  tripMinutes: Map<string, DutyTimelineTrip[]>;
  onSelectRange: (range: UnassignedRange) => void;
}

export function UnassignedSegmentsCard({ ranges, tripMinutes, onSelectRange }: UnassignedSegmentsCardProps): JSX.Element {
  const dragBus = useOptionalDragBus();

  const minutesLookup = useMemo(() => {
    const cache = new Map<string, Map<string, { start: number; end: number }>>();
    for (const [blockId, trips] of tripMinutes.entries()) {
      const map = new Map<string, { start: number; end: number }>();
      for (const trip of trips) {
        map.set(trip.tripId, { start: trip.startMinutes, end: trip.endMinutes });
      }
      cache.set(blockId, map);
    }
    return cache;
  }, [tripMinutes]);

  const beginDrag = (range: UnassignedRange) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragBus || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const tripMap = minutesLookup.get(range.blockId);
    const startMinutes = tripMap?.get(range.startTripId)?.start ?? 0;
    const endMinutes = tripMap?.get(range.endTripId)?.end ?? startMinutes;
    dragBus.beginDrag(
      {
        type: 'unassigned-range',
        blockId: range.blockId,
        startTripId: range.startTripId,
        endTripId: range.endTripId,
        serviceDayIndex: 0,
        startMinutes,
        endMinutes,
      },
      {
        origin: { laneId: range.blockId },
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        initialPosition: { clientX: event.clientX, clientY: event.clientY },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>未割当グループ</CardTitle>
        <CardDescription>乗務に割り当てられていない区間をまとめています。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">
          未割当の区間数: {ranges.length}
        </div>
        <div className="max-h-[240px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">D&D</TableHead>
                <TableHead>行路</TableHead>
                <TableHead>便範囲</TableHead>
                <TableHead>所要</TableHead>
                <TableHead>件数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranges.map((range, index) => (
                <TableRow key={`${range.blockId}-${range.startSequence}-${index}`}>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-dashed border-muted-foreground/40 text-muted-foreground transition hover:border-primary hover:text-primary"
                      onPointerDown={beginDrag(range)}
                      title="ドラッグして Duty に追加"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{range.blockId}</TableCell>
                  <TableCell className="text-sm">
                    <div>{range.startTripId} → {range.endTripId}</div>
                    <div className="text-xs text-muted-foreground">
                      {range.firstDeparture} → {range.lastArrival}
                    </div>
                  </TableCell>
                  <TableCell>{range.firstDeparture} - {range.lastArrival}</TableCell>
                  <TableCell>{range.tripCount}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onSelectRange(range)}>
                      範囲を選択
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ranges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    現在、未割当の区間はありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>ハンドルをドラッグして Duty タイムラインへ直接追加できます。</span>
        <span>「範囲を選択」を押すとブロックの開始・終了便が設定されます。続けて「区間を追加」を実行してください。</span>
      </CardFooter>
    </Card>
  );
}
