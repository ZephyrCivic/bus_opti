<!--
  docs/TODO_2.md
  場所: docs/
  趣旨: デプロイ前の仕上げ（安全網と微修正）の指針とTODOを一元管理。
  形式: チェックボックス [ ] / [x]。各項目に DoD と関連コマンドを明記。
-->

# TODO_2（デプロイ前の仕上げ）

Motto: "Small, clear, safe steps — always grounded in real docs."

## 前提・原則
- 変更は最小・安全・可逆（reversible）。設計通りに動くかを最優先。
- 新規依存は避ける。型・ビルド・エンコーディング・スモークの安全網を強化。
- Context7/Playwright/Chrome DevTools は `npx tsx tools/<name>Cli.ts ...` が唯一のサポート経路。

## 現状サマリ（2025-10-08 時点）
- テスト緑: `npm test` → 142/142 pass（node:test + tsx）
- ビルド成功: `npm run build` → dist 生成。初回 JS バンドル ~1.61 MB（Vite 警告）
- エンコーディング検査: `npm run scan:encoding -- --json` → 問題なし
- CI あり: `.github/workflows/ci.yml` で Encoding Scan と Unit Test 実行
- CLIs 整備済み: `tools/context7Cli.ts` / `tools/playwrightCli.ts` / `tools/chromeDevtoolsCli.ts`（引数検証テストあり）

---

## P0（最優先・SLA: デプロイ前に必須）

- [x] タイトル表記の統一（Smoke不一致の解消）
  - DoD: `npm run smoke:chrome` が成功し、`document.title` に期待値が含まれる。
  - 対象: `index.html:12`、`src/components/layout/AppShell.tsx:7`（`APP_NAME`）、`tools/chromeSmoke.ts`（`EXPECTED_TITLE`）
  - コマンド: `npx tsx tools/chromeDevtoolsCli.ts evaluate --url http://127.0.0.1:4173 --expression "document.title"`

- [x] CI に型検査を追加（型破綻の早期検知）
  - DoD: CI で `npm run typecheck` が通る。ローカルでも `tsc --noEmit` が緑。
  - 対象: `package.json`（`scripts.typecheck` 追加）、`.github/workflows/ci.yml`（Type check ステップ追加）
  - コマンド: `npm run typecheck`

- [x] CI に本番ビルドを追加（依存・設定の破綻検知）
  - DoD: CI で `npm run build` が成功。
  - 対象: `.github/workflows/ci.yml`
  - コマンド: `npm run build`

---

## P1（小さな改善: 体感と保守性の向上。動作変更なし）

- [x] 初期ロードの軽量化（安全なコード分割）
  - 内容: `src/App.tsx` を `React.lazy` + `Suspense` でタブ別コード分割（まず `ExplorerView` を遅延読込）。
  - DoD: 初回 JS チャンクのサイズ削減、Vite の chunk 警告が緩和/消失。
  - 参考: dist サイズ確認（`ls -lh dist/assets`）。

- [x] エラーバウンダリの導入（アプリ落ちの局所化）
  - 内容: `AppShell` 直下に簡易 ErrorBoundary を追加し、予期せぬ例外時にトースト＋フォールバック表示。
  - DoD: 意図的例外でフォールバックが表示され、リロードで復帰。ユニットテストは全緑のまま。

- [x] 300 LOC 超ファイルの分割（コメントヘッダ維持）
  - 対象候補: `src/features/duties/DutiesView.tsx`、`src/features/manual/ManualDataView.tsx`、`src/features/explorer/mapData.ts`、`src/features/timeline/TimelineGantt.tsx`
  - DoD: 1ファイル ≤ 300 LOC（目安）。Public API・挙動は不変。`npm test` 緑。

- [x] ドキュメント微整合（Export UI 表記）
  - 内容: `docs/TODO.md` の「downloadCsv util」記述を、現行実装（`ExportBar`）に合わせて軽微修正。
  - DoD: 関連ドキュメントテストが緑（必要に応じて期待文言更新）。

---

## P2（任意: 運用性・解析性の向上）

- [x] Node バージョンを明示（運用のブレ抑止）
  - 内容: `package.json` に `"engines": { "node": ">=20" }` を追記（CI/README と整合）。
  - 影響: Node 18 環境では npm が注意喚起。社内標準に合わせ判断。

- [x] 本番ソースマップの有効化
  - 内容: `vite.config.ts` に `build: { sourcemap: true }` を設定（事故解析の一次手がかり）。
  - 注意: 公開環境でのソース露出ポリシーに従うこと。

- [x] `DEPLOY.md` の追加（静的ホスティング手順）
  - 内容: GitHub Pages / Cloudflare Pages での公開手順、`base` 設定、タイル配信の注意を簡潔に記載。

---

## 検証コマンド（ローカル）
- 単体テスト: `npm test`
- 型検査: `npm run typecheck`
- 本番ビルド: `npm run build`
- プレビュー: `npm run preview` → http://127.0.0.1:4173
- DevTools スモーク: `npx tsx tools/chromeDevtoolsCli.ts evaluate --url http://127.0.0.1:4173 --expression "document.title"`
- Playwright スクショ: `npx tsx tools/playwrightCli.ts screenshot --url http://127.0.0.1:4173 --output docs/screenshots/playwright-cli.png`

---

## 参考・関連
- 決定ログ: `docs/DECISIONS_2025-10-06.md`
- 既存 TODO: `docs/TODO.md`
- CI: `.github/workflows/ci.yml`
- ユーザー向け: `readme.md`

---

## TODO リスト（実行順の目安）
1) P0（必須）
   - [x] タイトル表記の統一（`index.html` / `AppShell.tsx` / `tools/chromeSmoke.ts`）
   - [x] CI に型検査追加（`package.json` / `.github/workflows/ci.yml`）
   - [x] CI に本番ビルド追加（`.github/workflows/ci.yml`）

2) P1（小さな改善）
   - [x] タブ別コード分割（`src/App.tsx`）
   - [x] ErrorBoundary 追加（`src/components/layout/`）
   - [x] 300 LOC 超ファイルの分割（`DutiesView.tsx` ほか）
   - [x] `docs/TODO.md` 文言の微整合（`ExportBar`）

3) P2（任意）
   - [x] `package.json` に `engines.node` を追加
   - [x] `vite.config.ts` に `build.sourcemap: true`
   - [x] `DEPLOY.md` を追加（静的ホスティング手順）

---

## ロールバック戦略
- すべての変更は小さくコミットし、CI 緑を条件に段階適用。失敗時は直前コミットへ戻す。
- `package.json` と CI は別コミットで分離（影響範囲を限定）。
