/**
 * src/features/import/ImportView.tsx
 * GTFS データの取込・保存・読み込みを行うメイン画面。
 * 取込状況、サマリー、警告、保存データの管理をワンストップで提供する。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { UploadCloud, History, RefreshCcw, FileWarning } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { GtfsImportStatus } from '@/services/import/GtfsImportProvider';
import type { GtfsImportSummaryItem } from '@/services/import/gtfsParser';
import { fromSaved, fromSavedProject } from '@/services/import/gtfsPersistence';
import { useSectionNavigation } from '@/components/layout/SectionNavigationContext';
import { recordTelemetryEvent } from '@/services/telemetry/telemetry';
import { isStepOne } from '@/config/appStep';

const ACCEPTED_MIME = ['application/zip', 'application/x-zip-compressed'];
const ACCEPTED_SAVED = ['application/json'];

const STATUS_COPY: Record<string, string> = {
  idle: '待機中',
  parsing: '解析中',
  ready: '完了',
  error: '失敗',
};

export default function ImportView(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedInputRef = useRef<HTMLInputElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const previousStatusRef = useRef<GtfsImportStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const {
    status,
    errorMessage,
    result,
    importFromFile,
    reset,
    loadFromSaved,
    setManual,
    manual,
    selectedRouteIds,
  } = useGtfsImport();
  const { navigate } = useSectionNavigation();
  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      setLocalError(null);
      if (!fileList || fileList.length === 0) return;
      const file = Array.from(fileList).find(
        (candidate) => ACCEPTED_MIME.includes(candidate.type) || candidate.name.endsWith('.zip'),
      );
      if (!file) {
        setLocalError('GTFS の ZIP ファイルを選択してください。');
        return;
      }
      await importFromFile(file);
    },
    [importFromFile],
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      await handleFiles(event.dataTransfer?.files ?? null);
    },
    [handleFiles],
  );

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleSaved = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!ACCEPTED_SAVED.includes(file.type) && !file.name.endsWith('.json')) {
        setLocalError('保存ファイル（.json）を選択してください。');
        return;
      }
      try {
        const text = await file.text();
        const saved = JSON.parse(text);
        try {
          const project = fromSavedProject(saved);
          loadFromSaved(project.gtfs);
          setManual(() => project.manual);
        } catch {
          const hydrated = fromSaved(saved);
          loadFromSaved(hydrated);
        }
      } catch {
        setLocalError('保存ファイルの読み込みに失敗しました。内容をご確認ください。');
      }
    },
    [loadFromSaved, setManual],
  );

  const summaryColumns = useMemo<ColumnDef<GtfsImportSummaryItem>[]>(
    () => [
      {
        accessorKey: 'metric',
        header: '指標',
        cell: ({ row }) => <span className="font-medium">{row.getValue<string>('metric')}</span>,
      },
      {
        accessorKey: 'value',
        header: '値',
        cell: ({ row }) => <span className="tabular-nums">{row.getValue<number>('value')}</span>,
      },
      {
        accessorKey: 'description',
        header: '説明',
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue<string>('description')}</span>,
      },
    ],
    [],
  );

  const selectedRoutesKey = useMemo(() => selectedRouteIds.join('|'), [selectedRouteIds]);
  const telemetrySelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!result) {
      telemetrySelectionRef.current = null;
      return;
    }
    const key = `${result.sourceName}|${selectedRoutesKey}`;
    if (telemetrySelectionRef.current === key) {
      return;
    }
    telemetrySelectionRef.current = key;
    recordTelemetryEvent({
      type: 'import.route-filter.updated',
      payload: {
        sourceName: result.sourceName,
        routeCount: selectedRouteIds.length,
      },
    });
  }, [result, selectedRoutesKey, selectedRouteIds.length]);

  useEffect(() => {
    if (previousStatusRef.current === 'parsing' && status === 'ready') {
      const sentinel = bottomSentinelRef.current;
      if (sentinel) {
        const scrollToBottom = () => {
          sentinel.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
          });
        };
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(scrollToBottom);
        } else {
          scrollToBottom();
        }
      }
    }
    previousStatusRef.current = status;
  }, [status]);

  const totalRouteCount = useMemo(() => {
    if (!result) {
      return 0;
    }
    const trips = result.tables['trips.txt']?.rows ?? [];
    const ids = new Set<string>();
    for (const trip of trips) {
      const routeId = typeof trip.route_id === 'string' ? trip.route_id.trim() : '';
      if (routeId) {
        ids.add(routeId);
      }
    }
    return ids.size;
  }, [result]);

  const hasOptionalWarnings = !isStepOne && Boolean(result?.missingFiles.length);
  const hasAlerts = !isStepOne && Boolean(result?.alerts && result.alerts.length > 0);
  const hasRouteSelection = selectedRouteIds.length > 0;
  const footerMessage = isStepOne
    ? '保存・出力は各画面の CSV ボタンからいつでも実行できます。'
    : '保存・出力は左ナビの「差分・出力」から行えます。';

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          if (e.target.value) {
            e.target.value = '';
          }
        }}
      />
      <input
        ref={savedInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void handleSaved(e.target.files);
          if (e.target.value) {
            e.target.value = '';
          }
        }}
      />
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>読み込みメニュー</CardTitle>
          <CardDescription>新規開始（GTFS）または保存データから再開する導線を選択してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative flex flex-col gap-6 md:flex-row md:flex-wrap md:items-stretch md:gap-16">
            <div className="order-1 flex h-full flex-col gap-3 md:order-none md:flex-1">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <h3 className="text-sm font-semibold">GTFSを読み込む</h3>
                </div>
                <p className="text-xs text-muted-foreground">ZIP (stops/trips/stop_times/… ) から新規プロジェクトを開始します。</p>
              </div>
              <div
                className="flex min-h-[160px] flex-1 flex-col items-start justify-between gap-4 rounded-lg border border-muted-foreground/40 bg-muted/15 p-5 text-left"
                onDrop={onDrop}
                onDragOver={onDragOver}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
                }}
                aria-label="GTFS ZIP を読み込む"
              >
                <UploadCloud className="h-9 w-9 text-muted-foreground" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-medium">ここに ZIP をドロップ</p>
                  <p className="text-xs text-muted-foreground">最大 100MB 程度まで想定（ローカル処理）</p>
                </div>
                <Button variant="outline" size="sm" type="button" className="self-start" onClick={() => fileInputRef.current?.click()}>
                  ファイルを選択
                </Button>
              </div>
            </div>

            <div className="order-2 flex flex-shrink-0 items-center justify-center md:order-none md:px-6">
              <span className="rounded-full bg-amber-200 px-4 py-1.5 text-xs font-semibold text-amber-900 shadow-sm whitespace-nowrap">
                または
              </span>
            </div>

            <div className="order-3 flex h-full flex-col gap-3 md:order-none md:flex-1">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <h3 className="text-sm font-semibold">保存データから再開</h3>
                </div>
                <p className="text-xs text-muted-foreground">以前の作業（プロジェクトJSON / 取込結果JSON）を開きます。</p>
              </div>
              <div className="flex min-h-[160px] flex-1 flex-col items-start justify-between gap-4 rounded-lg border border-muted-foreground/40 bg-muted/15 p-5 text-left text-sm">
                <History className="h-9 w-9 text-muted-foreground" aria-hidden />
                <div className="space-y-1 text-muted-foreground">
                  <p>取込結果のみ（取込結果JSON）と手動編集を含むプロジェクトJSONの両方に対応しています。</p>
                </div>
                <Button variant="outline" size="sm" type="button" className="self-start" onClick={() => savedInputRef.current?.click()}>
                  保存ファイルを選択
                </Button>
              </div>
            </div>

            <p className="order-4 text-left text-xs text-muted-foreground md:order-none md:basis-full">
              状態: {STATUS_COPY[status] ?? status}
            </p>
          </div>
        </CardContent>
        {result?.sourceName ? (
          <CardFooter className="justify-start">
            <Badge variant="secondary">最新の読み込み: {result.sourceName}</Badge>
          </CardFooter>
        ) : null}
      </Card>

      {localError && (
        <Alert variant="destructive">
          <AlertTitle>ファイル選択エラー</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      {status === 'error' && errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>取込に失敗しました</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {status === 'parsing' && (
        <Alert>
          <AlertTitle>解析中です</AlertTitle>
          <AlertDescription>ZIP の内容を展開・解析しています。大きなファイルでは数分かかる場合があります。</AlertDescription>
        </Alert>
      )}

      {status === 'ready' && result && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>取込サマリー</CardTitle>
              <CardDescription>
                {new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(result.importedAt)} ／ ファイル名: {result.sourceName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="再取込" onClick={reset}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <DataTable columns={summaryColumns} data={result.summary} emptyMessage="サマリーを計算できませんでした。" />

            {hasAlerts && (
              <Alert variant="destructive">
                <FileWarning className="h-4 w-4" aria-hidden />
                <AlertTitle>重要な注意事項</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {result.alerts!.map((msg, index) => (
                      <li key={index}>{msg}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Table>
              <TableBody>
                {Object.entries(result.tables).map(([name, table]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{table.rows.length.toLocaleString()} 件</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasOptionalWarnings && (
              <Alert>
                <FileWarning className="h-4 w-4" aria-hidden />
                <AlertTitle>任意ファイルが欠落しています</AlertTitle>
                <AlertDescription>
                  {result.missingFiles.join(', ')} が ZIP に含まれていません。MVP では任意扱いですが、業務で利用する場合はご注意ください。
                </AlertDescription>
              </Alert>
            )}

            <section
              aria-label="行路編集対象の便の選択ガイド"
              className="space-y-2 rounded-md border border-dashed border-border/60 bg-background/60 p-4"
            >
              <h3 className="text-sm font-semibold">行路編集対象の便（系統）の選択</h3>
              <p className="text-xs text-muted-foreground">
                選択中: {selectedRouteIds.length.toLocaleString()} / {totalRouteCount.toLocaleString()} 便（系統）。
                地図画面の「行路編集対象の便を選択」でチェックを更新すると、ハイライトとタイムラインの対象が切り替わります。
              </p>
              <p className="text-xs text-muted-foreground">
                選択内容は保存データにも含まれます。取り込み直後は全便が選択されるため、必要に応じて 「行路編集対象の便を選択」で絞り込んでください。
              </p>
            </section>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{footerMessage}</p>
            <Button
              type="button"
              onClick={() => {
                if (!hasRouteSelection) {
                  return;
                }
                recordTelemetryEvent({
                  type: 'import.open-explorer',
                  payload: {
                    sourceName: result.sourceName,
                    routeCount: selectedRouteIds.length,
                  },
                });
                navigate('explorer');
              }}
              disabled={!hasRouteSelection}
              aria-disabled={!hasRouteSelection}
            >
              「行路編集対象の便を選択」を開く
            </Button>
          </CardFooter>
        </Card>
      )}

      <div ref={bottomSentinelRef} aria-hidden className="h-px w-px" />
    </div>
  );
}


