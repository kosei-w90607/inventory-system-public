//! CMD-04: 手動販売出庫コマンド群
//!
//! 44-cmd-inventory.md §23.6 に基づく実装。

use crate::biz::{inventory_service, ManualSaleRecordDetail};
use crate::cmd::{AppState, CmdError};
use tauri::State;

/// 手動販売出庫を作成する
///
/// 44-cmd-inventory.md §23.6 create_manual_sale
/// PLU警告がある場合は2段階確認フロー（needs_confirmation + confirmation_token）
#[tauri::command]
#[specta::specta]
pub fn create_manual_sale(
    state: State<AppState>,
    req: inventory_service::ManualSaleCreateRequest,
) -> Result<inventory_service::ManualSaleCreateResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::create_manual_sale(&mut conn, req).map_err(CmdError::from)
}

/// 手動販売記録詳細を返す
///
/// 65-inventory-record-traceability.md §65.7 getManualSaleRecord
#[tauri::command]
#[specta::specta]
pub fn get_manual_sale_record(
    state: State<AppState>,
    record_id: i64,
) -> Result<ManualSaleRecordDetail, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::get_manual_sale_record(&conn, record_id).map_err(CmdError::from)
}

#[cfg(test)]
mod tests {
    use crate::biz::BizError;
    use crate::cmd::CmdError;
    use crate::db::DbError;

    /// BizError::DatabaseError → CmdError { kind: "internal" }
    #[test]
    fn test_biz_db_error_req203_to_cmd_error() {
        // REQ-203: 手動販売出庫
        let db_err = DbError::QueryFailed("test".to_string());
        let biz_err = BizError::DatabaseError(db_err);
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "internal");
        assert!(cmd_err.message.contains("データベースエラー"));
    }
}
