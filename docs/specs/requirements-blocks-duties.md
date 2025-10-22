<!--
  docs/specs/requirements-blocks-duties.md
  目的: 現状分析Pro.txt（2025-04-01版GTFSを前提）を踏まえ、現状の実装との差分から「小さく安全に進める」修正点を整理する。
  背景: 本プロジェクトは GTFS 取込→行路（Blocks）編集→Duty編集を中心に構成。追加の業務データ（Depot/Relief/Deadhead 等）はUI入力と地図表示に留まっているため、評価ロジックへの統合が未了。
-->

# 要件定義（現状分析に基づく）— 行路・交番表をUIで組み立てる（2025-10-17）

> 追補あり: BlockIDが空のGTFSを前提とした最小構成は
> `docs/specs/requirements-blocks-duties.addendum.blockless.md`
> を参照（2025-10-17 追加）。

## ゴール（What）
- GTFS を入力として、視覚的なUI操作のみで「行路（Block）」と「交番（Duty）一覧＝交番表」を作成できること。
- 自動最適化は不要。ユーザーがルート・便をつないで行路を作り、従業員リストから交番に割付ける。
- 逸脱は保存を妨げず“警告”で提示する。

## 前提と範囲（Scope）
- 参照資料: リポジトリ直下の `現状分析Pro.txt`（群馬中央バス GTFS 2025-04-01 版を例示）。
- 本ドキュメントは、現行実装との差分を踏まえた「最小改修による要件定義」。自動最適化は対象外。
- モットー: Small, clear, safe steps — always grounded in real docs.

## 現状サマリ（実装の把握）
- GTFS取込: `stops.txt / trips.txt / stop_times.txt` 必須、`shapes.txt` 任意、`frequencies.txt` は検出して展開済み（`src/services/import/gtfsParser.ts`）。
- 行路編集（Blocks）: Greedy 連結。条件は「同一 serviceDayIndex かつ gap ≤ maxTurnGapMinutes」。Deadhead/Depot/Relief は未考慮（`src/services/blocks/blockBuilder.ts`）。
- Blocks可視化: 日別集約と時間帯重なりの簡易指標（平均gapをoverlapScoreに格納しており命名が実態と不一致）。
- Duty編集: ブロック区間の追加/移動/削除とCSV入出力。検証は「同一Blockのみ・区間の重複なし」のみ（`src/services/duty/validators.ts`）。労務ルール（連続運転/休憩/拘束）の適用なし。従業員（Drivers）はUI入力可だがDuty割付の評価は最小限。
- 手動入力（Manual）: Depot/Relief/Deadhead/Drivers/Linking設定はUI入出力・地図重畳のみで、行路連結やDuty検証に未統合。

## 要件（データモデル）
- ManualDriverの拡張（後方互換優先）
  - 追加候補: `qualifications?: string[]`（大型二種, 路線認定 等）, `availability?: { days?: string[]; timeSpans?: string[] }`。
- Depot/Relief に運用上限の明示
  - Depot: `openTime/closeTime` の既存項目を行路境界の制約源として使用（未活用→活用）。
  - ReliefPoint: `allowedWindow` をDuty交代候補のフィルタに使用（未活用→活用）。
- DeadheadRule の解釈強化
  - `mode`, `travelTimeMin`, `allowedWindow` を連結判定と評価指標に反映。未定義時は距離近似（shapes/緯度経度）で代替。

### 機材データ（Vehicles / VehicleTypes）— 手動インポート＋UI編集＋エクスポート
- 目的: 自動割当は行わず、可視化・警告・将来の最適化入力を支える台帳として扱う。
- データ構造（提案。実装は後方互換で段階導入）
  - VehicleType: `type_id`（必須）, `name?`, `wheelchair_accessible? (0/1)`, `low_floor? (0/1)`, `capacity_seated? (int)`, `capacity_total? (int)`, `tags?`
  - Vehicle: `vehicle_id`（必須）, `vehicle_type`（必須, VehicleType参照）, `depot_id?`, `seats? (int)`, `wheelchair_accessible? (0/1)`, `low_floor? (0/1)`, `notes?`
- CSV 仕様（Manual 画面で入出力）
  - `manual-vehicle_types.csv`: 上記の列順を推奨（未知列は無視）。
  - `manual-vehicles.csv`: 上記の列順を推奨（未知列は無視）。
- 検証（保存は可能／致命エラーのみブロック）
  - ブロック（取込中断）: 必須列欠落、`vehicle_id` 重複、数値列の不正。
  - 警告（非ブロック）: 未知の `depot_id`／`vehicle_type` 参照、路線要件との不整合の可能性。
- 活用（今回スコープ）
  - Blocks: 「タイプ別想定需要 vs 保有台数」簡易指標（情報/警告）。
  - Duties: Duty一覧に「機材注意」バッジ（info/warn）。
- UI 要件（Manual タブに2カードを追加）
  - Vehicle Types: 一覧/追加/削除/CSV Import/Export。
  - Vehicles: 一覧/追加/削除/CSV Import/Export（depot_id参照のドロップダウンは任意）。
- DoD（機材）
  - `manual-vehicle_types.csv` と `manual-vehicles.csv` をUIから読み込み、一覧で確認・編集し、同形式でエクスポートできる。
  - 不備はトーストで即時通知。致命エラーは取込を中断、参照不整合は警告として登録。

（注）シフト表（週次/月次の勤務組合せ）はスコープ外。Dutyは“日・人”の割付までを対象。

## 要件（UIフローと行路生成）
- ルート閲覧（Route Explorer）
  - ルート一覧→個別ビューで便タイムラインと地図表示（可能なら）を提供。
  - フィルタ: service_id、時間帯、方向。
- 行路エディタ（Block Builder）
  - 便の start/end をドラッグまたは選択で連結。複数候補がある場合は「実効gap（gap-Deadhead）」が小さい順に候補提示。
  - 画面に現在の `linking` 設定（minTurn, radius, 親駅許容）を常時表示。
  - 連結直後に警告を評価し、行単位でアイコン/バッジ表示。
- 交番エディタ（Duty Builder）
  - 従業員リストから Duty へ割付（ドラッグ&ドロップ/選択）
  - 1Duty=同一Block内の連続区間を原則。区間編集（追加/移動/削除）は現行を継承。
  - 警告（連続運転・休憩・交代所制約）をDuty単位で表示。保存は可能。

### 共通表示要件（新規）— 休憩/食事・回送・注記
- Break/Meal（休憩・食事）
  - 活動タイプ: `meal`（食事）, `layover`（待機）。
  - 表示: 薄色or緑系帯＋「食事 xxm」ラベル。Dutyでは帯として保存。Blocksでは候補ガイドのみ（保存はDuty側）。
  - 検証: `minBreakMinutes` 未満→`DUTY_BREAK_SHORT`（warn）。ReliefPoint.allowedWindow を外れる→`DUTY_RELIEF_WINDOW`（warn）。
- Deadhead（回送）
  - 表示: 細い黒/濃灰帯＋注記（例: `deadhead 5m`）。
  - 評価: 実効gap＝`gap - deadhead`。gap未満→`BLK_DEADHEAD_EXCEEDS`（critical）。未定義→`BLK_DEADHEAD_MISSING`（warn）。
- 注記（接続部ラベル）
  - `gap 10m` / `eff 25m` のような短い注記を接続部に表示。
  - ルート越境は `[A→B]` チップで明示。

### Split Mode（同期表示）
- Blocks と Duties を上下に表示し、選択・時間カーソル・ズームを同期する。
- 目的: 手動割付の迷いを減らし、行路編集と交番調整を往復しやすくする。

### 任意ビュー（推奨）— 配車（Vehicles View）
- 目的: 「行路（Block）」を実車に載せる可視化。最適化なし、手動割付と警告のみ。
- UI: 縦=vehicle_id、横=時間。バー=割付済みBlock。重複・出入庫・距離の問題を警告表示。
- 操作: Unassigned Blocks リストからドラッグ→車両レーンへ配置／解除。Undo/Redo。
- 警告（保存可）
  - `VEH_OVERLAP`（critical）: 同一車両で時間重複。
  - `VEH_AFTER_HOURS`（warn）: Depot営業時間外の出入庫。
  - `VEH_RADIUS_EXCEEDS`（warn）: 出入庫の接続距離が閾値超過。
- CSV（任意）: vehicle-assignments.csv（前方互換／未知列無視）
  - 必須: `vehicle_id, block_id, service_day_index`
  - 任意: `service_id, start_override, end_override, notes`
  - 検証: 1台×同日での時間重複はcriticalを記録（保存は可能）。未登録のvehicle_idは警告。
  - 例:
    ```csv
    vehicle_id,block_id,service_day_index,service_id,start_override,end_override,notes
    BUS-001,BLOCK_001,0,weekday,,,
    BUS-002,BLOCK_008,0,weekday,07:55,18:05,臨時延長
    ```

## 要件（行路編集ロジック最小拡張）
- 連結条件の拡張（安全な段階導入・既定OFF）
  1) `linkingEnabled` が true のとき、次の新条件で連結候補をスコアリング：
     - サービス日一致（現行維持）。
     - 折返し下限: `min(turnGap, depot.minTurnaroundMin at terminal) ≥ requiredMin` を満たす。
     - Deadhead所要: `DeadheadRule(fromStop→toStop)` があれば gap から控除。無い場合は距離推定×速度（閾値）で近似。
     - 接続半径/親駅許容: `maxConnectRadiusM`, `allowParentStation` を考慮し終点/始点を正規化。
  2) 候補が複数ある場合は「最小の実効gap（gap-死活移動）」優先（現行の単純gapより妥当）。
- 指標/警告の整備
  - `overlapScore` の命名修正（例: `averageGapMin`）。
  - 追加: `minTurnViolations`, `deadheadMissing`, `afterHoursAtDepot` を `BlockSummary` に格納。
- 互換性
  - 既存UIを壊さないため `BuildBlocksOptions` に `linkingEnabled?` を維持（既定: true）。新ロジックは `manual.linking.enabled` と同期。

## 要件（Duty検証）
- 編集時の軽量バリデーションを追加（全て警告レベルで始める）
  - 連続運転上限 `maxContinuousMinutes` と休憩下限 `minBreakMinutes` のチェック。
  - 交代所の制約: DutySegmentの境界が `ReliefPoint.allowedWindow` を満たすか。
  - Depot入出庫の現実性: 先頭/末尾区間が車庫の営業時間・折返し下限を満たすか。
- CSV出力に `violations` 列（件数）を追加し、外部確認を容易化。

## 要件（UI/UX）
- BlocksView
  - 右パネルに「連結設定の実効値（minTurn, 半径, 親駅可）」を表示。
  - サマリ表に `averageGapMin` と警告件数を明示。フィルタ: 警告あり/なし。
- DutiesView
  - Dutyごとの警告バッジ（連続運転/休憩/交代所/車庫）。
  - CSV入出力時に警告件数を注記。
- Explorer
  - Deadheadルールの可視化（簡易：線分+ツールチップ）。

## I/O（CSV 仕様の最小増分）
- blocks.csv（既存: blockId, seq, tripId, tripStart, tripEnd, fromStopId, toStopId, serviceId）
  - 追加候補: `deadhead_min`, `turn_min`, `link_type`（rule/approx/none）, `warnings`（カンマ区切り要約）。
  - 互換性: 追加列は現行実装で無視される（読み込み対象は既存列のみ）。

- manual-*.csv（既存テンプレートのまま）
  - 仕様書に `allowedWindow` の形式（HH:MM-HH:MM）と `mode` の列挙値を追記。

- duties.csv（新規／確定仕様：現行実装に整合）
  - 目的: Dutyエディタの入出力と外部連携（レビュー/再現）を支える。
  - 行単位: 1行＝1 Duty の1セグメント（区間）。Dutyが複数区間を持つ場合は同じ `duty_id` で複数行。
  - ヘッダと列（現行エクスポート/インポートに一致）
    - 必須: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id`
    - 任意: `driver_id`（同一duty内で一貫している必要あり）
    - メタ: `generated_at`（ISO8601）, `settings_hash`（8桁hex）
  - 空Duty行: セグメント未確定でも `duty_id` を確保したい場合、`block_id, segment_*` を空で出力可（エクスポート実装対応済み）。
  - 検証規則（インポート）
    - `seq` は 1 以上の整数で Duty 内ユニーク。
    - `block_id` が示す Block が現在のブロックインデックスに存在すること。
    - `segment_start_trip_id / segment_end_trip_id` が該当 Block に存在し、開始順 ≤ 終了順。
    - `driver_id` は同一 `duty_id` 内で矛盾しないこと（異なるdriver_idの混在はエラー）。
    - `generated_at / settings_hash` はトレース用で強制一致はしない（将来の厳格化に備えて保持）。
    - 追加の未知列は無視される（前方互換）。
  - 例
    ```csv
    duty_id,seq,block_id,segment_start_trip_id,segment_end_trip_id,driver_id,generated_at,settings_hash
    D001,1,BLOCK_001,TRIP_1001,TRIP_1003,DRV-01,2025-10-17T09:00:00.000Z,8fa1c2d3
    D001,2,BLOCK_001,TRIP_1004,TRIP_1005,DRV-01,2025-10-17T09:00:00.000Z,8fa1c2d3
    D002,1,,,,DRV-02,2025-10-17T09:00:00.000Z,8fa1c2d3
    ```
  - 将来拡張（要件として定義・現行未実装）
    - `violations`（数値）/`warnings`（要約テキスト）列を追加可能。現行のインポータは未知列を無視するため後方互換。

— 配車（任意）—
- vehicle-assignments.csv（新規）
  - 列: `vehicle_id`(req), `block_id`(req), `service_day_index`(req), `service_id`(opt), `start_override`(opt), `end_override`(opt), `notes`(opt)
  - 未知列は無視。欠落や型不正はエラー、参照不整合は警告。

## 警告レベルと運用（B）

目的: 逸脱は保存を妨げず“気づける”状態にする。技術的矛盾はブロック（保存不可）。

- レベル定義（UI 表示のみの指針。保存可否は下記「技術エラー」を除き常に可）
  - `critical`: 強い注意（赤）。運用成立に重大な疑義。ただし保存は可能。
  - `warn`: 注意（黄）。留意が必要。保存は可能。
  - `info`: 情報（青/灰）。確認用。

- 分類ポリシー
  - 技術エラー（blocking error）: データ整合性違反（例: Duty 内で複数 Block、区間の自己重複、CSVのseq重複）。編集/取込をブロック。
  - 運用警告（non-blocking warning）: 法令・運用・地理的制約の逸脱や推定不能（Deadhead未定義など）。保存可。

- Blocks（行路）で評価する警告
  - `BLK_NEG_GAP`（critical）: gap < 0（時間矛盾）。
  - `BLK_SVC_MISMATCH`（critical）: service_id が混在（同一行路で異なるサービス日）。
  - `BLK_TURN_SHORT`（warn）: 折返し下限（minTurnaround）未満。
  - `BLK_DEADHEAD_MISSING`（warn）: Deadhead ルール不在で所要時間見積不可（距離近似も閾値超過）。
  - `BLK_DEADHEAD_EXCEEDS`（critical）: Deadhead 所要が gap を超過し連結不可能。
  - `BLK_RADIUS_EXCEEDS`（warn）: 接続距離が maxConnectRadius を超過。
  - `BLK_AFTER_HOURS`（warn）: Depot/Relief の営業時間/許容時間帯の外。

- Duties（交番）で評価する警告
  - `DUTY_CONTINUOUS_EXCEEDS`（warn）: 連続運転が `maxContinuousMinutes` 超過。
  - `DUTY_BREAK_SHORT`（warn）: 休憩が `minBreakMinutes` 未満。
  - `DUTY_RELIEF_WINDOW`（warn）: 区間境界の ReliefPoint が許容時間帯外。

- 技術エラー（blocking error）
  - `TECH_DIFF_BLOCK`（error）: 1つの Duty に複数 Block が混在（現行validatorの一貫性違反）。
  - `TECH_OVERLAP`（error）: 同一 Duty の区間が重複（現行validatorの重複違反）。
  - `CSV_SEQ_DUP`（error）: duties.csv の seq 重複（インポータで検知）。

- UI 表示ルール
  - 一覧行にバッジ（critical/warn/info）と件数を表示。詳細はツールチップ/サイドパネル。
  - フィルタ: 「criticalのみ」「warn以上」「すべて」。
  - エディタ操作時は連結直後にその区間の警告を即時評価・表示。

- CSV との関係
  - 将来の `violations`（数値）/`warnings`（要約）列は、`critical + warn` の件数/要約を格納。`info` は任意。
  - 未実装時は列を出力しない（後方互換）。

- DoD 追補
  - Blocks/Duties の一覧で critical/warn の件数が表示・フィルタ可能であること。
  - エディタ操作で警告が即時に反映されること（保存は可能）。
  - Split Mode で選択・時間カーソルの同期が機能すること。
  - 食事帯の追加/削除が可能で、`minBreakMinutes` に基づく warn が表示されること。

## テスト計画（追加するテスト）
- blockBuilder の単体テスト
  - minTurnaround と DeadheadRule を与えたとき、連結の可否/選好が変わること。
  - `linkingEnabled=false` で現行挙動と一致すること（後方互換）。
- gtfsParser の frequency 展開が blockBuilder 入力に反映されることの結合テスト。
- manualCsv のラウンドトリップ（入出力で等価）。
- dutiesCsv の入出力（警告件数を含む）と Duty 適用の往復整合。

## 段階導入とリスク低減
- フィーチャーフラグ: `manual.linking.enabled` を唯一のスイッチとして運用。既定値は現状どおり `true`、検証中は画面で OFF 可能。
- 影響最小化: 既存型にフィールドを足すのみ。既存API/CSVの列は保持。
- ロールバック容易性: `linkingEnabled=false` で従来ロジックに即時復帰。

## 実装手順（ロードマップ）
- 手順の詳細は `docs/specs/implementation-plan.md` を参照。
- 概要: 
  1) Blocks: 手動Connect＋接続部の警告
  2) Duties: 割付UI＋食事/休憩帯＋警告
  3) Split Mode: Blocks↔Duties 同期
  4) Vehicles（任意）: 配車の可視化＋CSV

## 今回は対象外（Out of Scope）
- 自動最適化（行路・交番の探索/費用最小化）。
- UnitCost に基づく費用スコアの算出とダッシュボード連携。
- シフト表（週次/月次の勤務計画）。

## DoD（受け入れ条件）
- BlocksView で `averageGapMin` と警告件数が表示できる。
- 新連結ロジックON/OFFでブロック数・未割当便数が変化することを確認できる。
- DutiesView で警告バッジが表示され、CSVに `violations` 列が出力される。
  - 上記に対するテストが追加され、`npm test` がグリーン。

## メモ: シフトは後で良いか？
- Yes（後回し推奨）。理由:
  - 先に「正しい行路」と「妥当な交番」生成のUI/データ整合性を固めることで、後続の自動割付（シフト）要件が明確になる。
  - シフトは制約（法令・協定・希望・休暇）と最適化ロジックが絡み、変更耐性を下げる。段階導入で失敗コストを最小化。
  - 今回のDoDで作るCSV/警告が、そのまま次フェーズの入力・評価基盤になる。

## 設定（デフォルト値と調整可能項目）
- Blocks/連結
  - `maxTurnGapMinutes`: 15（コード既定: DEFAULT_MAX_TURN_GAP_MINUTES）。
  - `manual.linking.minTurnaroundMin`: 10（UI設定）。
  - `manual.linking.maxConnectRadiusM`: 100（UI設定）。
  - `manual.linking.allowParentStation`: true（UI設定）。
- Duties（交番）
  - `maxContinuousMinutes`: 240（4時間）。
  - `minBreakMinutes`: 30（食事/休憩の下限）。
  - `maxDailyMinutes`: 780（13時間）。
  - `undoStackLimit`: 50。
- Split Mode（表示）
  - 初期比率: Blocks 60% / Duties 40%（ユーザー変更可）。
- 色/表現（凡例）
  - 営業便=ルート色、回送=濃灰、待機=斜線、食事=薄緑、警告=赤/黄。

注: 上記Dutiesのデフォルトはコード側 `src/services/duty/constants.ts` の `DEFAULT_DUTY_SETTINGS` と一致させること。

---

補足: 実装に入る前に、`現状分析Pro.txt` の Deadhead/折返し/交代所の定義をそのままコードコメントへ転記し、仕様のブレを防ぎます（根拠はドキュメントに置く）。
