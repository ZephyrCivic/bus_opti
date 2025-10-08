<!--
  docs/specs/file-write-audit.md
  場所: docs/specs/
  目的: 社内配布時のファイル書き込み権限と監査フローを整理し、運用時の統制を確保する。
  背景: TODO「ファイル書き込みの権限 / 監査整備（社内配布手順）」の DoD を満たす。
-->

# ファイル書き込み権限と監査整備（2025-10-08）

## 背景
- Diff / Export ロールアウトに伴い、`docs/diff-baselines/` や `docs/releases/` などの成果物フォルダが増加。
- ファイル出力はダウンロード権限（`config.py` のロール設定）に依存し、社内統制上の監査ログが必須。
- 社内配布物優先度と承認手順（`docs/specs/distribution-approval.md`）と連携して、書き込み権限の範囲を明確化する。

## 権限モデル
- **ロール定義**  
  - `roles.downloadExport`: Export 履歴・CSV/JSON を取得できる管理者ロール。  
  - `roles.writeAudit`: 監査ログファイル（`docs/audits/`）へ追記できるメンバー。  
  - `roles.releasePublisher`: `docs/releases/` へ新規フォルダを作成できる担当者。  
- **実装ポイント**  
  - `config.py` に上記ロールを追加し、UI 側で `DutySettings` の権限チェックに連動させる。  
  - Playwright / CLI ツールはロールが無い場合に書き込みを拒否し、エラーコード `ERR_ROLE_DENIED` を返す。

## 書き込み先ディレクトリと制御
| ディレクトリ | 用途 | デフォルト権限 | 監査項目 |
| --- | --- | --- | --- |
| `docs/diff-baselines/` | Diff スナップショットの保存 | `downloadExport` | スナップショットID、作成者、対象スプリント |
| `docs/releases/` | リリースノート・配布パック | `releasePublisher` | リリースタグ、承認者、公開日時 |
| `docs/audits/` | 操作監査ログ (CSV/JSON) | `writeAudit` | 操作種別、対象ファイル、ロール、タイムスタンプ |
| `tmp/exports/` | 一時ファイル (zip, csv) | 実行ユーザーのみ | 自動削除ジョブ：24時間以内 |

## 監査フロー
1. **書き込みイベント記録**  
   - CLI / UI で書き込み成功時、`docs/audits/<YYYY-MM-DD>.log` に JSON 1行を追記。  
   - 形式例: `{"action":"export","path":"docs/diff-baselines/baseline-2025-10-08.json","role":"downloadExport","user":"codex","timestamp":"2025-10-08T05:00:00Z"}`  
2. **日次レビュー**  
   - Ops マネージャは毎朝 09:00 JST に最新ログを確認し、異常（ロール不一致・失敗連続）を Slack `#duty-diff-support` へ報告。  
3. **週次アーカイブ**  
   - `docs/audits/` を週単位で zip 化し、社内ストレージへ移動。メタデータを `docs/releases/` の README に追記。  
4. **権限棚卸し**  
   - 毎月第1営業日にロール割当を見直し、不要アカウントは `config.py` から削除。監査ログに棚卸し記録を残す。

## 実装・運用タスク
1. `config.py` にロール設定 (`ROLES = {...}`) を追加し、`src/utils/auth.ts`（新設予定）で参照。  
2. UI からのダウンロード時はロールを確認し、未許可ならトーストで通知。  
3. CLI (`tools/chromeDevtoolsCli.ts`, `tools/playwrightCli.ts`) へ権限チェックオプションを追加。  
4. `npm test` に監査ログフォーマット検証テストを追加し、未記録時は失敗させる。  
5. README に監査フォルダと棚卸し手順を追記。

## リスクと対策
- **ログ改ざん**: ログファイルは append-only とし、ローカルでの直接編集は禁止 → CI で `docs/audits/` の Git diff に手動編集が無いか検査。  
- **権限過多**: 一時的に必要なロールは期限付きでメモし、棚卸し時に失効させる。  
- **ストレージ肥大化**: アーカイブ実施と 90 日超ログの削除スクリプトを整備。  
- **CI 差分検出漏れ**: GitHub Actions に `audit-log-check` ジョブを追加し、未記録書き込みが無いか確認。

## 関連ドキュメント
- `docs/specs/distribution-approval.md`
- `docs/specs/diff-export-rollout.md`
- `config.py`
- `docs/TODO.md`
