# Test Design Matrix: SALES Daily Report Design

Risk: R3

Contract ID: SPEC-SALES-DAILY-REPORT-2026-06-30

This matrix is for the later implementation PR(s). This design PR does not add executable tests.

| ID | Contract / failure mode | Test type | Proposed test target | Expected failure caught |
|---|---|---|---|---|
| T1 | IO-07 parses a valid Z001/Z002/Z005 bundle with CP932 and NEL normalization | Rust unit | `io::daily_report_parser::tests::parse_valid_bundle_req401` | Parser rejects or misreads real-shaped daily report files |
| T2 | Missing Z001/Z002/Z005 blocks preview | Rust unit | `parse_missing_source_req401` | Partial daily report accidentally committed |
| T3 | Duplicate or unknown source blocks preview | Rust unit | `parse_duplicate_unknown_source_req401` | Wrong files bundled into one business date |
| T4 | Date mismatch across sources blocks preview | Rust unit/BIZ | `parse_date_mismatch_req401` / `parse_and_validate_date_mismatch_req401` | Different business dates mixed into one report |
| T5 | Invalid numeric field blocks preview with import_error | Rust unit | `parse_invalid_number_req401` | Incorrect totals silently become zero or wrong values |
| T6 | Department mismatch is warning, not hard failure | Rust BIZ test | `daily_report_department_warning_req401` | Store can no longer import official daily report because app master naming differs |
| T7 | Duplicate bundle hash blocks re-import | Rust BIZ test | `daily_report_duplicate_bundle_req401` | Daily report double-counted |
| T8 | Same report_date different bundle requires overwrite confirmation and rolls old import back | Rust BIZ integration | `daily_report_overwrite_rolls_back_previous_req401` | Multiple completed daily reports for same day without operator confirmation |
| T9 | Daily report commit writes only daily_report tables | Rust DB/BIZ integration | `daily_report_commit_does_not_write_sale_records_req401` | Aggregate report rows pollute item-level sales |
| T10 | Daily report rollback does not change stock or movements | Rust DB/BIZ integration | `daily_report_rollback_no_inventory_effect_req401` | Rollback corrupts inventory |
| T11 | CMD-12 cache expiry and token validation return import_error/validation | Rust command test | `daily_report_cmd_cache_expiry_req401` | UI retry path cannot recover cleanly |
| T12 | Existing Z004 import behavior remains unchanged | Existing Rust tests + targeted regression | `csv_import_service` existing test suite | SALES redesign breaks product-sales track |
| T13 | Daily sales DTO includes official_daily_report when daily report exists | Rust BIZ test | `get_daily_sales_includes_official_report_req501` | UI cannot show official daily report |
| T14 | Daily sales item list stays empty when only daily report exists | Rust BIZ test | `get_daily_sales_no_fake_items_req501` | UI shows fake product rows |
| T15 | Daily sales UI shows "商品別明細は未取込み" when official report exists but items empty | Vitest/RTL | `DailySalesPage.daily-report-without-items.test.tsx` | Operator reads empty item table as no sales |
| T16 | Monthly sales aggregates Z005 department lines separately | Rust BIZ test | `get_monthly_sales_official_department_totals_req502` | Monthly official totals missing |
| T17 | Monthly product ranking stays empty when only daily reports exist | Rust BIZ test | `get_monthly_sales_no_fake_ranking_req502` | Fake product ranking created from department totals |
| T18 | Monthly UI labels official department totals vs product ranking separately | Vitest/RTL | `MonthlySalesPage.official-totals.test.tsx` | Operator confuses totals with product ranking |
| T19 | Generated bindings include CMD-12 and new report DTOs | Rust/frontend generated check | `cargo run --bin generate_bindings` + clean expected diff | Frontend command contract drift |
| T20 | Query invalidation refreshes daily/monthly/home after daily report commit/rollback | Vitest/RTL hook test | `useDailyReportImportFlow.invalidates.test.tsx` | Reports show stale values after import |
| T21 | Data safety: fixtures contain no real JAN/product/store values | script/review check | `rg` over fixtures + review evidence | Store data committed |
| T22 | Windows native L3: file selection, warning readability, no-inventory-change wording | Manual | PR body checklist | File input or Japanese wording fails native operator workflow |

## Required Gates In Implementation PR

- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo run --bin generate_bindings`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `bash scripts/doc-consistency-check.sh`
- `bash scripts/doc-consistency-check.sh --target plan` while active plans exist

## Manual / External Verification

- Sanitized or shape-only Z001/Z002/Z005 examples are needed before parser implementation can be considered complete.
- Windows native L3 is required for UI-07 daily report flow because file input, drag/drop, Japanese wording, and operator comprehension are in scope.
- Real PC-tool/SD-card confirmation remains external evidence; real files must stay outside git.

