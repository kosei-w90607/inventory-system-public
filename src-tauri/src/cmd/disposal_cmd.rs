//! CMD-05: 廃棄・破損コマンド群
//!
//! 44-cmd-inventory.md §23.7 に基づく実装。

use crate::biz::{
    inventory_service, DisposalRecordDetail, DisposalRecordSummary, InventoryRecordQuery,
    InventoryRecordSummary, ListQuery, PaginatedResult,
};
use crate::cmd::{AppState, CmdError};
use tauri::State;

/// 廃棄・破損記録を作成する
///
/// 44-cmd-inventory.md §23.7 create_disposal
#[tauri::command]
#[specta::specta]
pub fn create_disposal(
    state: State<AppState>,
    req: inventory_service::DisposalCreateRequest,
) -> Result<inventory_service::DisposalCreateResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::create_disposal(&mut conn, req).map_err(CmdError::from)
}

/// 廃棄・破損記録一覧を返す
///
/// 44-cmd-inventory.md §23.7 list_disposals
#[tauri::command]
#[specta::specta]
pub fn list_disposals(
    state: State<AppState>,
    page: u32,
    per_page: u32,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<DisposalRecordSummary>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let query = ListQuery {
        page,
        per_page,
        date_from,
        date_to,
    };
    inventory_service::list_disposals(&conn, &query).map_err(CmdError::from)
}

/// 入出庫履歴ハブの業務記録一覧を返す
///
/// 65-inventory-record-traceability.md §65.7 listInventoryRecords
#[tauri::command]
#[specta::specta]
pub fn list_inventory_records(
    state: State<AppState>,
    query: InventoryRecordQuery,
) -> Result<PaginatedResult<InventoryRecordSummary>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::list_inventory_records(&conn, &query).map_err(CmdError::from)
}

/// 廃棄・破損記録詳細を返す
///
/// 65-inventory-record-traceability.md §65.7 getDisposalRecord
#[tauri::command]
#[specta::specta]
pub fn get_disposal_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<DisposalRecordDetail, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::get_disposal_record(&conn, record_id).map_err(CmdError::from)
}

#[cfg(test)]
mod tests {
    use crate::biz::BizError;
    use crate::cmd::CmdError;
    use crate::db;

    fn setup_db() -> db::DbConnection {
        let conn = db::init_database(":memory:").unwrap();
        db::migration::migrate(&conn).unwrap();
        conn
    }

    /// list_disposals: 個別パラメータ→ListQuery組み立て→BIZ呼び出しの統合テスト
    #[test]
    fn test_list_disposals_req204_via_biz() {
        let conn = setup_db();
        let query = crate::biz::ListQuery {
            page: 1,
            per_page: 20,
            date_from: None,
            date_to: None,
        };
        let result = crate::biz::inventory_service::list_disposals(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert_eq!(result.page, 1);
    }

    /// BizError::IdempotencyConflict → CmdError { kind: "idempotency_conflict" }
    #[test]
    fn test_biz_idempotency_req204_to_cmd_error() {
        // REQ-204: 廃棄・破損
        let biz_err = BizError::IdempotencyConflict("競合".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "idempotency_conflict");
    }
}
