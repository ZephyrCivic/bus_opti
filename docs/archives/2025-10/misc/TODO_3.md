<!--
  docs/TODO_3.md
  目的: Chrome DevTools CLI を用いた E2E シナリオの記録と実行結果の共有。
  備考: Motto「Small, clear, safe steps — always grounded in real docs.」
-->

# TODO_3（Chrome DevTools CLI E2E シナリオ）

## 前提条件
- `npm run dev` で Vite 開発サーバーが `http://localhost:5173/` で稼働していること。
- Chrome DevTools CLI（`npx tsx tools/chromeDevtoolsCli.ts`）を実行できること。
- ブラウザのローカルストレージに既存の GTFS インポートデータが残っていても結果に影響しないことを確認済み。

## シナリオ概要
- 目的: MVP UI がエラーオーバーレイなしで起動し、Import タブの主要要素（タイトル・ステータス・ドロップゾーン文言）が表示されていることを自動化で検証する。
- 成功条件:
  1. ページタイトルが `TS-bus-operation-app` である。
  2. タブ UI に `Import / Explorer / Blocks / Duties / Dashboard / Diff / Manual` が揃っており、`Import` が `active`。
  3. Import パネルのテキストに `ZIP` と `status: idle` が含まれている。
  4. Vite のエラーオーバーレイが DOM 上に存在しない。

## 手順と期待結果

1. **タイトル確認**
   ```sh
   npx tsx tools/chromeDevtoolsCli.ts evaluate --url http://localhost:5173 --expression "document.title"
   ```
   - 期待結果: `TS-bus-operation-app`

2. **タブ構成の検査**
   ```sh
   python -c "import subprocess, json; expr = \"(() => Array.from(document.querySelectorAll('button[role=\\\\\\\"tab\\\\\\\"]')).map(btn => ({ text: btn.textContent.trim(), state: btn.getAttribute('data-state') })) )()\"; cmd = f'npx tsx tools/chromeDevtoolsCli.ts evaluate --url http://localhost:5173 --expression \\\"{expr}\\\"'; result = subprocess.run(cmd, shell=True, capture_output=True, text=True); print(result.stdout)"
   ```
   - 期待結果: 配列内に 7 件、`Import` が `active`、他は `inactive`。

3. **Import パネルの文言確認**
   ```sh
   npx tsx tools/chromeDevtoolsCli.ts evaluate --url http://localhost:5173 --expression "(() => ({ hasZipCopy: document.body.textContent.includes('ZIP'), hasIdleStatus: document.body.textContent.includes('status: idle') }))()"
   ```
   - 期待結果: `{"hasZipCopy":true,"hasIdleStatus":true}`

4. **エラーオーバーレイの有無確認**
   ```sh
   npx tsx tools/chromeDevtoolsCli.ts evaluate --url http://localhost:5173 --expression "(() => document.querySelector('#vite-error-overlay') === null)()"
   ```
   - 期待結果: `true`

## 備考
- 文字列出力で日本語が文字化けする既知の課題があるため、文字列一致は ASCII を含む断片（`ZIP`、`status: idle`）で評価している。
- タブ切り替え操作は CLI の非同期対応が未実装のため、状態確認に留めた。
- 実行ログは 2025-10-09 時点の結果。開発サーバー設定変更時は再実行すること。
