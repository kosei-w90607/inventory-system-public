//! DBスキーマのマイグレーション実行（MNT-03）
//!
//! 22-mnt-migration.md §3 + §9 に基づく実装。
//! schema_versionsテーブルでバージョン管理し、未適用のマイグレーションを順番に実行する。
//!
//! ## MigrationKind
//! - Sql: 実行器が BEGIN→SQL→schema_versions INSERT→COMMIT を管理
//! - Custom: 関数側が TX管理 + schema_versions INSERT まで全責任を持つ
//!   （PRAGMA操作等でTX外処理が必要な場合用）

use super::schema_v1;
use super::schema_v2;
use super::schema_v3;
use super::schema_v4;
use super::DbError;
use rusqlite::Connection;

/// マイグレーション種別
enum MigrationKind {
    /// 実行器側が BEGIN→SQL→schema_versions INSERT→COMMIT を管理
    Sql(&'static str),
    /// 関数側が TX管理 + schema_versions INSERT まで全責任を持つ
    Custom(fn(&Connection, i64) -> Result<(), DbError>),
}

/// マイグレーション定義
struct Migration {
    version: i64,
    description: &'static str,
    kind: MigrationKind,
}

/// マイグレーション一覧（バージョン順）
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "初期スキーマ（20テーブル + インデックス + 初期データ）",
            kind: MigrationKind::Sql(schema_v1::get_initial_schema()),
        },
        Migration {
            version: 2,
            description: "冪等性カラム追加（4テーブル再作成）",
            kind: MigrationKind::Custom(schema_v2::apply_v2_idempotency),
        },
        Migration {
            version: 3,
            description: "PLU対象フラグ追加（products.plu_target）",
            kind: MigrationKind::Custom(schema_v3::apply_v3_plu_target),
        },
        Migration {
            version: 4,
            description: "日報取込みテーブル追加（daily_report_imports + lines）",
            kind: MigrationKind::Sql(schema_v4::get_v4_daily_report_schema()),
        },
    ]
}

/// schema_versionsテーブルを作成する（存在しなければ）
fn ensure_schema_versions_table(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_versions (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )
    .map_err(|e| DbError::MigrationFailed(format!("schema_versionsテーブル作成失敗: {}", e)))
}

/// 現在のスキーマバージョンを取得する
fn get_current_version(conn: &Connection) -> Result<i64, DbError> {
    let version: Option<i64> = conn
        .query_row("SELECT MAX(version) FROM schema_versions", [], |row| {
            row.get(0)
        })
        .map_err(|e| DbError::MigrationFailed(format!("バージョン取得失敗: {}", e)))?;
    Ok(version.unwrap_or(0))
}

/// Sql 種別のマイグレーションをトランザクション内で実行する
fn apply_sql_migration(
    conn: &Connection,
    version: i64,
    description: &str,
    sql: &str,
) -> Result<(), DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    conn.execute_batch("BEGIN;")
        .map_err(|e| DbError::MigrationFailed(format!("v{} BEGIN失敗: {}", version, e)))?;

    if let Err(e) = conn.execute_batch(sql) {
        conn.execute_batch("ROLLBACK;").ok();
        return Err(DbError::MigrationFailed(format!(
            "v{} ({}) SQL実行失敗: {}",
            version, description, e
        )));
    }

    if let Err(e) = conn.execute(
        "INSERT INTO schema_versions (version, applied_at) VALUES (?1, ?2)",
        rusqlite::params![version, now],
    ) {
        conn.execute_batch("ROLLBACK;").ok();
        return Err(DbError::MigrationFailed(format!(
            "v{} バージョン記録失敗: {}",
            version, e
        )));
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| DbError::MigrationFailed(format!("v{} COMMIT失敗: {}", version, e)))?;

    Ok(())
}

/// schema_versionsテーブルを確認し、未適用のマイグレーションを順番に実行する
///
/// 22-mnt-migration.md §3.2:
/// 1. schema_versionsテーブルの存在チェック → なければ作成
/// 2. 現在の最大バージョンを取得
/// 3. 未適用のマイグレーションを順番に実行
pub fn migrate(conn: &Connection) -> Result<(), DbError> {
    // 1. schema_versionsテーブルを確保
    ensure_schema_versions_table(conn)?;

    // 2. 現在のバージョンを取得
    let current_version = get_current_version(conn)?;

    // 3. 未適用のマイグレーションを順番に実行
    for migration in migrations() {
        if migration.version > current_version {
            match &migration.kind {
                MigrationKind::Sql(sql) => {
                    apply_sql_migration(conn, migration.version, migration.description, sql)?;
                }
                MigrationKind::Custom(func) => {
                    func(conn, migration.version)?;
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{init_database, schema_v1, schema_v2};
    use rusqlite::Connection;

    fn setup_v1_only_db() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_versions (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );",
        )
        .unwrap();
        conn.execute_batch(schema_v1::get_initial_schema()).unwrap();
        conn.execute(
            "INSERT INTO schema_versions (version, applied_at) VALUES (1, '2026-04-06T00:00:00')",
            [],
        )
        .unwrap();
        (dir, conn)
    }

    fn setup_v2_only_db() -> (tempfile::TempDir, Connection) {
        let (dir, conn) = setup_v1_only_db();
        schema_v2::apply_v2_idempotency(&conn, 2).unwrap();
        (dir, conn)
    }

    /// 全20テーブル（schema_v1.rs） + schema_versions = 21テーブルが存在すること
    #[test]
    fn test_migration_req903_creates_all_tables() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        let expected_tables = vec![
            "schema_versions",
            "departments",
            "suppliers",
            "products",
            "receiving_records",
            "receiving_items",
            "return_records",
            "return_items",
            "manual_sales",
            "manual_sale_items",
            "disposal_records",
            "disposal_items",
            "csv_imports",
            "csv_import_errors",
            "sale_records",
            "inventory_movements",
            "price_history",
            "stocktakes",
            "stocktake_items",
            "operation_logs",
            "app_settings",
        ];

        for table_name in &expected_tables {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
                    rusqlite::params![table_name],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(exists, "テーブル '{}' が存在しません", table_name);
        }
    }

    /// マイグレーション済みDBに対して再マイグレーションがスキップされること
    #[test]
    fn test_migration_req903_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // 1回目
        let conn = init_database(db_path.to_str().unwrap()).unwrap();
        let v1: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_versions", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(v1, 4);
        drop(conn);

        // 2回目（同じDBに対して再初期化）
        let conn = init_database(db_path.to_str().unwrap()).unwrap();
        let v2: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_versions", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(v2, 4, "バージョンが変わってはいけない");

        // schema_versionsにレコードが4件であること（v1 + v2 + v3 + v4）
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_versions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 4, "マイグレーションレコードは4件（v1+v2+v3+v4）");
    }

    #[test]
    fn test_migration_req903_v3_adds_plu_target_and_backfills_valid_ean13() {
        let (_dir, conn) = setup_v2_only_db();
        conn.execute(
            "INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, tax_rate, stock_unit, is_discontinued, created_at, updated_at)
             VALUES (?1, ?2, ?3, 1, 500, 300, '10', 'pcs', ?4, '2026-04-06T00:00:00', '2026-04-06T00:00:00')",
            rusqlite::params!["VALID", "4901234567894", "valid", false],
        )
        .unwrap();
        for (code, jan, discontinued) in [
            ("NULLJAN", None, false),
            ("SHORT", Some("123456789012"), false),
            ("ALPHA", Some("49012345678A4"), false),
            ("DISC", Some("4901234567894"), true),
        ] {
            conn.execute(
                "INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, tax_rate, stock_unit, is_discontinued, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 1, 500, 300, '10', 'pcs', ?4, '2026-04-06T00:00:00', '2026-04-06T00:00:00')",
                rusqlite::params![code, jan, code, discontinued],
            )
            .unwrap();
        }

        super::migrate(&conn).unwrap();

        let version: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_versions", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(version, 4);

        let rows: Vec<(String, bool)> = {
            let mut stmt = conn
                .prepare("SELECT product_code, plu_target FROM products ORDER BY product_code")
                .unwrap();
            stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap()
        };
        assert_eq!(
            rows,
            vec![
                ("ALPHA".to_string(), false),
                ("DISC".to_string(), false),
                ("NULLJAN".to_string(), false),
                ("SHORT".to_string(), false),
                ("VALID".to_string(), true),
            ]
        );
    }

    #[test]
    fn test_migration_req401_v4_creates_daily_report_tables_and_indexes() {
        // REQ-401: SALES日報取込み
        // DB 12b-12e: Z001/Z002/Z005日報取込み用の親子テーブルと検索indexを追加する
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        let version: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_versions", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(version, 4);

        for table_name in &[
            "daily_report_imports",
            "daily_report_summary_lines",
            "daily_report_payment_lines",
            "daily_report_department_lines",
        ] {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
                    rusqlite::params![table_name],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(exists, "テーブル '{}' が存在しません", table_name);
        }

        for index_name in &[
            "idx_daily_report_imports_report_date",
            "idx_daily_report_imports_bundle_hash",
            "idx_daily_report_summary_lines_import_id",
            "idx_daily_report_payment_lines_import_id",
            "idx_daily_report_department_lines_import_department",
        ] {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='index' AND name=?1",
                    rusqlite::params![index_name],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(exists, "インデックス '{}' が存在しません", index_name);
        }
    }

    #[test]
    fn test_migration_req401_v4_daily_report_constraints() {
        // REQ-401: SALES日報取込み
        // DB 12b-12e: status/source_adapter/source_file/FK制約をDBでも保持する
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        conn.execute(
            "INSERT INTO daily_report_imports (
                report_date, source_adapter, bundle_hash, source_files_json,
                gross_amount, net_amount, status, imported_at, note
             ) VALUES (
                '2026-03-21', 'casio_sr_s4000', 'hash-ok', '[]',
                12000, 11000, 'completed', '2026-03-21T18:00:00', NULL
             )",
            [],
        )
        .unwrap();
        let import_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO daily_report_summary_lines (
                daily_report_import_id, source_file, line_key, label, amount, quantity, count, sort_order
             ) VALUES (?1, 'Z001', 'gross_sales', '総売上', 12000, NULL, NULL, 1)",
            rusqlite::params![import_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO daily_report_payment_lines (
                daily_report_import_id, source_file, payment_key, label, amount, count, sort_order
             ) VALUES (?1, 'Z002', 'cash', '現金', 11000, 8, 1)",
            rusqlite::params![import_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO daily_report_department_lines (
                daily_report_import_id, source_file, department_id, raw_department_name,
                normalized_department_name, amount, quantity, count, sort_order
             ) VALUES (?1, 'Z005', 1, 'その他小物', 'その他小物', 3000, 4, NULL, 1)",
            rusqlite::params![import_id],
        )
        .unwrap();

        let invalid_adapter = conn.execute(
            "INSERT INTO daily_report_imports (
                report_date, source_adapter, bundle_hash, source_files_json,
                status, imported_at
             ) VALUES ('2026-03-22', 'unknown_adapter', 'hash-ng', '[]', 'completed', '2026-03-22T18:00:00')",
            [],
        );
        assert!(invalid_adapter.is_err(), "source_adapter CHECK が必要");

        let invalid_status = conn.execute(
            "INSERT INTO daily_report_imports (
                report_date, source_adapter, bundle_hash, source_files_json,
                status, imported_at
             ) VALUES ('2026-03-22', 'casio_sr_s4000', 'hash-ng2', '[]', 'failed', '2026-03-22T18:00:00')",
            [],
        );
        assert!(invalid_status.is_err(), "status CHECK が必要");

        let invalid_source = conn.execute(
            "INSERT INTO daily_report_summary_lines (
                daily_report_import_id, source_file, line_key, label, sort_order
             ) VALUES (?1, 'Z005', 'gross_sales', '総売上', 1)",
            rusqlite::params![import_id],
        );
        assert!(
            invalid_source.is_err(),
            "summary_lines.source_file は Z001 固定"
        );

        let invalid_department = conn.execute(
            "INSERT INTO daily_report_department_lines (
                daily_report_import_id, source_file, department_id, raw_department_name,
                amount, sort_order
             ) VALUES (?1, 'Z005', 99999, '未登録部門', 1000, 2)",
            rusqlite::params![import_id],
        );
        assert!(invalid_department.is_err(), "department_id FK が必要");
    }

    #[test]
    fn test_migration_req401_v4_keeps_existing_sales_tables_intact() {
        // REQ-401: SALES日報取込み
        // D-025: 日報モデル追加時もZ004/sale_records/inventory_movementsの既存表を壊さない
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        for sql in &[
            "SELECT id, filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at FROM csv_imports LIMIT 0",
            "SELECT id, csv_import_id, product_code, sale_date, quantity, amount, source, source_line_no, reason, note, is_voided, created_at FROM sale_records LIMIT 0",
            "SELECT id, product_code, movement_type, quantity, stock_after, reference_type, reference_id, note, is_voided, created_at FROM inventory_movements LIMIT 0",
        ] {
            conn.prepare(sql).unwrap();
        }
    }

    /// departments初期データ（21部門）が正しく投入されていること
    #[test]
    fn test_initial_departments_req903_data() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM departments", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 21, "部門は21件であるべき");

        // code_prefixが設定されている部門の確認
        let hz_prefix: Option<String> = conn
            .query_row(
                "SELECT code_prefix FROM departments WHERE name = 'ヘア雑貨'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(hz_prefix, Some("HZ".to_string()));

        // code_prefixがNULLの部門の確認
        let yarn_prefix: Option<String> = conn
            .query_row(
                "SELECT code_prefix FROM departments WHERE name = '毛糸'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(yarn_prefix, None, "毛糸の code_prefix は NULL");
    }

    /// app_settings初期データが正しく投入されていること
    #[test]
    fn test_initial_app_settings_req903_data() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        let threshold: String = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'stock_low_threshold'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(threshold, "3");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 9, "app_settings初期値は9件");
    }

    /// CHECK制約が動作すること（不正値でINSERTが失敗すること）
    #[test]
    fn test_check_constraints_req903_reject_invalid_values() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        // products.tax_rate に不正値 → 失敗すべき
        let result = conn.execute(
            "INSERT INTO products (product_code, name, department_id, selling_price, cost_price, tax_rate, stock_unit, created_at, updated_at)
             VALUES ('TEST001', 'テスト商品', 1, 100, 50, '15', 'pcs', '2026-04-03T00:00:00', '2026-04-03T00:00:00')",
            [],
        );
        assert!(result.is_err(), "tax_rate '15' は CHECK制約で弾かれるべき");

        // products.stock_unit に不正値 → 失敗すべき
        let result = conn.execute(
            "INSERT INTO products (product_code, name, department_id, selling_price, cost_price, tax_rate, stock_unit, created_at, updated_at)
             VALUES ('TEST002', 'テスト商品2', 1, 100, 50, '10', 'kg', '2026-04-03T00:00:00', '2026-04-03T00:00:00')",
            [],
        );
        assert!(
            result.is_err(),
            "stock_unit 'kg' は CHECK制約で弾かれるべき"
        );

        // 正常値 → 成功すべき
        let result = conn.execute(
            "INSERT INTO products (product_code, name, department_id, selling_price, cost_price, tax_rate, stock_unit, created_at, updated_at)
             VALUES ('TEST003', 'テスト商品3', 1, 100, 50, '10', 'pcs', '2026-04-03T00:00:00', '2026-04-03T00:00:00')",
            [],
        );
        assert!(result.is_ok(), "正常値は INSERT できるべき");
    }

    /// 外部キー制約が動作すること
    #[test]
    fn test_foreign_key_req903_constraints() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        // 存在しない department_id → 失敗すべき
        let result = conn.execute(
            "INSERT INTO products (product_code, name, department_id, selling_price, cost_price, tax_rate, stock_unit, created_at, updated_at)
             VALUES ('TEST001', 'テスト商品', 9999, 100, 50, '10', 'pcs', '2026-04-03T00:00:00', '2026-04-03T00:00:00')",
            [],
        );
        assert!(
            result.is_err(),
            "存在しないdepartment_idは外部キー制約で弾かれるべき"
        );
    }

    /// インデックスが作成されていること
    #[test]
    fn test_indexes_req903_exist() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        let expected_indexes = vec![
            "idx_products_jan_code",
            "idx_products_department_id",
            "idx_products_is_discontinued",
            "idx_csv_imports_file_hash",
            "idx_sale_records_sale_date",
            "idx_sale_records_product_date",
            "idx_sale_records_csv_import_id",
            "idx_inventory_movements_product_date",
            "idx_inventory_movements_reference",
            "idx_stocktake_items_stocktake_product",
        ];

        for index_name in &expected_indexes {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='index' AND name=?1",
                    rusqlite::params![index_name],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(exists, "インデックス '{}' が存在しません", index_name);
        }
    }
}
