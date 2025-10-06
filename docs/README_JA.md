# TS-bus-operation-app README（合意版 / 2025-10-03）

このドキュメントは、本リポジトリの目的・範囲（MVP）・UI方針・非機能を簡潔にまとめた合意版READMEです。詳細な設計メモや旧記述は `readme.md` に残し、本書を運用上の基準とします。

## 目的（Purpose）
- 設計済みの GTFS を読み取り、時刻表・経路を可視化・編集できるツールを提供する。
- そのデータを元に、手動でシンプルに以下を行えるようにする。
  - 行路（Vehicle Block：どの車両がどの便を連続して走るか）の作成・検証。
  - 交番前段の勤務（Crew Duty/Run）の割当・編集。
  - 勤務違反（連続運転・休憩・拘束時間 等）の簡易アラート表示。

## スコープ（Scope）
- In（MVP）
  - GTFS ZIP の読み込み（`stops/trips/stop_times/shapes` 必須を前提、なければ機能限定）
  - 地図上での Stops/Shapes 可視化とサービス日フィルタ
  - 行路（Block）推定の Greedy ヒューリスティクス + 既存 `block_id` の整合チェック
  - 勤務（Duty）簡易編集（追加/入替/削除・Undo1）
  - KPI/ダッシュボード（総シフト・未割当・総時間・簡易公平度）
  - 差分ビュー（追加/削除/担当変更 + メトリクス差分）
  - CSV エクスポート（Blocks / Duties）
- Out（MVPでは対象外）
  - ダイヤ設計（Timetable / Schedule Building）— 新規の時刻表自動生成は行わない
  - PDFロスター、厳密最適化（MIP/CP）、RBAC/SSO、常駐バックエンド/API
- 将来の拡張候補（“包括的”に近づける領域）
  - 週次の交番（Rostering＝週次パッケージ）
  - 車庫配車・出入庫（Pull-out / Pull-in）
  - 回送（Deadhead）
  - 車両属性・車種割当（低床・EV・容量・燃料 等の制約）

## UI 方針
- ライブラリ: shadcn/ui（Tailwind + Radix Primitives）
- ビルド: Vite + React 19 + TypeScript
- 補助: `@tanstack/react-table`（表）、`sonner`（トースト）、`lucide-react`（アイコン）
- 生成物配置: `src/components/ui/*`（shadcn生成）、`src/lib/utils.ts`（`cn` 関数）
- 注意: shadcn/ui は「生成コードの取り込み」方式のため、生成後は自前メンテ対象。最小限のみ導入。

## 非機能要件（抜粋）
- パフォーマンス: 1サービス日 ≈ 10,000 Trips を目安に、初期表示 < 30秒、UI操作は体感スムーズ
- オフライン: インポート後は基本ローカルで完結（Map タイルはキー不要の選択肢で開始）。インポート結果は手動保存/読込（JSON）に対応
- セキュリティ: データはブラウザ内、外部送信なし（環境変数はGit管理外）
- i18n: MVP は日本語固定（英語は Next）

## 暫定デフォルト値（変更可能）
- デモデータ: `data/GTFS-JP(gunmachuo).zip`
- 地図タイル: MapLibre + OSM（キー不要スタート）
- 連結パラメータ: `max_turn_gap = 15分`
- 簡易労務ルール（警告用）: 連続運転 4h / 休憩 30m / 1日拘束 9h
- CSV スキーマ（暫定）
  - Blocks: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id`
  - Duties: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id?`

注: 上記は運用中に変更可能です（設定化を前提）。本時点では検証を優先して暫定採用します。

## クイックスタート（MVP時点の想定）
```
npm ci
npm test
npm run dev
```
デモ用サンプル: `data/GTFS-JP(gunmachuo).zip`

（実装ステータス: 2025-10-03 時点で Import UI と Explorer 地図の骨組みまで完了。次は Stops/Shapes 表示とサービス日フィルタへ着手予定）

## 実装ロードマップ（短縮版）
1) Import（GTFSパーサ）/ UI骨組み（shadcn + ルーティング）
2) Explorer（地図・Stops/Shapes・サービス日フィルタ）
3) Block 推定（Greedy）+ 整合率表示
4) Duty 簡易編集 + KPI/ダッシュボード
5) 差分ビュー + CSV エクスポート
6) 体験改善・軽量E2E

## チェックリスト
- 実行用のチェックリストは `docs/ImplementationChecklist.md` を参照してください。

