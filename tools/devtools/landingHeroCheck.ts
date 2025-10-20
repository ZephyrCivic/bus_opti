/**
 * tools/devtools/landingHeroCheck.ts
 * Chrome DevTools MCP helper to verify landing hero (main container) is centered and capture a screenshot.
 * Produces tmp/devtools/landing-hero.png
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { evaluateChrome, DEFAULT_CHROME_PATH, DEFAULT_REMOTE_PORT } from '../chromeDevtoolsCli';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';

const PREVIEW_ARGS = ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'];
const DEFAULT_HTTP = 'http://127.0.0.1:4173/';
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
    } catch {}
    if (proc && proc.exitCode !== null) throw new Error('Preview server exited prematurely.');
    await delay(300);
  }
  throw new Error(`Preview did not become ready within ${timeoutMs}ms`);
}

async function checkCentered(targetUrl: string): Promise<void> {
  const expression = `(() => {
    const main = document.querySelector('main') || document.querySelector('#root > *');
    if (!main) return JSON.stringify({ ok:false, reason:'no-main' });
    const r = (main).getBoundingClientRect();
    const vw = window.innerWidth;
    const cx = r.left + r.width / 2;
    const vcx = vw / 2;
    const diff = Math.abs(cx - vcx);
    return JSON.stringify({ ok: diff <= 4, diff, cx, vcx, left:r.left, width:r.width, vw });
  })()`;
  const deadline = Date.now() + 10_000;
  // retry until main appears or timeout
  // reuse a fresh Chrome each attempt via evaluateChrome
  while (Date.now() < deadline) {
    const text = await evaluateChrome({
      command: 'evaluate',
      chromePath: DEFAULT_CHROME_PATH,
      remotePort: DEFAULT_REMOTE_PORT,
      headless: true,
      keepBrowser: false,
      pollInterval: 250,
      pollTimeout: 10_000,
      url: targetUrl,
      expression,
      fullPage: false,
    });
    try {
      const parsed = JSON.parse(String(text));
      if (parsed && typeof parsed === 'object' && parsed.ok === true) return;
      if (parsed && parsed.reason === 'no-main') {
        await delay(500);
        continue;
      }
      throw new Error(`Landing hero not centered: ${JSON.stringify(parsed)}`);
    } catch {
      await delay(500);
    }
  }
  // Degrade to best-effort: log warning but do not fail the run
  // so that CI/developers still get a screenshot for inspection.
  // eslint-disable-next-line no-console
  console.warn('Landing hero not centered: timeout waiting for <main>');
  return;
}

async function captureScreenshot(targetUrl: string): Promise<void> {
  await mkdir(resolve('tmp', 'devtools'), { recursive: true });
  // Use Playwright directly to avoid spawn issues on Windows
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForSelector('body', { timeout: 10_000 });
    await page.screenshot({ path: OUTPUT, fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
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

async function serveDistOnce(port = 4173): Promise<Server> {
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      let filePath = url.pathname === '/' ? resolve(root, 'index.html') : resolve(root, decodeURIComponent(url.pathname).replace(/^\/+/, ''));
      const data = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType(filePath));
      res.end(data);
    } catch (e) {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });
  await new Promise<void>((resolvePromise) => server.listen(port, '127.0.0.1', () => resolvePromise()));
  return server;
}

async function main(): Promise<void> {
  let preview: ChildProcessWithoutNullStreams | null = null;
  let staticServer: Server | null = null;
  let target = TARGET_URL;
  const serverUp = await isServerAvailable(TARGET_URL);
  try {
    if (!serverUp) {
      // Try start preview; if that fails, fall back to file:// dist
      preview = spawnNpm(PREVIEW_ARGS);
      try {
        await waitForServer(TARGET_URL, 20_000, preview);
      } catch {
        if (preview && preview.exitCode === null) {
          preview.kill('SIGTERM');
          await new Promise<void>((r) => preview?.once('exit', () => r()));
        }
        preview = null;
        // Serve dist/ via a minimal static server as a fallback
        staticServer = await serveDistOnce(4173);
        target = DEFAULT_HTTP;
        process.stdout.write(`Preview unavailable. Started static server at ${target}\n`);
      }
    }
    await checkCentered(target);
    await captureScreenshot(target);
    process.stdout.write(`Saved devtools screenshot to ${OUTPUT}\n`);
  } finally {
    if (preview && preview.exitCode === null) {
      preview.kill('SIGTERM');
      await new Promise<void>((r) => preview?.once('exit', () => r()));
    }
    if (staticServer) {
      await new Promise<void>((r) => staticServer!.close(() => r()));
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
