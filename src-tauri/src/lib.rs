// UI層未実装のため、IO/BIZ層の一部関数・型が未使用。UI実装時に解消される
#[allow(dead_code)]
mod biz;
mod cmd;
#[allow(dead_code)]
mod constants;
// pub: dev bin (src/bin/seed_demo_data.rs) から init_database / DbError を使用する
#[allow(dead_code)]
pub mod db;
#[allow(dead_code)]
mod io;
#[allow(dead_code)]
mod mnt;

// pub: dev tooling 専用のデモデータ seed ロジック。src/bin/seed_demo_data.rs と
// tests/seed_test.rs から参照される
#[allow(dead_code)]
pub mod seed_demo;

use cmd::AppState;
use mnt::diagnostic_log::DiagnosticLogConfig;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug)]
enum StartupDatabaseError {
    RestoreReconcile(String),
    LegacyMigration(String),
    DatabaseInit(String),
}

impl std::fmt::Display for StartupDatabaseError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RestoreReconcile(message)
            | Self::LegacyMigration(message)
            | Self::DatabaseInit(message) => formatter.write_str(message),
        }
    }
}

impl StartupDatabaseError {
    fn operator_message(&self) -> Option<String> {
        match self {
            Self::RestoreReconcile(details) => Some(format!(
                "前回の復元状態を安全に確定できませんでした。データ保護のため起動を中止します。\nアプリを再起動してください。繰り返し失敗する場合は管理者へ連絡してください。\n{details}"
            )),
            Self::LegacyMigration(details) => Some(format!(
                "旧データは無事です。アプリを再起動すると移行を再試行します。\n繰り返し失敗する場合は管理者へ連絡してください。\n{details}"
            )),
            // 既存 init_database 失敗経路の可視化は本 PR の scope 外。
            Self::DatabaseInit(_) => None,
        }
    }
}

fn prepare_database(app_data: &std::path::Path) -> Result<db::DbConnection, StartupDatabaseError> {
    prepare_database_with(
        app_data,
        || {
            std::env::current_dir()
                .map_err(|error| format!("作業フォルダを確認できません: {error}"))
        },
        db::migrate_legacy_db,
    )
}

fn prepare_database_with<C, F>(
    app_data: &std::path::Path,
    cwd: C,
    migrate: F,
) -> Result<db::DbConnection, StartupDatabaseError>
where
    C: FnOnce() -> Result<std::path::PathBuf, String>,
    F: FnOnce(&std::path::Path, &std::path::Path) -> Result<bool, std::io::Error>,
{
    prepare_database_with_init(app_data, cwd, migrate, db::init_database)
}

fn prepare_database_with_init<C, F, I>(
    app_data: &std::path::Path,
    cwd: C,
    migrate: F,
    init: I,
) -> Result<db::DbConnection, StartupDatabaseError>
where
    C: FnOnce() -> Result<std::path::PathBuf, String>,
    F: FnOnce(&std::path::Path, &std::path::Path) -> Result<bool, std::io::Error>,
    I: FnOnce(&str) -> Result<db::DbConnection, db::DbError>,
{
    let db_path = app_data.join("inventory.db");
    mnt::backup::reconcile_restore(&db_path)
        .map_err(|error| StartupDatabaseError::RestoreReconcile(error.to_string()))?;

    let new_db_exists = db_path.try_exists().map_err(|error| {
        StartupDatabaseError::LegacyMigration(format!("新DBの存在確認に失敗しました: {error}"))
    })?;
    if !new_db_exists {
        let cwd = cwd().map_err(StartupDatabaseError::LegacyMigration)?;
        match migrate(&cwd, app_data) {
            Ok(true) => tracing::info!(
                old_dir = %cwd.display(),
                new_dir = %app_data.display(),
                "既存DBを安全な単一snapshotへ移行しました（旧ファイルは保持）"
            ),
            Ok(false) => {}
            Err(error) => {
                return Err(StartupDatabaseError::LegacyMigration(format!(
                    "旧DBの移行に失敗しました: {error}"
                )))
            }
        }
    }

    let db_path_text = db_path.to_str().ok_or_else(|| {
        StartupDatabaseError::DatabaseInit("DBパスの文字列変換に失敗".to_string())
    })?;
    let conn = init(db_path_text)
        .map_err(|error| StartupDatabaseError::DatabaseInit(error.to_string()))?;
    if let Err(error) = mnt::backup::complete_reconciled_restore(&conn, &db_path) {
        // committed snapshot は利用可能。ログ補完/manifest cleanup は次回起動で再試行する。
        tracing::warn!(%error, "復元後処理の補完を次回起動へ持ち越し");
    }
    Ok(conn)
}

fn show_pre_window_fatal(message: &str) {
    tracing::error!(message, "pre-window initialization failed");
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

        let title: Vec<u16> = std::ffi::OsStr::new("Inventory startup error")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let body: Vec<u16> = std::ffi::OsStr::new(message)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let dialog = std::thread::spawn(move || unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                body.as_ptr(),
                title.as_ptr(),
                MB_OK | MB_ICONERROR,
            )
        });
        if dialog.join().is_err() {
            tracing::error!("pre-window error dialog thread panicked");
        }
    }
    #[cfg(not(windows))]
    eprintln!("起動できませんでした: {message}");
}

/// tauri-specta で TS 型 bindings を `src/lib/bindings.ts` に生成（ADR-002 / 2026-04-20 採用）
///
/// `#[specta::specta]` を付けた command の Rust 型を TypeScript 型定義 + command wrapper に
/// 変換して出力する。`src/lib/bindings.ts` は **git tracked (vendor-in 運用、PR commit に同梱)**、
/// debug build 時と `bin/generate_bindings` 経由で自動再生成される。
///
/// - debug build: `run()` の先頭から呼ばれて毎起動時に最新化
/// - release build: 呼ばれない（bindings.ts は開発時のみ必要）
/// - `.gitignore:38` で vendor-in に切替済（旧: gitignore 対象 / 現: PR に含めて push）
///
/// 現時点で specta 適用済み:
/// - CMD-01: create_product / update_product / toggle_discontinue / search_products / list_departments / list_suppliers / get_product / preview_import / commit_import
/// - CMD-02: create_receiving / list_receivings
/// - CMD-03: create_return / list_returns
/// - CMD-04: create_manual_sale
/// - CMD-05: create_disposal / list_disposals
/// - CMD-05b: list_inventory_records / get_disposal_record
/// - CMD-06: get_stock_detail / list_low_stock / list_movements
/// - CMD-07: parse_and_validate_csv / commit_csv_import / rollback_csv_import / list_csv_imports
/// - CMD-12: parse_and_validate_daily_report / commit_daily_report_import / rollback_daily_report_import / list_daily_report_imports
/// - CMD-08: prepare_plu_export / confirm_plu_export_saved / list_plu_dirty
/// - CMD-09: get_daily_sales / get_monthly_sales / export_sales_csv
/// - CMD-10: get_active_stocktake / start_stocktake / get_stocktake_items / find_stocktake_item / get_last_completed_stocktake / update_count / complete_stocktake
/// - CMD-11: get_settings / update_setting / list_logs / create_backup / check_auto_backup / list_backups / restore_backup / save_receipt_image
///
/// Phase 2 以降で段階的に拡張する。
#[cfg(debug_assertions)]
pub fn export_specta_bindings() {
    use tauri_specta::{collect_commands, Builder};

    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        // CMD-01: 商品管理
        cmd::product_cmd::create_product,
        cmd::product_cmd::update_product,
        cmd::product_cmd::toggle_discontinue,
        cmd::product_cmd::search_products,
        cmd::product_cmd::list_departments,
        cmd::product_cmd::list_suppliers,
        cmd::product_cmd::get_product,
        cmd::product_cmd::preview_import,
        cmd::product_cmd::commit_import,
        // CMD-02: 入庫
        cmd::receiving_cmd::create_receiving,
        cmd::receiving_cmd::list_receivings,
        cmd::receiving_cmd::get_receiving_record,
        // CMD-03: 返品・交換
        cmd::return_cmd::create_return,
        cmd::return_cmd::list_returns,
        cmd::return_cmd::get_return_record,
        // CMD-04: 手動販売出庫
        cmd::manual_sale_cmd::create_manual_sale,
        cmd::manual_sale_cmd::get_manual_sale_record,
        // CMD-05: 廃棄・破損
        cmd::disposal_cmd::create_disposal,
        cmd::disposal_cmd::list_disposals,
        cmd::disposal_cmd::list_inventory_records,
        cmd::disposal_cmd::get_disposal_record,
        // CMD-06: 在庫照会
        cmd::inventory_cmd::get_stock_detail,
        cmd::inventory_cmd::list_low_stock,
        cmd::inventory_cmd::list_movements,
        // CMD-07: CSV取込み
        cmd::csv_import_cmd::parse_and_validate_csv,
        cmd::csv_import_cmd::commit_csv_import,
        cmd::csv_import_cmd::rollback_csv_import,
        cmd::csv_import_cmd::list_csv_imports,
        // CMD-12: 日報取込み
        cmd::daily_report_import_cmd::parse_and_validate_daily_report,
        cmd::daily_report_import_cmd::commit_daily_report_import,
        cmd::daily_report_import_cmd::rollback_daily_report_import,
        cmd::daily_report_import_cmd::list_daily_report_imports,
        // CMD-08: PLU書出し
        cmd::plu_export_cmd::prepare_plu_export,
        cmd::plu_export_cmd::confirm_plu_export_saved,
        cmd::plu_export_cmd::list_plu_dirty,
        // CMD-09: 売上集計
        cmd::sales_cmd::get_daily_sales,
        cmd::sales_cmd::get_monthly_sales,
        cmd::sales_cmd::export_sales_csv,
        // CMD-10: 棚卸し
        cmd::stocktake_cmd::get_active_stocktake,
        cmd::stocktake_cmd::start_stocktake,
        cmd::stocktake_cmd::get_stocktake_items,
        cmd::stocktake_cmd::find_stocktake_item,
        cmd::stocktake_cmd::get_last_completed_stocktake,
        cmd::stocktake_cmd::update_count,
        cmd::stocktake_cmd::complete_stocktake,
        cmd::integrity_cmd::run_integrity_check,
        cmd::integrity_cmd::fix_integrity,
        // CMD-11: 設定・ログ・バックアップ・画像
        cmd::settings_cmd::get_settings,
        cmd::settings_cmd::update_setting,
        cmd::settings_cmd::list_logs,
        cmd::settings_cmd::list_log_operation_types,
        cmd::settings_cmd::create_backup,
        cmd::settings_cmd::check_auto_backup,
        cmd::settings_cmd::list_backups,
        cmd::settings_cmd::get_effective_backup_dir,
        cmd::settings_cmd::restore_backup,
        cmd::settings_cmd::save_receipt_image,
    ]);

    // CARGO_MANIFEST_DIR = `<project-root>/src-tauri`（compile-time 解決）。
    // cwd 非依存で `<project-root>/src/lib/bindings.ts` を指す。
    let bindings_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("lib")
        .join("bindings.ts");

    if let Err(e) = builder.export(specta_typescript::Typescript::default(), &bindings_path) {
        eprintln!(
            "警告: TS bindings の export に失敗しました ({}): {e}",
            bindings_path.display()
        );
    } else if let Err(e) = normalize_generated_bindings(&bindings_path) {
        eprintln!(
            "警告: TS bindings の整形に失敗しました ({}): {e}",
            bindings_path.display()
        );
    }
}

#[cfg(debug_assertions)]
fn normalize_generated_bindings(path: &std::path::Path) -> std::io::Result<()> {
    let original = std::fs::read_to_string(path)?;
    let mut lines = original
        .lines()
        .map(|line| line.trim_end().to_string())
        .collect::<Vec<_>>();

    while matches!(lines.last(), Some(line) if line.is_empty()) {
        lines.pop();
    }

    let mut normalized = lines.join("\n");
    normalized.push('\n');

    if normalized != original {
        std::fs::write(path, normalized)?;
    }

    Ok(())
}

#[cfg(all(test, debug_assertions))]
mod bindings_generation_tests {
    use super::normalize_generated_bindings;

    // WF 系 meta-test のため `test_` prefix なし命名（pre-push step ④ の REQ 番号必須対象外）
    #[test]
    fn normalize_generated_bindings_trims_trailing_whitespace() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bindings.ts");
        std::fs::write(&path, "type A = {\n\tfield: string,\t\n}\n\n").unwrap();

        normalize_generated_bindings(&path).unwrap();

        let normalized = std::fs::read_to_string(path).unwrap();
        assert_eq!(normalized, "type A = {\n\tfield: string,\n}\n");
    }

    #[test]
    fn test_startup_req903_m8_migration_error_stops_before_database_creation() {
        // REQ-903 / Matrix M5, M8
        let app_data = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let db_path = app_data.path().join("inventory.db");
        let result = super::prepare_database_with(
            app_data.path(),
            || Ok(cwd.path().to_path_buf()),
            |_old, _new| Err(std::io::Error::other("injected migration failure")),
        );
        assert!(result.is_err());
        assert!(
            !db_path.exists(),
            "init_database must not run after migration failure"
        );

        let cwd_error = super::prepare_database_with(
            app_data.path(),
            || Err("injected CWD failure".to_string()),
            |_old, _new| Ok(false),
        );
        assert!(cwd_error.is_err());
        assert!(!db_path.exists());

        let message = super::StartupDatabaseError::LegacyMigration("fixture".to_string())
            .operator_message()
            .unwrap();
        assert!(message.contains("旧データは無事です"));
        assert!(message.contains("再起動すると移行を再試行"));
        assert!(message.contains("管理者へ連絡"));
    }

    #[test]
    fn test_startup_req903_m7_existing_new_db_does_not_resolve_cwd() {
        // REQ-903 / Matrix M7: 新DB既存判定は CWD 非依存で先行する。
        let app_data = tempfile::tempdir().unwrap();
        let db_path = app_data.path().join("inventory.db");
        drop(crate::db::init_database(db_path.to_str().unwrap()).unwrap());

        let conn = super::prepare_database_with(
            app_data.path(),
            || Err("CWD must not be resolved".to_string()),
            |_old, _new| panic!("migration must be skipped when the new DB exists"),
        )
        .unwrap();
        drop(conn);
    }

    #[test]
    fn test_startup_req901_b9_temp_artifacts_route_through_reconcile() {
        // REQ-901 / Matrix B9: temp-only と canonical+temp は実 startup dispatcher で T0 を通る。
        let app_data = tempfile::tempdir().unwrap();
        let db_path = app_data.path().join("inventory.db");
        let temp_path =
            std::path::PathBuf::from(format!("{}.restore_manifest.tmp", db_path.display()));
        std::fs::write(&temp_path, b"temp-only").unwrap();
        drop(
            super::prepare_database_with(
                app_data.path(),
                || Ok(app_data.path().to_path_buf()),
                |_old, _new| Ok(false),
            )
            .unwrap(),
        );
        assert!(!temp_path.exists());

        let conn = crate::db::open_existing_database(db_path.to_str().unwrap()).unwrap();
        conn.execute(
            "INSERT INTO suppliers (name, created_at) VALUES ('old', '2026-07-18T00:00:00')",
            [],
        )
        .unwrap();
        drop(conn);
        let backup_path = std::path::PathBuf::from(format!("{}.restore_backup", db_path.display()));
        let manifest_path =
            std::path::PathBuf::from(format!("{}.restore_manifest", db_path.display()));
        std::fs::rename(&db_path, &backup_path).unwrap();
        std::fs::write(
            &manifest_path,
            br#"{"attempt_id":"startup-t0","original_files":["main"],"phase":"active"}"#,
        )
        .unwrap();
        std::fs::write(&temp_path, b"stale-commit-temp").unwrap();

        let reopened = super::prepare_database_with(
            app_data.path(),
            || Err("CWD must not be needed after reconcile restores main".to_string()),
            |_old, _new| panic!("migration must not run after reconcile restores main"),
        )
        .unwrap();
        let names: Vec<String> = reopened
            .prepare("SELECT name FROM suppliers ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(names, vec!["old"]);
        assert!(!temp_path.exists() && !manifest_path.exists() && !backup_path.exists());
    }

    #[test]
    fn test_startup_req901_b9_committed_marker_survives_init_failure_then_converges() {
        // REQ-901 / Matrix B9: committed reconcile 後の init_database 失敗でも marker を再々起動へ残す。
        let app_data = tempfile::tempdir().unwrap();
        let db_path = app_data.path().join("inventory.db");
        drop(crate::db::init_database(db_path.to_str().unwrap()).unwrap());
        let manifest_path =
            std::path::PathBuf::from(format!("{}.restore_manifest", db_path.display()));
        std::fs::write(
            &manifest_path,
            br#"{"attempt_id":"init-retry","original_files":["main"],"phase":"committed"}"#,
        )
        .unwrap();

        let failed = super::prepare_database_with_init(
            app_data.path(),
            || Err("CWD must not run".to_string()),
            |_old, _new| panic!("migration must not run"),
            |_path| {
                Err(crate::db::DbError::ConnectionFailed(
                    "injected init failure".into(),
                ))
            },
        );
        assert!(matches!(
            failed,
            Err(super::StartupDatabaseError::DatabaseInit(_))
        ));
        assert!(manifest_path.exists());

        let conn = super::prepare_database_with(
            app_data.path(),
            || Err("CWD must not run".to_string()),
            |_old, _new| panic!("migration must not run"),
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs
                 WHERE operation_type = 'backup_restore'
                   AND json_extract(detail_json, '$.attempt_id') = 'init-retry'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        assert!(!manifest_path.exists());
    }

    #[test]
    fn test_startup_req901_b10_guard_registration_precedes_mutation_setup() {
        // REQ-901 / Matrix B10: source-order regression guard.
        let source = include_str!("lib.rs");
        let guard = source.find("tauri_plugin_single_instance::init").unwrap();
        let setup = source.find(".setup(|app|").unwrap();
        assert!(
            guard < setup,
            "single-instance guard must precede mutation setup"
        );
    }

    #[test]
    fn test_startup_req901_b11_guard_failure_prevents_mutation_setup() {
        // REQ-901 / Matrix B11: injected guard plugin setup failure is observable and fail-closed.
        use std::sync::atomic::{AtomicBool, Ordering};
        static MUTATION_REACHED: AtomicBool = AtomicBool::new(false);
        MUTATION_REACHED.store(false, Ordering::SeqCst);
        let failing_guard =
            tauri::plugin::Builder::<tauri::test::MockRuntime>::new("single-instance-guard")
                .setup(|_, _| Err("injected single-instance initialization failure".into()))
                .build();
        let result = tauri::test::mock_builder()
            .plugin(failing_guard)
            .setup(|_| {
                MUTATION_REACHED.store(true, Ordering::SeqCst);
                Ok(())
            })
            .build(tauri::test::mock_context(tauri::test::noop_assets()));
        assert!(result.is_err());
        assert!(!MUTATION_REACHED.load(Ordering::SeqCst));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    export_specta_bindings();

    tauri::Builder::default()
        // mutation を行う setup より先に single-instance guard を確立する。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // app_data_dir: tauri.conf.json の identifier から自動解決
            // Linux: ~/.local/share/com.kosei.inventory/
            // Windows: C:\Users\{user}\AppData\Roaming\com.kosei.inventory\
            let app_data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data)?;

            // 1. 診断ログ初期化（setup 内の最初。失敗してもアプリ起動は続行）
            let log_config = DiagnosticLogConfig {
                log_dir: app_data.join("logs"),
                retention_days: 30,
                file_prefix: "app".to_string(),
            };
            if let Err(e) = mnt::diagnostic_log::init_diagnostics(&log_config) {
                eprintln!("警告: 診断ログの初期化に失敗しました: {}", e);
            }

            // 2. 古ログファイル削除（ログ初期化後に実行）
            if let Err(e) = mnt::diagnostic_log::cleanup_old_log_files(&log_config) {
                tracing::warn!(error = %e, "古いログファイルの削除に失敗");
            }

            // 3-4. reconcile → legacy migration → DB初期化。いずれかの失敗は fail-closed。
            let conn = match prepare_database(&app_data) {
                Ok(conn) => conn,
                Err(error) => {
                    if let Some(message) = error.operator_message() {
                        show_pre_window_fatal(&message);
                    } else {
                        tracing::error!(%error, "database initialization failed");
                    }
                    return Err(error.to_string().into());
                }
            };

            // 5. 操作ログ自動削除（DB初期化後に実行。失敗してもアプリ起動は続行）
            if let Err(e) = mnt::log_manager::cleanup_old_logs(&conn) {
                tracing::warn!(error = %e, "操作ログの自動削除に失敗");
            }

            // 6. 自動バックアップチェック（起動時。失敗してもアプリ起動は続行）
            let backup_dir = mnt::backup::resolve_backup_dir(&conn, &app_data);
            if let Err(e) = mnt::backup::check_auto_backup(&conn, &backup_dir) {
                tracing::warn!(error = %e, "自動バックアップチェックに失敗");
            }

            // 7. State管理（setup 内で manage）
            app.manage(AppState {
                db: Mutex::new(conn),
                preview_cache: Mutex::new(HashMap::new()),
                daily_report_preview_cache: Mutex::new(HashMap::new()),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // CMD-01: 商品管理
            cmd::product_cmd::create_product,
            cmd::product_cmd::update_product,
            cmd::product_cmd::toggle_discontinue,
            cmd::product_cmd::search_products,
            cmd::product_cmd::list_departments,
            cmd::product_cmd::list_suppliers,
            cmd::product_cmd::get_product,
            cmd::product_cmd::preview_import,
            cmd::product_cmd::commit_import,
            // CMD-02: 入庫
            cmd::receiving_cmd::create_receiving,
            cmd::receiving_cmd::list_receivings,
            cmd::receiving_cmd::get_receiving_record,
            // CMD-03: 返品・交換
            cmd::return_cmd::create_return,
            cmd::return_cmd::list_returns,
            cmd::return_cmd::get_return_record,
            // CMD-04: 手動販売出庫
            cmd::manual_sale_cmd::create_manual_sale,
            cmd::manual_sale_cmd::get_manual_sale_record,
            // CMD-05: 廃棄・破損
            cmd::disposal_cmd::create_disposal,
            cmd::disposal_cmd::list_disposals,
            cmd::disposal_cmd::list_inventory_records,
            cmd::disposal_cmd::get_disposal_record,
            // CMD-06: 在庫照会
            cmd::inventory_cmd::get_stock_detail,
            cmd::inventory_cmd::list_low_stock,
            cmd::inventory_cmd::list_movements,
            // CMD-07: CSV取込み
            cmd::csv_import_cmd::parse_and_validate_csv,
            cmd::csv_import_cmd::commit_csv_import,
            cmd::csv_import_cmd::rollback_csv_import,
            cmd::csv_import_cmd::list_csv_imports,
            // CMD-12: 日報取込み
            cmd::daily_report_import_cmd::parse_and_validate_daily_report,
            cmd::daily_report_import_cmd::commit_daily_report_import,
            cmd::daily_report_import_cmd::rollback_daily_report_import,
            cmd::daily_report_import_cmd::list_daily_report_imports,
            // CMD-08: PLU書出し
            cmd::plu_export_cmd::prepare_plu_export,
            cmd::plu_export_cmd::confirm_plu_export_saved,
            cmd::plu_export_cmd::list_plu_dirty,
            // CMD-09: 売上集計
            cmd::sales_cmd::get_daily_sales,
            cmd::sales_cmd::get_monthly_sales,
            cmd::sales_cmd::export_sales_csv,
            // CMD-10: 棚卸し
            cmd::stocktake_cmd::get_active_stocktake,
            cmd::stocktake_cmd::start_stocktake,
            cmd::stocktake_cmd::get_stocktake_items,
            cmd::stocktake_cmd::find_stocktake_item,
            cmd::stocktake_cmd::get_last_completed_stocktake,
            cmd::stocktake_cmd::update_count,
            cmd::stocktake_cmd::complete_stocktake,
            // CMD-11 部分: 整合性チェック
            cmd::integrity_cmd::run_integrity_check,
            cmd::integrity_cmd::fix_integrity,
            // CMD-11 残り: 設定・ログ・バックアップ・画像
            cmd::settings_cmd::get_settings,
            cmd::settings_cmd::update_setting,
            cmd::settings_cmd::list_logs,
            cmd::settings_cmd::list_log_operation_types,
            cmd::settings_cmd::create_backup,
            cmd::settings_cmd::check_auto_backup,
            cmd::settings_cmd::list_backups,
            cmd::settings_cmd::get_effective_backup_dir,
            cmd::settings_cmd::restore_backup,
            cmd::settings_cmd::save_receipt_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
