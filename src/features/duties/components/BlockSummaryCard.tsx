/**
 * src/features/duties/components/BlockSummaryCard.tsx
 * Duty 編集で参照するブロック一覧と区間選択、操作ボタンをまとめたカード。
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
  onAddBreak?: () => void;
  onAddDeadhead?: () => void;
  onMove(): void;
  onDelete(): void;
  onUndo(): void;
  onRedo(): void;
}

export function BlockSummaryCard({
  plan,
  selectedBlockId,
  onSelectBlock,
  filteredTrips,
  startTripId,
  endTripId,
  onStartTripChange,
  onEndTripChange,
  onAdd,
  onAddBreak,
  onAddDeadhead,
  onMove,
  onDelete,
  onUndo,
  onRedo,
}: BlockSummaryCardProps): JSX.Element {
  const coveragePercentage = Math.round(plan.coverageRatio * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ブロック一覧</CardTitle>
        <CardDescription>割り当て候補のブロックを確認し、Duty 編集に利用する区間を選択します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">設定されているターン間隔上限</span>
          <Badge variant="secondary">{plan.maxTurnGapMinutes} 分</Badge>
          <Badge variant={coverageBadgeVariant(coveragePercentage)}>{`カバレッジ ${coveragePercentage}%`}</Badge>
        </div>

        <div className="max-h-[260px] overflow-y-auto rounded-md border" data-testid="duty-block-table">
          <Table>
            <TableHeader>
              <TableRow>
              <TableHead>行路ID</TableHead>
              <TableHead>便数</TableHead>
                <TableHead>始発</TableHead>
                <TableHead>最終</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.summaries.map((summary) => (
                <TableRow
                  key={summary.blockId}
                  className={selectedBlockId === summary.blockId ? 'cursor-pointer bg-muted/50' : 'cursor-pointer'}
                  data-testid="duty-block-row"
                  data-block-id={summary.blockId}
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
            <label className="text-xs font-medium text-muted-foreground">開始便</label>
            <Select value={startTripId ?? ''} onValueChange={onStartTripChange}>
              <SelectTrigger data-testid="duty-start-trigger">
                <SelectValue placeholder="便を選択" />
              </SelectTrigger>
              <SelectContent>
                {filteredTrips.map((trip) => (
                  <SelectItem
                    key={trip.tripId}
                    value={trip.tripId}
                    data-testid="duty-start-option"
                    data-trip-id={trip.tripId}
                  >
                    {trip.seq}. {trip.tripId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">終了便</label>
            <Select value={endTripId ?? ''} onValueChange={onEndTripChange}>
              <SelectTrigger data-testid="duty-end-trigger">
                <SelectValue placeholder="便を選択" />
              </SelectTrigger>
              <SelectContent>
                {filteredTrips.map((trip) => (
                  <SelectItem
                    key={trip.tripId}
                    value={trip.tripId}
                    data-testid="duty-end-option"
                    data-trip-id={trip.tripId}
                  >
                    {trip.seq}. {trip.tripId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button data-testid="duty-add-segment" onClick={onAdd}>
            区間を追加
          </Button>
          {onAddBreak ? (
            <Button data-testid="duty-add-break" variant="secondary" onClick={onAddBreak}>
              休憩を追加
            </Button>
          ) : null}
          {onAddDeadhead ? (
            <Button data-testid="duty-add-deadhead" variant="secondary" onClick={onAddDeadhead}>
              回送を追加
            </Button>
          ) : null}
          <Button data-testid="duty-move-segment" variant="secondary" onClick={onMove}>
            区間を移動
          </Button>
          <Button data-testid="duty-delete-segment" variant="destructive" onClick={onDelete}>
            区間を削除
          </Button>
          <Button data-testid="duty-undo" variant="outline" onClick={onUndo}>
            元に戻す
          </Button>
          <Button data-testid="duty-redo" variant="outline" onClick={onRedo}>
            やり直す
          </Button>
        </div>

        <div className="space-y-2">
        <h4 className="text-sm font-semibold">ブロック内の便詳細</h4>
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
                    ブロックを選択すると該当する便が表示されます。
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

function coverageBadgeVariant(percentage: number): 'default' | 'secondary' | 'outline' {
  if (percentage >= 80) {
    return 'default';
  }
  if (percentage >= 60) {
    return 'secondary';
  }
  return 'outline';
}

