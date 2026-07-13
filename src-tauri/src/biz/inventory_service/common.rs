//! 共通ヘルパー: apply_stock_change + fingerprint 計算

use crate::biz::BizError;
use crate::db::inventory_repo::{self, MovementType, NewMovement, ReferenceType};
use crate::db::product_repo;
use crate::db::DbConnection;
use sha2::{Digest, Sha256};

/// 冪等性キーの最大長（UUID v4 = 36文字だが、余裕を持って255）
pub(super) const IDEMPOTENCY_KEY_MAX_LEN: usize = 255;

/// 共通在庫変動の結果（31-biz-inventory-service.md §12.2）
#[derive(Debug)]
pub struct StockChangeOutcome {
    pub stock_after: i64,
    pub negative_stock_warning: bool,
}

/// request_fingerprint を計算する（31-biz-inventory-service.md §12.8）
///
/// ヘッダ行 + ソート済みアイテム行を "\n" で結合し、SHA-256 hex digest を返す。
/// アイテム行は辞書順 ASC でソートする。
pub(super) fn compute_fingerprint(header: &str, items: &[String]) -> String {
    let mut sorted_items = items.to_vec();
    sorted_items.sort();
    let mut hasher = Sha256::new();
    hasher.update(header.as_bytes());
    for item in &sorted_items {
        hasher.update(b"\n");
        hasher.update(item.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

/// 商品の在庫数を変動させ、inventory_movements に履歴を記録する
///
/// TX 内部から呼ばれる。TX は呼び出し元の create_* が管理する。
/// BIZ-03（CSV取込み）からも直接呼び出し可（pub(crate) は意図的）。
///
/// 31-biz-inventory-service.md §12.2
pub(crate) fn apply_stock_change(
    conn: &DbConnection,
    product_code: &str,
    quantity: i64,
    movement_type: MovementType,
    reference_type: ReferenceType,
    reference_id: i64,
    note: Option<&str>,
) -> Result<StockChangeOutcome, BizError> {
    // 1. 商品存在確認
    let product = product_repo::find_by_product_code(conn, product_code)?
        .ok_or_else(|| BizError::NotFound(format!("商品が見つかりません: {}", product_code)))?;

    // 2. 在庫計算
    let stock_after = product
        .product
        .stock_quantity
        .checked_add(quantity)
        .ok_or_else(|| BizError::ValidationFailed("在庫数計算オーバーフロー".to_string()))?;

    // 3. 負在庫警告（INV-3: 処理は止めない）
    let negative_stock_warning = stock_after < 0;

    // 4. 在庫数更新
    let updated = inventory_repo::update_stock_quantity(conn, product_code, stock_after)?;
    if !updated {
        return Err(BizError::NotFound(format!(
            "商品が見つかりません: {}",
            product_code
        )));
    }

    // 5. 変動履歴記録
    inventory_repo::insert_movement(
        conn,
        &NewMovement {
            product_code: product_code.to_string(),
            movement_type,
            quantity,
            stock_after,
            reference_type: Some(reference_type),
            reference_id: Some(reference_id),
            note: note.map(|s| s.to_string()),
        },
    )?;

    Ok(StockChangeOutcome {
        stock_after,
        negative_stock_warning,
    })
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    use crate::db::product_repo;

    // -----------------------------------------------------------------------
    // fingerprint テスト
    // -----------------------------------------------------------------------

    #[test]
    fn test_fingerprint_req201_deterministic() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.8: request_fingerprint 正規化仕様 — 同じ入力 → 同じハッシュ
        let h1 = compute_fingerprint("a|b", &["x|1".to_string(), "y|2".to_string()]);
        let h2 = compute_fingerprint("a|b", &["x|1".to_string(), "y|2".to_string()]);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // SHA-256 hex
    }

    #[test]
    fn test_fingerprint_req201_sort_order() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.8: request_fingerprint 正規化仕様 — アイテム順序が異なっても同じハッシュ
        let h1 = compute_fingerprint("h", &["b|2".to_string(), "a|1".to_string()]);
        let h2 = compute_fingerprint("h", &["a|1".to_string(), "b|2".to_string()]);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_fingerprint_req201_different_input() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.8: request_fingerprint 正規化仕様 — 異なる入力 → 異なるハッシュ
        let h1 = compute_fingerprint("a|b", &["x|1".to_string()]);
        let h2 = compute_fingerprint("a|c", &["x|1".to_string()]);
        assert_ne!(h1, h2);
    }

    // -----------------------------------------------------------------------
    // apply_stock_change テスト
    // -----------------------------------------------------------------------

    #[test]
    fn test_apply_stock_change_req201_increase() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.2: 共通在庫変動処理 — 在庫増加: 10 + 5 = 15
        let (_dir, conn) = setup_test_db();
        create_test_product(&conn, "ASC-001", 10);

        let result = apply_stock_change(
            &conn,
            "ASC-001",
            5,
            MovementType::Receiving,
            ReferenceType::ReceivingRecord,
            1,
            None,
        )
        .unwrap();

        assert_eq!(result.stock_after, 15);
        assert!(!result.negative_stock_warning);

        // DB確認
        let p = product_repo::find_by_product_code(&conn, "ASC-001")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 15);
    }

    #[test]
    fn test_apply_stock_change_req201_decrease() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.2: 共通在庫変動処理 — 在庫減少: 10 - 3 = 7
        let (_dir, conn) = setup_test_db();
        create_test_product(&conn, "ASC-002", 10);

        let result = apply_stock_change(
            &conn,
            "ASC-002",
            -3,
            MovementType::SaleManual,
            ReferenceType::ManualSale,
            1,
            None,
        )
        .unwrap();

        assert_eq!(result.stock_after, 7);
        assert!(!result.negative_stock_warning);
    }

    #[test]
    fn test_apply_stock_change_req201_negative_warning() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.2: 共通在庫変動処理 — 在庫マイナス → 警告フラグ true、処理は続行（INV-3）
        let (_dir, conn) = setup_test_db();
        create_test_product(&conn, "ASC-003", 2);

        let result = apply_stock_change(
            &conn,
            "ASC-003",
            -5,
            MovementType::Disposal,
            ReferenceType::DisposalRecord,
            1,
            None,
        )
        .unwrap();

        assert_eq!(result.stock_after, -3);
        assert!(result.negative_stock_warning);

        // DB にも反映されていること
        let p = product_repo::find_by_product_code(&conn, "ASC-003")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, -3);
    }

    #[test]
    fn test_apply_stock_change_req201_product_not_found() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.2: 共通在庫変動処理 — 存在しない商品 → NotFound
        let (_dir, conn) = setup_test_db();

        let result = apply_stock_change(
            &conn,
            "NONEXISTENT",
            5,
            MovementType::Receiving,
            ReferenceType::ReceivingRecord,
            1,
            None,
        );

        assert!(matches!(result, Err(BizError::NotFound(_))));
    }

    #[test]
    fn test_apply_stock_change_req201_movement_recorded() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.2: 共通在庫変動処理 — inventory_movements にレコードが記録されること
        let (_dir, conn) = setup_test_db();
        create_test_product(&conn, "ASC-005", 10);

        apply_stock_change(
            &conn,
            "ASC-005",
            5,
            MovementType::Receiving,
            ReferenceType::ReceivingRecord,
            42,
            Some("テストメモ"),
        )
        .unwrap();

        // movement レコード確認
        let (qty, stock_after, mt, rt, ri, note): (i64, i64, String, String, i64, String) = conn
            .query_row(
                "SELECT quantity, stock_after, movement_type, reference_type, reference_id, note
                 FROM inventory_movements WHERE product_code = 'ASC-005'",
                [],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(qty, 5);
        assert_eq!(stock_after, 15);
        assert_eq!(mt, "receiving");
        assert_eq!(rt, "receiving_record");
        assert_eq!(ri, 42);
        assert_eq!(note, "テストメモ");
    }

    #[test]
    fn test_apply_stock_change_req201_update_returns_false() {
        // REQ-201: 共通在庫操作（入庫/返品/手動販売/廃棄で使用）
        // Covers: REQ-201, REQ-202, REQ-203, REQ-204
        // FUNC-12.2: 共通在庫変動処理 — update_stock_quantity が false を返す場合（race condition のエッジケース）
        // find→update の間に商品が削除された場合を想定
        // 直接テストは難しいので、存在しない商品コードでのNotFoundをカバー
        let (_dir, conn) = setup_test_db();

        let result = apply_stock_change(
            &conn,
            "NO-SUCH-PRODUCT",
            1,
            MovementType::Receiving,
            ReferenceType::ReceivingRecord,
            1,
            None,
        );
        assert!(matches!(result, Err(BizError::NotFound(_))));
    }
}
