//! BIZ-06: 棚卸しロジック
//!
//! 棚卸しの開始・カウント入力・確定を管理し、仕入原価総額を算出する。
//! 年末の長期作業（10月〜大晦日）で、4000商品を順次カウントする。
//!
//! docs/function-design/35-biz-stocktake-service.md に基づく実装。

use crate::biz::BizError;
use crate::db::{
    inventory_repo, product_repo, stocktake_repo, system_repo, DbConnection, NewOperationLog,
    NewStocktakeItem,
};

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 棚卸し開始結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct StartStocktakeResult {
    pub stocktake_id: i64,
    pub item_count: usize,
    pub auto_filled_count: usize,
}

/// カウント更新リクエスト
#[derive(Debug)]
pub struct UpdateCountRequest {
    pub stocktake_item_id: i64,
    pub actual_count: i64,
}

/// カウント更新結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct UpdateCountResult {
    pub success: bool,
    pub current_difference: i64,
}

/// 棚卸し確定リクエスト
#[derive(Debug)]
pub struct CompleteStocktakeRequest {
    pub stocktake_id: i64,
    pub force_fill: bool,
}

/// 棚卸し確定結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct StocktakeResult {
    pub total_cost: i64,
    pub adjusted_items: Vec<AdjustedItem>,
    pub total_items: usize,
    /// D-2統合: 確定後の整合性チェック結果。失敗時はNone
    pub integrity_result: Option<crate::biz::integrity_service::IntegrityResult>,
}

/// 差異補正アイテム
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct AdjustedItem {
    pub product_code: String,
    pub product_name: String,
    pub system_stock: i64,
    pub actual_count: i64,
    pub difference: i64,
    pub stock_after: i64,
}

/// 棚卸し進捗（BIZ版）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct StocktakeProgressBiz {
    pub stocktake_id: i64,
    pub status: String,
    pub total_items: usize,
    pub counted_items: usize,
    pub uncounted_items: usize,
}

// ---------------------------------------------------------------------------
// 関数
// ---------------------------------------------------------------------------

/// 進行中の棚卸しを取得する（読み取り専用、TX不要）
///
/// UI-10-D1 / CMD-10 get_active_stocktake 用。IO層の薄いラッパー。
pub fn get_active_stocktake(
    conn: &DbConnection,
) -> Result<Option<stocktake_repo::Stocktake>, BizError> {
    Ok(stocktake_repo::find_active_stocktake(conn)?)
}

/// 棚卸しアイテム一覧を取得する（読み取り専用、TX不要）
///
/// CMD-10 get_stocktake_items 用。BIZ-06-VAL-D1のページ下限を検証してIO層を呼ぶ。
/// items + progress を返す。
pub fn get_stocktake_items(
    conn: &DbConnection,
    stocktake_id: i64,
    department_id: Option<i64>,
    counted_only: Option<bool>,
    page: u32,
    per_page: u32,
) -> Result<
    (
        crate::db::PaginatedResult<stocktake_repo::StocktakeItemDetail>,
        stocktake_repo::StocktakeProgress,
    ),
    BizError,
> {
    if page < 1 {
        return Err(BizError::ValidationFailedAt {
            message: "ページ番号は1以上で指定してください".to_string(),
            field: "page".to_string(),
        });
    }
    if per_page < 1 {
        return Err(BizError::ValidationFailedAt {
            message: "1ページあたりの件数は1以上で指定してください".to_string(),
            field: "per_page".to_string(),
        });
    }

    let paginated = stocktake_repo::list_stocktake_items(
        conn,
        stocktake_id,
        department_id,
        counted_only,
        page,
        per_page,
    )?;
    let progress = stocktake_repo::get_stocktake_progress(conn, stocktake_id)?;
    Ok((paginated, progress))
}

/// 商品コードまたはJANコードで棚卸し明細を取得する（読み取り専用、TX不要）
///
/// UI-10-D2 / CMD-10 find_stocktake_item 用。IO層の薄いラッパー。
pub fn find_stocktake_item(
    conn: &DbConnection,
    stocktake_id: i64,
    code: &str,
) -> Result<Option<stocktake_repo::StocktakeItemDetail>, BizError> {
    Ok(stocktake_repo::find_stocktake_item_by_code(
        conn,
        stocktake_id,
        code,
    )?)
}

/// 最後に完了した棚卸しを取得する（読み取り専用、TX不要）
///
/// UI-10-D5 / CMD-10 get_last_completed_stocktake 用。IO層の薄いラッパー。
pub fn get_last_completed_stocktake(
    conn: &DbConnection,
) -> Result<Option<stocktake_repo::LastStocktakeSummary>, BizError> {
    Ok(stocktake_repo::find_last_completed_stocktake(conn)?)
}

/// 棚卸し進捗を取得する（読み取り専用、TX不要）
///
/// 35-biz-stocktake-service.md §20.6
pub fn get_stocktake_progress(
    conn: &DbConnection,
    stocktake_id: i64,
) -> Result<StocktakeProgressBiz, BizError> {
    // 1. 棚卸し存在チェック
    let stocktake = stocktake_repo::find_stocktake_by_id(conn, stocktake_id)?.ok_or_else(|| {
        BizError::NotFound(format!("棚卸しが見つかりません: ID {}", stocktake_id))
    })?;

    // 2. DB進捗取得
    let db_progress = stocktake_repo::get_stocktake_progress(conn, stocktake_id)?;

    // 3. BIZ型に変換
    Ok(StocktakeProgressBiz {
        stocktake_id,
        status: stocktake.status,
        total_items: db_progress.total_items as usize,
        counted_items: db_progress.counted_items as usize,
        uncounted_items: db_progress.uncounted_items as usize,
    })
}

/// カウント値を更新する（autocommit、TX不要）
///
/// 35-biz-stocktake-service.md §20.4
pub fn update_count(
    conn: &DbConnection,
    req: &UpdateCountRequest,
) -> Result<UpdateCountResult, BizError> {
    // 1. バリデーション
    if req.actual_count < 0 {
        return Err(BizError::ValidationFailed(
            "カウント数は0以上で入力してください".to_string(),
        ));
    }

    // 2. 明細＋親ステータス取得
    let (item, status) =
        stocktake_repo::find_stocktake_item_with_parent_status(conn, req.stocktake_item_id)?
            .ok_or_else(|| {
                BizError::NotFound(format!(
                    "棚卸し明細が見つかりません: ID {}",
                    req.stocktake_item_id
                ))
            })?;

    if status != "in_progress" {
        return Err(BizError::StocktakeNotInProgress(
            "この棚卸しは既に完了しています".to_string(),
        ));
    }

    // 3. カウント更新
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    stocktake_repo::update_stocktake_item_count(
        conn,
        req.stocktake_item_id,
        req.actual_count,
        &now,
    )?;

    // 4. 現在の差異を計算（動的: products.stock_quantity - actual_count）
    let product =
        product_repo::find_by_product_code(conn, &item.product_code)?.ok_or_else(|| {
            BizError::NotFound(format!("商品が見つかりません: {}", item.product_code))
        })?;
    let current_difference = product.product.stock_quantity - req.actual_count;

    Ok(UpdateCountResult {
        success: true,
        current_difference,
    })
}

/// 棚卸しを開始する（TX + operation_log TX外）
///
/// 35-biz-stocktake-service.md §20.3
pub fn start_stocktake(conn: &mut DbConnection) -> Result<StartStocktakeResult, BizError> {
    use crate::db::DbError;

    // 1. TX外: 進行中チェック
    if let Some(existing) = stocktake_repo::find_active_stocktake(conn)? {
        return Err(BizError::StocktakeInProgress(format!(
            "進行中の棚卸しがあります（ID: {}、開始日: {}）。完了してから新しい棚卸しを開始してください",
            existing.id, existing.started_at
        )));
    }

    // 2. TX外: 対象商品の取得（全商品、フィルタなし。P2-1修正済み）
    let products = stocktake_repo::find_stocktake_eligible_products(conn)?;
    if products.is_empty() {
        return Err(BizError::ValidationFailed(
            "棚卸し対象の商品がありません".to_string(),
        ));
    }

    // 3. TX開始
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 4. 棚卸しヘッダINSERT
    let stocktake_id = stocktake_repo::insert_stocktake(&tx, &now)?;

    // 5. 棚卸し明細の一括生成
    let mut auto_filled_count = 0usize;
    let item_count = products.len();
    for product in &products {
        if product.is_discontinued && product.stock_quantity == 0 {
            // 廃番stock=0: actual_count=0 で自動入力（R-6: system_stock=0明示）
            stocktake_repo::insert_stocktake_item(
                &tx,
                &NewStocktakeItem {
                    stocktake_id,
                    product_code: product.product_code.clone(),
                    system_stock: 0,
                    actual_count: Some(0),
                },
            )?;
            auto_filled_count += 1;
        } else {
            // 通常 + 廃番stock>0: actual_count=NULL（手動カウント）
            stocktake_repo::insert_stocktake_item(
                &tx,
                &NewStocktakeItem {
                    stocktake_id,
                    product_code: product.product_code.clone(),
                    system_stock: product.stock_quantity,
                    actual_count: None,
                },
            )?;
        }
    }

    // 6. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 7. TX外: 操作ログ記録（失敗は tracing::warn! で警告。R-5対応）
    let detail = serde_json::json!({
        "stocktake_id": stocktake_id,
        "item_count": item_count,
        "auto_filled_count": auto_filled_count,
    })
    .to_string();
    let log = NewOperationLog {
        operation_type: "stocktake_start".to_string(),
        summary: format!("棚卸しを開始しました（対象: {}件）", item_count),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(StartStocktakeResult {
        stocktake_id,
        item_count,
        auto_filled_count,
    })
}

/// 棚卸しを確定する（最高リスク。TX + operation_log TX外）
///
/// 35-biz-stocktake-service.md §20.5
pub fn complete_stocktake(
    conn: &mut DbConnection,
    req: &CompleteStocktakeRequest,
) -> Result<StocktakeResult, BizError> {
    use crate::db::DbError;
    use inventory_repo::{MovementType, NewMovement, ReferenceType};

    // 1. TX外バリデーション
    let stocktake =
        stocktake_repo::find_stocktake_by_id(conn, req.stocktake_id)?.ok_or_else(|| {
            BizError::NotFound(format!("棚卸しが見つかりません: ID {}", req.stocktake_id))
        })?;
    if stocktake.status != "in_progress" {
        return Err(BizError::StocktakeNotInProgress(
            "この棚卸しは既に完了しています".to_string(),
        ));
    }

    let uncounted_count = stocktake_repo::count_uncounted_items(conn, req.stocktake_id)?;
    if uncounted_count > 0 && !req.force_fill {
        return Err(BizError::ValidationFailed(format!(
            "未入力の商品が{}件あります。全商品のカウントを完了するか、force_fill=true で未入力をシステム在庫と同じとみなしてください",
            uncounted_count
        )));
    }

    // 2. TX開始
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 3. force_fill: 未入力の自動補完
    if req.force_fill && uncounted_count > 0 {
        let uncounted_items = stocktake_repo::list_uncounted_items(&tx, req.stocktake_id)?;
        for item in &uncounted_items {
            let product =
                product_repo::find_by_product_code(&tx, &item.product_code)?.ok_or_else(|| {
                    BizError::NotFound(format!("商品が見つかりません: {}", item.product_code))
                })?;
            // R-3 + P3-7: 負在庫補正。INV-3準拠
            let fill_value = product.product.stock_quantity.max(0);
            stocktake_repo::update_stocktake_item_count(
                &tx,
                item.stocktake_item_id,
                fill_value,
                &now,
            )?;
        }
    }

    // 4. 全明細取得（force_fill後はNULLなし保証）
    let all_items = stocktake_repo::get_stocktake_items_for_complete(&tx, req.stocktake_id)?;

    // 5. 各明細処理
    let mut total_cost: i64 = 0;
    let mut adjusted_items: Vec<AdjustedItem> = Vec::new();

    for item in &all_items {
        let product =
            product_repo::find_by_product_code(&tx, &item.product_code)?.ok_or_else(|| {
                BizError::NotFound(format!("商品が見つかりません: {}", item.product_code))
            })?;

        let valuation_cost_price = product.product.cost_price;
        stocktake_repo::update_stocktake_item_valuation(&tx, item.id, valuation_cost_price)?;

        // オーバーフロー検査
        let item_cost = valuation_cost_price
            .checked_mul(item.actual_count)
            .ok_or_else(|| {
                BizError::ValidationFailed(
                    "仕入原価総額の計算でオーバーフローが発生しました".to_string(),
                )
            })?;
        total_cost = total_cost.checked_add(item_cost).ok_or_else(|| {
            BizError::ValidationFailed(
                "仕入原価総額の計算でオーバーフローが発生しました".to_string(),
            )
        })?;

        let difference = product.product.stock_quantity - item.actual_count;
        if difference != 0 {
            let adjustment_quantity = item.actual_count - product.product.stock_quantity;
            inventory_repo::update_stock_quantity(&tx, &item.product_code, item.actual_count)?;
            inventory_repo::insert_movement(
                &tx,
                &NewMovement {
                    product_code: item.product_code.clone(),
                    movement_type: MovementType::Stocktake,
                    quantity: adjustment_quantity,
                    stock_after: item.actual_count,
                    reference_type: Some(ReferenceType::Stocktake),
                    reference_id: Some(req.stocktake_id),
                    note: Some(format!(
                        "棚卸し補正: システム在庫{} → 実カウント{}",
                        product.product.stock_quantity, item.actual_count
                    )),
                },
            )?;
            adjusted_items.push(AdjustedItem {
                product_code: item.product_code.clone(),
                product_name: product.product.name.clone(),
                system_stock: product.product.stock_quantity,
                actual_count: item.actual_count,
                difference,
                stock_after: item.actual_count,
            });
        }
    }

    // 6. 棚卸しヘッダ確定
    stocktake_repo::complete_stocktake(&tx, req.stocktake_id, total_cost, &now)?;

    // 7. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 8. TX外: 操作ログ記録
    let adjusted_count = adjusted_items.len();
    let total_items = all_items.len();
    let detail = serde_json::json!({
        "stocktake_id": req.stocktake_id,
        "total_cost": total_cost,
        "total_items": total_items,
        "adjusted_count": adjusted_count,
        "force_fill_used": req.force_fill && uncounted_count > 0,
    })
    .to_string();
    let log = NewOperationLog {
        operation_type: "stocktake_complete".to_string(),
        summary: format!(
            "棚卸しを確定しました（差異: {}件、仕入原価総額: ¥{}）",
            adjusted_count, total_cost
        ),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    // 9. TX外: 整合性チェック自動実行（D-2統合）
    let integrity_result = match crate::biz::integrity_service::run_integrity_check(conn) {
        Ok(result) => Some(result),
        Err(e) => {
            tracing::warn!(error = %e, "整合性チェックに失敗");
            None
        }
    };

    Ok(StocktakeResult {
        total_cost,
        adjusted_items,
        total_items,
        integrity_result,
    })
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

    fn seed_product(conn: &DbConnection, product_code: &str, stock_quantity: i64) {
        let product = NewProduct {
            product_code: product_code.to_string(),
            jan_code: None,
            name: format!("商品{}", product_code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(conn, &product).unwrap();
    }

    fn create_stocktake(conn: &DbConnection, status: &str) -> i64 {
        conn.execute(
            "INSERT INTO stocktakes (started_at, status) VALUES ('2026-10-01T09:00:00', ?1)",
            rusqlite::params![status],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn seed_stocktake_item(
        conn: &DbConnection,
        stocktake_id: i64,
        product_code: &str,
        system_stock: i64,
        actual_count: Option<i64>,
    ) -> i64 {
        conn.execute(
            "INSERT INTO stocktake_items (stocktake_id, product_code, system_stock, actual_count)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![stocktake_id, product_code, system_stock, actual_count],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn seed_product_with_jan(
        conn: &DbConnection,
        product_code: &str,
        jan_code: Option<&str>,
        stock_quantity: i64,
    ) {
        let product = NewProduct {
            product_code: product_code.to_string(),
            jan_code: jan_code.map(str::to_string),
            name: format!("商品{}", product_code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(conn, &product).unwrap();
    }

    // ===== UI-10 T-R3: 新規 BIZ 薄ラッパー =====

    #[test]
    fn test_get_active_stocktake_req205_passes_through_repo_result() {
        // REQ-205: 棚卸し（BIZ get_active_stocktake は IO 結果を加工せず返す）
        let (_dir, conn) = setup_test_db();
        let st_id = create_stocktake(&conn, "in_progress");

        let result = get_active_stocktake(&conn).unwrap();

        let stocktake = result.expect("進行中棚卸しが返るべき");
        assert_eq!(stocktake.id, st_id);
        assert_eq!(stocktake.status, "in_progress");
    }

    #[test]
    fn test_get_active_stocktake_req205_converts_db_error_to_biz_error() {
        // REQ-205: 棚卸し（BIZ get_active_stocktake は DbError を BizError::DatabaseError に変換）
        let (_dir, conn) = setup_test_db();
        conn.execute("DROP TABLE stocktakes", []).unwrap();

        let result = get_active_stocktake(&conn);

        assert!(matches!(result, Err(BizError::DatabaseError(_))));
    }

    #[test]
    fn test_find_stocktake_item_req205_passes_through_repo_result() {
        // REQ-205: 棚卸し（BIZ find_stocktake_item は IO 結果を加工せず返す）
        let (_dir, conn) = setup_test_db();
        seed_product_with_jan(&conn, "BF-001", Some("4900000000101"), 12);
        let st_id = create_stocktake(&conn, "in_progress");
        let item_id = seed_stocktake_item(&conn, st_id, "BF-001", 12, Some(11));

        let result = find_stocktake_item(&conn, st_id, "4900000000101").unwrap();

        let item = result.expect("JAN一致の明細が返るべき");
        assert_eq!(item.id, item_id);
        assert_eq!(item.actual_count, Some(11));
    }

    #[test]
    fn test_find_stocktake_item_req205_converts_db_error_to_biz_error() {
        // REQ-205: 棚卸し（BIZ find_stocktake_item は DbError を BizError::DatabaseError に変換）
        let (_dir, conn) = setup_test_db();
        conn.execute("DROP TABLE products", []).unwrap();

        let result = find_stocktake_item(&conn, 1, "BROKEN");

        assert!(matches!(result, Err(BizError::DatabaseError(_))));
    }

    #[test]
    fn test_get_last_completed_stocktake_req205_passes_through_none() {
        // REQ-205: 棚卸し（BIZ get_last_completed_stocktake は完了済みなしを None で返す）
        let (_dir, conn) = setup_test_db();

        let result = get_last_completed_stocktake(&conn).unwrap();

        assert!(result.is_none());
    }

    #[test]
    fn test_get_last_completed_stocktake_req205_converts_db_error_to_biz_error() {
        // REQ-205: 棚卸し（BIZ get_last_completed_stocktake は DbError を BizError::DatabaseError に変換）
        let (_dir, conn) = setup_test_db();
        conn.execute("DROP TABLE stocktakes", []).unwrap();

        let result = get_last_completed_stocktake(&conn);

        assert!(matches!(result, Err(BizError::DatabaseError(_))));
    }

    // ===== get_stocktake_progress テスト =====

    #[test]
    fn test_get_progress_req205_normal() {
        // REQ-205: 棚卸し（進捗取得 — 正常）
        // BIZ-06 §20.6: 正常な進捗取得
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "PG-001", 10);
        seed_product(&conn, "PG-002", 5);
        seed_product(&conn, "PG-003", 3);
        let st_id = create_stocktake(&conn, "in_progress");
        seed_stocktake_item(&conn, st_id, "PG-001", 10, Some(10));
        seed_stocktake_item(&conn, st_id, "PG-002", 5, None);
        seed_stocktake_item(&conn, st_id, "PG-003", 3, Some(3));

        let progress = get_stocktake_progress(&conn, st_id).unwrap();
        assert_eq!(progress.stocktake_id, st_id);
        assert_eq!(progress.status, "in_progress");
        assert_eq!(progress.total_items, 3);
        assert_eq!(progress.counted_items, 2);
        assert_eq!(progress.uncounted_items, 1);
    }

    #[test]
    fn test_get_progress_req205_not_found() {
        // REQ-205: 棚卸し（進捗取得 — 存在しないID → NotFound）
        // BIZ-06 §20.6: 存在しないID → NotFound
        let (_dir, conn) = setup_test_db();
        let result = get_stocktake_progress(&conn, 9999);
        assert!(matches!(result, Err(BizError::NotFound(_))));
    }

    // ===== update_count テスト =====

    #[test]
    fn test_update_count_req205_normal() {
        // REQ-205: 棚卸し（カウント更新 — 正常 + 差異計算）
        // BIZ-06 §20.4: 正常なカウント更新 + 差異計算
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "UC-001", 10);
        let st_id = create_stocktake(&conn, "in_progress");
        let item_id = seed_stocktake_item(&conn, st_id, "UC-001", 10, None);

        let req = UpdateCountRequest {
            stocktake_item_id: item_id,
            actual_count: 8,
        };
        let result = update_count(&conn, &req).unwrap();
        assert!(result.success);
        assert_eq!(
            result.current_difference, 2,
            "stock_quantity(10) - actual_count(8) = 2"
        );
    }

    #[test]
    fn test_update_count_req205_negative() {
        // REQ-205: 棚卸し（カウント更新 — 負値 → ValidationFailed）
        // BIZ-06 §20.4: actual_count < 0 → ValidationFailed
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "UN-001", 10);
        let st_id = create_stocktake(&conn, "in_progress");
        let item_id = seed_stocktake_item(&conn, st_id, "UN-001", 10, None);

        let req = UpdateCountRequest {
            stocktake_item_id: item_id,
            actual_count: -1,
        };
        let result = update_count(&conn, &req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_update_count_req205_zero_is_valid() {
        // REQ-205: 棚卸し（カウント更新 — 0 は有効値）
        // BIZ-06 §20.4: actual_count = 0 は有効値（<= 0 誤実装の防止）
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "UZ-001", 5);
        let st_id = create_stocktake(&conn, "in_progress");
        let item_id = seed_stocktake_item(&conn, st_id, "UZ-001", 5, None);

        let req = UpdateCountRequest {
            stocktake_item_id: item_id,
            actual_count: 0,
        };
        let result = update_count(&conn, &req).unwrap();
        assert!(result.success);
        assert_eq!(result.current_difference, 5);
    }

    #[test]
    fn test_update_count_req205_item_not_found() {
        // REQ-205: 棚卸し（カウント更新 — 存在しないitem_id → NotFound）
        // BIZ-06 §20.4: 存在しないitem_id → NotFound
        let (_dir, conn) = setup_test_db();
        let req = UpdateCountRequest {
            stocktake_item_id: 9999,
            actual_count: 5,
        };
        let result = update_count(&conn, &req);
        assert!(matches!(result, Err(BizError::NotFound(_))));
    }

    #[test]
    fn test_update_count_req205_not_in_progress() {
        // REQ-205: 棚卸し（カウント更新 — 完了済み棚卸し → StocktakeNotInProgress）
        // BIZ-06 §20.4: 完了済み棚卸し → StocktakeNotInProgress
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "UNP-001", 10);
        let st_id = create_stocktake(&conn, "completed");
        let item_id = seed_stocktake_item(&conn, st_id, "UNP-001", 10, None);

        let req = UpdateCountRequest {
            stocktake_item_id: item_id,
            actual_count: 8,
        };
        let result = update_count(&conn, &req);
        assert!(matches!(result, Err(BizError::StocktakeNotInProgress(_))));
        if let Err(BizError::StocktakeNotInProgress(msg)) = result {
            assert!(
                msg.contains("既に完了"),
                "エラーメッセージに '既に完了' を含むべき: {}",
                msg
            );
        }
    }

    #[test]
    fn test_update_count_req205_dynamic_difference() {
        // REQ-205: 棚卸し（カウント更新 — 差異は現在のstock_quantityから動的計算）
        // BIZ-06 §20.4: 差異は現在のstock_quantityから動的計算
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "UD-001", 10);
        let st_id = create_stocktake(&conn, "in_progress");
        let item_id = seed_stocktake_item(&conn, st_id, "UD-001", 10, None);

        // stock_quantityを直接変更（CSV取込み等でstock_quantityが変わるケースをシミュレート）
        conn.execute(
            "UPDATE products SET stock_quantity = 15 WHERE product_code = 'UD-001'",
            [],
        )
        .unwrap();

        let req = UpdateCountRequest {
            stocktake_item_id: item_id,
            actual_count: 12,
        };
        let result = update_count(&conn, &req).unwrap();
        // current_difference = 現在のstock_quantity(15) - actual_count(12) = 3
        // system_stock(10) ではなく、現在値を使う
        assert_eq!(result.current_difference, 3);
    }

    // テストヘルパー: カスタム商品seed
    fn seed_product_custom(
        conn: &DbConnection,
        product_code: &str,
        is_discontinued: bool,
        stock_quantity: i64,
        cost_price: i64,
    ) {
        let product = NewProduct {
            product_code: product_code.to_string(),
            jan_code: None,
            name: format!("商品{}", product_code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity,
            stock_unit: "pcs".to_string(),
            is_discontinued,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(conn, &product).unwrap();
    }

    // ===== start_stocktake テスト =====

    #[test]
    fn test_start_stocktake_req205_normal() {
        // REQ-205: 棚卸し（棚卸し開始 — 正常開始 + item_count）
        // BIZ-06 §20.3: 正常開始 + item_count + system_stock値DB検証
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "SS-001", 10);
        seed_product(&conn, "SS-002", 5);

        let result = start_stocktake(&mut conn).unwrap();
        assert!(result.stocktake_id > 0);
        assert_eq!(result.item_count, 2);
        assert_eq!(result.auto_filled_count, 0);

        // DBクエリで stocktake_items を検証
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = ?1",
                rusqlite::params![result.stocktake_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_start_stocktake_req205_already_in_progress() {
        // REQ-205: 棚卸し（棚卸し開始 — 進行中あり → StocktakeInProgress）
        // BIZ-06 §20.3: 進行中あり → StocktakeInProgress
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "SAI-001", 10);

        start_stocktake(&mut conn).unwrap(); // 1回目
        let result = start_stocktake(&mut conn); // 2回目
        assert!(matches!(result, Err(BizError::StocktakeInProgress(_))));
    }

    #[test]
    fn test_start_stocktake_req205_no_eligible() {
        // REQ-205: 棚卸し（棚卸し開始 — 商品0件 → ValidationFailed）
        // BIZ-06 §20.3: 商品0件 → ValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let result = start_stocktake(&mut conn);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_start_stocktake_req205_auto_fill_discontinued() {
        // REQ-205: 棚卸し（棚卸し開始 — 廃番stock=0 auto-fill検証）
        // BIZ-06 §20.3 P2-1: 3パターンのauto-fill検証
        let (_dir, mut conn) = setup_test_db();
        seed_product_custom(&conn, "AD-001", false, 10, 300); // 通常
        seed_product_custom(&conn, "AD-002", true, 5, 200); // 廃番stock>0
        seed_product_custom(&conn, "AD-003", true, 0, 100); // 廃番stock=0

        let result = start_stocktake(&mut conn).unwrap();
        assert_eq!(result.item_count, 3, "全3商品が対象");
        assert_eq!(result.auto_filled_count, 1, "廃番stock=0のみauto-fill");

        // DBクエリで各アイテムの actual_count を検証
        let items: Vec<(String, Option<i64>)> = {
            let mut stmt = conn
                .prepare(
                    "SELECT product_code, actual_count FROM stocktake_items
                     WHERE stocktake_id = ?1 ORDER BY product_code",
                )
                .unwrap();
            stmt.query_map(rusqlite::params![result.stocktake_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?))
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
        };
        assert_eq!(items.len(), 3);
        assert_eq!(items[0], ("AD-001".to_string(), None), "通常: NULL");
        assert_eq!(items[1], ("AD-002".to_string(), None), "廃番stock>0: NULL");
        assert_eq!(items[2], ("AD-003".to_string(), Some(0)), "廃番stock=0: 0");
    }

    #[test]
    fn test_start_stocktake_req205_operation_log() {
        // REQ-205: 棚卸し（棚卸し開始 — operation_log記録）
        // BIZ-06 §20.3: operation_log記録確認
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "SOL-001", 10);

        start_stocktake(&mut conn).unwrap();

        let (op_type, summary): (String, String) = conn
            .query_row(
                "SELECT operation_type, summary FROM operation_logs ORDER BY id DESC LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(op_type, "stocktake_start");
        assert!(
            summary.contains("1件"),
            "summaryに件数を含むべき: {}",
            summary
        );
    }

    // テストヘルパー: start_stocktake + 全アイテムにカウント入力
    fn start_and_count_all(
        conn: &mut DbConnection,
        counts: &[(&str, i64)], // [(product_code, actual_count)]
    ) -> i64 {
        let result = start_stocktake(conn).unwrap();
        for (pc, count) in counts {
            let item_id: i64 = conn
                .query_row(
                    "SELECT id FROM stocktake_items WHERE stocktake_id = ?1 AND product_code = ?2",
                    rusqlite::params![result.stocktake_id, pc],
                    |row| row.get(0),
                )
                .unwrap();
            conn.execute(
                "UPDATE stocktake_items SET actual_count = ?1, counted_at = '2026-10-15T14:00:00' WHERE id = ?2",
                rusqlite::params![count, item_id],
            )
            .unwrap();
        }
        result.stocktake_id
    }

    // ===== complete_stocktake テスト =====

    #[test]
    fn test_complete_req205_normal_all_counted() {
        // REQ-205: 棚卸し（確定 — 全件入力済み、1件差異あり）
        // BIZ-06 §20.5: 全件入力済み、1件差異あり
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "CN-001", 10);
        seed_product(&conn, "CN-002", 5);
        let st_id = start_and_count_all(&mut conn, &[("CN-001", 8), ("CN-002", 5)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req).unwrap();
        assert_eq!(result.adjusted_items.len(), 1, "差異は1件（CN-001）");
        assert_eq!(result.adjusted_items[0].product_code, "CN-001");
        assert_eq!(result.adjusted_items[0].difference, 2); // 10 - 8
    }

    #[test]
    fn test_complete_req205_force_fill_true() {
        // REQ-205: 棚卸し（確定 — 未入力1件 + force_fill → 自動入力確定）
        // BIZ-06 §20.5: 未入力1件 + force_fill → 自動入力 + 確定
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "CF-001", 10);
        seed_product(&conn, "CF-002", 5);
        let st_id = start_and_count_all(&mut conn, &[("CF-001", 10)]);
        // CF-002 は未入力のまま

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: true,
        };
        let result = complete_stocktake(&mut conn, &req).unwrap();
        assert_eq!(result.total_items, 2);
    }

    #[test]
    fn test_complete_req205_force_fill_false_uncounted() {
        // REQ-205: 棚卸し（確定 — 未入力あり + force_fill=false → ValidationFailed）
        // BIZ-06 §20.5: 未入力あり + force_fill=false → ValidationFailed
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "CFF-001", 10);
        seed_product(&conn, "CFF-002", 5);
        let st_id = start_and_count_all(&mut conn, &[("CFF-001", 10)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_complete_req205_not_found() {
        // REQ-205: 棚卸し（確定 — 存在しないID → NotFound）
        // BIZ-06 §20.5: 存在しないID → NotFound
        let (_dir, mut conn) = setup_test_db();
        let req = CompleteStocktakeRequest {
            stocktake_id: 9999,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req);
        assert!(matches!(result, Err(BizError::NotFound(_))));
    }

    #[test]
    fn test_complete_req205_already_completed() {
        // REQ-205: 棚卸し（確定 — 完了済みへの二重確定 → StocktakeNotInProgress）
        // BIZ-06 §20.5: 完了済み → StocktakeNotInProgress
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "CAC-001", 10);
        let st_id = start_and_count_all(&mut conn, &[("CAC-001", 10)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        complete_stocktake(&mut conn, &req).unwrap(); // 1回目

        let result = complete_stocktake(&mut conn, &req); // 2回目
        assert!(matches!(result, Err(BizError::StocktakeNotInProgress(_))));
    }

    #[test]
    fn test_complete_req205_creates_movements() {
        // REQ-205: 棚卸し（確定 — 差異あり → inventory_movements生成）
        // BIZ-06 §20.5: 差異あり → inventory_movements の全6フィールド検証
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "CM-001", 10);
        let st_id = start_and_count_all(&mut conn, &[("CM-001", 7)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        complete_stocktake(&mut conn, &req).unwrap();

        let (mt, qty, sa, rt, ri, note): (String, i64, i64, Option<String>, Option<i64>, Option<String>) = conn
            .query_row(
                "SELECT movement_type, quantity, stock_after, reference_type, reference_id, note
                 FROM inventory_movements WHERE product_code = 'CM-001' AND movement_type = 'stocktake'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
            )
            .unwrap();
        assert_eq!(mt, "stocktake");
        assert_eq!(qty, -3, "7 - 10 = -3（在庫視点: 3減少）");
        assert_eq!(sa, 7, "stock_after = actual_count（INV-2）");
        assert_eq!(rt, Some("stocktake".to_string()));
        assert_eq!(ri, Some(st_id));
        assert!(
            note.unwrap().contains("システム在庫10"),
            "note に変更前在庫を含む"
        );
    }

    #[test]
    fn test_complete_req205_total_cost_multiple_products() {
        // REQ-205: 棚卸し（確定 — 複数商品のtotal_cost計算）
        // BIZ-06 §20.5: 複数商品のtotal_cost計算
        let (_dir, mut conn) = setup_test_db();
        seed_product_custom(&conn, "TC-001", false, 10, 500);
        seed_product_custom(&conn, "TC-002", false, 5, 1000);
        let st_id = start_and_count_all(&mut conn, &[("TC-001", 3), ("TC-002", 2)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req).unwrap();
        // 500*3 + 1000*2 = 3500
        assert_eq!(result.total_cost, 3500);
    }

    #[test]
    fn test_complete_req205_no_difference() {
        // REQ-205: 棚卸し（確定 — 全件差異なし → movements作成なし）
        // BIZ-06 §20.5: 全件差異なし → adjusted_items空、movements作成なし
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "ND-001", 10);
        seed_product(&conn, "ND-002", 5);
        let st_id = start_and_count_all(&mut conn, &[("ND-001", 10), ("ND-002", 5)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req).unwrap();
        assert!(result.adjusted_items.is_empty(), "差異なし");

        let mv_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'stocktake'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(mv_count, 0, "movements 作成なし");
    }

    #[test]
    fn test_complete_req205_stock_after_equals_actual() {
        // REQ-205: 棚卸し（確定 — stock_quantity = actual_count で更新）
        // BIZ-06 §20.5 INV-2: products.stock_quantity = actual_count
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "SA-001", 10);
        let st_id = start_and_count_all(&mut conn, &[("SA-001", 7)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        complete_stocktake(&mut conn, &req).unwrap();

        let stock: i64 = conn
            .query_row(
                "SELECT stock_quantity FROM products WHERE product_code = 'SA-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stock, 7, "stock_quantity = actual_count");
    }

    #[test]
    fn test_complete_req205_force_fill_sets_actual_to_system_stock() {
        // REQ-205: 棚卸し（確定 — force_fill後のactual_count = stock_quantity）
        // BIZ-06 §20.5: force_fill後のactual_countがstock_quantityと一致
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FF-001", 10);
        seed_product(&conn, "FF-002", 5);
        let result = start_stocktake(&mut conn).unwrap();
        // FF-001のみカウント、FF-002は未入力
        let item_id: i64 = conn
            .query_row(
                "SELECT id FROM stocktake_items WHERE stocktake_id = ?1 AND product_code = 'FF-001'",
                rusqlite::params![result.stocktake_id],
                |row| row.get(0),
            )
            .unwrap();
        conn.execute(
            "UPDATE stocktake_items SET actual_count = 10, counted_at = '2026-10-15T14:00:00' WHERE id = ?1",
            rusqlite::params![item_id],
        )
        .unwrap();

        let req = CompleteStocktakeRequest {
            stocktake_id: result.stocktake_id,
            force_fill: true,
        };
        complete_stocktake(&mut conn, &req).unwrap();

        // FF-002 の actual_count が stock_quantity(5) と一致
        let actual: i64 = conn
            .query_row(
                "SELECT actual_count FROM stocktake_items WHERE stocktake_id = ?1 AND product_code = 'FF-002'",
                rusqlite::params![result.stocktake_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(actual, 5, "force_fill: actual_count = stock_quantity");
    }

    #[test]
    fn test_complete_req205_total_cost_overflow() {
        // REQ-205: 棚卸し（確定 — total_costオーバーフロー → ValidationFailed）
        // BIZ-06 §20.5: オーバーフロー → ValidationFailed
        let (_dir, mut conn) = setup_test_db();
        seed_product_custom(&conn, "OV-001", false, 10, i64::MAX / 2 + 1);
        let st_id = start_and_count_all(&mut conn, &[("OV-001", 2)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req);
        assert!(
            matches!(result, Err(BizError::ValidationFailed(ref msg)) if msg.contains("オーバーフロー")),
            "オーバーフローでValidationFailed: {:?}",
            result
        );
    }

    #[test]
    fn test_complete_req205_operation_log() {
        // REQ-205: 棚卸し（確定 — operation_log記録確認）
        // BIZ-06 §20.5: operation_log記録確認
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "OL-001", 10);
        let st_id = start_and_count_all(&mut conn, &[("OL-001", 8)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        complete_stocktake(&mut conn, &req).unwrap();

        let (op_type, detail): (String, Option<String>) = conn
            .query_row(
                "SELECT operation_type, detail_json FROM operation_logs
                 WHERE operation_type = 'stocktake_complete' ORDER BY id DESC LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(op_type, "stocktake_complete");
        let detail = detail.unwrap();
        assert!(
            detail.contains("stocktake_id"),
            "detail_json に stocktake_id を含む"
        );
        assert!(
            detail.contains("total_cost"),
            "detail_json に total_cost を含む"
        );
        assert!(
            detail.contains("adjusted_count"),
            "detail_json に adjusted_count を含む"
        );
    }

    #[test]
    fn test_complete_req205_force_fill_negative_stock_clamped_to_zero() {
        // REQ-205: 棚卸し（確定 — 負在庫 + force_fill → actual_count=0 補正）
        // BIZ-06 §20.5 P3-7 + R-3: 負在庫の商品にforce_fill → actual_count=0
        let (_dir, mut conn) = setup_test_db();
        seed_product_custom(&conn, "NS-001", false, -3, 300);
        let result = start_stocktake(&mut conn).unwrap();
        // NS-001 は未入力のまま

        let req = CompleteStocktakeRequest {
            stocktake_id: result.stocktake_id,
            force_fill: true,
        };
        complete_stocktake(&mut conn, &req).unwrap();

        // actual_count は max(0, -3) = 0
        let actual: i64 = conn
            .query_row(
                "SELECT actual_count FROM stocktake_items WHERE stocktake_id = ?1 AND product_code = 'NS-001'",
                rusqlite::params![result.stocktake_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(actual, 0, "負在庫(-3)はmax(0)で0に補正される");

        // stock_quantity も 0 に更新（差異補正）
        let stock: i64 = conn
            .query_row(
                "SELECT stock_quantity FROM products WHERE product_code = 'NS-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stock, 0, "stock_quantity = actual_count = 0");
    }

    // ===== D-2統合テスト =====

    #[test]
    fn test_complete_stocktake_req205_includes_integrity_result() {
        // REQ-205: 棚卸し（確定 — IntegrityResult が返る）
        // BIZ-06 D-2: 確定後に IntegrityResult が返る
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "D2-001", 10);
        let st_id = start_and_count_all(&mut conn, &[("D2-001", 10)]);

        let req = CompleteStocktakeRequest {
            stocktake_id: st_id,
            force_fill: false,
        };
        let result = complete_stocktake(&mut conn, &req).unwrap();

        assert!(
            result.integrity_result.is_some(),
            "D-2: integrity_result が返るべき"
        );
        let ir = result.integrity_result.unwrap();
        assert!(ir.checked_count > 0, "checked_count > 0");
    }
}
