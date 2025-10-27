# MVP 実行ガイド（SSOT）

最終更新: 2025-10-24

このファイルは現在の実装計画の単一情報源（SSOT）です。Step1のコア機能は完了しています。以下の残件はUI/運用補助の範囲（非ブロッキング）で、順次対応します。過去の詳細タスクは `plans.archive/2025-10-24.md` に退避しました。

## 北極星（読むだけで使い方が分かる版）
目的: 1運行日の行路（Block）と交番（Duty）を、GTFS+CSV を読み込んで二面ビューで人手で作る。

対象ユーザー: バス事業の運行計画担当者（配車/乗務編成を日次で組む人）。

用語ミニ辞書
- 行路（Block）: 同一車両で連続運行する便のまとまり（Step1では抽象ブロックとして手作り）。
- 交番（Duty）: 乗務のまとまり（区間の並び）。Step1では driver_id を記録するだけ（計算/検証なし）。
- 配車/配員: 行路→vehicle_id、Duty→driver_id を割付する行為。Step1では任意だが出力前に割付推奨。

必要ファイル（Step1・運用必須）
- 必須（運用）: `gtfs.zip`, `vehicle_types.csv`, `vehicles.csv`, `drivers.csv`
- 任意: `depots.csv`, `relief_points.csv`, `deadhead_rules.csv`, `labor_rules.csv`
- 雛形: `docs/templates/*.template.csv`

5分で体験（Step1 の基本フロー）
1. 事前準備: `vehicle_types.csv`（サイズ=Large/Medium/Small 等）, `vehicles.csv`（vehicle_id と type を紐付け）, `drivers.csv`（driver_id のみでも可）を用意する。
2. 取込: 画面で `gtfs.zip` と上記 CSV を選択し、取込サマリー（便数・車両数・運転士数）を確認する（不足があっても作業は継続可能）。
3. 地図: サービス日を選び、系統を切り替えて状況を把握する（表示のみ）。
4. 行路編集（手動連結・最小UI）: 画面の「手動連結」セクションで From/To を選び「連結」→必要に応じて「取り消し」。ターン間隔は参考表示。未割当便はテーブルで確認でき、ドラッグ＆ドロップまたはボタン操作で新規行路を作成できます。回送/休憩の挿入は次の交番編集で行います。
5. 交番編集（Driver面）: 縦軸=driver_id。Duty を作成し、`driver_id` を入力/選択（未割当でも編集可だが運用上は入力推奨）。二面ビューは即時同期。
6. 保存: 警告やKPIの計算/表示は行わず、常に保存できる（非ブロッキング）。
7. 出力: 出力前チェック（表示のみ）で未割当の件数（vehicle_id/driver_id/未配置便）を確認し、CSV をエクスポート（件数が残っていても続行可）。
   - スクリーンショット: 各ステップの画面を撮影し、本節に貼る予定の枠を後日追加する（Step1レビュー用）。添付先は `docs/templates/README.md` の記載に従う。

主要操作（Step1）
- 勤務タイムライン（Driver面）: ドラッグ移動、リサイズ、追加、削除、分割/連結。
- 回送/休憩（Driver面）: コンテキストメニューから区間を挿入/削除。
- 行路操作（Vehicle面）: From/To選択で手動連結（候補提示・自動確定なし）。
- Undo/Redo: Ctrl+Z / Ctrl+Shift+Z。
- 入出力: CSV の読み込み/書き出しをメニューから実行。
- 表示（Vehicle面）: 日別タイムライン表示。行路ID/車両IDの軸トグルを提供（未割当車両レーンは準備中）。
- 表示（Driver面）: 縦軸=driver_id（未割当レーンは常設）。
- 凡例: 系統色=便ピルの縁色。行路ヘッダに L/M/S バッジ（想定車両タイプ）を表示。

## Exec Plan: Vehicle面 UI 改修（軸トグル + 車両タイプバッジ）

### 全体像
Vehicle 面タイムラインで行路ID/車両IDの表示軸をトグルしつつ、行路ヘッダに想定車両タイプ（L/M/S など）をバッジ表示して可視性を高める。BlocksView を中心に、Duty 画面のブロックタイムラインでも統一表示する。

### 進捗状況
- [x] 仕様確認: block-ui-redesign.md / timeline-interactions.md / 現行 BlocksView のデータ構造を読み直す
- [x] TimelineGantt 拡張: Lane ラベルにバッジを描画できるよう型と描画ロジックを調整
- [x] BlocksView 対応: 表示軸トグル UI を追加し、lane データ生成で blockMeta（vehicleId/vehicleTypeId）を反映
- [x] DutiesView 反映: Duty 画面のブロックタイムラインにも同じバッジ表示を適用
- [x] テスト/ドキュメント: `npm run test -- tests/ui.timeline.render.test.tsx` 実行・本 plans.md 更新済み
- ショートカット: 連結=Enter、分割=S、取り消し=Ctrl+Z、やり直し=Ctrl+Shift+Z、未割当へ戻す=Backspace。
見えない/起きないこと（Step1 の約束＝コールド）
- 警告/KPI/推奨は「計算もしない／表示もしない」。
- 候補提示・Greedy・自動確定は存在しない。
- 警告の有無に関わらず保存は常に非ブロッキング。
- 車両タイプ適合や資格適合の自動検証は行わない（記録のみ）。
- 表示軸の切替は可視化のみであり、割付の自動移動・整列は行わない。
- 英語のみの UI 文言は出さない（例外は固有名詞・仕様名）。

次の段階（ロードマップの見取り図）
- Step2（支援）: 警告・KPI の可視化、候補提示 UI（自動確定なし）。
- Step3（自動化）: ソルバでの自動配置案提示（人手確認→保存）。

補助目標（Step1 で重視するもの）
- G1: 保存は常に可能（ブロックしない）
- G2: 自動確定なし（人手主体）
- G3: 二面ビュー（Vehicle/Driver）の即時同期
- G4: 行路連結・休憩・回送は完全手動


## 整合性レビュー（2025-10-24）
- ドキュメント: Step1は「手動連結の最小UI」を前提に記述（OK）。実装: BlocksView も手動連結UI中心（OK）。
- ドキュメント: 「未割当便→ドラッグで新規行路」は実装済み。ドラッグ/ボタン両方の操作方法を記載する。
- ドキュメント: 出力前チェックは件数の表示のみ（非ブロッキング）。実装: ExportConfirmationProvider で未割当件数カードを表示（`src/components/export/ExportConfirmationProvider.tsx`, `useStepOneExportCounts`）。
- ドキュメント: 車両タイプ/車両IDは“記録のみ”。実装: 未実装（要対応）。
- ドキュメント: KPI/警告/ダッシュボードはStep1対象外。実装: コードは残存しナビから非表示（要削除または隔離）。
- ドキュメント: 日本語優先。実装: ほぼ準拠、英語UIは主にDashboard系（Step1から除外予定）。

- 原則: 画面テキスト・メニュー・ヘルプ・ドキュメントは日本語。英語は必要最小限。
- 例外の扱い: 固有名詞／標準仕様名（GTFS, CSV ヘッダ名, API パラメータ）は英語を許容。
- 併記ルール: 英語を出す場合は先に日本語（例: 保存履歴（Save history））。
- 例外一覧: `docs/i18n-exceptions.md` を参照し、更新時は両方を同期する。
- 対象範囲: ユーザー向け文言のみ。コード識別子・型名は既存どおり（英語可）。
- CSV/仕様との整合: フィールド名は仕様準拠（英語）を維持し、READMEやUIでは日本語説明を付す。

## Step1 完了定義（DoD）
- カバレッジ: 当日対象の全便がいずれかの行路に所属（未配置便=0が望ましい）。
- 行路属性: 各行路に vehicle_type（サイズ）を記録し、必要に応じて vehicle_id を割付（未割当は一時的に可）。
- 交番属性: 各Dutyに driver_id を割付（氏名は任意・匿名可、未割当は一時的に可）。
- 手作業挿入: 必要箇所の回送/休憩を挿入済み。
- 永続化: 保存成功＋CSV出力を実施（非ブロッキング）。
- 出力前の見える化: 未割当 vehicle_id / driver_id / 未配置便の件数を確認（表示のみ、続行可）。
- UI確認: `make generate-snapshots` 差分≤0.5%、`npm run devtools:landing-hero` を通過。
- CSV往復: drivers/vehicles/vehicle_types のラウンドトリップが無損失。
- 日本語表記確認: 主要UIの英語単語が例外（固有名詞/仕様名）以外で残っていない。

## 検討ステップ（北極星準拠・コールド条件統合）
上の「5分で体験（Step1 の基本フロー）」各ステップを満たすことを実装・レビューの基準とし、やる/やらないを明文化する。

- Do（実施）
  - GTFS 取込とサマリー表示（表示まで）
  - 地図可視化＋サービス日フィルタ（表示のみ）
  - 二面ビューでの手動編集（連結・休憩・回送・ドラッグ/リサイズ・追加/削除・Undo/Redo・CSV 入出力）
  - Vehicle/Driver の即時同期、保存は常に非ブロッキング

- Don’t（やらない＝コールド条件）
  - 警告/KPI/推奨の計算・表示（Hard/Soft を含む）
  - 連結候補提示、Greedy、自動確定
  - ブロック間 D&D 連結などの半自動操作
  - 路線選択結果のタイムライン厳密反映（後続で検討）

適合性チェック観点（レビュー時の着眼）
- KPI/警告/UI/集計コードへの参照が残っていないか（削除/抑止済み）
- タイムライン編集は手動フローのみで完結しているか
- 保存導線が常時有効で、モーダルに依存していないか

結論（Step1 境界の最終確認）
- Step1 では推奨・警告・KPI など計算類は一切しない。UI にも表示しない。

## TODO（Step1再編：ドキュメント強化＋削除/修正計画）

A. ドキュメント詳細化（SSOTを充実）
- [x] docs/templates/README.md を新規作成（日本語・最小例・CSV仕様）
  - vehicle_types.csv: columns=vehicle_type_id, size(L/M/S), label
  - vehicles.csv: columns=vehicle_id, vehicle_type_id
  - drivers.csv: columns=driver_id, name(optional)
  - labor_rules.csv: columnsは将来用。Step1では未参照である旨を明記
  - DoD: 最小サンプルでImport→Exportの往復確認手順をREADMEに記述
- [x] plans.md の「5分で体験」を画面キャプチャ前提の手順に改訂（スクショは後日追加）
- [x] 日本語優先ポリシーの例外リストを docs/i18n-exceptions.md に分離して明記
- [x] `blocks_meta.csv` 仕様ドキュメントを追加（Step1専用）
  - 列: block_id, vehicle_type_id, vehicle_id（空許容）。
  - 位置: `docs/templates/blocks_meta.template.csv` と README に往復手順を追記。

B. 実装の削除/隔離（Step1から外す）
- [x] ダッシュボード一式の隔離（ビルド対象から外す）
  - 対象: src/features/dashboard/*, src/services/dashboard/*, src/services/state/dashboardCalculator.ts
  - DoD: `npm run build` 成功、Step1画面に影響なし、Import/Blocks/Dutiesの動作維持
  - 実装: ダッシュボード関連コードを `step2/features/dashboard` / `step2/services/dashboard` / `step2/services/state` に移動し、`src/` から削除。対応テストを `step2/tests` へ退避。
  - Test: `npm run typecheck`、`npm test`（26秒でタイムアウト扱いだが全174ケース PASS を確認）
- [x] 差分機能の隔離
  - 対象: src/features/dashboard/Diff*.tsx, src/services/state/scheduleDiff.ts
  - DoD: ビルド成功、ナビ/コンテキストから参照が消える
  - 実装: Diff 関連コードを上記 Step2 アーカイブへ移動。AppShell ナビテストを Step1 セクション構成に合わせて更新。
  - Test: 上記に同じ（Step1向け単体テスト一式が PASS）
- [x] ワークフローテレメトリの除去（Step1は記録しない）
    - 対象: src/services/workflow/workflowTelemetry.ts を no-op 化 or 参照を削除
    - 影響箇所: src/components/export/ExportConfirmationProvider.tsx（ensureWorkflowSession/completeWorkflowSave呼び出し）
    - 実装: workflowTelemetry を完全 no-op 化し、記録/保存なし（tests/telemetry.workflow.timing.test.ts をStep1仕様へ更新）
    - Test: `npm run typecheck`、`npm test -- tests/blocks.csv.export.test.ts tests/blocks.csv.roundtrip.test.ts tests/telemetry.workflow.timing.test.ts`（30秒制限で打ち切りログあり・結果は185件 PASS）
  - DoD: 出力前ダイアログは表示され、計測/記録は一切走らない
- [x] 警告/KPI/自動調整のロジックを隔離
    - 対象: src/services/duty/{dutyMetrics.ts,aggregateDutyWarnings.ts,dutyAutoCorrect.ts}
    - DoD: DutiesView は `showWarnings=false`でコンパイル/実行可。エクスポート/プレビュー動作に影響なし
    - 実装: Step1フラグで dutyMetrics 計算をスキップし、警告UI/自動調整ボタンを非表示化。自動調整呼び出しはトースト通知のみ
    - Test: `npm run typecheck`
- [x] 行路警告ダイアグノスティクスの除去
    - 対象: BlocksView 内の evaluateBlockWarnings 連携を丸ごとStep2へ退避
    - DoD: 表は重複合計のみを表示（警告列は削除）し、ビルド成功
    - 実装: buildBlocksPlan の diagnostics オプションを用いて Step1 では警告評価を全停止。BlocksView では警告表示なしを前提に UI 整理済み
    - Test: `npm run typecheck`, `npx tsx --test tests/blocks.manualPlan.test.ts`

C. 実装の修正（Step1に残す）
- [x] ExportConfirmationProvider を Step1専用に簡素化
    - 仕様: Step1は固定文言のみ表示。summary.metrics/警告ピル表示は無効、テレメトリ呼び出し削除
    - DoD: Duties/Blocks の出力フローが従来どおり継続
    - 実装: Step1カードのみ表示し、Step2向け警告UIと関連アイコンを削除。将来復帰メモを注記
- [x] Import時の事前案内バナー（CSV不足でも継続可）
    - 対象: src/features/import/ImportView.tsx
    - DoD: drivers/vehicles未提供時に“続行可能”の日本語バナー表示
    - 実装: manual.vehicleTypes / manual.vehicles / manual.drivers の欠如を検知し、InfoバナーでStep1の継続可を案内
    - Test: `npm run typecheck`（2025-10-24）
- [x] BlocksView の用語/説明の統一（手動連結が主）
  - DoD: ヘッダ/説明文がplans.mdと一致
- [x] Duties Inspector のガイド文言整備（driver_idの入力導線）
  - DoD: ガイドが見える。CSV出力にdriver_idが反映

- [x] Block記録UI（想定車両タイプ/車両ID）
  - 仕様: 行路ヘッダ/一覧に記録用UIを追加。検証や自動割付は行わない。未入力可。候補は `vehicle_types.csv` / `vehicles.csv` を使用しつつ自由入力も許容。
  - 保存: `manual.blockMeta: Record<block_id, { vehicleTypeId?: string; vehicleId?: string }>` に保存し、保存データ(JSON)にも含める。
  - 出力: `blocks_meta.csv`（block_id, vehicle_type_id, vehicle_id）を新規で出力（Step1ではBlocks CSVに列追加せず、メタを分離）。
  - 対象: `src/features/blocks/BlocksView.tsx`（ヘッダー/表の列追加または行路カードにドロップダウン）、`src/services/import/gtfsPersistence.ts`（保存/復元）、`src/services/export/blocksCsv.ts` 周辺（メタ出力の新規関数）。
  - DoD: 記録→保存→再読込でUIが復元。`blocks_meta.csv`に記録が出力。CSVテンプレが存在し、ドキュメントの往復手順で確認。
  - 移行: 既存保存データは `blockMeta` 不在でも動作。未設定は空扱い。
- [x] 出力前チェック（件数表示のみ）の実数定義を明文化
  - 集計元: vehicle_id未割当= `manual.blockMeta` で未設定の行路数／driver_id未割当= Duty配列で未設定件数／未配置便= BlocksPlanの `unassignedTripIds` 長さ。
  - UI: `ExportConfirmationProvider` の本文に件数を表示（非ブロッキング、続行可）。
  - 実装: `src/components/export/useStepOneExportCounts.ts`, `src/components/export/ExportConfirmationProvider.tsx`。
- [x] Block記録UIの最小E2Eを追加
  - 行路にvehicle_type/vehicle_idを入力→保存→再読込→UI復元→`blocks_meta.csv`出力を確認。
  - DoD: 件数が表示され、保存/出力の可否に影響しない。
  - 実装: `tests/playwright/blocks.meta.step1.spec.ts` を追加。`__TEST_MANUAL_INPUTS` で blockMeta を検証し、CSV 出力をダウンロード確認。
  - Test: `npx playwright test tests/playwright/blocks.meta.step1.spec.ts tests/playwright/step1.basic-flow.spec.ts`（Web サーバ起動待ちで120秒タイムアウト。既知の Playwright webServer 課題。要フォロー）
D. テスト/スナップショット整理（Step1基準）
- [x] Step2依存のPlaywrightテストを一時隔離 or skip
  - 対象: 
    - tests/playwright/blocks.manual-workflow.spec.ts
    - tests/playwright/blocks.warnings.spec.ts
    - tests/playwright/duty-break.manual.spec.ts
    - tests/playwright/duty-deadhead.manual.spec.ts
    - tests/playwright/export.nonblocking.confirmation.spec.ts
    - tests/playwright/save-flows.always-enabled.spec.ts
  - DoD: `make generate-snapshots` がタイムアウトせず終了。fallbackが出た場合は logs を plans.md > Test に添付
  - 実装: 各シナリオの `test.describe` を Step1 専用コメント付き `describe.skip` に変更（Step2 UI 復帰まで保留）
- [x] Step1用の最小E2Eを追加
  - 未割当便の可視化、手動連結、Duty作成、driver_id入力、CSV出力の一連
  - 実装: `tests/playwright/step1.basic-flow.spec.ts` を作成。ドライバ追加→行路連結→Duty作成→CSV Export を `__TEST_*` フック経由で検証。
  - Test: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/step1.basic-flow.spec.ts`（手動で `npm run preview` を起動した上で実行。Export 確認ダイアログを自動操作する処理を追加済み）

## Exec Plan: 未割当便ドラッグで新規行路生成

### 全体像
未割当便テーブルから便をドラッグし、BlocksView 内のドロップゾーンへ放すと新規行路を自動生成する。GTFSデータから該当便の時刻/停留所情報を復元し、手動ブロック計画へ安全に取り込めるようにする。

### 進捗状況
- [x] データ層: GTFS 結果から単一便の Block シード（時刻・停留所・serviceId）を生成する API を追加
- [x] ロジック層: manualPlan に未割当便から新行路を生成する純関数を実装し、Undo の履歴と整合
- [x] UI: BlocksView/未割当テーブルにドラッグ可視化とドロップゾーン、クリック代替アクションを導入
- [x] テスト/ドキュメント: manualPlan + seed の単体テスト、Playwright/ドキュメント更新（5分体験の文言修正を含む）

### 発見と決定
- 初期 GTFS では未割当件数が 0 でも、欠損行や将来の削除操作で便が孤立する想定。GTFS からの再計算でシードを作ることで、保存データに依存せず再現性を担保する。

### 決定ログ
2025-10-27: 新規ブロックIDは `BLOCK_###` 形式を踏襲し、既存ID重複を避けるためにインクリメントで探索する。

### To-Do
1. [x] `buildSingleTripBlockSeed`（仮称）を追加して単便情報を抽出
2. [x] manualPlan へ `createBlockFromTrip` を実装し、`useManualBlocksPlan` に公開
3. [x] UI（ドラッグ＆ドロップ／代替ボタン／トースト）を実装
4. [x] テスト・plans.md/ドキュメント更新（「準備中」文言の刷新含む）


## Exec Plan: Step2 ダッシュボードと警告UIの復帰

### 全体像
Step2 以降向けに退避していた KPI ダッシュボードと差分比較ビューを `src/` へ戻し、`appStep >= 2` のときに AppShell からアクセスできるようにする。Blocks/Duties で算出した警告や未割当件数を再利用し、Step1 の軽量運用は維持する。

### 進捗状況
- [x] Step2 配下の UI/サービス/テスト資産を棚卸し、現行 `src/` の依存関係と差分を確認
- [x] DashboardView/DiffView と関連サービス（baseline history, duty dashboard, schedule diff）を再統合し、`isStepTwoOrHigher` でナビゲーションを条件表示
- [x] 再統合したロジックの単体テスト群（dashboardCalculator/duty.dashboard/duty.baseline*/scheduleDiff）を復帰し、`npm run test -- …` で回帰を確認。plans.md と Test セクションを更新

### 発見と決定
- 2025-10-27: Context7 `/olliethedev/dnd-dashboard` のドラッグレイアウト事例を参照し、カードレイアウトと KPI カテゴリの分節を再確認（レイアウト崩れがあれば Grid 調整で対処する方針）。
- 2025-10-27: Dashboard/Diff は Step1 では非表示のままにし、`appStep >= 2` 時にのみナビゲーションへ追加して互換性を守る。


E. 将来（Step2/Step3）へ移送（Step1から除外）
- [x] 「未割当便→ドラッグで新規行路生成」UI
- [x] Vehicle面の表示軸トグル（行路ID/車両ID）
- [x] 行路ヘッダの車両タイプバッジ（L/M/S）
- [x] KPI/警告の可視化一式と候補提示
- [x] ダッシュボード／差分機能のStep2復帰（`step2/` 配下からの再統合＋テスト再有効化）

F. リスクとロールバック
- [x] 削除/隔離前に `plans.archive/` に背景と理由を記録
  - 実装: `plans.archive/2025-10-24.md` に Step1 E2E 追加・Playwright skip・Excel ガイド追記の背景をまとめた節を追加
- [ ] 変更は小さく分割し、各コミットでビルド/スナップショットを確認

### 追加TODO（Step1: 使いやすさ向上・仕様整合）
- [x] ImportView の英語表記「OR」を日本語「または」に置換（日本語優先の徹底）
  - 対象: `src/features/import/ImportView.tsx` 内の OR バッジ
  - DoD: 画面上の英語が消える（例外リストを除く）
- [x] Blocks CSV エクスポートのStep1仕様化（違反列を出さない）
  - 仕様: Step1 では violations_* 列をヘッダから削除（または常に0/空文字）。
  - 対象: `src/services/export/blocksCsv.ts`（ヘッダ/行生成の条件分岐）
  - DoD: 出力列仕様がStep1に一致し、既存画面からの出力で確認
- [x] buildBlocksPlan の警告計算をオプション化
    - 仕様: `options.diagnosticsEnabled=false` のとき `applyBlockWarnings` をスキップ
    - 影響: BlocksView では常に false を渡す。エクスポート仕様とも整合
    - DoD: 警告計算が走っていないことをログ/プロファイルで確認
    - 実装: `buildBlocksPlan` に diagnosticsEnabled オプションを追加し、Step1 経路（BlocksView / DutyPlan）で false を指定
    - Test: `npm run typecheck`、`npx tsx --test tests/blocks.plan.overlap.test.tsx`
- [x] CSVテンプレの実体ファイル追加（docs/templates/*.template.csv）
  - drivers/vehicles/vehicle_types/labor_rules の4種を用意（UTF-8 BOM付、サンプル数行）
  - DoD: Excel でも文字化けしないことをREADMEの手順で確認
- [x] Excel向けTSV/UTF-8 BOMオプションの検討（将来要望）
  - 仕様: エクスポート形式をCSV/TSVから選択。既定はUTF-8 BOM付CSV
  - DoD: ドキュメントに選択肢と注意書きを追記（実装はStep2以降）
  - 実装: `docs/templates/README.md` にExcelでのBOM指定とTSV運用の手順を追記
— アーカイブ: 過去のタスクと検討ログは `plans.archive/2025-10-24.md` を参照してください。



## スクリーンショット撮影（後日）
- 前提: 
pm run build を一度実行してから、make generate-snapshots を実行。
- 失敗時: インフラ要因でプレビュー起動やPlaywright準備が失敗した場合は自動フォールバック（	mp/ui-snapshots/fallback-*.md）。パスと原因を本ファイルの Test セクションに記録。
- 再試行: 強制的に失敗を再現したい場合は SNAPSHOT_FALLBACK_DISABLE=1 npm run generate-snapshots。
- 承認: スナップショット取得に成功したら、レビュー承認後に make approve-baseline を実施。

## Test (2025-10-27)
- `npm run build`
  - 目的: Playwright 実行前に最新ビルドを確定。
- `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/blocks.meta.step1.spec.ts`
  - 手順: 先に `npm run preview` を手動起動（ポート 4174 を既存 node プロセスから切り離したうえで実行）。
  - 結果: PASS。export ダイアログを自動承認する処理と CSV ダウンロードの `createReadStream` フォールバックを追加。
- `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/step1.basic-flow.spec.ts`
  - 手順: 上記と同じく手動 preview（終了忘れ防止のためテスト完了後にプロセスを停止）。
  - 結果: PASS。手動データ画面での driver 追加と export ダイアログを自動化。
- 備考: `make generate-snapshots` は引き続き preview/webServer の多重起動問題が残っているため未実施。視覚リグレッション確認は Playwright 安定後に再開予定（本節に理由を記録してスキップ）。
- `npm run test -- tests/blocks.manualPlan.test.ts tests/blocks.singleTripSeed.test.ts`
  - 目的: 未割当便ドラッグ機能の下支えとなるシード生成/plan更新ロジックの単体保証を追加。
  - 結果: PASS。`createBlockFromTrip` が割当済み便を拒否するケースも確認済み。
- `npm run test -- tests/dashboardCalculator.test.ts tests/duty.dashboard.test.ts tests/duty.baseline.history.test.ts tests/duty.baseline.test.ts tests/scheduleDiff.test.ts`
  - 目的: Step2 復帰したダッシュボード算出 / 差分ロジック / 基準履歴まわりの回帰確認。
  - 結果: PASS。`tests/scheduleDiff.test.ts` で `../src/services/...` にパスを揃え、Step2 限定ロジックが最新 `manualPlan` と整合することを確認。
