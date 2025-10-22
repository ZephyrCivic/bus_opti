import { expect, test } from '@playwright/test';
import { importSampleGtfs } from './utils/importHelpers';
import { waitForManualBlocksPlan } from './utils/blocksHelpers';

function computeGapMinutes(endTime: string, nextStart: string): number | null {
  const parse = (label: string): number | null => {
    const match = label.match(/^(\d+):(\d{2})$/);
    if (!match) return null;
    const hours = Number.parseInt(match[1]!, 10);
    const minutes = Number.parseInt(match[2]!, 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }
    return hours * 60 + minutes;
  };
  const end = parse(endTime);
  const start = parse(nextStart);
  if (end === null || start === null) return null;
  const gap = start - end;
  return gap >= 0 ? gap : null;
}

test.describe('G2: 自動確定なし', () => {
  test('ブロック連結は手動操作がない限り行われない', async ({ page }) => {
    await importSampleGtfs(page);
    await page.locator('button[data-section="blocks"]').click();

    const snapshot = await waitForManualBlocksPlan(page);
    expect(snapshot.summaries.length).toBeGreaterThan(0);
    expect(snapshot.connections).toHaveLength(0);

    const hasCandidate = snapshot.summaries.some((source) =>
      snapshot.summaries.some((target) => {
        if (target.blockId === source.blockId) return false;
        if (target.serviceDayIndex !== source.serviceDayIndex) return false;
        if (source.serviceId && target.serviceId && source.serviceId !== target.serviceId) return false;
        const gap = computeGapMinutes(source.lastTripEnd, target.firstTripStart);
        return gap !== null && gap >= 0;
      }),
    );
    expect(hasCandidate).toBe(true);

    await page.waitForTimeout(2_000);
    const after = await waitForManualBlocksPlan(page);
    expect(after.connections).toHaveLength(0);
  });
});
