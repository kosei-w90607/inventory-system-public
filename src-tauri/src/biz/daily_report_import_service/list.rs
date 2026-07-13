use crate::biz::daily_report_import_service::{DailyReportImportRow, ListDailyReportImportsQuery};
use crate::biz::BizError;
use crate::db::sales_repo;
use crate::db::{DbConnection, PaginatedResult};

pub fn list_daily_report_imports(
    conn: &DbConnection,
    query: ListDailyReportImportsQuery,
) -> Result<PaginatedResult<DailyReportImportRow>, BizError> {
    if query.page < 1 || query.per_page < 1 || query.per_page > 100 {
        return Err(BizError::ValidationFailed(
            "ページパラメータが不正です".to_string(),
        ));
    }
    if let Some(status) = &query.status {
        if !matches!(status.as_str(), "completed" | "rolled_back") {
            return Err(BizError::ValidationFailed(
                "statusパラメータが不正です".to_string(),
            ));
        }
    }

    Ok(sales_repo::list_daily_report_imports(
        conn,
        query.page as u32,
        query.per_page as u32,
        query.date_from.as_deref(),
        query.date_to.as_deref(),
    )?)
}
