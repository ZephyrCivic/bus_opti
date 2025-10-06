# 仕様確定事項（2025-10-06）

本ドキュメントは 2025-10-06 に合意したMVPの確定事項をまとめた補遺です。既存の `readme.md` と `docs/README_JA.md` を補完します。

- Block候補達成目標は「70〜80%」で据え置き（UIで達成度を表示）。
- Dutyルールの最小セットに「中拘束」「交代地点制約」を含める（警告/可視化）。
- CSVスキーマ（MVP）は以下とする（将来変更は後方互換を意識し小幅に）。
  - Blocks: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id`
  - Duties: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id`
  - 文字コード UTF-8 / 区切り , / 改行 LF / 時刻はGTFS準拠（24時超許容）
- データ/フィード: 当面は `data/GTFS-JP(gunmachuo).zip` をサンプルとして使用。ただし任意の GTFS/GTFS-JP ZIP をドラッグ&ドロップで読み込み可能とする（将来的に複数フィード切替は検討）。
- マップタイル: MVP既定は MapLibre + OSM（キー不要）。運用要件に応じて後から切り替え可能。
- 文字化け対策: `tools/encodingScanCli.ts` によりUTF-8検査を自動化し、`docs/encoding-guidelines.md` の運用ルールに従う。
