//! rollback_csv_import — CSV取込みのロールバック（論理無効化 + 在庫補正）

use crate::biz::csv_import_service::commit::apply_void_stock_corrections;
use crate::biz::csv_import_service::RollbackResult;
use crate::biz::BizError;
use crate::db::sales_repo;
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::{DbConnection, DbError};

/// 指定 csv_import を論理無効化し、在庫を補正する
///
/// 冪等（既に rolled_back なら何もせず成功を返す）。
///
/// docs/function-design/32-biz-csv-import-service.md §15.5
pub fn rollback_csv_import(
    conn: &mut DbConnection,
    csv_import_id: i64,
) -> Result<RollbackResult, BizError> {
    // 1. 対象確認
    let import = sales_repo::find_csv_import_by_id(conn, csv_import_id)?.ok_or_else(|| {
        BizError::NotFound(format!(
            "CSV取込み記録が見つかりません: ID {}",
            csv_import_id
        ))
    })?;

    // 冪等: 既に rolled_back なら何もせず成功
    if import.status == "rolled_back" {
        return Ok(RollbackResult {
            success: true,
            voided_sale_count: 0,
            voided_movement_count: 0,
            stock_corrections: Vec::new(),
        });
    }

    // 2. TX開始
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 3. sale_records の無効化
    let voided_sale_count = sales_repo::void_sale_records_by_import(&tx, csv_import_id)?;

    // 4. inventory_movements の無効化と在庫補正データ取得
    let voided_movements =
        sales_repo::void_movements_by_reference(&tx, "csv_import", csv_import_id)?;
    let voided_movement_count = voided_movements.len();

    // 5. 在庫補正
    let stock_corrections = apply_void_stock_corrections(&tx, &voided_movements)?;

    // 6. csv_imports の status 更新
    sales_repo::update_csv_import_status(&tx, csv_import_id, "rolled_back")?;

    // 7. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 8. TX外: 操作ログ記録（best-effort）
    let detail = format!(
        r#"{{"csv_import_id":{},"voided_sale_count":{},"voided_movement_count":{},"stock_corrections":{}}}"#,
        csv_import_id,
        voided_sale_count,
        voided_movement_count,
        serde_json::to_string(&stock_corrections).unwrap_or_else(|_| "[]".to_string())
    );
    let log = NewOperationLog {
        operation_type: "csv_rollback".to_string(),
        summary: format!("CSV取込みを取消しました: ID {}", csv_import_id),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    // 9. 結果返却
    Ok(RollbackResult {
        success: true,
        voided_sale_count,
        voided_movement_count,
        stock_corrections,
    })
}
