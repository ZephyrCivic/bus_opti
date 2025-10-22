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
- 流れ: Import → Explorer確認 → Blocks連結 → Duties割付 → CSV出力
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
