/**
 * src/services/import/dutiesCsv.ts
 * Parses Duties CSV payloads and converts them into Duty structures for the editor state.
 * Validates block/trip references against the provided BlockTripSequenceIndex.
 */
import Papa from 'papaparse';

import type { Duty } from '@/types';
import type { BlockTripSequenceIndex } from '@/services/duty/dutyState';

export interface ParsedDutiesCsv {
  duties: Duty[];
  settingsHash?: string;
  generatedAt?: string;
}

export function parseDutiesCsv(csv: string, index: BlockTripSequenceIndex): ParsedDutiesCsv {
  const result = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'Duties CSV の解析に失敗しました。');
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  const duties = new Map<string, DutyDraft>();
  let settingsHash: string | undefined;
  let generatedAt: string | undefined;

  for (const raw of rows) {
    const dutyId = normalizeString(raw.duty_id);
    if (!dutyId) {
      throw new Error('duty_id 列が空です。');
    }
    const seq = parseSequence(raw.seq);
    const blockId = normalizeString(raw.block_id);
    const startTripId = normalizeString(raw.segment_start_trip_id);
    const endTripId = normalizeString(raw.segment_end_trip_id);
    const driverId = normalizeString(raw.driver_id);

    if (settingsHash === undefined) {
      settingsHash = normalizeString(raw.settings_hash);
    }
    if (generatedAt === undefined) {
      generatedAt = normalizeString(raw.generated_at);
    }

    const duty = duties.get(dutyId) ?? createDutyDraft(dutyId);
    if (driverId) {
      if (duty.driverId && duty.driverId !== driverId) {
        throw new Error(`duty_id=${dutyId} の driver_id が行ごとに異なります。`);
      }
      duty.driverId = driverId;
    }

    if (!blockId && !startTripId && !endTripId) {
      duty.emptyRow = true;
      duties.set(dutyId, duty);
      continue;
    }

    if (!blockId || !startTripId || !endTripId) {
      throw new Error(`duty_id=${dutyId} の行で block_id / segment_start_trip_id / segment_end_trip_id のいずれかが欠けています。`);
    }

    const tripMap = index.get(blockId);
    if (!tripMap) {
      throw new Error(`CSVに含まれる block_id=${blockId} が現在のBlock一覧に存在しません。`);
    }

    const startSequence = tripMap.get(startTripId);
    const endSequence = tripMap.get(endTripId);
    if (!Number.isFinite(startSequence) || !Number.isFinite(endSequence)) {
      throw new Error(`block_id=${blockId} に trip_id=${startTripId}/${endTripId} が見つかりません。`);
    }
    if (Number(startSequence) > Number(endSequence)) {
      throw new Error(`duty_id=${dutyId} の区間は開始順序が終了より大きくなっています。`);
    }

    duty.segments.push({
      seq,
      blockId,
      startTripId,
      endTripId,
      startSequence: Number(startSequence),
      endSequence: Number(endSequence),
    });
    duties.set(dutyId, duty);
  }

  const mapped: Duty[] = Array.from(duties.values()).map(toDuty);
  mapped.sort((a, b) => a.id.localeCompare(b.id));
  return { duties: mapped, settingsHash, generatedAt };
}

interface DutyDraft {
  id: string;
  driverId?: string;
  segments: DutySegmentDraft[];
  emptyRow?: boolean;
}

interface DutySegmentDraft {
  seq: number;
  blockId: string;
  startTripId: string;
  endTripId: string;
  startSequence: number;
  endSequence: number;
}

function createDutyDraft(id: string): DutyDraft {
  return { id, segments: [] };
}

function toDuty(draft: DutyDraft): Duty {
  if (draft.segments.length === 0 && !draft.emptyRow) {
    throw new Error(`duty_id=${draft.id} のセグメントが1件もありません。CSVを確認してください。`);
  }

  const segments = draft.segments.slice().sort((a, b) => a.seq - b.seq);
  validateSequenceUniqueness(segments, draft.id);

  return {
    id: draft.id,
    driverId: draft.driverId || undefined,
    segments:
      segments.length === 0 && draft.emptyRow
        ? []
        : segments.map((segment, index) => ({
            id: formatSegmentId(index + 1),
            blockId: segment.blockId,
            startTripId: segment.startTripId,
            endTripId: segment.endTripId,
            startSequence: segment.startSequence,
            endSequence: segment.endSequence,
          })),
  };
}

function validateSequenceUniqueness(segments: DutySegmentDraft[], dutyId: string): void {
  const seen = new Set<number>();
  for (const segment of segments) {
    if (seen.has(segment.seq)) {
      throw new Error(`duty_id=${dutyId} 内で seq=${segment.seq} が重複しています。`);
    }
    seen.add(segment.seq);
  }
}

function parseSequence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(numeric) || numeric < 1) {
    throw new Error('seq 列は 1 以上の整数である必要があります。');
  }
  return Number(numeric);
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function formatSegmentId(index: number): string {
  return `SEG_${String(index).padStart(3, '0')}`;
}
