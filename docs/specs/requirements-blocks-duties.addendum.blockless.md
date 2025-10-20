<!--
  docs/specs/requirements-blocks-duties.addendum.blockless.md
  目的: BlockID が空の GTFS を前提に、最小構成で Blocks/Duties を成立させる要件追補を定義。
  背景: data/GTFS-JP(gunmachuo).zip の trips.txt に block_id 列はあるが全行空（267行中0件）。
  方針: Small, clear, safe steps — always grounded in real docs.
  日付: 2025-10-17
-->

# 要件追補（BlockIDなし前提の最小構成）

## スコープと前提
- 入力GTFS: `stops.txt / stop_times.txt / trips.txt / routes.txt / shapes.txt / calendar(.txt) / calendar_dates.txt` を使用。
- `trips.block_id` は列は存在するが値は空（=BlockID無しと見なす）。自動最適化は対象外、UI主導で行路/交番を作る。
- 追加入力（補助CSV）は `docs/demo/*.csv` の方針に準拠し、本追補で列名と解釈を明文化する。

## 用語（本追補での最小定義）
- ピース（piece）: 便と便の連結単位（見込みDeadheadを含む）で構成する車両側の連なり候補。
- 実効ターン（effective turnaround）: `gap_min - deadhead_min`。これが `>= minTurnaroundMin` を満たすとき連結可能。

## 入力データと契約（Contract）
### GTFS 前提
- タイムゾーンは `feed_info.txt` に従う（無い場合は環境設定）。
- 便の営業日判定は `calendar/calendar_dates` による。
- `shapes.txt` がある場合、最終停留所⇔次便始発の地理距離計算で優先利用。無い場合は停留所緯度経度で代替。

### 補助CSV（最小スキーマ）
- `docs/demo/depots.csv`
  - `depot_id, name, lat, lon, open_time, close_time`
  - 役割: 便の始終端との Deadhead 推定、営業所営業時間の警告生成。
- `docs/demo/relief_points.csv`
  - `relief_id, name, stop_id?, lat?, lon?, window_start, window_end`
  - 役割: 交代可能地点と時間帯の定義（stop_id または lat/lon のいずれか必須）。
- `docs/demo/deadhead_rules.csv`
  - `mode, speed_kmph?, travel_time_min?, allowed_window?`
  - 解釈: `travel_time_min` があれば優先、無ければ `distance_km / speed_kmph`。`allowed_window` は連結候補のフィルタ。
- `docs/demo/drivers.csv`
  - `driver_id, name, qualifications?, max_continuous_min?, max_daily_min?, min_break_min?`
  - 役割: Duty 警告の閾値や資格の雛形（未指定は既定値を使用）。

## 最小アルゴリズム（BlockIDなしの便連結）
1) 同一営業日内で、各便 `t` の直後に来る候補便 `u` を列挙。
   - 時間条件: `start(u) >= end(t)` かつ `gap_min <= maxTurnGapMinutes`。
   - 空間条件: `distance(last_stop(t), first_stop(u)) <= maxConnectRadiusM`（parent_station 許容可）。
2) Deadhead 推定
   - `deadhead_min = min( 指定travel_time_min, distance_km / speed_kmph )`。
   - depot を起終点とする場合は `distance(depot, first/last_stop)` を用いる。
3) 実効ターン評価
   - `effective = gap_min - deadhead_min` が `>= minTurnaroundMin` なら連結可。
4) 候補選好（単純規則）
   - 優先順: 最小 `deadhead_min` → 最小 `gap_min` → 同一路線/方向一致。
5) 競合回避
   - 既に選ばれた `u` は他の `t` からは除外（1:1 連結）。

備考: 実装は貪欲（Greedy）で開始し、後に改善可能。切替フラグ `manual.linking.enabled` で旧挙動に即時復帰できること。

## 検証（Validators）
ハードエラー（保存ブロック）
- `TECH_OVERLAP`: 同一ピース内で時間重複。
- `TECH_NEG_TURN`: 実効ターンが負（データ異常）。
- `TECH_UNKNOWN_REF`: depot/relief 参照不明。

警告（保存可）
- `WARN_LONG_DEADHEAD`: Deadhead が閾値超過（例: 30分）。
- `WARN_TURN_TIGHT`: 実効ターンが下限近傍（例: <5分）。
- `WARN_OUT_OF_WINDOW`: Relief/depot の許容時間帯外。

## UI 要件（最小）
- Blocks 画面
  - 未連結便パネル（候補数バッジ付）。
  - 連結操作で `deadhead` と `effective` をチップ表示。
  - フィルタ: `未連結のみ / 警告あり`。
- Duties 画面
  - 従業員ドラッグ割付と食事/休憩帯の追加。
  - バッジ: `critical/warn/info` 件数表示、ツールチップ詳細。

## 受け入れ条件（DoD）
- R-GTFS-001: 取込時に `trips.block_id` 非空率=0% を検出し「Blockless」ラベルを表示。
- R-BLOCK-001: 貪欲連結でピースが生成され、未連結便数が一覧に表示される。
- R-BLOCK-002: Deadhead 推定と実効ターンがUIに表示され、警告閾値が機能する。
- R-DUTY-001: Duty に割付・食事帯を追加し、警告が即時反映される（保存可）。
- R-CSV-001: `depots.csv / relief_points.csv / deadhead_rules.csv / drivers.csv` を読み込み、未知列は無視、欠落は警告。
- R-TEST-001: 単体/結合テストが追加され、`npm test` がグリーン。

## “ミニマムに最適作成”の定義と方針
- 充足条件（ハード）
  - COV: 未割当便=0。
  - LAW: 改善基準告示の違反=0（連続運転・休憩・日拘束の下限/上限）。
- 目的関数（ソフト、優先度順）
  1) Deadhead総分の最小化。
  2) 最悪実効ターンの底上げ（min effective turnaround の最大化）。
  3) Duty数の抑制（必要ドライバ数の圧縮）。
- 解法段階（依存を増やさない最小構成）
  - 段1: 貪欲連結（本追補の最小アルゴリズム）。
  - 段2: ローカル探索による改善（2-opt/隣接入替/再接続）。
  - 段3: 小規模MIP（任意/フラグ配下）。≤300 trips/日を目安に厳密解を許容。依存追加は任意（例: glpk.js）。

## スケール別の適用目安
- 小規模（単一営業所・≤300 trips/日）: 段1+2で十分。厳密性が必要な場合のみ段3。
- 中規模（≤800 trips/日）: 段1+2＋UI手直しで実務対応。特定日だけ段3をON。
- 大規模（>800 trips/日）: 本追補の範囲外（別途サーバ/バッチ最適化を検討）。

## 成功指標（評価と可視化）
- KPI-1: Deadhead総分のベースライン（段1）比 改善率 ≥ 15–30%。
- KPI-2: 未割当便=0・法規違反=0 を満たす日割合 ≥ 95%。
- KPI-3: 手直し工数（編集回数/ドラッグ回数）をベースライン比 ≥ 30%削減。
- 画面表示: Blocks/Duties フッタに KPI スナップショットを表示（情報/警告）。

## リスクと緩和（Blockless特有）
- RISK-1（誤連結の伝播）: 初期誤りが下流のDeadheadを増大。
  - Mitigation: ローカル探索を標準同梱。差分適用・UNDO対応。
- RISK-2（地理揺らぎへの過敏/鈍感）: parent_station と半径閾値のチューニング。
  - Mitigation: 二段基準（同一parent優先→距離）。UIで閾値を露出。
- RISK-3（法規境界）: 休憩分割・仮眠・宿泊勤務などの特殊形態。
  - Mitigation: スコープ外へ明示。将来の拡張フラグで段階導入。

## 設定とフラグ（参考）
- 既存: `manual.linking.enabled`（旧挙動へのロールバック）。
- 提案: `opt.local.enabled=true`（ローカル探索ON/OFF）, `opt.mip.enabled=false`, `opt.mip.maxTrips=300`。

## 非機能（最小）
- 設定は `config.py` 由来の既定を踏襲（magic number禁止）。
- ファイルサイズ/モジュールは各≤300LOC、段階導入・ロールバック容易。

## 変更履歴（本追補）
- 2025-10-17: 初版（BlockID無し前提を明文化、データ契約・受け入れ条件を追加）。
