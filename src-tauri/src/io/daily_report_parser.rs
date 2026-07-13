//! IO-07: Z001/Z002/Z005 日報bundleパーサー
//!
//! CASIO SR-S4000の日報ファイル束をDB非依存の構造化データへ変換する。
//! docs/function-design/29-io-daily-report-parser.md に基づく実装。

use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub struct DailyReportSourceFile {
    pub filename: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, specta::Type)]
pub enum DailyReportSourceKind {
    Z001,
    Z002,
    Z005,
}

#[derive(Debug, Clone)]
pub struct ParsedDailyReportSourceFile {
    pub source: DailyReportSourceKind,
    pub filename: String,
    pub file_hash: String,
    pub size_bytes: usize,
}

#[derive(Debug, Clone)]
pub struct DailyReportSummaryLine {
    pub source_file: DailyReportSourceKind,
    pub line_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone)]
pub struct DailyReportPaymentLine {
    pub source_file: DailyReportSourceKind,
    pub payment_key: String,
    pub label: String,
    pub amount: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone)]
pub struct DailyReportDepartmentLine {
    pub source_file: DailyReportSourceKind,
    pub raw_department_name: String,
    pub normalized_department_name: Option<String>,
    pub amount: i64,
    pub quantity: Option<i64>,
    pub count: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone)]
pub struct DailyReportParseError {
    pub source_file: Option<DailyReportSourceKind>,
    pub filename: Option<String>,
    pub line_no: Option<i64>,
    pub error_type: String,
    pub error_message: String,
}

#[derive(Debug, Clone)]
pub struct DailyReportParseResult {
    pub report_date: Option<String>,
    pub source_files: Vec<ParsedDailyReportSourceFile>,
    pub summary_lines: Vec<DailyReportSummaryLine>,
    pub payment_lines: Vec<DailyReportPaymentLine>,
    pub department_lines: Vec<DailyReportDepartmentLine>,
    pub parse_errors: Vec<DailyReportParseError>,
}

pub fn parse_daily_report_bundle(files: Vec<DailyReportSourceFile>) -> DailyReportParseResult {
    let mut result = DailyReportParseResult {
        report_date: None,
        source_files: Vec::new(),
        summary_lines: Vec::new(),
        payment_lines: Vec::new(),
        department_lines: Vec::new(),
        parse_errors: Vec::new(),
    };

    let mut seen_sources = HashSet::new();
    let mut source_dates: HashMap<DailyReportSourceKind, String> = HashMap::new();

    for file in files {
        let Some(source) = detect_source(&file.filename) else {
            result.parse_errors.push(parse_error(
                None,
                Some(file.filename),
                None,
                "unknown_source",
                "Z001/Z002/Z005以外のファイルです",
            ));
            continue;
        };

        if !seen_sources.insert(source) {
            result.parse_errors.push(parse_error(
                Some(source),
                Some(file.filename),
                None,
                "duplicate_source",
                "同じsourceのファイルが複数あります",
            ));
            continue;
        }

        let file_hash = sha256_hex(&file.bytes);
        result.source_files.push(ParsedDailyReportSourceFile {
            source,
            filename: file.filename.clone(),
            file_hash,
            size_bytes: file.bytes.len(),
        });

        let (decoded, had_errors) = encoding_rs::SHIFT_JIS.decode_without_bom_handling(&file.bytes);
        if had_errors {
            result.parse_errors.push(parse_error(
                Some(source),
                Some(file.filename),
                None,
                "decode_failed",
                "CP932デコードに失敗しました",
            ));
            continue;
        }

        let normalized = decoded
            .replace("\u{0085}", "\n")
            .replace("\u{2026}", "\n")
            .replace("\r\n", "\n")
            .replace('\r', "\n");

        if let Some(date) = extract_date(&normalized) {
            source_dates.insert(source, date);
        } else {
            result.parse_errors.push(parse_error(
                Some(source),
                Some(file.filename.clone()),
                None,
                "invalid_date",
                "対象日を抽出できません",
            ));
        }

        match source {
            DailyReportSourceKind::Z001 => {
                parse_z001(
                    &normalized,
                    &mut result.summary_lines,
                    &mut result.parse_errors,
                );
            }
            DailyReportSourceKind::Z002 => {
                parse_z002(
                    &normalized,
                    &mut result.payment_lines,
                    &mut result.parse_errors,
                );
            }
            DailyReportSourceKind::Z005 => {
                parse_z005(
                    &normalized,
                    &mut result.department_lines,
                    &mut result.parse_errors,
                );
            }
        }
    }

    for source in [
        DailyReportSourceKind::Z001,
        DailyReportSourceKind::Z002,
        DailyReportSourceKind::Z005,
    ] {
        if !seen_sources.contains(&source) {
            result.parse_errors.push(parse_error(
                Some(source),
                None,
                None,
                "missing_source",
                "必須sourceのファイルがありません",
            ));
        }
    }

    let unique_dates: HashSet<&String> = source_dates.values().collect();
    if seen_sources.len() == 3 && unique_dates.len() == 1 {
        result.report_date = unique_dates.into_iter().next().cloned();
    } else if seen_sources.len() == 3 {
        result.parse_errors.push(parse_error(
            None,
            None,
            None,
            "invalid_date",
            "Z001/Z002/Z005の日付が一致しません",
        ));
    }

    result
}

fn detect_source(filename: &str) -> Option<DailyReportSourceKind> {
    let upper = filename.to_ascii_uppercase();
    if upper.contains("Z001") {
        Some(DailyReportSourceKind::Z001)
    } else if upper.contains("Z002") {
        Some(DailyReportSourceKind::Z002)
    } else if upper.contains("Z005") {
        Some(DailyReportSourceKind::Z005)
    } else {
        None
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn parse_z001(
    text: &str,
    rows: &mut Vec<DailyReportSummaryLine>,
    errors: &mut Vec<DailyReportParseError>,
) {
    let data_rows = data_rows_after_header(text, DailyReportSourceKind::Z001, errors);
    for (index, (line_no, fields)) in data_rows.into_iter().enumerate() {
        let code = fields[0].trim();
        let label = fields[1].trim().to_string();
        if code.is_empty() && label.is_empty() {
            continue;
        }
        let first_value = match parse_optional_i64(&fields[2]) {
            Ok(value) => value,
            Err(()) => {
                errors.push(parse_error(
                    Some(DailyReportSourceKind::Z001),
                    None,
                    Some(line_no),
                    "invalid_number",
                    "Z001の個数/件数列を変換できません",
                ));
                continue;
            }
        };
        let amount = match parse_optional_i64(&fields[3]) {
            Ok(value) => value,
            Err(()) => {
                errors.push(parse_error(
                    Some(DailyReportSourceKind::Z001),
                    None,
                    Some(line_no),
                    "invalid_number",
                    "Z001の金額列を変換できません",
                ));
                continue;
            }
        };
        let sort_order = (index + 1) as i64;
        let line_key = summary_line_key(code, &label, sort_order);
        let (quantity, count) = if line_key == "gross_sales" {
            (first_value, None)
        } else {
            (None, first_value)
        };
        rows.push(DailyReportSummaryLine {
            source_file: DailyReportSourceKind::Z001,
            line_key,
            label,
            amount,
            quantity,
            count,
            sort_order,
        });
    }
}

fn data_rows_after_header(
    text: &str,
    source: DailyReportSourceKind,
    errors: &mut Vec<DailyReportParseError>,
) -> Vec<(i64, Vec<String>)> {
    let lines: Vec<&str> = text.split('\n').collect();
    if let Some(header_index) = lines.iter().position(|line| {
        let fields = split_csv_fields(line);
        is_header_fields(&fields)
    }) {
        let mut rows = Vec::new();
        for (line_index, line) in lines.iter().enumerate().skip(header_index + 1) {
            if line.trim().is_empty() {
                continue;
            }
            let fields = split_csv_fields(line);
            if fields.len() != 4 {
                errors.push(parse_error(
                    Some(source),
                    None,
                    Some((line_index + 1) as i64),
                    "invalid_format",
                    "日報CSVのデータ行が4列ではありません",
                ));
                continue;
            }
            rows.push(((line_index + 1) as i64, fields));
        }
        if rows.is_empty() {
            errors.push(parse_error(
                Some(source),
                None,
                None,
                "invalid_format",
                "日報CSVのデータ行がありません",
            ));
        }
        return rows;
    }

    let fields = quoted_fields(text);
    if let Some(header_index) = fields.windows(4).position(is_header_fields) {
        let data = &fields[header_index + 4..];
        if data.is_empty() || !data.len().is_multiple_of(4) {
            errors.push(parse_error(
                Some(source),
                None,
                None,
                "invalid_format",
                "日報CSVの連結データ行が4列反復ではありません",
            ));
            return Vec::new();
        }
        return data
            .chunks(4)
            .enumerate()
            .map(|(index, chunk)| ((index + 1) as i64, chunk.to_vec()))
            .collect();
    }

    errors.push(parse_error(
        Some(source),
        None,
        None,
        "invalid_format",
        "日報CSVのヘッダ行を検出できません",
    ));
    Vec::new()
}

fn is_header_fields(fields: &[String]) -> bool {
    fields.len() == 4
        && fields[0].trim().contains("レコード")
        && fields[1].trim().contains("キャラクター")
        && fields[3].trim().contains("金額")
}

fn quoted_fields(text: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '"' {
            continue;
        }
        let mut field = String::new();
        for inner in chars.by_ref() {
            if inner == '"' {
                break;
            }
            field.push(inner);
        }
        fields.push(field);
    }
    fields
}

fn parse_z002(
    text: &str,
    rows: &mut Vec<DailyReportPaymentLine>,
    errors: &mut Vec<DailyReportParseError>,
) {
    let data_rows = data_rows_after_header(text, DailyReportSourceKind::Z002, errors);
    for (index, (line_no, fields)) in data_rows.into_iter().enumerate() {
        let code = fields[0].trim();
        let label = fields[1].trim().to_string();
        if code.is_empty() && label.is_empty() {
            continue;
        }
        let count = match parse_optional_i64(&fields[2]) {
            Ok(value) => value,
            Err(()) => {
                errors.push(parse_error(
                    Some(DailyReportSourceKind::Z002),
                    None,
                    Some(line_no),
                    "invalid_number",
                    "Z002の件数列を変換できません",
                ));
                continue;
            }
        };
        let amount = match parse_optional_i64(&fields[3]) {
            Ok(value) => value,
            Err(()) => {
                errors.push(parse_error(
                    Some(DailyReportSourceKind::Z002),
                    None,
                    Some(line_no),
                    "invalid_number",
                    "Z002の金額列を変換できません",
                ));
                continue;
            }
        };
        let sort_order = (index + 1) as i64;
        rows.push(DailyReportPaymentLine {
            source_file: DailyReportSourceKind::Z002,
            payment_key: payment_key(code, &label, sort_order),
            label,
            amount,
            count,
            sort_order,
        });
    }
}

fn parse_z005(
    text: &str,
    rows: &mut Vec<DailyReportDepartmentLine>,
    errors: &mut Vec<DailyReportParseError>,
) {
    let data_rows = data_rows_after_header(text, DailyReportSourceKind::Z005, errors);
    for (index, (line_no, fields)) in data_rows.into_iter().enumerate() {
        let code = fields[0].trim();
        let raw_department_name = fields[1].trim().to_string();
        if code.is_empty() && raw_department_name.is_empty() {
            continue;
        }
        let quantity = match parse_optional_i64(&fields[2]) {
            Ok(value) => value,
            Err(()) => {
                errors.push(parse_error(
                    Some(DailyReportSourceKind::Z005),
                    None,
                    Some(line_no),
                    "invalid_number",
                    "Z005の個数列を変換できません",
                ));
                continue;
            }
        };
        let amount = match parse_required_i64(&fields[3]) {
            Ok(value) => value,
            Err(()) => {
                errors.push(parse_error(
                    Some(DailyReportSourceKind::Z005),
                    None,
                    Some(line_no),
                    "invalid_number",
                    "Z005の金額列を変換できません",
                ));
                continue;
            }
        };
        rows.push(DailyReportDepartmentLine {
            source_file: DailyReportSourceKind::Z005,
            normalized_department_name: Some(raw_department_name.clone()),
            raw_department_name,
            amount,
            quantity,
            count: None,
            sort_order: (index + 1) as i64,
        });
    }
}

fn parse_optional_i64(value: &str) -> Result<Option<i64>, ()> {
    let cleaned = clean_number(value);
    if cleaned.is_empty() {
        return Ok(None);
    }
    cleaned.parse::<i64>().map(Some).map_err(|_| ())
}

fn parse_required_i64(value: &str) -> Result<i64, ()> {
    parse_optional_i64(value)?.ok_or(())
}

fn clean_number(value: &str) -> String {
    value.trim().replace([',', '￥', '¥', ' '], "")
}

fn summary_line_key(code: &str, label: &str, sort_order: i64) -> String {
    if code == "101" || label.contains("総売") || label.eq_ignore_ascii_case("gross_sales") {
        "gross_sales".to_string()
    } else if code == "201" || label.contains("純売") || label.eq_ignore_ascii_case("net_sales") {
        "net_sales".to_string()
    } else {
        fallback_key("summary", sort_order)
    }
}

fn payment_key(code: &str, label: &str, sort_order: i64) -> String {
    if code == "01" || label.contains("現金") || label.eq_ignore_ascii_case("cash") {
        "cash".to_string()
    } else if code == "03" || label.contains("クレジット") || label.eq_ignore_ascii_case("credit")
    {
        "credit".to_string()
    } else {
        fallback_key("payment", sort_order)
    }
}

fn fallback_key(prefix: &str, sort_order: i64) -> String {
    format!("{}_{}", prefix, sort_order)
}

fn extract_date(text: &str) -> Option<String> {
    let date_re =
        regex::Regex::new(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})").expect("date regex must compile");
    date_re.captures(text).and_then(|caps| {
        let month = caps[2].parse::<u32>().ok()?;
        let day = caps[3].parse::<u32>().ok()?;
        Some(format!("{}-{month:02}-{day:02}", &caps[1]))
    })
}

fn parse_error(
    source_file: Option<DailyReportSourceKind>,
    filename: Option<String>,
    line_no: Option<i64>,
    error_type: &str,
    error_message: &str,
) -> DailyReportParseError {
    DailyReportParseError {
        source_file,
        filename,
        line_no,
        error_type: error_type.to_string(),
        error_message: error_message.to_string(),
    }
}

fn split_csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn encode_cp932(text: &str) -> Vec<u8> {
        let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
        encoded.to_vec()
    }

    fn source_file(filename: &str, text: &str) -> DailyReportSourceFile {
        DailyReportSourceFile {
            filename: filename.to_string(),
            bytes: encode_cp932(text),
        }
    }

    fn preamble(date: &str) -> String {
        format!(
            "\"マシンNo.   \",\"01\",\"\",\"\"\r\n\"ファイル    \",\"synthetic\",\"\",\"\"\r\n\"モード      \",\"精算\",\"\",\"\"\r\n\"精算回数    \",\"0001\",\"\",\"\"\r\n\"日付        \",\"{date}\",\"\",\"\"\r\n\"時刻        \",\"12:34\",\"\",\"\"\r\n\r\n\"レコード    \",\"キャラクター\",\"個数/件数   \",\"金額        \"\r\n"
        )
    }

    fn z001(date: &str) -> DailyReportSourceFile {
        source_file(
            "Z001_260321.CSV",
            &format!(
                "{}\"101\",\"総売\",\"8\",\"12000\"\r\n\"201\",\"純売\",\"7\",\"11000\"\r\n",
                preamble(date)
            ),
        )
    }

    fn z002(date: &str) -> DailyReportSourceFile {
        source_file(
            "Z002_260321.CSV",
            &format!(
                "{}\"01\",\"現金\",\"7\",\"11000\"\r\n\"03\",\"クレジット\",\"1\",\"1000\"\r\n",
                preamble(date)
            ),
        )
    }

    fn z005(date: &str) -> DailyReportSourceFile {
        source_file(
            "Z005_260321.CSV",
            &format!(
                "\"マシンNo.   \",\"01\"\r\n\"ファイル    \",\"synthetic\"\r\n\"モード      \",\"精算\"\r\n\"精算回数    \",\"0001\"\r\n\"日付        \",\"{date}\"\r\n\"時刻        \",\"12:34\"\r\n\r\n\"レコード    \",\"キャラクター\",\"個数        \",\"金額        \"\r\n\"01\",\"その他小物\",\"4\",\"3000\"\r\n\"02\",\"毛糸\",\"5\",\"8000\"\r\n"
            ),
        )
    }

    #[test]
    fn test_parse_daily_report_req401_happy_path() {
        // REQ-401 / IO-07: Z001/Z002/Z005 bundleを日報行へ正規化する
        let result = parse_daily_report_bundle(vec![
            z001("2026-03-21"),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ]);

        assert!(result.parse_errors.is_empty(), "{:?}", result.parse_errors);
        assert_eq!(result.report_date.as_deref(), Some("2026-03-21"));
        assert_eq!(result.source_files.len(), 3);
        assert!(result
            .source_files
            .iter()
            .all(|file| file.file_hash.len() == 64
                && file.file_hash == file.file_hash.to_lowercase()
                && file.size_bytes > 0));
        assert_eq!(result.summary_lines.len(), 2);
        assert_eq!(
            result.summary_lines[0].source_file,
            DailyReportSourceKind::Z001
        );
        assert_eq!(result.summary_lines[0].line_key, "gross_sales");
        assert_eq!(result.summary_lines[0].amount, Some(12000));
        assert_eq!(result.summary_lines[0].quantity, Some(8));
        assert_eq!(result.summary_lines[0].count, None);
        assert_eq!(result.summary_lines[1].line_key, "net_sales");
        assert_eq!(result.summary_lines[1].amount, Some(11000));
        assert_eq!(result.summary_lines[1].quantity, None);
        assert_eq!(result.summary_lines[1].count, Some(7));
        assert_eq!(result.payment_lines.len(), 2);
        assert_eq!(
            result.payment_lines[0].source_file,
            DailyReportSourceKind::Z002
        );
        assert_eq!(result.payment_lines[0].payment_key, "cash");
        assert_eq!(result.payment_lines[0].count, Some(7));
        assert_eq!(result.payment_lines[0].amount, Some(11000));
        assert_eq!(result.department_lines.len(), 2);
        assert_eq!(
            result.department_lines[0].source_file,
            DailyReportSourceKind::Z005
        );
        assert_eq!(result.department_lines[0].raw_department_name, "その他小物");
        assert_eq!(result.department_lines[0].amount, 3000);
        assert_eq!(result.department_lines[0].quantity, Some(4));
        assert_eq!(result.department_lines[0].count, None);
    }

    #[test]
    fn test_parse_daily_report_req401_missing_source() {
        // REQ-401 / IO-07: Z001/Z002/Z005の欠損はparse error
        let result = parse_daily_report_bundle(vec![z001("2026-03-21"), z002("2026-03-21")]);

        assert!(result
            .parse_errors
            .iter()
            .any(|error| error.error_type == "missing_source"
                && error.source_file == Some(DailyReportSourceKind::Z005)));
    }

    #[test]
    fn test_parse_daily_report_req401_duplicate_and_unknown_source() {
        // REQ-401 / IO-07: source重複と未知sourceはcommit不可エラー
        let unknown = source_file("Z009_260321.CSV", "\"2026-03-21\",\"ignored\"");
        let result = parse_daily_report_bundle(vec![
            z001("2026-03-21"),
            z001("2026-03-21"),
            z002("2026-03-21"),
            z005("2026-03-21"),
            unknown,
        ]);

        assert!(result
            .parse_errors
            .iter()
            .any(|error| error.error_type == "duplicate_source"
                && error.source_file == Some(DailyReportSourceKind::Z001)));
        assert!(result
            .parse_errors
            .iter()
            .any(|error| error.error_type == "unknown_source"));
    }

    #[test]
    fn test_parse_daily_report_req401_decode_failed() {
        // REQ-401 / IO-07: CP932 strict decode失敗はsource単位のparse error
        let result = parse_daily_report_bundle(vec![
            DailyReportSourceFile {
                filename: "Z001_260321.CSV".to_string(),
                bytes: vec![0x80, 0x00, 0xFF],
            },
            z002("2026-03-21"),
            z005("2026-03-21"),
        ]);

        assert!(result
            .parse_errors
            .iter()
            .any(|error| error.error_type == "decode_failed"
                && error.source_file == Some(DailyReportSourceKind::Z001)));
    }

    #[test]
    fn test_parse_daily_report_req401_date_mismatch() {
        // REQ-401 / IO-07: 3ファイルの日付不一致はinvalid_date
        let result = parse_daily_report_bundle(vec![
            z001("2026-03-21"),
            z002("2026-03-22"),
            z005("2026-03-21"),
        ]);

        assert_eq!(result.report_date, None);
        assert!(result
            .parse_errors
            .iter()
            .any(|error| error.error_type == "invalid_date"));
    }

    #[test]
    fn test_parse_daily_report_req401_invalid_number() {
        // REQ-401 / IO-07: source別数値列の変換失敗はinvalid_number
        let invalid_z005 = source_file(
            "Z005_260321.CSV",
            "\"マシンNo.   \",\"01\"\r\n\"ファイル    \",\"synthetic\"\r\n\"モード      \",\"精算\"\r\n\"精算回数    \",\"0001\"\r\n\"日付        \",\"2026-03-21\"\r\n\"時刻        \",\"12:34\"\r\n\r\n\"レコード    \",\"キャラクター\",\"個数        \",\"金額        \"\r\n\"01\",\"その他小物\",\"4\",\"not-number\"\r\n",
        );
        let result =
            parse_daily_report_bundle(vec![z001("2026-03-21"), z002("2026-03-21"), invalid_z005]);

        assert!(result
            .parse_errors
            .iter()
            .any(|error| error.error_type == "invalid_number"
                && error.source_file == Some(DailyReportSourceKind::Z005)));
    }

    #[test]
    fn test_parse_daily_report_req401_invalid_format_z002_z005() {
        // REQ-401 / IO-07: header後の4列データ行が崩れた行構造はinvalid_format
        let invalid_z002 = source_file(
            "Z002_260321.CSV",
            &format!("{}\"01\",\"現金\",\"7\"\r\n", preamble("2026-03-21")),
        );
        let invalid_z005 = source_file(
            "Z005_260321.CSV",
            "\"マシンNo.   \",\"01\"\r\n\"ファイル    \",\"synthetic\"\r\n\"モード      \",\"精算\"\r\n\"精算回数    \",\"0001\"\r\n\"日付        \",\"2026-03-21\"\r\n\"時刻        \",\"12:34\"\r\n\r\n\"レコード    \",\"キャラクター\",\"個数        \",\"金額        \"\r\n\"01\",\"その他小物\",\"4\"\r\n",
        );
        let result =
            parse_daily_report_bundle(vec![z001("2026-03-21"), invalid_z002, invalid_z005]);

        assert!(result.parse_errors.iter().any(|error| {
            error.error_type == "invalid_format"
                && error.source_file == Some(DailyReportSourceKind::Z002)
        }));
        assert!(result.parse_errors.iter().any(|error| {
            error.error_type == "invalid_format"
                && error.source_file == Some(DailyReportSourceKind::Z005)
        }));
    }

    #[test]
    fn test_parse_daily_report_req401_source_shapes() {
        // REQ-401 / IO-07: 匿名化shape
        // Z001/Z002/Z005=7行プリアンブル+header+4列データ行
        let result = parse_daily_report_bundle(vec![
            z001("2026-03-21"),
            z002("2026-03-21"),
            z005("2026-03-21"),
        ]);

        assert_eq!(result.summary_lines.len(), 2);
        assert_eq!(result.payment_lines.len(), 2);
        assert_eq!(result.department_lines.len(), 2);
        assert_eq!(result.summary_lines[0].sort_order, 1);
        assert_eq!(result.payment_lines[1].sort_order, 2);
        assert_eq!(result.department_lines[1].sort_order, 2);
    }

    #[test]
    fn test_parse_daily_report_req401_layout_b_concatenated_shape_supported() {
        // REQ-401 / IO-07: エクスポート機能の連結型layout Bも4列データ行として正規化する
        let layout_b_z002 = source_file(
            "Z002_260321.CSV",
            "\"出力\",\"PC\"\"内容\",\"日計\"\"日付\",\"2026-03-21\"\"レコード\",\"キャラクター\",\"個数/件数\",\"金額\"\"0001\",\"現金\",\"7\",\"11000\"\"0003\",\"クレジット\",\"1\",\"1000\"",
        );
        let layout_b_z005 = source_file(
            "Z005_260321.CSV",
            "\"出力\",\"PC\"\"内容\",\"日計\"\"日付\",\"2026-03-21\"\"レコード\",\"キャラクター\",\"個数\",\"金額\"\"0001\",\"その他小物\",\"4\",\"3000\"\"0002\",\"毛糸\",\"5\",\"8000\"",
        );

        let result =
            parse_daily_report_bundle(vec![z001("2026-03-21"), layout_b_z002, layout_b_z005]);

        assert!(result.parse_errors.is_empty(), "{:?}", result.parse_errors);
        assert_eq!(result.payment_lines.len(), 2);
        assert_eq!(result.payment_lines[0].payment_key, "cash");
        assert_eq!(result.payment_lines[0].count, Some(7));
        assert_eq!(result.payment_lines[0].amount, Some(11000));
        assert_eq!(result.department_lines.len(), 2);
        assert_eq!(result.department_lines[0].quantity, Some(4));
        assert_eq!(result.department_lines[0].amount, 3000);
    }
}
