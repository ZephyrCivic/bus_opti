/**
 * src/features/blocks/BlocksView.tsx
 * ブロック（行路）編集結果を確認し、ターン間隔や重複状況を把握する画面。
 * タイムライン、統計カード、詳細テーブル、未割当便一覧を提供する。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TimelineGantt from '@/features/timeline/TimelineGantt';
import { DEFAULT_PIXELS_PER_MINUTE, parseTimeLabel } from '@/features/timeline/timeScale';
import type { TimelineLane } from '@/features/timeline/types';
import {
  buildBlocksPlan,
  buildSingleTripBlockSeed,
  DEFAULT_MAX_TURN_GAP_MINUTES,
  type BlockCsvRow,
  type BlockPlan,
  type BlockSummary,
} from '@/services/blocks/blockBuilder';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import { useBlocksPlan } from './hooks/useBlocksPlan';
import { useManualBlocksPlan } from './hooks/useManualBlocksPlan';
import { isStepOne } from '@/config/appStep';
import { buildBlocksMetaCsv } from '@/services/export/blocksMetaCsv';
import { downloadCsv } from '@/utils/downloadCsv';
import { useExportConfirmation } from '@/components/export/ExportConfirmationProvider';
import { recordAuditEvent } from '@/services/audit/auditLog';
import { toast } from 'sonner';
import type { BlockMetaEntry } from '@/types';

const TIMELINE_AXIS_LABELS = {
  block: '行路ID',
  vehicle: '車両ID',
} as const;

type TimelineAxisMode = keyof typeof TIMELINE_AXIS_LABELS;

export default function BlocksView(): JSX.Element {
  const { result, manual, setManual } = useGtfsImport();
  const turnGap = DEFAULT_MAX_TURN_GAP_MINUTES;
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [fromBlockId, setFromBlockId] = useState<string>('');
  const [toBlockId, setToBlockId] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [timelineAxis, setTimelineAxis] = useState<TimelineAxisMode>('block');
  const [globalDropActive, setGlobalDropActive] = useState(false);
  const blockMeta = manual.blockMeta ?? {};
  const vehicleTypeOptions = useMemo(
    () =>
      manual.vehicleTypes.map((type) => ({
        value: type.typeId,
        label: type.name ? `${type.typeId}（${type.name}）` : type.typeId,
      })),
    [manual.vehicleTypes],
  );
  const vehicleIdOptions = useMemo(
    () =>
      manual.vehicles.map((vehicle) => ({
        value: vehicle.vehicleId,
        label: vehicle.vehicleTypeId ? `${vehicle.vehicleId}（${vehicle.vehicleTypeId}）` : vehicle.vehicleId,
      })),
    [manual.vehicles],
  );
  const { requestConfirmation } = useExportConfirmation();

  const initialPlan = useMemo<BlockPlan>(
    () =>
      buildBlocksPlan(result, {
        maxTurnGapMinutes: turnGap,
        minTurnaroundMinutes: manual.linking.minTurnaroundMin,
        linkingEnabled: false,
        diagnosticsEnabled: !isStepOne,
      }),
    [result, turnGap, manual.linking.minTurnaroundMin, manual.linking.enabled],
  );
  const manualPlanConfig = useMemo(
    () => ({
      minTurnaroundMin: 0,
      maxGapMinutes: Number.MAX_SAFE_INTEGER,
    }),
    [],
  );
  const manualPlanState = useManualBlocksPlan(initialPlan, manualPlanConfig);
  const { days, allDays, overlaps } = useBlocksPlan(manualPlanState.plan, { activeDay: activeDayIndex ?? undefined });

useEffect(() => {
  const blockIds = new Set(manualPlanState.plan.summaries.map((summary) => summary.blockId));
  setFromBlockId((current) => (current && !blockIds.has(current) ? '' : current));
  setToBlockId((current) => (current && !blockIds.has(current) ? '' : current));
}, [manualPlanState.plan]);

  useEffect(() => {
    const validBlockIds = new Set(manualPlanState.plan.summaries.map((summary) => summary.blockId));
    setManual((prev) => {
      const prevMeta = prev.blockMeta ?? {};
      let changed = false;
      const nextMeta: Record<string, BlockMetaEntry> = {};
      for (const [blockId, entry] of Object.entries(prevMeta)) {
        if (validBlockIds.has(blockId)) {
          nextMeta[blockId] = entry;
        } else {
          changed = true;
        }
      }
      if (!changed) {
        return prev;
      }
      return { ...prev, blockMeta: nextMeta };
    });
  }, [manualPlanState.plan.summaries, setManual]);

  const manualBlockSummaries = useMemo(
    () =>
      [...manualPlanState.plan.summaries].sort((a, b) => {
        if (a.serviceDayIndex !== b.serviceDayIndex) {
          return a.serviceDayIndex - b.serviceDayIndex;
        }
        return a.firstTripStart.localeCompare(b.firstTripStart);
      }),
    [manualPlanState.plan],
  );

  const manualToSummaries = useMemo(() => {
    if (!fromBlockId) {
      return manualBlockSummaries;
    }
    const candidates = manualPlanState.candidatesFor(fromBlockId);
    if (!candidates || candidates.length === 0) {
      return [];
    }
    const candidateIds = new Set(candidates.map((candidate) => candidate.blockId));
    return manualBlockSummaries.filter((summary) => candidateIds.has(summary.blockId));
  }, [manualBlockSummaries, manualPlanState.candidatesFor, fromBlockId]);

  const handleFromChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFromBlockId(value);
    setManualStatus(null);
    setToBlockId('');
  };

  const handleToChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setToBlockId(value);
    setManualStatus(null);
  };

  const handleConnect = () => {
    if (!fromBlockId || !toBlockId) {
      setManualStatus({ type: 'error', message: '連結元と連結先を選択してください。' });
      return;
    }
    const succeeded = manualPlanState.connect(fromBlockId, toBlockId);
    if (succeeded) {
      setManualStatus({ type: 'success', message: `${fromBlockId} と ${toBlockId} を連結しました。` });
      setToBlockId('');
    } else {
      setManualStatus({ type: 'error', message: '連結できませんでした。サービス日と時刻を確認してください。' });
    }
  };

  const handleUndo = () => {
    const undone = manualPlanState.undoLastConnection();
    if (undone) {
      setManualStatus({ type: 'success', message: '直前の連結を取り消しました。' });
    } else {
      setManualStatus({ type: 'error', message: '取り消す連結がありません。' });
    }
  };

  const handleCreateBlockFromTrip = useCallback(
    (tripId: string) => {
      if (!result) {
        toast.error('GTFSデータが読み込まれていません。');
        return;
      }
      const seed = buildSingleTripBlockSeed(result, tripId);
      if (!seed) {
        toast.error(`便 ${tripId} の情報を復元できませんでした。`);
        return;
      }
      const created = manualPlanState.createBlockFromTrip(seed);
      if (created) {
        toast.success(`便 ${tripId} から新しい行路を作成しました。`);
      } else {
        toast.info('この便は既に行路に割り当てられています。');
      }
    },
    [manualPlanState, result],
  );

  const handleBlockMetaChange = useCallback(
    (blockId: string, field: 'vehicleTypeId' | 'vehicleId', value: string) => {
      const normalized = value.trim();
      setManual((prev) => {
        const prevMeta = prev.blockMeta ?? {};
        const currentEntry = prevMeta[blockId] ?? {};
        const nextEntry: BlockMetaEntry = { ...currentEntry };

        if (field === 'vehicleTypeId') {
          if (normalized.length > 0) {
            nextEntry.vehicleTypeId = normalized;
          } else {
            delete nextEntry.vehicleTypeId;
          }
        } else if (field === 'vehicleId') {
          if (normalized.length > 0) {
            nextEntry.vehicleId = normalized;
          } else {
            delete nextEntry.vehicleId;
          }
        }

        const hasValue =
          (nextEntry.vehicleTypeId && nextEntry.vehicleTypeId.length > 0) ||
          (nextEntry.vehicleId && nextEntry.vehicleId.length > 0);

        const prevEntry = prevMeta[blockId];
        if (!hasValue) {
          if (!prevEntry) {
            return prev;
          }
          const { [blockId]: _removed, ...rest } = prevMeta;
          return { ...prev, blockMeta: rest };
        }

        if (
          prevEntry?.vehicleTypeId === nextEntry.vehicleTypeId &&
          prevEntry?.vehicleId === nextEntry.vehicleId
        ) {
          return prev;
        }

        return {
          ...prev,
          blockMeta: {
            ...prevMeta,
            [blockId]: nextEntry,
          },
        };
      });
    },
    [setManual],
  );

  const handleExportMeta = useCallback(() => {
    if (manualPlanState.plan.summaries.length === 0) {
      toast.info('行路が存在しないため、出力できるデータがありません。');
      return;
    }
    const preview = buildBlocksMetaCsv({
      plan: manualPlanState.plan,
      blockMeta,
    });
    requestConfirmation({
      title: 'blocks_meta.csv を出力しますか？',
      description: '行路ごとの車両タイプ・車両IDの記録を CSV で保存します。',
      summary: {
        hardWarnings: 0,
        softWarnings: 0,
        unassigned: manualPlanState.plan.unassignedTripIds.length,
      },
      context: { entity: 'blocks', exportType: 'blocks-meta-csv', fileName: preview.fileName },
      onConfirm: () => {
        const latest = buildBlocksMetaCsv({
          plan: manualPlanState.plan,
          blockMeta,
        });
        downloadCsv({ fileName: latest.fileName, content: latest.csv });
        recordAuditEvent({
          entity: 'blocks',
          fileName: latest.fileName,
          rowCount: latest.rowCount,
          generatedAt: latest.generatedAt,
          format: 'csv',
        });
        toast.success(`blocks_meta.csv をダウンロードしました（${latest.rowCount} 行）。`);
      },
    });
  }, [blockMeta, manualPlanState.plan, requestConfirmation]);

  const canConnect = fromBlockId !== '' && toBlockId !== '';
  const canUndo = manualPlanState.connections.length > 0;

  useEffect(() => {
    if (toBlockId && !manualToSummaries.some((summary) => summary.blockId === toBlockId)) {
      setToBlockId('');
    }
  }, [manualToSummaries, toBlockId]);

  useEffect(() => {
    if (allDays.length === 0) {
      if (activeDayIndex !== null) setActiveDayIndex(null);
      return;
    }
    const firstDay = allDays[0]!.dayIndex;
    if (activeDayIndex === null || !allDays.some((day) => day.dayIndex === activeDayIndex)) {
      setActiveDayIndex(firstDay);
    }
  }, [allDays, activeDayIndex]);

  const overlapMinutesByBlock = useMemo(() => {
    const map = new Map<string, number>();
    for (const summary of manualPlanState.plan.summaries) {
      const total = (overlaps.get(summary.blockId) ?? []).reduce(
        (accumulator, entry) => accumulator + entry.overlapMinutes,
        0,
      );
      map.set(summary.blockId, Number(total.toFixed(2)));
    }
    return map;
  }, [manualPlanState.plan, overlaps]);

  const visibleSummaries = useMemo(
    () => days.flatMap((day) => day.summaries),
    [days],
  );

  const timelineLanes = useMemo<TimelineLane[]>(() => {
    return visibleSummaries.reduce<TimelineLane[]>((lanes, summary) => {
      const startMinutes = parseTimeLabel(summary.firstTripStart);
      const endMinutes = parseTimeLabel(summary.lastTripEnd);
      if (startMinutes === undefined || endMinutes === undefined) {
        return lanes;
      }
      const overlapMinutes = overlapMinutesByBlock.get(summary.blockId) ?? 0;
      const color = overlapMinutes > 0 ? 'var(--destructive)' : 'var(--primary)';
      const meta = blockMeta[summary.blockId];
      const laneLabel = formatTimelineLaneLabel(summary, meta, timelineAxis);
      const vehicleTypeLabel = meta?.vehicleTypeId?.trim();
      const segmentLabel =
        timelineAxis === 'vehicle'
          ? `${summary.blockId}: ${summary.firstTripStart} ~ ${summary.lastTripEnd}`
          : `${summary.firstTripStart} ~ ${summary.lastTripEnd}`;
      const lane: TimelineLane = {
        id: summary.blockId,
        label: laneLabel,
        tag: vehicleTypeLabel
          ? {
              label: vehicleTypeLabel,
              title: `想定車両タイプ: ${vehicleTypeLabel}`,
            }
          : undefined,
        segments: [
          {
            id: `${summary.blockId}-window`,
            label: segmentLabel,
            startMinutes,
            endMinutes: Math.max(endMinutes, startMinutes + 1),
            color,
          },
        ],
      };
      lanes.push(lane);
      return lanes;
    }, []);
  }, [visibleSummaries, overlapMinutesByBlock, blockMeta, timelineAxis]);

  return (
    <div
      className="relative space-y-6"
      onDragOver={(event) => {
        // 未割当便のドラッグ時のみドロップを許可
        const types = Array.from(event.dataTransfer?.types ?? []);
        const isTripDrag = types.includes('application/x-trip-id') || types.includes('text/plain');
        if (isTripDrag) {
          event.preventDefault();
          if (!globalDropActive) setGlobalDropActive(true);
        }
      }}
      onDragLeave={() => {
        if (globalDropActive) setGlobalDropActive(false);
      }}
      onDrop={(event) => {
        const tripId =
          event.dataTransfer?.getData('application/x-trip-id') ?? event.dataTransfer?.getData('text/plain');
        if (tripId) {
          event.preventDefault();
          setGlobalDropActive(false);
          // 未割当便→新規行路の作成を実行
          void (async () => {
            try {
              const seed = await buildSingleTripBlockSeed(result, tripId);
              if (!seed) {
                toast.error(`trip_id=${tripId} の行路シードを生成できませんでした。`);
                return;
              }
              const created = manualPlanState.createBlockFromTrip(seed);
              if (created) {
                toast.success(`新しい行路 ${created.blockId} を作成しました。`);
              } else {
                toast.error('新しい行路を作成できませんでした。割当済みの可能性があります。');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : '行路の作成に失敗しました。';
              toast.error(message);
            }
          })();
        }
      }}
    >
      {globalDropActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="mx-4 w-full max-w-3xl rounded-xl border-4 border-dashed border-primary/60 bg-primary/5 p-6 text-center text-sm text-primary">
            未割当の便をここにドロップすると、新しい行路を作成します。
          </div>
        </div>
      ) : null}
      <div>
        <h2 className="text-lg font-semibold">行路編集</h2>
        <p className="text-sm text-muted-foreground">
          GTFS 取込データの便を可視化し、ターン間隔（現在 {manualPlanState.plan.maxTurnGapMinutes} 分）と重複状況を確認します。手動連結の判断材料として活用してください。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>手動連結（最小UI）</CardTitle>
            <CardDescription>
              Step1 ではブロックを手作業で連結します。候補提示や自動判定は行わず、連結/取り消しのみ提供します。
              タイムライン上でのドラッグ＆ドロップによる連結は非対応です（未割当便→新規行路の作成のみ D&amp;D 対応）。
              画面全体がドロップターゲットになっているため、未割当便の行をそのままタイムライン領域へドロップしても作成できます。
            </CardDescription>
          </div>
          <Badge variant="outline">連結数: {manualPlanState.connections.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="blocks-manual-from" className="text-sm font-medium text-muted-foreground">
                連結元ブロック
              </label>
              <select
                id="blocks-manual-from"
                data-testid="blocks-manual-from"
                value={fromBlockId}
                onChange={handleFromChange}
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">選択してください</option>
                {manualBlockSummaries.map((summary) => (
                  <option key={summary.blockId} value={summary.blockId}>
                    {formatBlockOption(summary)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="blocks-manual-to" className="text-sm font-medium text-muted-foreground">
                連結先ブロック
              </label>
              <select
                id="blocks-manual-to"
                data-testid="blocks-manual-to"
                value={toBlockId}
                onChange={handleToChange}
                disabled={fromBlockId === ''}
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">選択してください</option>
                {manualToSummaries
                  .filter((summary) => summary.blockId !== fromBlockId)
                  .map((summary) => (
                    <option key={summary.blockId} value={summary.blockId}>
                      {formatBlockOption(summary)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                data-testid="blocks-manual-connect"
                onClick={handleConnect}
                disabled={!canConnect}
              >
                連結
              </Button>
              <Button
                type="button"
                data-testid="blocks-manual-undo"
                onClick={handleUndo}
                variant="outline"
                disabled={!canUndo}
              >
                取り消し
              </Button>
            </div>
          </div>
          {manualStatus && (
            <p
              className={`text-sm ${
                manualStatus.type === 'success' ? 'text-emerald-600' : 'text-destructive'
              }`}
              data-testid="blocks-manual-status"
            >
              {manualStatus.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>日別タイムライン</CardTitle>
            <CardDescription>サービス日ごとのブロック稼働時間と重複を視覚化します（表示軸は行路ID/車両IDで切替可能）。</CardDescription>
          </div>
          <Badge variant="outline">サービス日数: {allDays.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {allDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">サービス日の集計がありません。GTFS フィードを取り込んでください。</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {allDays.map((day) => (
                    <Button
                      key={day.dayIndex}
                      size="sm"
                      variant={activeDayIndex === day.dayIndex ? 'default' : 'outline'}
                      onClick={() => setActiveDayIndex(day.dayIndex)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>表示軸</span>
                  <div className="flex items-center gap-1" role="group" aria-label="タイムライン表示軸">
                    {(Object.keys(TIMELINE_AXIS_LABELS) as TimelineAxisMode[]).map((axis) => (
                      <Button
                        key={axis}
                        type="button"
                        size="sm"
                        variant={timelineAxis === axis ? 'default' : 'outline'}
                        className="h-7 px-3 text-xs"
                        aria-pressed={timelineAxis === axis}
                        onClick={() => setTimelineAxis(axis)}
                      >
                        {TIMELINE_AXIS_LABELS[axis]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <TimelineGantt
                lanes={timelineLanes}
                pixelsPerMinute={DEFAULT_PIXELS_PER_MINUTE}
                emptyMessage="選択したサービス日に表示できるブロックがありません。"
              />
            </>
          )}
        </CardContent>
      </Card>

      <BlocksTable
        summaries={manualPlanState.plan.summaries}
        overlapMinutesByBlock={overlapMinutesByBlock}
        blockMeta={blockMeta}
        vehicleTypeOptions={vehicleTypeOptions}
        vehicleIdOptions={vehicleIdOptions}
        onUpdateBlockMeta={handleBlockMetaChange}
        onExportMeta={handleExportMeta}
      />
      <UnassignedTable
        unassigned={manualPlanState.plan.unassignedTripIds}
        onCreateBlock={handleCreateBlockFromTrip}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  trend?: 'default' | 'secondary' | 'outline';
}

function StatCard({ label, value, trend = 'outline' }: StatCardProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-4">
      <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
      <Badge variant={trend} className="w-fit text-base">
        {value}
      </Badge>
    </div>
  );
}

interface BlocksTableProps {
  summaries: BlockSummary[];
  overlapMinutesByBlock: Map<string, number>;
  blockMeta: Record<string, BlockMetaEntry | undefined>;
  vehicleTypeOptions: Array<{ value: string; label: string }>;
  vehicleIdOptions: Array<{ value: string; label: string }>;
  onUpdateBlockMeta: (blockId: string, field: 'vehicleTypeId' | 'vehicleId', value: string) => void;
  onExportMeta: () => void;
}

function BlocksTable({
  summaries,
  overlapMinutesByBlock,
  blockMeta,
  vehicleTypeOptions,
  vehicleIdOptions,
  onUpdateBlockMeta,
  onExportMeta,
}: BlocksTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>ブロック一覧</CardTitle>
          <CardDescription>
            行路単位で想定車両タイプ・車両IDを記録し、CSV へ出力できます。未入力のままでも保存・出力は可能です。
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onExportMeta} disabled={summaries.length === 0}>
            blocks_meta.csv を出力
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">ブロックの計算結果がありません。GTFS フィードを取り込んでください。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>行路ID</TableHead>
                  <TableHead>サービスID</TableHead>
                  <TableHead>サービス日</TableHead>
                  <TableHead>便数</TableHead>
                  <TableHead>想定車両タイプ</TableHead>
                  <TableHead>車両ID</TableHead>
                  <TableHead>始発時刻</TableHead>
                  <TableHead>最終時刻</TableHead>
                  <TableHead>平均ターン (分)</TableHead>
                  <TableHead>最大ターン (分)</TableHead>
                  <TableHead>重複合計 (分)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((summary) => {
                  const averageGap =
                    summary.gaps.length === 0
                      ? 0
                      : Math.round(summary.gaps.reduce((acc, gap) => acc + gap, 0) / summary.gaps.length);
                  const maxGap = summary.gaps.length === 0 ? 0 : Math.max(...summary.gaps);
                  const overlapMinutes = overlapMinutesByBlock.get(summary.blockId) ?? 0;
                  const meta = blockMeta[summary.blockId] ?? {};
                  return (
                    <TableRow key={summary.blockId} data-block-id={summary.blockId}>
                      <TableCell className="font-medium">{summary.blockId}</TableCell>
                      <TableCell>{summary.serviceId ?? '未設定'}</TableCell>
                      <TableCell>{formatServiceDay(summary.serviceDayIndex)}</TableCell>
                      <TableCell>{summary.tripCount}</TableCell>
                      <TableCell className="min-w-[10rem]">
                        <Input
                          value={meta.vehicleTypeId ?? ''}
                          onChange={(event) =>
                            onUpdateBlockMeta(summary.blockId, 'vehicleTypeId', event.target.value)
                          }
                          placeholder="例: M"
                          list="block-meta-vehicle-type-options"
                          autoComplete="off"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="min-w-[10rem]">
                        <Input
                          value={meta.vehicleId ?? ''}
                          onChange={(event) =>
                            onUpdateBlockMeta(summary.blockId, 'vehicleId', event.target.value)
                          }
                          placeholder="例: BUS_001"
                          list="block-meta-vehicle-id-options"
                          autoComplete="off"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>{summary.firstTripStart}</TableCell>
                      <TableCell>{summary.lastTripEnd}</TableCell>
                      <TableCell>{averageGap}</TableCell>
                      <TableCell>{maxGap}</TableCell>
                      <TableCell>{overlapMinutes.toFixed(1)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <datalist id="block-meta-vehicle-type-options">
              {vehicleTypeOptions.map((option) => (
                <option key={option.value} value={option.value} label={option.label} />
              ))}
            </datalist>
            <datalist id="block-meta-vehicle-id-options">
              {vehicleIdOptions.map((option) => (
                <option key={option.value} value={option.value} label={option.label} />
              ))}
            </datalist>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UnassignedTableProps {
  unassigned: string[];
  onCreateBlock?: (tripId: string) => void;
}

function UnassignedTable({ unassigned, onCreateBlock }: UnassignedTableProps): JSX.Element {
  const [isDropActive, setDropActive] = useState(false);

  const allowDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (unassigned.length === 0) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDropActive) {
      setDropActive(true);
    }
  };

  const resetDropState = () => {
    if (isDropActive) {
      setDropActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (unassigned.length === 0) {
      return;
    }
    event.preventDefault();
    resetDropState();
    const tripId =
      event.dataTransfer?.getData('application/x-trip-id') ?? event.dataTransfer?.getData('text/plain');
    if (tripId) {
      onCreateBlock?.(tripId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>未割当 便</CardTitle>
        <CardDescription>
          ブロックに割り当てられていない便を一覧で確認できます。ドラッグ＆ドロップ、またはボタン操作で新しい行路を作成できます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">未割当の便はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className={`mb-4 rounded-md border border-dashed p-4 text-sm ${
                isDropActive ? 'border-primary bg-primary/10 text-primary-foreground' : 'border-border/70 bg-muted/30'
              }`}
              onDragOver={allowDrop}
              onDragEnter={allowDrop}
              onDragLeave={resetDropState}
              onDrop={handleDrop}
            >
              未割当便をここにドラッグすると、新しい行路カードを自動作成できます。
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>trip_id</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassigned.map((tripId) => (
                  <TableRow
                    key={tripId}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer?.setData('application/x-trip-id', tripId);
                      event.dataTransfer?.setData('text/plain', tripId);
                      event.dataTransfer?.setDragImage(event.currentTarget, 0, 0);
                      event.dataTransfer.effectAllowed = 'copy';
                      setDropActive(true);
                    }}
                    onDragEnd={resetDropState}
                  >
                    <TableCell>{tripId}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => onCreateBlock?.(tripId)}>
                        新規行路
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function formatBlockOption(summary: BlockSummary): string {
  return `${formatServiceDay(summary.serviceDayIndex)} - ${summary.blockId}（便 ${summary.tripCount} 件）`;
}

function formatServiceDay(index: number): string {
  return `サービス日 ${index + 1}`;
}

function formatTimelineLaneLabel(
  summary: BlockSummary,
  meta: BlockMetaEntry | undefined,
  axis: TimelineAxisMode,
): string {
  if (axis === 'vehicle') {
    const vehicleId = meta?.vehicleId?.trim();
    if (vehicleId && vehicleId.length > 0) {
      return `${vehicleId}（行路 ${summary.blockId}）`;
    }
    return `${summary.blockId}（車両未設定）`;
  }
  return `${summary.blockId}（便 ${summary.tripCount} 件）`;
}

