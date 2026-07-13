# Inventory Traceability Foundation Test Design Matrix

## Risk

Risk: R3

## Contracts Under Test

- TRACE-D2 / REQ-207: movement reference resolves to an originating business-record label and route.
- REQ-303: existing product movement listing remains paged, filtered, and visible.
- Compatibility: movements with NULL or unknown references remain readable and do not become errors.
- Generated contract: `MovementRecord` binding includes the optional source link DTO.

## Failure Modes

- Route mapping points to the wrong records route.
- Source label is too generic and cannot identify the record type.
- Resolver lives in CMD/UI and bypasses BIZ ownership.
- NULL reference rows disappear or fail the whole query.
- Unknown reference_type causes a hard error.
- Existing paging/filter/order behavior changes while adding source metadata.
- `bindings.ts` is stale or hand-edited.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| TRACE-D2 / REQ-207 | wrong route/label | unit | `test_resolve_movement_source_req207_known_references` | receiving/disposal/csv/manual/return/stocktake mapping is wrong |
| Compatibility | NULL reference errors | unit | `test_resolve_movement_source_req303_null_reference` | source resolver requires reference data for every row |
| Compatibility | unknown reference errors | unit | `test_resolve_movement_source_req303_unknown_reference` | old or corrupt rows fail the whole list |
| REQ-303 | source not attached | integration | `test_list_movements_req303_includes_source_link` | `list_movements` returns raw reference only |
| REQ-303 | old fields regress | integration | existing `test_list_movements_req303_type_filter` / `date_to_end_of_day` | enrichment changes filter/order/date behavior |
| REQ-207 | CMD path loses source | integration | `test_list_movements_req207_source_link_through_biz` | CMD uses a stale type or bypasses enrichment |
| Generated contract | stale TS binding | schema / CLI | `cargo run --bin generate_bindings`; `npm run typecheck` | TypeScript does not see the optional source field |

## Negative Paths

- missing input: `reference_type=None` and/or `reference_id=None`.
- invalid input: unsupported `reference_type` string from legacy/corrupt row.
- duplicate/ambiguous input: multiple movement rows pointing to the same record should each receive the same source link.
- unknown reference: route target may not exist yet; resolver still returns route for known enum values and no source for unknown enum values.
- dependency missing: generated binding command fails if Rust types are not Specta-compatible.
- permission/write failure: no runtime writes; generated binding writes only expected tracked file.
- dry-run side effect: not applicable.

## Boundary Checks

- threshold: page/per_page validation remains existing BIZ logic.
- null/default: `source=None` for missing references.
- empty/non-empty: empty movement list remains empty.
- min/max: SQLite IDs are passed through as i64 and formatted into route string.
- status/policy enum: known reference_type values are `csv_import`, `manual_sale`, `receiving_record`, `return_record`, `disposal_record`, `stocktake`.
- wire type: `PaginatedResult<MovementRecord>` with optional source DTO.
- internal type: IO row plus BIZ-resolved source metadata.
- producer/consumer: Rust CMD producer, future UI-06c consumer through generated TS binding.
- round-trip token: `reference_type/reference_id` survives and source route uses the same id.
- precision/range: normal SQLite row IDs; no JS arithmetic on IDs.
- cross-language parse: snake_case/camelCase generated binding shape is inspected by typecheck.

## Compatibility Checks

- old schema/input: no DB migration; rows with NULL reference still list.
- new schema/input: additive output field; existing fields unchanged.
- output order: `ORDER BY created_at DESC, id DESC` unchanged.
- optional field behavior: source absent when reference is absent or unknown.

## Data Safety Checks

- source-derived data: no real POS/store data.
- generated outputs: `src/lib/bindings.ts` only after `generate_bindings`.
- secrets: no `.env*`, keys, certificates, auth files.
- local-only files: DB/log/backup/dist/target not committed.
- synthetic sample boundaries: fake product codes and in-memory DB only.

## Main Wiring / Integration Checks

- helper connected to main path: resolver is called by `inventory_service::list_movements`.
- output reaches manifest/report: generated binding includes new DTO.
- effective config reaches runtime: existing `cmd::inventory_cmd::list_movements` remains registered.
- CLI arg reaches implementation: traceability generator sees REQ-207 / REQ-303 tests.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? known/unknown reference resolver tests.
- If a threshold comparison changes, which test fails? existing per_page validation tests.
- If a guard is removed, which test fails? NULL / unknown reference tests.
- If an output field is omitted, which test fails? source enrichment test and typecheck.
- If output order changes, which test fails? existing list movement ordering expectations if affected; otherwise review diff.
- If dry-run performs a side effect, which test fails? not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? no dedicated test; IDs are displayed/linked, not calculated.
- If a state token is round-tripped through browser/client code, which test fails? not applicable in this backend slice.

## Residual Test Gaps

- UI click-through to the route is intentionally deferred to UI-06c.
- Known route strings may point to pages not yet implemented; this PR validates contract strings, not navigation rendering.
- No Windows native L3 is required for this backend-only slice.

## Execution Results

- `cd src-tauri && cargo test inventory_service::list` PASS
- `cd src-tauri && cargo test inventory_cmd` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（569 tests）
- `cd src-tauri && cargo run --bin generate_bindings` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm test` PASS（71 files / 452 tests）
- `npm run build` PASS
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS
