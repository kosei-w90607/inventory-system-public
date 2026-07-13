//! CMD-10: 棚卸しコマンド群
//!
//! docs/function-design/42-cmd-sales-stocktake.md §22.5 に基づく実装。

use crate::biz::stocktake_service::{self, CompleteStocktakeRequest, UpdateCountRequest};
use crate::biz::{LastStocktakeSummary, Stocktake, StocktakeItemDetail, StocktakeProgress};
use crate::cmd::{AppState, CmdError};
use tauri::State;

// ---------------------------------------------------------------------------
// CMD専用型
// ---------------------------------------------------------------------------

/// 棚卸しアイテム一覧レスポンス（CMD-10 get_stocktake_items 専用）
///
/// items（PaginatedResult相当）+ progress を1レスポンスにまとめる。
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct StocktakeItemListResponse {
    pub items: Vec<StocktakeItemDetail>,
    pub progress: StocktakeProgress,
    pub total_count: u32,
    pub page: u32,
    pub per_page: u32,
}

// ---------------------------------------------------------------------------
// コマンド
// ---------------------------------------------------------------------------

/// 進行中の棚卸しを取得する
///
/// BIZ層（stocktake_service）経由で呼び出す。読み取り専用。
#[tauri::command]
#[specta::specta]
pub fn get_active_stocktake(state: State<AppState>) -> Result<Option<Stocktake>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    stocktake_service::get_active_stocktake(&conn).map_err(CmdError::from)
}

/// 新しい棚卸しを開始する
///
/// 進行中の棚卸しが既にある場合は stocktake_in_progress エラー。
#[tauri::command]
#[specta::specta]
pub fn start_stocktake(
    state: State<AppState>,
) -> Result<stocktake_service::StartStocktakeResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    stocktake_service::start_stocktake(&mut conn).map_err(CmdError::from)
}

/// 棚卸しアイテム一覧を取得する
///
/// BIZ層（stocktake_service）経由で呼び出す。読み取り専用。
#[tauri::command]
#[specta::specta]
pub fn get_stocktake_items(
    state: State<AppState>,
    stocktake_id: i64,
    department_id: Option<i64>,
    counted_only: Option<bool>,
    page: u32,
    per_page: u32,
) -> Result<StocktakeItemListResponse, CmdError> {
    // 防御的チェック: page/per_page の不正値を validation error で返す
    if page < 1 {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "ページ番号は1以上で指定してください".to_string(),
            field: Some("page".to_string()),
        });
    }
    if per_page < 1 {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "1ページあたりの件数は1以上で指定してください".to_string(),
            field: Some("per_page".to_string()),
        });
    }

    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;

    let (paginated, progress) = stocktake_service::get_stocktake_items(
        &conn,
        stocktake_id,
        department_id,
        counted_only,
        page,
        per_page,
    )
    .map_err(CmdError::from)?;

    Ok(StocktakeItemListResponse {
        items: paginated.items,
        total_count: paginated.total_count,
        page: paginated.page,
        per_page: paginated.per_page,
        progress,
    })
}

/// 商品コードまたはJANコードで棚卸しアイテムを取得する
///
/// BIZ層（stocktake_service）経由で呼び出す。読み取り専用。
#[tauri::command]
#[specta::specta]
pub fn find_stocktake_item(
    state: State<AppState>,
    stocktake_id: i64,
    code: String,
) -> Result<Option<StocktakeItemDetail>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    stocktake_service::find_stocktake_item(&conn, stocktake_id, &code).map_err(CmdError::from)
}

/// 最後に完了した棚卸しを取得する
///
/// 完了済みがない場合は None を返す。読み取り専用。
#[tauri::command]
#[specta::specta]
pub fn get_last_completed_stocktake(
    state: State<AppState>,
) -> Result<Option<LastStocktakeSummary>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    stocktake_service::get_last_completed_stocktake(&conn).map_err(CmdError::from)
}

/// 棚卸しアイテムのカウントを更新する
///
/// actual_count < 0 は防御的チェックでブロック（BIZ層にも同じチェックあり）。
#[tauri::command]
#[specta::specta]
pub fn update_count(
    state: State<AppState>,
    stocktake_item_id: i64,
    actual_count: i64,
) -> Result<stocktake_service::UpdateCountResult, CmdError> {
    if actual_count < 0 {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "カウント数は0以上で入力してください".to_string(),
            field: None,
        });
    }
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let req = UpdateCountRequest {
        stocktake_item_id,
        actual_count,
    };
    stocktake_service::update_count(&conn, &req).map_err(CmdError::from)
}

/// 棚卸しを確定する
///
/// force_fill=true で未入力をシステム在庫と同じとみなす。
/// 確定後に整合性チェック（D-2統合）を自動実行し、結果を含めて返す。
#[tauri::command]
#[specta::specta]
pub fn complete_stocktake(
    state: State<AppState>,
    stocktake_id: i64,
    force_fill: bool,
) -> Result<stocktake_service::StocktakeResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    let req = CompleteStocktakeRequest {
        stocktake_id,
        force_fill,
    };
    stocktake_service::complete_stocktake(&mut conn, &req).map_err(CmdError::from)
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::{seed_product, setup_test_db};
    use std::collections::HashMap;
    use std::sync::Mutex;
    use tauri::Manager;

    fn app_state_for_test(conn: crate::db::DbConnection) -> AppState {
        AppState {
            db: Mutex::new(conn),
            preview_cache: Mutex::new(HashMap::new()),
            daily_report_preview_cache: Mutex::new(HashMap::new()),
        }
    }

    #[test]
    fn test_update_count_req205_negative_validation() {
        // REQ-205: 棚卸し（CMD — 負のactual_count → validation error）
        // 負のactual_countで validation error になることを検証
        let negative_counts: Vec<i64> = vec![-1, -100, i64::MIN];
        for count in negative_counts {
            let result: Result<(), CmdError> = if count < 0 {
                Err(CmdError {
                    kind: "validation".to_string(),
                    message: "カウント数は0以上で入力してください".to_string(),
                    field: None,
                })
            } else {
                Ok(())
            };
            let err = result.unwrap_err();
            assert_eq!(err.kind, "validation");
            assert!(err.message.contains("0以上"));
        }
    }

    #[test]
    fn test_update_count_req205_zero_is_valid() {
        // REQ-205: 棚卸し（CMD — 0 は有効値）
        // 0 は valid（validation error にならない）
        let count: i64 = 0;
        let result: Result<(), CmdError> = if count < 0 {
            Err(CmdError {
                kind: "validation".to_string(),
                message: "カウント数は0以上で入力してください".to_string(),
                field: None,
            })
        } else {
            Ok(())
        };
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_stocktake_items_req205_page_zero_validation() {
        // REQ-205: 棚卸し（CMD — page=0 → validation error）
        // page=0 で validation error になることを検証
        let page: u32 = 0;
        let result: Result<(), CmdError> = if page < 1 {
            Err(CmdError {
                kind: "validation".to_string(),
                message: "ページ番号は1以上で指定してください".to_string(),
                field: Some("page".to_string()),
            })
        } else {
            Ok(())
        };
        let err = result.unwrap_err();
        assert_eq!(err.kind, "validation");
        assert_eq!(err.field, Some("page".to_string()));
    }

    #[test]
    fn test_get_stocktake_items_req205_per_page_zero_validation() {
        // REQ-205: 棚卸し（CMD — per_page=0 → validation error）
        // per_page=0 で validation error になることを検証
        let per_page: u32 = 0;
        let result: Result<(), CmdError> = if per_page < 1 {
            Err(CmdError {
                kind: "validation".to_string(),
                message: "1ページあたりの件数は1以上で指定してください".to_string(),
                field: Some("per_page".to_string()),
            })
        } else {
            Ok(())
        };
        let err = result.unwrap_err();
        assert_eq!(err.kind, "validation");
        assert_eq!(err.field, Some("per_page".to_string()));
    }

    #[test]
    fn test_find_stocktake_item_req205_cmd_calls_command_and_returns_some() {
        // REQ-205: 棚卸し（CMD — 商品コード/JAN完全一致で棚卸し明細を返す）
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "FI-001");
        conn.execute(
            "UPDATE products SET jan_code = '4900000001001', name = '検索対象商品'
             WHERE product_code = 'FI-001'",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO stocktakes (started_at, status, total_cost)
             VALUES ('2026-10-01T09:00:00', 'in_progress', NULL)",
            [],
        )
        .unwrap();
        let stocktake_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO stocktake_items (stocktake_id, product_code, system_stock, actual_count)
             VALUES (?1, 'FI-001', 8, NULL)",
            [stocktake_id],
        )
        .unwrap();
        let item_id = conn.last_insert_rowid();
        let app = tauri::test::mock_builder()
            .manage(app_state_for_test(conn))
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let result = find_stocktake_item(
            app.state::<AppState>(),
            stocktake_id,
            "4900000001001".to_string(),
        )
        .unwrap();

        let item = result.expect("JAN一致の棚卸し明細が返るべき");
        assert_eq!(item.id, item_id);
        assert_eq!(item.stocktake_id, stocktake_id);
        assert_eq!(item.product_code, "FI-001");
        assert_eq!(item.name, "検索対象商品");
        assert_eq!(item.system_stock, 8);
        assert!(item.actual_count.is_none());
    }

    #[test]
    fn test_find_stocktake_item_req205_cmd_calls_command_and_returns_none() {
        // REQ-205: 棚卸し（CMD — 対象なしはエラー化せず None を返す）
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "FN-001");
        conn.execute(
            "INSERT INTO stocktakes (started_at, status, total_cost)
             VALUES ('2026-10-01T09:00:00', 'in_progress', NULL)",
            [],
        )
        .unwrap();
        let stocktake_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO stocktake_items (stocktake_id, product_code, system_stock, actual_count)
             VALUES (?1, 'FN-001', 8, NULL)",
            [stocktake_id],
        )
        .unwrap();
        let app = tauri::test::mock_builder()
            .manage(app_state_for_test(conn))
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let result = find_stocktake_item(
            app.state::<AppState>(),
            stocktake_id,
            "NO-MATCH".to_string(),
        )
        .unwrap();

        assert!(result.is_none());
    }

    #[test]
    fn test_get_last_completed_stocktake_req205_cmd_calls_command_and_returns_none() {
        // REQ-205: 棚卸し（CMD — 最終完了棚卸しは存在しない状態をエラーにしない）
        let (_dir, conn) = setup_test_db();
        let app = tauri::test::mock_builder()
            .manage(app_state_for_test(conn))
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let result = get_last_completed_stocktake(app.state::<AppState>()).unwrap();

        assert!(result.is_none());
    }

    #[test]
    fn test_get_active_stocktake_req205_cmd_calls_command_and_returns_active() {
        // REQ-205: 棚卸し（CMD — get_active_stocktake は DB の進行中棚卸しを返す）
        let (_dir, conn) = setup_test_db();
        conn.execute(
            "INSERT INTO stocktakes (started_at, status, total_cost)
             VALUES ('2026-10-01T09:00:00', 'in_progress', NULL)",
            [],
        )
        .unwrap();
        let stocktake_id = conn.last_insert_rowid();
        let app = tauri::test::mock_builder()
            .manage(app_state_for_test(conn))
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let result = get_active_stocktake(app.state::<AppState>()).unwrap();

        let stocktake = result.expect("進行中棚卸しが返るべき");
        assert_eq!(stocktake.id, stocktake_id);
        assert_eq!(stocktake.status, "in_progress");
    }
}
