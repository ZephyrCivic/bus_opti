/**
 * src/features/manual/utils/file.ts
 * Provides small helpers for reading CSV files inside manual data workflows.
 */
export async function readFileAsText(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}
