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
4. 行路編集（手動連結・最小UI）: 未割当便の一覧から便をタイムラインへドラッグすると新しい行路カードを作成できます。既存ブロック同士の連結は From/To 選択で行い、回送/休憩の挿入は右クリックから操作します。
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

## Exec Plan: 5分体験のドラッグ＆ドロップ修正

### 全体像
「5分で体験」Step4 で記載しているドラッグ＆ドロップ操作（未割当便→新規行路作成）が実際のUIで体験できていない問題を解消する。原因は初期プラン生成時に `startUnassigned` を有効にしておらず、未割当便リストが空になっているため。合わせて、Step1ではタイムライン上のD&D連結は非対応であることを文言で明確化する。

### 進捗状況（TODO）
- [x] 実装: 初期プラン生成で未割当スタートを有効化（`src/features/blocks/BlocksView.tsx` の `buildBlocksPlan(...)` に `startUnassigned: true` を追加。Step1限定でよい）。
- [x] 実装: 未割当パネルのガイド文を「未割当便をドラッグすると新しい行路を作成」に統一（結合/分離の文言は残さない）。
- [ ] 実装: D&D オーバーレイの表示/非表示の発火条件を再確認（`onDragOver`/`onDrop` で `preventDefault` 済みか、テーブル行の `draggable`/`setData` を網羅）→ Playwright のD&Dシナリオで動作確認予定（ユーザー実機でも再検証中）。
- [x] 回帰防止（Unit）: `blockBuilder` の `startUnassigned` オプションをテストで固定化（全tripが `unassignedTripIds` に入ること）。
- [x] E2E: Playwright で未割当行からタイムライン領域へのD&Dを再現し、トースト成功と行路数の増加を検証（`tests/playwright/blocks.unassigned.dragdrop.spec.ts` を追加）。
- [x] Docs: 「5分で体験」(本ファイル) の Step4 文言を現仕様に整合（D&Dは未割当→新規行路のみ／連結はFrom/To選択）。
- [x] Docs: `docs/templates/README.md` の「使い方（5分）」も同様に更新。
- [ ] UI検証: `npm run build` → `make generate-snapshots` を実行し、差分 ≤ 0.5% を確認（ユーザー側でUI確認予定のため未実施。必要なら再開）。
- [ ] DevTools: `npm run devtools:landing-hero` を実行し、中央揃えと `tmp/devtools/landing-hero.png` を確認（レイアウトに影響がないことを念のため担保）。
- [ ] 反映: レビュー承認後に `make approve-baseline` を実行。

### 発見と決定
- 2025-10-28: Step1ではタイムライン上でのブロック連結D&Dは非対応のまま据え置く。未割当→新規行路D&Dのみを「5分で体験」の中核操作として保証する。
- 2025-10-28: 既存実装は `linkingEnabled: false` のため、初期化時に全tripが新規ブロックへ割当済みになり、未割当が空になる。`startUnassigned: true` を優先させて体験導線を回復する。

### 作業メモ（適用箇所）
- `src/features/blocks/BlocksView.tsx:77` 付近の `buildBlocksPlan(result, {...})` に `startUnassigned: true` を追加。
- 未割当パネル文言: `src/features/blocks/BlocksView.tsx:768-786` 付近と、カード説明部 `:431-435` の整合を取る。
- Playwright: 新規 `tests/playwright/blocks.unassigned.dragdrop.spec.ts` で DataTransfer をモックし、`setData('application/x-trip-id', ...)` を使ってD&Dを再現。

### Test
- 事前: `npm run build`
- E2E: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/blocks.unassigned.dragdrop.spec.ts`
- UIスナップショット: `make generate-snapshots`（失敗時は `tmp/ui-snapshots/fallback-*.md` を本ファイルの Test セクションへ追記）
- DevTools: `npm run devtools:landing-hero`

## Exec Plan: Blocksタイムラインの操作拡張

### 全体像
日別タイムライン上で行路カードのドラッグ＆ドロップ連結、便単位での分離、休憩/回送区間の追加と長さ調整を可能にする。既存のFrom/To連結フォームは残しつつ、視覚的な編集手段を補完する。

### 進捗状況
- [ ] 実装: TimelineGantt にコンテキストメニュー/ドラッグプロップを追加し、レーン単位のD&Dと区間右クリックをフックできるようにする。
- [ ] 実装: BlocksView で便ごとのセグメントを描画し、ブロック連結・分離・休憩/回送の状態管理を行う。
- [ ] 実装: manualPlan に行路分割ロジックを追加し、UI から呼び出せるようにする。
- [ ] UI検証: `npm run build` → `make generate-snapshots`。
- [ ] テスト: 必要に応じて `npm run lint` / Playwright を実行し、意図しない回帰がないか確認。

### 発見と決定
- 2025-10-29: 休憩/回送はブロックCSVには書き戻さず、Step1ではUI上での補助情報として扱う。将来的にエクスポートへ反映する際は新たなCSVスキーマ拡張が必要。
- 2025-10-29: D&D はレーンラベルをドラッグしてターゲット行路へドロップする方式で実装し、SVG区間のポインタ操作（リサイズ）とは干渉しない構造を採用する。

## Exec Plan: Vehicle面 UI 改修（軸トグル + 車両タイプバッジ）

### 全体像
Vehicle 面タイムラインで行路ID/車両IDの表示軸をトグルしつつ、行路ヘッダに想定車両タイプ（L/M/S など）をバッジ表示して可視性を高める。BlocksView を中心に、Duty 画面のブロックタイムラインでも統一表示する。

### 進捗状況
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
## Exec Plan: 未割当便ドラッグで新規行路生成

### 全体像
未割当便テーブルから便をドラッグし、BlocksView 内のドロップゾーンへ放すと新規行路を自動生成する。GTFSデータから該当便の時刻/停留所情報を復元し、手動ブロック計画へ安全に取り込めるようにする。

### 進捗状況
### 発見と決定
- 初期 GTFS では未割当件数が 0 でも、欠損行や将来の削除操作で便が孤立する想定。GTFS からの再計算でシードを作ることで、保存データに依存せず再現性を担保する。

### 決定ログ
2025-10-27: 新規ブロックIDは `BLOCK_###` 形式を踏襲し、既存ID重複を避けるためにインクリメントで探索する。

### To-Do
## Exec Plan: Step2 ダッシュボードと警告UIの復帰

### 全体像
Step2 以降向けに退避していた KPI ダッシュボードと差分比較ビューを `src/` へ戻し、`appStep >= 2` のときに AppShell からアクセスできるようにする。Blocks/Duties で算出した警告や未割当件数を再利用し、Step1 の軽量運用は維持する。

### 進捗状況
### 発見と決定
- 2025-10-27: Context7 `/olliethedev/dnd-dashboard` のドラッグレイアウト事例を参照し、カードレイアウトと KPI カテゴリの分節を再確認（レイアウト崩れがあれば Grid 調整で対処する方針）。
- 2025-10-27: Dashboard/Diff は Step1 では非表示のままにし、`appStep >= 2` 時にのみナビゲーションへ追加して互換性を守る。

E. 将来（Step2/Step3）へ移送（Step1から除外）
- [ ] 変更は小さく分割し、各コミットでビルド/スナップショットを確認

### 追加TODO（Step1: 使いやすさ向上・仕様整合）
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
