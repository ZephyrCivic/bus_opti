<!--
  docs/TODO.md
  どこ: docs/
  なに: プロジェクトの「生きた」TODOチェックリスト。優先度/DoD/検証コマンドを併記し、実作業の進行に合わせて [ ]→[x] を更新する。
  なぜ: Small, clear, safe steps を実践し、実装/テスト/ドキュメント整合を一元管理するため。
-->

# TODO（優先順位つきロードマップ）
Motto: "Small, clear, safe steps — always grounded in real docs."

開発は段階（S0→S4）と優先度（P0→P2）で進めます。従来の章は下に残し、以降は本ロードマップに集約します。

### 実行順（Single Queue／上から順に実施）
1. [ ] 行路連結ガードを導入する [P0]
   - 親子駅許容/接続半径R(m)/最小折返しT(分)を満たす場合のみ連結（閾値は`manual.linking`）。
   - DoD: ユニットテストで誤連結ゼロ、Blocks画面で連結結果が変わることを確認。
2. [ ] 時刻正規化（HH≥24:00）を適用する [P0]
   - stop_timesの24時超表記を分に正規化し、Duty計算に反映。
   - DoD: ブロック構築・Dutyメトリクス双方のテストが緑。
3. [ ] Blocks CSV出力を追加する [P0]
   - 列: block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id, schema_version, generated_at, settings_hash。
   - DoD: ボタンからCSVが落とせ、列/件数/時刻形式をテストで確認。
4. [ ] Duties CSV出力を追加する [P0]
   - 列: duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id, schema_version, generated_at, settings_hash。
   - DoD: ボタンからCSVが落とせ、列/件数をテストで確認。
5. [ ] README「最短で触る（60秒デモ）」を追記する [P0-Docs]
   - 手順: Import→デモ読込（project JSON）→Blocks→Duties→CSV出力まで。Manualは後からでOK、推奨しきい値（半径100m/折返し10分）を明記。
   - DoD: README冒頭に見出しと手順、スクリーンショット1枚（任意）を追加し、tests/readme.*が通る。
6. [ ] デモ用シード（docs/demo）を投入する [P0-Data]
   - ファイル: project.gunmachuo.json / drivers.csv / depots.csv / relief_points.csv / deadhead_rules.csv。
   - DoD: Importでproject.gunmachuo.jsonを読み込み、Blocks 70–80%カバレッジ、Duties2–3本作成、CSV出力まで1分以内。
7. [ ] frequencies展開（静的便生成） [P1]
   - `trip_id#n`を生成。`exact_times`=0/1の両方対応。
   - DoD: 便数と最終出発時刻が期待どおりになるテスト。
8. [ ] Manual CSVのイン/アウト [P1]
   - depots/relief_points/deadhead_rulesをCSVで往復可能に。
   - DoD: ラウンドトリップで損失なし。
9. [ ] Relief/Deadhead の“存在チェック”警告（表示のみ） [P1]
   - 未設定/到達不可のDutyに情報警告。作業は継続可。
   - DoD: 警告件数がUIで確認できる。
10. [ ] 簡易ガント（車両 or 仕業軸のいずれか） [P1]
   - 折返し/休憩/違反を重ねて視覚化（最小機能）。
   - DoD: 代表ケースのスクリーンショット比較テスト。
11. [ ] Explorerオーバーレイ（Depots/Relief points） [P2]
12. [ ] Diff/Exportタブ拡張（CSV導線集約） [P2]
13. [ ] Drivers簡易インポート（drivers.csv） [P2]
14. [ ] KPI系UX磨き（スクロール/ショートカット等） [P2]
15. [ ] i18n整備（表記ゆれ対策） [P2]

備考
- 進捗は各項目のチェックボックスに加え、完了日(YYYY-MM-DD)とOwnerを行末に追記します。
- テストはS1〜S2の各項目に紐づけて随時追加（下段「テスト/CI」を参照）。

## S0 基盤（完了）
- [x] エンコーディング検査の整備（ログ除外/対象指定）
  - DoD: `npm test` && `npm run scan:encoding -- --json` が0件
  - 変更: `tools/encodingScanCli.ts`, `tests/encodingScanCli.test.ts`（2025-10-06, Owner: Codex）
- [x] 設定の単一ソース化（Python⇄TSの既定値一致テスト）
  - DoD: `config.py` と `DEFAULT_DUTY_SETTINGS` が一致（テスト通過）
  - 変更: `tests/config.defaults.test.ts`（2025-10-06, Owner: Codex）
- [x] README/DECISIONS/specs の目的明確化（中拘束・交代地点の記載）
  - DoD: 該当テスト通過（2025-10-06, Owner: Codex）
- [x] Manual 入力UIとプロジェクト保存/読込（GTFS+manual）
  - DoD: Manualタブで編集、Import画面で「保存（プロジェクトJSON）」が機能
  - 変更: `src/features/manual/ManualDataView.tsx`, `src/services/import/GtfsImportProvider.tsx`, `src/services/import/gtfsPersistence.ts`, `src/features/import/ImportView.tsx`, `src/App.tsx`（2025-10-07, Owner: Codex）
- [x] Import時の強警告（frequencies/HH≥24:00 検出）
  - DoD: サマリ件数＋「重要な警告」カード表示（2025-10-07, Owner: Codex）

## S1 連結と時間の信頼性（P0）
- [ ] 行路連結ガード（誤連結抑止）
  - 仕様: 親子駅許容/接続半径R(m)/最小折返しT(分) すべてを満たす場合のみ連結。閾値は `manual.linking` から取得。
  - DoD: ユニットテストで「ガードONで誤連結ゼロ」を確認。
  - 変更候補: `src/services/blocks/blockBuilder.ts`
- [ ] 時刻正規化（HH≥24:00）
  - 仕様: stop_times の24時超表記を分に正規化し、Dutyスパン/連続運転計算に反映。
  - DoD: ブロック構築・Dutyメトリクス双方のテストを追加。
  - 変更候補: `gtfsParser.ts` または `blockBuilder.ts`/`dutyMetrics.ts`

## S2 成果物の提供（P0）
- [ ] Blocks CSV 出力（実務成果物）
  - 仕様: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id, schema_version, generated_at, settings_hash`
  - DoD: Blocks画面に「CSV出力」ボタン、テストで列・件数・時刻形式を確認。
  - 変更候補: `src/features/blocks/BlocksView.tsx`（UI）・共通`downloadCsv` util
- [ ] Duties CSV 出力（実務成果物）
  - 仕様: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id, schema_version, generated_at, settings_hash`
  - DoD: Duties画面に「CSV出力」ボタン、テストで列・件数を確認。
  - 変更候補: `src/features/duties/DutiesView.tsx`（UI）・共通`downloadCsv` util

## S3 使い勝手の底上げ（P1）
- [ ] frequencies 展開（静的便生成: `trip_id#n`、`exact_times`対応）
  - DoD: 便数/最終出発時刻が期待通り。0/1の両方を網羅テスト。
- [ ] Manual CSV イン/アウト（将来互換）
  - DoD: `depots/relief_points/deadhead_rules` のCSVラウンドトリップで損失なし。
- [ ] Relief/Deadhead の“存在チェック”警告（表示のみ先行）
  - DoD: 未設定/到達不可のDutyに情報警告。作業は継続可能。

## S4 可視化・オプション（P1〜P2）
- [ ] 簡易ガント（車両ブロック軸 or 仕業軸のどちらか）
  - DoD: 折返し・休憩・違反を重ねて視覚化（最小機能）
- [ ] Explorer オーバーレイ（Depots/Relief points）
- [ ] Diff/Export タブ拡張（CSV導線集約）
- [ ] Drivers 簡易インポート（drivers.csv）
- [ ] KPI系UXの磨き（スクロール/ショートカット等）
- [ ] i18n整備（表記ゆれ対策）

## テスト/CI（S1〜S2で追加）
- [ ] 連結ガードのテスト（接続半径/親子駅/最小折返し）
- [ ] 時刻正規化のテスト（23:50→24:10→25:00 等）
- [ ] CSV出力のテスト（列・件数・タイムスタンプ・ハッシュ）

— ここから下は従来のTODO。必要に応じて上のロードマップへ統合・整理してください —

---

## デモ用シードデータ（P0：短期で導入可能）

目的
- このMVPを“すぐ見せられる”状態にするため、既存GTFSサンプル（`data/GTFS-JP(gunmachuo).zip`）に対して、必要最小の手動データ（乗務員・デポ・交代地点・回送近似・連結しきい値）を私たちが準備する。

成果物（DoD）
- [ ] `docs/demo/project.gunmachuo.json`（GTFS+manual を内包したプロジェクトJSON。Import→「保存（プロジェクトJSON）」の逆操作で即ロード可能）
- [ ] `docs/demo/drivers.csv`（デモ用10名: `driver_id,name`）
- [ ] `docs/demo/depots.csv`（1–2拠点: `depot_id,name,lat,lon,open_time,close_time,min_turnaround_min`）
- [ ] `docs/demo/relief_points.csv`（主要停留所ベース: `relief_id,name,lat,lon,stop_id,walk_time_to_stop_min,allowed_window`）
- [ ] `docs/demo/deadhead_rules.csv`（近似回送: `from_id,to_id,mode,travel_time_min,distance_km,allowed_window`）
- [ ] READMEに「デモ手順」追記（Import→プロジェクトJSON読込→Blocks→Duties まで1分以内）

前提/方針
- データは架空であり、実運行とは無関係。地理はGTFS内の主要`stop_id`に寄せる。
- linkingのデフォルトは「minTurnaround=10分 / 半径100m / 親子駅許容」を設定。

検収観点
- Importでエラー0件、重要警告は既知2種（frequencies/HH≥24）以内。
- Blocksのカバレッジが≥70%（サンプル範囲内）を確認。
- Dutiesで2～3本の例示的な仕業を作り、警告が理解可能な粒度で表示される。

Owner/期日
- Owner: Codex
- 期日: 2025-10-09 までに初版（必要なら追補で更新）

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

- [x] 大きいファイルの分割（≤300 LOC）
  - 対象: `src/features/duties/DutiesView.tsx`、`src/services/duty/dutyState.ts`、`src/services/blocks/blockBuilder.ts`
  - DoD: 既存テスト緑・API/エイリアス互換・各ファイルにヘッダコメント
  - 検証: `npm test`
  - 実施: DutiesView.tsx から trip 選択検証を utils/tripSelection.ts へ分離し、専用テストを追加
  - 完了: 2025-10-06 (Owner: Codex)

---

## P1（MVPの不足埋め・機能拡張）

- [x] Duty編集の Redo と履歴上限
  - DoD: Undo→Redo→Undo のユニットテストが緑、`Ctrl+Y`/`Shift+Ctrl+Z` で動作
  - 検証: `npm test`
  - 実施: Duty state に undo/redo スタックを導入し、Provider/UI/ショートカットと BlockSummaryCard を更新、`tests/duty.state.test.ts` を拡充
  - 完了: 2025-10-06 (Owner: Codex)
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

---

## 追加TODO（2025-10-07 — 設計反映）

P0（最優先）
- [x] Manual 入力UIとプロジェクト保存/読込（GTFS+manual）
  - DoD: Import画面に「保存（プロジェクトJSON）」ボタン。Manualタブで depots/relief_points/deadhead_rules/linking の追加・削除が可能。
  - 変更: `src/features/manual/ManualDataView.tsx`, `src/services/import/GtfsImportProvider.tsx`, `src/services/import/gtfsPersistence.ts`, `src/features/import/ImportView.tsx`, `src/App.tsx`
  - 状態: 完了（2025-10-07, Owner: Codex）
- [x] Import時の強警告（frequencies検出・HH≥24:00検出）
  - DoD: サマリに件数表示、「重要な警告」カード表示。
  - 変更: `src/services/import/gtfsParser.ts`, `src/features/import/ImportView.tsx`
  - 状態: 完了（2025-10-07, Owner: Codex）
- [ ] 行路連結ガード（誤連結抑止）
  - 内容: 親子駅許容/接続半径R(m)/最小折返しT(分)を満たす場合のみ連結。値は `manual.linking` から取得。
  - DoD: ユニットテストで「ガードONで誤連結ゼロ」を確認。
  - 変更候補: `src/services/blocks/blockBuilder.ts`
  - Owner: Codex
- [ ] 時刻正規化（HH≥24:00）
  - 内容: stop_times の 24時超表記を分に正規化し、Dutyスパン/連続運転の計算に反映。
  - DoD: ブロック構築・Dutyメトリクス双方のテストを追加。
  - 変更候補: `gtfsParser.ts` or `blockBuilder.ts`/`dutyMetrics.ts`
  - Owner: Codex
- [ ] Blocks CSV 出力（実務成果物）
  - 仕様: `block_id, seq, trip_id, trip_start, trip_end, from_stop_id, to_stop_id, service_id, schema_version, generated_at, settings_hash`
  - 変更候補: `src/features/blocks/BlocksView.tsx`（UI）, 共通`downloadCsv` util
- [ ] Duties CSV 出力（実務成果物）
  - 仕様: `duty_id, seq, block_id, segment_start_trip_id, segment_end_trip_id, driver_id, schema_version, generated_at, settings_hash`
  - 変更候補: `src/features/duties/DutiesView.tsx`（UI）, 共通`downloadCsv` util

P1（次手）
- [ ] frequencies 展開（静的便生成: `trip_id#n`）
  - DoD: 便数/最終出発時刻が期待どおり。`exact_times`=0/1 を網羅テスト。
- [ ] Relief/Deadhead の“存在チェック”警告（表示のみ先行）
  - 内容: 交代地点未設定/到達不可や回送ルール未設定に情報警告。作業は継続可能。
- [ ] Manual CSV イン/アウト（将来互換）
  - DoD: depots/relief_points/deadhead_rules のCSVラウンドトリップで損失なし。
- [ ] 簡易ガント表示（車両ブロック軸 or 仕業軸のどちらか）
  - DoD: 折返し・休憩・違反を重ねて視覚化（最小機能）。

テスト/CI（2025-10-07 追加）
- [ ] 行路連結ガードのテスト（接続半径/親子駅/最小折返し）
- [ ] 時刻正規化のテスト（23:50→24:10→25:00 等）
- [ ] CSV出力のテスト（列・件数・タイムスタンプ・ハッシュ）
