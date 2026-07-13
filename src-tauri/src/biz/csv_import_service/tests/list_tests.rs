use crate::biz::csv_import_service::list;
use crate::biz::BizError;
use crate::db::sales_repo::{self, NewCsvImport};
use crate::db::test_support::setup_test_db;

// --- list_csv_imports テスト ---

#[test]
fn test_list_csv_imports_req401_normal() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 2件のインポートを作成
    for i in 1..=2 {
        sales_repo::insert_csv_import(
            &conn,
            &NewCsvImport {
                filename: format!("Z004_{}", i),
                settlement_date: format!("2026-03-2{}", i),
                file_hash: format!("hash{}", i),
                total_items: i as i64,
                total_amount: i as i64 * 100,
                skipped_count: 0,
                status: "completed".to_string(),
            },
        )
        .unwrap();
    }

    let result = list::list_csv_imports(&conn, 1, 10).unwrap();
    assert_eq!(result.total_count, 2);
    assert_eq!(result.items.len(), 2);
}

#[test]
fn test_list_csv_imports_req401_invalid_page() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    let result = list::list_csv_imports(&conn, 0, 10);
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ValidationFailed(msg) => assert!(msg.contains("ページパラメータ")),
        e => panic!("Expected ValidationFailed, got {:?}", e),
    }
}

#[test]
fn test_list_csv_imports_req401_invalid_per_page() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // per_page = 0
    let r1 = list::list_csv_imports(&conn, 1, 0);
    assert!(r1.is_err());

    // per_page = 101
    let r2 = list::list_csv_imports(&conn, 1, 101);
    assert!(r2.is_err());
    match r2.unwrap_err() {
        BizError::ValidationFailed(_) => {}
        e => panic!("Expected ValidationFailed, got {:?}", e),
    }
}
