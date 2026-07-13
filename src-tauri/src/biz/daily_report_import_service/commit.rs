use crate::biz::daily_report_import_service::{
    source_kind_db_value, CachedDailyReportPreview, DailyReportDuplicateStatus,
    DailyReportImportResult,
};
use crate::biz::BizError;
use crate::constants;
use crate::db::sales_repo::{
    self, NewDailyReportDepartmentLine, NewDailyReportImport, NewDailyReportPaymentLine,
    NewDailyReportSummaryLine,
};
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::{DbConnection, DbError};

pub fn commit_daily_report_import(
    conn: &mut DbConnection,
    cached_preview: CachedDailyReportPreview,
    overwrite_confirmed: bool,
) -> Result<DailyReportImportResult, BizError> {
    if cached_preview.created_at.elapsed().as_secs() > constants::PREVIEW_CACHE_TTL_SECS {
        return Err(BizError::ImportError(
            "プレビューの有効期限が切れています".to_string(),
        ));
    }
    match cached_preview.preview_data.duplicate_check.status {
        DailyReportDuplicateStatus::AlreadyImported => {
            return Err(BizError::IdempotencyConflict(
                "この日報bundleは取込み済みです".to_string(),
            ));
        }
        DailyReportDuplicateStatus::OverwriteRequired if !overwrite_confirmed => {
            return Err(BizError::ValidationFailed(
                "同日のデータが取込み済みです。上書き確認が必要です".to_string(),
            ));
        }
        _ => {}
    }

    let result = execute_commit(conn, &cached_preview, overwrite_confirmed);
    if result.is_err() {
        let log = NewOperationLog {
            operation_type: "daily_report_import_failed".to_string(),
            summary: "日報取込みに失敗しました".to_string(),
            detail_json: None,
        };
        if let Err(e) = system_repo::insert_operation_log(conn, &log) {
            tracing::warn!(error = %e, "操作ログ記録に失敗");
        }
    }
    result
}

fn execute_commit(
    conn: &mut DbConnection,
    cached_preview: &CachedDailyReportPreview,
    overwrite_confirmed: bool,
) -> Result<DailyReportImportResult, BizError> {
    let report_date = &cached_preview.preview_data.file_info.report_date;
    let bundle_hash = &cached_preview.preview_data.file_info.bundle_hash;
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    if sales_repo::find_blocking_daily_report_by_bundle_hash(&tx, bundle_hash)?.is_some() {
        return Err(BizError::IdempotencyConflict(
            "この日報bundleは取込み済みです".to_string(),
        ));
    }
    let same_date = sales_repo::find_daily_report_imports_by_report_date(&tx, report_date)?;
    if !same_date.is_empty() {
        if !overwrite_confirmed {
            return Err(BizError::ValidationFailed(
                "同日のデータが取込み済みです。再度プレビューしてください".to_string(),
            ));
        }
        for existing in same_date {
            sales_repo::rollback_daily_report_import(&tx, existing.id, &now)?;
        }
    }

    let source_files_json =
        serde_json::to_string(&cached_preview.preview_data.file_info.source_files)
            .map_err(|e| BizError::ImportError(e.to_string()))?;
    let note = if cached_preview.preview_data.warnings.is_empty() {
        None
    } else {
        Some(
            cached_preview
                .preview_data
                .warnings
                .iter()
                .map(|warning| warning.message.clone())
                .collect::<Vec<_>>()
                .join("\n"),
        )
    };

    let import_id = sales_repo::insert_daily_report_import(
        &tx,
        &NewDailyReportImport {
            report_date: report_date.clone(),
            source_adapter: "casio_sr_s4000".to_string(),
            bundle_hash: bundle_hash.clone(),
            source_files_json,
            gross_amount: cached_preview.preview_data.totals.gross_amount,
            net_amount: cached_preview.preview_data.totals.net_amount,
            status: "completed".to_string(),
            note,
        },
    )?;

    let summary_rows: Vec<NewDailyReportSummaryLine> = cached_preview
        .summary_lines
        .iter()
        .map(|line| NewDailyReportSummaryLine {
            daily_report_import_id: import_id,
            source_file: source_kind_db_value(
                crate::io::daily_report_parser::DailyReportSourceKind::Z001,
            )
            .to_string(),
            line_key: line.line_key.clone(),
            label: line.label.clone(),
            amount: line.amount,
            quantity: line.quantity,
            count: line.count,
            sort_order: line.sort_order,
        })
        .collect();
    sales_repo::insert_daily_report_summary_lines(&tx, &summary_rows)?;

    let payment_rows: Vec<NewDailyReportPaymentLine> = cached_preview
        .payment_lines
        .iter()
        .map(|line| NewDailyReportPaymentLine {
            daily_report_import_id: import_id,
            source_file: source_kind_db_value(
                crate::io::daily_report_parser::DailyReportSourceKind::Z002,
            )
            .to_string(),
            payment_key: line.payment_key.clone(),
            label: line.label.clone(),
            amount: line.amount,
            count: line.count,
            sort_order: line.sort_order,
        })
        .collect();
    sales_repo::insert_daily_report_payment_lines(&tx, &payment_rows)?;

    let department_rows: Vec<NewDailyReportDepartmentLine> = cached_preview
        .department_lines
        .iter()
        .map(|line| NewDailyReportDepartmentLine {
            daily_report_import_id: import_id,
            source_file: source_kind_db_value(
                crate::io::daily_report_parser::DailyReportSourceKind::Z005,
            )
            .to_string(),
            department_id: line.department_id,
            raw_department_name: line.raw_department_name.clone(),
            normalized_department_name: line.normalized_department_name.clone(),
            amount: line.amount,
            quantity: line.quantity,
            count: line.count,
            sort_order: line.sort_order,
        })
        .collect();
    sales_repo::insert_daily_report_department_lines(&tx, &department_rows)?;

    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    let log = NewOperationLog {
        operation_type: "daily_report_import".to_string(),
        summary: format!("日報取込み完了: {}", report_date),
        detail_json: Some(
            serde_json::json!({
                "daily_report_import_id": import_id,
                "report_date": report_date,
                "bundle_hash": bundle_hash,
            })
            .to_string(),
        ),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(DailyReportImportResult {
        daily_report_import_id: import_id,
        status: "completed".to_string(),
        report_date: report_date.clone(),
        gross_amount: cached_preview.preview_data.totals.gross_amount,
        net_amount: cached_preview.preview_data.totals.net_amount,
        warning_count: cached_preview.preview_data.warnings.len() as i64,
    })
}
