//! list_csv_imports — CSV取込み一覧（repo直呼び防止ラッパー）

use crate::biz::BizError;
use crate::db::sales_repo::{self, CsvImport};
use crate::db::{DbConnection, PaginatedResult};

/// csv_imports 一覧を返す
///
/// docs/function-design/32-biz-csv-import-service.md §15.6
pub fn list_csv_imports(
    conn: &DbConnection,
    page: u32,
    per_page: u32,
) -> Result<PaginatedResult<CsvImport>, BizError> {
    if !(1..=u32::MAX).contains(&page) || !(1..=100).contains(&per_page) {
        return Err(BizError::ValidationFailed(
            "ページパラメータが不正です".to_string(),
        ));
    }
    Ok(sales_repo::list_csv_imports(conn, page, per_page)?)
}
