/**
 * src/components/export/ExportConfirmationProvider.tsx
 * 出力時の非モーダル確認ダイアログと履歴記録を担うコンテキスト。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { isStepOne } from '@/config/appStep';
import { useStepOneExportCounts } from './useStepOneExportCounts';
import { Badge } from '@/components/ui/badge';

export interface ExportSummaryMetric {
  label: string;
  value: string;
}

export interface ExportConfirmationSummary {
  hardWarnings: number;
  softWarnings: number;
  unassigned: number;
  coveragePercentage?: number;
  fairnessScore?: number;
  metrics?: ExportSummaryMetric[];
}

export interface ExportConfirmationContextInfo {
  entity: string;
  exportType: string;
  fileName?: string;
}

export interface ExportConfirmationRequest {
  title: string;
  description?: string;
  summary: ExportConfirmationSummary;
  context: ExportConfirmationContextInfo;
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
  const stepOneCounts = useStepOneExportCounts();

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
    handleClose();
  }, [current, handleClose]);

  const handleConfirm = useCallback(async () => {
    if (!current || isProcessing) {
      return;
    }
    setIsProcessing(true);
    try {
      await current.onConfirm();
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '出力処理に失敗しました。';
      toast.error(message);
      setIsProcessing(false);
    }
  }, [current, handleClose, isProcessing]);

  const requestConfirmation = useCallback((request: ExportConfirmationRequest) => {
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Step1 では警告や KPI の計算は行わず、いつでも出力できます。以下の未割当件数は参考情報として表示されます（出力はブロックされません）。
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StepOneCountCard
                    label="車両未割当の行路"
                    count={stepOneCounts.unassignedVehicleBlocks}
                    total={stepOneCounts.totalBlocks}
                    unit="行路"
                  />
                  <StepOneCountCard
                    label="運転士未割当の交番"
                    count={stepOneCounts.unassignedDrivers}
                    total={stepOneCounts.totalDuties}
                    unit="交番"
                  />
                  <StepOneCountCard
                    label="未配置の便"
                    count={stepOneCounts.unassignedTrips}
                    total={stepOneCounts.totalTrips}
                    unit="便"
                  />
                </div>
                {!isStepOne ? (
                  <p className="text-xs text-muted-foreground">
                    将来の Step2/Step3 では警告や KPI をここに復帰させる予定です。
                  </p>
                ) : null}
              </div>
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

function StepOneCountCard({
  label,
  count,
  total,
  unit,
}: {
  label: string;
  count: number;
  total: number;
  unit: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/60 px-4 py-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold">{count.toLocaleString('ja-JP')}</span>
        <span className="text-xs text-muted-foreground">全 {total.toLocaleString('ja-JP')} {unit}</span>
      </div>
    </div>
  );
}
