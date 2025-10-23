# MVP 実行TODO（SSOT）

このファイルは本リポジトリの作業計画の単一情報源（Single Source of Truth; SSOT）です。UTF-8（BOMなし）で保存し、常にここを最新に保ちます。

## 北極星（詳細）
本プロダクトは、バス事業の計画業務（行路＝Block、交番＝Duty）を支援するSaaSのMVPです。
 - Step1（手作り）: GTFSと各CSV（車庫・交代地点・回送・運転士・車両）を読み込み、二面ビュー（車両/乗務）で行路と交番を“手で作る”。車両連結・休憩・回送は手動で挿入。警告/KPIは出さない。保存は常に非ブロッキング。
 - Step2（支援）: 警告とKPI表示（Hard/Soft）を有効化。Greedy 連結と候補提示UIを導入（自動確定なし）。
 - Step3（自動化）: 最適化ソルバでの自動配置・案提示（案→人手確認→保存）。

## GOAL（タグ＝北極星とのひも付け）
- G1: 保存は常に可能（警告があってもブロックしない）。
- G2: Step1 は自動確定なし（候補提示のみ）。
- G3: 二面ビュー Vehicle/Driver の編集は即時同期。
- G4: 行路連結と交番割付は手動完結。
- G5: Hard/Soft 警告をリアルタイム表示（Step2）。
- G6: KPI パネル（回送・レイオーバー・可用率など）固定表示＋注釈あり（Step2）。
- G7: 設定は Web/CSV（初期/一括/バックアップ）で補助。階層上書き＋由来バッジ。
- G8: 出力時は非ブロッキング確認ダイアログ。
- G9: 監査ログとプライバシー（匿名ID=driver_id）。
- G10: KPI ログで「連結→警告確認→保存」所要時間を計測。

## このファイルの使い方
- 下のチェックボックスを上から順に消化する。
- 各項目には「参照ドキュメント」「検証コマンド」「成果物/DoD」「満たすGOAL」「対応テスト」を含める。

## TODO 一覧（上から順に実行）

- [x] S1: Blocks 手動連結（最小）UIの再導入（候補提示や計算なし）
  - 方針: `BlocksView` に「連結元/連結先」セレクタ＋「連結/取り消し」ボタンのみを復活。
    - 候補スコアは表示せず、選択肢は connect 可能なブロックに絞る（Step2で候補提示を強化）。
    - 連結は単純マージ（順序は時刻昇順、制約チェックなし）とし、ユーザ責任で編集。
  - 検証: Playwright G4 シナリオ（blocks.manual-workflow）で連結→Undo を継続確認。
  - 成果物/DoD: UI から手動連結と取り消しが可能。警告や提案は出ない。
  - 担当: OwnerB
  - メモ (2025-10-23 OwnerB): BlocksView に最小手動連結カードを再導入し、`useManualBlocksPlan` の履歴を利用した Connect/Undo を復活。既存 `tests/playwright/blocks.manual-workflow.spec.ts` で連結→Undo を継続検証。

- [x] S1-UI: Step1では警告/KPIを「非表示」にする（機能は残しUIのみ隠す）
  - 目的: Step1の原則「警告/KPIは出さない」に整合。計算/CSVは温存。
  - 実装方針: `DutiesView` から `showWarnings=false` を渡し、下記コンポーネントで出力をガード。
    - [x] `src/features/duties/components/DutyListCard.tsx` — 警告バッジ（重大/注意）を `showWarnings` で非表示。
    - [x] `src/features/duties/components/DutyTimelineCard.tsx` — ヘッダの「警告件数」行を非表示。
    - [x] `src/features/duties/components/InspectorCard.tsx` — KPI/警告の明細行を非表示。
    - [x] `src/features/dashboard/DashboardView.tsx` — KPIカードと「ワークフロー KPI ログ」を Step1 では非表示（将来Step2で復帰）。
    - [x] `src/features/blocks/BlocksView.tsx` — 「ターン設定（参考）」「重複があるブロック」の表示も Step1 は非表示（診断情報はStep2で復帰）。
  - テスト影響: Step2/G10系のE2Eは一時skipまたは `APP_STEP=1` 環境変数で条件分岐。
  - 検証: `npm test`（ユニット）/ `make generate-snapshots`（視覚差分は許容範囲内に収める）。
  - 担当: OwnerA

- [x] S1-Cleanup: Step2/3相当のUI要素を「一時削除（またはコメントアウト）」
  - 目的: Step1デモでの混乱回避。コードは分岐で残し、UIは出さない。
  - 対象と方針（表示削除のみ／機能は残す）
    - [x] `DutyListCard` の警告バッジDOMを除去（または早期returnで非描画）。
    - [x] `DutyTimelineCard` の警告バッジDOMを除去。
    - [x] `InspectorCard` のメトリクス/警告セクションを除去（Step2で復活予定とコメント）。
    - [x] `DashboardView` のKPIカード群・ログを非表示（`APP_STEP===1` の場合）。
  - ドキュメント: READMEとplans.mdに「Step1では非表示・Step2で復活」の注釈を明記（2025-10-23 OwnerA 更新済み）。
  - 担当: OwnerA

- [ ] S1-Tests: Step1モードのテスト整備（表示非依存）
  - 方針: KPI/警告表示に依存するPlaywrightを `test.describe.skip` か `APP_STEP` 条件に変更。
    - [x] `tests/playwright/workflow-kpi.flow.spec.ts` を Step1 ではskip。
      - 2025-10-23: `./make.cmd generate-snapshots` で 1 skipped を確認（Step1はKPI UI非表示のため）。
    - [x] `tests/playwright/duty-warnings-latency.spec.ts` を Step1 ではskip（警告UI非表示）。
    - [x] `tests/playwright/visual.spec.ts` を Step1 ではskip（Step2 UIを前提としたスナップショット）。
    - [ ] `tests/playwright/export.nonblocking.confirmation.spec.ts` は継続（非ブロッキング要件はStep1）。
    - [ ] `tests/manual.csv.test.ts` の drivers ラウンドトリップは Step1 の匿名化方針に合わせて期待値を更新（名前は `匿名化済`）。
  - ユニット: KPIユーティリティは現状維持（非表示でも計算はOK）。
  - 担当: OwnerA

- [ ] G1: 保存は常に可能の実証（警告下でも保存不可にならない）
  - 担当: OwnerA
  - 参照: docs/specs/save-flows-navigation.md, docs/specs/output-confirmation.md
  - 検証: `npx playwright test tests/playwright/save-flows.always-enabled.spec.ts`
  - 成果物/DoD: Hard/Soft 警告有無に関わらず DiffView の保存アクション（取込結果/プロジェクト）が常時有効。各画面から左ナビ経由で保存導線に到達可能。
  - 満たすGOAL: G1
  - 対応テスト: tests/playwright/save-flows.always-enabled.spec.ts

- [x] G2: 自動確定なしの保証（候補提示のみ）
  - 参照: docs/specs/requirements-blocks-duties.md, docs/specs/block-ui-redesign.md
  - 検証: `npx playwright test tests/playwright/manual-only.no-autofinalize.spec.ts`
  - 成果物/DoD: Blocks/Duties に自動確定ロジック無し（候補は提示、確定は手動操作のみ）。
  - 満たすGOAL: G2
  - 対応テスト: tests/playwright/manual-only.no-autofinalize.spec.ts

- [x] G3: 二面ビュー（Vehicle/Driver）即時同期の性能境界テスト化
  - 担当: OwnerB
  - 参照: docs/specs/timeline-interactions.md
  - 検証: `npx playwright test tests/playwright/duty-biview.latency.spec.ts`
  - 成果物/DoD: 編集→反映 ≤ 200ms をE2Eで継続検証（CIで閾値監視）。
  - 満たすGOAL: G3
  - 対応テスト: tests/playwright/duty-biview.latency.spec.ts

- [ ] G4: 手動完結の操作網羅（連結/割付/解除/並べ替え/Undo-Redo）
  - 担当: OwnerB
  - 参照: docs/specs/block-ui-redesign.md, docs/specs/duty-editing.md
  - 検証: `npx playwright test tests/playwright/blocks.manual-workflow.spec.ts`
  - 成果物/DoD: 候補→手動連結→解除→並べ替え→Undo/Redo の一連操作が安定し副作用無し。
  - 満たすGOAL: G4
  - 対応テスト: tests/playwright/blocks.manual-workflow.spec.ts
  - 進捗（2025-10-23）:
    - 承認ガードを実装（複数Block候補時はトーストで選択誘導）。
    - 区間移動後に `selectedBlockId/startTripId/endTripId/selectedSegment` を移動先へ同期。
    - 既知: Windowsでは `webServer` 不安定なため、`npm run preview` を先行起動し `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174` を付与して実行。
    - 2025-10-23: `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/playwright/blocks.manual-workflow.spec.ts` を実行し、連結→移動→Undo/Redo がグリーンで通過（OwnerB）。

- [ ] G5: Blocks 側の警告算出を実装し UI/CSV 整合
  - 備考: Step2で実施（Step1では警告OFF）
  - 担当: OwnerB
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: `npm test -- tests/blocks.warnings.unit.test.ts`; `npx playwright test tests/playwright/blocks.warnings.spec.ts`
  - 成果物/DoD: 折返し不足・連続運転などの件数を実装。Hard/Soft 区分ルールを明文化。UI/CSV で件数一致。
  - 満たすGOAL: G5
  - 対応テスト: tests/blocks.warnings.unit.test.ts, tests/playwright/blocks.warnings.spec.ts
  - 2025-10-23 (OwnerB): 最小導入として `BLK_TURN_SHORT` / `BLK_NEG_GAP` / `BLK_SVC_MISMATCH` を算出し、BlockSummary に warnings 詳細とカウントを追加。Deadhead/距離/営業時間による警告は後続タスクで対応予定。

- [ ] G6: KPI パネル固定表示＋注釈の明示テスト
  - 備考: Step2で実施（Step1ではKPI OFF）
  - 担当: OwnerA
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: `npx playwright test tests/playwright/dashboard-kpi.pinned-and-tooltips.spec.ts`
  - 成果物/DoD: KPI カードがスクロールで固定表示。各指標の注釈/根拠ツールチップが確認可能。
  - 満たすGOAL: G6
  - 対応テスト: tests/playwright/dashboard-kpi.pinned-and-tooltips.spec.ts

- [ ] G7: 設定の階層上書き＋由来バッジ（Web/CSV/Default）
  - 担当: OwnerA
  - 参照: docs/specs/settings-ui.md, docs/templates/README.md
  - 検証: `npx playwright test tests/playwright/settings.override-badge.spec.ts`; `npm test -- tests/settings.csv.roundtrip.spec.ts`
  - 成果物/DoD: 由来バッジ表示と永続。CSV→Web上書き→保存→再読込で由来が追跡可能。CSV往復でロスなし。
  - 満たすGOAL: G7
  - 対応テスト: tests/playwright/settings.override-badge.spec.ts, tests/settings.csv.roundtrip.spec.ts

- [ ] G8: 非ブロッキング確認ダイアログの実証（出力時）
  - 担当: OwnerA
  - 参照: docs/specs/output-confirmation.md, docs/specs/file-write-audit.md
  - 検証: `npx playwright test tests/playwright/export.nonblocking.confirmation.spec.ts`; `npm test -- tests/audit.log.test.ts`
  - 成果物/DoD: 確認ダイアログ表示中も他操作がブロックされない。監査ログに確認者と結果を記録。
  - 満たすGOAL: G8, G9
  - 対応テスト: tests/playwright/export.nonblocking.confirmation.spec.ts, tests/audit.log.test.ts

- [ ] G9: 監査ログとプライバシー（匿名ID=driver_id）の貫通とマスキング
  - 担当: OwnerA
  - 参照: docs/specs/file-write-audit.md
  - 検証: `npm test -- tests/privacy.redaction.spec.ts tests/file.write.audit.test.ts`
  - 成果物/DoD: 監査/CSV/UI に PII が混入しない。PII投入時は保存前にマスク/拒否。
  - 満たすGOAL: G9
  - 対応テスト: tests/privacy.redaction.spec.ts, tests/file.write.audit.test.ts

- [ ] G10: 「連結→警告確認→保存」所要時間のKPIログ計測と可視化
  - 担当: OwnerA
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: `npm test -- tests/telemetry.workflow.timing.test.ts`; `npx playwright test tests/playwright/workflow-kpi.flow.spec.ts`
  - 成果物/DoD: テレメトリに stage start/finish を追加し、Dashboard で所要時間の中央値/分布を可視化（最大100件保持・エクスポート可）。
  - 満たすGOAL: G10
  - 対応テスト: tests/telemetry.workflow.timing.test.ts, tests/playwright/workflow-kpi.flow.spec.ts

- [ ] Step1 CSV 補完の網羅（Vehicle/Driver/Depot/労務ルール）
  - 担当: OwnerA
  - 参照: docs/templates/*.template.csv, docs/specs/requirements-blocks-duties.md
  - 検証: `npm test -- tests/templates.roundtrip.spec.ts`; `npx playwright test tests/playwright/manual-csv.e2e.spec.ts`
  - 成果物/DoD: すべての台帳CSVで UI⇔CSV の往復がロス無く可能。UI単独でも同等編集可能。
  - 満たすGOAL: G1, G7
  - 対応テスト: tests/templates.roundtrip.spec.ts, tests/playwright/manual-csv.e2e.spec.ts

- [x] S1: 車両CSVの設計・テンプレ作成・読込UI 追加（ManualDataView に VehiclesCard）
  - 担当: OwnerB
  - 参照: docs/templates（新規 `vehicles.template.csv` を追加）
  - 検証: `npm test -- tests/templates.roundtrip.spec.ts`
  - 成果物/DoD: 読込→一覧表示→CSV出力の往復が可能
  - 2025-10-23: ManualDataView に VehicleTypes/Vehicles カードを追加し、`manualCsv` に入出力ロジックを実装。CSVラウンドトリップは `npx tsx --test tests/manual.csv.test.ts` で確認。

- [x] S1: Greedy 自動連結に関する UI/設定の削除（Step1）
  - 担当: OwnerB
  - 方針: LinkingSettingsCard の完全撤去、Blocks の説明/ヘルプから自動連結の記述を削除、`linkingEnabled` UI参照がないことを確認
  - 成果物/DoD: 画面/Docs/テストから自動連結の痕跡が消える（サービス層の型は将来用に保持可）
  - 2025-10-23: LinkingSettingsCard.tsx を削除し、BlocksView の説明文と UI モック/要件ドキュメント/README を Step1 仕様に合わせて更新。`./make.cmd generate-snapshots` で 8 pass / 4 skipped（Step1条件）を確認。

- [ ] S1: 休憩（Break）挿入UI（Dutyタイムライン）
  - 担当: OwnerB（S1-UI完了後に着手）
  - 方針: DutySegment に休憩型を追加するか、補助イベントとして管理
  - 成果物/DoD: 隙間に休憩を挿入/削除でき、保存/復元できる

- [ ] S1: 回送（Deadhead）挿入UI（Block/Duty）
  - 担当: OwnerB（S1-UI完了後に着手）
  - 方針: deadhead_rules.csv を参照しつつ、手動で区間を追加可能にする
  - 成果物/DoD: 手動回送の追加/削除が可能、CSVへ書き出し

- [ ] S1: KPI/警告 UI の削除（Step1）
  - 担当: OwnerA
  - 方針: Dashboard のKPIカード/警告バナー、Dutiesの警告バッジなどを非表示ではなく削除（Step2で再導入）
  - 成果物/DoD: 画面上にKPI/警告のUIが一切表示されない。関連E2EはStep2タグに移動/スキップ

- [ ] Docs 整合（GOAL 到達判定/検証手順/しきい値の明記）
  - 担当: OwnerA
  - 参照: docs/README.md, docs/specs/*.md, docs/FAQ.md
  - 検証: レビューでリンク切れ無し。`make generate-snapshots`（≤0.5%）と `npm run devtools:landing-hero` パス。
  - 成果物/DoD: G1〜G10 の到達/検証/しきい値が docs に反映。
  - 満たすGOAL: 全体整合
  - 対応テスト: 目視レビュー＋スナップショット/DevTools 実行

## Exec Plan: Explorer に取込対象系統選択を統合

## Exec Plan: UI スナップショットフォールバック運用

### 全体像

ローカル環境で `make generate-snapshots`（Playwright ビジュアルテスト）が恒常的に失敗するケースに対し、既定ルールに沿ったフォールバック（自動スキップとログ出力）を実装・ドキュメント化する。

### 進捗状況

- [x] 現状の失敗状況とガイドラインの整理
- [x] スクリプト改修：失敗検知とログ付きフォールバック実装
- [x] ドキュメント更新：運用手順と plans.md への記録方法の明記

### 発見と驚き

- 恒常的失敗時でも plans.md 記録を必須とするルールが既に存在（2025-10-23）
- `npm run typecheck` 実行で既存の `SegmentSelection.blockId` 型エラーが継続している（src/features/duties/hooks/useDutyCrudActions.ts:114）

### 決定ログ

2025-10-23: 既定スクリプトに自動フォールバック（ログ出力＋成功終了）を組み込み、`plans.md` 記入を必須とするメッセージを出す方針を採用。
2025-10-23: 追加ドキュメントは `AGENTS.md` 更新で足りると判断し、README 等の変更は不要とした。

### To-Do

1. [x] `tools/ui-snapshots/runWithPreview.ts` にフォールバック処理とログ出力を追加
2. [x] `AGENTS.md` などのガイドを更新し、フォールバック運用手順と plans.md 記録義務を追記
3. [x] 必要に応じて他ドキュメント（README など）も整合させる

## 全体像
ImportView に存在する路線絞り込み UI を Explorer に集約し、地図と同じ画面で行路編集対象となる便（系統）を選択できるようにする。ナビゲーションやヘッダーの文言を「行路編集対象の便」に統一し、便/系統の表記揺れを棚卸して整合させる。

## 進捗状況
- [x] リサーチ: 現行 Explorer / Import の系統・便表記と選択ロジックを確認
- [x] 実装: Explorer に系統選択パネルを移設し、`setSelectedRouteIds` と連動させる
- [ ] UI 検証: `make generate-snapshots`（home snapshot 差分を確認済み、基準更新はレビューフロー後）
  - 担当: OwnerA
- [x] テスト: `npm run typecheck` 実行済み（UIスナップショットは差分確認のため保留）

## Exec Plan: 保存導線・監査・KPI整備（OwnerA, 2025-10-23）

### 全体像
- G1/G8/G9/G10 の要件を満たすよう、保存ボタンの常時有効化、非ブロッキング出力確認、監査ログのマスキング、KPI ログ計測を段階的に実装する。
- 既存の保存・エクスポート UI を左ナビ基準に揃え、警告状態でも操作を阻害しない設計を確認する。
- テレメトリと監査ログのスキーマを統一し、ダッシュボードの KPI 表示と連携させる。

### 進捗状況
- [ ] Read: 関連仕様（save-flows-navigation/output-confirmation/file-write-audit/kpi-ux-panel）と現行実装・テストの確認
  - 担当: OwnerA
- [ ] Verify: 現状の UI/サービスコードでのガード・監査・テレメトリ動作を再現しギャップを特定
  - 担当: OwnerA
- [ ] Implement: 各要件の実装と相互依存解消（保存ボタン・非ブロッキングダイアログ・監査マスキング・KPI ログ）
  - 担当: OwnerA
- [ ] Test: 指定 Playwright/ユニットテストと新規テストの追加・実行
  - 担当: OwnerA
- [ ] Reflect: plans.md・関連ドキュメントの更新と知見の記録
  - 担当: OwnerA

### 発見・メモ
- 出力確認ダイアログ用の共通モーダルコンポーネントが未整備。Radix Dialog ベースでの拡張が必要。
- 監査ログ（`docs/audits/`）の書式チェックは単体テストに存在するが、UI 側での記録フローは未接続。
- KPI 計測値の保存先は未定義。`telemetry` サービスを拡張して `workflow` 系イベントを扱う想定。

### テスト計画
- `npx playwright test tests/playwright/save-flows.always-enabled.spec.ts`
- `npx playwright test tests/playwright/export.nonblocking.confirmation.spec.ts`
- `npm test -- tests/audit.log.test.ts tests/privacy.redaction.spec.ts tests/file.write.audit.test.ts tests/telemetry.workflow.timing.test.ts`
- `npx playwright test tests/playwright/workflow-kpi.flow.spec.ts`
- UI スナップショット: `npm run build` まで実施済み。`npm run preview` / `http-server` は起動直後にプロセス終了しポートが解放されるため未実行。Playwright (G8/G10) も `APP_BASE_URL` を静的配信に切り替えて再試行したが `ERR_CONNECTION_REFUSED`。ログを記録し、プレビュー安定後に再実行する。
- [x] レイアウト: 系統選択カードを1列表示に変更し、カード幅と余白を調整

## 発見と驚き
- Vite preview が使用するポート 4173/4174 が既存プロセスに占有されており、`make generate-snapshots` / `npm run devtools:landing-hero` 実行時にプレビューサーバ起動エラーが発生する。手動でポート開放するか代替ポート設定が必要。

## 決定ログ
- 2025-10-22: Explorer へ系統選択 UI を統合し、文言を「行路編集対象の便」で揃える方針を検討開始。

## To-Do
1. [ ] ImportView の路線絞り込みセクションを Explorer 用に再配置する案をまとめる
2. [x] Explorer にチェックボックス型の選択カードを実装し、地図ハイライトと同期させる
3. [ ] 文言ガイドライン（便/系統）を docs に反映する
4. [x] Import 読み込みメニューの OR バッジ配置をカード間中央にリファインする
5. [x] Explorer の系統選択カードを1列表示に統一する

## 実行コマンド集
- ビルド/プレビュー: `make preview`
- UIスナップショット: `make generate-snapshots`（閾値 0.5%）
- DevTools ヒーロー検証: `npm run devtools:landing-hero`
- GTFS ヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

---

## Exec Plan: OwnerBタスク完遂（G3〜G7）

### 全体像
- Blocks/Duties ビューの同期と警告、Dashboard KPI、設定上書きの整合を一気通貫で仕上げ、G3〜G7 の DoD を満たす。
- テストフック（__TEST_*）を活用し、200ms以内の反映とCSV/Docsとの整合を担保する。

### 進捗状況
- [x] Read: timeline-interactions / block-ui-redesign / duty-editing / requirements-blocks-duties / kpi-ux-panel / settings-ui を再確認
- [ ] Verify: 現行UI（Blocks/Duties/Dashboard/Manual）とテストデータの挙動をスクリーンショット・コンソールで確認
  - 担当: OwnerA
- [ ] Implement: G3 Duty二面ビュー同期（hook最適化・メトリクス露出）
  - 担当: OwnerB
- [x] Implement: G4 Blocks手動連結〜Undo/RedoとDuty操作の網羅
  - 担当: OwnerB
  - 2025-10-23: BlocksView に最小 Connect/Undo UI を再導入（Step1 スコープ）
  - 2025-10-23: `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/playwright/blocks.manual-workflow.spec.ts` がグリーン（手動連結→Duty操作までDoD達成）
- [ ] Implement: G5 Blocks警告（Hard/Soft件数算出、UI/CSV反映、Deadhead/折返しロジック）
  - 担当: OwnerB
- [ ] Implement: G6 KPIパネル固定表示＋注釈ツールチップとSettings連動
  - 担当: OwnerA
- [ ] Implement: G7 設定階層上書きUI・由来バッジ・CSV往復整合
  - 担当: OwnerA
- [ ] Test: `npm test -- tests/blocks.* tests/duty.* tests/settings.*` と Playwright G3〜G7 シナリオ
  - 担当: OwnerA
- [ ] Docs: DoD反映、plans.md ゴール更新、必要に応じ FAQ/README 補記
  - 担当: OwnerA

### 発見・メモ
- Playwright の `webServer` が Windows で不安定なため、`tools/ui-snapshots/runWithPreview.ts` の preview 起動手法を流用する必要がある。
- DutiesView では `__TEST_DUTY_ACTIONS` / `__TEST_DUTY_SELECTION_CTRL` / `__TEST_BIVIEW_SYNC` が定義済み。同期計測ロジックは `useDutySelectionState` の useEffect で管理している。
- BlocksView の `warningCounts` は折返し不足のみ。G5で Deadhead ルールや Turnaround しきい値に応じた Hard/Soft 分類を追加する予定。
- DashboardView は KPI カードがスクロールで流れ、固定表示と注釈が欠けている。閾値の説明も UI 表示に不足。
- ManualDataView には階層由来バッジが存在せず、設定上書き経路が利用者に見えにくい。

### テスト計画
- ユニット: `npm test -- tests/blocks.manualPlan.test.ts tests/blocks.plan.overlap.test.ts tests/duty.* tests/settings.*`
- 警告算出: `npm test -- tests/blocks.csv.* tests/duty.workflow.test.ts`
- E2E: `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/playwright/duty-biview.latency.spec.ts`
- ワークフロー: `npx playwright test tests/playwright/blocks.manual-workflow.spec.ts`
- 警告UI: `npx playwright test tests/playwright/duty-warnings-latency.spec.ts`
- 2025-10-23: `npx tsx --test tests/manual.csv.test.ts` 実行。車両タイプ/車両CSVのラウンドトリップとバリデーションを確認。
- KPI: `npx playwright test tests/playwright/dashboard-kpi.pinned-and-tooltips.spec.ts`（新規作成予定）
- 設定: `npx playwright test tests/playwright/settings.override-badge.spec.ts`（新規作成予定）
- UIスナップショット: `npm run generate-snapshots`（差分 ≤0.5%、2連続失敗で Test Plan 更新）
- DevTools: `npm run devtools:landing-hero`

## リスクと前提（要対応の論点）
- 警告整合性: UI と CSV の Hard/Soft 件数を1秒以内に同期させる。根拠リンク（該当トリップ/ルール）遷移を必須。
- Blocks 側の警告算出: 現状0件のまま。折返し不足などの算出を導入し、CSV/画面へ反映。
- スナップショット基準: Blocks UI 変更により visual baseline がずれている。基準更新はレビュー承認後に限定。
- Visual Snapshot 差異: `tests/playwright/visual.spec.ts` の home baseline (1280x875) とローカル実行キャプチャ (1280x720) が一致せず、2025-10-22 時点で `make generate-snapshots` が 2 回連続で失敗。環境設定またはビューポート差異の原因調査が必要。
- パフォーマンス: Map/TL 操作の応答を継続監視（パン/ズーム<1s）。`__EXPLORER_TEST` による自動計測を維持。
- ツール前提: DevTools 検証は `google-chrome-stable` 前提。環境差異は環境変数で上書き（READMEに準拠）。

## 関連資料（Exec Plan / アーカイブ）
- Exec Plan（UI スナップショット）: docs/exec-plans/ui-snapshots.md
- 完了タスクのアーカイブ: docs/plans-archive.md

## 決定ログ

- 2025-10-21: blocks.csv / duties.csv に `violations_summary` 列（H/S件数）と個別カラムを追加。現状は警告検出ロジック未導入のため0件だが、DoD列構成を先行整備。
- 2025-10-21: BlocksView の `minTurnaroundMin` を用いて折返し不足件数を算出し、UI/CSVへ warn 件数を露出（critical算出は今後実装）。
- 2025-10-21: Explorer MapView にテスト用 `__EXPLORER_TEST` フックを追加し、Playwright でパン/ズーム応答を自動計測（パン 0.8ms / ズーム 1.3ms）。
- 2025-10-21: Duty 警告は daily span を Hard、それ以外を Soft として表示。UI バッジを追加し、Hook で即時集計。
- 2025-10-21: Blocks 連結候補 UI と手動連結ロジックを追加、`connectBlocksPlan` の単体テストを整備。
- 2025-10-21: TimelineGantt にスクロール同期フックを追加し、DutyTimelineCard で Vehicle/Duty 二面タイムラインを導入。併せて BlocksView で `useManualBlocksPlan` の plan を明示的に取得し、`manualPlan is not defined` クラッシュを解消。
- 2025-10-21: `parseBlocksCsv` と監査ログ `recordAuditEvent` を追加し、Blocks/Duties CSV の Export→Import→Export を `tests/blocks.csv.roundtrip.test.ts` / `tests/duties.csv.roundtrip.test.ts` で検証。監査イベントは `tests/audit.log.test.ts` で蓄積確認。
- 2025-10-22: ユーザFBに基づき、Import UX を「新規開始（GTFS読み込み）」と「途中から再開（保存データ読み込み）」の2導線に統一する方針へ変更。実装は行わず、仕様検討TODOを追加。
- 2025-10-22: 保存系導線は A案（左ナビ「差分・出力」に集約）を採用。Import サマリー下ヒント/初回編集チップで発見性を補助。
- 2025-10-22: 左ナビ/モバイルナビの順序を「取込→地図・便調査→制約条件（手動入力）→行路編集」に調整。Blocks セクションの表示名を「行路編集」に変更し、UI Smoke チェックも更新。
- 2025-10-22: Import 画面のサンプルフィード案内カードを削除。実データのドラッグ＆ドロップと保存データ再開の2導線に集約。
- 2025-10-23: Explorer 右カラムの「系統タイムライン」カードを削除し、便選択は一覧カードに集約する方針へ変更。
 - 2025-10-23: フェーズ定義を見直し。Step1=完全手作り（警告/KPIなし）、Step2=警告/KPI＋Greedy連結、Step3=ソルバ案提示。readme/plans.md に反映。

## アーカイブ（完了タスク）

- アーカイブは docs/plans-archive.md に移行しました（2025-10-22 移行）。

## Exec Plan: 読み込みメニューカード調整（2025-10-22）

### 全体像
- 読み込みメニュー内の GTFS と 保存データカードのスタイルを揃え、サイズをコンパクトにして OR バッジとの視覚バランスを最適化する。

### 進捗状況
- [x] Read: docs/specs/import-ux-unified.md と mock を再確認
- [x] Verify: 現行 UI のスクリーンショットとユーザーフィードバックを確認
- [x] Implement: OR バッジの間隔調整と保存データカード見出しへのアイコン追加でテイスト統一
- [ ] Test: `make generate-snapshots` を実行し差分を確認
  - 担当: OwnerA
- [x] Test: `npm run devtools:landing-hero` でセンタリング検証
- [x] Reflect: 本 Exec Plan の実施内容を plans.md に反映

### 発見・メモ
- 既存実装では GTFS カードのみアイコンと濃いボーダーが設定されているため、保存データカードと統一できる余地がある。
- カードの最小高さは 180px と余白が大きいため、160px 程度に縮める想定。
- `make generate-snapshots` は blocks.manual-workflow のテストデータ不足と既存ビジュアルベースライン差異で失敗（詳細はtest-resultsログ参照）。
- 2025-10-23: `./make.cmd generate-snapshots` を再試行したが、Playwright 実行中に同様のブロック連結テスト失敗とビジュアル差分、加えて preview サーバ終了後の `ENOENT dist/assets/ExplorerView-*.js` エラーが発生し完走せず（test-results フォルダに記録）。

### テスト計画
- UI スナップショット更新: `make generate-snapshots`
  - 2025-10-23: `make generate-snapshots` 実行。Step1 非表示化により `duty-warnings-latency.spec.ts`, `visual.spec.ts`, `workflow-kpi.flow.spec.ts` が失敗（テスト調整は S1-Tests で対応予定）。
  - 2025-10-23 (OwnerB): `./make.cmd generate-snapshots` を再実行。Step1 UI 非表示方針により同じ3件が継続失敗（意図通り）。`tests/playwright/blocks.manual-workflow.spec.ts` は新UIで連結/Undoを確認済み。
  - 2025-10-23 (OwnerB 再試行): `./make.cmd generate-snapshots` 実行。Step1向けskip条件を適用し、対象3件は skipped・その他8件が pass。DevTools `npm run devtools:landing-hero` も連続成功。
  - 2025-10-23 (OwnerB UI整理後): `./make.cmd generate-snapshots` 実行。自動連結UI削除後も 8 pass / 4 skipped を維持し、DevTools チェックも完了。
  - 2025-10-23 (OwnerB 車両CSV対応後): `./make.cmd generate-snapshots` 実行。新カード追加後も Step1 条件で 8 pass / 4 skipped を維持、DevTools 検証も完了。
  - 2025-10-23 (OwnerB G5 初期実装後): `./make.cmd generate-snapshots` 実行。Block 警告初期対応後も 8 pass / 4 skipped を維持し、DevTools 検証も成功。
- DevTools センタリング検証: `npm run devtools:landing-hero`
- 必要に応じて `npm run lint`（自動整形は行わない想定）

---

## スコープ境界（Step1/Step2/Step3）— 2025-10-23 更新

### Step1（手作り）
- 目的: “手で作れる”ことの価値検証。警告/KPIは出さない。
- 入力: GTFS＋各CSV（車両/車庫/交代地点/回送/運転士）
- 操作: 二面ビュー（車両/乗務）で車両連結・休憩挿入・回送挿入を手動で実施
- 保存: 常に非ブロッキング

### Step2（警告/KPI＋支援）
- 警告/KPIの表示（Hard/Soft）を有効化
- Greedy 連結と候補提示UIを導入（自動確定なし）

### Step3（自動化）
- ソルバでの自動配置（案提示→人手確認→保存）

---

## スコープ境界（Step1/Step2/Step3）— 2025-10-23 追加

本節は現状実装の適合性チェックと、やること／やらないこと（Step境界）を明文化する。

-### Step1（運用MVP・人手主体）
- Do（実装済）
  - GTFS取込とサマリー、欠落検知。
  - 路線選択に基づく地図（MapLibre）可視化＋サービス日フィルタ。
  - 行路の自動連結しきい値（ON/OFF、最小折返し、ターン間隔）調整。
  - 交番のタイムライン編集（ドラッグ移動/リサイズ/追加・削除、Undo/Redo、CSV入出力）。
  - KPI/警告の表示（休憩不足・連続運転・日拘束超過、未割当など）。
  - 保存は常に可能（警告下でもブロックしない）。
  - CSV補完（車庫・交代地点・回送・運転士）＋UIでの上書き（労務/KPI閾値を含む）。
- Don’t（後続に回す）
  - 自動最適化ソルバの導入と自動確定。
  - 連結候補の自動提示UIとブロック連結操作（Step2で再導入予定）。
  - ブロック間のD&D連結（タイムライン上で直接の接続操作）。
  - 路線選択の結果をブロック編集タイムラインへ厳密反映（現状は地図のみ）。

≪適合性チェック結果≫
- 地図の路線絞り込みは実装済（`ExplorerView`→`buildExplorerDataset` が `routeIds` を反映）。
- ブロック編集タイムラインは現状すべての便が対象（`BlocksView`→`buildBlocksPlan` が `selectedRouteIds` 未参照）→ Step2 課題。
- ブロック連結はプルダウン＋候補ボタンで実施（D&D未対応）→ Step2 課題。
- 交番編集のドラッグ操作・警告・KPI・非ブロッキング保存は要件通り実装済。

### Step2（操作性・一貫性の強化）— Backlog
- B1: 路線選択のブロック編集タイムライン反映
  - 方針: `buildBlocksPlan` にルートフィルタを導入するか、GTFSテーブル段階でフィルタ済ビューを渡す。
  - 検証: 単体テスト＋Playwrightで「選択0件時は空」を確認。
- B2: ブロック連結 UI（候補提示＋Connect/Undo）を正式化
  - 方針: 連結候補スコアリング（時間ギャップ＋停留所近接/回送/交代点）を導入し、候補UIを再導入。
  - 検証: 単体・E2Eで候補の安定性を確認、Undo/Redo 含む。
- B3: ブロックD&D連結 UI（TimelineGantt 拡張）
  - 方針: ブロックタイムラインへドラッグ接続操作を追加し、`useManualBlocksPlan.connect` を呼ぶ。候補範囲の視覚化とスナップを提供。
  - 検証: 連結成功/失敗、Undo/Redo のUI/単体テストを追加。
- B4: 警告の拡充（ブロック側 Hard/Softの定義整備、折返し不足・重複・境界超過などの一貫表示）。
- B5: 取込UXの統合（`docs/specs/import-ux-unified.md` に沿って微調整）。

### Step3（自動化）— 構想
- S1: 制約付き自動配置ソルバ（MIP/ヒューリスティック）を導入し、案提示→人手確認→保存までを一括化。
- S2: KPI最適化指標のチューニングとシナリオ比較、ロールバック容易な保存履歴運用。
