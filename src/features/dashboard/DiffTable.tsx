/**
 * src/features/dashboard/DiffTable.tsx
 * 追加・削除・担当変更された Duty を一覧表示し、指標の差分を可視化するコンポーネント。
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ScheduleDiffResult } from '@/services/state/scheduleDiff';

interface DiffTableProps {
  diff: ScheduleDiffResult | null;
}

function EmptyState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>差分データがありません</CardTitle>
        <CardDescription>基準データを読み込み、変更箇所を抽出するとここに表示されます。</CardDescription>
      </CardHeader>
    </Card>
  );
}

interface SectionProps {
  title: string;
  description: string;
  rows: JSX.Element[] | null;
  emptyMessage: string;
}

function Section({ title, description, rows, emptyMessage }: SectionProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>サービス日</TableHead>
                  <TableHead>route_id</TableHead>
                  <TableHead>driver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{rows}</TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricsDelta({ diff }: { diff: ScheduleDiffResult['metricsDelta'] }): JSX.Element {
  const entries: Array<{ label: string; value: number }> = [
    { label: 'シフト数', value: diff.totalShifts },
    { label: '稼働時間 (h)', value: diff.totalHours },
    { label: '未割当 Duty', value: diff.unassigned },
    { label: '公平性スコア', value: diff.fairnessScore },
    { label: 'カバレッジ率', value: diff.coveragePercentage },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>指標の差分</CardTitle>
        <CardDescription>現状と基準データの KPI 差分を確認できます。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <div key={entry.label} className="rounded-md border bg-card/50 p-4">
              <h3 className="text-sm font-medium text-muted-foreground">{entry.label}</h3>
              <p className="text-xl font-semibold">{formatDelta(entry.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return value.toString();
  return '±0';
}

export default function DiffTable({ diff }: DiffTableProps): JSX.Element {
  if (!diff) {
    return <EmptyState />;
  }

  const addedRows = diff.added.map((item) => (
    <TableRow key={`added-${item.day}-${item.routeId}`}>
      <TableCell>{item.day}</TableCell>
      <TableCell>{item.routeId}</TableCell>
      <TableCell>{item.driverId}</TableCell>
    </TableRow>
  ));

  const removedRows = diff.removed.map((item) => (
    <TableRow key={`removed-${item.day}-${item.routeId}`}>
      <TableCell>{item.day}</TableCell>
      <TableCell>{item.routeId}</TableCell>
      <TableCell>{item.driverId}</TableCell>
    </TableRow>
  ));

  const reassignedRows = diff.reassigned.map((item) => (
    <TableRow key={`reassigned-${item.day}-${item.routeId}`}>
      <TableCell>{item.day}</TableCell>
      <TableCell>{item.routeId}</TableCell>
      <TableCell>
        {item.fromDriverId} → {item.toDriverId}
      </TableCell>
    </TableRow>
  ));

  return (
    <div className="space-y-6">
      <MetricsDelta diff={diff.metricsDelta} />
      <Card>
        <CardHeader>
          <CardTitle>アラート比較</CardTitle>
          <CardDescription>基準と現在の KPI アラートを比較し、注意が必要な項目を把握します。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <AlertList heading="現在のアラート" alerts={diff.alerts.current} emptyMessage="現在のアラートはありません。" />
          <AlertList heading="基準のアラート" alerts={diff.alerts.baseline} emptyMessage="基準のアラートはありません。" />
        </CardContent>
      </Card>
      <Section
        title="追加された勤務"
        description="新たに割り当てられた driver × route の組み合わせです。"
        rows={addedRows}
        emptyMessage="追加された勤務はありません。"
      />
      <Section
        title="削除された勤務"
        description="基準には存在していたが、現在は削除された driver × route の組み合わせです。"
        rows={removedRows}
        emptyMessage="削除された勤務はありません。"
      />
      <Section
        title="担当が変わった勤務"
        description="同じ route を別のドライバーが担当するようになった勤務です。"
        rows={reassignedRows}
        emptyMessage="担当変更された勤務はありません。"
      />
    </div>
  );
}

interface AlertListProps {
  heading: string;
  alerts: ScheduleDiffResult['alerts']['current'];
  emptyMessage: string;
}

function AlertList({ heading, alerts, emptyMessage }: AlertListProps): JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{heading}</h3>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {alerts.map((alert, index) => (
            <li key={`${heading}-alert-${alert.id}-${index}`}>
              <span className={alert.severity === 'critical' ? 'text-destructive font-semibold' : 'text-amber-500'}>
                [{alert.severity === 'critical' ? '重要' : '注意'}]
              </span>{' '}
              {alert.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

