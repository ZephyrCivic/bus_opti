/**
 * src/features/blocks/BlocksView.tsx
 * ブロック（行路）編集結果を確認し、ターン間隔や重複状況を把握する画面。
 * タイムライン、統計カード、詳細テーブル、未割当便一覧を提供する。
 */
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TimelineGantt from '@/features/timeline/TimelineGantt';
import { DEFAULT_PIXELS_PER_MINUTE, parseTimeLabel } from '@/features/timeline/timeScale';
import type { TimelineLane } from '@/features/timeline/types';
import {
  buildBlocksPlan,
  countWarnings,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  evaluateBlockWarnings,
  type BlockCsvRow,
  type BlockPlan,
  type BlockSummary,
  type BlockWarningCounts,
  type BlockWarningDetail,
} from '@/services/blocks/blockBuilder';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { useBlocksPlan } from './hooks/useBlocksPlan';
import { useManualBlocksPlan } from './hooks/useManualBlocksPlan';
import { isStepOne } from '@/config/appStep';

const MIN_TURN_GAP = 0;
const MAX_TURN_GAP = 180;

export default function BlocksView(): JSX.Element {
  const { result, manual } = useGtfsImport();
  const [turnGap, setTurnGap] = useState<number>(DEFAULT_MAX_TURN_GAP_MINUTES);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [fromBlockId, setFromBlockId] = useState<string>('');
  const [toBlockId, setToBlockId] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const diagnosticsEnabled = !isStepOne;

  const initialPlan = useMemo<BlockPlan>(
    () =>
      buildBlocksPlan(result, {
        maxTurnGapMinutes: turnGap,
        minTurnaroundMinutes: manual.linking.minTurnaroundMin,
        linkingEnabled: false,
      }),
    [result, turnGap, manual.linking.minTurnaroundMin, manual.linking.enabled],
  );
  const manualPlanConfig = useMemo(
    () => ({
      minTurnaroundMin: 0,
      maxGapMinutes: Number.MAX_SAFE_INTEGER,
    }),
    [],
  );
  const manualPlanState = useManualBlocksPlan(initialPlan, manualPlanConfig);
  const { days, allDays, overlaps } = useBlocksPlan(manualPlanState.plan, { activeDay: activeDayIndex ?? undefined });

  useEffect(() => {
    const blockIds = new Set(manualPlanState.plan.summaries.map((summary) => summary.blockId));
    setFromBlockId((current) => (current && !blockIds.has(current) ? '' : current));
    setToBlockId((current) => (current && !blockIds.has(current) ? '' : current));
  }, [manualPlanState.plan]);

  const manualBlockSummaries = useMemo(
    () =>
      [...manualPlanState.plan.summaries].sort((a, b) => {
        if (a.serviceDayIndex !== b.serviceDayIndex) {
          return a.serviceDayIndex - b.serviceDayIndex;
        }
        return a.firstTripStart.localeCompare(b.firstTripStart);
      }),
    [manualPlanState.plan],
  );

  const manualToSummaries = useMemo(() => {
    if (!fromBlockId) {
      return manualBlockSummaries;
    }
    const candidates = manualPlanState.candidatesFor(fromBlockId);
    if (!candidates || candidates.length === 0) {
      return [];
    }
    const candidateIds = new Set(candidates.map((candidate) => candidate.blockId));
    return manualBlockSummaries.filter((summary) => candidateIds.has(summary.blockId));
  }, [manualBlockSummaries, manualPlanState.candidatesFor, fromBlockId]);

  const handleFromChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFromBlockId(value);
    setManualStatus(null);
    setToBlockId('');
  };

  const handleToChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setToBlockId(value);
    setManualStatus(null);
  };

  const handleConnect = () => {
    if (!fromBlockId || !toBlockId) {
      setManualStatus({ type: 'error', message: '連結元と連結先を選択してください。' });
      return;
    }
    const succeeded = manualPlanState.connect(fromBlockId, toBlockId);
    if (succeeded) {
      setManualStatus({ type: 'success', message: `${fromBlockId} と ${toBlockId} を連結しました。` });
      setToBlockId('');
    } else {
      setManualStatus({ type: 'error', message: '連結できませんでした。サービス日と時刻を確認してください。' });
    }
  };

  const handleUndo = () => {
    const undone = manualPlanState.undoLastConnection();
    if (undone) {
      setManualStatus({ type: 'success', message: '直前の連結を取り消しました。' });
    } else {
      setManualStatus({ type: 'error', message: '取り消す連結がありません。' });
    }
  };

  const canConnect = fromBlockId !== '' && toBlockId !== '';
  const canUndo = manualPlanState.connections.length > 0;

  useEffect(() => {
    if (toBlockId && !manualToSummaries.some((summary) => summary.blockId === toBlockId)) {
      setToBlockId('');
    }
  }, [manualToSummaries, toBlockId]);

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

  const coveragePercentage = Math.round(manualPlanState.plan.coverageRatio * 100);

  const overlapMinutesByBlock = useMemo(() => {
    const map = new Map<string, number>();
    for (const summary of manualPlanState.plan.summaries) {
      const total = (overlaps.get(summary.blockId) ?? []).reduce(
        (accumulator, entry) => accumulator + entry.overlapMinutes,
        0,
      );
      map.set(summary.blockId, Number(total.toFixed(2)));
    }
    return map;
  }, [manualPlanState.plan, overlaps]);

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

  const warningDiagnostics = useMemo(() => {
    if (!diagnosticsEnabled) {
      return null;
    }
    const minTurn = Math.max(0, manual.linking.minTurnaroundMin);
    const grouped = new Map<string, BlockCsvRow[]>();
    for (const row of manualPlanState.plan.csvRows) {
      const list = grouped.get(row.blockId) ?? [];
      list.push(row);
      grouped.set(row.blockId, list);
    }
    const map = new Map<string, { counts: BlockWarningCounts; warnings: BlockWarningDetail[] }>();
    for (const [blockId, rows] of grouped.entries()) {
      const warnings = evaluateBlockWarnings(rows, minTurn);
      map.set(blockId, {
        counts: countWarnings(warnings),
        warnings,
      });
    }
    return map;
  }, [diagnosticsEnabled, manual.linking.minTurnaroundMin, manualPlanState.plan.csvRows]);

  const showDiagnostics = diagnosticsEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">行路編集</h2>
        <p className="text-sm text-muted-foreground">
          GTFS 取込データの便を可視化し、ターン間隔（現在 {manualPlanState.plan.maxTurnGapMinutes} 分）と重複状況を確認します。手動連結の判断材料として活用してください。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>手動連結（最小UI）</CardTitle>
            <CardDescription>
              Step1 ではブロックを手作業で連結します。候補提示や自動判定は行わず、連結/取り消しのみ提供します。
            </CardDescription>
          </div>
          <Badge variant="outline">連結数: {manualPlanState.connections.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="blocks-manual-from" className="text-sm font-medium text-muted-foreground">
                連結元ブロック
              </label>
              <select
                id="blocks-manual-from"
                data-testid="blocks-manual-from"
                value={fromBlockId}
                onChange={handleFromChange}
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">選択してください</option>
                {manualBlockSummaries.map((summary) => (
                  <option key={summary.blockId} value={summary.blockId}>
                    {formatBlockOption(summary)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="blocks-manual-to" className="text-sm font-medium text-muted-foreground">
                連結先ブロック
              </label>
              <select
                id="blocks-manual-to"
                data-testid="blocks-manual-to"
                value={toBlockId}
                onChange={handleToChange}
                disabled={fromBlockId === ''}
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">選択してください</option>
                {manualToSummaries
                  .filter((summary) => summary.blockId !== fromBlockId)
                  .map((summary) => (
                    <option key={summary.blockId} value={summary.blockId}>
                      {formatBlockOption(summary)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                data-testid="blocks-manual-connect"
                onClick={handleConnect}
                disabled={!canConnect}
              >
                連結
              </Button>
              <Button
                type="button"
                data-testid="blocks-manual-undo"
                onClick={handleUndo}
                variant="outline"
                disabled={!canUndo}
              >
                取り消し
              </Button>
            </div>
          </div>
          {manualStatus && (
            <p
              className={`text-sm ${
                manualStatus.type === 'success' ? 'text-emerald-600' : 'text-destructive'
              }`}
              data-testid="blocks-manual-status"
            >
              {manualStatus.message}
            </p>
          )}
        </CardContent>
      </Card>

      {showDiagnostics ? (
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <CardTitle>ターン設定（参考）</CardTitle>
              <CardDescription>
              ターン間隔は参考指標として表示されます。必要に応じて手動連結の前後確認に利用してください。
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
              <StatCard label="割り当て済み便" value={manualPlanState.plan.assignedTripCount.toLocaleString()} />
              <StatCard label="対象便件数" value={manualPlanState.plan.totalTripCount.toLocaleString()} />
              <StatCard
                label="カバレッジ率"
                value={`${coveragePercentage}%`}
                trend={coverageBadgeVariant(coveragePercentage)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

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
              {showDiagnostics ? (
                visibleOverlapSummaries.length > 0 ? (
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
                )
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <BlocksTable
        summaries={manualPlanState.plan.summaries}
        overlapMinutesByBlock={overlapMinutesByBlock}
        showDiagnostics={showDiagnostics}
        warningDiagnostics={warningDiagnostics ?? undefined}
      />
      <UnassignedTable unassigned={manualPlanState.plan.unassignedTripIds} />
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
  showDiagnostics: boolean;
  warningDiagnostics?: Map<string, { counts: BlockWarningCounts; warnings: BlockWarningDetail[] }>;
}

function BlocksTable({
  summaries,
  overlapMinutesByBlock,
  showDiagnostics,
  warningDiagnostics,
}: BlocksTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ブロック一覧</CardTitle>
        <CardDescription>編集した行路の概要やターン間隔、重複量を確認できます。</CardDescription>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">ブロックの計算結果がありません。GTFS フィードを取り込んでください。</p>
        ) : (
          <TooltipProvider delayDuration={0}>
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
                    {showDiagnostics ? <TableHead>警告 (H/S/I)</TableHead> : null}
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
                      <TableRow key={summary.blockId} data-block-id={summary.blockId}>
                        <TableCell className="font-medium">{summary.blockId}</TableCell>
                        <TableCell>{summary.serviceId ?? '未設定'}</TableCell>
                        <TableCell>{formatServiceDay(summary.serviceDayIndex)}</TableCell>
                        <TableCell>{summary.tripCount}</TableCell>
                        <TableCell>{summary.firstTripStart}</TableCell>
                        <TableCell>{summary.lastTripEnd}</TableCell>
                        <TableCell>{averageGap}</TableCell>
                        <TableCell>{maxGap}</TableCell>
                        <TableCell>{overlapMinutes.toFixed(1)}</TableCell>
                        {showDiagnostics ? (
                          <TableCell data-testid="blocks-warning-cell">
                            <WarningsBadge
                              summary={summary}
                              diagnostics={warningDiagnostics?.get(summary.blockId)}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
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

function formatBlockOption(summary: BlockSummary): string {
  return `${formatServiceDay(summary.serviceDayIndex)} - ${summary.blockId}（便 ${summary.tripCount} 件）`;
}

function formatServiceDay(index: number): string {
  return `サービス日 ${index + 1}`;
}

function WarningsBadge({
  summary,
  diagnostics,
}: {
  summary: BlockSummary;
  diagnostics?: { counts: BlockWarningCounts; warnings: BlockWarningDetail[] };
}): JSX.Element {
  const counts = diagnostics?.counts ?? summary.warningCounts ?? { critical: 0, warn: 0, info: 0 };
  const details = diagnostics?.warnings ?? summary.warnings ?? [];
  const total = (counts.critical ?? 0) + (counts.warn ?? 0) + (counts.info ?? 0);

  if (total === 0) {
    return <span className="text-xs text-muted-foreground">警告なし</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2" data-testid={`blocks-warning-badges-${summary.blockId}`}>
          <Badge variant={counts.critical > 0 ? 'destructive' : 'outline'}>H {counts.critical ?? 0}</Badge>
          <Badge variant={counts.warn > 0 ? 'secondary' : 'outline'}>S {counts.warn ?? 0}</Badge>
          <Badge variant={counts.info > 0 ? 'default' : 'outline'}>I {counts.info ?? 0}</Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent
        align="end"
        className="max-w-xs space-y-1"
        data-testid={`blocks-warning-tooltip-${summary.blockId}`}
      >
        {details.length === 0 ? (
          <p className="text-xs leading-5">警告の内訳が取得できませんでした。</p>
        ) : (
          details.map((warning, index) => (
            <p key={`${warning.code}-${index}`} className="text-xs leading-5">
              {formatWarningDetail(warning)}
            </p>
          ))
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function formatWarningDetail(warning: BlockWarningDetail): string {
  switch (warning.code) {
    case 'BLK_NEG_GAP': {
      const from = warning.fromTripId ?? '前便';
      const to = warning.toTripId ?? '次便';
      const gap = warning.gapMinutes ?? 0;
      return `${from} → ${to} の時刻が重なっています（ギャップ ${gap} 分）。`;
    }
    case 'BLK_TURN_SHORT': {
      const from = warning.fromTripId ?? '前便';
      const to = warning.toTripId ?? '次便';
      const gap = warning.gapMinutes ?? 0;
      return `${from} → ${to} のターン間隔が ${gap} 分で最小ターン未満です。`;
    }
    case 'BLK_SVC_MISMATCH':
      return '同じブロック内で service_id が混在しています。';
    default:
      return '詳細不明の警告です。';
  }
}

