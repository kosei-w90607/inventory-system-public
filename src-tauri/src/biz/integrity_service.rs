//! BIZ-07: 整合性チェックロジック
//!
//! products.stock_quantity と inventory_movements の集計値を突合し、不整合を検出・補正する。
//! stock_quantity はキャッシュ値であり、movements の合計が真値。
//!
//! docs/function-design/36-biz-integrity-check.md に基づく実装。

use crate::biz::BizError;
use crate::db::{inventory_repo, product_repo, system_repo, DbConnection, NewOperationLog};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 整合性チェック結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct IntegrityResult {
    pub mismatches: Vec<IntegrityMismatch>,
    pub mismatch_count: usize,
    pub checked_count: usize,
}

/// 不整合アイテム
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct IntegrityMismatch {
    pub product_code: String,
    pub name: String,
    pub stock_quantity: i64,
    pub movements_sum: i64,
    pub difference: i64,
}

/// 整合性補正結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct IntegrityFixResult {
    pub fixed_count: usize,
    pub skipped_count: usize,
    pub adjustments: Vec<StockAdjustment>,
}

/// 在庫補正詳細
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct StockAdjustment {
    pub product_code: String,
    pub old_stock: i64,
    pub new_stock: i64,
    pub adjustment: i64,
}

// ---------------------------------------------------------------------------
// 関数
// ---------------------------------------------------------------------------

/// 全商品の整合性をチェックする（読み取り専用、TX不要）
///
/// 36-biz-integrity-check.md §21.3
pub fn run_integrity_check(conn: &DbConnection) -> Result<IntegrityResult, BizError> {
    // 1. 全商品の movements 集計を HashMap に変換
    let movements = inventory_repo::sum_movements_by_product(conn)?;
    let movements_map: HashMap<String, i64> = movements
        .into_iter()
        .map(|m| (m.product_code, m.movements_sum))
        .collect();

    // 2. 全商品の現在在庫を取得
    let products = product_repo::find_all_stock_quantities(conn)?;
    let checked_count = products.len();

    // 3. 突合
    let mut mismatches = Vec::new();
    for (product_code, name, stock_quantity) in &products {
        let movements_sum = movements_map
            .get(product_code.as_str())
            .copied()
            .unwrap_or(0);
        let difference = stock_quantity - movements_sum;
        if difference != 0 {
            mismatches.push(IntegrityMismatch {
                product_code: product_code.clone(),
                name: name.clone(),
                stock_quantity: *stock_quantity,
                movements_sum,
                difference,
            });
        }
    }

    let mismatch_count = mismatches.len();

    // 4. TX外: 操作ログ記録
    let detail = serde_json::json!({
        "checked_count": checked_count,
        "mismatch_count": mismatch_count,
        "mismatches": mismatches.iter().map(|m| {
            serde_json::json!({
                "product_code": m.product_code,
                "stock_quantity": m.stock_quantity,
                "movements_sum": m.movements_sum,
                "difference": m.difference,
            })
        }).collect::<Vec<_>>(),
    })
    .to_string();
    let log = NewOperationLog {
        operation_type: "integrity_check".to_string(),
        summary: format!(
            "整合性チェック実行: {}件中{}件の不整合",
            checked_count, mismatch_count
        ),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(IntegrityResult {
        mismatches,
        mismatch_count,
        checked_count,
    })
}

/// 指定商品の在庫を movements_sum に合わせて補正する（TX）
///
/// 36-biz-integrity-check.md §21.4
pub fn fix_integrity(
    conn: &mut DbConnection,
    product_codes: &[String],
) -> Result<IntegrityFixResult, BizError> {
    use crate::db::DbError;

    // 1. 入力バリデーション
    if product_codes.is_empty() {
        return Err(BizError::ValidationFailed(
            "補正対象の商品が指定されていません".to_string(),
        ));
    }

    // 2. TX開始
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 3. 各商品について補正
    let mut fixed_count = 0usize;
    let mut skipped_count = 0usize;
    let mut adjustments = Vec::new();

    for product_code in product_codes {
        // 3a. 個別 movements_sum 取得
        let movements_sum = inventory_repo::sum_movements_for_product(&tx, product_code)?;

        // 3b. 現在の商品を取得
        let product = match product_repo::find_by_product_code(&tx, product_code)? {
            Some(p) => p,
            None => {
                skipped_count += 1;
                continue;
            }
        };

        // 3c. 差異計算
        let stock_quantity = product.product.stock_quantity;
        let difference = stock_quantity - movements_sum;
        if difference == 0 {
            skipped_count += 1;
            continue;
        }

        // 3e. 補正実行（stock_quantity を movements_sum に合わせる）
        // 設計書からの逸脱: movement 挿入を行わない。
        // 理由: correction movement を追加すると movements_sum 自体が変わり、
        // 再チェック時に差異が残る（P1指摘）。audit trail は operation_logs で記録する。
        let adjustment = movements_sum - stock_quantity;
        inventory_repo::update_stock_quantity(&tx, product_code, movements_sum)?;

        adjustments.push(StockAdjustment {
            product_code: product_code.clone(),
            old_stock: stock_quantity,
            new_stock: movements_sum,
            adjustment,
        });
        fixed_count += 1;
    }

    // 4. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 5. TX外: 操作ログ記録
    let detail = serde_json::json!({
        "fixed_count": fixed_count,
        "skipped_count": skipped_count,
        "adjustments": adjustments.iter().map(|a| {
            serde_json::json!({
                "product_code": a.product_code,
                "old_stock": a.old_stock,
                "new_stock": a.new_stock,
                "adjustment": a.adjustment,
            })
        }).collect::<Vec<_>>(),
    })
    .to_string();
    let log = NewOperationLog {
        operation_type: "integrity_fix".to_string(),
        summary: format!("{}件の在庫を補正しました", fixed_count),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(IntegrityFixResult {
        fixed_count,
        skipped_count,
        adjustments,
    })
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::db::inventory_repo::{MovementType, NewMovement};
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

    fn add_movement(conn: &DbConnection, product_code: &str, quantity: i64) {
        inventory_repo::insert_movement(
            conn,
            &NewMovement {
                product_code: product_code.to_string(),
                movement_type: MovementType::Receiving,
                quantity,
                stock_after: quantity,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();
    }

    // ===== run_integrity_check テスト =====

    #[test]
    fn test_run_integrity_check_req904_all_consistent() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.3: 全件一致 → mismatches空
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "IC-001", 10);
        add_movement(&conn, "IC-001", 10);

        let result = run_integrity_check(&conn).unwrap();
        assert_eq!(result.checked_count, 1);
        assert_eq!(result.mismatch_count, 0);
        assert!(result.mismatches.is_empty());
    }

    #[test]
    fn test_run_integrity_check_req904_mismatch_detected() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.3: 差異あり → mismatches返却
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "IM-001", 10); // stock=10
        add_movement(&conn, "IM-001", 7); // movements=7 → 差異3

        let result = run_integrity_check(&conn).unwrap();
        assert_eq!(result.mismatch_count, 1);
        let m = &result.mismatches[0];
        assert_eq!(m.product_code, "IM-001");
        assert_eq!(m.stock_quantity, 10);
        assert_eq!(m.movements_sum, 7);
        assert_eq!(m.difference, 3);
    }

    #[test]
    fn test_run_integrity_check_req904_no_movements_product() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.3: movements 0件 → movements_sum=0として扱い
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "NM-001", 5); // stock=5, movements=0

        let result = run_integrity_check(&conn).unwrap();
        assert_eq!(result.mismatch_count, 1);
        assert_eq!(result.mismatches[0].movements_sum, 0);
        assert_eq!(result.mismatches[0].difference, 5);
    }

    #[test]
    fn test_run_integrity_check_req904_operation_log() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.3: 操作ログ記録確認
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "OL-001", 10);
        add_movement(&conn, "OL-001", 10);

        run_integrity_check(&conn).unwrap();

        let op_type: String = conn
            .query_row(
                "SELECT operation_type FROM operation_logs ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(op_type, "integrity_check");
    }

    #[test]
    fn test_run_integrity_check_req904_empty_db() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.3: 商品0件 → checked_count=0
        let (_dir, conn) = setup_test_db();
        let result = run_integrity_check(&conn).unwrap();
        assert_eq!(result.checked_count, 0);
        assert_eq!(result.mismatch_count, 0);
    }

    // ===== fix_integrity テスト =====

    #[test]
    fn test_fix_integrity_req904_normal() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4: 差異あり → 補正実行
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FI-001", 10);
        add_movement(&conn, "FI-001", 7); // movements=7, stock=10

        let result = fix_integrity(&mut conn, &["FI-001".to_string()]).unwrap();
        assert_eq!(result.fixed_count, 1);
        assert_eq!(result.adjustments[0].old_stock, 10);
        assert_eq!(result.adjustments[0].new_stock, 7);

        // DB検証: stock_quantity = movements_sum
        let stock: i64 = conn
            .query_row(
                "SELECT stock_quantity FROM products WHERE product_code = 'FI-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stock, 7);
    }

    #[test]
    fn test_fix_integrity_req904_empty_codes() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4: 空配列 → ValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let result = fix_integrity(&mut conn, &[]);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_fix_integrity_req904_product_not_found() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4: 存在しない商品 → スキップ
        let (_dir, mut conn) = setup_test_db();
        let result = fix_integrity(&mut conn, &["NONEXISTENT".to_string()]).unwrap();
        assert_eq!(result.fixed_count, 0);
        assert_eq!(result.skipped_count, 1);
    }

    #[test]
    fn test_fix_integrity_req904_no_difference() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4: 差異なし → スキップ
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FN-001", 10);
        add_movement(&conn, "FN-001", 10);

        let result = fix_integrity(&mut conn, &["FN-001".to_string()]).unwrap();
        assert_eq!(result.fixed_count, 0);
        assert_eq!(result.skipped_count, 1);
    }

    #[test]
    fn test_fix_integrity_req904_recheck_consistent() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4 P1修正: 補正後に再チェックで不整合0件
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FM-001", 10);
        add_movement(&conn, "FM-001", 7);

        // 1回目: 不整合検出
        let check1 = run_integrity_check(&conn).unwrap();
        assert_eq!(check1.mismatch_count, 1);

        // 補正実行
        fix_integrity(&mut conn, &["FM-001".to_string()]).unwrap();

        // 2回目: 不整合なし
        let check2 = run_integrity_check(&conn).unwrap();
        assert_eq!(check2.mismatch_count, 0, "補正後は不整合0件であるべき");
    }

    #[test]
    fn test_fix_integrity_req904_multiple_products() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4: 複数商品の一括補正
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FMU-001", 10);
        seed_product(&conn, "FMU-002", 5);
        add_movement(&conn, "FMU-001", 8);
        add_movement(&conn, "FMU-002", 3);

        let result =
            fix_integrity(&mut conn, &["FMU-001".to_string(), "FMU-002".to_string()]).unwrap();
        assert_eq!(result.fixed_count, 2);
        assert_eq!(result.adjustments.len(), 2);
    }

    #[test]
    fn test_fix_integrity_req904_operation_log() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4: 操作ログ記録確認
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FOL-001", 10);
        add_movement(&conn, "FOL-001", 7);

        fix_integrity(&mut conn, &["FOL-001".to_string()]).unwrap();

        let op_type: String = conn
            .query_row(
                "SELECT operation_type FROM operation_logs
                 WHERE operation_type = 'integrity_fix' ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(op_type, "integrity_fix");
    }

    #[test]
    fn test_fix_integrity_req904_negative_movements_sum() {
        // REQ-904: 整合性チェック（在庫数突合/修復）
        // BIZ-07 §21.4 P3-2: 負のmovements_sum → stock_quantityを負に補正（INV-3準拠）
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "FNG-001", 5);
        // movements: +10, -13 = -3
        add_movement(&conn, "FNG-001", 10);
        inventory_repo::insert_movement(
            &conn,
            &NewMovement {
                product_code: "FNG-001".to_string(),
                movement_type: MovementType::SaleAuto,
                quantity: -13,
                stock_after: -3,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();

        let result = fix_integrity(&mut conn, &["FNG-001".to_string()]).unwrap();
        assert_eq!(result.fixed_count, 1);
        assert_eq!(result.adjustments[0].new_stock, -3);

        let stock: i64 = conn
            .query_row(
                "SELECT stock_quantity FROM products WHERE product_code = 'FNG-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stock, -3, "負のmovements_sumに合わせる");
    }
}
