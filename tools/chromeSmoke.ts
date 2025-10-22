/**
 * tools/chromeSmoke.ts
 * Spins up Vite preview, runs Chrome DevTools CLI evaluate command, and shuts down.
 */
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { evaluateChrome, DEFAULT_CHROME_PATH, DEFAULT_REMOTE_PORT } from './chromeDevtoolsCli';

const PREVIEW_ARGS = ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4174', '--strictPort'];
const SMOKE_URL = 'http://127.0.0.1:4174';
export const EXPECTED_TITLE = 'TS-bus-operation-app';

function spawnNpm(args: string[]): ChildProcessWithoutNullStreams {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...args], { stdio: 'inherit' }) as ChildProcessWithoutNullStreams;
  }
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(command, args, { stdio: 'inherit' });
}

async function waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
}

async function isServerAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(
  url: string,
  timeoutMs = 20_000,
  previewProcess?: ChildProcessWithoutNullStreams | null,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // ignore until timeout
    }
    if (previewProcess?.exitCode !== null) {
      throw new Error('Preview server exited before becoming ready.ポート使用状況を確認してください。');
    }
    await delay(500);
  }
  throw new Error(`Preview server did not become ready within ${timeoutMs}ms`);
}

async function runSmoke(): Promise<void> {
  let preview: ChildProcessWithoutNullStreams | null = null;
  const serverAlreadyRunning = await isServerAvailable(SMOKE_URL);
  try {
    if (!serverAlreadyRunning) {
      preview = spawnNpm(PREVIEW_ARGS);
      await waitForSpawn(preview);
      await waitForServer(SMOKE_URL, 20_000, preview);
    } else {
      console.log(`Detected existing preview at ${SMOKE_URL}, reusing without spawning a new server.`);
    }

    const result = await evaluateChrome({
      command: 'evaluate',
      chromePath: DEFAULT_CHROME_PATH,
      remotePort: DEFAULT_REMOTE_PORT,
      url: SMOKE_URL,
      expression: 'document.title',
      headless: true,
      keepBrowser: false,
      userDataDir: undefined,
      pollTimeout: 10_000,
      pollInterval: 250,
      fullPage: false,
      outputPath: undefined,
    });

    const title = String(result).trim();
    if (!title.includes(EXPECTED_TITLE)) {
      throw new Error(`Unexpected title "${title}" (expected to include "${EXPECTED_TITLE}")`);
    }
    console.log(`Chrome smoke succeeded: ${title}`);
  } finally {
    if (preview && preview.exitCode === null) {
      preview.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        preview?.once('exit', () => resolve());
      });
    }
  }
}

const MODULE_PATH = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === MODULE_PATH) {
  void runSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
