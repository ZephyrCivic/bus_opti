/**
 * src/features/duties/components/ManualCheckCard.tsx
 * Provides a read-only summary of Relief Points / Deadhead Rules and how they intersect with current Duties.
 * Helps Duty editors confirm that manual configuration values are reflected in the active schedule.
 */
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BlockPlan } from '@/services/blocks/blockBuilder';
import type { Duty, ManualInputs } from '@/types';

interface ManualCheckCardProps {
  manual: ManualInputs;
  plan: BlockPlan;
  duties: Duty[];
}

interface ReliefUsageRow {
  reliefId: string;
  name?: string;
  stopId?: string;
  usageCount: number;
}

export default function ManualCheckCard({ manual, plan, duties }: ManualCheckCardProps): JSX.Element {
  const reliefRows = useMemo<ReliefUsageRow[]>(() => {
    const tripStops = buildTripStopLookup(plan);
    const stopUsage = computeDutyStopUsage(duties, tripStops);
    return manual.reliefPoints.map((relief) => ({
      reliefId: relief.reliefId,
      name: relief.name,
      stopId: relief.stopId,
      usageCount: relief.stopId ? stopUsage.get(relief.stopId) ?? 0 : 0,
    }));
  }, [plan, duties, manual.reliefPoints]);

  const usedReliefCount = reliefRows.filter((row) => row.usageCount > 0).length;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>交代地点 / 回送チェック</CardTitle>
            <CardDescription>手動設定が乗務編集に反映されているかを可視化します。</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">
              交代地点 {manual.reliefPoints.length} / 使用中 {usedReliefCount}
            </Badge>
            <Badge variant="outline">
              回送 {manual.deadheadRules.length}
            </Badge>
            <Badge variant="outline">
              車庫 {manual.depots.length}
            </Badge>
            <Badge variant="outline">
              運転士 {manual.drivers.length}
            </Badge>
            <Badge variant="outline">
              労務ルール {manual.laborRules.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold">交代地点</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>relief_id</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>stop_id</TableHead>
                <TableHead className="text-right">Duty使用</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reliefRows.map((row) => (
                <TableRow key={row.reliefId}>
                  <TableCell>{row.reliefId}</TableCell>
                  <TableCell>{row.name ?? '-'}</TableCell>
                  <TableCell>{row.stopId ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    {row.usageCount > 0 ? `${row.usageCount.toLocaleString()} 件` : '0 件'}
                  </TableCell>
                </TableRow>
              ))}
              {reliefRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    交代地点が未登録です。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">回送ルール</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>from_id</TableHead>
                <TableHead>to_id</TableHead>
                <TableHead>mode</TableHead>
                <TableHead className="text-right">所要(分)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manual.deadheadRules.map((rule, index) => (
                <TableRow key={`${rule.fromId}-${rule.toId}-${index}`}>
                  <TableCell>{rule.fromId}</TableCell>
                  <TableCell>{rule.toId}</TableCell>
                  <TableCell>{rule.mode}</TableCell>
                  <TableCell className="text-right">{rule.travelTimeMin}</TableCell>
                </TableRow>
              ))}
              {manual.deadheadRules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    回送ルールが未登録です。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
  );
}

interface TripStopSpan {
  startStopId?: string;
  endStopId?: string;
}

type TripStopLookup = Map<string, TripStopSpan>;

function buildTripStopLookup(plan: BlockPlan): TripStopLookup {
  const lookup: TripStopLookup = new Map();
  for (const row of plan.csvRows) {
    const tripId = row.tripId;
    if (!tripId) continue;
    const span = lookup.get(tripId) ?? {};
    if (row.fromStopId) {
      span.startStopId = row.fromStopId;
    }
    if (row.toStopId) {
      span.endStopId = row.toStopId;
    }
    lookup.set(tripId, span);
  }
  return lookup;
}

function computeDutyStopUsage(duties: Duty[], tripStops: TripStopLookup): Map<string, number> {
  const usage = new Map<string, number>();
  for (const duty of duties) {
    for (const segment of duty.segments) {
      const touched = new Set<string>();
      const startSpan = tripStops.get(segment.startTripId);
      if (startSpan?.startStopId) {
        touched.add(startSpan.startStopId);
      }
      if (startSpan?.endStopId) {
        touched.add(startSpan.endStopId);
      }
      const endSpan = tripStops.get(segment.endTripId);
      if (endSpan?.startStopId) {
        touched.add(endSpan.startStopId);
      }
      if (endSpan?.endStopId) {
        touched.add(endSpan.endStopId);
      }
      for (const stopId of touched) {
        usage.set(stopId, (usage.get(stopId) ?? 0) + 1);
      }
    }
  }
  return usage;
}
