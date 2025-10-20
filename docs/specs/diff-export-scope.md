<!--
  docs/specs/diff-export-scope.md
  どこ: docs/specs/
  なに: Diff / Export 機能の拡張スコープと判断基準を整理した合意メモ。
  なぜ: TODO の「Diff / Export のスコープ確定」DoD を満たし、今後のスプリント計画を明確化する。
-->

# Diff / Export スコープ確定メモ（2025-10-07）

## 背景
Diff 最小 UI と Blocks / Duties の CSV エクスポートは 2025-10-07 時点で P0 として実装完了済み。  
次段の拡張では CSV 以外を含めた比較・配布機能の要求があり、対象範囲を事前に明文化する必要がある。

## 決定事項
- **CSV 差分の強化**: ブラウザ内で複数バージョンの CSV を並列比較し、差分タイプ（追加 / 削除 / 更新）ごとに絞り込み可能にする。  
- **JSON エクスポート**: Diff ビューと同等のデータ構造を JSON（UTF-8, LF）でダウンロード可能にし、外部システム連携を支援する。  
- **スクリーンショット共有**: 既存の Chrome DevTools CLI を利用し、Diff / Export タブから差分テーブルのスクリーンショット保存をトリガーできるようにする。  
- **権限管理**: Export 機能に Download ガードを追加し、管理者ロールのみが履歴ファイルへアクセスできる。

## 非スコープ（今回含めない事項）
- リアルタイム共同編集や同時編集コンフリクト解消。  
- 外部ストレージ（S3 等）への自動アップロード。  
- AI ベースの自動マージ提案。

## DoD 整合ポイント
1. CSV 以外（JSON）の出力フローを実装し、テストでファイル内容とメタデータを検証する。  
2. Diff タブの履歴管理 UI を実装し、ローカル履歴（最新5件）を表示できる。  
3. Export 履歴の権限チェックを `config.py` のロール設定と連動させる。  
4. README と DECISIONS に拡張スコープを追記し、テストで存在を確認する。

## スプリント計画案
1. **調査（0.5日）**: 既存 Diff / Export 実装のデータ構造と API を洗い出し、権限ガードの挙動を調査。  
2. **実装（2日）**: JSON 出力と履歴 UI を追加し、Chrome DevTools CLI 連携を構築。  
3. **テスト & ドキュメント（1日）**: 新規テスト（ユニット + smoke）と README / DECISIONS の更新。  
4. **レビュー / 受け入れ（0.5日）**: スプリント終了前に QA と UX レビューを実施。

## 参照
- docs/TODO.md（2025-10-07 更新）  
- docs/specs/duty-editing.md / duty-editing.addendum.md  
- README 「差分とダッシュボード指標」節  
- tools/chromeDevtoolsCli.ts（スクリーンショット CLI）

## 警告要約列（CSV 仕様・追記）
- 列名と順序（提案）
  - violations_summary: 例 "H:3;S:5"（Hard/Soft件数の要約）
  - violations_hard: 数値（Hard件数）
  - violations_soft: 数値（Soft件数）
- 出力箇所
  - blocks.csv / duties.csv の末尾列として追加（将来変更可）
- フォーマット規則
  - 数値は整数、空は0。小数なし
  - 区切りはセミコロン、キーは固定（H,S）
- DoD
  - UIの警告カウンタとCSVが一致
