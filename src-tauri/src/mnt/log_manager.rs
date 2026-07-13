//! MNT-02: 操作ログ管理
//!
//! 操作ログの自動削除を提供する。アプリ起動時に1日1回実行。
//!
//! docs/function-design/72-mnt-log-manager.md に基づく実装。

use crate::db::{self, DbConnection, DbError, NewOperationLog};

/// デフォルトのログ保持日数（app_settingsから取得できない場合）
const DEFAULT_RETENTION_DAYS: u32 = 365;

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// 操作ログの自動削除を実行する（1日1回制限）
///
/// 72-mnt-log-manager.md §72.4
///
/// アプリ起動時にsetup hookから呼ばれる。
/// `log_last_cleanup_date` が今日と同じ場合はスキップ。
pub fn cleanup_old_logs(conn: &DbConnection) -> Result<(), DbError> {
    let today = chrono::Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    // 1. 最終クリーンアップ日を取得
    if let Some(date_str) = db::system_repo::get_setting(conn, "log_last_cleanup_date")? {
        // 2. 今日と比較（パース失敗は無視して続行）
        if let Ok(last_date) = chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
            if last_date == today {
                return Ok(()); // 同日 → スキップ
            }
        }
    }

    // 3. 保持日数を取得（取得失敗やパース失敗はデフォルト365日）
    let retention_days = db::system_repo::get_setting(conn, "log_retention_days")?
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(DEFAULT_RETENTION_DAYS);

    // 4. 古いログを削除
    let deleted = db::system_repo::delete_old_logs(conn, retention_days)?;

    // 5. 削除件数 > 0 ならログに記録
    if deleted > 0 {
        let cutoff_date = (today - chrono::Duration::days(i64::from(retention_days)))
            .format("%Y-%m-%d")
            .to_string();
        db::system_repo::insert_operation_log(
            conn,
            &NewOperationLog {
                operation_type: "log_cleanup".to_string(),
                summary: format!("操作ログを{}件削除しました（{}以前）", deleted, cutoff_date),
                detail_json: None,
            },
        )?;
    }

    // 6. 最終クリーンアップ日を更新
    db::system_repo::upsert_setting(conn, "log_last_cleanup_date", &today_str)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn setup_test_db() -> (tempfile::TempDir, DbConnection) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();
        (dir, conn)
    }

    /// 古いログを手動INSERTするヘルパー
    fn insert_log_with_date(conn: &DbConnection, created_at: &str) {
        conn.execute(
            "INSERT INTO operation_logs (operation_type, summary, created_at)
             VALUES ('test_op', 'テスト', ?1)",
            rusqlite::params![created_at],
        )
        .unwrap();
    }

    #[test]
    fn test_cleanup_old_logs_req902_first_run() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: MNT-02
        // MNT-02: log_last_cleanup_date 未存在時にクリーンアップ実行
        let (_dir, conn) = setup_test_db();

        // log_last_cleanup_date は初期データに含まれない
        let before = db::system_repo::get_setting(&conn, "log_last_cleanup_date").unwrap();
        assert!(before.is_none(), "初期データにlog_last_cleanup_dateは無い");

        // 古いログを挿入
        insert_log_with_date(&conn, "2025-01-01T10:00:00");

        // cleanup実行
        cleanup_old_logs(&conn).unwrap();

        // 古いログが削除された
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'test_op'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "古いログは削除されるべき");
    }

    #[test]
    fn test_cleanup_old_logs_req902_same_day_skip() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: MNT-02
        // MNT-02: 同日2回目の呼び出しでスキップ
        let (_dir, conn) = setup_test_db();

        // 1回目: 実行される
        cleanup_old_logs(&conn).unwrap();

        // 古いログを2回目の前に挿入
        insert_log_with_date(&conn, "2025-01-01T10:00:00");

        // 2回目: スキップされる
        cleanup_old_logs(&conn).unwrap();

        // 古いログが残っている（2回目はスキップされたため）
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'test_op'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "2回目はスキップされるため古いログは残る");
    }

    #[test]
    fn test_cleanup_old_logs_req902_deletes_expired() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: MNT-02
        // MNT-02: 366日前のログが削除される（retention_days=365）
        let (_dir, conn) = setup_test_db();

        let expired_date = (chrono::Local::now().date_naive() - chrono::Duration::days(366))
            .format("%Y-%m-%dT10:00:00")
            .to_string();
        insert_log_with_date(&conn, &expired_date);

        cleanup_old_logs(&conn).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'test_op'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "366日前のログは削除されるべき");
    }

    #[test]
    fn test_cleanup_old_logs_req902_keeps_recent() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: MNT-02
        // MNT-02: 364日前のログが保持される（retention_days=365）
        let (_dir, conn) = setup_test_db();

        let recent_date = (chrono::Local::now().date_naive() - chrono::Duration::days(364))
            .format("%Y-%m-%dT10:00:00")
            .to_string();
        insert_log_with_date(&conn, &recent_date);

        cleanup_old_logs(&conn).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'test_op'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "364日前のログは保持されるべき");
    }

    #[test]
    fn test_cleanup_old_logs_req902_records_cleanup() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: MNT-02
        // MNT-02: 削除後にoperation_type='log_cleanup'のログが記録される
        let (_dir, conn) = setup_test_db();

        insert_log_with_date(&conn, "2025-01-01T10:00:00");

        cleanup_old_logs(&conn).unwrap();

        let summary: String = conn
            .query_row(
                "SELECT summary FROM operation_logs WHERE operation_type = 'log_cleanup'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            summary.contains("1件削除しました"),
            "削除件数がsummaryに含まれるべき: {}",
            summary
        );
    }

    #[test]
    fn test_cleanup_old_logs_req902_updates_date() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: MNT-02
        // MNT-02: 実行後にlog_last_cleanup_dateが今日に更新される
        let (_dir, conn) = setup_test_db();

        cleanup_old_logs(&conn).unwrap();

        let date = db::system_repo::get_setting(&conn, "log_last_cleanup_date")
            .unwrap()
            .expect("log_last_cleanup_date が設定されているべき");
        let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
        assert_eq!(date, today_str, "今日の日付が記録されるべき");
    }
}
