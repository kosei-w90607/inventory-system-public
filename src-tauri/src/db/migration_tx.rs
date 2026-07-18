//! Migration transaction failure handling shared by schema migrations.
//!
//! `docs/function-design/22-mnt-migration.md` §3.2 MNT-03-D1 に基づく。

use super::DbError;
use rusqlite::Connection;

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum FailurePoint {
    Rollback,
    Commit,
    ForeignKeyRestore,
    ForeignKeyRestoreNoop,
    ForeignKeyVerify,
}

#[cfg(test)]
thread_local! {
    static FAILURES: std::cell::RefCell<Vec<FailurePoint>> = const { std::cell::RefCell::new(Vec::new()) };
}

#[cfg(test)]
pub(crate) struct FailureGuard {
    previous: Vec<FailurePoint>,
}

#[cfg(test)]
impl Drop for FailureGuard {
    fn drop(&mut self) {
        FAILURES.with(|failures| {
            *failures.borrow_mut() = std::mem::take(&mut self.previous);
        });
    }
}

#[cfg(test)]
pub(crate) fn fail_operations(operations: &[FailurePoint]) -> FailureGuard {
    let previous = FAILURES.with(|failures| failures.replace(operations.to_vec()));
    FailureGuard { previous }
}

#[cfg(test)]
fn should_fail(operation: FailurePoint) -> bool {
    FAILURES.with(|failures| failures.borrow().contains(&operation))
}

#[cfg(test)]
fn injected_error(operation: &str) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(format!("injected {operation} failure"))
}

fn execute_rollback(conn: &Connection) -> Result<(), rusqlite::Error> {
    #[cfg(test)]
    if should_fail(FailurePoint::Rollback) {
        return Err(injected_error("ROLLBACK"));
    }
    conn.execute_batch("ROLLBACK;")
}

fn execute_commit(conn: &Connection) -> Result<(), rusqlite::Error> {
    #[cfg(test)]
    if should_fail(FailurePoint::Commit) {
        return Err(injected_error("COMMIT"));
    }
    conn.execute_batch("COMMIT;")
}

pub(crate) fn rollback_after_error(conn: &Connection, original: String) -> DbError {
    match execute_rollback(conn) {
        Ok(()) => DbError::MigrationFailed(original),
        Err(rollback_error) => {
            tracing::error!(
                error = %rollback_error,
                original_error = %original,
                "migration ROLLBACK failed; transaction state is unknown"
            );
            DbError::MigrationFailed(format!(
                "{original}（ROLLBACK も失敗: {rollback_error}、transaction 状態不明）"
            ))
        }
    }
}

pub(crate) fn commit_transaction(conn: &Connection, context: &str) -> Result<(), DbError> {
    let commit_error = match execute_commit(conn) {
        Ok(()) => return Ok(()),
        Err(error) => error,
    };
    let original = format!("{context}: {commit_error}");

    tracing::error!(
        error = %commit_error,
        transaction_open = !conn.is_autocommit(),
        "migration COMMIT failed"
    );
    if conn.is_autocommit() {
        return Err(DbError::MigrationFailed(format!(
            "{original}（transaction は終了済み）"
        )));
    }

    match execute_rollback(conn) {
        Ok(()) => Err(DbError::MigrationFailed(format!(
            "{original}（ROLLBACK 成功）"
        ))),
        Err(rollback_error) => {
            tracing::error!(
                error = %rollback_error,
                commit_error = %commit_error,
                "migration ROLLBACK after COMMIT failure also failed; transaction state is unknown"
            );
            Err(DbError::MigrationFailed(format!(
                "{original}（ROLLBACK も失敗: {rollback_error}、transaction 状態不明）"
            )))
        }
    }
}

fn execute_foreign_key_restore(
    conn: &Connection,
    original_foreign_keys: i64,
) -> Result<(), rusqlite::Error> {
    #[cfg(test)]
    {
        if should_fail(FailurePoint::ForeignKeyRestore) {
            return Err(injected_error("foreign_keys restore"));
        }
        if should_fail(FailurePoint::ForeignKeyRestoreNoop) {
            return Ok(());
        }
    }
    conn.execute_batch(&format!("PRAGMA foreign_keys = {original_foreign_keys};"))
}

pub(crate) fn restore_foreign_keys(
    conn: &Connection,
    version: i64,
    original_foreign_keys: i64,
) -> Result<(), DbError> {
    if !conn.is_autocommit() {
        let message =
            format!("v{version} transaction 状態不明のためforeign_keysを復元せず、接続破棄必須");
        tracing::error!("{message}");
        return Err(DbError::MigrationFailed(message));
    }

    execute_foreign_key_restore(conn, original_foreign_keys).map_err(|error| {
        tracing::error!(error = %error, version, "migration foreign_keys restore failed");
        DbError::MigrationFailed(format!(
            "v{version} foreign_keys復元失敗: {error}（接続破棄必須）"
        ))
    })?;

    let restored = read_foreign_keys_for_verification(conn).map_err(|error| {
        tracing::error!(error = %error, version, "migration foreign_keys re-read failed");
        DbError::MigrationFailed(format!(
            "v{version} foreign_keys再読取失敗: {error}（接続破棄必須）"
        ))
    })?;
    if restored != original_foreign_keys {
        tracing::error!(
            expected = original_foreign_keys,
            actual = restored,
            version,
            "migration foreign_keys restore verification failed"
        );
        return Err(DbError::MigrationFailed(format!(
            "v{version} foreign_keys復元検証失敗: expected={original_foreign_keys}, actual={restored}（接続破棄必須）"
        )));
    }

    Ok(())
}

fn read_foreign_keys_for_verification(conn: &Connection) -> Result<i64, rusqlite::Error> {
    #[cfg(test)]
    if should_fail(FailurePoint::ForeignKeyVerify) {
        return Err(injected_error("foreign_keys verify"));
    }
    conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0))
}
