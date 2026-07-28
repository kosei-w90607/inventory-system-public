use std::fs;
use std::path::Path;

fn read_repo_file(relative_path: &str) -> String {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    fs::read_to_string(repo_root.join(relative_path))
        .unwrap_or_else(|error| panic!("failed to read {relative_path}: {error}"))
}

fn struct_block<'a>(source: &'a str, struct_name: &str) -> &'a str {
    let anchors = [
        format!("pub struct {struct_name} {{"),
        format!("struct {struct_name} {{"),
    ];
    let (start, anchor) = anchors
        .iter()
        .find_map(|anchor| source.find(anchor).map(|start| (start, anchor)))
        .unwrap_or_else(|| panic!("struct {struct_name} not found"));
    let body_start = start + anchor.len();
    let mut depth = 1_i32;

    for (offset, ch) in source[body_start..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return &source[body_start..body_start + offset];
                }
            }
            _ => {}
        }
    }

    panic!("struct {struct_name} is not closed");
}

fn field_names(block: &str) -> Vec<String> {
    block
        .lines()
        .filter_map(|line| {
            let field = line.trim().strip_prefix("pub ").unwrap_or(line.trim());
            if field.is_empty()
                || field.starts_with("//")
                || field.starts_with('#')
                || !field.contains(':')
            {
                return None;
            }
            Some(
                field
                    .split_once(':')
                    .expect("field must contain colon")
                    .0
                    .trim()
                    .to_string(),
            )
        })
        .collect()
}

fn assert_struct_fields(source: &str, struct_name: &str, expected: &[&str]) {
    assert_eq!(
        field_names(struct_block(source, struct_name)),
        expected,
        "{struct_name} must keep its minimal internal field contract"
    );
}

fn markdown_section<'a>(source: &'a str, heading: &str, next_heading: &str) -> &'a str {
    let start = source
        .find(heading)
        .unwrap_or_else(|| panic!("heading {heading} not found"));
    let body_start = start + heading.len();
    let end = source[body_start..]
        .find(next_heading)
        .map_or(source.len(), |offset| body_start + offset);
    &source[body_start..end]
}

fn markdown_field_names(section: &str) -> Vec<String> {
    section
        .lines()
        .filter_map(|line| {
            let field = line.trim().strip_prefix("- ")?;
            let (name, _) = field.split_once(':')?;
            Some(name.trim().to_string())
        })
        .collect()
}

#[test]
fn test_import_internal_contract_req401_is_minimal() {
    // REQ-401 / BIZ-03-D1 / IO-07-D1: internal cache/parser types do not
    // reintroduce consumer-free metadata while diagnostic fields stay intact.
    let csv_source = read_repo_file("src-tauri/src/biz/csv_import_service/mod.rs");
    let daily_source = read_repo_file("src-tauri/src/io/daily_report_parser.rs");
    let csv_design = read_repo_file("docs/function-design/32-biz-csv-import-service.md");
    let daily_design = read_repo_file("docs/function-design/29-io-daily-report-parser.md");

    let matched_fields = [
        "line_no",
        "product_code",
        "quantity",
        "amount",
        "pos_stock_sync",
    ];
    let commit_fields = ["overwrite_confirmed", "cached_data"];
    assert_struct_fields(&csv_source, "MatchedRow", &matched_fields);
    assert_struct_fields(&csv_source, "CommitRequest", &commit_fields);
    assert_eq!(
        markdown_field_names(markdown_section(
            &csv_design,
            "#### MatchedRow構造体",
            "#### ErrorRow構造体",
        )),
        matched_fields,
        "MatchedRow design section must keep the minimal field contract"
    );
    assert_eq!(
        markdown_field_names(markdown_section(
            &csv_design,
            "#### CommitRequest構造体",
            "#### ImportResult構造体",
        )),
        commit_fields,
        "CommitRequest design section must keep the minimal field contract"
    );

    for source in [&daily_source, &daily_design] {
        assert_struct_fields(
            source,
            "DailyReportSummaryLine",
            &[
                "line_key",
                "label",
                "amount",
                "quantity",
                "count",
                "sort_order",
            ],
        );
        assert_struct_fields(
            source,
            "DailyReportPaymentLine",
            &["payment_key", "label", "amount", "count", "sort_order"],
        );
        assert_struct_fields(
            source,
            "DailyReportDepartmentLine",
            &[
                "raw_department_name",
                "normalized_department_name",
                "amount",
                "quantity",
                "count",
                "sort_order",
            ],
        );
        assert_struct_fields(
            source,
            "DailyReportParseError",
            &[
                "source_file",
                "filename",
                "line_no",
                "error_type",
                "error_message",
            ],
        );
    }
}
