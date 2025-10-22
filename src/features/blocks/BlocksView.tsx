/**
 * src/features/blocks/BlocksView.tsx
 * ブロック推定結果を確認し、ターン間隔や重複状況を把握する画面。
 * タイムライン、統計カード、詳細テーブル、未割当便一覧を提供する。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useManualBlocksPlan } from './hooks/useManualBlocksPlan';
import { toast } from 'sonner';

const MIN_TURN_GAP = 0;
const MAX_TURN_GAP = 180;

export default function BlocksView(): JSX.Element {
  const { result, manual } = useGtfsImport();
  const [turnGap, setTurnGap] = useState<number>(DEFAULT_MAX_TURN_GAP_MINUTES);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);

  const initialPlan = useMemo<BlockPlan>(
    () =>
      buildBlocksPlan(result, {
        maxTurnGapMinutes: turnGap,
        minTurnaroundMinutes: manual.linking.minTurnaroundMin,
        linkingEnabled: manual.linking.enabled,
      }),
    [result, turnGap, manual.linking.minTurnaroundMin, manual.linking.enabled],
  );
  const { plan: manualPlan } = useManualBlocksPlan(initialPlan, {
    minTurnaroundMin: manual.linking.minTurnaroundMin,
    maxGapMinutes: turnGap,
  });
  const { days, allDays, overlaps } = useBlocksPlan(manualPlan, { activeDay: activeDayIndex ?? undefined });

  useEffect(() => {
    if (!result) {
      setTurnGap(DEFAULT_MAX_TURN_GAP_MINUTES);
    }
  }, [result]);

  useEffect(() => {
    if (allDays.length === 0) {
      if (activeDayIndex !== null) setActiveDayIndex(null);
      return;
    }
    const firstDay = allDays[0]!.dayIndex;
    if (activeDayIndex === null || !allDays.some((day) => day.dayIndex === activeDayIndex)) {
      setActiveDayIndex(firstDay);
    }
  }, [allDays, activeDayIndex]);

  const coveragePercentage = Math.round(manualPlan.coverageRatio * 100);

  const overlapMinutesByBlock = useMemo(() => {
    const map = new Map<string, number>();
    for (const summary of manualPlan.summaries) {
      const total = (overlaps.get(summary.blockId) ?? []).reduce(
        (accumulator, entry) => accumulator + entry.overlapMinutes,
        0,
      );
      map.set(summary.blockId, Number(total.toFixed(2)));
    }
    return map;
  }, [manualPlan.summaries, overlaps]);

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
          label: `${summary.blockId}（便 ${summary.tripCount} 件）`,
        segments: [
          {
            id: `${summary.blockId}-window`,
            label: `${summary.firstTripStart} ~ ${summary.lastTripEnd}`,
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
        <h2 className="text-lg font-semibold">行路推定</h2>
        <p className="text-sm text-muted-foreground">
          GTFS 取込データを Greedy アルゴリズムで束ね、ターン間隔（現在 {manualPlan.maxTurnGapMinutes} 分）と重複状況を確認します。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle>ターン設定の確認</CardTitle>
            <CardDescription>
              取込済みの便に対してターン間隔を適用します。数値を変更すると即座に再計算されます。
            </CardDescription>
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
            <StatCard label="割り当て済み便" value={manualPlan.assignedTripCount.toLocaleString()} />
            <StatCard label="対象便件数" value={manualPlan.totalTripCount.toLocaleString()} />
            <StatCard
              label="カバレッジ率"
              value={`${coveragePercentage}%`}
              trend={coverageBadgeVariant(coveragePercentage)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>日別タイムライン</CardTitle>
            <CardDescription>サービス日ごとのブロック稼働時間と重複を視覚化します。</CardDescription>
          </div>
          <Badge variant="outline">サービス日数: {allDays.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {allDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">サービス日の集計がありません。GTFS フィードを取り込んでください。</p>
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
                emptyMessage="選択したサービス日に表示できるブロックがありません。"
              />
              {visibleOverlapSummaries.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold">重複があるブロック</h4>
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
                <p className="text-sm text-muted-foreground">選択したサービス日に重複はありません。</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <BlocksTable summaries={manualPlan.summaries} overlapMinutesByBlock={overlapMinutesByBlock} />
      <UnassignedTable unassigned={manualPlan.unassignedTripIds} />
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
      <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
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
        <CardTitle>ブロック一覧</CardTitle>
        <CardDescription>推定されたブロックの概要やターン間隔、重複量を確認できます。</CardDescription>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">ブロックの計算結果がありません。GTFS フィードを取り込んでください。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>行路ID</TableHead>
                  <TableHead>サービスID</TableHead>
                  <TableHead>サービス日</TableHead>
                  <TableHead>便数</TableHead>
                  <TableHead>始発時刻</TableHead>
                  <TableHead>最終時刻</TableHead>
                  <TableHead>平均ターン (分)</TableHead>
                  <TableHead>最大ターン (分)</TableHead>
                  <TableHead>重複合計 (分)</TableHead>
                  <TableHead>警告 (H/S)</TableHead>
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
                  const warningCounts = summary.warningCounts ?? { critical: 0, warn: 0 };
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
                      <TableCell>
                        <Badge variant={warningCounts.critical > 0 ? 'destructive' : 'outline'}>
                          H {warningCounts.critical}
                        </Badge>
                        <Badge
                          variant={warningCounts.warn > 0 ? 'secondary' : 'outline'}
                          className="ml-2"
                        >
                          S {warningCounts.warn}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
      <CardTitle>未割当 便</CardTitle>
      <CardDescription>ブロックに割り当てられていない便を一覧で確認できます。</CardDescription>
      </CardHeader>
      <CardContent>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">未割当の便はありません。</p>
        ) : (
          <div className="overflow-x-auto">
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
          </div>
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
  return `サービス日 ${index + 1}`;
}

