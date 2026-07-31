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

/// UI向けエラー分類
///
/// docs/function-design/40-cmd-product.md §5.3 + 41-cmd-pos.md §17.4
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum CmdErrorKind {
    Validation,
    Duplicate,
    NotFound,
    Internal,
    ImportError,
    ExportError,
    IdempotencyConflict,
    StocktakeInProgress,
    StocktakeNotInProgress,
    RestoreFailedRecovered,
    RestoreFailedUnrecoverable,
    RestoreDurabilityUnknown,
}

/// UI向け構造化エラー
///
/// docs/function-design/40-cmd-product.md §5.3 + 41-cmd-pos.md §17.4
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct CmdError {
    /// エラー分類（`CmdErrorKind` の12値）
    pub kind: CmdErrorKind,
    /// 利用者向け日本語メッセージ
    pub message: String,
    /// バリデーションエラー時のフィールド名
    pub field: Option<String>,
    /// 診断ログとの相関 ID（internal / restore_* 系のみ）
    pub error_id: Option<String>,
}

impl CmdError {
    /// 内部エラー（DB接続取得失敗等）
    ///
    /// §70.7.1: CmdError::internal で直接生成するケースも ERROR ログを出力する。
    fn internal(message: &str, detail: impl std::fmt::Display) -> Self {
        Self::correlated(CmdErrorKind::Internal, message, detail)
    }

    pub(crate) fn restore_failed_recovered(message: &str) -> Self {
        Self::restore(CmdErrorKind::RestoreFailedRecovered, message)
    }

    pub(crate) fn restore_failed_unrecoverable(message: &str, detail: &str) -> Self {
        Self::restore_with_detail(CmdErrorKind::RestoreFailedUnrecoverable, message, detail)
    }

    pub(crate) fn restore_durability_unknown(message: &str, detail: &str) -> Self {
        Self::restore_with_detail(CmdErrorKind::RestoreDurabilityUnknown, message, detail)
    }

    fn restore(kind: CmdErrorKind, message: &str) -> Self {
        Self::restore_with_detail(kind, message, message)
    }

    fn restore_with_detail(kind: CmdErrorKind, message: &str, detail: &str) -> Self {
        Self::correlated(kind, message, detail)
    }

    fn correlated(kind: CmdErrorKind, message: &str, detail: impl std::fmt::Display) -> Self {
        let error_id = format!(
            "E-{}-{}",
            chrono::Local::now().format("%Y%m%d-%H%M%S"),
            &uuid::Uuid::new_v4().simple().to_string()[..4]
        );
        tracing::error!(kind = ?kind, error_id, detail = %detail, "CMD層相関エラー");
        Self {
            kind,
            message: message.to_string(),
            field: None,
            error_id: Some(error_id),
        }
    }
}

/// BizError → CmdError の変換
///
/// docs/function-design/40-cmd-product.md §5.3 + 41-cmd-pos.md §17.4
/// §70.7.1: エラー境界での1回記録。全variantで tracing::error! を出力する。
impl From<BizError> for CmdError {
    fn from(err: BizError) -> Self {
        if let BizError::DatabaseError(detail) = &err {
            return CmdError::internal(
                "データベースエラーが発生しました。もう一度お試しください",
                detail,
            );
        }
        tracing::error!(error = %err, "CMD層エラー");
        match err {
            BizError::ValidationFailed(msg) => CmdError {
                kind: CmdErrorKind::Validation,
                message: msg,
                field: None,
                error_id: None,
            },
            BizError::ValidationFailedAt { message, field } => CmdError {
                kind: CmdErrorKind::Validation,
                message,
                field: Some(field),
                error_id: None,
            },
            BizError::NotFound(msg) => CmdError {
                kind: CmdErrorKind::NotFound,
                message: msg,
                field: None,
                error_id: None,
            },
            BizError::DuplicateProductCode(code) => CmdError {
                kind: CmdErrorKind::Duplicate,
                message: format!("この商品コードは既に使用されています: {}", code),
                field: None,
                error_id: None,
            },
            BizError::DatabaseError(_) => unreachable!("handled before generic logging"),
            BizError::ImportError(msg) => CmdError {
                kind: CmdErrorKind::ImportError,
                message: msg,
                field: None,
                error_id: None,
            },
            BizError::ExportError(msg) => CmdError {
                kind: CmdErrorKind::ExportError,
                message: msg,
                field: None,
                error_id: None,
            },
            BizError::IdempotencyConflict(msg) => CmdError {
                kind: CmdErrorKind::IdempotencyConflict,
                message: msg,
                field: None,
                error_id: None,
            },
            BizError::StocktakeInProgress(msg) => CmdError {
                kind: CmdErrorKind::StocktakeInProgress,
                message: msg,
                field: None,
                error_id: None,
            },
            BizError::StocktakeNotInProgress(msg) => CmdError {
                kind: CmdErrorKind::StocktakeNotInProgress,
                message: msg,
                field: None,
                error_id: None,
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
    use regex::Regex;

    #[test]
    fn test_cmd_error_req905_from_import_error() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::ImportError("テストエラー".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, CmdErrorKind::ImportError);
        assert_eq!(cmd_err.message, "テストエラー");
        assert!(cmd_err.field.is_none());
    }

    #[test]
    fn test_cmd_error_req905_from_validation_failed() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::ValidationFailed("入力エラー".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, CmdErrorKind::Validation);
        assert_eq!(cmd_err.message, "入力エラー");
    }

    #[test]
    fn test_cmd_error_req205_from_validation_failed_at_preserves_field() {
        // REQ-205 / BIZ-06-VAL-D1: BIZ由来のfield付きvalidationをwire tripleへ変換する。
        let biz_err = BizError::ValidationFailedAt {
            message: "ページ番号は1以上で指定してください".to_string(),
            field: "page".to_string(),
        };
        let cmd_err: CmdError = biz_err.into();

        assert_eq!(cmd_err.kind, CmdErrorKind::Validation);
        assert_eq!(cmd_err.message, "ページ番号は1以上で指定してください");
        assert_eq!(cmd_err.field.as_deref(), Some("page"));
    }

    #[test]
    fn test_cmd_error_req905_from_not_found() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::NotFound("見つかりません".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, CmdErrorKind::NotFound);
    }

    #[test]
    fn test_cmd_error_req905_from_database_error() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let db_err = DbError::QueryFailed("test".to_string());
        let biz_err = BizError::DatabaseError(db_err);
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, CmdErrorKind::Internal);
        assert!(cmd_err.message.contains("データベースエラー"));
        assert!(cmd_err.error_id.is_some());
    }

    #[test]
    fn test_cmd_error_req905_from_duplicate() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::DuplicateProductCode("TEST-001".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, CmdErrorKind::Duplicate);
        assert!(cmd_err.message.contains("TEST-001"));
    }

    #[test]
    fn test_cmd_error_req905_restore_failure_kinds_are_stable() {
        // REQ-905 / MNT-01-D4 / Matrix F1
        assert_eq!(
            CmdError::restore_failed_recovered("recovered").kind,
            CmdErrorKind::RestoreFailedRecovered
        );
        assert_eq!(
            CmdError::restore_failed_unrecoverable("fatal", "detail").kind,
            CmdErrorKind::RestoreFailedUnrecoverable
        );
        assert_eq!(
            CmdError::restore_durability_unknown("unknown", "detail").kind,
            CmdErrorKind::RestoreDurabilityUnknown
        );
    }

    #[test]
    fn test_internal_error_id_req700_wire_log_match() {
        // REQ-700 / CMD-ERR-D1: wire と診断ログは同じ相関 ID を共有する。
        let raw_detail = "synthetic sqlite detail: /tmp/synthetic.db";
        let (cmd_err, logs) = crate::test_tracing::capture(|| {
            CmdError::internal("在庫情報の取得でエラーが発生しました", raw_detail)
        });
        let error_id = cmd_err.error_id.as_deref().expect("internal error_id");
        let pattern = Regex::new(r"^E-\d{8}-\d{6}-[0-9a-f]{4}$").unwrap();

        assert!(
            pattern.is_match(error_id),
            "unexpected error_id: {error_id}"
        );
        assert!(logs.contains(error_id), "captured logs: {logs:?}");
        assert!(logs.contains(raw_detail), "captured logs: {logs:?}");
    }

    #[test]
    fn test_internal_message_req700_excludes_raw_detail() {
        // REQ-700 / CMD-ERR-D2: raw detail は wire message に混ぜない。
        let raw_detail = "synthetic OS error: permission denied /tmp/synthetic.db";
        let cmd_err =
            CmdError::internal("バックアップ一覧の取得でエラーが発生しました", raw_detail);

        assert_eq!(
            cmd_err.message,
            "バックアップ一覧の取得でエラーが発生しました"
        );
        assert!(!cmd_err.message.contains(raw_detail));
        assert!(!cmd_err.message.contains("/tmp/synthetic.db"));
    }

    #[test]
    fn test_restore_kinds_req700_carry_error_id() {
        // REQ-700 / CMD-ERR-D1 / 68 §68.7: restore 3 kind は相関 ID を持つ。
        let errors = [
            CmdError::restore_failed_recovered("recovered"),
            CmdError::restore_failed_unrecoverable("fatal", "fatal detail"),
            CmdError::restore_durability_unknown("unknown", "unknown detail"),
        ];
        let pattern = Regex::new(r"^E-\d{8}-\d{6}-[0-9a-f]{4}$").unwrap();

        for error in errors {
            let error_id = error.error_id.as_deref().expect("restore error_id");
            assert!(
                pattern.is_match(error_id),
                "unexpected error_id: {error_id}"
            );
        }
    }

    #[test]
    fn test_plu_format_failure_req402_maps_to_export_error() {
        // REQ-402 / BIZ-04-D2: PLU 書出し失敗は import_error と分離する。
        let cmd_err: CmdError = BizError::ExportError("PLU生成失敗".to_string()).into();

        assert_eq!(cmd_err.kind, CmdErrorKind::ExportError);
        assert_eq!(cmd_err.message, "PLU生成失敗");
        assert!(cmd_err.error_id.is_none());
    }

    #[test]
    fn test_cmd_error_req905_from_idempotency_conflict() {
        // REQ-905: 設定管理（設定CRUD/エラー変換）
        let biz_err = BizError::IdempotencyConflict("競合".to_string());
        let cmd_err: CmdError = biz_err.into();
        assert_eq!(cmd_err.kind, CmdErrorKind::IdempotencyConflict);
    }
}
