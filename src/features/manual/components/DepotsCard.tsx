/**
 * src/features/manual/components/DepotsCard.tsx
 * Manages manual depot entries and related CSV import/export actions.
 */
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Depot } from '@/types';

import { DataTable, LabeledInput, clampInt, toNumber } from './FormControls';

export interface DepotsCardProps {
  rows: Depot[];
  onAdd: (row: Depot) => void;
  onDelete: (depotId: string) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function DepotsCard({ rows, onAdd, onDelete, onImport, onExport }: DepotsCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<Depot>({
    depotId: '',
    name: '',
    lat: 0,
    lon: 0,
    minTurnaroundMin: 10,
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>デポ/車庫（Depots）</CardTitle>
          <CardDescription>入出庫・点呼拠点など。最小折返し時間も保持できます。</CardDescription>
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
          <LabeledInput id="depot-id" label="ID" value={draft.depotId} onChange={(value) => setDraft({ ...draft, depotId: value })} />
          <LabeledInput id="depot-name" label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
          <LabeledInput
            id="depot-lat"
            label="緯度"
            type="number"
            value={String(draft.lat)}
            onChange={(value) => setDraft({ ...draft, lat: toNumber(value, 0) })}
          />
          <LabeledInput
            id="depot-lon"
            label="経度"
            type="number"
            value={String(draft.lon)}
            onChange={(value) => setDraft({ ...draft, lon: toNumber(value, 0) })}
          />
          <LabeledInput
            id="depot-open"
            label="開所"
            placeholder="HH:MM"
            value={draft.openTime ?? ''}
            onChange={(value) => setDraft({ ...draft, openTime: value || undefined })}
          />
          <LabeledInput
            id="depot-close"
            label="閉所"
            placeholder="HH:MM"
            value={draft.closeTime ?? ''}
            onChange={(value) => setDraft({ ...draft, closeTime: value || undefined })}
          />
        </div>
        <div className="flex items-end gap-2">
          <LabeledInput
            id="depot-turn"
            label="最小折返し (分)"
            type="number"
            value={String(draft.minTurnaroundMin ?? 0)}
            onChange={(value) => setDraft({ ...draft, minTurnaroundMin: clampInt(value, 0, 120, 10) })}
          />
          <Button
            type="button"
            onClick={() => {
              if (!draft.depotId || !Number.isFinite(draft.lat) || !Number.isFinite(draft.lon)) {
                return;
              }
              onAdd(draft);
              setDraft({ depotId: '', name: '', lat: 0, lon: 0, minTurnaroundMin: 10 });
            }}
          >
            追加
          </Button>
        </div>

        <DataTable
          headers={['depot_id', '名称', '緯度', '経度', '開所', '閉所', '最小折返し', '']}
          rows={rows.map((depot) => [
            depot.depotId,
            depot.name,
            String(depot.lat),
            String(depot.lon),
            depot.openTime ?? '-',
            depot.closeTime ?? '-',
            String(depot.minTurnaroundMin ?? '-'),
            <Button key={`del-${depot.depotId}`} variant="destructive" size="sm" onClick={() => onDelete(depot.depotId)}>
              削除
            </Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}
