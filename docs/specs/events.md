# 内部イベントモデル仕様（events）— Step1

目的
- UI同期・警告生成・指標計算の共通基盤となるイベント表の最小仕様を定義する。

スキーマ（論理）
- event_id: string（必須）
- event_type: enum（revenue|deadhead|pull-out|pull-in|break|inspection|standby）
- start_time: string（HH:MM:SS、GTFS拡張で24:00以降可）
- end_time: string（HH:MM:SS、GTFS拡張）
- trip_id: string|null
- block_id: string|null
- vehicle_id: string|null
- driver_id: string|null
- depot_id: string|null
- relief_point_id: string|null
- violation_flags: string[]（例: ["hard:rest_short","soft:long_block"]）
- geometry: GeoJSON LineString|null（任意）

整合制約
- end_time >= start_time（拡張時間込み）
- event_type=break のとき driver_id 必須
- pull-out/pull-in は depot_id を要求
- deadhead は trip_id=null を原則（距離/時間はgeometryまたは時刻差）

計算順序（警告）
1) 連続運転・休憩の判定は driver_id 時系列で評価
2) 折返し最小時間は vehicle_id の連続便境界で評価
3) 資格/所属は driver_id×route/vehicle の適合で評価

入出力
- 入力は GTFS+UI編集結果からイベントへ正規化
- 出力は警告要約/指標計算へ供給

DoD
- イベント生成が決定論的（同入力→同イベント）
- 単体テスト: 代表的ケースでviolation_flagsが期待どおり
