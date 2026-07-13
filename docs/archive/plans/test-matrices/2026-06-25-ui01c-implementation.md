# Test Design Matrix: UI-01c 商品一括インポート

## Risk

Risk: R3

## Contracts Under Test

- REQ-104 / SPEC-UI01C-REQ104: CSV file can be previewed, partially accepted, duplicate-controlled, committed, and summarized.
- UI-01c-D2: generated commands and types are the only frontend backend boundary.
- UI-01c-D4: import flow state is reducer-controlled and recoverable.
- UI-01c-D6/D7: duplicate rows default to skip and require confirmation for overwrite.
- UI-01c-D8/D9: row errors do not block valid rows; zero import target blocks commit with visible reason.
- UI-01c-D10/D11: successful commit invalidates stale product/inventory data and shows result actions.
- UI-01c-D13: Windows native visual confirmation is required.

## Failure Modes

- Product import commands are registered in Rust but missing from generated bindings.
- Generated TypeScript type name collides with existing sales CSV `ImportResult` because product import result was not renamed to `ProductImportResult`.
- UI commits error rows or unselected duplicate rows.
- Duplicate rows default to overwrite or can be overwritten without confirmation.
- Commit button remains enabled when there are no importable rows.
- Commit failure clears preview state and forces the operator to reselect a file.
- Successful commit leaves product list, home low stock, stock inquiry, or PLU dirty query caches stale.
- Operator cannot visually distinguish new rows, row errors, duplicates, skip, and overwrite.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-01c-D2 | missing generated command | Rust/TS compile | `cargo run --bin generate_bindings` + `npm run typecheck` | `previewImport` / `commitImport` or import DTO types are missing |
| UI-01c-D2 | type collision | typecheck/regression | `npm run typecheck` | product import result reuses/breaks sales CSV `ImportResult` instead of generated `ProductImportResult` |
| UI-01c-D4 | invalid flow transition | unit | `product-import-reducer.test.ts` | preview/result/error/reset transitions lose state or allow impossible state |
| UI-01c-D3 | file bytes not sent | RTL | `ProductImportPage.test.tsx` file selection case | selected file does not call `commands.previewImport` with bytes |
| UI-01c-D5 | preview labels missing | RTL | `ProductImportPage.test.tsx` preview summary case | counts or Japanese labels are absent |
| UI-01c-D6 | duplicate default wrong | RTL | `ProductImportPage.test.tsx` duplicate default skip case | duplicate rows start as overwrite |
| UI-01c-D7 | confirm boundary wrong | RTL | `ProductImportPage.test.tsx` overwrite confirmation case | overwrite commit bypasses dialog or new-only commit shows dialog |
| UI-01c-D8 | error row committed | RTL | `ProductImportPage.test.tsx` partial import case | commit payload includes error rows or blocks valid rows |
| UI-01c-D9 | zero target enabled | RTL | `ProductImportPage.test.tsx` no import target case | commit button is enabled with no valid/overwrite rows |
| UI-01c-D10 | stale cache | RTL/hook | `ProductImportPage.test.tsx` commit success invalidation case | `queryKeys.productList.root()`, `queryKeys.lowStock(false)`, `queryKeys.stockInquiryRoot()`, or `queryKeys.pluDirty()` is not invalidated |
| UI-01c-D11 | result incomplete | RTL | `ProductImportPage.test.tsx` result summary case | created/updated/skipped counts or next actions are missing |
| UI-01c-D12 | false cancel | RTL | `ProductImportPage.test.tsx` committing state case | committing state exposes reset/cancel or editable controls |
| UI-01c-D13 | visual ambiguity | manual L3 | Windows native owner checklist | operator cannot distinguish error/duplicate/overwrite/result states |

## Negative Paths

- missing input: empty file returns validation Alert and file selection remains available.
- invalid input: missing required headers or decode failure shows file-level Alert.
- duplicate/ambiguous input: duplicate product codes default skip; overwrite requires confirmation.
- unknown reference: row errors from unknown department/supplier appear in error rows and are not committed.
- dependency missing: generated command/type missing fails typecheck.
- permission/write failure: commit internal error shows Alert and preserves preview state.
- dry-run side effect: preview does not write DB; backend tests already cover this, UI treats preview as read-only.

## Boundary Checks

- threshold: preview table displays a bounded initial row set while counts show totals.
- null/default: optional import fields stay optional until commit; UI does not invent BIZ defaults.
- empty/non-empty: zero target disables commit; non-empty target enables commit.
- min/max: counts are JS-safe numbers; no precision risk at project scale.
- status/policy enum: reducer states are discriminated union variants.
- wire type: `previewImport(fileBytes: number[])` and `commitImport(validRows, overwriteCodes)` are generated typed commands; commit result is `ProductImportResult`.
- internal type: Rust import DTOs derive `specta::Type`; product import result is renamed from `ImportResult` to `ProductImportResult`.
- producer/consumer: Rust product_cmd -> generated bindings -> ProductImportPage.
- round-trip token: no server preview token by design; rows are round-tripped through frontend state.
- precision/range: product counts and line numbers remain well below JS safe integer.
- cross-language parse: generated bindings compile and frontend tests use the generated shapes.

## Compatibility Checks

- old schema/input: no DB schema change.
- new schema/input: no new CSV columns required; optional columns remain optional.
- output order: preview row order follows backend order; UI tests assert visible line labels, not brittle full order unless required.
- optional field behavior: UI passes backend-provided rows back unchanged except duplicate selection filtering.

## Data Safety Checks

- source-derived data: no real product master or POS CSV fixtures.
- generated outputs: `src/lib/bindings.ts` is inspected after generation.
- secrets: no `.env*`, credentials, keys, auth files.
- local-only files: any manual CSVs stay ignored/local.
- synthetic sample boundaries: fake product codes/names only in tests.

## Main Wiring / Integration Checks

- helper connected to main path: reducer used by `ProductImportPage`.
- output reaches manifest/report: generated commands appear in `src/lib/bindings.ts`.
- effective config reaches runtime: `navigation.ts` points UI-01c to `/products/import`.
- CLI arg reaches implementation: not applicable.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? Duplicate default skip / overwrite confirmation RTL tests.
- If a threshold comparison changes, which test fails? Zero target disabled test.
- If a guard is removed, which test fails? Error rows not committed and overwrite confirmation tests.
- If an output field is omitted, which test fails? Result summary test and typecheck.
- If output order changes, which test fails? Preview summary should survive; row-specific tests use line labels.
- If dry-run performs a side effect, which test fails? Existing Rust preview tests; UI has no DB side-effect assertion.
- If a JSON number crosses JavaScript safe integer range, which test fails? Not applicable at expected scale; type remains number.
- If a state token is round-tripped through browser/client code, which test fails? Reducer transition tests.

## Residual Test Gaps

- Windows native file drag/drop and visual distinction require manual L3 evidence.
- Actual Excel-produced CP932 files are not committed; parser coverage remains Rust synthetic fixtures.
