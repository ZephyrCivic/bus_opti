# UI スナップショット再利用テンプレート

このディレクトリと `tests/playwright/visual.spec.ts`（および `visual.spec.ts-snapshots/`）を **ワンセット** で他プロジェクトへコピーすると、Playwright ベースのモバイル UI スナップショット基盤を最小構成で再利用できます。

## 構成要素

- `extract_previews.py`  
  - Playwright によるビジュアルテスト実行をラップする Python スクリプト。`pnpm`／`APP_BASE_URL` などの環境設定を自動化。
- `README.md`（本ファイル）  
  - 再利用手順と注意事項。
- `tests/playwright/visual.spec.ts`  
  - 主要画面の撮影シナリオを定義した Playwright テスト。**必ず同時にコピー** する。
- `tests/playwright/visual.spec.ts-snapshots/`  
  - ベースライン画像。Playwright がテスト時に差分比較する。
- `playwright.config.ts`  
  - ベース URL やレポーター設定。既存プロジェクトに無い場合は合わせてコピー。

## 再利用手順（チェックリスト）

1. 依存インストール  
   - `pnpm add -D @playwright/test`  
   - `pnpm exec playwright install chromium`
2. 以下のファイルとディレクトリをコピー  
   - `tools/ui-snapshots/`  
   - `tests/playwright/visual.spec.ts`  
   - `tests/playwright/visual.spec.ts-snapshots/`  
   - `playwright.config.ts`
3. `package.json` にスクリプトを追加  
   - `"test:visual": "playwright test"`  
   - 任意で `"snapshots:update": "playwright test --update-snapshots"`
4. `.gitignore` に `playwright-report/` や生成物が含まれることを確認。
5. `pnpm test:visual` を実行し、ベースラインとの差分が 0.5% 以内であることを確認。

## ヒント

- ベースライン更新は `extract_previews.py --update` で実行可能（内部で `--update-snapshots` を付与）。
- 端末を追加する場合は `tests/playwright/visual.spec.ts` 内の `scenarios` 配列にデバイスを追加する。
- 差分許容値を調整したい場合は、`.env` や CI 設定で `SNAP_DIFF_THRESHOLD` を上書きする。
- 大きな UI 変更後は `playwright-report/` の HTML レポートでスクリーンショット差分を確認するとレビューがスムーズ。
