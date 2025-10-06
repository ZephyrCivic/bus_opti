/**
 * tools/playwrightCli.ts
 * Playwright helper used by CLI entry points and the archived MCP bundle.
 */
import { pathToFileURL } from 'node:url';

type PlaywrightModule = typeof import('playwright');
type Page = import('playwright').Page;
type BrowserContext = import('playwright').BrowserContext;

export type BrowserTarget = 'chromium' | 'firefox' | 'webkit';

type Command = 'screenshot' | 'evaluate' | 'help';

export interface PlaywrightCliOptions {
  command: Command;
  url?: string;
  outputPath?: string;
  browser: BrowserTarget;
  headless: boolean;
  timeout: number;
  waitForSelector?: string;
  waitForTimeout: number;
  script?: string;
  fullPage: boolean;
}

export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_WAIT_TIMEOUT = 10000;
export const DEFAULT_SCREENSHOT = 'playwright-screenshot.png';

function parsePositiveInt(label: string, value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function parsePlaywrightArgs(argv: string[]): PlaywrightCliOptions {
  if (argv.length === 0) {
    return {
      command: 'help',
      browser: 'chromium',
      headless: true,
      timeout: DEFAULT_TIMEOUT,
      waitForTimeout: DEFAULT_WAIT_TIMEOUT,
      fullPage: false,
    };
  }

  const [commandRaw, ...rest] = argv;
  const command = (commandRaw ?? '').toLowerCase();

  const options: PlaywrightCliOptions = {
    command: command === 'screenshot' || command === 'evaluate' ? (command as Command) : 'help',
    browser: 'chromium',
    headless: true,
    timeout: DEFAULT_TIMEOUT,
    waitForTimeout: DEFAULT_WAIT_TIMEOUT,
    fullPage: false,
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) continue;
    if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '--url') {
      options.url = rest[++i];
    } else if (arg.startsWith('--output=')) {
      options.outputPath = arg.split('=')[1];
    } else if (arg === '--output') {
      options.outputPath = rest[++i];
    } else if (arg.startsWith('--browser=')) {
      const candidate = arg.split('=')[1] as BrowserTarget;
      if (candidate === 'chromium' || candidate === 'firefox' || candidate === 'webkit') {
        options.browser = candidate;
      } else {
        throw new Error(`Unsupported browser: ${candidate}`);
      }
    } else if (arg === '--browser') {
      const candidate = rest[++i] as BrowserTarget;
      if (candidate === 'chromium' || candidate === 'firefox' || candidate === 'webkit') {
        options.browser = candidate;
      } else {
        throw new Error(`Unsupported browser: ${candidate}`);
      }
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = parsePositiveInt('--timeout', arg.split('=')[1], DEFAULT_TIMEOUT);
    } else if (arg === '--timeout') {
      options.timeout = parsePositiveInt('--timeout', rest[++i], DEFAULT_TIMEOUT);
    } else if (arg.startsWith('--wait-for=')) {
      options.waitForSelector = arg.split('=')[1];
    } else if (arg === '--wait-for') {
      options.waitForSelector = rest[++i];
    } else if (arg.startsWith('--wait-timeout=')) {
      options.waitForTimeout = parsePositiveInt('--wait-timeout', arg.split('=')[1], DEFAULT_WAIT_TIMEOUT);
    } else if (arg === '--wait-timeout') {
      options.waitForTimeout = parsePositiveInt('--wait-timeout', rest[++i], DEFAULT_WAIT_TIMEOUT);
    } else if (arg === '--no-headless') {
      options.headless = false;
    } else if (arg === '--full-page') {
      options.fullPage = true;
    } else if (arg.startsWith('--script=')) {
      options.script = arg.slice('--script='.length);
    } else if (arg === '--script') {
      options.script = rest[++i];
    } else if (!options.url && options.command !== 'help') {
      options.url = arg;
    }
  }

  if (options.command === 'screenshot') {
    if (!options.url) {
      throw new Error('screenshot command requires a URL');
    }
    options.outputPath ??= DEFAULT_SCREENSHOT;
  }

  if (options.command === 'evaluate') {
    if (!options.url) {
      throw new Error('evaluate command requires a URL');
    }
    if (!options.script) {
      throw new Error('evaluate command requires --script to specify JavaScript to run');
    }
  }

  return options;
}

async function ensurePlaywright(): Promise<PlaywrightModule> {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error('playwright package is required. Install it with "npm install --save-dev playwright".');
  }
}

async function withPage<T>(options: PlaywrightCliOptions, handler: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> {
  const playwright = await ensurePlaywright();
  const browserType = playwright[options.browser];
  if (!browserType) {
    throw new Error(`playwright does not expose browser type: ${options.browser}`);
  }
  const browser = await browserType.launch({ headless: options.headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(options.url!, { timeout: options.timeout, waitUntil: 'load' });
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: options.waitForTimeout });
    }
    return await handler(page, context);
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runPlaywrightScreenshot(options: PlaywrightCliOptions): Promise<string> {
  const output = options.outputPath ?? DEFAULT_SCREENSHOT;
  await withPage(options, async (page) => {
    await page.screenshot({ path: output, fullPage: options.fullPage });
  });
  return output;
}

export async function runPlaywrightEvaluate(options: PlaywrightCliOptions): Promise<string> {
  const result = await withPage(options, async (page) => page.evaluate(options.script!));
  if (typeof result === 'string') {
    return result;
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function showHelp(): void {
  console.log(`Playwright direct CLI\n\nExamples:\n  npx tsx tools/playwrightCli.ts screenshot --url https://example.com --output example.png\n  npx tsx tools/playwrightCli.ts evaluate --url https://example.com --script "return document.title"\n\nOptions:\n  --browser <chromium|firefox|webkit>  Browser engine (default chromium)\n  --timeout <ms>                       Navigation timeout (default ${DEFAULT_TIMEOUT})\n  --wait-for <selector>                Wait for selector before continuing\n  --wait-timeout <ms>                  Selector wait timeout (default ${DEFAULT_WAIT_TIMEOUT})\n  --output <path>                      Screenshot destination (screenshot only)\n  --no-headless                        Launch browser in headed mode\n  --full-page                          Capture full page screenshot\n  --script <js>                        JavaScript to evaluate (evaluate only)\n`);
}

async function main(): Promise<void> {
  try {
    const options = parsePlaywrightArgs(process.argv.slice(2));
    switch (options.command) {
      case 'screenshot': {
        const target = await runPlaywrightScreenshot(options);
        console.log(`Saved screenshot to ${target}`);
        break;
      }
      case 'evaluate': {
        const result = await runPlaywrightEvaluate(options);
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