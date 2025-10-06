# TS-bus-operation-app — 包括的設計（完成版 / Final Design）

## 🆕 追補: MVP/Next 設計表（2025-09-30 反映版）

> 方針：**MVPは“見る→つなぐ→配置する”に集中**。差分比較・高度検査・網羅バリデーション・PDFは次フェーズ。

### フェーズ定義

| フェーズ     | 目的                                                           | 完了の定義（DoD）                                     |
| -------- | ------------------------------------------------------------ | ---------------------------------------------- |
| **MVP**  | GTFSを**確認**し、`block_id`が無くても**Block確定**し、最小ルールで**Duty配置**できる | Explorer最小 / Block候補→採否→確定 / Dutyガント最小 / CSV出力 |
| **Next** | 精度・品質・運用性の底上げ                                                | 差分比較・高度検査・バリデーション拡張・PDF/ロスター・RBAC強化            |

### 機能設計マトリクス

| 機能領域          | **MVP（含む）**                                                                                                     | **Next（後回し）**                                      | 受入基準（MVP）                           | 備考                   |
| ------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------- | -------------------- |
| インポート&静的検査    | ZIP取込、必須列、到着≤出発、座標存在、service整合                                                                                  | 速度/形状逸脱/重複停等の**高度検査**                              | 失敗時の**致命一覧**を返し、Explorerから該当へジャンプ   | ログは簡易（who/what/when） |
| GTFS Explorer | **Stops/Shapes表示**、日付/路線選択、**路線×時間ヒストグラム**、**Depot手入力**、致命異常のピン留め                                               | **Feed差分比較UI**、速度/座標分散などの**高度異常可視化**               | 指定日で地図とヒストグラムが同期し、Depotを保存できる       | i18nは日本語固定           |
| Block生成（半自動）  | 候補条件**3点**（`turn_gap`/距離/同一路線優先）、**Greedy+手動採否**、**オーバーライド固定**、候補線可視化                                           | スコア高度化、Relief/Depotスコア、調整UI、MIP/CP小規模導入            | **70–80%**のTripで候補提示、採否で**Block確定** | PostGIS任意（距離はアプリ計算）  |
| Dutyガント       | セグメント**3種**（運転/回送/休憩）、ドラッグ&伸縮&削除&複製、**Undo1段**、**最小3ルール**（連続運転上限/日拘束/食事）                                        | ルール網羅（中拘束/交代窓/ベース制約等）、Undo多段、テンプレ/スニペット、**週間ロスター** | 違反は色分け＋理由表示、手動解除可（備考必須）             | Block↔Dutyリンクは最小参照のみ |
| エクスポート        | **CSV（Blocks/Duties）**                                                                                          | **PDF帳票/交番票**、Excel整形                              | CSVをダウンロード可能                        |                      |
| セキュリティ/RBAC   | 役割**2種**（編集/閲覧）、簡易監査                                                                                            | 役割細分・完全監査・SAML/SCIM                                | 編集操作が監査リストに残る                       |                      |
| API           | `/import`, `/explorer`, `/blocks`, `/duties` 最小                                                                 | `/diff`, `/validate`拡張, `/reports`                 | 最小APIでE2Eが回る                        |                      |
| データモデル        | `stg.*`（GTFS）/ `ops.depots`/`ops.relief_points`/`ops.blocks`/`ops.block_trips`/`ops.duties`/`ops.duty_segments` | `ops.rosters`/`ops.change_set`/キャッシュ系              | 最小スキーマで保存/再読込が可能                    | PostGISは任意           |

### 非機能（MVP目標）

* 地図初期表示 **< 2秒**／ガント操作レイテンシ **< 100ms**／候補生成1 service日 **< 30秒**（単一ジョブ）

### 受入基準（MVP再定義）

1. ExplorerでStops/Shapesとヒストグラムが同期表示でき、Depotを保存できる。
2. `block_id`なしでも、対象service日に対し**70–80%のTrip**で候補が提示され、採否→**Block確定**できる。
3. Dutyガントで**3セグメント編集**・**3ルール**の警告・**1段Undo**が機能する。
4. Blocks/Dutiesを**CSV出力**できる。

### 実装順（DoDつき）

1. 取込&静的検査 → 2) Explorer最小 → 3) Block候補生成/採否 → 4) Dutyガント最小 → 5) CSV出力。

### Nextの完了目安

* 差分比較UIで**変更箇所→影響Block/Duty**にジャンプできる。
* 高度検査（速度/座標/形状）で**誤検知率<10%**の実用水準。
* バリデーション網羅＋週間ロスター出力（PDF/Excel）。

---

> 目的：GTFS/GTFS-JPを読み込み、バスの**行路表（Vehicle Blocks）**と**交番表（Crew Duties/Rosters）**を、まずは**手動＋半自動**で素早く作成・検証できるWebアプリを提供する。最終的には自動化・最適化へ段階的に拡張する。

---

## 0. ガイドライン（日本語優先 / EN gloss）

* **原則**：MVPは**手動で確実に作れるUI**、次に**半自動**、最後に**自動化**。
* **前段に“GTFS Explorer（可視化）”**を置き、取り込み直後の品質確認・差分把握・補助データ（Depot/Relief等）入力の母体とする。
* **`block_id`欠如前提**：行路推定ロジックと**人による採否**を中核機能に。
* **Overrideファースト**：自動推定よりも**手動オーバーライドを常に優先**。
* **Explainability**：推定根拠・違反理由・差分影響をUIで明示。

---

## 1. スコープ & 非スコープ

### スコープ（MVP〜段階拡張）

1. **GTFSインポート & 検査**（GTFS/GTFS-JP）
2. **GTFS Explorer**（地図・時間・異常・差分）
3. **行路生成（半自動）**：Trip連結候補提示→人が確定
4. **交番作成（手動中心）**：ガントでDuty編集＋ルール検証
5. **Feed差分影響分析**：Routes/Trips/Calendarの変更→Blocks/Duties影響

### 非スコープ（将来）

* 数理最適化（MIP/CP）による完全自動化
* 乗務員シフトの給与計算・勤怠連携
* 旅客需要予測やダイヤ最適化

---

## 2. 利用者・ユースケース

* **運用計画担当**：行路・交番の作成と改訂、差分確認
* **現場監督者**：Depot/Reliefポイントの定義、運用ルール設定
* **品質管理**：フィード異常の検出・修正の指示

主ユースケース：

1. GTFS取込→Explorerで品質チェック→Depot/Reliefを登録
2. 行路推定（候補）を見ながら採否→Blockを確定
3. ガントでDutyを作成（手動＋テンプレ）→ルールチェック
4. 新版GTFSで差分確認→影響範囲の再調整

---

## 3. データモデル（論理設計）

### 3.1 ステージング（GTFSそのまま）

* `stg.agency/routes/trips/stop_times/stops/shapes/calendar/calendar_dates/frequencies/transfers`
* インポート時のメタ：`stg.feed_info`, `stg.import_log`

### 3.2 運用メタ（オーバーレイ）

* `ops.depots`：車庫（座標/名称/属性）
* `ops.relief_points`：交代可能停留所・時間帯・許容ドリフト
* `ops.stop_overrides`：停名/座標補正、タグ
* `ops.service_overrides`：暦例外・運用日タグ
* `ops.parameters`：推定パラメタ（`max_turn_gap`, `max_link_km`, `min_layover_min` 等）

### 3.3 行路・交番（運用成果）

* `ops.blocks`：blockヘッダ（service_id, depot, 備考）
* `ops.block_trips`：順序付けられたTrip連結＋セグメント種別（service/deadhead/layover）
* `ops.duties`：乗務員当たりのDutyヘッダ（sign_on/off, base, role）
* `ops.duty_segments`：運転/回送/休憩/待機/引上/点検 等、GTFS参照リンク
* `ops.rosters`：週/交番票ライン（将来）
* 監査：`ops.audit_log`, `ops.change_set`

---

## 4. インポート & 検査フロー

1. ZIPアップロード→`stg`にロード（高速化：COPY/バルク）
2. **静的検査**：必須列/制約、時系列整合（到着≤出発）、shape距離
3. **動的検査**：速度異常（p95/平均比較）、同名停の座標分散、service適用範囲
4. **結果サマリ**をダッシュボードへ（致命/警告/情報）。

---

## 5. GTFS Explorer（MVP最小）

**目的**：理解・異常把握・オーバーレイ入力・行路推定の前処理。

* **地図レイヤ**：Routes/Shapes/Stops + Depot/Relief（編集可）
* **時間ビュー**：

  * 路線別トリップ時刻帯ヒストグラム
  * 停留所時刻表プレビュー（選択日×時刻）
* **異常リスト**：速度/時系列矛盾/座標異常→クリックで地図/時間へジャンプ
* **差分比較**：前回FeedとRoutes/Trips/Calendar差分（増減/改廃/日付）
* **オーバーレイ保存**：Depot/Relief/メモ→`ops.*`に即保存

---

## 6. 行路生成（半自動）

### 6.1 候補生成

* 対象日（service_id）で**Trip終端→Trip起点**のリンク候補を生成
* 条件：`gap_min ≤ turn_gap ≤ max_turn_gap`、`link_distance ≤ max_link_km`、同一路線優先、終端/起点がRelief可能点ならスコア加点
* コスト：`deadhead_time + α·layover_slack + β·route_mismatch + γ·depot_penalty`

### 6.2 連結アルゴリズム（MVP）

* **Greedy + Backtrack（軽量）**：スコア最小の遷移を順に採用、閉路/衝突時はロールバック
* **人の採否**：UIで候補パスを可視化し、クリックで確定/拒否
* **オーバーライド最優先**：明示指定の連結は強制固定

### 6.3 出力

* `ops.blocks`/`ops.block_trips`にコミット
* 指標：稼働台数、総走行/回送、平均layover、始終業デポ

---

## 7. 交番作成（手動中心＋検証）

### 7.1 ガントUI（乗務員ビュー）

* **スイムレーン**：Duty単位、セグメントはカード（運転/回送/休憩…）
* **ドラッグ&ドロップ**、スナップ（停留所・時刻）、拡大縮小、複製/テンプレ
* **ショートカット**：伸縮（Shift+Drag）、分割/結合、検索（Block/Trip）
* **バリデーション**：

  * 連続運転上限、日拘束/中拘束、休憩義務、交代地点制約
  * 開始/終了のベース（Depot/営業所）
  * 複数Dutyの当日衝突検出
* **アラート**：違反種別別に色分け＋理由ツールチップ

### 7.2 データ

* Duty生成は`ops.duties` + `ops.duty_segments`
* BlockとDutyは**1:n**（1Dutyが複数Block区間を担当可）
* 将来：週間ロスター`ops.rosters`へ展開

---

## 8. ルール設定（例：パラメタライズ）

* `max_turn_gap`（分）、`max_link_km`、`min_meal_min`、`max_continuous_drive_min`、`sign_on_buffer_min`、`sign_off_buffer_min`
* 交代可能窓：`relief_points.time_windows`
* 暦：`service_overrides`で特異日タグ（例：祝日特別ダイヤ）

---

## 9. 差分影響分析

* 新旧Feedの比較：Routes/Trips/Calendar/Stopsの**追加・削除・変更**
* 影響算出：

  * Block参照Tripの欠落/変更 → 該当Blockを警告
  * Duty参照Segmentの欠落/時間ズレ → ガント上にハイライト
* レポート出力：CSV/Excel（変更一覧、再計画必要リスト）

---

## 10. アーキテクチャ

### 10.1 フロントエンド

* React + TypeScript、状態管理（Zustand/Redux）、地図（MapLibre/Mapbox GL）、ガント（自作Canvas/Virtualized）
* i18n（ja優先）、アクセシビリティ（キーボード操作・コントラスト）

### 10.2 バックエンド

* Node.js（Fastify/Express） or Python（FastAPI）
* ジョブ実行：BullMQ/RQ（インポート・検査・候補生成）
* 認証：OIDC（Google/MS）

### 10.3 データベース

* PostgreSQL + PostGIS
* 重要索引：`trips(service_id, route_id)`, `stop_times(trip_id, stop_sequence)`, 空間インデックス（stops/shapes），`ops.block_trips(block_id, seq)`

### 10.4 API（例）

* `POST /gtfs/import`、`GET /gtfs/summary`、`GET /gtfs/diff`
* `GET /explorer/map?service_id=...`
* `POST /overlays/depots|relief_points`
* `POST /blocks/infer`、`POST /blocks/commit`、`GET /blocks/:id`
* `POST /duties`、`PUT /duties/:id`、`GET /duties/validate`

### 10.5 ログ & 監査

* 変更セット（誰が/いつ/何を）とロールバック（ソフトデリート）

---

## 11. UI/UX要件（抜粋）

* **高速フィードバック**：操作→即座に可視反映
* **選択からのジャンプ**：異常リスト→地図/時間、Trip→Block、Block→Duty
* **空間×時間の同期**：地図ポインタが時刻ビューに同期移動
* **テンプレ**：Duty雛形、休憩パターン、始終業パターン
* **ショートカットとUndo/Redo**：編集の信頼性

---

## 12. 性能・容量目標

* 1日あたり**10,000 Trips**規模まで快適表示（仮想化リスト/Canvas描画）
* 候補生成は1 service日あたり**< 30秒**（将来並列化）
* 地図初期描画**< 2秒**、ガント操作レイテンシ**< 100ms**

---

## 13. セキュリティ・運用

* RBAC（管理者/計画担当/閲覧）
* 監査証跡、PII非保持（職員IDは内部ID化）
* バックアップ（DB日次、ファイルS3互換）

---

## 14. テスト計画

* **ユニット**：検査・候補生成・バリデータ
* **統合**：インポート→Explorer→Blocks→DutiesのE2E
* **UI**：重要操作の回帰（Playwright）
* **現場シナリオ**：時刻変更・便削除・運休の差分適用

---

## 15. ロードマップ

* **MVP**（8週目標）

  * インポート/検査、Explorer（地図/時間/異常/差分）
  * 行路候補生成（Greedy）、採否UI、Block確定
  * Dutyガント（手動・検証・テンプレ）
* **次フェーズ**

  * 候補生成の改善（ラグランジアン/小規模MIP）
  * 週間ロスター、帳票出力（交番票PDF）
  * 需要変化に応じたサジェスト（将来）

---

## 16. 受入基準（サンプル）

* GTFS取込後、Explorerで**速度異常/座標異常/時系列矛盾**が一覧でき、クリックで該当を地図へジャンプできる
* `block_id`無しでも、対象service日に対して**候補が95%以上提示**され、人が採否して**Blockが確定**できる
* Duty編集で**規定違反をリアルタイム警告**、CSV/PDFエクスポートできる
* 新版Feed投入後、**影響を一覧出力**できる

---

## 17. 用語対照（JP ⇔ EN）

* 行路（Vehicle Block）/ 交番（Crew Duty）/ 交番票（Roster）
* 回送（Deadhead）/ 折返（Turnback）/ 休憩（Meal/Break）/ 始終業（Sign on/off）

---

## 18. 付録A：ERD（記述）

* `stg.*`（GTFS標準）→ `ops.*`（Overlays/Blocks/Duties）に分離
* 主キー：`blocks(id)`, `block_trips(block_id, seq)`, `duties(id)`, `duty_segments(duty_id, seq)`
* 参照：`block_trips.trip_id → stg.trips.trip_id`、`duty_segments.block_trip_ref`（nullable）

---

---

## スコープ明確化 / Scope

- 本プロジェクトは「設計済みの GTFS を読み取り、可視化・編集する」ことを目的とします。
- ダイヤ設計（Timetable / Schedule Building）は対象外です。新規の時刻表自動生成は行いません。

包括性に関する補足（今後の拡張候補）:
- 週次の交番（Rostering＝週次パッケージ）
- 車庫配車・出入庫（Pull-out / Pull-in）
- 回送（Deadhead）
- 車両属性・車種割当（低床・EV・容量・燃料等の制約を含む）

上記は運行計画業務を「包括的」と呼ぶために必要な周辺領域ですが、MVPでは範囲外とし、行路（Blocking）と勤務（Crew Scheduling）を中心に扱います。

---

## プロダクト概要（MVP）

- 富士通が西日本鉄道（西鉄）向けに提供する、バス業務（車両・乗務員割当）の「UI先行・最小実装」MVP。
- 1名の非エンジニアがAIと共創。短期間で意思決定に必要な価値の可視化を最優先。
- 目的: 人手で行っているブロック（運行機材の連結）およびDuty（乗務）の編成作業を、GTFSを基礎データとしてブラウザ上で直感的に実施できるようにする。次フェーズで数理最適化を段階導入。
- カバー範囲: GTFS読込 → Explorerで地図/時系列の可視化 → Block候補推定（半自動）→ Dutyの手動割当＋簡易ルール警告 → CSV出力。PDFや厳密最適化は次フェーズ。

## MVP仕様（再整理）

- 入力データ
  - GTFS/GTFS-JP ZIP（最低: stops, trips, stop_times, shapes。必要に応じて calendar, calendar_dates）。
  - 任意オーバーレイ: 営業所/Depot, 交代可能地点（relief points）。
- 主要機能
  - Explorer: 地図（Stops/Shapes）と時刻ヒストグラムの同期表示、日/路線フィルタ、異常ピン留め。
  - Block候補推定: Greedy連結（turn_gap/距離/同一路線優先）。候補の採否でBlock確定。単独Tripは孤立Block容認。
  - Dutyガント: 運転/回送/休憩の3種セグメント、Drag&Drop編集、1段Undo、違反の即時可視化。
  - エクスポート: Blocks/DutiesのCSV。
- 簡易ルール（暫定・設定化）
  - max_turn_gap=15分、max_continuous_drive=4時間、min_meal=30分、day_max_duty_span=9時間。
  - sign_on/offバッファ、交代地点はrelief_pointsに準拠。
- 受け入れ基準（MVP）
  - 地図と時系列が同期し、Depot保存ができる。
  - `block_id`未設定でも対象service日に対して70〜80%のTripでBlock候補提示→採否でBlock確定。
  - Duty編成中にルール違反が色分け表示され、CSVをダウンロードできる。

## 非スコープ（MVP）

- PDF帳票（交番票）、厳密な数理最適化（MIP/CP）、SSO/RBACの高度化、サーバ常駐API、完全な差分比較UIなどは次フェーズ。

## 想定利用者・体験

- 想定利用者: 運行計画・配車・乗務割当の担当者。
- 体験価値: 紙/Excel中心の手作業を、ブラウザ上で「見える・つなぐ・配置する」に置き換え、判断を早く・正確に。

## 更新履歴
- 2025-10-06: プロダクト概要とMVP仕様（再整理）を追加。

## 仕様確定事項（2025-10-06）

- Block候補の達成目標値は「70〜80%」で据え置き（引き上げない）。
- Dutyルールの最小セットに「中拘束」「交代地点制約」を含める。
- CSVスキーマは適切であればOKとし、以下のMVP案を採用（将来の変更は互換を配慮して小幅に実施）。

### CSVスキーマ（MVP）
- Blocks: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id`
- Duties: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id`
  - 備考: 時刻はGTFS準拠（例: 24時超を許容）。文字コードUTF-8、区切りは`,`、改行はLF。

### データ/フィード
- サンプルは `data/GTFS-JP(gunmachuo).zip` を利用。ただし任意のGTFS/GTFS-JP ZIPをドラッグ&ドロップで読み込み可能にする（将来的に複数フィード切替は検討）。

### マップタイル
- MVP既定は MapLibre + OSM（キー不要）。運用要件に応じて後から切り替え可能。

Note: An updated, concise README is available at docs/README_JA.md and an execution-focused checklist at docs/ImplementationChecklist.md. This file retains prior design notes.
