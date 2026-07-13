use crate::biz::daily_report_import_service::DailyReportRollbackResult;
use crate::biz::BizError;
use crate::db::sales_repo;
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::{DbConnection, DbError};

pub fn rollback_daily_report_import(
    conn: &mut DbConnection,
    daily_report_import_id: i64,
) -> Result<DailyReportRollbackResult, BizError> {
    let import = sales_repo::find_daily_report_import_by_id(conn, daily_report_import_id)?
        .ok_or_else(|| {
            BizError::NotFound(format!(
                "日報取込み記録が見つかりません: ID {}",
                daily_report_import_id
            ))
        })?;
    if import.status == "rolled_back" {
        return Ok(DailyReportRollbackResult {
            daily_report_import_id,
            status: "rolled_back".to_string(),
            rolled_back_at: import.rolled_back_at,
        });
    }

    let rolled_back_at = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;
    sales_repo::rollback_daily_report_import(&tx, daily_report_import_id, &rolled_back_at)?;
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    let log = NewOperationLog {
        operation_type: "daily_report_rollback".to_string(),
        summary: format!("日報取込みを取消しました: ID {}", daily_report_import_id),
        detail_json: Some(
            serde_json::json!({
                "daily_report_import_id": daily_report_import_id,
            })
            .to_string(),
        ),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(DailyReportRollbackResult {
        daily_report_import_id,
        status: "rolled_back".to_string(),
        rolled_back_at: Some(rolled_back_at),
    })
}
