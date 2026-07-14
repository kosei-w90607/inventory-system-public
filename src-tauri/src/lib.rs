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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    export_specta_bindings();

    tauri::Builder::default()
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

            // 3. 旧DBの移行フォールバック
            // 旧実装では相対パス "inventory.db" を使用していたため、CWDにDBが残っている可能性がある。
            if let Ok(cwd) = std::env::current_dir() {
                match db::migrate_legacy_db(&cwd, &app_data) {
                    Ok(true) => tracing::info!(
                        old_dir = %cwd.display(),
                        new_dir = %app_data.display(),
                        "既存DBを移行しました（旧ファイルは手動削除してください）"
                    ),
                    Ok(false) => {} // 移行不要
                    Err(e) => tracing::error!(
                        error = %e,
                        "旧DBの移行に失敗しました。手動でコピーしてください"
                    ),
                }
            }

            // 4. DB初期化（app_data_dir 配下の絶対パス）
            let db_path = app_data.join("inventory.db");
            let conn = db::init_database(db_path.to_str().expect("DB パスの文字列変換に失敗"))?;

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
