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

        // 3e. D-051 / BIZ-07-D2: movement を追加せず、派生 cache を原本の合計へ直接補正する。
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

    // 4. TX内: 操作ログ記録（BIZ-07-D3、失敗時は補正ごと rollback）
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
    system_repo::insert_operation_log(&tx, &log)?;

    // 5. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

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

    fn add_voided_movement(conn: &DbConnection, product_code: &str, quantity: i64) {
        let movement_id = inventory_repo::insert_movement(
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
        conn.execute(
            "UPDATE inventory_movements SET is_voided = 1 WHERE id = ?1",
            [movement_id],
        )
        .unwrap();
    }

    fn stock_quantity(conn: &DbConnection, product_code: &str) -> i64 {
        conn.query_row(
            "SELECT stock_quantity FROM products WHERE product_code = ?1",
            [product_code],
            |row| row.get(0),
        )
        .unwrap()
    }

    fn movement_count(conn: &DbConnection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM inventory_movements", [], |row| {
            row.get(0)
        })
        .unwrap()
    }

    #[derive(Debug, PartialEq, Eq)]
    struct MovementSnapshot {
        id: i64,
        product_code: String,
        movement_type: String,
        quantity: i64,
        stock_after: i64,
        reference_type: Option<String>,
        reference_id: Option<i64>,
        note: Option<String>,
        is_voided: bool,
        created_at: String,
    }

    fn movement_snapshot(conn: &DbConnection) -> Vec<MovementSnapshot> {
        let mut stmt = conn
            .prepare(
                "SELECT id, product_code, movement_type, quantity, stock_after,
                        reference_type, reference_id, note, is_voided, created_at
                 FROM inventory_movements ORDER BY id",
            )
            .unwrap();
        stmt.query_map([], |row| {
            Ok(MovementSnapshot {
                id: row.get(0)?,
                product_code: row.get(1)?,
                movement_type: row.get(2)?,
                quantity: row.get(3)?,
                stock_after: row.get(4)?,
                reference_type: row.get(5)?,
                reference_id: row.get(6)?,
                note: row.get(7)?,
                is_voided: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap()
    }

    fn product_snapshot(
        conn: &DbConnection,
        product_code: &str,
    ) -> (serde_json::Value, i64, String) {
        let product = product_repo::find_by_product_code(conn, product_code)
            .unwrap()
            .unwrap()
            .product;
        let stock_quantity = product.stock_quantity;
        let updated_at = product.updated_at.clone();
        let mut invariant_columns = serde_json::to_value(product).unwrap();
        let invariant_columns = invariant_columns.as_object_mut().unwrap();
        invariant_columns.remove("stock_quantity");
        invariant_columns.remove("updated_at");
        (
            serde_json::Value::Object(invariant_columns.clone()),
            stock_quantity,
            updated_at,
        )
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
    fn test_fix_integrity_req904_t1_log_insert_failure() {
        // REQ-904 / BIZ-07-D3 / T1: 操作ログ失敗時は全補正をロールバックする
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "T1-A", 10);
        seed_product(&conn, "T1-B", 3);
        add_movement(&conn, "T1-A", 7);
        add_movement(&conn, "T1-B", 8);
        let stocks_before = [stock_quantity(&conn, "T1-A"), stock_quantity(&conn, "T1-B")];
        let movements_before = movement_count(&conn);
        conn.execute_batch(
            "CREATE TRIGGER fail_integrity_fix_log
             BEFORE INSERT ON operation_logs
             WHEN NEW.operation_type = 'integrity_fix'
             BEGIN
                 SELECT RAISE(ABORT, 'synthetic integrity_fix log failure');
             END;",
        )
        .unwrap();

        let result = fix_integrity(&mut conn, &["T1-A".to_string(), "T1-B".to_string()]);

        assert!(matches!(result, Err(BizError::DatabaseError(_))));
        assert_eq!(
            [stock_quantity(&conn, "T1-A"), stock_quantity(&conn, "T1-B"),],
            stocks_before
        );
        assert_eq!(movement_count(&conn), movements_before);
    }

    #[test]
    fn test_fix_integrity_req904_t2_audit_detail_and_skips() {
        // REQ-904 / BIZ-07-D3 / INV-4 / T2: 具体値の監査ログと skipped 契約
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "T2-DOWN", 10);
        seed_product(&conn, "T2-UP", 3);
        seed_product(&conn, "T2-VOID", 6);
        seed_product(&conn, "T2-ZERO", 5);
        seed_product(&conn, "T2-SAME", 2);
        add_movement(&conn, "T2-DOWN", 7);
        add_movement(&conn, "T2-UP", 8);
        add_movement(&conn, "T2-VOID", 4);
        add_voided_movement(&conn, "T2-VOID", 100);
        add_movement(&conn, "T2-SAME", 2);

        let result = fix_integrity(
            &mut conn,
            &[
                "T2-DOWN".to_string(),
                "T2-UP".to_string(),
                "T2-VOID".to_string(),
                "T2-ZERO".to_string(),
                "T2-SAME".to_string(),
                "T2-MISSING".to_string(),
            ],
        )
        .unwrap();

        assert_eq!(result.fixed_count, 4);
        assert_eq!(result.skipped_count, 2);
        let (log_count, detail_json): (i64, String) = conn
            .query_row(
                "SELECT COUNT(*), detail_json FROM operation_logs
                 WHERE operation_type = 'integrity_fix'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(log_count, 1);
        let detail: serde_json::Value = serde_json::from_str(&detail_json).unwrap();
        assert_eq!(detail["fixed_count"], serde_json::json!(4));
        assert_eq!(detail["skipped_count"], serde_json::json!(2));
        assert_eq!(
            detail["adjustments"],
            serde_json::json!([
                {"product_code": "T2-DOWN", "old_stock": 10, "new_stock": 7, "adjustment": -3},
                {"product_code": "T2-UP", "old_stock": 3, "new_stock": 8, "adjustment": 5},
                {"product_code": "T2-VOID", "old_stock": 6, "new_stock": 4, "adjustment": -2},
                {"product_code": "T2-ZERO", "old_stock": 5, "new_stock": 0, "adjustment": -5}
            ])
        );
    }

    #[test]
    fn test_fix_integrity_req904_t3_movements_and_products_unchanged() {
        // REQ-904 / BIZ-07-D2 / INV-8 / T3: movement 原本と product 行を破壊しない
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "T3-A", 10);
        seed_product(&conn, "T3-B", 3);
        add_movement(&conn, "T3-A", 7);
        add_movement(&conn, "T3-B", 8);
        add_voided_movement(&conn, "T3-B", 20);
        let movements_before = movement_snapshot(&conn);
        let movement_count_before = movement_count(&conn);
        let products_before = [
            ("T3-A", product_snapshot(&conn, "T3-A"), 7),
            ("T3-B", product_snapshot(&conn, "T3-B"), 8),
        ];

        fix_integrity(&mut conn, &["T3-A".to_string(), "T3-B".to_string()]).unwrap();

        assert_eq!(movement_count(&conn), movement_count_before);
        assert_eq!(movement_snapshot(&conn), movements_before);
        for (product_code, (invariant_before, stock_before, updated_at_before), expected_stock) in
            products_before
        {
            let per_product_before = movements_before
                .iter()
                .filter(|movement| movement.product_code == product_code)
                .count() as i64;
            let per_product_after: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM inventory_movements WHERE product_code = ?1",
                    [product_code],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(per_product_after, per_product_before);

            let (invariant_after, stock_after, updated_at_after) =
                product_snapshot(&conn, product_code);
            assert_eq!(stock_after, expected_stock, "{product_code}");
            assert_ne!(stock_after, stock_before, "{product_code}");
            assert!(updated_at_after >= updated_at_before, "{product_code}");
            assert_eq!(invariant_after, invariant_before, "{product_code}");
        }
    }

    #[test]
    fn test_fix_integrity_req904_t4_recheck_converges() {
        // REQ-904 / BIZ-07-D4 / T4: 成功直後は補正対象が mismatch に現れない
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "T4-A", 10);
        seed_product(&conn, "T4-B", 3);
        add_movement(&conn, "T4-A", 7);
        add_movement(&conn, "T4-B", 8);

        let fixed = fix_integrity(&mut conn, &["T4-A".to_string(), "T4-B".to_string()]).unwrap();
        let rechecked = run_integrity_check(&conn).unwrap();

        for adjustment in fixed.adjustments {
            assert!(rechecked
                .mismatches
                .iter()
                .all(|mismatch| mismatch.product_code != adjustment.product_code));
        }
    }

    #[test]
    fn test_fix_integrity_req904_t5_stock_equals_non_voided_sum() {
        // REQ-904 / BIZ-07-D1 / INV-4 / T5: DB の派生関係を SQL で直接検査する
        let (_dir, mut conn) = setup_test_db();
        seed_product(&conn, "T5-MOVED", 10);
        seed_product(&conn, "T5-ZERO", 5);
        add_movement(&conn, "T5-MOVED", 7);
        add_voided_movement(&conn, "T5-MOVED", 100);

        fix_integrity(&mut conn, &["T5-MOVED".to_string(), "T5-ZERO".to_string()]).unwrap();

        for product_code in ["T5-MOVED", "T5-ZERO"] {
            let (stock, movements_sum): (i64, i64) = conn
                .query_row(
                    "SELECT p.stock_quantity,
                            COALESCE((SELECT SUM(im.quantity)
                                      FROM inventory_movements im
                                      WHERE im.product_code = p.product_code
                                        AND im.is_voided = 0), 0)
                     FROM products p WHERE p.product_code = ?1",
                    [product_code],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            assert_eq!(stock, movements_sum, "{product_code}");
        }
    }

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
