//! CMD-03: 返品・交換コマンド群
//!
//! 44-cmd-inventory.md §23.4〜§23.5 に基づく実装。

use crate::biz::{
    inventory_service, ListQuery, PaginatedResult, ReturnRecordDetail, ReturnRecordSummary,
};
use crate::cmd::{AppState, CmdError};
use tauri::State;

/// 返品・交換記録を作成する
///
/// 44-cmd-inventory.md §23.4 create_return
#[tauri::command]
#[specta::specta]
pub fn create_return(
    state: State<AppState>,
    req: inventory_service::ReturnCreateRequest,
) -> Result<inventory_service::ReturnCreateResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::create_return(&mut conn, req).map_err(CmdError::from)
}

/// 返品・交換記録一覧を返す
///
/// 44-cmd-inventory.md §23.5 list_returns
#[tauri::command]
#[specta::specta]
pub fn list_returns(
    state: State<AppState>,
    page: u32,
    per_page: u32,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<ReturnRecordSummary>, CmdError> {
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
    inventory_service::list_returns(&conn, &query).map_err(CmdError::from)
}

/// 返品・交換記録詳細を返す
///
/// 65-inventory-record-traceability.md §65.7 getReturnRecord
#[tauri::command]
#[specta::specta]
pub fn get_return_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<ReturnRecordDetail, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::get_return_record(&conn, record_id).map_err(CmdError::from)
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

    /// list_returns: 個別パラメータ→ListQuery組み立て→BIZ呼び出しの統合テスト
    #[test]
    fn test_list_returns_req202_via_biz() {
        let conn = setup_db();
        let query = crate::biz::ListQuery {
            page: 1,
            per_page: 20,
            date_from: None,
            date_to: None,
        };
        let result = crate::biz::inventory_service::list_returns(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert_eq!(result.page, 1);
    }

    /// BizError::NotFound → CmdError { kind: "not_found" }
    #[test]
    fn test_biz_not_found_req202_to_cmd_error() {
        // REQ-202: 返品・交換
        let biz_err = BizError::NotFound("商品が見つかりません".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "not_found");
    }
}
