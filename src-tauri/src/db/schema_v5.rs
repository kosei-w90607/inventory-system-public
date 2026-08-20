//! migration v5: PLU slot 永続割当
//!
//! docs/db-design/plu-tables.md §25 / REQ-907 に基づく実装。

use crate::constants::{PLU_EXPORT_LIMIT, SCANNING_PLU_EXPORT_LIMIT, SCANNING_PLU_MEMORY_START};

use super::{migration_tx, DbError};
use rusqlite::{params, Connection};

const CREATE_PLU_SLOTS_SQL: &str = r#"
CREATE TABLE plu_slots (
    memory_no INTEGER PRIMARY KEY CHECK(memory_no BETWEEN 217 AND 5000),
    scanning_code TEXT,
    status TEXT NOT NULL CHECK(status IN ('free','external','reserved','active','release_pending')),
    reserved_at TEXT,
    activated_at TEXT,
    released_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_plu_slots_live_scanning_code
ON plu_slots(scanning_code)
WHERE scanning_code IS NOT NULL
  AND status IN ('external','reserved','active');
"#;

pub(crate) fn apply_v5_plu_slots(conn: &Connection, version: i64) -> Result<(), DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute_batch("BEGIN;")
        .map_err(|e| DbError::MigrationFailed(format!("v{version} BEGIN失敗: {e}")))?;

    let result = (|| -> Result<(), DbError> {
        conn.execute_batch(CREATE_PLU_SLOTS_SQL)
            .map_err(|e| DbError::MigrationFailed(format!("v{version} plu_slots作成失敗: {e}")))?;

        let end = PLU_EXPORT_LIMIT;
        debug_assert_eq!(
            end + 1 - SCANNING_PLU_MEMORY_START,
            SCANNING_PLU_EXPORT_LIMIT
        );
        for memory_no in SCANNING_PLU_MEMORY_START..=end {
            conn.execute(
                "INSERT INTO plu_slots (memory_no, status, updated_at) VALUES (?1, 'free', ?2)",
                params![memory_no as i64, now],
            )?;
        }

        let (count, min_memory, max_memory, free_count): (i64, i64, i64, i64) = conn.query_row(
            "SELECT COUNT(*), MIN(memory_no), MAX(memory_no),
                    SUM(CASE WHEN status = 'free' THEN 1 ELSE 0 END)
             FROM plu_slots",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?;
        let expected_count = SCANNING_PLU_EXPORT_LIMIT as i64;
        if count != expected_count
            || free_count != expected_count
            || min_memory != SCANNING_PLU_MEMORY_START as i64
            || max_memory != end as i64
        {
            return Err(DbError::MigrationFailed(format!(
                "v{version} plu_slots検証失敗: count={count}, min={min_memory}, max={max_memory}, free={free_count}"
            )));
        }

        conn.execute(
            "INSERT INTO schema_versions (version, applied_at) VALUES (?1, ?2)",
            params![version, now],
        )?;
        Ok(())
    })();

    if let Err(error) = result {
        return Err(migration_tx::rollback_after_error(
            conn,
            format!("v{version} PLU slot migration失敗: {error}"),
        ));
    }
    migration_tx::commit_transaction(conn, &format!("v{version} COMMIT失敗"))
}
