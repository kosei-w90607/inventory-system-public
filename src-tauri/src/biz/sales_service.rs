//! BIZ-05: 売上集計ロジック
//!
//! 日次・月次の売上データを集計し、レポート画面とCSVエクスポートに必要なデータを提供する。
//! is_voided=0 のレコードのみ対象。読み取り専用、TX不要。
//!
//! docs/function-design/34-biz-sales-service.md に基づく実装。

use crate::biz::BizError;
use crate::db::sales_repo;
use crate::db::DbConnection;
use crate::io::report_csv_exporter;
use chrono::NaiveDate;
use std::collections::BTreeMap;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 集計モード
///
/// response serialize 時に snake_case 出力（"by_product" / "by_department"）。
/// request 引数は `get_monthly_sales(mode: String)` で受け取り CMD 層で変換する（H-1）。
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum SalesMode {
    ByProduct,
    ByDepartment,
}

/// 日次売上アイテム（BIZ公開型。DB型からマッピング）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct DailySaleItem {
    pub product_code: String,
    pub name: String,
    pub department_name: String,
    pub department_id: i64,
    pub quantity: i64,
    pub amount: i64,
    pub source: String,
}

/// 日次売上レポート
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct DailySalesReport {
    pub date: String,
    pub items: Vec<DailySaleItem>,
    pub department_subtotals: Vec<DeptSubtotal>,
    pub grand_total: GrandTotal,
    pub official_daily_report: Option<OfficialDailyReportSummary>,
}

/// 部門小計
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct DeptSubtotal {
    pub department_id: i64,
    pub department_name: String,
    pub quantity: i64,
    pub amount: i64,
}

/// 総合計
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct GrandTotal {
    pub quantity: i64,
    pub amount: i64,
}

/// レジ日報由来の公式日次サマリ
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct OfficialDailyReportSummary {
    pub daily_report_import_id: i64,
    pub report_date: String,
    pub gross_amount: Option<i64>,
    pub net_amount: Option<i64>,
    pub payment_lines: Vec<OfficialDailyPaymentLine>,
    pub department_lines: Vec<OfficialDailyDepartmentLine>,
    pub warnings: Vec<String>,
}

/// レジ日報由来の支払集計行
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct OfficialDailyPaymentLine {
    pub payment_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub count: Option<i64>,
}

/// レジ日報由来の部門別集計行
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct OfficialDailyDepartmentLine {
    pub department_id: Option<i64>,
    pub raw_department_name: String,
    pub normalized_department_name: Option<String>,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
}

/// 月次売上レポート
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct MonthlySalesReport {
    pub month: String,
    pub mode: SalesMode,
    pub items: Vec<MonthlySaleItem>,
    pub prev_month_comparison: Option<Vec<MonthlySaleItem>>,
    pub official_department_totals: Option<Vec<OfficialMonthlyDepartmentTotal>>,
}

/// 月次売上集計アイテム（ランキング付き）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct MonthlySaleItem {
    pub key: String,
    pub label: String,
    pub quantity: i64,
    pub amount: i64,
    pub ranking: u32,
}

/// レジ日報由来の月次公式部門集計行
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct OfficialMonthlyDepartmentTotal {
    pub department_id: Option<i64>,
    pub label: String,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
}

/// レポート種別（CSVエクスポート用）
///
/// `serde::Deserialize` + `specta::Type` + `#[serde(rename_all = "snake_case")]` で
/// frontend bindings から `"daily" | "monthly_by_product" | "monthly_by_department"` literal union として
/// 受け取り、CMD 層で文字列 validation なく直接 enum として deserialize される（H-5 / Q-6 A 案）。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum SalesReportType {
    /// 日次（target: YYYY-MM-DD）
    Daily,
    /// 月次・商品別（target: YYYY-MM）
    MonthlyByProduct,
    /// 月次・部門別（target: YYYY-MM）
    MonthlyByDepartment,
}

/// CSVエクスポート結果
#[derive(Debug)]
pub struct SalesCsvExportResult {
    /// UTF-8 BOM付きCSVバイト列
    pub csv_bytes: Vec<u8>,
    /// レコード件数
    pub count: usize,
    /// 推奨ファイル名
    pub suggested_filename: String,
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// 指定日の売上データを商品別に集計し、部門小計と総合計を含むレポートを返す
///
/// 34-biz-sales-service.md セクション19.3
pub fn get_daily_sales(conn: &DbConnection, date: &str) -> Result<DailySalesReport, BizError> {
    // Step 1: 日付バリデーション
    validate_date(date)?;

    // Step 2: 商品別売上取得 + DB型 -> BIZ型マッピング
    let db_rows = sales_repo::get_daily_sales_records(conn, date)?;
    let items: Vec<DailySaleItem> = db_rows
        .into_iter()
        .map(|r| DailySaleItem {
            product_code: r.product_code,
            name: r.name,
            department_name: r.department_name,
            department_id: r.department_id,
            quantity: r.quantity,
            amount: r.amount,
            source: r.source,
        })
        .collect();

    // Step 3: 部門小計の計算（BTreeMap で部門ID昇順を保証）
    let mut dept_map: BTreeMap<i64, (String, i64, i64)> = BTreeMap::new();
    for item in &items {
        let entry = dept_map
            .entry(item.department_id)
            .or_insert_with(|| (item.department_name.clone(), 0, 0));
        entry.1 += item.quantity;
        entry.2 += item.amount;
    }
    let department_subtotals: Vec<DeptSubtotal> = dept_map
        .into_iter()
        .map(|(id, (name, qty, amt))| DeptSubtotal {
            department_id: id,
            department_name: name,
            quantity: qty,
            amount: amt,
        })
        .collect();

    // Step 4: 総合計
    let grand_total = GrandTotal {
        quantity: items.iter().map(|i| i.quantity).sum(),
        amount: items.iter().map(|i| i.amount).sum(),
    };

    let official_daily_report =
        sales_repo::get_latest_completed_daily_report(conn, date)?.map(map_official_daily_report);

    Ok(DailySalesReport {
        date: date.to_string(),
        items,
        department_subtotals,
        grand_total,
        official_daily_report,
    })
}

/// 指定月の売上データを商品別または部門別に集計し、ランキングと前月比較を含むレポートを返す
///
/// 34-biz-sales-service.md セクション19.4
pub fn get_monthly_sales(
    conn: &DbConnection,
    month: &str,
    mode: SalesMode,
) -> Result<MonthlySalesReport, BizError> {
    // Step 1: 月バリデーション
    let (year, month_num) = validate_month(month)?;

    // Step 2: 対象月の日付範囲
    let (date_from, date_to) = month_date_range(year, month_num);

    // Step 3-4: 集計 + ランキング
    let items = fetch_and_rank(conn, &date_from, &date_to, &mode)?;

    // Step 5: 前月比較
    let (prev_year, prev_month) = if month_num == 1 {
        (year - 1, 12)
    } else {
        (year, month_num - 1)
    };
    let (prev_from, prev_to) = month_date_range(prev_year, prev_month);
    let prev_items = fetch_and_rank(conn, &prev_from, &prev_to, &mode)?;
    let prev_month_comparison = Some(prev_items);
    let official_department_totals = sales_repo::get_monthly_official_department_totals(
        conn, &date_from, &date_to,
    )?
    .map(|rows| {
        rows.into_iter()
            .map(|row| OfficialMonthlyDepartmentTotal {
                department_id: row.department_id,
                label: row.label,
                amount: row.amount,
                quantity: row.quantity,
                count: row.count,
            })
            .collect()
    });

    Ok(MonthlySalesReport {
        month: month.to_string(),
        mode,
        items,
        prev_month_comparison,
        official_department_totals,
    })
}

/// 指定日または指定月の売上データをCSVバイト列としてエクスポートする
///
/// 34-biz-sales-service.md §19.5 export_sales_csv
pub fn export_sales_csv(
    conn: &DbConnection,
    report_type: &SalesReportType,
    target: &str,
) -> Result<SalesCsvExportResult, BizError> {
    let (headers, rows, count, suggested_filename) = match report_type {
        SalesReportType::Daily => {
            let report = get_daily_sales(conn, target)?;
            let headers = vec![
                "商品コード".to_string(),
                "商品名".to_string(),
                "部門".to_string(),
                "数量".to_string(),
                "金額".to_string(),
                "記録元".to_string(),
            ];
            let rows: Vec<Vec<String>> = report
                .items
                .iter()
                .map(|item| {
                    vec![
                        item.product_code.clone(),
                        item.name.clone(),
                        item.department_name.clone(),
                        item.quantity.to_string(),
                        item.amount.to_string(),
                        translate_source(&item.source).to_string(),
                    ]
                })
                .collect();
            let count = report.items.len();
            let filename = format!("sales_daily_{}.csv", target);
            (headers, rows, count, filename)
        }
        SalesReportType::MonthlyByProduct => {
            let report = get_monthly_sales(conn, target, SalesMode::ByProduct)?;
            let headers = vec![
                "ランク".to_string(),
                "商品コード".to_string(),
                "商品名".to_string(),
                "数量".to_string(),
                "金額".to_string(),
            ];
            let rows: Vec<Vec<String>> = report
                .items
                .iter()
                .map(|item| {
                    vec![
                        item.ranking.to_string(),
                        item.key.clone(),
                        item.label.clone(),
                        item.quantity.to_string(),
                        item.amount.to_string(),
                    ]
                })
                .collect();
            let count = report.items.len();
            let filename = format!("sales_monthly_product_{}.csv", target);
            (headers, rows, count, filename)
        }
        SalesReportType::MonthlyByDepartment => {
            let report = get_monthly_sales(conn, target, SalesMode::ByDepartment)?;
            let headers = vec![
                "ランク".to_string(),
                "部門名".to_string(),
                "数量".to_string(),
                "金額".to_string(),
            ];
            let rows: Vec<Vec<String>> = report
                .items
                .iter()
                .map(|item| {
                    vec![
                        item.ranking.to_string(),
                        item.label.clone(),
                        item.quantity.to_string(),
                        item.amount.to_string(),
                    ]
                })
                .collect();
            let count = report.items.len();
            let filename = format!("sales_monthly_dept_{}.csv", target);
            (headers, rows, count, filename)
        }
    };

    let csv_bytes = report_csv_exporter::export_csv(&headers, &rows);

    Ok(SalesCsvExportResult {
        csv_bytes,
        count,
        suggested_filename,
    })
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

/// 売上記録元の日本語変換（CSV出力用）
fn translate_source(source: &str) -> &str {
    match source {
        "auto" => "POS",
        "manual" => "手動",
        other => other,
    }
}

/// YYYY-MM-DD 形式の日付をバリデーションする
fn validate_date(date: &str) -> Result<(), BizError> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| {
        if date.len() == 10 && date.chars().nth(4) == Some('-') && date.chars().nth(7) == Some('-')
        {
            BizError::ValidationFailed("存在しない日付です".to_string())
        } else {
            BizError::ValidationFailed("日付の形式が不正です（YYYY-MM-DD）".to_string())
        }
    })?;
    Ok(())
}

/// YYYY-MM 形式の月をバリデーションし、(year, month) を返す
fn validate_month(month: &str) -> Result<(i32, u32), BizError> {
    if month.len() != 7 || month.chars().nth(4) != Some('-') {
        return Err(BizError::ValidationFailed(
            "月の形式が不正です（YYYY-MM）".to_string(),
        ));
    }
    let year: i32 = month[..4]
        .parse()
        .map_err(|_| BizError::ValidationFailed("月の形式が不正です（YYYY-MM）".to_string()))?;
    let month_num: u32 = month[5..7]
        .parse()
        .map_err(|_| BizError::ValidationFailed("月の形式が不正です（YYYY-MM）".to_string()))?;

    if !(1..=12).contains(&month_num) {
        return Err(BizError::ValidationFailed("存在しない月です".to_string()));
    }

    Ok((year, month_num))
}

/// 指定年月の日付範囲（YYYY-MM-DD, YYYY-MM-DD）を返す
fn month_date_range(year: i32, month: u32) -> (String, String) {
    let first_day =
        NaiveDate::from_ymd_opt(year, month, 1).expect("month_date_range: invalid year/month");

    // 月末日: 翌月1日の前日
    let last_day = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap() - chrono::Duration::days(1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap() - chrono::Duration::days(1)
    };

    (
        first_day.format("%Y-%m-%d").to_string(),
        last_day.format("%Y-%m-%d").to_string(),
    )
}

fn map_official_daily_report(
    row: sales_repo::OfficialDailyReportRow,
) -> OfficialDailyReportSummary {
    let unmatched_count = row
        .department_lines
        .iter()
        .filter(|line| line.department_id.is_none())
        .count();
    let warnings = if unmatched_count == 0 {
        Vec::new()
    } else {
        vec![format!(
            "部門マスタと対応していない部門が {} 件あります（部門名のまま表示しています）",
            unmatched_count
        )]
    };

    OfficialDailyReportSummary {
        daily_report_import_id: row.daily_report_import_id,
        report_date: row.report_date,
        gross_amount: row.gross_amount,
        net_amount: row.net_amount,
        payment_lines: row
            .payment_lines
            .into_iter()
            .map(|line| OfficialDailyPaymentLine {
                payment_key: line.payment_key,
                label: line.label,
                amount: line.amount,
                count: line.count,
            })
            .collect(),
        department_lines: row
            .department_lines
            .into_iter()
            .map(|line| OfficialDailyDepartmentLine {
                department_id: line.department_id,
                raw_department_name: line.raw_department_name,
                normalized_department_name: line.normalized_department_name,
                amount: line.amount,
                quantity: line.quantity,
                count: line.count,
            })
            .collect(),
        warnings,
    }
}

/// モード別集計を取得し、ランキングを付与する
fn fetch_and_rank(
    conn: &DbConnection,
    date_from: &str,
    date_to: &str,
    mode: &SalesMode,
) -> Result<Vec<MonthlySaleItem>, BizError> {
    let mut items: Vec<MonthlySaleItem> = match mode {
        SalesMode::ByProduct => {
            let rows = sales_repo::get_monthly_sales_by_product(conn, date_from, date_to)?;
            rows.into_iter()
                .map(|r| MonthlySaleItem {
                    key: r.product_code,
                    label: r.name,
                    quantity: r.quantity,
                    amount: r.amount,
                    ranking: 0,
                })
                .collect()
        }
        SalesMode::ByDepartment => {
            let rows = sales_repo::get_monthly_sales_by_department(conn, date_from, date_to)?;
            rows.into_iter()
                .map(|r| MonthlySaleItem {
                    key: r.department_id.to_string(),
                    label: r.department_name,
                    quantity: r.quantity,
                    amount: r.amount,
                    ranking: 0,
                })
                .collect()
        }
    };

    // amount 降順ソート（DB側で既にソート済みだが、明示的に保証）
    // amount 降順、同額時は key 昇順でタイブレーク（安定した順序を保証）
    items.sort_by(|a, b| b.amount.cmp(&a.amount).then_with(|| a.key.cmp(&b.key)));

    // ランキング付与（1始まり、row number方式）
    for (i, item) in items.iter_mut().enumerate() {
        item.ranking = (i + 1) as u32;
    }

    Ok(items)
}

// ===========================================================================
// テスト
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use crate::db::product_repo::{self, NewProduct};
    use crate::db::sales_repo::{
        NewDailyReportDepartmentLine, NewDailyReportImport, NewDailyReportPaymentLine,
        NewSaleRecord,
    };

    fn setup_test_db() -> (tempfile::TempDir, crate::db::DbConnection) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();
        (dir, conn)
    }

    fn seed_product(conn: &DbConnection, code: &str, dept_id: i64) {
        let product = NewProduct {
            product_code: code.to_string(),
            jan_code: None,
            name: format!("商品{}", code),
            department_id: dept_id,
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

    fn seed_sale(conn: &DbConnection, code: &str, date: &str, qty: i64, amt: i64, source: &str) {
        let record = NewSaleRecord {
            csv_import_id: None,
            product_code: code.to_string(),
            sale_date: date.to_string(),
            quantity: qty,
            amount: amt,
            source: source.to_string(),
            source_line_no: None,
            reason: None,
            note: None,
        };
        sales_repo::insert_sale_record(conn, &record).unwrap();
    }

    fn seed_daily_report(conn: &DbConnection, report_date: &str, bundle_hash: &str) -> i64 {
        sales_repo::insert_daily_report_import(
            conn,
            &NewDailyReportImport {
                report_date: report_date.to_string(),
                source_adapter: "casio_sr_s4000".to_string(),
                bundle_hash: bundle_hash.to_string(),
                source_files_json: "[]".to_string(),
                gross_amount: Some(12000),
                net_amount: Some(11000),
                status: "completed".to_string(),
                note: None,
            },
        )
        .unwrap()
    }

    fn seed_daily_report_lines(conn: &DbConnection, import_id: i64, department_id: Option<i64>) {
        sales_repo::insert_daily_report_payment_lines(
            conn,
            &[NewDailyReportPaymentLine {
                daily_report_import_id: import_id,
                source_file: "Z002".to_string(),
                payment_key: "cash".to_string(),
                label: "現金".to_string(),
                amount: Some(11000),
                count: Some(7),
                sort_order: 1,
            }],
        )
        .unwrap();
        sales_repo::insert_daily_report_department_lines(
            conn,
            &[NewDailyReportDepartmentLine {
                daily_report_import_id: import_id,
                source_file: "Z005".to_string(),
                department_id,
                raw_department_name: "その他小物".to_string(),
                normalized_department_name: Some("その他小物".to_string()),
                amount: 11000,
                quantity: Some(7),
                count: Some(3),
                sort_order: 1,
            }],
        )
        .unwrap();
    }

    // -------------------------------------------------------------------
    // get_daily_sales
    // -------------------------------------------------------------------

    #[test]
    fn test_daily_sales_req501_normal() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 19.3: 正常取得 + subtotal + grand_total
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 3);
        seed_sale(&conn, "P001", "2026-03-21", 2, 1000, "auto");
        seed_sale(&conn, "P002", "2026-03-21", 1, 500, "manual");

        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        assert_eq!(report.items.len(), 2);
        assert_eq!(report.department_subtotals.len(), 2);
        assert_eq!(report.grand_total.quantity, 3);
        assert_eq!(report.grand_total.amount, 1500);
    }

    #[test]
    fn test_daily_sales_req501_invalid_date_format() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 19.3: 不正形式
        let (_dir, conn) = setup_test_db();
        let err = get_daily_sales(&conn, "2026/03/21").unwrap_err();
        assert!(matches!(err, BizError::ValidationFailed(_)));
    }

    #[test]
    fn test_daily_sales_req501_invalid_date_value() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 19.3: 存在しない日付
        let (_dir, conn) = setup_test_db();
        let err = get_daily_sales(&conn, "2026-02-30").unwrap_err();
        assert!(matches!(err, BizError::ValidationFailed(_)));
    }

    #[test]
    fn test_daily_sales_req501_empty_date() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 19.3: データなし -> 空レポート
        let (_dir, conn) = setup_test_db();
        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        assert!(report.items.is_empty());
        assert!(report.department_subtotals.is_empty());
        assert_eq!(report.grand_total.quantity, 0);
        assert_eq!(report.grand_total.amount, 0);
        assert!(report.official_daily_report.is_none());
    }

    #[test]
    fn test_daily_sales_req501_dept_subtotals() {
        // REQ-501: 日次売上（日付別商品売上集計）
        // 19.3: 複数部門の小計
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 1);
        seed_product(&conn, "P003", 3);
        seed_sale(&conn, "P001", "2026-03-21", 2, 1000, "auto");
        seed_sale(&conn, "P002", "2026-03-21", 3, 1500, "auto");
        seed_sale(&conn, "P003", "2026-03-21", 1, 800, "auto");

        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        assert_eq!(report.department_subtotals.len(), 2);

        // 部門ID=1: P001+P002 = qty5, amt2500
        let dept1 = &report.department_subtotals[0];
        assert_eq!(dept1.department_id, 1);
        assert_eq!(dept1.quantity, 5);
        assert_eq!(dept1.amount, 2500);

        // 部門ID=3: P003 = qty1, amt800
        let dept3 = &report.department_subtotals[1];
        assert_eq!(dept3.department_id, 3);
        assert_eq!(dept3.quantity, 1);
        assert_eq!(dept3.amount, 800);
    }

    #[test]
    fn test_get_daily_sales_includes_official_report_req501() {
        // REQ-501: 日次売上公式日報表示
        // 19.3: daily_report_* 保存済み行をofficial_daily_reportとして返す
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report(&conn, "2026-03-21", "official-daily");
        seed_daily_report_lines(&conn, import_id, Some(1));

        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        let official = report.official_daily_report.unwrap();
        assert_eq!(official.daily_report_import_id, import_id);
        assert_eq!(official.report_date, "2026-03-21");
        assert_eq!(official.gross_amount, Some(12000));
        assert_eq!(official.net_amount, Some(11000));
        assert_eq!(official.payment_lines[0].payment_key, "cash");
        assert_eq!(official.payment_lines[0].amount, Some(11000));
        assert_eq!(official.department_lines[0].amount, 11000);
    }

    #[test]
    fn test_get_daily_sales_no_fake_items_req501() {
        // REQ-501: 日次売上公式日報表示
        // 19.3: 日報取込みだけでは商品別明細・商品別小計・総合計を水増ししない
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report(&conn, "2026-03-21", "official-no-items");
        seed_daily_report_lines(&conn, import_id, Some(1));

        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        assert!(report.official_daily_report.is_some());
        assert!(report.items.is_empty());
        assert!(report.department_subtotals.is_empty());
        assert_eq!(report.grand_total.quantity, 0);
        assert_eq!(report.grand_total.amount, 0);
    }

    #[test]
    fn test_get_daily_sales_without_official_report_req501() {
        // REQ-501: 日次売上公式日報表示
        // 19.3: 日報未取込みでも既存商品別売上は取得できる
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-03-21", 2, 1000, "auto");

        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        assert!(report.official_daily_report.is_none());
        assert_eq!(report.items.len(), 1);
        assert_eq!(report.grand_total.amount, 1000);
    }

    #[test]
    fn test_get_daily_sales_warnings_unmatched_department_req501() {
        // REQ-501: 日次売上公式日報表示
        // SALES2-D5: department_id NULL の日報部門行は公式セクション内warningにまとめる
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report(&conn, "2026-03-21", "official-warning");
        seed_daily_report_lines(&conn, import_id, None);

        let report = get_daily_sales(&conn, "2026-03-21").unwrap();
        let official = report.official_daily_report.unwrap();
        assert_eq!(official.warnings.len(), 1);
        assert_eq!(
            official.warnings[0],
            "部門マスタと対応していない部門が 1 件あります（部門名のまま表示しています）"
        );
    }

    // -------------------------------------------------------------------
    // get_monthly_sales
    // -------------------------------------------------------------------

    #[test]
    fn test_monthly_sales_req502_by_product_normal() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 商品別 + ランキング
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 1);
        seed_sale(&conn, "P001", "2026-03-10", 5, 2500, "auto");
        seed_sale(&conn, "P002", "2026-03-15", 1, 800, "auto");

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        assert_eq!(report.items.len(), 2);
        assert_eq!(report.items[0].key, "P001");
        assert_eq!(report.items[0].ranking, 1);
        assert_eq!(report.items[1].key, "P002");
        assert_eq!(report.items[1].ranking, 2);
    }

    #[test]
    fn test_monthly_sales_req502_by_department_normal() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 部門別
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 3);
        seed_sale(&conn, "P001", "2026-03-10", 2, 1000, "auto");
        seed_sale(&conn, "P002", "2026-03-15", 5, 3000, "auto");

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByDepartment).unwrap();
        assert_eq!(report.items.len(), 2);
        assert_eq!(report.items[0].key, "3"); // 毛糸 3000 > その他小物 1000
        assert_eq!(report.items[0].ranking, 1);
    }

    #[test]
    fn test_monthly_sales_req502_invalid_month_format() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 不正形式
        let (_dir, conn) = setup_test_db();
        let err = get_monthly_sales(&conn, "2026/03", SalesMode::ByProduct).unwrap_err();
        assert!(matches!(err, BizError::ValidationFailed(_)));
    }

    #[test]
    fn test_monthly_sales_req502_invalid_month_13() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 月=13
        let (_dir, conn) = setup_test_db();
        let err = get_monthly_sales(&conn, "2026-13", SalesMode::ByProduct).unwrap_err();
        assert!(matches!(err, BizError::ValidationFailed(_)));
    }

    #[test]
    fn test_monthly_sales_req502_ranking_order() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: amount降順 ranking=1,2,3
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "A", 1);
        seed_product(&conn, "B", 1);
        seed_product(&conn, "C", 1);
        seed_sale(&conn, "A", "2026-03-10", 1, 100, "auto");
        seed_sale(&conn, "B", "2026-03-10", 1, 300, "auto");
        seed_sale(&conn, "C", "2026-03-10", 1, 200, "auto");

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        assert_eq!(report.items[0].key, "B"); // 300
        assert_eq!(report.items[0].ranking, 1);
        assert_eq!(report.items[1].key, "C"); // 200
        assert_eq!(report.items[1].ranking, 2);
        assert_eq!(report.items[2].key, "A"); // 100
        assert_eq!(report.items[2].ranking, 3);
    }

    #[test]
    fn test_monthly_sales_req502_prev_month_comparison() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 前月データあり -> Some(非空)
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-02-15", 2, 1000, "auto");
        seed_sale(&conn, "P001", "2026-03-15", 3, 1500, "auto");

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        assert_eq!(report.items.len(), 1);
        let prev = report.prev_month_comparison.as_ref().unwrap();
        assert_eq!(prev.len(), 1);
        assert_eq!(prev[0].amount, 1000);
    }

    #[test]
    fn test_monthly_sales_req502_prev_month_none() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 前月データなし -> Some(空Vec)
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-03-15", 3, 1500, "auto");

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        let prev = report.prev_month_comparison.as_ref().unwrap();
        assert!(prev.is_empty());
        assert!(report.official_department_totals.is_none());
    }

    #[test]
    fn test_monthly_sales_req502_year_boundary() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 2026-01 -> 前月 2025-12
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2025-12-20", 2, 1000, "auto");
        seed_sale(&conn, "P001", "2026-01-10", 3, 1500, "auto");

        let report = get_monthly_sales(&conn, "2026-01", SalesMode::ByProduct).unwrap();
        assert_eq!(report.items.len(), 1);
        assert_eq!(report.items[0].amount, 1500);

        let prev = report.prev_month_comparison.as_ref().unwrap();
        assert_eq!(prev.len(), 1);
        assert_eq!(prev[0].amount, 1000, "2025-12の前月データ");
    }

    #[test]
    fn test_monthly_sales_req502_with_returns() {
        // REQ-502: 月次売上（月次商品別/部門別集計）
        // 19.4: 返品（負数量）の集計
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_sale(&conn, "P001", "2026-03-10", 5, 2500, "auto");
        seed_sale(&conn, "P001", "2026-03-15", -1, -500, "auto");

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        assert_eq!(report.items.len(), 1);
        assert_eq!(report.items[0].quantity, 4, "5 + (-1) = 4");
        assert_eq!(report.items[0].amount, 2000, "2500 + (-500) = 2000");
    }

    #[test]
    fn test_get_monthly_sales_official_department_totals_req502() {
        // REQ-502: 月次売上公式部門集計
        // 19.4: 日報部門行はofficial_department_totalsで返す
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report(&conn, "2026-03-21", "official-monthly");
        seed_daily_report_lines(&conn, import_id, Some(1));

        let report = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        let official = report.official_department_totals.unwrap();
        assert_eq!(official.len(), 1);
        assert_eq!(official[0].department_id, Some(1));
        assert_eq!(official[0].label, "その他小物");
        assert_eq!(official[0].amount, 11000);
    }

    #[test]
    fn test_get_monthly_sales_no_fake_ranking_req502() {
        // REQ-502: 月次売上公式部門集計
        // 19.4: 日報部門行だけでは商品ランキング/商品別由来部門集計を水増ししない
        let (_dir, conn) = setup_test_db();
        let import_id = seed_daily_report(&conn, "2026-03-21", "official-no-ranking");
        seed_daily_report_lines(&conn, import_id, Some(1));

        let by_product = get_monthly_sales(&conn, "2026-03", SalesMode::ByProduct).unwrap();
        assert!(by_product.official_department_totals.is_some());
        assert!(by_product.items.is_empty());

        let by_department = get_monthly_sales(&conn, "2026-03", SalesMode::ByDepartment).unwrap();
        assert!(by_department.official_department_totals.is_some());
        assert!(by_department.items.is_empty());
    }

    // -------------------------------------------------------------------
    // export_sales_csv
    // -------------------------------------------------------------------

    #[test]
    fn test_export_sales_csv_req501_daily_normal() {
        // REQ-501: 日次売上CSVエクスポート — 正常系
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 3);
        seed_sale(&conn, "P001", "2026-03-21", 2, 1000, "auto");
        seed_sale(&conn, "P002", "2026-03-21", 1, 500, "manual");

        let result = export_sales_csv(&conn, &SalesReportType::Daily, "2026-03-21").unwrap();

        // 件数
        assert_eq!(result.count, 2);
        // ファイル名
        assert_eq!(result.suggested_filename, "sales_daily_2026-03-21.csv");
        // UTF-8 BOM
        assert_eq!(&result.csv_bytes[..3], &[0xEF, 0xBB, 0xBF]);
        // CSVの中身を検証
        let csv_str = String::from_utf8(result.csv_bytes[3..].to_vec()).unwrap();
        assert!(csv_str.starts_with("商品コード,商品名,部門,数量,金額,記録元\r\n"));
        assert!(csv_str.contains("P001"));
        assert!(csv_str.contains("P002"));
    }

    #[test]
    fn test_export_sales_csv_req501_daily_empty() {
        // REQ-501: 日次 — 売上0件 → ヘッダのみCSV
        let (_dir, conn) = setup_test_db();

        let result = export_sales_csv(&conn, &SalesReportType::Daily, "2026-03-21").unwrap();
        assert_eq!(result.count, 0);

        let csv_str = String::from_utf8(result.csv_bytes[3..].to_vec()).unwrap();
        assert!(csv_str.starts_with("商品コード,商品名,部門,数量,金額,記録元\r\n"));
        // ヘッダ行のみ（データ行なし）
        assert_eq!(csv_str.lines().count(), 1);
    }

    #[test]
    fn test_export_sales_csv_req501_daily_source() {
        // REQ-501: source翻訳 — "auto"→"POS"、"manual"→"手動"
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 1);
        seed_sale(&conn, "P001", "2026-03-21", 1, 500, "auto");
        seed_sale(&conn, "P002", "2026-03-21", 1, 300, "manual");

        let result = export_sales_csv(&conn, &SalesReportType::Daily, "2026-03-21").unwrap();
        let csv_str = String::from_utf8(result.csv_bytes[3..].to_vec()).unwrap();
        assert!(csv_str.contains("POS"), "auto → POS");
        assert!(csv_str.contains("手動"), "manual → 手動");
        assert!(!csv_str.contains(",auto"), "auto が生のまま残っていない");
        assert!(
            !csv_str.contains(",manual"),
            "manual が生のまま残っていない"
        );
    }

    #[test]
    fn test_export_sales_csv_req502_monthly_product() {
        // REQ-502: 月次商品別CSVエクスポート
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 1);
        seed_sale(&conn, "P001", "2026-03-10", 5, 2500, "auto");
        seed_sale(&conn, "P002", "2026-03-15", 1, 800, "auto");

        let result =
            export_sales_csv(&conn, &SalesReportType::MonthlyByProduct, "2026-03").unwrap();
        assert_eq!(result.count, 2);
        assert_eq!(
            result.suggested_filename,
            "sales_monthly_product_2026-03.csv"
        );

        let csv_str = String::from_utf8(result.csv_bytes[3..].to_vec()).unwrap();
        assert!(csv_str.starts_with("ランク,商品コード,商品名,数量,金額\r\n"));
        // ランク1がP001（金額2500）
        assert!(csv_str.contains("1,P001"));
    }

    #[test]
    fn test_export_sales_csv_req502_monthly_dept() {
        // REQ-502: 月次部門別CSVエクスポート
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "P001", 1);
        seed_product(&conn, "P002", 3);
        seed_sale(&conn, "P001", "2026-03-10", 2, 1000, "auto");
        seed_sale(&conn, "P002", "2026-03-15", 5, 3000, "auto");

        let result =
            export_sales_csv(&conn, &SalesReportType::MonthlyByDepartment, "2026-03").unwrap();
        assert_eq!(result.count, 2);
        assert_eq!(result.suggested_filename, "sales_monthly_dept_2026-03.csv");

        let csv_str = String::from_utf8(result.csv_bytes[3..].to_vec()).unwrap();
        assert!(csv_str.starts_with("ランク,部門名,数量,金額\r\n"));
    }

    #[test]
    fn test_export_sales_csv_req501_invalid_date() {
        // REQ-501: 不正日付 → ValidationFailed
        let (_dir, conn) = setup_test_db();
        let err = export_sales_csv(&conn, &SalesReportType::Daily, "2026/03/21").unwrap_err();
        assert!(matches!(err, BizError::ValidationFailed(_)));
    }
}
