//! CMD-08: PLU書出しコマンド群
//!
//! docs/function-design/41-cmd-pos.md §17.6 に基づく実装。

use crate::biz::plu_export_service::{
    self, ExportMode, PluExcludedReason, PluExportConfirmRequest, PluExportPrepareRequest,
};
use crate::cmd::{AppState, CmdError};
use base64::{engine::general_purpose, Engine as _};
use tauri::State;

// ---------------------------------------------------------------------------
// レスポンス型
// ---------------------------------------------------------------------------

/// PLUファイル生成レスポンス（フロントエンド返却用）
///
/// PluCsvOutput の bytes を base64 エンコードして返す。
/// フロントエンド側で base64デコード → native save dialog の保存先へ書き込む。
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct PluExportPrepareResponse {
    /// CP932バイト列のbase64エンコード
    pub bytes_base64: String,
    /// 推奨ファイル名（例: "PLU_20260408.txt"）
    pub suggested_filename: String,
    /// MIMEタイプ
    pub content_type: String,
    /// 文字エンコーディング名
    pub encoding: String,
    /// 書出し件数
    pub count: usize,
    /// PLUファイルに含めた商品コード一覧
    pub target_product_codes: Vec<String>,
    /// PLUファイルに含めなかった商品一覧
    pub excluded: Vec<PluExcludedProductResponse>,
    /// PLU上限超過警告（互換維持フィールド）
    pub over_limit_warning: bool,
}

#[derive(Debug, serde::Serialize, specta::Type)]
pub struct PluExcludedProductResponse {
    pub product_code: String,
    pub jan_code: Option<String>,
    pub name: String,
    pub reason: String,
}

/// PLU保存済み確認レスポンス（フロントエンド返却用）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct PluExportConfirmResponse {
    pub updated_count: usize,
    pub confirmed_at: String,
}

/// PLU dirty 商品レスポンス（フロントエンド返却用）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ProductResponse {
    pub product_code: String,
    pub jan_code: Option<String>,
    pub name: String,
    pub department_id: i64,
    pub selling_price: i64,
    pub cost_price: i64,
    pub stock_quantity: i64,
    pub plu_dirty: bool,
    pub plu_exported_at: Option<String>,
}

// ---------------------------------------------------------------------------
// コマンド
// ---------------------------------------------------------------------------

fn parse_export_mode(mode: &str) -> Result<ExportMode, CmdError> {
    match mode {
        "full" => Ok(ExportMode::Full),
        "diff" => Ok(ExportMode::Diff),
        _ => Err(CmdError {
            kind: "validation".to_string(),
            message: "書出しモードは 'full' または 'diff' を指定してください".to_string(),
            field: Some("mode".to_string()),
        }),
    }
}

/// PLUファイルを生成して返す。DB状態は更新しない。
///
/// docs/function-design/41-cmd-pos.md §17.6 prepare_plu_export
#[tauri::command]
#[specta::specta]
pub fn prepare_plu_export(
    state: State<AppState>,
    mode: String,
) -> Result<PluExportPrepareResponse, CmdError> {
    let export_mode = parse_export_mode(&mode)?;

    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let req = PluExportPrepareRequest { mode: export_mode };
    let result = plu_export_service::prepare_plu_export(&conn, req).map_err(CmdError::from)?;

    Ok(PluExportPrepareResponse {
        bytes_base64: general_purpose::STANDARD.encode(&result.csv_output.bytes),
        suggested_filename: result.csv_output.suggested_filename,
        content_type: result.csv_output.content_type.to_string(),
        encoding: result.csv_output.encoding.to_string(),
        count: result.count,
        target_product_codes: result.target_product_codes,
        excluded: result
            .excluded
            .into_iter()
            .map(|excluded| PluExcludedProductResponse {
                product_code: excluded.product_code,
                jan_code: excluded.jan_code,
                name: excluded.name,
                reason: excluded_reason_to_snake_case(&excluded.reason).to_string(),
            })
            .collect(),
        over_limit_warning: result.over_limit_warning,
    })
}

/// PLUファイル保存済み確認を受け、対象商品を未反映から外す
///
/// docs/function-design/41-cmd-pos.md §17.6 confirm_plu_export_saved
#[tauri::command]
#[specta::specta]
pub fn confirm_plu_export_saved(
    state: State<AppState>,
    product_codes: Vec<String>,
) -> Result<PluExportConfirmResponse, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let req = PluExportConfirmRequest { product_codes };
    let result =
        plu_export_service::confirm_plu_export_saved(&mut conn, req).map_err(CmdError::from)?;

    Ok(PluExportConfirmResponse {
        updated_count: result.updated_count,
        confirmed_at: result.confirmed_at,
    })
}

/// PLU書出しが必要な商品一覧を返す
///
/// docs/function-design/41-cmd-pos.md §17.6 list_plu_dirty
#[tauri::command]
#[specta::specta]
pub fn list_plu_dirty(state: State<AppState>) -> Result<Vec<ProductResponse>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let products = plu_export_service::list_plu_dirty(&conn).map_err(CmdError::from)?;

    // Product → ProductResponse 変換
    let responses = products
        .into_iter()
        .map(|p| ProductResponse {
            product_code: p.product_code,
            jan_code: p.jan_code,
            name: p.name,
            department_id: p.department_id,
            selling_price: p.selling_price,
            cost_price: p.cost_price,
            stock_quantity: p.stock_quantity,
            plu_dirty: p.plu_dirty,
            plu_exported_at: p.plu_exported_at,
        })
        .collect();

    Ok(responses)
}

fn excluded_reason_to_snake_case(reason: &PluExcludedReason) -> &'static str {
    match reason {
        PluExcludedReason::MissingJan => "missing_jan",
        PluExcludedReason::InvalidJanFormat => "invalid_jan_format",
        PluExcludedReason::InvalidCheckDigit => "invalid_check_digit",
        PluExcludedReason::GroupPriceMismatch => "group_price_mismatch",
    }
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_mode_conversion_full_req402() {
        // REQ-402: PLU書出し
        let result = parse_export_mode("full");
        assert!(result.is_ok());
    }

    #[test]
    fn test_export_mode_conversion_diff_req402() {
        // REQ-402: PLU書出し
        let result = parse_export_mode("diff");
        assert!(result.is_ok());
    }

    #[test]
    fn test_export_mode_conversion_invalid_req402() {
        // REQ-402: PLU書出し
        let result = parse_export_mode("invalid");
        assert!(result.is_err());
    }
}
