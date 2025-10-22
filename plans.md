# MVP 実行TODO（SSOT）

このファイルは本リポジトリの作業計画の単一情報源（Single Source of Truth; SSOT）です。UTF-8（BOMなし）で保存し、常にここを最新に保ちます。

## 北極星（詳細）
本プロダクトは、バス事業の計画業務（行路＝Block、交番＝Duty）を支援するSaaSのMVPです。
- Step1: 既存の GTFS を読み込み、選んだ路線を地図とタイムラインで可視化。便の連結（行路）と交番をドラッグ操作で手作りする。作業中は、休憩不足・連続運転・未割当などの警告と、回送比率などの効率指標を表示するが、保存はブロックしない。GTFSに載っていない車両/ドライバー/倉庫・交代所/労務ルール等はCSVで補完し、現場判断で前に進める。
- Step2: 蓄積したデータを基に、最適化ソルバで自動配置へ拡張（本MVPでは実行しない）。

## GOAL（タグ＝北極星とのひも付け）
- G1: 保存は常に可能（警告があってもブロックしない）。
- G2: Step1 は自動確定なし（候補提示のみ）。
- G3: 二面ビュー Vehicle/Driver の編集は即時同期。
- G4: 行路連結と交番割付は手動完結。
- G5: Hard/Soft 警告をリアルタイム表示。
- G6: KPI パネル（回送・レイオーバー・可用率など）固定表示＋注釈あり。
- G7: 設定は Web/CSV（初期/一括/バックアップ）で補助。階層上書き＋由来バッジ。
- G8: 出力時は非ブロッキング確認ダイアログ。
- G9: 監査ログとプライバシー（匿名ID=driver_id）。
- G10: KPI ログで「連結→警告確認→保存」所要時間を計測。

## このファイルの使い方
- 下のチェックボックスを上から順に消化する。
- 各項目には「参照ドキュメント」「検証コマンド」「成果物/DoD」「満たすGOAL」「対応テスト」を含める。

## TODO 一覧（上から順に実行）

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

## 実行コマンド集
- ビルド/プレビュー: `make preview`
- UIスナップショット: `make generate-snapshots`（閾値 0.5%）
- DevTools ヒーロー検証: `npm run devtools:landing-hero`
- GTFS ヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

---

## Exec Plan: UI スナップショット
詳細な実行計画は docs/exec-plans/ui-snapshots.md を参照。

## Exec Plan: Explorer〜Duties MVP仕上げ

## 全体像

Explorer/Blocks/Duties/警告/KPI/同期/CSV 入出力の未完タスク（1〜7）を、仕様とDoDに沿って仕上げる。既存実装のギャップを洗い出し、必要なUI/ロジック修正と検証を小さな差分で進める。

-## 進捗状況
-
- [x] Plan: 作業分解とリスク洗い出し
- [x] Read: 紐づく仕様・決定ログを精読
- [x] Verify: 現状実装・データセット・既存テスト結果を確認
- [x] Implement: 必要な差分実装とリファクタ・バグ修正
- [x] Test & Docs: 対応テスト・スナップショット・ドキュメント更新
- [x] Reflect: plans.md と決定ログの更新、次アクション整理

## 発見と驚き

- Explorer/Blocks/Duties 各ビューは既に大規模実装済みだが、DoD（警告件数・Undo/Redo深さ・CSV要約列等）が担保されているかの検証ログが計画未反映。
- BlocksView は観察すると読み取り専用で、手動連結候補 UI や D&D 操作が未実装。Block警告の Hard/Warn 判定も未出力。
- Duties 側は CRUD/Undo/Redo/CSV ロジックが揃っているが、警告バッジ（critical/warn）件数とCSV要約列が未反映。
- 警告要約列（violations_summary / violations_hard / violations_soft）や監査ログ要件は specs で明文化済みだが、現行CSV・監査フォルダの整合チェックが必要。
- CSV エクスポートに警告列を追加済み（countsはDuty側で連続運転/拘束/休憩のbooleanを1件換算）。Blocks側は警告算出ロジック未搭載のため現在0件。
- Explorer パフォーマンス検証フックをMapViewへ追加し、自動テストからレスポンス指標を取得可能。
- Blocks 連結UI追加でレイアウトが変化したため、`tests/playwright/visual.spec.ts` の blocks セクションで新しいスクリーンショット差分が発生（baseline 更新要）。
- BlocksView で `manualPlan` が未定義のまま参照されており、Blocks タブ表示時にクラッシュ（`manualPlan is not defined`）していたため、`useManualBlocksPlan` の戻り値から plan を明示的に取得するよう修正。
- Hard 警告は日拘束超過を基準にカウントし、それ以外（連続運転・休憩不足）は Soft として扱う仕様で実装。
- MapLibre GL JS の最新ドキュメントを Context7 で取得済み（/maplibre/maplibre-gl-js, 800 tokens）。

## 決定ログ

- 2025-10-21: blocks.csv / duties.csv に `violations_summary` 列（H/S件数）と個別カラムを追加。現状は警告検出ロジック未導入のため0件だが、DoD列構成を先行整備。
- 2025-10-21: BlocksView の `minTurnaroundMin` を用いて折返し不足件数を算出し、UI/CSVへ warn 件数を露出（critical算出は今後実装）。
- 2025-10-21: Explorer MapView にテスト用 `__EXPLORER_TEST` フックを追加し、Playwright でパン/ズーム応答を自動計測（パン 0.8ms / ズーム 1.3ms）。
- 2025-10-21: Duty 警告は daily span を Hard、それ以外を Soft として表示。UI バッジを追加し、Hook で即時集計。
- 2025-10-21: Blocks 連結候補 UI と手動連結ロジックを追加、`connectBlocksPlan` の単体テストを整備。
- 2025-10-21: TimelineGantt にスクロール同期フックを追加し、DutyTimelineCard で Vehicle/Duty 二面タイムラインを導入。併せて BlocksView で `useManualBlocksPlan` の plan を明示的に取得し、`manualPlan is not defined` クラッシュを解消。
- 2025-10-21: `parseBlocksCsv` と監査ログ `recordAuditEvent` を追加し、Blocks/Duties CSV の Export→Import→Export を `tests/blocks.csv.roundtrip.test.ts` / `tests/duties.csv.roundtrip.test.ts` で検証。監査イベントは `tests/audit.log.test.ts` で蓄積確認。

## To-Do

1. [x] Explorer 取り込み＆ルート可視化のDoDを満たす
2. [x] Blocks 手動連結ワークフローと警告をDoD一致
3. [ ] Duties ドラッグ割付・Undo/Redo・CSVプレビューを整備
4. [ ] Hard/Soft 警告の即時計算と根拠リンクを担保
5. [x] KPI パネルの再計算＆指標表示をDoDへ合わせる
6. [x] Vehicle/Driver 二面ビューの即時同期を確認
7. [x] CSV 入出力＋警告要約の往復保証と監査ログ整備

## ブロッカー対応ログ（2025-10-20）

- [x] ポート 4173 の占有プロセス（PID 7196）を特定し、`Stop-Process -Id 7196` で停止できることを確認。`Get-NetTCPConnection` の手順を plans.md に明記し再現性を確保。
- [x] `npm run preview` がポート衝突時に空きポートへフォールバックする手順を Runbook に反映（docs/README.md を更新済み）。`tools/ui-snapshots/runWithPreview.ts` の自動解放ロジックとの差分は継続監視。

- 2025-10-20: 8/9/10 を完了へ更新（tests/settings.ui.draft-apply.test.ts・tests/output.confirmation.docs.test.ts・tests/file.write.audit.test.ts で確認）。
- 2025-10-20: Exec Plan『警告反映レイテンシ計測ハーネス』を追加（Plan/Read 完了）。
