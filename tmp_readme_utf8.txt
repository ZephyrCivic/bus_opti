# TS-bus-operation-app

運用計画のMVP。GTFS取り込み → Block（運用）推定 → Duty（乗務）設計・検証を、シンプルなUIとCSV入出力で素早く回すためのWebアプリです。

## このアプリでできること（主要機能）
- GTFS/GTFS-JPのZIPをドラッグ＆ドロップで取り込み、routes/trips/calendar/stop_times/shapes/stopsを解析してローカルに保持。
- サービスと時系列に沿って、続けて運行できる次の便を順に選んでつなぎ、行路（Vehicle Block）を推定し、Blocks CSVとして出力。
- 推定した行路（Block）を素材に仕業（Duty）を設計。セグメントの追加・移動・削除、履歴を使ったやり直しに対応。
- 安全・労務ルール（中拘束・交代地点制約など）を自動検証し、不適合を早期に把握。
- 地図（MapLibre）と表の両方で可視化。Stops/Shapes表示、Tripのハイライト、基本的なフィルタを提供。
- CSVによる入出力（Blocks/Duties）と差分比較、ダッシュボードでの集計により、案の比較・評価を支援。
- サンプルデータ（data/GTFS-JP(gunmachuo).zip）を同梱し、すぐに体験可能。

## 用語と全体フロー（現場準拠）
1. サービス計画/時刻計画
   ・入力：GTFS（時刻表・経路・運行日）、運行カレンダーの例外（calendar_dates）
   ・補足：自社で時刻表を改訂する場合はここが上流。GTFSは「基準データ」。

2. 運用前提の付加（計画パラメータ）
   ・必須：車庫（depot）、交替可能地点（relief point）、回送/入出庫所要、車両属性（長さ/乗車定員/ノンステップ/燃料・充電）、運用制約（充電・点検時間）
   ・任意：路外待機場、道路制約、満充電→最小SOCルール

3. 行路表（Vehicle Blocks）を作成
   ・意味：1台の車両が「出庫→営業→回送→休憩→入庫」まで1日の“つながり”
   ・可視化：ガントで「営業（濃色）/回送（薄色）/入出庫（ハッチ）/停留（灰）」区分
   ・ポイント：GTFSのtripを連結し、入出庫・回送・折返し余裕（layover）を明示

4. 仕業/乗務表（Crew Duties/Pieces）を作成
   ・意味：1人の乗務員が1日で担当する勤務のまとまり（＝仕業/Duty）。Dutyは複数の乗務片（Piece：乗継単位）で構成
   ・制約反映：拘束時間・実乗務時間・休憩/手待ち・深夜等の労務規程

5. 交番表（Rosters）を編成
   ・意味：1週間などの周期で「月〜日」にDutyを並べた“パターン”。公平性や生活リズムを担保
   ・注意：「交番＝長期パターン」、「当日割付＝日々の担当確定」は別物

6. 当日割付（Daily Assignment）で最終決定
   ・入力：交番表、休暇・研修・免許条件、当日欠勤/遅延、車両故障
   ・出力：その日の「誰が・どのDuty（≒どの行路のどのPiece）に・どこで乗るか」
   ・運用：休暇は原則ここで代番・スワップで吸収（計画的長期休暇は交番再編で対応）

> 推奨の整理：
> 「GTFS →（＋車両/車庫/交替点/回送）→ 行路表 → 仕業表 → 交番表 → 当日割付（休暇等を反映して最終決定）」
> “シフト”は曖昧語のため、設計上は「交番（パターン）」と「当日割付（実運用）」に分けて記述します。

## プロジェクトの目的
- GTFSからBlock（運用単位）を推定し、Duty（乗務）を短時間で設計・検証できる最小限の体験を提供する。
- 現場判断に必要な可視化と、CSVによる入出力（インポート/エクスポート）を提供する。

## ビジネス目的（達成すること）
- 運用案の初期作成と見直しのリードタイムを短縮し、意思決定サイクルを高速化する。
- 安全・労務ルール（中拘束・交代地点制約など）の自動検証で不適合を早期発見し、修正コストを低減する。
- 現場と企画の合意形成を支援（地図と表での可視化、CSVで共有・差分比較）。
- データの再現性と移行性を確保（GTFS/CSVベース、ベンダーロックイン回避）。

## 対象ユーザー/ユースケース
- 企画・運用担当者: 初期の運用案を素早く作成し、安全ルールに照らして検証。
- 現場スーパーバイザー: ブロック/乗務の修正点を可視化し、差分を把握して共有。
- データ管理者: GTFS/CSVの入出力で再現性を担保し、他システムと連携。

## 入出力仕様（概要）
- 入力: GTFS/GTFS-JP ZIP（ドラッグ&ドロップ）
- 出力:
  - Blocks CSV（行路）: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id`
  - Duties CSV（仕業）: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id`
  - 取込結果スナップショット（JSON）: 再読込可能（gtfsPersistence）

## 操作フロー（最短）
1) GTFS ZIPを読み込み → サマリ/地図で概況確認（サービス絞り込み可）。
2) Blockを自動推定 → カバレッジ/ギャップを見ながら必要箇所のみ修正。
3) Dutyを区間指定で追加/移動/削除 → 検証/警告（中拘束・連続上限・1日上限）。
4) CSVへエクスポート、または差分とダッシュボードで影響を確認。

## クイックスタート
前提: Node.js 20系（LTS推奨）、npm 10+

```
# 依存のインストール
npm ci   # 既存 lock を厳密に反映（推奨）
# or
npm install

# 開発サーバ（Vite）
npm run dev
# → ブラウザで http://localhost:5173 を開く

# 本番ビルドとローカルプレビュー（任意）
npm run build
npm run preview

# テスト（任意）
npm test
```

## 技術スタック（最小）
- フロントエンド: React 19 + TypeScript, Vite, Tailwind CSS, shadcn/ui（Radix UI）, TanStack Table, Sonner
- 地図: MapLibre GL
- ユーティリティ: JSZip, Papa Parse, clsx, class-variance-authority, tailwind-merge
- テスト/実行: node:test（tsx）, 各種CLIは `npx tsx tools/<name>Cli.ts ...`

## 機能（詳細・ノースポール）
- データ取り込み/検証
  - 入力: GTFS/GTFS-JP の ZIP をドラッグ&ドロップで読込。
  - 解析: routes/trips/calendar/stop_times/shapes/stops を正規化し、欠損ファイルを検出。
  - サマリ: 路線数・便数などを集計。保存/再読込のための JSON スナップショットを作成（`src/services/import/gtfsPersistence.ts`）。
- エクスプローラ（地図）
  - MapLibre 表示（OSM）。Stops/Shapes の表示切替、サービス（日付種別）でのフィルタ。
  - Stop/Shape の詳細（関連Trip数、サービスIDなど）と自動フィット（bounds計算）。
- Block 推定（運用単位）
  - アルゴリズム: 時系列順に、続けて運行できる次の便を順に選んで連結（いわゆる貪欲法）。サービスID・運用日ごとにグルーピングし、`maxTurnGapMinutes` 以内のみ許容。
  - 出力: CSV相当の行（`block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id`）。カバレッジ比率（assign/total）とギャップ統計を表示。
- Duty 設計・検証（乗務）
  - 操作: Blockと区間（開始/終了Trip）を選択してセグメント追加・移動・削除（整合チェックを内蔵）。
  - 検証: 中拘束（最小休憩）、連続運転の上限、1日合計の上限を算出し警告を表示（`computeDutyMetrics`）。
  - 自動修正: 違反セグメントを優先的に間引くヒューリスティック（`autoCorrectDuty`）。
  - CSV スキーマ（MVP）: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id`。
- スケジュール差分/ダッシュボード
  - 差分: 追加/削除/担当替えを検出し、未変更件数とメトリクス差分を算出（`diffSchedules`）。
  - メトリクス: 勤務時間の合計・未割当数・公平性スコアなどを集計（`dashboardCalculator`）。

## ノースメトリクス（ダッシュボード）
- シフト総数: `totalShifts`（割当済みのシフト件数）
- 総勤務時間: `totalHours`（時間単位。routesの時間差から集計）
- 未割当件数: `unassignedCount`（必要人数に対して不足している割当）
- 公平性スコア: `fairnessScore`（0〜100、均等=100）
- 個別ワークロード: `workloadAnalysis`（driverIdごとの`shiftCount`/`hours`）

## サンプルデータ
- テスト用GTFS: `data/GTFS-JP(gunmachuo).zip`

## スコープ（MVP）
- Block推定の目標達成率は 70~80% を目安とする。
- 地図は MapLibre をデフォルト採用。
- Dutyルールには「中拘束（mid-duty break）」「交代地点制約（relief-point constraint）」を含む。

## 主な操作
- GTFS ZIPの読み込みと概要確認
- 推定されたBlockの確認・必要な修正
- Dutyの追加/移動/削除とCSV入出力

## CLI（補助ツール）
- `npx tsx tools/encodingScanCli.ts ...`
- `npx tsx tools/playwrightCli.ts ...`
- `npx tsx tools/chromeDevtoolsCli.ts ...`
- `npx tsx tools/context7Cli.ts ...`

## 動作環境
- 必須: Node.js 20（LTS推奨）, npm 10+
- ブラウザ: 最新版の Chrome/Edge（MapLibre表示を含む）
- 権限/ネットワーク: 外部APIや自動化ツールの利用時は社内ポリシーに従う（Context7/Playwright/DevTools CLIなど）

## 非目標（MVP外）
- PDFレポート/RBAC/本格サーバAPIの提供（将来検討）
- 高度な最適化（MIP/CP 等）や大規模データ分散処理

