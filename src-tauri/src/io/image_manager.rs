//! IO-06: 画像ファイル管理
//!
//! レシート画像のバイト列を受け取り、アプリデータフォルダ配下に保存して相対パスを返す。
//! DB非依存。
//!
//! docs/function-design/28-io-image-manager.md に基づく実装。

use std::io;
use std::path::Path;

/// 許可する画像拡張子
const ALLOWED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp"];

/// 画像保存先の相対ディレクトリ
const RECEIPTS_DIR: &str = "images/receipts";

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// レシート画像を保存して相対パスを返す
///
/// 28-io-image-manager.md §28.4
///
/// 戻り値: 相対パス（例: `images/receipts/2026-04-13_001.jpg`）
pub fn save_receipt_image(
    app_data_dir: &Path,
    image_bytes: &[u8],
    extension: &str,
) -> Result<String, io::Error> {
    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    save_receipt_image_with_date(app_data_dir, image_bytes, extension, &date_str)
}

/// 日付を外部から注入可能なバージョン（テスト用内部関数）
///
/// 28-io-image-manager.md §28.4
pub(crate) fn save_receipt_image_with_date(
    app_data_dir: &Path,
    image_bytes: &[u8],
    extension: &str,
    date_str: &str,
) -> Result<String, io::Error> {
    // 1. 拡張子バリデーション
    let ext_lower = extension.to_lowercase();
    if !ALLOWED_EXTENSIONS.contains(&ext_lower.as_str()) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!(
                "不正な画像拡張子: {}（許可: {}）",
                extension,
                ALLOWED_EXTENSIONS.join(", ")
            ),
        ));
    }

    // 2. 保存ディレクトリ作成
    let save_dir = app_data_dir.join(RECEIPTS_DIR);
    std::fs::create_dir_all(&save_dir)?;

    // 3. 連番決定: 同ディレクトリ内の {date}_ プレフィックスを持つファイルから最大連番+1
    let prefix = format!("{}_", date_str);
    let mut max_seq: u32 = 0;

    if let Ok(entries) = std::fs::read_dir(&save_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if let Some(rest) = name_str.strip_prefix(&prefix) {
                // rest = "001.jpg" → split('.') → "001" → parse
                if let Some(seq_str) = rest.split('.').next() {
                    if let Ok(seq) = seq_str.parse::<u32>() {
                        max_seq = max_seq.max(seq);
                    }
                }
            }
        }
    }

    let next_seq = max_seq + 1;

    // 4. ファイル名生成
    let filename = format!("{}_{:03}.{}", date_str, next_seq, ext_lower);

    // 5. ファイル書き込み
    let full_path = save_dir.join(&filename);
    std::fs::write(&full_path, image_bytes)?;

    // 6. 相対パスを返す
    Ok(format!("{}/{}", RECEIPTS_DIR, filename))
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_image_req906_creates_file() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: バイト列がファイルとして保存される
        let dir = tempfile::tempdir().unwrap();
        let image_data = b"fake-image-data";

        let result = save_receipt_image_with_date(dir.path(), image_data, "jpg", "2026-04-13");
        assert!(result.is_ok());

        let rel_path = result.unwrap();
        let full_path = dir.path().join(&rel_path);
        assert!(full_path.exists(), "ファイルが作成されているべき");

        let content = std::fs::read(&full_path).unwrap();
        assert_eq!(content, image_data, "書き込まれた内容が一致するべき");
    }

    #[test]
    fn test_save_image_req906_relative_path() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: 戻り値が images/receipts/ から始まる相対パス
        let dir = tempfile::tempdir().unwrap();

        let rel_path =
            save_receipt_image_with_date(dir.path(), b"data", "png", "2026-04-13").unwrap();

        assert!(
            rel_path.starts_with("images/receipts/"),
            "相対パスは images/receipts/ で始まるべき: {}",
            rel_path
        );
    }

    #[test]
    fn test_save_image_req906_sequential_numbering() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: 同日2回保存で _001, _002 の連番
        let dir = tempfile::tempdir().unwrap();

        let path1 = save_receipt_image_with_date(dir.path(), b"img1", "jpg", "2026-04-13").unwrap();
        let path2 = save_receipt_image_with_date(dir.path(), b"img2", "jpg", "2026-04-13").unwrap();

        assert!(path1.contains("_001."), "1枚目は _001: {}", path1);
        assert!(path2.contains("_002."), "2枚目は _002: {}", path2);
    }

    #[test]
    fn test_save_image_req906_directory_creation() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: 存在しないディレクトリが自動作成される
        let dir = tempfile::tempdir().unwrap();
        let receipts_dir = dir.path().join("images").join("receipts");
        assert!(!receipts_dir.exists(), "ディレクトリはまだ存在しない");

        let result = save_receipt_image_with_date(dir.path(), b"data", "jpg", "2026-04-13");
        assert!(result.is_ok());
        assert!(receipts_dir.exists(), "ディレクトリが自動作成されるべき");
    }

    #[test]
    fn test_save_image_req906_date_prefix() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: ファイル名に日付が含まれる
        let dir = tempfile::tempdir().unwrap();

        let rel_path =
            save_receipt_image_with_date(dir.path(), b"data", "jpg", "2026-04-13").unwrap();
        let filename = rel_path.rsplit('/').next().unwrap();

        assert!(
            filename.starts_with("2026-04-13_"),
            "ファイル名は日付プレフィックスで始まるべき: {}",
            filename
        );
    }

    #[test]
    fn test_save_image_req906_extension_preserved() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: .jpg, .png が正しく付与される
        let dir = tempfile::tempdir().unwrap();

        let path_jpg =
            save_receipt_image_with_date(dir.path(), b"jpg-data", "jpg", "2026-04-13").unwrap();
        let path_png =
            save_receipt_image_with_date(dir.path(), b"png-data", "png", "2026-04-13").unwrap();

        assert!(path_jpg.ends_with(".jpg"), "jpg拡張子: {}", path_jpg);
        assert!(path_png.ends_with(".png"), "png拡張子: {}", path_png);
    }

    #[test]
    fn test_save_image_req906_invalid_extension() {
        // REQ-906: 画像管理（レシート画像保存）
        // Task: IO-06
        // IO-06: 不正な拡張子でエラー
        let dir = tempfile::tempdir().unwrap();

        let result = save_receipt_image_with_date(dir.path(), b"data", "bmp", "2026-04-13");
        assert!(result.is_err());

        let err = result.unwrap_err();
        assert_eq!(
            err.kind(),
            io::ErrorKind::InvalidInput,
            "InvalidInput エラーであるべき"
        );
    }
}
