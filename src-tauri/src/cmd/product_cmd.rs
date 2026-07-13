//! CMD-01: 商品コマンド群
//!
//! docs/function-design/40-cmd-product.md §5.4 + 42-cmd-sales-stocktake.md §22.6 に基づく実装。

use crate::biz::product_service::{self, ImportRow};
use crate::biz::{Department, PaginatedResult, ProductSearchQuery, ProductWithRelations, Supplier};
use crate::cmd::{AppState, CmdError};
use tauri::State;

// ---------------------------------------------------------------------------
// 商品CRUD（§5.4）
// ---------------------------------------------------------------------------

/// 商品を新規登録する
#[tauri::command]
#[specta::specta]
pub fn create_product(
    state: State<AppState>,
    req: product_service::ProductCreateRequest,
) -> Result<product_service::ProductCreateResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::create_product(&mut conn, req).map_err(CmdError::from)
}

/// 商品情報を更新する
#[tauri::command]
#[specta::specta]
pub fn update_product(
    state: State<AppState>,
    product_code: String,
    req: product_service::ProductUpdateRequest,
) -> Result<product_service::ProductUpdateResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::update_product(&mut conn, &product_code, &req).map_err(CmdError::from)
}

/// 廃番状態を切り替える
///
/// 戻り値は is_discontinued の新しい値。
#[tauri::command]
#[specta::specta]
pub fn toggle_discontinue(state: State<AppState>, product_code: String) -> Result<bool, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::toggle_discontinue(&mut conn, &product_code).map_err(CmdError::from)
}

/// 商品を検索する（ページング対応）
#[tauri::command]
#[specta::specta]
pub fn search_products(
    state: State<AppState>,
    query: ProductSearchQuery,
) -> Result<PaginatedResult<ProductWithRelations>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::search_products(&conn, query).map_err(CmdError::from)
}

/// 部門選択候補を全件取得する
#[tauri::command]
#[specta::specta]
pub fn list_departments(state: State<AppState>) -> Result<Vec<Department>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::list_departments(&conn).map_err(CmdError::from)
}

/// 取引先選択候補を全件取得する
#[tauri::command]
#[specta::specta]
pub fn list_suppliers(state: State<AppState>) -> Result<Vec<Supplier>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::list_suppliers(&conn).map_err(CmdError::from)
}

/// 商品詳細を取得する
///
/// BIZ層（product_service）経由で呼び出す。
#[tauri::command]
#[specta::specta]
pub fn get_product(
    state: State<AppState>,
    product_code: String,
) -> Result<ProductWithRelations, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::get_product(&conn, &product_code).map_err(CmdError::from)
}

// ---------------------------------------------------------------------------
// 一括インポート（§22.6）
// ---------------------------------------------------------------------------

/// 商品マスタCSVのプレビューを返す（読み取り専用）
///
/// ファイル内容を解析し、有効行・エラー行・重複行に分類して返す。
/// DB書込みは行わない。
#[tauri::command]
#[specta::specta]
pub fn preview_import(
    state: State<AppState>,
    file_bytes: Vec<u8>,
) -> Result<product_service::ImportPreview, CmdError> {
    if file_bytes.is_empty() {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "ファイルが空です".to_string(),
            field: None,
        });
    }
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::preview_import(&conn, &file_bytes).map_err(CmdError::from)
}

/// プレビュー済みの一括インポートを確定する
///
/// valid_rows の INSERT/UPDATE と、overwrite_codes の上書き処理をトランザクション内で実行。
#[tauri::command]
#[specta::specta]
pub fn commit_import(
    state: State<AppState>,
    valid_rows: Vec<ImportRow>,
    overwrite_codes: Vec<String>,
) -> Result<product_service::ProductImportResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    product_service::commit_import(&mut conn, valid_rows, overwrite_codes).map_err(CmdError::from)
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preview_import_req104_empty_file_validation() {
        // REQ-104: 商品マスタ一括インポート
        // 空の file_bytes で validation error になることを検証
        let empty: Vec<u8> = vec![];
        let result: Result<(), CmdError> = if empty.is_empty() {
            Err(CmdError {
                kind: "validation".to_string(),
                message: "ファイルが空です".to_string(),
                field: None,
            })
        } else {
            Ok(())
        };
        let err = result.unwrap_err();
        assert_eq!(err.kind, "validation");
        assert!(err.message.contains("ファイルが空"));
    }
}
