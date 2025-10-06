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

import type { Duty, DutySegment } from '@/types';
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
  } = props;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Inspector</CardTitle>
        <CardDescription>Duty/KPIの概要を確認できます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="default-driver">
            driver_id (追加時に適用)
          </label>
          <Input
            id="default-driver"
            value={defaultDriverId}
            onChange={(event) => onDefaultDriverChange(event.target.value)}
            placeholder="DRIVER_001"
          />
        </div>
        <QuickStats dutyCount={dutyCount} segmentCount={segmentCount} driverCount={driverCount} />
        {selectedDuty ? (
          <DutyMetricsPanel metrics={selectedMetrics} onAutoCorrect={onAutoCorrect} />
        ) : (
          <p className="text-sm text-muted-foreground">Dutyを選択するとKPIを表示します。</p>
        )}
        {selectedSegmentDetail ? (
          <SegmentDetails selection={selectedSegment} segment={selectedSegmentDetail} />
        ) : (
          <p className="text-sm text-muted-foreground">セグメントを選択すると詳細を表示します。</p>
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
        <span className="text-muted-foreground">Duty数</span>
        <span>{dutyCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Segment数</span>
        <span>{segmentCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Drivers</span>
        <span>{driverCount}</span>
      </div>
    </div>
  );
}

function DutyMetricsPanel({ metrics, onAutoCorrect }: { metrics: DutyMetrics | undefined; onAutoCorrect: () => void }): JSX.Element {
  if (!metrics) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <h4 className="font-semibold">Duty KPI</h4>
        <p className="text-xs text-muted-foreground">Dutyを選択するとKPIを表示します。</p>
      </div>
    );
  }

  const warningMessages: string[] = [];
  if (metrics.warnings.exceedsContinuous) {
    warningMessages.push('連続運転時間が設定値を超えています。');
  }
  if (metrics.warnings.exceedsDailySpan) {
    warningMessages.push('1日の拘束時間が設定値を超えています。');
  }
  if (metrics.warnings.insufficientBreak && metrics.shortestBreakMinutes !== null) {
    warningMessages.push('休憩が最小設定値を満たしていません。');
  }

  const showWarnings = metrics.warnings.exceedsContinuous || metrics.warnings.exceedsDailySpan || metrics.warnings.insufficientBreak;

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      {showWarnings ? (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={onAutoCorrect}>
            自動補正
          </Button>
        </div>
      ) : null}
      <h4 className="font-semibold">Duty KPI</h4>
      <MetricRow label="連続運転（最大）" value={formatMinutes(metrics.longestContinuousMinutes)} warn={metrics.warnings.exceedsContinuous} />
      <MetricRow label="日拘束（全体）" value={formatMinutes(metrics.totalSpanMinutes)} warn={metrics.warnings.exceedsDailySpan} />
      <MetricRow
        label="休憩（最小）"
        value={metrics.shortestBreakMinutes === null ? '?' : formatMinutes(metrics.shortestBreakMinutes)}
        warn={metrics.warnings.insufficientBreak}
      />
      {warningMessages.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {warningMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">全て設定範囲内です。</p>
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
      <h4 className="font-semibold">選択中のセグメント</h4>
      <DetailRow label="duty_id" value={selection?.dutyId ?? '-'} />
      <DetailRow label="segment_id" value={segment.id} />
      <DetailRow label="Block" value={segment.blockId} />
      <DetailRow label="Trip範囲" value={`${segment.startTripId} → ${segment.endTripId}`} />
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

