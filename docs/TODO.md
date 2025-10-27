<!--
  docs/TODO.md
  場所: docs/
  趣旨: プロジェクトTODOの優先順位・DoD・関連コマンドを一元管理する。
  形式: [ ] / [x] で進捗を更新し、Motto に従って安全に前進する。
-->

# TODO（優先順位つきロードマップ）

Motto: "Small, clear, safe steps — always grounded in real docs."

## 運用原則
- Plan → Read → Verify → Implement → Test & Docs → Reflect を必ず踏む。
- DoD と関連コマンドを各タスクに添え、更新時に [ ] / [x] を切り替える。
- Owner の明記が無いタスクは既定で Codex 担当とする。

## P0（最優先・SLA）
### 機能
- [x] ガントタイムライン最小UI（Blocks/Duties 共通コンポーネント）  
  DoD: SVGベースで時間軸と行（Block/Duty）を水平スクロール表示。24:00超の時刻を正しく描画し、矩形バーのクリックで選択ハイライト・Inspector連動（読み取り専用、D&Dなし）。`BlocksView`/`DutiesView` の双方に統合。軽量スナップショット＋Playwrightでの要素スクリーンショットが緑。  
  対象: `src/features/timeline/TimelineGantt.tsx`（新規）, `src/features/timeline/timeScale.ts`（新規）, `src/features/timeline/types.ts`（新規）, `src/features/blocks/BlocksView.tsx`（統合）, `src/features/duties/DutiesView.tsx`（統合）  
  メモ: `tests/ui.timeline.render.test.tsx` でスナップショット済み。Playwright 代替として Chrome DevTools CLI で `docs/screenshots/blocks-timeline.png` を取得（2025-10-07, Owner: Codex）。
- [x] manual.linking を尊重するリンクガード（OFF では連結せず、ON のみ許可）  
  DoD: ブロック結合テストで OFF / ON 双方を確認。対象: `src/services/blocks/blockBuilder.ts` ほか。  
  メモ: Linking設定に `enabled` トグルを追加（2025-10-07, Owner: Codex）。
- [x] HH 表記を 24:00 形式へ正規化し、Duty 計算まで整合させる  
  DoD: ブロック出力と Duty 指標で 24:00 を扱うユニットテストを追加。  
  メモ: stop_times の日跨ぎを `normalizeStopTimeRows`（2025-10-07, Owner: Codex）で処理し、警告文言も更新。
- [x] Blocks CSV エクスポート（正式スキーマ: block_id…settings_hash）  
  DoD: UI からダウンロードでき、生成時刻 / ハッシュを含めたテストが緑。  
  メモ: `src/services/export/blocksCsv.ts` と `BlocksView` ボタンで対応（2025-10-07, Owner: Codex）。
- [x] Duties CSV エクスポート（正式スキーマ: duty_id…settings_hash）  
  DoD: UI からダウンロードでき、セグメント境界と driver 情報を網羅するテストが緑。  
  メモ: `src/services/export/dutiesCsv.ts` と `DutiesView` ボタンで対応（2025-10-07, Owner: Codex）。
 - [x] CSV 出力UI（ExportBar ボタン: Blocks / Duties）  
   DoD: `BlocksView` / `DutiesView` に `ExportBar` を配置し、共通ボタンから Blocks/Duties CSV をダウンロードできる。スナップショットテスト緑。  
   対象: `src/features/blocks/BlocksView.tsx`, `src/features/duties/DutiesView.tsx`, `src/components/export/ExportBar.tsx`, `src/utils/downloadCsv.ts`  
   メモ: `ExportBar` コンポーネント＋サーバレンダーテスト追加（2025-10-07, Owner: Codex）。
- [x] ダッシュボード最小UI（4カード: totalShifts / totalHours / unassignedCount / fairnessScore）  
  DoD: テストデータと数値が一致。README「差分とダッシュボード指標」と整合。  
  対象: `src/services/state/dashboardCalculator.ts`, `src/App.tsx`, `src/features/dashboard/DashboardView.tsx`（新規）  
  メモ: `computeDutyDashboard` とテーブル表示で指標を可視化（2025-10-07, Owner: Codex）。
- [x] 差分（Diff）最小UI（追加 / 削除 / 担当替えの簡易テーブル）  
  DoD: 2つのスナップショットを比較して差分が表示できる。READMEと整合。  
  対象: `src/services/state/scheduleDiff.ts`, `src/features/dashboard/DiffTable.tsx`, `src/features/dashboard/DiffView.tsx`（新規）  
  メモ: Duty→Schedule変換で baseline を保存/読込し、DiffView で可視化（2025-10-07, Owner: Codex）。

### ドキュメント／データ
- [x] README に「60 秒デモ」の手順と留意点を追記  
  DoD: `tests/readme.*` で新セクションを検証、CLI 操作例を記載。  
  メモ: `README` に 60秒デモ節を追加し、`tests/readme.demo.test.ts` を新設（2025-10-07, Owner: Codex）。
- [x] デモ用データ `docs/demo` を整備  
  DoD: 下記 5 ファイルを揃え、Import → Blocks → Duties → CSV 出力まで 1 ループ完了。  
    • `project.gunmachuo.json`（GTFS+manual を保存したプロジェクト JSON）  
    • `drivers.csv`（10 名程度、`driver_id,name`）  
    • `depots.csv`（1–2 拠点、`depot_id,name,lat,lon,open_time,close_time,min_turnaround_min`）  
    • `relief_points.csv`（停留所紐付き、`relief_id,…,allowed_window`）  
    • `deadhead_rules.csv`（`from_id,to_id,mode,travel_time_min,distance_km,allowed_window`）

### テスト／CI
- [x] ガントUIのレンダリングテスト（軽量）  
  DoD: `tests/ui.timeline.render.test.tsx` でSVGと主要ラベル（時間目盛・行名）の存在を検証。`tools/chromeDevtoolsCli.ts` で主要要素のスクリーンショット保存に置き換え（Playwright未使用）。
- [x] manual.linking ガード用の単体テスト（連結距離・連結時間ケースを網羅）  
  DoD: 23:50 / 24:10 / 25:00 のケースを含め、`npm test` がゼロフェール。  
  メモ: `tests/blockBuilder.test.ts` に `linkingEnabled` ON/OFF のケースを追加（2025-10-07, Owner: Codex）。
- [x] 24:00 正規化の単体テスト（stop_times → Duty メトリクス）  
  DoD: 正規化前後の差分を比較するテストを追加し、`npm test` がゼロフェール。  
  メモ: `tests/blockBuilder.test.ts` と `tests/duty.metrics.test.ts` に日跨ぎケースを追加（2025-10-07, Owner: Codex）。
- [x] Blocks / Duties CSV 出力のスナップショットテスト  
  DoD: タイムスタンプ・ファイル名・ハッシュを含む比較テストが緑。  
  メモ: `tests/blocks.csv.export.test.ts` / `tests/duties.csv.export.test.ts` でCSV全文をスナップ照合（2025-10-07, Owner: Codex）。
- [x] Playwright スモーク（Context7 CLI で UI 起動確認）  
  DoD: `npx tsx tools/playwrightCli.ts evaluate …` が緑、スクリーンショット保存。  
  メモ: `playwright` を導入し、Evaluate と Screenshot を Example Domain で実行。`docs/screenshots/playwright-cli.png` 取得（2025-10-07, Owner: Codex）。

## P1（重要・MVP 差分）
### 機能
- [x] ガントUIの操作強化（D&D/リサイズ/ズーム）  
  DoD: バーのドラッグで Duty セグメントの開始/終了Tripにスナップする。Shift+ホイールで水平ズーム、Alt+ホイールで水平パン。キーボードで前後Tripへフォーカス移動。  
  対象: `src/features/timeline/TimelineGantt.tsx`（拡張）, `src/features/duties/utils/timelineSnap.ts`（連携）, `src/features/duties/DutiesView.tsx`（イベント統合）  
  メモ: `duty.timeline.snap.test.ts` でスナップ計算を検証し、`TimelineGantt` のインタラクション通知・キーボード操作を `DutiesView` に統合（2025-10-08, Owner: Codex）。
- [x] ガントUI操作強化の設計調査  
  DoD: 操作要件・実装ステップ・リスクを整理したメモを作成し、テストで存在を検証。  
  メモ: `docs/specs/timeline-interactions.md` に設計メモを追加し、`tests/timeline.interactions.design.test.ts` で検証（2025-10-08, Owner: Codex）。
- [x] ガントUI操作強化のズーム/パン基盤  
  DoD: Shift/Alt+ホイールでズーム/パンできるようにし、`TimelineGantt` のイベント拡張をテスト実行で確認。  
  メモ: `TimelineGantt` にインタラクション通知を追加し、`BlocksView` と `DutiesView` でズーム状態を管理（2025-10-08, Owner: Codex）。  
- [x] ガントUI操作強化のドラッグ&キーボード対応  
  DoD: Duty タイムラインでドラッグ/リサイズがトリップ境界にスナップし、矢印キーで前後の区間へフォーカス移動できる。  
  メモ: `TimelineGantt` にドラッグハンドルを追加し、`DutiesView` で `applySegmentDrag` を用いて更新。キーボード矢印でDuty/セグメント移動を実装（2025-10-08, Owner: Codex）。  
- [x] frequencies 対応（`trip_id#n` 生成、`exact_times`=0/1 両対応）  
  DoD: インポート時に周波数ダイヤを Duty に展開し、テストで確認。  
  メモ: gtfsParser で frequencies を静的便へ展開し、ユニットテストと README/DECISIONS を更新（2025-10-08, Owner: Codex）。
- [x] Manual CSV 入出力（depots / relief_points / deadhead_rules）  
  DoD: UI から CSV で round-trip できることを確認。  
  メモ: ManualタブでCSVインポート/エクスポートを提供し、`manualCsv`ユーティリティとテストで検証（2025-10-07, Owner: Codex）。
- [x] Relief / Deadhead の簡易チェックビュー（表示のみ）  
  DoD: Duty に設定値が反映される UI テストを追加。  
  メモ: `ManualCheckCard` を Duty 画面に追加し、`tests/duty.manual.check.test.tsx` で Relief 使用件数を検証（2025-10-07, Owner: Codex）。
- [x] Drivers CSV インポート（`driver_id` 重複検出を含む）  
  DoD: インポート後に Duty 作成で driver 選択が可能。  
  メモ: Manual タブに Drivers セクションを追加し、Duty Inspector で候補を選択可能化。`manualCsv` に重複チェックとテスト追加（2025-10-07, Owner: Codex）。
- [x] Duties の保存／読み込み（localStorage と簡易 `duties.csv`）  
  DoD: ブラウザ再読込後も最新 Duty が復元できることを確認。  
  メモ: DutiesView で localStorage 永続化と CSV 読込を実装し、ユニットテストを追加（2025-10-07, Owner: Codex）。
 - [x] ブロック差し替え方針の整理（直列 vs 迂回など）  
  DoD: README か DECISIONS に判断基準を文書化。  
  メモ: DECISIONS に直列/迂回の基準・手順を追記し、テストで確認（2025-10-08, Owner: Codex）。
- [x] KPI × UX パネル（拡張UI: グラフ/詳細ビュー）  
  DoD: 4カードはP0で実装済。追加のグラフや詳細テーブルを提供。  
  メモ: Step2 復帰にあわせて DashboardView のスパークライン・Top5 棒グラフ・KPI 詳細テーブル・警告タイムラインを再有効化（2025-10-27, Owner: Codex）。
- [x] KPI × UX パネルの設計調査  
  DoD: グラフ/詳細ビュー/監査連動の要件を整理したメモを作成し、テストで確認。  
  メモ: `docs/specs/kpi-ux-panel.md` に仕様メモを追加し、`tests/dashboard.kpi-ux.design.test.ts` で検証（2025-10-08, Owner: Codex）。  
- [x] KPI × UX パネルのデータ基盤  
  DoD: 日別メトリクスとドライバー別集計を返すユーティリティを実装しテストで検証。  
  メモ: `dashboardCalculator` を拡張して日別/ドライバー別メトリクスとアラート履歴を生成し、`tests/dashboardCalculator.test.ts` を追加（2025-10-08, Owner: Codex）。  
- [x] KPI 閾値設定モーダル設計（設定UIの方針整理）  
  DoD: DECISIONS に閾値編集の設計を追記し、テストで確認。  
  メモ: KPIカテゴリごとのUI・同期・テスト方針を整理（2025-10-08, Owner: Codex）。
- [x] Dashboard KPI 閾値適用（警告ロジック拡張）  
  DoD: dashboardCalculator で閾値ベースの警告を算出し、テストで検証。  
  メモ: coverage/未割当率/公平性アラートを追加し、DutySettings新フィールドを永続化（2025-10-08, Owner: Codex）。
- [x] Diff履歴アラート比較タイムライン  
  DoD: 履歴表示でKPI差分とアラート比較が可能。  
  メモ: DiffViewに履歴カードとタイムライン比較を追加し、履歴管理ユーティリティ／テストを実装（2025-10-08, Owner: Codex）。

### テスト／運用
- [x] 追加ユニットテスト（Redo / Drivers / CSV / KPI / AutoCorrect）  
  DoD: `npm test` がゼロフェールで、ケース名に対象機能を明記。  
  メモ: duty.workflow.test.ts で編集ワークフローを網羅し、Redo・ドライバー更新・CSVラウンドトリップ・KPI警告・AutoCorrectを検証（2025-10-08, Owner: Codex）。
- [x] Pre-commit / CI チェックの自動化  
  DoD: `npm run scan:encoding -- --json` と `npm test` を CI でブロック化。  
  メモ: GitHub Actions (`.github/workflows/ci.yml`) を追加し、README に運用手順を明記（2025-10-08, Owner: Codex）。

## P2（次段・探索）
- [x] Explorer オーバーレイ（Depots / Relief points のマップ表示）  
  DoD: ON / OFF 切替で Duty への影響を視覚化。  
  メモ: `ExplorerView` にトグルを追加し、`MapView` で depots/relief レイヤーと Duty影響カウントを連動（2025-10-07, Owner: Codex）。
- [x] Diff / Export タブ（拡張UI: CSV 差分ビューと履歴）  
  DoD: 最小UIはP0で実装済。ここでは履歴管理や高度な比較を提供。  
  メモ: DiffView に履歴カードを追加し、基準保存/適用/ダウンロードとアラート比較を実装（2025-10-08, Owner: Codex）。
- [x] 「ブロック」画面の UI リデザイン（サービス線の可視化）  
  DoD: 日別表示と重なりハイライトを追加。  
  メモ: BlocksView にサービス日ボタンと重複ハイライト付きガントを導入し、`tests/blocks.plan.overlap.test.tsx` で検証（2025-10-08, Owner: Codex）。
- [x] ブロックUIリデザインのタイムライン改修  
  DoD: サービス日タブと重複ハイライトを導入し、BlocksView でギャップ警告を一覧化。  
  メモ: BlocksView に日別タブと重複検出ロジックを追加し、`useBlocksPlan` フックで集計（2025-10-08, Owner: Codex）。  
- [x] ブロックUIリデザインの設計調査  
  DoD: 日別表示・重なりハイライト・サービス線表示の要件を整理したメモを作成しテストで確認。  
  メモ: `docs/specs/block-ui-redesign.md` に設計メモを追加し、`tests/blocks.ui.redesign.design.test.ts` で検証（2025-10-08, Owner: Codex）。
- [x] i18n 対応の調査（対応範囲・優先言語の整理）  
  メモ: `docs/specs/i18n-survey.md` に優先言語とロードマップを整理し、`tests/i18n.survey.test.ts` で検証（2025-10-08, Owner: Codex）。  
  DoD: 対応方針と必要工数を提案書にまとめる。
- [x] Duty 生成タイミングの再評価（Next リリース向け）  
  DoD: 現状課題と候補アプローチを DECISIONS に整理。  
  メモ: DECISIONS に課題・段階的再生成/テンプレート/ドライバー連動案を追記し、テストで検証（2025-10-08, Owner: Codex）。
- [x] Diff / Export のスコープ確定（CSV 以外を含むかの判断）  
  DoD: 要求範囲とスプリント計画を決める。  
  メモ: `docs/specs/diff-export-scope.md` に合意内容とスプリント案を整理（2025-10-07, Owner: Codex）。
- [x] ファイル書き込みの権限 / 監査整備（社内配布手順）  
  メモ: `docs/specs/file-write-audit.md` に権限モデルと監査フローを整理し、`tests/file.write.audit.test.ts` で検証（2025-10-08, Owner: Codex）。  
  DoD: 監査項目と権限設定のチェックリストを作成。

## フォローアップメモ
- [x] 全体 KPI ポリシー（指標・アラート・レビュー体制）の策定。  
  メモ: DECISIONS にKPIカテゴリ／アラート閾値／レビュー体制を追記し、テストで検証（2025-10-08, Owner: Codex）。
- [x] Drivers データ品質（ダミー driver や ID 採番ルール）の定義。  
  メモ: DECISIONS にデータ品質ポリシーを追記し、テストで検証（2025-10-08, Owner: Codex）。
- [x] Diff / Export のロールアウト計画（段階的公開とサポート体制）。
  メモ: `docs/specs/diff-export-rollout.md` に段階的公開とサポート体制を整理し、`tests/diff.export.rollout.test.ts` で検証（2025-10-08, Owner: Codex）。
- [x] 社内 / 外部向け配布物の優先度と承認フローの確認。
  メモ: `docs/specs/distribution-approval.md` に優先度と承認手順を整理し、`tests/distribution.approval.test.ts` で検証（2025-10-08, Owner: Codex）。

## Done
- [x] Manual 画面の保存 / 読み込みとプロジェクト保存（2025-10-07, Owner: Codex）
- [x] Import の丸め（frequencies・HH→24:00）（2025-10-07, Owner: Codex）
- [x] エンコーディングスキャン CLI 導入（2025-10-06, Owner: Codex）
- [x] 設定ベースライン検証（2025-10-06, Owner: Codex）
- [x] README / DECISIONS / duty specs 整備（2025-10-06, Owner: Codex）
- [x] Duty 状態の Undo / Redo（2025-10-06, Owner: Codex）
- [x] 大きなファイル分割（~300 LOC 目安）（2025-10-06, Owner: Codex）

---

## 参考コマンド
- テスト: `npm test`
- エンコーディングスキャン: `npm run scan:encoding -- --json`
- 開発サーバー: `npm run dev`
- Context7 ドキュメント取得: `npx tsx tools/context7Cli.ts docs <libraryId> --tokens 800 --output docs.txt`
- UIスモーク（Chrome DevTools CLI）: `npm run smoke:chrome`
