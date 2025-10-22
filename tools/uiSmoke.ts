/**
 * tools/uiSmoke.ts
 * Headless Chrome smoke checks for key UI sections using the Chrome DevTools CLI helper.
 */
import { DEFAULT_CHROME_PATH, DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT, DEFAULT_REMOTE_PORT, evaluateChrome, type ChromeCliOptions } from './chromeDevtoolsCli';

type Check = {
  id: string;
  description: string;
  expression: string;
  validate: (result: string) => boolean;
  failureMessage: string;
};

const TARGET_URL = process.env.UI_SMOKE_URL ?? 'http://localhost:5173/';

function buildSectionExpression(sectionId: string, expectedHeading: string): string {
  return `
    (() => {
      const select = document.getElementById('app-mobile-nav');
      if (select) {
        select.value = '${sectionId}';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const button = document.querySelector('aside nav button[data-section="${sectionId}"]');
        if (button) button.click();
      }
      const heading = document.querySelector('main h2');
      return heading ? heading.textContent.trim() : '';
    })()
  `;
}

function buildOverlayCheckExpression(): string {
  return `
    (() => {
      const overlay = document.querySelector('#vite-error-overlay');
      return overlay ? overlay.textContent : '';
    })()
  `;
}

const checks: Check[] = [
  {
    id: 'mobile-nav-select',
    description: 'モバイルナビゲーションのセレクトが描画される',
    expression: '(() => Boolean(document.getElementById("app-mobile-nav")).toString())()',
    validate: (result) => result === 'true',
    failureMessage: 'モバイル用ナビゲーションの select 要素が見つかりません。',
  },
  {
    id: 'import-heading',
    description: 'Import セクションのナビゲーションラベル',
    expression: `
      (() => {
        const desktopNav = document.querySelector('aside nav button[data-section="import"] span');
        if (desktopNav && desktopNav.textContent) {
          return desktopNav.textContent.trim();
        }
        const mobileOption = document.querySelector('#app-mobile-nav option[value="import"]');
        return mobileOption?.textContent?.trim() ?? '';
      })()
    `,
    validate: (result) => result === 'GTFS取込・保存データから再開',
    failureMessage: 'Import セクションのナビゲーションラベルが期待どおりではありません（GTFS取込・保存データから再開）。',
  },
  {
    id: 'blocks-heading',
    description: '行路編集セクションの見出し',
    expression: buildSectionExpression('blocks', '行路編集'),
    validate: (result) => result === '行路編集',
    failureMessage: 'Blocks セクションの見出しが期待どおりではありません（行路編集）。',
  },
  {
    id: 'duties-heading',
    description: '勤務編集セクションの見出し',
    expression: buildSectionExpression('duties', '勤務編集'),
    validate: (result) => result === '勤務編集',
    failureMessage: 'Duties セクションの見出しが期待どおりではありません（勤務編集）。',
  },
  {
    id: 'dashboard-heading',
    description: '運行指標ダッシュボードの見出し',
    expression: buildSectionExpression('dashboard', '運行指標ダッシュボード'),
    validate: (result) => result === '運行指標ダッシュボード',
    failureMessage: 'Dashboard セクションの見出しが期待どおりではありません（運行指標ダッシュボード）。',
  },
  {
    id: 'diff-heading',
    description: '差分・出力セクションの見出し',
    expression: buildSectionExpression('diff', '差分・出力'),
    validate: (result) => result === '差分・出力',
    failureMessage: 'Diff セクションの見出しが期待どおりではありません（差分・出力）。',
  },
  {
    id: 'manual-heading',
    description: '手動データ管理セクションの読み込み',
    expression: buildSectionExpression('manual', '連携設定'),
    validate: (result) => result.includes('連携設定'),
    failureMessage: 'Manual セクションの表示が期待どおりではありません（連携設定カードが見つからない）。',
  },
  {
    id: 'vite-overlay',
    description: 'Vite エラーバナーが表示されていない',
    expression: buildOverlayCheckExpression(),
    validate: (result) => result.trim().length === 0,
    failureMessage: 'Vite エラーオーバーレイが DOM 上に存在します。',
  },
];

async function runCheck(check: Check): Promise<void> {
  const options: ChromeCliOptions = {
    command: 'evaluate',
    chromePath: DEFAULT_CHROME_PATH,
    remotePort: DEFAULT_REMOTE_PORT,
    headless: true,
    keepBrowser: false,
    pollTimeout: DEFAULT_POLL_TIMEOUT,
    pollInterval: DEFAULT_POLL_INTERVAL,
    url: TARGET_URL,
    expression: check.expression,
  };
  const result = await evaluateChrome(options);
  if (!check.validate(result)) {
    throw new Error(`${check.failureMessage}\n実際の返値: ${result}`);
  }
  process.stdout.write(`✔ ${check.description}\n`);
}

async function main(): Promise<void> {
  process.stdout.write(`UI smoke check started against ${TARGET_URL}\n`);
  for (const check of checks) {
    await runCheck(check);
  }
  process.stdout.write('All UI smoke checks passed.\n');
}

main().catch((error) => {
  process.stderr.write(`✘ UI smoke check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
