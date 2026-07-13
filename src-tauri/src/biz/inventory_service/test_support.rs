//! テスト共通ヘルパー（inventory_service サブモジュール共用）

use crate::db::product_repo;
use crate::db::{self, DbConnection};
use tempfile::TempDir;

pub(super) fn setup_test_db() -> (TempDir, DbConnection) {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let conn = db::init_database(db_path.to_str().unwrap()).unwrap();
    (dir, conn)
}

pub(super) fn create_test_product(conn: &DbConnection, code: &str, stock: i64) {
    product_repo::insert_product(
        conn,
        &product_repo::NewProduct {
            product_code: code.to_string(),
            jan_code: None,
            name: format!("テスト商品 {}", code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: stock,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        },
    )
    .unwrap();
}

/// PLU登録済みの商品を作成するヘルパー（plu_dirty=false, plu_exported_at あり）
pub(super) fn create_plu_exported_product(conn: &DbConnection, code: &str, stock: i64) {
    product_repo::insert_product(
        conn,
        &product_repo::NewProduct {
            product_code: code.to_string(),
            jan_code: None,
            name: format!("PLU登録済み商品 {}", code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: stock,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: false,
            plu_exported_at: Some("2026-04-01T12:00:00".to_string()),
            plu_target: true,
            pos_stock_sync: true,
        },
    )
    .unwrap();
}

pub(super) fn create_test_supplier(conn: &DbConnection) -> i64 {
    product_repo::find_or_create_supplier(conn, "テスト取引先")
        .unwrap()
        .id
}
