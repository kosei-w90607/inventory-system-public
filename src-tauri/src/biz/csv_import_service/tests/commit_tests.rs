use crate::biz::csv_import_service::test_support::*;
use crate::biz::csv_import_service::*;
use crate::biz::BizError;
use crate::db::test_support::setup_test_db;
use crate::db::{product_repo, sales_repo};
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

// --- commit_csv_import テスト ---

#[test]
fn test_commit_req401_normal_flow() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    create_test_product_with_jan(&conn, "TEST-002", "4912345678902", 5, true);
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "商品A", 3, 900),
            ("4912345678902", "商品B", 1, 200),
        ],
    );
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    let token = pv.preview_token.clone();
    let cached = build_cached(pv);

    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: token,
            overwrite_confirmed: false,
            cached_data: cached,
        },
    )
    .unwrap();

    assert_eq!(result.status, "completed");
    assert_eq!(result.total_items, 2);
    assert_eq!(result.total_amount, 1100);
    assert_eq!(result.skipped_count, 0);

    // DB検証: 在庫が減っている
    let p1 = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p1.product.stock_quantity, 7); // 10 - 3
    let p2 = product_repo::find_by_product_code(&conn, "TEST-002")
        .unwrap()
        .unwrap();
    assert_eq!(p2.product.stock_quantity, 4); // 5 - 1
}

#[test]
fn test_commit_req401_overwrite_flow() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);

    // 最初のインポート
    let bytes1 = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 2, 600)]);
    let pv1 = parse_and_build_cache(&conn, bytes1, "Z004_old");
    let cached1 = build_cached(pv1);
    let result1 = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token1".to_string(),
            overwrite_confirmed: false,
            cached_data: cached1,
        },
    )
    .unwrap();
    assert_eq!(result1.status, "completed");
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 8); // 10 - 2

    // 同日の別ファイルで上書き（異なるデータ行を持つファイルで上書き）
    let bytes2 = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 5, 1500)]);
    // settlement_date 同日チェックのため手動でPreviewDataを構築
    let pv2 = parse_and_build_cache(&conn, bytes2, "Z004_new");
    assert_eq!(
        pv2.preview_data.duplicate_check.status,
        DuplicateStatus::OverwriteRequired
    );
    let cached2 = build_cached(pv2);
    let result2 = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token2".to_string(),
            overwrite_confirmed: true,
            cached_data: cached2,
        },
    )
    .unwrap();
    assert_eq!(result2.status, "completed");
    assert_eq!(result2.total_items, 1);
    assert_eq!(result2.total_amount, 1500);

    // DB検証: 旧データの在庫補正(+2) → 10 + 新データの在庫減算(-5) → 5
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 5);
}

#[test]
fn test_commit_req401_overwrite_not_confirmed() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);

    // 同日の既存インポートを作成
    sales_repo::insert_csv_import(
        &conn,
        &sales_repo::NewCsvImport {
            filename: "old".to_string(),
            settlement_date: "2026-03-21".to_string(),
            file_hash: "oldhash".to_string(),
            total_items: 1,
            total_amount: 100,
            skipped_count: 0,
            status: "completed".to_string(),
        },
    )
    .unwrap();

    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let pv = parse_and_build_cache(&conn, bytes, "Z004_new");
    let cached = build_cached(pv);

    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("overwrite_confirmed")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_commit_req401_toctou_check() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let pv = parse_and_build_cache(&conn, bytes.clone(), "Z004_260321");
    let file_hash = pv.preview_data.file_info.file_hash.clone();

    // プレビュー後にDBに同じhashを挿入（他の操作がcommitした状況をシミュレート）
    sales_repo::insert_csv_import(
        &conn,
        &sales_repo::NewCsvImport {
            filename: "sneaky".to_string(),
            settlement_date: "2026-03-21".to_string(),
            file_hash,
            total_items: 1,
            total_amount: 900,
            skipped_count: 0,
            status: "completed".to_string(),
        },
    )
    .unwrap();

    let cached = build_cached(pv);
    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("取込み済み")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_commit_req401_pos_stock_sync_false() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, false); // pos_stock_sync=false
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "生地A", 3, 900)]);
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    let cached = build_cached(pv);

    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    )
    .unwrap();
    assert_eq!(result.status, "completed");
    assert_eq!(result.total_items, 1);

    // DB検証: 在庫は動かない
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 10); // 変わらず
}

#[test]
fn test_commit_req401_negative_stock_warning() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 2, true); // 在庫2
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "商品A", 5, 1500), // 5個販売 → 在庫-3
        ],
    );
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    let cached = build_cached(pv);

    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    )
    .unwrap();
    // 処理は完了する（INV-3: 負在庫は警告のみ）
    assert_eq!(result.status, "completed");

    // DB検証: 在庫がマイナス
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, -3); // 2 - 5
}

#[test]
fn test_commit_req401_partial_with_errors() {
    // REQ-401: CSV取込み
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    // 1件マッチ + 1件アンマッチ
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "商品A", 3, 900),
            ("9999999999999", "未登録商品", 1, 100),
        ],
    );
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    let cached = build_cached(pv);

    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    )
    .unwrap();
    assert_eq!(result.status, "completed_partial");
    assert_eq!(result.total_items, 1);
    assert_eq!(result.skipped_count, 1);
}

#[test]
fn test_commit_req401_sign_flip_inv1() {
    // REQ-401: CSV取込み
    // INV-1: quantity=3（売上帳票視点）→ inventory_quantity=-3（在庫視点）
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 100, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    let cached = build_cached(pv);

    commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    )
    .unwrap();

    // DB検証: 在庫が3減っている（100 - 3 = 97）
    let p = product_repo::find_by_product_code(&conn, "TEST-001")
        .unwrap()
        .unwrap();
    assert_eq!(p.product.stock_quantity, 97);
}

#[test]
fn test_commit_req401_settlement_date_toctou() {
    // REQ-401: CSV取込み
    // Preview時はNoDuplicateだったが、commit前に同日データが別経路で取り込まれた場合
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    // Preview時点ではNoDuplicate
    assert_eq!(
        pv.preview_data.duplicate_check.status,
        DuplicateStatus::NoDuplicate
    );

    // Preview後に別経路で同日データを挿入
    sales_repo::insert_csv_import(
        &conn,
        &sales_repo::NewCsvImport {
            filename: "Z004_sneaky".to_string(),
            settlement_date: "2026-03-21".to_string(),
            file_hash: "sneaky_different_hash".to_string(),
            total_items: 1,
            total_amount: 500,
            skipped_count: 0,
            status: "completed".to_string(),
        },
    )
    .unwrap();

    let cached = build_cached(pv);
    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: false,
            cached_data: cached,
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("同日")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_commit_req401_overwrite_confirmed_without_duplicate() {
    // REQ-401: CSV取込み
    // Preview が NoDuplicate なのに overwrite_confirmed=true → ValidationFailed
    let (_dir, mut conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let pv = parse_and_build_cache(&conn, bytes, "Z004_260321");
    assert_eq!(
        pv.preview_data.duplicate_check.status,
        DuplicateStatus::NoDuplicate
    );
    let cached = build_cached(pv);

    let result = commit::commit_csv_import(
        &mut conn,
        CommitRequest {
            preview_token: "token".to_string(),
            overwrite_confirmed: true, // NoDuplicate なのに true
            cached_data: cached,
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ValidationFailed(msg) => assert!(msg.contains("上書き対象がありません")),
        e => panic!("Expected ValidationFailed, got {:?}", e),
    }
}
