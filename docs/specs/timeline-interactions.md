<!--
  docs/specs/timeline-interactions.md
  場所: docs/specs/
  目的: ガントUI操作強化（D&D/リサイズ/ズーム/キーボード操作）の要件と実装方針を整理する。
  背景: TODO「ガントUIの操作強化（D&D/リサイズ/ズーム）」に着手する前段として、影響範囲とスナップ要件を明文化する。
-->

# Timeline インタラクション拡張 設計メモ（2025-10-08）

## 背景とゴール
- 現状の `TimelineGantt` は静的描画のみで、Duty 編集のマウス操作ができない。
- DoD では以下を満たす必要がある:
  1. セグメント矩形をドラッグして開始/終了 Trip にスナップさせる。
  2. Shift + ホイールで水平ズーム、Alt + ホイールで水平パン。
  3. キーボードで前後の Trip へフォーカス移動。
- Blocks/Duties 共通コンポーネントとして機能を追加し、`DutiesView` で Duty 編集、`BlocksView` でブロック操作へ波及させる。

## ユースケース
1. **Duty セグメントの移動**  
   - ユーザーが Duty セグメントをクリック＆ドラッグすると、Trip 境界に沿って前後へ移動。  
   - 終了位置がブロック最終 Trip を超える場合は制限する。  
   - ドラッグ中は影（preview）を表示し、放した時点で `dutyActions.moveSegment` を呼び出す。
2. **Duty セグメントのリサイズ**  
   - 矩形左右にハンドルを表示し、ドラッグで開始/終了 Trip を変更。  
   - Trip 選択は `tripSelection` ユーティリティを再利用し、エラー時はトーストを表示。
3. **タイムラインズーム/パン**  
   - Shift + ホイール: `pixelsPerMinute` を 0.5〜2.0 倍の範囲で変動。  
   - Alt + ホイール: `bounds.startMinutes`/`endMinutes` をオフセットさせ、軸レンダリングに反映。  
   - UI 上は `TimelineControls`（新規）で現在のズーム倍率を表示。
4. **キーボードナビゲーション**  
   - 左右矢印キーで選択中セグメントの開始/終了 Trip を一つずつ前後に移動。  
   - Home/End で同一 Duty 内の最初/最後の Trip へ移動。  
   - フォーカス管理は `useTimelineSelection` フック（新設）で集約。

## コンポーネント設計
- `TimelineGantt` をプレゼンテーショナルに保ち、イベント通知は props 経由で外部ハンドラへ渡す。
- 新規コンポーネント/フック案:
  - `useTimelineInteractions`: ズーム/パン、ドラッグ状態、キーボード処理を担当。
  - `TimelineSegmentHandle`: 左右ハンドルを描画し、リサイズイベントを発火。
  - `TimelineCursorOverlay`: ドラッグ中の位置やスナップ先 Trip を表示。
- Duties 側では `useDutySegmentEditor`（既存?）に統合し、`dutyActions.moveDutySegment` 等を呼び出す。

## データ・スナップ仕様
- スナップ対象はブロック Trip 境界 (`plan.csvRows`) と Duty セグメント自体の `startTripId`/`endTripId`。
- 1 Trip ＝ `startMinutes`→`endMinutes`（`enrichDutySegments`）を利用。
- ドラッグ中は最も近い Trip の境界（または2分の1を閾値）へ移動。 閾値案: 12px。
- リサイズ時は開始 < 終了を強制し、重複やギャップは `ensureNoOverlap` で最終確認。

## テスト戦略
1. **ユニットテスト**  
   - `tests/timeline.interactions.test.tsx`（新設）でドラッグ→スナップ計算、ズーム倍率変更、キーボード移動のロジックを検証。  
   - `tests/duty.timeline.interactions.test.tsx` で Duty Actions との統合をモックし、呼び出しを確認。
2. **スナップショット/ビジュアル**  
   - Chrome DevTools CLI でガント拡張 UI のスクリーンショットを取得（DoD に合わせて更新）。  
   - Shift/Alt 操作は録画ではなくログ出力で追跡。
3. **E2E シナリオ**  
   - 将来的に Playwright で DnD を再現するスクリプトを追加（バックログ）。

## 実装ステップ案
1. 設計メモ（本書）と `tests/timeline.interactions.design.test.ts` 追加。  
2. `TimelineGantt` にインタラクション API（props とイベント）を拡張。  
3. Duty/Blocks 向けに `useTimelineInteractions` を実装し、ズーム/パン状態を管理。  
4. DnD/リサイズロジックを追加し、`tripSelection` と `dutyActions` に接続。  
5. テスト・ドキュメント更新、TODO チェック。

## リスク・課題
- SVG 内ドラッグはマウス/タッチ互換が必要 → pointer events を採用し、タッチは後続対応。  
- 描画と状態管理の分離が複雑化 → hooks・context で責務を明確化する。  
- 大量 Duty 時のパフォーマンス → 既存幅計算 + 仮想化要否を検討。  
- 操作ログと Undo/Redo 影響 → Duty actions の履歴が正しく積まれるようテストを追加。

## 関連ドキュメント
- `docs/specs/diff-export-rollout.md`（ロールアウトでの操作トレーニングに引用予定）  
- `docs/specs/duty-editing.md`（Duty 編集フローと整合性確認）  
- `docs/TODO.md`
