/**
 * src/features/manual/ManualDataView.tsx
 * 連携設定・運転士・車庫・交代地点・回送ルールを管理する手動データ画面。
 * CSV 入出力とインライン編集をまとめ、GtfsImportProvider の状態を更新する。
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

import { downloadCsv } from '@/utils/downloadCsv';
import {
  csvToDeadheadRules,
  csvToDepots,
  csvToDrivers,
  csvToReliefPoints,
  deadheadRulesToCsv,
  depotsToCsv,
  driversToCsv,
  reliefPointsToCsv,
} from '@/services/manual/manualCsv';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { DeadheadRule, Depot, ManualDriver, ReliefPoint } from '@/types';

import { DepotsCard } from './components/DepotsCard';
import { DeadheadRulesCard } from './components/DeadheadRulesCard';
import { DriversCard } from './components/DriversCard';
import { LinkingSettingsCard } from './components/LinkingSettingsCard';
import { ReliefPointsCard } from './components/ReliefPointsCard';
import { readFileAsText } from './utils/file';

export default function ManualDataView(): JSX.Element {
  const { manual, setManual } = useGtfsImport();

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
        setManual((prev) => ({ ...prev, drivers }));
        toast.success(`運転士 CSV を読み込みました（${drivers.length} 件）。`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '運転士 CSV の読み込みに失敗しました。');
      }
    },
    [setManual],
  );

  const exportWithGuard = useCallback((label: string, rows: unknown[], builder: () => string, fileName: string) => {
    if (rows.length === 0) {
      toast.info(`${label} に出力できるデータがありません。`);
      return;
    }
    const content = builder();
    downloadCsv({ fileName, content });
    toast.success(`${label} をエクスポートしました。`);
  }, []);

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
      setManual((prev) => ({ ...prev, drivers: [...prev.drivers, trimmed] }));
      toast.success(`運転士 ${trimmed.driverId} を追加しました。`);
      return true;
    },
    [manual.drivers, setManual],
  );

  const handleDeleteDriver = useCallback(
    (driverId: string) => {
      setManual((prev) => ({ ...prev, drivers: prev.drivers.filter((driver) => driver.driverId !== driverId) }));
      toast.success(`運転士 ${driverId} を削除しました。`);
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
      <LinkingSettingsCard
        enabled={manual.linking.enabled}
        minTurnaroundMin={manual.linking.minTurnaroundMin}
        maxConnectRadiusM={manual.linking.maxConnectRadiusM}
        allowParentStation={manual.linking.allowParentStation}
        onChange={(partial) => setManual((prev) => ({ ...prev, linking: { ...prev.linking, ...partial } }))}
      />

      <DriversCard
        rows={manual.drivers}
        onAdd={handleAddDriver}
        onDelete={handleDeleteDriver}
        onImport={handleImportDrivers}
        onExport={() =>
          exportWithGuard('運転士', manual.drivers, () => driversToCsv(manual.drivers), 'manual-drivers.csv')
        }
      />

      <ReliefPointsCard
        rows={manual.reliefPoints}
        onAdd={handleAddRelief}
        onDelete={handleDeleteRelief}
        onImport={handleImportReliefPoints}
        onExport={() =>
          exportWithGuard('交代地点', manual.reliefPoints, () => reliefPointsToCsv(manual.reliefPoints), 'manual-relief_points.csv')
        }
      />

      <DepotsCard
        rows={manual.depots}
        onAdd={handleAddDepot}
        onDelete={handleDeleteDepot}
        onImport={handleImportDepots}
        onExport={() =>
          exportWithGuard('車庫', manual.depots, () => depotsToCsv(manual.depots), 'manual-depots.csv')
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
          )
        }
      />
    </div>
  );
}
