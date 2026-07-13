//! IO-05: レポートCSVエクスポーター
//!
//! ヘッダとデータ行からUTF-8 BOM付きCSVバイト列を生成する。
//! 純関数。DB非依存。
//!
//! docs/function-design/27-io-report-csv-exporter.md に基づく実装。

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// ヘッダとデータ行からUTF-8 BOM付きCSVバイト列を生成する
///
/// 27-io-report-csv-exporter.md §27.4
///
/// - UTF-8 BOM（0xEF, 0xBB, 0xBF）を先頭に付与
/// - 行末は `\r\n`（Excel互換）
/// - フィールドはRFC 4180に準拠してエスケープ
pub fn export_csv(headers: &[String], rows: &[Vec<String>]) -> Vec<u8> {
    let mut buf = Vec::new();

    // 1. UTF-8 BOM
    buf.extend_from_slice(&[0xEF, 0xBB, 0xBF]);

    // 2. ヘッダが空ならBOMのみ返す（呼び出し元の責務。設計書§27.4）
    if headers.is_empty() {
        return buf;
    }

    // 3. ヘッダ行
    let line: Vec<String> = headers.iter().map(|h| escape_csv_field(h)).collect();
    buf.extend_from_slice(line.join(",").as_bytes());
    buf.extend_from_slice(b"\r\n");

    // 4. データ行
    for row in rows {
        let line: Vec<String> = row.iter().map(|f| escape_csv_field(f)).collect();
        buf.extend_from_slice(line.join(",").as_bytes());
        buf.extend_from_slice(b"\r\n");
    }

    buf
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

/// CSVフィールド値をRFC 4180に準拠してエスケープする
///
/// 27-io-report-csv-exporter.md §27.5
fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') || field.contains('\r') {
        // ダブルクォートを "" に置換し、全体を " で囲む
        let escaped = field.replace('"', "\"\"");
        format!("\"{}\"", escaped)
    } else {
        field.to_string()
    }
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_csv_req501_basic_output() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: ヘッダ+データ行が正しいCSV形式で出力される
        let headers = vec![
            "商品コード".to_string(),
            "名前".to_string(),
            "数量".to_string(),
        ];
        let rows = vec![
            vec![
                "TEST-001".to_string(),
                "テスト商品A".to_string(),
                "10".to_string(),
            ],
            vec![
                "TEST-002".to_string(),
                "テスト商品B".to_string(),
                "5".to_string(),
            ],
        ];

        let result = export_csv(&headers, &rows);
        let text = String::from_utf8(result[3..].to_vec()).unwrap(); // BOMスキップ

        assert!(text.contains("商品コード,名前,数量\r\n"));
        assert!(text.contains("TEST-001,テスト商品A,10\r\n"));
        assert!(text.contains("TEST-002,テスト商品B,5\r\n"));
    }

    #[test]
    fn test_export_csv_req501_utf8_bom() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: 出力の先頭3バイトがUTF-8 BOM
        let headers = vec!["col1".to_string()];
        let result = export_csv(&headers, &[]);

        assert_eq!(&result[..3], &[0xEF, 0xBB, 0xBF], "先頭3バイトはUTF-8 BOM");
    }

    #[test]
    fn test_export_csv_req501_quoting() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: カンマ・ダブルクォート・改行を含むフィールドが正しくエスケープされる
        let headers = vec!["field".to_string()];
        let rows = vec![
            vec!["カンマ,入り".to_string()],
            vec!["ダブル\"クォート".to_string()],
            vec!["改行\n入り".to_string()],
            vec!["CR\r入り".to_string()],
        ];

        let result = export_csv(&headers, &rows);
        let text = String::from_utf8(result[3..].to_vec()).unwrap();

        assert!(
            text.contains("\"カンマ,入り\""),
            "カンマを含むフィールドはクォート囲み"
        );
        assert!(
            text.contains("\"ダブル\"\"クォート\""),
            "ダブルクォートは\"\"に置換: {}",
            text
        );
        assert!(
            text.contains("\"改行\n入り\""),
            "改行を含むフィールドはクォート囲み"
        );
        assert!(
            text.contains("\"CR\r入り\""),
            "CRを含むフィールドはクォート囲み"
        );
    }

    #[test]
    fn test_export_csv_req501_empty_headers() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: headers空 → BOMのみ（設計書§27.4「空のheaders → BOMのみ」）
        let headers: Vec<String> = vec![];
        let rows = vec![vec!["data".to_string()]];

        let result = export_csv(&headers, &rows);
        assert_eq!(result.len(), 3, "BOM 3バイトのみ");
        assert_eq!(&result[..3], &[0xEF, 0xBB, 0xBF]);
    }

    #[test]
    fn test_export_csv_req501_empty_data() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: rows空 → ヘッダ行のみのCSV
        let headers = vec!["A".to_string(), "B".to_string()];
        let result = export_csv(&headers, &[]);
        let text = String::from_utf8(result[3..].to_vec()).unwrap();

        assert_eq!(text, "A,B\r\n", "ヘッダ行のみ");
    }

    #[test]
    fn test_export_csv_req501_japanese_content() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: 日本語フィールドが正しくUTF-8で出力される
        let headers = vec!["部門名".to_string(), "売上合計".to_string()];
        let rows = vec![vec!["毛糸".to_string(), "15800".to_string()]];

        let result = export_csv(&headers, &rows);
        // UTF-8として正しくデコードできること
        let text = String::from_utf8(result[3..].to_vec()).unwrap();
        assert!(text.contains("部門名,売上合計"));
        assert!(text.contains("毛糸,15800"));
    }

    #[test]
    fn test_export_csv_req501_crlf_line_ending() {
        // REQ-501: 売上レポートCSV出力
        // Task: IO-05
        // IO-05: 行末が \r\n（Excel互換）
        let headers = vec!["col".to_string()];
        let rows = vec![vec!["val".to_string()]];

        let result = export_csv(&headers, &rows);
        let text = String::from_utf8(result[3..].to_vec()).unwrap();

        // \n の前に必ず \r がある
        for (i, b) in text.bytes().enumerate() {
            if b == b'\n' {
                assert!(
                    i > 0 && text.as_bytes()[i - 1] == b'\r',
                    "\\n の前に \\r があるべき"
                );
            }
        }
        // \r\n の個数 = 行数（ヘッダ1 + データ1）
        let crlf_count = text.matches("\r\n").count();
        assert_eq!(crlf_count, 2, "ヘッダ行+データ行=2行分の\\r\\n");
    }
}
