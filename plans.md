# MVP 実行TODO（SSOT）

このファイルは本リポジトリの作業計画の単一情報源（Single Source of Truth; SSOT）です。UTF-8（BOMなし）で保存し、常にここを最新に保ちます。

## 北極星（詳細）
本プロダクトは、バス事業の計画業務（行路＝Block、交番＝Duty）を支援するSaaSのMVPです。
 - Step1: 既存の GTFS を読み込み、選んだ路線を地図とタイムラインで可視化。便の連結（行路）と交番をドラッグ操作で手作りする。作業中は、休憩不足・連続運転・未割当などの警告と、回送比率などの効率指標を表示するが、保存はブロックしない。GTFSに載っていない車両/ドライバー/倉庫・交代所/労務ルール等はCSVで補完し、制約条件はCSVに加えてUIから直接入力・上書き可能とし、現場判断で前に進める。
- Step2: 蓄積したデータを基に、最適化ソルバで自動配置へ拡張（本MVPでは実行しない）。

## GOAL（タグ＝北極星とのひも付け）
- G1: 保存は常に可能（警告があってもブロックしない）。
- G2: Step1 は自動確定なし（候補提示のみ）。
- G3: 二面ビュー Vehicle/Driver の編集は即時同期。
- G4: 行路連結と交番割付は手動完結。
- G5: Hard/Soft 警告をリアルタイム表示。
- G6: KPI パネル（回送・レイオーバー・可用率など）固定表示＋注釈あり。
- G7: 設定は Web/CSV（初期/一括/バックアップ）で補助。階層上書き＋由来バッジ。
- G8: 出力時は非ブロッキング確認ダイアログ。
- G9: 監査ログとプライバシー（匿名ID=driver_id）。
- G10: KPI ログで「連結→警告確認→保存」所要時間を計測。

## このファイルの使い方
- 下のチェックボックスを上から順に消化する。
- 各項目には「参照ドキュメント」「検証コマンド」「成果物/DoD」「満たすGOAL」「対応テスト」を含める。

## TODO 一覧（上から順に実行）

- [ ] G1: 保存は常に可能の実証（警告下でも保存不可にならない）
  - 参照: docs/specs/save-flows-navigation.md, docs/specs/output-confirmation.md
  - 検証: `npx playwright test tests/playwright/save-flows.always-enabled.spec.ts`
  - 成果物/DoD: Hard/Soft 警告有無に関わらず DiffView の保存アクション（取込結果/プロジェクト）が常時有効。各画面から左ナビ経由で保存導線に到達可能。
  - 満たすGOAL: G1
  - 対応テスト: tests/playwright/save-flows.always-enabled.spec.ts

- [x] G2: 自動確定なしの保証（候補提示のみ）
  - 参照: docs/specs/requirements-blocks-duties.md, docs/specs/block-ui-redesign.md
  - 検証: `npx playwright test tests/playwright/manual-only.no-autofinalize.spec.ts`
  - 成果物/DoD: Blocks/Duties に自動確定ロジック無し（候補は提示、確定は手動操作のみ）。
  - 満たすGOAL: G2
  - 対応テスト: tests/playwright/manual-only.no-autofinalize.spec.ts

- [ ] G3: 二面ビュー（Vehicle/Driver）即時同期の性能境界テスト化
  - 参照: docs/specs/timeline-interactions.md
  - 検証: `npx playwright test tests/playwright/duty-biview.latency.spec.ts`
  - 成果物/DoD: 編集→反映 ≤ 200ms をE2Eで継続検証（CIで閾値監視）。
  - 満たすGOAL: G3
  - 対応テスト: tests/playwright/duty-biview.latency.spec.ts

- [ ] G4: 手動完結の操作網羅（連結/割付/解除/並べ替え/Undo-Redo）
  - 参照: docs/specs/block-ui-redesign.md, docs/specs/duty-editing.md
  - 検証: `npx playwright test tests/playwright/blocks.manual-workflow.spec.ts`
  - 成果物/DoD: 候補→手動連結→解除→並べ替え→Undo/Redo の一連操作が安定し副作用無し。
  - 満たすGOAL: G4
  - 対応テスト: tests/playwright/blocks.manual-workflow.spec.ts

- [ ] G5: Blocks 側の警告算出を実装し UI/CSV 整合
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: `npm test -- tests/blocks.warnings.unit.test.ts`; `npx playwright test tests/playwright/blocks.warnings.spec.ts`
  - 成果物/DoD: 折返し不足・連続運転などの件数を実装。Hard/Soft 区分ルールを明文化。UI/CSV で件数一致。
  - 満たすGOAL: G5
  - 対応テスト: tests/blocks.warnings.unit.test.ts, tests/playwright/blocks.warnings.spec.ts

- [ ] G6: KPI パネル固定表示＋注釈の明示テスト
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: `npx playwright test tests/playwright/dashboard-kpi.pinned-and-tooltips.spec.ts`
  - 成果物/DoD: KPI カードがスクロールで固定表示。各指標の注釈/根拠ツールチップが確認可能。
  - 満たすGOAL: G6
  - 対応テスト: tests/playwright/dashboard-kpi.pinned-and-tooltips.spec.ts

- [ ] G7: 設定の階層上書き＋由来バッジ（Web/CSV/Default）
  - 参照: docs/specs/settings-ui.md, docs/templates/README.md
  - 検証: `npx playwright test tests/playwright/settings.override-badge.spec.ts`; `npm test -- tests/settings.csv.roundtrip.spec.ts`
  - 成果物/DoD: 由来バッジ表示と永続。CSV→Web上書き→保存→再読込で由来が追跡可能。CSV往復でロスなし。
  - 満たすGOAL: G7
  - 対応テスト: tests/playwright/settings.override-badge.spec.ts, tests/settings.csv.roundtrip.spec.ts

- [ ] G8: 非ブロッキング確認ダイアログの実証（出力時）
  - 参照: docs/specs/output-confirmation.md, docs/specs/file-write-audit.md
  - 検証: `npx playwright test tests/playwright/export.nonblocking.confirmation.spec.ts`; `npm test -- tests/audit.log.test.ts`
  - 成果物/DoD: 確認ダイアログ表示中も他操作がブロックされない。監査ログに確認者と結果を記録。
  - 満たすGOAL: G8, G9
  - 対応テスト: tests/playwright/export.nonblocking.confirmation.spec.ts, tests/audit.log.test.ts

- [ ] G9: 監査ログとプライバシー（匿名ID=driver_id）の貫通とマスキング
  - 参照: docs/specs/file-write-audit.md
  - 検証: `npm test -- tests/privacy.redaction.spec.ts tests/file.write.audit.test.ts`
  - 成果物/DoD: 監査/CSV/UI に PII が混入しない。PII投入時は保存前にマスク/拒否。
  - 満たすGOAL: G9
  - 対応テスト: tests/privacy.redaction.spec.ts, tests/file.write.audit.test.ts

- [ ] G10: 「連結→警告確認→保存」所要時間のKPIログ計測と可視化
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: `npm test -- tests/telemetry.workflow.timing.test.ts`; `npx playwright test tests/playwright/workflow-kpi.flow.spec.ts`
  - 成果物/DoD: テレメトリに stage start/finish を追加し、Dashboard で所要時間の中央値/分布を可視化（最大100件保持・エクスポート可）。
  - 満たすGOAL: G10
  - 対応テスト: tests/telemetry.workflow.timing.test.ts, tests/playwright/workflow-kpi.flow.spec.ts

- [ ] Step1 CSV 補完の網羅（Vehicle/Driver/Depot/労務ルール）
  - 参照: docs/templates/*.template.csv, docs/specs/requirements-blocks-duties.md
  - 検証: `npm test -- tests/templates.roundtrip.spec.ts`; `npx playwright test tests/playwright/manual-csv.e2e.spec.ts`
  - 成果物/DoD: すべての台帳CSVで UI⇔CSV の往復がロス無く可能。UI単独でも同等編集可能。
  - 満たすGOAL: G1, G7
  - 対応テスト: tests/templates.roundtrip.spec.ts, tests/playwright/manual-csv.e2e.spec.ts

- [ ] Docs 整合（GOAL 到達判定/検証手順/しきい値の明記）
  - 参照: docs/README.md, docs/specs/*.md, docs/FAQ.md
  - 検証: レビューでリンク切れ無し。`make generate-snapshots`（≤0.5%）と `npm run devtools:landing-hero` パス。
  - 成果物/DoD: G1〜G10 の到達/検証/しきい値が docs に反映。
  - 満たすGOAL: 全体整合
  - 対応テスト: 目視レビュー＋スナップショット/DevTools 実行

## Exec Plan: Explorer に取込対象系統選択を統合

## 全体像
ImportView に存在する路線絞り込み UI を Explorer に集約し、地図と同じ画面で行路編集対象となる便（系統）を選択できるようにする。ナビゲーションやヘッダーの文言を「行路編集対象の便」に統一し、便/系統の表記揺れを棚卸して整合させる。

## 進捗状況
- [x] リサーチ: 現行 Explorer / Import の系統・便表記と選択ロジックを確認
- [x] 実装: Explorer に系統選択パネルを移設し、`setSelectedRouteIds` と連動させる
- [ ] UI 検証: `make generate-snapshots`（home snapshot 差分を確認済み、基準更新はレビューフロー後）
- [x] テスト: `npm run typecheck` 実行済み（UIスナップショットは差分確認のため保留）

## 発見と驚き
- （未記載）

## 決定ログ
- 2025-10-22: Explorer へ系統選択 UI を統合し、文言を「行路編集対象の便」で揃える方針を検討開始。

## To-Do
1. [ ] ImportView の路線絞り込みセクションを Explorer 用に再配置する案をまとめる
2. [x] Explorer にチェックボックス型の選択カードを実装し、地図ハイライトと同期させる
3. [ ] 文言ガイドライン（便/系統）を docs に反映する
4. [x] Import 読み込みメニューの OR バッジ配置をカード間中央にリファインする

## 実行コマンド集
- ビルド/プレビュー: `make preview`
- UIスナップショット: `make generate-snapshots`（閾値 0.5%）
- DevTools ヒーロー検証: `npm run devtools:landing-hero`
- GTFS ヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

---

## リスクと前提（要対応の論点）
- 警告整合性: UI と CSV の Hard/Soft 件数を1秒以内に同期させる。根拠リンク（該当トリップ/ルール）遷移を必須。
- Blocks 側の警告算出: 現状0件のまま。折返し不足などの算出を導入し、CSV/画面へ反映。
- スナップショット基準: Blocks UI 変更により visual baseline がずれている。基準更新はレビュー承認後に限定。
- Visual Snapshot 差異: `tests/playwright/visual.spec.ts` の home baseline (1280x875) とローカル実行キャプチャ (1280x720) が一致せず、2025-10-22 時点で `make generate-snapshots` が 2 回連続で失敗。環境設定またはビューポート差異の原因調査が必要。
- パフォーマンス: Map/TL 操作の応答を継続監視（パン/ズーム<1s）。`__EXPLORER_TEST` による自動計測を維持。
- ツール前提: DevTools 検証は `google-chrome-stable` 前提。環境差異は環境変数で上書き（READMEに準拠）。

## 関連資料（Exec Plan / アーカイブ）
- Exec Plan（UI スナップショット）: docs/exec-plans/ui-snapshots.md
- 完了タスクのアーカイブ: docs/plans-archive.md

## 決定ログ

- 2025-10-21: blocks.csv / duties.csv に `violations_summary` 列（H/S件数）と個別カラムを追加。現状は警告検出ロジック未導入のため0件だが、DoD列構成を先行整備。
- 2025-10-21: BlocksView の `minTurnaroundMin` を用いて折返し不足件数を算出し、UI/CSVへ warn 件数を露出（critical算出は今後実装）。
- 2025-10-21: Explorer MapView にテスト用 `__EXPLORER_TEST` フックを追加し、Playwright でパン/ズーム応答を自動計測（パン 0.8ms / ズーム 1.3ms）。
- 2025-10-21: Duty 警告は daily span を Hard、それ以外を Soft として表示。UI バッジを追加し、Hook で即時集計。
- 2025-10-21: Blocks 連結候補 UI と手動連結ロジックを追加、`connectBlocksPlan` の単体テストを整備。
- 2025-10-21: TimelineGantt にスクロール同期フックを追加し、DutyTimelineCard で Vehicle/Duty 二面タイムラインを導入。併せて BlocksView で `useManualBlocksPlan` の plan を明示的に取得し、`manualPlan is not defined` クラッシュを解消。
- 2025-10-21: `parseBlocksCsv` と監査ログ `recordAuditEvent` を追加し、Blocks/Duties CSV の Export→Import→Export を `tests/blocks.csv.roundtrip.test.ts` / `tests/duties.csv.roundtrip.test.ts` で検証。監査イベントは `tests/audit.log.test.ts` で蓄積確認。
- 2025-10-22: ユーザFBに基づき、Import UX を「新規開始（GTFS読み込み）」と「途中から再開（保存データ読み込み）」の2導線に統一する方針へ変更。実装は行わず、仕様検討TODOを追加。
- 2025-10-22: 保存系導線は A案（左ナビ「差分・出力」に集約）を採用。Import サマリー下ヒント/初回編集チップで発見性を補助。
- 2025-10-22: 左ナビ/モバイルナビの順序を「取込→地図・便調査→制約条件（手動入力）→行路編集」に調整。Blocks セクションの表示名を「行路編集」に変更し、UI Smoke チェックも更新。
- 2025-10-22: Import 画面のサンプルフィード案内カードを削除。実データのドラッグ＆ドロップと保存データ再開の2導線に集約。

## アーカイブ（完了タスク）

- アーカイブは docs/plans-archive.md に移行しました（2025-10-22 移行）。
