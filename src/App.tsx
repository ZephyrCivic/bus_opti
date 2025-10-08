/**
 * src/App.tsx
 * TabsでImport/Explorer/Blocks/Duties/Dashboard/Diff/Manualを切り替え、Explorerは遅延読込で初期ロードを軽量化する。
 */
import { Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import AppShell from './components/layout/AppShell';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import ImportView from './features/import/ImportView';
import BlocksView from './features/blocks/BlocksView';
import DutiesView from './features/duties/DutiesView';
import DashboardView from './features/dashboard/DashboardView';
import DiffView from './features/dashboard/DiffView';
import ManualDataView from './features/manual/ManualDataView';
import { GtfsImportProvider } from './services/import/GtfsImportProvider';

const ExplorerView = lazy(async () => import('./features/explorer/ExplorerView'));

export default function App(): JSX.Element {
  return (
    <GtfsImportProvider>
      <AppShell>
        <ErrorBoundary fallback={<ErrorPaneFallback />}>
          <Tabs defaultValue="import" className="space-y-4">
            <TabsList>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="explorer">Explorer</TabsTrigger>
              <TabsTrigger value="blocks">Blocks</TabsTrigger>
              <TabsTrigger value="duties">Duties</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>
            <TabsContent value="import">
              <ImportView />
            </TabsContent>
            <TabsContent value="explorer">
              <Suspense fallback={<LazyPaneFallback label="Explorer" />}>
                <ExplorerView />
              </Suspense>
            </TabsContent>
            <TabsContent value="blocks">
              <BlocksView />
            </TabsContent>
            <TabsContent value="duties">
              <DutiesView />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardView />
            </TabsContent>
            <TabsContent value="diff">
              <DiffView />
            </TabsContent>
            <TabsContent value="manual">
              <ManualDataView />
            </TabsContent>
          </Tabs>
        </ErrorBoundary>
      </AppShell>
      <Toaster position="top-right" richColors closeButton />
    </GtfsImportProvider>
  );
}

interface LazyPaneFallbackProps {
  label: string;
}

function LazyPaneFallback({ label }: LazyPaneFallbackProps): JSX.Element {
  return <div className="p-4 text-sm text-muted-foreground">{label} view を読み込んでいます…</div>;
}

function ErrorPaneFallback(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
      <p>ビューの描画に失敗しました。</p>
      <p>入力内容を保存したうえで、ページの再読み込みをお試しください。</p>
    </div>
  );
}
