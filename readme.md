# TS-bus-operation-app

## プロジェクトの目的（MVP）
- 分散した表や地図を1画面に統合し、ガント風の直感操作で車両行路（Block）と仕業（Duty）を素早く組み立てる。
- 連続運転・休憩不足・拘束超過・未割付などの逸脱を即時に警告して、修正箇所を明確化する。
- 自動最適化は後回し。「見える・割付けられる・逸脱に気づける」を最優先にすることで、初期案作成〜レビューを短時間で回す。

## MVPの範囲（現在）
- GTFS/GTFS-JPのZIP取込（stops/trips/stop_times/shapes）と保存/復元（JSON）。
- Greedyな行路推定（折返し上限分の調整可、manual.linking のON/OFFで自動連結を制御）と未割当Tripの可視化。
- 仕業の追加/移動/削除、Undo/Redo、基本の労務チェック（拘束スパン・連続運転・最小休憩）。
- 地図（MapLibre）と表での可視化、サービスIDフィルタ。
- 変更差分とダッシュボード指標（総シフト数・総時間・未割当・簡易フェアネス）。

## 計画者が手動で入力する情報（当面）
- ManualタブのUIで入力/編集できます。CSVスキーマは将来のインポート/エクスポート互換を見据えた参考形です。
- 交代地点（relief_points.csv）: relief_id,name,lat,lon,stop_id?,walk_time_to_stop_min,allowed_window
- デポ/車庫（depots.csv）: depot_id,name,lat,lon,open_time,close_time,min_turnaround_min
- 回送近似（deadhead_rules.csv）: from_id,to_id,mode,travel_time_min,distance_km,allowed_window
- 連結閾値（config.py or UI）: 最小折返し分・接続半径m・parent_station許容のON/OFF

回避策/暫定動作
- 交代地点・回送が未入力でも編集は続行（警告を出しつつブロック/仕業は操作可能）。
- 回送は近似（固定分・距離）から開始し、精緻化は後続リリースで対応。
- HH≥24:00の時刻を正規化し、frequencies.txt は `trip_id#n` 形式の静的便へ自動展開。exact_times=0/1 どちらでも Block / Duty 計算に取り込める。

## 次の着手（採用済みのP0）
- 行路連結ガード: 終点=次便始点（親子駅/半径R m許容）かつ最小折返しT分を満たす場合のみ連結。
- Blocks/DutyのCSV出力: schema_version・元trip_id・生成日時・設定ハッシュを付与。
- 時刻正規化: HH≥24:00 を 24:00 形式に正規化し、Duty 計算へ反映。

これらにより「誤連結で全体像が歪む」「成果物が出せない」「日跨ぎで数字が狂う」を解消し、現場の初期案作成〜レビューに耐えるMVPとします。
## このアプリでできること（主要機能）
- GTFS/GTFS-JPのZIPをドラッグ＆ドロップで取り込み、routes/trips/calendar/stop_times/shapes/stopsを解析してローカルに保持。
- サービスと時系列に沿って、続けて運行できる次の便を順に選んでつなぎ、行路（Vehicle Block）を推定・表示。Blocks CSVとしても出力可能。
- Blocks / Duties の両ビューにSVGベースのガントタイムラインを追加し、24:00超の区間も含めて俯瞰できる。
- 推定した行路（Block）を素材に仕業（Duty）を設計。セグメントの追加・移動・削除、履歴を使ったやり直しに対応。CSV出力も可能。
- 安全・労務ルール（中拘束・交代地点制約など）を自動検証し、不適合を早期に把握。アラート表示（アラートがあっても作業は継続可能）。
- 地図（MapLibre）と表の両方で可視化。Stops/Shapes表示、Tripのハイライト、基本的なフィルタを提供。Depots / Relief points のオーバーレイをトグルし、Duty影響カウントを地図上で確認できる。
- 差分比較とダッシュボードでの集計により、案の比較・評価を支援。
- Dashboard タブで Duty 割当の総シフト数・総時間・未割当数・公平性スコアを即時に確認し、設定したKPI閾値に基づくカバレッジ/公平性アラートを表示。右上の「KPI設定」ボタンから閾値を編集すると即時に反映される。
- Diff タブで基準案と現在案を比較し、追加 / 削除 / 担当替えと指標差分およびKPIアラート差分を一覧化。履歴カードから最大10件の基準を適用・再ダウンロード可能。
- サンプルデータ（data/GTFS-JP(gunmachuo).zip）で、インストール直後から体験可能。

注記: 交番（Rosters）と当日割付（Daily Assignments）は全体フローに含まれる次段階機能で、本MVPでは行路と仕業の設計・検証を中心に提供します。

運用計画のMVP。GTFS取り込み → Block（運用）推定 → Duty（乗務）設計・検証を、シンプルなUIとCSV入出力で素早く回すためのWebアプリです。

## 用語と全体フロー（現場準拠）
1. サービス計画/時刻計画
   ・入力：GTFS（時刻表・経路・運行日）、運行カレンダーの例外（calendar_dates）
   ・補足：自社で時刻表を改訂する場合はここが上流。GTFSは「基準データ」。

2. 運用前提の付加（計画パラメータ）
   ・必須：車庫（depot）、交替可能地点（relief point）、回送/入出庫所要、車両属性（長さ/乗車定員/ノンステップ/燃料・充電）、運用制約（充電・点検時間）
   ・任意：路外待機場、道路制約

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

## 画面と可視化（MVP→次段階）
A. GTFSビューア（入力確認）
- 地図＋時刻表。service_id/日付フィルタ、trip選択で経路と停車時刻。
- 差分表示：calendar_datesの例外を色替え。

B. 行路ビルダー（車両ガント）
- レーン＝「計画上の車両スロット」（実車番は後付けでもOK）
- 色：営業/回送/入出庫/停留、重ねて「充電・給油」「点検」をアイコン化
- 自動チェック：折返し不足、車庫容量、車両属性不適合（大型不可路線など）

C. 仕業ビルダー（乗務ガント）
- レーン＝Duty。区分：Sign-on/点呼、Piece、休憩、手待ち、Sign-off
- 制約違反を右側にスタック（拘束>◯h、休憩<◯分 等）

D. 交番エディタ（週次グリッド）
- 行＝交番パターン、列＝曜日、セル＝Dutyコード
- KPI：夜勤回数/早番回数の分散、週実乗務時間の偏差、連続早番の上限

E. 当日割付ボード
- 左：本日のDuty一覧（欠員/代番必要を赤）
- 右：乗務員プール（資格タグ、勤務間インターバル、当月実績）
- ドラッグ&ドロップで割付→労務チェック→確定→配車票/点呼票出力

F. KPIダッシュ（横断）
- 車両：営業/回送比、予備車率、車庫別出入庫ピーク
- 労務：人件費試算、拘束・休憩遵守率、交番の公平性指標
- Dashboard（MVP実装済み）: Duty 割当の総シフト数・総時間・未割当・公平性スコアをカード表示、ドライバー別ワークロードを表形式で確認。
- Diff（MVP実装済み）: 基準スナップショットと現行案を比較し、追加/削除/担当替え・指標差分・KPIアラートの差異をテーブル表示。JSON基準ファイルの保存/読込と履歴による再適用をサポート。

## 最小データモデル（MVP用）
- gtfs_trips/stop_times/calendar(_dates)（読取専用）
- depots（車庫）、relief_points（交替地点）
- vehicles（属性：長さ/座席/低床/燃料/充電性能/所属車庫/整備周期）
- deadheads（地点間所要：車庫↔起終点、折返し、回送）
- blocks（行路）・block_segments（営業/回送/入出庫/停留の区分）
- duties（仕業）・pieces（乗務片）・sign_events（点呼/点検）
- roster_lines（交番パターン）・roster_calendar（週→人への適用）
- employees（資格/免許/勤務条件）・leave_requests（確定/申請中）
- assignments（当日割付：人×Piece）・violations（自動検出ログ）
- scenarios（版管理：MVPは手動ブランチでもOK）

## ルール・制約の取り扱い（早めにパラメタ化）
- 労務：1日の実乗務上限、拘束上限、休憩最短、勤務間インターバル、深夜帯定義
- 車両：車種縛り、車庫所属、充電/給油時間とSOC/燃料制約、整備入庫周期
- 運行：折返し最短、出入庫可能時刻、交替可能地点、回送経路許可

## 可視化の結合インタラクション
- どれか一つ（Trip/Block/Duty/Roster）を選ぶと、他レイヤがハイライトされる“クロスハイライト”。
- 例：Tripをクリック→そのTripを含むBlock区間が濃色→それを含むDutyが点灯→交番セルが強調。
- 不整合は常に右ペインに積む（修正→リチェックが一目でわかる）。

## 用語ポリシー
- 本READMEでは「shift」という語は使わず、計画は「交番（Roster）」、当日の確定は「当日割付（Assignment）」として記述します。
- 既存の指標キー `totalShifts`/`shiftCount` はコード互換のためそのまま表記しますが、意味は「割付単位」です。

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
※ `package.json` の `engines.node` で Node >= 20 を強制しています。

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

# Chrome DevTools スモーク（preview を自動起動してタイトル検証）
npm run smoke:chrome
```

## 60秒デモ（最短ルート）
### 操作手順（約1分）
1. 依存をインストール済みであることを確認し、`npm run dev` を実行する（Vite が `http://localhost:5173` で待機）。
2. Chromium系ブラウザで `http://localhost:5173` を開き、上部タブから **Import** を選択する。
3. リポジトリ同梱の `data/GTFS-JP(gunmachuo).zip` をドラッグ＆ドロップし、インポート完了トーストを待つ。
4. **Blocks** タブに移動し、ガントタイムラインで自動生成された行路を確認する（カバレッジと未割当 Trip が即座に更新される）。
5. **Duties** タブで同じ行路を素材にセグメント一覧を確認し、必要なら `ExportBar` から CSV をダウンロードして成果物を共有する。

### 留意点
- ブラウザは最新の Chrome / Edge を推奨（MapLibre の WebGL 描画に対応している必要があります）。
- サンプル以外のGTFSを読み込む場合はファイルサイズに応じて初回解析が数十秒かかることがあります。
- 別データで再検証する際は Import 画面右上の **Reset** を実行して状態を初期化してください。

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
  - 保存: Duty 編集結果は `localStorage` の `dutyEditState:v1` に自動保存し、再読込時に復元。
  - CSV 読み込み: Duty タイムライン右上の「Duties CSVを読み込む」で簡易CSVを差し替え（既存Dutyを置換）。
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

## CI
- GitHub Actions (`.github/workflows/ci.yml`) で `npm run scan:encoding -- --json` と `npm test` をプッシュ／Pull Request 毎に実行し、文字コード検査とユニットテストを自動検証する。

## 非目標（MVP外）
- PDFレポート/RBAC/本格サーバAPIの提供（将来検討）
- 高度な最適化（MIP/CP 等）や大規模データ分散処理
