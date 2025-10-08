/**
 * src/features/duties/components/InspectorCard.tsx
 * Groups KPI metrics, quick stats, and selected segment details for the Duty inspector pane.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { Duty, DutySegment, ManualDriver } from '@/types';
import type { DutyMetrics } from '@/services/duty/dutyMetrics';
import { formatMinutes } from '@/services/duty/dutyMetrics';

interface InspectorCardProps {
  defaultDriverId: string;
  onDefaultDriverChange: (value: string) => void;
  dutyCount: number;
  segmentCount: number;
  driverCount: number;
  selectedDuty: Duty | null;
  selectedSegment: { dutyId: string; segmentId: string } | null;
  selectedSegmentDetail: DutySegment | null;
  selectedMetrics?: DutyMetrics;
  onAutoCorrect: () => void;
  driverOptions: ManualDriver[];
}

export function InspectorCard(props: InspectorCardProps): JSX.Element {
  const {
    defaultDriverId,
    onDefaultDriverChange,
    dutyCount,
    segmentCount,
    driverCount,
    selectedDuty,
    selectedSegment,
    selectedSegmentDetail,
    selectedMetrics,
    onAutoCorrect,
    driverOptions,
  } = props;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>乗務の状況</CardTitle>
        <CardDescription>選択した乗務の情報と注意点を確認できます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="default-driver">
            運転士ID（新規追加時に自動適用）
          </label>
          <Input
            id="default-driver"
            value={defaultDriverId}
            onChange={(event) => onDefaultDriverChange(event.target.value)}
            placeholder="DRIVER_001"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">運転士候補から選択</span>
          {driverOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {driverOptions.map((driver) => {
                const active = driver.driverId === defaultDriverId;
                const label = driver.name ? `${driver.driverId}（${driver.name}）` : driver.driverId;
                return (
                  <Button
                    key={driver.driverId}
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onDefaultDriverChange(driver.driverId)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Drivers CSV を読み込むと候補が表示されます。</p>
          )}
        </div>
        <QuickStats dutyCount={dutyCount} segmentCount={segmentCount} driverCount={driverCount} />
        {selectedDuty ? (
          <DutyMetricsPanel metrics={selectedMetrics} onAutoCorrect={onAutoCorrect} />
        ) : (
          <p className="text-sm text-muted-foreground">乗務を選ぶと、安全チェック結果が表示されます。</p>
        )}
        {selectedSegmentDetail ? (
          <SegmentDetails selection={selectedSegment} segment={selectedSegmentDetail} />
        ) : (
          <p className="text-sm text-muted-foreground">区間を選ぶと、詳細がここに表示されます。</p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickStats({
  dutyCount,
  segmentCount,
  driverCount,
}: {
  dutyCount: number;
  segmentCount: number;
  driverCount: number;
}): JSX.Element {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">乗務件数</span>
        <span>{dutyCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">区間数</span>
        <span>{segmentCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">運転士人数</span>
        <span>{driverCount}</span>
      </div>
    </div>
  );
}

function DutyMetricsPanel({ metrics, onAutoCorrect }: { metrics: DutyMetrics | undefined; onAutoCorrect: () => void }): JSX.Element {
  if (!metrics) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <h4 className="font-semibold">乗務チェック項目</h4>
        <p className="text-xs text-muted-foreground">乗務を選ぶと、拘束時間などの結果が表示されます。</p>
      </div>
    );
  }

  const warningMessages: string[] = [];
  if (metrics.warnings.exceedsContinuous) {
    warningMessages.push('連続運転時間が上限を超えています。');
  }
  if (metrics.warnings.exceedsDailySpan) {
    warningMessages.push('一日の拘束時間が上限を超えています。');
  }
  if (metrics.warnings.insufficientBreak && metrics.shortestBreakMinutes !== null) {
    warningMessages.push('休憩時間が規定より短い区間があります。');
  }

  const showWarnings = metrics.warnings.exceedsContinuous || metrics.warnings.exceedsDailySpan || metrics.warnings.insufficientBreak;

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      {showWarnings ? (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={onAutoCorrect}>
            自動調整
          </Button>
        </div>
      ) : null}
      <h4 className="font-semibold">乗務チェック項目</h4>
      <MetricRow label="連続運転（最長）" value={formatMinutes(metrics.longestContinuousMinutes)} warn={metrics.warnings.exceedsContinuous} />
      <MetricRow label="乗務時間（総計）" value={formatMinutes(metrics.totalSpanMinutes)} warn={metrics.warnings.exceedsDailySpan} />
      <MetricRow
        label="休憩時間（最短）"
        value={metrics.shortestBreakMinutes === null ? '未計測' : formatMinutes(metrics.shortestBreakMinutes)}
        warn={metrics.warnings.insufficientBreak}
      />
      {warningMessages.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {warningMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">規定範囲内です。</p>
      )}
    </div>
  );
}

function MetricRow({ label, value, warn }: { label: string; value: string; warn?: boolean }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant={warn ? 'destructive' : 'outline'}>{value}</Badge>
    </div>
  );
}

function SegmentDetails({
  selection,
  segment,
}: {
  selection: { dutyId: string; segmentId: string } | null;
  segment: DutySegment;
}): JSX.Element {
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <h4 className="font-semibold">選択中の区間</h4>
      <DetailRow label="乗務ID" value={selection?.dutyId ?? '-'} />
      <DetailRow label="区間ID" value={segment.id} />
      <DetailRow label="ブロックID" value={segment.blockId} />
      <DetailRow label="Trip区間" value={`${segment.startTripId} → ${segment.endTripId}`} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
