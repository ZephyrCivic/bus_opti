/**
 * src/features/import/ImportView.tsx
 * GTFS データの取込・保存・読み込みを行うメイン画面。
 * 取込状況、サマリー、警告、保存データの管理をワンストップで提供する。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { GtfsImportSummaryItem } from '@/services/import/gtfsParser';
import { fromSaved, fromSavedProject } from '@/services/import/gtfsPersistence';
import { useSectionNavigation } from '@/components/layout/SectionNavigationContext';

const ACCEPTED_MIME = ['application/zip', 'application/x-zip-compressed'];
const ACCEPTED_SAVED = ['application/json'];

const STATUS_COPY: Record<string, string> = {
  idle: '待機中',
  parsing: '解析中',
  ready: '完了',
  error: '失敗',
};

interface RouteOption {
  id: string;
  label: string;
  description?: string;
}

export default function ImportView(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedInputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [routeFilterQuery, setRouteFilterQuery] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const { status, errorMessage, result, importFromFile, reset, loadFromSaved, setManual } = useGtfsImport();
  const { navigate } = useSectionNavigation();
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

  const routeOptions = useMemo<RouteOption[]>(() => {
    if (!result) {
      return [];
    }
    const trips = result.tables['trips.txt']?.rows ?? [];
    const routes = result.tables['routes.txt']?.rows ?? [];
    const routeNameMap = new Map<string, string>();
    for (const entry of routes) {
      const routeId = entry.route_id?.trim();
      if (!routeId) continue;
      const shortName = entry.route_short_name?.trim();
      const longName = entry.route_long_name?.trim();
      const display = shortName || longName;
      if (display) {
        routeNameMap.set(routeId, display);
      }
    }
    const uniqueIds = new Set<string>();
    for (const trip of trips) {
      const routeId = trip.route_id?.trim();
      if (routeId) {
        uniqueIds.add(routeId);
      }
    }
    return Array.from(uniqueIds)
      .sort((a, b) => a.localeCompare(b))
      .map((routeId) => ({
        id: routeId,
        label: routeNameMap.get(routeId) ?? routeId,
        description: routeNameMap.has(routeId) ? routeId : undefined,
      }));
  }, [result]);

  const routesKey = useMemo(() => routeOptions.map((option) => option.id).join('|'), [routeOptions]);

  useEffect(() => {
    if (routeOptions.length === 0) {
      setSelectedRoutes(new Set());
      return;
    }
    setSelectedRoutes(new Set(routeOptions.map((option) => option.id)));
    setRouteFilterQuery('');
  }, [routesKey]);

  const filteredRoutes = useMemo(() => {
    const query = routeFilterQuery.trim().toLowerCase();
    if (!query) {
      return routeOptions;
    }
    return routeOptions.filter((option) => {
      const label = option.label.toLowerCase();
      const description = option.description?.toLowerCase() ?? '';
      return label.includes(query) || option.id.toLowerCase().includes(query) || description.includes(query);
    });
  }, [routeFilterQuery, routeOptions]);

  const hasOptionalWarnings = Boolean(result?.missingFiles.length);
  const hasAlerts = Boolean(result?.alerts && result.alerts.length > 0);
  const hasRouteSelection = selectedRoutes.size > 0;

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
          <CardTitle>読み込みメニュー</CardTitle>
          <CardDescription>新規開始（GTFS）または保存データから再開する導線を選択してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">GTFSを読み込む</h3>
                <p className="text-xs text-muted-foreground">ZIP (stops/trips/stop_times/… ) から新規プロジェクトを開始します。</p>
              </div>
              <div
                className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-muted-foreground/40 bg-muted/20 text-center"
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
                <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
                  ファイルを選択
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">状態: {STATUS_COPY[status] ?? status}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">保存データから再開</h3>
                <p className="text-xs text-muted-foreground">以前の作業（プロジェクトJSON / 取込結果JSON）を開きます。</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
                <p className="text-muted-foreground">
                  取込結果のみ（取込結果JSON）と手動編集を含むプロジェクトJSONの両方に対応しています。
                </p>
                <Button className="mt-4" type="button" onClick={() => savedInputRef.current?.click()}>
                  保存ファイルを選択
                </Button>
              </div>
              <div className="rounded-lg border border-border/40 bg-background p-3 text-xs text-muted-foreground">
                Drag & Drop にも対応しています。ファイル選択後に解析が始まり、完了すると下部のサマリーへ遷移します。
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>保存・出力は左ナビの「差分・出力」から実行できます。</span>
          {result?.sourceName ? <Badge variant="secondary">最新の読み込み: {result.sourceName}</Badge> : null}
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
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>取込サマリー</CardTitle>
              <CardDescription>
                {new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(result.importedAt)} ／ Source: {result.sourceName}
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

            <section aria-label="路線の絞り込み" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">（任意）路線の絞り込み</h3>
                  <p className="text-xs text-muted-foreground">初期状態ではすべての路線が選択されています。選択を変更すると Explorer でのハイライト対象が更新される予定です。</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setSelectedRoutes(new Set(routeOptions.map((option) => option.id)))}>
                    全選択
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => setSelectedRoutes(new Set())}>
                    全解除
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-[240px_1fr]">
                <Input
                  value={routeFilterQuery}
                  onChange={(event) => setRouteFilterQuery(event.target.value)}
                  placeholder="系統ID・名称で検索"
                  aria-label="路線検索"
                />
                <p className="text-xs text-muted-foreground self-center">選択中: {selectedRoutes.size} / {routeOptions.length}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRoutes.length === 0 ? (
                  <p className="col-span-full rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">該当する路線がありません。</p>
                ) : (
                  filteredRoutes.map((option) => {
                    const checked = selectedRoutes.has(option.id);
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm shadow-sm transition hover:border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => {
                            setSelectedRoutes((prev) => {
                              const next = new Set(prev);
                              if (next.has(option.id)) {
                                next.delete(option.id);
                              } else {
                                next.add(option.id);
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="flex flex-col">
                          <span className="font-medium text-foreground">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description ?? option.id}</span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </section>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">保存・出力は左ナビの「差分・出力」から行えます。</p>
            <Button type="button" onClick={() => navigate('explorer')} disabled={!hasRouteSelection} aria-disabled={!hasRouteSelection}>
              Explorer を開く
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
