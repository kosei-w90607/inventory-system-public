//! L1: レイヤー依存ルール
//!
//! ARCHITECTURE.md のレイヤー間呼び出し原則を自動検証する。
//! UI → CMD → BIZ → IO の一方向のみ。各層が禁止された層に依存していないことを保証する。
//!
//! rust_arkitect は target/ 内の自動生成ファイルで panic するため不採用。
//! 代わりに `use crate::` 文を直接パースして依存関係を検査する。

use std::fs;
use std::path::{Path, PathBuf};

/// レイヤーごとの依存ルール定義
struct LayerRule {
    /// 検査対象のディレクトリ名（例: "db"）
    layer: &'static str,
    /// 依存を禁止するモジュール名のリスト
    forbidden: &'static [&'static str],
}

/// レイヤー依存ルールの例外
///
/// CMD-11 設定・ログ・画像コマンド（settings_cmd.rs）は業務ロジックを持たない
/// インフラ操作のため、BIZ層を経由せず DB層（system_repo）/ IO層（image_manager）を
/// 直接呼ぶ。architecture/cmd-task-specs.md CMD-11 + FUNCTION_DESIGN.md §43 に基づく設計判断。
const LAYER_EXCEPTIONS: &[(&str, &str)] =
    &[("cmd/settings_cmd.rs", "db"), ("cmd/settings_cmd.rs", "io")];

/// ARCHITECTURE.md に基づくレイヤー依存ルール
///
/// IO層は db/ と io/ の2モジュールで構成:
///   db/ = IO-01（SQLiteデータアクセス層）
///   io/ = IO-02（Z004パーサー）, IO-04（PLUフォーマッター）等の純関数群
///
/// 許可方向: UI → CMD → BIZ → IO（db/ + io/）
///
/// db/  → biz, cmd, io への依存禁止
/// biz/ → cmd への依存禁止（db, io は IO層なので許可）
/// cmd/ → db, io への直接依存禁止（biz のみ許可）
/// io/  → biz, cmd, db への依存禁止（純関数層）
const LAYER_RULES: &[LayerRule] = &[
    LayerRule {
        layer: "db",
        forbidden: &["biz", "cmd", "io"],
    },
    LayerRule {
        layer: "biz",
        forbidden: &["cmd"],
    },
    LayerRule {
        layer: "cmd",
        forbidden: &["db", "io"],
    },
    LayerRule {
        layer: "io",
        forbidden: &["biz", "cmd", "db"],
    },
];

/// 指定ディレクトリ配下の .rs ファイルを再帰的に列挙
fn collect_rs_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if !dir.exists() {
        return files;
    }
    for entry in fs::read_dir(dir).expect("ディレクトリ読み込み失敗") {
        let entry = entry.expect("エントリ読み込み失敗");
        let path = entry.path();
        if path.is_dir() {
            files.extend(collect_rs_files(&path));
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            files.push(path);
        }
    }
    files
}

/// ソースファイル内の `use crate::{module}` パターンを検出
/// `#[cfg(test)]` ブロック内は除外（テスト専用の cross-layer import を許容）
fn find_forbidden_imports(
    file_path: &Path,
    forbidden_modules: &[&str],
) -> Vec<(usize, String, String)> {
    let content = fs::read_to_string(file_path).expect("ファイル読み込み失敗");
    let mut violations = Vec::new();
    let mut in_cfg_test = false;
    let mut brace_depth: i32 = 0;

    for (line_no, line) in content.lines().enumerate() {
        let trimmed = line.trim();

        // #[cfg(test)] ブロックの開始を検出
        if trimmed.contains("#[cfg(test)]") {
            in_cfg_test = true;
            brace_depth = 0;
            continue;
        }

        // #[cfg(test)] ブロック内のブレース追跡
        if in_cfg_test {
            for ch in trimmed.chars() {
                if ch == '{' {
                    brace_depth += 1;
                } else if ch == '}' {
                    brace_depth -= 1;
                    if brace_depth <= 0 {
                        in_cfg_test = false;
                        break;
                    }
                }
            }
            continue;
        }

        // コメント行はスキップ
        if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
            continue;
        }
        // インラインコメント部分を除去してからチェック
        let code_part = trimmed.split("//").next().unwrap_or(trimmed);
        for forbidden in forbidden_modules {
            // use crate::forbidden_module パターンを検出
            let patterns = [
                format!("use crate::{}", forbidden),
                format!("crate::{}::", forbidden),
                format!("crate::{} ", forbidden),
                format!("crate::{};", forbidden),
                format!("crate::{},", forbidden),
                format!("crate::{}}}", forbidden),
            ];
            if patterns.iter().any(|pat| code_part.contains(pat.as_str())) {
                violations.push((line_no + 1, forbidden.to_string(), trimmed.to_string()));
                break;
            }
        }
    }
    violations
}

#[test]
fn layer_dependency_rules() {
    let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut all_violations: Vec<String> = Vec::new();

    for rule in LAYER_RULES {
        let layer_dir = src_dir.join(rule.layer);
        let rs_files = collect_rs_files(&layer_dir);

        for file_path in &rs_files {
            let violations = find_forbidden_imports(file_path, rule.forbidden);
            for (line_no, forbidden_mod, line_content) in &violations {
                let relative = file_path.strip_prefix(&src_dir).unwrap_or(file_path);
                let relative_str = relative.display().to_string().replace('\\', "/");

                // 例外チェック
                let is_exception = LAYER_EXCEPTIONS
                    .iter()
                    .any(|(file, module)| relative_str == *file && forbidden_mod == module);
                if is_exception {
                    continue;
                }

                all_violations.push(format!(
                    "  {}:{} — {}/が{}に依存: {}",
                    relative_str, line_no, rule.layer, forbidden_mod, line_content
                ));
            }
        }
    }

    if !all_violations.is_empty() {
        panic!(
            "レイヤー依存ルール違反が {}件 見つかりました:\n{}",
            all_violations.len(),
            all_violations.join("\n")
        );
    }
}
