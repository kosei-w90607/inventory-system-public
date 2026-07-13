//! CMD-07: CSV取込みコマンド群
//!
//! docs/function-design/41-cmd-pos.md §17.5 に基づく実装。
//! CMD層は薄いラッパー。キャッシュ管理とBizError→CmdError変換のみ。

use crate::biz::csv_import_service::{
    self, CachedPreview, CommitRequest, CsvParseAndValidateRequest, PreviewData,
};
use crate::cmd::{AppState, CmdError};
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
            kind: "validation".to_string(),
            message: "ファイルサイズが上限(20MB)を超えています".to_string(),
            field: None,
        });
    }

    // 2. DB接続取得 → BIZ呼び出し → DB解放
    let result = {
        let conn = state
            .db
            .lock()
            .map_err(|_| CmdError::internal("DB接続エラー"))?;
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
            .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;

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
    overwrite_confirmed: bool,
) -> Result<csv_import_service::ImportResult, CmdError> {
    // 1. UUID形式バリデーション
    if uuid::Uuid::parse_str(&preview_token).is_err() {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "不正なプレビュートークンです".to_string(),
            field: None,
        });
    }

    // 2. キャッシュからデータ取得（clone で保持。成功時のみ remove）
    let cached_data = {
        let cache = state
            .preview_cache
            .lock()
            .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;

        match cache.get(&preview_token) {
            None => {
                return Err(CmdError {
                    kind: "import_error".to_string(),
                    message: "プレビューが見つかりません。再度ファイルを選択してください"
                        .to_string(),
                    field: None,
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
                        .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;
                    cache.remove(&preview_token);
                    return Err(CmdError {
                        kind: "import_error".to_string(),
                        message:
                            "プレビューの有効期限が切れました（30分）。再度ファイルを選択してください"
                                .to_string(),
                        field: None,
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
        .map_err(|_| CmdError::internal("DB接続エラー"))?;

    let req = CommitRequest {
        preview_token: preview_token.clone(),
        overwrite_confirmed,
        cached_data,
    };

    match csv_import_service::commit_csv_import(&mut conn, req) {
        Ok(result) => {
            drop(conn); // db lock解放
                        // 成功時のみキャッシュから削除（設計書§17.5）
            let mut cache = state
                .preview_cache
                .lock()
                .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;
            cache.remove(&preview_token);
            Ok(result)
        }
        Err(e) => {
            // 失敗: キャッシュを保持（再試行可能）
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
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
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
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    csv_import_service::list_csv_imports(&conn, page, per_page).map_err(CmdError::from)
}
