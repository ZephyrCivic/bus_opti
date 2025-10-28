<!--
  docs/specs/implementation-plan.md
  目的: 小さく安全な実装手順（段階導入）を明文化し、レビューしやすい粒度に分割する。
  前提: 仕様は readme.md / docs/specs/requirements-blocks-duties.md / docs/specs/ui-mock.md に準拠。
  方針: Small, clear, safe steps — always grounded in real docs.
  日付: 2025-10-17
-->

# 実装手順（小さく安全な順）

本手順は、仕様を段階的に満たすための最小ステップです。各ステップは独立にレビュー可能で、ロールバック容易（フラグや限定UI）を前提とします。

## STEP 1 — Blocks: 手動Connect＋接続部の警告
- 目的: 行路（Block）をUIで直感的に作れる最小コアを提供。
- 実装
  - タイムライン上で Start/End 選択→Connect（ui-mockの操作どおり）。
  - 実効gap＝gap−Deadhead（手入力ルール）を計算し、接続部ラベルに表示。
  - 警告（critical/warn/info）を接続部/行単位に表示。
  - Coverage/未割当の集計をフッタに表示。
  - CSV: blocks.csv 現行仕様のまま（将来列は出力しない）。
- テスト
  - blockBuilder/連結の単体（minTurn/Deadhead/半径）
  - linkingEnabled=false で旧挙動一致
- DoD
  - Connect→行路行に便が連なり、接続部に注記と警告が出る。

## STEP 1b — Blocks: ローカル探索（準最適化）
- 目的: Deadhead総分を UI 応答内で逓減（<数秒）。
- 実装
  - 近傍操作: 2-opt, 隣接入替（swap）, 末端再接続（relink）。
  - 停止条件: 改善が止まる、もしくは時間上限（例: 200ms/反復×N）。
  - フラグ: `opt.local.enabled=true`（既定ON）。
- テスト
  - Deadhead 単調非増性（改善が悪化しない）
  - 既存の技術制約（OVERLAP等）を侵さない
- DoD
  - 段1ベースライン比で Deadhead が改善し、未割当=0/警告評価が維持。

## STEP 2 — Duties: 割付UI＋食事（休憩）帯＋警告
- 目的: 交番表（Duty一覧）をUI操作で作成可能にする。
- 実装
  - 左=従業員リスト→中央=Dutyタイムラインへドラッグで割付。
  - 区間の追加/移動/削除は既存機能を継承。
  - 食事/休憩（meal/break/layover）帯の追加・編集・削除。
  - 警告: 連続運転上限/休憩下限/交代所ウィンドウ。
  - CSV: duties.csv 確定仕様（現行実装）で入出力。
- テスト
  - dutiesCsv 入出力の往復整合
  - 警告ロジックの閾値テスト（minBreak等）
- DoD
  - Dutyに従業員を割付け、食事帯を入れても保存/CSV出力できる（警告は非ブロック）。

## STEP 3 — Split Mode: Blocks↔Duties 同期表示
- 目的: 手動割付の作業性を最大化（選択/時間/ズームの同期）。
- 実装
  - 上=Blocks、下=Duties のスプリットレイアウト。
  - 選択同期・時間カーソル同期・ズーム同期の実装。
  - 初期比率: 60%/40%（ユーザー可変）。
- テスト
  - 同期イベントの発火と反映（選択/ホバー/ズーム）。
- DoD
  - 片方の編集がもう片方に即座に視覚反映し、操作が滞らない。

## STEP 4 — Vehicles（任意）: 配車の可視化＋CSV
- 目的: 行路を車両レーンに載せて重複等を警告（最適化なし）。
- 実装
  - 縦=vehicle_id、横=時間のガント。Unassigned Blocks→車両へドラッグ。
  - 警告: VEH_OVERLAP / AFTER_HOURS / RADIUS_EXCEEDS（保存は可）。
  - CSV: vehicle-assignments.csv（任意）。
- テスト
  - 重複検出とCSV入出力
- DoD
  - 重複/距離/営業時間外の警告が出る。CSV入出力が通る。

## STEP 5 — 小規模MIP（任意・フラグ配下）
- 目的: 小規模日の Deadhead 厳密最小化と違反ゼロ保証（≤300 trips/日目安）。
- 実装
  - 解法: 依存追加なし（簡易B&B）またはオプションで glpk.js。フラグ `opt.mip.enabled=false` 既定OFF。
  - 入力: 段1+2で生成した候補連結集合。
  - 出力: Deadhead最小のブロック集合（未割当=0・制約充足）。
- テスト
  - 既知の小規模インスタンスで厳密値と一致。
  - オフ時は段2結果と一致。
- DoD
  - フラグONのとき、KPI-1（Deadhead）で段2以下になり、COV/LAWを維持。

## 横断タスク
- ドキュメント更新: readme.md / fixlist / ui-mock をステップ完了時に更新。
- アクセシビリティ/操作性: キーショートカット（S/E/Enter, A, Z/Y）。
- ログ/トースト: 取込・保存・警告の発生をユーザーに明示。
- フラグ/ロールバック: `manual.linking.enabled` など、既存フラグで旧挙動へ即時復帰可能。
 - 計測/KPI: Blocks/Duties フッタに KPI スナップショット（Deadhead改善率・未割当・違反）を表示。

## リスク低減
- 仕様外の列や未知データは常に無視（前方互換）。
- 警告は非ブロック（技術エラーのみブロック）。
- 画面単位で段階リリースし、ユーザーへの影響を局所化。


