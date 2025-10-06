/**
 * tools/encodingScanCli.ts
 * ワークスペース内のテキストファイルをUTF-8として検証し、文字化けの兆候を検出するCLI。
 * 目的は合意済みドキュメントの可読性を保ち、誤ったエンコーディング保存を早期に察知すること。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

const decoder = new TextDecoder('utf-8', { fatal: true });
const REPLACEMENT_PLACEHOLDER = '\uFFFD';

const SKIP_DIRS = new Set([
  '.git',
  '.husky',
  '.turbo',
  '.vscode',
  '.idea',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'playwright-report',
  'test-results',
  'logs',
]);

const SKIP_EXTS = new Set([
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.icns',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.mp3',
  '.mp4',
  '.mov',
  '.pdf',
  '.log',
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5MB safety guard

const HALFWIDTH_KATAKANA_RANGE = { start: 0xff61, end: 0xff9f };
const FULLWIDTH_LATIN_RANGE = { start: 0xff01, end: 0xff5e };
// 許容する全角記号（日本語ドキュメントで一般的に使用され誤検知が多い）
const ALLOWED_FULLWIDTH_CODEPOINTS = new Set<number>([
  0xff08, // （ FULLWIDTH LEFT PARENTHESIS
  0xff09, // ） FULLWIDTH RIGHT PARENTHESIS
  0xff06, // ＆ FULLWIDTH AMPERSAND (ドラッグ＆ドロップ等)
  0xff0b, // ＋ FULLWIDTH PLUS SIGN（文中の並列表現で一般的）
  0xff0f, // ／ FULLWIDTH SOLIDUS（区切りとして一般的）
  0xff0c, // ， FULLWIDTH COMMA（和文で一般的）
  0xff1a, // ： FULLWIDTH COLON（和文で一般的）
  0xff1d, // ＝ FULLWIDTH EQUALS SIGN（和文表記で一般的）
  0xff1f, // ？ FULLWIDTH QUESTION MARK（和文で一般的）
]);

export type IssueType =
  | 'INVALID_UTF8'
  | 'REPLACEMENT_CHAR'
  | 'HALFWIDTH_KATAKANA'
  | 'FULLWIDTH_LATIN';

export interface ScanIssue {
  type: IssueType;
  message: string;
  position?: { line: number; column: number };
  snippet?: string;
}

export interface ScanResult {
  file: string;
  issues: ScanIssue[];
}

function isDirentSkippable(direntName: string): boolean {
  return SKIP_DIRS.has(direntName) || direntName.startsWith('.git');
}

function isBinaryExtension(filePath: string): boolean {
  return SKIP_EXTS.has(path.extname(filePath).toLowerCase());
}

async function collectFiles(startPaths: string[], root: string): Promise<string[]> {
  const queue = startPaths.map((p) => path.resolve(root, p));
  const files: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    const stat = await fs.stat(current).catch(() => null);
    if (!stat) continue;

    if (stat.isDirectory()) {
      const dirName = path.basename(current);
      if (isDirentSkippable(dirName)) continue;

      const dirents = await fs.readdir(current, { withFileTypes: true });
      for (const dirent of dirents) {
        if (dirent.isDirectory() && isDirentSkippable(dirent.name)) {
          continue;
        }
        queue.push(path.join(current, dirent.name));
      }
      continue;
    }

    if (stat.size > MAX_BYTES) continue;
    if (isBinaryExtension(current)) continue;

    files.push(current);
  }

  return files.sort();
}

function locatePosition(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function makeSnippet(text: string, index: number, radius = 30): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export async function scanPaths(paths: string[], root = process.cwd()): Promise<ScanResult[]> {
  const files = await collectFiles(paths.length > 0 ? paths : ['.'], root);
  const results: ScanResult[] = [];

  for (const filePath of files) {
    const issues: ScanIssue[] = [];
    const buffer = await fs.readFile(filePath);

    let text: string | null = null;

    try {
      text = decoder.decode(buffer);
    } catch (error) {
      issues.push({
        type: 'INVALID_UTF8',
        message: 'UTF-8としてデコードできないバイト列を検出しました。',
      });
    }

    if (text) {
      const replacementIndex = text.indexOf(REPLACEMENT_PLACEHOLDER);
      if (replacementIndex !== -1) {
        const position = locatePosition(text, replacementIndex);
        issues.push({
          type: 'REPLACEMENT_CHAR',
          message: `置換文字（${REPLACEMENT_PLACEHOLDER}）が含まれています。文字化けの可能性があります。`,
          position,
          snippet: makeSnippet(text, replacementIndex),
        });
      }

      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code >= HALFWIDTH_KATAKANA_RANGE.start && code <= HALFWIDTH_KATAKANA_RANGE.end) {
          const position = locatePosition(text, i);
          issues.push({
            type: 'HALFWIDTH_KATAKANA',
            message: `半角カナ（U+${code.toString(16).toUpperCase()}）が含まれています。文字化け（Shift_JIS→UTF-8変換漏れ）の可能性があります。`,
            position,
            snippet: makeSnippet(text, i),
          });
          break;
        }
      }

      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (
          code >= FULLWIDTH_LATIN_RANGE.start &&
          code <= FULLWIDTH_LATIN_RANGE.end &&
          !ALLOWED_FULLWIDTH_CODEPOINTS.has(code)
        ) {
          const position = locatePosition(text, i);
          issues.push({
            type: 'FULLWIDTH_LATIN',
            message: `全角英数字（U+${code.toString(16).toUpperCase()}）が含まれています。エンコード変換ミスや全角英数字の混入が疑われます。`,
            position,
            snippet: makeSnippet(text, i),
          });
          break;
        }
      }
    }

    if (issues.length > 0) {
      results.push({
        file: path.relative(root, filePath) || path.basename(filePath),
        issues,
      });
    }
  }

  return results;
}

interface CliOptions {
  json: boolean;
  paths: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { json: false, paths: [] };
  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true;
    } else {
      options.paths.push(arg);
    }
  }
  return options;
}

async function runCli(): Promise<void> {
  const { paths, json } = parseArgs(process.argv.slice(2));
  const defaultTargets = ['docs', 'src', 'tools', 'readme.md'];
  const targets = paths.length > 0 ? paths : defaultTargets;
  const results = await scanPaths(targets);

  if (json) {
    console.log(JSON.stringify({ issues: results }, null, 2));
    process.exit(results.length > 0 ? 1 : 0);
    return;
  }

  if (results.length === 0) {
    console.log('文字化けの兆候は見つかりませんでした。');
    return;
  }

  console.error(`文字化けの可能性があるファイル: ${results.length}件`);
  for (const result of results) {
    console.error(`- ${result.file}`);
    for (const issue of result.issues) {
      const location = issue.position
        ? ` (line ${issue.position.line}, col ${issue.position.column})`
        : '';
      console.error(`    • ${issue.message}${location}`);
      if (issue.snippet) {
        console.error(`      snippet: ${issue.snippet}`);
      }
    }
  }
  process.exitCode = 1;
}

const isDirectRun = (() => {
  const currentFile = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return currentFile === invoked;
})();

if (isDirectRun) {
  runCli().catch((error) => {
    console.error('encodingScanCli: 実行中にエラーが発生しました。');
    console.error(error);
    process.exit(1);
  });
}
