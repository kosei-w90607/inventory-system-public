use crate::biz::csv_import_service::test_support::*;
use crate::biz::csv_import_service::*;
use crate::biz::BizError;
use crate::db::test_support::setup_test_db;
use crate::db::{product_repo, sales_repo};
use std::time::Instant;

/// CachedPreview を構築するヘルパー
fn build_cached(result: ParseValidateResult) -> CachedPreview {
    let active_same_date_import_ids = result
        .preview_data
        .duplicate_check
        .same_date_imports
        .iter()
        .map(|item| item.id)
        .collect();
    CachedPreview {
        created_at: Instant::now(),
        matched_rows: result.matched_rows,
        error_rows: result.error_rows,
        preview_data: result.preview_data,
        active_same_date_import_ids,
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
            additional_import_confirmed: false,
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

#[test]
fn test_rollback_req401_same_day_is_per_import_with_negative_return() {
    // REQ-401 / I-B6 / SPEC-SDI-D2,D7: 対象importだけを取消し、同日返品siblingを保持する。
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let first = commit_import(
        &mut conn,
        make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 2, 600)]),
        "Z004_0001",
    );
    let second_preview = parse_and_build_cache(
        &conn,
        make_z004_bytes("2026-03-21", &[("4912345678901", "返品A", -1, -300)]),
        "Z004_0002",
    );
    let second = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            additional_import_confirmed: true,
            cached_data: build_cached(second_preview),
        },
    )
    .unwrap();

    rollback::rollback_csv_import(&mut conn, first.csv_import_id).unwrap();

    let active =
        crate::db::sales_repo::find_imports_by_settlement_date(&conn, "2026-03-21").unwrap();
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].id, second.csv_import_id);
    let product = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(product.product.stock_quantity, 11);
    let remaining_sales = sales_repo::get_daily_sales_records(&conn, "2026-03-21").unwrap();
    assert_eq!(remaining_sales.len(), 1);
    assert_eq!(remaining_sales[0].quantity, -1);
    assert_eq!(remaining_sales[0].amount, -300);
    assert_eq!(remaining_sales[0].source, "auto");
}

#[test]
fn test_rollback_req401_selected_negative_return_reverses_only_return_contribution() {
    // REQ-401 / I-B7 / SPEC-SDI-D2: 負数返品importを取消すと返品寄与だけを逆転しfirst saleを保持する。
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let first = commit_import(
        &mut conn,
        make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 2, 600)]),
        "Z004_0001",
    );
    let return_preview = parse_and_build_cache(
        &conn,
        make_z004_bytes("2026-03-21", &[("4912345678901", "返品A", -1, -300)]),
        "Z004_0002",
    );
    let returned = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            additional_import_confirmed: true,
            cached_data: build_cached(return_preview),
        },
    )
    .unwrap();
    let before = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(before.product.stock_quantity, 9);

    rollback::rollback_csv_import(&mut conn, returned.csv_import_id).unwrap();

    let after = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(after.product.stock_quantity, 8);
    let active = sales_repo::find_imports_by_settlement_date(&conn, "2026-03-21").unwrap();
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].id, first.csv_import_id);
    let first_active_sale: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sale_records WHERE csv_import_id = ?1 AND is_voided = 0",
            [first.csv_import_id],
            |row| row.get(0),
        )
        .unwrap();
    let return_active_sale: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sale_records WHERE csv_import_id = ?1 AND is_voided = 0",
            [returned.csv_import_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(first_active_sale, 1);
    assert_eq!(return_active_sale, 0);
}

#[test]
fn test_import_rollback_req401_logs_exact_selected_id_and_preserves_commit_on_log_failure() {
    // REQ-401 / I-B9 / SPEC-SDI-D2: log失敗はbusiness rollbackを戻さず、成功logは選択IDを記録する。
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let first = commit_import(
        &mut conn,
        make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 1, 300)]),
        "Z004_0001",
    );
    let second_preview = parse_and_build_cache(
        &conn,
        make_z004_bytes("2026-03-21", &[("4912345678901", "商品B", 2, 600)]),
        "Z004_0002",
    );
    let second = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            additional_import_confirmed: true,
            cached_data: build_cached(second_preview),
        },
    )
    .unwrap();

    conn.execute_batch(
        "CREATE TRIGGER fail_csv_rollback_log
         BEFORE INSERT ON operation_logs
         WHEN NEW.operation_type = 'csv_rollback'
         BEGIN SELECT RAISE(FAIL, 'synthetic log failure'); END;",
    )
    .unwrap();
    let result = rollback::rollback_csv_import(&mut conn, first.csv_import_id).unwrap();
    assert!(result.success);
    let first_record = sales_repo::find_csv_import_by_id(&conn, first.csv_import_id)
        .unwrap()
        .unwrap();
    let second_record = sales_repo::find_csv_import_by_id(&conn, second.csv_import_id)
        .unwrap()
        .unwrap();
    assert_eq!(first_record.status, sales_repo::CsvImportStatus::RolledBack);
    assert_eq!(second_record.status, sales_repo::CsvImportStatus::Completed);

    conn.execute_batch("DROP TRIGGER fail_csv_rollback_log;")
        .unwrap();
    rollback::rollback_csv_import(&mut conn, second.csv_import_id).unwrap();
    let (summary, detail): (String, String) = conn
        .query_row(
            "SELECT summary, detail_json FROM operation_logs
             WHERE operation_type = 'csv_rollback' ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert!(summary.contains(&format!("ID {}", second.csv_import_id)));
    assert!(detail.contains(&format!(r#""csv_import_id":{}"#, second.csv_import_id)));
}
