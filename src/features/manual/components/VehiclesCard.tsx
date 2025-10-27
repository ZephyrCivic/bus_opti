/**
 * src/features/manual/components/VehiclesCard.tsx
 * Manages manual vehicle entries and CSV import/export operations.
 */
import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ManualVehicle, ManualVehicleType } from '@/types';

import { DataTable, LabeledInput } from './FormControls';

const NO_VEHICLE_TYPES_OPTION_VALUE = '__no-vehicle-types__';

type BooleanChoice = 'unset' | 'true' | 'false';

interface VehicleDraft {
  vehicleId: string;
  vehicleTypeId: string;
  depotId: string;
  seats: string;
  wheelchairAccessible: BooleanChoice;
  lowFloor: BooleanChoice;
  notes: string;
}

export interface VehiclesCardProps {
  rows: ManualVehicle[];
  vehicleTypes: ManualVehicleType[];
  onAdd: (vehicle: ManualVehicle) => boolean;
  onDelete: (vehicleId: string) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function VehiclesCard({
  rows,
  vehicleTypes,
  onAdd,
  onDelete,
  onImport,
  onExport,
}: VehiclesCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<VehicleDraft>({
    vehicleId: '',
    vehicleTypeId: '',
    depotId: '',
    seats: '',
    wheelchairAccessible: 'unset',
    lowFloor: 'unset',
    notes: '',
  });

  const totalVehicles = useMemo(() => rows.length, [rows]);
  const vehicleTypeOptions = useMemo(
    () =>
      vehicleTypes.map((type) => ({
        value: type.typeId,
        label: type.name ? `${type.typeId}（${type.name}）` : type.typeId,
      })),
    [vehicleTypes],
  );

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
          <CardTitle>車両</CardTitle>
          <CardDescription>
            `manual-vehicles.csv`（vehicle_id, vehicle_type, depot_id, seats, wheelchair_accessible, low_floor, notes）を管理します。
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
            id="vehicle-id"
            label="vehicle_id"
            value={draft.vehicleId}
            onChange={(value) => setDraft((prev) => ({ ...prev, vehicleId: value }))}
          />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">vehicle_type</label>
            <Select
              value={draft.vehicleTypeId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, vehicleTypeId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="タイプを選択" />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypeOptions.length === 0 ? (
                  <SelectItem value={NO_VEHICLE_TYPES_OPTION_VALUE} disabled>
                    先に車両タイプを登録してください
                  </SelectItem>
                ) : (
                  vehicleTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <LabeledInput
            id="vehicle-depot"
            label="depot_id"
            value={draft.depotId}
            onChange={(value) => setDraft((prev) => ({ ...prev, depotId: value }))}
          />
          <LabeledInput
            id="vehicle-seats"
            label="座席数"
            value={draft.seats}
            onChange={(value) => setDraft((prev) => ({ ...prev, seats: value }))}
            type="number"
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
            id="vehicle-notes"
            label="備考"
            value={draft.notes}
            onChange={(value) => setDraft((prev) => ({ ...prev, notes: value }))}
            placeholder="任意メモ"
          />
          <div className="md:self-end">
            <Button
              type="button"
              onClick={() => {
                const vehicleId = draft.vehicleId.trim();
                if (!vehicleId) {
                  return;
                }
                const vehicleTypeId = draft.vehicleTypeId.trim();
                if (!vehicleTypeId) {
                  return;
                }
                const payload: ManualVehicle = {
                  vehicleId,
                  vehicleTypeId,
                  depotId: draft.depotId.trim() || undefined,
                  seats: parseOptionalNumber(draft.seats),
                  wheelchairAccessible: safeBoolean(draft.wheelchairAccessible),
                  lowFloor: safeBoolean(draft.lowFloor),
                  notes: draft.notes.trim() || undefined,
                };
                const added = onAdd(payload);
                if (added) {
                  setDraft({
                    vehicleId: '',
                    vehicleTypeId: '',
                    depotId: '',
                    seats: '',
                    wheelchairAccessible: 'unset',
                    lowFloor: 'unset',
                    notes: '',
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
            'vehicle_id',
            'vehicle_type',
            'depot_id',
            '座席',
            '車椅子',
            '低床',
            '備考',
            '',
          ]}
          rows={rows.map((vehicle) => [
            vehicle.vehicleId,
            vehicle.vehicleTypeId,
            vehicle.depotId ?? '-',
            vehicle.seats ?? '-',
            vehicle.wheelchairAccessible === undefined ? '-' : vehicle.wheelchairAccessible ? '1' : '0',
            vehicle.lowFloor === undefined ? '-' : vehicle.lowFloor ? '1' : '0',
            vehicle.notes ?? '-',
            <Button
              key={`delete-${vehicle.vehicleId}`}
              variant="destructive"
              size="sm"
              onClick={() => onDelete(vehicle.vehicleId)}
            >
              削除
            </Button>,
          ])}
        />

        <p className="text-xs text-muted-foreground">登録件数: {totalVehicles}</p>
      </CardContent>
    </Card>
  );
}
