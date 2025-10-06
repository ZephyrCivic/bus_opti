# TS-bus-operation-app: MVP 設計（2025-10-03）

このドキュメントは `readme.md`（最終更新: 2025-09-30）を要約し、初回リリース（MVP）の実装対象を具体化したものです。元の設計を大きく崩さず、短期間で「使って判断できる最小価値」を届けることを目的にしています。

## 1. MVP で提供する価値

- GTFS（ZIP）をローカルで読み込み、Stops/Shapes を地図上に可視化（オフライン可）。
- 既存 `block_id` の検証と、Greedy ルールによる Block 推定（3 ルール: `turn_gap`/時差/連続性）。
- 推定 Block からの簡易 Duty 編集（3 操作: 追加/入替/削除、Undo1 段階）。
- Blocks/Duties の CSV エクスポート。
- 差分ビュー（Before/After の追加/削除/担当変更、メトリクス差分）。

非ゴール（MVP ではやらない）
- PDF ロスター、厳密最適化（MIP/CP）、RBAC/組織統合、サーバー常駐 API。

## 2. 技術スコープ

- フロントエンドのみ（Vite + React + TypeScript）。
- 地図は MapLibre GL もしくは Mapbox GL（MVP は地図表示に限定）。
- データはすべてブラウザメモリ内（IndexedDB は任意）。
- サーバー不要。CLI ツールは任意（同梱の `tools/*` は維持）。

## 3. 最小データモデル（フロント実装）

- `Route { id, day, startTime, endTime, requiredDrivers, startLocation, endLocation }`
- `Assignment { routeId, driverId }`
- `Schedule: Record<DayOfWeek, Assignment[]>`
- `DashboardData { summary:{ totalShifts,totalHours,unassignedCount,fairnessScore }, workloadAnalysis, unassignedRoutes }`

本リポジトリに `src/types.ts` と `src/services/state/*`（メトリクス集計・差分算出）を追加済み。`npm test` でユニットテスト 13 件が成功します。

## 4. 画面フロー（MVP）

1) Import 画面
- GTFS ZIP をドロップ → `stops.txt`/`trips.txt`/`stop_times.txt`/`shapes.txt` を解析
- サマリー表示（路線数、便数、サービス日など）

2) Explorer 画面
- 地図に Stops/Shapes を描画、選択で詳細をサイドパネル表示
- Service 日選択 → 該当 Trip/Block のみ表示

3) Blocks 画面
- Greedy 推定を実行 → Block リスト表示（3 ルール）
- Explorer で選択中の Trip を Block に追加/入替/削除（Undo1）

4) Duties 画面（簡易）
- Block をセグメント化して担当者に割当（ドラッグ&ドロップ 3 操作）
- メトリクス（総シフト・未割当・公平度）をヘッダに表示

5) Export
- Blocks/Duties を CSV ダウンロード（ファイル名に日付を付与）

## 5. Done の定義（MVP）

- 主要 4 画面が操作可能で、GTFS から CSV 出力まで UI で一貫。
- 95% 以上の Trip が Block 推定に連結（既存 `block_id` があれば検証可能）。
- 差分ビューで「追加/削除/担当変更」とメトリクス差分が確認できる。
- ローカル環境で `npm run dev` から 5 分以内に起動確認できる。

## 6. 実装タスク（2 週間目安）

Day 1-2
- 画面シェル（React Router / ページ骨組み）
- Import パーサ（JSZip + PapaParse）

Day 3-5
- Explorer（地図描画、Stops/Shapes、サービス日フィルタ）
- Greedy Block 推定（最短ターン・連続性・時間差）

Day 6-8
- Duty 編集（追加/入替/削除、Undo1）
- `dashboardCalculator` を UI に接続

Day 9-10
- 差分ビュー `scheduleDiff` の UI 化
- CSV Export（Blocks/Duties）

Day 11-12
- エッジケース（未割当や重複）のハンドリング
- 使い勝手改善（ショートカット・検索）

Day 13-14
- 簡易 E2E（Playwright は任意）/ 動作検証 / 体験改善

## 7. セットアップと動かし方

```
npm ci
npm test
npm run dev
```

地図キーが必要な場合は `.env.local.example` を参考に `.env.local` を作成（MVP はキー不要のタイルで開始可）。

## 8. 既存 readme.md への所見（要点）

- フェーズ/MVP/Next の切り分けは妥当。MVP 定義を先頭に集約すると読みやすい。
- PDF・厳密最適化・RBAC を後ろ倒しにした判断は MVP では正しい。
- API/DB 記述は将来像として良いが、MVP はフロント単体で十分。将来的に FastAPI/Fastify を再検討。

修正提案（readme.md 反映を推奨）
- 冒頭に「MVP サマリー」「非ゴール」「セットアップ」を追加。
- UI 4 画面のワイヤ概略を記載（文章ベースで十分）。
- 差分ビューの DoD（検出カテゴリとメトリクス差分）を明文化。

