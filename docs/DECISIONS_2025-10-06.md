# 仕様確定事項(2025-10-06)

本ドキュメントは 2025-10-06 に合意したMVPの確定事項をまとめた補遺です。`readme.md`（単一README）を補完します。

- Block候補達成目標は「70〜80%」で据え置き(UIで達成度を表示)。
- Dutyルールの最小セットに「中拘束（mid-duty break）」「交代地点制約（relief-point constraint）」を含める(警告/可視化)。
- CSVスキーマ(MVP)は以下とする(将来変更は後方互換を意識し小幅に)。
- Blocks: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id, generated_at, settings_hash`
- Duties: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id, generated_at, settings_hash`
  - 文字コード UTF-8 / 区切り , / 改行 LF / 時刻はGTFS準拠(24時超許容)
- frequencies.txt は parse 時に静的便へ展開（`trip_id#n` を採番）。`exact_times`=0/1 を問わず headway を時刻へ展開し、Block/Duty 処理の前段で組み込む。
- データ/フィード: 当面は `data/GTFS-JP(gunmachuo).zip` をサンプルとして使用。ただし任意の GTFS/GTFS-JP ZIP をドラッグ&ドロップで読み込み可能とする(将来的に複数フィード切替は検討)。
- マップタイル: MVP既定は MapLibre + OSM(キー不要)。運用要件に応じて後から切り替え可能。
- 文字化け対策: `tools/encodingScanCli.ts` によりUTF-8検査を自動化し、`docs/encoding-guidelines.md` の運用ルールに従う。

## ブロック差し替え方針（直列 vs 迂回）

- 目的: 既存Blockの一部を置き換える際の判断基準を定義し、Duty編集で意図しないギャップや二重割当を防ぐ。
- 直列差し替え（推奨デフォルト）
  - 同一`block_id`内で Trip 順序を保ったまま、区間を等価な別Trip列に入れ替える。
  - 判定基準:
    1. 置換候補の start/end Trip が既存Blockの連続範囲に収まっている。
    2. 新旧の所要時間差が `DEFAULT_MAX_TURN_GAP_MINUTES`（config.pyに準拠）以内。
    3. Duty 側のセグメント連続性（序数・driver割当）を維持できる。
  - 手順: BlocksViewで該当Blockを選択 → `selectionErrorToMessage`で警告がないことを確認 → Dutyでセグメントを再生成。
- 迂回差し替え（例外的運用）
  - 元Blockでは時間ギャップや折り返し距離が許容外となるケースに用いる。新しいBlockを生成し、元Blockは保守用として残す。
  - 判定基準:
    1. 連続Tripであっても gap が `manual.linking.maxConnectRadiusM`／`minTurnaroundMin` を超える。
    2. Relief Point 要件を満たすため、途中停留所を追加で挟む必要がある。
    3. Duty KPI（`computeDutyMetrics`）で連続運転/休憩警告を解消できる見込みがある。
  - 手順: BlocksViewで新Block生成 → Dutyでは旧セグメントを削除し、新Blockのセグメントを追加 → DiffViewで差分を確認し、ExportBarからCSVを更新。
- ドキュメント/監査: 差し替えを行った場合、`docs/diff-baselines/` にスナップショットを保存し、副作用（driver再配置やdeadhead影響）をコメントで残すこと。
- 履歴管理: Diffビューでは基準保存時にローカル履歴（最大10件）へ記録し、指標サマリとアラートを保持する。履歴から即時適用／再ダウンロードが可能で、レビュー時の比較効率を高める。

## Duty生成タイミング再評価（Nextリリース向け）

- 現状課題
  - GTFS再取込やBlock差し替え時に Duty が初期化されるため、操作者の手作業再編成が都度発生。Undo履歴も消える。
  - Manualタブでドライバー・回送設定を更新しても自動連動せず、Duty KPI の警告解消が遅延する。
  - 勤務案作成フェーズによって「最初にどこまで自動生成し、どこから手動調整するか」の境界が不明確。
- 再評価ゴール: 「GTFS→Block→Duty」各段を分離しつつ、Duty生成のトリガー／再生成範囲を明示して再作業コストを最小化する。
- アプローチ候補
  1. **段階的再生成（push-on-edit）**  
     - Blockが差し替えられた区間のみ Duty を再計算し、手動編集済みセグメントは保護。  
     - 差し替え対象を `diffSchedules` と Dutyセグメントのクロス参照で抽出。
  2. **初期テンプレート生成（pull-on-import）**  
     - GTFS取込直後に基準となる Duty テンプレートを自動生成。ユーザーは以降テンプレートとの差分編集を行う。  
     - KPI警告を満たす範囲（連続運転≦設定値、休憩≥設定値）で greedy にセグメント化。
  3. **ドライバー割当連動**  
     - Manualドライバー更新時に、未割当Dutyへ候補を自動提案。  
     - Duty計算の再生成と同時に `computeDutyMetrics` を再評価し、警告を即時反映。
- リリース判断
  - Nextリリースでは「段階的再生成」を最優先に実装し、他2案はProof of Conceptで効果とUX影響を検証した上で採用可否を決定する。
  - 実装に先立ち、`DutyEditState` のセグメントに「ソース種別（自動/手動）」フラグを追加し、再生成の対象外セグメントを明示する。

## Driversデータ品質ポリシー

- 目的: Duty 割当やCSV入出力時にドライバーデータの一貫性と監査性を担保する。
- IDフォーマット
  - `driver_id` は `DRV_###`（3桁以上のゼロパディング）を既定とする。例: `DRV_001`, `DRV_1203`。
  - 手動入力や CSV インポート時は英数字とアンダースコアのみ許可。UI インスペクタでフォーマット違反を警告表示。
- ダミードライバーの扱い
  - ダミー行は `DRV_DUMMY_*` 接頭辞を使用し、Dashboard で未割当扱いと区別できるようアラートを出す。
  - ダミーの利用は「ドラフト段階のみ」とし、履歴カードにフラグを残す（Diff履歴にダミーIDが含まれる場合は黄色警告）。
- 一意性／重複検知
  - Drivers CSV インポートでは重複 ID をハードエラーとし、`manualCsv` ユーティリティで検証済み。
  - Manualタブで追加する際も既存IDが存在する場合は保存不可。
- メタデータ
  - `drivers.csv` には最低限 `driver_id,name` を含め、任意で `availability` や `notes` 列を追加しても無視されず保持する。
  - 将来の勤怠連携に備え、社内ID（例: `employee_id`）をオプション列として許可する。
- 監査
  - Diff履歴と KPI レポートにはドライバー割当の変動を残す。ダミー/実ドライバーの比率は週次レビューで確認し、ダミー超過時は改善アクションを記録する。

## 全体KPIポリシー（指標・アラート・レビュー体制）

- 目的: 勤務案の品質を定量的に評価し、改善サイクルを回すための指標群と運用ルールを統一する。
- 指標カテゴリ
  1. **稼働カバレッジ**: 総シフト数 / 目標シフト数、未割当Duty件数、欠員率。
  2. **労務健全性**: 連続運転時間（最大値・平均）、休憩確保率（30分以上の休憩を含むDuty比率）、日拘束時間の95パーセンタイル。
  3. **公平性**: ドライバーごとの総拘束時間標準偏差、夜勤回数の分散、連続早番/遅番の上限超過カウント。
  4. **安全警告**: `computeDutyMetrics` 由来の警告件数（連続運転・休憩不足・日拘束超過）と relief-point 違反件数。
- アラート閾値
  - カバレッジ < 95%、未割当Duty > 0 → 黄色警告、レビュー前に改善必須。
  - 連続運転 > `config.py` の既定値 +15分、または休憩不足率 > 5% → 赤警告、出庫前承認不可。
  - 公平性指標（標準偏差）が 10%以上 → 黄色警告、次スプリントで是正計画を提出。
- レビュー体制
  - **デイリースタンドアップ**: KPIダッシュボード（Dashboardタブ）を共有し、警告件数と改善プランを確認。
  - **週次レビュー**: DiffView と KPIスナップショットを `docs/diff-baselines/` に保存し、アラート履歴を追跡。
  - **承認フロー**: 赤警告が残存する案は運行管理者承認不可。黄色警告はレビューコメントに改善日時を明記。
- 将来拡張
  - アラート設定値は `config.py` と UI設定モーダルで編集可能にする。
  - KPI履歴を JSON でエクスポートし、BI連携や社内レビュー資料へ転用する。

## KPI閾値設定モーダル（設計方針）

- 目的: 運用チームが `config.py` を直接触らずに KPI 閾値を調整できるようにし、Dashboard/Duty 警告と即時連動させる。
- ソース・同期
  - 既定値は `config.py` に保持（`DUTY_MAX_CONTINUOUS_MINUTES` など現行定数を `KPI_THRESHOLDS` に再編）。
  - `DutySettings`／`DutyEditState.settings` に KPI 閾値を追加し、LocalStorage 永続化 (`dutyEditState:v1`) に含める。
- UI
  - Dashboard タブ右上に「KPI設定」ボタンを追加し、モーダルで下記フィールドを編集：連続運転上限、休憩下限、日拘束上限、未割当許容率、夜勤分散しきい値。
  - 数値は分単位またはパーセントで入力し、変更即時に Duty タブへ反映（`useGtfsImport` 経由で settings 更新）。
- バリデーションと適用
  - 入力範囲: 分は 0〜1440、率は 0〜100。異常値はトーストで警告し、保存不可。
  - 保存時に `computeDutyMetrics` と Dashboard KPI を再計算し、赤/黄アラートを再判定。
  - 設定リセットボタンで config 既定値へ戻せるようにする。
- QA/テスト
  - `tests/duty.settings.modal.test.tsx`（新設予定）でUI操作と settings 更新をスナップショット＋ロジックで検証。
  - `tests/dashboard.kpi-thresholds.test.ts`（新設予定）で Dashboard KPI が閾値変更を反映することを確認。

## UI 改善候補メモ（2025-10-09）
- BlocksView: タイムラインの `pixelsPerMinute` を設定可能な UI 追加を検討（将来のユーザー調査項目）。
- DutiesView: 区間操作にショートカットキーを提示するツールチップを追加予定。
- ManualDataView: CSV インポート結果の差分表示（プレビュー）を次フェーズ候補として整理。
