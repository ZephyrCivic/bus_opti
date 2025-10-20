# MVP 実行TODO（SSOT）

## 北極星（詳細）
本プロダクトは、バス事業者の計画業務（行路＝Block交番＝Duty）を支援するSaaSのMVPです。Step1では、既存のGTFSを読み込み、選んだ路線を地図とタイムラインで可視化し、便の連結（行路）と交番をドラッグ操作で手作りします。作業中は、休憩不足連続運転超過未割当などの警告と、回送比率などの効率指標を表示しますが、保存は決して妨げません。GTFSにない情報（車両ドライバー倉庫交代所労務ルール）はCSVで補完し、現場の判断で前に進めます。画面は「車両軸（Vehicle）」と「ドライバー軸（Driver）」を切り替えられ、どちらで編集しても即時に同期されます。Step2では、蓄積したデータを基に、最適化ソルバで自動配置へ拡張します（本MVPでは実行しません）。

## GOAL タグ（北極星の分解）
- G1: 保存は常に可能（警告があってもブロックしない）
- G2: Step1は自動確定なし（候補提示のみ）
- G3: 二面ビュー（Vehicle/Driver）編集は即時同期
- G4: 行路連結・交番割付は完全手動
- G5: Hard/Soft 警告をリアルタイム表示
- G6: 指標（回送/レイオーバー/可用率）固定表示＋式のツールチップ
- G7: 設定はWeb主・CSVは初期/一括/バックアップ補助。階層上書き＋由来バッジ
- G8: 出力時は非ブロッキング確認ダイアログ
- G9: 監査ログ＋プライバシー（匿名ID＝driver_id）
- G10: KPIログで「連結→警告確認→保存」時間を計測

## このファイルの使い方
- 下のチェックボックスを上から順に消化する。
- 各項目は「参照ドキュメント」「検証コマンド」「成果物/DoD」「満たすGOAL」「対応テスト」を含む。

## TODO 一覧（上から順に実行）
- [ ] 0. 準備/GTFSヘルスチェック
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: `npx tsx tools/gtfsHealthCli.ts <gtfs.zip>`（Blockless/時刻延長を確認）
  - 成果物/DoD: 重大エラー0、警告は記録（logs/）し次工程に反映
  - 満たすGOAL: G1
  - 対応テスト: tests/gtfs.healthCli.test.ts, tests/gtfsPersistence.test.ts

- [ ] 1. Explorer（取り込み/路線選択/地図＋タイムライン）
  - 参照: docs/specs/ui-mock.md, docs/specs/timeline-interactions.md
  - 検証: `make preview` → `make generate-snapshots`（閾値0.5%）
  - 成果物/DoD: ルート個別が正順描画、パン/ズーム応答<1s
  - 満たすGOAL: G1
  - 対応テスト: tests/explorer/loadMapLibre.test.ts, tests/ui.timeline.render.test.tsx

- [ ] 2. Blocksエディタ（端点連結＝手動／提案のみ）
  - 参照: docs/specs/block-ui-redesign.md, docs/specs/requirements-blocks-duties.md
  - 検証: スナップショット合格≤0.5%、`npm run devtools:landing-hero`
  - 成果物/DoD: 連結/解除/並び替えと差分表示が即時
  - 満たすGOAL: G2, G4, G5
  - 対応テスト: tests/timeline.interactions.design.test.ts, tests/encoding.blocksView.test.ts

- [ ] 3. Dutiesエディタ（ドラッグ割付／未割当グループ）
  - 参照: docs/specs/duty-editing.md, docs/specs/duty-editing.addendum.md
  - 検証: スナップショット、Undo/Redo 10段
  - 成果物/DoD: 割付/解除/移動が可能、`duties.csv`プレビュー
  - 満たすGOAL: G1, G2, G4, G5
  - 対応テスト: tests/duty.workflow.test.ts, tests/duty.timeline.snap.test.ts, tests/duty.manual.check.test.tsx

- [ ] 4. 警告（Hard/Soft）即時表示と内訳
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: 編集→<1sで反映、内訳に根拠リンク
  - 成果物/DoD: Hard/Soft件数一致、保存は非ブロック
  - 満たすGOAL: G1, G5
  - 対応テスト: tests/duty.specs.test.ts, tests/duty.metrics.test.ts

- [ ] 5. 効率指標ダッシュ（回送/レイオーバー/可用率）
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: 値が期待値±1%、ツールチップに式
  - 成果物/DoD: 指標固定表示、編集で再計算
  - 満たすGOAL: G6, G10
  - 対応テスト: tests/duty.metrics.test.ts, tests/duty.dashboard.test.ts

- [ ] 6. 二面ビュー切替と編集同期（Vehicle/Driver）
  - 参照: docs/specs/ui-mock.md, docs/specs/timeline-interactions.md
  - 検証: 切替/編集で200ms以内に同期
  - 成果物/DoD: 双方向編集が即時反映
  - 満たすGOAL: G3
  - 対応テスト: tests/ui.timeline.render.test.tsx

- [ ] 7. CSV入出力（blocks/duties）＋警告要約列
  - 参照: docs/specs/diff-export-scope.md, docs/specs/diff-export-rollout.md, docs/specs/file-write-audit.md
  - 検証: Export→Import→Exportが一致（冪等）
  - 成果物/DoD: 警告要約列を含むCSV出力と監査ログ
  - 満たすGOAL: G1, G8, G9
  - 対応テスト: tests/export.bar.test.tsx, tests/file.write.audit.test.ts

- [ ] 8. 設定UI（Web主/CSV補助）折返し/交代所/Depot/労務
  - 参照: docs/specs/settings-ui.md, docs/templates/*.template.csv
  - 検証: 由来バッジ表示、ドラフト→適用→ロールバック
  - 成果物/DoD: 設定が警告/指標に即時反映
  - 満たすGOAL: G5, G7, G9
  - 対応テスト: tests/settings.ui.draft-apply.test.ts

- [ ] 9. 出力時確認（非ブロッキング）
  - 参照: docs/specs/output-confirmation.md
  - 検証: 公開/CSV出力前に要約ダイアログ（Hard/Soft/未割付/指標）、続行可
  - 成果物/DoD: 監査ログに要約値と実行者を記録
  - 満たすGOAL: G1, G8, G9
  - 対応テスト: tests/settings.ui.draft-apply.test.ts

- [ ] 10. 監査ログとプライバシー
  - 参照: docs/specs/file-write-audit.md, readme.md（プライバシー）, docs/specs/roles-permissions.md
  - 検証: 主要操作100%記録、PIIなし
  - 成果物/DoD: 期間保存の監査レコード
  - 満たすGOAL: G9
  - 対応テスト: tests/file.write.audit.test.ts

- [ ] 11. KPI計測（UIログ）と週次レポート
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: 「連結→警告確認→保存」所要を自動集計
  - 成果物/DoD: 週次ダッシュ、CSVエクスポート
  - 満たすGOAL: G10
  - 対応テスト: tests/settings.ui.draft-apply.test.ts

- [ ] 12. ドキュメント整備（README/Plans/テンプレ）
  - 参照: readme.md, 本ファイル
  - 検証: 参照リンク死活=0、手順再現可
  - 成果物/DoD: SSOT整合クリア

## 実行コマンド索引
- ビルド/プレビュー: `make preview`（Windowsは `make.cmd preview`）
- UIスナップショット: `make generate-snapshots`（閾値0.5%）
- DevToolsヒーロー確認: `npm run devtools:landing-hero`
- GTFSヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

注記（Step1原則）
- 保存は常に可能。Hard/Softと指標は提示、出力時は非ブロッキング確認のみ。



# Exec Plan: ドキュメントのSSOT化（MVP最小セット）

## 全体像

docs 配下の散在ドキュメントを「参照はできるが、実装の単一情報源は plans.md」に整理する。MVP到達に必要な最小ドキュメントだけを docs/README に明示し、その他は archives へ誘導する。

## 進捗状況

- [ ] 索引更新: docs/README を SSOT 前提に刷新
- [ ] アーカイブ移動: TODO_3/4/5 を archives/2025-10 へ
- [ ] Archives README を更新
- [ ] 影響確認: 既存テストのパス/参照を温存（TODO/TODO_2 は残置）

## 発見と驚き

- docs 系の軽量テストが複数存在（TODO, TODO_2, DEPLOY, DECISIONS）。ファイル名移動はテスト破壊リスクがあるため、対象外は残置する方針が安全。

## 決定ログ

2025-10-20: SSOT は plans.md とし、MVP最小セット以外は archives に明示的に誘導する。

## To-Do

1. [ ] docs/README を「MVP最小セット + 参照 + アーカイブ」構成へ
2. [ ] docs/TODO_3.md, docs/TODO_4.md, docs/TODO_5.md を archives/2025-10/misc へ移動
3. [ ] docs/archives/README を SSOT 方針で更新
4. [ ] npm test で docs 関連テストの健全性を確認
## 運用前提・共通手順（追加）
- サンプルデータ（0/1の検証に使用）
  - `data/GTFS-JP(gunmachuo).zip`
  - `data/feed_fukutsucity_minibus_20251001_20250820163420.zip`
- エンコーディング健全性チェック（文字化け予防）
  - `npm run scan:encoding`
- DevTools 前提/上書き（環境差異がある場合）
  - `DEVTOOLS_CHROME_CMD`（例: `chrome`, `google-chrome-stable`）
  - `DEVTOOLS_TARGET_URL`, `DEVTOOLS_BROWSER_URL`

## 計測ガイド（4/6のDoD用）
- 4（警告の即時表示 <1s）
  - Playwright: 操作直前/直後で `performance.now()` を取得し、差分を記録。
  - DevTools: Performance レコーディングで Interaction→DOM 更新までの区間を確認。
- 6（二面ビューの同期 200ms 以内）
  - Playwright: 片面の操作イベント→反対側DOMの変化検知までの所要を計測。
  - ページ内に `performance.mark('section-change')` を仕込み、`performance.measure` で採取（必要に応じて実装側に軽微な埋め込み）。

## 正誤・テスト対応（補足）
- 8（設定UI）と 9（出力時確認）の「対応テスト」は後続で追加する（現時点では仕様ドキュメントによる確認を優先）。
  - 8: docs/specs/settings-ui.md と docs/templates/*.template.csv（テンプレ整合は tests/docs.templates.test.ts で担保）
  - 9: docs/specs/output-confirmation.md（監査/出力周りは tests/file.write.audit.test.ts で周辺を補強）

## タスク→主要テストの対応表（抜粋）
- 1 Explorer: tests/explorer/loadMapLibre.test.ts, tests/ui.timeline.render.test.tsx
- 2 Blocks: tests/timeline.interactions.design.test.ts, tests/encoding.blocksView.test.ts
- 3 Duties: tests/duty.workflow.test.ts, tests/duty.timeline.snap.test.ts, tests/duty.manual.check.test.tsx
- 4 警告: tests/duty.specs.test.ts, tests/duty.metrics.test.ts
- 5 KPI: tests/duty.dashboard.test.ts, tests/duty.metrics.test.ts
- 7 CSV I/O: tests/export.bar.test.tsx, tests/file.write.audit.test.ts
- 10 監査/プライバシー: tests/file.write.audit.test.ts, tests/distribution.approval.test.ts
