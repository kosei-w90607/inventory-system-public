use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};

fn rust_files_under(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for entry in fs::read_dir(root).expect("read cmd directory") {
        let entry = entry.expect("read cmd entry");
        let path = entry.path();
        if path.is_dir() {
            files.extend(rust_files_under(&path));
        } else if path.extension().and_then(|value| value.to_str()) == Some("rs") {
            files.push(path);
        }
    }
    files
}

#[test]
fn test_internal_calls_req700_do_not_format_raw_detail_into_user_message() {
    // REQ-700 / CMD-ERR-D2: internal の第1引数へ format! を渡す旧契約を再導入しない。
    let cmd_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/cmd");
    let forbidden = Regex::new(r"CmdError::internal\s*\(\s*&?\s*format!").unwrap();
    let offenders: Vec<String> = rust_files_under(&cmd_dir)
        .into_iter()
        .filter_map(|path| {
            let source = fs::read_to_string(&path).expect("read cmd source");
            forbidden
                .is_match(&source)
                .then(|| path.strip_prefix(&cmd_dir).unwrap().display().to_string())
        })
        .collect();

    assert!(
        offenders.is_empty(),
        "raw detail is formatted into internal user_message in: {offenders:?}"
    );
}
