//! CMD-02: 入庫コマンド群
//!
//! 44-cmd-inventory.md §23.1〜§23.2 に基づく実装。

use crate::biz::{
    inventory_service, ListQuery, PaginatedResult, ReceivingRecordDetail,
    ReceivingRecordWithSupplier,
};
use crate::cmd::{AppState, CmdError};
use tauri::State;

/// 入庫記録を作成する
///
/// 44-cmd-inventory.md §23.1 create_receiving
#[tauri::command]
#[specta::specta]
pub fn create_receiving(
    state: State<AppState>,
    req: inventory_service::ReceivingCreateRequest,
) -> Result<inventory_service::ReceivingCreateResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::create_receiving(&mut conn, req).map_err(CmdError::from)
}

/// 入庫記録一覧を返す
///
/// 44-cmd-inventory.md §23.2 list_receivings
#[tauri::command]
#[specta::specta]
pub fn list_receivings(
    state: State<AppState>,
    page: u32,
    per_page: u32,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<ReceivingRecordWithSupplier>, CmdError> {
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
    inventory_service::list_receivings(&conn, &query).map_err(CmdError::from)
}

/// 入庫記録詳細を返す
///
/// 65-inventory-record-traceability.md §65.7 getReceivingRecord
#[tauri::command]
#[specta::specta]
pub fn get_receiving_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<ReceivingRecordDetail, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::get_receiving_record(&conn, record_id).map_err(CmdError::from)
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

    /// list_receivings: 個別パラメータ→ListQuery組み立て→BIZ呼び出しの統合テスト
    #[test]
    fn test_list_receivings_req201_via_biz() {
        let conn = setup_db();
        let query = crate::biz::ListQuery {
            page: 1,
            per_page: 20,
            date_from: None,
            date_to: None,
        };
        let result = crate::biz::inventory_service::list_receivings(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert_eq!(result.page, 1);
        assert_eq!(result.per_page, 20);
    }

    /// BizError::ValidationFailed → CmdError { kind: "validation" }
    #[test]
    fn test_biz_validation_req201_to_cmd_error() {
        // REQ-201: 入庫記録
        let biz_err = BizError::ValidationFailed("ページパラメータが不正です".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "validation");
        assert!(cmd_err.message.contains("ページパラメータ"));
    }
}
