//! migration v3: PLU対象フラグ追加
//!
//! 22-mnt-migration.md §10 に基づく実装。

use super::{migration_tx, DbError};
use rusqlite::Connection;

/// v3 マイグレーション: products.plu_target 追加と既存商品のバックフィル。
pub(crate) fn apply_v3_plu_target(conn: &Connection, version: i64) -> Result<(), DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    conn.execute_batch("BEGIN IMMEDIATE;")
        .map_err(|e| DbError::MigrationFailed(format!("v{} BEGIN失敗: {}", version, e)))?;

    if let Err(e) = conn.execute_batch(
        "ALTER TABLE products ADD COLUMN plu_target BOOLEAN NOT NULL DEFAULT 0;

         UPDATE products
         SET plu_target = 1
         WHERE is_discontinued = 0
           AND jan_code IS NOT NULL
           AND length(jan_code) = 13
           AND jan_code NOT GLOB '*[^0-9]*';",
    ) {
        return Err(migration_tx::rollback_after_error(
            conn,
            format!("v{} products.plu_target追加失敗: {}", version, e),
        ));
    }

    if let Err(e) = conn.execute(
        "INSERT INTO schema_versions (version, applied_at) VALUES (?1, ?2)",
        rusqlite::params![version, now],
    ) {
        return Err(migration_tx::rollback_after_error(
            conn,
            format!("v{} バージョン記録失敗: {}", version, e),
        ));
    }

    migration_tx::commit_transaction(conn, &format!("v{} COMMIT失敗", version))?;

    Ok(())
}
