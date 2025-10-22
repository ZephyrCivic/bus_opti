# MVP 実行TODO（SSOT）

このファイルは本リポジトリの作業計画の単一情報源（Single Source of Truth; SSOT）です。UTF-8（BOMなし）で保存し、常にここを最新に保ちます。

## 北極星（詳細）
本プロダクトは、バス事業の計画業務（行路＝Block、交番＝Duty）を支援するSaaSのMVPです。
 - Step1: 既存の GTFS を読み込み、選んだ路線を地図とタイムラインで可視化。便の連結（行路）と交番をドラッグ操作で手作りする。作業中は、休憩不足・連続運転・未割当などの警告と、回送比率などの効率指標を表示するが、保存はブロックしない。GTFSに載っていない車両/ドライバー/倉庫・交代所/労務ルール等はCSVで補完し、制約条件はCSVに加えてUIから直接入力・上書き可能とし、現場判断で前に進める。
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


- [x] Duties ドラッグ割付・Undo/Redo・CSVプレビューを整備（2025-10-22 完了）
  - 参照: docs/specs/duty-editing.md, docs/specs/duty-editing.addendum.md
  - 検証: `make generate-snapshots` 合格（≤0.5%）。`npm test -- tests/duty.workflow.test.ts tests/duty.timeline.snap.test.ts tests/duty.manual.check.test.tsx`
  - 成果物/DoD: 割付/解除/移動、Undo/Redo（10段）、`duties.csv` プレビューに警告要約列が表示
  - 満たすGOAL: G1, G2, G4, G5
  - 対応テスト: tests/duty.workflow.test.ts, tests/duty.timeline.snap.test.ts, tests/duty.manual.check.test.tsx, tests/duty.unassigned.test.ts
  - 依存関係: スナップショット基準の整合、未割当ロジック（computeUnassignedRanges）
  - 実施ログ: `npm test -- tests/duty.workflow.test.ts tests/duty.timeline.snap.test.ts tests/duty.manual.check.test.tsx` でDoD検証。
- [x] Hard/Soft 警告の即時計算と根拠リンクを担保（2025-10-22 完了）
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: 編集後1s以内の再計算を `make generate-snapshots` と Playwright ログで確認
  - 成果物/DoD: Hard/Soft 件数がUI/CSVで一致し、根拠リンク（該当トリップ/ルール）へ遷移可能
  - 満たすGOAL: G1, G5
  - 対応テスト: tests/duty.specs.test.ts, tests/duty.metrics.test.ts, tests/duty.workflow.test.ts, tests/duty.unassigned.test.ts
  - 依存関係: 設定UIのしきい値、Blocks側の警告算出実装
  - 実施ログ: `npm test`（全体）でHard/Soft件数同期と根拠リンク関連テストを確認。

- [x] Import UX 統一（仕様策定のみ）（2025-10-22 完了）
  - 参照: docs/specs/import-ux-unified.md, docs/specs/import-ux-unified.mock.md
  - 成果物/DoD: 2導線共通サマリー仕様、文言/アクセシビリティ要件、影響範囲を明文化。モックにフォーカス順・エラー挙動を追記。
  - 検証: `./make.cmd generate-snapshots` 合格（≤0.5%）。Playwright視覚テスト4件パス、DevToolsヒーロー自動確認。
  - 実施ログ: `./make.cmd generate-snapshots` 実行で UI スナップショットと devtools チェックを取得。
  - 次アクション: PO合意後に Exec Plan「Import UX 統一（実装）」を起票し、路線ハイライト実装を別タスク化。

- [ ] 日本語UIの用語統一と文言修正（仕様策定→一括実装）
  - 背景: 利用者はバス乗務員と計画業務者。英語は最小限（GTFS列名・ID表示など）に留める。画面上の操作要素・説明・バッジ等は日本語を既定とする。
  - 決定（用語統一案・初回表示時は括弧で英語補足可）
    - Trip → 便（例: 総便数、便範囲）
    - Stop → 停留所
    - Route → 系統
    - Block → 行路（Block）
    - Duty → 乗務（Duty）
    - Driver → 運転士（driver_id はそのまま）
    - Depot → 車庫
    - Relief point → 交代地点
    - Deadhead → 回送（Deadhead）
    - Service ID → 運行日ID（service_id）
    - Hard/Soft（警告）→ 重大／注意（英語バッジは併記せず日本語に置換）
  - DoD（受け入れ基準）
    - 主要画面（Import/Explorer/Blocks/Duties/Dashboard/Diff/Manual）の可視テキストに英語が残るのは「GTFS列名・ID・ファイル名表示」のみ。
    - ボタン／バッジ／見出し／入力ラベルは日本語。ツールチップ・空状態メッセージも日本語。
    - スナップショット差分が 0.5% 以内で安定。`make generate-snapshots` パス。
    - a11y: aria-label/placeholder も日本語に統一（IDなど機械可読値は除く）。
    - 例外: 「KPI」の語は英語のまま維持（KPI 設定・KPI 詳細など）。
  - 影響ファイル（代表箇所と提案文言）
    - グローバル
      - `index.html:12` ページタイトルを「バス運行計画ツール（仮）」へ（要正式名称合意）。
      - `src/components/layout/AppShell.tsx:8,33` APP_NAME 表示を日本語化（例: バス運行最適化ツール）。
    - Import（概ね日本語化済・確認のみ）
      - `src/features/import/ImportView.tsx` サマリーのテーブル名は GTFS ファイル名をそのまま表示で可。説明文に「stops/trips/…」はコード記述として許容。
    - Explorer（英語混在が多い）
      - `src/features/explorer/ExplorerView.tsx:281` CardTitle "Route Timeline" → 「系統タイムライン」。
      - `src/features/explorer/ExplorerView.tsx:202` ボタン "Depots" → 「車庫」。
      - `src/features/explorer/ExplorerView.tsx:209` ボタン "Relief points" → 「交代地点」。
      - `src/features/explorer/ExplorerView.tsx:197-205` バッジ "Trip / Stop" → 「便 / 停留所」。
      - `src/features/explorer/ExplorerView.tsx:529,535,537,570,573,575` 「Trip数／総Trip数／フィルタ適用時Trip数」→「便数／総便数／フィルタ適用時便数」。
      - `src/features/explorer/ExplorerView.tsx:437` 「Manual タブ」→「手動入力タブ」。
      - `src/features/explorer/ExplorerView.tsx:620` `formatServiceOptionLabel` の返却文言 "Trips/Stops" → 「便/停留所」。
      - `src/features/explorer/ExplorerView.tsx:166` セクション見出し "Explorer" → 「地図・便調査」（タブ名と統一）。
      - `src/features/explorer/ExplorerView.tsx:462` 空状態文言 「GTFSフィードをインポートすると Explorer にデータが表示されます。」→「GTFSフィードを取り込むと地図にデータが表示されます。」。
    - Blocks（英語の見出し・列）
      - `src/features/blocks/BlocksView.tsx:269` 列見出し "Block ID" → 「行路ID」。
      - `src/features/blocks/BlocksView.tsx:272` 列見出し "Trip 数" → 「便数」。
      - `src/features/blocks/BlocksView.tsx` タイムラインのラベル "Trip {n} 件" → 「{n} 便」。
      - `src/features/blocks/BlocksView.tsx:332` セクション見出し 「未割当 Trip」→「未割当 便」。
    - Duties（英語のバッジ・ビュー名）
      - `src/features/duties/components/DutyTimelineCard.tsx:133-134` バッジ "Hard/Soft" → 「重大/注意」。
      - `src/features/duties/components/DutyTimelineCard.tsx:150,167` "Vehicleビュー/Driverビュー" → 「車両ビュー/乗務ビュー」。
      - `src/features/duties/components/BlockSummaryCard.tsx:69,70` "Block ID / Trip 数" → 「行路ID / 便数」。
      - `src/features/duties/components/BlockSummaryCard.tsx:95,110` "開始/終了 Trip" → 「開始/終了 便」。
      - `src/features/duties/components/UnassignedSegmentsCard.tsx:33-34` 列見出し "Block / Trip 範囲" → 「行路 / 便範囲」。
      - `src/features/duties/components/InspectorCard.tsx:89` 「Drivers CSV」→「運転士 CSV」。
      - `src/features/duties/components/InspectorCard.tsx:174-175` バッジ "Hard/Soft" → 「重大/注意」。
      - `src/features/duties/components/InspectorCard.tsx:214` 「Trip区間」→「便区間」。
    - Dashboard（表・フィルタの英語）
      - `src/features/dashboard/DashboardView.tsx:368-374` 絞り込みボタン "Hard/Soft" → 「重大/注意」。
      - `src/features/dashboard/DashboardView.tsx:385-389` テーブル見出し "Duty ID / Driver / Hard / Soft" → 「勤務ID / 運転士 / 重大 / 注意」。
      - `src/features/dashboard/DashboardView.tsx:615-617` バー凡例 `{hours} h` → 「{時間} 時間」。
      - `src/features/dashboard/DashboardView.tsx (SummaryCard)` バッジ "OK / WARNING / CRITICAL" → 「良好 / 注意 / 重大」。
    - Manual（文言の統一）
      - `src/features/manual/ManualDataView.tsx` トースト「ドライバー」→「運転士」に統一。
      - `src/features/manual/components/DeadheadRulesCard.tsx` ラベル "mode" → 「回送手段」（選択肢の walk/bus/other はそのまま許容）。
      - `src/features/manual/components/DriversCard.tsx` 見出しは現状「運転士（Drivers）」でOK。説明文とボタンは日本語のまま維持。
      - `src/features/manual/components/DepotsCard.tsx` 見出し・説明・ボタン・テーブル列の「デポ」を「車庫」に統一（CSVファイル名 `manual-depots.csv` はそのまま可、UI表示は「車庫」）。
    - その他
      - `src/components/layout/ErrorBoundary.tsx`／`src/components/ui/*` は日本語化済。ARIA/placeholder の残英語がないか最終確認。
  - 検証
    - 実装後に `make generate-snapshots` を実行（SNAP_DIFF_THRESHOLD=0.5）。差分が大きい場合は文言幅に応じてレイアウト微調整。
    - 主要フロー（Import→Explorer→Blocks→Duties→Dashboard→Diff→Manual）で、英語残存チェックリストを完了。
  - 対応テスト
    - 既存の Playwright/UI スナップショット。必要に応じて空状態・エラーメッセージの期待文言を更新。

- [x] 保存系アクションの導線見直し（仕様策定のみ）（2025-10-22 完了）
  - 参照: docs/specs/save-flows-navigation.md, docs/specs/save-flows-navigation.mock.md
  - 成果物/DoD: 左ナビ集約案と文言・エラーハンドリング・アクセシビリティ要件・KPI を明文化。モックで未保存バッジ/トースト/権限差分を表現。
  - 検証: `./make.cmd generate-snapshots` 合格（≤0.5%）。DevTools ヒーロー自動確認、操作シナリオをモックに記述。
  - 実施ログ: `./make.cmd generate-snapshots` 実行で Playwright 視覚テスト4件パス。
  - 次アクション: Exec Plan「保存導線見直し（実装）」を起票し、左ナビ/ステータスバッジ/履歴ストア更新をタスク分解。

- [ ] Exec Plan: Import UX 統一（実装）
  - 背景: 仕様合意後、ImportView 全体のUI刷新とテレメトリ更新を短期間で実装する必要がある。
  - 参照: docs/specs/import-ux-unified.md, docs/specs/import-ux-unified.mock.md, docs/exec-plans/import-ux-unified.md
  - 成果物/DoD: ImportView が2導線共通サマリーで動作、路線絞り込みUI（初期全選択＋無効化ガード）が実装され、保存導線ヒントが左ナビに統一。Explorer 遷移テレメトリ更新、README/FAQが最新化。
  - 満たすGOAL: G1, G4, G5, G7
  - 検証: `npm test -- tests/import-flow.spec.ts`（新規）, `./make.cmd generate-snapshots`（≤0.5%）, `npm run devtools:landing-hero`
  - 対応テスト: tests/import-flow.spec.ts（新規）, tests/visual.spec.ts（更新）
  - 依存関係: POレビュー承認、保存導線実装タスクとの整合、スナップショット基準更新はレビュー承認後
  - 進捗ログ（2025-10-22）: 読み込みメニュー2導線・路線絞り込みUIを実装、Explorerボタンはセクションナビゲーション経由で遷移可能。テレメトリ更新とプレイライト新規シナリオ、README/FAQ整備は未着手。
  - 次アクション: Exec Plan の To-Do（テレメトリ更新／Explorer連携／import-flowテスト／ドキュメント更新）を順に対応。保存導線 Exec Plan も並行準備。
## 実行コマンド集
- ビルド/プレビュー: `make preview`
- UIスナップショット: `make generate-snapshots`（閾値 0.5%）
- DevTools ヒーロー検証: `npm run devtools:landing-hero`
- GTFS ヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

---

## リスクと前提（要対応の論点）
- 警告整合性: UI と CSV の Hard/Soft 件数を1秒以内に同期させる。根拠リンク（該当トリップ/ルール）遷移を必須。
- Blocks 側の警告算出: 現状0件のまま。折返し不足などの算出を導入し、CSV/画面へ反映。
- スナップショット基準: Blocks UI 変更により visual baseline がずれている。基準更新はレビュー承認後に限定。
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

## アーカイブ（完了タスク）

- アーカイブは docs/plans-archive.md に移行しました（2025-10-22 移行）。
