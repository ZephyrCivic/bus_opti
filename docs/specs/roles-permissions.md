# ロールと権限（RBAC）— Step1

ロール
- Viewer: 閲覧のみ。出力可。設定編集不可。
- Planner: Explorer/Blocks/Dutiesの編集可。出力可。設定編集は不可。
- Admin: すべて可。設定UI（折返し/労務/Depot/交代所）を編集・適用可。監査参照。

画面別×操作
- Explorer/Blocks/Duties: Viewer=閲覧, Planner=編集, Admin=編集
- 設定UI: Viewer=閲覧, Planner=閲覧, Admin=編集/適用
- 出力（CSV/印刷）: 全ロール可（非ブロッキング確認を挟む）
- 監査ログ閲覧: Adminのみ

DoD
- 不正操作はUI無効化＋APIでも拒否
- 権限変更は即時反映、監査に記録
