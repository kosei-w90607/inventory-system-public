//! テスト共通ヘルパー

use super::DbConnection;
use crate::db::product_repo::{self, NewProduct};

pub fn setup_test_db() -> (tempfile::TempDir, DbConnection) {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let conn = crate::db::init_database(db_path.to_str().unwrap()).unwrap();
    (dir, conn)
}

/// テスト用に商品を1件挿入するヘルパー
pub fn seed_product(conn: &DbConnection, product_code: &str) {
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

/// テスト用に取引先を作成するヘルパー
pub fn seed_supplier(conn: &DbConnection) -> i64 {
    conn.execute(
        "INSERT INTO suppliers (name, created_at) VALUES ('テスト取引先', '2026-04-06T00:00:00')",
        [],
    )
    .unwrap();
    conn.last_insert_rowid()
}
