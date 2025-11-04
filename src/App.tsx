/**
 * src/App.tsx
 * 行路編集モードに寄せた最小ナビゲーション構成。Import と Blocks のみを提供する。
 */
import { useMemo, useState } from 'react';
import AppShell, { type NavigationSection } from './components/layout/AppShell';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import ImportView from './features/import/ImportView';
import BlocksView from './features/blocks/BlocksView';
import { GtfsImportProvider } from './services/import/GtfsImportProvider';
import { SectionNavigationContext } from './components/layout/SectionNavigationContext';
import { ExportConfirmationProvider } from './components/export/ExportConfirmationProvider';

const SECTIONS: NavigationSection[] = [
  { id: 'import', label: 'GTFS・保存データ取込' },
  { id: 'blocks', label: '行路編集' },
];

type SectionId = (typeof SECTIONS)[number]['id'];

export default function App(): JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>(SECTIONS[0]!.id);

  const content = useMemo(() => {
    switch (activeSection) {
      case 'import':
        return <ImportView />;
      case 'blocks':
        return <BlocksView />;
      default:
        return null;
    }
  }, [activeSection]);

  return (
    <GtfsImportProvider>
      <ExportConfirmationProvider>
        <SectionNavigationContext.Provider
          value={{ currentSection: activeSection, navigate: (next) => setActiveSection(next as SectionId) }}
        >
          <AppShell sections={SECTIONS} activeSection={activeSection} onSectionSelect={setActiveSection}>
            <ErrorBoundary fallback={<ErrorPaneFallback />}>{content}</ErrorBoundary>
          </AppShell>
          <Toaster position="top-right" richColors closeButton />
        </SectionNavigationContext.Provider>
      </ExportConfirmationProvider>
    </GtfsImportProvider>
  );
}

function ErrorPaneFallback(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
      <p>画面の表示に失敗しました。</p>
      <p>内容を保存済みの場合はページを再読み込みしてください。</p>
    </div>
  );
}
