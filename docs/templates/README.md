# Step1 用 CSV テンプレート集（運用最小）

目的: Step1 で必要な最小 CSV をすぐ用意できるよう、ひな形と書式の注意点をまとめます。すべて日本語ドキュメント優先、仕様名の英語は列名のみ使用します。

## ファイル一覧

- drivers.template.csv
- vehicle_types.template.csv
- vehicles.template.csv
- labor_rules.template.csv（Step1では未使用。将来のための雛形）
- blocks_meta.template.csv（Step1専用: 行路の「記録のみ」メタ用）

## 書式と Excel の注意

- 文字コード: UTF-8（BOM付き推奨）。Excel で文字化けする場合は「UTF-8 (BOM)」で保存してください。
- 区切り: カンマ（,）。セル内にカンマを含める場合はダブルクオートで囲みます。
- 改行: LF/CRLF いずれも可。Excel で編集する際は 1 行目ヘッダがずれないよう注意してください。
- 日付/時刻: 文字列として扱います。Excel の自動変換に注意してください。
- 空欄: Step1 では空欄を許容します（記録のみ、検証なし）。

### Excel での保存オプション（TSV/BOM）

- **推奨:** CSV のまま保存する場合は必ず「UTF-8 (BOM)」を選択してください（Excel で［名前を付けて保存］→［CSV UTF-8 (コンマ区切り)］）。
- **TSV 運用:** Excel の仕様上 UTF-8 CSV が扱えない環境では、一度「Unicode テキスト（*.txt）」で保存し、拡張子を `.tsv` に変更してインポートする方法もあります（現在はドキュメント手順のみ、Step2 でUIオプション追加予定）。
- **再読み込み時:** TSV で運用する場合は `plans.md` に記載の手順で `docs/templates` 内サンプルを基準にCSVへ戻した上で読み込んでください。

## 使い方（5分）

1. 本フォルダの `*.template.csv` をコピーして、拡張子を `.csv` のまま編集します。
2. `drivers.csv` / `vehicle_types.csv` / `vehicles.csv` を下記サンプルを参考に最小構成で作成します。
3. 画面の「GTFS・保存データ取込」で `gtfs.zip` と併せて読み込みます（不足があっても作業は継続可能）。
4. 手動入力（Manual > Vehicle Catalog）では「1行=1台」のグリッドで台帳を編集します。`vehicle_type` を既存タイプから選択するか、新しい ID を直接入力すると暫定タイプが自動登録されます。
5. 行路編集で未割当便をタイムラインへドラッグし、新しい行路カードを作成します。既存ブロックの連結は From/To 選択で行い、必要な回送/休憩は右クリックから挿入します。勤務編集では必要に応じて `driver_id` / `vehicle_type` / `vehicle_id` を入力します（未入力でも続行可）。
5. 出力時は `duties.csv` と `blocks_meta.csv`（Step1 専用）をエクスポートできます。

各ステップでスクリーンショットを取得し、plans.md の「5分で体験」節に追記予定の枠に貼り付ける想定です（撮影は後日対応）。

## 列仕様と最小サンプル

### drivers.csv（運転士）

必須列: `driver_id`  
任意列: `name`

```csv
driver_id,name
D001,山田
D002,佐藤
```

### vehicle_types.csv（車両タイプ）

必須列: `type_id`  
任意列: `name`, `wheelchair_accessible`, `low_floor`, `capacity_seated`, `capacity_total`, `tags`

```csv
type_id,name,wheelchair_accessible,low_floor,capacity_seated,capacity_total,tags
LARGE,大型,1,1,45,70,"高速;ノンステップ"
SMALL,小型,0,0,22,40,支線
```

### vehicles.csv（車両台帳）

必須列: `vehicle_id`, `vehicle_type`  
任意列: `depot_id`, `seats`, `wheelchair_accessible`, `low_floor`, `notes`

```csv
vehicle_id,vehicle_type,depot_id,seats,wheelchair_accessible,low_floor,notes
BUS_001,LARGE,DEPOT_A,45,1,1,予備車両
BUS_002,SMALL,DEPOT_B,22,0,0,
```

### labor_rules.csv（労務ルール雛形: Step1 未使用）

Step1 では読み込んでも計算に使いません。将来のために雛形だけ提供します。

```csv
rule_id,label,value,unit,notes
MAX_CONTINUOUS_MIN,連続稼働上限,300,minutes,Step1では未使用
MIN_BREAK_MIN,最低休憩時間,45,minutes,Step1では未使用
MAX_DAILY_MIN,1日上限,600,minutes,Step1では未使用
```

### blocks_meta.csv（Step1 専用: 行路の「記録のみ」メタ）

- 目的: 行路 ID ごとに「想定車両タイプ」「車両 ID」を記録だけ行う（検証や自動割付は実施しません）。
- 列: `block_id`, `vehicle_type_id`, `vehicle_id`（すべて空欄可）

```csv
block_id,vehicle_type_id,vehicle_id
BLOCK_001,M,BUS_001
BLOCK_002,,BUS_002
BLOCK_003,L,
```

## 往復（インポート/エクスポート）手順

1. 上記 CSV をインポート → 行路/勤務で編集 → 保存。
2. エクスポートで `duties.csv` と `blocks_meta.csv` を出力。
3. 出力した CSV を再インポートし、UI に反映されることを確認（Step1 では「記録のみ」で計算は行いません）。

---

補足: Excel での保存が不安定な環境では、TSV（タブ区切り）運用も検討できます（Step2 以降で正式対応予定）。
