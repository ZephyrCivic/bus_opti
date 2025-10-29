/**
 * src/features/manual/components/VehicleCatalogCard.tsx
 * Manages vehicle types and vehicles side by side to emphasize their relationship.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ManualVehicle, ManualVehicleType } from '@/types';

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

interface VehicleDraft {
  vehicleId: string;
  vehicleTypeId: string;
  depotId: string;
  seats: string;
  wheelchairAccessible: BooleanChoice;
  lowFloor: BooleanChoice;
  notes: string;
}

export interface VehicleCatalogCardProps {
  vehicleTypes: ManualVehicleType[];
  vehicles: ManualVehicle[];
  onTypeAdd: (type: ManualVehicleType) => boolean;
  onTypeDelete: (typeId: string) => void;
  onTypeImport: (file: File) => Promise<void>;
  onTypeExport: () => void;
  onVehicleAdd: (vehicle: ManualVehicle) => boolean;
  onVehicleDelete: (vehicleId: string) => void;
  onVehicleImport: (file: File) => Promise<void>;
  onVehicleExport: () => void;
}

const BOOLEAN_OPTIONS: { label: string; value: BooleanChoice }[] = [
  { value: 'unset', label: '未指定' },
  { value: 'true', label: '対応（1）' },
  { value: 'false', label: '非対応（0）' },
];

export function VehicleCatalogCard({
  vehicleTypes,
  vehicles,
  onTypeAdd,
  onTypeDelete,
  onTypeImport,
  onTypeExport,
  onVehicleAdd,
  onVehicleDelete,
  onVehicleImport,
  onVehicleExport,
}: VehicleCatalogCardProps): JSX.Element {
  const typeFileInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleFileInputRef = useRef<HTMLInputElement | null>(null);

  const [typeDraft, setTypeDraft] = useState<VehicleTypeDraft>({
    typeId: '',
    name: '',
    wheelchairAccessible: 'unset',
    lowFloor: 'unset',
    capacitySeated: '',
    capacityTotal: '',
    tags: '',
  });
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>({
    vehicleId: '',
    vehicleTypeId: '',
    depotId: '',
    seats: '',
    wheelchairAccessible: 'unset',
    lowFloor: 'unset',
    notes: '',
  });

  const [selectedTypeId, setSelectedTypeId] = useState<string>(() => vehicleTypes[0]?.typeId ?? '');

  useEffect(() => {
    if (!selectedTypeId && vehicleTypes.length > 0) {
      setSelectedTypeId(vehicleTypes[0]!.typeId);
      return;
    }
    if (selectedTypeId && !vehicleTypes.some((type) => type.typeId === selectedTypeId)) {
      setSelectedTypeId(vehicleTypes[0]?.typeId ?? '');
    }
  }, [selectedTypeId, vehicleTypes]);

  useEffect(() => {
    setVehicleDraft((prev) => ({
      ...prev,
      vehicleTypeId: selectedTypeId ?? '',
    }));
  }, [selectedTypeId]);

  const vehicleCountsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vehicle of vehicles) {
      counts.set(vehicle.vehicleTypeId, (counts.get(vehicle.vehicleTypeId) ?? 0) + 1);
    }
    return counts;
  }, [vehicles]);

  const vehicleTypeOptions = useMemo(
    () =>
      vehicleTypes.map((type) => ({
        value: type.typeId,
        label: type.name ? `${type.typeId}（${type.name}）` : type.typeId,
      })),
    [vehicleTypes],
  );

  const filteredVehicles = useMemo(() => {
    if (!selectedTypeId) {
      return vehicles;
    }
    return vehicles.filter((vehicle) => vehicle.vehicleTypeId === selectedTypeId);
  }, [selectedTypeId, vehicles]);

  const safeBoolean = (choice: BooleanChoice): boolean | undefined => {
    if (choice === 'unset') {
      return undefined;
    }
    return choice === 'true';
  };

  const parseOptionalNumber = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  return (
    <Card data-testid="manual-vehicle-catalog-card">
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>車両タイプと車両</CardTitle>
          <CardDescription>
            タイプ（カテゴリの共通属性）と個別車両（ナンバー・所属など）を1つの画面で編集します。タイプを選択すると、その配下の車両一覧と追加フォームが表示されます。
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={typeFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onTypeImport(file);
              }
              event.target.value = '';
            }}
          />
          <input
            ref={vehicleFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onVehicleImport(file);
              }
              event.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => typeFileInputRef.current?.click()}>
            タイプCSVを読み込む
          </Button>
          <Button variant="secondary" size="sm" onClick={() => vehicleFileInputRef.current?.click()}>
            車両CSVを読み込む
          </Button>
          <Button size="sm" onClick={onTypeExport}>
            タイプCSVを書き出す
          </Button>
          <Button size="sm" onClick={onVehicleExport}>
            車両CSVを書き出す
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">1. 車両タイプを登録</h3>
            <p className="text-xs text-muted-foreground">
              共通する仕様（座席数・バリアフリーなど）をタイプとしてまとめます。後段の車両登録ではここで選択した type_id を利用します。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            <LabeledInput
              id="vehicle-type-id"
              label="type_id"
              value={typeDraft.typeId}
              onChange={(value) => setTypeDraft((prev) => ({ ...prev, typeId: value }))}
            />
            <LabeledInput
              id="vehicle-type-name"
              label="名称"
              value={typeDraft.name}
              onChange={(value) => setTypeDraft((prev) => ({ ...prev, name: value }))}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">車椅子対応</label>
              <Select
                value={typeDraft.wheelchairAccessible}
                onValueChange={(value: BooleanChoice) => setTypeDraft((prev) => ({ ...prev, wheelchairAccessible: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  {BOOLEAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ノンステップ</label>
              <Select
                value={typeDraft.lowFloor}
                onValueChange={(value: BooleanChoice) => setTypeDraft((prev) => ({ ...prev, lowFloor: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  {BOOLEAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LabeledInput
              id="vehicle-type-capacity-seated"
              label="座席数"
              value={typeDraft.capacitySeated}
              onChange={(value) => setTypeDraft((prev) => ({ ...prev, capacitySeated: value }))}
              type="number"
            />
            <LabeledInput
              id="vehicle-type-capacity-total"
              label="総定員"
              value={typeDraft.capacityTotal}
              onChange={(value) => setTypeDraft((prev) => ({ ...prev, capacityTotal: value }))}
              type="number"
            />
            <LabeledInput
              id="vehicle-type-tags"
              label="タグ（カンマ区切り）"
              value={typeDraft.tags}
              onChange={(value) => setTypeDraft((prev) => ({ ...prev, tags: value }))}
            />
            <div className="md:self-end">
              <Button
                type="button"
                onClick={() => {
                  const typeId = typeDraft.typeId.trim();
                  if (!typeId) {
                    return;
                  }
                  const payload: ManualVehicleType = {
                    typeId,
                    name: typeDraft.name.trim() || undefined,
                    wheelchairAccessible: safeBoolean(typeDraft.wheelchairAccessible),
                    lowFloor: safeBoolean(typeDraft.lowFloor),
                    capacitySeated: parseOptionalNumber(typeDraft.capacitySeated),
                    capacityTotal: parseOptionalNumber(typeDraft.capacityTotal),
                    tags: typeDraft.tags.trim() || undefined,
                  };
                  const added = onTypeAdd(payload);
                  if (added) {
                    setTypeDraft({
                      typeId: '',
                      name: '',
                      wheelchairAccessible: 'unset',
                      lowFloor: 'unset',
                      capacitySeated: '',
                      capacityTotal: '',
                      tags: '',
                    });
                    setSelectedTypeId((prevSelected) => prevSelected || payload.typeId);
                  }
                }}
              >
                車両タイプを追加
              </Button>
            </div>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>type_id</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>車椅子</TableHead>
                  <TableHead>低床</TableHead>
                  <TableHead>座席</TableHead>
                  <TableHead>総定員</TableHead>
                  <TableHead>タグ</TableHead>
                  <TableHead>車両数</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleTypes.map((type) => {
                  const isSelected = selectedTypeId === type.typeId;
                  return (
                    <TableRow
                      key={type.typeId}
                      className={clsx('cursor-pointer', isSelected && 'bg-muted/60')}
                      onClick={() => setSelectedTypeId(type.typeId)}
                    >
                      <TableCell>{type.typeId}</TableCell>
                      <TableCell>{type.name ?? '-'}</TableCell>
                      <TableCell>
                        {type.wheelchairAccessible === undefined ? '-' : type.wheelchairAccessible ? '1' : '0'}
                      </TableCell>
                      <TableCell>{type.lowFloor === undefined ? '-' : type.lowFloor ? '1' : '0'}</TableCell>
                      <TableCell>{type.capacitySeated ?? '-'}</TableCell>
                      <TableCell>{type.capacityTotal ?? '-'}</TableCell>
                      <TableCell>{type.tags ?? '-'}</TableCell>
                      <TableCell>{vehicleCountsByType.get(type.typeId) ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTypeDelete(type.typeId);
                          }}
                        >
                          削除
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {vehicleTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      まだ車両タイプがありません。まずタイプを追加してください。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">2. 車両を登録</h3>
              <p className="text-xs text-muted-foreground">
                選択中のタイプに対して車両 ID・所属・備考を登録します。タイプごとの車両がテーブル下部に一覧表示されます。
              </p>
            </div>
            <div className="w-full sm:w-60">
              <label className="text-xs font-medium text-muted-foreground">車両タイプを選択</label>
              <Select
                value={selectedTypeId}
                onValueChange={(value) => setSelectedTypeId(value)}
                disabled={vehicleTypes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="タイプ未選択" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            <LabeledInput
              id="vehicle-id"
              label="vehicle_id"
              value={vehicleDraft.vehicleId}
              onChange={(value) => setVehicleDraft((prev) => ({ ...prev, vehicleId: value }))}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">vehicle_type</label>
              <Select
                value={vehicleDraft.vehicleTypeId}
                onValueChange={(value) => setVehicleDraft((prev) => ({ ...prev, vehicleTypeId: value }))}
                disabled={vehicleTypeOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="タイプを選択" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypeOptions.length === 0 ? (
                    <SelectItem value="__no-types__" disabled>
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
              value={vehicleDraft.depotId}
              onChange={(value) => setVehicleDraft((prev) => ({ ...prev, depotId: value }))}
            />
            <LabeledInput
              id="vehicle-seats"
              label="座席数"
              value={vehicleDraft.seats}
              onChange={(value) => setVehicleDraft((prev) => ({ ...prev, seats: value }))}
              type="number"
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">車椅子対応</label>
              <Select
                value={vehicleDraft.wheelchairAccessible}
                onValueChange={(value: BooleanChoice) => setVehicleDraft((prev) => ({ ...prev, wheelchairAccessible: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  {BOOLEAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ノンステップ</label>
              <Select
                value={vehicleDraft.lowFloor}
                onValueChange={(value: BooleanChoice) => setVehicleDraft((prev) => ({ ...prev, lowFloor: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  {BOOLEAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LabeledInput
              id="vehicle-notes"
              label="備考"
              value={vehicleDraft.notes}
              onChange={(value) => setVehicleDraft((prev) => ({ ...prev, notes: value }))}
              placeholder="任意メモ"
            />
            <div className="md:self-end">
              <Button
                type="button"
                disabled={vehicleTypeOptions.length === 0}
                onClick={() => {
                  const vehicleId = vehicleDraft.vehicleId.trim();
                  if (!vehicleId) {
                    return;
                  }
                  const vehicleTypeId = vehicleDraft.vehicleTypeId.trim();
                  if (!vehicleTypeId) {
                    return;
                  }
                  const payload: ManualVehicle = {
                    vehicleId,
                    vehicleTypeId,
                    depotId: vehicleDraft.depotId.trim() || undefined,
                    seats: parseOptionalNumber(vehicleDraft.seats),
                    wheelchairAccessible: safeBoolean(vehicleDraft.wheelchairAccessible),
                    lowFloor: safeBoolean(vehicleDraft.lowFloor),
                    notes: vehicleDraft.notes.trim() || undefined,
                  };
                  const added = onVehicleAdd(payload);
                  if (added) {
                    setVehicleDraft({
                      vehicleId: '',
                      vehicleTypeId: selectedTypeId,
                      depotId: '',
                      seats: '',
                      wheelchairAccessible: 'unset',
                      lowFloor: 'unset',
                      notes: '',
                    });
                  }
                }}
              >
                車両を追加
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
            rows={filteredVehicles.map((vehicle) => [
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
                onClick={() => onVehicleDelete(vehicle.vehicleId)}
              >
                削除
              </Button>,
            ])}
            emptyMessage={
              selectedTypeId
                ? `type_id=${selectedTypeId} の車両がまだ登録されていません。`
                : 'まだ車両がありません。タイプを選択して追加してください。'
            }
          />
          <p className="text-xs text-muted-foreground">
            表示中の車両件数: {filteredVehicles.length}
            {selectedTypeId ? `（type_id=${selectedTypeId}）` : ''}
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
