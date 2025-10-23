<!--
  readme.md — プロジェクト概要（SSOT は plans.md）
  目的: 現場導入の合意形成と Step1 の運用範囲の明確化。
-->

# 最適化 Demo — 導入とゴール（試験運用）

本プロジェクトは、バス運行データ（GTFS）を読み込み、行路（Block）と交番（Duty）を扱う運用UIを提供します。Step1では人が判断し、システムは可視化・警告・効率指標の提示と保存を支援します（自動最適化はStep2以降）。

## プロジェクトの目的
Step1として、人の判断で行路（Block）と交番（Duty）を編集・保存できるUIを提供します。システムは可視化・警告・KPI提示に徹し、自動確定は行いません（Step2以降の対象）。

## クイックスタート
1) 依存をインストール: `npm i`
2) 開発サーバ起動: `npm run dev`
3) ビルド: `npm run build`
4) プレビュー: `npm run preview`

## 60秒デモ
- 流れ: Import → Explorer確認 → Blocks確認（手動連結）→ Duties割付 → CSV出力
- 留意点: デモ用データは `docs/demo/*` を使用。Reset で初期状態に戻せます。

## Import画面の導線（2025-10 更新）
- 「読み込みメニュー」で `GTFSを読み込む` と `保存データから再開` の2ボタンを提示し、どちらから始めても共通の「取込サマリー」へ遷移します。
- 取込サマリーには読み込み日時・ソース名・指標テーブル・注意事項・（任意）路線の絞り込みを表示します。路線選択は初期状態ですべて選択され、0件になると Explorer ボタンが自動で無効化されます。
- 保存・出力は左ナビ「差分・出力」に集約しました。Import 画面ではヒントのみ提示し、操作ログは `bus-opti.telemetry.events`（localStorage）へ `import.route-filter.updated` / `import.open-explorer` として記録します。

## 仕様上の決定キーワード（抜粋）
- Block の目標比（設計目安）: 70~80%
- MapLibre をデフォルトとする（軽量・OSS）。
- Duty のルール例: 中拘束／交代地点制約

## 参照
- SSOT: `plans.md`
- 主要仕様: `docs/specs/requirements-blocks-duties.md`, `docs/specs/ui-mock.md`, `docs/specs/timeline-interactions.md`
- スナップショット設定: `playwright.config.ts`

## 実装状況とスコープ（2025-10-23 更新）

Step1/2/3 の役割を明確化します。SSOT は `plans.md` です。

### Step1（手作りフェーズ）
- 目的: 現場が“手で作れる”ことの確認。警告/KPIは出さない。
- 入力: GTFS（必須）＋ 各CSV（車庫・交代地点・回送ルール・運転士・車両[新規]）。
- 操作: 二面ビュー（車両/乗務）で、行路（Block）と交番（Duty）を手で作る。
  - 車両連結（端点を手でつなぐ）
  - 休憩の挿入（手動）
  - 回送の挿入（手動）
- UI 表示: 環境変数 `APP_STEP=1` を指定すると警告バッジや KPI カードなど Step2 以降の可視要素を非表示化する（Duty 警告・Inspector の安全チェック・Dashboard KPI・Blocks の診断カードなど）。`APP_STEP>=2` で復帰。
- 出力/保存: 常に可能（非ブロッキング）。

注: 現状コードでは「車両CSV」「休憩/回送の手動挿入UI」が未実装です。Step1達成に向けて plans.md のTODOに追加しています。

### Step1 ではやらないこと（後続）
- 警告/KPI表示（休憩不足・連続運転・日拘束・未割当など）
- Greedy 自動連結（行路の自動連結）としきい値調整
- 連結候補の自動提示UI／D&D連結UI
- 路線選択の厳密反映（Blocks タイムライン）

### Step2（警告/KPI＋支援）
- 警告とKPIの表示（Hard/Soft）を有効化。
- Greedy 自動連結と候補提示UIを導入（自動確定なし）。

### Step3（ソルバ）
- 制約（労務・回送・交代可能点）を考慮した自動配置ソルバを導入（案提示→人手確認→保存）。

既知の前提・運用ルールは `plans.md` を参照してください。
