/**
 * tools/encodingScanCli.ts
 * Minimal encoding hygiene checker for UTF-8 project files.
 * Detects invalid UTF-8, replacement characters, halfwidth katakana, and
 * disallowed fullwidth Latin characters. Provides a tiny CLI plus a reusable
 * `scanPaths` helper for tests.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

const decoder = new TextDecoder('utf-8', { fatal: true });
const REPLACEMENT_PLACEHOLDER = '\uFFFD';

const SKIP_DIRS = new Set([
  '.git',
  '.github',
  '.husky',
  '.turbo',
  '.vscode',
  '.idea',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'logs',
  'tmp',
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
const ALLOWED_FULLWIDTH_CODEPOINTS = new Set<number>([
  0xff08, // FULLWIDTH LEFT PARENTHESIS
  0xff09, // FULLWIDTH RIGHT PARENTHESIS
  0xff06, // FULLWIDTH AMPERSAND
  0xff0b, // FULLWIDTH PLUS SIGN
  0xff0f, // FULLWIDTH SOLIDUS
  0xff0c, // FULLWIDTH COMMA
  0xff1a, // FULLWIDTH COLON
  0xff1d, // FULLWIDTH EQUALS SIGN
  0xff1f, // FULLWIDTH QUESTION MARK
  0xff3b, // FULLWIDTH LEFT SQUARE BRACKET
  0xff3d, // FULLWIDTH RIGHT SQUARE BRACKET
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

function makeSnippet(text: string, index: number, radius = 12): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ');
}

function detectIssues(buffer: Buffer): ScanIssue[] {
  const issues: ScanIssue[] = [];
  let decoded = '';

  try {
    decoded = decoder.decode(buffer);
  } catch {
    issues.push({
      type: 'INVALID_UTF8',
      message: 'Invalid UTF-8 sequence detected.',
    });
    return issues;
  }

  const replacementIndex = decoded.indexOf(REPLACEMENT_PLACEHOLDER);
  if (replacementIndex !== -1) {
    issues.push({
      type: 'REPLACEMENT_CHAR',
      message: 'Replacement character (\uFFFD) found. Check source encoding.',
      position: locatePosition(decoded, replacementIndex),
      snippet: makeSnippet(decoded, replacementIndex),
    });
  }

  for (let i = 0; i < decoded.length; i += 1) {
    const code = decoded.charCodeAt(i);
    if (code >= HALFWIDTH_KATAKANA_RANGE.start && code <= HALFWIDTH_KATAKANA_RANGE.end) {
      issues.push({
        type: 'HALFWIDTH_KATAKANA',
        message: `Halfwidth katakana detected (U+${code.toString(16).toUpperCase()}).`,
        position: locatePosition(decoded, i),
        snippet: makeSnippet(decoded, i),
      });
      break;
    }
  }

  for (let i = 0; i < decoded.length; i += 1) {
    const code = decoded.charCodeAt(i);
    if (
      code >= FULLWIDTH_LATIN_RANGE.start &&
      code <= FULLWIDTH_LATIN_RANGE.end &&
      !ALLOWED_FULLWIDTH_CODEPOINTS.has(code)
    ) {
      issues.push({
        type: 'FULLWIDTH_LATIN',
        message: `Disallowed fullwidth Latin character detected (U+${code.toString(16).toUpperCase()}).`,
        position: locatePosition(decoded, i),
        snippet: makeSnippet(decoded, i),
      });
      break;
    }
  }

  return issues;
}

export async function scanPaths(paths: string[], root = process.cwd()): Promise<ScanResult[]> {
  const files = await collectFiles(paths, root);
  const results: ScanResult[] = [];

  for (const file of files) {
    const buffer = await fs.readFile(file);
    const issues = detectIssues(buffer);
    if (issues.length > 0) {
      results.push({
        file: path.relative(root, file) || path.basename(file),
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
  const { json, paths } = parseArgs(process.argv.slice(2));
  const defaultTargets = ['docs', 'src', 'tools', 'readme.md', 'plans.md', 'AGENTS.md'];
  const targets = paths.length > 0 ? paths : defaultTargets;
  const results = await scanPaths(targets);

  if (json) {
    console.log(JSON.stringify({ issues: results }, null, 2));
    process.exit(results.length > 0 ? 1 : 0);
    return;
  }

  if (results.length === 0) {
    console.log('Encoding check passed.');
    return;
  }

  console.error(`Encoding issues detected: ${results.length}`);
  for (const result of results) {
    console.error(`- ${result.file}`);
    for (const issue of result.issues) {
      const location = issue.position ? ` (line ${issue.position.line}, col ${issue.position.column})` : '';
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
    console.error('encodingScanCli: unexpected failure');
    console.error(error);
    process.exit(1);
  });
}
