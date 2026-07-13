//! IO-02: Z004パーサー
//!
//! カシオSR-S4000のZ004ファイル（CP932/CSV）を構造化データに変換する。
//! 純関数。DB非依存。
//!
//! docs/function-design/23-io-z004-parser.md に基づく実装。

use sha2::{Digest, Sha256};
use std::fmt;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// Z004パース成功結果（行単位エラーがあっても返る）
#[derive(Debug)]
pub struct ParseResult {
    /// 精算日（YYYY-MM-DD、1行目から抽出）
    pub settlement_date: String,
    /// 正常にパースできたデータ行
    pub parsed_rows: Vec<ParsedRow>,
    /// 行単位のパースエラー
    pub parse_errors: Vec<ParseError>,
    /// 3行目以降の非空行でパースを試みた総数（Ok(Some)+Ok(None)+Err）
    pub total_data_lines: usize,
    /// SHA-256ハッシュ（raw bytes基準、hex小文字64文字。INV-6準拠）
    pub file_hash: String,
}

/// 正常にパースできた1データ行
#[derive(Debug, Clone)]
pub struct ParsedRow {
    /// ファイル内行番号（1始まり）
    pub line_no: usize,
    /// 正規化後13桁JANコード
    pub normalized_jan: String,
    /// Z004上の商品名（そのまま）
    pub name: String,
    /// 数量（マイナス=返品）
    pub quantity: i32,
    /// 金額（マイナス=返品）
    pub amount: i32,
}

/// 行単位パースエラー（他の行の処理は継続）
#[derive(Debug, Clone)]
pub struct ParseError {
    pub line_no: usize,
    pub error_type: ParseErrorType,
    pub error_message: String,
    /// パース途中で取得できた商品名（取得前のエラーではNone）
    pub raw_name: Option<String>,
    pub raw_quantity: Option<String>,
    pub raw_amount: Option<String>,
}

/// パースエラーの種別
///
/// db-design/pos-tables.md csv_import_errors の error_type CHECK制約に対応
#[derive(Debug, Clone, PartialEq)]
#[allow(clippy::enum_variant_names)]
pub enum ParseErrorType {
    /// フィールド数不正等の構造エラー
    InvalidFormat,
    /// JANコード正規化失敗
    InvalidJan,
    /// 数量・金額の数値変換失敗
    InvalidNumber,
}

/// 致命的エラー（ファイル全体の処理を中断）
#[derive(Debug)]
pub enum Z004ParseError {
    /// CP932デコード失敗
    DecodeFailed(String),
    /// 2行未満（ヘッダ行すらない）
    NoDataLines(String),
    /// 1行目から日付抽出不能
    NoSettlementDate(String),
}

impl fmt::Display for Z004ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Z004ParseError::DecodeFailed(msg) => write!(f, "{}", msg),
            Z004ParseError::NoDataLines(msg) => write!(f, "{}", msg),
            Z004ParseError::NoSettlementDate(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for Z004ParseError {}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// Z004ファイルの生バイト列を構造化データに変換する
///
/// 23-io-z004-parser.md セクション13.3
pub fn parse_z004(raw_bytes: &[u8]) -> Result<ParseResult, Z004ParseError> {
    // Step 1: file_hash算出（raw bytesから。INV-6準拠）
    let mut hasher = Sha256::new();
    hasher.update(raw_bytes);
    let hash_result = hasher.finalize();
    let file_hash = format!("{:x}", hash_result);

    // Step 2: CP932 strictデコード
    let (decoded, had_errors) = encoding_rs::SHIFT_JIS.decode_without_bom_handling(raw_bytes);
    if had_errors {
        return Err(Z004ParseError::DecodeFailed(
            "CP932デコードに失敗しました。ファイル形式を確認してください".to_string(),
        ));
    }

    // Step 3: 改行正規化（\u{0085}, \r\n, \r → \n）
    let normalized = decoded
        .replace("\u{0085}", "\n")
        .replace("\r\n", "\n")
        .replace('\r', "\n");

    // Step 4: 行分割（空行は除去しない — 行番号保持）
    let lines: Vec<&str> = normalized.split('\n').collect();

    // Step 5: 2行未満チェック
    if lines.len() < 2 {
        return Err(Z004ParseError::NoDataLines(
            "データ行がありません。ファイル形式を確認してください".to_string(),
        ));
    }

    // Step 6: 1行目からYYYY-MM-DD抽出
    let date_re = regex::Regex::new(r"\d{4}-\d{2}-\d{2}").expect("日付パターンのコンパイル失敗");
    let settlement_date = match date_re.find(lines[0]) {
        Some(m) => m.as_str().to_string(),
        None => {
            return Err(Z004ParseError::NoSettlementDate(
                "1行目から精算日（YYYY-MM-DD）を抽出できません".to_string(),
            ));
        }
    };

    // Step 7: 2行目スキップ
    // Step 8: 3行目以降をパース
    let mut parsed_rows = Vec::new();
    let mut parse_errors = Vec::new();
    let mut total_data_lines: usize = 0;

    for (i, line) in lines.iter().enumerate().skip(2) {
        let line_no = i + 1; // 1始まり

        // 空行スキップ（カウントしない）
        if line.trim().is_empty() {
            continue;
        }

        total_data_lines += 1;

        match parse_data_line(line, line_no) {
            Ok(Some(row)) => parsed_rows.push(row),
            Ok(None) => {} // 空スロット（全桁ゼロ）— スキップ
            Err(error) => parse_errors.push(error),
        }
    }

    Ok(ParseResult {
        settlement_date,
        parsed_rows,
        parse_errors,
        total_data_lines,
        file_hash,
    })
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

/// Z004の1データ行をパースする
///
/// 23-io-z004-parser.md セクション13.4
fn parse_data_line(line: &str, line_no: usize) -> Result<Option<ParsedRow>, ParseError> {
    // Step 1: CSVフィールド分割（ダブルクォート対応）
    let fields = split_csv_fields(line);
    if fields.len() != 5 {
        return Err(ParseError {
            line_no,
            error_type: ParseErrorType::InvalidFormat,
            error_message: format!(
                "行{}: フィールド数が不正です（期待: 5, 実際: {}）",
                line_no,
                fields.len()
            ),
            raw_name: fields.get(2).map(|s| s.to_string()),
            raw_quantity: fields.get(3).map(|s| s.to_string()),
            raw_amount: fields.get(4).map(|s| s.to_string()),
        });
    }

    let scanning_code_raw = &fields[1];
    let name_raw = &fields[2];
    let quantity_raw = &fields[3];
    let amount_raw = &fields[4];

    // Step 2: JAN正規化
    let normalized_jan = match normalize_jan(scanning_code_raw, line_no) {
        Ok(None) => return Ok(None), // 空スロット
        Err(msg) => {
            return Err(ParseError {
                line_no,
                error_type: ParseErrorType::InvalidJan,
                error_message: msg,
                raw_name: Some(name_raw.to_string()),
                raw_quantity: Some(quantity_raw.to_string()),
                raw_amount: Some(amount_raw.to_string()),
            });
        }
        Ok(Some(jan)) => jan,
    };

    // Step 3: quantity パース
    let quantity: i32 = quantity_raw.trim().parse().map_err(|_| ParseError {
        line_no,
        error_type: ParseErrorType::InvalidNumber,
        error_message: format!(
            "行{}: 数量が数値ではありません: '{}'",
            line_no, quantity_raw
        ),
        raw_name: Some(name_raw.to_string()),
        raw_quantity: Some(quantity_raw.to_string()),
        raw_amount: Some(amount_raw.to_string()),
    })?;

    // Step 4: amount パース
    let amount: i32 = amount_raw.trim().parse().map_err(|_| ParseError {
        line_no,
        error_type: ParseErrorType::InvalidNumber,
        error_message: format!("行{}: 金額が数値ではありません: '{}'", line_no, amount_raw),
        raw_name: Some(name_raw.to_string()),
        raw_quantity: Some(quantity_raw.to_string()),
        raw_amount: Some(amount_raw.to_string()),
    })?;

    // Step 5: 成功
    Ok(Some(ParsedRow {
        line_no,
        normalized_jan,
        name: name_raw.to_string(),
        quantity,
        amount,
    }))
}

/// Z004のスキャニングコードをJANコード13桁に正規化する
///
/// 23-io-z004-parser.md セクション13.5
fn normalize_jan(raw: &str, line_no: usize) -> Result<Option<String>, String> {
    let trimmed = raw.trim();

    // 全桁ゼロ → 空スロット（設計書13.5: 13桁/14桁ゼロが対象。
    // 他の桁数の全ゼロは後続の13桁チェックでErrになるため実害なし）
    if !trimmed.is_empty() && trimmed.chars().all(|c| c == '0') {
        return Ok(None);
    }

    let mut chars: Vec<char> = trimmed.chars().collect();
    let len = chars.len();

    // 14桁 + 末尾ASCII英字 → 末尾除去で13桁化
    if len == 14 && chars[13].is_ascii_alphabetic() {
        chars.pop();
    }

    let normalized: String = chars.iter().collect();

    // 13桁 + 全数字
    if normalized.len() == 13 && normalized.chars().all(|c| c.is_ascii_digit()) {
        Ok(Some(normalized))
    } else {
        Err(format!(
            "行{}: JANコード '{}' を正規化できません",
            line_no, raw
        ))
    }
}

/// CSVフィールドをダブルクォート対応で分割する
///
/// 仕様: ダブルクォート囲み除去、内部カンマ保護、""→"エスケープ、囲みなし許容
fn split_csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    // "" → " エスケープ
                    current.push('"');
                    chars.next();
                } else {
                    // クォート終了
                    in_quotes = false;
                }
            } else {
                current.push(ch);
            }
        } else if ch == '"' {
            in_quotes = true;
        } else if ch == ',' {
            fields.push(current.clone());
            current.clear();
        } else {
            current.push(ch);
        }
    }
    fields.push(current);
    fields
}

// ===========================================================================
// テスト
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// CP932エンコードされたテストデータを生成するヘルパー
    fn encode_cp932(text: &str) -> Vec<u8> {
        let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
        encoded.to_vec()
    }

    /// 最小限の有効Z004データ（ヘッダ+1データ行）
    fn make_valid_z004(data_lines: &str) -> Vec<u8> {
        let text = format!(
            "精算日報 2026-03-21 テスト店舗\r\nNo,コード,名称,個数,金額\r\n{}",
            data_lines
        );
        encode_cp932(&text)
    }

    // -----------------------------------------------------------------------
    // 正常系
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_z004_req401_single_product() {
        // REQ-401: CSV取込み
        // 13.3: 正常パース（1商品）
        let raw = make_valid_z004("\"1\",\"4976383262108\",\"ﾊﾏﾅｶ ｱﾐｱﾐ極太\",3,1782");
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.settlement_date, "2026-03-21");
        assert_eq!(result.parsed_rows.len(), 1);
        assert_eq!(result.parse_errors.len(), 0);

        let row = &result.parsed_rows[0];
        assert_eq!(row.line_no, 3);
        assert_eq!(row.normalized_jan, "4976383262108");
        assert_eq!(row.name, "ﾊﾏﾅｶ ｱﾐｱﾐ極太");
        assert_eq!(row.quantity, 3);
        assert_eq!(row.amount, 1782);
    }

    #[test]
    fn test_parse_z004_req401_multiple_products() {
        // REQ-401: CSV取込み
        // 13.3: 複数商品
        let raw = make_valid_z004(
            "\"1\",\"4976383262108\",\"商品A\",3,1782\r\n\"2\",\"4973167902615\",\"商品B\",1,385",
        );
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.parsed_rows.len(), 2);
        assert_eq!(result.parsed_rows[0].normalized_jan, "4976383262108");
        assert_eq!(result.parsed_rows[1].normalized_jan, "4973167902615");
        assert_eq!(result.total_data_lines, 2);
    }

    #[test]
    fn test_parse_z004_req401_settlement_date_extraction() {
        // REQ-401: CSV取込み
        // 13.3 Step 6: settlement_date抽出
        let raw = make_valid_z004("\"1\",\"4976383262108\",\"A\",1,100");
        let result = parse_z004(&raw).unwrap();
        assert_eq!(result.settlement_date, "2026-03-21");
    }

    #[test]
    fn test_parse_z004_req401_file_hash() {
        // REQ-401: CSV取込み
        // INV-6: file_hash = SHA-256(raw_bytes), hex小文字64文字
        let raw = make_valid_z004("\"1\",\"4976383262108\",\"A\",1,100");
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.file_hash.len(), 64);
        assert!(
            result.file_hash.chars().all(|c| c.is_ascii_hexdigit()),
            "hex文字のみ"
        );
        assert_eq!(
            result.file_hash,
            result.file_hash.to_lowercase(),
            "小文字のみ"
        );

        // 同じ入力 → 同じハッシュ
        let result2 = parse_z004(&raw).unwrap();
        assert_eq!(result.file_hash, result2.file_hash);
    }

    #[test]
    fn test_parse_z004_req401_negative_values_allowed() {
        // REQ-401: CSV取込み
        // 13.6: 返品値（quantity < 0, amount < 0）許可
        let raw = make_valid_z004("\"1\",\"4976383262108\",\"返品商品\",-1,-385");
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.parsed_rows.len(), 1);
        assert_eq!(result.parsed_rows[0].quantity, -1);
        assert_eq!(result.parsed_rows[0].amount, -385);
    }

    // -----------------------------------------------------------------------
    // 致命的エラー
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_z004_req401_decode_failed() {
        // REQ-401: CSV取込み
        // 13.3 Step 2: CP932デコード失敗
        // 0x80 の後に 0x00 が続くのはCP932マルチバイトとして不正
        let invalid_bytes: Vec<u8> = vec![0x80, 0x00, 0xFF];
        let result = parse_z004(&invalid_bytes);
        assert!(matches!(result, Err(Z004ParseError::DecodeFailed(_))));
    }

    #[test]
    fn test_parse_z004_req401_no_data_lines() {
        // REQ-401: CSV取込み
        // 13.3 Step 5: 2行未満
        let raw = encode_cp932("1行のみ");
        let result = parse_z004(&raw);
        assert!(matches!(result, Err(Z004ParseError::NoDataLines(_))));
    }

    #[test]
    fn test_parse_z004_req401_no_settlement_date() {
        // REQ-401: CSV取込み
        // 13.3 Step 6: 日付抽出不能
        let raw = encode_cp932("日付のない1行目\r\nヘッダ行\r\nデータ行");
        let result = parse_z004(&raw);
        assert!(matches!(result, Err(Z004ParseError::NoSettlementDate(_))));
    }

    // -----------------------------------------------------------------------
    // 行単位エラー
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_z004_req401_invalid_format() {
        // REQ-401: CSV取込み
        // 13.4: フィールド数不正
        let raw = make_valid_z004("\"1\",\"4976383262108\",\"商品A\"");
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.parsed_rows.len(), 0);
        assert_eq!(result.parse_errors.len(), 1);
        assert_eq!(
            result.parse_errors[0].error_type,
            ParseErrorType::InvalidFormat
        );
        assert_eq!(result.parse_errors[0].line_no, 3);
    }

    #[test]
    fn test_parse_z004_req401_invalid_number() {
        // REQ-401: CSV取込み
        // 13.4: 数量が数値でない
        let raw = make_valid_z004("\"1\",\"4976383262108\",\"商品A\",abc,100");
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.parse_errors.len(), 1);
        assert_eq!(
            result.parse_errors[0].error_type,
            ParseErrorType::InvalidNumber
        );
        assert!(result.parse_errors[0].error_message.contains("数量"));
    }

    #[test]
    fn test_parse_z004_req401_line_no_preserved() {
        // REQ-401: CSV取込み
        // parse_errors の line_no が正しい行番号であること
        let raw = make_valid_z004(
            "\"1\",\"4976383262108\",\"正常\",1,100\r\n\"2\",\"INVALID\",\"エラー\",1,100",
        );
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.parsed_rows.len(), 1);
        assert_eq!(result.parse_errors.len(), 1);
        assert_eq!(result.parsed_rows[0].line_no, 3);
        assert_eq!(result.parse_errors[0].line_no, 4);
    }

    // -----------------------------------------------------------------------
    // JAN正規化
    // -----------------------------------------------------------------------

    #[test]
    fn test_normalize_jan_req401_13_digits() {
        // REQ-401: CSV取込み
        assert_eq!(
            normalize_jan("4976383262108", 1).unwrap(),
            Some("4976383262108".to_string())
        );
    }

    #[test]
    fn test_normalize_jan_req401_14_with_letter_suffix() {
        // REQ-401: CSV取込み
        // 14桁 + 末尾E → 末尾除去で13桁化
        assert_eq!(
            normalize_jan("4976383262108E", 1).unwrap(),
            Some("4976383262108".to_string())
        );
    }

    #[test]
    fn test_normalize_jan_req401_all_zeros_13() {
        // REQ-401: CSV取込み
        assert_eq!(normalize_jan("0000000000000", 1).unwrap(), None);
    }

    #[test]
    fn test_normalize_jan_req401_all_zeros_14() {
        // REQ-401: CSV取込み
        assert_eq!(normalize_jan("00000000000000", 1).unwrap(), None);
    }

    #[test]
    fn test_normalize_jan_req401_12_digits_error() {
        // REQ-401: CSV取込み
        assert!(normalize_jan("497638326210", 1).is_err());
    }

    #[test]
    fn test_normalize_jan_req401_14_digits_no_letter_error() {
        // REQ-401: CSV取込み
        // 14桁末尾が数字 → 不正
        assert!(normalize_jan("49763832621089", 1).is_err());
    }

    #[test]
    fn test_normalize_jan_req401_non_numeric_error() {
        // REQ-401: CSV取込み
        assert!(normalize_jan("ABCDEFGHIJKLM", 1).is_err());
    }

    // -----------------------------------------------------------------------
    // 空行・空スロット
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_z004_req401_empty_lines_skipped() {
        // REQ-401: CSV取込み
        // 空行はスキップ＋total_data_linesに含まれない
        let raw = make_valid_z004(
            "\"1\",\"4976383262108\",\"A\",1,100\r\n\r\n\"2\",\"4973167902615\",\"B\",2,200",
        );
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.parsed_rows.len(), 2);
        assert_eq!(result.total_data_lines, 2, "空行はカウントしない");
    }

    #[test]
    fn test_parse_z004_req401_all_zero_jan_skipped() {
        // REQ-401: CSV取込み
        // 全桁ゼロJAN → Ok(None) = 空スロット
        let raw = make_valid_z004("\"1\",\"00000000000000\",\"\",0,0");
        let result = parse_z004(&raw).unwrap();

        assert_eq!(
            result.parsed_rows.len(),
            0,
            "空スロットは parsed_rows に入らない"
        );
        assert_eq!(result.parse_errors.len(), 0, "エラーにもならない");
        assert_eq!(result.total_data_lines, 1, "パース試行としてカウントされる");
    }

    // -----------------------------------------------------------------------
    // CSVダブルクォート処理
    // -----------------------------------------------------------------------

    #[test]
    fn test_csv_req401_quoted_fields() {
        // REQ-401: CSV取込み
        // クォート囲みフィールド → 外側クォート除去
        let fields = split_csv_fields("\"A\",\"B\",\"C\"");
        assert_eq!(fields, vec!["A", "B", "C"]);
    }

    #[test]
    fn test_csv_req401_comma_inside_quotes() {
        // REQ-401: CSV取込み
        // クォート内カンマ → 区切りとして扱わない
        let fields = split_csv_fields("\"A,B\",C");
        assert_eq!(fields, vec!["A,B", "C"]);
    }

    #[test]
    fn test_csv_req401_escaped_quotes() {
        // REQ-401: CSV取込み
        // "" → "
        let fields = split_csv_fields("\"A\"\"B\",C");
        assert_eq!(fields, vec!["A\"B", "C"]);
    }

    #[test]
    fn test_csv_req401_mixed_quoted_unquoted() {
        // REQ-401: CSV取込み
        // 囲みなしフィールドとの混在
        let fields = split_csv_fields("\"1\",\"4976383262108\",商品名,3,1782");
        assert_eq!(fields.len(), 5);
        assert_eq!(fields[0], "1");
        assert_eq!(fields[1], "4976383262108");
        assert_eq!(fields[2], "商品名");
        assert_eq!(fields[3], "3");
        assert_eq!(fields[4], "1782");
    }
}
