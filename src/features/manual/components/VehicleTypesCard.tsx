/**
 * src/features/manual/components/VehicleTypesCard.tsx
 * Manages manual vehicle type entries and CSV import/export operations.
 */
import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ManualVehicleType } from '@/types';

import { DataTable, LabeledInput } from './FormControls';

type BooleanChoice = 'unset' | 'true' | 'false';

interface VehicleTypeDraft {
  typeId: string;
  name: string;
  wheelchairAccessible: BooleanChoice;
  lowFloor: BooleanChoice;
  capacitySeated: string;
  capacityTotal: string;
  tags: string;
}

export interface VehicleTypesCardProps {
  rows: ManualVehicleType[];
  onAdd: (type: ManualVehicleType) => boolean;
  onDelete: (typeId: string) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function VehicleTypesCard({ rows, onAdd, onDelete, onImport, onExport }: VehicleTypesCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<VehicleTypeDraft>({
    typeId: '',
    name: '',
    wheelchairAccessible: 'unset',
    lowFloor: 'unset',
    capacitySeated: '',
    capacityTotal: '',
    tags: '',
  });

  const totalVehicleTypes = useMemo(() => rows.length, [rows]);

  const safeBoolean = (choice: BooleanChoice): boolean | undefined => {
    if (choice === 'unset') {
      return undefined;
    }
    return choice === 'true';
  };

  const parseOptionalNumber = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>車両タイプ（Vehicle Types）</CardTitle>
          <CardDescription>
            `manual-vehicle_types.csv`（type_id, name, wheelchair_accessible, low_floor, capacity_seated, capacity_total, tags）を管理します。
          </CardDescription>
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
          <LabeledInput
            id="vehicle-type-id"
            label="type_id"
            value={draft.typeId}
            onChange={(value) => setDraft((prev) => ({ ...prev, typeId: value }))}
          />
          <LabeledInput
            id="vehicle-type-name"
            label="名称"
            value={draft.name}
            onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
          />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">車椅子対応</label>
            <Select
              value={draft.wheelchairAccessible}
              onValueChange={(value: BooleanChoice) => setDraft((prev) => ({ ...prev, wheelchairAccessible: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="未指定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">未指定</SelectItem>
                <SelectItem value="true">対応（1）</SelectItem>
                <SelectItem value="false">非対応（0）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ノンステップ</label>
            <Select
              value={draft.lowFloor}
              onValueChange={(value: BooleanChoice) => setDraft((prev) => ({ ...prev, lowFloor: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="未指定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">未指定</SelectItem>
                <SelectItem value="true">低床（1）</SelectItem>
                <SelectItem value="false">通常（0）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LabeledInput
            id="vehicle-type-capacity-seated"
            label="座席数"
            value={draft.capacitySeated}
            onChange={(value) => setDraft((prev) => ({ ...prev, capacitySeated: value }))}
            type="number"
          />
          <LabeledInput
            id="vehicle-type-capacity-total"
            label="総定員"
            value={draft.capacityTotal}
            onChange={(value) => setDraft((prev) => ({ ...prev, capacityTotal: value }))}
            type="number"
          />
          <LabeledInput
            id="vehicle-type-tags"
            label="タグ（カンマ区切り）"
            value={draft.tags}
            onChange={(value) => setDraft((prev) => ({ ...prev, tags: value }))}
          />
          <div className="md:self-end">
            <Button
              type="button"
              onClick={() => {
                const typeId = draft.typeId.trim();
                if (!typeId) {
                  return;
                }
                const payload: ManualVehicleType = {
                  typeId,
                  name: draft.name.trim() || undefined,
                  wheelchairAccessible: safeBoolean(draft.wheelchairAccessible),
                  lowFloor: safeBoolean(draft.lowFloor),
                  capacitySeated: parseOptionalNumber(draft.capacitySeated),
                  capacityTotal: parseOptionalNumber(draft.capacityTotal),
                  tags: draft.tags.trim() || undefined,
                };
                const added = onAdd(payload);
                if (added) {
                  setDraft({
                    typeId: '',
                    name: '',
                    wheelchairAccessible: 'unset',
                    lowFloor: 'unset',
                    capacitySeated: '',
                    capacityTotal: '',
                    tags: '',
                  });
                }
              }}
            >
              追加
            </Button>
          </div>
        </div>

        <DataTable
          headers={[
            'type_id',
            '名称',
            '車椅子',
            '低床',
            '座席',
            '総定員',
            'タグ',
            '',
          ]}
          rows={rows.map((type) => [
            type.typeId,
            type.name ?? '-',
            type.wheelchairAccessible === undefined ? '-' : type.wheelchairAccessible ? '1' : '0',
            type.lowFloor === undefined ? '-' : type.lowFloor ? '1' : '0',
            type.capacitySeated ?? '-',
            type.capacityTotal ?? '-',
            type.tags ?? '-',
            <Button
              key={`delete-${type.typeId}`}
              variant="destructive"
              size="sm"
              onClick={() => onDelete(type.typeId)}
            >
              削除
            </Button>,
          ])}
        />

        <p className="text-xs text-muted-foreground">登録件数: {totalVehicleTypes}</p>
      </CardContent>
    </Card>
  );
}
