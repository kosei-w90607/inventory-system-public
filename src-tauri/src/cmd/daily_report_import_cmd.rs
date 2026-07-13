//! CMD-12: 日報取込みコマンド群
//!
//! CMD層は薄いラッパー。token/cache管理とBizError→CmdError変換のみを持つ。

use crate::biz::daily_report_import_service::{
    self, CachedDailyReportPreview, DailyReportImportResult, DailyReportImportRow,
    DailyReportInputFile, DailyReportPreviewData, DailyReportRollbackResult,
    ListDailyReportImportsQuery,
};
use crate::biz::PaginatedResult;
use crate::cmd::{AppState, CmdError};
use crate::constants;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct DailyReportSourceFileRequest {
    pub filename: String,
    pub file_bytes: Vec<u8>,
}

#[derive(Debug, serde::Serialize, specta::Type)]
pub struct DailyReportPreviewResponse {
    pub preview_data: DailyReportPreviewData,
    pub preview_token: String,
}

#[tauri::command]
#[specta::specta]
pub fn parse_and_validate_daily_report(
    state: State<AppState>,
    files: Vec<DailyReportSourceFileRequest>,
) -> Result<DailyReportPreviewResponse, CmdError> {
    validate_daily_report_files(&files)?;

    let result = {
        let conn = state
            .db
            .lock()
            .map_err(|_| CmdError::internal("DB接続エラー"))?;
        let source_files = files
            .into_iter()
            .map(|file| DailyReportInputFile {
                filename: file.filename,
                bytes: file.file_bytes,
            })
            .collect();
        daily_report_import_service::parse_and_validate_daily_report(&conn, source_files)
            .map_err(CmdError::from)?
    };

    let preview_token = uuid::Uuid::new_v4().to_string();
    let response = DailyReportPreviewResponse {
        preview_data: result.preview_data,
        preview_token: preview_token.clone(),
    };

    let mut cache = state
        .daily_report_preview_cache
        .lock()
        .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;
    evict_oldest_daily_report_preview(&mut cache);
    cache.insert(preview_token, result.cached_preview);

    Ok(response)
}

#[tauri::command]
#[specta::specta]
pub fn commit_daily_report_import(
    state: State<AppState>,
    preview_token: String,
    overwrite_confirmed: bool,
) -> Result<DailyReportImportResult, CmdError> {
    commit_daily_report_import_with_state(&state, preview_token, overwrite_confirmed)
}

fn commit_daily_report_import_with_state(
    state: &AppState,
    preview_token: String,
    overwrite_confirmed: bool,
) -> Result<DailyReportImportResult, CmdError> {
    validate_preview_token(&preview_token)?;
    let cached_preview = {
        let mut cache = state
            .daily_report_preview_cache
            .lock()
            .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;
        let Some(cached) = cache.get(&preview_token) else {
            return Err(CmdError {
                kind: "import_error".to_string(),
                message: "プレビューが見つかりません。再度ファイルを選択してください".to_string(),
                field: None,
            });
        };
        if cached.created_at.elapsed().as_secs() > constants::PREVIEW_CACHE_TTL_SECS {
            cache.remove(&preview_token);
            return Err(CmdError {
                kind: "import_error".to_string(),
                message: "プレビューの有効期限が切れました（30分）。再度ファイルを選択してください"
                    .to_string(),
                field: None,
            });
        }
        cached.clone()
    };

    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    match daily_report_import_service::commit_daily_report_import(
        &mut conn,
        cached_preview,
        overwrite_confirmed,
    ) {
        Ok(result) => {
            drop(conn);
            let mut cache = state
                .daily_report_preview_cache
                .lock()
                .map_err(|_| CmdError::internal("キャッシュ取得エラー"))?;
            cache.remove(&preview_token);
            Ok(result)
        }
        Err(err) => Err(CmdError::from(err)),
    }
}

#[tauri::command]
#[specta::specta]
pub fn rollback_daily_report_import(
    state: State<AppState>,
    daily_report_import_id: i64,
) -> Result<DailyReportRollbackResult, CmdError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    daily_report_import_service::rollback_daily_report_import(&mut conn, daily_report_import_id)
        .map_err(CmdError::from)
}

#[tauri::command]
#[specta::specta]
pub fn list_daily_report_imports(
    state: State<AppState>,
    page: i64,
    per_page: i64,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedResult<DailyReportImportRow>, CmdError> {
    let conn = state
        .db
        .lock()
        .map_err(|_| CmdError::internal("DB接続エラー"))?;
    daily_report_import_service::list_daily_report_imports(
        &conn,
        ListDailyReportImportsQuery {
            page,
            per_page,
            date_from,
            date_to,
            status: None,
        },
    )
    .map_err(CmdError::from)
}

fn validate_daily_report_files(files: &[DailyReportSourceFileRequest]) -> Result<(), CmdError> {
    if files.len() != 3 {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "Z001/Z002/Z005の3ファイルを選択してください".to_string(),
            field: None,
        });
    }
    if files
        .iter()
        .any(|file| file.file_bytes.len() > constants::CSV_IMPORT_FILE_SIZE_LIMIT)
    {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "ファイルサイズが上限(20MB)を超えています".to_string(),
            field: None,
        });
    }
    Ok(())
}

fn validate_preview_token(preview_token: &str) -> Result<(), CmdError> {
    if uuid::Uuid::parse_str(preview_token).is_err() {
        return Err(CmdError {
            kind: "validation".to_string(),
            message: "不正なプレビュートークンです".to_string(),
            field: None,
        });
    }
    Ok(())
}

fn evict_oldest_daily_report_preview(cache: &mut HashMap<String, CachedDailyReportPreview>) {
    if cache.len() >= constants::PREVIEW_CACHE_LIMIT {
        if let Some(oldest_key) = cache
            .iter()
            .min_by_key(|(_, cached)| cached.created_at)
            .map(|(key, _)| key.clone())
        {
            cache.remove(&oldest_key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::biz::daily_report_import_service::{
        DailyReportDuplicateCheck, DailyReportDuplicateStatus, DailyReportFileInfo,
        DailyReportTotals,
    };
    use crate::db::test_support::setup_test_db;
    use std::time::{Duration, Instant};

    fn request(filename: &str, size: usize) -> DailyReportSourceFileRequest {
        DailyReportSourceFileRequest {
            filename: filename.to_string(),
            file_bytes: vec![0; size],
        }
    }

    fn cached(created_at: Instant) -> CachedDailyReportPreview {
        CachedDailyReportPreview {
            created_at,
            preview_data: DailyReportPreviewData {
                file_info: DailyReportFileInfo {
                    report_date: "2026-03-21".to_string(),
                    bundle_hash: "hash".to_string(),
                    source_files: Vec::new(),
                },
                totals: DailyReportTotals {
                    gross_amount: Some(1),
                    net_amount: Some(1),
                },
                payment_summary: Vec::new(),
                department_summary: Vec::new(),
                warnings: Vec::new(),
                duplicate_check: DailyReportDuplicateCheck {
                    status: DailyReportDuplicateStatus::NoDuplicate,
                    existing_import_id: None,
                },
                preview_created_at: "2026-03-21T10:00:00".to_string(),
            },
            summary_lines: Vec::new(),
            payment_lines: Vec::new(),
            department_lines: Vec::new(),
        }
    }

    fn cached_with_status(
        created_at: Instant,
        status: DailyReportDuplicateStatus,
    ) -> CachedDailyReportPreview {
        let mut cached = cached(created_at);
        cached.preview_data.duplicate_check.status = status;
        cached
    }

    fn app_state() -> (tempfile::TempDir, AppState) {
        let (dir, conn) = setup_test_db();
        (
            dir,
            AppState {
                db: std::sync::Mutex::new(conn),
                preview_cache: std::sync::Mutex::new(HashMap::new()),
                daily_report_preview_cache: std::sync::Mutex::new(HashMap::new()),
            },
        )
    }

    #[test]
    fn test_daily_report_cmd_req401_validates_three_files() {
        let err = validate_daily_report_files(&[request("Z001.csv", 1)]).unwrap_err();
        assert_eq!(err.kind, "validation");

        let ok = validate_daily_report_files(&[
            request("Z001.csv", 1),
            request("Z002.csv", 1),
            request("Z005.csv", 1),
        ]);
        assert!(ok.is_ok());
    }

    #[test]
    fn test_daily_report_cmd_req401_validates_size_limit() {
        let err = validate_daily_report_files(&[
            request("Z001.csv", 1),
            request("Z002.csv", constants::CSV_IMPORT_FILE_SIZE_LIMIT + 1),
            request("Z005.csv", 1),
        ])
        .unwrap_err();

        assert_eq!(err.kind, "validation");
    }

    #[test]
    fn test_daily_report_cmd_req401_validates_uuid_token() {
        assert!(validate_preview_token("not-a-uuid").is_err());
        assert!(validate_preview_token(&uuid::Uuid::new_v4().to_string()).is_ok());
    }

    #[test]
    fn test_daily_report_cmd_req401_cache_miss_and_expiry_return_import_error() {
        // REQ-401 / CMD-12: cache miss / 期限切れ token は import_error
        let (_dir, state) = app_state();
        let missing_token = uuid::Uuid::new_v4().to_string();
        let missing = commit_daily_report_import_with_state(&state, missing_token, false)
            .expect_err("cache miss should fail");
        assert_eq!(missing.kind, "import_error");

        let expired_token = uuid::Uuid::new_v4().to_string();
        state.daily_report_preview_cache.lock().unwrap().insert(
            expired_token.clone(),
            cached(Instant::now() - Duration::from_secs(constants::PREVIEW_CACHE_TTL_SECS + 1)),
        );
        let expired = commit_daily_report_import_with_state(&state, expired_token.clone(), false)
            .expect_err("expired cache should fail");
        assert_eq!(expired.kind, "import_error");
        assert!(!state
            .daily_report_preview_cache
            .lock()
            .unwrap()
            .contains_key(&expired_token));
    }

    #[test]
    fn test_daily_report_cmd_req401_cache_lifecycle_success_removes_failure_keeps() {
        // REQ-401 / CMD-12: commit成功でtoken削除、BIZ失敗では再試行用にcacheを残す
        let (_dir, state) = app_state();
        let success_token = uuid::Uuid::new_v4().to_string();
        state
            .daily_report_preview_cache
            .lock()
            .unwrap()
            .insert(success_token.clone(), cached(Instant::now()));

        commit_daily_report_import_with_state(&state, success_token.clone(), false).unwrap();
        assert!(!state
            .daily_report_preview_cache
            .lock()
            .unwrap()
            .contains_key(&success_token));

        let failure_token = uuid::Uuid::new_v4().to_string();
        state.daily_report_preview_cache.lock().unwrap().insert(
            failure_token.clone(),
            cached_with_status(Instant::now(), DailyReportDuplicateStatus::AlreadyImported),
        );

        let failed = commit_daily_report_import_with_state(&state, failure_token.clone(), false)
            .expect_err("BIZ failure should keep cache");
        assert_eq!(failed.kind, "idempotency_conflict");
        assert!(state
            .daily_report_preview_cache
            .lock()
            .unwrap()
            .contains_key(&failure_token));
    }

    #[test]
    fn test_daily_report_cmd_req401_fifo_eviction_removes_oldest() {
        let mut cache = HashMap::new();
        for index in 0..constants::PREVIEW_CACHE_LIMIT {
            cache.insert(
                format!("token-{}", index),
                cached(Instant::now() - Duration::from_secs((index + 1) as u64)),
            );
        }

        evict_oldest_daily_report_preview(&mut cache);

        assert_eq!(cache.len(), constants::PREVIEW_CACHE_LIMIT - 1);
        assert!(!cache.contains_key(&format!("token-{}", constants::PREVIEW_CACHE_LIMIT - 1)));
    }
}
