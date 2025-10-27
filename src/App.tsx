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
import ManualDataView from './features/manual/ManualDataView';
import { GtfsImportProvider } from './services/import/GtfsImportProvider';
import { SectionNavigationContext } from './components/layout/SectionNavigationContext';
import { ExportConfirmationProvider } from './components/export/ExportConfirmationProvider';
import { isStepTwoOrHigher } from './config/appStep';

const ExplorerView = lazy(async () => import('./features/explorer/ExplorerView'));
const DashboardView = lazy(async () => import('./features/dashboard/DashboardView'));
const DiffView = lazy(async () => import('./features/dashboard/DiffView'));

const BASE_SECTIONS: NavigationSection[] = [
  { id: 'import', label: 'GTFS・保存データ取込' },
  { id: 'explorer', label: '行路編集対象の便を選択' },
  { id: 'manual', label: '制約条件（手動入力）' },
  { id: 'blocks', label: '行路編集' },
  { id: 'duties', label: '勤務編集' },
];
const STEP_TWO_SECTIONS: NavigationSection[] = isStepTwoOrHigher
  ? [
      { id: 'dashboard', label: 'KPIダッシュボード' },
      { id: 'diff', label: '差分と基準' },
    ]
  : [];
const SECTIONS: NavigationSection[] = [...BASE_SECTIONS, ...STEP_TWO_SECTIONS];

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
      case 'manual':
        return <ManualDataView />;
      case 'dashboard':
        return isStepTwoOrHigher ? (
          <Suspense fallback={<LazyPaneFallback label="ダッシュボードを読み込み中…" />}>
            <DashboardView />
          </Suspense>
        ) : null;
      case 'diff':
        return isStepTwoOrHigher ? (
          <Suspense fallback={<LazyPaneFallback label="差分ビューを読み込み中…" />}>
            <DiffView />
          </Suspense>
        ) : null;
      default:
        return null;
    }
  }, [activeSection]);

  return (
    <GtfsImportProvider>
      <ExportConfirmationProvider>
        <SectionNavigationContext.Provider value={{ currentSection: activeSection, navigate: handleSectionSelect }}>
          <AppShell
            sections={SECTIONS}
            activeSection={activeSection}
            onSectionSelect={handleSectionSelect}
          >
            <ErrorBoundary fallback={<ErrorPaneFallback />}>{content}</ErrorBoundary>
          </AppShell>
          <Toaster position="top-right" richColors closeButton />
        </SectionNavigationContext.Provider>
      </ExportConfirmationProvider>
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


