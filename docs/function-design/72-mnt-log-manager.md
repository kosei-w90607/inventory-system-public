## MNT-02: 操作ログ管理

### 72.1 モジュール構成

```
src-tauri/src/
  mnt/
    mod.rs           -- pub mod log_manager（既存宣言済み）
    log_manager.rs   -- ログクリーンアップ（本セクション）
  db/
    system_repo.rs   -- list_operation_logs, delete_old_logs を追加（§2.8拡張）
  lib.rs             -- setup hook に cleanup_old_logs 呼び出しを追加
```

---

### 72.2 依存クレート

追加なし。`chrono`（既存依存）を使用。

---

### 72.3 型定義

なし。system_repo の関数を組み合わせるオーケストレーション層。

---

### 72.4 cleanup_old_logs

**関数要求**: 操作ログの自動削除を実行する。1日1回のみ。アプリ起動時にsetup hookから呼ばれる

**シグネチャ**:
```
fn cleanup_old_logs(conn: &DbConnection) -> Result<(), DbError>
```

**処理ステップ**:
1. `system_repo::get_setting(conn, "log_last_cleanup_date")` で最終クリーンアップ日を取得
   - `None` → 初回実行。ステップ3に進む
   - `Some(date_str)` → ステップ2に進む
2. `date_str` を `chrono::NaiveDate` にパース。今日の日付と比較
   - 同日 → 何もせず `Ok(())` を返す（1日1回制限）
   - 異なる日 → ステップ3に進む
   - パース失敗 → ステップ3に進む（不正な値はリセット扱い）
3. `system_repo::get_setting(conn, "log_retention_days")` で保持日数を取得
   - `None` or パース失敗 → デフォルト365日を使用
   - `Some(days_str)` → 整数にパース
4. `system_repo::delete_old_logs(conn, retention_days)` を実行。削除件数を受け取る
5. 削除件数 > 0 の場合:
   - `system_repo::insert_operation_log` で記録:
     - `operation_type`: `"log_cleanup"`
     - `summary`: `"操作ログを{N}件削除しました（{cutoff_date}以前）"`
     - `detail_json`: `None`
6. `system_repo::upsert_setting(conn, "log_last_cleanup_date", &today_str)` で日付を更新
7. `Ok(())` を返す

**エラーハンドリング**:
- DB操作失敗 → `DbError` をそのまま返す
- 呼び出し元（lib.rs）で `tracing::warn!` して続行する（ログクリーンアップ失敗はアプリ起動を止めない）

---

### 72.5 lib.rs 起動シーケンスの変更

**追加箇所**: DB初期化（ステップ5）の後、State管理（ステップ8）の前

```
// 6. 操作ログ自動削除（DB初期化後に実行）
if let Err(e) = mnt::log_manager::cleanup_old_logs(&conn) {
    tracing::warn!(error = %e, "操作ログの自動削除に失敗");
}
```

---

### 72.6 テスト方針

| テスト名 | 検証内容 |
|---------|---------|
| `test_cleanup_old_logs_mnt02_first_run` | `log_last_cleanup_date`キー未存在時にクリーンアップ実行 |
| `test_cleanup_old_logs_mnt02_same_day_skip` | 同日2回目の呼び出しでスキップ |
| `test_cleanup_old_logs_mnt02_deletes_expired` | 366日前のログが削除される |
| `test_cleanup_old_logs_mnt02_keeps_recent` | 364日前のログが保持される |
| `test_cleanup_old_logs_mnt02_records_cleanup` | 削除後にoperation_type='log_cleanup'のログが記録される |
| `test_cleanup_old_logs_mnt02_updates_date` | 実行後にlog_last_cleanup_dateが今日に更新される |
