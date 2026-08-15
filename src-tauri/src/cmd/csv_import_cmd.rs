//! CMD-07: CSV取込みコマンド群
//!
//! docs/function-design/41-cmd-pos.md §17.5 に基づく実装。
//! CMD層は薄いラッパー。キャッシュ管理とBizError→CmdError変換のみ。

use crate::biz::csv_import_service::{
    self, CachedPreview, CommitRequest, CsvParseAndValidateRequest, PreviewData,
};
use crate::cmd::{AppState, CmdError, CmdErrorKind};
use crate::constants;
use std::time::Instant;
use tauri::State;

// ---------------------------------------------------------------------------
// レスポンス型
// ---------------------------------------------------------------------------

/// parse_and_validate_csv のレスポンス（フロントエンド返却用）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ParseAndValidateResponse {
    /// プレビューデータ（表示用）
    pub preview_data: PreviewData,
    /// commit時に送り返すトークン
    pub preview_token: String,
}

// ---------------------------------------------------------------------------
// コマンド
// ---------------------------------------------------------------------------

/// Z004ファイルを受け取り、プレビューデータを返す
///
/// docs/function-design/41-cmd-pos.md §17.5 parse_and_validate_csv
#[tauri::command]
#[specta::specta]
pub fn parse_and_validate_csv(
    state: State<AppState>,
    file_bytes: Vec<u8>,
    filename: String,
) -> Result<ParseAndValidateResponse, CmdError> {
    // 1. サイズチェック（防御的。BIZ層にも同じチェックあり）
    if file_bytes.len() > constants::CSV_IMPORT_FILE_SIZE_LIMIT {
        return Err(CmdError {
            kind: CmdErrorKind::Validation,
            message: "ファイルサイズが上限(20MB)を超えています".to_string(),
            field: None,
            error_id: None,
        });
    }

    // 2. DB接続取得 → BIZ呼び出し → DB解放
    let result = {
        let conn = state
            .db
            .lock()
            .map_err(|error| CmdError::internal("DB接続エラー", error))?;
        let req = CsvParseAndValidateRequest {
            file_bytes,
            filename,
        };
        csv_import_service::parse_and_validate(&conn, req).map_err(CmdError::from)?
    }; // db lock解放

    // 3. キャッシュ保存（db lock解放後にcache lock — デッドロック防止）
    let preview_token = result.preview_token.clone();
    let response = ParseAndValidateResponse {
        preview_data: result.preview_data.clone(),
        preview_token: preview_token.clone(),
    };

    {
        let mut cache = state
            .preview_cache
            .lock()
            .map_err(|error| CmdError::internal("キャッシュ取得エラー", error))?;

        // FIFO eviction: 上限超過時は最古を削除
        if cache.len() >= constants::PREVIEW_CACHE_LIMIT {
            if let Some(oldest_key) = cache
                .iter()
                .min_by_key(|(_, v)| v.created_at)
                .map(|(k, _)| k.clone())
            {
                cache.remove(&oldest_key);
            }
        }

        cache.insert(
            preview_token,
            CachedPreview {
                created_at: Instant::now(),
                matched_rows: result.matched_rows,
                error_rows: result.error_rows,
                preview_data: result.preview_data,
                active_same_date_import_ids: response
                    .preview_data
                    .duplicate_check
                    .same_date_imports
                    .iter()
                    .map(|item| item.id)
                    .collect(),
            },
        );
    }

    Ok(response)
}

/// プレビュー済みデータの取込みを確定する
///
/// docs/function-design/41-cmd-pos.md §17.5 commit_csv_import
#[tauri::command]
#[specta::specta]
pub fn commit_csv_import(
    state: State<AppState>,
    preview_token: String,
    additional_import_confirmed: bool,
) -> Result<csv_import_service::ImportResult, CmdError> {
    // 1. UUID形式バリデーション
    if uuid::Uuid::parse_str(&preview_token).is_err() {
        return Err(CmdError {
            kind: CmdErrorKind::Validation,
            message: "不正なプレビュートークンです".to_string(),
            field: None,
            error_id: None,
        });
    }

    // 2. キャッシュからデータ取得（clone で保持。成功時のみ remove）
    let cached_data = {
        let cache = state
            .preview_cache
            .lock()
            .map_err(|error| CmdError::internal("キャッシュ取得エラー", error))?;

        match cache.get(&preview_token) {
            None => {
                return Err(CmdError {
                    kind: CmdErrorKind::ImportError,
                    message: "プレビューが見つかりません。再度ファイルを選択してください"
                        .to_string(),
                    field: None,
                    error_id: None,
                });
            }
            Some(cached) => {
                // TTL検証（30分）
                if cached.created_at.elapsed().as_secs() > constants::PREVIEW_CACHE_TTL_SECS {
                    drop(cache);
                    // 期限切れ → remove
                    let mut cache = state
                        .preview_cache
                        .lock()
                        .map_err(|error| CmdError::internal("キャッシュ取得エラー", error))?;
                    cache.remove(&preview_token);
                    return Err(CmdError {
                        kind: CmdErrorKind::ImportError,
                        message:
                            "プレビューの有効期限が切れました（30分）。再度ファイルを選択してください"
                                .to_string(),
                        field: None,
                        error_id: None,
                    });
                }
                cached.clone()
            }
        }
    }; // cache lock解放

    // 3. DB接続取得 + BIZ呼び出し（cache lock なし — デッドロック防止）
    let mut conn = state
        .db
        .lock()
        .map_err(|error| CmdError::internal("DB接続エラー", error))?;

    let req = CommitRequest {
        additional_import_confirmed,
        cached_data,
    };

    match csv_import_service::commit_csv_import(&mut conn, req) {
        Ok(result) => {
            drop(conn); // db lock解放
                        // 成功時のみキャッシュから削除（設計書§17.5）
            let mut cache = state
                .preview_cache
                .lock()
                .map_err(|error| CmdError::internal("キャッシュ取得エラー", error))?;
            cache.remove(&preview_token);
            Ok(result)
        }
        Err(e) => {
            if e.to_string()
                .contains("同日の取込み状況が変わりました。再度プレビューしてください")
            {
                drop(conn);
                let mut cache = state
                    .preview_cache
                    .lock()
                    .map_err(|error| CmdError::internal("キャッシュ取得エラー", error))?;
                cache.remove(&preview_token);
            }
            Err(CmdError::from(e))
        }
    }
}

/// CSV取込みをロールバック（論理無効化）する
///
/// docs/function-design/41-cmd-pos.md §17.5 rollback_csv_import
#[tauri::command]
#[specta::specta]
pub fn rollback_csv_import(
    state: State<AppState>,
    csv_import_id: i64,
) -> Result<csv_import_service::RollbackResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|error| CmdError::internal("DB接続エラー", error))?;
    csv_import_service::rollback_csv_import(&mut conn, csv_import_id).map_err(CmdError::from)
}

/// CSV取込み履歴の一覧を返す
///
/// docs/function-design/41-cmd-pos.md §17.5 list_csv_imports
#[tauri::command]
#[specta::specta]
pub fn list_csv_imports(
    state: State<AppState>,
    page: u32,
    per_page: u32,
) -> Result<crate::biz::PaginatedResult<crate::biz::CsvImport>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|error| CmdError::internal("DB接続エラー", error))?;
    csv_import_service::list_csv_imports(&conn, page, per_page).map_err(CmdError::from)
}

/// CSV取込み記録の詳細を返す。
///
/// docs/function-design/41-cmd-pos.md §17.5 get_csv_import_record
#[tauri::command]
#[specta::specta]
pub fn get_csv_import_record(
    state: State<AppState>,
    import_id: i64,
) -> Result<csv_import_service::CsvImportRecordDetail, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|error| CmdError::internal("DB接続エラー", error))?;
    csv_import_service::get_csv_import_record(&conn, import_id).map_err(CmdError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::setup_test_db;
    use std::collections::HashMap;
    use std::sync::Mutex;
    use tauri::Manager;

    fn cmd_z004_bytes() -> Vec<u8> {
        let text = "\"精算日\",\"2026-03-21\",\"\",\"\",\"\"\r\n\
                    \"No.\",\"スキャニングコード\",\"商品名\",\"個数\",\"金額\"\r\n\
                    \"1\",\"4912345678901\",\"商品A\",\"1\",\"300\"";
        let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(text);
        encoded.into_owned()
    }

    fn cached_for_snapshot(created_at: Instant) -> CachedPreview {
        CachedPreview {
            created_at,
            matched_rows: Vec::new(),
            error_rows: Vec::new(),
            preview_data: PreviewData {
                file_info: csv_import_service::FileInfo {
                    filename: "Z004_new".to_string(),
                    settlement_date: "2026-03-21".to_string(),
                    file_hash: "new-hash".to_string(),
                },
                matched_summary: csv_import_service::MatchedSummary {
                    count: 0,
                    total_amount: 0,
                    warnings: Vec::new(),
                },
                error_summary: csv_import_service::ErrorSummary {
                    count: 0,
                    items: Vec::new(),
                },
                duplicate_check: csv_import_service::DuplicateCheck {
                    status: csv_import_service::DuplicateStatus::NoDuplicate,
                    same_date_imports: Vec::new(),
                },
                preview_created_at: "2026-03-21T10:00:00".to_string(),
            },
            active_same_date_import_ids: Vec::new(),
        }
    }

    #[test]
    fn test_get_csv_import_record_cmd_req206_not_found_kind() {
        // REQ-206 / 41 §17.5: production command 実呼びで not_found wire kind を固定する。
        let (_dir, conn) = setup_test_db();
        let app = tauri::test::mock_builder()
            .manage(AppState {
                db: Mutex::new(conn),
                preview_cache: Mutex::new(HashMap::new()),
                daily_report_preview_cache: Mutex::new(HashMap::new()),
            })
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let error = get_csv_import_record(app.state::<AppState>(), 99_999).unwrap_err();

        assert_eq!(error.kind, CmdErrorKind::NotFound);
        assert_eq!(error.message, "CSV取込み記録が見つかりません: 99999");
    }

    #[test]
    fn test_csv_cmd_req401_parse_cache_preserves_ordered_same_date_ids() {
        // REQ-401 / I-W2 / I-W5 / SPEC-SDI-D3,D4: production CMD cacheはresponse ordered IDsをそのまま保持する。
        let (_dir, conn) = setup_test_db();
        let now = "2026-03-21T08:00:00";
        conn.execute(
            "INSERT INTO products (product_code, jan_code, name, department_id, selling_price,
             cost_price, tax_rate, stock_quantity, stock_unit, is_discontinued, plu_dirty,
             pos_stock_sync, created_at, updated_at)
             VALUES ('TEST-001', '4912345678901', '商品A', 1, 300, 100, '10', 10, 'pcs', 0, 1, 1, ?1, ?1)",
            [now],
        )
        .unwrap();
        let first = crate::db::sales_repo::insert_csv_import(
            &conn,
            &crate::db::sales_repo::NewCsvImport {
                filename: "existing-a".into(),
                settlement_date: "2026-03-21".into(),
                file_hash: "existing-a-hash".into(),
                total_items: 1,
                total_amount: 100,
                skipped_count: 0,
                status: "completed".into(),
            },
        )
        .unwrap();
        let second = crate::db::sales_repo::insert_csv_import(
            &conn,
            &crate::db::sales_repo::NewCsvImport {
                filename: "existing-b".into(),
                settlement_date: "2026-03-21".into(),
                file_hash: "existing-b-hash".into(),
                total_items: 1,
                total_amount: 200,
                skipped_count: 0,
                status: "completed_partial".into(),
            },
        )
        .unwrap();
        let app = tauri::test::mock_builder()
            .manage(AppState {
                db: Mutex::new(conn),
                preview_cache: Mutex::new(HashMap::new()),
                daily_report_preview_cache: Mutex::new(HashMap::new()),
            })
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let response = parse_and_validate_csv(
            app.state::<AppState>(),
            cmd_z004_bytes(),
            "Z004_new.CSV".into(),
        )
        .unwrap();
        let response_ids: Vec<_> = response
            .preview_data
            .duplicate_check
            .same_date_imports
            .iter()
            .map(|item| item.id)
            .collect();
        assert_eq!(response_ids, vec![second, first]);
        let state = app.state::<AppState>();
        let cache = state.preview_cache.lock().unwrap();
        assert_eq!(
            cache
                .get(&response.preview_token)
                .unwrap()
                .active_same_date_import_ids,
            response_ids
        );
    }

    #[test]
    fn test_csv_cmd_req401_snapshot_mismatch_deletes_preview_token() {
        // REQ-401 / I-W5 / SPEC-SDI-D4: mismatch tokenは再利用させない。
        let (_dir, conn) = setup_test_db();
        let concurrent_id = crate::db::sales_repo::insert_csv_import(
            &conn,
            &crate::db::sales_repo::NewCsvImport {
                filename: "concurrent".into(),
                settlement_date: "2026-03-21".into(),
                file_hash: "concurrent-hash".into(),
                total_items: 1,
                total_amount: 1,
                skipped_count: 0,
                status: "completed".into(),
            },
        )
        .unwrap();
        let token = uuid::Uuid::new_v4().to_string();
        let mut cache = HashMap::new();
        cache.insert(token.clone(), cached_for_snapshot(Instant::now()));
        let app = tauri::test::mock_builder()
            .manage(AppState {
                db: Mutex::new(conn),
                preview_cache: Mutex::new(cache),
                daily_report_preview_cache: Mutex::new(HashMap::new()),
            })
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let error = commit_csv_import(app.state::<AppState>(), token.clone(), false).unwrap_err();
        assert_eq!(
            error.message,
            "同日の取込み状況が変わりました。再度プレビューしてください"
        );
        assert!(!app
            .state::<AppState>()
            .preview_cache
            .lock()
            .unwrap()
            .contains_key(&token));
        let retry = commit_csv_import(app.state::<AppState>(), token, false).unwrap_err();
        assert_eq!(retry.kind, CmdErrorKind::ImportError);

        let new_token = uuid::Uuid::new_v4().to_string();
        let mut fresh = cached_for_snapshot(Instant::now());
        fresh.preview_data.duplicate_check.status =
            csv_import_service::DuplicateStatus::AdditionalImportConfirmationRequired;
        fresh.active_same_date_import_ids = vec![concurrent_id];
        app.state::<AppState>()
            .preview_cache
            .lock()
            .unwrap()
            .insert(new_token.clone(), fresh);
        let committed =
            commit_csv_import(app.state::<AppState>(), new_token.clone(), true).unwrap();
        assert_eq!(
            committed.status,
            crate::db::sales_repo::CsvImportStatus::Completed
        );
        assert!(!app
            .state::<AppState>()
            .preview_cache
            .lock()
            .unwrap()
            .contains_key(&new_token));
    }
}
