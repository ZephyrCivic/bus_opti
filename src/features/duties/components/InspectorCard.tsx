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
import type { DutyMetrics, DutyWarningSummary } from '@/services/duty/dutyMetrics';
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
  warningSummary?: DutyWarningSummary;
  onAutoCorrect: () => void;
  driverOptions: ManualDriver[];
  showSafetyPanel?: boolean;
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
    warningSummary,
    onAutoCorrect,
    driverOptions,
    showSafetyPanel = true,
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
            <p className="text-xs text-muted-foreground">運転士 CSV を読み込むと候補が表示されます。</p>
          )}
       </div>
       <QuickStats dutyCount={dutyCount} segmentCount={segmentCount} driverCount={driverCount} />
        {showSafetyPanel ? (
          selectedDuty ? (
            <DutyMetricsPanel metrics={selectedMetrics} warningSummary={warningSummary} onAutoCorrect={onAutoCorrect} />
          ) : (
            <p className="text-sm text-muted-foreground">乗務を選ぶと、安全チェック結果が表示されます。</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Step1 では警告と安全チェックの表示を一時的に無効化しています。</p>
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

function DutyMetricsPanel({
  metrics,
  warningSummary,
  onAutoCorrect,
}: {
  metrics: DutyMetrics | undefined;
  warningSummary?: DutyWarningSummary;
  onAutoCorrect: () => void;
}): JSX.Element {
  if (!metrics) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <h4 className="font-semibold">乗務チェック項目</h4>
        <p className="text-xs text-muted-foreground">乗務を選ぶと、拘束時間などの結果が表示されます。</p>
      </div>
    );
  }

  const summary = warningSummary ?? { hard: 0, soft: 0, messages: [] };
  const showWarnings = summary.hard > 0 || summary.soft > 0;

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
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={summary.hard > 0 ? 'destructive' : 'outline'}>重大 {summary.hard}</Badge>
          <Badge variant={summary.soft > 0 ? 'secondary' : 'outline'}>注意 {summary.soft}</Badge>
        </div>
      {summary.messages.length > 0 ? (
        <ul className={`space-y-1 text-xs ${summary.hard > 0 || summary.soft > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {summary.messages.map((entry, index) => (
            <li key={`${entry.message}-${index}`} className={entry.level === 'hard' ? 'font-semibold' : ''}>
              {entry.message}
            </li>
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
      <DetailRow label="便区間" value={`${segment.startTripId} → ${segment.endTripId}`} />
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



