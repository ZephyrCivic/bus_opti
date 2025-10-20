<!--
  docs/specs/timeline-interactions.md
  目的: タイムライン上の操作（D&D/ズーム/キーボード/履歴）の仕様を定義。
-->

# Timeline インタラクション仕様（2025-10-08）

## 背景とゴール
- Blocks/Dutiesの編集はTimeline中心。視認性と操作一貫性が重要。
- ゴール: 誰が触っても同じ結果（決定論）と、十分なパフォーマンス/アクセシビリティ。

## インタラクション
1) ドラッグ&ドロップ（D&D）
- Blocks: 端点連結/解除/並び替え。
- Duties: 未割当→Driverへ割付、Driver間の移動、解除で未割当へ戻す。
- プレビュー: ドラッグ中は影表示、確定で差分ハイライト。

2) ズーム/パン
- Shift + ホイール = ズーム（`pixelsPerMinute` を 0.5–2.0の範囲）。
- Alt + ホイール = パン（`bounds.startMinutes/endMinutes` を平行移動）。
- 画面コントロール: TimelineControls（ズームプリセット/範囲リセット）。

3) キーボード
- 矢印キー = 選択移動。Home/End = 最初/最後のTripへ。
- Enter = 候補確定/割付確定。Esc = キャンセル/ダイアログ閉じ。
- フォーカス管理: `useTimelineSelection` で一意に保持。

4) Undo/Redo
- 対象: Blocks（連結/解除/並び替え）、Duties（割付/解除/移動）、Settingsドラフト（適用前）。
- 非対象: CSVインポート、適用済み設定。
- 深さ: セッション単位で最低10段。

5) data-testid（例）
- blocks.connect.suggested-item / blocks.action.undo / blocks.action.redo
- duties.unassigned.list / duties.action.assign / duties.action.undo
- settings.input.min_turnaround / settings.action.apply.draft

## 非機能
- 編集反映200ms以内。ズーム/パン1s以内。A11y対応（キーボード/ARIA/コントラスト）。

## DoD
- D&D/ズーム/キーボード/Undo-Redoが上記仕様どおり再現。
- E2E最小シナリオ:
  1) 連結→解除→Redoで連結に戻る。
  2) 未割当→Driver割付→Undoで未割当へ戻る。
  3) 設定ドラフト変更→Undo→Redo（適用前）。

## 参照
- docs/specs/block-ui-redesign.md
- docs/specs/non-functional.md
- docs/specs/settings-ui.md

---

# Timeline インタラクション拡張 設計メモ（2025-10-08）

## 背景とゴール
- Blocks/Dutiesの編集はTimeline中心。視認性と操作一貫性が重要。
- ゴール: 誰が触っても同じ結果（決定論）と、十分なパフォーマンス/アクセシビリティ。
- DoD では以下を満たす。

## インタラクション
1) ドラッグ&ドロップ（D&D）
- Blocks: 端点連結/解除/並び替え。
- Duties: 未割当→Driverへ割付、Driver間の移動、解除で未割当へ戻す。
- プレビュー: ドラッグ中は影表示、確定で差分ハイライト。

2) ズーム/パン
- Shift + ホイール = ズーム（`pixelsPerMinute` を 0.5–2.0の範囲）。
- Alt + ホイール = パン（`bounds.startMinutes/endMinutes` を平行移動）。
- 画面コントロール: TimelineControls（ズームプリセット/範囲リセット）。

3) キーボード
- 矢印キー = 選択移動。Home/End = 最初/最後のTripへ。
- Enter = 候補確定/割付確定。Esc = キャンセル/ダイアログ閉じ。
- フォーカス管理: `useTimelineSelection` で一意に保持。

4) Undo/Redo
- 対象: Blocks（連結/解除/並び替え）、Duties（割付/解除/移動）、Settingsドラフト（適用前）。
- 非対象: CSVインポート、適用済み設定。
- 深さ: セッション単位で最低10段。

5) data-testid（例）
- blocks.connect.suggested-item / blocks.action.undo / blocks.action.redo
- duties.unassigned.list / duties.action.assign / duties.action.undo
- settings.input.min_turnaround / settings.action.apply.draft

## コンポーネント設計
- TimelinePane / TimelineControls / SelectionOverlay を分離。
- Duty セグメントの移動をカスタムフックで抽象化。

## ユースケース
- Duty セグメントの移動/割付/解除。
- Blocks の端点連結/解除/並び替え。
- キーボードのみの編集操作（A11y対応）。

## 実装スケッチ案
- 仮想化リスト＋SVGレイヤ構成。編集時は局所再描画。

## 実装ステップ案
1) 選択とフォーカス遷移の確立（P0）
2) D&Dとキーボード操作の確定（P1）
3) 差分ハイライトと履歴の最適化（P2）

## リスク・課題
- パフォーマンスとA11yの両立。回帰はスナップショット/DevToolsで監視。

## DoD
- D&D/ズーム/キーボード/Undo-Redoが上記仕様どおり再現。
- E2E最小シナリオ:
  1) 連結→解除→Redoで連結に戻る。
  2) 未割当→Driver割付→Undoで未割当へ戻る。
  3) 設定ドラフト変更→Undo→Redo（適用前）。
