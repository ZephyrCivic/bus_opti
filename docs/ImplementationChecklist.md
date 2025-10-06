# 実装チェックリスト（MVP / shadcn/ui 前提）

本チェックリストは、README_JA に基づき、実装を“見える化”しながら進めるためのTODOです。各項目は GitHub 風チェックボックスで運用します。

## 0. 合意・準備（2025-10-03 確定）
- [x] スコープ合意（Timetable除外、Rostering/Deadhead等はNext候補）
- [x] UIスタック合意（shadcn/ui + Tailwind + Radix）
- [x] デモデータ合意（`data/GTFS-JP(gunmachuo).zip`）
- [x] ルール暫定値合意（例: max_turn_gap=15分、連続運転4h/休憩30m/拘束9h）

## 1. プロジェクト整備（コード生成は必要最小限）
- [x] Tailwind 初期化（`tailwind.config.js`, `postcss.config.js`, `src/index.css`）
- [x] shadcn 初期化（Vite対応）
- [x] 必要最低限のUIコンポーネント生成
  - [x] Button / Input / Select / Dialog / Drawer(or Sheet)
  - [x] Tabs / Tooltip / Badge / Card / Alert
  - [x] Table（TanStack Table統合）
  - [x] Toast（`sonner`）
- [x] `src/components/layout/AppShell.tsx`（Header/Sidebar/Content）

## 2. Import（GTFS 読込）
- [x] ZIP ドラッグ&ドロップ + ファイル選択の両対応
- [x] `stops/trips/stop_times/shapes` パース（欠損時は機能限定のガイド）
- [x] インポートサマリー（便数/路線数/サービス日）
- [x] メモリ保持 + 手動保存/読込 + 再インポート動線

## 3. Explorer（地図可視化）
- [x] MapLibre GL 導入（キー不要スタイル）
- [x] Stops/Shapes の描画（GeoJSON オーバーレイ + 自動フィット）
- [ ] サービス日フィルタ
- [ ] Stop/Trip 選択 → サイドパネル表示

## 4. Block 推定（Greedy）
- [ ] 既存 `block_id` 整合率の集計表示
- [ ] Greedy 連結（turn_gap最小優先、補助: 同一路線/近接/時系列）
- [ ] 単独Tripの扱い（孤立Block）
- [ ] 推定の再実行/パラメータ変更UI

## 5. Duty 簡易編集
- [ ] Block をセグメント化 → Driver へ割当（3操作: 追加/入替/削除）
- [ ] Undo 1段階
- [ ] KPI パネル（総シフト/未割当/総時間/公平度）
- [ ] 簡易ルール警告（連続運転/休憩/拘束）

## 6. Diff + Export
- [ ] 基準スナップショット（読込時点 or 任意保存）
- [ ] 差分ビュー（追加/削除/担当変更/不変件数 + メトリクス差分）
- [ ] CSV エクスポート（Blocks/Duties; UTF-8, LF, ヘッダあり）

## 7. 仕上げ
- [ ] 主要ユースケースの手動チェックシート作成
- [ ] 軽量E2E（任意; Playwright）
- [ ] ドキュメント整備（`readme.md`, `docs/README_JA.md`, 本チェックリスト）

---

## 付録: 生成コンポーネント最小セット（shadcn/ui）
- `button`, `input`, `select`, `dialog`, `drawer` or `sheet`, `tabs`, `tooltip`, `badge`, `card`, `alert`, `table`, `toaster`

---

## 追加: 合意に基づくタスク（2025-10-06）

- [x] Block候補の達成目標（70〜80%）をMVP基準として明記（READMEに反映済み）
- [ ] Block達成度のUI表示（対象service日のTripに対する候補提示率を表示）
- [ ] Dutyルールに「中拘束」「交代地点制約」を追加（警告/可視化）
- [ ] CSVスキーマ最終確認（READMEのMVP案に準拠：`driver_id` 採用）
- [ ] 任意GTFS ZIPの読込/再読込（サンプル: `GTFS-JP(gunmachuo).zip`）
- [ ] マップタイル既定を MapLibre + OSM に固定（後から差し替え可能に）
