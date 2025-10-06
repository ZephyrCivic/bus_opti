/**
 * tools/context7Cli.ts
 * Shared Context7 helper used by CLI entry points and the archived MCP bundle.
 */
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_TOKENS = 600;
const BASE_URL = (process.env.CONTEXT7_BASE_URL ?? 'https://context7.com').replace(/\/?$/, '');
const API_KEY = process.env.CONTEXT7_API_KEY;

type Command = 'resolve' | 'docs' | 'help';

export interface Context7CliOptions {
  command: Command;
  query?: string;
  libraryId?: string;
  tokens: number;
  outputPath?: string;
  silent: boolean;
}

interface Context7SearchItem {
  settings: {
    project: string;
    title: string;
    description?: string;
    docsSiteUrl?: string;
  };
  version?: {
    lastUpdateDate?: string;
    totalTokens?: number;
  };
}

interface Context7SearchResponse {
  results: Context7SearchItem[];
}

function validateTokens(raw?: string): number {
  if (!raw) {
    return DEFAULT_TOKENS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`--tokens must be a positive integer: ${raw}`);
  }
  return parsed;
}

export function parseContext7Args(argv: string[]): Context7CliOptions {
  if (argv.length === 0) {
    return { command: 'help', tokens: DEFAULT_TOKENS, silent: false };
  }

  const [commandRaw, ...rest] = argv;
  const command = (commandRaw ?? '').toLowerCase();

  const options: Context7CliOptions = {
    command: command === 'resolve' || command === 'docs' ? (command as Command) : 'help',
    tokens: DEFAULT_TOKENS,
    silent: false,
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) continue;
    if (arg.startsWith('--tokens=')) {
      options.tokens = validateTokens(arg.split('=')[1]);
    } else if (arg === '--tokens') {
      options.tokens = validateTokens(rest[++i]);
    } else if (arg.startsWith('--output=')) {
      options.outputPath = arg.split('=')[1];
    } else if (arg === '--output') {
      options.outputPath = rest[++i];
    } else if (arg === '--silent') {
      options.silent = true;
    } else if (!options.query && command === 'resolve') {
      options.query = arg;
    } else if (!options.libraryId && command === 'docs') {
      options.libraryId = arg;
    }
  }

  if (options.command === 'resolve' && !options.query) {
    throw new Error('resolve command requires a search keyword');
  }

  if (options.command === 'docs' && !options.libraryId) {
    throw new Error('docs command requires a Context7 libraryId (project name)');
  }

  return options;
}

export function buildSearchUrl(query: string): string {
  return `${BASE_URL}/api/search?query=${encodeURIComponent(query)}`;
}

export function buildDocsUrl(libraryId: string, tokens: number): string {
  const trimmed = libraryId.replace(/^\/+/, '');
  return `${BASE_URL}/api/v1/${trimmed}?tokens=${encodeURIComponent(tokens.toString())}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Context7 API error (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/plain' };
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Context7 API error (${response.status}): ${text}`);
  }
  return await response.text();
}

export interface SimplifiedSearchResult {
  libraryId: string;
  title: string;
  description?: string;
  docsSiteUrl?: string;
  lastUpdate?: string;
  totalTokens?: number;
}

export function simplifySearchResults(results: Context7SearchItem[]): SimplifiedSearchResult[] {
  return results.map((item) => ({
    libraryId: item.settings.project,
    title: item.settings.title,
    description: item.settings.description,
    docsSiteUrl: item.settings.docsSiteUrl,
    lastUpdate: item.version?.lastUpdateDate,
    totalTokens: item.version?.totalTokens,
  }));
}

export async function resolveContext7(query: string): Promise<SimplifiedSearchResult[]> {
  const url = buildSearchUrl(query);
  const json = await fetchJson<Context7SearchResponse>(url);
  return simplifySearchResults(json.results ?? []);
}

export async function fetchContext7Docs(libraryId: string, tokens: number): Promise<string> {
  const url = buildDocsUrl(libraryId, tokens);
  return await fetchText(url);
}

async function handleResolve(query: string): Promise<void> {
  const simplified = await resolveContext7(query);
  if (simplified.length === 0) {
    console.log('No matching libraries were found.');
    return;
  }
  for (const entry of simplified) {
    console.log(`- ${entry.title} (${entry.libraryId})`);
    if (entry.description) {
      console.log(`  ${entry.description}`);
    }
    if (entry.docsSiteUrl) {
      console.log(`  docs: ${entry.docsSiteUrl}`);
    }
    if (entry.lastUpdate) {
      console.log(`  lastUpdate: ${entry.lastUpdate}`);
    }
    if (typeof entry.totalTokens === 'number') {
      console.log(`  tokens: ${entry.totalTokens}`);
    }
  }
}

async function handleDocs(libraryId: string, tokens: number, outputPath?: string, silent?: boolean): Promise<void> {
  const docs = await fetchContext7Docs(libraryId, tokens);
  if (outputPath) {
    await writeFile(outputPath, docs, 'utf8');
    if (!silent) {
      console.log(`Wrote ${outputPath}.`);
    }
  } else {
    console.log(docs);
  }
}

function showHelp(): void {
  console.log(`Context7 direct CLI\n\nExamples:\n  npx tsx tools/context7Cli.ts resolve react\n  npx tsx tools/context7Cli.ts docs /websites/react_dev --tokens 800 --output react.txt\n\nOptions:\n  --tokens <number>  Max combined tokens to fetch (default ${DEFAULT_TOKENS})\n  --output <path>    Write results to file instead of stdout\n  --silent           Skip completion message when writing to a file\n`);
}

async function main(): Promise<void> {
  try {
    const options = parseContext7Args(process.argv.slice(2));
    switch (options.command) {
      case 'resolve':
        await handleResolve(options.query!);
        break;
      case 'docs':
        await handleDocs(options.libraryId!, options.tokens, options.outputPath, options.silent);
        break;
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
})();

if (invokedDirectly) {
  void main();
}




