/**
 * src/features/manual/components/DriversCard.tsx
 * Manages manual driver entries and CSV import/export operations.
 */
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ManualDriver } from '@/types';

import { DataTable, LabeledInput } from './FormControls';

export interface DriversCardProps {
  rows: ManualDriver[];
  onAdd: (driver: ManualDriver) => boolean;
  onDelete: (driverId: string) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function DriversCard({ rows, onAdd, onDelete, onImport, onExport }: DriversCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<ManualDriver>({ driverId: '', name: '' });

  return (
    <Card data-testid="manual-drivers-card">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>運転士</CardTitle>
          <CardDescription>`drivers.csv`（driver_id,name）を取り込んで乗務割当の候補に利用します。</CardDescription>
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
        <div className="grid gap-3 md:grid-cols-3">
          <LabeledInput
            id="driver-id"
            label="driver_id"
            value={draft.driverId}
            onChange={(value) => setDraft({ ...draft, driverId: value })}
          />
          <LabeledInput
            id="driver-name"
            label="名称"
            value={draft.name}
            onChange={(value) => setDraft({ ...draft, name: value })}
          />
          <div className="md:self-end">
            <Button
              type="button"
              onClick={() => {
                const added = onAdd(draft);
                if (added) {
                  setDraft({ driverId: '', name: '' });
                }
              }}
            >
              追加
            </Button>
          </div>
        </div>

        <DataTable
          headers={['driver_id', '名称', '']}
          rows={rows.map((driver) => [
            driver.driverId,
            driver.name || '-',
            <Button key={`del-${driver.driverId}`} variant="destructive" size="sm" onClick={() => onDelete(driver.driverId)}>
              削除
            </Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}
