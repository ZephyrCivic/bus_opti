/**
 * src/features/explorer/ExplorerView.tsx
 * Wraps MapView with service filters and selection panel for Stops/Shapes overlays.
 */
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import MapView, { type ExplorerMapSelection } from './MapView';
import {
  buildExplorerDataset,
  type ExplorerDataset,
  type ExplorerServiceOption,
} from './mapData';
import { useGtfsImport } from '../../services/import/GtfsImportProvider';

const ALL_SERVICES_VALUE = 'all';

export default function ExplorerView(): JSX.Element {
  const { result } = useGtfsImport();
  const [serviceValue, setServiceValue] = useState<string>(ALL_SERVICES_VALUE);
  const dataset = useMemo(() => {
    return buildExplorerDataset(result, serviceValue === ALL_SERVICES_VALUE ? undefined : { serviceId: serviceValue });
  }, [result, serviceValue]);
  const [selection, setSelection] = useState<ExplorerMapSelection | null>(null);

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
  const serviceLabel = serviceValue === ALL_SERVICES_VALUE
    ? '全サービス'
    : activeServiceOption?.label ?? `サービス ${serviceValue}`;
  const disableSelect = dataset.services.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Explorer</h2>
        <p className="text-sm text-muted-foreground">
          GTFSから読み込んだ停留所と経路をMapLibreで表示します。サービスIDフィルタと選択パネルで日次構成と個別情報を確認できます。
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
      </div>

      <MapView dataset={dataset} onSelect={setSelection} />

      <SelectionPanel dataset={dataset} selection={selection} serviceLabel={serviceLabel} />
    </div>
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
          <CardDescription>地図上の停留所または経路をクリックすると詳細を表示します。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {dataset.geoJson.stops.features.length === 0
              ? 'GTFSフィードをインポートするとExplorerにデータが表示されます。'
              : '対象を選択してください。'}
          </p>
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
    <div className="flex justify-between gap-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground/90">{value}</span>
    </div>
  );
}

function fallbackCard(message: string): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>選択詳細</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function formatServiceOptionLabel(service: ExplorerServiceOption): string {
  return `${service.label} (Trip ${service.tripCount.toLocaleString()} / Stop ${service.stopCount.toLocaleString()})`;
}
