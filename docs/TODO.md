<!--
  docs/TODO.md
  どこ: docs/
  なに: プロジェクトの「生きた」TODOチェックリスト。優先度/DoD/検証コマンドを併記し、実作業の進行に合わせて [ ]→[x] を更新する。
  なぜ: Small, clear, safe steps を実践し、実装/テスト/ドキュメント整合を一元管理するため。
-->

# TODO（生きたチェックリスト）

Motto: "Small, clear, safe steps — always grounded in real docs."

使い方
- 下記の順で進める: Plan → Read → Verify → Implement → Test & Docs → Reflect。
- 各項目にDoDと検証コマンドを明記。完了したら [x] に更新し、完了日(YYYY-MM-DD)を記録。
- オーナーは初期値 Codex（エージェント）。必要に応じて変更。

凡例
- 優先度: P0=最優先, P1=次点, P2=拡張
- ステータス: [ ] 未 / [x] 済

---

## P0（最優先: 品質/整合/基盤）

- [x] エンコーディング検査の安定化（誤検知抑制/.log除外/対象限定）
  - DoD: `npm test` 緑、`npm run scan:encoding -- --json` で0件
  - 検証: `npm test` / `npm run scan:encoding -- --json`
  - 変更: `tools/encodingScanCli.ts`, `tests/encodingScanCli.test.ts`
  - 完了: 2025-10-06（Owner: Codex）

- [x] 設定の単一ソース化検証（Python↔TSの既定値同期テスト）
  - DoD: `config.py` の `DUTY_*` と TS の `DEFAULT_DUTY_SETTINGS` が一致
  - 検証: `npm test`
  - 変更: `tests/config.defaults.test.ts`
  - 完了: 2025-10-06（Owner: Codex）

- [x] README / DECISIONS / specs の用語整合と重複整理（中拘束・交代地点制約・英語併記）
  - DoD: `tests/readme.*.test.ts` と `tests/docs.decisions.test.ts` が緑、用語の表記ゆれ解消
  - 検証: `npm test`
  - 変更: `readme.md`, `docs/DECISIONS_2025-10-06.md`, `docs/specs/duty-editing.md`
  - 完了: 2025-10-06（Owner: Codex）

- [ ] 大きいファイルの分割（≤300 LOC）
  - 対象: `src/features/duties/DutiesView.tsx`、`src/services/duty/dutyState.ts`、`src/services/blocks/blockBuilder.ts`
  - DoD: 既存テスト緑・API/エイリアス互換・各ファイルにヘッダコメント
  - 検証: `npm test`
  - メモ: 2025-10-06 DutiesView.tsx を 219 行へ分割済。`dutyState.ts` を modules (`constants.ts`, `indexing.ts`, `history.ts`, `validators.ts`, `state.ts`) に分割済。残り `blockBuilder.ts`
  - Owner: Codex

---

## P1（MVPの不足埋め・機能拡張）

- [ ] Duty編集の Redo と履歴上限
  - DoD: Undo→Redo→再Undo のユニットテストが緑、`Ctrl+Y`/`Shift+Ctrl+Z` で動作
  - 検証: `npm test`
  - 変更想定: `src/services/duty/*`（history抽出）, `src/services/import/GtfsImportProvider.tsx`, `src/features/duties/*`
  - Owner: Codex

- [ ] Duties の保存/復元と CSV 出力
  - DoD: localStorage 保存/復元OK、`duties.csv` 列順: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id`
  - 検証: `npm test`（CSV生成ユニットテスト）
  - Owner: Codex

- [ ] Drivers の簡易インポート（drivers.csv）
  - DoD: `driver_id,name,...` 読込後にDuty作成時の既定driver選択が可能、重複IDは上書き規則を明記
  - 検証: `npm test`
  - Owner: Codex

- [ ] Blocks/Duties の CSV エクスポート導線（Diff/Exportタブ）
  - DoD: 1クリック保存、`defaultFileName()` 準拠、両CSV出力可能
  - 検証: 手動確認 + 生成ロジックのユニットテスト
  - Owner: Codex

- [ ] KPIパネルUX改善（警告→該当セグメント強調・スクロール、オートコレクト導線）
  - DoD: 警告時に解消導線あり、適用で警告軽減/解消
  - 検証: `npm test`（最小ユニット）+ 手動確認
  - Owner: Codex

---

## P2（拡張/Next）

- [ ] Explorer オーバレイ（Depots/Relief points）追加と警告連携
  - DoD: レイヤON/OFF、Dutyが交代地点に接続しない場合に警告（MVPは警告のみ）
  - 検証: 手動確認 + 補助ユニット
  - Owner: Codex

- [ ] ブロック計画UI改善（サービス日表示/凡例、日跨ぎの視認性）
  - DoD: Day表記の補助表示、日跨ぎの分断が視覚的に理解できる
  - 検証: 手動確認
  - Owner: Codex

- [ ] Diff/Export タブの初期実装（CSV集約）
  - DoD: タブ追加・Blocks/Dutiesのエクスポート集約
  - 検証: 手動確認
  - Owner: Codex

- [ ] i18nの下地（最低限ラベル辞書化）
  - DoD: 主要ラベル/警告文が辞書経由、既存テストに影響なし
  - 検証: `npm test`
  - Owner: Codex

---

## テスト/CI

- [ ] 追加ユニットテスト（Redo、Drivers、CSV、KPI→AutoCorrect）
  - DoD: 主要シナリオのユニットが緑
  - 検証: `npm test`
  - Owner: Codex

- [ ] プリチェック自動化
  - DoD: pre-commit/CI で `npm run scan:encoding -- --json` と `npm test` を実行、失敗でブロック
  - 検証: CIログ
  - Owner: Codex

- [ ] （任意）E2Eスモーク（Playwright CLI）
  - DoD: サーバ起動後、`evaluate`/`screenshot` が成功
  - コマンド例: `npx tsx tools/playwrightCli.ts evaluate --url http://localhost:5173 --script "return document.title"`
  - Owner: Codex

---

## 要確認事項（合意が必要）

- [ ] 全角記号ポリシー（現在: （）＆＋／，：＝？ を許容）に問題ないか
- [ ] Drivers仕様（必須列/任意列、重複ID上書き規則、既定driverの扱い）
- [ ] Duty制約の厳格化タイミング（MVPは警告のみ、Nextで強制/自動調整）
- [ ] Diff/Exportスコープ（CSV集約のみか、スケジュール差分ビュー先行か）
- [ ] ファイル分割の粒度/命名規約（優先対象・命名の合意）

---

## 実行・検証のショートカット

- テスト: `npm test`
- エンコーディング検査: `npm run scan:encoding -- --json`
- 開発サーバ: `npm run dev`
- ドキュメント取得（Context7）: `npx tsx tools/context7Cli.ts docs <libraryId> --tokens 800 --output docs.txt`

---

## 完了ログ（変更履歴）

- 2025-10-06: エンコーディング検査の安定化を実施（`tools/encodingScanCli.ts`, `tests/encodingScanCli.test.ts`）。
- 2025-10-06: 設定の単一ソース化検証テストを追加（`tests/config.defaults.test.ts`）。
- 2025-10-06: README / DECISIONS / duty specs の用語整合（中拘束・交代地点制約の英語併記）を実施。
- 2025-10-06: Duty編集 stateロジックを `constants/indexing/history/validators/state` へ分割し、既存APIを維持。
