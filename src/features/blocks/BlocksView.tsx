/**
 * src/features/blocks/BlocksView.tsx
 * Provides the Greedy block planning UI: turn gap control, block list, and unassigned trips.
 */
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import {
  buildBlocksPlan,
  type BlockPlan,
  type BlockSummary,
  DEFAULT_MAX_TURN_GAP_MINUTES,
} from '@/services/blocks/blockBuilder';

const MIN_TURN_GAP = 0;
const MAX_TURN_GAP = 180;

export default function BlocksView(): JSX.Element {
  const { result } = useGtfsImport();
  const [turnGap, setTurnGap] = useState<number>(DEFAULT_MAX_TURN_GAP_MINUTES);
  const plan = useMemo<BlockPlan>(() => buildBlocksPlan(result, { maxTurnGapMinutes: turnGap }), [result, turnGap]);

  useEffect(() => {
    if (!result) {
      setTurnGap(DEFAULT_MAX_TURN_GAP_MINUTES);
    }
  }, [result]);

  const coveragePercentage = Math.round(plan.coverageRatio * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Blocks</h2>
        <p className="text-sm text-muted-foreground">
          GreedyアルゴリズムでTripを連結し、最大ターン間隔 {plan.maxTurnGapMinutes} 分以内で block_id を採番します。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle>ターン間隔の調整</CardTitle>
            <CardDescription>GTFS取り込み済みのTripに対して適用されます。値を更新すると即座に再計算します。</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="turn-gap-input">
              最大ターン間隔 (分)
            </label>
            <Input
              id="turn-gap-input"
              type="number"
              min={MIN_TURN_GAP}
              max={MAX_TURN_GAP}
              value={turnGap}
              onChange={(event) => setTurnGap(clampTurnGap(event.target.value))}
              className="w-24"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="割り当て済みTrip" value={plan.assignedTripCount.toLocaleString()} />
            <StatCard label="対象Trip総数" value={plan.totalTripCount.toLocaleString()} />
            <StatCard label="カバレッジ" value={`${coveragePercentage}%`} trend={coverageBadgeVariant(coveragePercentage)} />
          </div>
        </CardContent>
      </Card>

      <BlocksTable summaries={plan.summaries} />
      <UnassignedTable unassigned={plan.unassignedTripIds} />
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
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <Badge variant={trend} className="w-fit text-base">
        {value}
      </Badge>
    </div>
  );
}

interface BlocksTableProps {
  summaries: BlockSummary[];
}

function BlocksTable({ summaries }: BlocksTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>生成された Blocks</CardTitle>
        <CardDescription>Greedy連結の結果とギャップ統計を表示します。</CardDescription>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">ブロックがまだ計算されていません。GTFSフィードをインポートしてください。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>block_id</TableHead>
                <TableHead>サービス</TableHead>
                <TableHead>サービス日</TableHead>
                <TableHead>Trip数</TableHead>
                <TableHead>開始時刻</TableHead>
                <TableHead>終了時刻</TableHead>
                <TableHead>平均隙間 (分)</TableHead>
                <TableHead>最大隙間 (分)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => {
                const averageGap = summary.gaps.length === 0 ? 0 : Math.round(summary.gaps.reduce((acc, gap) => acc + gap, 0) / summary.gaps.length);
                const maxGap = summary.gaps.length === 0 ? 0 : Math.max(...summary.gaps);
                return (
                  <TableRow key={summary.blockId}>
                    <TableCell className="font-medium">{summary.blockId}</TableCell>
                    <TableCell>{summary.serviceId ?? '未設定'}</TableCell>
                    <TableCell>{formatServiceDay(summary.serviceDayIndex)}</TableCell>
                    <TableCell>{summary.tripCount}</TableCell>
                    <TableCell>{summary.firstTripStart}</TableCell>
                    <TableCell>{summary.lastTripEnd}</TableCell>
                    <TableCell>{averageGap}</TableCell>
                    <TableCell>{maxGap}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

interface UnassignedTableProps {
  unassigned: string[];
}

function UnassignedTable({ unassigned }: UnassignedTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>未割り当て Trip</CardTitle>
        <CardDescription>時刻情報不足やターン間隔超過で連結できなかった Trip を表示します。</CardDescription>
      </CardHeader>
      <CardContent>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">未割り当てのTripはありません。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>trip_id</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unassigned.map((tripId) => (
                <TableRow key={tripId}>
                  <TableCell>{tripId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function clampTurnGap(value: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_MAX_TURN_GAP_MINUTES;
  }
  return Math.min(MAX_TURN_GAP, Math.max(MIN_TURN_GAP, Math.round(numeric)));
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

function formatServiceDay(index: number): string {
  return `Day ${index}`;
}
