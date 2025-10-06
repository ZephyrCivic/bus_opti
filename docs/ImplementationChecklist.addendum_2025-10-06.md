# Implementation Checklist Addendum（2025-10-06）

本補遺は `docs/ImplementationChecklist.md` に対する追加タスクです。MVPのスコープ変更はありません。小さく安全に進めるため、既存チェックリストを維持しつつ以下を追記します。

## A. 合意反映（ドキュメント）
- [x] README（英/和）へ「仕様確定事項（2025-10-06）」を追記
- [x] Decisions ドキュメントの追加（docs/DECISIONS_2025-10-06.md）

## B. UI/機能タスク
- [ ] Block達成度のUI表示（対象service日のTripに対する候補提示率：70〜80%目標）
- [ ] Dutyルールの警告に「中拘束」「交代地点制約」を追加
- [ ] 任意GTFS ZIPの再読込（サンプル: `GTFS-JP(gunmachuo).zip`）
- [ ] マップタイルを MapLibre + OSM で既定化（環境変数や設定で将来差し替え可能に）

## C. Export/スキーマ
- [ ] CSVエクスポートのスキーマを README のMVP案に合わせる（`driver_id` を採用）
- [ ] 文字コード/改行/時間表現（24時超）に関する自動テストを追加

## D. テスト/確認
- [ ] READMEの決定事項が崩れていないことのスモークテスト（見出し/キーワード）
- [ ] ルール警告（中拘束/交代地点制約）単体テスト

## E. ドキュメント整合性とエンコーディング
- [x] 文字化け検出CLI（`npx tsx tools/encodingScanCli.ts`）の追加
- [x] 運用ガイドライン `docs/encoding-guidelines.md` の作成
- [ ] docs/ImplementationChecklist.md / docs/README_JA.md をUTF-8へ再保存し、必要箇所へガイドラインをリンク
- [ ] コミット前チェックの一環として `npm run scan:encoding` を導線化（README記載 or pre-commit）
