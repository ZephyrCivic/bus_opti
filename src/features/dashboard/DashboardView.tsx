/**
 * src/features/dashboard/DashboardView.tsx
 * Presents high-level KPI cards, workload tables, alerts, and KPI settings editing.
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

    if ([parsed.maxContinuousMinutes, parsed.minBreakMinutes, parsed.maxDailyMinutes].some((value) => Number.isNaN(value) || value < 0 || value > 1440)) {
      setFormError('分単位の項目は 0〜1440 の範囲で入力してください。');
      return;
    }
    if ([parsed.maxUnassignedPercentage, parsed.maxNightShiftVariance].some((value) => Number.isNaN(value) || value < 0 || value > 100)) {
      setFormError('率の項目は 0〜100 の範囲で入力してください。');
      return;
    }

    dutyActions.updateSettings(parsed);
    setIsSettingsOpen(false);
    toast.success('KPI設定を更新しました。');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Dutyの割当状況を集計し、労務負荷や未割当の有無を素早く把握します。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
          KPI設定
        </Button>
      </div>

      {hasData ? (
        <>
          {dashboard.alerts.length > 0 && (
            <div className="space-y-2">
              {dashboard.alerts.map((alert) => (
                <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                  <AlertTitle>
                    {alert.id === 'coverage-low' && 'カバレッジ警告'}
                    {alert.id === 'unassigned-exceeds' && '未割当の超過'}
                    {alert.id === 'fairness-imbalance' && '公平性の偏り'}
                  </AlertTitle>
                  <AlertDescription>{alert.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              title="総シフト数"
              value={dashboard.summary.totalShifts.toLocaleString()}
              description="割当済み Duty の件数"
            />
            <SummaryCard
              title="総時間"
              value={`${dashboard.summary.totalHours.toLocaleString()} 時間`}
              description="Dutyの稼働時間合計（Sign-on〜Sign-off相当）"
            />
            <SummaryCard
              title="未割当"
              value={dashboard.summary.unassignedCount.toLocaleString()}
              description="担当ドライバーが未設定の Duty 数"
            />
            <SummaryCard
              title="公平性スコア"
              value={`${dashboard.summary.fairnessScore}%`}
              description="シフト数の偏りを 0〜100 で評価（100が最良）"
            />
            <SummaryCard
              title="カバレッジ"
              value={`${dashboard.summary.coveragePercentage}%`}
              description="割当済み Duty の比率（100% が目標）"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>ドライバー別の稼働状況</CardTitle>
              <CardDescription>割当済み Duty 数と累計時間を表示します。</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.workloads.length === 0 ? (
                <p className="text-sm text-muted-foreground">割当済みのドライバーがまだ存在しません。</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>driver_id</TableHead>
                      <TableHead>Duty数</TableHead>
                      <TableHead>累計時間 (h)</TableHead>
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
              <CardDescription>ドライバーが設定されていない Duty の一覧です。</CardDescription>
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
            <CardTitle>データがありません</CardTitle>
            <CardDescription>GTFSをインポートし、Duties で少なくとも1件のDutyを作成するとダッシュボードが更新されます。</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>KPI設定</DialogTitle>
            <DialogDescription>閾値を編集し、ダッシュボードと警告へ即時反映させます。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-max-continuous">連続運転上限（分）</label>
              <Input
                id="kpi-max-continuous"
                inputMode="numeric"
                value={form.maxContinuousMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, maxContinuousMinutes: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-min-break">休憩下限（分）</label>
              <Input
                id="kpi-min-break"
                inputMode="numeric"
                value={form.minBreakMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, minBreakMinutes: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-max-daily">日拘束上限（分）</label>
              <Input
                id="kpi-max-daily"
                inputMode="numeric"
                value={form.maxDailyMinutes}
                onChange={(event) => setForm((prev) => ({ ...prev, maxDailyMinutes: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-max-unassigned">未割当許容率（%）</label>
              <Input
                id="kpi-max-unassigned"
                inputMode="numeric"
                value={form.maxUnassignedPercentage}
                onChange={(event) => setForm((prev) => ({ ...prev, maxUnassignedPercentage: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="kpi-fairness">公平性偏差許容（%）</label>
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
            <Button onClick={handleSettingsSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
