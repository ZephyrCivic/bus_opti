# 識別子移行方針（employee_id → driver_id）— Step1

方針
- 正: driver_id を正とする。UI/CSV/内部モデルで統一。
- 互換: 当面は employee_id を読み取り時に driver_id へエイリアス変換（出力は driver_id のみ）。
- 廃止: vX.Y で employee_id 入力を非推奨に、vX+1 で廃止予定。

CSV互換
- duties.csv: `duty_id, driver_id, block_id, start_time, end_time`
- 互換読み込み: 列名 employee_id が存在すれば driver_id にマップ。

テスト
- 旧CSV（employee_id）→インポート→エクスポートで driver_id に統一される。
