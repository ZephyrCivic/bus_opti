/**
 * src/features/import/ImportView.tsx
 * Provides the GTFS import workflow: drag&drop/file選択UI、解析ステータス表示、サマリー、手動保存/読込、再インポート動線。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { UploadCloud, RefreshCcw, FileWarning } from 'lucide-react';

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
import { fromSaved, toSaved, downloadSavedJson, defaultFileName } from '@/services/import/gtfsPersistence';

const ACCEPTED_MIME = ['application/zip', 'application/x-zip-compressed'];
const ACCEPTED_SAVED = ['application/json'];

export default function ImportView(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedInputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { status, errorMessage, result, importFromFile, reset, loadFromSaved } = useGtfsImport();

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      setLocalError(null);
      if (!fileList || fileList.length === 0) return;
      const file = Array.from(fileList).find((candidate) => ACCEPTED_MIME.includes(candidate.type) || candidate.name.endsWith('.zip'));
      if (!file) {
        setLocalError('ZIP 形式の GTFS ファイルを選択してください。');
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
        setLocalError('保存データ（.json）を選択してください。');
        return;
      }
      try {
        const text = await file.text();
        const saved = JSON.parse(text);
        const hydrated = fromSaved(saved);
        loadFromSaved(hydrated);
      } catch {
        setLocalError('保存データの読込に失敗しました。内容をご確認ください。');
      }
    },
    [loadFromSaved],
  );

  const summaryColumns = useMemo<ColumnDef<GtfsImportSummaryItem>[]>(
    () => [
      {
        accessorKey: 'metric',
        header: 'メトリクス',
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

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>GTFS インポート</CardTitle>
          <CardDescription>
            ZIP ファイルをドラッグ＆ドロップするか、ファイル選択ボタンから `stops/trips/stop_times/shapes` を含む GTFS Feed を読み込んでください。
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
          <span>status: {status}</span>
          {result?.sourceName && <Badge variant="secondary">{result.sourceName}</Badge>}
        </CardFooter>
      </Card>

      {localError && (
        <Alert variant="destructive">
          <AlertTitle>ファイル形式エラー</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      {status === 'error' && errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>インポート失敗</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {status === 'parsing' && (
        <Alert>
          <AlertTitle>解析中</AlertTitle>
          <AlertDescription>ZIP の内容を展開しています。大きいファイルの場合は数秒かかる場合があります。</AlertDescription>
        </Alert>
      )}

      {status === 'ready' && result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>インポートサマリー</CardTitle>
              <CardDescription>{new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(result.importedAt)}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => savedInputRef.current?.click()}>
                保存データを読込
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
                保存（JSON）
              </Button>
              <Button variant="ghost" size="icon" aria-label="再インポート" onClick={reset}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={savedInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void handleSaved(e.target.files)} />

            <DataTable columns={summaryColumns} data={result.summary} emptyMessage="サマリーが計算できませんでした。" />

            <Table>
              <TableBody>
                {Object.entries(result.tables).map(([name, table]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{table.rows.length.toLocaleString()} rows</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasOptionalWarnings && (
              <Alert>
                <FileWarning className="h-4 w-4" aria-hidden />
                <AlertTitle>任意ファイルが見つかりません</AlertTitle>
                <AlertDescription>
                  {result.missingFiles.join(', ')} は ZIP 内に存在しません。MVP では任意扱いですが、地図表示や行路推定で細かな補正ができない場合があります。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
