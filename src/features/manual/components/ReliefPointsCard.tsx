/**
 * src/features/manual/components/ReliefPointsCard.tsx
 * Handles manual relief point inputs and CSV import/export.
 */
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReliefPoint } from '@/types';

import { DataTable, LabeledInput, clampInt, toNumber } from './FormControls';

export interface ReliefPointsCardProps {
  rows: ReliefPoint[];
  onAdd: (row: ReliefPoint) => void;
  onDelete: (reliefId: string) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function ReliefPointsCard({ rows, onAdd, onDelete, onImport, onExport }: ReliefPointsCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<ReliefPoint>({
    reliefId: '',
    name: '',
    lat: 0,
    lon: 0,
    stopId: '',
    walkTimeToStopMin: 0,
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>交代地点（Relief Points）</CardTitle>
          <CardDescription>交代可能な地点を追加します（未入力でも作業は継続可能）。</CardDescription>
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
          <LabeledInput id="relief-id" label="ID" value={draft.reliefId} onChange={(value) => setDraft({ ...draft, reliefId: value })} />
          <LabeledInput id="relief-name" label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
          <LabeledInput
            id="relief-lat"
            label="緯度"
            type="number"
            value={String(draft.lat)}
            onChange={(value) => setDraft({ ...draft, lat: toNumber(value, 0) })}
          />
          <LabeledInput
            id="relief-lon"
            label="経度"
            type="number"
            value={String(draft.lon)}
            onChange={(value) => setDraft({ ...draft, lon: toNumber(value, 0) })}
          />
          <LabeledInput
            id="relief-stop"
            label="stop_id"
            value={draft.stopId ?? ''}
            onChange={(value) => setDraft({ ...draft, stopId: value || undefined })}
          />
          <LabeledInput
            id="relief-walk"
            label="徒歩 (分)"
            type="number"
            value={String(draft.walkTimeToStopMin ?? 0)}
            onChange={(value) => setDraft({ ...draft, walkTimeToStopMin: clampInt(value, 0, 120, 0) })}
          />
        </div>
        <div className="flex gap-2">
          <LabeledInput
            id="relief-window"
            label="許可時間帯"
            placeholder="例 09:00-18:00"
            value={draft.allowedWindow ?? ''}
            onChange={(value) => setDraft({ ...draft, allowedWindow: value || undefined })}
          />
          <Button
            type="button"
            onClick={() => {
              if (!draft.reliefId || !Number.isFinite(draft.lat) || !Number.isFinite(draft.lon)) {
                return;
              }
              onAdd(draft);
              setDraft({ reliefId: '', name: '', lat: 0, lon: 0, stopId: '', walkTimeToStopMin: 0 });
            }}
          >
            追加
          </Button>
        </div>

        <DataTable
          headers={['relief_id', '名称', '緯度', '経度', 'stop_id', '徒歩', '許可時間帯', '']}
          rows={rows.map((relief) => [
            relief.reliefId,
            relief.name,
            String(relief.lat),
            String(relief.lon),
            relief.stopId ?? '-',
            String(relief.walkTimeToStopMin ?? '-'),
            relief.allowedWindow ?? '-',
            <Button key={`del-${relief.reliefId}`} variant="destructive" size="sm" onClick={() => onDelete(relief.reliefId)}>
              削除
            </Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}
