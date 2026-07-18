//! Tauriコマンド層（CMD）
//!
//! ARCHITECTURE.md: UI → CMD → BIZ → IO の一方向。
//! CMD層は薄いラッパー。業務ルールを持たない。

pub mod csv_import_cmd;
pub mod daily_report_import_cmd;
pub mod disposal_cmd;
pub mod integrity_cmd;
pub mod inventory_cmd;
pub mod manual_sale_cmd;
pub mod plu_export_cmd;
pub mod product_cmd;
pub mod receiving_cmd;
pub mod return_cmd;
pub mod sales_cmd;
pub mod settings_cmd;
pub mod stocktake_cmd;

use crate::biz::csv_import_service::CachedPreview;
use crate::biz::daily_report_import_service::CachedDailyReportPreview;
use crate::biz::{BizError, DbConnection};
use std::collections::HashMap;
use std::sync::Mutex;

// ---------------------------------------------------------------------------
// AppState
// ---------------------------------------------------------------------------

/// Tauri管理のアプリケーション状態
///
/// DB接続とCSV取込みPreviewキャッシュを保持する。
/// docs/function-design/41-cmd-pos.md §17.3
pub struct AppState {
    /// SQLite接続（Mutex で排他制御）
    pub db: Mutex<DbConnection>,
    /// CSV取込みPreviewキャッシュ（token → CachedPreview）
    pub preview_cache: Mutex<HashMap<String, CachedPreview>>,
    /// 日報取込みPreviewキャッシュ（token → CachedDailyReportPreview）
    pub daily_report_preview_cache: Mutex<HashMap<String, CachedDailyReportPreview>>,
}

// ---------------------------------------------------------------------------
// CmdError
// ---------------------------------------------------------------------------

/// UI向け構造化エラー
///
/// docs/function-design/40-cmd-product.md §5.3 + 41-cmd-pos.md §17.4
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct CmdError {
    /// エラー分類: validation / duplicate / not_found / internal / import_error /
    /// idempotency_conflict / stocktake_* / restore_failed_recovered /
    /// restore_failed_unrecoverable / restore_durability_unknown
    pub kind: String,
    /// 利用者向け日本語メッセージ
    pub message: String,
    /// バリデーションエラー時のフィールド名
    pub field: Option<String>,
}

impl CmdError {
    /// 内部エラー（DB接続取得失敗等）
    ///
    /// §70.7.1: CmdError::internal で直接生成するケースも ERROR ログを出力する。
    fn internal(message: &str) -> Self {
        tracing::error!(message, "CMD層内部エラー");
        Self {
            kind: "internal".to_string(),
            message: message.to_string(),
            field: None,
        }
    }

    pub(crate) fn restore_failed_recovered(message: &str) -> Self {
        Self::restore("restore_failed_recovered", message)
    }

    pub(crate) fn restore_failed_unrecoverable(message: &str, detail: &str) -> Self {
        Self::restore_with_detail("restore_failed_unrecoverable", message, detail)
    }

    pub(crate) fn restore_durability_unknown(message: &str, detail: &str) -> Self {
        Self::restore_with_detail("restore_durability_unknown", message, detail)
    }

    fn restore(kind: &str, message: &str) -> Self {
        Self::restore_with_detail(kind, message, message)
    }

    fn restore_with_detail(kind: &str, message: &str, detail: &str) -> Self {
        tracing::error!(kind, message, detail, "CMD層リストアエラー");
        Self {
            kind: kind.to_string(),
            message: message.to_string(),
            field: None,
        }
    }
}

/// BizError → CmdError の変換
///
/// docs/function-design/40-cmd-product.md §5.3 + 41-cmd-pos.md §17.4
/// §70.7.1: エラー境界での1回記録。全variantで tracing::error! を出力する。
impl From<BizError> for CmdError {
    fn from(err: BizError) -> Self {
        tracing::error!(error = %err, "CMD層エラー");
        match err {
            BizError::ValidationFailed(msg) => CmdError {
                kind: "validation".to_string(),
                message: msg,
                field: None,
            },
            BizError::NotFound(msg) => CmdError {
                kind: "not_found".to_string(),
                message: msg,
                field: None,
            },
            BizError::DuplicateProductCode(code) => CmdError {
                kind: "duplicate".to_string(),
                message: format!("この商品コードは既に使用されています: {}", code),
                field: None,
            },
            BizError::DatabaseError(_) => CmdError {
                kind: "internal".to_string(),
                message: "データベースエラーが発生しました。もう一度お試しください".to_string(),
                field: None,
            },
            BizError::ImportError(msg) => CmdError {
                kind: "import_error".to_string(),
                message: msg,
                field: None,
            },
            BizError::IdempotencyConflict(msg) => CmdError {
                kind: "idempotency_conflict".to_string(),
                message: msg,
                field: None,
            },
            BizError::StocktakeInProgress(msg) => CmdError {
                kind: "stocktake_in_progress".to_string(),
                message: msg,
                field: None,
            },
            BizError::StocktakeNotInProgress(msg) => CmdError {
                kind: "stocktake_not_in_progress".to_string(),
                message: msg,
                field: None,
            },
        }
    }
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbError;

    #[test]
    fn test_cmd_error_req905_from_import_error() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::ImportError("テストエラー".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "import_error");
        assert_eq!(cmd_err.message, "テストエラー");
        assert!(cmd_err.field.is_none());
    }

    #[test]
    fn test_cmd_error_req905_from_validation_failed() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::ValidationFailed("入力エラー".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "validation");
        assert_eq!(cmd_err.message, "入力エラー");
    }

    #[test]
    fn test_cmd_error_req905_from_not_found() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::NotFound("見つかりません".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "not_found");
    }

    #[test]
    fn test_cmd_error_req905_from_database_error() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let db_err = DbError::QueryFailed("test".to_string());
        let biz_err = BizError::DatabaseError(db_err);
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "internal");
        assert!(cmd_err.message.contains("データベースエラー"));
    }

    #[test]
    fn test_cmd_error_req905_from_duplicate() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::DuplicateProductCode("TEST-001".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "duplicate");
        assert!(cmd_err.message.contains("TEST-001"));
    }

    #[test]
    fn test_cmd_error_req905_restore_failure_kinds_are_stable() {
        // REQ-905 / MNT-01-D4 / Matrix F1
        assert_eq!(
            CmdError::restore_failed_recovered("recovered").kind,
            "restore_failed_recovered"
        );
        assert_eq!(
            CmdError::restore_failed_unrecoverable("fatal", "detail").kind,
            "restore_failed_unrecoverable"
        );
        assert_eq!(
            CmdError::restore_durability_unknown("unknown", "detail").kind,
            "restore_durability_unknown"
        );
    }

    #[test]
    fn test_cmd_error_req905_from_idempotency_conflict() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::IdempotencyConflict("競合".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, "idempotency_conflict");
    }
}
