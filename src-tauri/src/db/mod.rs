//! DB接続管理・リポジトリモジュール群
//!
//! 20-io-product-repo.md §2 に基づく実装。
//! IO-01: SQLiteデータアクセス層

// モジュール宣言（アルファベット順）
pub mod disposal_repo;
pub mod inventory_common;
pub mod inventory_repo;
pub mod manual_sale_repo;
pub mod migration;
pub mod product_repo;
pub mod receiving_repo;
pub mod return_repo;
pub mod sales_repo;
pub mod stocktake_repo;
pub mod system_repo;

// 内部モジュール（非公開）
mod schema_v1;
mod schema_v2;
mod schema_v3;
mod schema_v4;

#[cfg(test)]
pub(crate) mod test_support;

// BIZ/CMD層で使用する型の re-export（UI層未実装のため一部はまだ未使用）
#[allow(unused_imports)]
pub use disposal_repo::{
    DisposalRecordDetail, DisposalRecordSummary, InventoryRecordQuery, InventoryRecordSummary,
    NewDisposalItem, NewDisposalRecord,
};
#[allow(unused_imports)]
pub use inventory_common::ListQuery;
#[allow(unused_imports)]
pub use inventory_repo::{
    MovementQuery, MovementRecord, MovementSourceLink, MovementType, NewMovement,
    ProductMovementSum, ReferenceType,
};
#[allow(unused_imports)]
pub use manual_sale_repo::{
    ManualSaleRecordDetail, ManualSaleRecordDetailItem, NewManualSale, NewManualSaleItem,
};
#[allow(unused_imports)]
pub use product_repo::{
    Department, NewPriceHistory, NewProduct, Product, ProductForPlu, ProductSearchQuery,
    ProductUpdates, ProductWithRelations, SortKey, SortOrder, StockDetail, Supplier,
};
#[allow(unused_imports)]
pub use receiving_repo::{
    NewReceivingItem, NewReceivingRecord, ReceivingRecordDetail, ReceivingRecordDetailItem,
    ReceivingRecordWithSupplier,
};
#[allow(unused_imports)]
pub use return_repo::{
    NewReturnItem, NewReturnRecord, ReturnRecordDetail, ReturnRecordDetailItem, ReturnRecordSummary,
};
#[allow(unused_imports)]
pub use sales_repo::{
    CsvImport, DailyReportImport, DailySaleRow, MonthlySaleDeptRow, MonthlySaleProductRow,
    NewCsvImport, NewCsvImportError, NewDailyReportDepartmentLine, NewDailyReportImport,
    NewDailyReportPaymentLine, NewDailyReportSummaryLine, NewSaleRecord, VoidedMovement,
};
#[allow(unused_imports)]
pub use stocktake_repo::{
    LastStocktakeSummary, NewStocktakeItem, ProductForStocktake, Stocktake, StocktakeItem,
    StocktakeItemDetail, StocktakeItemForComplete, StocktakeProgress, UncountedItem,
};
#[allow(unused_imports)]
pub use system_repo::{AppSetting, NewOperationLog, OperationLog};

use std::fmt;

/// DB接続の型エイリアス
///
/// 20-io-product-repo.md に基づく。rusqlite::Connection をそのまま使う。
/// トランザクション管理はBIZ層が conn.transaction() で制御する。
pub type DbConnection = rusqlite::Connection;

/// DB層のエラー型
///
/// 20-io-product-repo.md §2.10
#[derive(Debug)]
pub enum DbError {
    /// DB接続の確立に失敗
    ConnectionFailed(String),
    /// PRAGMA設定に失敗
    PragmaFailed(String),
    /// マイグレーション実行に失敗
    MigrationFailed(String),
    /// SQLクエリ実行に失敗
    QueryFailed(String),
    /// 主キーまたはユニーク制約違反
    DuplicateKey(String),
    /// 外部キー制約違反
    ForeignKeyViolation(String),
    /// レコードが見つからない
    NotFound,
}

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DbError::ConnectionFailed(msg) => write!(f, "DB接続エラー: {}", msg),
            DbError::PragmaFailed(msg) => write!(f, "PRAGMA設定エラー: {}", msg),
            DbError::MigrationFailed(msg) => write!(f, "マイグレーションエラー: {}", msg),
            DbError::QueryFailed(msg) => write!(f, "クエリ実行エラー: {}", msg),
            DbError::DuplicateKey(key) => write!(f, "重複キー: {}", key),
            DbError::ForeignKeyViolation(msg) => write!(f, "外部キー制約違反: {}", msg),
            DbError::NotFound => write!(f, "レコードが見つかりません"),
        }
    }
}

impl std::error::Error for DbError {}

/// rusqlite::Error → DbError の変換
///
/// SQLiteのエラーコードに基づいて適切なDbErrorバリアントに変換する:
/// - SQLITE_CONSTRAINT_PRIMARYKEY (1555) / SQLITE_CONSTRAINT_UNIQUE (2067) → DuplicateKey
/// - SQLITE_CONSTRAINT_FOREIGNKEY (787) → ForeignKeyViolation
/// - その他 → QueryFailed
impl From<rusqlite::Error> for DbError {
    fn from(err: rusqlite::Error) -> Self {
        match &err {
            rusqlite::Error::SqliteFailure(sqlite_err, msg) => {
                let code = sqlite_err.extended_code;
                if code == 1555 || code == 2067 {
                    // SQLITE_CONSTRAINT_PRIMARYKEY / SQLITE_CONSTRAINT_UNIQUE
                    DbError::DuplicateKey(msg.clone().unwrap_or_default())
                } else if code == 787 {
                    // SQLITE_CONSTRAINT_FOREIGNKEY
                    DbError::ForeignKeyViolation(msg.clone().unwrap_or_default())
                } else {
                    DbError::QueryFailed(err.to_string())
                }
            }
            _ => DbError::QueryFailed(err.to_string()),
        }
    }
}

/// ページネーション付き検索結果
///
/// 20-io-product-repo.md §2.10
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total_count: u32,
    pub page: u32,
    pub per_page: u32,
}

/// DB接続を初期化する
///
/// 20-io-product-repo.md §2.2:
/// SQLiteファイルを開き、PRAGMA設定とマイグレーションを実行して、
/// 使用可能な接続を返す。
pub fn init_database(db_path: &str) -> Result<DbConnection, DbError> {
    // 1. ファイルを開く（なければ新規作成）
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| DbError::ConnectionFailed(e.to_string()))?;

    // 2. PRAGMA foreign_keys = ON
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| DbError::PragmaFailed(format!("foreign_keys: {}", e)))?;

    // 3. PRAGMA journal_mode = WAL
    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|e| DbError::PragmaFailed(format!("journal_mode: {}", e)))?;

    // 4. PRAGMA busy_timeout = 5000
    conn.execute_batch("PRAGMA busy_timeout = 5000;")
        .map_err(|e| DbError::PragmaFailed(format!("busy_timeout: {}", e)))?;

    // 5. マイグレーション実行（MNT-03）
    migration::migrate(&conn)?;

    // 6. 初期化完了ログ（§70.7.4）
    let schema_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_versions",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    tracing::info!(schema_version, db_path, "DB初期化完了");

    Ok(conn)
}

/// 旧パス（CWD/inventory.db）から新パス（app_data_dir/inventory.db）へDB移行する
///
/// PR #25 レビュー指摘対応。WALモードの -wal/-shm を含む3ファイルセットでコピー。
/// 本体（inventory.db）のコピー失敗時は移行失敗として Err を返す。
///
/// 戻り値: Ok(true) = 移行実行、Ok(false) = 移行不要（旧DB無し or 新DB既存）
pub fn migrate_legacy_db(
    old_dir: &std::path::Path,
    new_dir: &std::path::Path,
) -> Result<bool, std::io::Error> {
    let old_db = old_dir.join("inventory.db");
    let new_db = new_dir.join("inventory.db");

    // 新パスにDB既存 or 旧パスにDB無し → 移行不要
    if new_db.exists() || !old_db.exists() {
        return Ok(false);
    }

    // 本体コピー（失敗は致命的 → Err で返す）
    std::fs::copy(&old_db, &new_db)?;

    // WAL/SHM はベストエフォート（存在すればコピー、失敗は警告のみ）
    for suffix in &["-wal", "-shm"] {
        let old = old_dir.join(format!("inventory.db{}", suffix));
        let new = new_dir.join(format!("inventory.db{}", suffix));
        if old.exists() {
            if let Err(e) = std::fs::copy(&old, &new) {
                tracing::warn!(
                    file = %old.display(),
                    error = %e,
                    "旧DB付随ファイルのコピーに失敗"
                );
            }
        }
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// DB初期化が成功し、PRAGMAが正しく設定されること
    #[test]
    fn test_init_database_req903_pragmas() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        // PRAGMA foreign_keys = ON
        let fk: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk, 1, "foreign_keys should be ON");

        // PRAGMA journal_mode = WAL
        let journal: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(journal, "wal", "journal_mode should be WAL");

        // PRAGMA busy_timeout = 5000
        let timeout: i64 = conn
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .unwrap();
        assert_eq!(timeout, 5000, "busy_timeout should be 5000");
    }

    /// 同じDBに対して2回初期化しても成功すること（再マイグレーションスキップ）
    #[test]
    fn test_init_database_req903_twice_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let _conn1 = init_database(db_path.to_str().unwrap()).unwrap();
        drop(_conn1);
        let _conn2 = init_database(db_path.to_str().unwrap()).unwrap();
    }

    /// DbError の From<rusqlite::Error> 変換テスト
    #[test]
    fn test_db_error_req903_from_rusqlite_duplicate_key() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();

        // 同じPKで2回INSERTして DuplicateKey エラーを発生させる
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES ('test_key', 'v1', '2026-04-03T00:00:00')",
            [],
        )
        .unwrap();

        let result = conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES ('test_key', 'v2', '2026-04-03T00:00:00')",
            [],
        );

        let err: DbError = result.unwrap_err().into();
        assert!(
            matches!(err, DbError::DuplicateKey(_)),
            "重複キーエラーが DuplicateKey に変換されるべき: {:?}",
            err
        );
    }

    // -----------------------------------------------------------------------
    // migrate_legacy_db テスト
    // -----------------------------------------------------------------------

    #[test]
    fn test_migrate_legacy_db_req903_copies_all_files() {
        // REQ-903: マイグレーション/DB基盤（初期化/スキーマ更新）
        // 旧パスにDB+WAL+SHMがあり、新パスにDBがない → 3ファイルコピー
        let old_dir = tempfile::tempdir().unwrap();
        let new_dir = tempfile::tempdir().unwrap();

        std::fs::write(old_dir.path().join("inventory.db"), "main").unwrap();
        std::fs::write(old_dir.path().join("inventory.db-wal"), "wal").unwrap();
        std::fs::write(old_dir.path().join("inventory.db-shm"), "shm").unwrap();

        let result = migrate_legacy_db(old_dir.path(), new_dir.path()).unwrap();
        assert!(result, "移行が実行されるべき");
        assert!(new_dir.path().join("inventory.db").exists());
        assert!(new_dir.path().join("inventory.db-wal").exists());
        assert!(new_dir.path().join("inventory.db-shm").exists());
        // 旧ファイルは残っている（手動削除）
        assert!(old_dir.path().join("inventory.db").exists());
    }

    #[test]
    fn test_migrate_legacy_db_req903_skips_when_new_exists() {
        // REQ-903: マイグレーション/DB基盤（初期化/スキーマ更新）
        // 新パスにDB既存 → 移行不要
        let old_dir = tempfile::tempdir().unwrap();
        let new_dir = tempfile::tempdir().unwrap();

        std::fs::write(old_dir.path().join("inventory.db"), "old").unwrap();
        std::fs::write(new_dir.path().join("inventory.db"), "new").unwrap();

        let result = migrate_legacy_db(old_dir.path(), new_dir.path()).unwrap();
        assert!(!result, "移行されるべきではない");
        // 新パスは上書きされていない
        let content = std::fs::read_to_string(new_dir.path().join("inventory.db")).unwrap();
        assert_eq!(content, "new");
    }

    #[test]
    fn test_migrate_legacy_db_req903_skips_when_old_missing() {
        // REQ-903: マイグレーション/DB基盤（初期化/スキーマ更新）
        // 旧パスにDBなし → 移行不要
        let old_dir = tempfile::tempdir().unwrap();
        let new_dir = tempfile::tempdir().unwrap();

        let result = migrate_legacy_db(old_dir.path(), new_dir.path()).unwrap();
        assert!(!result, "移行されるべきではない");
        assert!(!new_dir.path().join("inventory.db").exists());
    }

    #[test]
    fn test_migrate_legacy_db_req903_without_wal_shm() {
        // REQ-903: マイグレーション/DB基盤（初期化/スキーマ更新）
        // 旧パスにDBのみ（WAL/SHMなし）→ 本体のみコピー
        let old_dir = tempfile::tempdir().unwrap();
        let new_dir = tempfile::tempdir().unwrap();

        std::fs::write(old_dir.path().join("inventory.db"), "main").unwrap();

        let result = migrate_legacy_db(old_dir.path(), new_dir.path()).unwrap();
        assert!(result);
        assert!(new_dir.path().join("inventory.db").exists());
        assert!(!new_dir.path().join("inventory.db-wal").exists());
        assert!(!new_dir.path().join("inventory.db-shm").exists());
    }
}
