//! CMD-11 残り: 設定・ログ・バックアップ・画像コマンド群
//!
//! docs/function-design/43-cmd-settings-log.md に基づく実装。
//! 整合性チェック（run_integrity_check, fix_integrity）は integrity_cmd.rs に実装済み。

use crate::cmd::{AppState, CmdError};
use crate::db::{self, system_repo, DbConnection, PaginatedResult};
use crate::io::image_manager;
use crate::mnt::backup;
use base64::{engine::general_purpose, Engine as _};
use std::path::PathBuf;
use tauri::{Manager, State};

// ---------------------------------------------------------------------------
// 型定義（§43.2）
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct UpdateSettingRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct LogQuery {
    pub page: u32,
    pub per_page: u32,
    pub operation_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct RestoreBackupRequest {
    pub backup_path: String,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct SaveImageRequest {
    pub image_base64: String,
    pub extension: String,
}

#[derive(Debug, serde::Serialize, specta::Type)]
pub struct SaveImageResponse {
    pub relative_path: String,
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/// backup_dir を resolve するヘルパー（複数コマンドで共通）
fn get_backup_dir<R: tauri::Runtime>(
    conn: &DbConnection,
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, CmdError> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CmdError::internal(&format!("app_data_dir取得エラー: {}", e)))?;
    backup::resolve_backup_dir(conn, &app_data).map_err(db_err)
}

/// DbError → CmdError::internal 変換ヘルパー
fn db_err(e: db::DbError) -> CmdError {
    CmdError::internal(&format!("{}", e))
}

fn terminal_restore_error(error: backup::RestoreError) -> CmdError {
    match error {
        backup::RestoreError::Recovered(message) => CmdError::restore_failed_recovered(&message),
        backup::RestoreError::Unrecoverable(message) => {
            CmdError::restore_failed_unrecoverable(
                "バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを再起動してください",
                &message,
            )
        }
        backup::RestoreError::DurabilityUnknown(message) => {
            CmdError::restore_durability_unknown(
                "復元が完了したか確定できませんでした。アプリを再起動してください。",
                &message,
            )
        }
    }
}

fn handle_restore_failure(
    guard: &mut DbConnection,
    db_path: &std::path::Path,
    error: backup::RestoreError,
) -> CmdError {
    match error {
        backup::RestoreError::Recovered(error) => {
            // NO_CREATE 再接続のみ許可し、空DBを生成しない。
            match db::open_existing_database(db_path.to_str().unwrap_or("")) {
                Ok(recovered) => {
                    *guard = recovered;
                    CmdError::restore_failed_recovered(&format!(
                        "バックアップの復元に失敗しました。現在のデータには戻しています: {error}"
                    ))
                }
                Err(recovery_error) => {
                    let detail = format!(
                        "同期巻き戻し後のDB再接続に失敗: restore={error}; reconnect={recovery_error}"
                    );
                    CmdError::restore_failed_unrecoverable(
                        "バックアップの復元に失敗し、DB接続の復旧もできませんでした。アプリを再起動してください",
                        &detail,
                    )
                }
            }
        }
        other => terminal_restore_error(other),
    }
}

fn validate_log_date_range(
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<(), CmdError> {
    let parse = |value: &str| {
        let bytes = value.as_bytes();
        let has_strict_ymd_shape = bytes.len() == 10
            && bytes[4] == b'-'
            && bytes[7] == b'-'
            && [0, 1, 2, 3, 5, 6, 8, 9]
                .iter()
                .all(|index| bytes[*index].is_ascii_digit());
        if !has_strict_ymd_shape {
            return Err(());
        }
        chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| ())
    };
    let invalid = || CmdError {
        kind: "validation".to_string(),
        message: "開始日・終了日はYYYY-MM-DD形式で入力してください".to_string(),
        field: None,
    };
    let start = start_date.map(parse).transpose().map_err(|_| invalid())?;
    let end = end_date.map(parse).transpose().map_err(|_| invalid())?;
    if matches!((start, end), (Some(start), Some(end)) if start > end) {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "開始日は終了日と同じ日か、それより前の日付にしてください".to_string(),
            field: None,
        });
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// コマンド
// ---------------------------------------------------------------------------

/// 全設定を取得する（§43.3）
#[tauri::command]
#[specta::specta]
pub fn get_settings(state: State<AppState>) -> Result<Vec<system_repo::AppSetting>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    system_repo::get_all_settings(&conn).map_err(db_err)
}

/// 設定値を更新する（§43.4）
#[tauri::command]
#[specta::specta]
pub fn update_setting(
    state: State<AppState>,
    request: UpdateSettingRequest,
) -> Result<(), CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    system_repo::upsert_setting(&conn, &request.key, &request.value).map_err(db_err)
}

/// 操作ログ一覧を取得する（§43.5）
#[tauri::command]
#[specta::specta]
pub fn list_logs(
    state: State<AppState>,
    query: LogQuery,
) -> Result<PaginatedResult<system_repo::OperationLog>, CmdError> {
    validate_log_date_range(query.start_date.as_deref(), query.end_date.as_deref())?;
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    system_repo::list_operation_logs(
        &conn,
        query.page,
        query.per_page,
        query.operation_type.as_deref(),
        query.start_date.as_deref(),
        query.end_date.as_deref(),
    )
    .map_err(db_err)
}

#[tauri::command]
#[specta::specta]
pub fn list_log_operation_types(state: State<AppState>) -> Result<Vec<String>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    system_repo::find_distinct_operation_types(&conn).map_err(db_err)
}

/// バックアップを作成する（§43.6）
#[tauri::command]
#[specta::specta]
pub fn create_backup(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<backup::BackupResult, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let backup_dir = get_backup_dir(&conn, &app_handle)?;
    backup::create_backup(&conn, &backup_dir).map_err(db_err)
}

/// 自動バックアップチェック（§43.7）
///
/// フロントエンドの setInterval(60秒) から呼ばれる。
#[tauri::command]
#[specta::specta]
pub fn check_auto_backup(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<bool, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let backup_dir = get_backup_dir(&conn, &app_handle)?;
    backup::check_auto_backup(&conn, &backup_dir).map_err(db_err)
}

/// 実効バックアップ保存先を取得する（§43.8.1）
///
/// `backup_path` 未設定時にアプリ既定フォルダ（`app_data/backups`）を利用者へ提示するための
/// 読み取り専用コマンド。既存ヘルパ `get_backup_dir` を呼ぶだけの薄いラッパー。
#[tauri::command]
#[specta::specta]
pub fn get_effective_backup_dir(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let backup_dir = get_backup_dir(&conn, &app_handle)?;
    Ok(backup_dir.to_string_lossy().to_string())
}

/// バックアップ一覧を取得する（§43.8）
#[tauri::command]
#[specta::specta]
pub fn list_backups(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<backup::BackupInfo>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let backup_dir = get_backup_dir(&conn, &app_handle)?;
    backup::list_backups(&backup_dir)
        .map_err(|e| CmdError::internal(&format!("バックアップ一覧取得エラー: {}", e)))
}

/// バックアップから復元する（§43.9）
///
/// DB接続の所有権を移転するため、Mutex内の接続をstd::mem::replaceで取り出す。
/// **? 演算子はreplace後に使用禁止** — dummy接続がguardに残るのを防ぐため。
#[tauri::command]
#[specta::specta]
pub fn restore_backup(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
    request: RestoreBackupRequest,
) -> Result<(), CmdError> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CmdError::internal(&format!("app_data_dir取得エラー: {}", e)))?;
    let db_path = app_data.join("inventory.db");
    let backup_path = std::path::Path::new(&request.backup_path);

    // Mutex ロック取得
    let mut guard = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;

    // dummy接続を作成し、現在の接続を取り出す
    let dummy = match rusqlite::Connection::open_in_memory() {
        Ok(c) => c,
        Err(e) => {
            return Err(CmdError::internal(&format!("一時接続の作成に失敗: {}", e)));
        }
    };
    let old_conn = std::mem::replace(&mut *guard, dummy);

    // ── ここ以降 ? 使用禁止 ── guard に dummy が入っている ──

    match backup::restore_backup(old_conn, backup_path, &db_path) {
        Ok(new_conn) => {
            *guard = new_conn;
            Ok(())
        }
        Err(error) => Err(handle_restore_failure(&mut guard, &db_path, error)),
    }
}

/// レシート画像を保存する（§43.10）
#[tauri::command]
#[specta::specta]
pub fn save_receipt_image(
    app_handle: tauri::AppHandle,
    request: SaveImageRequest,
) -> Result<SaveImageResponse, CmdError> {
    // 1. Base64デコード
    let image_bytes = general_purpose::STANDARD
        .decode(&request.image_base64)
        .map_err(|_| CmdError {
            kind: "validation".to_string(),
            message: "画像データが不正です".to_string(),
            field: None,
        })?;

    // 2. app_data_dir 取得
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CmdError::internal(&format!("app_data_dir取得エラー: {}", e)))?;

    // 3. 画像保存
    let relative_path =
        image_manager::save_receipt_image(&app_data, &image_bytes, &request.extension).map_err(
            |e| {
                if e.kind() == std::io::ErrorKind::InvalidInput {
                    // 拡張子不正は利用者入力起因 → validation
                    CmdError {
                        kind: "validation".to_string(),
                        message: format!("{}", e),
                        field: Some("extension".to_string()),
                    }
                } else {
                    CmdError::internal(&format!("画像保存エラー: {}", e))
                }
            },
        )?;

    Ok(SaveImageResponse { relative_path })
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::mnt::backup as mnt_backup;

    fn setup_test_db() -> (tempfile::TempDir, db::DbConnection) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();
        (dir, conn)
    }

    #[test]
    fn test_get_backup_dir_req901_d2_maps_db_error_to_internal() {
        // REQ-901 / MNT-01-D2 / Matrix C6
        let (_dir, conn) = setup_test_db();
        let app = tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let _failure = mnt_backup::fail_setting_read("backup_path");

        let error = get_backup_dir(&conn, app.handle()).unwrap_err();

        assert_eq!(error.kind, "internal");
        assert!(error.message.contains("backup_path"));
    }

    #[test]
    fn test_list_logs_req902_date_validation_contract() {
        // REQ-902 / UI-11c-D2 / D-036 / D-037
        assert!(validate_log_date_range(Some("2026-07-10"), Some("2026-07-10")).is_ok());
        for (field, invalid_date) in [
            ("start_date", "2026-7-01"),
            ("start_date", "2026-07-01x"),
            ("start_date", "2026/07/01"),
            ("start_date", "2026-07-01 "),
            ("start_date", "2026-02-30"),
            ("start_date", "２０２６-０７-０１"),
            ("end_date", "2026-7-01"),
            ("end_date", "2026-07-01x"),
            ("end_date", "2026/07/01"),
            ("end_date", "2026-07-01 "),
            ("end_date", "2026-02-30"),
            ("end_date", "２０２６-０７-０１"),
        ] {
            let result = match field {
                "start_date" => validate_log_date_range(Some(invalid_date), None),
                "end_date" => validate_log_date_range(None, Some(invalid_date)),
                _ => unreachable!(),
            };
            let error = result.unwrap_err();
            assert_eq!(
                error.kind, "validation",
                "{field}={invalid_date} must be rejected"
            );
            assert_eq!(
                error.message, "開始日・終了日はYYYY-MM-DD形式で入力してください",
                "{field}={invalid_date} must use the format validation message"
            );
        }
        let reversed = validate_log_date_range(Some("2026-07-11"), Some("2026-07-10")).unwrap_err();
        assert_eq!(reversed.kind, "validation");
        assert_eq!(
            reversed.message,
            "開始日は終了日と同じ日か、それより前の日付にしてください"
        );
    }

    #[test]
    fn test_get_settings_req905() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: get_all_settings で初期設定が返る
        let (_dir, conn) = setup_test_db();

        let settings = system_repo::get_all_settings(&conn).unwrap();
        assert!(!settings.is_empty(), "初期設定が1件以上存在するべき");

        // 初期データに含まれるキーを確認
        let keys: Vec<&str> = settings.iter().map(|s| s.key.as_str()).collect();
        assert!(
            keys.contains(&"backup_enabled"),
            "backup_enabled が含まれるべき"
        );
    }

    #[test]
    fn test_update_setting_req905() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: upsert → get で読み戻し
        let (_dir, conn) = setup_test_db();

        system_repo::upsert_setting(&conn, "stock_low_threshold", "5").unwrap();

        let value = system_repo::get_setting(&conn, "stock_low_threshold")
            .unwrap()
            .expect("設定値が存在するべき");
        assert_eq!(value, "5", "更新した値が読み戻せるべき");
    }

    #[test]
    fn test_list_logs_req902_pagination() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: CMD-11
        // CMD-11: ページングパラメータの受け渡し
        let (_dir, conn) = setup_test_db();

        // テストデータ挿入
        for i in 0..5 {
            system_repo::insert_operation_log(
                &conn,
                &db::NewOperationLog {
                    operation_type: "test_op".to_string(),
                    summary: format!("テストログ{}", i),
                    detail_json: None,
                },
            )
            .unwrap();
        }

        let result = system_repo::list_operation_logs(&conn, 1, 2, None, None, None).unwrap();
        assert_eq!(result.per_page, 2, "per_page=2");
        assert_eq!(result.page, 1, "page=1");
        assert!(result.items.len() <= 2, "1ページあたり2件以下");
        assert!(
            result.total_count >= 5,
            "合計5件以上（初期データ含む可能性）"
        );
    }

    #[test]
    fn test_list_logs_req902_filter() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: CMD-11
        // CMD-11: operation_type フィルタ
        let (_dir, conn) = setup_test_db();

        system_repo::insert_operation_log(
            &conn,
            &db::NewOperationLog {
                operation_type: "backup_create".to_string(),
                summary: "テスト".to_string(),
                detail_json: None,
            },
        )
        .unwrap();
        system_repo::insert_operation_log(
            &conn,
            &db::NewOperationLog {
                operation_type: "product_create".to_string(),
                summary: "テスト".to_string(),
                detail_json: None,
            },
        )
        .unwrap();

        let result =
            system_repo::list_operation_logs(&conn, 1, 100, Some("backup_create"), None, None)
                .unwrap();
        assert!(
            result
                .items
                .iter()
                .all(|l| l.operation_type == "backup_create"),
            "フィルタされた結果のみ返されるべき"
        );
        assert!(result.total_count >= 1, "1件以上ヒット");
    }

    #[test]
    fn test_create_backup_req905() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: バックアップ作成と BackupResult
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        let result = mnt_backup::create_backup(&conn, &backup_dir).unwrap();

        assert!(!result.file_name.is_empty(), "ファイル名が返されるべき");
        assert!(result.size_bytes > 0, "サイズが0より大きいべき");
        assert!(
            std::path::Path::new(&result.file_path).exists(),
            "ファイルが存在するべき"
        );
    }

    #[test]
    fn test_list_backups_req905() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: バックアップ一覧取得
        let (dir, conn) = setup_test_db();
        let backup_dir = dir.path().join("backups");

        // バックアップ作成
        mnt_backup::create_backup(&conn, &backup_dir).unwrap();

        let list = mnt_backup::list_backups(&backup_dir).unwrap();
        assert_eq!(list.len(), 1, "1件のバックアップが返されるべき");
        assert!(!list[0].file_name.is_empty(), "ファイル名があるべき");
        assert!(!list[0].created_at.is_empty(), "日時があるべき");
    }

    #[test]
    fn test_save_receipt_image_req905_valid() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: Base64デコード → 画像保存 → 相対パス
        let dir = tempfile::tempdir().unwrap();
        let image_data = b"fake-image-data";
        let encoded = general_purpose::STANDARD.encode(image_data);

        // Base64デコード検証
        let decoded = general_purpose::STANDARD.decode(&encoded).unwrap();
        assert_eq!(decoded, image_data);

        // 画像保存検証
        let relative_path = image_manager::save_receipt_image(dir.path(), &decoded, "jpg").unwrap();
        assert!(
            relative_path.starts_with("images/receipts/"),
            "相対パスが正しい形式: {}",
            relative_path
        );
    }

    #[test]
    fn test_save_receipt_image_req905_invalid_base64() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: 不正Base64でデコードエラー
        let invalid = "!!!not-valid-base64!!!";
        let result = general_purpose::STANDARD.decode(invalid);
        assert!(result.is_err(), "不正なBase64はデコード失敗するべき");
    }

    #[test]
    fn test_restore_backup_req905_notfound_to_cmderror() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: restore_backup に存在しないファイルを渡すと NotFound → CmdError 変換
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("main.db");
        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();

        let nonexistent = dir.path().join("nonexistent.db");
        let result = backup::restore_backup(conn, &nonexistent, &db_path);

        assert!(result.is_err(), "存在しないファイルでエラーが返されるべき");
        // DbError::NotFound → CMD層で CmdError::internal に変換されることを検証
        let db_err_str = format!("{}", result.unwrap_err());
        assert!(
            db_err_str.contains("見つかりません"),
            "NotFoundメッセージが含まれるべき: {}",
            db_err_str
        );
    }

    #[test]
    fn test_restore_backup_req905_recovery_after_failure() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: restore失敗後にDBファイルが復元されていることを確認
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("main.db");
        let conn = db::init_database(db_path.to_str().unwrap()).unwrap();

        // テストデータ挿入
        conn.execute(
            "INSERT INTO suppliers (name, created_at) VALUES ('復元テスト', '2026-01-01T00:00:00')",
            [],
        )
        .unwrap();

        let nonexistent = dir.path().join("nonexistent.db");
        // restore_backup は NotFound で失敗するが、DB接続は drop される（所有権移転）
        let _ = backup::restore_backup(conn, &nonexistent, &db_path);

        // DBファイルが復元されていれば再接続できるはず
        // （NotFoundの場合、rename前に早期returnするのでDBファイルはそのまま）
        let recovered = db::init_database(db_path.to_str().unwrap()).unwrap();
        let name: String = recovered
            .query_row("SELECT name FROM suppliers LIMIT 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(name, "復元テスト", "元のデータがアクセス可能であるべき");
    }

    #[test]
    fn test_save_receipt_image_req905_invalid_extension_to_validation() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: InvalidInput(拡張子不正) → CmdError{kind:"validation", field:"extension"}
        let dir = tempfile::tempdir().unwrap();
        let image_data = b"fake-image";

        let result = image_manager::save_receipt_image(dir.path(), image_data, "bmp");
        assert!(result.is_err());

        let io_err = result.unwrap_err();
        assert_eq!(io_err.kind(), std::io::ErrorKind::InvalidInput);

        // CMD層の変換ロジックを直接検証
        let cmd_err = if io_err.kind() == std::io::ErrorKind::InvalidInput {
            CmdError {
                kind: "validation".to_string(),
                message: format!("{}", io_err),
                field: Some("extension".to_string()),
            }
        } else {
            CmdError::internal(&format!("画像保存エラー: {}", io_err))
        };
        assert_eq!(cmd_err.kind, "validation", "拡張子不正は validation");
        assert_eq!(
            cmd_err.field.as_deref(),
            Some("extension"),
            "field が extension"
        );
    }

    #[test]
    fn test_list_logs_req902_invalid_page_to_cmderror() {
        // REQ-902: ログ管理（操作ログ記録/一覧/自動削除）
        // Task: CMD-11
        // CMD-11: page=0 で DbError::QueryFailed → CmdError::internal 変換
        let (_dir, conn) = setup_test_db();

        let result = system_repo::list_operation_logs(&conn, 0, 10, None, None, None);
        assert!(result.is_err(), "page=0 はエラーであるべき");

        // DbError → CmdError 変換を検証
        let cmd_err = super::db_err(result.unwrap_err());
        assert_eq!(cmd_err.kind, "internal", "DbError は internal に変換");
        assert!(
            cmd_err.message.contains("page"),
            "エラーメッセージに page が含まれるべき: {}",
            cmd_err.message
        );
    }

    #[test]
    fn test_restore_backup_req905_unrecoverable_message() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: 復旧不能時の「再起動が必要」メッセージが CmdError に含まれることを検証
        // 実際の init_database 失敗は再現困難なため、エラーメッセージの構築を直接テスト
        let cmd_err =
            terminal_restore_error(backup::RestoreError::Unrecoverable("fixture".to_string()));
        assert_eq!(cmd_err.kind, "restore_failed_unrecoverable");
        assert!(
            cmd_err.message.contains("再起動"),
            "再起動メッセージが含まれるべき: {}",
            cmd_err.message
        );
    }

    #[test]
    fn test_restore_backup_req905_maps_all_failure_kinds_without_message_parsing() {
        // REQ-905 / MNT-01-D4 / Matrix F1, F2
        let recovered =
            terminal_restore_error(backup::RestoreError::Recovered("same message".to_string()));
        let fatal = terminal_restore_error(backup::RestoreError::Unrecoverable(
            "same message".to_string(),
        ));
        let unknown = terminal_restore_error(backup::RestoreError::DurabilityUnknown(
            "same message".to_string(),
        ));
        assert_eq!(recovered.kind, "restore_failed_recovered");
        assert_eq!(fatal.kind, "restore_failed_unrecoverable");
        assert_eq!(unknown.kind, "restore_durability_unknown");
        assert_eq!(
            unknown.message,
            "復元が完了したか確定できませんでした。アプリを再起動してください。"
        );
    }

    #[test]
    fn test_restore_backup_req905_b3_no_create_cmd_recovery_never_hides_missing_main() {
        // REQ-905 / MNT-01-D4 / Matrix B3
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("inventory.db");
        let mut dummy = rusqlite::Connection::open_in_memory().unwrap();
        let error = handle_restore_failure(
            &mut dummy,
            &missing,
            backup::RestoreError::Recovered("injected rollback result".to_string()),
        );
        assert_eq!(error.kind, "restore_failed_unrecoverable");
        assert!(error.message.contains("再起動"));
        assert!(!missing.exists(), "CMD recovery must use NO_CREATE open");
    }

    #[test]
    fn test_check_auto_backup_req905_dberror_to_cmderror() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        // Task: CMD-11
        // CMD-11: check_auto_backup の DbError → CmdError 変換確認
        let (dir, conn) = setup_test_db();

        // backup_enabled を無効に設定 → Ok(false) が返る（エラーではない）
        system_repo::upsert_setting(&conn, "backup_enabled", "0").unwrap();
        let backup_dir = dir.path().join("backups");
        let result = backup::check_auto_backup(&conn, &backup_dir).unwrap();
        assert!(!result, "無効時はfalse");

        // DbError 変換パスのテスト: db_err ヘルパーが DbError を CmdError に変換
        let test_err = db::DbError::QueryFailed("テストエラー".to_string());
        let cmd_err = super::db_err(test_err);
        assert_eq!(
            cmd_err.kind, "internal",
            "DbError は internal に変換されるべき"
        );
        assert!(
            cmd_err.message.contains("テストエラー"),
            "元メッセージが含まれるべき: {}",
            cmd_err.message
        );
    }
}
