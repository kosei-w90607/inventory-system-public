//! CMD-06: 在庫照会コマンド群
//!
//! 44-cmd-inventory.md §23.8 に基づく実装。

use crate::biz::{
    inventory_service, product_service, MovementQuery, MovementRecord, PaginatedResult,
    ProductWithRelations, StockDetail,
};
use crate::cmd::{AppState, CmdError};
use tauri::State;

/// 商品の在庫詳細を取得する（最終入庫日・最終販売日を含む）
///
/// 44-cmd-inventory.md §23.8 get_stock_detail
#[tauri::command]
#[specta::specta]
pub fn get_stock_detail(
    state: State<AppState>,
    product_code: String,
) -> Result<StockDetail, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::get_stock_detail(&conn, &product_code).map_err(CmdError::from)
}

/// 在庫が閾値以下の商品を一覧取得する
///
/// 44-cmd-inventory.md §23.8 list_low_stock
#[tauri::command]
#[specta::specta]
pub fn list_low_stock(
    state: State<AppState>,
    include_discontinued: bool,
) -> Result<Vec<ProductWithRelations>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::list_low_stock(&conn, include_discontinued).map_err(CmdError::from)
}

/// 商品別の在庫変動履歴をフィルタ付きでページング取得する
///
/// 44-cmd-inventory.md §23.8 list_movements
#[tauri::command]
#[specta::specta]
pub fn list_movements(
    state: State<AppState>,
    query: MovementQuery,
) -> Result<PaginatedResult<MovementRecord>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    inventory_service::list_movements(&conn, &query).map_err(CmdError::from)
}

#[cfg(test)]
mod tests {
    use crate::biz::BizError;
    use crate::cmd::CmdError;
    use crate::db;

    fn setup_db() -> db::DbConnection {
        let conn = db::init_database(":memory:").unwrap();
        db::migration::migrate(&conn).unwrap();
        conn
    }

    /// get_stock_detail: 存在しない商品 → BizError::NotFound → CmdError { kind: "not_found" }
    #[test]
    fn test_get_stock_detail_req301_not_found() {
        // REQ-301: 商品別在庫照会
        let conn = setup_db();
        let err = crate::biz::product_service::get_stock_detail(&conn, "NONEXISTENT").unwrap_err();
        let cmd_err: CmdError = err.into();
        assert_eq!(cmd_err.kind, "not_found");
    }

    /// list_low_stock: デフォルト閾値で空テーブル → 空Vec
    #[test]
    fn test_list_low_stock_req302_empty() {
        // REQ-302: 在庫少一覧
        let conn = setup_db();
        let result = crate::biz::product_service::list_low_stock(&conn, false).unwrap();
        assert!(result.is_empty());
    }

    /// list_movements: BIZ経由の統合テスト（空テーブル）
    #[test]
    fn test_list_movements_req303_empty() {
        // REQ-303: 在庫変動履歴
        let conn = setup_db();
        let query = crate::biz::MovementQuery {
            product_code: "TEST-001".to_string(),
            date_from: None,
            date_to: None,
            movement_type: None,
            page: 1,
            per_page: 20,
        };
        let result = crate::biz::inventory_service::list_movements(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert!(result.items.is_empty());
    }

    /// list_movements: per_page > 100 → ValidationFailed
    #[test]
    fn test_list_movements_req303_per_page_exceeds_max() {
        // REQ-303: 在庫変動履歴
        let conn = setup_db();
        let query = crate::biz::MovementQuery {
            product_code: "TEST-001".to_string(),
            date_from: None,
            date_to: None,
            movement_type: None,
            page: 1,
            per_page: 101,
        };
        let err = crate::biz::inventory_service::list_movements(&conn, &query).unwrap_err();
        match err {
            BizError::ValidationFailed(_) => {}
            _ => panic!("expected ValidationFailed, got {:?}", err),
        }
    }

    // -----------------------------------------------------------------------
    // データ投入込みの統合テスト
    // -----------------------------------------------------------------------

    fn seed_product_with_stock(conn: &db::DbConnection, code: &str, stock: i64, unit: &str) {
        let product = crate::db::product_repo::NewProduct {
            product_code: code.to_string(),
            jan_code: None,
            name: format!("テスト商品_{}", code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: stock,
            stock_unit: unit.to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        crate::db::product_repo::insert_product(conn, &product).unwrap();
    }

    fn insert_movement(conn: &db::DbConnection, code: &str, mt: &str, qty: i64, is_voided: bool) {
        conn.execute(
            "INSERT INTO inventory_movements \
             (product_code, movement_type, quantity, stock_after, is_voided, created_at) \
             VALUES (?1, ?2, ?3, 0, ?4, '2026-03-15T10:00:00')",
            rusqlite::params![code, mt, qty, is_voided as i32],
        )
        .unwrap();
    }

    /// get_stock_detail: 商品存在時に最終入庫日・最終販売日を返す
    #[test]
    fn test_get_stock_detail_req301_with_data() {
        // REQ-301: 商品別在庫照会
        let conn = setup_db();
        seed_product_with_stock(&conn, "SD-001", 10, "pcs");
        // 入庫記録
        conn.execute(
            "INSERT INTO receiving_records (idempotency_key, request_fingerprint, supplier_id, receiving_date, note, created_at) \
             VALUES ('test-key-1', 'fp1', NULL, '2026-03-20', NULL, '2026-03-20T10:00:00')",
            [],
        )
        .unwrap();
        let rec_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO receiving_items (receiving_record_id, product_code, quantity, cost_price) \
             VALUES (?1, 'SD-001', 5, 300)",
            rusqlite::params![rec_id],
        )
        .unwrap();
        // 売上記録
        conn.execute(
            "INSERT INTO sale_records (product_code, sale_date, quantity, amount, source, is_voided, created_at) \
             VALUES ('SD-001', '2026-03-22', 2, 1000, 'auto', 0, '2026-03-22T19:00:00')",
            [],
        )
        .unwrap();

        let detail = crate::biz::product_service::get_stock_detail(&conn, "SD-001").unwrap();
        assert_eq!(detail.product.product.product_code, "SD-001");
        assert_eq!(detail.last_receiving_date, Some("2026-03-20".to_string()));
        assert_eq!(detail.last_sale_date, Some("2026-03-22".to_string()));
    }

    /// list_low_stock: pcs/cm閾値分岐テスト
    #[test]
    fn test_list_low_stock_req302_threshold_branching() {
        // REQ-302: 在庫少一覧
        let conn = setup_db();
        // pcs商品: stock=2（閾値3以下 → ヒット）
        seed_product_with_stock(&conn, "LS-PCS", 2, "pcs");
        // cm商品: stock=300（閾値500以下 → ヒット）
        seed_product_with_stock(&conn, "LS-CM", 300, "cm");
        // pcs商品: stock=10（閾値3超 → ヒットしない）
        seed_product_with_stock(&conn, "LS-OK", 10, "pcs");

        let result = crate::biz::product_service::list_low_stock(&conn, false).unwrap();
        assert_eq!(result.len(), 2);
        let codes: Vec<&str> = result
            .iter()
            .map(|p| p.product.product_code.as_str())
            .collect();
        assert!(codes.contains(&"LS-PCS"));
        assert!(codes.contains(&"LS-CM"));
        assert!(!codes.contains(&"LS-OK"));
    }

    /// list_low_stock: include_discontinued=false で廃番除外
    #[test]
    fn test_list_low_stock_req302_exclude_discontinued() {
        // REQ-302: 在庫少一覧
        let conn = setup_db();
        seed_product_with_stock(&conn, "LS-ACT", 1, "pcs");
        seed_product_with_stock(&conn, "LS-DIS", 1, "pcs");
        conn.execute(
            "UPDATE products SET is_discontinued = 1 WHERE product_code = 'LS-DIS'",
            [],
        )
        .unwrap();

        let result = crate::biz::product_service::list_low_stock(&conn, false).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].product.product_code, "LS-ACT");

        // include_discontinued=true で廃番も含む
        let result = crate::biz::product_service::list_low_stock(&conn, true).unwrap();
        assert_eq!(result.len(), 2);
    }

    /// list_movements: is_voided=0 フィルタ（voided行は除外される）
    #[test]
    fn test_list_movements_req303_voided_excluded() {
        // REQ-303: 在庫変動履歴
        let conn = setup_db();
        seed_product_with_stock(&conn, "MV-001", 10, "pcs");
        insert_movement(&conn, "MV-001", "receiving", 5, false);
        insert_movement(&conn, "MV-001", "sale_auto", -2, true); // voided

        let query = crate::biz::MovementQuery {
            product_code: "MV-001".to_string(),
            date_from: None,
            date_to: None,
            movement_type: None,
            page: 1,
            per_page: 50,
        };
        let result = crate::biz::inventory_service::list_movements(&conn, &query).unwrap();
        assert_eq!(result.total_count, 1); // voided行は除外
        assert_eq!(result.items[0].movement_type, "receiving");
    }

    /// list_movements: movement_type フィルタ
    #[test]
    fn test_list_movements_req303_type_filter() {
        // REQ-303: 在庫変動履歴
        let conn = setup_db();
        seed_product_with_stock(&conn, "MV-002", 10, "pcs");
        insert_movement(&conn, "MV-002", "receiving", 5, false);
        insert_movement(&conn, "MV-002", "sale_auto", -2, false);

        let query = crate::biz::MovementQuery {
            product_code: "MV-002".to_string(),
            date_from: None,
            date_to: None,
            movement_type: Some("receiving".to_string()),
            page: 1,
            per_page: 50,
        };
        let result = crate::biz::inventory_service::list_movements(&conn, &query).unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.items[0].movement_type, "receiving");
    }

    /// list_movements: date_to の日末補完（T23:59:59）
    #[test]
    fn test_list_movements_req303_date_to_end_of_day() {
        // REQ-303: 在庫変動履歴
        let conn = setup_db();
        seed_product_with_stock(&conn, "MV-003", 10, "pcs");
        // created_at が 2026-03-15T10:00:00 で挿入される
        insert_movement(&conn, "MV-003", "receiving", 5, false);

        // date_to=2026-03-15 で検索 → T23:59:59が補完されるのでヒットする
        let query = crate::biz::MovementQuery {
            product_code: "MV-003".to_string(),
            date_from: None,
            date_to: Some("2026-03-15".to_string()),
            movement_type: None,
            page: 1,
            per_page: 50,
        };
        let result = crate::biz::inventory_service::list_movements(&conn, &query).unwrap();
        assert_eq!(result.total_count, 1);

        // date_to=2026-03-14 → 14日末まで。15日のデータはヒットしない
        let query2 = crate::biz::MovementQuery {
            product_code: "MV-003".to_string(),
            date_from: None,
            date_to: Some("2026-03-14".to_string()),
            movement_type: None,
            page: 1,
            per_page: 50,
        };
        let result2 = crate::biz::inventory_service::list_movements(&conn, &query2).unwrap();
        assert_eq!(result2.total_count, 0);
    }

    /// list_movements: CMD経由で source link を含む
    #[test]
    fn test_list_movements_req207_source_link_through_biz() {
        // REQ-207 / TRACE-D2: CMD は BIZ が解決した元記録 link をそのまま返す
        let conn = setup_db();
        seed_product_with_stock(&conn, "MV-CMD", 10, "pcs");
        conn.execute(
            "INSERT INTO inventory_movements \
             (product_code, movement_type, quantity, stock_after, reference_type, reference_id, is_voided, created_at) \
             VALUES ('MV-CMD', 'disposal', -2, 8, 'disposal_record', 15, 0, '2026-03-15T10:00:00')",
            [],
        )
        .unwrap();

        let query = crate::biz::MovementQuery {
            product_code: "MV-CMD".to_string(),
            date_from: None,
            date_to: None,
            movement_type: None,
            page: 1,
            per_page: 20,
        };
        let result = crate::biz::inventory_service::list_movements(&conn, &query).unwrap();
        let source = result.items[0].source.as_ref().expect("source link");

        assert_eq!(source.label, "廃棄・破損 #15");
        assert_eq!(source.route, "/inventory/disposal/records/15");
    }
}
