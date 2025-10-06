# 文字化け防止ガイドライン(2025-10-06)

本ドキュメントは、MVPドキュメント群における文字化け事故を防ぐための運用ルールをまとめたものです。以下を守り、定期的にCLIで検査してください。

## 1. 保存フォーマット
- すべてのドキュメント/ソースコードは **UTF-8 (BOM なし)** で保存する。
- エディタ設定例(VS Code):
  - `"files.encoding": "utf8"`
  - `"files.autoGuessEncoding": false`
  - `"files.eol": "\n"`
- Windows環境でPowerShellから `Set-Content` を利用する場合は `-Encoding UTF8` を必ず指定する。

## 2. チェックリスト
- 追加・更新したMarkdown/テキスト/TSXなどはコミット前に `npm run scan:encoding` を実行し、エラーが無いことを確認する。
- CLIで検出された `INVALID_UTF8` はファイルの文字コードがUTF-8でない可能性が高い。エディタで再保存するか、`iconv`等でUTF-8へ変換する。
- `REPLACEMENT_CHAR` が出力された場合は、元データを再取得し、文字化け箇所を手動で修正する。

## 3. 取り込み時の注意
- 表計算ソフトや社内システムからコピーする際は、一度 UTF-8 対応のテキストエディタへ貼り付けてから保存する。
- 外部Zipを展開する場合は、一旦 `npm run scan:encoding data/<dir>` で事前チェックする(必要に応じて対象ディレクトリを指定)。

## 4. 自動化への組み込み(任意)
- 将来的に pre-commit フックや CI へ `npm run scan:encoding -- --json` を組み込み、失敗時にブロックする運用を推奨。
- 大容量バイナリ(>5MB, 画像/Zipなど)はスキップ設定済み。追加で除外したい場合は `tools/encodingScanCli.ts` のリストを更新する。

