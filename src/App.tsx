/**
 * src/App.tsx
 * 各機能セクションを定義し、AppShell に渡して画面切替を管理する。
 * セクションごとのコンテンツを日本語 UI へ寄せつつ、遅延読み込みも維持する。
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import AppShell, { type NavigationSection } from './components/layout/AppShell';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import ImportView from './features/import/ImportView';
import BlocksView from './features/blocks/BlocksView';
import DutiesView from './features/duties/DutiesView';
import DashboardView from './features/dashboard/DashboardView';
import DiffView from './features/dashboard/DiffView';
import ManualDataView from './features/manual/ManualDataView';
import { GtfsImportProvider } from './services/import/GtfsImportProvider';
import { SectionNavigationContext } from './components/layout/SectionNavigationContext';

const ExplorerView = lazy(async () => import('./features/explorer/ExplorerView'));

const SECTIONS: NavigationSection[] = [
  { id: 'import', label: 'GTFS取込' },
  { id: 'explorer', label: '行路編集対象の便を選択' },
  { id: 'blocks', label: '行路推定' },
  { id: 'duties', label: '勤務編集' },
  { id: 'dashboard', label: '運行指標' },
  { id: 'diff', label: '差分・出力' },
  { id: 'manual', label: '手動入力' },
];

type SectionId = (typeof SECTIONS)[number]['id'];

export default function App(): JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>(SECTIONS[0]!.id);
  const handleSectionSelect = (nextSection: string) => {
    setActiveSection(nextSection as SectionId);
  };

  const content = useMemo(() => {
    switch (activeSection) {
      case 'import':
        return <ImportView />;
      case 'explorer':
        return (
          <Suspense fallback={<LazyPaneFallback label="行路編集対象の便を読み込み中…" />}>
            <ExplorerView />
          </Suspense>
        );
      case 'blocks':
        return <BlocksView />;
      case 'duties':
        return <DutiesView />;
      case 'dashboard':
        return <DashboardView />;
      case 'diff':
        return <DiffView />;
      case 'manual':
        return <ManualDataView />;
      default:
        return null;
    }
  }, [activeSection]);

  return (
    <GtfsImportProvider>
      <SectionNavigationContext.Provider value={{ currentSection: activeSection, navigate: handleSectionSelect }}>
        <AppShell sections={SECTIONS} activeSection={activeSection} onSectionSelect={handleSectionSelect}>
          <ErrorBoundary fallback={<ErrorPaneFallback />}>{content}</ErrorBoundary>
        </AppShell>
        <Toaster position="top-right" richColors closeButton />
      </SectionNavigationContext.Provider>
    </GtfsImportProvider>
  );
}

interface LazyPaneFallbackProps {
  label: string;
}

function LazyPaneFallback({ label }: LazyPaneFallbackProps): JSX.Element {
  return <div className="p-4 text-sm text-muted-foreground">{label}</div>;
}

function ErrorPaneFallback(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
      <p>画面の表示に失敗しました。</p>
      <p>入力内容を保存のうえ、ページを再読み込みしてください。</p>
    </div>
  );
}

