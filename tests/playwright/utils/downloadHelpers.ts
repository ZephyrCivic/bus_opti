import { promises as fs } from 'node:fs';
import type { Download } from '@playwright/test';

export async function readDownload(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  if (stream) {
    return await new Promise<string>((resolve, reject) => {
      let content = '';
      stream.setEncoding('utf-8');
      stream.on('data', (chunk) => {
        content += chunk;
      });
      stream.on('end', () => resolve(content));
      stream.on('error', reject);
    });
  }

  const filePath = await download.path();
  if (!filePath) {
    throw new Error('ダウンロードパスを取得できませんでした。');
  }
  return fs.readFile(filePath, 'utf-8');
}
