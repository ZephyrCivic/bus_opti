<!--
  docs/DEPLOY.md
  Purpose: Document repeatable steps for deploying the app to static hosting platforms.
  Scope: GitHub Pages / Cloudflare Pages（社内検証向け） / ローカル preview。
-->

# デプロイ手順ガイド

## 前提
- Node.js 20 以上（`package.json` の `engines` で強制されています）。
- npm 10 以上。
- リポジトリが最新状態で `npm install` 済み。
- ビルド成功を事前確認: `npm run typecheck && npm test && npm run build`

## 1. GitHub Pages（GitHub Actions 公式方式・推奨）

1. `vite.config.ts` の `base` は GitHub Pages 用に `/bus_opti/` をセット済み（別リポジトリ名なら変更）。
2. リポジトリ Settings → Pages の Source を「GitHub Actions」に設定。
3. ワークフロー `.github/workflows/pages.yml` を用意（本リポジトリは同梱済み）。構成:
   - `actions/checkout@v4` → `setup-node@v4 (node 20)` → `npm ci` → `npm run typecheck && npm test` → `npm run build`
   - `cp dist/index.html dist/404.html`（SPA 404 フォールバック）
   - `actions/upload-pages-artifact@v3` で `dist` をアップロード
   - `actions/deploy-pages@v4` で公開
4. `main` に push すると自動でデプロイ。URL は `https://<owner>.github.io/bus_opti/`。

（代替）gh-pages ブランチでの配布を使う場合は従来の `peaceiris/actions-gh-pages` を利用可能。

## 2. Cloudflare Pages（社内検証向け）

1. Cloudflare ダッシュボードで「Pages » Create project » Direct upload」を選択。
2. ビルドコマンド: `npm run build`  
   ビルド出力: `dist`
3. Node バージョンを 20 に設定。環境変数 `NODE_VERSION=20` を追加すると安全。
4. デプロイ後、`dist` 内のアセットが静的配信される。sourcemap が含まれるため、公開設定に合わせて（必要に応じて）`build.sourcemap` を false にして再ビルドすることも検討する。

## 3. ローカルプレビュー

1. `npm run build` 実行。
2. `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort`  
   `http://127.0.0.1:4174` で確認。
3. Chrome DevTools スモーク: `npm run smoke:chrome` でタイトル確認。

## 4. デプロイ前チェックリスト

- [ ] `npm run typecheck` / `npm test` / `npm run build` の成功。
- [ ] `.env` などの秘匿情報がビルド成果物へ含まれていない。
- [ ] `config.py` のターンアラウンドなど環境依存値を確認。
- [ ] sourcemap を公開する場合、ポリシーに沿った運用であること。
- [ ] `docs/DEPLOY.md` 自身が最新手順に追随していること。

## 5. トラブルシューティング

| 症状 | 対処 |
| ---- | ---- |
| GitHub Pages でルーティングが `/` 以外で404 | `vite.config.ts` の `base` をリポジトリ名に設定し、再ビルド。 |
| Cloudflare Pages で Node バージョン mismatch | ビルド環境変数 `NODE_VERSION` を 20 に設定。 |
| `npm run preview` がポート重複で失敗 | `tools/chromeSmoke.ts` は既存プレビューを再利用。不要なサーバーがないか確認。 |

---

必要に応じて SaaS 固有の配信（S3 + CloudFront 等）に展開する際は、`dist/` を静的サイトとしてアップロードし、`/index.html` へのフォールバック設定を行う。
