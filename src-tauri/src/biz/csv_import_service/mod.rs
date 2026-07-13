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
pub use list::list_csv_imports;
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
    /// OverwriteRequired時のみSome
    pub existing_import_id: Option<i64>,
}

/// 重複チェックのステータス
#[derive(Debug, Clone, Serialize, PartialEq, specta::Type)]
pub enum DuplicateStatus {
    /// 問題なし
    NoDuplicate,
    /// 同settlement_date、別ファイル → 上書き確認
    OverwriteRequired,
}

/// マスタ照合成功行（サーバ側キャッシュに保持、フロントエンドには送らない）
#[derive(Debug, Clone)]
pub struct MatchedRow {
    /// Z004の行番号（1始まり）
    pub line_no: usize,
    /// 紐付いた商品コード
    pub product_code: String,
    /// 正規化後のJAN
    pub jan_code: String,
    /// Z004上の商品名
    pub name: String,
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
    pub error_type: String,
    /// 利用者向け日本語メッセージ
    pub error_message: String,
}

/// commit_csv_import のリクエスト（CMD層が組み立て）
#[derive(Debug)]
pub struct CommitRequest {
    /// parse_and_validate が返した token
    pub preview_token: String,
    /// 上書き確認済みフラグ
    pub overwrite_confirmed: bool,
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
}

/// commit_csv_import の結果
#[derive(Debug, Serialize, specta::Type)]
pub struct ImportResult {
    pub csv_import_id: i64,
    /// "completed" / "completed_partial"
    pub status: String,
    pub total_items: i64,
    pub total_amount: i64,
    pub skipped_count: i64,
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
