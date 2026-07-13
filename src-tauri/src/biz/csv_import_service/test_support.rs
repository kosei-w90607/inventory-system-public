//! BIZ-03 テスト共有ヘルパー

use crate::biz::csv_import_service::parse::parse_and_validate;
use crate::biz::csv_import_service::{CsvParseAndValidateRequest, ParseValidateResult};
use crate::db::DbConnection;
use encoding_rs::SHIFT_JIS;

/// JAN付き商品を作成するテストヘルパー
///
/// department_id=1（初期データ「その他小物」）を使用。
pub(super) fn create_test_product_with_jan(
    conn: &DbConnection,
    product_code: &str,
    jan_code: &str,
    stock: i64,
    pos_stock_sync: bool,
) {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO products (product_code, jan_code, name, department_id, selling_price, cost_price, tax_rate, stock_quantity, stock_unit, is_discontinued, plu_dirty, pos_stock_sync, created_at, updated_at)
         VALUES (?1, ?2, ?3, 1, 100, 50, '10', ?4, 'pcs', 0, 1, ?5, ?6, ?7)",
        rusqlite::params![product_code, jan_code, format!("テスト商品 {}", product_code), stock, pos_stock_sync, now, now],
    )
    .expect("テスト商品の作成に失敗");
}

/// テスト用Z004バイト列を生成する
///
/// data_lines: (jan, name, quantity, amount) のスライス
pub(super) fn make_z004_bytes(
    settlement_date: &str,
    data_lines: &[(&str, &str, i32, i32)],
) -> Vec<u8> {
    let mut lines = Vec::new();
    // 1行目: メタ行（日付含む）
    lines.push(format!("\"精算日\",\"{}\",\"\",\"\",\"\"", settlement_date));
    // 2行目: ヘッダ（読み飛ばし）
    lines.push("\"No.\",\"スキャニングコード\",\"商品名\",\"個数\",\"金額\"".to_string());
    // 3行目以降: データ行
    for (i, (jan, name, qty, amt)) in data_lines.iter().enumerate() {
        lines.push(format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"",
            i + 1,
            jan,
            name,
            qty,
            amt
        ));
    }

    let text = lines.join("\r\n");
    let (encoded, _, _) = SHIFT_JIS.encode(&text);
    encoded.into_owned()
}

/// parse_and_validate を呼んで結果を返す（commit/rollback テストの前段処理用）
///
/// パースが成功することを前提とする。失敗時はpanic。
pub(super) fn parse_and_build_cache(
    conn: &DbConnection,
    file_bytes: Vec<u8>,
    filename: &str,
) -> ParseValidateResult {
    parse_and_validate(
        conn,
        CsvParseAndValidateRequest {
            file_bytes,
            filename: filename.to_string(),
        },
    )
    .expect("parse_and_validate がテスト中に失敗しました")
}
