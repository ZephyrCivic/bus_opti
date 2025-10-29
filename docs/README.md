---
title: Docs Index (SSOT = plans.md)
date: 2025-10-20
---

# ドキュメント索引（SSOT = plans.md）
モットー: Small, clear, safe steps — always grounded in real docs.

- 作業計画の単一情報源: `plans.md`（最優先で最新化）
- MVPの基本要件: `docs/specs/requirements-blocks-duties.md`
- Blockless 追加要件: `docs/specs/requirements-blocks-duties.addendum.blockless.md`
- 実装計画: `docs/specs/implementation-plan.md`
- UIモック/操作: `docs/specs/ui-mock.md`, `docs/specs/timeline-interactions.md`
- KPI/UX パネル: `docs/specs/kpi-ux-panel.md`
- 配布・監査: `docs/specs/file-write-audit.md`, `docs/specs/output-confirmation.md`
- 参考決定ログ: `docs/DECISIONS_2025-10-06.md` ほか

## サンプルとスキーマ
- デモ用データ: `docs/demo/*`, `data/*.zip`
- CSV テンプレート: `docs/templates/*.template.csv`（初期投入/一括更新/バックアップ用途）
- 制約条件（折返し/交代所/労務ルール 等）は Web UI から直接編集可能（CSVは補助）。

## 主要コマンド
- 単体/統合テスト: `npm test`
- UI スナップショット + DevTools 検証: `make generate-snapshots`
- DevTools 単体チェック: `npm run devtools:landing-hero`
- Import フロー（Playwright）検証: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/import-flow.spec.ts`
- プレビュー起動: `npm run preview`（Runbook の手順を参照し、ポート衝突時は 4174 を解放する）

## Runbook: Vite Preview ポート衝突の解消
1. 占有プロセス確認: `Get-NetTCPConnection -LocalPort 4174 | Select-Object -First 5 LocalAddress,LocalPort,OwningProcess,State`
2. プロセス停止（必要な場合）: `Stop-Process -Id <OwningProcess>`
3. 再試行: `npm run preview`（`--strictPort` により 4174 を利用）
4. 自動フォールバックが必要な場合は `tools/ui-snapshots/runWithPreview.ts` と同じロジックで空きポートを探索しているか確認し、Runbook を再更新する

## Telemetry ログの確認
- Import サマリー上で路線選択を変更すると `import.route-filter.updated`、手動入力ビューへ遷移すると `import.open-manual` が記録される。
- ブラウザコンソールで `window.__TELEMETRY__` または `localStorage.getItem('bus-opti.telemetry.events')` を確認すると最新100件までのイベント内容を確認可能。


## 注意
- 文字コードは UTF-8（BOMなし）、改行は LF を徹底。
- 文字化けを検出するには: `npm run scan:encoding` を使用。
