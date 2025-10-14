/**
 * src/features/dashboard/DashboardView.tsx
 * 運行ダッシュボード。KPI カード、ドライバー別稼働、未割当 Duty、KPI 設定編集を提供する。
 */
import { useEffect, useMemo, useState } from 'react';

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
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { buildBlocksPlan, DEFAULT_MAX_TURN_GAP_MINUTES } from '@/services/blocks/blockBuilder';
import { buildTripLookup, enrichDutySegments } from '@/services/duty/dutyMetrics';
import { computeDutyDashboard } from '@/services/dashboard/dutyDashboard';
import { toast } from 'sonner';

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
}

function SummaryCard({ title, value, description }: SummaryCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardView(): JSX.Element {
  const { result, dutyState, manual, dutyActions } = useGtfsImport();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    maxContinuousMinutes: '',
    minBreakMinutes: '',
    maxDailyMinutes: '',
    maxUnassignedPercentage: '',
    maxNightShiftVariance: '',
  });

  const plan = useMemo(
    () => buildBlocksPlan(result, { maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES, linkingEnabled: manual.linking.enabled }),
    [result, manual.linking.enabled],
  );
  const tripLookup = useMemo(() => buildTripLookup(plan.csvRows), [plan.csvRows]);

  const dutySummaries = useMemo(() => {
    return dutyState.duties.map((duty) => {
      const segments = enrichDutySegments(duty, tripLookup);
      if (segments.length === 0) {
        return { id: duty.id, driverId: duty.driverId };
      }
      return {
        id: duty.id,
        driverId: duty.driverId,
        startMinutes: segments[0]?.startMinutes,
        endMinutes: segments[segments.length - 1]?.endMinutes,
      };
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

  const hasData = dutySummaries.length > 0;
  const unassigned = useMemo(
    () => dutySummaries.filter((duty) => !duty.driverId).map((duty) => duty.id),
    [dutySummaries],
  );

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

    if (
      Number.isNaN(parsed.maxContinuousMinutes) ||
      Number.isNaN(parsed.minBreakMinutes) ||
      Number.isNaN(parsed.maxDailyMinutes) ||
      Number.isNaN(parsed.maxUnassignedPercentage) ||
      Number.isNaN(parsed.maxNightShiftVariance)
    ) {
      setFormError('すべての項目を数値で入力してください。');
      return;
    }
    if (
      parsed.maxContinuousMinutes < 0 ||
      parsed.maxContinuousMinutes > 1440 ||
      parsed.minBreakMinutes < 0 ||
      parsed.minBreakMinutes > 1440 ||
      parsed.maxDailyMinutes < 0 ||
      parsed.maxDailyMinutes > 1440
    ) {
      setFormError('分単位の項目は 0〜1440 の範囲で入力してください。');
      return;
    }
    if (
      parsed.maxUnassignedPercentage < 0 ||
      parsed.maxUnassignedPercentage > 100 ||
      parsed.maxNightShiftVariance < 0 ||
      parsed.maxNightShiftVariance > 100
    ) {
      setFormError('割合の項目は 0〜100 の範囲で入力してください。');
      return;
    }

    dutyActions.updateSettings({
      maxContinuousMinutes: parsed.maxContinuousMinutes,
      minBreakMinutes: parsed.minBreakMinutes,
      maxDailyMinutes: parsed.maxDailyMinutes,
      maxUnassignedPercentage: parsed.maxUnassignedPercentage,
      maxNightShiftVariance: parsed.maxNightShiftVariance,
    });
    toast.success('KPI 設定を更新しました。');
    setIsSettingsOpen(false);
  };

  const alertMessages: Record<string, string> = {
    'coverage-low': 'カバレッジ率が目標値を下回っています。',
    'unassigned-exceeds': '未割当 Duty が許容値を超えています。',
    'fairness-imbalance': 'ドライバー間の公平性に偏りがあります。',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">運行指標ダッシュボード</h2>
        <p className="text-sm text-muted-foreground">
          Duty の割当状況を集計し、稼働バランスや未割当 Duty を早期に把握します。
        </p>
      </div>

      <Alert variant="default">
        <AlertTitle>最新データ</AlertTitle>
        <AlertDescription>
          GTFS 取込と Duty 編集の内容に基づいて指標を算出しています。再計算したい場合は「KPI 設定」からしきい値を調整してください。
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setIsSettingsOpen(true)}>
          KPI 設定を編集
        </Button>
        <Button variant="outline" size="sm" onClick={() => dutyActions.reset()}>
          Duty をリセット
        </Button>
      </div>

      {dashboard.alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>注意が必要な項目があります</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {dashboard.alerts.map((alert) => (
                <li key={alert.id}>{alertMessages[alert.id] ?? alert.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {hasData ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              title="総シフト数"
              value={dashboard.summary.totalShifts.toLocaleString()}
              description="割当済み Duty の件数"
            />
            <SummaryCard
              title="総稼働時間"
              value={`${dashboard.summary.totalHours.toLocaleString()} 時間`}
              description="Duty の稼働時間合計（Sign-on〜Sign-off 相当）"
            />
            <SummaryCard
              title="未割当 Duty"
              value={dashboard.summary.unassignedCount.toLocaleString()}
              description="担当ドライバーが未設定の Duty 数"
            />
            <SummaryCard
              title="公平性スコア"
              value={`${dashboard.summary.fairnessScore.toFixed(1)}`}
              description="シフト数の偏りを 0〜100 で評価（100 が最良）"
            />
            <SummaryCard
              title="カバレッジ率"
              value={`${dashboard.summary.coveragePercentage}%`}
              description="割り当て済み Duty の比率（100% が目標）"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>ドライバー別の稼働</CardTitle>
              <CardDescription>割り当て済み Duty と稼働時間の内訳を一覧できます。</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.workloads.length === 0 ? (
                <p className="text-sm text-muted-foreground">割り当て済みのドライバーはまだありません。</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>driver_id</TableHead>
                      <TableHead>Duty 件数</TableHead>
                      <TableHead>稼働時間 (h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.workloads.map((item) => (
                      <TableRow key={item.driverId}>
                        <TableCell className="font-medium">{item.driverId}</TableCell>
                        <TableCell>{item.shiftCount}</TableCell>
                        <TableCell>{item.hours.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>未割当 Duty</CardTitle>
              <CardDescription>ドライバーが割り当てられていない Duty のリストです。</CardDescription>
            </CardHeader>
            <CardContent>
              {unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">未割当の Duty はありません。</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {unassigned.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>データが不足しています</CardTitle>
            <CardDescription>GTFS を取り込んで Duty を少なくとも 1 件追加すると、ダッシュボードが集計されます。</CardDescription>
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
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-max-continuous">連続稼働の上限 (分)</label>
              <Input
                id="kpi-max-continuous"
                inputMode="numeric"
                value={form.maxContinuousMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, maxContinuousMinutes: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-min-break">最低休憩時間 (分)</label>
              <Input
                id="kpi-min-break"
                inputMode="numeric"
                value={form.minBreakMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, minBreakMinutes: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-max-daily">1 日あたりの上限 (分)</label>
              <Input
                id="kpi-max-daily"
                inputMode="numeric"
                value={form.maxDailyMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, maxDailyMinutes: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-max-unassigned">未割当率の上限 (%)</label>
              <Input
                id="kpi-max-unassigned"
                inputMode="numeric"
                value={form.maxUnassignedPercentage}
                onChange={(event) => setForm((prev) => ({ ...prev, maxUnassignedPercentage: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-fairness">公平性の許容偏差 (%)</label>
              <Input
                id="kpi-fairness"
                inputMode="numeric"
                value={form.maxNightShiftVariance}
                onChange={(event) => setForm((prev) => ({ ...prev, maxNightShiftVariance: event.target.value }))}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>キャンセル</Button>
            <Button onClick={handleSettingsSave}>保存する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
