use super::*;
use crate::biz::BizError;
use crate::constants;
use crate::db::product_repo::{self, NewProduct};
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
    // REQ-401 / BIZ-08: IO parse errorはImportErrorにし、daily_report_parse_failedを記録する
    let (_dir, conn) = setup_test_db();
    let result = parse_and_validate_daily_report(&conn, vec![z001("2026-03-21")]);

    assert!(matches!(result, Err(BizError::ImportError(_))));
    assert_eq!(count_rows(&conn, "daily_report_imports"), 0);
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'daily_report_parse_failed'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
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
    // REQ-401 / BIZ-08: 同一bundleのcompletedはAlreadyImported
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();

    let second = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    assert_eq!(
        second.preview_data.duplicate_check.status,
        DailyReportDuplicateStatus::AlreadyImported
    );
}

#[test]
fn test_daily_report_req401_overwrite_required_for_same_date_different_bundle() {
    // REQ-401 / BIZ-08: 同日別bundleはOverwriteRequired
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
        DailyReportDuplicateStatus::OverwriteRequired
    );
    assert!(second
        .preview_data
        .duplicate_check
        .existing_import_id
        .is_some());
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
        .any(|w| w.code == "unmatched_department"));
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
fn test_daily_report_req401_commit_overwrite_rolls_back_old() {
    // REQ-401 / BIZ-08: overwrite確定時は同日completedをrolled_backにして新規作成する
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
    assert_eq!(old_status, "rolled_back");
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
fn test_daily_report_req401_commit_overwrite_unconfirmed_validation_failed() {
    // REQ-401 / BIZ-08: OverwriteRequired preview は overwrite_confirmed=false でValidationFailed
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
        DailyReportDuplicateStatus::OverwriteRequired
    );

    let result = commit_daily_report_import(&mut conn, second.cached_preview, false);
    assert!(matches!(result, Err(BizError::ValidationFailed(_))));
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
fn test_daily_report_req401_stale_overwrite_preview_same_bundle_conflicts() {
    // REQ-401 / BIZ-08: 古いOverwriteRequiredプレビューでも同一bundleの二重取込みを防ぐ
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
        DailyReportDuplicateStatus::OverwriteRequired
    );

    let current_second = parse_and_validate_daily_report(&conn, second_files).unwrap();
    commit_daily_report_import(&mut conn, current_second.cached_preview, true).unwrap();

    let result = commit_daily_report_import(&mut conn, stale_second.cached_preview, true);
    assert!(matches!(result, Err(BizError::IdempotencyConflict(_))));

    let completed_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM daily_report_imports WHERE report_date = '2026-03-21' AND status = 'completed'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(completed_count, 1);
    let total_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM daily_report_imports WHERE report_date = '2026-03-21'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(total_count, 2);
}

#[test]
fn test_daily_report_req401_commit_already_imported_conflict() {
    // REQ-401 / BIZ-08: AlreadyImported previewをcommitしようとするとIdempotencyConflict
    let (_dir, mut conn) = setup_test_db();
    let first = parse_and_validate_daily_report(&conn, valid_files()).unwrap();
    commit_daily_report_import(&mut conn, first.cached_preview, false).unwrap();
    let second = parse_and_validate_daily_report(&conn, valid_files()).unwrap();

    let result = commit_daily_report_import(&mut conn, second.cached_preview, false);
    assert!(matches!(result, Err(BizError::IdempotencyConflict(_))));
}

#[test]
fn test_daily_report_req401_rollback_idempotent_and_no_stock_change() {
    // REQ-401 / BIZ-08 / D-025: rollbackは親statusのみ。在庫・sale_records・movementsを変えない
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
