/**
 * src/components/export/ExportConfirmationProvider.tsx
 * 出力時の非モーダル確認ダイアログと履歴記録を担うコンテキスト。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { isStepOne } from '@/config/appStep';
import { Badge } from '@/components/ui/badge';
import { ensureWorkflowSession, completeWorkflowSave, type WorkflowSummary, type WorkflowSaveContext } from '@/services/workflow/workflowTelemetry';
import { recordExportConfirmationEvent } from '@/services/audit/auditLog';

export interface ExportSummaryMetric {
  label: string;
  value: string;
}

export interface ExportConfirmationSummary extends WorkflowSummary {
  coveragePercentage?: number;
  fairnessScore?: number;
  metrics?: ExportSummaryMetric[];
}

export interface ExportConfirmationRequest {
  title: string;
  description?: string;
  summary: ExportConfirmationSummary;
  context: WorkflowSaveContext & { entity: string };
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

interface ExportConfirmationContextValue {
  requestConfirmation: (request: ExportConfirmationRequest) => void;
}

const ExportConfirmationContext = createContext<ExportConfirmationContextValue | undefined>(undefined);

export function ExportConfirmationProvider({ children }: PropsWithChildren): JSX.Element {
  const [current, setCurrent] = useState<ExportConfirmationRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as typeof window & { __EXPORT_CONFIRM__?: string | null }).__EXPORT_CONFIRM__ = current?.title ?? null;
      // eslint-disable-next-line no-console
      console.debug('[export-confirmation] state:', current?.title ?? 'closed');
    }
  }, [current]);

  useEffect(() => {
    if (!current) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const handleClose = useCallback(() => {
    setCurrent(null);
    setIsProcessing(false);
  }, []);

  const handleCancel = useCallback(() => {
    if (!current) {
      return;
    }
    current.onCancel?.();
    recordExportConfirmationEvent({
      entity: current.context.entity,
      exportType: current.context.exportType,
      outcome: 'cancel',
      hardWarnings: current.summary.hardWarnings,
      softWarnings: current.summary.softWarnings,
      unassigned: current.summary.unassigned,
    });
    handleClose();
  }, [current, handleClose]);

  const handleConfirm = useCallback(async () => {
    if (!current || isProcessing) {
      return;
    }
    setIsProcessing(true);
    try {
      await current.onConfirm();
      completeWorkflowSave(current.summary, current.context);
      recordExportConfirmationEvent({
        entity: current.context.entity,
        exportType: current.context.exportType,
        outcome: 'proceed',
        hardWarnings: current.summary.hardWarnings,
        softWarnings: current.summary.softWarnings,
        unassigned: current.summary.unassigned,
      });
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '出力処理に失敗しました。';
      toast.error(message);
      setIsProcessing(false);
    }
  }, [current, handleClose, isProcessing]);

  const requestConfirmation = useCallback((request: ExportConfirmationRequest) => {
    ensureWorkflowSession(toWorkflowSummary(request.summary));
    setCurrent(request);
  }, []);

  const contextValue = useMemo<ExportConfirmationContextValue>(
    () => ({ requestConfirmation }),
    [requestConfirmation],
  );

  const dialog = current
    ? createPortal(
        <div className="pointer-events-none fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-background/10" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="false"
            aria-label={current.title}
            className="pointer-events-auto absolute left-1/2 top-6 w-[min(96vw,560px)] -translate-x-1/2 rounded-lg border border-border/70 bg-background p-6 shadow-xl"
            data-testid="export-confirmation-dialog"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{current.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {current.description ?? '警告状況を確認し、出力を続行するか決定してください。ダイアログ表示中も他の操作を継続できます。'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-muted"
                aria-label="閉じる"
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-4 pt-4">
              {isStepOne ? (
                <p className="text-sm text-muted-foreground">Step1 では警告やKPIの表示・計算は行いません。いつでも保存できます。</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryPill icon={AlertTriangle} label="重大" value={current.summary.hardWarnings} tone="destructive" />
                    <SummaryPill icon={AlertTriangle} label="注意" value={current.summary.softWarnings} tone="warning" />
                    <SummaryPill icon={CheckCircle2} label="未割当" value={current.summary.unassigned} tone="neutral" />
                  </div>
                  {current.summary.metrics && current.summary.metrics.length > 0 ? (
                    <div className="space-y-2 rounded-md border border-dashed border-border/60 bg-card/40 p-4">
                      <p className="text-xs font-semibold text-muted-foreground">主要指標</p>
                      <ul className="grid gap-2 text-sm sm:grid-cols-2">
                        {current.summary.metrics.map((metric) => (
                          <li key={metric.label} className="flex items-center justify-between rounded-md bg-background/80 px-3 py-2">
                            <span className="text-muted-foreground">{metric.label}</span>
                            <span className="font-medium">{metric.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button data-testid="export-confirm-cancel" variant="ghost" onClick={handleCancel} disabled={isProcessing}>
                キャンセル
              </Button>
              <Button data-testid="export-confirm-continue" onClick={handleConfirm} disabled={isProcessing}>
                {isProcessing ? '出力中…' : '続行して出力'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <ExportConfirmationContext.Provider value={contextValue}>
      {children}
      {dialog}
    </ExportConfirmationContext.Provider>
  );
}

export function useExportConfirmation(): ExportConfirmationContextValue {
  const value = useContext(ExportConfirmationContext);
  if (!value) {
    throw new Error('useExportConfirmation は ExportConfirmationProvider の内部で使用してください。');
  }
  return value;
}

function toWorkflowSummary(summary: ExportConfirmationSummary): WorkflowSummary {
  return {
    hardWarnings: summary.hardWarnings,
    softWarnings: summary.softWarnings,
    unassigned: summary.unassigned,
    coveragePercentage: summary.coveragePercentage,
    fairnessScore: summary.fairnessScore,
  };
}

function SummaryPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: 'destructive' | 'warning' | 'neutral';
}): JSX.Element {
  const variant = tone === 'destructive' ? 'destructive' : tone === 'warning' ? 'secondary' : 'outline';
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}
