/**
 * tools/gtfsHealthCli.ts
 * どこ: tools/
 * なに: GTFS ZIP の健全性サマリ（最小）を出力するCLI/ライブラリ。
 * なぜ: BlockID なし前提の確認を自動化し、実装前の前提を固めるため。
 * 方針: 小さく安全。trips.block_id の有無/非空率に限定（将来拡張可）。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

export type GtfsHealthSummary = {
  zipPath: string;
  entries: string[];
  hasTrips: boolean;
  tripsHeader?: string[];
  hasBlockIdColumn: boolean;
  tripsRowCount: number;
  blockIdNonEmptyCount: number;
  blockless: boolean; // hasBlockIdColumn && blockIdNonEmptyCount === 0
};

/**
 * ZIPを読み、trips.txt のヘッダーと block_id 列の非空率のみを集計する。
 * 依存は jszip のみ。サイズの大きいZIPは非推奨（本CLIは最小検査）。
 */
export async function gtfsHealth(zipPath: string): Promise<GtfsHealthSummary> {
  assert.ok(zipPath, 'zipPath は必須です');
  const abs = path.resolve(process.cwd(), zipPath);
  const buf = readFileSync(abs);
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.keys(zip.files);
  const tripsFileName = entries.find((e) => /(^|\/)trips\.txt$/i.test(e));
  if (!tripsFileName) {
    return {
      zipPath: abs,
      entries: entries.sort(),
      hasTrips: false,
      hasBlockIdColumn: false,
      tripsRowCount: 0,
      blockIdNonEmptyCount: 0,
      blockless: false,
    };
  }

  const tripsText = await zip.file(tripsFileName)!.async('string');
  const lines = tripsText.split(/\r?\n/).filter(Boolean);
  const headerLine = lines[0] ?? '';
  const header = headerLine.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
  const hasBlock = header.some((h) => h.toLowerCase() === 'block_id');
  let blockNonEmpty = 0;
  let rows = 0;
  const blockIdx = header.findIndex((h) => h.toLowerCase() === 'block_id');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    rows++;
    if (hasBlock) {
      const cols = line.split(',');
      const v = cols[blockIdx] ?? '';
      if (v && v.trim().replace(/^"|"$/g, '') !== '') blockNonEmpty++;
    }
  }

  const summary: GtfsHealthSummary = {
    zipPath: abs,
    entries: entries.sort(),
    hasTrips: true,
    tripsHeader: header,
    hasBlockIdColumn: hasBlock,
    tripsRowCount: rows,
    blockIdNonEmptyCount: blockNonEmpty,
    blockless: hasBlock && blockNonEmpty === 0,
  };
  return summary;
}

async function main() {
  // Windows/tsx 対応のため、実行スクリプト判定を fileURLToPath + resolve で行う
  const isDirect = (() => {
    try {
      const thisPath = path.resolve(fileURLToPath(import.meta.url));
      const argv1 = path.resolve(process.argv[1] ?? '');
      return thisPath === argv1;
    } catch {
      return false;
    }
  })();

  if (isDirect) {
    const target = process.argv[2];
    if (!target) {
      console.error('Usage: npx tsx tools/gtfsHealthCli.ts <path-to-gtfs.zip>');
      process.exit(2);
    }
    try {
      const s = await gtfsHealth(target);
      // 人間向けの軽い表示＋JSON
      console.log(`ZIP: ${s.zipPath}`);
      if (!s.hasTrips) {
        console.log('trips.txt: NOT FOUND');
      } else {
        console.log(`trips.txt header: ${s.tripsHeader?.join(',')}`);
        console.log(`rows: ${s.tripsRowCount}`);
        console.log(`block_id column: ${s.hasBlockIdColumn ? 'PRESENT' : 'ABSENT'}`);
        console.log(`block_id non-empty rows: ${s.blockIdNonEmptyCount}`);
        console.log(`blockless: ${s.blockless}`);
      }
      console.log('--- JSON ---');
      console.log(JSON.stringify(s, null, 2));
    } catch (e) {
      console.error('gtfsHealth failed:', e);
      process.exit(1);
    }
  }
}

void main();
