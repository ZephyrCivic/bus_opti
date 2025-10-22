/**
 * src/features/duties/components/DutyListCard.tsx
 * Renders the list of Duties and their segments, delegating selection callbacks to the parent.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { Duty, DutySegment } from '@/types';
import type { DutyWarningSummary } from '@/services/duty/dutyMetrics';

interface DutyListCardProps {
  duties: Duty[];
  dutyWarnings: Map<string, DutyWarningSummary>;
  selectedDutyId: string | null;
  selectedSegmentId: string | null;
  onSelectDuty: (duty: Duty) => void;
  onSelectSegment: (duty: Duty, segment: DutySegment) => void;
}

export function DutyListCard({
  duties,
  dutyWarnings,
  selectedDutyId,
  selectedSegmentId,
  onSelectDuty,
  onSelectSegment,
}: DutyListCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>乗務一覧</CardTitle>
        <CardDescription>区間を選択すると詳細が表示されます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {duties.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ乗務がありません。区間を追加してください。</p>
        ) : (
          duties.map((duty) => {
            const warningSummary = dutyWarnings.get(duty.id);
            return (
              <div
                key={duty.id}
                className={cn('rounded-lg border p-4', selectedDutyId === duty.id && 'border-primary')}
                onClick={() => onSelectDuty(duty)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-semibold">{duty.id}</h4>
                    <p className="text-xs text-muted-foreground">運転士ID: {duty.driverId ?? '未設定'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary">{duty.segments.length} 区間</Badge>
                    {warningSummary ? (
                      <div className="flex items-center gap-1 text-[10px]">
                        <Badge variant={warningSummary.hard > 0 ? 'destructive' : 'outline'}>重大 {warningSummary.hard}</Badge>
                        <Badge variant={warningSummary.soft > 0 ? 'secondary' : 'outline'}>注意 {warningSummary.soft}</Badge>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {duty.segments.map((segment) => (
                    <button
                      key={segment.id}
                      type="button"
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted',
                        selectedSegmentId === segment.id && 'border-primary bg-primary/5',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectSegment(duty, segment);
                      }}
                    >
                      <div className="flex justify-between">
                        <span>{segment.blockId}</span>
                        <span>{segment.id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {segment.startTripId} → {segment.endTripId}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
