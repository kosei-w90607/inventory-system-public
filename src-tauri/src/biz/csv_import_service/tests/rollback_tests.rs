use crate::biz::csv_import_service::test_support::*;
use crate::biz::csv_import_service::*;
use crate::biz::BizError;
use crate::db::product_repo;
use crate::db::test_support::setup_test_db;
use std::time::Instant;

/// CachedPreview を構築するヘルパー
fn build_cached(result: ParseValidateResult) -> CachedPreview {
    CachedPreview {
        created_at: Instant::now(),
        matched_rows: result.matched_rows,
        error_rows: result.error_rows,
        preview_data: result.preview_data,
    }
}

/// commit してからrollbackをテストするヘルパー
fn commit_import(
    conn: &mut crate::db::DbConnection,
    bytes: Vec<u8>,
    filename: &str,
) -> ImportResult {
    let pv = parse_and_build_cache(conn, bytes, filename);
    let cached = build_cached(pv);
    commit::commit_csv_import(
        conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    )
    .unwrap()
}

// --- rollback_csv_import テスト ---

#[test]
fn test_rollback_req401_normal() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let import_result = commit_import(&mut conn, bytes, "Z004_260321");

    // 在庫が減っていることを確認
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 7); // 10 - 3

    // ロールバック
    let rb = rollback::rollback_csv_import(&mut conn, import_result.csv_import_id).unwrap();
    assert!(rb.success);
    assert_eq!(rb.voided_sale_count, 1);
    assert_eq!(rb.voided_movement_count, 1);
    assert_eq!(rb.stock_corrections.len(), 1);
    assert_eq!(rb.stock_corrections[0].product_code, "TEST-001");
    assert_eq!(rb.stock_corrections[0].old_stock, 7);
    assert_eq!(rb.stock_corrections[0].new_stock, 10);

    // DB検証: 在庫が元に戻っている
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 10);
}

#[test]
fn test_rollback_req401_idempotent() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let import_result = commit_import(&mut conn, bytes, "Z004_260321");

    // 1回目のロールバック
    let rb1 = rollback::rollback_csv_import(&mut conn, import_result.csv_import_id).unwrap();
    assert!(rb1.success);
    assert_eq!(rb1.voided_sale_count, 1);

    // 2回目のロールバック（冪等）
    let rb2 = rollback::rollback_csv_import(&mut conn, import_result.csv_import_id).unwrap();
    assert!(rb2.success);
    assert_eq!(rb2.voided_sale_count, 0);
    assert_eq!(rb2.voided_movement_count, 0);
    assert!(rb2.stock_corrections.is_empty());

    // DB検証: 在庫は1回目のロールバック後のまま
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 10);
}

#[test]
fn test_rollback_req401_not_found() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    let result = rollback::rollback_csv_import(&mut conn, 999);
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::NotFound(msg) => assert!(msg.contains("999")),
        e => panic!("Expected NotFound, got {:?}", e),
    }
}

#[test]
fn test_rollback_req401_stock_corrections() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 20, true);
    create_test_product_with_jan(&conn, "TEST-002", "4912345678902", 15, true);
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "商品A", 5, 1500),
            ("4912345678902", "商品B", 3, 600),
        ],
    );
    let import_result = commit_import(&mut conn, bytes, "Z004_260321");

    // 在庫確認
    let p1 = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p1.product.stock_quantity, 15); // 20 - 5
    let p2 = product_repo::find_by_product_code(&conn, "TEST-002")
        .unwrap()
        .unwrap();
    assert_eq!(p2.product.stock_quantity, 12); // 15 - 3

    // ロールバック
    let rb = rollback::rollback_csv_import(&mut conn, import_result.csv_import_id).unwrap();
    assert_eq!(rb.voided_sale_count, 2);
    assert_eq!(rb.voided_movement_count, 2);
    assert_eq!(rb.stock_corrections.len(), 2);

    // 各商品の在庫が元に戻っている
    let p1 = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p1.product.stock_quantity, 20);
    let p2 = product_repo::find_by_product_code(&conn, "TEST-002")
        .unwrap()
        .unwrap();
    assert_eq!(p2.product.stock_quantity, 15);
}
