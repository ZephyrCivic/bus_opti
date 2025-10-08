/**
 * src/features/duties/hooks/useDutyCsvHandlers.ts
 * Duties CSV のインポート／エクスポート処理をまとめる。
 * Duty 選択状態の更新もここで行い、ビューを簡潔に保つ。
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

import { buildDutiesCsv } from '@/services/export/dutiesCsv';
import { parseDutiesCsv } from '@/services/import/dutiesCsv';
import type { DutyEditorActions } from '@/services/import/GtfsImportProvider';
import type { DutyEditState } from '@/types';
import { downloadCsv } from '@/utils/downloadCsv';
import type { SegmentSelection } from './useDutySelectionState';

interface DutyCsvParams {
  dutyActions: DutyEditorActions;
  dutyState: DutyEditState;
  tripIndex: Parameters<typeof parseDutiesCsv>[1];
  setSelectedDutyId: (id: string | null) => void;
  setSelectedSegment: (selection: SegmentSelection | null) => void;
  setSelectedBlockId: (id: string | null) => void;
  setStartTripId: (id: string | null) => void;
  setEndTripId: (id: string | null) => void;
}

interface DutyCsvResult {
  handleImportFile: (file: File) => Promise<void>;
  handleExport: () => void;
  handleImportClick: (input: HTMLInputElement | null) => void;
}

async function readFileAsText(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

export function useDutyCsvHandlers(params: DutyCsvParams): DutyCsvResult {
  const {
    dutyActions,
    dutyState,
    tripIndex,
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
  } = params;

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const csv = await readFileAsText(file);
        const parsed = parseDutiesCsv(csv, tripIndex);
        dutyActions.replace(parsed.duties);
        if (parsed.duties.length === 0) {
          setSelectedDutyId(null);
          setSelectedSegment(null);
          setStartTripId(null);
          setEndTripId(null);
          toast.success('Duties CSV を読み込みました（0件）。');
          return;
        }
        const firstDuty = parsed.duties[0]!;
        setSelectedDutyId(firstDuty.id);
        const firstSegment = firstDuty.segments[0];
        if (firstSegment) {
          setSelectedSegment({ dutyId: firstDuty.id, segmentId: firstSegment.id });
          setSelectedBlockId(firstSegment.blockId);
          setStartTripId(firstSegment.startTripId);
          setEndTripId(firstSegment.endTripId);
        } else {
          setSelectedSegment(null);
          setStartTripId(null);
          setEndTripId(null);
        }
        const metadataNote = parsed.generatedAt ? `（${parsed.generatedAt}）` : '';
        toast.success(`Duties CSV を読み込みました（${parsed.duties.length} Duty）${metadataNote}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Duties CSV の読み込みに失敗しました。');
      }
    },
    [dutyActions, setEndTripId, setSelectedBlockId, setSelectedDutyId, setSelectedSegment, setStartTripId, tripIndex],
  );

  const handleExport = useCallback(() => {
    if (dutyState.duties.length === 0) {
      toast.info('エクスポート可能な Duty がありません。');
      return;
    }
    const exportData = buildDutiesCsv(dutyState.duties, { dutySettings: dutyState.settings });
    downloadCsv({ fileName: exportData.fileName, content: exportData.csv });
    toast.success(`Duties CSV をダウンロードしました（${exportData.rowCount} 行）`);
  }, [dutyState.duties, dutyState.settings]);

  const handleImportClick = useCallback((input: HTMLInputElement | null) => {
    input?.click();
  }, []);

  return { handleImportFile, handleExport, handleImportClick };
}
