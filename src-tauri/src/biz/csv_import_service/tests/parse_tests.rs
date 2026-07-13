use crate::biz::csv_import_service::test_support::*;
use crate::biz::csv_import_service::*;
use crate::biz::BizError;
use crate::db::sales_repo::{self, NewCsvImport};
use crate::db::test_support::setup_test_db;

// --- parse_and_validate テスト ---

#[test]
fn test_parse_and_validate_req401_size_limit() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    let big_bytes = vec![0u8; 20 * 1024 * 1024 + 1];
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: big_bytes,
            filename: "too_big.csv".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("20MB")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_decode_error() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 不正なバイト列（CP932としてデコード不能）
    let invalid_bytes = vec![0xFF, 0xFE, 0x00, 0x01, 0x80, 0x00];
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: invalid_bytes,
            filename: "invalid.csv".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("CP932")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_no_data_lines() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 1行のみ（ヘッダ行すらない）
    let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode("\"精算日\"");
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: encoded.into_owned(),
            filename: "short.csv".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("データ行がありません")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_no_settlement_date() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 日付なしの2行
    let text = "\"no date here\",\"\",\"\",\"\",\"\"\r\n\"header\",\"\",\"\",\"\",\"\"";
    let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: encoded.into_owned(),
            filename: "nodate.csv".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("精算日")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_line_limit() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 10001行のデータ行を生成
    let mut data_lines = Vec::new();
    for _ in 0..10001 {
        data_lines.push(("4912345678901", "テスト", 1, 100));
    }
    let refs = data_lines.to_vec();
    let bytes = make_z004_bytes("2026-03-21", &refs);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "huge.csv".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("10,000")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_empty_records_excluded() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    // quantity=0, amount=0 の行 + 正常行
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "正常商品", 3, 900),
            ("4912345678902", "空スロット", 0, 0),
        ],
    );
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    // 空スロットは除外され、正常行1件のみマッチ
    assert_eq!(result.matched_rows.len(), 1);
    assert_eq!(result.matched_rows[0].product_code, "TEST-001");
    // 空スロットはエラーにもカウントされない（unmatchedにもならない）
    // 4912345678902 はDB未登録だが qty=0,amt=0 なので除外される
}

#[test]
fn test_parse_and_validate_req401_normal_matching() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    create_test_product_with_jan(&conn, "TEST-002", "4912345678902", 5, false);
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "商品A", 3, 900),
            ("4912345678902", "商品B", 1, 200),
        ],
    );
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    assert_eq!(result.matched_rows.len(), 2);
    assert_eq!(result.matched_rows[0].product_code, "TEST-001");
    assert_eq!(result.matched_rows[0].quantity, 3);
    assert!(result.matched_rows[0].pos_stock_sync);
    assert_eq!(result.matched_rows[1].product_code, "TEST-002");
    assert!(!result.matched_rows[1].pos_stock_sync);
    assert_eq!(result.preview_data.matched_summary.count, 2);
    assert_eq!(result.preview_data.matched_summary.total_amount, 1100);
    assert_eq!(result.preview_data.error_summary.count, 0);
    assert_eq!(
        result.preview_data.duplicate_check.status,
        DuplicateStatus::NoDuplicate
    );
    assert!(!result.preview_token.is_empty());
}

#[test]
fn test_parse_and_validate_req401_unmatched_product() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // DBに商品を登録しない
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "未登録商品", 2, 500)]);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    assert_eq!(result.matched_rows.len(), 0);
    assert_eq!(result.error_rows.len(), 1);
    assert_eq!(result.error_rows[0].error_type, "unmatched_product");
    assert!(result.error_rows[0].error_message.contains("4912345678901"));
}

#[test]
fn test_parse_and_validate_req401_multiple_jan_hits() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 同じJANで2商品（グループコード）
    create_test_product_with_jan(&conn, "FS-0001", "4912345678901", 10, true);
    create_test_product_with_jan(&conn, "FS-0002", "4912345678901", 5, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "グループ商品", 1, 300)]);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    // ORDER BY product_code ASC で先頭を採用
    assert_eq!(result.matched_rows.len(), 1);
    assert_eq!(result.matched_rows[0].product_code, "FS-0001");
    // 警告がwarningsに追加される
    assert_eq!(result.preview_data.matched_summary.warnings.len(), 1);
    assert!(result.preview_data.matched_summary.warnings[0].contains("複数商品"));
}

#[test]
fn test_parse_and_validate_req401_parse_errors_merged() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    // フィールド数不足の行を含むZ004
    let text = "\"精算日\",\"2026-03-21\",\"\",\"\",\"\"\r\n\
         \"No.\",\"スキャニングコード\",\"商品名\",\"個数\",\"金額\"\r\n\
         \"1\",\"4912345678901\",\"正常行\",\"3\",\"900\"\r\n\
         \"2\",\"bad_line\""
        .to_string();
    let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(&text);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: encoded.into_owned(),
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    assert_eq!(result.matched_rows.len(), 1);
    // parse_errors がマージされてerror_rowsに含まれる
    assert!(!result.error_rows.is_empty());
    let format_error = result
        .error_rows
        .iter()
        .find(|e| e.error_type == "invalid_format");
    assert!(format_error.is_some());
}

#[test]
fn test_parse_and_validate_req401_no_valid_data() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 全行が空レコード（qty=0, amt=0）
    let bytes = make_z004_bytes(
        "2026-03-21",
        &[
            ("4912345678901", "空1", 0, 0),
            ("4912345678902", "空2", 0, 0),
        ],
    );
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("取込み対象のデータがありません")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_file_hash_blocking() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);

    // まず1回パース → file_hash を取得して直接DBに登録
    let first_result = parse_and_build_cache(&conn, bytes.clone(), "Z004_260321");
    let file_hash = &first_result.preview_data.file_info.file_hash;
    sales_repo::insert_csv_import(
        &conn,
        &NewCsvImport {
            filename: "Z004_260321".to_string(),
            settlement_date: "2026-03-21".to_string(),
            file_hash: file_hash.clone(),
            total_items: 1,
            total_amount: 900,
            skipped_count: 0,
            status: "completed".to_string(),
        },
    )
    .unwrap();

    // 同じファイルで再パース → ブロック
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("取込み済み")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_settlement_date_overwrite() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);

    // 同日の別ファイルが取込み済み
    sales_repo::insert_csv_import(
        &conn,
        &NewCsvImport {
            filename: "Z004_old".to_string(),
            settlement_date: "2026-03-21".to_string(),
            file_hash: "oldhash_different_from_new".to_string(),
            total_items: 1,
            total_amount: 500,
            skipped_count: 0,
            status: "completed".to_string(),
        },
    )
    .unwrap();

    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321_new".to_string(),
        },
    )
    .unwrap();
    assert_eq!(
        result.preview_data.duplicate_check.status,
        DuplicateStatus::OverwriteRequired
    );
    assert!(result
        .preview_data
        .duplicate_check
        .existing_import_id
        .is_some());
}

#[test]
fn test_parse_and_validate_req401_no_duplicate() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "商品A", 3, 900)]);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    assert_eq!(
        result.preview_data.duplicate_check.status,
        DuplicateStatus::NoDuplicate
    );
    assert!(result
        .preview_data
        .duplicate_check
        .existing_import_id
        .is_none());
}

#[test]
fn test_parse_and_validate_req401_negative_quantity_return() {
    // REQ-401: CSV取込み
    // 返品行（quantity < 0）が正常にmatched_rowsに入ることを確認
    let (_dir, conn) = setup_test_db();
    create_test_product_with_jan(&conn, "TEST-001", "4912345678901", 10, true);
    let bytes = make_z004_bytes("2026-03-21", &[("4912345678901", "返品商品", -1, -500)]);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    assert_eq!(result.matched_rows.len(), 1);
    assert_eq!(result.matched_rows[0].quantity, -1);
    assert_eq!(result.matched_rows[0].amount, -500);
    assert_eq!(result.preview_data.matched_summary.total_amount, -500);
}

#[test]
fn test_parse_and_validate_req401_error_summary_truncation() {
    // REQ-401: CSV取込み
    // error_rows > 100件のとき、error_summary.items が100件に截断されることを確認
    let (_dir, conn) = setup_test_db();
    // 110件の未登録JAN行を生成
    let mut data_lines = Vec::new();
    for i in 0..110 {
        let jan = format!("490000000{:04}", i);
        data_lines.push((jan, format!("未登録商品{}", i), 1i32, 100i32));
    }
    let refs: Vec<(&str, &str, i32, i32)> = data_lines
        .iter()
        .map(|(j, n, q, a)| (j.as_str(), n.as_str(), *q, *a))
        .collect();
    let bytes = make_z004_bytes("2026-03-21", &refs);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_260321".to_string(),
        },
    )
    .unwrap();
    // 全行がunmatched → error_rows = 110件
    assert_eq!(result.error_rows.len(), 110);
    // error_summary.count は全件数
    assert_eq!(result.preview_data.error_summary.count, 110);
    // error_summary.items は先頭100件に截断
    assert_eq!(result.preview_data.error_summary.items.len(), 100);
}

#[test]
fn test_parse_and_validate_req401_invalid_settlement_date() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 不正日付（2026-99-99）を含むZ004
    let text = "\"精算日\",\"2026-99-99\",\"\",\"\",\"\"\r\n\
         \"No.\",\"コード\",\"名\",\"個\",\"額\"\r\n\
         \"1\",\"4912345678901\",\"商品\",\"1\",\"100\""
        .to_string();
    let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(&text);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: encoded.into_owned(),
            filename: "Z004_bad_date".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("不正な日付")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}

#[test]
fn test_parse_and_validate_req401_future_settlement_date() {
    // REQ-401: CSV取込み
    let (_dir, conn) = setup_test_db();
    // 未来日付
    let bytes = make_z004_bytes("2099-12-31", &[("4912345678901", "商品", 1, 100)]);
    let result = parse::parse_and_validate(
        &conn,
        CsvParseAndValidateRequest {
            file_bytes: bytes,
            filename: "Z004_future".to_string(),
        },
    );
    assert!(result.is_err());
    match result.unwrap_err() {
        BizError::ImportError(msg) => assert!(msg.contains("未来")),
        e => panic!("Expected ImportError, got {:?}", e),
    }
}
