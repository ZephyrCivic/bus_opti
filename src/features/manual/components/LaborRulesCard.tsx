/**
 * src/features/manual/components/LaborRulesCard.tsx
 * 労務ルールの入力・CSV入出力を扱うカード。
 */
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { DataTable, LabeledInput } from './FormControls';

export interface LaborRuleDraft {
  driverId: string;
  maxContinuousDriveMin: string;
  minBreakMin: string;
  maxDutySpanMin: string;
  maxWorkMin: string;
  nightWindowStart: string;
  nightWindowEnd: string;
  qualifications: string;
  affiliation: string;
}

export interface LaborRulesCardProps {
  rows: Array<{
    driverId: string;
    maxContinuousDriveMin?: number;
    minBreakMin?: number;
    maxDutySpanMin?: number;
    maxWorkMin?: number;
    nightWindowStart?: string;
    nightWindowEnd?: string;
    qualifications?: string[];
    affiliation?: string;
  }>;
  onAdd: (draft: LaborRuleDraft) => boolean;
  onDelete: (driverId: string) => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
}

export function LaborRulesCard({ rows, onAdd, onDelete, onImport, onExport }: LaborRulesCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<LaborRuleDraft>({
    driverId: '',
    maxContinuousDriveMin: '',
    minBreakMin: '',
    maxDutySpanMin: '',
    maxWorkMin: '',
    nightWindowStart: '',
    nightWindowEnd: '',
    qualifications: '',
    affiliation: '',
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <CardTitle>労務ルール</CardTitle>
          <CardDescription>
            `labor_rules.csv`（driver_idごとの拘束時間/休憩など）を取り込み、後続の警告ロジックの基礎データとします。
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onImport(file);
              }
              event.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            CSVを読み込む
          </Button>
          <Button size="sm" onClick={onExport}>
            CSVを書き出す
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-5">
          <LabeledInput
            id="labor-driver-id"
            label="ドライバーID（必須）"
            value={draft.driverId}
            onChange={(value) => setDraft((prev) => ({ ...prev, driverId: value }))}
          />
          <LabeledInput
            id="labor-max-continuous"
            label="最大連続運転時間（分）"
            value={draft.maxContinuousDriveMin}
            onChange={(value) => setDraft((prev) => ({ ...prev, maxContinuousDriveMin: value }))}
            type="number"
            placeholder="240"
          />
          <LabeledInput
            id="labor-min-break"
            label="最小休憩時間（分）"
            value={draft.minBreakMin}
            onChange={(value) => setDraft((prev) => ({ ...prev, minBreakMin: value }))}
            type="number"
            placeholder="45"
          />
          <LabeledInput
            id="labor-max-duty"
            label="拘束時間上限（分）"
            value={draft.maxDutySpanMin}
            onChange={(value) => setDraft((prev) => ({ ...prev, maxDutySpanMin: value }))}
            type="number"
            placeholder="780"
          />
          <LabeledInput
            id="labor-max-work"
            label="労働時間上限（分）"
            value={draft.maxWorkMin}
            onChange={(value) => setDraft((prev) => ({ ...prev, maxWorkMin: value }))}
            type="number"
            placeholder="480"
          />
          <LabeledInput
            id="labor-night-start"
            label="深夜時間帯開始"
            value={draft.nightWindowStart}
            onChange={(value) => setDraft((prev) => ({ ...prev, nightWindowStart: value }))}
            placeholder="22:00"
          />
          <LabeledInput
            id="labor-night-end"
            label="深夜時間帯終了"
            value={draft.nightWindowEnd}
            onChange={(value) => setDraft((prev) => ({ ...prev, nightWindowEnd: value }))}
            placeholder="05:00"
          />
          <LabeledInput
            id="labor-qualifications"
            label="資格（|区切り）"
            value={draft.qualifications}
            onChange={(value) => setDraft((prev) => ({ ...prev, qualifications: value }))}
            placeholder="大型バス|路線"
          />
          <LabeledInput
            id="labor-affiliation"
            label="所属"
            value={draft.affiliation}
            onChange={(value) => setDraft((prev) => ({ ...prev, affiliation: value }))}
            placeholder="営業所A"
          />
          <div className="lg:self-end">
            <Button
              type="button"
              onClick={() => {
                const added = onAdd(draft);
                if (added) {
                  setDraft({
                    driverId: '',
                    maxContinuousDriveMin: '',
                    minBreakMin: '',
                    maxDutySpanMin: '',
                    maxWorkMin: '',
                    nightWindowStart: '',
                    nightWindowEnd: '',
                    qualifications: '',
                    affiliation: '',
                  });
                }
              }}
            >
              追加
            </Button>
          </div>
        </div>

        <DataTable
          headers={[
            'ドライバーID',
            '最大連続運転（分）',
            '最小休憩（分）',
            '拘束時間上限（分）',
            '労働時間上限（分）',
            '深夜時間帯',
            '資格',
            '所属',
            '',
          ]}
          rows={rows.map((rule) => [
            rule.driverId,
            rule.maxContinuousDriveMin ?? '-',
            rule.minBreakMin ?? '-',
            rule.maxDutySpanMin ?? '-',
            rule.maxWorkMin ?? '-',
            rule.nightWindowStart || rule.nightWindowEnd
              ? `${rule.nightWindowStart ?? '-'} → ${rule.nightWindowEnd ?? '-'}`
              : '-',
            rule.qualifications?.length ? rule.qualifications.join(' | ') : '-',
            rule.affiliation ?? '-',
            <Button key={`del-${rule.driverId}`} variant="destructive" size="sm" onClick={() => onDelete(rule.driverId)}>
              削除
            </Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}
