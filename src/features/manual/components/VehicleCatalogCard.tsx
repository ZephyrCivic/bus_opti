/**
 * src/features/manual/components/VehicleCatalogCard.tsx
 * グリッド中心の車両管理フォーム。車両タイプと車両を同じカード内で編集できるよう再構成する。
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ManualVehicle, ManualVehicleType } from '@/types';

import { LabeledInput } from './FormControls';

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

const ALL_TYPES_VALUE = '__all__';

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

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeDraft, setTypeDraft] = useState<VehicleTypeDraft>(() => createTypeDraft());
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(() => createVehicleDraft(vehicleTypes[0]?.typeId ?? ''));
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES_VALUE);

  useEffect(() => {
    if (!typeDialogOpen) {
      setTypeDraft(createTypeDraft());
    }
  }, [typeDialogOpen]);

  useEffect(() => {
    setVehicleDraft((prev) => {
      if (vehicleTypes.length === 0) {
        return prev.vehicleTypeId === '' ? prev : { ...prev, vehicleTypeId: '' };
      }
      if (vehicleTypes.some((type) => type.typeId === prev.vehicleTypeId)) {
        return prev;
      }
      return { ...prev, vehicleTypeId: vehicleTypes[0]!.typeId };
    });
  }, [vehicleTypes]);

  useEffect(() => {
    if (typeFilter === ALL_TYPES_VALUE) {
      return;
    }
    setVehicleDraft((prev) => {
      if (prev.vehicleTypeId === typeFilter) {
        return prev;
      }
      return { ...prev, vehicleTypeId: typeFilter };
    });
  }, [typeFilter]);

  const vehicleTypeOptions = useMemo(
    () =>
      vehicleTypes.map((type) => ({
        value: type.typeId,
        label: type.name ? `${type.typeId}（${type.name}）` : type.typeId,
      })),
    [vehicleTypes],
  );

  const filteredVehicles = useMemo(() => {
    if (typeFilter === ALL_TYPES_VALUE) {
      return vehicles;
    }
    return vehicles.filter((vehicle) => vehicle.vehicleTypeId === typeFilter);
  }, [typeFilter, vehicles]);

  const vehicleCountsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vehicle of vehicles) {
      counts.set(vehicle.vehicleTypeId, (counts.get(vehicle.vehicleTypeId) ?? 0) + 1);
    }
    return counts;
  }, [vehicles]);

  const handleAddVehicleFromDraft = () => {
    const vehicleId = vehicleDraft.vehicleId.trim();
    const vehicleTypeId = vehicleDraft.vehicleTypeId.trim();
    if (!vehicleId || !vehicleTypeId) {
      return;
    }

    const typeExists = vehicleTypes.some((type) => type.typeId === vehicleTypeId);
    if (!typeExists && typeFilter === ALL_TYPES_VALUE) {
      setTypeFilter(vehicleTypeId);
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
    if (!added) {
      return;
    }

    const resetTypeId = typeFilter !== ALL_TYPES_VALUE ? typeFilter : vehicleTypeId;
    setVehicleDraft(createVehicleDraft(resetTypeId));
  };

  const handleSubmitType = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    if (!added) {
      return;
    }
    setTypeDialogOpen(false);
    setTypeFilter(typeId);
    setVehicleDraft(createVehicleDraft(typeId));
  };

  const hasTypes = vehicleTypes.length > 0;
  const hasVehicles = vehicles.length > 0;

  return (
    <Card data-testid="manual-vehicle-catalog-card">
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>車両タイプと車両</CardTitle>
          <CardDescription>
            CSV と同じ列順で「1行 = 1車両」を入力できます。タイプを選ばず保存した場合は、自動で暫定タイプを登録します。
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={typeFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await onTypeImport(file);
                event.target.value = '';
              }
            }}
          />
          <Button variant="outline" onClick={() => typeFileInputRef.current?.click()}>
            タイプCSVを読み込む
          </Button>
          <Button variant="outline" onClick={onTypeExport} disabled={!hasTypes}>
            タイプCSVを書き出す
          </Button>

          <input
            ref={vehicleFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await onVehicleImport(file);
                event.target.value = '';
              }
            }}
          />
          <Button variant="outline" onClick={() => vehicleFileInputRef.current?.click()}>
            車両CSVを読み込む
          </Button>
          <Button variant="outline" onClick={onVehicleExport} disabled={!hasVehicles}>
            車両CSVを書き出す
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="flex-1 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">車両一覧と追加</h3>
                <p className="text-xs text-muted-foreground">
                  CSV と同じ列順で入力できます。タイプは選択肢から選ぶか、新しい type_id を直接入力してください。
                </p>
              </div>
              <div className="w-full sm:w-56">
                <label className="text-xs font-medium text-muted-foreground">フィルター</label>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="すべてのタイプ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TYPES_VALUE}>すべてのタイプ</SelectItem>
                    {vehicleTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[10rem]">vehicle_id</TableHead>
                    <TableHead className="min-w-[12rem]">vehicle_type</TableHead>
                    <TableHead className="min-w-[10rem]">depot_id</TableHead>
                    <TableHead className="min-w-[6rem] text-right">seats</TableHead>
                    <TableHead className="min-w-[8rem] text-center">wheelchair_accessible</TableHead>
                    <TableHead className="min-w-[8rem] text-center">low_floor</TableHead>
                    <TableHead className="min-w-[14rem]">notes</TableHead>
                    <TableHead className="min-w-[6rem]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/20">
                    <TableCell>
                      <Input
                        value={vehicleDraft.vehicleId}
                        onChange={(event) => setVehicleDraft((prev) => ({ ...prev, vehicleId: event.target.value }))}
                        placeholder="例: 001"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          list="manual-vehicle-type-suggestions"
                          value={vehicleDraft.vehicleTypeId}
                          onChange={(event) => setVehicleDraft((prev) => ({ ...prev, vehicleTypeId: event.target.value }))}
                          placeholder="type_id を入力"
                        />
                        <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="secondary" size="sm">
                              タイプを追加
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>車両タイプを追加</DialogTitle>
                              <DialogDescription>共通仕様をテンプレートとして登録します。</DialogDescription>
                            </DialogHeader>
                            <form className="space-y-3" onSubmit={handleSubmitType}>
                              <LabeledInput
                                id="type-id"
                                label="type_id（必須）"
                                value={typeDraft.typeId}
                                onChange={(value) => setTypeDraft((prev) => ({ ...prev, typeId: value }))}
                                placeholder="例: LARGE_A"
                              />
                              <LabeledInput
                                id="type-name"
                                label="名称"
                                value={typeDraft.name}
                                onChange={(value) => setTypeDraft((prev) => ({ ...prev, name: value }))}
                                placeholder="任意ラベル"
                              />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">車椅子対応</label>
                                  <Select
                                    value={typeDraft.wheelchairAccessible}
                                    onValueChange={(value: BooleanChoice) =>
                                      setTypeDraft((prev) => ({ ...prev, wheelchairAccessible: value }))
                                    }
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
                                    onValueChange={(value: BooleanChoice) =>
                                      setTypeDraft((prev) => ({ ...prev, lowFloor: value }))
                                    }
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
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <LabeledInput
                                  id="type-capacity-seated"
                                  label="座席数"
                                  value={typeDraft.capacitySeated}
                                  onChange={(value) => setTypeDraft((prev) => ({ ...prev, capacitySeated: value }))}
                                  type="number"
                                />
                                <LabeledInput
                                  id="type-capacity-total"
                                  label="総定員"
                                  value={typeDraft.capacityTotal}
                                  onChange={(value) => setTypeDraft((prev) => ({ ...prev, capacityTotal: value }))}
                                  type="number"
                                />
                              </div>
                              <LabeledInput
                                id="type-tags"
                                label="タグ（カンマ区切り）"
                                value={typeDraft.tags}
                                onChange={(value) => setTypeDraft((prev) => ({ ...prev, tags: value }))}
                                placeholder="例: 大型,ノンステップ"
                              />
                              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <DialogClose asChild>
                                  <Button type="button" variant="ghost">
                                    キャンセル
                                  </Button>
                                </DialogClose>
                                <Button type="submit">タイプを追加</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={vehicleDraft.depotId}
                        onChange={(event) => setVehicleDraft((prev) => ({ ...prev, depotId: event.target.value }))}
                        placeholder="所属車庫"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        value={vehicleDraft.seats}
                        onChange={(event) => setVehicleDraft((prev) => ({ ...prev, seats: event.target.value }))}
                        type="number"
                        placeholder="数値"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={vehicleDraft.wheelchairAccessible}
                        onValueChange={(value: BooleanChoice) =>
                          setVehicleDraft((prev) => ({ ...prev, wheelchairAccessible: value }))
                        }
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
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={vehicleDraft.lowFloor}
                        onValueChange={(value: BooleanChoice) =>
                          setVehicleDraft((prev) => ({ ...prev, lowFloor: value }))
                        }
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
                    </TableCell>
                    <TableCell>
                      <Input
                        value={vehicleDraft.notes}
                        onChange={(event) => setVehicleDraft((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="任意メモ"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" onClick={handleAddVehicleFromDraft}>
                        行を追加
                      </Button>
                    </TableCell>
                  </TableRow>

                  {filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.vehicleId}>
                      <TableCell>{vehicle.vehicleId}</TableCell>
                      <TableCell>{vehicle.vehicleTypeId}</TableCell>
                      <TableCell>{vehicle.depotId ?? '-'}</TableCell>
                      <TableCell className="text-right">{vehicle.seats ?? '-'}</TableCell>
                      <TableCell className="text-center">
                        {vehicle.wheelchairAccessible === undefined ? '-' : vehicle.wheelchairAccessible ? '1' : '0'}
                      </TableCell>
                      <TableCell className="text-center">
                        {vehicle.lowFloor === undefined ? '-' : vehicle.lowFloor ? '1' : '0'}
                      </TableCell>
                      <TableCell>{vehicle.notes ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" size="sm" onClick={() => onVehicleDelete(vehicle.vehicleId)}>
                          削除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredVehicles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        {typeFilter === ALL_TYPES_VALUE ? 'まだ車両がありません。CSV またはフォームから追加してください。' : `type_id=${typeFilter} の車両はまだ登録されていません。`}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              表示件数: {filteredVehicles.length} / 総登録 {vehicles.length}
              {typeFilter !== ALL_TYPES_VALUE ? `（type_id=${typeFilter}）` : ''}
            </p>
          </section>

          <aside className="lg:w-80 lg:flex-none">
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground">車両タイプ一覧</h3>
                  <p className="text-xs text-muted-foreground">タイプごとの登録台数を確認できます。</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setTypeDialogOpen(true)}>
                  追加
                </Button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {vehicleTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">まだタイプがありません。先に登録するか、車両行で新しい type_id を入力してください。</p>
                ) : (
                  vehicleTypes.map((type) => (
                    <div key={type.typeId} className="flex items-start justify-between gap-2 rounded border px-3 py-2">
                      <div className="space-y-1 text-xs">
                        <p className="text-sm font-semibold">{type.typeId}</p>
                        {type.name && <p className="text-muted-foreground">名称: {type.name}</p>}
                        <p className="text-muted-foreground">
                          車両数: {vehicleCountsByType.get(type.typeId) ?? 0}
                        </p>
                        {type.tags && <p className="text-muted-foreground">タグ: {type.tags}</p>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onTypeDelete(type.typeId)}>
                        削除
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </CardContent>

      <datalist id="manual-vehicle-type-suggestions">
        {vehicleTypeOptions.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
    </Card>
  );
}

function createTypeDraft(): VehicleTypeDraft {
  return {
    typeId: '',
    name: '',
    wheelchairAccessible: 'unset',
    lowFloor: 'unset',
    capacitySeated: '',
    capacityTotal: '',
    tags: '',
  };
}

function createVehicleDraft(defaultTypeId: string): VehicleDraft {
  return {
    vehicleId: '',
    vehicleTypeId: defaultTypeId,
    depotId: '',
    seats: '',
    wheelchairAccessible: 'unset',
    lowFloor: 'unset',
    notes: '',
  };
}

function safeBoolean(choice: BooleanChoice): boolean | undefined {
  if (choice === 'unset') {
    return undefined;
  }
  return choice === 'true';
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}
