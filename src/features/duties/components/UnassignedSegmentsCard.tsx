import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UnassignedRange } from '@/services/duty/unassigned';

interface UnassignedSegmentsCardProps {
  ranges: UnassignedRange[];
  onSelectRange: (range: UnassignedRange) => void;
}

export function UnassignedSegmentsCard({ ranges, onSelectRange }: UnassignedSegmentsCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>未割当グループ</CardTitle>
        <CardDescription>Duty に割り当てられていない区間をまとめています。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">
          未割当の区間数: {ranges.length}
        </div>
        <div className="max-h-[240px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>Trip 範囲</TableHead>
                <TableHead>所要</TableHead>
                <TableHead>件数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranges.map((range, index) => (
                <TableRow key={`${range.blockId}-${range.startSequence}-${index}`}>
                  <TableCell className="font-medium">{range.blockId}</TableCell>
                  <TableCell className="text-sm">
                    <div>{range.startTripId} → {range.endTripId}</div>
                    <div className="text-xs text-muted-foreground">
                      {range.firstDeparture} → {range.lastArrival}
                    </div>
                  </TableCell>
                  <TableCell>{range.firstDeparture} - {range.lastArrival}</TableCell>
                  <TableCell>{range.tripCount}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onSelectRange(range)}>
                      範囲を選択
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ranges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    現在、未割当の区間はありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        「範囲を選択」を押すとブロックの開始・終了Tripが設定されます。続けて「区間を追加」を実行してください。
      </CardFooter>
    </Card>
  );
}
