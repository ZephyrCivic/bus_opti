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

- [x] スコープ境界の明確化（2025-10-24 改定を反映：Step1は推奨/警告/KPIなど計算類を一切しない）

- [x] Step1 外機能の棚卸しと削除（実装済みの情報を分析し、Step1以外を除去）
  - 参照: 本ファイル「スコープ境界—2025-10-24 改定」の適合性チェック、`ExplorerView`/`BlocksView` 記述
  - 検証: KPI/警告UI・自動連結・D&D連結・候補提示・過剰なルート連携がUI/コードから消えていることを確認。`make generate-snapshots` ≤0.5%、`npm run devtools:landing-hero` パス
  - 成果物/DoD: Step1で不要な機能がコード/設定/テストから削除または無効化され、G1〜G4に専念できる状態
  - 満たすGOAL: G1, G2, G3, G4

- [x] Step1 CSV 補完の網羅（Vehicle/Driver/Depot/労務ルール）
  - 担当: OwnerA
  - 参照: docs/templates/*.template.csv, docs/specs/requirements-blocks-duties.md
  - 検証: `npx tsx --test tests/manual.csv.test.ts tests/duty.manual.check.test.tsx tests/gtfsPersistence.test.ts`
  - 成果物/DoD: すべての台帳CSVで UI⇔CSV の往復がロス無く可能。UI単独でも同等編集可能。
  - 満たすGOAL: G1, G7
  - 対応テスト: tests/templates.roundtrip.spec.ts, tests/playwright/manual-csv.e2e.spec.ts

- [x] S1: 回送（Deadhead）挿入UI（Block/Duty）
  - 担当: OwnerB（S1-UI完了後に着手）
  - 方針: deadhead_rules.csv を参照しつつ、手動で区間を追加可能にする
  - 成果物/DoD: 手動回送の追加/削除が可能、CSVへ書き出し

- [x] S1: KPI/警告 UI の削除（Step1）
  - 担当: OwnerA
  - 方針: Dashboard のKPIカード/警告バナー、Dutiesの警告バッジなどを非表示ではなく削除（Step2で再導入）
  - 成果物/DoD: 画面上にKPI/警告のUIが一切表示されない。関連E2EはStep2タグに移動/スキップ

## Exec Plan: Explorer に取込対象系統選択を統合

## 全体像
ImportView に存在する路線絞り込み UI を Explorer に集約し、地図と同じ画面で行路編集対象となる便（系統）を選択できるようにする。ナビゲーションやヘッダーの文言を「行路編集対象の便」に統一し、便/系統の表記揺れを棚卸して整合させる。

## 進捗状況
- [ ] UI 検証: `make generate-snapshots`（home snapshot 差分を確認済み、基準更新はレビューフロー後）
  - 担当: OwnerA

## 発見と驚き
- Vite preview が使用するポート 4173/4174 が既存プロセスに占有されており、`make generate-snapshots` / `npm run devtools:landing-hero` 実行時にプレビューサーバ起動エラーが発生する。手動でポート開放するか代替ポート設定が必要。

## 決定ログ
- 2025-10-22: Explorer へ系統選択 UI を統合し、文言を「行路編集対象の便」で揃える方針を検討開始。

## To-Do


## 実行コマンド集
- ビルド/プレビュー: `make preview`
- UIスナップショット: `make generate-snapshots`（閾値 0.5%）
- DevTools ヒーロー検証: `npm run devtools:landing-hero`
- GTFS ヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

---

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
- [ ] Test: `make generate-snapshots` を実行し差分を確認
  - 担当: OwnerA

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
  - 2025-10-23 (OwnerA S1-Tests): `npx tsx --test tests/manual.csv.test.ts` で匿名化済み期待値を確認し、`PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/playwright/export.nonblocking.confirmation.spec.ts` を実行して非ブロッキング保存導線を検証（既存プレビューを再利用）。
  - 2025-10-23 (OwnerA G8): `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/playwright/export.nonblocking.confirmation.spec.ts` と `npm test -- tests/audit.log.test.ts` を実行し、出力確認ダイアログが非モーダルで監査ログが残ることを確認。
  - 2025-10-23 (OwnerA G1): `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/playwright/save-flows.always-enabled.spec.ts` を実行し、警告下でも保存ボタンが常時有効であることを確認。
  - 2025-10-23 (OwnerA Verify): `npm test -- tests/workflow.telemetry.timing.test.ts` を再実行し、ワークフロー計測ユーティリティの現状動作を確認。
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

## スコープ境界（Step1/Step2/Step3）— 2025-10-24 改定

本節は現状実装の適合性チェックと、やること／やらないこと（Step境界）を明文化する。Step1は「究極にシンプル」を最優先とし、推奨・警告・KPIなど計算類は一切行わない。

### Step1（運用MVP・人手主体）
- Do（実施内容）
  - GTFS取込とサマリー表示、欠落検知（表示まで）。
  - 地図（MapLibre）可視化＋サービス日フィルタ（表示のみ）。
  - 二面ビュー（車両/乗務）での完全手動編集：ブロック連結・休憩挿入・回送挿入、ドラッグ移動/リサイズ/追加・削除、Undo/Redo、CSV入出力。
  - 二面ビューの即時同期（Vehicle/Driver）。
  - 保存は常に非ブロッキング。
  - 計算/推奨/警告/KPIは「表示もしない／計算もしない」。
- Don’t（後続に回す）
  - 警告/KPIの計算・表示（Hard/Soft 含む）。
  - ブロック連結候補の提示やGreedy、自動確定。
  - 行路の自動連結しきい値調整（ON/OFF、最小折返し、ターン間隔等）。
  - ブロック間のD&D連結（タイムライン上で直接接続）。
  - 路線選択結果のブロック編集タイムラインへの厳密反映（Step2で検討）。
  - 自動最適化ソルバ、KPI最適化、シナリオ比較など。

≪適合性チェック結果（現状→Step1方針）≫
- KPI/警告UI・集計の参照が複数箇所に残存（Dashboard/Duties/Blocks/Export）。Step1では「非表示かつ未計算」に変更する。該当箇所は削除またはガードで抑止。
- 地図の路線絞り込みは実装済（`ExplorerView`→`buildExplorerDataset` が `routeIds` を反映）。Step1では地図のみで十分。タイムライン反映は後続。
- ブロック編集は手動連結（Connect/Undo）に限定。候補提示やD&D連結は削除/無効化。
- 非ブロッキング保存の導線は維持（ダイアログは簡素化し、警告/KPI要素を除去）。

上記を反映するための具体TODOは「TODO 一覧」の先頭（Step1 外機能の棚卸しと削除）に集約。

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


