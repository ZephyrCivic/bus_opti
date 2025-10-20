# MVP 実行TODO（SSOT）

このファイルは本リポジトリの作業計画の単一情報源（Single Source of Truth; SSOT）です。UTF-8（BOMなし）で保存し、常にここを最新に保ちます。

## 北極星（詳細）
本プロダクトは、バス事業の計画業務（行路＝Block、交番＝Duty）を支援するSaaSのMVPです。
- Step1: 既存の GTFS を読み込み、選んだ路線を地図とタイムラインで可視化。便の連結（行路）と交番をドラッグ操作で手作りする。作業中は、休憩不足・連続運転・未割当などの警告と、回送比率などの効率指標を表示するが、保存はブロックしない。GTFSに載っていない車両/ドライバー/倉庫・交代所/労務ルール等はCSVで補完し、現場判断で前に進める。
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

- [ ] 0. 準備: GTFS ヘルスチェック
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: `npx tsx tools/gtfsHealthCli.ts <gtfs.zip>`（blockless/時刻延長を確認）
  - 成果物/DoD: 重大エラー0、警告は記録し logs/ に残す。次工程へ反映。
  - 満たすGOAL: G1
  - 対応テスト: tests/gtfs.healthCli.test.ts, tests/gtfsPersistence.test.ts

- [ ] 1. Explorer: 取り込み/路線選択・地図/タイムライン
  - 参照: docs/specs/ui-mock.md, docs/specs/timeline-interactions.md
  - 検証: `make preview` と `make generate-snapshots`（閾値 0.5%）
  - 成果物/DoD: ルート個別が正しく描画、パン/ズーム応答 < 1s
  - 満たすGOAL: G1
  - 対応テスト: tests/explorer/loadMapLibre.test.ts, tests/ui.timeline.render.test.tsx

- [ ] 2. Blocks: 端点連結＝手動／提案のみ
  - 参照: docs/specs/block-ui-redesign.md, docs/specs/requirements-blocks-duties.md
  - 検証: スナップショット合格 ≤0.5%、`npm run devtools:landing-hero`
  - 成果物/DoD: 連結/解除/並び替えと差分表示が即時
  - 満たすGOAL: G2, G4, G5
  - 対応テスト: tests/timeline.interactions.design.test.ts, tests/encoding.blocksView.test.ts

- [ ] 3. Duties: ドラッグ割付／未割当グループ
  - 参照: docs/specs/duty-editing.md, docs/specs/duty-editing.addendum.md
  - 検証: スナップショット、Undo/Redo 10段
  - 成果物/DoD: 割付/解除/移動が可能、`duties.csv` プレビュー
  - 満たすGOAL: G1, G2, G4, G5
  - 対応テスト: tests/duty.workflow.test.ts, tests/duty.timeline.snap.test.ts, tests/duty.manual.check.test.tsx

- [ ] 4. 警告（Hard/Soft）即時表示と根拠
  - 参照: docs/specs/requirements-blocks-duties.md
  - 検証: 編集反映 < 1s、根拠にリンク
  - 成果物/DoD: Hard/Soft 件数一致、保存は非ブロック
  - 満たすGOAL: G1, G5
  - 対応テスト: tests/duty.specs.test.ts, tests/duty.metrics.test.ts

- [ ] 5. KPI パネル（回送/レイオーバー/可用率）
  - 参照: docs/specs/kpi-ux-panel.md
  - 検証: 値が期待±1%、ツールチップに根拠
  - 成果物/DoD: 指標は固定表示、編集で再計算
  - 満たすGOAL: G6, G10
  - 対応テスト: tests/duty.metrics.test.ts, tests/duty.dashboard.test.ts

- [ ] 6. 二面ビューの同期（Vehicle/Driver）
  - 参照: docs/specs/ui-mock.md, docs/specs/timeline-interactions.md
  - 検証: 切替/編集 ≤ 200ms で同期
  - 成果物/DoD: 双方向編集が即時反映
  - 満たすGOAL: G3
  - 対応テスト: tests/ui.timeline.render.test.tsx

- [ ] 7. CSV 入出力（blocks/duties）＋警告要約
  - 参照: docs/specs/diff-export-scope.md, docs/specs/diff-export-rollout.md, docs/specs/file-write-audit.md
  - 検証: Export→Import→Export の往復
  - 成果物/DoD: 差分説明付き CSV 出力と監査ログ
  - 満たすGOAL: G7, G9
  - 対応テスト: tests/distribution.approval.test.ts, tests/file.write.audit.test.ts

- [ ] 8. 設定UI（Web主/CSV併用）・初期/一括/Depot/労務
  - 参照: docs/specs/settings-ui.md, docs/templates/*.template.csv
  - 検証: コールバック整備、ドラフト適用はロールバック可能
  - 成果物/DoD: 設定が段階/由来で表示
  - 満たすGOAL: G7
  - 対応テスト: tests/settings.ui.draft-apply.test.ts

- [ ] 9. 出力確認（ノンブロッキング）
  - 参照: docs/specs/output-confirmation.md
  - 検証: 配布/CSV出力前に確認ダイアログ（Hard/Soft/差分/根拠）
  - 成果物/DoD: 監査ログに確認者と実行記録
  - 満たすGOAL: G8, G9
  - 対応テスト: tests/output.confirmation.docs.test.ts

- [ ] 10. 監査とプライバシー
  - 参照: docs/specs/file-write-audit.md, readme.md（プライバシー）
  - 検証: 主要イベント100%記録（PIIなし）
  - 成果物/DoD: 匿名化IDと追跡コード
  - 満たすGOAL: G9, G10
  - 対応テスト: tests/file.write.audit.test.ts, tests/duty.metrics.test.ts

## 実行コマンド集
- ビルド/プレビュー: `make preview`
- UIスナップショット: `make generate-snapshots`（閾値 0.5%）
- DevTools ヒーロー検証: `npm run devtools:landing-hero`
- GTFS ヘルスチェック: `npx tsx tools/gtfsHealthCli.ts <zip>`

---

## Exec Plan: UI スナップショット
詳細な実行計画は docs/exec-plans/ui-snapshots.md を参照。

## ブロッカー対応ログ（2025-10-20）

- [x] ポート 4173 の占有プロセス（PID 7196）を特定し、`Stop-Process -Id 7196` で停止できることを確認。`Get-NetTCPConnection` の手順を plans.md に明記し再現性を確保。
- [ ] `npm run preview` がポート衝突時に自動で空きポートへフェイルオーバーする Runbook をドキュメント化し、既存の `tools/ui-snapshots/runWithPreview.ts` の挙動と揃える。
