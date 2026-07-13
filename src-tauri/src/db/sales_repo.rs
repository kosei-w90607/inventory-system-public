//! 売上レコード・CSV取込み・CSV取込みエラーのCRUD操作
//!
//! 21-io-inventory-repo.md §11 に基づく実装。
//! IO-01: SQLiteデータアクセス層（sales_repository）

use super::{DbConnection, DbError};
use rusqlite::OptionalExtension;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 売上レコードINSERT用
///
/// 21-io-inventory-repo.md §11.1
#[derive(Debug)]
pub struct NewSaleRecord {
    pub csv_import_id: Option<i64>,
    pub product_code: String,
    pub sale_date: String,
    pub quantity: i64,
    pub amount: i64,
    pub source: String,
    pub source_line_no: Option<i64>,
    pub reason: Option<String>,
    pub note: Option<String>,
}

// ---------------------------------------------------------------------------
// 関数
// ---------------------------------------------------------------------------

/// sale_records に1行INSERTし、挿入されたIDを返す
///
/// is_voided=0, created_at=現在日時 で固定挿入。
///
/// 21-io-inventory-repo.md §11.1
pub fn insert_sale_record(conn: &DbConnection, record: &NewSaleRecord) -> Result<i64, DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO sale_records (csv_import_id, product_code, sale_date, quantity, amount, source, source_line_no, reason, note, is_voided, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10)",
        rusqlite::params![
            record.csv_import_id,
            record.product_code,
            record.sale_date,
            record.quantity,
            record.amount,
            record.source,
            record.source_line_no,
            record.reason,
            record.note,
            now,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

// ---------------------------------------------------------------------------
// CSV取込み型定義（BIZ-03 用）
// ---------------------------------------------------------------------------

/// csv_imports テーブルの行マッピング
///
/// 24-io-csv-import-repo.md §14.2
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct CsvImport {
    pub id: i64,
    pub filename: String,
    pub settlement_date: String,
    pub file_hash: String,
    pub total_items: i64,
    pub total_amount: i64,
    pub skipped_count: i64,
    pub status: String,
    pub imported_at: String,
}

/// csv_imports INSERT用（id, imported_at は自動設定）
///
/// 24-io-csv-import-repo.md §14.2
#[derive(Debug)]
pub struct NewCsvImport {
    pub filename: String,
    pub settlement_date: String,
    pub file_hash: String,
    pub total_items: i64,
    pub total_amount: i64,
    pub skipped_count: i64,
    pub status: String,
}

/// csv_import_errors INSERT用（created_at は自動設定）
///
/// 24-io-csv-import-repo.md §14.2
#[derive(Debug)]
pub struct NewCsvImportError {
    pub csv_import_id: i64,
    pub source_line_no: i64,
    pub normalized_jan: Option<String>,
    pub raw_name: String,
    pub raw_quantity: String,
    pub raw_amount: String,
    pub error_type: String,
    pub error_message: String,
}

/// ロールバック時の逆補正用（product_code + 元のquantity）
///
/// 24-io-csv-import-repo.md §14.2
#[derive(Debug, Clone)]
pub struct VoidedMovement {
    pub product_code: String,
    pub quantity: i64,
}

// ---------------------------------------------------------------------------
// 日報取込み型定義（BIZ-08 用）
// ---------------------------------------------------------------------------

/// daily_report_imports テーブルの行マッピング
///
/// 24-io-csv-import-repo.md §14.2 / §14.14-14.20
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct DailyReportImport {
    pub id: i64,
    pub report_date: String,
    pub source_adapter: String,
    pub bundle_hash: String,
    pub source_files_json: String,
    pub gross_amount: Option<i64>,
    pub net_amount: Option<i64>,
    pub status: String,
    pub imported_at: String,
    pub rolled_back_at: Option<String>,
    pub note: Option<String>,
}

/// daily_report_imports INSERT用（id/imported_at/rolled_back_at は自動設定）
#[derive(Debug)]
pub struct NewDailyReportImport {
    pub report_date: String,
    pub source_adapter: String,
    pub bundle_hash: String,
    pub source_files_json: String,
    pub gross_amount: Option<i64>,
    pub net_amount: Option<i64>,
    pub status: String,
    pub note: Option<String>,
}

/// daily_report_summary_lines INSERT用
#[derive(Debug)]
pub struct NewDailyReportSummaryLine {
    pub daily_report_import_id: i64,
    pub source_file: String,
    pub line_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

/// daily_report_payment_lines INSERT用
#[derive(Debug)]
pub struct NewDailyReportPaymentLine {
    pub daily_report_import_id: i64,
    pub source_file: String,
    pub payment_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

/// daily_report_department_lines INSERT用
#[derive(Debug)]
pub struct NewDailyReportDepartmentLine {
    pub daily_report_import_id: i64,
    pub source_file: String,
    pub department_id: Option<i64>,
    pub raw_department_name: String,
    pub normalized_department_name: Option<String>,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

// ---------------------------------------------------------------------------
// CSV取込み関数（BIZ-03 用）
// ---------------------------------------------------------------------------

/// csv_imports に1行INSERTし、挿入されたIDを返す
///
/// 24-io-csv-import-repo.md §14.4
pub fn insert_csv_import(conn: &DbConnection, record: &NewCsvImport) -> Result<i64, DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO csv_imports (filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            record.filename,
            record.settlement_date,
            record.file_hash,
            record.total_items,
            record.total_amount,
            record.skipped_count,
            record.status,
            now,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// csv_imports からIDで1件取得する
///
/// 24-io-csv-import-repo.md §14.5
pub fn find_csv_import_by_id(conn: &DbConnection, id: i64) -> Result<Option<CsvImport>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at
         FROM csv_imports WHERE id = ?1",
    )?;
    let mut rows = stmt.query(rusqlite::params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_csv_import(row)?)),
        None => Ok(None),
    }
}

/// file_hash で有効な csv_imports を検索する（重複取込みブロック判定）
///
/// 24-io-csv-import-repo.md §14.6
pub fn find_blocking_import_by_file_hash(
    conn: &DbConnection,
    file_hash: &str,
) -> Result<Option<CsvImport>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at
         FROM csv_imports WHERE file_hash = ?1 AND status IN ('completed','completed_partial')
         ORDER BY id DESC LIMIT 1",
    )?;
    let mut rows = stmt.query(rusqlite::params![file_hash])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_csv_import(row)?)),
        None => Ok(None),
    }
}

/// settlement_date で有効な csv_imports を検索する（同日上書き確認用）
///
/// 24-io-csv-import-repo.md §14.7
pub fn find_imports_by_settlement_date(
    conn: &DbConnection,
    date: &str,
) -> Result<Vec<CsvImport>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at
         FROM csv_imports WHERE settlement_date = ?1 AND status IN ('completed','completed_partial')
         ORDER BY id DESC",
    )?;
    let rows = stmt.query_map(rusqlite::params![date], row_to_csv_import)?;
    let mut imports = Vec::new();
    for row in rows {
        imports.push(row?);
    }
    Ok(imports)
}

/// csv_imports の status を更新する
///
/// 24-io-csv-import-repo.md §14.8
pub fn update_csv_import_status(
    conn: &DbConnection,
    id: i64,
    status: &str,
) -> Result<bool, DbError> {
    let affected = conn.execute(
        "UPDATE csv_imports SET status = ?1 WHERE id = ?2",
        rusqlite::params![status, id],
    )?;
    Ok(affected == 1)
}

/// csv_imports の totals + status を確定する（Stage 4 Commit最終ステップ）
///
/// 24-io-csv-import-repo.md §14.9
pub fn update_csv_import_totals(
    conn: &DbConnection,
    id: i64,
    total_items: i64,
    total_amount: i64,
    skipped_count: i64,
    status: &str,
) -> Result<bool, DbError> {
    let affected = conn.execute(
        "UPDATE csv_imports SET total_items = ?1, total_amount = ?2, skipped_count = ?3, status = ?4 WHERE id = ?5",
        rusqlite::params![total_items, total_amount, skipped_count, status, id],
    )?;
    Ok(affected == 1)
}

/// csv_import_errors に複数行を一括INSERTする
///
/// 24-io-csv-import-repo.md §14.10
pub fn insert_csv_import_errors(
    conn: &DbConnection,
    errors: &[NewCsvImportError],
) -> Result<(), DbError> {
    if errors.is_empty() {
        return Ok(());
    }
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let mut stmt = conn.prepare(
        "INSERT INTO csv_import_errors (csv_import_id, source_line_no, normalized_jan, raw_name, raw_quantity, raw_amount, error_type, error_message, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )?;
    for error in errors {
        stmt.execute(rusqlite::params![
            error.csv_import_id,
            error.source_line_no,
            error.normalized_jan,
            error.raw_name,
            error.raw_quantity,
            error.raw_amount,
            error.error_type,
            error.error_message,
            now,
        ])?;
    }
    Ok(())
}

/// 指定 csv_import_id の sale_records を is_voided=1 に更新する（ロールバック用）
///
/// 冪等: 既に is_voided=1 のレコードは更新しない
///
/// 24-io-csv-import-repo.md §14.11
pub fn void_sale_records_by_import(
    conn: &DbConnection,
    csv_import_id: i64,
) -> Result<u64, DbError> {
    let affected = conn.execute(
        "UPDATE sale_records SET is_voided = 1 WHERE csv_import_id = ?1 AND is_voided = 0",
        rusqlite::params![csv_import_id],
    )?;
    Ok(affected as u64)
}

/// 指定 reference の inventory_movements を void し、void対象を返す（ロールバック用）
///
/// SELECT→UPDATE の2段階。BIZ-03が戻り値で在庫補正を行う。
/// movement_type フィルタなし（INV-7: csv_import参照はsale_auto限定）
///
/// 注: 呼び出し元はトランザクション内で呼ぶこと（BIZ-03 Rollback TX 内で使用）
///
/// 24-io-csv-import-repo.md §14.12
pub fn void_movements_by_reference(
    conn: &DbConnection,
    ref_type: &str,
    ref_id: i64,
) -> Result<Vec<VoidedMovement>, DbError> {
    // Step 1: SELECT で void 対象を事前取得
    let mut stmt = conn.prepare(
        "SELECT product_code, quantity FROM inventory_movements
         WHERE reference_type = ?1 AND reference_id = ?2 AND is_voided = 0",
    )?;
    let rows = stmt.query_map(rusqlite::params![ref_type, ref_id], |row| {
        Ok(VoidedMovement {
            product_code: row.get(0)?,
            quantity: row.get(1)?,
        })
    })?;
    let mut voided = Vec::new();
    for row in rows {
        voided.push(row?);
    }

    // Step 2: UPDATE で一括 void
    conn.execute(
        "UPDATE inventory_movements SET is_voided = 1
         WHERE reference_type = ?1 AND reference_id = ?2 AND is_voided = 0",
        rusqlite::params![ref_type, ref_id],
    )?;

    Ok(voided)
}

/// csv_imports 一覧をページング取得する
///
/// 24-io-csv-import-repo.md §14.13
pub fn list_csv_imports(
    conn: &DbConnection,
    page: u32,
    per_page: u32,
) -> Result<super::PaginatedResult<CsvImport>, DbError> {
    // 入力ガード
    if page < 1 {
        return Err(DbError::QueryFailed("page must be >= 1".to_string()));
    }
    if per_page < 1 {
        return Err(DbError::QueryFailed("per_page must be >= 1".to_string()));
    }
    if per_page > 100 {
        return Err(DbError::QueryFailed("per_page must be <= 100".to_string()));
    }

    let total_count: u32 =
        conn.query_row("SELECT COUNT(*) FROM csv_imports", [], |row| row.get(0))?;

    let offset = (page - 1) * per_page;
    let mut stmt = conn.prepare(
        "SELECT id, filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at
         FROM csv_imports ORDER BY imported_at DESC, id DESC LIMIT ?1 OFFSET ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![per_page, offset], row_to_csv_import)?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(super::PaginatedResult {
        items,
        total_count,
        page,
        per_page,
    })
}

// ---------------------------------------------------------------------------
// 日報取込み関数（BIZ-08 用）
// ---------------------------------------------------------------------------

/// daily_report_imports に1行INSERTし、挿入されたIDを返す
///
/// 24-io-csv-import-repo.md §14.14
pub fn insert_daily_report_import(
    conn: &DbConnection,
    record: &NewDailyReportImport,
) -> Result<i64, DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO daily_report_imports (
            report_date, source_adapter, bundle_hash, source_files_json,
            gross_amount, net_amount, status, imported_at, note
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            record.report_date,
            record.source_adapter,
            record.bundle_hash,
            record.source_files_json,
            record.gross_amount,
            record.net_amount,
            record.status,
            now,
            record.note,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// daily_report_summary_lines に複数行を一括INSERTする
///
/// 24-io-csv-import-repo.md §14.15
pub fn insert_daily_report_summary_lines(
    conn: &DbConnection,
    rows: &[NewDailyReportSummaryLine],
) -> Result<(), DbError> {
    if rows.is_empty() {
        return Ok(());
    }
    let mut stmt = conn.prepare(
        "INSERT INTO daily_report_summary_lines (
            daily_report_import_id, source_file, line_key, label,
            amount, quantity, count, sort_order
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )?;
    for row in rows {
        stmt.execute(rusqlite::params![
            row.daily_report_import_id,
            row.source_file,
            row.line_key,
            row.label,
            row.amount,
            row.quantity,
            row.count,
            row.sort_order,
        ])?;
    }
    Ok(())
}

/// daily_report_payment_lines に複数行を一括INSERTする
///
/// 24-io-csv-import-repo.md §14.15
pub fn insert_daily_report_payment_lines(
    conn: &DbConnection,
    rows: &[NewDailyReportPaymentLine],
) -> Result<(), DbError> {
    if rows.is_empty() {
        return Ok(());
    }
    let mut stmt = conn.prepare(
        "INSERT INTO daily_report_payment_lines (
            daily_report_import_id, source_file, payment_key, label,
            amount, count, sort_order
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )?;
    for row in rows {
        stmt.execute(rusqlite::params![
            row.daily_report_import_id,
            row.source_file,
            row.payment_key,
            row.label,
            row.amount,
            row.count,
            row.sort_order,
        ])?;
    }
    Ok(())
}

/// daily_report_department_lines に複数行を一括INSERTする
///
/// 24-io-csv-import-repo.md §14.15
pub fn insert_daily_report_department_lines(
    conn: &DbConnection,
    rows: &[NewDailyReportDepartmentLine],
) -> Result<(), DbError> {
    if rows.is_empty() {
        return Ok(());
    }
    let mut stmt = conn.prepare(
        "INSERT INTO daily_report_department_lines (
            daily_report_import_id, source_file, department_id, raw_department_name,
            normalized_department_name, amount, quantity, count, sort_order
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )?;
    for row in rows {
        stmt.execute(rusqlite::params![
            row.daily_report_import_id,
            row.source_file,
            row.department_id,
            row.raw_department_name,
            row.normalized_department_name,
            row.amount,
            row.quantity,
            row.count,
            row.sort_order,
        ])?;
    }
    Ok(())
}

/// daily_report_imports からIDで1件取得する
///
/// 24-io-csv-import-repo.md §14.16
pub fn find_daily_report_import_by_id(
    conn: &DbConnection,
    id: i64,
) -> Result<Option<DailyReportImport>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, report_date, source_adapter, bundle_hash, source_files_json,
                gross_amount, net_amount, status, imported_at, rolled_back_at, note
         FROM daily_report_imports WHERE id = ?1",
    )?;
    let mut rows = stmt.query(rusqlite::params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_daily_report_import(row)?)),
        None => Ok(None),
    }
}

/// 同一bundleのcompleted日報取込みを検索する
///
/// 24-io-csv-import-repo.md §14.17
pub fn find_blocking_daily_report_by_bundle_hash(
    conn: &DbConnection,
    bundle_hash: &str,
) -> Result<Option<DailyReportImport>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, report_date, source_adapter, bundle_hash, source_files_json,
                gross_amount, net_amount, status, imported_at, rolled_back_at, note
         FROM daily_report_imports
         WHERE bundle_hash = ?1 AND status = 'completed'
         ORDER BY id DESC LIMIT 1",
    )?;
    let mut rows = stmt.query(rusqlite::params![bundle_hash])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_daily_report_import(row)?)),
        None => Ok(None),
    }
}

/// 同一report_dateのcompleted日報取込みを検索する
///
/// 24-io-csv-import-repo.md §14.18
pub fn find_daily_report_imports_by_report_date(
    conn: &DbConnection,
    report_date: &str,
) -> Result<Vec<DailyReportImport>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, report_date, source_adapter, bundle_hash, source_files_json,
                gross_amount, net_amount, status, imported_at, rolled_back_at, note
         FROM daily_report_imports
         WHERE report_date = ?1 AND status = 'completed'
         ORDER BY id DESC",
    )?;
    let rows = stmt.query_map(rusqlite::params![report_date], row_to_daily_report_import)?;
    let mut imports = Vec::new();
    for row in rows {
        imports.push(row?);
    }
    Ok(imports)
}

/// daily_report_imports を rolled_back に更新する
///
/// 24-io-csv-import-repo.md §14.19
pub fn rollback_daily_report_import(
    conn: &DbConnection,
    id: i64,
    rolled_back_at: &str,
) -> Result<bool, DbError> {
    let affected = conn.execute(
        "UPDATE daily_report_imports
         SET status = 'rolled_back', rolled_back_at = ?1
         WHERE id = ?2 AND status = 'completed'",
        rusqlite::params![rolled_back_at, id],
    )?;
    Ok(affected == 1)
}

/// daily_report_imports 一覧をページング取得する
///
/// 24-io-csv-import-repo.md §14.20
pub fn list_daily_report_imports(
    conn: &DbConnection,
    page: u32,
    per_page: u32,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<super::PaginatedResult<DailyReportImport>, DbError> {
    if page < 1 {
        return Err(DbError::QueryFailed("page must be >= 1".to_string()));
    }
    if per_page < 1 {
        return Err(DbError::QueryFailed("per_page must be >= 1".to_string()));
    }
    if per_page > 100 {
        return Err(DbError::QueryFailed("per_page must be <= 100".to_string()));
    }

    let mut where_clauses: Vec<&str> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(date_from) = date_from {
        where_clauses.push("report_date >= ?");
        params.push(Box::new(date_from.to_string()));
    }
    if let Some(date_to) = date_to {
        where_clauses.push("report_date <= ?");
        params.push(Box::new(date_to.to_string()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM daily_report_imports{}", where_sql);
    let params_ref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let total_count: u32 = conn.query_row(&count_sql, params_ref.as_slice(), |row| row.get(0))?;

    let offset = (page - 1) * per_page;
    let select_sql = format!(
        "SELECT id, report_date, source_adapter, bundle_hash, source_files_json,
                gross_amount, net_amount, status, imported_at, rolled_back_at, note
         FROM daily_report_imports{}
         ORDER BY report_date DESC, imported_at DESC, id DESC
         LIMIT ? OFFSET ?",
        where_sql
    );
    params.push(Box::new(per_page));
    params.push(Box::new(offset));
    let params_ref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&select_sql)?;
    let rows = stmt.query_map(params_ref.as_slice(), row_to_daily_report_import)?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(super::PaginatedResult {
        items,
        total_count,
        page,
        per_page,
    })
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/// rusqlite::Row → CsvImport の変換
fn row_to_csv_import(row: &rusqlite::Row) -> rusqlite::Result<CsvImport> {
    Ok(CsvImport {
        id: row.get(0)?,
        filename: row.get(1)?,
        settlement_date: row.get(2)?,
        file_hash: row.get(3)?,
        total_items: row.get(4)?,
        total_amount: row.get(5)?,
        skipped_count: row.get(6)?,
        status: row.get(7)?,
        imported_at: row.get(8)?,
    })
}

/// rusqlite::Row → DailyReportImport の変換
fn row_to_daily_report_import(row: &rusqlite::Row) -> rusqlite::Result<DailyReportImport> {
    Ok(DailyReportImport {
        id: row.get(0)?,
        report_date: row.get(1)?,
        source_adapter: row.get(2)?,
        bundle_hash: row.get(3)?,
        source_files_json: row.get(4)?,
        gross_amount: row.get(5)?,
        net_amount: row.get(6)?,
        status: row.get(7)?,
        imported_at: row.get(8)?,
        rolled_back_at: row.get(9)?,
        note: row.get(10)?,
    })
}

// ---------------------------------------------------------------------------
// BIZ-05 売上集計クエリ（20-io-product-repo.md セクション2.10）
// ---------------------------------------------------------------------------

/// 日次売上レコード（商品名・部門名付き）
#[derive(Debug, serde::Serialize)]
pub struct DailySaleRow {
    pub product_code: String,
    pub name: String,
    pub department_name: String,
    pub department_id: i64,
    pub quantity: i64,
    pub amount: i64,
    pub source: String,
}

/// 月次売上集計（商品別）
#[derive(Debug, serde::Serialize)]
pub struct MonthlySaleProductRow {
    pub product_code: String,
    pub name: String,
    pub quantity: i64,
    pub amount: i64,
}

/// 月次売上集計（部門別）
#[derive(Debug, serde::Serialize)]
pub struct MonthlySaleDeptRow {
    pub department_id: i64,
    pub department_name: String,
    pub quantity: i64,
    pub amount: i64,
}

/// 日次売上画面向けの公式日報サマリ（DB DTO）
#[derive(Debug, serde::Serialize)]
pub struct OfficialDailyReportRow {
    pub daily_report_import_id: i64,
    pub report_date: String,
    pub gross_amount: Option<i64>,
    pub net_amount: Option<i64>,
    pub payment_lines: Vec<OfficialDailyPaymentRow>,
    pub department_lines: Vec<OfficialDailyDepartmentRow>,
}

#[derive(Debug, serde::Serialize)]
pub struct OfficialDailyPaymentRow {
    pub payment_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub count: Option<i64>,
}

#[derive(Debug, serde::Serialize)]
pub struct OfficialDailyDepartmentRow {
    pub department_id: Option<i64>,
    pub raw_department_name: String,
    pub normalized_department_name: Option<String>,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
}

/// 月次売上画面向けの公式部門集計（DB DTO）
#[derive(Debug, serde::Serialize)]
pub struct OfficialMonthlyDepartmentTotalRow {
    pub department_id: Option<i64>,
    pub label: String,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
}

/// 指定日の売上レコードを商品名・部門名付きで取得する（is_voided=0のみ）
pub fn get_daily_sales_records(
    conn: &DbConnection,
    date: &str,
) -> Result<Vec<DailySaleRow>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT sr.product_code, p.name, d.name as department_name,
                    d.id as department_id, sr.quantity, sr.amount, sr.source
             FROM sale_records sr
             INNER JOIN products p ON sr.product_code = p.product_code
             INNER JOIN departments d ON p.department_id = d.id
             WHERE sr.sale_date = ?1 AND sr.is_voided = 0
             ORDER BY d.id ASC, p.product_code ASC",
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    let rows = stmt
        .query_map([date], |row| {
            Ok(DailySaleRow {
                product_code: row.get(0)?,
                name: row.get(1)?,
                department_name: row.get(2)?,
                department_id: row.get(3)?,
                quantity: row.get(4)?,
                amount: row.get(5)?,
                source: row.get(6)?,
            })
        })
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| DbError::QueryFailed(e.to_string()))
}

/// 指定日の最新completed日報取込みと配下の公式日報行を取得する
pub fn get_latest_completed_daily_report(
    conn: &DbConnection,
    report_date: &str,
) -> Result<Option<OfficialDailyReportRow>, DbError> {
    let parent = conn
        .query_row(
            "SELECT id, report_date, gross_amount, net_amount
             FROM daily_report_imports
             WHERE report_date = ?1 AND status = 'completed'
             ORDER BY id DESC
             LIMIT 1",
            [report_date],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    let Some((daily_report_import_id, report_date, gross_amount, net_amount)) = parent else {
        return Ok(None);
    };

    let mut payment_stmt = conn
        .prepare(
            "SELECT payment_key, label, amount, count
             FROM daily_report_payment_lines
             WHERE daily_report_import_id = ?1
             ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;
    let payment_lines = payment_stmt
        .query_map([daily_report_import_id], |row| {
            Ok(OfficialDailyPaymentRow {
                payment_key: row.get(0)?,
                label: row.get(1)?,
                amount: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| DbError::QueryFailed(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    let mut department_stmt = conn
        .prepare(
            "SELECT department_id, raw_department_name, normalized_department_name, amount, quantity, count
             FROM daily_report_department_lines
             WHERE daily_report_import_id = ?1
             ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;
    let department_lines = department_stmt
        .query_map([daily_report_import_id], |row| {
            Ok(OfficialDailyDepartmentRow {
                department_id: row.get(0)?,
                raw_department_name: row.get(1)?,
                normalized_department_name: row.get(2)?,
                amount: row.get(3)?,
                quantity: row.get(4)?,
                count: row.get(5)?,
            })
        })
        .map_err(|e| DbError::QueryFailed(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    Ok(Some(OfficialDailyReportRow {
        daily_report_import_id,
        report_date,
        gross_amount,
        net_amount,
        payment_lines,
        department_lines,
    }))
}

/// 指定期間のcompleted日報から公式部門集計を取得する
pub fn get_monthly_official_department_totals(
    conn: &DbConnection,
    date_from: &str,
    date_to: &str,
) -> Result<Option<Vec<OfficialMonthlyDepartmentTotalRow>>, DbError> {
    let report_count: i64 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM daily_report_imports
             WHERE status = 'completed' AND report_date BETWEEN ?1 AND ?2",
            [date_from, date_to],
            |row| row.get(0),
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;
    if report_count == 0 {
        return Ok(None);
    }

    let mut stmt = conn
        .prepare(
            "SELECT l.department_id,
                    COALESCE(l.normalized_department_name, l.raw_department_name) AS label,
                    SUM(l.amount) AS amount,
                    SUM(l.quantity) AS quantity,
                    SUM(l.count) AS count
             FROM daily_report_department_lines l
             INNER JOIN daily_report_imports i ON i.id = l.daily_report_import_id
             WHERE i.status = 'completed' AND i.report_date BETWEEN ?1 AND ?2
             GROUP BY l.department_id, label
             ORDER BY MIN(l.sort_order) ASC, l.department_id ASC, label ASC",
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    let rows = stmt
        .query_map([date_from, date_to], |row| {
            Ok(OfficialMonthlyDepartmentTotalRow {
                department_id: row.get(0)?,
                label: row.get(1)?,
                amount: row.get(2)?,
                quantity: row.get(3)?,
                count: row.get(4)?,
            })
        })
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map(Some)
        .map_err(|e| DbError::QueryFailed(e.to_string()))
}

/// 指定期間の商品別売上集計を取得する
pub fn get_monthly_sales_by_product(
    conn: &DbConnection,
    date_from: &str,
    date_to: &str,
) -> Result<Vec<MonthlySaleProductRow>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT sr.product_code, p.name,
                    SUM(sr.quantity) as quantity, SUM(sr.amount) as amount
             FROM sale_records sr
             INNER JOIN products p ON sr.product_code = p.product_code
             WHERE sr.sale_date >= ?1 AND sr.sale_date <= ?2 AND sr.is_voided = 0
             GROUP BY sr.product_code, p.name
             ORDER BY SUM(sr.amount) DESC",
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    let rows = stmt
        .query_map([date_from, date_to], |row| {
            Ok(MonthlySaleProductRow {
                product_code: row.get(0)?,
                name: row.get(1)?,
                quantity: row.get(2)?,
                amount: row.get(3)?,
            })
        })
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| DbError::QueryFailed(e.to_string()))
}

/// 指定期間の部門別売上集計を取得する
pub fn get_monthly_sales_by_department(
    conn: &DbConnection,
    date_from: &str,
    date_to: &str,
) -> Result<Vec<MonthlySaleDeptRow>, DbError> {
    let mut stmt = conn
        .prepare(
            "SELECT d.id as department_id, d.name as department_name,
                    SUM(sr.quantity) as quantity, SUM(sr.amount) as amount
             FROM sale_records sr
             INNER JOIN products p ON sr.product_code = p.product_code
             INNER JOIN departments d ON p.department_id = d.id
             WHERE sr.sale_date >= ?1 AND sr.sale_date <= ?2 AND sr.is_voided = 0
             GROUP BY d.id, d.name
             ORDER BY SUM(sr.amount) DESC",
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    let rows = stmt
        .query_map([date_from, date_to], |row| {
            Ok(MonthlySaleDeptRow {
                department_id: row.get(0)?,
                department_name: row.get(1)?,
                quantity: row.get(2)?,
                amount: row.get(3)?,
            })
        })
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| DbError::QueryFailed(e.to_string()))
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::db::product_repo::{self, NewProduct};

    fn setup_test_db() -> (tempfile::TempDir, DbConnection) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();
        (dir, conn)
    }

    fn seed_product(conn: &DbConnection, product_code: &str) {
        let product = NewProduct {
            product_code: product_code.to_string(),
            jan_code: None,
            name: "テスト商品".to_string(),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: 0,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(conn, &product).unwrap();
    }

    #[test]
    fn test_insert_sale_record_req401_manual() {
        // REQ-401: CSV取込み
        // FUNC-11.1: source="manual", csv_import_id=None
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-SALE");

        let record = NewSaleRecord {
            csv_import_id: None,
            product_code: "TEST-SALE".to_string(),
            sale_date: "2026-04-06".to_string(),
            quantity: 1,
            amount: 500,
            source: "manual".to_string(),
            source_line_no: None,
            reason: Some("plu_unregistered".to_string()),
            note: None,
        };
        let id = insert_sale_record(&conn, &record).unwrap();
        assert!(id > 0);

        // is_voided=0 がデフォルト
        let is_voided: bool = conn
            .query_row(
                "SELECT is_voided FROM sale_records WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_voided, "is_voided は 0 であるべき");
    }

    #[test]
    fn test_insert_sale_record_req401_auto_with_csv_import() {
        // REQ-401: CSV取込み
        // FUNC-11.1: source="auto", csv_import_id=Some（BIZ-03経路の先行検証）
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-AUTO");

        // csv_imports にダミーレコードを作成
        conn.execute(
            "INSERT INTO csv_imports (filename, settlement_date, file_hash, total_items, total_amount, skipped_count, status, imported_at)
             VALUES ('Z004_test', '2026-04-06', 'abc123', 1, 500, 0, 'completed', '2026-04-06T00:00:00')",
            [],
        ).unwrap();
        let csv_id = conn.last_insert_rowid();

        let record = NewSaleRecord {
            csv_import_id: Some(csv_id),
            product_code: "TEST-AUTO".to_string(),
            sale_date: "2026-04-06".to_string(),
            quantity: 3,
            amount: 1500,
            source: "auto".to_string(),
            source_line_no: Some(5),
            reason: None,
            note: None,
        };
        let id = insert_sale_record(&conn, &record).unwrap();
        assert!(id > 0);

        // csv_import_id が保存されていること
        let stored_csv_id: Option<i64> = conn
            .query_row(
                "SELECT csv_import_id FROM sale_records WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_csv_id, Some(csv_id));
    }

    #[test]
    fn test_insert_sale_record_req401_fk_violation_product() {
        // REQ-401: CSV取込み
        // FUNC-11.1: 不正 product_code → ForeignKeyViolation
        let (_dir, conn) = setup_test_db();
        let record = NewSaleRecord {
            csv_import_id: None,
            product_code: "NONEXISTENT".to_string(),
            sale_date: "2026-04-06".to_string(),
            quantity: 1,
            amount: 100,
            source: "manual".to_string(),
            source_line_no: None,
            reason: None,
            note: None,
        };
        let result = insert_sale_record(&conn, &record);
        assert!(
            matches!(result, Err(DbError::ForeignKeyViolation(_))),
            "{:?}",
            result
        );
    }

    #[test]
    fn test_insert_sale_record_req401_check_source() {
        // REQ-401: CSV取込み
        // FUNC-11.1: CHECK制約 — source 不正値
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-SCHK");
        let record = NewSaleRecord {
            csv_import_id: None,
            product_code: "TEST-SCHK".to_string(),
            sale_date: "2026-04-06".to_string(),
            quantity: 1,
            amount: 100,
            source: "invalid_source".to_string(),
            source_line_no: None,
            reason: None,
            note: None,
        };
        let result = insert_sale_record(&conn, &record);
        assert!(
            matches!(result, Err(DbError::QueryFailed(_))),
            "CHECK制約違反は QueryFailed を期待: {:?}",
            result
        );
    }

    // -----------------------------------------------------------------------
    // CSV取込みリポジトリ テスト（BIZ-03 用）
    // -----------------------------------------------------------------------

    /// テスト用に csv_imports を INSERT するヘルパー
    fn seed_csv_import(conn: &DbConnection, file_hash: &str, status: &str) -> i64 {
        let record = NewCsvImport {
            filename: "Z004_test".to_string(),
            settlement_date: "2026-03-21".to_string(),
            file_hash: file_hash.to_string(),
            total_items: 10,
            total_amount: 5000,
            skipped_count: 0,
            status: status.to_string(),
        };
        insert_csv_import(conn, &record).unwrap()
    }

    #[test]
    fn test_csv_import_req401_insert_and_find_by_id() {
        // REQ-401: CSV取込み
        // FUNC-14.4/14.5: insert + find_by_id 往復
        let (_dir, conn) = setup_test_db();
        let id = seed_csv_import(&conn, "abc123def456", "completed");

        let found = find_csv_import_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(found.id, id);
        assert_eq!(found.filename, "Z004_test");
        assert_eq!(found.settlement_date, "2026-03-21");
        assert_eq!(found.file_hash, "abc123def456");
        assert_eq!(found.status, "completed");
        assert!(!found.imported_at.is_empty());
    }

    #[test]
    fn test_csv_import_req401_find_by_id_not_found() {
        // REQ-401: CSV取込み
        let (_dir, conn) = setup_test_db();
        let found = find_csv_import_by_id(&conn, 99999).unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_find_blocking_req401_completed_blocks() {
        // REQ-401: CSV取込み
        // INV-6: completed → ブロック
        let (_dir, conn) = setup_test_db();
        seed_csv_import(&conn, "hash_completed", "completed");

        let blocking = find_blocking_import_by_file_hash(&conn, "hash_completed").unwrap();
        assert!(blocking.is_some(), "completed はブロック対象");
    }

    #[test]
    fn test_find_blocking_req401_rolled_back_passes() {
        // REQ-401: CSV取込み
        // INV-6: rolled_back → 通過
        let (_dir, conn) = setup_test_db();
        seed_csv_import(&conn, "hash_rolled_back", "rolled_back");

        let blocking = find_blocking_import_by_file_hash(&conn, "hash_rolled_back").unwrap();
        assert!(blocking.is_none(), "rolled_back はブロック対象外");
    }

    #[test]
    fn test_find_imports_req401_by_settlement_date() {
        // REQ-401: CSV取込み
        // FUNC-14.7: 同日複数 + 0件
        let (_dir, conn) = setup_test_db();
        seed_csv_import(&conn, "hash_a", "completed");
        seed_csv_import(&conn, "hash_b", "completed_partial");
        seed_csv_import(&conn, "hash_c", "rolled_back"); // これは対象外

        let found = find_imports_by_settlement_date(&conn, "2026-03-21").unwrap();
        assert_eq!(found.len(), 2, "completed + completed_partial の2件");

        let empty = find_imports_by_settlement_date(&conn, "2099-01-01").unwrap();
        assert!(empty.is_empty(), "存在しない日付は空Vec");
    }

    #[test]
    fn test_update_csv_import_req401_status() {
        // REQ-401: CSV取込み
        // FUNC-14.8: status更新
        let (_dir, conn) = setup_test_db();
        let id = seed_csv_import(&conn, "hash_status", "completed");

        let updated = update_csv_import_status(&conn, id, "rolled_back").unwrap();
        assert!(updated);

        let found = find_csv_import_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(found.status, "rolled_back");
    }

    #[test]
    fn test_update_csv_import_req401_totals() {
        // REQ-401: CSV取込み
        // FUNC-14.9: totals確定
        let (_dir, conn) = setup_test_db();
        let id = seed_csv_import(&conn, "hash_totals", "completed");

        let updated =
            update_csv_import_totals(&conn, id, 42, 25000, 3, "completed_partial").unwrap();
        assert!(updated);

        let found = find_csv_import_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(found.total_items, 42);
        assert_eq!(found.total_amount, 25000);
        assert_eq!(found.skipped_count, 3);
        assert_eq!(found.status, "completed_partial");
    }

    #[test]
    fn test_insert_csv_import_req401_errors_batch() {
        // REQ-401: CSV取込み
        // FUNC-14.10: バッチ挿入
        let (_dir, conn) = setup_test_db();
        let import_id = seed_csv_import(&conn, "hash_errors", "completed_partial");

        let errors = vec![
            NewCsvImportError {
                csv_import_id: import_id,
                source_line_no: 5,
                normalized_jan: Some("4976383262108".to_string()),
                raw_name: "テスト商品".to_string(),
                raw_quantity: "3".to_string(),
                raw_amount: "1782".to_string(),
                error_type: "unmatched_product".to_string(),
                error_message: "マスタ未登録".to_string(),
            },
            NewCsvImportError {
                csv_import_id: import_id,
                source_line_no: 8,
                normalized_jan: None,
                raw_name: "不明".to_string(),
                raw_quantity: "abc".to_string(),
                raw_amount: "100".to_string(),
                error_type: "invalid_number".to_string(),
                error_message: "数値不正".to_string(),
            },
        ];
        insert_csv_import_errors(&conn, &errors).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM csv_import_errors WHERE csv_import_id = ?1",
                rusqlite::params![import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_insert_csv_import_req401_errors_empty_returns_ok() {
        // REQ-401: CSV取込み
        // FUNC-14.10: 空配列 → 即Ok(())
        let (_dir, conn) = setup_test_db();
        let result = insert_csv_import_errors(&conn, &[]);
        assert!(result.is_ok());
    }

    #[test]
    fn test_void_sale_records_req401_by_import() {
        // REQ-401: CSV取込み
        // FUNC-14.11: is_voided=1 更新 + 冪等性
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "VOID-P1");
        let import_id = seed_csv_import(&conn, "hash_void", "completed");

        // 2件のsale_recordsを作成
        for i in 0..2 {
            let record = NewSaleRecord {
                csv_import_id: Some(import_id),
                product_code: "VOID-P1".to_string(),
                sale_date: "2026-03-21".to_string(),
                quantity: 1,
                amount: 500,
                source: "auto".to_string(),
                source_line_no: Some(i + 1),
                reason: None,
                note: None,
            };
            insert_sale_record(&conn, &record).unwrap();
        }

        // 1回目: 2件void
        let affected = void_sale_records_by_import(&conn, import_id).unwrap();
        assert_eq!(affected, 2);

        // 2回目: 既にvoided → 0件（冪等）
        let affected2 = void_sale_records_by_import(&conn, import_id).unwrap();
        assert_eq!(affected2, 0);
    }

    #[test]
    fn test_void_movements_req401_by_reference() {
        // REQ-401: CSV取込み
        // FUNC-14.12: SELECT→UPDATE 2段階 + VoidedMovement返却
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "VM-P1");
        let import_id = seed_csv_import(&conn, "hash_mv", "completed");

        // inventory_movements に直接INSERT（テスト用）
        conn.execute(
            "INSERT INTO inventory_movements (product_code, movement_type, quantity, stock_after, reference_type, reference_id, is_voided, created_at)
             VALUES ('VM-P1', 'sale_auto', -3, 7, 'csv_import', ?1, 0, '2026-03-21T00:00:00')",
            rusqlite::params![import_id],
        ).unwrap();

        let voided = void_movements_by_reference(&conn, "csv_import", import_id).unwrap();
        assert_eq!(voided.len(), 1);
        assert_eq!(voided[0].product_code, "VM-P1");
        assert_eq!(voided[0].quantity, -3);

        // is_voided=1 に更新されていること
        let is_voided: bool = conn
            .query_row(
                "SELECT is_voided FROM inventory_movements WHERE reference_type = 'csv_import' AND reference_id = ?1",
                rusqlite::params![import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(is_voided);
    }

    #[test]
    fn test_void_movements_req401_no_movement_type_filter() {
        // REQ-401: CSV取込み
        // INV-7: movement_type フィルタなしで動作すること
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "INV7-P1");

        conn.execute(
            "INSERT INTO inventory_movements (product_code, movement_type, quantity, stock_after, reference_type, reference_id, is_voided, created_at)
             VALUES ('INV7-P1', 'sale_auto', -5, 5, 'csv_import', 999, 0, '2026-03-21T00:00:00')",
            [],
        ).unwrap();

        let voided = void_movements_by_reference(&conn, "csv_import", 999).unwrap();
        assert_eq!(voided.len(), 1, "movement_type条件なしでsale_autoを取得");
    }

    #[test]
    fn test_list_csv_imports_req401_pagination() {
        // REQ-401: CSV取込み
        // FUNC-14.13: ページング正常系
        let (_dir, conn) = setup_test_db();
        for i in 0..5 {
            seed_csv_import(&conn, &format!("hash_{}", i), "completed");
        }

        let page1 = list_csv_imports(&conn, 1, 2).unwrap();
        assert_eq!(page1.items.len(), 2);
        assert_eq!(page1.total_count, 5);
        assert_eq!(page1.page, 1);
        assert_eq!(page1.per_page, 2);

        let page3 = list_csv_imports(&conn, 3, 2).unwrap();
        assert_eq!(page3.items.len(), 1, "最終ページは1件");
    }

    #[test]
    fn test_list_csv_imports_req401_boundary_errors() {
        // REQ-401: CSV取込み
        // FUNC-14.13: 入力ガード境界
        let (_dir, conn) = setup_test_db();

        assert!(
            matches!(list_csv_imports(&conn, 0, 10), Err(DbError::QueryFailed(_))),
            "page=0 → エラー"
        );
        assert!(
            matches!(list_csv_imports(&conn, 1, 0), Err(DbError::QueryFailed(_))),
            "per_page=0 → エラー"
        );
        assert!(
            matches!(
                list_csv_imports(&conn, 1, 101),
                Err(DbError::QueryFailed(_))
            ),
            "per_page=101 → エラー"
        );
        assert!(list_csv_imports(&conn, 1, 100).is_ok(), "per_page=100 → OK");
    }

    // -----------------------------------------------------------------------
    // 日報取込みリポジトリ テスト（BIZ-08 用）
    // -----------------------------------------------------------------------

    fn new_daily_report_import(
        report_date: &str,
        bundle_hash: &str,
        status: &str,
    ) -> NewDailyReportImport {
        NewDailyReportImport {
            report_date: report_date.to_string(),
            source_adapter: "casio_sr_s4000".to_string(),
            bundle_hash: bundle_hash.to_string(),
            source_files_json:
                r#"[{"source":"Z001","filename":"Z001_sample.csv","hash":"hash-z001","size":120}]"#
                    .to_string(),
            gross_amount: Some(12000),
            net_amount: Some(11000),
            status: status.to_string(),
            note: Some("synthetic fixture".to_string()),
        }
    }

    fn seed_daily_report_import(
        conn: &DbConnection,
        report_date: &str,
        bundle_hash: &str,
        status: &str,
    ) -> i64 {
        let record = new_daily_report_import(report_date, bundle_hash, status);
        insert_daily_report_import(conn, &record).unwrap()
    }

    #[test]
    fn test_daily_report_repo_req401_insert_and_find_by_id() {
        // REQ-401: SALES日報取込み
        // FUNC-14.14/14.16: daily_report_imports insert + find_by_id
        let (_dir, conn) = setup_test_db();
        let id = seed_daily_report_import(&conn, "2026-03-21", "bundle-hash-a", "completed");

        let found = find_daily_report_import_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(found.id, id);
        assert_eq!(found.report_date, "2026-03-21");
        assert_eq!(found.source_adapter, "casio_sr_s4000");
        assert_eq!(found.bundle_hash, "bundle-hash-a");
        assert!(found.source_files_json.contains("Z001_sample.csv"));
        assert_eq!(found.gross_amount, Some(12000));
        assert_eq!(found.net_amount, Some(11000));
        assert_eq!(found.status, "completed");
        assert!(found.rolled_back_at.is_none());
        assert_eq!(found.note.as_deref(), Some("synthetic fixture"));

        let missing = find_daily_report_import_by_id(&conn, 99999).unwrap();
        assert!(missing.is_none());
    }

    #[test]
    fn test_daily_report_repo_req401_insert_lines_and_keep_nullable_values() {
        // REQ-401: SALES日報取込み
        // FUNC-14.15: Z001/Z002/Z005行を一括INSERTし、nullable項目を保持する
        let (_dir, conn) = setup_test_db();
        let import_id =
            seed_daily_report_import(&conn, "2026-03-21", "bundle-hash-lines", "completed");

        insert_daily_report_summary_lines(
            &conn,
            &[
                NewDailyReportSummaryLine {
                    daily_report_import_id: import_id,
                    source_file: "Z001".to_string(),
                    line_key: "gross_sales".to_string(),
                    label: "総売上".to_string(),
                    amount: Some(12000),
                    quantity: None,
                    count: Some(8),
                    sort_order: 1,
                },
                NewDailyReportSummaryLine {
                    daily_report_import_id: import_id,
                    source_file: "Z001".to_string(),
                    line_key: "customer_count".to_string(),
                    label: "客数".to_string(),
                    amount: None,
                    quantity: None,
                    count: Some(8),
                    sort_order: 2,
                },
            ],
        )
        .unwrap();
        insert_daily_report_payment_lines(
            &conn,
            &[NewDailyReportPaymentLine {
                daily_report_import_id: import_id,
                source_file: "Z002".to_string(),
                payment_key: "cash".to_string(),
                label: "現金".to_string(),
                amount: Some(11000),
                count: Some(7),
                sort_order: 1,
            }],
        )
        .unwrap();
        insert_daily_report_department_lines(
            &conn,
            &[
                NewDailyReportDepartmentLine {
                    daily_report_import_id: import_id,
                    source_file: "Z005".to_string(),
                    department_id: Some(1),
                    raw_department_name: "その他小物".to_string(),
                    normalized_department_name: Some("その他小物".to_string()),
                    amount: 3000,
                    quantity: Some(4),
                    count: None,
                    sort_order: 1,
                },
                NewDailyReportDepartmentLine {
                    daily_report_import_id: import_id,
                    source_file: "Z005".to_string(),
                    department_id: None,
                    raw_department_name: "未対応部門".to_string(),
                    normalized_department_name: Some("未対応部門".to_string()),
                    amount: 8000,
                    quantity: None,
                    count: None,
                    sort_order: 2,
                },
            ],
        )
        .unwrap();

        let summary_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM daily_report_summary_lines WHERE daily_report_import_id = ?1",
                rusqlite::params![import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(summary_count, 2);

        let payment_amount: Option<i64> = conn
            .query_row(
                "SELECT amount FROM daily_report_payment_lines WHERE daily_report_import_id = ?1 AND payment_key = 'cash'",
                rusqlite::params![import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(payment_amount, Some(11000));

        let unmatched_department_id: Option<i64> = conn
            .query_row(
                "SELECT department_id FROM daily_report_department_lines WHERE daily_report_import_id = ?1 AND raw_department_name = '未対応部門'",
                rusqlite::params![import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(unmatched_department_id, None);
    }

    #[test]
    fn test_daily_report_repo_req401_insert_lines_empty_noop() {
        // REQ-401: SALES日報取込み
        // FUNC-14.15: 空スライスの一括INSERTはno-op
        let (_dir, conn) = setup_test_db();

        insert_daily_report_summary_lines(&conn, &[]).unwrap();
        insert_daily_report_payment_lines(&conn, &[]).unwrap();
        insert_daily_report_department_lines(&conn, &[]).unwrap();

        for table in [
            "daily_report_summary_lines",
            "daily_report_payment_lines",
            "daily_report_department_lines",
        ] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert_eq!(count, 0, "{} should remain empty", table);
        }
    }

    #[test]
    fn test_daily_report_repo_req401_find_blocking_by_bundle_hash_completed_only() {
        // REQ-401: SALES日報取込み
        // FUNC-14.17: 同一bundleのcompletedのみ二重取込みをブロックする
        let (_dir, conn) = setup_test_db();
        seed_daily_report_import(&conn, "2026-03-20", "same-bundle", "rolled_back");
        let completed_id =
            seed_daily_report_import(&conn, "2026-03-21", "same-bundle", "completed");

        let blocking = find_blocking_daily_report_by_bundle_hash(&conn, "same-bundle")
            .unwrap()
            .unwrap();
        assert_eq!(blocking.id, completed_id);

        rollback_daily_report_import(&conn, completed_id, "2026-03-22T10:00:00").unwrap();
        let blocking = find_blocking_daily_report_by_bundle_hash(&conn, "same-bundle").unwrap();
        assert!(blocking.is_none(), "rolled_back の同一bundleは再取込み可能");
    }

    #[test]
    fn test_daily_report_repo_req401_find_by_report_date_completed_only() {
        // REQ-401: SALES日報取込み
        // FUNC-14.18: 同一report_dateのcompletedをid降順で返し、rolled_backを除外する
        let (_dir, conn) = setup_test_db();
        let old_id = seed_daily_report_import(&conn, "2026-03-21", "date-hash-a", "completed");
        seed_daily_report_import(&conn, "2026-03-21", "date-hash-rolled", "rolled_back");
        let new_id = seed_daily_report_import(&conn, "2026-03-21", "date-hash-b", "completed");
        seed_daily_report_import(&conn, "2026-03-22", "date-hash-other", "completed");

        let found = find_daily_report_imports_by_report_date(&conn, "2026-03-21").unwrap();
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].id, new_id);
        assert_eq!(found[1].id, old_id);
    }

    #[test]
    fn test_get_latest_completed_daily_report_returns_latest_req501() {
        // REQ-501: 日次売上公式日報表示
        // FUNC-14.21: 指定日の最新completed親と配下行をsort_order順で返す
        let (_dir, conn) = setup_test_db();
        let old_id = seed_daily_report_import(&conn, "2026-03-21", "latest-old", "completed");
        insert_daily_report_payment_lines(
            &conn,
            &[NewDailyReportPaymentLine {
                daily_report_import_id: old_id,
                source_file: "Z002".to_string(),
                payment_key: "old".to_string(),
                label: "旧現金".to_string(),
                amount: Some(1),
                count: Some(1),
                sort_order: 1,
            }],
        )
        .unwrap();
        let latest_id = seed_daily_report_import(&conn, "2026-03-21", "latest-new", "completed");
        insert_daily_report_payment_lines(
            &conn,
            &[
                NewDailyReportPaymentLine {
                    daily_report_import_id: latest_id,
                    source_file: "Z002".to_string(),
                    payment_key: "credit".to_string(),
                    label: "クレジット".to_string(),
                    amount: Some(2000),
                    count: Some(2),
                    sort_order: 2,
                },
                NewDailyReportPaymentLine {
                    daily_report_import_id: latest_id,
                    source_file: "Z002".to_string(),
                    payment_key: "cash".to_string(),
                    label: "現金".to_string(),
                    amount: Some(9000),
                    count: Some(5),
                    sort_order: 1,
                },
            ],
        )
        .unwrap();
        insert_daily_report_department_lines(
            &conn,
            &[NewDailyReportDepartmentLine {
                daily_report_import_id: latest_id,
                source_file: "Z005".to_string(),
                department_id: Some(1),
                raw_department_name: "その他小物".to_string(),
                normalized_department_name: Some("その他小物".to_string()),
                amount: 11000,
                quantity: Some(7),
                count: Some(3),
                sort_order: 1,
            }],
        )
        .unwrap();

        let report = get_latest_completed_daily_report(&conn, "2026-03-21")
            .unwrap()
            .unwrap();
        assert_eq!(report.daily_report_import_id, latest_id);
        assert_eq!(report.gross_amount, Some(12000));
        assert_eq!(report.net_amount, Some(11000));
        assert_eq!(report.payment_lines[0].payment_key, "cash");
        assert_eq!(report.payment_lines[1].payment_key, "credit");
        assert_eq!(report.department_lines.len(), 1);
    }

    #[test]
    fn test_get_latest_completed_daily_report_excludes_rolled_back_req501() {
        // REQ-501: 日次売上公式日報表示
        // FUNC-14.21: rolled_back親は公式表示対象外
        let (_dir, conn) = setup_test_db();
        seed_daily_report_import(&conn, "2026-03-21", "rolled", "rolled_back");

        let report = get_latest_completed_daily_report(&conn, "2026-03-21").unwrap();
        assert!(report.is_none());
    }

    #[test]
    fn test_get_latest_completed_daily_report_after_overwrite_req501() {
        // REQ-501: 日次売上公式日報表示
        // FUNC-14.21: 上書き後はrolled_back旧親ではなく新completed親を返す
        let (_dir, conn) = setup_test_db();
        let old_id = seed_daily_report_import(&conn, "2026-03-21", "overwrite-old", "completed");
        rollback_daily_report_import(&conn, old_id, "2026-03-22T10:00:00").unwrap();
        let new_id = seed_daily_report_import(&conn, "2026-03-21", "overwrite-new", "completed");

        let report = get_latest_completed_daily_report(&conn, "2026-03-21")
            .unwrap()
            .unwrap();
        assert_eq!(report.daily_report_import_id, new_id);
    }

    #[test]
    fn test_daily_report_repo_req401_rollback_is_parent_status_only() {
        // REQ-401: SALES日報取込み
        // FUNC-14.19 / D-025: rollbackは親status更新のみ。明細は物理削除しない
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report_import(&conn, "2026-03-21", "rollback-hash", "completed");
        insert_daily_report_summary_lines(
            &conn,
            &[NewDailyReportSummaryLine {
                daily_report_import_id: import_id,
                source_file: "Z001".to_string(),
                line_key: "net_sales".to_string(),
                label: "純売上".to_string(),
                amount: Some(11000),
                quantity: None,
                count: None,
                sort_order: 1,
            }],
        )
        .unwrap();

        let updated =
            rollback_daily_report_import(&conn, import_id, "2026-03-22T10:00:00").unwrap();
        assert!(updated);
        let second = rollback_daily_report_import(&conn, import_id, "2026-03-22T11:00:00").unwrap();
        assert!(!second, "completed以外は更新しない");

        let found = find_daily_report_import_by_id(&conn, import_id)
            .unwrap()
            .unwrap();
        assert_eq!(found.status, "rolled_back");
        assert_eq!(found.rolled_back_at.as_deref(), Some("2026-03-22T10:00:00"));

        let line_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM daily_report_summary_lines WHERE daily_report_import_id = ?1",
                rusqlite::params![import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(line_count, 1, "明細は物理削除しない");
    }

    #[test]
    fn test_daily_report_repo_req401_list_pagination_filters_and_boundaries() {
        // REQ-401: SALES日報取込み
        // FUNC-14.20: 履歴一覧は日付降順、日付範囲filter、page/per_page境界を守る
        let (_dir, conn) = setup_test_db();
        seed_daily_report_import(&conn, "2026-03-19", "list-hash-1", "completed");
        seed_daily_report_import(&conn, "2026-03-21", "list-hash-2", "completed");
        seed_daily_report_import(&conn, "2026-03-20", "list-hash-3", "rolled_back");

        let page1 = list_daily_report_imports(&conn, 1, 2, None, None).unwrap();
        assert_eq!(page1.items.len(), 2);
        assert_eq!(page1.total_count, 3);
        assert_eq!(page1.page, 1);
        assert_eq!(page1.per_page, 2);
        assert_eq!(page1.items[0].report_date, "2026-03-21");
        assert_eq!(page1.items[1].report_date, "2026-03-20");

        let filtered =
            list_daily_report_imports(&conn, 1, 10, Some("2026-03-20"), Some("2026-03-21"))
                .unwrap();
        assert_eq!(filtered.total_count, 2);
        assert!(filtered
            .items
            .iter()
            .all(|item| item.report_date.as_str() >= "2026-03-20"
                && item.report_date.as_str() <= "2026-03-21"));

        assert!(
            matches!(
                list_daily_report_imports(&conn, 0, 10, None, None),
                Err(DbError::QueryFailed(_))
            ),
            "page=0 → エラー"
        );
        assert!(
            matches!(
                list_daily_report_imports(&conn, 1, 0, None, None),
                Err(DbError::QueryFailed(_))
            ),
            "per_page=0 → エラー"
        );
        assert!(
            matches!(
                list_daily_report_imports(&conn, 1, 101, None, None),
                Err(DbError::QueryFailed(_))
            ),
            "per_page=101 → エラー"
        );
    }

    // -------------------------------------------------------------------
    // BIZ-05 売上集計クエリ
    // -------------------------------------------------------------------

    /// テスト用: 商品を指定部門で登録
    fn seed_product_with_dept(conn: &DbConnection, product_code: &str, department_id: i64) {
        let product = NewProduct {
            product_code: product_code.to_string(),
            jan_code: None,
            name: format!("商品{}", product_code),
            department_id,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: 0,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(conn, &product).unwrap();
    }

    /// テスト用: 売上レコードを挿入
    fn seed_sale(
        conn: &DbConnection,
        product_code: &str,
        date: &str,
        quantity: i64,
        amount: i64,
        source: &str,
        is_voided: bool,
    ) {
        let record = NewSaleRecord {
            csv_import_id: None,
            product_code: product_code.to_string(),
            sale_date: date.to_string(),
            quantity,
            amount,
            source: source.to_string(),
            source_line_no: None,
            reason: None,
            note: None,
        };
        let id = insert_sale_record(conn, &record).unwrap();
        if is_voided {
            conn.execute("UPDATE sale_records SET is_voided = 1 WHERE id = ?1", [id])
                .unwrap();
        }
    }

    #[test]
    fn test_get_daily_sales_records_req501_normal() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 2.10: auto+manual混在の正常取得
        let (_dir, conn) = setup_test_db();
        seed_product_with_dept(&conn, "P001", 1);
        seed_product_with_dept(&conn, "P002", 3);
        seed_sale(&conn, "P001", "2026-03-21", 2, 1000, "auto", false);
        seed_sale(&conn, "P002", "2026-03-21", 1, 500, "manual", false);

        let rows = get_daily_sales_records(&conn, "2026-03-21").unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].product_code, "P001"); // dept 1 < dept 3
        assert_eq!(rows[0].source, "auto");
        assert_eq!(rows[1].product_code, "P002");
        assert_eq!(rows[1].source, "manual");
    }

    #[test]
    fn test_get_daily_sales_records_req501_empty() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 2.10: データなし -> 空Vec
        let (_dir, conn) = setup_test_db();
        let rows = get_daily_sales_records(&conn, "2026-03-21").unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn test_get_daily_sales_records_req501_voided_excluded() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 2.10: is_voided=1 は除外される
        let (_dir, conn) = setup_test_db();
        seed_product_with_dept(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-03-21", 3, 1500, "auto", false);
        seed_sale(&conn, "P001", "2026-03-21", 1, 500, "auto", true);

        let rows = get_daily_sales_records(&conn, "2026-03-21").unwrap();
        assert_eq!(rows.len(), 1, "voided=1 は除外");
        assert_eq!(rows[0].quantity, 3);
    }

    #[test]
    fn test_get_daily_sales_records_req501_returns() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 2.10: マイナスquantity（返品）も取得される
        let (_dir, conn) = setup_test_db();
        seed_product_with_dept(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-03-21", -1, -500, "auto", false);

        let rows = get_daily_sales_records(&conn, "2026-03-21").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].quantity, -1);
        assert_eq!(rows[0].amount, -500);
    }

    #[test]
    fn test_get_monthly_by_product_req502_normal() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 2.10: 商品別集計
        let (_dir, conn) = setup_test_db();
        seed_product_with_dept(&conn, "P001", 1);
        seed_product_with_dept(&conn, "P002", 1);
        seed_sale(&conn, "P001", "2026-03-01", 2, 1000, "auto", false);
        seed_sale(&conn, "P001", "2026-03-15", 3, 1500, "auto", false);
        seed_sale(&conn, "P002", "2026-03-10", 1, 800, "auto", false);

        let rows = get_monthly_sales_by_product(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert_eq!(rows.len(), 2);
        // P001: amount 2500 > P002: amount 800 -> P001が先（DESC）
        assert_eq!(rows[0].product_code, "P001");
        assert_eq!(rows[0].quantity, 5);
        assert_eq!(rows[0].amount, 2500);
        assert_eq!(rows[1].product_code, "P002");
    }

    #[test]
    fn test_get_monthly_by_product_req502_empty() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 2.10: データなし -> 空Vec
        let (_dir, conn) = setup_test_db();
        let rows = get_monthly_sales_by_product(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn test_get_monthly_by_department_req502_normal() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 2.10: 部門別集計
        let (_dir, conn) = setup_test_db();
        seed_product_with_dept(&conn, "P001", 1); // その他小物
        seed_product_with_dept(&conn, "P002", 3); // 毛糸
        seed_sale(&conn, "P001", "2026-03-10", 2, 1000, "auto", false);
        seed_sale(&conn, "P002", "2026-03-10", 5, 3000, "auto", false);

        let rows = get_monthly_sales_by_department(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert_eq!(rows.len(), 2);
        // 毛糸 3000 > その他小物 1000 -> 毛糸が先（DESC）
        assert_eq!(rows[0].department_id, 3);
        assert_eq!(rows[0].amount, 3000);
        assert_eq!(rows[1].department_id, 1);
    }

    #[test]
    fn test_get_monthly_by_department_req502_voided() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 2.10: voided除外で集計
        let (_dir, conn) = setup_test_db();
        seed_product_with_dept(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-03-10", 5, 2500, "auto", false);
        seed_sale(&conn, "P001", "2026-03-15", 3, 1500, "auto", true);

        let rows = get_monthly_sales_by_department(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].quantity, 5, "voided分は除外");
        assert_eq!(rows[0].amount, 2500);
    }

    #[test]
    fn test_get_monthly_official_department_totals_aggregates_req502() {
        // REQ-502: 月次売上公式部門集計
        // FUNC-14.22: completed日報のZ005部門行を月内集計する
        let (_dir, conn) = setup_test_db();
        let first = seed_daily_report_import(&conn, "2026-03-01", "monthly-a", "completed");
        let second = seed_daily_report_import(&conn, "2026-03-15", "monthly-b", "completed");
        seed_daily_report_import(&conn, "2026-04-01", "monthly-other", "completed");
        insert_daily_report_department_lines(
            &conn,
            &[
                NewDailyReportDepartmentLine {
                    daily_report_import_id: first,
                    source_file: "Z005".to_string(),
                    department_id: Some(1),
                    raw_department_name: "その他小物".to_string(),
                    normalized_department_name: Some("その他小物".to_string()),
                    amount: 1000,
                    quantity: Some(2),
                    count: Some(1),
                    sort_order: 1,
                },
                NewDailyReportDepartmentLine {
                    daily_report_import_id: second,
                    source_file: "Z005".to_string(),
                    department_id: Some(1),
                    raw_department_name: "その他小物".to_string(),
                    normalized_department_name: Some("その他小物".to_string()),
                    amount: 3000,
                    quantity: Some(4),
                    count: Some(2),
                    sort_order: 1,
                },
            ],
        )
        .unwrap();

        let rows = get_monthly_official_department_totals(&conn, "2026-03-01", "2026-03-31")
            .unwrap()
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].department_id, Some(1));
        assert_eq!(rows[0].label, "その他小物");
        assert_eq!(rows[0].amount, 4000);
        assert_eq!(rows[0].quantity, Some(6));
        assert_eq!(rows[0].count, Some(3));
    }

    #[test]
    fn test_get_monthly_official_department_totals_none_req502() {
        // REQ-502: 月次売上公式部門集計
        // FUNC-14.22: 対象月にcompleted日報が無ければNone
        let (_dir, conn) = setup_test_db();
        seed_daily_report_import(&conn, "2026-03-01", "rolled-monthly", "rolled_back");

        let rows =
            get_monthly_official_department_totals(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert!(rows.is_none());
    }

    #[test]
    fn test_get_monthly_official_department_totals_null_department_req502() {
        // REQ-502: 月次売上公式部門集計
        // FUNC-14.22: department_id NULL の部門名行も落とさず集計する
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report_import(&conn, "2026-03-21", "null-dept", "completed");
        insert_daily_report_department_lines(
            &conn,
            &[NewDailyReportDepartmentLine {
                daily_report_import_id: import_id,
                source_file: "Z005".to_string(),
                department_id: None,
                raw_department_name: "未対応部門".to_string(),
                normalized_department_name: None,
                amount: 800,
                quantity: None,
                count: Some(1),
                sort_order: 1,
            }],
        )
        .unwrap();

        let rows = get_monthly_official_department_totals(&conn, "2026-03-01", "2026-03-31")
            .unwrap()
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].department_id, None);
        assert_eq!(rows[0].label, "未対応部門");
        assert_eq!(rows[0].amount, 800);
        assert_eq!(rows[0].quantity, None);
        assert_eq!(rows[0].count, Some(1));
    }
}
