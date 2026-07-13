//! IO-03: 商品マスタCSVインポーター
//!
//! 利用者が作成したCSVファイル（バイト列）を読み込み、
//! エンコーディングを自動判定して構造化データに変換する。
//! 純関数。DB非依存。業務ロジック（ヘッダ検証・重複チェック等）はBIZ-01側の責務。
//!
//! docs/function-design/26-io-product-csv-importer.md に基づく実装。

use std::collections::HashMap;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// CSVパース成功結果（行単位エラーがあっても返る）
///
/// 26-io-product-csv-importer.md セクション18.2
#[derive(Debug)]
pub struct ImportParseResult {
    /// ヘッダ行のカラム名一覧
    pub headers: Vec<String>,
    /// データ行（元CSV行番号付き）
    pub rows: Vec<ParsedRow>,
    /// パースエラー一覧（行単位）
    pub parse_errors: Vec<ImportParseError>,
}

/// パース成功行（元CSVの行番号を保持）
#[derive(Debug, Clone)]
pub struct ParsedRow {
    /// 元CSVの行番号（1始まり、ヘッダ行=1）
    pub line_no: usize,
    /// フィールド値（ヘッダ名 -> 値のマップ）
    pub fields: HashMap<String, String>,
}

/// 行単位パースエラー（他の行の処理は継続）
#[derive(Debug, Clone)]
pub struct ImportParseError {
    /// 行番号（1始まり、ヘッダ行=1）
    pub line_no: usize,
    /// エラー種別（"field_count_mismatch"）
    pub error_type: String,
    /// 利用者向け日本語メッセージ
    pub error_message: String,
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// 商品マスタCSVファイルの生バイト列を構造化データに変換する
///
/// 26-io-product-csv-importer.md セクション18.3
pub fn parse_product_csv(bytes: &[u8]) -> Result<ImportParseResult, String> {
    // Step 1: 空ファイルチェック
    if bytes.is_empty() {
        return Err("ファイルが空です".to_string());
    }

    // Step 2: エンコーディング判定とデコード
    let decoded = decode_bytes(bytes)?;

    // Step 3: 改行で分割（\r\n -> \n, \r -> \n の順で正規化）
    let normalized = decoded.replace("\r\n", "\n").replace('\r', "\n");
    let mut lines: Vec<&str> = normalized.split('\n').collect();

    // 末尾の空行を除去
    while lines.last().is_some_and(|l| l.trim().is_empty()) {
        lines.pop();
    }

    // Step 4: ヘッダ行パース（1行目）
    if lines.is_empty() {
        return Err("ファイルにデータがありません".to_string());
    }

    let headers = parse_header_line(lines[0])?;

    // Step 5: データ行パース（2行目以降）
    let mut rows = Vec::new();
    let mut parse_errors = Vec::new();

    for (i, line) in lines.iter().enumerate().skip(1) {
        let line_no = i + 1; // 1始まり

        // 空行スキップ（エラーにもカウントしない）
        if line.trim().is_empty() {
            continue;
        }

        let fields = split_csv_fields(line);

        if fields.len() != headers.len() {
            parse_errors.push(ImportParseError {
                line_no,
                error_type: "field_count_mismatch".to_string(),
                error_message: format!(
                    "行{}: フィールド数が不一致です（期待{}, 実際{}）",
                    line_no,
                    headers.len(),
                    fields.len()
                ),
            });
            continue;
        }

        // 全フィールドが空の行はスキップ
        if fields.iter().all(|f| f.trim().is_empty()) {
            continue;
        }

        // HashMap構築（ヘッダ名 -> 値、値の前後空白トリム）
        let mut field_map = HashMap::new();
        for (header, value) in headers.iter().zip(fields.iter()) {
            field_map.insert(header.clone(), value.trim().to_string());
        }
        rows.push(ParsedRow {
            line_no,
            fields: field_map,
        });
    }

    // Step 6: 結果返却
    Ok(ImportParseResult {
        headers,
        rows,
        parse_errors,
    })
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

/// バイト列をエンコーディング判定してデコードする
///
/// BOM(0xEF,0xBB,0xBF) -> UTF-8、それ以外 -> CP932
fn decode_bytes(bytes: &[u8]) -> Result<String, String> {
    // BOM判定
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        // UTF-8（BOM除去）
        let without_bom = &bytes[3..];
        String::from_utf8(without_bom.to_vec()).map_err(|_| {
            "ファイルの文字コードが判別できません。Excelで保存し直してください".to_string()
        })
    } else {
        // CP932としてstrictデコード
        let (decoded, had_errors) = encoding_rs::SHIFT_JIS.decode_without_bom_handling(bytes);
        if had_errors {
            return Err(
                "ファイルの文字コードが判別できません。Excelで保存し直してください".to_string(),
            );
        }
        Ok(decoded.into_owned())
    }
}

/// ヘッダ行をパースする
fn parse_header_line(line: &str) -> Result<Vec<String>, String> {
    let fields = split_csv_fields(line);
    let headers: Vec<String> = fields.iter().map(|f| f.trim().to_string()).collect();

    // 空ヘッダチェック（全フィールドが空、またはフィールドなし）
    if headers.is_empty() || headers.iter().all(|h| h.is_empty()) {
        return Err("ヘッダ行が不正です".to_string());
    }

    Ok(headers)
}

/// CSVフィールドをダブルクォート対応で分割する
///
/// z004_parser.rs の同名関数と同じロジック（IO層モジュール独立のためコピー）
fn split_csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    // "" -> " エスケープ
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

    // -----------------------------------------------------------------------
    // テストヘルパー
    // -----------------------------------------------------------------------

    /// UTF-8 BOM付きCSVバイト列を生成する
    fn make_utf8_bom_csv(content: &str) -> Vec<u8> {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(content.as_bytes());
        bytes
    }

    /// CP932エンコードされたテストデータを生成する
    fn encode_cp932(text: &str) -> Vec<u8> {
        let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
        encoded.to_vec()
    }

    // -----------------------------------------------------------------------
    // 正常系
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_csv_req104_utf8_bom_normal() {
        // REQ-104: 一括インポート（BOM付きUTF-8正常パース）
        // 18.3: BOM付きUTF-8 -> 正常パース
        let csv =
            make_utf8_bom_csv("商品コード,商品名,売価\n4976383262108,ハマナカ アミアミ極太,594\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.headers, vec!["商品コード", "商品名", "売価"]);
        assert_eq!(result.rows.len(), 1);
        assert_eq!(result.parse_errors.len(), 0);

        let row = &result.rows[0];
        assert_eq!(row.fields.get("商品コード").unwrap(), "4976383262108");
        assert_eq!(row.fields.get("商品名").unwrap(), "ハマナカ アミアミ極太");
        assert_eq!(row.fields.get("売価").unwrap(), "594");
    }

    #[test]
    fn test_parse_csv_req104_cp932_normal() {
        // REQ-104: 一括インポート（CP932正常パース）
        // 18.3: CP932（BOMなし）-> 正常パース、日本語文字化けなし
        let csv = encode_cp932("商品コード,商品名,売価\n4976383262108,ハマナカ アミアミ極太,594\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.headers, vec!["商品コード", "商品名", "売価"]);
        assert_eq!(result.rows.len(), 1);

        let row = &result.rows[0];
        assert_eq!(row.fields.get("商品名").unwrap(), "ハマナカ アミアミ極太");
    }

    // -----------------------------------------------------------------------
    // ファイルレベルエラー（Err返却）
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_csv_req104_empty_file() {
        // REQ-104: 一括インポート（空ファイルエラー）
        // 18.3 Step 1: 空ファイル
        let result = parse_product_csv(&[]);
        assert_eq!(result.unwrap_err(), "ファイルが空です");
    }

    #[test]
    fn test_parse_csv_req104_decode_failure() {
        // REQ-104: 一括インポート（デコード失敗）
        // 18.3 Step 2: CP932デコード失敗（不正バイト列）
        let invalid_bytes: Vec<u8> = vec![0x80, 0x00, 0xFF];
        let result = parse_product_csv(&invalid_bytes);
        assert!(result.unwrap_err().contains("文字コードが判別できません"));
    }

    // -----------------------------------------------------------------------
    // ヘッダ・行パース
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_csv_req104_header_only() {
        // REQ-104: 一括インポート（ヘッダのみ）
        // 18.3: ヘッダのみ（データ行なし）-> rows空
        let csv = make_utf8_bom_csv("商品コード,商品名,売価\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.headers.len(), 3);
        assert_eq!(result.rows.len(), 0);
        assert_eq!(result.parse_errors.len(), 0);
    }

    #[test]
    fn test_parse_csv_req104_field_count_mismatch() {
        // REQ-104: 一括インポート（フィールド数不一致）
        // 18.3 Step 5: フィールド数不一致 -> parse_errors
        let csv = make_utf8_bom_csv(
            "商品コード,商品名,売価\n4976383262108,ハマナカ\n4973167902615,毛糸B,385\n",
        );
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.rows.len(), 1, "正常行は1件");
        assert_eq!(result.parse_errors.len(), 1, "エラー行は1件");
        assert_eq!(result.parse_errors[0].line_no, 2);
        assert_eq!(result.parse_errors[0].error_type, "field_count_mismatch");
        assert!(result.parse_errors[0].error_message.contains("期待3"));
        assert!(result.parse_errors[0].error_message.contains("実際2"));
    }

    #[test]
    fn test_parse_csv_req104_empty_lines_skipped() {
        // REQ-104: 一括インポート（空行スキップ）
        // 18.3 Step 5: 空行はスキップ
        let csv =
            make_utf8_bom_csv("商品コード,商品名\n\n4976383262108,商品A\n\n4973167902615,商品B\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.rows.len(), 2, "空行はスキップされて2件");
        assert_eq!(result.parse_errors.len(), 0);
    }

    #[test]
    fn test_parse_csv_req104_double_quote_handling() {
        // REQ-104: 一括インポート（ダブルクォート処理）
        // 18.3: ダブルクォート囲み除去 + "" -> " 変換
        let csv = make_utf8_bom_csv("名前,説明\n\"商品A\",\"サイズ\"\"大\"\"\"\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.rows.len(), 1);
        let row = &result.rows[0];
        assert_eq!(row.fields.get("名前").unwrap(), "商品A");
        assert_eq!(row.fields.get("説明").unwrap(), "サイズ\"大\"");
    }

    #[test]
    fn test_parse_csv_req104_all_fields_present() {
        // REQ-104: 一括インポート（全フィールド正常）
        // 18.3: 設計書の入力例と同等
        let csv = make_utf8_bom_csv(
            "商品コード,商品名,部門ID,売価,原価,税率\n4976383262108,ハマナカ アミアミ極太,3,594,111,10\n",
        );
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.headers.len(), 6);
        assert_eq!(result.rows.len(), 1);

        let row = &result.rows[0];
        assert_eq!(row.fields.get("商品コード").unwrap(), "4976383262108");
        assert_eq!(row.fields.get("商品名").unwrap(), "ハマナカ アミアミ極太");
        assert_eq!(row.fields.get("部門ID").unwrap(), "3");
        assert_eq!(row.fields.get("売価").unwrap(), "594");
        assert_eq!(row.fields.get("原価").unwrap(), "111");
        assert_eq!(row.fields.get("税率").unwrap(), "10");
    }

    #[test]
    fn test_parse_csv_req104_optional_fields_missing() {
        // REQ-104: 一括インポート（任意フィールド省略）
        // 18.3: ヘッダ3列、データ3列 -> 3キーのHashMap
        let csv = make_utf8_bom_csv("A,B,C\n1,2,3\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.rows.len(), 1);
        let row = &result.rows[0];
        assert_eq!(row.fields.len(), 3);
        assert_eq!(row.fields.get("A").unwrap(), "1");
        assert_eq!(row.fields.get("B").unwrap(), "2");
        assert_eq!(row.fields.get("C").unwrap(), "3");
    }

    #[test]
    fn test_parse_csv_req104_bom_removed_from_header() {
        // REQ-104: 一括インポート（BOM除去確認）
        // 18.3: BOMがヘッダ名に残らない
        let csv = make_utf8_bom_csv("商品コード,商品名\nTEST,テスト\n");
        let result = parse_product_csv(&csv).unwrap();

        // ヘッダの先頭がBOMで汚染されていないこと
        assert_eq!(result.headers[0], "商品コード");
        assert!(!result.headers[0].starts_with('\u{FEFF}'));
    }

    #[test]
    fn test_parse_csv_req104_mixed_errors_and_valid() {
        // REQ-104: 一括インポート（エラー行と正常行の混在）
        // 18.3: エラー行と正常行の混在
        let csv = make_utf8_bom_csv("コード,名前,値段\nA,B\nC,D,E\nF,G\nH,I,J\n");
        let result = parse_product_csv(&csv).unwrap();

        assert_eq!(result.rows.len(), 2, "正常行は2件（C,D,EとH,I,J）");
        assert_eq!(result.parse_errors.len(), 2, "エラー行は2件（A,BとF,G）");

        // エラーの行番号が正しい
        assert_eq!(result.parse_errors[0].line_no, 2);
        assert_eq!(result.parse_errors[1].line_no, 4);

        // 正常行のデータが正しい
        assert_eq!(result.rows[0].fields.get("コード").unwrap(), "C");
        assert_eq!(result.rows[1].fields.get("コード").unwrap(), "H");
    }
}
