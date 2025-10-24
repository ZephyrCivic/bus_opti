/**
 * src/features/dashboard/DiffSidebarActions.tsx
 * 左ナビに表示する保存／エクスポート／履歴セクション。
 */
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { buildBlocksPlan, DEFAULT_MAX_TURN_GAP_MINUTES } from '@/services/blocks/blockBuilder';
import { buildTripLookup, enrichDutySegments } from '@/services/duty/dutyMetrics';
import { aggregateDutyWarnings } from '@/services/duty/aggregateDutyWarnings';
import { computeDutyDashboard } from '@/services/dashboard/dutyDashboard';
import { loadBaselineHistory } from '@/services/dashboard/baselineHistory';
import { loadSaveHistory } from '@/services/dashboard/saveHistory';
import { useDiffSaveActions } from './useDiffSaveActions';
import { getAuditEvents, type AuditEvent } from '@/services/audit/auditLog';

interface DiffSidebarActionsProps {
  variant?: 'desktop' | 'mobile';
}

export function DiffSidebarActions({ variant = 'desktop' }: DiffSidebarActionsProps): JSX.Element {
  const { result, manual, dutyState } = useGtfsImport();

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
    }),
    [
      warningTotals.hard,
      warningTotals.soft,
      warningTotals.unassigned,
      dashboard.summary.coveragePercentage,
      dashboard.summary.fairnessScore,
    ],
  );

  const [manualSaveHistory, setManualSaveHistory] = useState(() => loadSaveHistory());
  const [baselineHistory, setBaselineHistory] = useState(() => loadBaselineHistory());
  const [auditPreview, setAuditPreview] = useState<AuditEvent[]>(() =>
    getAuditEvents().slice(-3).reverse(),
  );

  const refreshHistories = useCallback(() => {
    setManualSaveHistory(loadSaveHistory());
    setBaselineHistory(loadBaselineHistory());
    setAuditPreview(getAuditEvents().slice(-3).reverse());
  }, []);

  const { handleSaveImportResult, handleSaveProject } = useDiffSaveActions({
    summary: workflowSummary,
    result,
    manual,
    onAfterSave: refreshHistories,
  });

  const hasImportResult = Boolean(result);

  const containerClass =
    variant === 'desktop'
      ? 'flex flex-col gap-4 text-sm'
      : 'mt-4 flex flex-col gap-4 rounded-md border border-border/60 bg-card/40 p-3 text-sm';

  const scrollToExport = () => {
    document.getElementById('diff-export-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToHistory = () => {
    document.getElementById('diff-history-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={containerClass} id={variant === 'desktop' ? 'diff-sidebar-actions' : undefined}>
      <section className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">保存</p>
        <Button size="sm" onClick={handleSaveImportResult} disabled={!hasImportResult}>
          取込結果を保存
        </Button>
        <Button size="sm" variant="outline" onClick={handleSaveProject} disabled={!hasImportResult}>
          プロジェクト保存
        </Button>
        {!hasImportResult ? (
          <p className="text-[11px] text-muted-foreground">GTFSを取り込むと保存操作が有効になります。</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">エクスポート</p>
        <Button size="sm" variant="ghost" onClick={scrollToExport}>
          差分・基準データへ移動
        </Button>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">最近の保存履歴</p>
          <Button size="sm" variant="ghost" onClick={refreshHistories}>
            最新を取得
          </Button>
        </div>
        {manualSaveHistory.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">まだ保存履歴はありません。</p>
        ) : (
          <ul className="space-y-1.5 text-[11px] leading-relaxed">
            {manualSaveHistory.slice(0, 5).map((entry) => (
              <li key={entry.id} className="rounded-md border border-border/60 bg-background/80 p-2">
                <p className="font-semibold">{entry.type === 'project' ? 'プロジェクト保存' : '取込結果保存'}</p>
                <p>{entry.fileName}</p>
                <p className="text-muted-foreground">{new Date(entry.savedAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="ghost" onClick={scrollToHistory}>
          詳細履歴を見る
        </Button>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">基準データ履歴</p>
        {baselineHistory.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">基準データがまだ保存されていません。</p>
        ) : (
          <ul className="space-y-1.5 text-[11px] leading-relaxed">
            {baselineHistory.slice(0, 3).map((entry) => (
              <li key={entry.id} className="rounded-md border border-dashed border-border/60 bg-background/50 p-2">
                <p className="font-semibold">{entry.fileName}</p>
                <p className="text-muted-foreground">{new Date(entry.savedAt).toLocaleString()}</p>
                <p>
                  未割当 {entry.summary.unassignedCount} 件 / カバレッジ {entry.summary.coveragePercentage}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">監査ログ（最新3件）</p>
        {auditPreview.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">まだ監査イベントは記録されていません。</p>
        ) : (
          <ul className="space-y-1.5 text-[11px] leading-relaxed">
            {auditPreview.map((event) => (
              <li key={`${event.timestamp}-${event.action}`} className="rounded-md border border-border/60 bg-background/70 p-2">
                <p className="font-semibold text-foreground">
                  {event.action === 'export' ? 'エクスポート' : '確認ダイアログ'}
                </p>
                {'fileName' in event && event.fileName ? <p>{event.fileName}</p> : null}
                <p className="text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                {'warnings' in event && event.warnings ? (
                  <p className="text-muted-foreground">
                    警告: Hard {event.warnings.hard} / Soft {event.warnings.soft}
                  </p>
                ) : null}
                {'outcome' in event ? (
                  <p className="text-muted-foreground">結果: {event.outcome === 'proceed' ? '続行' : 'キャンセル'}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
