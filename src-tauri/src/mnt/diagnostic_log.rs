//! MNT-04: アプリケーション診断ログ
//!
//! docs/function-design/70-mnt-diagnostic-log.md に基づく実装。
//! tracing 基盤の初期化とログファイルのクリーンアップを提供する。

use std::path::PathBuf;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 診断ログの設定
///
/// §70.3 DiagnosticLogConfig
#[derive(Debug, Clone)]
pub struct DiagnosticLogConfig {
    /// ログファイルの保存ディレクトリ
    pub log_dir: PathBuf,
    /// 保持日数（デフォルト: 30）
    pub retention_days: u32,
    /// ファイル名プレフィックス（デフォルト: "app"）
    pub file_prefix: String,
}

/// 診断ログ初期化エラー
///
/// §70.3 DiagnosticLogError
/// BizError / DbError とは独立。ログ初期化は DB 接続より前に実行されるため。
#[derive(Debug)]
pub enum DiagnosticLogError {
    /// logs/ ディレクトリの作成失敗
    DirectoryCreationFailed(String),
    /// tracing-subscriber の初期化失敗
    SubscriberInitFailed(String),
}

impl std::fmt::Display for DiagnosticLogError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DiagnosticLogError::DirectoryCreationFailed(msg) => {
                write!(f, "ログディレクトリ作成失敗: {}", msg)
            }
            DiagnosticLogError::SubscriberInitFailed(msg) => {
                write!(f, "ログサブスクライバー初期化失敗: {}", msg)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 関数
// ---------------------------------------------------------------------------

/// tracing 基盤を初期化し、ファイルへのログ出力を開始する
///
/// §70.4 init_diagnostics
/// アプリ起動シーケンスの最初（setup hook 内）に呼ばれる。
pub fn init_diagnostics(config: &DiagnosticLogConfig) -> Result<(), DiagnosticLogError> {
    // 1. ディレクトリ作成
    std::fs::create_dir_all(&config.log_dir).map_err(|e| {
        DiagnosticLogError::DirectoryCreationFailed(format!("{}: {}", config.log_dir.display(), e))
    })?;

    // 2. 日次ローテーションのファイルアペンダー
    let file_appender = tracing_appender::rolling::daily(&config.log_dir, &config.file_prefix);

    // 3. サブスクライバー構築
    use tracing_subscriber::{fmt, EnvFilter};
    // RUST_LOG 環境変数が設定されていればそちらを優先。未設定時は INFO デフォルト。
    // トラブル調査時: RUST_LOG=inventory_system_tauri_scaffold_lib=debug で起動
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("inventory_system_tauri_scaffold_lib=info"));

    let subscriber = fmt()
        .with_writer(file_appender)
        .with_ansi(false)
        .with_target(true)
        .with_env_filter(filter)
        .finish();

    // 4. グローバルサブスクライバー登録
    tracing::subscriber::set_global_default(subscriber)
        .map_err(|e| DiagnosticLogError::SubscriberInitFailed(e.to_string()))?;

    // 5. 初期化完了ログ
    tracing::info!("診断ログ初期化完了");

    Ok(())
}

/// 指定日数を超過した古いログファイルを削除する
///
/// §70.5 cleanup_old_log_files
/// アプリ起動時に呼ばれる（ログ初期化の後）。
pub fn cleanup_old_log_files(config: &DiagnosticLogConfig) -> Result<u32, std::io::Error> {
    let today = chrono::Local::now().date_naive();
    let entries = match std::fs::read_dir(&config.log_dir) {
        Ok(entries) => entries
            .map(|entry| entry.map(|entry| entry.path()))
            .collect::<Vec<_>>(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(error) => return Err(error),
    };
    Ok(cleanup_log_entries(config, today, entries))
}

fn cleanup_log_entries<I>(config: &DiagnosticLogConfig, today: chrono::NaiveDate, entries: I) -> u32
where
    I: IntoIterator<Item = std::io::Result<PathBuf>>,
{
    let mut deleted_count = 0u32;
    for entry in entries {
        let path = match entry {
            Ok(path) => path,
            Err(error) => {
                tracing::warn!(error = %error, "診断ログエントリの走査に失敗（継続）");
                continue;
            }
        };
        let file_name = match path
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_owned)
        {
            Some(name) => name,
            None => {
                tracing::warn!(path = %path.display(), "診断ログファイル名のUTF-8変換に失敗（継続）");
                continue;
            }
        };

        // ファイル名パターン: {prefix}.YYYY-MM-DD
        let date_str = match extract_date_from_filename(&file_name, &config.file_prefix) {
            Some(d) => d,
            None => continue,
        };

        let file_date = match chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
            Ok(d) => d,
            Err(error) => {
                tracing::warn!(file = %file_name, error = %error, "診断ログ日付の解析に失敗（継続）");
                continue;
            }
        };

        let age_days = (today - file_date).num_days();
        if age_days > config.retention_days as i64 {
            if let Err(e) = std::fs::remove_file(&path) {
                tracing::warn!(
                    file = %file_name,
                    error = %e,
                    "古いログファイルの削除に失敗"
                );
            } else {
                deleted_count += 1;
            }
        }
    }

    deleted_count
}

/// ファイル名から日付部分を抽出する
///
/// `{prefix}.YYYY-MM-DD` パターンに一致する場合のみ Some を返す。
fn extract_date_from_filename(filename: &str, prefix: &str) -> Option<String> {
    // tracing-appender の命名: "{prefix}.YYYY-MM-DD"
    let expected_prefix = format!("{}.", prefix);
    let date_part = filename.strip_prefix(&expected_prefix)?;

    // YYYY-MM-DD 形式チェック（10文字）
    if date_part.len() != 10 {
        return None;
    }

    // 簡易フォーマットチェック: NNNN-NN-NN
    let bytes = date_part.as_bytes();
    if bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }
    for (i, &b) in bytes.iter().enumerate() {
        if i == 4 || i == 7 {
            continue;
        }
        if !b.is_ascii_digit() {
            return None;
        }
    }

    Some(date_part.to_string())
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_date_req700_valid() {
        // REQ-700: 診断ログ
        // §70.8: ファイル名から日付を正しく抽出
        assert_eq!(
            extract_date_from_filename("app.2026-04-13", "app"),
            Some("2026-04-13".to_string())
        );
    }

    #[test]
    fn test_extract_date_req700_wrong_prefix() {
        // REQ-700: 診断ログ
        // §70.8: プレフィックス不一致はNone
        assert_eq!(extract_date_from_filename("other.2026-04-13", "app"), None);
    }

    #[test]
    fn test_extract_date_req700_no_date() {
        // REQ-700: 診断ログ
        // §70.8: 日付部分がないファイル名はNone
        assert_eq!(extract_date_from_filename("app.log", "app"), None);
    }

    #[test]
    fn test_extract_date_req700_invalid_format() {
        // REQ-700: 診断ログ
        // §70.8: 不正な日付フォーマットはNone
        assert_eq!(extract_date_from_filename("app.2026-4-13", "app"), None);
        assert_eq!(extract_date_from_filename("app.20260413", "app"), None);
    }

    #[test]
    fn test_cleanup_req700_deletes_old_files() {
        // REQ-700: 診断ログ
        // §70.8: 31日前のファイルを作成し、cleanup後に削除されていること
        let dir = tempfile::tempdir().unwrap();
        let config = DiagnosticLogConfig {
            log_dir: dir.path().to_path_buf(),
            retention_days: 30,
            file_prefix: "app".to_string(),
        };

        // 31日前のファイル
        let old_date = chrono::Local::now().date_naive() - chrono::Duration::days(31);
        let old_name = format!("app.{}", old_date.format("%Y-%m-%d"));
        std::fs::write(dir.path().join(&old_name), "old log").unwrap();

        let deleted = cleanup_old_log_files(&config).unwrap();
        assert_eq!(deleted, 1);
        assert!(!dir.path().join(&old_name).exists());
    }

    #[test]
    fn test_cleanup_req700_keeps_recent_files() {
        // REQ-700: 診断ログ
        // §70.8: 29日前のファイルが削除されないこと
        let dir = tempfile::tempdir().unwrap();
        let config = DiagnosticLogConfig {
            log_dir: dir.path().to_path_buf(),
            retention_days: 30,
            file_prefix: "app".to_string(),
        };

        let recent_date = chrono::Local::now().date_naive() - chrono::Duration::days(29);
        let recent_name = format!("app.{}", recent_date.format("%Y-%m-%d"));
        std::fs::write(dir.path().join(&recent_name), "recent log").unwrap();

        let deleted = cleanup_old_log_files(&config).unwrap();
        assert_eq!(deleted, 0);
        assert!(dir.path().join(&recent_name).exists());
    }

    #[test]
    fn test_cleanup_req700_ignores_non_matching_files() {
        // REQ-700: 診断ログ
        // §70.8: プレフィックス不一致のファイルがスキップされること
        let dir = tempfile::tempdir().unwrap();
        let config = DiagnosticLogConfig {
            log_dir: dir.path().to_path_buf(),
            retention_days: 30,
            file_prefix: "app".to_string(),
        };

        let old_date = chrono::Local::now().date_naive() - chrono::Duration::days(31);
        let unrelated = format!("other.{}", old_date.format("%Y-%m-%d"));
        std::fs::write(dir.path().join(&unrelated), "not mine").unwrap();

        let deleted = cleanup_old_log_files(&config).unwrap();
        assert_eq!(deleted, 0);
        assert!(dir.path().join(&unrelated).exists());
    }

    #[test]
    fn test_cleanup_req700_empty_directory() {
        // REQ-700: 診断ログ
        // §70.8: 空ディレクトリでOk(0)が返ること
        let dir = tempfile::tempdir().unwrap();
        let config = DiagnosticLogConfig {
            log_dir: dir.path().to_path_buf(),
            retention_days: 30,
            file_prefix: "app".to_string(),
        };

        let deleted = cleanup_old_log_files(&config).unwrap();
        assert_eq!(deleted, 0);
    }

    #[test]
    fn test_cleanup_req700_nonexistent_directory() {
        // REQ-700: 診断ログ
        // §70.8: 存在しないディレクトリでOk(0)が返ること
        let config = DiagnosticLogConfig {
            log_dir: PathBuf::from("/tmp/nonexistent_diagnostic_log_test_dir"),
            retention_days: 30,
            file_prefix: "app".to_string(),
        };

        let deleted = cleanup_old_log_files(&config).unwrap();
        assert_eq!(deleted, 0);
    }

    #[test]
    fn test_cleanup_req700_entry_error_warns_and_continues() {
        // REQ-700 / MNT-04-D1: entry単位の走査失敗は記録して継続
        let dir = tempfile::tempdir().unwrap();
        let config = DiagnosticLogConfig {
            log_dir: dir.path().to_path_buf(),
            retention_days: 30,
            file_prefix: "app".into(),
        };
        let old = dir.path().join("app.2020-01-01");
        let entries = vec![
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "injected",
            )),
            Ok(old),
        ];
        let today = chrono::Local::now().date_naive();
        let (deleted, logs) =
            crate::test_tracing::capture(|| cleanup_log_entries(&config, today, entries));
        assert_eq!(deleted, 0);
        assert!(logs.contains("診断ログエントリ") || logs.contains("entry"));
    }
}
