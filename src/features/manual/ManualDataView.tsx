/**
 * src/features/manual/ManualDataView.tsx
 * 運転士・車庫・交代地点・回送ルールを管理する手動データ画面。
 * CSV 入出力とインライン編集をまとめ、GtfsImportProvider の状態を更新する。
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

import { downloadCsv } from '@/utils/downloadCsv';
import {
  csvToDeadheadRules,
  csvToDepots,
  csvToDrivers,
  csvToLaborRules,
  csvToReliefPoints,
  deadheadRulesToCsv,
  depotsToCsv,
  driversToCsv,
  laborRulesToCsv,
  reliefPointsToCsv,
  csvToVehicleTypes,
  csvToVehicles,
  vehicleTypesToCsv,
  vehiclesToCsv,
} from '@/services/manual/manualCsv';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { DeadheadRule, Depot, LaborRule, ManualDriver, ManualVehicle, ManualVehicleType, ReliefPoint } from '@/types';
import { sanitizeDriverName, REDACTED_LABEL } from '@/services/privacy/redaction';

import { recordAuditEvent } from '@/services/audit/auditLog';
import { DepotsCard } from './components/DepotsCard';
import { DeadheadRulesCard } from './components/DeadheadRulesCard';
import { DriversCard } from './components/DriversCard';
import { LaborRulesCard, type LaborRuleDraft } from './components/LaborRulesCard';
import { ReliefPointsCard } from './components/ReliefPointsCard';
import { VehicleTypesCard } from './components/VehicleTypesCard';
import { VehiclesCard } from './components/VehiclesCard';
import { readFileAsText } from './utils/file';
import { useExportConfirmation } from '@/components/export/ExportConfirmationProvider';

export default function ManualDataView(): JSX.Element {
  const { manual, setManual } = useGtfsImport();
  const { requestConfirmation } = useExportConfirmation();

  const handleImportDepots = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const depots = csvToDepots(csv);
        setManual((prev) => ({ ...prev, depots }));
        toast.success('車庫 CSV を読み込みました。');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '車庫 CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const handleImportReliefPoints = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const reliefPoints = csvToReliefPoints(csv);
        setManual((prev) => ({ ...prev, reliefPoints }));
        toast.success('交代地点 CSV を読み込みました。');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '交代地点 CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const handleImportDeadheads = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const deadheadRules = csvToDeadheadRules(csv);
        setManual((prev) => ({ ...prev, deadheadRules }));
        toast.success('回送ルール CSV を読み込みました。');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '回送ルール CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const handleImportDrivers = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const drivers = csvToDrivers(csv);
        let redactedCount = 0;
        const sanitized = drivers.map((driver) => {
          const { value, redacted } = sanitizeDriverName(driver.name);
          if (redacted) {
            redactedCount += 1;
          }
          return { driverId: driver.driverId, name: value } satisfies ManualDriver;
        });
        setManual((prev) => ({ ...prev, drivers: sanitized }));
        toast.success(`運転士 CSV を読み込みました（${sanitized.length} 件）。`);
        if (redactedCount > 0) {
          toast.info(`名称は ${redactedCount} 件匿名化されました（${REDACTED_LABEL}）。`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '運転士 CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const handleImportLaborRules = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const laborRules = csvToLaborRules(csv);
        setManual((prev) => ({ ...prev, laborRules }));
        toast.success(`労務ルール CSV を読み込みました（${laborRules.length} 件）。`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '労務ルール CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const handleImportVehicleTypes = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const vehicleTypes = csvToVehicleTypes(csv);
        setManual((prev) => ({ ...prev, vehicleTypes }));
        toast.success(`車両タイプ CSV を読み込みました（${vehicleTypes.length} 件）。`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '車両タイプ CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const handleImportVehicles = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const vehicles = csvToVehicles(csv);
        setManual((prev) => ({ ...prev, vehicles }));
        toast.success(`車両 CSV を読み込みました（${vehicles.length} 件）。`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '車両 CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const exportWithGuard = useCallback((
    label: string,
    rows: unknown[],
    builder: () => string,
    fileName: string,
    entity: string,
    exportType: string,
  ) => {
    if (rows.length === 0) {
      toast.info(`${label} に出力できるデータがありません。`);
      return;
    }
    requestConfirmation({
      title: `${label} をエクスポートしますか？`,
      description: '手動入力データを外部に保存する前に件数を確認してください。',
      summary: {
        hardWarnings: 0,
        softWarnings: 0,
        unassigned: 0,
        metrics: [{ label: '対象件数', value: `${rows.length}` }],
      },
      context: { entity, exportType },
      onConfirm: async () => {
        const content = builder();
        downloadCsv({ fileName, content });
        recordAuditEvent({
          entity,
          fileName,
          rowCount: rows.length,
          format: 'csv',
        });
        toast.success(`${label} をエクスポートしました。`);
      },
    });
  }, [requestConfirmation]);

  const handleAddDriver = useCallback(
    (input: ManualDriver) => {
      const trimmed: ManualDriver = {
        driverId: input.driverId.trim(),
        name: input.name.trim(),
      };
      if (!trimmed.driverId) {
        toast.error('driver_id を入力してください。');
        return false;
      }
      if (manual.drivers.some((driver) => driver.driverId === trimmed.driverId)) {
        toast.error(`driver_id "${trimmed.driverId}" は既に登録されています。`);
        return false;
      }
      const sanitized = sanitizeDriverName(trimmed.name);
      setManual((prev) => ({ ...prev, drivers: [...prev.drivers, { driverId: trimmed.driverId, name: sanitized.value }] }));
      toast.success(`運転士 ${trimmed.driverId} を追加しました。`);
      if (sanitized.redacted) {
        toast.info(`名称は匿名化されました（${REDACTED_LABEL}）。`);
      }
      return true;
    },
    [manual.drivers, setManual],
  );

  const handleAddLaborRule = useCallback(
    (draft: LaborRuleDraft) => {
      const driverId = draft.driverId.trim();
      if (!driverId) {
        toast.error('driver_id を入力してください。');
        return false;
      }
      if (manual.laborRules.some((rule) => rule.driverId === driverId)) {
        toast.error(`driver_id "${driverId}" は既に登録されています。`);
        return false;
      }

      const parseNumber = (label: string, value: string): number | undefined => {
        const trimmed = value.trim();
        if (!trimmed) {
          return undefined;
        }
        const numeric = Number(trimmed);
        if (!Number.isFinite(numeric)) {
          toast.error(`${label} には数値を入力してください。`);
          throw new Error('invalid-number');
        }
        return numeric;
      };

      let maxContinuous: number | undefined;
      let minBreak: number | undefined;
      let maxDuty: number | undefined;
      let maxWork: number | undefined;

      try {
        maxContinuous = parseNumber('max_continuous_drive_min', draft.maxContinuousDriveMin);
        minBreak = parseNumber('min_break_min', draft.minBreakMin);
        maxDuty = parseNumber('max_duty_span_min', draft.maxDutySpanMin);
        maxWork = parseNumber('max_work_min', draft.maxWorkMin);
      } catch (error) {
        if (error instanceof Error && error.message === 'invalid-number') {
          return false;
        }
        throw error;
      }

      const qualifications = draft.qualifications
        .split('|')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      const payload: LaborRule = {
        driverId,
        maxContinuousDriveMin: maxContinuous,
        minBreakMin: minBreak,
        maxDutySpanMin: maxDuty,
        maxWorkMin: maxWork,
        nightWindowStart: draft.nightWindowStart.trim() || undefined,
        nightWindowEnd: draft.nightWindowEnd.trim() || undefined,
        qualifications: qualifications.length > 0 ? qualifications : undefined,
        affiliation: draft.affiliation.trim() || undefined,
      };

      setManual((prev) => ({ ...prev, laborRules: [...prev.laborRules, payload] }));
      toast.success(`労務ルール（${driverId}）を追加しました。`);
      return true;
    },
    [manual.laborRules, setManual],
  );

  const handleDeleteLaborRule = useCallback(
    (driverId: string) => {
      setManual((prev) => ({ ...prev, laborRules: prev.laborRules.filter((rule) => rule.driverId !== driverId) }));
      toast.success(`労務ルール ${driverId} を削除しました。`);
    },
    [setManual],
  );

  const handleDeleteDriver = useCallback(
    (driverId: string) => {
      setManual((prev) => ({ ...prev, drivers: prev.drivers.filter((driver) => driver.driverId !== driverId) }));
      toast.success(`運転士 ${driverId} を削除しました。`);
    },
    [setManual],
  );

  const handleAddVehicleType = useCallback(
    (input: ManualVehicleType) => {
      const typeId = input.typeId.trim();
      if (!typeId) {
        toast.error('type_id を入力してください。');
        return false;
      }
      if (manual.vehicleTypes.some((type) => type.typeId === typeId)) {
        toast.error(`type_id "${typeId}" は既に登録されています。`);
        return false;
      }
      setManual((prev) => ({ ...prev, vehicleTypes: [...prev.vehicleTypes, { ...input, typeId }] }));
      toast.success(`車両タイプ ${typeId} を追加しました。`);
      return true;
    },
    [manual.vehicleTypes, setManual],
  );

  const handleDeleteVehicleType = useCallback(
    (typeId: string) => {
      if (manual.vehicles.some((vehicle) => vehicle.vehicleTypeId === typeId)) {
        toast.error(`車両タイプ ${typeId} は車両が参照しているため削除できません。`);
        return;
      }
      setManual((prev) => ({ ...prev, vehicleTypes: prev.vehicleTypes.filter((entry) => entry.typeId !== typeId) }));
      toast.success(`車両タイプ ${typeId} を削除しました。`);
    },
    [manual.vehicles, setManual],
  );

  const handleAddVehicle = useCallback(
    (input: ManualVehicle) => {
      const vehicleId = input.vehicleId.trim();
      const vehicleTypeId = input.vehicleTypeId.trim();
      if (!vehicleId) {
        toast.error('vehicle_id を入力してください。');
        return false;
      }
      if (!vehicleTypeId) {
        toast.error('vehicle_type を選択してください。');
        return false;
      }
      if (manual.vehicles.some((vehicle) => vehicle.vehicleId === vehicleId)) {
        toast.error(`vehicle_id "${vehicleId}" は既に登録されています。`);
        return false;
      }
      if (!manual.vehicleTypes.some((type) => type.typeId === vehicleTypeId)) {
        toast.error(`vehicle_type "${vehicleTypeId}" が存在しません。先に車両タイプを登録してください。`);
        return false;
      }
      setManual((prev) => ({
        ...prev,
        vehicles: [
          ...prev.vehicles,
          {
            ...input,
            vehicleId,
            vehicleTypeId,
          },
        ],
      }));
      toast.success(`車両 ${vehicleId} を追加しました。`);
      return true;
    },
    [manual.vehicleTypes, manual.vehicles, setManual],
  );

  const handleDeleteVehicle = useCallback(
    (vehicleId: string) => {
      setManual((prev) => ({ ...prev, vehicles: prev.vehicles.filter((vehicle) => vehicle.vehicleId !== vehicleId) }));
      toast.success(`車両 ${vehicleId} を削除しました。`);
    },
    [setManual],
  );

  const handleAddRelief = useCallback(
    (relief: ReliefPoint) => {
      setManual((prev) => ({ ...prev, reliefPoints: [...prev.reliefPoints, relief] }));
      toast.success(`交代地点 ${relief.reliefId} を追加しました。`);
    },
    [setManual],
  );

  const handleDeleteRelief = useCallback(
    (reliefId: string) => {
      setManual((prev) => ({ ...prev, reliefPoints: prev.reliefPoints.filter((point) => point.reliefId !== reliefId) }));
      toast.success(`交代地点 ${reliefId} を削除しました。`);
    },
    [setManual],
  );

  const handleAddDepot = useCallback(
    (depot: Depot) => {
      setManual((prev) => ({ ...prev, depots: [...prev.depots, depot] }));
      toast.success(`車庫 ${depot.depotId} を追加しました。`);
    },
    [setManual],
  );

  const handleDeleteDepot = useCallback(
    (depotId: string) => {
      setManual((prev) => ({ ...prev, depots: prev.depots.filter((depot) => depot.depotId !== depotId) }));
      toast.success(`車庫 ${depotId} を削除しました。`);
    },
    [setManual],
  );

  const handleAddDeadhead = useCallback(
    (rule: DeadheadRule) => {
      setManual((prev) => ({ ...prev, deadheadRules: [...prev.deadheadRules, rule] }));
      toast.success('回送ルールを追加しました。');
    },
    [setManual],
  );

  const handleDeleteDeadhead = useCallback(
    (index: number) => {
      setManual((prev) => ({ ...prev, deadheadRules: prev.deadheadRules.filter((_, i) => i !== index) }));
      toast.success('回送ルールを削除しました。');
    },
    [setManual],
  );

  return (
    <div className="space-y-6">
      <VehicleTypesCard
        rows={manual.vehicleTypes}
        onAdd={handleAddVehicleType}
        onDelete={handleDeleteVehicleType}
        onImport={handleImportVehicleTypes}
        onExport={() =>
          exportWithGuard(
            '車両タイプ',
            manual.vehicleTypes,
            () => vehicleTypesToCsv(manual.vehicleTypes),
            'manual-vehicle_types.csv',
            'manual.vehicleTypes',
            'manual.vehicleTypes.csv',
          )
        }
      />

      <VehiclesCard
        rows={manual.vehicles}
        vehicleTypes={manual.vehicleTypes}
        onAdd={handleAddVehicle}
        onDelete={handleDeleteVehicle}
        onImport={handleImportVehicles}
        onExport={() =>
          exportWithGuard('車両', manual.vehicles, () => vehiclesToCsv(manual.vehicles), 'manual-vehicles.csv', 'manual.vehicles', 'manual.vehicles.csv')
        }
      />

      <DriversCard
        rows={manual.drivers}
        onAdd={handleAddDriver}
        onDelete={handleDeleteDriver}
        onImport={handleImportDrivers}
        onExport={() =>
          exportWithGuard('運転士', manual.drivers, () => driversToCsv(manual.drivers), 'manual-drivers.csv', 'manual.drivers', 'manual.drivers.csv')
        }
      />

      <LaborRulesCard
        rows={manual.laborRules}
        onAdd={handleAddLaborRule}
        onDelete={handleDeleteLaborRule}
        onImport={handleImportLaborRules}
        onExport={() =>
          exportWithGuard(
            '労務ルール',
            manual.laborRules,
            () => laborRulesToCsv(manual.laborRules),
            'manual-labor_rules.csv',
            'manual.laborRules',
            'manual.laborRules.csv',
          )
        }
      />

      <ReliefPointsCard
        rows={manual.reliefPoints}
        onAdd={handleAddRelief}
        onDelete={handleDeleteRelief}
        onImport={handleImportReliefPoints}
        onExport={() =>
          exportWithGuard('交代地点', manual.reliefPoints, () => reliefPointsToCsv(manual.reliefPoints), 'manual-relief_points.csv', 'manual.reliefPoints', 'manual.reliefPoints.csv')
        }
      />

      <DepotsCard
        rows={manual.depots}
        onAdd={handleAddDepot}
        onDelete={handleDeleteDepot}
        onImport={handleImportDepots}
        onExport={() =>
          exportWithGuard('車庫', manual.depots, () => depotsToCsv(manual.depots), 'manual-depots.csv', 'manual.depots', 'manual.depots.csv')
        }
      />

      <DeadheadRulesCard
        rows={manual.deadheadRules}
        onAdd={handleAddDeadhead}
        onDelete={handleDeleteDeadhead}
        onImport={handleImportDeadheads}
        onExport={() =>
          exportWithGuard(
            '回送ルール',
            manual.deadheadRules,
            () => deadheadRulesToCsv(manual.deadheadRules),
            'manual-deadhead_rules.csv',
            'manual.deadheadRules',
            'manual.deadheadRules.csv',
          )
        }
      />
    </div>
  );
}
