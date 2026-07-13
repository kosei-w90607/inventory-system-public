//! BIZ-08: 日報取込みパイプライン

mod commit;
mod list;
mod parse;
mod rollback;

#[cfg(test)]
mod tests;

#[allow(unused_imports)]
pub use commit::commit_daily_report_import;
#[allow(unused_imports)]
pub use list::list_daily_report_imports;
#[allow(unused_imports)]
pub use parse::parse_and_validate_daily_report;
#[allow(unused_imports)]
pub use rollback::rollback_daily_report_import;

use crate::db::sales_repo::DailyReportImport;
use crate::io::daily_report_parser::DailyReportSourceKind;
use serde::Serialize;
use std::time::Instant;

#[derive(Debug)]
pub struct DailyReportParseValidateResult {
    pub preview_data: DailyReportPreviewData,
    pub cached_preview: CachedDailyReportPreview,
}

#[derive(Debug, Clone)]
pub struct DailyReportInputFile {
    pub filename: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportPreviewData {
    pub file_info: DailyReportFileInfo,
    pub totals: DailyReportTotals,
    pub payment_summary: Vec<DailyReportPaymentLinePreview>,
    pub department_summary: Vec<DailyReportDepartmentLinePreview>,
    pub warnings: Vec<DailyReportWarning>,
    pub duplicate_check: DailyReportDuplicateCheck,
    pub preview_created_at: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportFileInfo {
    pub report_date: String,
    pub bundle_hash: String,
    pub source_files: Vec<DailyReportSourceFileInfo>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportSourceFileInfo {
    pub source: DailyReportSourceKind,
    pub filename: String,
    pub file_hash: String,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportTotals {
    pub gross_amount: Option<i64>,
    pub net_amount: Option<i64>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportPaymentLinePreview {
    pub payment_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportDepartmentLinePreview {
    pub department_id: Option<i64>,
    pub raw_department_name: String,
    pub normalized_department_name: Option<String>,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportWarning {
    pub code: String,
    pub message: String,
    pub source_file: Option<DailyReportSourceKind>,
    pub line_no: Option<i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, specta::Type)]
pub enum DailyReportDuplicateStatus {
    NoDuplicate,
    AlreadyImported,
    OverwriteRequired,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DailyReportDuplicateCheck {
    pub status: DailyReportDuplicateStatus,
    pub existing_import_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct CachedDailyReportPreview {
    pub created_at: Instant,
    pub preview_data: DailyReportPreviewData,
    pub summary_lines: Vec<CachedDailyReportSummaryLine>,
    pub payment_lines: Vec<DailyReportPaymentLinePreview>,
    pub department_lines: Vec<DailyReportDepartmentLinePreview>,
}

#[derive(Debug, Clone)]
pub struct CachedDailyReportSummaryLine {
    pub line_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct DailyReportImportResult {
    pub daily_report_import_id: i64,
    pub status: String,
    pub report_date: String,
    pub gross_amount: Option<i64>,
    pub net_amount: Option<i64>,
    pub warning_count: i64,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct DailyReportRollbackResult {
    pub daily_report_import_id: i64,
    pub status: String,
    pub rolled_back_at: Option<String>,
}

#[derive(Debug)]
pub struct ListDailyReportImportsQuery {
    pub page: i64,
    pub per_page: i64,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub status: Option<String>,
}

pub type DailyReportImportRow = DailyReportImport;

pub(crate) fn source_kind_order(source: DailyReportSourceKind) -> i64 {
    match source {
        DailyReportSourceKind::Z001 => 1,
        DailyReportSourceKind::Z002 => 2,
        DailyReportSourceKind::Z005 => 3,
    }
}

pub(crate) fn source_kind_db_value(source: DailyReportSourceKind) -> &'static str {
    match source {
        DailyReportSourceKind::Z001 => "Z001",
        DailyReportSourceKind::Z002 => "Z002",
        DailyReportSourceKind::Z005 => "Z005",
    }
}
