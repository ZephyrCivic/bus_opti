<!--
  docs/specs/block-ui-redesign.md
  目的: Blocks（行路）編集UIの再定義。視認性・操作性・検証性を高める。
-->

# Blocks UI リデザイン仕様（2025-10-08）

## 背景
- 既存のBlocksViewはカード＋テーブル＋タイムラインの混在で、サービス（縦軸）視点の編集が難しい。
- Duty編集や差分エクスポートと整合させるため、Blockの表示・編集フローを再設計する。
- KPI/UX観点では、Timelineインタラクションと指標の即時再計算が必要。

## ゴール
1. サービス視点でBlockの表示と編集ができ、主要ケースを1画面で完結。
2. Block内のギャップ（回送/折返し）を可視化し、Dutyとの往来がスムーズ。
3. 変更は即時に指標/警告へ反映。Export/差分も一貫。

## UI構成
1. ヘッダー: サービス/カレンダー/フィルタ（`service_id`、タグ）。
2. サービス別タイムライン: 24:00超の拡張時刻表示に対応。折返しはオーバーレイで強調。
3. Blockカード: Trip数、開始/終了、回送/最小折返し/reliefなどの要約。アクション（移動/削除）。
4. 地図（P2）: MapLibreで経路/交代所/Depotの関係をプレビュー。サムネイル→別タブで拡大。
5. アクションバー: Blocks CSV/JSON出力、差分スナップショット、ルール編集への導線。

## データ
- 計画行（plan.csvRows）とGTFS `calendar` を合成し、`service_id`単位で構築。
- Tripの`startMinutes`/`endMinutes`からギャップ（deadhead/layover）を算出。
- Relief/Depotは `docs/demo` のCSVを初期値として取り込み可能。

## 候補提示（端点連結）の定義
- 距離計算: Haversine（WGS84）で終点→始点の直線距離を算出。
- 候補集合 C(from_trip) の生成:
  - 時間条件: from.end <= to.start <= from.end + Δt_max（初期15分）。
  - 距離条件: 終点→始点の距離 d <= Δd_max（初期1.5km）。
  - 例外: 交代所/Depotを跨ぐ場合は距離判定を緩和（+0.5km）。
- ランク付け（昇順）:
  1) Δt（小さい順）
  2) d（短い順）
  3) 同点は route_id 昇順 → trip_id 昇順。
- 表示数: 上位K=8件（「他を表示」で展開可）。
- 提案のみ: クリック/ドラッグで確定するまでBlockは変化しない（自動確定なし）。
- 既定値: Δt_max/Δd_max は settings-ui で変更可（NFRに初期値）。
- DoD: 同一入力で候補順序が常に決定論的。UIの候補とCSV差分が一致。

## 非機能
- タイムライン描画1s以内、編集反映200ms以内（NFR参照）。
- 失敗時はドラフト保存・復元（復旧ポリシー参照）。

## DoD
- 連結/解除/並び替えが即時反映され、Undo/Redoで10段まで戻せる。
- 候補提示が定義どおりの順序で表示される。
- Export/差分が冪等（Export→Import→Exportで一致）。

## 参照
- docs/specs/timeline-interactions.md
- docs/specs/diff-export-rollout.md
- docs/specs/file-write-audit.md
- docs/specs/requirements-blocks-duties.md
- docs/specs/non-functional.md

---

# ブロック画面 UI リデザイン設計メモ（2025-10-08）

## 背景
- 既存のBlocksViewはカード＋テーブル＋タイムラインの混在で、サービス（縦軸）視点の編集が難しい。
- Duty編集や差分エクスポートと整合させるため、Blockの表示・編集フローを再設計する。
- KPI/UX観点では、Timelineインタラクションと指標の即時再計算が必要。

## ゴール
1. サービス視点でBlockの表示と編集ができ、主要ケースを1画面で完結。
2. Block内のギャップ（回送/折返し）を可視化し、Dutyとの往来がスムーズ。
3. 変更は即時に指標/警告へ反映。Export/差分も一貫。

## UI構成案
1. ヘッダー: サービス/カレンダー/フィルタ（`service_id`、タグ）。
2. サービス日別タイムライン: 24:00超の拡張時刻表示に対応。折返しはオーバーレイで強調。
3. Blockカード: Trip数、開始/終了、回送/最小折返し/reliefなどの要約。アクション（移動/削除）。
4. 地図（P2）: MapLibreで経路/交代所/Depotの関係をプレビュー。サムネイル→別タブで拡大。
5. アクションバー: Blocks CSV/JSON出力、差分スナップショット、ルール編集への導線。

## データ要件
- 計画行（plan.csvRows）とGTFS `calendar` を合成し、`service_id`単位で構築。
- Tripの`startMinutes`/`endMinutes`からギャップ（deadhead/layover）を算出。
- Relief/Depotは `docs/demo` のCSVを初期値として取り込み可能。

## 実装スケッチ案
- 候補提示（端点連結）の定義とランク付け（Δt, d, route_id, trip_id）。
- 表示件数は上位K=8（「他を表示」で展開）。確定するまでデータは不変。
- 既定値（Δt_max/Δd_max）は Settings UI で変更可。

## 実装ステップ案
1) タイムライン最小UIの実装（P0）
2) 候補提示/解除/並び替えの実装（P1）
3) 地図プレビューと高度化（P2）

## リスクと対策
- 大規模サービス時の描画性能。→ 仮想化・スケールごとの簡略描画を併用。
- Undo/Redo と差分の整合。→ 一意IDと操作ログを導入し決定論性を担保。

## ロードマップ（目安）
1) タイムライン最小UI（P0）→ 2) 接続候補/解除（P1）→ 3) 地図/高度化（P2）

## DoD
- D&D/ズーム/キーボード/Undo-Redoが上記仕様どおり再現。
- E2E最小シナリオ:
  1) 連結→解除→Redoで連結に戻る。
  2) 未割当→Driver割付→Undoで未割当へ戻る。
  3) 設定ドラフト変更→Undo→Redo（適用前）。
