/**
 * src/components/export/ExportBar.tsx
 * Shared UI bar to expose one or more export actions (e.g., CSV download).
 */
import { Button } from '@/components/ui/button';

export interface ExportAction {
  id: string;
  label: string;
  onClick(): void;
  disabled?: boolean;
}

interface ExportBarProps {
  actions: ExportAction[];
  className?: string;
}

export function ExportBar({ actions, className }: ExportBarProps): JSX.Element {
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {actions.map((action) => (
        <Button key={action.id} onClick={action.onClick} disabled={action.disabled} size="sm">
          {action.label}
        </Button>
      ))}
      {actions.length === 0 && (
        <span className="text-sm text-muted-foreground">エクスポート可能な項目はありません。</span>
      )}
    </div>
  );
}

export default ExportBar;
