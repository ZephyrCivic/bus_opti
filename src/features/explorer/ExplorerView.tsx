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
  CardFooter,
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';

import MapView, { type ExplorerMapSelection } from './MapView';
import {
  buildExplorerDataset,
  type ExplorerDataset,
  type ExplorerServiceOption,
  type ExplorerManualOverlay,
  type ExplorerRouteOption,
  type ExplorerRouteDetail,
  type ExplorerRouteDirectionDetail,
  type ExplorerTimelineTrip,
} from './mapData';

const ALL_SERVICES_VALUE = 'all';

export default function ExplorerView(): JSX.Element {
  const { result, manual, dutyState } = useGtfsImport();
  const [serviceValue, setServiceValue] = useState<string>(ALL_SERVICES_VALUE);
  const [selection, setSelection] = useState<ExplorerMapSelection | null>(null);
  const [showDepots, setShowDepots] = useState(true);
  const [showReliefPoints, setShowReliefPoints] = useState(true);
  const [routeSearch, setRouteSearch] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(undefined);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string>('all');

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

  const filteredRouteOptions = useMemo(() => {
    if (routeSearch.trim().length === 0) {
      return dataset.routeOptions;
    }
    const keyword = routeSearch.trim().toLowerCase();
    return dataset.routeOptions.filter((option) => {
      const haystack = [option.routeId, option.label, option.shortName, option.longName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [dataset.routeOptions, routeSearch]);

  useEffect(() => {
    if (dataset.routeOptions.length === 0) {
      setSelectedRouteId(undefined);
      return;
    }
    setSelectedRouteId((previous) => {
      if (previous && dataset.routeOptions.some((option) => option.routeId === previous)) {
        return previous;
      }
      return dataset.routeOptions[0]?.routeId;
    });
  }, [dataset.routeOptions]);

  useEffect(() => {
    if (filteredRouteOptions.length === 0) {
      return;
    }
    setSelectedRouteId((previous) => {
      if (previous && filteredRouteOptions.some((option) => option.routeId === previous)) {
        return previous;
      }
      return filteredRouteOptions[0]?.routeId;
    });
  }, [filteredRouteOptions]);

  useEffect(() => {
    if (!selectedRouteId) {
      setSelectedDirectionId('all');
      return;
    }
    const route = dataset.routes[selectedRouteId];
    if (!route) {
      setSelectedDirectionId('all');
      return;
    }
    const availableDirectionIds = Object.keys(route.directions);
    setSelectedDirectionId((previous) => {
      if (previous === 'all') {
        return previous;
      }
      return availableDirectionIds.includes(previous) ? previous : (availableDirectionIds[0] ?? 'all');
    });
  }, [selectedRouteId, dataset.routes]);

  const selectedRoute = selectedRouteId ? dataset.routes[selectedRouteId] : undefined;

  const directionOptions = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }
    return Object.keys(selectedRoute.directions).sort((a, b) => a.localeCompare(b, 'ja-JP-u-nu-latn'));
  }, [selectedRoute]);

  const timelineSections = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }
    if (selectedDirectionId !== 'all') {
      const detail = selectedRoute.directions[selectedDirectionId];
      return detail ? [{
        directionId: selectedDirectionId,
        label: buildDirectionLabel(selectedDirectionId, detail),
        detail,
      }] : [];
    }
    return Object.entries(selectedRoute.directions)
      .sort((a, b) => a[0].localeCompare(b[0], 'ja-JP-u-nu-latn'))
      .map(([directionId, detail]) => ({
        directionId,
        label: buildDirectionLabel(directionId, detail),
        detail,
      }));
  }, [selectedRoute, selectedDirectionId]);

  const alertCount = dataset.alerts.length;

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <MapView dataset={dataset} onSelect={setSelection} showDepots={showDepots} showReliefPoints={showReliefPoints} />
          <ManualSummaryCard overlay={dataset.manualOverlay} summary={dataset.manualSummary} />
        </div>
        <div className="space-y-4">
          <RouteTimelinePanel
            routeOptions={dataset.routeOptions}
            filteredRouteOptions={filteredRouteOptions}
            routeSearch={routeSearch}
            onRouteSearchChange={(value) => setRouteSearch(value)}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(routeId) => setSelectedRouteId(routeId)}
            directionOptions={directionOptions}
            selectedDirectionId={selectedDirectionId}
            onSelectDirection={(directionId) => setSelectedDirectionId(directionId)}
            timelineSections={timelineSections}
            routeDetail={selectedRoute}
            alertCount={alertCount}
          />
          <SelectionPanel dataset={dataset} selection={selection} serviceLabel={serviceLabel} />
        </div>
      </div>
    </div>
  );
}

interface TimelineSection {
  directionId: string;
  label: string;
  detail: ExplorerRouteDirectionDetail;
}

interface RouteTimelinePanelProps {
  routeOptions: ExplorerRouteOption[];
  filteredRouteOptions: ExplorerRouteOption[];
  routeSearch: string;
  onRouteSearchChange: (value: string) => void;
  selectedRouteId?: string;
  onSelectRoute: (routeId: string) => void;
  directionOptions: string[];
  selectedDirectionId: string;
  onSelectDirection: (directionId: string) => void;
  timelineSections: TimelineSection[];
  routeDetail?: ExplorerRouteDetail;
  alertCount: number;
}

function RouteTimelinePanel({
  routeOptions,
  filteredRouteOptions,
  routeSearch,
  onRouteSearchChange,
  selectedRouteId,
  onSelectRoute,
  directionOptions,
  selectedDirectionId,
  onSelectDirection,
  timelineSections,
  routeDetail,
  alertCount,
}: RouteTimelinePanelProps): JSX.Element {
  const hasRoutes = routeOptions.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Route Timeline</CardTitle>
        <CardDescription>ルート別に便の時系列を確認します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            value={routeSearch}
            onChange={(event) => onRouteSearchChange(event.target.value)}
            placeholder="ルートID / 名称で検索"
          />
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
            {filteredRouteOptions.map((option) => {
              const isSelected = option.routeId === selectedRouteId;
              const style = option.color ? { borderColor: option.color } : undefined;
              return (
                <Button
                  key={option.routeId}
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onSelectRoute(option.routeId)}
                  className="whitespace-nowrap"
                  style={style}
                >
                  {option.label}
                </Button>
              );
            })}
            {filteredRouteOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">該当するルートが見つかりません。</p>
            )}
          </div>
        </div>
        {!hasRoutes ? (
          <p className="text-sm text-muted-foreground">
            GTFS をインポートするとルートタイムラインが表示されます。
          </p>
        ) : !selectedRouteId || !routeDetail ? (
          <p className="text-sm text-muted-foreground">ルートを選択するとタイムラインを表示します。</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">方向</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedDirectionId === 'all' ? 'default' : 'outline'}
                  onClick={() => onSelectDirection('all')}
                >
                  All
                </Button>
                {directionOptions.map((directionId) => (
                  <Button
                    key={directionId}
                    size="sm"
                    variant={selectedDirectionId === directionId ? 'default' : 'outline'}
                    onClick={() => onSelectDirection(directionId)}
                  >
                    {directionId}
                  </Button>
                ))}
              </div>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {timelineSections.length === 0 ? (
                <p className="text-xs text-muted-foreground">選択した条件に一致する便がありません。</p>
              ) : (
                timelineSections.map((section) => (
                  <div key={section.directionId} className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">{section.label}</div>
                    <div className="space-y-2">
                      {section.detail.trips.map((trip) => (
                        <div
                          key={trip.tripId}
                          className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-semibold text-foreground">{trip.tripId}</div>
                            {trip.headsign && (
                              <div className="text-xs text-muted-foreground">{trip.headsign}</div>
                            )}
                            {trip.serviceId && (
                              <div className="text-xs text-muted-foreground">Service: {trip.serviceId}</div>
                            )}
                          </div>
                          <div className="space-y-1 text-right text-xs text-muted-foreground">
                            <div className="font-medium text-foreground">{formatTripRange(trip)}</div>
                            <div>停留所 {trip.stopCount}</div>
                            {typeof trip.durationMinutes === 'number' && (
                              <div>所要 {trip.durationMinutes} 分</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>選択ルート: {selectedRouteId ?? '-'}</span>
        <span>便数: {routeDetail?.tripCount ?? 0}</span>
        <span>停留所数: {routeDetail?.stopCount ?? 0}</span>
        <span>アラート: {alertCount}</span>
      </CardFooter>
    </Card>
  );
}

function formatTripRange(trip: ExplorerTimelineTrip): string {
  const start = trip.startTime;
  const end = trip.endTime;
  if (start && end) {
    return `${start}──${end}`;
  }
  if (start) {
    return `${start}──?`;
  }
  if (end) {
    return `?──${end}`;
  }
  return '時間情報なし';
}

function buildDirectionLabel(directionId: string, detail: ExplorerRouteDirectionDetail): string {
  const headsign = detail.headsigns[0];
  const range =
    detail.earliestDeparture && detail.latestArrival
      ? `（${detail.earliestDeparture}〜${detail.latestArrival}）`
      : '';
  return headsign ? `方向 ${directionId} · ${headsign}${range}` : `方向 ${directionId}${range}`;
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
