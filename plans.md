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

（現在、未完了タスクはありません）
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
