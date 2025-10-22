<!--
  docs/TODO_5.md
  用途: 改善点バックログの第5弾。UI/UXや運用改善の着想を安全に整理する。
  Motto: "Small, clear, safe steps — always grounded in real docs."
-->

# TODO_5（改善ログ）

## 方針
- 小さく安全な改修を優先し、影響範囲をドキュメントで裏付ける。
- 既存TODOとの重複を避け、完了後は関連ドキュメントへ記録を移す。
- 変更前後で検証方法（CLI・手動手順）を必ず紐づける。

## 利用ルール
- 各項目はチェックボックス `[ ] / [x]` を用いる。完了時は関連コミットや決定ログを明記する。
- 優先度は P0（緊急）/P1（重要）/P2（改善）で分類し、レビュー観点や検証コマンドを添える。
- 追加調査が必要な場合は `Pending` セクションへメモを残し、期限や担当を設定する。

## P0（緊急対応）
- [ ] 項目サンプル: 例）「プレビューでのレイアウト崩れ再発」  
  - DoD: Chrome DevTools CLI で再現幅のスクリーンショットを取得し、修正後に差分確認。  
  - コマンド: `npx tsx tools/chromeDevtoolsCli.ts screenshot --url http://127.0.0.1:4174 --output docs/screenshots/layout-regression.png --full-page`

## P1（重要改善）
- [ ] 項目サンプル: 例）「Playwright スモークのモバイル断面追加」  
  - DoD: `npx tsx tools/playwrightCli.ts screenshot --browser chromium --url http://127.0.0.1:4174 --output docs/screenshots/mobile.png --full-page` が成功する。

## P2（継続改善）
- [ ] 項目サンプル: 例）「i18n テキストの用語統一」  
  - DoD: `npm test -- tests/i18n.*.test.ts` が緑で、決定ログに記録済み。

## Pending（調査・メモ）
- [ ] 調査テーマ:  
  - 背景:  
  - 次アクション / 期限:

## 完了履歴
- [ ] 完了時にここへ移動し、参照コミットや関連ドキュメント（例: `docs/DECISIONS_YYYY-MM-DD.md`）を記載する。
