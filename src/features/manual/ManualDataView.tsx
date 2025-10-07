/**
 * src/features/manual/ManualDataView.tsx
 * Simple forms to input manual data (depots, relief points, deadhead rules)
 * and tweak linking thresholds directly from the UI.
 * Data is stored in GtfsImportProvider.manual (in-memory). JSON保存は今後拡張予定。
 */
import { useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useGtfsImport } from '@/services/import/GtfsImportProvider';
import type { Depot, ReliefPoint, DeadheadRule } from '@/types';

export default function ManualDataView(): JSX.Element {
  const { manual, setManual } = useGtfsImport();

  return (
    <div className="space-y-6">
      <LinkingSettingsCard
        minTurnaroundMin={manual.linking.minTurnaroundMin}
        maxConnectRadiusM={manual.linking.maxConnectRadiusM}
        allowParentStation={manual.linking.allowParentStation}
        onChange={(partial) => setManual((prev) => ({ ...prev, linking: { ...prev.linking, ...partial } }))}
      />

      <ReliefPointsCard
        rows={manual.reliefPoints}
        onAdd={(row) => setManual((prev) => ({ ...prev, reliefPoints: [...prev.reliefPoints, row] }))}
        onDelete={(reliefId) => setManual((prev) => ({ ...prev, reliefPoints: prev.reliefPoints.filter((r) => r.reliefId !== reliefId) }))}
      />

      <DepotsCard
        rows={manual.depots}
        onAdd={(row) => setManual((prev) => ({ ...prev, depots: [...prev.depots, row] }))}
        onDelete={(depotId) => setManual((prev) => ({ ...prev, depots: prev.depots.filter((d) => d.depotId !== depotId) }))}
      />

      <DeadheadRulesCard
        rows={manual.deadheadRules}
        onAdd={(row) => setManual((prev) => ({ ...prev, deadheadRules: [...prev.deadheadRules, row] }))}
        onDelete={(index) => setManual((prev) => ({ ...prev, deadheadRules: prev.deadheadRules.filter((_, i) => i !== index) }))}
      />
    </div>
  );
}

function LinkingSettingsCard(props: {
  minTurnaroundMin: number;
  maxConnectRadiusM: number;
  allowParentStation: boolean;
  onChange: (partial: Partial<{ minTurnaroundMin: number; maxConnectRadiusM: number; allowParentStation: boolean }>) => void;
}): JSX.Element {
  const { minTurnaroundMin, maxConnectRadiusM, allowParentStation, onChange } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>連結ガード（しきい値）</CardTitle>
        <CardDescription>誤連結を避けるための最小折返し時間・近接半径・親子駅許容を設定します。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <LabeledInput
            id="min-turn"
            label="最小折返し (分)"
            type="number"
            value={String(minTurnaroundMin)}
            onChange={(v) => onChange({ minTurnaroundMin: clampInt(v, 0, 240, 10) })}
          />
          <LabeledInput
            id="radius"
            label="接続半径 (m)"
            type="number"
            value={String(maxConnectRadiusM)}
            onChange={(v) => onChange({ maxConnectRadiusM: clampInt(v, 0, 2000, 100) })}
          />
          <div className="flex items-end gap-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="parent-station">親子駅を許容</label>
            <input
              id="parent-station"
              type="checkbox"
              className="h-4 w-4"
              checked={allowParentStation}
              onChange={(e) => onChange({ allowParentStation: e.target.checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReliefPointsCard(props: {
  rows: ReliefPoint[];
  onAdd: (row: ReliefPoint) => void;
  onDelete: (reliefId: string) => void;
}): JSX.Element {
  const { rows, onAdd, onDelete } = props;
  const [draft, setDraft] = useState<ReliefPoint>({ reliefId: '', name: '', lat: 0, lon: 0, stopId: '', walkTimeToStopMin: 0 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>交代地点（Relief Points）</CardTitle>
        <CardDescription>交代可能な地点を追加します（未入力でも作業は継続可能）。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-6">
          <LabeledInput id="relief-id" label="ID" value={draft.reliefId} onChange={(v) => setDraft({ ...draft, reliefId: v })} />
          <LabeledInput id="relief-name" label="名称" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <LabeledInput id="relief-lat" label="緯度" type="number" value={String(draft.lat)} onChange={(v) => setDraft({ ...draft, lat: toNum(v, 0) })} />
          <LabeledInput id="relief-lon" label="経度" type="number" value={String(draft.lon)} onChange={(v) => setDraft({ ...draft, lon: toNum(v, 0) })} />
          <LabeledInput id="relief-stop" label="stop_id" value={draft.stopId ?? ''} onChange={(v) => setDraft({ ...draft, stopId: v || undefined })} />
          <LabeledInput id="relief-walk" label="徒歩 (分)" type="number" value={String(draft.walkTimeToStopMin ?? 0)} onChange={(v) => setDraft({ ...draft, walkTimeToStopMin: clampInt(v, 0, 120, 0) })} />
        </div>
        <div className="flex gap-2">
          <LabeledInput id="relief-window" label="許可時間帯" placeholder="例 09:00-18:00" value={draft.allowedWindow ?? ''} onChange={(v) => setDraft({ ...draft, allowedWindow: v || undefined })} />
          <Button
            type="button"
            onClick={() => {
              if (!draft.reliefId || !Number.isFinite(draft.lat) || !Number.isFinite(draft.lon)) return;
              onAdd(draft);
              setDraft({ reliefId: '', name: '', lat: 0, lon: 0, stopId: '', walkTimeToStopMin: 0 });
            }}
          >
            追加
          </Button>
        </div>

        <DataTable
          headers={[['relief_id', '名称', '緯度', '経度', 'stop_id', '徒歩', '許可時間帯', '']]}
          rows={rows.map((r) => [r.reliefId, r.name, String(r.lat), String(r.lon), r.stopId ?? '-', String(r.walkTimeToStopMin ?? '-'), r.allowedWindow ?? '-',
            <Button key={`del-${r.reliefId}`} variant="destructive" size="sm" onClick={() => onDelete(r.reliefId)}>削除</Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}

function DepotsCard(props: { rows: Depot[]; onAdd: (row: Depot) => void; onDelete: (depotId: string) => void }): JSX.Element {
  const { rows, onAdd, onDelete } = props;
  const [draft, setDraft] = useState<Depot>({ depotId: '', name: '', lat: 0, lon: 0, minTurnaroundMin: 10 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>デポ/車庫（Depots）</CardTitle>
        <CardDescription>入出庫・点呼拠点など。最小折返し時間も保持できます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-6">
          <LabeledInput id="depot-id" label="ID" value={draft.depotId} onChange={(v) => setDraft({ ...draft, depotId: v })} />
          <LabeledInput id="depot-name" label="名称" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <LabeledInput id="depot-lat" label="緯度" type="number" value={String(draft.lat)} onChange={(v) => setDraft({ ...draft, lat: toNum(v, 0) })} />
          <LabeledInput id="depot-lon" label="経度" type="number" value={String(draft.lon)} onChange={(v) => setDraft({ ...draft, lon: toNum(v, 0) })} />
          <LabeledInput id="depot-open" label="開所" placeholder="HH:MM" value={draft.openTime ?? ''} onChange={(v) => setDraft({ ...draft, openTime: v || undefined })} />
          <LabeledInput id="depot-close" label="閉所" placeholder="HH:MM" value={draft.closeTime ?? ''} onChange={(v) => setDraft({ ...draft, closeTime: v || undefined })} />
        </div>
        <div className="flex gap-2 items-end">
          <LabeledInput id="depot-turn" label="最小折返し (分)" type="number" value={String(draft.minTurnaroundMin ?? 0)} onChange={(v) => setDraft({ ...draft, minTurnaroundMin: clampInt(v, 0, 120, 10) })} />
          <Button
            type="button"
            onClick={() => {
              if (!draft.depotId || !Number.isFinite(draft.lat) || !Number.isFinite(draft.lon)) return;
              onAdd(draft);
              setDraft({ depotId: '', name: '', lat: 0, lon: 0, minTurnaroundMin: 10 });
            }}
          >追加</Button>
        </div>

        <DataTable
          headers={[['depot_id', '名称', '緯度', '経度', '開所', '閉所', '最小折返し', '']]}
          rows={rows.map((d) => [d.depotId, d.name, String(d.lat), String(d.lon), d.openTime ?? '-', d.closeTime ?? '-', String(d.minTurnaroundMin ?? '-'),
            <Button key={`del-${d.depotId}`} variant="destructive" size="sm" onClick={() => onDelete(d.depotId)}>削除</Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}

function DeadheadRulesCard(props: { rows: DeadheadRule[]; onAdd: (row: DeadheadRule) => void; onDelete: (index: number) => void }): JSX.Element {
  const { rows, onAdd, onDelete } = props;
  const [draft, setDraft] = useState<DeadheadRule>({ fromId: '', toId: '', mode: 'walk', travelTimeMin: 5 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>回送近似（Deadhead Rules）</CardTitle>
        <CardDescription>最短経路は後続対応。まずは固定分/距離などで近似します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-6">
          <LabeledInput id="dh-from" label="from_id" value={draft.fromId} onChange={(v) => setDraft({ ...draft, fromId: v })} />
          <LabeledInput id="dh-to" label="to_id" value={draft.toId} onChange={(v) => setDraft({ ...draft, toId: v })} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">mode</label>
            <Select value={draft.mode} onValueChange={(v) => setDraft({ ...draft, mode: v as DeadheadRule['mode'] })}>
              <SelectTrigger>
                <SelectValue placeholder="mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk">walk</SelectItem>
                <SelectItem value="bus">bus</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LabeledInput id="dh-time" label="所要 (分)" type="number" value={String(draft.travelTimeMin)} onChange={(v) => setDraft({ ...draft, travelTimeMin: clampInt(v, 0, 600, 5) })} />
          <LabeledInput id="dh-dist" label="距離 (km)" type="number" value={String(draft.distanceKm ?? 0)} onChange={(v) => setDraft({ ...draft, distanceKm: toNum(v, 0) })} />
          <LabeledInput id="dh-window" label="許可時間帯" placeholder="例 05:00-23:00" value={draft.allowedWindow ?? ''} onChange={(v) => setDraft({ ...draft, allowedWindow: v || undefined })} />
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!draft.fromId || !draft.toId || !Number.isFinite(draft.travelTimeMin)) return;
            onAdd(draft);
            setDraft({ fromId: '', toId: '', mode: 'walk', travelTimeMin: 5 });
          }}
        >追加</Button>

        <DataTable
          headers={[['from_id', 'to_id', 'mode', '所要(分)', '距離(km)', '許可時間帯', '']]}
          rows={rows.map((r, i) => [r.fromId, r.toId, r.mode, String(r.travelTimeMin), r.distanceKm ?? '-', r.allowedWindow ?? '-',
            <Button key={`del-${i}`} variant="destructive" size="sm" onClick={() => onDelete(i)}>削除</Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}

function DataTable(props: { headers: (string | JSX.Element)[][]; rows: (string | number | JSX.Element | null | undefined)[][] }): JSX.Element {
  const { headers, rows } = props;
  const header = useMemo(() => headers[0] ?? [], [headers]);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {header.map((h, idx) => (
            <TableHead key={idx}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => (
              <TableCell key={`${i}-${j}`}>{c as any}</TableCell>
            ))}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={header.length} className="text-sm text-muted-foreground text-center">
              まだ行がありません
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function LabeledInput(props: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }): JSX.Element {
  const { id, label, value, onChange, type = 'text', placeholder } = props;
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={id}>{label}</label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function clampInt(text: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(text), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toNum(text: string, fallback: number): number {
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

