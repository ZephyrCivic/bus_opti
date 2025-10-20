import { defineConfig, devices } from '@playwright/test';

function readThreshold(): number {
  const env = process.env.SNAP_DIFF_THRESHOLD;
  if (!env) return 0.005; // 0.5%
  const num = Number(env);
  if (Number.isNaN(num) || num < 0) return 0.005;
  return num > 1 ? num / 100 : num / 100; // allow values like 0.5 => 0.5%
}

const baseURL = process.env.APP_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'tests/playwright',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: readThreshold(),
    },
  },
  webServer: {
    command: 'npm run preview',
    reuseExistingServer: true,
    timeout: 30_000,
    url: baseURL,
  },
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
