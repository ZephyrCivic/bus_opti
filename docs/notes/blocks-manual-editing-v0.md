# blocks-manual-editing-v0.md

## 概要
- 行路（Block）の手動編集UIを検証OFFモードで再構成。
- 便の右クリックから休憩・回送を前後に挿入、便ドラッグで分離→結合。
- 地図モーダルで route_id ごとの形状を確認できる。
- 休憩・回送の区間は locks_intervals.csv に書き出し、note 列で補足情報を残せる。

## 新しい操作
- **右クリック（便）**: 「前に休憩」「後に休憩」「前に回送」「後に回送」「この便から分離」「この便のルートを地図で表示」
- **右クリック（レーン余白）**: その位置に休憩/回送（10分）を挿入。
- **ドラッグ&ドロップ**:
  - 便 → 別レーン: splitBlock → connectBlocksPlan を検証OFFで実行。
  - 行路ラベル → 別レーン: 既存の結合操作を維持。
  - 未割当テーブル → タイムライン: 新行路を即作成。
- **区間編集**: 休憩/回送はタイムライン上でドラッグ（移動）・端のドラッグ（リサイズ）対応。
- **検証OFFバナー**: 画面上部に常時表示し、整合性チェックが行われない旨を通知。

## 出力仕様の更新
`
blocks_intervals.csv
  - block_id
  - anchor_trip_id
  - position (before|after|absolute)
  - kind (break|deadhead)
  - start_time (HH:MM)
  - end_time (HH:MM)
  - note
`
- nchor_trip_id / position は便に紐づく区間で利用。レーン余白挿入は position=absolute。
- start_time / end_time は UI 上の分単位から HH:MM に変換して出力。

## テストと検証
- 
pm run test -- --bail で手動結合ロジックをカバー（検証OFF時の結合を追加テスト）。
- スナップショットは今回スキップ（指示による）。
- DevTools チェック: 
pm run devtools:landing-hero で Playwright 側の見た目を確認可能。

## 注意点
- 検証OFFによりサービス日・時刻の矛盾が残る可能性があるため、バナーで注意喚起。
- 将来的に validationMode を strict に戻すため、manualPlanConfig の切り替え余地は残してある。
- shapes.txt が無い場合は stops を直線補間して地図表示する。