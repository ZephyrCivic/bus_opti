/**
 * src/features/explorer/ExplorerView.tsx
 * Explorer のマップ表示・サービスフィルタ・手動オーバーレイの可視化を司るコンテナ。
 * GTFSインポート結果とマニュアル入力をまとめ、MapView へ渡すデータセットを構築する。
 */
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';

import MapView, { type ExplorerMapSelection } from './MapView';
import {
  buildExplorerDataset,
  type ExplorerDataset,
  type ExplorerServiceOption,
  type ExplorerManualOverlay,
} from './mapData';

const ALL_SERVICES_VALUE = 'all';

export default function ExplorerView(): JSX.Element {
  const { result, manual, dutyState } = useGtfsImport();
  const [serviceValue, setServiceValue] = useState<string>(ALL_SERVICES_VALUE);
  const [selection, setSelection] = useState<ExplorerMapSelection | null>(null);
  const [showDepots, setShowDepots] = useState(true);
  const [showReliefPoints, setShowReliefPoints] = useState(true);

  const dataset = useMemo(() => {
    const filter = serviceValue === ALL_SERVICES_VALUE ? undefined : { serviceId: serviceValue };
    return buildExplorerDataset(result, {
      filter,
      manual,
      duties: dutyState.duties,
    });
  }, [result, manual, dutyState.duties, serviceValue]);

  useEffect(() => {
    if (serviceValue === ALL_SERVICES_VALUE) {
      return;
    }
    if (!dataset.services.some((service) => service.serviceId === serviceValue)) {
      setServiceValue(ALL_SERVICES_VALUE);
    }
  }, [dataset.services, serviceValue]);

  useEffect(() => {
    setSelection(null);
  }, [serviceValue, result]);

  const activeServiceOption = dataset.services.find((service) => service.serviceId === dataset.selectedServiceId);
  const serviceLabel =
    serviceValue === ALL_SERVICES_VALUE ? '全サービス' : activeServiceOption?.label ?? `サービス ${serviceValue}`;
  const disableSelect = dataset.services.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Explorer</h2>
        <p className="text-sm text-muted-foreground">
          GTFS 由来の停留所・経路とマニュアルオーバーレイ（デポ・交代地点）を地図上で確認します。
          サービスフィルタで対象日を絞り込み、選択パネルで詳細を参照してください。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="block text-xs font-medium text-muted-foreground">サービスフィルタ</span>
          <Select value={serviceValue} onValueChange={setServiceValue} disabled={disableSelect}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="サービスを選択">{serviceLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SERVICES_VALUE}>全サービス</SelectItem>
              {dataset.services.map((service) => (
                <SelectItem key={service.serviceId} value={service.serviceId}>
                  {formatServiceOptionLabel(service)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {activeServiceOption && (
          <Badge variant="secondary" className="h-6">
            Trip {activeServiceOption.tripCount.toLocaleString()} / Stop {activeServiceOption.stopCount.toLocaleString()}
          </Badge>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">手動オーバーレイ</span>
          <Button
            size="sm"
            variant={showDepots ? 'default' : 'outline'}
            onClick={() => setShowDepots((prev) => !prev)}
          >
            Depots
          </Button>
          <Button
            size="sm"
            variant={showReliefPoints ? 'default' : 'outline'}
            onClick={() => setShowReliefPoints((prev) => !prev)}
          >
            Relief points
          </Button>
        </div>
      </div>

      <MapView dataset={dataset} onSelect={setSelection} showDepots={showDepots} showReliefPoints={showReliefPoints} />

      <ManualSummaryCard overlay={dataset.manualOverlay} summary={dataset.manualSummary} />

      <SelectionPanel dataset={dataset} selection={selection} serviceLabel={serviceLabel} />
    </div>
  );
}

interface ManualSummaryCardProps {
  overlay: ExplorerManualOverlay;
  summary: ExplorerDataset['manualSummary'];
}

function ManualSummaryCard({ overlay, summary }: ManualSummaryCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>マニュアルオーバーレイ概要</CardTitle>
        <CardDescription>デポ / 交代地点と duty 影響件数のサマリです。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
        <InfoRow label="デポ数" value={summary.depotCount.toLocaleString()} />
        <InfoRow label="交代地点数" value={summary.reliefPointCount.toLocaleString()} />
        <InfoRow
          label="Duty 影響件数"
          value={(summary.totalDutyImpacts ?? 0).toLocaleString()}
        />
        {overlay.depots.features.length === 0 && overlay.reliefPoints.features.length === 0 && (
          <p className="sm:col-span-3 text-muted-foreground">
            マニュアル入力が未登録です。Manual タブからデポや交代地点を追加すると表示されます。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface SelectionPanelProps {
  dataset: ExplorerDataset;
  selection: ExplorerMapSelection | null;
  serviceLabel: string;
}

function SelectionPanel({ dataset, selection, serviceLabel }: SelectionPanelProps): JSX.Element {
  if (!selection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>選択詳細</CardTitle>
          <CardDescription>地図上の停留所 / 経路 / オーバーレイをクリックすると詳細を表示します。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {dataset.geoJson.stops.features.length === 0
              ? 'GTFSフィードをインポートすると Explorer にデータが表示されます。'
              : '対象を選択してください。'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selection.type === 'manualDepot') {
    const depot = dataset.manualOverlay.depots.features.find(
      (feature) => feature.properties?.depotId === selection.id,
    );
    if (!depot) {
      return fallbackCard('デポ情報を取得できませんでした。入力内容を確認してください。');
    }
    const properties = depot.properties ?? {};
    const coordinates = depot.geometry.coordinates as [number, number];
    return (
      <Card>
        <CardHeader>
          <CardTitle>デポ {properties.depotId ?? selection.id}</CardTitle>
          <CardDescription>Duty 影響件数: {(properties.dutyImpactCount ?? 0).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {properties.name && <InfoRow label="名称" value={String(properties.name)} />}
          <InfoRow label="座標" value={`${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`} />
        </CardContent>
      </Card>
    );
  }

  if (selection.type === 'manualRelief') {
    const relief = dataset.manualOverlay.reliefPoints.features.find(
      (feature) => feature.properties?.reliefId === selection.id,
    );
    if (!relief) {
      return fallbackCard('交代地点情報を取得できませんでした。入力内容を確認してください。');
    }
    const properties = relief.properties ?? {};
    const coordinates = relief.geometry.coordinates as [number, number];
    return (
      <Card>
        <CardHeader>
          <CardTitle>交代地点 {properties.reliefId ?? selection.id}</CardTitle>
          <CardDescription>Duty 影響件数: {(properties.dutyImpactCount ?? 0).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {properties.name && <InfoRow label="名称" value={String(properties.name)} />}
          {properties.stopId && <InfoRow label="停留所ID" value={String(properties.stopId)} />}
          <InfoRow label="座標" value={`${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`} />
        </CardContent>
      </Card>
    );
  }

  if (selection.type === 'stop') {
    const detail = dataset.stopDetails[selection.id];
    if (!detail) {
      return fallbackCard('停留所情報を取得できませんでした。フィルタを変更して再試行してください。');
    }

    const activeTripCount = dataset.selectedServiceId ? detail.activeTripCount : detail.totalTripCount;

    return (
      <Card>
        <CardHeader>
          <CardTitle>停留所 {detail.stopId}</CardTitle>
          <CardDescription>{serviceLabel} のTrip数: {activeTripCount.toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {detail.name && <InfoRow label="名称" value={detail.name} />}
          {detail.code && <InfoRow label="コード" value={detail.code} />}
          <InfoRow label="座標" value={`${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`} />
          <InfoRow label="総Trip数" value={detail.totalTripCount.toLocaleString()} />
          {dataset.selectedServiceId && (
            <InfoRow label="フィルタ適用時Trip数" value={detail.activeTripCount.toLocaleString()} />
          )}
          {detail.serviceIds.length > 0 && (
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">関連サービス</span>
              <div className="flex flex-wrap gap-2">
                {detail.serviceIds.map((serviceId) => (
                  <Badge
                    key={serviceId}
                    variant={serviceId === dataset.selectedServiceId ? 'default' : 'outline'}
                  >
                    {serviceId}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const detail = dataset.shapeDetails[selection.id];
  if (!detail) {
    return fallbackCard('形状情報を取得できませんでした。フィルタを変更して再試行してください。');
  }

  const activeTripCount = dataset.selectedServiceId ? detail.activeTripCount : detail.tripCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>経路形状 {detail.shapeId}</CardTitle>
        <CardDescription>{serviceLabel} のTrip数: {activeTripCount.toLocaleString()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <InfoRow label="総Trip数" value={detail.tripCount.toLocaleString()} />
        {dataset.selectedServiceId && (
          <InfoRow label="フィルタ適用時Trip数" value={detail.activeTripCount.toLocaleString()} />
        )}
        {detail.serviceIds.length > 0 && (
          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">関連サービス</span>
            <div className="flex flex-wrap gap-2">
              {detail.serviceIds.map((serviceId) => (
                <Badge
                  key={serviceId}
                  variant={serviceId === dataset.selectedServiceId ? 'default' : 'outline'}
                >
                  {serviceId}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function fallbackCard(message: string): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>詳細情報</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function formatServiceOptionLabel(option: ExplorerServiceOption): string {
  return `${option.label} · Trips ${option.tripCount.toLocaleString()} / Stops ${option.stopCount.toLocaleString()}`;
}
