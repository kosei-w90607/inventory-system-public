//! BIZ-03: CSV取込みパイプライン
//!
//! ARCHITECTURE.md タスク仕様 BIZ-03 + docs/function-design/32-biz-csv-import-service.md に基づく実装。
//! 4段階パイプライン: Parse → Validate → Preview → Commit。
//! キャッシュ管理はCMD層の責務（BIZ層はキャッシュを保持しない）。

mod commit;
mod list;
mod parse;
mod rollback;

#[cfg(test)]
mod test_support;
#[cfg(test)]
mod tests;

// CMD層が未実装のため一部シンボルは未使用だが、API互換のために再エクスポートを維持
#[allow(unused_imports)]
pub use commit::commit_csv_import;
#[allow(unused_imports)]
pub use list::{get_csv_import_record, list_csv_imports};
#[allow(unused_imports)]
pub use parse::parse_and_validate;
#[allow(unused_imports)]
pub use rollback::rollback_csv_import;

use serde::Serialize;

// ---------------------------------------------------------------------------
// 型定義（設計書 §15.2 準拠、15型）
// ---------------------------------------------------------------------------

/// parse_and_validate のリクエスト
#[derive(Debug)]
pub struct CsvParseAndValidateRequest {
    /// Z004ファイルの生バイト列
    pub file_bytes: Vec<u8>,
    /// ファイル名（csv_imports.filename に記録する表示用）
    pub filename: String,
}

/// parse_and_validate の結果
#[derive(Debug)]
pub struct ParseValidateResult {
    /// フロントエンドに返すプレビューデータ
    pub preview_data: PreviewData,
    /// CMD層がキャッシュキーとして使用するUUID v4
    pub preview_token: String,
    /// CMD層がキャッシュに保存する（フロントエンドには返さない）
    pub matched_rows: Vec<MatchedRow>,
    /// CMD層がキャッシュに保存する（フロントエンドには返さない）
    pub error_rows: Vec<ErrorRow>,
}

/// フロントエンドに返すプレビューデータ
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct PreviewData {
    pub file_info: FileInfo,
    pub matched_summary: MatchedSummary,
    pub error_summary: ErrorSummary,
    pub duplicate_check: DuplicateCheck,
    pub preview_created_at: String,
}

/// ファイル情報
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct FileInfo {
    pub filename: String,
    /// YYYY-MM-DD
    pub settlement_date: String,
    /// SHA-256 hex、小文字64文字
    pub file_hash: String,
}

/// マッチ成功サマリ
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct MatchedSummary {
    /// 紐付け成功件数
    pub count: usize,
    /// matched_rows の amount 合計
    pub total_amount: i64,
    /// グループコード商品の紐付け警告等
    pub warnings: Vec<String>,
}

/// エラーサマリ
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct ErrorSummary {
    /// エラー行の総数
    pub count: usize,
    /// 最大100件（UI表示の上限）
    pub items: Vec<ErrorRow>,
}

/// 重複チェック結果
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DuplicateCheck {
    pub status: DuplicateStatus,
    pub same_date_imports: Vec<SameDateCsvImportSummary>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct SameDateCsvImportSummary {
    pub id: i64,
    pub filename: String,
    pub total_items: i64,
    pub total_amount: i64,
    pub imported_at: String,
}

/// 重複チェックのステータス
#[derive(Debug, Clone, Serialize, PartialEq, specta::Type)]
pub enum DuplicateStatus {
    /// 問題なし
    NoDuplicate,
    /// 同settlement_date、別ファイル → 追加確認
    AdditionalImportConfirmationRequired,
}

/// マスタ照合成功行（サーバ側キャッシュに保持、フロントエンドには送らない）
#[derive(Debug, Clone)]
pub struct MatchedRow {
    /// Z004の行番号（1始まり）
    pub line_no: usize,
    /// 紐付いた商品コード
    pub product_code: String,
    /// 売上帳票視点の値。正=販売、負=返品
    pub quantity: i32,
    pub amount: i32,
    /// 紐付いた商品の pos_stock_sync フラグ
    pub pos_stock_sync: bool,
}

/// エラー行（フロント送信 + キャッシュ兼用）
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct ErrorRow {
    pub line_no: usize,
    /// JAN正規化前にエラーならNone
    pub normalized_jan: Option<String>,
    pub name: String,
    pub raw_quantity: String,
    pub raw_amount: String,
    /// "unmatched_product" / "invalid_format" / "invalid_jan" / "invalid_number"
    pub error_type: CsvImportErrorType,
    /// 利用者向け日本語メッセージ
    pub error_message: String,
}

/// commit_csv_import のリクエスト（CMD層が組み立て）
#[derive(Debug)]
pub struct CommitRequest {
    /// 同日追加取込み確認済みフラグ
    pub additional_import_confirmed: bool,
    /// CMD層がキャッシュから復元したデータ
    pub cached_data: CachedPreview,
}

/// サーバ側メモリキャッシュ（CMD層の AppState で管理）
#[derive(Debug, Clone)]
pub struct CachedPreview {
    /// キャッシュ作成時刻（有効期限判定に使用）
    pub created_at: std::time::Instant,
    pub matched_rows: Vec<MatchedRow>,
    pub error_rows: Vec<ErrorRow>,
    /// フロントエンドに返した内容のコピー
    pub preview_data: PreviewData,
    /// preview 時点の同日 active import ID snapshot（表示順）
    pub active_same_date_import_ids: Vec<i64>,
}

/// commit_csv_import の結果
#[derive(Debug, Serialize, specta::Type)]
pub struct ImportResult {
    pub csv_import_id: i64,
    /// "completed" / "completed_partial"
    pub status: crate::db::sales_repo::CsvImportStatus,
    pub total_items: i64,
    pub total_amount: i64,
    pub skipped_count: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum CsvImportErrorType {
    UnmatchedProduct,
    InvalidFormat,
    InvalidJan,
    InvalidNumber,
}

impl CsvImportErrorType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::UnmatchedProduct => "unmatched_product",
            Self::InvalidFormat => "invalid_format",
            Self::InvalidJan => "invalid_jan",
            Self::InvalidNumber => "invalid_number",
        }
    }

    fn from_db(value: &str) -> Result<Self, crate::db::DbError> {
        match value {
            "unmatched_product" => Ok(Self::UnmatchedProduct),
            "invalid_format" => Ok(Self::InvalidFormat),
            "invalid_jan" => Ok(Self::InvalidJan),
            "invalid_number" => Ok(Self::InvalidNumber),
            other => Err(crate::db::DbError::QueryFailed(format!(
                "unknown csv import error type: {other}"
            ))),
        }
    }
}

/// CSV取込み記録詳細の wire DTO。
///
/// docs/function-design/32-biz-csv-import-service.md §15.6a
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct CsvImportRecordDetail {
    pub id: i64,
    pub filename: String,
    pub settlement_date: String,
    pub total_items: i64,
    pub total_amount: i64,
    pub skipped_count: i64,
    pub status: crate::db::sales_repo::CsvImportStatus,
    pub imported_at: String,
    pub items: Vec<crate::db::sales_repo::CsvImportRecordDetailItem>,
    pub error_rows: Vec<ErrorRow>,
    pub movements: Vec<crate::db::inventory_repo::MovementRecord>,
}

/// rollback_csv_import の結果
#[derive(Debug, Serialize, specta::Type)]
pub struct RollbackResult {
    pub success: bool,
    pub voided_sale_count: u64,
    pub voided_movement_count: usize,
    pub stock_corrections: Vec<StockCorrection>,
}

/// 在庫補正の詳細（rollback結果に含まれる）
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct StockCorrection {
    pub product_code: String,
    pub old_stock: i64,
    pub new_stock: i64,
}
