/**
 * src/features/dashboard/DashboardView.tsx
 * 運行ダッシュボード。KPI カード、可視化、詳細テーブル、警告タイムラインを提供する。
 */
import { useEffect, useMemo, useState, useCallback } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { isStepOne } from '@/config/appStep';
import { buildBlocksPlan, DEFAULT_MAX_TURN_GAP_MINUTES } from '@/services/blocks/blockBuilder';
import { buildTripLookup, enrichDutySegments, computeDutyMetrics, summarizeDutyWarnings, formatMinutes } from '@/services/duty/dutyMetrics';
import { computeDutyDashboard, type DutyTimelineSummary } from '@/services/dashboard/dutyDashboard';
import { downloadCsv } from '@/utils/downloadCsv';
import { toast } from 'sonner';
import { aggregateDutyWarnings } from '@/services/duty/aggregateDutyWarnings';
import {
  ensureWorkflowSession,
  markWorkflowWarningsViewed,
  getWorkflowStats,
  getWorkflowSessions,
  subscribeWorkflowTelemetry,
  exportWorkflowSessionsCsv,
  type WorkflowStats,
} from '@/services/workflow/workflowTelemetry';
import { useExportConfirmation } from '@/components/export/ExportConfirmationProvider';

interface SummaryCardProps {
  id: string;
  title: string;
  value: string;
  description: string;
  delta?: number;
  deltaLabel?: string;
  severity?: 'neutral' | 'warning' | 'critical';
  tooltip?: string;
  onClick?: () => void;
}

interface SparklineProps {
  title: string;
  subtitle: string;
  color: string;
  points: Array<{ label: string; value: number }>;
}

interface DriverBarListProps {
  items: Array<{ driverId: string; shiftCount: number; hours: number }>; 
}

interface DutyDetailRow {
  dutyId: string;
  driverId: string;
  totalMinutes: number;
  coverageLabel: string;
  hardWarnings: number;
  softWarnings: number;
  messages: string[];
}

export default function DashboardView(): JSX.Element {
  const { result, dutyState, manual } = useGtfsImport();
  const showKpiUi = !isStepOne;
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats>(() => getWorkflowStats());
  const { requestConfirmation } = useExportConfirmation();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    maxContinuousMinutes: '',
    minBreakMinutes: '',
    maxDailyMinutes: '',
    maxUnassignedPercentage: '',
    maxNightShiftVariance: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'hard' | 'soft'>('all');

  const plan = useMemo(
    () =>
      buildBlocksPlan(result, {
        maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES,
        linkingEnabled: false,
      }),
    [result],
  );
  const tripLookup = useMemo(() => buildTripLookup(plan.csvRows), [plan.csvRows]);

  const warningTotals = useMemo(
    () => aggregateDutyWarnings(dutyState.duties, tripLookup, dutyState.settings),
    [dutyState.duties, dutyState.settings, tripLookup],
  );

  const dutySummaries = useMemo<DutyTimelineSummary[]>(() => {
    return dutyState.duties.map((duty) => {
      const segments = enrichDutySegments(duty, tripLookup);
      if (segments.length === 0) {
        return { id: duty.id, driverId: duty.driverId };
      }
      return {
        id: duty.id,
        driverId: duty.driverId ?? undefined,
        startMinutes: segments[0]?.startMinutes,
        endMinutes: segments[segments.length - 1]?.endMinutes,
      } satisfies DutyTimelineSummary;
    });
  }, [dutyState.duties, tripLookup]);

  const dashboard = useMemo(
    () =>
      computeDutyDashboard(dutySummaries, {
        maxUnassignedPercentage: dutyState.settings.maxUnassignedPercentage,
        maxNightShiftVariance: dutyState.settings.maxNightShiftVariance,
      }),
    [dutySummaries, dutyState.settings.maxNightShiftVariance, dutyState.settings.maxUnassignedPercentage],
  );

  const dutyDetails = useMemo<DutyDetailRow[]>(() => {
    return dutyState.duties.map((duty) => {
      const metrics = computeDutyMetrics(duty, tripLookup, dutyState.settings);
      const summary = summarizeDutyWarnings(metrics);
      const totalMinutes = metrics.totalSpanMinutes ?? 0;
      const coverageLabel = metrics.totalSpanMinutes ? formatMinutes(metrics.totalSpanMinutes) : '-';
      return {
        dutyId: duty.id,
        driverId: duty.driverId ?? '未割当',
        totalMinutes,
        coverageLabel,
        hardWarnings: summary.hard,
        softWarnings: summary.soft,
        messages: summary.messages.map((entry) => entry.message),
      };
    });
  }, [dutyState.duties, dutyState.settings, tripLookup]);

  const filteredDetails = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const matchesSearch = (row: DutyDetailRow) => {
      if (!normalized) return true;
      return row.dutyId.toLowerCase().includes(normalized) || row.driverId.toLowerCase().includes(normalized);
    };
    const matchesSeverity = (row: DutyDetailRow) => {
      if (severityFilter === 'all') return true;
      if (severityFilter === 'hard') return row.hardWarnings > 0;
      return row.hardWarnings === 0 && row.softWarnings > 0;
    };
    return dutyDetails.filter((row) => matchesSearch(row) && matchesSeverity(row));
  }, [dutyDetails, searchTerm, severityFilter]);

  const createDetailsExport = useCallback(() => {
    const header = ['duty_id', 'driver_id', 'total_minutes', 'hard_warnings', 'soft_warnings', 'messages'];
    const rows = filteredDetails.map((row) => [
      row.dutyId,
      row.driverId,
      String(row.totalMinutes),
      String(row.hardWarnings),
      String(row.softWarnings),
      row.messages.join(' | '),
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const timestamp = new Date().toISOString().replace(/-|:|T/g, '').slice(0, 12);
    const fileName = `duty-kpi-details-${timestamp}.csv`;
    return { csv, fileName, rowCount: rows.length };
  }, [filteredDetails]);

  const dailyCoverageTrend = useMemo(() => {
    if (dashboard.dailyMetrics.length < 2) {
      return undefined;
    }
    const sorted = [...dashboard.dailyMetrics].sort((a, b) => a.dayIndex - b.dayIndex);
    const latest = sorted[sorted.length - 1]!.coveragePercentage;
    const previous = sorted[sorted.length - 2]!.coveragePercentage;
    return latest - previous;
  }, [dashboard.dailyMetrics]);

  const unassignedTrend = useMemo(() => {
    if (dashboard.dailyMetrics.length < 2) {
      return undefined;
    }
    const sorted = [...dashboard.dailyMetrics].sort((a, b) => a.dayIndex - b.dayIndex);
    const latest = sorted[sorted.length - 1]!.unassignedCount;
    const previous = sorted[sorted.length - 2]!.unassignedCount;
    return latest - previous;
  }, [dashboard.dailyMetrics]);

  const coverageSeries = useMemo(
    () =>
      dashboard.dailyMetrics
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((metric) => ({ label: metric.label, value: metric.coveragePercentage })),
    [dashboard.dailyMetrics],
  );
  const unassignedSeries = useMemo(
    () =>
      dashboard.dailyMetrics
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((metric) => ({ label: metric.label, value: metric.unassignedCount })),
    [dashboard.dailyMetrics],
  );

  const hasData = dutySummaries.length > 0;
  const unassignedDutyIds = useMemo(
    () => dutySummaries.filter((duty) => !duty.driverId).map((duty) => duty.id),
    [dutySummaries],
  );

  useEffect(() => {
    const summary = {
      hardWarnings: warningTotals.hard,
      softWarnings: warningTotals.soft,
      unassigned: warningTotals.unassigned,
      coveragePercentage: dashboard.summary.coveragePercentage,
      fairnessScore: dashboard.summary.fairnessScore,
    } satisfies Parameters<typeof ensureWorkflowSession>[0];
    ensureWorkflowSession(summary);
    markWorkflowWarningsViewed(summary);
  }, [
    warningTotals.hard,
    warningTotals.soft,
    warningTotals.unassigned,
    dashboard.summary.coveragePercentage,
    dashboard.summary.fairnessScore,
  ]);

  useEffect(() => {
    setWorkflowStats(getWorkflowStats());
    const unsubscribe = subscribeWorkflowTelemetry(() => {
      setWorkflowStats(getWorkflowStats());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;
    setForm({
      maxContinuousMinutes: String(dutyState.settings.maxContinuousMinutes),
      minBreakMinutes: String(dutyState.settings.minBreakMinutes),
      maxDailyMinutes: String(dutyState.settings.maxDailyMinutes),
      maxUnassignedPercentage: String(dutyState.settings.maxUnassignedPercentage),
      maxNightShiftVariance: String(dutyState.settings.maxNightShiftVariance),
    });
    setFormError(null);
  }, [dutyState.settings, isSettingsOpen]);

  const handleSettingsSave = () => {
    const parsed = {
      maxContinuousMinutes: Number.parseInt(form.maxContinuousMinutes, 10),
      minBreakMinutes: Number.parseInt(form.minBreakMinutes, 10),
      maxDailyMinutes: Number.parseInt(form.maxDailyMinutes, 10),
      maxUnassignedPercentage: Number.parseInt(form.maxUnassignedPercentage, 10),
      maxNightShiftVariance: Number.parseInt(form.maxNightShiftVariance, 10),
    };

    const hasNaN = Object.values(parsed).some((value) => !Number.isFinite(value));
    if (hasNaN) {
      setFormError('すべての項目に数値を入力してください。');
      return;
    }

    dutyState.settings.maxContinuousMinutes = parsed.maxContinuousMinutes;
    dutyState.settings.minBreakMinutes = parsed.minBreakMinutes;
    dutyState.settings.maxDailyMinutes = parsed.maxDailyMinutes;
    dutyState.settings.maxUnassignedPercentage = parsed.maxUnassignedPercentage;
    dutyState.settings.maxNightShiftVariance = parsed.maxNightShiftVariance;
    toast.success('KPI 設定を更新しました。');
    setIsSettingsOpen(false);
  };

  const handleExportDetails = () => {
    if (filteredDetails.length === 0) {
      toast.info('エクスポートできる行がありません。');
      return;
    }
    const snapshot = createDetailsExport();
    requestConfirmation({
      title: 'KPI 詳細をエクスポートしますか？',
      description: '連結→警告確認→保存ワークフローの観点で指標を記録します。',
      summary: {
        hardWarnings: warningTotals.hard,
        softWarnings: warningTotals.soft,
        unassigned: warningTotals.unassigned,
        metrics: [
          { label: '出力行数', value: `${snapshot.rowCount}` },
          { label: 'カバレッジ', value: `${dashboard.summary.coveragePercentage}%` },
        ],
      },
      context: { entity: 'dashboard', exportType: 'kpi-details', fileName: snapshot.fileName },
      onConfirm: async () => {
        const latest = createDetailsExport();
        downloadCsv({ fileName: latest.fileName, content: latest.csv });
        toast.success('KPI 詳細をエクスポートしました。');
      },
    });
  };

  const handleExportWorkflowLog = () => {
    const sessions = getWorkflowSessions();
    if (sessions.length === 0) {
      toast.info('計測済みのワークフローがありません。');
      return;
    }
    const csv = exportWorkflowSessionsCsv(sessions);
    const timestamp = new Date().toISOString().replace(/-|:|T/g, '').slice(0, 12);
    downloadCsv({ fileName: `workflow-kpi-${timestamp}.csv`, content: csv });
    toast.success('ワークフロー KPI ログをエクスポートしました。');
  };

  const summaryCards: SummaryCardProps[] = [
    {
      id: 'coverage',
      title: 'カバレッジ',
      value: `${dashboard.summary.coveragePercentage}%`,
      description: '割り当て済み乗務の割合',
      delta: dailyCoverageTrend,
      deltaLabel: '前日比',
      severity: dashboard.summary.coveragePercentage < 100 - dutyState.settings.maxUnassignedPercentage ? 'warning' : 'neutral',
      tooltip: `割当 ${dashboard.summary.totalShifts} / ${dashboard.summary.totalShifts + dashboard.summary.unassignedCount}`,
    },
    {
      id: 'unassigned',
      title: '未割当 乗務',
      value: `${dashboard.summary.unassignedCount} 件`,
      description: '運転士がまだ決まっていない乗務',
      delta: unassignedTrend,
      deltaLabel: '前日差',
      severity: dashboard.summary.unassignedCount > 0 ? 'warning' : 'neutral',
      tooltip: unassignedDutyIds.join(', ') || '未割当なし',
    },
    {
      id: 'hours',
      title: '総稼働時間',
      value: `${dashboard.summary.totalHours.toLocaleString()} 時間`,
      description: '割当済み乗務の稼働時間',
      severity: 'neutral',
      tooltip: '運転士単位で積算した稼働時間の合計',
    },
    {
      id: 'fairness',
      title: '公平性スコア',
      value: `${dashboard.summary.fairnessScore}`,
      description: '割当の偏りを 0-100 で評価',
      severity: dashboard.summary.fairnessScore < 100 - dutyState.settings.maxNightShiftVariance ? 'warning' : 'neutral',
      tooltip: '運転士ごとの乗務件数の偏りを基に算出',
    },
  ];

  const workflowMedianDisplay = {
    linkToWarnings: formatDurationMs(workflowStats.medianLinkToWarningsMs),
    warningsToSave: formatDurationMs(workflowStats.medianWarningsToSaveMs),
    linkToSave: formatDurationMs(workflowStats.medianLinkToSaveMs),
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">運行ダッシュボード</h2>
            <p className="text-sm text-muted-foreground">
              乗務の配分状況を確認し、警告の根拠や詳細データを参照できます。
            </p>
          </div>
          {showKpiUi ? (
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
              KPI 設定を編集
            </Button>
          ) : null}
        </div>

        {showKpiUi ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <SummaryCard key={card.id} {...card} />
            ))}
          </div>
        ) : null}

        {showKpiUi ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>ワークフロー KPI ログ</CardTitle>
                <CardDescription>連結→警告確認→保存までの所要時間を計測しています。</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">計測 {workflowStats.total} 件</Badge>
                <Button variant="secondary" size="sm" onClick={handleExportWorkflowLog} disabled={workflowStats.total === 0}>
                  CSV を書き出す
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <WorkflowMetric label="連結→警告確認 (中央値)" value={workflowMedianDisplay.linkToWarnings} />
                <WorkflowMetric label="警告確認→保存 (中央値)" value={workflowMedianDisplay.warningsToSave} />
                <WorkflowMetric label="連結→保存 (中央値)" value={workflowMedianDisplay.linkToSave} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">直近の計測</p>
                {workflowStats.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">まだ計測がありません。</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {workflowStats.recent.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-medium">
                          {new Date(entry.savedAt).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'medium' })}
                        </span>
                        <span className="text-muted-foreground">連結→保存 {formatDurationMs(entry.linkToSaveMs)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {hasData ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>カバレッジ推移</CardTitle>
                  <CardDescription>日別のカバレッジと未割当件数の推移</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <Sparkline title="カバレッジ" subtitle="%" color="#16a34a" points={coverageSeries} />
                  <Sparkline title="未割当" subtitle="件" color="#ef4444" points={unassignedSeries} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>運転士別稼働 (Top5)</CardTitle>
                  <CardDescription>割当件数と稼働時間の概況</CardDescription>
                </CardHeader>
                <CardContent>
                  <DriverBarList items={dashboard.workloads} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>KPI 詳細テーブル</CardTitle>
                  <CardDescription>乗務ごとの稼働時間と警告の内訳。検索や絞り込みが可能です。</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="乗務ID / 運転士ID を検索"
                    className="w-[200px]"
                  />
                  <Button
                    variant={severityFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setSeverityFilter('all')}
                  >
                    全て
                  </Button>
                  <Button
                    variant={severityFilter === 'hard' ? 'default' : 'outline'}
                    onClick={() => setSeverityFilter('hard')}
                  >
                    重大
                  </Button>
                  <Button
                    variant={severityFilter === 'soft' ? 'default' : 'outline'}
                    onClick={() => setSeverityFilter('soft')}
                  >
                    注意
                  </Button>
                  <Button variant="secondary" onClick={handleExportDetails}>
                    CSV エクスポート
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[320px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                    <TableHead>乗務ID</TableHead>
                    <TableHead>運転士</TableHead>
                    <TableHead className="text-right">稼働時間</TableHead>
                    <TableHead className="text-right">重大</TableHead>
                    <TableHead className="text-right">注意</TableHead>
                      <TableHead>メッセージ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDetails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          条件に合致する行がありません。
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDetails.map((row) => (
                        <TableRow key={row.dutyId}>
                          <TableCell className="font-medium">{row.dutyId}</TableCell>
                          <TableCell>{row.driverId}</TableCell>
                          <TableCell className="text-right">{row.coverageLabel}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.hardWarnings > 0 ? 'destructive' : 'outline'}>重大 {row.hardWarnings}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.softWarnings > 0 ? 'secondary' : 'outline'}>注意 {row.softWarnings}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.messages.length === 0 ? '問題ありません。' : row.messages.join(' / ')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>警告タイムライン</CardTitle>
                <CardDescription>日別のアラート履歴。対応が必要なケースを把握します。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.alertHistory.length === 0 && dashboard.alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">直近の警告はありません。</p>
                ) : (
                  <>
                    {dashboard.alerts.length > 0 ? (
                      <Alert>
                        <AlertTitle>現在の警告</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc space-y-1 pl-5 text-sm">
                            {dashboard.alerts.map((alert) => (
                              <li key={`current-${alert.id}-${alert.message}`}>{alert.message}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="space-y-2">
                      {dashboard.alertHistory.map((entry) => (
                        <div key={entry.label} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{entry.label}</span>
                            <Badge variant={entry.alerts.some((alert) => alert.severity === 'critical') ? 'destructive' : 'secondary'}>
                              {entry.alerts.length} 件
                            </Badge>
                          </div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {entry.alerts.map((alert) => (
                              <li key={`${entry.label}-${alert.id}`}>{alert.message}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>データが不足しています</CardTitle>
          <CardDescription>GTFS を取り込み、乗務を少なくとも 1 件追加するとダッシュボードが集計されます。</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>KPI 設定</DialogTitle>
              <DialogDescription>割当ルールを見直し、ダッシュボードの基準値を調整できます。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <NumberField
                label="連続稼働の上限 (分)"
                value={form.maxContinuousMinutes}
                onChange={(value) => setForm((prev) => ({ ...prev, maxContinuousMinutes: value }))}
                inputId="kpi-max-continuous"
              />
              <NumberField
                label="最低休憩時間 (分)"
                value={form.minBreakMinutes}
                onChange={(value) => setForm((prev) => ({ ...prev, minBreakMinutes: value }))}
                inputId="kpi-min-break"
              />
              <NumberField
                label="1 日あたりの上限 (分)"
                value={form.maxDailyMinutes}
                onChange={(value) => setForm((prev) => ({ ...prev, maxDailyMinutes: value }))}
                inputId="kpi-max-daily"
              />
              <NumberField
                label="未割当率の上限 (%)"
                value={form.maxUnassignedPercentage}
                onChange={(value) => setForm((prev) => ({ ...prev, maxUnassignedPercentage: value }))}
                inputId="kpi-max-unassigned"
              />
              <NumberField
                label="公平性の許容偏差 (%)"
                value={form.maxNightShiftVariance}
                onChange={(value) => setForm((prev) => ({ ...prev, maxNightShiftVariance: value }))}
                inputId="kpi-fairness"
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSettingsSave}>保存する</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function SummaryCard({ title, value, description, delta, deltaLabel, severity = 'neutral', tooltip, onClick }: SummaryCardProps): JSX.Element {
  const severityVariant = severity === 'critical' ? 'destructive' : severity === 'warning' ? 'secondary' : 'outline';
  const deltaDisplay = typeof delta === 'number' ? (delta > 0 ? `+${delta}` : `${delta}`) : null;
  const severityLabel = severity === 'critical' ? '重大' : severity === 'warning' ? '注意' : '良好';

  const body = (
    <Card
      className={onClick ? 'cursor-pointer transition hover:border-primary/60' : undefined}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Badge variant={severityVariant}>{severityLabel}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {deltaDisplay !== null && deltaLabel ? (
          <p className="text-xs text-muted-foreground">{deltaLabel}: {deltaDisplay}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{body}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
  return body;
}

function Sparkline({ title, subtitle, color, points }: SparklineProps): JSX.Element {
  if (points.length === 0) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">データが不足しています。</div>
    );
  }
  const maxValue = Math.max(...points.map((point) => point.value));
  const minValue = Math.min(...points.map((point) => point.value));
  const normalized = points.map((point, index) => ({
    x: (index / Math.max(1, points.length - 1)) * 100,
    y: maxValue === minValue ? 50 : ((maxValue - point.value) / (maxValue - minValue)) * 100,
  }));
  const path = normalized.map((point) => `${point.x},${point.y}`).join(' ');
  const latest = points[points.length - 1]!;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-muted-foreground">{latest.value} {subtitle}</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-24 w-full">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2}
          points={path}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={normalized[normalized.length - 1]!.x} cy={normalized[normalized.length - 1]!.y} r={2.5} fill={color} />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}

function DriverBarList({ items }: DriverBarListProps): JSX.Element {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">割当済みの運転士はまだありません。</p>;
  }
  const sorted = [...items].sort((a, b) => b.shiftCount - a.shiftCount);
  const topFive = sorted.slice(0, 5);
  const maxShift = Math.max(...topFive.map((item) => item.shiftCount));
  return (
    <div className="space-y-3">
      {topFive.map((item) => (
        <div key={item.driverId}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.driverId}</span>
            <span className="text-muted-foreground">{item.shiftCount} 件 / {item.hours.toLocaleString()} 時間</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${maxShift === 0 ? 0 : Math.round((item.shiftCount / maxShift) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {sorted.length > 5 ? (
        <p className="text-xs text-muted-foreground">他 {sorted.length - 5} 名</p>
      ) : null}
    </div>
  );
}

function WorkflowMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange, inputId }: { label: string; value: string; onChange: (value: string) => void; inputId: string }): JSX.Element {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor={inputId}>{label}</label>
      <Input
        id={inputId}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function formatDurationMs(value?: number | null): string {
  if (value === null || value === undefined) {
    return '計測なし';
  }
  if (value <= 0) {
    return '0秒';
  }
  const totalSeconds = Math.round(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分${seconds}秒`;
  }
  if (minutes > 0) {
    return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}
