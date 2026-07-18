//! MNT-01: バックアップ・リストア
//!
//! SQLiteデータベースのバックアップ作成・復元・自動チェックを提供する。
//!
//! docs/function-design/71-mnt-backup.md に基づく実装。

use crate::db::{self, DbConnection, DbError, NewOperationLog};
use std::path::{Path, PathBuf};

#[cfg(test)]
thread_local! {
    static SETTING_READ_FAILURE: std::cell::RefCell<Option<String>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
pub(crate) struct SettingReadFailureGuard {
    previous: Option<String>,
}

#[cfg(test)]
impl Drop for SettingReadFailureGuard {
    fn drop(&mut self) {
        SETTING_READ_FAILURE.with(|failure| {
            *failure.borrow_mut() = self.previous.take();
        });
    }
}

#[cfg(test)]
pub(crate) fn fail_setting_read(key: &str) -> SettingReadFailureGuard {
    let previous = SETTING_READ_FAILURE.with(|failure| failure.replace(Some(key.to_string())));
    SettingReadFailureGuard { previous }
}

fn get_backup_setting(conn: &DbConnection, key: &str) -> Result<Option<String>, DbError> {
    #[cfg(test)]
    {
        SETTING_READ_FAILURE.with(|failure| {
            if failure.borrow().as_deref() == Some(key) {
                return Err(DbError::QueryFailed(format!(
                    "injected setting read failure: {key}"
                )));
            }
            db::system_repo::get_setting(conn, key)
        })
    }

    #[cfg(not(test))]
    {
        db::system_repo::get_setting(conn, key)
    }
}

pub use super::restore::RestoreError;

/// バックアップ snapshot へ crash-consistent に置換する（MNT-01-D1/D4/D5）。
pub fn restore_backup(
    current_conn: DbConnection,
    backup_path: &Path,
    db_path: &Path,
) -> Result<DbConnection, RestoreError> {
    super::restore::restore_backup(current_conn, backup_path, db_path)
}

pub(crate) fn reconcile_restore(db_path: &Path) -> Result<(), RestoreError> {
    super::restore::reconcile_restore(db_path).map(|_| ())
}

pub(crate) fn complete_reconciled_restore(
    conn: &DbConnection,
    db_path: &Path,
) -> Result<(), RestoreError> {
    super::restore::complete_reconciled_restore(conn, db_path)
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const BACKUP_PREFIX: &str = "inventory_backup_";
const BACKUP_EXT: &str = ".db";
/// デフォルトのバックアップ保持日数（設定行が存在しない場合）
const DEFAULT_RETENTION_DAYS: u32 = 3;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// バックアップ作成結果
///
/// 71-mnt-backup.md §71.3
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct BackupResult {
    pub file_path: String,
    pub file_name: String,
    pub size_bytes: u64,
}

/// バックアップファイル情報（一覧表示用）
///
/// 71-mnt-backup.md §71.3
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct BackupInfo {
    pub file_name: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// プライベートヘルパー
// ---------------------------------------------------------------------------

/// ファイル名からYYYYMMDD部分を抽出してNaiveDateに変換
///
/// パターン: `inventory_backup_YYYYMMDD_HHMMSS.db`
fn extract_date_from_backup(filename: &str) -> Option<chrono::NaiveDate> {
    let stem = filename.strip_prefix(BACKUP_PREFIX)?;
    let stem = stem.strip_suffix(BACKUP_EXT)?;
    // stem = "YYYYMMDD_HHMMSS" の完全一致のみ削除対象（§71.5 ステップ2a-2d）。
    // 日付部分だけの検証では inventory_backup_YYYYMMDD_manual.db のような
    // 非 timestamp suffix のファイルまで削除対象になる
    if stem.len() != 15 || stem.as_bytes()[8] != b'_' {
        return None;
    }
    let date_part = &stem[..8];
    let time_part = &stem[9..];
    chrono::NaiveTime::parse_from_str(time_part, "%H%M%S").ok()?;
    chrono::NaiveDate::parse_from_str(date_part, "%Y%m%d").ok()
}

/// ファイル名からYYYYMMDD_HHMMSS部分を抽出して "YYYY-MM-DD HH:MM:SS" に変換
fn extract_datetime_from_backup(filename: &str) -> Option<String> {
    let stem = filename.strip_prefix(BACKUP_PREFIX)?;
    let stem = stem.strip_suffix(BACKUP_EXT)?;
    if stem.len() != 15 {
        return None;
    }
    let date_part = &stem[..8];
    let time_part = &stem[9..];
    if stem.as_bytes()[8] != b'_' || time_part.len() != 6 {
        return None;
    }
    // 日付・時刻のパースチェック
    chrono::NaiveDate::parse_from_str(date_part, "%Y%m%d").ok()?;
    chrono::NaiveTime::parse_from_str(time_part, "%H%M%S").ok()?;

    Some(format!(
        "{}-{}-{} {}:{}:{}",
        &date_part[..4],
        &date_part[4..6],
        &date_part[6..8],
        &time_part[..2],
        &time_part[2..4],
        &time_part[4..6],
    ))
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// バックアップディレクトリを解決する
///
/// 71-mnt-backup.md §71.9
///
/// app_settings の backup_path を優先し、未設定/空なら app_data/backups をデフォルトとする。
pub fn resolve_backup_dir(conn: &DbConnection, app_data: &Path) -> Result<PathBuf, DbError> {
    Ok(get_backup_setting(conn, "backup_path")?
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data.join("backups")))
}

/// SQLiteデータベースの安全なバックアップを作成する
///
/// 71-mnt-backup.md §71.4
///
/// VACUUM INTO でWAL変更を取り込んだ単一.dbファイルを生成する。
pub fn create_backup(conn: &DbConnection, backup_dir: &Path) -> Result<BackupResult, DbError> {
    // 1. ディレクトリ作成
    std::fs::create_dir_all(backup_dir).map_err(|e| {
        DbError::QueryFailed(format!("バックアップディレクトリの作成に失敗: {}", e))
    })?;

    // 2. ファイル名生成
    let now = chrono::Local::now();
    let file_name = format!(
        "{}{}{}",
        BACKUP_PREFIX,
        now.format("%Y%m%d_%H%M%S"),
        BACKUP_EXT
    );
    let backup_path = backup_dir.join(&file_name);
    let path_str = backup_path.to_string_lossy().to_string();

    // 3. VACUUM INTO（シングルクォートをエスケープ）
    let escaped_path = path_str.replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", escaped_path))
        .map_err(|e| DbError::QueryFailed(format!("VACUUM INTOに失敗: {}", e)))?;

    // 4. ファイルサイズ取得
    let size_bytes = std::fs::metadata(&backup_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // 5. 操作ログ記録（失敗してもバックアップは成功扱い）
    if let Err(e) = db::system_repo::insert_operation_log(
        conn,
        &NewOperationLog {
            operation_type: "backup_create".to_string(),
            summary: format!("バックアップを作成しました: {}", file_name),
            detail_json: Some(format!(
                r#"{{"file_name":"{}","size_bytes":{}}}"#,
                file_name, size_bytes
            )),
        },
    ) {
        tracing::warn!(error = %e, "バックアップ操作ログの記録に失敗");
    }

    Ok(BackupResult {
        file_path: path_str,
        file_name,
        size_bytes,
    })
}

/// 保持日数を超えた古いバックアップファイルを削除する
///
/// 71-mnt-backup.md §71.5
pub fn cleanup_old_backups(backup_dir: &Path, retention_days: u32) -> Result<u32, std::io::Error> {
    let entries = match std::fs::read_dir(backup_dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(e) => return Err(e),
    };

    let today = chrono::Local::now().date_naive();
    let mut deleted = 0u32;

    for entry in entries {
        let entry = entry?;
        let filename = entry.file_name();
        let filename_str = filename.to_string_lossy();

        if let Some(file_date) = extract_date_from_backup(&filename_str) {
            let age = today - file_date;
            if age.num_days() > i64::from(retention_days) {
                if let Err(e) = std::fs::remove_file(entry.path()) {
                    tracing::warn!(
                        file = %filename_str,
                        error = %e,
                        "古いバックアップファイルの削除に失敗"
                    );
                } else {
                    deleted += 1;
                }
            }
        }
    }

    Ok(deleted)
}

/// バックアップディレクトリ内のバックアップファイル一覧を返す
///
/// 71-mnt-backup.md §71.6
///
/// 新しい順（created_at DESC）でソート。
pub fn list_backups(backup_dir: &Path) -> Result<Vec<BackupInfo>, std::io::Error> {
    let entries = match std::fs::read_dir(backup_dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e),
    };

    let mut backups = Vec::new();

    for entry in entries {
        let entry = entry?;
        let filename = entry.file_name();
        let filename_str = filename.to_string_lossy().to_string();

        if let Some(created_at) = extract_datetime_from_backup(&filename_str) {
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let file_path = entry.path().to_string_lossy().to_string();

            backups.push(BackupInfo {
                file_name: filename_str,
                file_path,
                size_bytes,
                created_at,
            });
        }
    }

    // 新しい順
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

/// 自動バックアップの条件を判定し、必要なら実行する
///
/// 71-mnt-backup.md §71.8
///
/// 起動時に呼ばれる。backup_enabled=1の場合のみ動作。
/// 今日のバックアップが無ければ即実行、あればbackup_time到達後に2回目実行。
pub fn check_auto_backup(conn: &DbConnection, backup_dir: &Path) -> Result<bool, DbError> {
    // 1. backup_enabled チェック
    let enabled = db::system_repo::get_setting(conn, "backup_enabled")?;
    if enabled.as_deref() != Some("1") {
        return Ok(false);
    }

    // 2. 今日の日付
    let now = chrono::Local::now();
    let today_str = now.format("%Y%m%d").to_string();
    let today_prefix = format!("{}{}_", BACKUP_PREFIX, today_str);

    // 3. 今日のバックアップファイルを走査
    let today_files: Vec<String> = match std::fs::read_dir(backup_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with(&today_prefix) && name.ends_with(BACKUP_EXT) {
                    Some(name)
                } else {
                    None
                }
            })
            .collect(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => vec![],
        Err(e) => {
            return Err(DbError::QueryFailed(format!(
                "バックアップディレクトリの読み取りに失敗: {}",
                e
            )));
        }
    };

    // 4. 今日のバックアップが無い → 即実行
    if today_files.is_empty() {
        create_backup(conn, backup_dir)?;
        run_cleanup(conn, backup_dir);
        return Ok(true);
    }

    // 5. backup_time チェック
    let backup_time = match db::system_repo::get_setting(conn, "backup_time")? {
        Some(t) if !t.is_empty() => t,
        _ => return Ok(false),
    };

    // 6. HH:MM パース
    let target_time = match chrono::NaiveTime::parse_from_str(&backup_time, "%H:%M") {
        Ok(t) => t,
        Err(_) => {
            tracing::warn!(
                backup_time = %backup_time,
                "backup_timeのパースに失敗（定時バックアップをスキップ）"
            );
            return Ok(false);
        }
    };

    // 7. 現在時刻がbackup_time より前 → スキップ
    if now.time() < target_time {
        return Ok(false);
    }

    // 8. backup_time以降のバックアップがあるか確認
    let target_hhmmss = target_time.format("%H%M%S").to_string();
    let has_post_time_backup = today_files.iter().any(|name| {
        // ファイル名から HHMMSS 部分を抽出
        name.strip_prefix(&today_prefix)
            .and_then(|rest| rest.strip_suffix(BACKUP_EXT))
            .map(|hhmmss| hhmmss >= target_hhmmss.as_str())
            .unwrap_or(false)
    });

    if has_post_time_backup {
        return Ok(false);
    }

    // 9. backup_time以降のバックアップなし → 実行
    create_backup(conn, backup_dir)?;
    run_cleanup(conn, backup_dir);
    Ok(true)
}

/// cleanup_old_backups を設定値で実行するヘルパー（エラーはwarnのみ）
fn run_cleanup(conn: &DbConnection, backup_dir: &Path) {
    let retention_days = match get_backup_setting(conn, "backup_retention_days") {
        Ok(Some(value)) => match value.parse::<u32>() {
            Ok(days) => days,
            Err(e) => {
                tracing::warn!(
                    backup_retention_days = %value,
                    error = %e,
                    "backup_retention_daysのparseに失敗（cleanupをスキップ）"
                );
                return;
            }
        },
        Ok(None) => DEFAULT_RETENTION_DAYS,
        Err(e) => {
            tracing::warn!(
                error = %e,
                "backup_retention_daysの読取に失敗（cleanupをスキップ）"
            );
            return;
        }
    };

    if let Err(e) = cleanup_old_backups(backup_dir, retention_days) {
        tracing::warn!(error = %e, "古いバックアップの削除に失敗");
    }
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

    fn write_backup_days_old(backup_dir: &Path, days: i64) -> PathBuf {
        std::fs::create_dir_all(backup_dir).unwrap();
        let date = (chrono::Local::now().date_naive() - chrono::Duration::days(days))
            .format("%Y%m%d")
            .to_string();
        let path = backup_dir.join(format!("{BACKUP_PREFIX}{date}_120000{BACKUP_EXT}"));
        std::fs::write(&path, "synthetic backup").unwrap();
        path
    }

    #[test]
    fn test_resolve_backup_dir_req901_d2_propagates_db_error() {
        // REQ-901 / MNT-01-D2 / Matrix C1
        let (dir, conn) = setup_test_db();
        let _failure = fail_setting_read("backup_path");

        let result = resolve_backup_dir(&conn, dir.path());

        assert!(
            matches!(result, Err(DbError::QueryFailed(message)) if message.contains("backup_path"))
        );
    }

    #[test]
    fn test_resolve_backup_dir_req901_d2_defaults_when_missing() {
        // REQ-901 / MNT-01-D2 / Matrix C2
        let (dir, conn) = setup_test_db();
        conn.execute("DELETE FROM app_settings WHERE key = 'backup_path'", [])
            .unwrap();

        assert_eq!(
            resolve_backup_dir(&conn, dir.path()).unwrap(),
            dir.path().join("backups")
        );
    }

    #[test]
    fn test_resolve_backup_dir_req901_d2_defaults_when_empty() {
        // REQ-901 / MNT-01-D2 / Matrix C3
        let (dir, conn) = setup_test_db();
        db::system_repo::upsert_setting(&conn, "backup_path", "").unwrap();

        assert_eq!(
            resolve_backup_dir(&conn, dir.path()).unwrap(),
            dir.path().join("backups")
        );
    }

    #[test]
    fn test_resolve_backup_dir_req901_d2_uses_configured_path() {
        // REQ-901 / MNT-01-D2 / Matrix C4
        let (dir, conn) = setup_test_db();
        let configured = dir.path().join("configured-backups");
        db::system_repo::upsert_setting(
            &conn,
            "backup_path",
            configured.to_string_lossy().as_ref(),
        )
        .unwrap();

        assert_eq!(resolve_backup_dir(&conn, dir.path()).unwrap(), configured);
    }

    #[test]
    fn test_resolve_backup_dir_req901_d2_all_callers_handle_result_contract() {
        // REQ-901 / MNT-01-D2 / Matrix C7
        let lib = include_str!("../lib.rs");
        let settings = include_str!("../cmd/settings_cmd.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap();
        assert_eq!(lib.matches("mnt::backup::resolve_backup_dir").count(), 1);
        assert_eq!(settings.matches("backup::resolve_backup_dir").count(), 1);
        assert!(lib.contains("match mnt::backup::resolve_backup_dir"));
        assert!(settings.contains("backup::resolve_backup_dir(conn, &app_data).map_err(db_err)"));
    }

    #[test]
    fn test_run_cleanup_req901_d3_missing_setting_uses_default() {
        // REQ-901 / MNT-01-D3 / Matrix D1
        let (dir, conn) = setup_test_db();
        conn.execute(
            "DELETE FROM app_settings WHERE key = 'backup_retention_days'",
            [],
        )
        .unwrap();
        let backup_dir = dir.path().join("backups");
        let expired = write_backup_days_old(&backup_dir, 4);

        run_cleanup(&conn, &backup_dir);

        assert!(!expired.exists(), "未設定時は既定3日で削除するべき");
    }

    #[test]
    fn test_check_auto_backup_req901_d3_db_error_skips_cleanup_but_keeps_backup() {
        // REQ-901 / MNT-01-D3 / Matrix D2
        let (dir, conn) = setup_test_db();
        db::system_repo::upsert_setting(&conn, "backup_enabled", "1").unwrap();
        let backup_dir = dir.path().join("backups");
        let expired = write_backup_days_old(&backup_dir, 4);
        let _failure = fail_setting_read("backup_retention_days");

        let (result, logs) = crate::test_tracing::capture(|| check_auto_backup(&conn, &backup_dir));

        assert!(result.unwrap(), "cleanup失敗でもbackup作成は成功するべき");
        assert!(
            expired.exists(),
            "保持日数を読めない場合は削除してはならない"
        );
        assert!(
            list_backups(&backup_dir).unwrap().len() >= 2,
            "既存syntheticファイルに加えて新規backupが作成されるべき"
        );
        assert!(
            logs.contains("WARN") && logs.contains("cleanup"),
            "logs={logs:?}"
        );
    }

    #[test]
    fn test_run_cleanup_req901_d3_parse_error_skips_cleanup() {
        // REQ-901 / MNT-01-D3 / Matrix D3
        let (dir, conn) = setup_test_db();
        db::system_repo::upsert_setting(&conn, "backup_retention_days", "abc").unwrap();
        let backup_dir = dir.path().join("backups");
        let expired = write_backup_days_old(&backup_dir, 4);

        let (_, logs) = crate::test_tracing::capture(|| run_cleanup(&conn, &backup_dir));

        assert!(expired.exists(), "parse不能時は削除してはならない");
        assert!(
            logs.contains("WARN") && logs.contains("parse"),
            "logs={logs:?}"
        );
    }

    #[test]
    fn test_run_cleanup_req901_d3_uses_valid_retention() {
        // REQ-901 / MNT-01-D3 / Matrix D4
        let (dir, conn) = setup_test_db();
        db::system_repo::upsert_setting(&conn, "backup_retention_days", "90").unwrap();
        let backup_dir = dir.path().join("backups");
        let four_days_old = write_backup_days_old(&backup_dir, 4);

        run_cleanup(&conn, &backup_dir);

        assert!(four_days_old.exists(), "設定した90日基準を使うべき");
    }

    // -----------------------------------------------------------------------
    // create_backup テスト（4件）
    // -----------------------------------------------------------------------

    #[test]
    fn test_create_backup_req901_creates_file() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: VACUUM INTO でバックアップファイルが生成される
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        let result = create_backup(&conn, &backup_dir).unwrap();

        assert!(
            Path::new(&result.file_path).exists(),
            "バックアップファイルが存在するべき"
        );
        assert!(result.size_bytes > 0, "ファイルサイズが0より大きいべき");
    }

    #[test]
    fn test_create_backup_req901_filename_format() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: ファイル名が inventory_backup_YYYYMMDD_HHMMSS.db 形式
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        let result = create_backup(&conn, &backup_dir).unwrap();

        assert!(
            result.file_name.starts_with(BACKUP_PREFIX),
            "ファイル名が {} で始まるべき: {}",
            BACKUP_PREFIX,
            result.file_name
        );
        assert!(
            result.file_name.ends_with(BACKUP_EXT),
            "ファイル名が {} で終わるべき: {}",
            BACKUP_EXT,
            result.file_name
        );
        // YYYYMMDD_HHMMSS 部分が15文字
        let stem = result
            .file_name
            .strip_prefix(BACKUP_PREFIX)
            .unwrap()
            .strip_suffix(BACKUP_EXT)
            .unwrap();
        assert_eq!(stem.len(), 15, "日時部分は15文字であるべき: {}", stem);
    }

    #[test]
    fn test_create_backup_req901_data_integrity() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: バックアップDBに現在のデータが含まれる
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        // テストデータを挿入
        conn.execute(
            "INSERT INTO suppliers (name, created_at) VALUES ('テスト取引先', '2026-01-01T00:00:00')",
            [],
        )
        .unwrap();

        let result = create_backup(&conn, &backup_dir).unwrap();

        // バックアップDBを開いてデータ確認
        let backup_conn = rusqlite::Connection::open(&result.file_path).unwrap();
        let name: String = backup_conn
            .query_row(
                "SELECT name FROM suppliers WHERE name = 'テスト取引先'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "テスト取引先");
    }

    #[test]
    fn test_create_backup_req901_logs_operation() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: operation_type='backup_create' のログが記録される
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        create_backup(&conn, &backup_dir).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'backup_create'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "backup_create ログが1件記録されるべき");
    }

    // -----------------------------------------------------------------------
    // cleanup_old_backups テスト（2件）
    // -----------------------------------------------------------------------

    #[test]
    fn test_cleanup_old_backups_req901_deletes_expired() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: 保持日数超過ファイルが削除される
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        // 10日前のファイルを作成
        let old_date = (chrono::Local::now().date_naive() - chrono::Duration::days(10))
            .format("%Y%m%d")
            .to_string();
        let old_file = backup_dir.join(format!(
            "{}{}_{}{}",
            BACKUP_PREFIX, old_date, "120000", BACKUP_EXT
        ));
        std::fs::write(&old_file, "dummy").unwrap();

        let deleted = cleanup_old_backups(&backup_dir, 3).unwrap();

        assert_eq!(deleted, 1, "1件削除されるべき");
        assert!(!old_file.exists(), "古いファイルは削除されるべき");
    }

    #[test]
    fn test_cleanup_old_backups_req901_skips_non_timestamp_suffix() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01 §71.5 ステップ2a-2d / Matrix D5a: ファイル名は
        // inventory_backup_YYYYMMDD_HHMMSS.db の完全一致のみ削除対象。
        // 非 timestamp suffix（手動リネーム等）は保持日数超過でも削除しない
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        let old_date = (chrono::Local::now().date_naive() - chrono::Duration::days(10))
            .format("%Y%m%d")
            .to_string();
        // stem 長 15 だが suffix が時刻でない（"_manual" は separator 込みで 7 文字）
        let manual_file = backup_dir.join(format!("{BACKUP_PREFIX}{old_date}_manual{BACKUP_EXT}"));
        std::fs::write(&manual_file, "synthetic manual copy").unwrap();
        // separator 位置が '_' でないケース
        let no_sep_file = backup_dir.join(format!("{BACKUP_PREFIX}{old_date}x120000{BACKUP_EXT}"));
        std::fs::write(&no_sep_file, "synthetic").unwrap();

        let deleted = cleanup_old_backups(&backup_dir, 3).unwrap();

        assert_eq!(deleted, 0, "パターン不一致ファイルは削除件数に含めない");
        assert!(
            manual_file.exists(),
            "非 timestamp suffix は削除してはならない"
        );
        assert!(no_sep_file.exists(), "separator 不一致は削除してはならない");
    }

    #[test]
    fn test_cleanup_old_backups_req901_warns_and_continues_on_delete_failure() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01 §71.5 ステップ2g / Matrix D5b: 個別ファイルの削除失敗は
        // tracing::warn! を記録して次のファイルへ進む（全体を中断しない）
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        let old_date = (chrono::Local::now().date_naive() - chrono::Duration::days(10))
            .format("%Y%m%d")
            .to_string();
        // パターン一致名の「ディレクトリ」= remove_file が決定論的に失敗する
        let undeletable = backup_dir.join(format!("{BACKUP_PREFIX}{old_date}_120000{BACKUP_EXT}"));
        std::fs::create_dir_all(&undeletable).unwrap();
        // 通常の削除対象ファイル（処理順に依存せず削除継続を検証できる）
        let deletable = backup_dir.join(format!("{BACKUP_PREFIX}{old_date}_130000{BACKUP_EXT}"));
        std::fs::write(&deletable, "synthetic").unwrap();

        let (result, logs) = crate::test_tracing::capture(|| cleanup_old_backups(&backup_dir, 3));

        assert_eq!(
            result.unwrap(),
            1,
            "削除失敗があっても他ファイルの削除は継続"
        );
        assert!(undeletable.exists(), "削除失敗対象は残る");
        assert!(!deletable.exists(), "後続の削除対象は削除される");
        assert!(
            logs.contains("WARN") && logs.contains("削除に失敗"),
            "logs={logs:?}"
        );
    }

    #[test]
    fn test_cleanup_old_backups_req901_keeps_recent() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: 保持日数内のファイルが保持される
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        // 今日のファイルを作成
        let today = chrono::Local::now()
            .date_naive()
            .format("%Y%m%d")
            .to_string();
        let recent_file = backup_dir.join(format!(
            "{}{}_{}{}",
            BACKUP_PREFIX, today, "120000", BACKUP_EXT
        ));
        std::fs::write(&recent_file, "dummy").unwrap();

        // 2日前のファイルを作成
        let two_days_ago = (chrono::Local::now().date_naive() - chrono::Duration::days(2))
            .format("%Y%m%d")
            .to_string();
        let recent_file2 = backup_dir.join(format!(
            "{}{}_{}{}",
            BACKUP_PREFIX, two_days_ago, "120000", BACKUP_EXT
        ));
        std::fs::write(&recent_file2, "dummy").unwrap();

        let deleted = cleanup_old_backups(&backup_dir, 3).unwrap();

        assert_eq!(deleted, 0, "削除されるべきファイルは無い");
        assert!(recent_file.exists(), "今日のファイルは保持されるべき");
        assert!(recent_file2.exists(), "2日前のファイルは保持されるべき");
    }

    // -----------------------------------------------------------------------
    // list_backups テスト（2件）
    // -----------------------------------------------------------------------

    #[test]
    fn test_list_backups_req901_returns_sorted() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: 新しい順でBackupInfoが返される
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        // 古いファイル
        let file1 = backup_dir.join(format!("{}20260410_100000{}", BACKUP_PREFIX, BACKUP_EXT));
        std::fs::write(&file1, "old").unwrap();

        // 新しいファイル
        let file2 = backup_dir.join(format!("{}20260413_150000{}", BACKUP_PREFIX, BACKUP_EXT));
        std::fs::write(&file2, "new").unwrap();

        let list = list_backups(&backup_dir).unwrap();

        assert_eq!(list.len(), 2, "2件返されるべき");
        assert_eq!(
            list[0].created_at, "2026-04-13 15:00:00",
            "1番目は新しいファイル"
        );
        assert_eq!(
            list[1].created_at, "2026-04-10 10:00:00",
            "2番目は古いファイル"
        );
    }

    #[test]
    fn test_list_backups_req901_empty_dir() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: 空ディレクトリで空Vecが返される
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        let list = list_backups(&backup_dir).unwrap();
        assert!(list.is_empty(), "空のVecが返されるべき");
    }

    // -----------------------------------------------------------------------
    // restore_backup テスト（3件）
    // -----------------------------------------------------------------------

    #[test]
    fn test_restore_backup_req901_replaces_data() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: リストア後にバックアップ時点のデータに戻る
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("main.db");
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        // 初期状態のDBを作成
        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();

        // データ挿入（バックアップに含まれるべき）
        conn.execute(
            "INSERT INTO suppliers (name, created_at) VALUES ('バックアップ前', '2026-01-01T00:00:00')",
            [],
        )
        .unwrap();

        // バックアップ作成
        let backup_result = create_backup(&conn, &backup_dir).unwrap();

        // バックアップ後に追加データ挿入
        conn.execute(
            "INSERT INTO suppliers (name, created_at) VALUES ('バックアップ後', '2026-01-02T00:00:00')",
            [],
        )
        .unwrap();

        // リストア前にバックアップ後のデータが存在することを確認
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM suppliers", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2, "リストア前は2件あるべき");

        // リストア実行
        let backup_path = Path::new(&backup_result.file_path);
        let new_conn = restore_backup(conn, backup_path, &db_path).unwrap();

        // リストア後のデータ確認
        let count: i64 = new_conn
            .query_row("SELECT COUNT(*) FROM suppliers", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "リストア後は1件（バックアップ時点）に戻るべき");

        let name: String = new_conn
            .query_row("SELECT name FROM suppliers LIMIT 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(name, "バックアップ前", "バックアップ時点のデータであるべき");
    }

    #[test]
    fn test_restore_backup_req901_nonexistent_file() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01-D4: 存在しない復元対象は元接続を壊さない recoverable error
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("main.db");
        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();

        let nonexistent = dir.path().join("nonexistent.db");
        let result = restore_backup(conn, &nonexistent, &db_path);

        assert!(result.is_err(), "エラーが返されるべき");
        assert!(matches!(result.unwrap_err(), RestoreError::Recovered(_)));
    }

    #[test]
    fn test_restore_backup_req901_runs_migration() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: init_database がマイグレーション実行することを間接確認
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("main.db");
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();
        let backup_result = create_backup(&conn, &backup_dir).unwrap();

        // リストア実行（init_databaseが呼ばれてPRAGMA再設定 + マイグレーション実行）
        let backup_path = Path::new(&backup_result.file_path);
        let new_conn = restore_backup(conn, backup_path, &db_path).unwrap();

        // PRAGMA foreign_keys が再設定されていることを確認
        let fk_enabled: i64 = new_conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk_enabled, 1, "foreign_keysが有効であるべき");

        // schema_versionsテーブルが存在することを確認（マイグレーション済み）
        let version: i64 = new_conn
            .query_row("SELECT MAX(version) FROM schema_versions", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert!(version >= 1, "マイグレーションが実行済みであるべき");
    }

    // -----------------------------------------------------------------------
    // check_auto_backup テスト（4件）
    // -----------------------------------------------------------------------

    #[test]
    fn test_check_auto_backup_req901_disabled() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: backup_enabled=0 でスキップ
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        // backup_enabled を 0 に設定
        db::system_repo::upsert_setting(&conn, "backup_enabled", "0").unwrap();

        let result = check_auto_backup(&conn, &backup_dir).unwrap();
        assert!(!result, "バックアップ無効時はfalseが返されるべき");
    }

    #[test]
    fn test_check_auto_backup_req901_no_backup_today() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: 今日のバックアップなしで即実行
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        // backup_enabled を有効化
        db::system_repo::upsert_setting(&conn, "backup_enabled", "1").unwrap();

        let result = check_auto_backup(&conn, &backup_dir).unwrap();
        assert!(result, "今日のバックアップが無ければ実行されるべき");

        // バックアップファイルが作成されたことを確認
        let list = list_backups(&backup_dir).unwrap();
        assert_eq!(list.len(), 1, "バックアップファイルが1件作成されるべき");
    }

    #[test]
    fn test_check_auto_backup_req901_already_backed_up() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: 今日のバックアップありでスキップ（backup_time未設定）
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        // backup_enabled を有効化
        db::system_repo::upsert_setting(&conn, "backup_enabled", "1").unwrap();

        // 初期スキーマで backup_time='23:00' が設定されるため、明示的にクリア
        // （23時以降にテスト実行すると定時バックアップ判定に入り失敗するため）
        db::system_repo::upsert_setting(&conn, "backup_time", "").unwrap();

        // 今日のダミーバックアップファイルを作成
        let today = chrono::Local::now().format("%Y%m%d").to_string();
        let dummy = backup_dir.join(format!(
            "{}{}_{}{}",
            BACKUP_PREFIX, today, "080000", BACKUP_EXT
        ));
        std::fs::write(&dummy, "dummy").unwrap();

        let result = check_auto_backup(&conn, &backup_dir).unwrap();
        assert!(
            !result,
            "今日のバックアップがあり、backup_time未設定ならスキップされるべき"
        );
    }

    #[test]
    fn test_check_auto_backup_req901_scheduled_time() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: backup_time到達で2回目のバックアップ実行
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        // backup_enabled を有効化
        db::system_repo::upsert_setting(&conn, "backup_enabled", "1").unwrap();

        // backup_time を 00:00 に設定（テスト実行時には必ず過ぎている）
        db::system_repo::upsert_setting(&conn, "backup_time", "00:00").unwrap();

        // 今日の「早朝」バックアップ（00:00より前の00:00:00はありえないが、テスト用）
        // backup_time(00:00) 以前のバックアップとして判定されるよう、
        // check_auto_backup の「backup_time以降のバックアップがあるか」チェックを通過させる必要がある。
        // ただし 00:00 の場合、000000 >= 000000 は true なので、
        // backup_time を "00:01" にして 000000 < 000100 を成立させる。
        db::system_repo::upsert_setting(&conn, "backup_time", "00:01").unwrap();

        let today = chrono::Local::now().format("%Y%m%d").to_string();
        let early_backup = backup_dir.join(format!(
            "{}{}_{}{}",
            BACKUP_PREFIX, today, "000000", BACKUP_EXT
        ));
        std::fs::write(&early_backup, "dummy").unwrap();

        let result = check_auto_backup(&conn, &backup_dir).unwrap();
        assert!(
            result,
            "backup_time以降のバックアップが無ければ実行されるべき"
        );

        // 合計2ファイル（ダミー + 新規作成）
        let list = list_backups(&backup_dir).unwrap();
        assert!(
            list.len() >= 2,
            "ダミー + 新規のバックアップが存在するべき: 実際={}",
            list.len()
        );
    }

    #[test]
    fn test_check_auto_backup_req901_read_dir_error() {
        // REQ-901: バックアップ
        // Task: MNT-01
        // MNT-01: backup_dir がファイルの場合、NotFound以外のエラーで DbError を返す
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        // ディレクトリではなくファイルを作成 → read_dir が "Not a directory" で失敗
        std::fs::write(&backup_dir, "not a directory").unwrap();

        db::system_repo::upsert_setting(&conn, "backup_enabled", "1").unwrap();

        let result = check_auto_backup(&conn, &backup_dir);
        assert!(result.is_err(), "read_dir失敗時はエラーが返されるべき");
        match result.unwrap_err() {
            DbError::QueryFailed(msg) => {
                assert!(
                    msg.contains("読み取りに失敗"),
                    "エラーメッセージが適切であるべき: {}",
                    msg
                );
            }
            other => panic!("QueryFailedが期待されるが、{:?} が返された", other),
        }
    }
}
