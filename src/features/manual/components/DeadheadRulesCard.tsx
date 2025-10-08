/**
 * src/features/manual/components/DeadheadRulesCard.tsx
 * Provides a UI to manage deadhead approximation rules and CSV import/export.
 */
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DeadheadRule } from '@/types';

import { DataTable, LabeledInput, clampInt, toNumber } from './FormControls';

export interface DeadheadRulesCardProps {
  rows: DeadheadRule[];
  onAdd: (row: DeadheadRule) => void;
  onDelete: (index: number) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function DeadheadRulesCard({ rows, onAdd, onDelete, onImport, onExport }: DeadheadRulesCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<DeadheadRule>({
    fromId: '',
    toId: '',
    mode: 'walk',
    travelTimeMin: 5,
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>回送近似（Deadhead Rules）</CardTitle>
          <CardDescription>最短経路は後続対応。まずは固定分/距離などで近似します。</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onImport(file);
              }
              event.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            CSVを読み込む
          </Button>
          <Button size="sm" onClick={onExport}>
            CSVを書き出す
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-6">
          <LabeledInput id="dh-from" label="from_id" value={draft.fromId} onChange={(value) => setDraft({ ...draft, fromId: value })} />
          <LabeledInput id="dh-to" label="to_id" value={draft.toId} onChange={(value) => setDraft({ ...draft, toId: value })} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">mode</label>
            <Select value={draft.mode} onValueChange={(value) => setDraft({ ...draft, mode: value as DeadheadRule['mode'] })}>
              <SelectTrigger>
                <SelectValue placeholder="mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk">walk</SelectItem>
                <SelectItem value="bus">bus</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LabeledInput
            id="dh-time"
            label="所要 (分)"
            type="number"
            value={String(draft.travelTimeMin)}
            onChange={(value) => setDraft({ ...draft, travelTimeMin: clampInt(value, 0, 600, 5) })}
          />
          <LabeledInput
            id="dh-dist"
            label="距離 (km)"
            type="number"
            value={String(draft.distanceKm ?? 0)}
            onChange={(value) => setDraft({ ...draft, distanceKm: toNumber(value, 0) })}
          />
          <LabeledInput
            id="dh-window"
            label="許可時間帯"
            placeholder="例 05:00-23:00"
            value={draft.allowedWindow ?? ''}
            onChange={(value) => setDraft({ ...draft, allowedWindow: value || undefined })}
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!draft.fromId || !draft.toId || !Number.isFinite(draft.travelTimeMin)) {
              return;
            }
            onAdd(draft);
            setDraft({ fromId: '', toId: '', mode: 'walk', travelTimeMin: 5 });
          }}
        >
          追加
        </Button>

        <DataTable
          headers={['from_id', 'to_id', 'mode', '所要(分)', '距離(km)', '許可時間帯', '']}
          rows={rows.map((rule, index) => [
            rule.fromId,
            rule.toId,
            rule.mode,
            String(rule.travelTimeMin),
            rule.distanceKm ?? '-',
            rule.allowedWindow ?? '-',
            <Button key={`del-${index}`} variant="destructive" size="sm" onClick={() => onDelete(index)}>
              削除
            </Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}
