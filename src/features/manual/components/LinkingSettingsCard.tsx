/**
 * src/features/manual/components/LinkingSettingsCard.tsx
 * Presents manual linking thresholds (folded turnaround minutes, connect radius, parent station allowance).
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { LabeledInput, clampInt } from './FormControls';

export interface LinkingSettings {
  enabled: boolean;
  minTurnaroundMin: number;
  maxConnectRadiusM: number;
  allowParentStation: boolean;
}

export interface LinkingSettingsCardProps extends LinkingSettings {
  onChange: (partial: Partial<LinkingSettings>) => void;
}

export function LinkingSettingsCard({
  enabled,
  minTurnaroundMin,
  maxConnectRadiusM,
  allowParentStation,
  onChange,
}: LinkingSettingsCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>連結ガード（しきい値）</CardTitle>
        <CardDescription>
          誤連結を避けるための最小折返し時間・近接半径・親子駅許容を設定します。OFF の場合は自動連結を行いません。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-end gap-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="linking-enabled">
              自動連結を有効化
            </label>
            <input
              id="linking-enabled"
              type="checkbox"
              className="h-4 w-4"
              checked={enabled}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
          </div>
          <LabeledInput
            id="min-turn"
            label="最小折返し (分)"
            type="number"
            value={String(minTurnaroundMin)}
            onChange={(value) => onChange({ minTurnaroundMin: clampInt(value, 0, 240, 10) })}
          />
          <LabeledInput
            id="radius"
            label="接続半径 (m)"
            type="number"
            value={String(maxConnectRadiusM)}
            onChange={(value) => onChange({ maxConnectRadiusM: clampInt(value, 0, 2000, 100) })}
          />
          <div className="flex items-end gap-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="parent-station">
              親子駅を許容
            </label>
            <input
              id="parent-station"
              type="checkbox"
              className="h-4 w-4"
              checked={allowParentStation}
              onChange={(event) => onChange({ allowParentStation: event.target.checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
