/**
 * src/features/duties/components/BlockSummaryCard.tsx
 * Presents block coverage stats, block summaries, and trip selection controls for Duty editing.
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
  onRedo(): void;
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
    onRedo,
  } = props;

  const coveragePercentage = Math.round(plan.coverageRatio * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ブロック一覧</CardTitle>
        <CardDescription>運行ブロックのカバー率と便ごとの区間を確認できます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">待機時間の上限</span>
          <Badge variant="secondary">{plan.maxTurnGapMinutes} 分</Badge>
        </div>

        <div className="max-h-[260px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>block_id</TableHead>
                <TableHead>便数</TableHead>
                <TableHead>始発</TableHead>
                <TableHead>終着</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.summaries.map((summary) => (
                <TableRow
                  key={summary.blockId}
                  className={selectedBlockId === summary.blockId ? 'cursor-pointer bg-muted/50' : 'cursor-pointer'}
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
                <SelectValue placeholder="便を選択" />
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
                <SelectValue placeholder="便を選択" />
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
          <Button onClick={onAdd}>区間を作成</Button>
          <Button variant="secondary" onClick={onMove}>
            区間を移す
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            区間を削除
          </Button>
          <Button variant="outline" onClick={onUndo}>
            元に戻す
          </Button>
          <Button variant="outline" onClick={onRedo}>
            やり直す
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">ブロック内の便一覧</h4>
          <div className="max-h-[220px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>seq</TableHead>
                  <TableHead>trip_id</TableHead>
                  <TableHead>出発</TableHead>
                  <TableHead>到着</TableHead>
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
                      ブロックを選ぶと便が表示されます。
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
