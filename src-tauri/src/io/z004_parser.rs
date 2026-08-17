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
    /// 精算日（YYYY-MM-DD、入力 shape に応じたメタ行から抽出）
    pub settlement_date: String,
    /// 正常にパースできたデータ行
    pub parsed_rows: Vec<ParsedRow>,
    /// 行単位のパースエラー
    pub parse_errors: Vec<ParseError>,
    /// ヘッダ行より後の非空行でパースを試みた総数（Ok(Some)+Ok(None)+Err）
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
    /// ヘッダまたは精算日を抽出不能
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

    // Step 6: 従来 shape と layout A を判定し、ヘッダ位置と精算日を確定
    let conventional_date = extract_iso_date(lines[0]);
    let is_conventional_shape =
        conventional_date.is_some() && is_conventional_header_line(lines[1]);

    let (header_index, settlement_date) = if is_conventional_shape {
        (
            1,
            conventional_date.expect("従来 shape 判定済みの日付が存在する"),
        )
    } else {
        const HEADER_SCAN_LIMIT: usize = 20;
        let header_index = lines
            .iter()
            .take(HEADER_SCAN_LIMIT)
            .position(|line| is_layout_a_header_line(line))
            .ok_or_else(|| {
                Z004ParseError::NoSettlementDate(
                    "ヘッダ行を検出できません。ファイル形式を確認してください".to_string(),
                )
            })?;

        let metadata = &lines[..header_index];
        let labeled_date = metadata.iter().find_map(|line| {
            let fields = split_csv_fields(line);
            fields
                .first()
                .filter(|label| label.contains("日付"))
                .and_then(|_| extract_normalized_date(line))
        });
        let fallback_date = || {
            metadata
                .iter()
                .find_map(|line| extract_normalized_date(line))
        };
        let settlement_date = labeled_date.or_else(fallback_date).ok_or_else(|| {
            Z004ParseError::NoSettlementDate(
                "精算日を抽出できません。ファイル形式を確認してください".to_string(),
            )
        })?;

        (header_index, settlement_date)
    };

    // Step 7: 検出したヘッダ行をスキップ
    // Step 8: ヘッダ行より後をパース
    let mut parsed_rows = Vec::new();
    let mut parse_errors = Vec::new();
    let mut total_data_lines: usize = 0;

    for (i, line) in lines.iter().enumerate().skip(header_index + 1) {
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

/// 従来 shape の1行目から `YYYY-MM-DD` を抽出する。
fn extract_iso_date(line: &str) -> Option<String> {
    let date_re = regex::Regex::new(r"\d{4}-\d{2}-\d{2}").expect("日付パターンのコンパイル失敗");
    date_re
        .find(line)
        .map(|matched| matched.as_str().to_string())
}

/// layout A のメタ行から日付を抽出し、`YYYY-MM-DD` に正規化する。
fn extract_normalized_date(line: &str) -> Option<String> {
    let date_re = regex::Regex::new(
        r"(?x)
        (?P<year>\d{4})
        (?:
            -(?P<dash_month>\d{1,2})-(?P<dash_day>\d{1,2})
          | /(?P<slash_month>\d{1,2})/(?P<slash_day>\d{1,2})
        )",
    )
    .expect("日付パターンのコンパイル失敗");
    let captures = date_re.captures(line)?;
    let year = captures.name("year")?.as_str();
    let month = captures
        .name("dash_month")
        .or_else(|| captures.name("slash_month"))?
        .as_str()
        .parse::<u8>()
        .ok()?;
    let day = captures
        .name("dash_day")
        .or_else(|| captures.name("slash_day"))?
        .as_str()
        .parse::<u8>()
        .ok()?;
    Some(format!("{year}-{month:02}-{day:02}"))
}

/// 従来 shape の2行目に対する中間強度検査。
/// コード label は全角「コード」と半角カナ「ｺｰﾄﾞ」の両形を受理する
/// （実ファイルのヘッダ第2フィールドは半角カナ「ｽｷｬﾆﾝｸﾞｺｰﾄﾞ」。SPEC-Z4A-D1/D2）。
fn contains_code_label(field: &str) -> bool {
    field.contains("コード") || field.contains("ｺｰﾄﾞ")
}

fn is_conventional_header_line(line: &str) -> bool {
    let fields = split_csv_fields(line);
    fields.len() == 5 && contains_code_label(&fields[1])
}

/// layout A の5フィールド・位置アンカー付きヘッダ検査。
fn is_layout_a_header_line(line: &str) -> bool {
    let fields = split_csv_fields(line);
    fields.len() == 5 && contains_code_label(&fields[1]) && fields[4].contains("金額")
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

#[cfg(test)]
mod layout_a_tests {
    use super::*;

    // 実ファイル形状（2026-08-17 機械抽出）: CP932 12byte 固定幅 padding、第2フィールドは半角カナ
    const LAYOUT_A_HEADER: &str =
        "\"レコード    \",\"ｽｷｬﾆﾝｸﾞｺｰﾄﾞ \",\"キャラクター\",\"個数        \",\"金額        \"";
    // 全角「コード」形（旧 synthetic 形）。アンカーの全角受理を独立に拘束するために保持
    const LAYOUT_A_HEADER_FULLWIDTH: &str = "\"メモリNo.\",\"コード\",\"名称\",\"個数\",\"金額\"";

    fn encode_cp932(text: &str) -> Vec<u8> {
        let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
        encoded.to_vec()
    }

    fn layout_a_text(metadata: &[&str], data_lines: &[&str]) -> String {
        let mut lines = metadata.to_vec();
        lines.push(LAYOUT_A_HEADER);
        lines.extend_from_slice(data_lines);
        lines.join("\r\n")
    }

    fn synthetic_layout_a_fixture() -> Vec<u8> {
        // 実ファイル形状 exact（メタ6行の実ラベル + 7行目空行 + 8行目ヘッダ。値は synthetic）
        encode_cp932(&layout_a_text(
            &[
                "\"マシンNo.   \",\"0001\"",
                "\"ファイル    \",\"Z004_SYNTH\"",
                "\"モード      \",\"SYNTH\"",
                "\"精算回数    \",\"0042\"",
                "\"日付        \",\"2026-08-15\"",
                "\"時刻        \",\"18:30\"",
                "",
            ],
            &[
                "\"1\",\"9999999999990E\",\"合成商品A\",\"2\",\"600\"",
                "\"2\",\"8888888888880E\",\"合成返品B\",\"-1\",\"-250\"",
                "\"3\",\"12345678EEEEEE\",\"合成独自C\",\"1\",\"100\"",
                "\"4\",\"0000000000000\",\"空スロット13\",\"0\",\"0\"",
                "\"5\",\"00000000000000\",\"空スロット14\",\"0\",\"0\"",
            ],
        ))
    }

    fn assert_no_settlement_date(error: Z004ParseError, expected_message: &str) {
        match error {
            Z004ParseError::NoSettlementDate(message) => {
                assert_eq!(message, expected_message);
            }
            other => panic!("NoSettlementDate を期待しました: {other:?}"),
        }
    }

    #[test]
    fn test_parse_z004_req401_layout_a_full_shape() {
        // REQ-401 / SPEC-Z4A-D1/D2/D3/D4: layout A の完全形状と出力契約
        let raw = synthetic_layout_a_fixture();
        let result = parse_z004(&raw).unwrap();

        assert_eq!(result.settlement_date, "2026-08-15");
        assert_eq!(result.parsed_rows.len(), 2);
        assert_eq!(result.parse_errors.len(), 1);
        assert_eq!(result.total_data_lines, 5);
        assert_eq!(
            result.file_hash,
            "fc73326f99ac4c2d15823460f86f97d20674d49ba45ae52c0ebf318444e36fe8"
        );

        let sale = &result.parsed_rows[0];
        assert_eq!(sale.line_no, 9);
        assert_eq!(sale.normalized_jan, "9999999999990");
        assert_eq!(sale.name, "合成商品A");
        assert_eq!(sale.quantity, 2);
        assert_eq!(sale.amount, 600);

        let returned = &result.parsed_rows[1];
        assert_eq!(returned.line_no, 10);
        assert_eq!(returned.normalized_jan, "8888888888880");
        assert_eq!(returned.name, "合成返品B");
        assert_eq!(returned.quantity, -1);
        assert_eq!(returned.amount, -250);
    }

    #[test]
    fn test_parse_z004_req401_layout_a_settlement_date_iso() {
        // REQ-401 / SPEC-Z4A-D3: ISO 形式の日付ラベル値を採用する
        let result = parse_z004(&synthetic_layout_a_fixture()).unwrap();
        assert_eq!(result.settlement_date, "2026-08-15");
    }

    #[test]
    fn test_parse_z004_req401_layout_a_settlement_date_slash_padded() {
        // REQ-401 / SPEC-Z4A-D3: YYYY/M/D をゼロ埋めする
        let raw = encode_cp932(&layout_a_text(
            &["\"管理No.\",\"SYNTH-0002\"", "\"日付\",\"2026/8/5\""],
            &["\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\""],
        ));

        let result = parse_z004(&raw).unwrap();
        assert_eq!(result.settlement_date, "2026-08-05");
    }

    #[test]
    fn test_parse_z004_req401_layout_a_8digit_code_invalid_jan() {
        // REQ-401 / SPEC-Z4A-D5: 8桁 + E パディングは行単位エラーで可視化する
        let result = parse_z004(&synthetic_layout_a_fixture()).unwrap();

        assert_eq!(result.parsed_rows.len(), 2, "他の正常行は処理を継続する");
        assert_eq!(result.parse_errors.len(), 1);
        assert_eq!(result.parse_errors[0].line_no, 11);
        assert_eq!(
            result.parse_errors[0].error_type,
            ParseErrorType::InvalidJan
        );
        assert_eq!(
            result.parse_errors[0].raw_name.as_deref(),
            Some("合成独自C")
        );
    }

    #[test]
    fn test_parse_z004_req401_layout_a_meta_line_count_tolerance() {
        // REQ-401 / SPEC-Z4A-D2: メタ行数を固定値にしない
        for metadata in [
            vec![
                "\"管理No.\",\"SYNTH-5\"",
                "\"ファイル\",\"Z004\"",
                "\"帳票\",\"PLU別売上\"",
                "\"日付\",\"2026-08-15\"",
                "\"時刻\",\"18:30\"",
            ],
            vec![
                "\"管理No.\",\"SYNTH-7\"",
                "\"ファイル\",\"Z004\"",
                "\"帳票\",\"PLU別売上\"",
                "\"番号\",\"42\"",
                "\"日付\",\"2026-08-15\"",
                "\"時刻\",\"18:30\"",
                "\"予備\",\"synthetic\"",
            ],
        ] {
            let raw = encode_cp932(&layout_a_text(
                &metadata,
                &["\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\""],
            ));
            let result = parse_z004(&raw).unwrap();
            assert_eq!(result.parsed_rows.len(), 1);
        }
    }

    #[test]
    fn test_parse_z004_req401_layout_a_fullwidth_header_variant() {
        // REQ-401 / SPEC-Z4A-D2: 全角「コード」ヘッダも受理する（アンカーの全角側を独立拘束）
        let raw = encode_cp932(&format!(
            "{}\r\n{}\r\n{}",
            "\"日付\",\"2026-08-15\"",
            LAYOUT_A_HEADER_FULLWIDTH,
            "\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\""
        ));
        let result = parse_z004(&raw).unwrap();
        assert_eq!(result.settlement_date, "2026-08-15");
        assert_eq!(result.parsed_rows.len(), 1);
    }

    #[test]
    fn test_parse_z004_req401_layout_a_slot_dump_counts() {
        // REQ-401 / SPEC-Z4A-D6: 全スロットダンプと全ゼロ skip
        let mut data_lines = vec![
            "\"1\",\"9999999999990E\",\"合成商品A\",\"3\",\"900\"".to_string(),
            "\"2\",\"8888888888880E\",\"合成商品B\",\"1\",\"250\"".to_string(),
        ];
        data_lines.extend(
            (3..=5_000).map(|slot| format!("\"{slot}\",\"00000000000000\",\"\",\"0\",\"0\"")),
        );
        let data_refs: Vec<&str> = data_lines.iter().map(String::as_str).collect();
        let raw = encode_cp932(&layout_a_text(
            &["\"管理No.\",\"SYNTH-5000\"", "\"日付\",\"2026-08-15\""],
            &data_refs,
        ));

        let result = parse_z004(&raw).unwrap();
        assert_eq!(result.total_data_lines, 5_000);
        assert_eq!(result.parsed_rows.len(), 2);
        assert_eq!(result.parse_errors.len(), 0);
        assert_eq!(result.parsed_rows[0].quantity, 3);
        assert_eq!(result.parsed_rows[1].amount, 250);
    }

    #[test]
    fn test_parse_z004_req401_layout_a_datelike_meta_first_line() {
        let raw = encode_cp932(&layout_a_text(
            &[
                "\"管理No.\",\"RUN-2026-01-02\"",
                "\"コード\",\"decoy\",\"金額\",\"x\",\"not-anchor\"",
                "\"帳票\",\"PLU別売上\"",
                "\"日付\",\"2026/8/5\"",
                "\"時刻\",\"18:30\"",
            ],
            &["\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\""],
        ));

        let result = parse_z004(&raw).unwrap();
        // SPEC-Z4A-D1: 日付様の先頭メタ値でも従来 shape へ誤ルーティングしない。
        assert_eq!(result.parsed_rows.len(), 1);
        // SPEC-Z4A-D3: 最初の一致ではなく「日付」ラベル行を優先する。
        assert_eq!(result.settlement_date, "2026-08-05");
        // SPEC-Z4A-D2: 誤位置のラベルを持つ decoy をヘッダと認識しない。
        assert_eq!(result.parsed_rows[0].line_no, 7);
        assert_eq!(result.total_data_lines, 1);
    }

    #[test]
    fn test_parse_z004_req401_layout_a_five_field_meta_decoy() {
        // REQ-401 / SPEC-Z4A-D1: 5フィールドだけの2行目を従来 shape と誤認しない
        let raw = encode_cp932(&layout_a_text(
            &[
                "\"管理No.\",\"RUN-2026-01-02\"",
                "\"decoy\",\"not-code\",\"x\",\"y\",\"金額\"",
                "\"日付\",\"2026-08-15\"",
            ],
            &["\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\""],
        ));

        let result = parse_z004(&raw).unwrap();
        assert_eq!(result.settlement_date, "2026-08-15");
        assert_eq!(result.parsed_rows.len(), 1);
        assert_eq!(result.parsed_rows[0].line_no, 5);
        assert_eq!(result.total_data_lines, 1);
    }

    #[test]
    fn test_parse_z004_req401_layout_a_no_date_fails() {
        // REQ-401 / SPEC-Z4A-D3: ヘッダがあっても日付なしは安全停止する
        let raw = encode_cp932(&layout_a_text(
            &["\"管理No.\",\"SYNTH-NO-DATE\"", "\"時刻\",\"18:30\""],
            &["\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\""],
        ));

        assert_no_settlement_date(
            parse_z004(&raw).unwrap_err(),
            "精算日を抽出できません。ファイル形式を確認してください",
        );
    }

    #[test]
    fn test_parse_z004_req401_layout_a_no_header_fails() {
        // REQ-401 / SPEC-Z4A-D2: 20行目は受理、21行目は走査上限超過で停止する
        let preamble_19: Vec<String> = (1..=19)
            .map(|line| {
                if line == 2 {
                    "\"日付\",\"2026-08-15\"".to_string()
                } else {
                    format!("\"メタ{line}\",\"synthetic\"")
                }
            })
            .collect();
        let mut accepted_lines = preamble_19.clone();
        accepted_lines.push(LAYOUT_A_HEADER.to_string());
        accepted_lines.push("\"1\",\"9999999999990E\",\"合成商品\",\"1\",\"100\"".to_string());
        let accepted = encode_cp932(&accepted_lines.join("\r\n"));
        assert_eq!(parse_z004(&accepted).unwrap().parsed_rows.len(), 1);

        let mut preamble_20 = preamble_19;
        preamble_20.push("\"メタ20\",\"synthetic\"".to_string());
        preamble_20.push(LAYOUT_A_HEADER.to_string());
        let rejected = encode_cp932(&preamble_20.join("\r\n"));
        assert_no_settlement_date(
            parse_z004(&rejected).unwrap_err(),
            "ヘッダ行を検出できません。ファイル形式を確認してください",
        );
    }

    #[test]
    fn test_parse_z004_req401_unrecognized_shape_fails() {
        // REQ-401 / SPEC-Z4A-D1: 二形状外は部分結果を返さない
        let raw =
            encode_cp932("\"メタ\",\"synthetic\"\r\n\"別メタ\",\"value\"\r\n\"終端\",\"value\"");
        assert_no_settlement_date(
            parse_z004(&raw).unwrap_err(),
            "ヘッダ行を検出できません。ファイル形式を確認してください",
        );
    }
}
