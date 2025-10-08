/**
 * src/features/dashboard/DiffTable.tsx
 * Renders added/removed/reassigned schedule items with dashboard metric deltas.
 */
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ScheduleDiffResult } from '@/services/state/scheduleDiff';

interface DiffTableProps {
  diff: ScheduleDiffResult | null;
}

function EmptyState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>差分はありません</CardTitle>
        <CardDescription>比較できる基準データを読み込むと変更点が表示されます。</CardDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>day</TableHead>
                <TableHead>route_id</TableHead>
                <TableHead>driver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricsDelta({ diff }: { diff: ScheduleDiffResult['metricsDelta'] }): JSX.Element {
  const entries: Array<{ label: string; value: number }> = [
    { label: '総シフト数', value: diff.totalShifts },
    { label: '総時間', value: diff.totalHours },
    { label: '未割当', value: diff.unassigned },
    { label: '公平性スコア', value: diff.fairnessScore },
    { label: 'カバレッジ', value: diff.coveragePercentage },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>指標の変化量</CardTitle>
        <CardDescription>現在案と基準案の差分を表示します。</CardDescription>
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
  if (value > 0) {
    return `+${value}`;
  }
  if (value < 0) {
    return value.toString();
  }
  return '0';
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
        {item.fromDriverId}
        {' → '}
        {item.toDriverId}
      </TableCell>
    </TableRow>
  ));

  return (
    <div className="space-y-6">
      <MetricsDelta diff={diff.metricsDelta} />
      <Card>
        <CardHeader>
          <CardTitle>アラート比較</CardTitle>
          <CardDescription>基準案と現在案のKPIアラートを比較します。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">現在のアラート</h3>
            {diff.alerts.current.length === 0 ? (
              <p className="text-sm text-muted-foreground">現在案のアラートはありません。</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {diff.alerts.current.map((alert, index) => (
                  <li key={`current-alert-${alert.id}-${index}`}>
                    <span className={alert.severity === 'critical' ? 'text-destructive font-semibold' : 'text-amber-500'}>
                      [{alert.severity === 'critical' ? '重大' : '注意'}]
                    </span>{' '}
                    {alert.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">基準のアラート</h3>
            {diff.alerts.baseline.length === 0 ? (
              <p className="text-sm text-muted-foreground">基準案のアラートはありません。</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {diff.alerts.baseline.map((alert, index) => (
                  <li key={`baseline-alert-${alert.id}-${index}`}>
                    <span className={alert.severity === 'critical' ? 'text-destructive font-semibold' : 'text-amber-500'}>
                      [{alert.severity === 'critical' ? '重大' : '注意'}]
                    </span>{' '}
                    {alert.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
      <Section
        title="追加された担当"
        description="現行案に追加された driver × route の組み合わせです。"
        rows={addedRows}
        emptyMessage="追加された担当はありません。"
      />
      <Section
        title="削除された担当"
        description="基準案から削除された driver × route の組み合わせです。"
        rows={removedRows}
        emptyMessage="削除された担当はありません。"
      />
      <Section
        title="担当替え"
        description="同じ route で driver が入れ替わった項目を表示します。"
        rows={reassignedRows}
        emptyMessage="担当替えはありません。"
      />
    </div>
  );
}
