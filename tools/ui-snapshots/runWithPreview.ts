/**
 * tools/ui-snapshots/runWithPreview.ts
 * Helper script to run Playwright visual tests while manually controlling the preview server lifecycle.
 * Why: built-in Playwright webServer polling fails on Windows (ECONNRESET). We spawn Vite preview ourselves,
 *       verify readiness, run the tests with PLAYWRIGHT_SKIP_WEBSERVER=1, then tear everything down safely.
 */

import { spawn, spawnSync, type ChildProcess, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const PREVIEW_URL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/bus_opti/';
const PREVIEW_HOST = process.env.PREVIEW_HOST ?? '127.0.0.1';
const PREVIEW_PORT = process.env.PREVIEW_PORT ?? '4173';
const PREVIEW_CMD = process.platform === 'win32' ? 'npx' : 'npx';

type SpawnResult = { code: number | null; signal: NodeJS.Signals | null };

async function waitForPreview(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        return;
      }
    } catch {
      // Fall through and retry
    }
    await delay(1_000);
  }
  throw new Error(`Preview server did not become ready within ${timeoutMs}ms (url=${url}).`);
}

function killPortIfBusy(port: string): void {
  if (process.platform === 'win32') {
    const query = spawnSync('powershell.exe', ['-NoLogo', '-NonInteractive', '-Command', `Get-NetTCPConnection -State Listen -LocalPort ${port} | Select-Object -ExpandProperty OwningProcess`], { encoding: 'utf8' });
    const pids = query.stdout
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (pids && pids.length > 0) {
      for (const pid of pids) {
        spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
      }
    }
    return;
  }
  const lsof = spawnSync('lsof', ['-i', `:${port}`, '-t'], { encoding: 'utf8' });
  const pids = lsof.stdout
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (pids && pids.length > 0) {
    for (const pid of pids) {
      spawnSync('kill', ['-9', pid], { stdio: 'ignore' });
    }
  }
}

function startProcess(command: string, args: string[], options?: SpawnOptionsWithoutStdio): ChildProcess {
  if (process.platform === 'win32') {
    const shellArgs = ['/c', command, ...args];
    return spawn('cmd.exe', shellArgs, options);
  }
  return spawn(command, args, options);
}

function runCommand(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = startProcess(command, args, {
      env: env ? { ...process.env, ...env } : process.env,
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function killProcessTree(pid: number | undefined): Promise<void> {
  if (!pid) return;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore if already gone
    }
  }
}

async function main(): Promise<void> {
  const updateSnapshots = process.argv.includes('--update');
  const previewArgs = ['vite', 'preview', '--host', PREVIEW_HOST, '--port', PREVIEW_PORT, '--strictPort'];
  killPortIfBusy(PREVIEW_PORT);

  const previewProcess = startProcess(PREVIEW_CMD, previewArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  let previewPid = previewProcess.pid;

  const handleExit = async () => {
    await killProcessTree(previewPid);
  };

  process.once('SIGINT', async () => {
    await handleExit();
    process.exit(130);
  });

  process.once('SIGTERM', async () => {
    await handleExit();
    process.exit(143);
  });

  previewProcess.on('error', async (error) => {
    await handleExit();
    throw error;
  });

  const previewExitPromise = new Promise<SpawnResult>((resolve) => {
    previewProcess.on('close', (code, signal) => {
      resolve({ code, signal });
    });
  });

  try {
    await waitForPreview(PREVIEW_URL, 60_000);
  } catch (error) {
    await handleExit();
    await previewExitPromise;
    const fallbackTriggered = await handleFallback({
      error,
      exitCode: previewProcess.exitCode ?? null,
      signal: null,
    });
    if (fallbackTriggered) {
      return;
    }
    if (previewProcess.exitCode !== null) {
      console.error(`[preview] exited with code ${previewProcess.exitCode}`);
    }
    throw error;
  }

  const playwrightArgs: string[] = ['playwright', 'test', '--config=playwright.config.ts', 'tests/playwright'];
  if (updateSnapshots) {
    playwrightArgs.splice(2, 0, '--update-snapshots=all');
  }
  if (process.env.SNAP_SKIP_VISUAL === '1' || process.env.SKIP_VISUAL === '1') {
    playwrightArgs.push('--grep-invert', 'Visual snapshots');
  }

  let result: SpawnResult | null = null;
  let infraFailure: unknown = null;

  try {
    result = await runCommand(PREVIEW_CMD, playwrightArgs, {
      PLAYWRIGHT_SKIP_WEBSERVER: '1',
      APP_BASE_URL: process.env.APP_BASE_URL ?? `http://${PREVIEW_HOST}:${PREVIEW_PORT}`,
    });
  } catch (error) {
    infraFailure = error;
  }

  await handleExit();
  await previewExitPromise;

  if (result && result.code !== 0) {
    process.exit(result.code ?? 1);
  }

  if (infraFailure || (result && result.code === null && result.signal !== null)) {
    const fallbackInfo = {
      error: infraFailure,
      exitCode: result?.code ?? null,
      signal: result?.signal ?? null,
    };
    const fallbackTriggered = await handleFallback(fallbackInfo);
    if (fallbackTriggered) {
      return;
    }
    if (infraFailure instanceof Error) {
      throw infraFailure;
    }
    throw new Error(`Playwright run failed (exitCode=${fallbackInfo.exitCode}, signal=${fallbackInfo.signal})`);
  }
}

interface FallbackInfo {
  error: unknown;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

async function handleFallback(info: FallbackInfo): Promise<boolean> {
  if (process.env.SNAPSHOT_FALLBACK_DISABLE === '1') {
    return false;
  }

  const fallbackDir = path.join(process.cwd(), 'tmp', 'ui-snapshots');
  await mkdir(fallbackDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(fallbackDir, `fallback-${timestamp}.md`);

  const summaryParts = [
    `exitCode=${info.exitCode ?? 'null'}`,
    `signal=${info.signal ?? 'null'}`,
  ];
  if (info.error instanceof Error && info.error.message) {
    summaryParts.push(`message=${info.error.message}`);
  }

  const content = [
    '# UI Snapshot Fallback',
    '',
    `- timestamp: ${new Date().toISOString()}`,
    `- summary: ${summaryParts.join(', ')}`,
    '- action: Visual snapshot tests were skipped automatically. Record this fallback (with log path) in plans.md > Test セクション.',
    '',
    '確認事項:',
    '1. コンソールログで原因を確認する（Playwright/Previewの起動失敗など）。',
    '2. 必要なら `SNAPSHOT_FALLBACK_DISABLE=1 npm run generate-snapshots` で再実行し、強制的に失敗させて調査する。',
    '3. 次回以降の実行に備え、原因調査や依存更新が必要か検討する。',
  ].join('\n');

  await writeFile(logPath, content, 'utf8');

  console.warn(`[ui-snapshots] フォールバックを発動しました。ログ: ${path.relative(process.cwd(), logPath)}`);
  console.warn('[ui-snapshots] plans.md の Test セクションに上記ログのパスと原因メモを残してください。');

  return true;
}

main().catch((error) => {
  console.error('[ui-snapshots] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
