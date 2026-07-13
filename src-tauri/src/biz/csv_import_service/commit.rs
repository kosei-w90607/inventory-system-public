//! commit_csv_import — Stage 4（Commit）+ apply_void_stock_corrections ヘルパー

use crate::biz::csv_import_service::{
    CommitRequest, DuplicateStatus, ImportResult, StockCorrection,
};
use crate::biz::inventory_service::apply_stock_change;
use crate::biz::BizError;
use crate::db::inventory_repo;
use crate::db::inventory_repo::{MovementType, ReferenceType};
use crate::db::product_repo;
use crate::db::sales_repo::{self, NewCsvImport, NewCsvImportError, NewSaleRecord, VoidedMovement};
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::{DbConnection, DbError};
use std::collections::HashMap;

/// プレビュー済みデータをDBに書き込む
///
/// CMD層から受け取ったキャッシュデータを使いTX内で一括実行する。
///
/// docs/function-design/32-biz-csv-import-service.md §15.4
pub fn commit_csv_import(
    conn: &mut DbConnection,
    req: CommitRequest,
) -> Result<ImportResult, BizError> {
    // 1. ローカル変数の導出
    let cached = req.cached_data;
    let matched_rows = &cached.matched_rows;
    let error_rows = &cached.error_rows;
    let file_hash = &cached.preview_data.file_info.file_hash;
    let settlement_date = &cached.preview_data.file_info.settlement_date;
    let filename = &cached.preview_data.file_info.filename;
    let existing_import_id = cached.preview_data.duplicate_check.existing_import_id;

    // 2. 上書き確認処理
    if cached.preview_data.duplicate_check.status == DuplicateStatus::OverwriteRequired
        && !req.overwrite_confirmed
    {
        return Err(BizError::ImportError(
            "同日のデータが取込み済みです。上書きする場合は overwrite_confirmed を指定してください"
                .to_string(),
        ));
    }
    // Preview が NoDuplicate なのに overwrite_confirmed=true → 不正リクエスト
    if cached.preview_data.duplicate_check.status == DuplicateStatus::NoDuplicate
        && req.overwrite_confirmed
    {
        return Err(BizError::ValidationFailed(
            "上書き対象がありません（プレビュー結果と不整合）".to_string(),
        ));
    }

    // 3〜10. TX処理 + 操作ログ記録
    let result = execute_commit(
        conn,
        matched_rows,
        error_rows,
        file_hash,
        settlement_date,
        filename,
        existing_import_id,
        req.overwrite_confirmed,
    );

    // TX失敗時: csv_import_failed ログを記録（設計書§15.4）
    if let Err(ref e) = result {
        let fail_log = NewOperationLog {
            operation_type: "csv_import_failed".to_string(),
            summary: format!("CSV取込みに失敗しました: {}", e),
            detail_json: None,
        };
        if let Err(log_err) = system_repo::insert_operation_log(conn, &fail_log) {
            tracing::warn!(error = %log_err, "操作ログ記録に失敗");
        }
    }

    result
}

/// TX処理本体（ステップ3〜10）
#[allow(clippy::too_many_arguments)]
fn execute_commit(
    conn: &mut DbConnection,
    matched_rows: &[crate::biz::csv_import_service::MatchedRow],
    error_rows: &[crate::biz::csv_import_service::ErrorRow],
    file_hash: &str,
    settlement_date: &str,
    filename: &str,
    existing_import_id: Option<i64>,
    overwrite_confirmed: bool,
) -> Result<ImportResult, BizError> {
    // 3. TX開始
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 3a. 上書き時の旧データ無効化（TX内）
    if overwrite_confirmed {
        if let Some(old_id) = existing_import_id {
            sales_repo::void_sale_records_by_import(&tx, old_id)?;
            let voided_movements =
                sales_repo::void_movements_by_reference(&tx, "csv_import", old_id)?;
            apply_void_stock_corrections(&tx, &voided_movements)?;
            sales_repo::update_csv_import_status(&tx, old_id, "rolled_back")?;
        }
    }

    // 4. file_hash TOCTOU再チェック（TX内）
    if sales_repo::find_blocking_import_by_file_hash(&tx, file_hash)?.is_some() {
        return Err(BizError::ImportError(
            "このファイルは既に取込み済みです".to_string(),
        ));
    }

    // 4a. settlement_date TOCTOU再チェック（TX内、常時実行）
    // overwrite_confirmed=true の場合、ステップ3a で旧データを rolled_back 済みのため
    // find_imports_by_settlement_date は空を返す（rolled_back は除外される）
    let same_date_imports = sales_repo::find_imports_by_settlement_date(&tx, settlement_date)?;
    if !same_date_imports.is_empty() {
        return Err(BizError::ImportError(
            "同日のデータが取込み済みです。再度プレビューしてください".to_string(),
        ));
    }

    // 5. csv_imports 仮INSERT
    let import_id = sales_repo::insert_csv_import(
        &tx,
        &NewCsvImport {
            filename: filename.to_string(),
            settlement_date: settlement_date.to_string(),
            file_hash: file_hash.to_string(),
            total_items: 0,
            total_amount: 0,
            skipped_count: 0,
            status: "completed".to_string(),
        },
    )?;

    // 6. matched_rows の各行を処理
    for row in matched_rows {
        // 6a. sale_record 作成
        sales_repo::insert_sale_record(
            &tx,
            &NewSaleRecord {
                csv_import_id: Some(import_id),
                product_code: row.product_code.clone(),
                sale_date: settlement_date.to_string(),
                quantity: row.quantity as i64,
                amount: row.amount as i64,
                source: "auto".to_string(),
                source_line_no: Some(row.line_no as i64),
                reason: None,
                note: None,
            },
        )?;

        // 6b. pos_stock_sync=true → 在庫変動
        if row.pos_stock_sync {
            // INV-1: 売上帳票視点→在庫視点。常に符号反転
            let inventory_quantity = -(row.quantity as i64);
            apply_stock_change(
                &tx,
                &row.product_code,
                inventory_quantity,
                MovementType::SaleAuto,
                ReferenceType::CsvImport,
                import_id,
                None,
            )?;
        }
        // 6c. pos_stock_sync=false → sale_records のみ作成。在庫は動かさない
    }

    // 7. error_rows の記録
    if !error_rows.is_empty() {
        let errors: Vec<NewCsvImportError> = error_rows
            .iter()
            .map(|e| NewCsvImportError {
                csv_import_id: import_id,
                source_line_no: e.line_no as i64,
                normalized_jan: e.normalized_jan.clone(),
                raw_name: e.name.clone(),
                raw_quantity: e.raw_quantity.clone(),
                raw_amount: e.raw_amount.clone(),
                error_type: e.error_type.clone(),
                error_message: e.error_message.clone(),
            })
            .collect();
        sales_repo::insert_csv_import_errors(&tx, &errors)?;
    }

    // 8. 集計値の確定
    let total_items = matched_rows.len() as i64;
    let total_amount: i64 = matched_rows.iter().map(|r| r.amount as i64).sum();
    let skipped_count = error_rows.len() as i64;
    let status = if error_rows.is_empty() {
        "completed"
    } else {
        "completed_partial"
    };
    sales_repo::update_csv_import_totals(
        &tx,
        import_id,
        total_items,
        total_amount,
        skipped_count,
        status,
    )?;

    // 9. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 10. TX外: 操作ログ記録（best-effort）
    let detail = serde_json::json!({
        "import_id": import_id,
        "filename": filename,
        "settlement_date": settlement_date,
        "total_items": total_items,
        "total_amount": total_amount,
        "skipped_count": skipped_count,
        "status": status,
    })
    .to_string();
    let log = NewOperationLog {
        operation_type: "csv_import".to_string(),
        summary: format!(
            "CSV取込み完了: {}（{}件, ¥{}）",
            filename, total_items, total_amount
        ),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(ImportResult {
        csv_import_id: import_id,
        status: status.to_string(),
        total_items,
        total_amount,
        skipped_count,
    })
}

/// voided_movements に基づく在庫補正（commit上書き + rollback で共用）
///
/// voided_movements を product_code でグループ化し、
/// correction = -SUM(quantity) で在庫を補正する。
///
/// docs/function-design/32-biz-csv-import-service.md §15.5
pub(super) fn apply_void_stock_corrections(
    conn: &DbConnection,
    voided_movements: &[VoidedMovement],
) -> Result<Vec<StockCorrection>, BizError> {
    if voided_movements.is_empty() {
        return Ok(Vec::new());
    }

    // product_code でグループ化して quantity を合算
    let mut corrections_map: HashMap<String, i64> = HashMap::with_capacity(voided_movements.len());
    for vm in voided_movements {
        *corrections_map.entry(vm.product_code.clone()).or_insert(0) += vm.quantity;
    }

    let mut stock_corrections = Vec::new();
    for (product_code, sum_quantity) in &corrections_map {
        // correction = -SUM(voided.quantity)
        let correction = -sum_quantity;
        let product = product_repo::find_by_product_code(conn, product_code)?.ok_or_else(|| {
            BizError::NotFound(format!(
                "在庫補正対象の商品が見つかりません: {}",
                product_code
            ))
        })?;
        let old_stock = product.product.stock_quantity;
        let new_stock = old_stock + correction;
        inventory_repo::update_stock_quantity(conn, product_code, new_stock)?;
        stock_corrections.push(StockCorrection {
            product_code: product_code.clone(),
            old_stock,
            new_stock,
        });
    }

    Ok(stock_corrections)
}
