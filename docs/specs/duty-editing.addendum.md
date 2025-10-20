<!--
  docs/specs/duty-editing.addendum.md
  どこ: docs/specs/
  なに: Duty編集ドラフトへの合意反映（ユーザー回答ベース）の追補。
  なぜ: 既存ファイルの文字化けや差分最小化のため、追補として安全に合意事項を明記。
-->

# Duty編集 追補（合意反映 2025-10-06）

本追補は docs/specs/duty-editing.md を補完し、以下の合意を反映します。

## 合意事項
1. 交代候補停留所は「手動指定（マスタ管理）」とする。自動判定は行わない。
2. `driver_id` は手入力できるようにする。Duties CSVへの出力・CSVからの読み込みにも対応する。任意で `drivers.csv`（`driver_id,name`）を読み込み、候補としてサジェストに使用。
3. Undo/Redo は多段。`Ctrl+Z`（Undo）/ `Ctrl+Y` or `Shift+Ctrl+Z`（Redo）。スタック上限は既定50（設定で変更可）。
4. 警告のしきい値（連続運転・休憩・1日上限）はユーザーが数値を入力して変更できる。また将来、追加の条件（カスタム警告）をユーザーが入れられるようにする。
5. `duty_id` 命名は `DUTY_###`。連番の再整備はエクスポート時に行う。
6. 同一Block内で複数Dutyを許容。推奨は Block あたり 1〜2 Duty 程度とし、超過時はKPIで注意喚起。

## エクスポート/インポート/保存
- CSVエクスポート: Blocks/Duties（UTF-8, LF, ヘッダーあり）。
- CSVインポート: Duties（同スキーマ）を取り込み。デフォルトは「置換」。マージはオプションで選択可能。
- Driversは `drivers.csv`（`driver_id,name`）を取り込み可能。
- LocalStorage保存: `dutyEditState:v1` キーでJSON保存。Undo/Redo履歴は保存対象外。

## 設定（Settings）
- 連続運転上限（分）: 既定240（編集可）
- 休憩最小（分）: 既定30（編集可）
- 1日合計上限（分）: 既定540（編集可）
- Undo/Redoスタック上限: 既定50（編集可）
- 交代候補停留所: 手動管理（追加/削除/インポート）

## UI追補
- 右ペインにドライバー入力欄を追加（フリーテキスト + Driversマスタサジェスト）。
- 設定ダイアログ（Settings）を追加し、上記しきい値とUndoスタック上限を編集可能にする。

## 警告の扱い（保存可）
- driver_idがDriversマスタに未登録の場合など、該当するケースでは「弱い警告（情報）」を表示する。
- 警告があっても保存・エクスポートは可能（ブロッキングしない）。

## 注意喚起のしきい値（Block内Duty数）
- 同一Block内のDuty数が2を超える場合（>2）に注意喚起を表示する。
- 閾値は設定で変更可能（既定=2）。
## 実装状況 (2025-10-06)
- Dutiesビュー (`src/features/duties/DutiesView.tsx`) 右ペインで Duty KPI（連続運転/拘束/最短休憩）と警告を表示。
 - Dutiesビュー (`src/features/duties/DutiesView.tsx`) を追加し、3ペイン構成で Add/Move/Delete/Undo を提供。Block選択・Trip範囲選択・Inspector概要を備える。
- Duty状態遷移は `src/services/duty/dutyState.ts` に集約。`add/move/delete/undo` の各関数で重複検知とBlock整合性を検証する。
- Tripの順序検証は Block CSV (`BlockPlan.csvRows`) から生成したインデックスを `buildTripIndexFromPlan` / `buildTripIndexFromCsv` で共有。
- Undoは最新1件のみ（`settings.undoStackLimit` 初期値50）。実行後はスナップショットを破棄し二重Undoを抑止。
- `GtfsImportProvider` が `dutyActions` を公開し、GTFSの再読込やリセット時に Duty状態も初期化する。
- Duty/Segment IDは `DUTY_###` / `SEG_###` フォーマットで採番し、CSVエクスポート・UI双方で再利用する前提。
> この追補は参考（Reference）です。BlockIDなし前提の最新要件は
> `docs/specs/requirements-blocks-duties.addendum.blockless.md` を参照してください。
