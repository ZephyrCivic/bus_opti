---
title: Docs Index (SSOT = plans.md)
date: 2025-10-20
---

# ドキュメント索引（SSOT = plans.md）

モットー: Small, clear, safe steps — always grounded in real docs.

- SSOT（単一の実装ガイド）はリポジトリ直下の `plans.md` です。
- MVPに必要な最小ドキュメントだけをここに列挙します。その他は参照（Reference）またはアーカイブ（Archives）として扱います。

## MVP 最小セット（実装に直結）
- 要件（行路/交番/警告定義）: `docs/specs/requirements-blocks-duties.md`
- 追加要件（Blockless補足）: `docs/specs/requirements-blocks-duties.addendum.blockless.md`
- 実装計画（補助）: `docs/specs/implementation-plan.md`
- UIモック/振る舞い: `docs/specs/ui-mock.md`, `docs/specs/timeline-interactions.md`
- KPI/UXパネル: `docs/specs/kpi-ux-panel.md`
- 重要な決定: `docs/DECISIONS_2025-10-06.md`
- デプロイ: `docs/DEPLOY.md`

サンプルデータとスキーマ
- サンプル（ローカル検証用）: `docs/demo/*`, `data/*.zip`
- テンプレ（CSV入出力）: `docs/templates/*.template.csv`

検証コマンド（抜粋）
- UIスナップショット: `make generate-snapshots`
- DevTools中央揃え: `npm run devtools:landing-hero`
- Docs健全性: `npm test`（docs系テストを含む）

## Reference（補助資料）
- Duty編集: `docs/specs/duty-editing.md`, `docs/specs/duty-editing.addendum.md`
- Block UI再設計: `docs/specs/block-ui-redesign.md`
- 配布/承認: `docs/specs/distribution-approval.md`
- i18n調査: `docs/specs/i18n-survey.md`
- 監査/出力仕様: `docs/specs/file-write-audit.md`, `docs/specs/output-confirmation.md`

## Archives（履歴保存）
- `docs/archives/` 以下は参照専用。実装判断は本ページと `plans.md` を基準にします。

