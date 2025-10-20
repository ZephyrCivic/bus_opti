/**
 * src/features/import/ImportView.tsx
 * GTFS データの取込・保存・読み込みを行うメイン画面。
 * 取込状況、サマリー、警告、保存データの管理をワンストップで提供する。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { UploadCloud, RefreshCcw, FileWarning, ClipboardCopy } from 'lucide-react';

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
import type { GtfsImportSummaryItem } from '@/services/import/gtfsParser';
import {
  defaultFileName,
  downloadProjectJson,
  downloadSavedJson,
  fromSaved,
  fromSavedProject,
  toSaved,
  toSavedProject,
} from '@/services/import/gtfsPersistence';

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
  const [localError, setLocalError] = useState<string | null>(null);
  const { status, errorMessage, result, importFromFile, reset, loadFromSaved, manual, setManual } = useGtfsImport();
  const sampleFeeds = useMemo(
    () => [
      'data/GTFS-JP(gunmachuo).zip',
      'data/feed_fukutsucity_minibus_20251001_20250820163420.zip',
    ],
    [],
  );

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

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボード未許可環境では警告を出さず無視
    }
  }, []);

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

  const hasOptionalWarnings = Boolean(result?.missingFiles.length);
  const hasAlerts = Boolean(result?.alerts && result.alerts.length > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>サンプルフィード（ローカル）</CardTitle>
          <CardDescription>
            エクスプローラで次のZIPを見つけて、この画面へドラッグ＆ドロップしてください（相対パス）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sampleFeeds.map((name) => (
            <div key={name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <code className="truncate" title={name}>{name}</code>
              <Button variant="ghost" size="sm" type="button" onClick={() => copyToClipboard(name)}>
                <ClipboardCopy className="mr-1 h-4 w-4" />コピー
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>GTFS取込</CardTitle>
          <CardDescription>
            ZIP ファイルをドラッグ＆ドロップするか、「ファイルを選択」から `stops / trips / stop_times / shapes`
            を含む GTFS Feed を読み込んでください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-muted-foreground/40 bg-muted/20 text-center"
            onDrop={onDrop}
            onDragOver={onDragOver}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
            }}
          >
            <UploadCloud className="h-9 w-9 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium">ここに ZIP をドロップ</p>
              <p className="text-xs text-muted-foreground">最大 100MB 程度まで想定（ローカル処理）</p>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
              ファイルを選択
            </Button>
            <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
          </div>
        </CardContent>
        <CardFooter className="justify-between text-xs text-muted-foreground">
          <span>状態: {STATUS_COPY[status] ?? status}</span>
          {result?.sourceName && <Badge variant="secondary">{result.sourceName}</Badge>}
        </CardFooter>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>取込サマリー</CardTitle>
              <CardDescription>{new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(result.importedAt)}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => savedInputRef.current?.click()}>
                保存データを読み込む
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  const saved = toSaved(result);
                  downloadSavedJson(saved, defaultFileName(result.sourceName));
                }}
              >
                取込結果を保存
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => downloadProjectJson(toSavedProject(result, manual))}>
                プロジェクト保存
              </Button>
              <Button variant="ghost" size="icon" aria-label="再取込" onClick={reset}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={savedInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void handleSaved(e.target.files)} />

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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
