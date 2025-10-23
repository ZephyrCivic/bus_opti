# Agent ガイド

## モットー
Small, clear, safe steps — always grounded in real docs.

## 要点
- 変更は小さく安全に行い、`plans.md` を単一の実装ガイド（Single Source of Truth; SSOT）として扱う。
- UI 変更時は自動スナップショットで視覚検証し、結果に基づいて修正する。
- 大きな作業に取りかかる前に `plans.md` に Exec Plan を作成する。

## 必須: UI 検証コマンド
UI コードを書いたら、次のコマンドで視覚検証を必ず実行する。

```sh
make generate-snapshots
```

Windows 環境では GNU Make が未導入でも、同梱の `make.cmd` により同じコマンドで実行できます（内部で `npm` と Playwright を呼び出します）。

生成されたスクリーンショットをデザインと照合し、合致しない場合は修正して再実行する。

## 簡潔な原則
- 小さく・可逆的に変更する。理由: リスクを下げる。次へ: 小さな差分で PR を作る。
- 明確さを優先し、不要な複雑さを入れない。次へ: 単一責務で実装する。
- 依存は最小限。不要になったら削除する。次へ: 導入基準を厳格にする。

## Knowledge & Libraries（運用要点）
- 変更前に `tools/mcps/context7/client.ts` を使って context7（MCP）から最新ドキュメントを取得し、前提を確認する。fetch が失敗した場合のみ `npm run context7:docs -- <libraryId>` または `npx tsx tools/mcps/context7/docsCli.ts <libraryId>` で直接実行して確認する（内部で HTTP フォールバック済み）。
- ライブラリ ID を検索したい場合は `npm run context7:resolve -- <keyword>` または `npx tsx tools/mcps/context7/resolveCli.ts <keyword>` を利用する。
- `tools/mcps/chrome-devtools/client.ts` で Chrome DevTools Protocol を利用できる。E2E テストやローカル動作確認の際はこのクライアントを優先的に使用する。

## ワークフロー（短縮）
Plan → Read → Verify → Implement → Test & Docs → Reflect の順で進め、各ステップを `plans.md` に記録する。変更ごとに最低 1 件のテストとドキュメント更新を必須とし、CI をグリーンにする。

## プレビューと UI スナップショット運用
- **既定フロー**: UI 変更時は `npm run build` → `make generate-snapshots` を実施し、差分 ≤ 0.5%（`SNAP_DIFF_THRESHOLD=0.5`）を確認する。
- **プレビューサーバ運用**: 一時サーバを起動したら、作業完了時（または失敗時）に必ずプロセスを停止する。使い終えたターミナルを開きっぱなしにしないこと。
- **代替策**: `npm run preview` や `http-server` が 2 回連続で起動直後に終了する場合は、`npm run build` のみ実行し、起動ログと原因調査メモを `plans.md` に残した上で Playwright/UI スナップショットをスキップしてよい。
- **スナップショット省略時のフォロー**: 差分確認を代替するため、UI 変更内容をレビューで説明し、確認不能だった理由（使用ポート競合・接続拒否など）を `plans.md` の Test セクションに明記する。
- **自動フォールバック**: `make generate-snapshots` 実行時にプレビュー起動や Playwright の準備がインフラ要因で失敗した場合、`tools/ui-snapshots/runWithPreview.ts` が `tmp/ui-snapshots/fallback-*.md` を出力して自動的にスキップする（ビジュアル差分などのテスト失敗は対象外で従来どおり失敗扱い）。ログのパスと原因メモを `plans.md` > Test に必ず記録し、調査が必要なら `SNAPSHOT_FALLBACK_DISABLE=1 npm run generate-snapshots` で強制的に再失敗させる。
- **基準更新**: スナップショットが取得できた場合に限り、レビュー承認後 `make approve-baseline` を実行する（PR 内での直接上書きは禁止）。

## Chrome DevTools 検証（必須）
- `npm run devtools:landing-hero`（内部で `tools/devtools/landingHeroCheck.ts` を実行）で、Chrome DevTools MCP 経由の中央揃え確認とスクリーンショット取得を行う。
- スクリプトは Headless Chrome と Vite Dev Server を自動で起動し、検証後に両方を停止する。`google-chrome-stable` が WSL 側にインストールされていることを前提とする（既定値は `google-chrome-stable`）。
- 環境に合わせて `DEVTOOLS_TARGET_URL`, `DEVTOOLS_BROWSER_URL`, `DEVTOOLS_CHROME_CMD` などを上書きする場合は、同名の環境変数を設定する。MCP サーバのエントリは `MCP_CHROME_DEVTOOLS_ENTRY` にパスを指定する（既定の個人パスは廃止）。
- 取得した `tmp/devtools/landing-hero.png` をデザインと比較し、ズレがある場合は修正後に再実行する。
- 他ページの検証が必要な場合は、同スクリプトを複製し対象セレクタや URL を変更して利用する。

## Exec Plan 運用（必須）
複雑な機能や長期作業は必ず `plans.md` に Exec Plan を作成する。「exec plan」と呼ばれたら以下を実行する。

- 全体像把握
- 進捗管理
- 作業後の `plans.md` 更新
- 発見・決定の記録

実装は `plans.md` に従い、進捗に応じて都度更新する。

## Exec Plan テンプレート（`plans.md`）
以下を `plans.md` に追加して利用できる。

```markdown
# Exec Plan: JSONパーサーのストリーミング対応

## 全体像

ストリーミングツールコール用のJSONパーサーを実装する。AI時代に最適化されたパーサーとして、リアルタイム処理を可能にする。

## 進捗状況

- [ ] スパイク：XXXライブラリの調査
- [ ] 機能実装：ストリーミングAPI
- [ ] テスト追加
- [ ] ドキュメント更新

## 発見と驚き

- YYYライブラリには既存のバグがあった
- ZZZの実装方法が予想と異なった

## 決定ログ

2025-01-15: アプローチAを選択。理由：パフォーマンスが優れているため  
2025-01-15: アプローチBを却下。理由：メモリ使用量が多すぎる

## To-Do

1. [ ] コア機能の実装
2. [ ] エッジケースのテスト
3. [ ] パフォーマンス最適化
```

## 要点まとめ（短いチェックリスト）
- UI 変更時は必ず `make generate-snapshots` を実行する。
- Chrome DevTools スクリプトでヒーローの中央揃えとスクリーンショットを取得し、結果を確認する。
- 複雑な作業は `plans.md` に Exec Plan を作成する。
- 変更ごとにテストとドキュメントを更新し、CI をグリーンにする。
- 会話は常に日本語で返答する。

必要であれば、この condensed 版を既存の `AGENTS.md` / `Agent.md` に置き換え、修正があれば適宜反映する。
