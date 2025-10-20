# Exec Plan: UIスナップショット自動化（Playwright + Make）

## 全体像

Playwright のビジュアルテストと Chrome DevTools 検証を統合し、`make generate-snapshots` でビルド→ブラウザ取得→スナップ生成→DevTools チェック（ヒーロー中央揃え + スクリーンショット）まで自動化する。

## 進捗状況

- [x] スパイク：既存ツール確認（chromeDevtoolsCli / smoke）
- [x] 機能実装：playwright.config.ts 追加（SNAP_DIFF_THRESHOLD 既定 0.5%）
- [x] 機能実装：tests/playwright/visual.spec.ts 追加（home / blocks）
- [x] Make 互換：make.cmd 追加（初回は baseline 自動生成）
- [x] スクリプト：tools/devtools/landingHeroCheck.ts 追加（中央揃え検証 + 画像出力）
- [ ] ドキュメント更新（README に手順追記）

## 発見と驚き

- リポジトリに GNU Make が無く Windows でも `make` を使いたい → `make.cmd` で互換層を実装し解決。
- AGENTS.md 記載の DevTools スクリプトは未実装だったため、新規に追加して要件を満たした。

## 決定ログ

2025-10-20: Playwright の `webServer` で `vite preview` を自動起動。`SNAP_DIFF_THRESHOLD` は 0.5% を既定（環境変数で上書き可能）。

## To-Do

1. [ ] README に「UI スナップショット手順」を追記
2. [ ] CI に Playwright のヘッドレス実行を組み込む
3. [ ] シナリオ追加（duties/diff/manual など）

