use super::*;
use crate::biz::BizError;
use crate::constants;
use crate::db::product_repo::{self, NewProduct};
use crate::db::sales_repo;
use crate::db::test_support::setup_test_db;
use std::time::{Duration, Instant};

fn encode_cp932(text: &str) -> Vec<u8> {
    let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
    encoded.to_vec()
}

fn source_file(filename: &str, text: &str) -> DailyReportInputFile {
    DailyReportInputFile {
        filename: filename.to_string(),
        bytes: encode_cp932(text),
    }
}

fn daily_report_preamble(date: &str) -> String {
    format!(
        "\"マシンNo.   \",\"01\",\"\",\"\"\r\n\"ファイル    \",\"synthetic\",\"\",\"\"\r\n\"モード      \",\"精算\",\"\",\"\"\r\n\"精算回数    \",\"0001\",\"\",\"\"\r\n\"日付        \",\"{date}\",\"\",\"\"\r\n\"時刻        \",\"12:34\",\"\",\"\"\r\n\r\n\"レコード    \",\"キャラクター\",\"個数/件数   \",\"金額        \"\r\n"
    )
}

fn z001_with_lines(date: &str, lines: &[(&str, &str, &str, &str)]) -> DailyReportInputFile {
    let mut text = daily_report_preamble(date);
    for (code, label, quantity_or_count, amount) in lines {
        text.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\"\r\n",
            code, label, quantity_or_count, amount
        ));
    }
    source_file("Z001_260321.CSV", &text)
}

fn z001(date: &str) -> DailyReportInputFile {
    z001_with_lines(
        date,
        &[("101", "総売", "8", "12000"), ("201", "純売", "7", "11000")],
    )
}

fn z002(date: &str) -> DailyReportInputFile {
    source_file(
        "Z002_260321.CSV",
        &format!(
            "{}\"01\",\"現金\",\"7\",\"11000\"\r\n\"03\",\"クレジット\",\"1\",\"1000\"\r\n",
            daily_report_preamble(date)
        ),
    )
}

fn z005_with_department(date: &str, department: &str) -> DailyReportInputFile {
    source_file(
        "Z005_260321.CSV",
        &format!(
            "\"マシンNo.   \",\"01\"\r\n\"ファイル    \",\"synthetic\"\r\n\"モード      \",\"精算\"\r\n\"精算回数    \",\"0001\"\r\n\"日付        \",\"{date}\"\r\n\"時刻        \",\"12:34\"\r\n\r\n\"レコード    \",\"キャラクター\",\"個数        \",\"金額        \"\r\n\"01\",\"{}\",\"4\",\"3000\"\r\n\"02\",\"毛糸\",\"5\",\"8000\"\r\n",
            department
        ),
    )
}

fn z005(date: &str) -> DailyReportInputFile {
    z005_with_department(date, "その他小物")
}

fn valid_files() -> Vec<DailyReportInputFile> {
    vec![z001("2026-03-21"), z002("2026-03-21"), z005("2026-03-21")]
}

fn count_rows(conn: &crate::db::DbConnection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| {
        row.get(0)
    })
    .unwrap()
}

fn write_surface(conn: &crate::db::DbConnection) -> [i64; 7] {
    [
        count_rows(conn, "daily_report_imports"),
        count_rows(conn, "daily_report_summary_lines"),
        count_rows(conn, "daily_report_payment_lines"),
        count_rows(conn, "daily_report_department_lines"),
        count_rows(conn, "sale_records"),
        count_rows(conn, "inventory_movements"),
        conn.query_row(
            "SELECT COALESCE(SUM(stock_quantity), 0) FROM products",
            [],
            |row| row.get(0),
        )
        .unwrap(),
    ]
}

fn seed_product_with_stock(conn: &crate::db::DbConnection, product_code: &str, stock: i64) {
    product_repo::insert_product(
        conn,
        &NewProduct {
            product_code: product_code.to_string(),
            jan_code: Some(format!(
                "4900000000{}",
                &product_code[product_code.len() - 3..]
            )),
            name: format!("合成商品 {}", product_code),
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

#[test]
fn test_daily_report_req401_parse_preview_happy_path() {
    // REQ-401 / BIZ-08: previewに対象日、bundle_hash、支払/部門、warningを返す
    let (_dir, conn) = setup_test_db();
    let result = parse_and_validate_daily_report(&conn, valid_files()).unwrap();

    assert_eq!(result.preview_data.file_info.report_date, "2026-03-21");
    assert_eq!(result.preview_data.file_info.bundle_hash.len(), 64);
    assert_eq!(result.preview_data.totals.gross_amount, Some(12000));
    assert_eq!(result.preview_data.totals.net_amount, Some(11000));
    assert_eq!(result.preview_data.payment_summary.len(), 2);
    assert_eq!(result.preview_data.department_summary.len(), 2);
    assert!(result.preview_data.warnings.is_empty());
    assert_eq!(
        result.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::NoDuplicate
    );
}

#[test]
fn test_daily_report_req401_parse_error_logs_parse_failed() {
    // REQ-401 / BIZ-08-D1: IO parse detailはdiagnostic専用、operator境界は汎用に保つ
    let (_dir, conn) = setup_test_db();
    let malformed_z001 = z001_with_lines("2026-03-21", &[("101", "総売", "not-a-number", "12000")]);
    let (result, diagnostic) = crate::test_tracing::capture(|| {
        parse_and_validate_daily_report(
            &conn,
            vec![malformed_z001, z002("2026-03-21"), z005("2026-03-21")],
        )
    });

    match result {
        Err(BizError::ImportError(message)) => {
            assert_eq!(message, "日報ファイルの解析に失敗しました");
        }
        other => panic!("expected generic import error, got {other:?}"),
    }
    assert!(
        diagnostic.contains("source_file=Some(Z001)"),
        "{diagnostic}"
    );
    assert!(diagnostic.contains("filename=None"), "{diagnostic}");
    assert!(diagnostic.contains("line_no=Some(9)"), "{diagnostic}");
    assert!(
        diagnostic.contains("error_type=invalid_number"),
        "{diagnostic}"
    );
    assert!(
        diagnostic.contains("error_message=Z001の個数/件数列を変換できません"),
        "{diagnostic}"
    );
    assert_eq!(count_rows(&conn, "daily_report_imports"), 0);
    let (operation_type, summary, detail_json): (String, String, Option<String>) = conn
        .query_row(
            "SELECT operation_type, summary, detail_json
             FROM operation_logs
             WHERE operation_type = 'daily_report_parse_failed'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(operation_type, "daily_report_parse_failed");
    assert_eq!(summary, "日報ファイルの解析に失敗しました");
    assert_eq!(detail_json, None);
}

#[test]
fn test_daily_report_req401_future_date_rejected() {
    // REQ-401 / BIZ-08: 未来日の日報はcommit不可
    let (_dir, conn) = setup_test_db();
    let result = parse_and_validate_daily_report(
        &conn,
        vec![z001("2099-01-01"), z002("2099-01-01"), z005("2099-01-01")],
    );

    assert!(matches!(result, Err(BizError::ImportError(_))));
}

#[test]
fn test_daily_report_req401_bundle_hash_stable_by_source_order() {
    // REQ-401 / BIZ-08: bundle_hashは入力順ではなくZ001→Z002→Z005順で安定する
    let (_dir, conn) = setup_test_db();
    let normal = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let reversed = parse_and_validate_daily_report(
        &conn,
        vec![z005("2026-03-21"), z002("2026-03-21"), z001("2026-03-21")],
    )
    .unwrap();

    assert_eq!(
        normal.preview_data.file_info.bundle_hash,
        reversed.preview_data.file_info.bundle_hash
    );
}

#[test]
fn test_daily_report_req401_duplicate_already_imported() {
    // REQ-401 / I-B1 / SPEC-SDI-D1: active同一bundleはAlreadyImported、rollback後は再preview可能。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let first = commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let second = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    assert_eq!(
        second.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::AlreadyImported
    );

    rollback_daily_report_import(&mut conn, first.daily_report_import_id).unwrap();
    let retry = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    assert_eq!(
        retry.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::NoDuplicate
    );
}

#[test]
fn test_daily_report_req401_additional_confirmation_for_same_date_different_bundle() {
    // REQ-401 / I-W3 / SPEC-SDI-D3: 同日別bundleは全件・全files/totalsのordered snapshot付き追加確認。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let first = commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let second_files = vec![
        z001_with_lines(
            "2026-03-21",
            &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
        ),
        z002("2026-03-21"),
        z005("2026-03-21"),
    ];
    let second = parse_and_validate_daily_report(&conn, second_files).unwrap();
    let second = commit_daily_report_import(&mut conn, second.cached_preview, true).unwrap();
    let third = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[
                    ("101", "総売", "10", "14000"),
                    ("201", "純売", "9", "12500"),
                ],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap();
    assert_eq!(
        third.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::AdditionalImportConfirmationRequired
    );
    let summaries = &third.preview_data.duplicate_check.same_date_imports;
    assert_eq!(summaries.len(), 2);
    assert_eq!(summaries[0].id, second.daily_report_import_id);
    assert_eq!(summaries[1].id, first.daily_report_import_id);
    assert_eq!(summaries[0].source_filenames.len(), 3);
    assert_eq!(summaries[0].gross_amount, Some(13000));
    assert_eq!(summaries[0].net_amount, Some(12000));
    assert!(!summaries[0].imported_at.is_empty());
}

#[test]
fn test_daily_report_req401_corrupt_same_date_source_files_metadata_fails_safe() {
    // REQ-401 / I-W3 / SPEC-SDI-D3: 既存metadata破損時はfilenameを捏造せずpreviewを安全側errorにする。
    let (_dir, conn) = setup_test_db();
    sales_repo::insert_daily_report_import(
        &conn,
        &sales_repo::NewDailyReportImport {
            report_date: "2026-03-21".to_string(),
            source_adapter: "casio_sr_s4000".to_string(),
            bundle_hash: "corrupt-existing-bundle".to_string(),
            source_files_json: "{not-json".to_string(),
            gross_amount: Some(1),
            net_amount: Some(1),
            status: "completed".to_string(),
            note: None,
        },
    )
    .unwrap();

    let error = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap_err();
    assert!(
        matches!(error, BizError::ImportError(ref message) if message == "既存日報のファイル情報を読み取れません")
    );
}

#[test]
fn test_daily_report_req401_unmatched_department_warns_but_previews() {
    // REQ-401 / BIZ-08: 部門名未対応はwarningで、department_id=Noneのままpreview可能
    let (_dir, conn) = setup_test_db();
    let result = parse_and_validate_daily_report(
        &conn,
        vec![
            z001("2026-03-21"),
            z002("2026-03-21"),
            z005_with_department("2026-03-21", "未対応部門"),
        ],
    )
    .unwrap();

    assert!(result
        .preview_data
        .warnings
        .iter()
        .any(|w| w.code == "unmatched_department"
            && w.source_file == Some(DailyReportSourceKind::Z005)));
    assert!(result
        .preview_data
        .department_summary
        .iter()
        .any(|line| line.raw_department_name == "未対応部門" && line.department_id.is_none()));
}

#[test]
fn test_daily_report_req401_commit_inserts_parent_lines_and_log() {
    // REQ-401 / BIZ-08: commitは親/3系統明細/operation_logを作る
    let (_dir, mut conn) = setup_test_db();
    let parsed = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let result = commit_daily_report_import(&mut conn, parsed.cached_preview, false).unwrap();

    assert_eq!(result.status, "completed");
    assert!(result.daily_report_import_id > 0);
    for table in [
        "daily_report_imports",
        "daily_report_summary_lines",
        "daily_report_payment_lines",
        "daily_report_department_lines",
    ] {
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert!(count > 0, "{} should have rows", table);
    }
    let log_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'daily_report_import'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(log_count, 1);
}

#[test]
fn test_daily_report_req401_commit_same_date_is_insert_only() {
    // REQ-401 / I-B4 / SPEC-SDI-D1: 追加確定でも既存completedと全childを保持する。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let first_result = commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let second_files = vec![
        z001_with_lines(
            "2026-03-21",
            &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
        ),
        z002("2026-03-21"),
        z005("2026-03-21"),
    ];
    let second = parse_and_validate_daily_report(&conn, second_files).unwrap();
    let second_result = commit_daily_report_import(&mut conn, second.cached_preview, true).unwrap();

    assert_ne!(
        first_result.daily_report_import_id,
        second_result.daily_report_import_id
    );
    let old_status: String = conn
        .query_row(
            "SELECT status FROM daily_report_imports WHERE id = ?1",
            [first_result.daily_report_import_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(old_status, "completed");
    assert_eq!(first_result.gross_amount, Some(12000));
    assert_eq!(second_result.gross_amount, Some(13000));
    for (import_id, expected_max_summary) in [
        (first_result.daily_report_import_id, 12000_i64),
        (second_result.daily_report_import_id, 13000_i64),
    ] {
        let max_summary: i64 = conn
            .query_row(
                "SELECT MAX(amount) FROM daily_report_summary_lines WHERE daily_report_import_id = ?1",
                [import_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(max_summary, expected_max_summary);
        for table in [
            "daily_report_payment_lines",
            "daily_report_department_lines",
        ] {
            let child_count: i64 = conn
                .query_row(
                    &format!("SELECT COUNT(*) FROM {table} WHERE daily_report_import_id = ?1"),
                    [import_id],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(child_count > 0, "{table} child rows must remain");
        }
    }
}

#[test]
fn test_daily_report_req401_commit_does_not_write_sale_records_or_stock() {
    // REQ-401 / BIZ-08 / D-025: 日報commit単体はsale_records/movements/products.stock_quantityを汚染しない
    let (_dir, mut conn) = setup_test_db();
    seed_product_with_stock(&conn, "DR-001", 17);
    let parsed = parse_and_validate_daily_report(&conn, valid_files()).unwrap();

    commit_daily_report_import(&mut conn, parsed.cached_preview, false).unwrap();

    let stock: i64 = conn
        .query_row(
            "SELECT stock_quantity FROM products WHERE product_code = 'DR-001'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stock, 17);
    assert_eq!(count_rows(&conn, "sale_records"), 0);
    assert_eq!(count_rows(&conn, "inventory_movements"), 0);
}

#[test]
fn test_daily_report_req401_commit_additional_unconfirmed_validation_failed() {
    // REQ-401 / I-B5 / SPEC-SDI-D3: 追加確認required + false はValidationFailed。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let second_files = vec![
        z001_with_lines(
            "2026-03-21",
            &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
        ),
        z002("2026-03-21"),
        z005("2026-03-21"),
    ];
    let second = parse_and_validate_daily_report(&conn, second_files).unwrap();
    assert_eq!(
        second.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::AdditionalImportConfirmationRequired
    );

    let before = write_surface(&conn);
    let result = commit_daily_report_import(&mut conn, second.cached_preview, false);
    assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    assert_eq!(write_surface(&conn), before);
}

#[test]
fn test_daily_report_req401_commit_no_duplicate_confirmed_validation_failed() {
    // REQ-401 / I-B5 / SPEC-SDI-D3: NoDuplicate + true は副作用なしValidationFailed。
    let (_dir, mut conn) = setup_test_db();
    let parsed = parse_and_validate_daily_report(&conn, valid_files()).unwrap();

    let before = write_surface(&conn);
    let result = commit_daily_report_import(&mut conn, parsed.cached_preview, true);

    assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    assert_eq!(count_rows(&conn, "daily_report_imports"), 0);
    assert_eq!(count_rows(&conn, "daily_report_payment_lines"), 0);
    assert_eq!(count_rows(&conn, "daily_report_department_lines"), 0);
    assert_eq!(write_surface(&conn), before);
}

#[test]
fn test_daily_report_req401_commit_expired_preview_import_error() {
    // REQ-401 / BIZ-08: TTLを過ぎたpreviewはcommit不可
    let (_dir, mut conn) = setup_test_db();
    let mut parsed = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    parsed.cached_preview.created_at =
        Instant::now() - Duration::from_secs(constants::PREVIEW_CACHE_TTL_SECS + 1);

    let result = commit_daily_report_import(&mut conn, parsed.cached_preview, false);
    assert!(matches!(result, Err(BizError::ImportError(_))));
}

#[test]
fn test_daily_report_req401_stale_additional_preview_same_bundle_conflicts() {
    // REQ-401 / I-B2 / SPEC-SDI-D4: hash-first recheckでstale previewの同一bundle二重取込みを防ぐ。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let second_files = vec![
        z001_with_lines(
            "2026-03-21",
            &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
        ),
        z002("2026-03-21"),
        z005("2026-03-21"),
    ];
    let stale_second = parse_and_validate_daily_report(&conn, second_files.clone()).unwrap();
    assert_eq!(
        stale_second.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::AdditionalImportConfirmationRequired
    );

    let current_second = parse_and_validate_daily_report(&conn, second_files).unwrap();
    commit_daily_report_import(&mut conn, current_second.cached_preview, true).unwrap();

    let before = write_surface(&conn);
    let result = commit_daily_report_import(&mut conn, stale_second.cached_preview, true);
    assert!(matches!(result, Err(BizError::IdempotencyConflict(_))));

    let completed_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM daily_report_imports WHERE report_date = '2026-03-21' AND status = 'completed'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(completed_count, 2);
    let total_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM daily_report_imports WHERE report_date = '2026-03-21'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(total_count, 2);
    assert_eq!(write_surface(&conn), before);
}

#[test]
fn test_daily_report_req401_snapshot_change_requires_repreview_without_side_effects() {
    // REQ-401 / I-W5 / SPEC-SDI-D4: active ID snapshot差分は副作用なしで拒否する。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let stale = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap();
    let concurrent = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[
                    ("101", "総売", "10", "14000"),
                    ("201", "純売", "9", "12500"),
                ],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap();
    commit_daily_report_import(&mut conn, concurrent.cached_preview, true).unwrap();
    let before: i64 = conn
        .query_row("SELECT COUNT(*) FROM daily_report_imports", [], |row| {
            row.get(0)
        })
        .unwrap();
    let before_surface = write_surface(&conn);

    let error = commit_daily_report_import(&mut conn, stale.cached_preview, true).unwrap_err();
    assert!(
        matches!(error, BizError::ImportError(ref message) if message == "同日の取込み状況が変わりました。再度プレビューしてください")
    );
    let after: i64 = conn
        .query_row("SELECT COUNT(*) FROM daily_report_imports", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(after, before);
    assert_eq!(write_surface(&conn), before_surface);
}

#[test]
fn test_daily_report_req401_snapshot_replace_requires_repreview_without_side_effects() {
    // REQ-401 / I-W5 / SPEC-SDI-D4: 同件数のactive parent ID置換もexact snapshotで検出する。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let first = commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();
    let stale = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap();
    rollback_daily_report_import(&mut conn, first.daily_report_import_id).unwrap();
    let replacement = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[
                    ("101", "総売", "10", "14000"),
                    ("201", "純売", "9", "12500"),
                ],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap();
    commit_daily_report_import(&mut conn, replacement.cached_preview, false).unwrap();
    let before = write_surface(&conn);

    let error = commit_daily_report_import(&mut conn, stale.cached_preview, true).unwrap_err();

    assert!(
        matches!(error, BizError::ImportError(ref message) if message == "同日の取込み状況が変わりました。再度プレビューしてください")
    );
    assert_eq!(write_surface(&conn), before);
}

#[test]
fn test_daily_report_req401_commit_already_imported_conflict() {
    // REQ-401 / I-B5 / SPEC-SDI-D3: AlreadyImported previewは副作用なしIdempotencyConflict。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();
    let second = parse_and_validate_daily_report(&conn, valid_files()).unwrap();

    let before = write_surface(&conn);
    let result = commit_daily_report_import(&mut conn, second.cached_preview, false);
    assert!(matches!(result, Err(BizError::IdempotencyConflict(_))));
    assert_eq!(write_surface(&conn), before);
}

#[test]
fn test_daily_report_req401_rollback_idempotent_and_no_stock_change() {
    // REQ-401 / I-B8 / SPEC-SDI-D2: rollback冪等再実行は親statusのみで在庫系列を変えない。
    let (_dir, mut conn) = setup_test_db();
    let parsed = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let committed = commit_daily_report_import(&mut conn, parsed.cached_preview, false).unwrap();

    let first = rollback_daily_report_import(&mut conn, committed.daily_report_import_id).unwrap();
    let second = rollback_daily_report_import(&mut conn, committed.daily_report_import_id).unwrap();
    assert_eq!(first.status, "rolled_back");
    assert_eq!(second.status, "rolled_back");
    let rollback_log_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'daily_report_rollback'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(rollback_log_count, 1);

    for table in ["sale_records", "inventory_movements"] {
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0, "{} must stay empty", table);
    }
}

#[test]
fn test_daily_report_req401_rollback_keeps_same_date_sibling() {
    // REQ-401 / I-B8 / SPEC-SDI-D2,D7: 日報rollbackはper-importで同日siblingを保持する。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let first = commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();
    let second_files = vec![
        z001_with_lines(
            "2026-03-21",
            &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
        ),
        z002("2026-03-21"),
        z005("2026-03-21"),
    ];
    let second = parse_and_validate_daily_report(&conn, second_files).unwrap();
    let second = commit_daily_report_import(&mut conn, second.cached_preview, true).unwrap();

    rollback_daily_report_import(&mut conn, first.daily_report_import_id).unwrap();

    let active = sales_repo::find_daily_report_imports_by_report_date(&conn, "2026-03-21").unwrap();
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].id, second.daily_report_import_id);
    let aggregate = sales_repo::get_completed_daily_report_aggregate(&conn, "2026-03-21")
        .unwrap()
        .unwrap();
    assert_eq!(aggregate.source_import_count, 1);
    assert_eq!(aggregate.gross_amount, Some(13000));
    assert_eq!(aggregate.net_amount, Some(12000));
    assert!(aggregate
        .payment_lines
        .iter()
        .any(|line| line.payment_key == "cash" && line.amount == Some(11000)));

    rollback_daily_report_import(&mut conn, first.daily_report_import_id).unwrap();
    let repeated = sales_repo::get_completed_daily_report_aggregate(&conn, "2026-03-21")
        .unwrap()
        .unwrap();
    assert_eq!(repeated.gross_amount, Some(13000));
}

#[test]
fn test_daily_report_rollback_req401_logs_exact_selected_id_and_survives_log_failure() {
    // REQ-401 / I-B9 / SPEC-SDI-D2: daily log失敗もbusiness rollbackを戻さず、成功logは選択IDを記録する。
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    let first = commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();
    let second = parse_and_validate_daily_report(
        &conn,
        vec![
            z001_with_lines(
                "2026-03-21",
                &[("101", "総売", "9", "13000"), ("201", "純売", "8", "12000")],
            ),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ],
    )
    .unwrap();
    let second = commit_daily_report_import(&mut conn, second.cached_preview, true).unwrap();

    conn.execute_batch(
        "CREATE TRIGGER fail_daily_rollback_log
         BEFORE INSERT ON operation_logs
         WHEN NEW.operation_type = 'daily_report_rollback'
         BEGIN SELECT RAISE(FAIL, 'synthetic log failure'); END;",
    )
    .unwrap();
    let result = rollback_daily_report_import(&mut conn, first.daily_report_import_id).unwrap();
    assert_eq!(result.status, "rolled_back");
    let sibling = sales_repo::find_daily_report_import_by_id(&conn, second.daily_report_import_id)
        .unwrap()
        .unwrap();
    assert_eq!(sibling.status, "completed");

    conn.execute_batch("DROP TRIGGER fail_daily_rollback_log;")
        .unwrap();
    rollback_daily_report_import(&mut conn, second.daily_report_import_id).unwrap();
    let (summary, detail): (String, String) = conn
        .query_row(
            "SELECT summary, detail_json FROM operation_logs
             WHERE operation_type = 'daily_report_rollback' ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert!(summary.contains(&format!("ID {}", second.daily_report_import_id)));
    assert!(detail.contains(&format!(
        r#""daily_report_import_id":{}"#,
        second.daily_report_import_id
    )));
}

#[test]
fn test_daily_report_req401_missing_required_summary() {
    // REQ-401 / BIZ-08: gross_sales/net_salesがともに導出不可ならcommit不可
    let (_dir, conn) = setup_test_db();
    let files = vec![
        z001_with_lines("2026-03-21", &[("999", "客数", "8", "")]),
        z002("2026-03-21"),
        z005("2026-03-21"),
    ];
    let result = parse_and_validate_daily_report(&conn, files);
    assert!(matches!(result, Err(BizError::ImportError(_))));
}

#[test]
fn test_daily_report_req401_list_validation_and_result() {
    // REQ-401 / BIZ-08: listはpage/per_page境界を検証し、repo結果を返す
    let (_dir, mut conn) = setup_test_db();
    let parsed = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, parsed.cached_preview, false).unwrap();

    let page = list_daily_report_imports(
        &conn,
        ListDailyReportImportsQuery {
            page: 1,
            per_page: 10,
            date_from: Some("2026-03-01".to_string()),
            date_to: Some("2026-03-31".to_string()),
            status: None,
        },
    )
    .unwrap();
    assert_eq!(page.total_count, 1);

    let invalid = list_daily_report_imports(
        &conn,
        ListDailyReportImportsQuery {
            page: 0,
            per_page: 10,
            date_from: None,
            date_to: None,
            status: None,
        },
    );
    assert!(matches!(invalid, Err(BizError::ValidationFailed(_))));
}
