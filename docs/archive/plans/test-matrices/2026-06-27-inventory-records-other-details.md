# Test Design Matrix: 入庫 / 返品・交換 / 手動販売の業務記録詳細横展開

## Risk

Risk: R3

## Contracts Under Test

- `listInventoryRecords(query)` returns receiving / return / manual sale / disposal header rows without duplicate headers.
- `getReceivingRecord(id)` returns header, supplier, items, cost total, and movements.
- `getReturnRecord(id)` returns header, return/exchange semantics, receipt image path, items, and movements only when stock moved.
- `getManualSaleRecord(id)` returns header, reason, items, amount total, and movements.
- Detail route `returnTo` preserves `/inventory/records` search state and UI-06c movement list search state.

## Failure Modes

- Header rows duplicate when product keyword or department filters match multiple items.
- `all` listing pages each record type separately and returns globally wrong order.
- Missing record is surfaced as internal error instead of not_found.
- `register_processed=true` return detail incorrectly displays fake movements.
- Manual sale detail uses `sale_records.id` as the business record ID.
- Detail route drops `returnTo` or accepts external URLs.
- Generated bindings omit a new command or type.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| listInventoryRecords 4種 union | Duplicate headers / wrong order | Rust unit | `test_list_inventory_records_req206_returns_four_types_in_business_date_order` | union query pages per type or item JOIN duplicates headers |
| listInventoryRecords filters | product / department / record_id not applied per type | Rust unit | `test_list_inventory_records_req206_filters_supported_record_types` | a filter is only applied to disposal records |
| listInventoryRecords validation | unsupported record type/status accepted silently | Rust unit | `test_list_inventory_records_req206_rejects_unknown_record_type_or_status` | BIZ no longer rejects unknown values |
| receiving detail | header/items/total/movements missing | Rust unit | `test_get_receiving_record_req201_includes_items_total_and_movements` | detail omits supplier, cost total, or movements |
| return detail | register_processed semantics wrong | Rust unit | `test_get_return_record_req202_register_processed_true_has_no_movements` | true records imply this screen changed stock |
| return detail | exchange directions lost | Rust unit | `test_get_return_record_req202_includes_item_directions` | direction labels cannot be rendered |
| manual sale detail | manual sale vs sale_records identity mixed | Rust unit | `test_get_manual_sale_record_req203_uses_manual_sale_id_and_amount_total` | detail ID comes from sale_records or amount total is wrong |
| not_found mapping | missing record internalized | Rust unit | `test_get_other_record_details_req206_map_missing_to_not_found` | BIZ/CMD maps missing detail to internal |
| detail routes | commands called and return path works | RTL | `OtherRecordDetailPages.test.tsx` | route calls wrong command or back href is dropped |
| records page | filter select and detail links cover 4 types | RTL | `InventoryRecordsPage.test.tsx` | UI only exposes disposal or detail href misses returnTo |
| movement links | 3 source route links stay live | RTL | `MovementTable.test.tsx` | source route for receiving/return/manual sale is wrong |
| recent/result links | UI-02/03 recent list and UI-04 result panel reach detail | RTL | `ReceivingPage.test.tsx` / `ReturnExchangePage.test.tsx` / `ManualSalePage.test.tsx` | recent list or result panel remains a dead-end |

## Negative Paths

- missing input: detail route with missing/non-numeric ID falls back to not_found UI or route validation.
- invalid input: page < 1, per_page > 100, unsupported `record_type`, unsupported `status`.
- duplicate/ambiguous input: multiple items in one record match a keyword; list still returns one header.
- unknown reference: movement source resolver returns `source=null` for unknown reference types and keeps the row.
- dependency missing: department list failure disables department filter but list can still render.
- permission/write failure: not applicable; read-only.
- dry-run side effect: not applicable.

## Boundary Checks

- threshold: `per_page=100` accepted, `per_page=101` rejected.
- null/default: `record_type=null` and `"all"` both return all supported types.
- empty/non-empty: detail movements may be empty; item rows should still render.
- min/max: record ID exact match handles minimum positive ID.
- status/policy enum: current schema supports `active` only; `canceled`/`corrected` rejected until schema slice.
- wire type: Rust i64 IDs/money become TS number; generated binding checked.
- internal type: IO detail structs do not expose BizError/CmdError.
- producer/consumer: CMD names in Rust match `commands.*` names in TS.
- round-trip token: `returnTo` is URL-encoded, app-local, and preserves search params.
- precision/range: tests use small synthetic IDs/money within JS safe integer range.
- cross-language parse: route params are parsed to number and invalid params do not call commands with NaN.

## Compatibility Checks

- old schema/input: existing receiving / return / manual_sale tables require no migration.
- new schema/input: additive commands and DTOs only.
- output order: business_date DESC, record_id DESC across all supported types.
- optional field behavior: supplier, note, receipt_image_path can be null and render as Japanese fallback text.

## Data Safety Checks

- source-derived data: none; test fixtures synthesize product and record rows.
- generated outputs: `src/lib/bindings.ts` and `src/routeTree.gen.ts` are generated and inspected.
- secrets: no `.env*`, credentials, DB backups, real receipt images.
- local-only files: no app data or local SQLite DB committed.
- synthetic sample boundaries: manual L3 seed, if needed, uses clearly prefixed synthetic records only.

## Main Wiring / Integration Checks

- helper connected to main path: `queryKeys.inventoryRecords.*Detail` used by detail pages.
- output reaches manifest/report: new commands are in `collect_commands!` / `generate_handler!`.
- effective config reaches runtime: route files regenerate into `routeTree.gen.ts`.
- CLI arg reaches implementation: not applicable.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? `register_processed=true` movement empty-state test and movement source route tests.
- If a threshold comparison changes, which test fails? page/per_page validation tests.
- If a guard is removed, which test fails? external `returnTo` fallback route tests.
- If an output field is omitted, which test fails? detail RTL tests for supplier/reason/amount/receipt labels and generated type compile.
- If output order changes, which test fails? union order Rust test and records page row order assertion.
- If dry-run performs a side effect, which test fails? not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? no runtime test; residual gap accepted for local SQLite IDs.
- If a state token is round-tripped through browser/client code, which test fails? `InventoryRecordsPage` returnTo link test and detail route back href tests.

## Residual Test Gaps

- Windows native WebView IME and visual density are covered by L3, not CI.
- Receipt image asset rendering is intentionally deferred; tests only cover path/attachment presence display.
