/**
 * src/features/dashboard/useDiffSaveActions.ts
 * DiffView での保存アクション（取込結果・プロジェクト）を共有するカスタムフック。
 * 今後、左ナビや他画面からの保存導線でも再利用できるように切り出す。
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

import {
  downloadProjectJson,
  downloadSavedJson,
  defaultFileName,
  toSaved,
  toSavedProject,
} from '@/services/import/gtfsPersistence';
import { useExportConfirmation, type ExportConfirmationSummary } from '@/components/export/ExportConfirmationProvider';
import { addSaveHistory } from '@/services/dashboard/saveHistory';
import type { GtfsImportResult } from '@/services/import/gtfsParser';
import type { ManualInputs } from '@/types';
import { recordAuditEvent } from '@/services/audit/auditLog';
import { isStepOne } from '@/config/appStep';

interface UseDiffSaveActionsOptions {
  summary: ExportConfirmationSummary;
  result?: GtfsImportResult;
  manual: ManualInputs;
  onAfterSave?: () => void;
}

interface UseDiffSaveActions {
  handleSaveImportResult: () => void;
  handleSaveProject: () => void;
}

export function useDiffSaveActions({
  summary,
  result,
  manual,
  onAfterSave,
}: UseDiffSaveActionsOptions): UseDiffSaveActions {
  const { requestConfirmation } = useExportConfirmation();

  const handleSaveImportResult = useCallback(() => {
    if (!result) {
      toast.info('GTFSフィードを取り込むと保存できます。');
      return;
    }
    const fileName = defaultFileName(result.sourceName);
    requestConfirmation({
      title: '取込結果を保存しますか？',
      description: isStepOne
        ? 'Step1 では非ブロッキングでいつでも保存できます。'
        : '現在の警告件数と未割当状況を確認してから保存を続行できます。',
      summary,
      context: { entity: 'saved-result', exportType: 'saved-json', fileName },
      onConfirm: async () => {
        try {
          const latestFileName = defaultFileName(result.sourceName);
          downloadSavedJson(toSaved(result), latestFileName);
          recordAuditEvent({
            entity: 'saved-result',
            fileName: latestFileName,
            warnings: { hard: summary.hardWarnings, soft: summary.softWarnings },
            format: 'json',
          });
          addSaveHistory({
            type: 'saved-result',
            fileName: latestFileName,
            warnings: { hard: summary.hardWarnings, soft: summary.softWarnings },
          });
          onAfterSave?.();
          toast.success('取込結果JSONを保存しました。');
        } catch (error) {
          const message = error instanceof Error ? error.message : '保存処理で予期しないエラーが発生しました。';
          toast.error(message);
          throw error;
        }
      },
    });
  }, [onAfterSave, requestConfirmation, result, summary]);

  const handleSaveProject = useCallback(() => {
    if (!result) {
      toast.info('GTFSフィードを取り込むと保存できます。');
      return;
    }
    const projectFileName = defaultFileName(result.sourceName).replace('gtfs-import', 'project');
    requestConfirmation({
      title: 'プロジェクト JSON を保存しますか？',
      description: isStepOne
        ? 'Step1 では非ブロッキングでいつでも保存できます。'
        : '警告件数と未割当状況を確認してから保存を続行してください。',
      summary,
      context: { entity: 'project', exportType: 'project-json', fileName: projectFileName },
      onConfirm: async () => {
        try {
          const latestProjectFileName = defaultFileName(result.sourceName).replace('gtfs-import', 'project');
          downloadProjectJson(toSavedProject(result, manual), latestProjectFileName);
          recordAuditEvent({
            entity: 'project',
            fileName: latestProjectFileName,
            warnings: { hard: summary.hardWarnings, soft: summary.softWarnings },
            format: 'json',
          });
          addSaveHistory({
            type: 'project',
            fileName: latestProjectFileName,
            warnings: { hard: summary.hardWarnings, soft: summary.softWarnings },
          });
          onAfterSave?.();
          toast.success('プロジェクトJSONを保存しました。');
        } catch (error) {
          const message = error instanceof Error ? error.message : '保存処理で予期しないエラーが発生しました。';
          toast.error(message);
          throw error;
        }
      },
    });
  }, [manual, onAfterSave, requestConfirmation, result, summary]);

  return {
    handleSaveImportResult,
    handleSaveProject,
  };
}
