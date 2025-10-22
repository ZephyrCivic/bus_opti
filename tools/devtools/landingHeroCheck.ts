/**
 * tools/devtools/landingHeroCheck.ts
 * Chrome DevTools MCP helper to verify landing hero (main container) alignment
 * and capture a screenshot for visual inspection.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer, type Server } from 'node:http';
import type { Page } from 'playwright';

const PREVIEW_HOST = process.env.DEVTOOLS_HOST ?? '127.0.0.1';
const PREVIEW_PORT = Number.parseInt(process.env.DEVTOOLS_PORT ?? '4174', 10);
const BASE_PATH_RAW = process.env.DEVTOOLS_BASE_PATH ?? '/bus_opti/';
const BASE_PATH = BASE_PATH_RAW.endsWith('/') ? BASE_PATH_RAW : `${BASE_PATH_RAW}/`;

const PREVIEW_ARGS = ['run', 'preview'];
const DEFAULT_HTTP = `http://${PREVIEW_HOST}:${PREVIEW_PORT}${BASE_PATH}`;
const TARGET_URL = process.env.DEVTOOLS_TARGET_URL ?? DEFAULT_HTTP;
const OUTPUT = resolve('tmp', 'devtools', 'landing-hero.png');

function spawnNpm(args: string[]): ChildProcessWithoutNullStreams {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...args], { stdio: 'inherit' });
  }
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(command, args, { stdio: 'inherit' });
}

async function isServerAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs = 20_000, proc?: ChildProcessWithoutNullStreams | null): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return;
    } catch {
      // retry
    }
    if (proc && proc.exitCode !== null) throw new Error('Preview server exited prematurely.');
    await delay(300);
  }
  throw new Error(`Preview did not become ready within ${timeoutMs}ms`);
}

function killPortIfBusy(port: number): void {
  if (process.platform === 'win32') {
    const ps = spawnSync('powershell.exe', ['-NoLogo', '-NonInteractive', '-Command', `Get-NetTCPConnection -State Listen -LocalPort ${port} | Select-Object -ExpandProperty OwningProcess`], { encoding: 'utf8' });
    ps.stdout
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .forEach((pid) => {
        spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
      });
    return;
  }
  const lsof = spawnSync('lsof', ['-i', `:${port}`, '-t'], { encoding: 'utf8' });
  lsof.stdout
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((pid) => {
      spawnSync('kill', ['-9', pid], { stdio: 'ignore' });
    });
}

function resolveDistPath(root: string, pathname: string): string {
  let normalized = decodeURIComponent(pathname);
  if (normalized === '/' || normalized === BASE_PATH) {
    return resolve(root, 'index.html');
  }
  if (BASE_PATH !== '/' && normalized.startsWith(BASE_PATH)) {
    normalized = normalized.slice(BASE_PATH.length);
  }
  normalized = normalized.replace(/^\/+/, '');
  if (normalized === '') {
    normalized = 'index.html';
  }
  return resolve(root, normalized);
}

function contentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=UTF-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=UTF-8';
  if (path.endsWith('.css')) return 'text/css; charset=UTF-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function serveDistOnce(port: number, host: string): Promise<Server> {
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${host}:${port}`);
      const filePath = resolveDistPath(root, url.pathname);
      const data = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType(filePath));
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });
  await new Promise<void>((resolvePromise) => server.listen(port, host, () => resolvePromise()))
    .catch((error) => {
      throw new Error(`Failed to start fallback server: ${String(error)}`);
    });
  return server;
}

async function ensureHeroCentered(page: Page): Promise<void> {
  await page.waitForTimeout(500);
  try {
    await page.waitForSelector('main, #root > *', { timeout: 10_000 });
  } catch {
    console.warn('Landing hero not centered: timeout waiting for <main>');
    return;
  }
  const result = await page.evaluate(() => {
    const candidate = document.querySelector('main') ?? document.querySelector('#root > *');
    if (!candidate) return { ok: false, reason: 'no-main' };
    const rect = candidate.getBoundingClientRect();
    const viewportCenter = window.innerWidth / 2;
    const elementCenter = rect.left + rect.width / 2;
    const diff = Math.abs(viewportCenter - elementCenter);
    return { ok: diff <= 4, diff };
  });
  if (!result?.ok) {
    console.warn(`Landing hero not centered: diff=${result?.diff ?? 'unknown'}px`);
  }
}

async function runPlaywrightTasks(targetUrl: string): Promise<() => Promise<void>> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 960, height: 800 } });
  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
  await ensureHeroCentered(page);
  await mkdir(resolve('tmp', 'devtools'), { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  return async () => {
    await context.close();
    await browser.close();
  };
}

async function main(): Promise<void> {
  let preview: ChildProcessWithoutNullStreams | null = null;
  let staticServer: Server | null = null;
  let cleanupPage: (() => Promise<void>) | null = null;
  let target = TARGET_URL;
  const serverUp = await isServerAvailable(TARGET_URL);
  let startedPreview = false;
  try {
    if (!serverUp) {
      killPortIfBusy(PREVIEW_PORT);
      preview = spawnNpm(PREVIEW_ARGS);
      startedPreview = true;
      try {
        await waitForServer(TARGET_URL, 20_000, preview);
      } catch (error) {
        if (preview && preview.exitCode === null) {
          preview.kill('SIGTERM');
          await new Promise<void>((resolvePromise) => preview?.once('exit', () => resolvePromise()));
        }
        preview = null;
        staticServer = await serveDistOnce(PREVIEW_PORT, PREVIEW_HOST);
        target = DEFAULT_HTTP;
        process.stdout.write(`Preview unavailable. Started static server at ${target}\n`);
      }
    }
    cleanupPage = await runPlaywrightTasks(target);
    process.stdout.write(`Saved devtools screenshot to ${OUTPUT}\n`);
  } finally {
    if (cleanupPage) {
      await cleanupPage();
    }
    if (preview && preview.exitCode === null) {
      preview.kill('SIGTERM');
      await new Promise<void>((resolvePromise) => preview?.once('exit', () => resolvePromise()));
    }
    if (staticServer) {
      await new Promise<void>((resolvePromise) => staticServer!.close(() => resolvePromise()));
    }
    if (startedPreview) {
      // best-effort: ensure no orphan preview remains on the port
      await delay(200);
      killPortIfBusy(PREVIEW_PORT);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
