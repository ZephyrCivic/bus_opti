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

## 仕様上の決定キーワード（抜粋）
- Block の目標比（設計目安）: 70~80%
- MapLibre をデフォルトとする（軽量・OSS）。
- サンプルフィード: `data/GTFS-JP(gunmachuo).zip`
- Duty のルール例: 中拘束／交代地点制約

## 参照
- SSOT: `plans.md`
- 主要仕様: `docs/specs/requirements-blocks-duties.md`, `docs/specs/ui-mock.md`, `docs/specs/timeline-interactions.md`
- スナップショット設定: `playwright.config.ts`

