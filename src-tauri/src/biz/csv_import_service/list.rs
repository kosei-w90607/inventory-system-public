//! list_csv_imports — CSV取込み一覧（repo直呼び防止ラッパー）

use crate::biz::BizError;
use crate::db::sales_repo::{self, CsvImport};
use crate::db::{DbConnection, PaginatedResult};

use super::{CsvImportErrorType, CsvImportRecordDetail, ErrorRow};

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

/// CSV取込み記録詳細を wire DTO として返す。
///
/// docs/function-design/32-biz-csv-import-service.md §15.6a / REQ-206 / REQ-207
pub fn get_csv_import_record(
    conn: &DbConnection,
    import_id: i64,
) -> Result<CsvImportRecordDetail, BizError> {
    let core = match sales_repo::get_csv_import_record_detail(conn, import_id) {
        Ok(core) => core,
        Err(crate::db::DbError::NotFound) => {
            return Err(BizError::NotFound(format!(
                "CSV取込み記録が見つかりません: {import_id}"
            )))
        }
        Err(error) => return Err(BizError::DatabaseError(error)),
    };

    let error_rows = sales_repo::list_csv_import_error_rows(conn, import_id)?
        .into_iter()
        .map(|row| {
            let line_no = usize::try_from(row.source_line_no).map_err(|_| {
                crate::db::DbError::QueryFailed(format!(
                    "invalid csv import source line number: {}",
                    row.source_line_no
                ))
            })?;
            Ok(ErrorRow {
                line_no,
                normalized_jan: row.normalized_jan,
                name: row.raw_name,
                raw_quantity: row.raw_quantity,
                raw_amount: row.raw_amount,
                error_type: CsvImportErrorType::from_db(&row.error_type)?,
                error_message: row.error_message,
            })
        })
        .collect::<Result<Vec<_>, crate::db::DbError>>()?;

    let mut movements = core.movements;
    for movement in &mut movements {
        movement.source = crate::biz::inventory_service::resolve_movement_source(
            &movement.reference_type,
            &movement.reference_id,
        );
    }

    Ok(CsvImportRecordDetail {
        id: core.header.id,
        filename: core.header.filename,
        settlement_date: core.header.settlement_date,
        total_items: core.header.total_items,
        total_amount: core.header.total_amount,
        skipped_count: core.header.skipped_count,
        status: core.header.status,
        imported_at: core.header.imported_at,
        items: core.items,
        error_rows,
        movements,
    })
}
