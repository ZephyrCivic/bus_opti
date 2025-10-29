% Plans2: 行路ドラッグ＆ドロップUI 完全実装計画（SSOT）

最終更新: 2025-10-28（米国時間）

この文書は、ブロック（車両行路）とDuty（乗務行路）の両方を、徹底的にドラッグ＆ドロップのみで作成・編集できるUIを完成させるための唯一の実装ガイド（SSOT）です。既存の `plans.md` と整合しつつ、本計画はUI完成までの道筋・基準・テストを明確化します。

## 用語と対象範囲
- 行路（本計画の対象）
  - Driver行路＝Duty（ドライバーの勤務シーケンス）。本計画の主対象。
  - Vehicle行路＝Block（車両の運用シーケンス）。補助タイムラインとして活用し、Duty生成のドラッグ元（ソース）にする。
- 本計画は Step2 以降（`appStep >= 2`）での Duty 編集体験を主軸に、Step1（Block計画）でのD&D強化も併走。
- 既存のタイムライン実装（`src/features/timeline/TimelineGantt.tsx`）と Duty 操作群（`useDutyTimelineControls.ts`／`useDutyCrudActions.ts`）を拡張し、外部ドラッグ、クロスレーン移動、空白ドロップでの新規作成を一貫化します。

## 成功基準（受け入れ条件・必須）
- マウス操作だけで以下が可能（キーボードは補助）。全てUndo/Redo対応。
  1) BlockタイムラインのTripをDutyタイムラインへドラッグして新規Dutyセグメントを作成できる。
  2) Block側で複数Tripを連続選択し、その範囲をDutyへドロップして一括追加できる（ゴーストプレビュー表示）。
  3) Dutyセグメントを同一Duty内で並べ替え、他Dutyへ移動、空白行（未作成Duty領域）へドロップして新規Dutyを作成できる。
  4) Dutyセグメントの左右リサイズやドラッグ移動は、GTFS Trip境界にスナップし、無効な状態（重複/逆転/最小ターンアラウンド違反等）を拒否または警告できる。
  5) Unassigned（未割当）一覧、およびBreak/DeadheadのトークンをDutyへドラッグし、適切なギャップに自動配置できる。
  6) すべてのD&D操作で視覚的なドロップ許可/不許可のフィードバック（色/カーソル/ツールチップ）と結果トースト表示が出る。
- 自動テスト:
  - Playwright E2Eで主要フロー（1)〜5)）がPASS。
  - スナップショット差分が0.5%以下（`SNAP_DIFF_THRESHOLD=0.5`）。
- パフォーマンス:
  - 1画面あたりDuty 50・Tripセグメント合計1000件でスクロール/ドラッグが滑らか（フレーム落ち顕著でない）。
- アクセシビリティ:
  - キーボードでの選択・移動（Tab/矢印/Enter）を最低限サポート（D&D代替操作）。

## 実装の中核設計
- Dragバス（軽量グローバル）
  - `features/timeline/dragBus.ts`（新規）を導入。React Context + 内部EventEmitterで、同一画面内の複数 `TimelineGantt` 間でドラッグペイロードを共有。
  - ペイロード型: `ExternalDragPayload`
    - `type: 'block-trip' | 'block-trip-range' | 'duty-segment' | 'break-token' | 'deadhead-token' | 'unassigned-range'`
    - 最小フィールド: `blockId`, `tripId | startTripId/endTripId`, `dutyId/segmentId（必要時）` ほか。
- TimelineGantt 拡張（非破壊・後方互換）
  - 既存のセグメントドラッグ（move/resize）に加えて「外部ドラッグ受け入れ」を追加。
  - 新Prop（オプショナル）: `onExternalDragOver`, `onExternalDrop`, `renderDropPreview`。
  - セグメント外のレーン空白部にも `drop zone` を設定し、空白ドロップで「新規Duty作成+セグメント追加」を実行可能に。
- Duty側コントローラ拡張
  - `useDutyTimelineControls.ts`: `handleExternalDrop(payload, laneId, minutes)` を追加し、
    - block-trip / block-trip-range: `dutyActions.addSegment(...)`
    - duty-segment: `dutyActions.moveSegment(...)`（クロスレーン対応）
    - break/deadhead: 既存ロジックへ委譲
    - unassigned-range: 範囲に対応するDrive/Break/Deadheadを推論して追加
  - スナップ計算は `timelineSnap.ts` をDuty/Block兼用で拡張し、範囲→Trip境界へ丸め。
- Block側ドラッグソース
  - `DutiesView.tsx` の `blockTimelineLanes` を「Trip単位セグメント」化済み。各セグメントから `dragBus.begin({type:'block-trip', ...})` を呼び出し、Duty側へドロップ可能にする（HTML5 DnDは使わず、Pointerベースで統一）。
- 視覚プレビュー
  - ドラッグ中はDutyレーンに半透明のゴースト矩形を重ねて配置位置を可視化。不可な箇所は赤系で表示。
- エラーハンドリング
  - 不正ドロップはスナックで理由表示（連続性違反、重複、境界逆転など）。
- Telemetry
  - `src/services/workflow/workflowTelemetry.ts` へイベントを追加（drag_start/over/drop/cancel）。

## 変更予定ファイル（主）
- 追加: `src/features/timeline/dragBus.ts`
- 変更: `src/features/timeline/TimelineGantt.tsx`（外部ドラッグ受け入れ/プレビュー）
- 変更: `src/features/duties/hooks/useDutyTimelineControls.ts`（外部ドロップ処理/クロスレーン）
- 変更: `src/features/duties/components/DutyTimelineCard.tsx`（DragBus提供/配線）
- 変更: `src/features/duties/components/UnassignedSegmentsCard.tsx`（ドラッグ開始を追加）
- 変更: `src/features/blocks/BlocksView.tsx`（TripセグメントをDragソース化）
- 変更: `src/features/timeline/types.ts`（ExternalDragPayload型を追加）
- 必要に応じて: `src/services/duty/*`（境界チェック/警告の拡張）

## マイルストーン（確実に進める小さなステップ）
- M1: 基盤と最初の成功（10/28〜10/31）
  - DragBus導入、Block→Dutyへ単一Tripのドロップで新規Duty作成が成功。
  - テスト: `tests/playwright/duties.dnd.builder.spec.ts` の「単一Trip追加」シナリオPASS。
- M2: 実運用に耐える（11/01〜11/04）
  - 複数Trip範囲ドラッグ、Duty内/間の移動、空白ドロップ（新規作成）を実装。
  - スナップ/検証/警告の一体化。Undo/Redoの完全動作。
  - テスト: 主要シナリオ一式PASS。UIスナップショット差分≤0.5%。
- M3: 仕上げ（11/05〜11/07）
  - Break/Deadheadトークンのドラッグ追加、アクセシビリティ代替操作、パフォーマンス最適化。
  - ドキュメント/チュートリアル更新、DevTools検証スクリーンショット取得。

※ 日付は目安。今日（2025-10-28）から即着手。各M完了時に `plans2.md` を更新して進捗と結果を記録。

## 詳細実装タスク
- DragBus（新規）
  - [ ] `createDragBus(): { begin(payload), update(pos), end(result), subscribe(...) }`
  - [ ] React Context `DragBusProvider` と `useDragBus()`
  - [ ] ペイロード/結果型のTypeScript定義（`ExternalDragPayload`, `DropResult`）
- TimelineGantt 拡張
  - [ ] スクロールコンテナへ `onPointerMove`/`onPointerUp` を追加し、`dragBus`の `update/end` を受け取りプレビューを描画
  - [ ] `onExternalDrop(laneId, minutes, payload)` を発火
  - [ ] セグメント外の空白に薄いドロップレイヤを実装（ヒットテストでminutes算出）
- DutiesView/DutyTimelineCard
  - [ ] `DragBusProvider` をページに配置
  - [ ] Blockタイムラインにも `DragBus` のbeginを配線（Tripセグメントから開始）
  - [ ] Dutyタイムラインに `onExternalDrop` を渡し、`useDutyTimelineControls.handleExternalDrop` を呼ぶ
- useDutyTimelineControls
  - [ ] `handleExternalDrop(payload, laneId, minutes)` で各ペイロードを分岐
  - [ ] `moveSegment` を他Dutyへの移動にも対応
  - [ ] スナップ/検証に失敗したら結果を破棄し、ユーザーへ理由提示
- Unassigned/Break/Deadhead
  - [ ] `UnassignedSegmentsCard` の行をドラッグ可能に（payload: `unassigned-range`）
  - [ ] `ExportBar` 近辺にBreak/Deadheadトークン（小バッジ）を配置してドラッグ開始
- 検証/警告
  - [ ] `timelineSnap.ts` をDuty/Block共通ロジックに拡張
  - [ ] Duty警告（`aggregateDutyWarnings.ts`）と連携し、ドロップ時に軽量チェック
- Telemetry
  - [ ] `workflowTelemetry.track('dnd', {...})` を要所に追加

## テスト計画（自動 + 目視）
- E2E（Playwright）
  - 追加: `tests/playwright/duties.dnd.builder.spec.ts`
    - [ ] Block→Duty 単一Tripドロップで新規Duty作成
    - [ ] 複数Trip範囲ドロップ（Shift+ドラッグで選択拡張→ドロップ）
    - [ ] Duty内並べ替え、Duty間移動、空白ドロップで新規Duty
    - [ ] Unassigned→Duty ドロップ
    - [ ] Break/Deadheadトークン→Duty ドロップ
  - 既存との整合: `tests/duty.timeline.snap.test.ts` ほかが引き続きPASS
- 単体
  - [ ] `timelineSnap` の範囲丸め/検証
  - [ ] `useDutyCrudActions`（move/add/deleteの境界条件）
- UIスナップショット（必須）
  - 既定フロー: `npm run build` → `make generate-snapshots`
  - フォールバック: プレビュー/Playwright準備がインフラ要因で失敗した場合は自動スキップ（`tmp/ui-snapshots/fallback-*.md`）。必ず `plans2.md > Test` にログパスと原因を記録。強制再失敗は `SNAPSHOT_FALLBACK_DISABLE=1 npm run generate-snapshots`。
- DevTools検証（必須）
  - `npm run devtools:landing-hero` を実行し、`tmp/devtools/landing-hero.png` を確認。

## 実行コマンド（抜粋）
```sh
# UIビルド & スナップショット
npm run build
make generate-snapshots

# E2E（プレビュー省略モードの例）
PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/duties.dnd.builder.spec.ts

# DevTools（中央揃え/スクショ）
npm run devtools:landing-hero

# Context7 ドキュメント（ライブラリ調査が必要な場合）
npm run context7:resolve -- dnd
npm run context7:docs -- <libraryId>
```

## リスクとフォールバック
- HTML5 DnDとPointerイベントの混在リスク
  - 方針: 既存に合わせてPointerベース＋独自DragBusで統一。ライブラリ導入は最後の手段。
- タイムライン間のスクロール同期ずれ
  - `scrollLeft`のしきい値更新を`±1px`で抑制済み。過剰再描画を回避。
- プレビュー/サーバ準備の不安定
  - 既定のスナップショット運用に従い、フォールバックログをTest節に記録。

## 完了の定義（Definition of Done）
- 受け入れ条件（6項目）をE2Eで自動検証済み。
- スナップショット差分≤0.5%、設計スクリーンショットと視覚一致。
- 主要コードに型・JSDocコメントが付与され、回帰テストが通過。
- 操作チュートリアルを `docs/README.md` に追記（GIF/PNG付き）。

## 決定ログ（抜粋）
- 2025-10-28: 行路＝Dutyを主対象とし、Blockはドラッグソース兼リファレンスとして扱う。
- 2025-10-28: DnDはPointer＋DragBusで統一（dnd-kit等は現時点で導入しない）。

## Step1 テスト安定化 Exec Plan（2025-10-29着手）

### 全体像
Step1 専用シナリオの初期データとロジックを見直し、`blocks.meta.step1` / `manual-only.no-autofinalize` / `step1.basic-flow` など Playwright テストが期待する状態を再現する。DnD 改修の副作用や依存関係を洗い出し、必要であれば Step1 セッション用の初期化を補強する。

### 進捗状況
- [x] 失敗テストの再現とログ精査（`test-results/*` / コンソール出力）※ 2025-10-29: `make.cmd generate-snapshots` ログを再確認し、`blocks.meta.step1` ほかの失敗条件を把握
- [ ] Step1 フィクスチャ・初期化ロジックの差分確認（`tests/fixtures/step1` 系 / `src/features/blocks`）
- [ ] 修正案の実装（初期データ or ロジック）
- [ ] Playwright 該当スイートの再実行
- [ ] ドキュメント / 記録更新

### 発見とメモ
- `useEffect(() => () => setManualBlockPlan(...))` が `manualPlanState.plan` 変更のたびにクリーンアップを発火し、旧プランを保存 → Step1 で行路作成後すぐ初期化される挙動を確認。最新プランを保持するため `useRef` と組み合わせた保存に切り替える必要あり（2025-10-29）

## To-Do（実装✅チェックリスト）
1. [x] DragBusの実装と配線
2. [x] TimelineGanttの外部ドロップ対応
3. [x] Block→Duty 単一Tripドロップ
4. [x] Duty内/間のドラッグ移動
5. [x] 空白ドロップで新規Duty作成
6. [x] 複数Trip範囲ドラッグ/スナップ
7. [x] Unassigned/Break/Deadheadのドラッグ対応
8. [x] Telemetryイベント追加
9. [x] E2E/単体テスト追加
10. [ ] UIスナップショット取得と基準更新
11. [x] ドキュメント更新（操作チュートリアル）
12. [ ] Step1 既知不具合（blocks.meta.step1 / manual-only.no-autofinalize / step1.basic-flow）の再調査と是正計画策定（2025-10-29 着手）

---

# Test（実行ログ記録エリア）
- 実行日とコマンド、結果、フォールバック有無/ログパスを逐次追記すること。

例:
- 2025-10-29: `npm run build` → OK
- 2025-10-29: `make generate-snapshots` → Fallback発動、`tmp/ui-snapshots/fallback-20251029-1030.md`。原因: プレビュー起動に失敗。再試行予定。
- 2025-10-30: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/duties.dnd.builder.spec.ts` → PASS
- 2025-10-28: `npm run build` → WARN（esbuild css minify の `-: T;` が継続。成果物は生成済み）
- 2025-10-28: `npm test` → PASS（DnDユーティリティのスナップテスト追加済み）
- 2025-10-28: `npm run generate-snapshots` → FAIL（Playwright 実行中に `ReferenceError: Cannot access 'ne' before initialization`。原因調査と再実行が必要）
- 2025-10-28: `npm run build` → OK（css minify の `-: T;` 警告を解消）
- 2025-10-28: `npx tsx --test tests/blocks.plan.overlap.test.tsx` → PASS（manual plan overlap のユニット確認）
- 2025-10-28: `./make.cmd generate-snapshots` → FAIL（`blocks.meta.step1` / `blocks.unassigned.dragdrop` / `manual-only.no-autofinalize` / `step1.basic-flow` が未割当→新規行路作成時に失敗トーストを表示。`ReferenceError` は再現せず。`test-results/*` を参照し原因調査継続）
- 2025-10-29: `make.cmd generate-snapshots` → FAIL（`blocks.meta.step1` / `manual-only.no-autofinalize` / `step1.basic-flow` が失敗。Step1関連の既知課題が継続。ログ: `test-results/*` を参照）
- 2025-10-29: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/playwright/blocks.meta.step1.spec.ts --project=chromium --workers=1` → FAIL（webServer 設定が port 4174 の既存 preview と競合。バックグラウンド起動手順を再整理予定）
- 2025-10-29: `npm run build` → OK
- 2025-10-29: `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/playwright/blocks.meta.step1.spec.ts --reporter=list --workers=1` → PASS
- 2025-10-29: `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/playwright/manual-only.no-autofinalize.spec.ts --reporter=list --workers=1` → PASS
- 2025-10-29: `PLAYWRIGHT_SKIP_WEBSERVER=1 APP_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/playwright/step1.basic-flow.spec.ts --reporter=list --workers=1` → PASS
