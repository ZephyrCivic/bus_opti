/**
 * src/utils/downloadCsv.ts
 * Utility to trigger CSV downloads in the browser.
 */

export interface DownloadCsvOptions {
  fileName: string;
  content: string;
}

export function downloadCsv({ fileName, content }: DownloadCsvOptions): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName(fileName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-');
}
