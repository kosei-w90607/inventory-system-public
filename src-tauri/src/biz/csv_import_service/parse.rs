//! parse_and_validate — Stage 1+2+3（Parse + Validate + Preview）

use crate::biz::csv_import_service::{
    CsvParseAndValidateRequest, DuplicateCheck, DuplicateStatus, ErrorRow, ErrorSummary, FileInfo,
    MatchedRow, MatchedSummary, ParseValidateResult, PreviewData,
};
use crate::biz::BizError;
use crate::constants;
use crate::db::product_repo;
use crate::db::sales_repo;
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::DbConnection;
use crate::io::z004_parser::{self, ParseErrorType, Z004ParseError};
use uuid::Uuid;

/// Z004ファイルを解析し、マスタ照合後のプレビューデータを返す
///
/// 業務テーブルへの書き込みなし（parse失敗時のoperation_log記録は例外）。
/// preview_token を生成して返す（キャッシュ保存はCMD層の責務）。
///
/// docs/function-design/32-biz-csv-import-service.md §15.3
pub fn parse_and_validate(
    conn: &DbConnection,
    req: CsvParseAndValidateRequest,
) -> Result<ParseValidateResult, BizError> {
    // 1. サイズガード
    if req.file_bytes.len() > constants::CSV_IMPORT_FILE_SIZE_LIMIT {
        return Err(BizError::ImportError(
            "ファイルサイズが上限（20MB）を超えています".to_string(),
        ));
    }

    // 2. Stage 1: Parse（IO-02 委譲）
    let parse_result = match z004_parser::parse_z004(&req.file_bytes) {
        Ok(result) => result,
        Err(e) => {
            let msg = match &e {
                Z004ParseError::DecodeFailed(_) => {
                    "Z004ファイルの解析に失敗しました: CP932デコードエラー"
                }
                Z004ParseError::NoDataLines(_) => {
                    "Z004ファイルの解析に失敗しました: データ行がありません"
                }
                Z004ParseError::NoSettlementDate(_) => {
                    "Z004ファイルの解析に失敗しました: 精算日を抽出できません"
                }
            };
            log_parse_failure(conn, msg);
            return Err(BizError::ImportError(msg.to_string()));
        }
    };

    // parsed_rows が 0件かつ parse_errors が非空
    if parse_result.parsed_rows.is_empty() && !parse_result.parse_errors.is_empty() {
        let msg = "有効なデータがありません";
        log_parse_failure(conn, msg);
        return Err(BizError::ImportError(msg.to_string()));
    }

    // 2a. settlement_date 業務妥当性チェック
    let parsed_date = chrono::NaiveDate::parse_from_str(&parse_result.settlement_date, "%Y-%m-%d")
        .map_err(|_| {
            BizError::ImportError(format!(
                "精算日が不正な日付です: {}",
                parse_result.settlement_date
            ))
        })?;
    let today = chrono::Local::now().date_naive();
    if parsed_date > today {
        return Err(BizError::ImportError(format!(
            "精算日が未来の日付です: {}",
            parse_result.settlement_date
        )));
    }

    // 3. 行数ガード
    if parse_result.total_data_lines > constants::CSV_IMPORT_LINE_LIMIT {
        return Err(BizError::ImportError(
            "データ行数が上限（10,000行）を超えています".to_string(),
        ));
    }

    // 4. Stage 2: Validate
    let mut matched_rows: Vec<MatchedRow> = Vec::new();
    let mut error_rows: Vec<ErrorRow> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    // 4a-b. 実データ行のマスタ照合
    for row in &parse_result.parsed_rows {
        // 空レコード除外（エラーにもカウントしない）
        if row.quantity == 0 && row.amount == 0 {
            continue;
        }

        let products = product_repo::find_by_jan_code(conn, &row.normalized_jan)?;
        match products.len() {
            0 => {
                error_rows.push(ErrorRow {
                    line_no: row.line_no,
                    normalized_jan: Some(row.normalized_jan.clone()),
                    name: row.name.clone(),
                    raw_quantity: row.quantity.to_string(),
                    raw_amount: row.amount.to_string(),
                    error_type: "unmatched_product".to_string(),
                    error_message: format!("JAN {} に該当する商品がありません", row.normalized_jan),
                });
            }
            1 => {
                matched_rows.push(MatchedRow {
                    line_no: row.line_no,
                    product_code: products[0].product_code.clone(),
                    jan_code: row.normalized_jan.clone(),
                    name: row.name.clone(),
                    quantity: row.quantity,
                    amount: row.amount,
                    pos_stock_sync: products[0].pos_stock_sync,
                });
            }
            _ => {
                // 複数ヒット → 先頭を採用 + warning
                warnings.push(format!(
                    "JAN {} は複数商品に紐付いています（{} を使用）",
                    row.normalized_jan, products[0].product_code
                ));
                matched_rows.push(MatchedRow {
                    line_no: row.line_no,
                    product_code: products[0].product_code.clone(),
                    jan_code: row.normalized_jan.clone(),
                    name: row.name.clone(),
                    quantity: row.quantity,
                    amount: row.amount,
                    pos_stock_sync: products[0].pos_stock_sync,
                });
            }
        }
    }

    // 4c. parse_errors を ErrorRow にマージ
    for pe in &parse_result.parse_errors {
        let error_type_str = match pe.error_type {
            ParseErrorType::InvalidFormat => "invalid_format",
            ParseErrorType::InvalidJan => "invalid_jan",
            ParseErrorType::InvalidNumber => "invalid_number",
        };
        error_rows.push(ErrorRow {
            line_no: pe.line_no,
            normalized_jan: None,
            name: pe.raw_name.clone().unwrap_or_default(),
            raw_quantity: pe.raw_quantity.clone().unwrap_or_default(),
            raw_amount: pe.raw_amount.clone().unwrap_or_default(),
            error_type: error_type_str.to_string(),
            error_message: pe.error_message.clone(),
        });
    }

    // 4d. 実質0件ガード
    if matched_rows.is_empty() && error_rows.is_empty() {
        return Err(BizError::ImportError(
            "取込み対象のデータがありません".to_string(),
        ));
    }

    // 5. Stage 3: Preview
    // 5a. file_hash 重複チェック
    if let Some(existing) =
        sales_repo::find_blocking_import_by_file_hash(conn, &parse_result.file_hash)?
    {
        return Err(BizError::ImportError(format!(
            "このファイルは取込み済みです（取込みID: {}、取込み日: {}）",
            existing.id, existing.imported_at
        )));
    }

    // 5b. settlement_date 同日チェック
    let existing_imports =
        sales_repo::find_imports_by_settlement_date(conn, &parse_result.settlement_date)?;
    let duplicate_check = if existing_imports.is_empty() {
        DuplicateCheck {
            status: DuplicateStatus::NoDuplicate,
            existing_import_id: None,
        }
    } else {
        DuplicateCheck {
            status: DuplicateStatus::OverwriteRequired,
            existing_import_id: Some(existing_imports[0].id),
        }
    };

    // 5c. PreviewData 構築
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let error_summary_items: Vec<_> = error_rows.iter().take(100).cloned().collect();

    let preview_data = PreviewData {
        file_info: FileInfo {
            filename: req.filename,
            settlement_date: parse_result.settlement_date,
            file_hash: parse_result.file_hash,
        },
        matched_summary: MatchedSummary {
            count: matched_rows.len(),
            total_amount: matched_rows.iter().map(|r| r.amount as i64).sum(),
            warnings,
        },
        error_summary: ErrorSummary {
            count: error_rows.len(),
            items: error_summary_items,
        },
        duplicate_check,
        preview_created_at: now,
    };

    // 6. preview_token 生成
    let preview_token = Uuid::new_v4().to_string();

    Ok(ParseValidateResult {
        preview_data,
        preview_token,
        matched_rows,
        error_rows,
    })
}

/// parse失敗時の操作ログ記録（best-effort）
fn log_parse_failure(conn: &DbConnection, message: &str) {
    let log = NewOperationLog {
        operation_type: "csv_import_parse_failed".to_string(),
        summary: message.to_string(),
        detail_json: None,
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }
}
