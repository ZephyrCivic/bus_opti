/**
 * src/features/blocks/BlocksView.tsx
 * ブロック計画の統計とサービス日別タイムラインを表示し、重複ハイライトを行う。
 */
import { useEffect, useMemo, useState } from 'react';

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
import TimelineGantt from '@/features/timeline/TimelineGantt';
import { DEFAULT_PIXELS_PER_MINUTE, parseTimeLabel } from '@/features/timeline/timeScale';
import type { TimelineLane } from '@/features/timeline/types';
import {
  buildBlocksPlan,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockPlan,
  type BlockSummary,
} from '@/services/blocks/blockBuilder';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';

import { useBlocksPlan } from './hooks/useBlocksPlan';

const MIN_TURN_GAP = 0;
const MAX_TURN_GAP = 180;

export default function BlocksView(): JSX.Element {
  const { result } = useGtfsImport();
  const [turnGap, setTurnGap] = useState<number>(DEFAULT_MAX_TURN_GAP_MINUTES);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);

  const plan = useMemo<BlockPlan>(
    () => buildBlocksPlan(result, { maxTurnGapMinutes: turnGap }),
    [result, turnGap],
  );
  const { days, allDays, overlaps } = useBlocksPlan(plan, { activeDay: activeDayIndex ?? undefined });

  useEffect(() => {
    if (!result) {
      setTurnGap(DEFAULT_MAX_TURN_GAP_MINUTES);
    }
  }, [result]);

  useEffect(() => {
    if (allDays.length === 0) {
      if (activeDayIndex !== null) {
        setActiveDayIndex(null);
      }
      return;
    }
    const firstDay = allDays[0]!.dayIndex;
    if (activeDayIndex === null || !allDays.some((day) => day.dayIndex === activeDayIndex)) {
      setActiveDayIndex(firstDay);
    }
  }, [allDays, activeDayIndex]);

  const coveragePercentage = Math.round(plan.coverageRatio * 100);

  const overlapMinutesByBlock = useMemo(() => {
    const map = new Map<string, number>();
    for (const summary of plan.summaries) {
      const total = (overlaps.get(summary.blockId) ?? []).reduce(
        (accumulator, entry) => accumulator + entry.overlapMinutes,
        0,
      );
      map.set(summary.blockId, Number(total.toFixed(2)));
    }
    return map;
  }, [plan.summaries, overlaps]);

  const visibleSummaries = useMemo(
    () => days.flatMap((day) => day.summaries),
    [days],
  );

  const timelineLanes = useMemo<TimelineLane[]>(() => {
    return visibleSummaries.reduce<TimelineLane[]>((lanes, summary) => {
      const startMinutes = parseTimeLabel(summary.firstTripStart);
      const endMinutes = parseTimeLabel(summary.lastTripEnd);
      if (startMinutes === undefined || endMinutes === undefined) {
        return lanes;
      }
      const overlapMinutes = overlapMinutesByBlock.get(summary.blockId) ?? 0;
      const color = overlapMinutes > 0 ? 'var(--destructive)' : 'var(--primary)';
      const lane: TimelineLane = {
        id: summary.blockId,
        label: `${summary.blockId} (${summary.tripCount} Trips)`,
        segments: [
          {
            id: `${summary.blockId}-window`,
            label: `${summary.firstTripStart} → ${summary.lastTripEnd}`,
            startMinutes,
            endMinutes: Math.max(endMinutes, startMinutes + 1),
            color,
          },
        ],
      };
      lanes.push(lane);
      return lanes;
    }, []);
  }, [visibleSummaries, overlapMinutesByBlock]);

  const visibleOverlapSummaries = useMemo(() => {
    return visibleSummaries
      .map((summary) => ({
        blockId: summary.blockId,
        minutes: overlapMinutesByBlock.get(summary.blockId) ?? 0,
      }))
      .filter((item) => item.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [visibleSummaries, overlapMinutesByBlock]);

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
            <StatCard
              label="カバレッジ"
              value={`${coveragePercentage}%`}
              trend={coverageBadgeVariant(coveragePercentage)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>サービス日別タイムライン</CardTitle>
            <CardDescription>重なりがある Block を赤系でハイライトし、日別に確認できます。</CardDescription>
          </div>
          <Badge variant="outline">サービス日: {allDays.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {allDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">サービス日がまだ計算されていません。GTFSフィードをインポートしてください。</p>
          ) : (
            <>
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
              <TimelineGantt
                lanes={timelineLanes}
                pixelsPerMinute={DEFAULT_PIXELS_PER_MINUTE}
                emptyMessage="選択中のサービス日に表示できる Block がありません。"
              />
              {visibleOverlapSummaries.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold">重なり検出済み Block</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    {visibleOverlapSummaries.map((item) => (
                      <li key={item.blockId} className="flex items-center justify-between">
                        <span className="font-medium">{item.blockId}</span>
                        <span className="text-muted-foreground">{item.minutes.toFixed(1)} 分</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">選択中のサービス日に重なりはありません。</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <BlocksTable summaries={plan.summaries} overlapMinutesByBlock={overlapMinutesByBlock} />
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
  overlapMinutesByBlock: Map<string, number>;
}

function BlocksTable({ summaries, overlapMinutesByBlock }: BlocksTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>生成された Blocks</CardTitle>
        <CardDescription>Greedy連結の結果とギャップ統計を表示します。重複は参考値です。</CardDescription>
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
                    <TableCell>{overlapMinutes.toFixed(1)}</TableCell>
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
  return `Day ${index + 1}`;
}
