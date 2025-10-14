/**
 * src/components/layout/AppShell.tsx
 * アプリ全体の枠組みを提供するレイアウトシェル。
 * ヘッダー・ナビゲーション・コンテンツ領域を束ね、セクション切替とレスポンシブ対応を担う。
 */
import { type ChangeEvent, type PropsWithChildren } from 'react';

export const APP_NAME = 'TS-bus-operation-app';

export interface NavigationSection {
  id: string;
  label: string;
  caption?: string;
}

interface AppShellProps extends PropsWithChildren {
  sections: NavigationSection[];
  activeSection: string;
  onSectionSelect: (sectionId: string) => void;
}

export default function AppShell({
  children,
  sections,
  activeSection,
  onSectionSelect,
}: AppShellProps): JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-screen-xl items-center justify-between px-4 sm:px-6">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide">{APP_NAME}</span>
            <span className="text-xs text-muted-foreground">バス運行の計画・最適化を支援する業務ツール</span>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">β プレビュー</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
          <aside className="hidden lg:flex lg:flex-col lg:gap-2 lg:border-r lg:border-border/60 lg:pr-6">
            <nav aria-label="主要メニュー" className="flex flex-col gap-1 text-sm">
              {sections.map((section) => (
                <AppShellNavItem
                  key={section.id}
                  section={section}
                  active={section.id === activeSection}
                  onSelect={onSectionSelect}
                />
              ))}
            </nav>
          </aside>
          <div className="flex flex-col gap-4 lg:col-start-2">
            <MobileNavigation
              sections={sections}
              activeSection={activeSection}
              onSectionSelect={onSectionSelect}
            />
            <main className="min-h-[calc(100vh-10rem)] rounded-lg border border-dashed border-border/60 bg-card p-4 shadow-sm sm:p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AppShellNavItemProps {
  section: NavigationSection;
  active: boolean;
  onSelect: (sectionId: string) => void;
}

function AppShellNavItem({ section, active, onSelect }: AppShellNavItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      aria-current={active ? 'page' : undefined}
      className="flex flex-col rounded-md border border-transparent px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-border hover:bg-muted/50 data-[active=true]:border-border data-[active=true]:bg-muted/60 data-[active=true]:text-foreground"
      data-active={active} data-section={section.id}
    >
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">{section.label}</span>
      {section.caption ? <span className="text-sm font-medium text-foreground/90">{section.caption}</span> : null}
    </button>
  );
}

interface MobileNavigationProps {
  sections: NavigationSection[];
  activeSection: string;
  onSectionSelect: (sectionId: string) => void;
}

function MobileNavigation({
  sections,
  activeSection,
  onSectionSelect,
}: MobileNavigationProps): JSX.Element | null {
  if (sections.length <= 1) {
    return null;
  }

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSectionSelect(event.target.value);
  };

  return (
    <div className="rounded-md border border-border/60 bg-card/70 p-3 shadow-sm lg:hidden">
      <label htmlFor="app-mobile-nav" className="block text-xs font-semibold text-muted-foreground">
        表示する画面を選択
      </label>
      <select
        id="app-mobile-nav"
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        value={activeSection}
        onChange={handleChange}
      >
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.label}
            {section.caption ? `（${section.caption}）` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

