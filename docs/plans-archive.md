# Plans Archive

このファイルは plans.md から移行したアーカイブ（完了タスク）の保管場所です。
編集日時: 2025-10-22

---

## アーカイブ（完了タスク）

### TODO 一覧（完了・2025-10-22）

- [x] 0. 準備: GTFS ヘルスチェック（2025-10-20 実施ログ: `logs/2025-10-20-gtfs-health.md`）
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: `npx tsx tools/gtfsHealthCli.ts <gtfs.zip>`（blockless/時刻延長を確認）
  - 成果物/DoD: 重大エラー0、警告は記録し logs/ に残す。次工程へ反映。
  - 満たすGOAL: G1
  - 対応テスト: tests/gtfs.healthCli.test.ts, tests/gtfsPersistence.test.ts

- [x] 1. Explorer: 取り込み/路線選択・地図/タイムライン
  - 参照: docs/specs/ui-mock.md, docs/specs/timeline-interactions.md
  - 検証: `make preview` と `make generate-snapshots`（閾値 0.5%）
  - 成果物/DoD: ルート個別が正しく描画、パン/ズーム応答 < 1s
  - 満たすGOAL: G1
  - 対応テスト: tests/explorer/loadMapLibre.test.ts, tests/ui.timeline.render.test.tsx
  - 2025-10-21: `tests/playwright/explorer-performance.spec.ts` でパン 0.8ms / ズーム 1.3ms を計測（`make generate-snapshots` ログ）。
  - 2025-10-21: MapView が `__EXPLORER_TEST` を公開し、自動テストからレスポンス検証可能に更新。

- [x] 2. Blocks: 端点連結＝手動／提案のみ
  - 参照: docs/specs/block-ui-redesign.md, docs/specs/requirements-blocks-duties.md
  - 検証: スナップショット合格 ≤0.5%、`npm run devtools:landing-hero`
  - 成果物/DoD: 連結/解除/並び替えと差分表示が即時
  - 満たすGOAL: G2, G4, G5
  - 対応テスト: tests/timeline.interactions.design.test.ts, tests/encoding.blocksView.test.ts
  - 2025-10-21: `useManualBlocksPlan` と `manualPlan` サービスを追加し、CONNECT/解除（Undo）を即時反映する UI を `BlocksView` に実装。
  - 2025-10-21: Playwright `explorer-performance` で連結 UI 追加後もレスポンスを測定し、パン 1.0ms / ズーム 1.3ms を記録。
  - 2025-10-21: `tests/blocks.manualPlan.test.ts` で連結ロジックの単体テストを追加。

- [x] 3. Duties: ドラッグ割付／未割当グループ
  - 参照: docs/specs/duty-editing.md, docs/specs/duty-editing.addendum.md
  - 検証: スナップショット、Undo/Redo 10段
  - 成果物/DoD: 割付/解除/移動が可能、`duties.csv` プレビュー
  - 満たすGOAL: G1, G2, G4, G5
  - 対応テスト: tests/duty.workflow.test.ts, tests/duty.timeline.snap.test.ts, tests/duty.manual.check.test.tsx
  - 2025-10-21: `UnassignedSegmentsCard` と `computeUnassignedRanges` を追加し、未割当区間を一覧化・選択できるように更新。選択すると Block/Trip がプリセットされる。
  - 2025-10-21: Duty CSV ハンドラに `tripLookup` を渡し、警告の H/S 件数を算出。`tests/duty.unassigned.test.ts` で未割当ロジック、`tests/duty.workflow.test.ts` で Undo/Redo（10段）を検証。

- [x] 4. 警告（Hard/Soft）即時表示と根拠
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: 編集反映 < 1s、根拠にリンク
  - 成果物/DoD: Hard/Soft 件数一致、保存は非ブロック
  - 満たすGOAL: G1, G5
  - 対応テスト: tests/duty.specs.test.ts, tests/duty.metrics.test.ts, tests/duty.workflow.test.ts, tests/duty.unassigned.test.ts
  - 2025-10-21: DutyListCard/InspectorCard に Hard/Soft バッジと根拠メッセージを追加。警告設定変更や操作直後に即時更新。
  - 2025-10-21: `DutyTimelineCard` に警告バッジを追加、Playwright で 1s 以内に警告が表示されることを再確認。

- [x] 5. KPI パネル（回送/レイオーバー/可用率）
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: 値が期待±1%、ツールチップに根拠
  - 成果物/DoD: 指標は固定表示、編集で再計算
  - 満たすGOAL: G6, G10
  - 対応テスト: tests/duty.metrics.test.ts, tests/duty.dashboard.test.ts
  - 2025-10-21: DashboardView を再構成し、KPI カード・スパークライン・詳細テーブル・警告タイムラインを実装。ドライバー稼働と未割当推移を可視化。

- [x] 6. 二面ビューの同期（Vehicle/Driver）
  - 参照: docs/specs/ui-mock.md, docs/specs/timeline-interactions.md
  - 検証: 切替/編集 ≤ 200ms で同期
  - 成果物/DoD: 双方向編集が即時反映
  - 満たすGOAL: G3
  - 対応テスト: tests/ui.timeline.render.test.tsx
  - 2025-10-21: DutyTimelineCard に Vehicle/Duty 二面タイムラインを追加し、ズーム・スクロールを同期。`tests/duty.timeline.split.test.tsx` 追加＋`npm test`・`make generate-snapshots` 合格。

- [x] 7. CSV 入出力（blocks/duties）＋警告要約
  - 参照: docs/specs/diff-export-scope.md, docs/specs/diff-export-rollout.md, docs/specs/file-write-audit.md
  - 検証: Export→Import→Export の往復
  - 成果物/DoD: 差分説明付き CSV 出力と監査ログ
  - 満たすGOAL: G7, G9
  - 対応テスト: tests/distribution.approval.test.ts, tests/file.write.audit.test.ts
  - 2025-10-21: blocks/duties CSV のラウンドトリップテスト（warnings列を含む）を追加し、監査ログ記録ユーティリティを実装。`tests/blocks.csv.roundtrip.test.ts` / `tests/duties.csv.roundtrip.test.ts` / `tests/audit.log.test.ts` で Export→Import→Export と監査イベント蓄積を検証。

- [x] 8. 設定UI（Web主/CSV併用）・初期/一括/Depot/労務
  - 参照: docs/specs/settings-ui.md, docs/templates/*.template.csv
  - 検証: コールバック整備、ドラフト適用はロールバック可能
  - 成果物/DoD: 設定が段階/由来で表示
  - 満たすGOAL: G7
  - 対応テスト: tests/settings.ui.draft-apply.test.ts

- [x] 9. 出力確認（ノンブロッキング）
  - 参照: docs/specs/output-confirmation.md
  - 検証: 配布/CSV出力前に確認ダイアログ（Hard/Soft/差分/根拠）
  - 成果物/DoD: 監査ログに確認者と実行記録
  - 満たすGOAL: G8, G9
  - 対応テスト: tests/output.confirmation.docs.test.ts

- [x] 10. 監査とプライバシー
  - 参照: docs/specs/file-write-audit.md, readme.md（プライバシー）
  - 検証: 主要イベント100%記録（PIIなし）
  - 成果物/DoD: 匿名化IDと追跡コード
  - 満たすGOAL: G9, G10
  - 対応テスト: tests/file.write.audit.test.ts, tests/duty.metrics.test.ts

### To-Do（完了・2025-10-22）

1. [x] Explorer 取り込み＆ルート可視化のDoDを満たす
2. [x] Blocks 手動連結ワークフローと警告をDoD一致
5. [x] KPI パネルの再計算＆指標表示をDoDへ合わせる
6. [x] Vehicle/Driver 二面ビューの即時同期を確認
7. [x] CSV 入出力＋警告要約の往復保証と監査ログ整備

### ブロッカー対応ログ（完了・2025-10-20）

- [x] ポート 4173 の占有プロセス（PID 7196）を特定し、`Stop-Process -Id 7196` で停止できることを確認。`Get-NetTCPConnection` の手順を plans.md に明記し再現性を確保。
- [x] `npm run preview` がポート衝突時に空きポートへフォールバックする手順を Runbook に反映（docs/README.md を更新済み）。`tools/ui-snapshots/runWithPreview.ts` の自動解放ロジックとの差分は継続監視。

### 進捗状況（完了・2025-10-22）

- [x] Plan: 作業分解とリスク洗い出し
- [x] Read: 紐づく仕様・決定ログを精読
- [x] Verify: 現状実装・データセット・既存テスト結果を確認
- [x] Implement: 必要な差分実装とリファクタ・バグ修正
- [x] Test & Docs: 対応テスト・スナップショット・ドキュメント更新
- [x] Reflect: plans.md と決定ログの更新、次アクション整理

<!-- 統合のため「## To-Do」セクションを廃止。未完タスクは上部 TODO 一覧へ集約。 -->


### メンテナンス: plans.md の整理（完了・2025-10-22）

- [x] きれいにする: plans.md の整理（アーカイブ分離、重複ToDo統合、見出し体裁の修正）
  - DoD: 本ファイルから完了項目を除去し下部のアーカイブ節へ移動。重複ToDoを一箇所に統合し、体裁エラー（例: 先頭ハイフン付き見出しなど）を修正。
  - 検証: Markdown レンダリング崩れがないこと。アーカイブ差分が行単位で一致していること。
  - 参照: docs/plans-archive.md, docs/exec-plans/ui-snapshots.md, docs/README.md
  - 満たすGOAL: 運用改善（SSOT整備。プロダクトGOAL対象外）
  - 対応テスト: 目視レビュー＋Markdownプレビュー（リンク切れ/体裁崩れが無いこと）
  - 依存関係: docs/plans-archive.md への移行完了

### Duty タスク（完了・2025-10-22）

- [x] Duties ドラッグ割付・Undo/Redo・CSVプレビューを整備（2025-10-22 完了)
  - DoD: 割付/解除/移動、Undo/Redo（10段）、`duties.csv` プレビュー警告要約を確認。
  - 検証: `npm test -- tests/duty.workflow.test.ts tests/duty.timeline.snap.test.ts tests/duty.manual.check.test.tsx`
  - 満たすGOAL: G1, G2, G4, G5
  - 対応テスト: tests/duty.workflow.test.ts, tests/duty.timeline.snap.test.ts, tests/duty.manual.check.test.tsx, tests/duty.unassigned.test.ts

- [x] Hard/Soft 警告の即時計算と根拠リンクを担保（2025-10-22 完了)
  - DoD: Hard/Soft 件数が UI/CSV で一致し根拠リンクで確認。
  - 検証: `npm test`（全体）
  - 満たすGOAL: G1, G5
  - 対応テスト: tests/duty.specs.test.ts, tests/duty.metrics.test.ts, tests/duty.workflow.test.ts, tests/duty.unassigned.test.ts
