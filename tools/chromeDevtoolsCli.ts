/**
 * tools/chromeDevtoolsCli.ts
 * Chrome DevTools helper used by CLI entry points and the archived MCP bundle.
 */
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import CDP, { Client as ChromeClient } from 'chrome-remote-interface';

export type ChromeCommand = 'evaluate' | 'help';

export interface ChromeCliOptions {
  command: ChromeCommand;
  chromePath: string;
  remotePort: number;
  url?: string;
  expression?: string;
  headless: boolean;
  keepBrowser: boolean;
  userDataDir?: string;
  pollTimeout: number;
  pollInterval: number;
}

export const DEFAULT_REMOTE_PORT = 9222;
export const DEFAULT_POLL_TIMEOUT = 10000;
export const DEFAULT_POLL_INTERVAL = 250;
export const DEFAULT_CHROME_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome';

function parsePort(raw?: string): number {
  if (!raw) return DEFAULT_REMOTE_PORT;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('remote port must be a positive integer');
  }
  return parsed;
}

function parseTimeout(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('timeout values must be positive integers');
  }
  return parsed;
}

export function parseChromeArgs(argv: string[]): ChromeCliOptions {
  if (argv.length === 0) {
    return {
      command: 'help',
      chromePath: DEFAULT_CHROME_PATH,
      remotePort: DEFAULT_REMOTE_PORT,
      headless: true,
      keepBrowser: false,
      pollTimeout: DEFAULT_POLL_TIMEOUT,
      pollInterval: DEFAULT_POLL_INTERVAL,
    };
  }

  const [commandRaw, ...rest] = argv;
  const command = (commandRaw ?? '').toLowerCase();

  const options: ChromeCliOptions = {
    command: command === 'evaluate' ? 'evaluate' : 'help',
    chromePath: DEFAULT_CHROME_PATH,
    remotePort: DEFAULT_REMOTE_PORT,
    headless: true,
    keepBrowser: false,
    pollTimeout: DEFAULT_POLL_TIMEOUT,
    pollInterval: DEFAULT_POLL_INTERVAL,
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) continue;
    if (arg.startsWith('--chrome-path=')) {
      options.chromePath = arg.split('=')[1];
    } else if (arg === '--chrome-path') {
      options.chromePath = rest[++i];
    } else if (arg.startsWith('--remote-port=')) {
      options.remotePort = parsePort(arg.split('=')[1]);
    } else if (arg === '--remote-port') {
      options.remotePort = parsePort(rest[++i]);
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '--url') {
      options.url = rest[++i];
    } else if (arg.startsWith('--expression=')) {
      options.expression = arg.slice('--expression='.length);
    } else if (arg === '--expression') {
      options.expression = rest[++i];
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg === '--keep-browser') {
      options.keepBrowser = true;
    } else if (arg.startsWith('--user-data-dir=')) {
      options.userDataDir = arg.split('=')[1];
    } else if (arg === '--user-data-dir') {
      options.userDataDir = rest[++i];
    } else if (arg.startsWith('--poll-timeout=')) {
      options.pollTimeout = parseTimeout(arg.split('=')[1], DEFAULT_POLL_TIMEOUT);
    } else if (arg === '--poll-timeout') {
      options.pollTimeout = parseTimeout(rest[++i], DEFAULT_POLL_TIMEOUT);
    } else if (arg.startsWith('--poll-interval=')) {
      options.pollInterval = parseTimeout(arg.split('=')[1], DEFAULT_POLL_INTERVAL);
    } else if (arg === '--poll-interval') {
      options.pollInterval = parseTimeout(rest[++i], DEFAULT_POLL_INTERVAL);
    }
  }

  if (options.command === 'evaluate') {
    options.expression ??= 'document.title';
  }

  return options;
}

async function waitForDevtools(port: number, timeout: number, interval: number): Promise<void> {
  const deadline = Date.now() + timeout;
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until timeout
    }
    await delay(interval);
  }
  throw new Error('Timed out waiting for Chrome DevTools endpoint');
}

async function launchChrome(options: ChromeCliOptions, userDataDir: string): Promise<ChildProcessWithoutNullStreams> {
  const args = [
    `--remote-debugging-port=${options.remotePort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    '--disable-extensions',
    '--disable-background-networking',
    options.headless ? '--headless=new' : '--start-maximized',
    'about:blank',
  ];

  const chrome = spawn(options.chromePath, args, {
    stdio: 'ignore',
    detached: false,
  });

  chrome.on('error', (error) => {
    console.error(`Failed to launch Chrome: ${error}`);
  });

  return chrome;
}

async function waitForLoad(session: ChromeClient): Promise<void> {
  const readyScript = `new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
      return;
    }
    window.addEventListener('load', () => resolve(), { once: true });
  });`;
  await session.Runtime.evaluate({ expression: readyScript, awaitPromise: true });
}

function formatEvaluationResult(value: unknown): string {
  if (value === null || value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function evaluateExpression(options: ChromeCliOptions): Promise<string> {
  const tempDir = options.userDataDir ?? await mkdtemp(join(tmpdir(), 'chrome-devtools-'));
  const cleanTempDir = !options.userDataDir;
  const chrome = await launchChrome(options, tempDir);
  let resultText = 'undefined';
  try {
    await waitForDevtools(options.remotePort, options.pollTimeout, options.pollInterval);
    const host = '127.0.0.1';
    const client = await CDP({ host, port: options.remotePort });
    try {
      const { Target } = client;
      const { targetId } = await Target.createTarget({ url: 'about:blank' });
      const session = await CDP({ host, port: options.remotePort, target: targetId });
      try {
        await session.Page.enable();
        await session.Runtime.enable();
        if (options.url) {
          await session.Page.navigate({ url: options.url, transitionType: 'typed' });
          await waitForLoad(session);
        }
        const evaluation = await session.Runtime.evaluate({
          expression: options.expression!,
          returnByValue: true,
        });
        if (evaluation.exceptionDetails) {
          const message = evaluation.exceptionDetails.text ?? 'Unknown error';
          throw new Error(`Evaluation threw an exception: ${message}`);
        }
        resultText = formatEvaluationResult(evaluation.result?.value);
      } finally {
        await session.close();
        await Target.closeTarget({ targetId }).catch(() => undefined);
      }
    } finally {
      await client.close();
    }
  } finally {
    if (!options.keepBrowser) {
      if (chrome.exitCode === null) {
        chrome.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          chrome.once('exit', () => resolve());
        });
      }
    }
    if (!options.keepBrowser && cleanTempDir) {
      await delay(200);
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  return resultText;
}

export async function evaluateChrome(options: ChromeCliOptions): Promise<string> {
  return await evaluateExpression(options);
}

function showHelp(): void {
  console.log(`Chrome DevTools direct CLI\n\nExample:\n  npx tsx tools/chromeDevtoolsCli.ts evaluate --url https://example.com --expression "document.title"\n\nOptions:\n  --chrome-path <path>   Path to Chrome executable (default platform specific)\n  --remote-port <port>   Remote debugging port (default ${DEFAULT_REMOTE_PORT})\n  --url <url>            Page URL to open before evaluation\n  --expression <js>      JavaScript snippet to evaluate (default document.title)\n  --headed               Launch Chrome with UI instead of headless\n  --keep-browser         Leave Chrome running after evaluation\n  --user-data-dir <dir>  Use existing Chrome profile directory\n  --poll-timeout <ms>    Max wait for DevTools availability (default ${DEFAULT_POLL_TIMEOUT})\n  --poll-interval <ms>   Poll interval while waiting (default ${DEFAULT_POLL_INTERVAL})\n`);
}

async function main(): Promise<void> {
  try {
    const options = parseChromeArgs(process.argv.slice(2));
    switch (options.command) {
      case 'evaluate': {
        const result = await evaluateChrome(options);
        console.log(result);
        break;
      }
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
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
})();

if (invokedDirectly) {
  void main();
}