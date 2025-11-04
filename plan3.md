# plan3: 行路編集 v0（検証OFF・右クリック挿入・便D&D・地図モーダル）

## 全体像
行路（Block）編集に特化した最小UIを提供する。検証（サービス日/時刻整合）は当面OFFで、操作自由度を優先。便右クリックで休憩/回送を「前/後」に挿入し、便ドラッグ＆ドロップで「分離→結合」を無条件で実行する。便から route を辿って地図モーダルで表示。区間は blocks_intervals.csv に保存し note 列を持たせる。

## 進捗状況
- [x] ナビ最小化（Import/行路のみ表示）
- [x] BlocksView: 便の右クリックメニュー拡張（前/後 休憩・回送、地図表示）
- [x] 便D&D（分離→結合、検証OFF）
- [x] intervals エクスポート（blocks_intervals.csv: note 列対応）
- [x] 地図モーダル（route_id フィルタ、shapes 無しは stops 補間）
- [x] 画面上部の「検証OFF」バナーと簡易警告カウンタ表示
- [-] スナップショット検証（make generate-snapshots、閾値≤0.5%）（スキップ：指示により未実施）
- [x] 単体テスト追加（connect/split 検証OFF、intervals 出力）
- [x] ドキュメント更新（README/spec、操作ガイド、CSV 仕様）

## 発見と驚き
- v0 では検証OFFでも CSV 出力を許容する運用が妥当（合意済）。
- MapLibre 実装は既存 Explorer を流用でき、導線をモーダルに限定すれば実装コストが低い。

## 決定ログ
- 2025-11-04: 休憩デフォルト10分。右クリックで前後に挿入。検証OFFでも出力許可。
- 2025-11-04: blocks_intervals.csv を新設。列= block_id, anchor_trip_id, position(before|after|absolute), kind(break|deadhead), start_time, end_time, note。
- 2025-11-04: 地図はモーダル表示（最適）。便→route_id でフィルタ表示。

## To-Do（段階PR）
1. ナビゲーション最小化（Import/Blocks のみ） ✅
2. BlocksView 右クリックメニュー拡張（前/後 休憩/回送、地図表示） ✅
3. DragBus を用いた便D&D（分離→結合、検証OFF） ✅
4. blocks_intervals.csv エクスポート実装（note 対応、時間は UI 値をそのまま保存） ✅
5. 地図モーダル組込み（route_id フィルタ、shapes 無は stops 直線補間） ✅
6. 画面上部に「検証OFF」バナー＋簡易警告（非ブロッキング） ✅
7. スナップショット: npm run build → make generate-snapshots（SNAP_DIFF_THRESHOLD=0.5 を確認）（スキップ）
8. テスト: manualPlan 検証OFFの結合/分離、intervals CSV 出力
9. Docs: specs と README 更新（操作・CSV 仕様・検証OFF注意）

## Test & Logs（運用）
- 既定フローで UI スナップショット実行。失敗時は tmp/ui-snapshots/fallback-*.md のログパスを本ファイルまたは plans.md に追記。
- Chrome DevTools 検証: npm run devtools:landing-hero 実行・画像確認。

---

## 承認事項（レビューゲート）
- 仕様A（CSVスキーマ）: blocks_intervals.csv の最終列構成（必須列＋note）
- 仕様B（検証モード）: 既定は validation=OFF、バナー表示。将来ON切替のトグルはコードに残す。
- UI: 便右クリックメニュー（前/後 休憩・回送／分離／ルート地図）とモーダル表示。
- ロールアウト: 段階PRで統制し、各段階でスナップショットまたはビルド確認をゲートにする。

## 受け入れ基準（DoD）
- 便右クリックから前後に休憩/回送を追加でき、ドラッグで長さを変更できる。
- 便D&Dで「分離→結合」が1操作で完了し、CSV保存まで含めて失敗しない。
- blocks_intervals.csv の各行が UI の内容と一致し、時刻は HH:MM として書き出される。
- 地図モーダルに当該 route が表示される（shapes 無しは stops 直線補間）。
- スナップショット差分 ≤ 0.5%、主要テストがグリーン。

## リスクと緩和
- 無検証による不整合: バナーと簡易警告で可視化し、将来ON切替で解消可能にする。
- BlocksView の巨大化: 段階PRと小コンポーネント分割で影響範囲を抑制。
- shapes 不在: stops 補間をフォールバックとして用意。

## 実行コマンド（抜粋）
- ビルド: `npm run build`
- スナップショット: `make generate-snapshots`
- DevTools検証: `npm run devtools:landing-hero`

