# Exec Plan: Import UX 統一（実装）

## 全体像

ImportView を「新規開始（GTFS）」と「保存データから再開」の 2 導線に統一し、共通の取込サマリーと路線絞り込み UI を実装する。既存仕様（docs/specs/import-ux-unified*.md）に従い、保存導線は左ナビ誘導へ一本化しつつ、Explorer 以降の遷移とテレメトリ計測も更新する。

## 進捗状況

- [x] 既存 ImportView / サマリー実装の調査と API 整理（2025-10-22）
- [x] UI リファクタ: 読み込みメニュー 2 導線＋共通サマリー構造（2025-10-22）
- [x] 路線絞り込み UI（初期全選択 / チェックボックスグリッド / 選択ゼロ時の無効化）（2025-10-22、Explorer 連携は後続タスク）
- [x] テレメトリ・ルーティング更新（Explorer ボタン押下、保存導線ヒント）（2025-10-22）
- [x] Explorer との連携（路線選択の共有と Map ハイライト制御）（2025-10-22）
- [x] ユニット / E2E テスト追加（Playwright: import-flow.spec.ts）（2025-10-22）
- [x] ドキュメント更新（README 保存導線章 / FAQ）（2025-10-22）

## 発見と驚き

- ImportView では GTFS 読み込み完了時に取込サマリー内へ保存ボタン（取込結果保存・プロジェクト保存・再取込）が集約されており、左ナビ導線との二重化が発生している。
- `useGtfsImport` は取込完了で Duty 状態をリセットし、`result.tables` をテーブル名そのままで表示しているため、新サマリーでもこのデータ構造を再利用可能。
- 保存データの読み込みは `fromSavedProject` → `setManual` 追従が必要で、取込サマリー側の UI を更新する際も hidden input 経由の再利用が求められる。
- App 全体でセクション切替を呼び出せるよう `SectionNavigationContext` を新設。Explorer ボタンから `navigate('explorer')` を呼べるようになった。

## 決定ログ

- 未実施（実装着手後に追記）

## To-Do

1. [x] コードスパイク：ImportView 現状のローディング/状態遷移の確認（2025-10-22）
2. [x] 新 UI コンポーネント作成（ImportSummaryCard v2, RouteFilterPanel）（2025-10-22）
3. [x] 旧保存カードの削除と左ナビリンクヒントの追加（2025-10-22）
4. [x] テレメトリイベントの更新と context7 ドキュメント整合確認（2025-10-22）
5. [x] Explorer との連携（路線選択の共有と Map ハイライト制御）（2025-10-22）
6. [x] Playwright シナリオ追加（GTFS / 保存データの両導線）（2025-10-22）
7. [x] README / FAQ 更新、plans.md 状態反映（2025-10-22）
