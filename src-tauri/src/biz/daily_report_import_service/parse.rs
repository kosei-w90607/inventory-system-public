use crate::biz::daily_report_import_service::{
    source_kind_order, CachedDailyReportPreview, CachedDailyReportSummaryLine,
    DailyReportDepartmentLinePreview, DailyReportDuplicateCheck, DailyReportDuplicateStatus,
    DailyReportFileInfo, DailyReportInputFile, DailyReportParseValidateResult,
    DailyReportPaymentLinePreview, DailyReportPreviewData, DailyReportSourceFileInfo,
    DailyReportTotals, DailyReportWarning,
};
use crate::biz::BizError;
use crate::constants;
use crate::db::product_repo;
use crate::db::sales_repo;
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::DbConnection;
use crate::io::daily_report_parser::{self, DailyReportSourceFile};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::Instant;

pub fn parse_and_validate_daily_report(
    conn: &DbConnection,
    files: Vec<DailyReportInputFile>,
) -> Result<DailyReportParseValidateResult, BizError> {
    if files
        .iter()
        .any(|file| file.bytes.len() > constants::CSV_IMPORT_FILE_SIZE_LIMIT)
    {
        return Err(BizError::ImportError(
            "ファイルサイズが上限（20MB）を超えています".to_string(),
        ));
    }

    let source_files = files
        .into_iter()
        .map(|file| DailyReportSourceFile {
            filename: file.filename,
            bytes: file.bytes,
        })
        .collect();
    let parse_result = daily_report_parser::parse_daily_report_bundle(source_files);
    if !parse_result.parse_errors.is_empty() {
        log_parse_failure(conn, "日報ファイルの解析に失敗しました");
        return Err(BizError::ImportError(
            "日報ファイルの解析に失敗しました".to_string(),
        ));
    }

    let report_date = parse_result.report_date.ok_or_else(|| {
        log_parse_failure(conn, "日報ファイルの対象日を抽出できません");
        BizError::ImportError("日報ファイルの対象日を抽出できません".to_string())
    })?;
    let parsed_date =
        chrono::NaiveDate::parse_from_str(&report_date, "%Y-%m-%d").map_err(|_| {
            BizError::ImportError(format!("日報対象日が不正な日付です: {}", report_date))
        })?;
    if parsed_date > chrono::Local::now().date_naive() {
        return Err(BizError::ImportError(format!(
            "日報対象日が未来の日付です: {}",
            report_date
        )));
    }

    let bundle_hash = build_bundle_hash(&parse_result.source_files);

    let gross_amount = parse_result
        .summary_lines
        .iter()
        .find(|line| line.line_key == "gross_sales")
        .and_then(|line| line.amount);
    let net_amount = parse_result
        .summary_lines
        .iter()
        .find(|line| line.line_key == "net_sales")
        .and_then(|line| line.amount);
    if gross_amount.is_none() && net_amount.is_none() {
        return Err(BizError::ImportError(
            "必須サマリ（総売上または純売上）を導出できません".to_string(),
        ));
    }

    let departments = product_repo::list_departments(conn)?;
    let department_ids_by_name: HashMap<String, i64> = departments
        .into_iter()
        .map(|department| (department.name, department.id))
        .collect();
    let mut warnings = Vec::new();
    let department_summary: Vec<DailyReportDepartmentLinePreview> = parse_result
        .department_lines
        .iter()
        .map(|line| {
            let department_id = line
                .normalized_department_name
                .as_ref()
                .and_then(|name| department_ids_by_name.get(name).copied());
            if department_id.is_none() {
                warnings.push(DailyReportWarning {
                    code: "unmatched_department".to_string(),
                    message: format!("部門マスタに一致しません: {}", line.raw_department_name),
                    source_file: Some(line.source_file),
                    line_no: None,
                });
            }
            DailyReportDepartmentLinePreview {
                department_id,
                raw_department_name: line.raw_department_name.clone(),
                normalized_department_name: line.normalized_department_name.clone(),
                amount: line.amount,
                quantity: line.quantity,
                count: line.count,
                sort_order: line.sort_order,
            }
        })
        .collect();

    let duplicate_check = if let Some(existing) =
        sales_repo::find_blocking_daily_report_by_bundle_hash(conn, &bundle_hash)?
    {
        DailyReportDuplicateCheck {
            status: DailyReportDuplicateStatus::AlreadyImported,
            existing_import_id: Some(existing.id),
        }
    } else {
        let same_date = sales_repo::find_daily_report_imports_by_report_date(conn, &report_date)?;
        if same_date.is_empty() {
            DailyReportDuplicateCheck {
                status: DailyReportDuplicateStatus::NoDuplicate,
                existing_import_id: None,
            }
        } else {
            DailyReportDuplicateCheck {
                status: DailyReportDuplicateStatus::OverwriteRequired,
                existing_import_id: Some(same_date[0].id),
            }
        }
    };

    let source_files: Vec<DailyReportSourceFileInfo> = parse_result
        .source_files
        .iter()
        .map(|source| DailyReportSourceFileInfo {
            source: source.source,
            filename: source.filename.clone(),
            file_hash: source.file_hash.clone(),
            size_bytes: source.size_bytes,
        })
        .collect();
    let summary_lines: Vec<CachedDailyReportSummaryLine> = parse_result
        .summary_lines
        .iter()
        .map(|line| CachedDailyReportSummaryLine {
            line_key: line.line_key.clone(),
            label: line.label.clone(),
            amount: line.amount,
            quantity: line.quantity,
            count: line.count,
            sort_order: line.sort_order,
        })
        .collect();
    let payment_summary: Vec<DailyReportPaymentLinePreview> = parse_result
        .payment_lines
        .iter()
        .map(|line| DailyReportPaymentLinePreview {
            payment_key: line.payment_key.clone(),
            label: line.label.clone(),
            amount: line.amount,
            count: line.count,
            sort_order: line.sort_order,
        })
        .collect();

    let preview_data = DailyReportPreviewData {
        file_info: DailyReportFileInfo {
            report_date,
            bundle_hash,
            source_files,
        },
        totals: DailyReportTotals {
            gross_amount,
            net_amount,
        },
        payment_summary: payment_summary.clone(),
        department_summary: department_summary.clone(),
        warnings: warnings.clone(),
        duplicate_check,
        preview_created_at: chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
    };
    let cached_preview = CachedDailyReportPreview {
        created_at: Instant::now(),
        preview_data: preview_data.clone(),
        summary_lines,
        payment_lines: payment_summary,
        department_lines: department_summary,
    };

    Ok(DailyReportParseValidateResult {
        preview_data,
        cached_preview,
    })
}

fn build_bundle_hash(sources: &[daily_report_parser::ParsedDailyReportSourceFile]) -> String {
    let mut parts: Vec<_> = sources.iter().collect();
    parts.sort_by_key(|source| source_kind_order(source.source));
    let joined = parts
        .iter()
        .map(|source| {
            format!(
                "{:?}:{}:{}",
                source.source, source.file_hash, source.size_bytes
            )
        })
        .collect::<Vec<_>>()
        .join("|");
    let mut hasher = Sha256::new();
    hasher.update(joined.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn log_parse_failure(conn: &DbConnection, message: &str) {
    let log = NewOperationLog {
        operation_type: "daily_report_parse_failed".to_string(),
        summary: message.to_string(),
        detail_json: None,
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }
}
