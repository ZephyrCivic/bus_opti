/**
 * src/features/duties/components/BlockSummaryCard.tsx
 * Presents block coverage stats, block summaries, and trip selection controls for Duty editing.
 * Keeps DutiesView lean by encapsulating UI-only logic around block/trip selection.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { BlockPlan, BlockCsvRow } from '@/services/blocks/blockBuilder';

interface BlockSummaryCardProps {
  plan: BlockPlan;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  filteredTrips: BlockCsvRow[];
  startTripId: string | null;
  endTripId: string | null;
  onStartTripChange: (value: string) => void;
  onEndTripChange: (value: string) => void;
  onAdd(): void;
  onMove(): void;
  onDelete(): void;
  onUndo(): void;
}

export function BlockSummaryCard(props: BlockSummaryCardProps): JSX.Element {
  const {
    plan,
    selectedBlockId,
    onSelectBlock,
    filteredTrips,
    startTripId,
    endTripId,
    onStartTripChange,
    onEndTripChange,
    onAdd,
    onMove,
    onDelete,
    onUndo,
  } = props;

  const coveragePercentage = Math.round(plan.coverageRatio * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocks</CardTitle>
        <CardDescription>
          Coverage {coveragePercentage}% / Trip {plan.assignedTripCount.toLocaleString()} 件
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Max Turn Gap</span>
          <Badge variant="secondary">{plan.maxTurnGapMinutes} 分</Badge>
        </div>

        <div className="max-h-[260px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>block_id</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>開始</TableHead>
                <TableHead>終了</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.summaries.map((summary) => (
                <TableRow
                  key={summary.blockId}
                  className={selectedBlockId === summary.blockId ? 'bg-muted/50 cursor-pointer' : 'cursor-pointer'}
                  onClick={() => onSelectBlock(summary.blockId)}
                >
                  <TableCell className="font-medium">{summary.blockId}</TableCell>
                  <TableCell>{summary.tripCount}</TableCell>
                  <TableCell>{summary.firstTripStart}</TableCell>
                  <TableCell>{summary.lastTripEnd}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">開始Trip</label>
            <Select value={startTripId ?? ''} onValueChange={onStartTripChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tripを選択" />
              </SelectTrigger>
              <SelectContent>
                {filteredTrips.map((trip) => (
                  <SelectItem key={trip.tripId} value={trip.tripId}>
                    {trip.seq}. {trip.tripId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">終了Trip</label>
            <Select value={endTripId ?? ''} onValueChange={onEndTripChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tripを選択" />
              </SelectTrigger>
              <SelectContent>
                {filteredTrips.map((trip) => (
                  <SelectItem key={trip.tripId} value={trip.tripId}>
                    {trip.seq}. {trip.tripId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onAdd}>追加</Button>
          <Button variant="secondary" onClick={onMove}>
            移動
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            削除
          </Button>
          <Button variant="outline" onClick={onUndo}>
            Undo
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Block内Trip</h4>
          <div className="max-h-[220px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>seq</TableHead>
                  <TableHead>trip_id</TableHead>
                  <TableHead>start</TableHead>
                  <TableHead>end</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.map((trip) => (
                  <TableRow key={trip.tripId} className="text-sm">
                    <TableCell>{trip.seq}</TableCell>
                    <TableCell>{trip.tripId}</TableCell>
                    <TableCell>{trip.tripStart}</TableCell>
                    <TableCell>{trip.tripEnd}</TableCell>
                  </TableRow>
                ))}
                {filteredTrips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Blockを選択してください。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

