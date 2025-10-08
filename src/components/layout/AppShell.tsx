/**
 * src/components/layout/AppShell.tsx
 * Defines the base layout (header, sidebar, content) used across MVP screens.
 * Ensures consistent spacing and theming before routing/feature components arrive.
 */
import { type PropsWithChildren } from 'react';

export const APP_NAME = 'TS-bus-operation-app';

export default function AppShell({ children }: PropsWithChildren): JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-wide">{APP_NAME}</span>
          <span className="text-xs text-muted-foreground">MVP scaffolding</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-screen-xl grid-cols-[220px_1fr] gap-x-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-2 border-border/60 lg:border-r">
          <nav aria-label="主要ナビゲーション" className="flex flex-col gap-1 text-sm">
            <AppShellNavItem label="Import" caption="GTFS 読込" />
            <AppShellNavItem label="Explorer" caption="地図・便調査" />
            <AppShellNavItem label="Blocks" caption="行路推定" />
            <AppShellNavItem label="Duties" caption="勤務編集" />
            <AppShellNavItem label="Diff/Export" caption="差分・出力" />
          </nav>
        </aside>
        <main className="min-h-[calc(100vh-8rem)] rounded-lg border border-dashed border-border/60 bg-card p-6 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}

interface AppShellNavItemProps {
  label: string;
  caption: string;
}

function AppShellNavItem({ label, caption }: AppShellNavItemProps): JSX.Element {
  return (
    <div className="flex flex-col rounded-md border border-transparent px-3 py-2 text-left transition hover:border-border hover:bg-muted/40">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground/90">{caption}</span>
    </div>
  );
}
