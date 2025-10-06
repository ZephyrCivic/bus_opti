<!--
  docs/specs/duty-editing.md
  どこ: docs/specs/
  なに: Duty（乗務）編集のMVP仕様ドラフト。データ定義/操作/UI/Undo/警告ルールを一か所に集約。
  なぜ: READMEとDECISIONSに散在する前提を、実装前に合意形成できる粒度で明文化するため。
-->

# Duty（乗務）編集 仕様ドラフト（MVP）

対象スコープは「GTFSを読み込み→GreedyでBlocksを推定→Dutyセグメントを手で切る→CSVで出す」まで。複数ユーザー/サーバー同期/自動最適化は範囲外。

## 用語と前提
- Block: 連結可能なTrips列（`block_id`は本アプリが採番）。
- Duty: ある乗務員に割り当てる連続した運転区間の集合。MVPではドライバー割当は任意（`driver_id`は空でも良い）。
- セグメント（Segment）: Block内の連続するTrip群の区切り（Dutyの構成要素）。境界はTrip境界に限る（Trip途中不可）。
- サービス日: GTFSの0時起点。`service_day_index`で同日内の編集に限定（跨日DutyはMVP外）。
- 交代地点制約（relief-point constraint）: 交代は原則、停留所でのみ可能。MVPでは警告表示のみ（強制不可）。
- 中拘束（mid-duty break）: 途中の待機/休憩が長すぎ/短すぎ等の状況。MVPでは警告表示のみ（強制不可）。

参考: README・DECISIONSのCSVスキーマ定義と整合（Blocks/Dutiesの列名）。

## データモデル（CSV/I/O）
- Blocks CSV（出力）: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id`
- Duties CSV（出力）: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id`
  - `duty_id`: 画面での新規作成時に `DUTY_###` 形式で採番（エクスポート時点で連番再整備OK）。
  - `seq`: 同一`duty_id`内のセグメント通し番号（1..N）。
  - `segment_start_trip_id`/`segment_end_trip_id`: 境界Tripの`trip_id`。閉区間。[start..end] は同一Block内かつ順序が正。
  - `driver_id`: 任意。空可。将来の配車最適化/勤怠連携の拡張余地。

内部状態（UI上）
- 編集セッションはメモリ常駐。明示保存（LocalStorageにJSON）とCSVエクスポートを提供。
- 既存のGTFSインポートContext（`GtfsImportProvider`）の上に `DutyEditState`（仮）を追加し、Duties配列を保持。

## 編集操作（MVP）
対象: 「セグメントの 追加 / 移動 / 削除」。Undoは直前の1段。

- 追加（Add）
  - Blockと範囲（start_trip_id, end_trip_id）を指定して新規セグメントを作成。
  - 既存セグメントと重複/交差しないこと（同Block内での非重複/整列が不変条件）。
  - 端点は必ず既存Trip境界。

- 移動（Move）
  - セグメントの境界をドラッグ/入力で前後のTrip境界までスナップ移動。
  - 移動により他セグメントと交差しないこと。衝突時は移動を拒否（トーストで理由表示）。

- 削除（Delete）
  - 選択セグメントを削除。`duty_id`自体は残す（空のDutyは後述KPIで警告対象）。

不変条件（Invariant）
- Block内のセグメントはTrip順で昇順に整列し、互いに非交差・非重複。
- セグメントは同一Block内に閉じる（越境=別仕様、MVP外）。
- 境界はTrip境界のみにスナップ（部分切りは不可）。

## Undo仕様（Undo(1)）
- 対象アクション: 追加/移動/削除 の各1操作を原子的に記録（ドラッグはMouseUpで1操作）。
- 機能: `Ctrl+Z`（Undo）/ `Ctrl+Y` or `Shift+Ctrl+Z`（Redo）はMVPではRedo無し、Undoのみ。
- スコープ: 直近1操作のみ、画面遷移/インポートや手動保存でクリア。
- 表示: トーストで「直前の操作を取り消しました」。

## UI構成（ドラフト）
画面は既存AppShell/Tabs配下に「Duties」タブを追加する想定。3ペイン構成。

1) 左ペイン（Block一覧）
- 列: `block_id` / Trip数 / 開始/終了時刻 / サービス（任意）/ギャップ最大
- フィルタ: サービスID / 日付 / 文字検索
- 選択: クリックで中央に該当BlockのTripタイムラインを表示

2) 中央ペイン（Tripタイムライン + セグメント）
- 横軸: 時刻（GTFS基準、24h超は 24:xx 表記可）
- 行: 選択中Block（複数Blockの同時表示はMVP外）
- 表示: Tripをバー表示、セグメントは上段オーバーレイ（色帯）。境界はTrip境界にスナップ。
- 操作: 範囲ドラッグで追加、セグメント端のドラッグで移動、選択+Deleteで削除。
- KPIバッジ: セグメント選択時に右ペインへ詳細、中央には簡易指標（長さ/休憩）。

3) 右ペイン（インスペクタ/KPI）
- 選択セグメント: `duty_id` / Block / start/end Trip / 推定所要 / driver_id(選択可)
- KPI: 連続運転時間/休憩見込み/当日累計時間/交代回数
- 警告: 中拘束（mid-duty break）/交代地点制約（relief-point constraint）/閾値超過をバッジで表示（警告=黄色、重大=赤）。

アクセシビリティ/操作性
- キー操作: `A`追加モード、`Esc`解除、`Del`削除、`Ctrl+Z`Undo。
- スナップ: Trip境界へ磁石スナップ（±15px）

## ルール・警告（非拘束: 可視化のみ）
- 連続運転: 連続4hを超える見込みで警告（しきい値=4h）。
- 休憩: 連続運転4hごとに30m以上の休憩が無いと警告（しきい値=30m）。
- 1日上限: 同一乗務員の当日合計9h超で警告（しきい値=9h）。
- 交代地点制約（relief-point constraint）
  - セグメント境界の停留所が「交代候補」でない場合に警告。
  - 候補判定: 設定ベース（例: `営業所/Depot/車庫` 等のキーワード一致）+ 終端停留所（始点/終点）を自動候補化。
  - データ不在時は「参考」ラベルで弱い警告（UIでルール情報が未設定である旨を明示）。

注記: これらはMVPではHard制約にしない（保存/エクスポートは可能）。将来は設定でHard化可。

## エクスポート/保存
- CSVエクスポート（Blocks/Duties）: UTF-8, LF, ヘッダーあり。README/DECISIONSのスキーマと一致。
- ローカル保存: LocalStorageにJSON（キー: `dutyEditState:v1`）。Undoバッファは保存対象外。

## 境界ケース
- 日跨ぎTrip: GTFSの 24:xx フォーマットを許容。`service_day_index` で同日扱いを明示。
- 欠損データ: 対象Tripに `stop_times` 欠落があれば編集不可（ツールチップで理由）。
- 空Duty: `duty_id`が存在しセグメント無しの場合はKPIで警告。

## 非目標（MVP外）
- セグメントのBlock間移動（越境）
- 自動Duty生成/最適化、複数日・週次テンプレート
- 多人数同時編集・サーバー保存
- 地理上の距離/回送考慮（将来の拡張点）

## オープンクエスチョン（合意リクエスト）
1. 交代候補停留所の初期設定は「終端+キーワード一致（営業所/Depot/車庫）」で良いか。追加したいキーワードは？
2. `driver_id` はMVPで任意のままで良いか。選択肢の供給元（固定リスト/CSV/手入力）をどれにするか。
3. Undo(1)のスコープは「直前1操作のみ」で十分か。Redoは不要か。
4. 警告しきい値（連続4h/休憩30m/1日9h）を既定値としてよいか。設定UIはMVPに含めるか。
5. エクスポートの命名（`DUTY_###`）と連番再整備のタイミング（エクスポート時）で問題ないか。
6. 同Block内で複数Dutyを許容（セグメント群が複数`duty_id`に分かれる）で良いか、あるいはBlock=1Dutyを原則とするか。

---

補足: `中拘束 (mid-duty break)` と `交代地点制約 (relief-point constraint)` の表記を併記しています。テストは英語側の語にも反応するようにします。
