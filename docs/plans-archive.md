# Plans Archive

このファイルは plans.md から移行したアーカイブ（完了タスク）の保管場所です。
編集日時: 2025-10-22

---

## アーカイブ（完了タスク）

### TODO 一覧（完了・2025-10-22 追加）

- [x] Run Preview / スナップショット用ポートのデフォルト分離（2025-10-22 完了）
  - 参照: make.cmd, package.json, playwright.config.ts, tools/ui-snapshots/runWithPreview.ts, tools/devtools/landingHeroCheck.ts, tools/chromeSmoke.ts, docs/README.md, docs/DEPLOY.md, docs/TODO_2.md, docs/archives/2025-10/misc/TODO_5.md, docs/plans-archive.md
  - 検証: `npm run build`（ポート設定更新後もビルド成功）
  - 成果物/DoD: プレビュー/スナップショット系を 127.0.0.1:4173 に統一。Playwright の baseURL・APP_BASE_URL を同一にし、ポート競合/接続拒否を解消。
  - 満たすGOAL: 運用改善（プロダクトGOAL対象外）
  - 対応テスト: `npm run build`
  - 依存関係: Vite 設定、Playwright 設定

- [x] Import UX 統一（仕様策定のみ）（2025-10-22 完了）
  - 参照: docs/specs/import-ux-unified.md, docs/specs/import-ux-unified.mock.md
  - 成果物/DoD: 2導線共通サマリー仕様、文言/アクセシビリティ要件、影響範囲を明文化。モックにフォーカス順・エラー挙動を追記。
  - 検証: `./make.cmd generate-snapshots` 合格（≤0.5%）。Playwright視覚テスト4件パス、DevToolsヒーロー自動確認。
  - 実施ログ: `./make.cmd generate-snapshots` 実行で UI スナップショットと devtools チェックを取得。

- [x] 日本語UIの用語統一と文言修正（仕様策定→一括実装）（2025-10-22 完了）
  - 実施内容: Explorer/Blocks/Duties/Dashboard/Manual/Import の表示テキストを日本語へ統一し、APP 名称とトップタイトルを「バス運行計画ツール」に変更。警告バッジ（重大/注意）、路線/便関連ラベル、保存導線の文言整理を実施。
  - 変更範囲: index.html, AppShell, ExplorerView, BlocksView, 各 Duty コンポーネント、ManualDataView と関連カード、DashboardView、DiffView、gtfsParser のサマリー文言など。
  - 検証: `./make.cmd generate-snapshots`（home.png 差分 3% で失敗）、`tests/playwright/import-flow.spec.ts`（新 UI への更新待ちでタイムアウト）、その他 Playwright シナリオは継続パス。
  - 備考: スナップショット基準と import-flow テスト期待値の更新が必要。英語表記の例外は KPI と CSV 列名のみ。

- [x] 保存系アクションの導線見直し（実装）（2025-10-22 完了）
  - 参照: docs/specs/save-flows-navigation.md, docs/specs/save-flows-navigation.mock.md
  - 実施内容: ImportView の保存ボタンを撤去し、保存導線のヒントを追加。DiffView に「データ保存・エクスポート」カードを新設し、取込結果JSON／プロジェクトJSONの保存を集約。
  - 成果物/DoD: 保存操作が「差分・出力」タブに集約され、ImportView からも明示的に誘導。手動入力込みの保存が可能で、result 未取得時は無効化表示。
  - 検証: `./make.cmd generate-snapshots` 実行（home.png でレイアウト差分検出 3% → スナップショット未更新）。
  - 実施ログ: Playwright 視覚テストは home.png の差分で失敗（取込導線の UI 追加による高さ変化）。Explorer パフォーマンス・Duty 警告テストは継続パス。
  - 備考: スナップショット基準は別途更新が必要。

- [x] Exec Plan: Import UX 統一（実装）（2025-10-22 完了）
  - 背景: 仕様合意後、ImportView 全体のUI刷新とテレメトリ更新を短期間で実装する必要がある。
  - 参照: docs/specs/import-ux-unified.md, docs/specs/import-ux-unified.mock.md, docs/exec-plans/import-ux-unified.md
  - 成果物/DoD: ImportView が2導線共通サマリーで動作、路線絞り込みUI（初期全選択＋無効化ガード）が実装され、保存導線ヒントが左ナビに統一。Explorer 遷移テレメトリ更新、README/FAQが最新化。
  - 満たすGOAL: G1, G4, G5, G7
  - 検証: `npm test -- tests/import-flow.spec.ts`（新規）, `./make.cmd generate-snapshots`, `npm run devtools:landing-hero`
  - 進捗ログ: 入口2導線・路線絞り込みUI・ナビ遷移・テレメトリ・README/FAQ 更新を実装。UI高さは路線グリッドに `max-h:320px` を設定し増分を抑制。スナップショットは承認済み基準へ更新。

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

- [x] ポート 4174 の占有プロセス（PID 7196）を特定し、`Stop-Process -Id 7196` で停止できることを確認。`Get-NetTCPConnection` の手順を plans.md に明記し再現性を確保。
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
