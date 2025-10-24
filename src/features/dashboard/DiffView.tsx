/**
 * src/features/dashboard/DiffView.tsx
 * 現在の乗務状態と保存済み基準値（Baseline）を比較し、差分を可視化する画面。
 * 基準値の保存・読込・履歴管理を一体的に提供する。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { buildBlocksPlan, DEFAULT_MAX_TURN_GAP_MINUTES } from '@/services/blocks/blockBuilder';
import { buildTripLookup, enrichDutySegments } from '@/services/duty/dutyMetrics';
import { computeDutyDashboard } from '@/services/dashboard/dutyDashboard';
import DiffTable from './DiffTable';
import { buildDutyScheduleState, downloadBaseline } from '@/services/dashboard/dutyBaseline';
import type { ScheduleState } from '@/types';
import diffSchedules from '@/services/state/scheduleDiff';
import {
  addBaselineHistory,
  clearBaselineHistory,
  loadBaselineHistory,
  type BaselineHistoryEntry,
} from '@/services/dashboard/baselineHistory';
import { aggregateDutyWarnings } from '@/services/duty/aggregateDutyWarnings';
import { useDiffSaveActions } from './useDiffSaveActions';

function loadBaselineFromFile(file: File): Promise<ScheduleState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ScheduleState;
        resolve(parsed);
      } catch {
        reject(new Error('JSON 形式として読み込めませんでした。内容をご確認ください。'));
      }
    };
    reader.readAsText(file);
  });
}

export default function DiffView(): JSX.Element {
  const { result, dutyState, manual } = useGtfsImport();
  const [baseline, setBaseline] = useState<ScheduleState | null>(null);
  const [history, setHistory] = useState<BaselineHistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const plan = useMemo(
    () => buildBlocksPlan(result, { maxTurnGapMinutes: DEFAULT_MAX_TURN_GAP_MINUTES, linkingEnabled: false }),
    [result],
  );
  const tripLookup = useMemo(() => buildTripLookup(plan.csvRows), [plan.csvRows]);

  const warningTotals = useMemo(
    () => aggregateDutyWarnings(dutyState.duties, tripLookup, dutyState.settings),
    [dutyState.duties, dutyState.settings, tripLookup],
  );

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

  const dashboard = useMemo(() => computeDutyDashboard(dutySummaries), [dutySummaries]);

  const workflowSummary = useMemo(
    () => ({
      hardWarnings: warningTotals.hard,
      softWarnings: warningTotals.soft,
      unassigned: warningTotals.unassigned,
      coveragePercentage: dashboard.summary.coveragePercentage,
      fairnessScore: dashboard.summary.fairnessScore,
      metrics: [
        { label: 'カバレッジ', value: `${dashboard.summary.coveragePercentage}%` },
        { label: '未割当 Duty', value: `${dashboard.summary.unassignedCount} 件` },
        { label: '公平性スコア', value: `${dashboard.summary.fairnessScore}` },
      ],
    }),
    [
      warningTotals.hard,
      warningTotals.soft,
      warningTotals.unassigned,
      dashboard.summary.coveragePercentage,
      dashboard.summary.unassignedCount,
      dashboard.summary.fairnessScore,
    ],
  );

  const currentState = useMemo(
    () => buildDutyScheduleState(dutyState.duties, dashboard),
    [dutyState.duties, dashboard],
  );

  const diff = useMemo(() => {
    if (!baseline) return null;
    return diffSchedules(currentState, baseline);
  }, [baseline, currentState]);

  const { handleSaveImportResult, handleSaveProject } = useDiffSaveActions({
    summary: workflowSummary,
    result,
    manual,
  });

  const hasImportResult = Boolean(result);

  useEffect(() => {
    setHistory(loadBaselineHistory());
  }, []);

  const refreshHistory = (entries: BaselineHistoryEntry[]) => {
    setHistory(entries);
  };

  const handleSaveBaseline = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '');
      const fileName = `duty-baseline-${timestamp}.json`;
      downloadBaseline(currentState, fileName);
      refreshHistory(addBaselineHistory(currentState, { fileName, savedAt: new Date().toISOString() }));
      toast.success('現在の乗務を基準として保存しました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '基準データの保存に失敗しました。');
    }
  };

  const handleLoadBaseline = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await loadBaselineFromFile(file);
      setBaseline(parsed);
      refreshHistory(addBaselineHistory(parsed, { fileName: file.name, savedAt: new Date().toISOString() }));
      toast.success('基準データを読み込みました。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '基準データの読み込みに失敗しました。');
    } finally {
      event.target.value = '';
    }
  };

  const handleResetBaseline = () => {
    setBaseline(null);
    toast.success('基準データの選択を解除しました。');
  };

  const handleClearHistory = () => {
    clearBaselineHistory();
    refreshHistory([]);
    toast.success('基準履歴を削除しました。');
  };

  const handleApplyHistory = (entry: BaselineHistoryEntry) => {
    setBaseline(entry.state);
    toast.success('選択した基準データを適用しました。');
  };

  const handleDownloadHistoryEntry = (entry: BaselineHistoryEntry) => {
    const fileName = `${entry.fileName.replace(/\.json$/i, '')}-history.json`;
    downloadBaseline(entry.state, fileName);
    toast.success('履歴データをダウンロードしました。');
  };

  if (isStepOne) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>差分ビュー（Step1では無効）</CardTitle>
            <CardDescription>
              Step1 は推奨/警告/KPIなどの計算を行わないため、このビューは無効化しています。保存と履歴は Import/Explorer/Duties から実施してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Step2 以降で有効になります。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">差分・出力</h2>
        <p className="text-sm text-muted-foreground">
          現在の乗務を基準データと比較し、変更点を確認します。基準を保存しておくと、別案との比較やレポート出力が容易になります。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>データ保存・エクスポート</CardTitle>
          <CardDescription>取込結果や手動入力を JSON として保存し、後から作業を再開できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            「取込結果を保存」は GTFS の解析結果のみを保存します。「プロジェクト保存」は手動入力（車庫・交代地点・運転士など）を含めた再開用データです。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveImportResult} disabled={!hasImportResult}>
              取込結果を保存
            </Button>
            <Button variant="outline" onClick={handleSaveProject} disabled={!hasImportResult}>
              プロジェクト保存
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {hasImportResult ? '保存した JSON は次回「Import」タブの「保存データから再開」で読み込めます。' : 'GTFSフィードを取り込むと保存操作が有効になります。'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基準データの管理</CardTitle>
          <CardDescription>乗務のスケジュールを JSON 基準データとして保存・読み込みできます。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={handleSaveBaseline}>現在の乗務を基準として保存</Button>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleLoadBaseline}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              基準データを読み込む
            </Button>
            <Button variant="outline" onClick={handleResetBaseline} disabled={!baseline}>
              基準をクリア
            </Button>
          </div>
          {baseline ? (
            <p className="text-xs text-muted-foreground">
              適用中の基準: シフト {baseline.dashboard.summary.totalShifts} 件 / 未割当 {baseline.dashboard.summary.unassignedCount} 件
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">基準が未設定の場合、差分テーブルは読み取り専用で表示されます。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基準履歴</CardTitle>
          <CardDescription>保存・読み込みの履歴を管理します。最新 10 件まで保持されます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshHistory(loadBaselineHistory())}>
              最新の履歴を読み込み
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearHistory} disabled={history.length === 0}>
              履歴をクリア
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴はまだありません。基準を保存するとここに表示されます。</p>
          ) : (
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-md border bg-card/50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">保存日時: {new Date(entry.savedAt).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">ファイル名: {entry.fileName}</p>
                      <div className="grid gap-1 text-xs sm:grid-cols-2">
                        <span>シフト数: {entry.summary.totalShifts}</span>
                        <span>未割当: {entry.summary.unassignedCount}</span>
                        <span>公平性スコア: {entry.summary.fairnessScore}</span>
                        <span>カバレッジ: {entry.summary.coveragePercentage}%</span>
                      </div>
                      {entry.alerts.length > 0 && (
                        <ul className="space-y-1 text-xs">
                          {entry.alerts.map((alert, index) => (
                            <li key={`${entry.id}-alert-${index}`}>
                              <span className={alert.severity === 'critical' ? 'text-destructive font-semibold' : 'text-amber-500'}>
                                [{alert.severity === 'critical' ? '重要' : '注意'}]
                              </span>{' '}
                              {alert.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Button size="sm" onClick={() => handleApplyHistory(entry)}>
                        この基準を適用
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleDownloadHistoryEntry(entry)}>
                        JSON をダウンロード
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DiffTable diff={diff} />
    </div>
  );
}

