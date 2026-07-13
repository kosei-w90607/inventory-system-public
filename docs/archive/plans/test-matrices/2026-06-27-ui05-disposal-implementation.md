# UI-05 廃棄・破損 Test Design Matrix

## Risk

Risk: R3

## Contracts Under Test

- UI-05-D2: UI uses generated `commands.createDisposal` / `commands.listDisposals` only.
- UI-05-D5/D6: product add input supports 0/1/multiple search results and focus return.
- UI-05-D3/D4/D7/D8: line-level disposal type/reason, duplicate merge, and invalid quantities/cost/reasons are blocked.
- UI-05-D9/D10: idempotency key lifecycle prevents double recording and pending save cannot appear cancellable.
- UI-05-D11/D12/D13: result panel, recent list, and cache invalidation are correct.
- UI-05-D14: Windows native L3 covers operator readability and state distinction.

## Failure Modes

- UI calls an untyped/ad hoc invoke path and misses binding drift.
- A broad search auto-adds the first product without operator selection.
- Same product/type/reason creates duplicate rows instead of incrementing quantity.
- Different reason is incorrectly merged and loses loss-cause detail.
- Decimal/zero quantity, negative cost, or blank reason reaches backend.
- Saving reuses an idempotency key after edited contents.
- Saving appears cancellable while the command is in flight.
- Saving invalidates sales or PLU dirty state unnecessarily, or misses inventory cache.
- Recent disposal list is not refreshed after save.
- Late product-search results can mutate the form after save locks it.
- Reason typing loses focus because an editable field is used as the React row key.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-05-D2 | untyped command path | integration / schema | `npm run typecheck`; binding diff review | `createDisposal` / `listDisposals` are absent from generated bindings or UI imports a fallback |
| UI-05-D5/D6 | 1 result not added / focus lost | RTL | `REQ-204 adds a single matching product and restores focus` | Enter search does not add exactly one result or input focus is not returned |
| UI-05-D5/D6 | multiple candidates auto-add | RTL | `REQ-204 requires explicit selection when multiple products match` | first candidate is added without pressing `廃棄・破損に追加` |
| UI-05-D5/D6 | 0 result recovery missing | RTL | `REQ-204 shows product registration guidance for no match` | no-result text or `/products/new` link is missing |
| UI-05-D7 | duplicate rows created | unit / RTL | `REQ-204 merges duplicate product/type/reason into one row` | row count increases for the same product/type/reason |
| UI-05-D7 | reason detail lost | unit / RTL | `REQ-204 keeps different disposal reasons as separate rows` | different reasons are merged into one row |
| UI-05-D8 | invalid values submitted | unit / RTL | `REQ-204 blocks invalid quantity cost and reason before submit` | quantity 0/1.5, cost -1, or blank reason calls `createDisposal` |
| UI-05-D9 | edited retry reuses key | RTL / unit | `REQ-204 keeps the idempotency key for same-content retry and rotates it after edits or reset` | changed contents submit with the failed request key or same-content retry rotates unnecessarily |
| UI-05-D10 | pending operation appears cancellable | RTL | `REQ-204 disables return and editing while saving` | back/reset/input controls remain enabled during pending mutation |
| UI-05-D11 | incomplete result | RTL | `REQ-204 displays disposal result and follow-up links` | record_id/item count/loss total/warnings/stock link are missing |
| UI-05-D12 | recent list missing | RTL | `REQ-204 displays recent disposal records` | list query is not called or empty/error/success states are missing |
| UI-05-D13 | wrong cache invalidation | RTL | `REQ-204 invalidates disposal and inventory queries after save` | disposal/product/lowStock/stockInquiry keys are not invalidated or sales/PLU keys are invalidated |
| UI-05-D10 | stale async search mutates locked form | RTL | `REQ-204 ignores late product search results after the form is locked` | a late product search result adds a row after save locks or completes the form |
| UI-05-D7/D8 | editable reason remounts the row | RTL | `REQ-204 keeps focus while typing a disposal reason` | row identity changes on each reason character and focus is lost |
| UI-05-D14 | operator flow unverified | manual L3 | `Windows native L3: disposal flow` | saved disposal cannot be checked or key labels are unreadable |

## Negative Paths

- missing input: disposal date empty, no rows.
- invalid input: quantity 0, quantity decimal, cost negative, reason blank.
- duplicate/ambiguous input: same product/type/reason, same product with different reason, multiple search candidates.
- unknown reference: product search returns empty result.
- dependency missing: product search, list, or create command rejects.
- backend validation: command rejects; UI preserves form and idempotency key for same-content retry.

## Boundary Checks

- threshold: quantity min `1`; cost_price min `0`; reason non-empty.
- null/default: disposal type default `"damage"`; date default today.
- empty/non-empty: rows empty disables submit; warnings empty/non-empty render correctly.
- min/max: integer cost and quantity fields preserve numeric parsing.
- status/policy enum: `"disposal"` / `"damage"` / `"other"` wire values, Japanese labels in UI.
- wire type: Specta generated request/result/list summary.
- internal type: UI row type maps to `{ product_code, disposal_type, quantity, cost_price, reason }`.
- producer/consumer: Rust CMD -> generated binding -> React page.
- precision/range: JS number safe for normal store quantities/costs; SQLite ids displayed, not recalculated.
- cross-language parse: `YYYY-MM-DD` disposal date reaches Rust unchanged.

## Compatibility Checks

- old schema/input: no DB migration required; existing backend disposal tests remain valid.
- new schema/input: generated binding includes existing Rust structs without changing field names.
- output order: candidate list order follows `searchProducts` response; no UI sort promise beyond command input.
- optional field behavior: none in create payload except date/list filters; list filters use `null`.

## Data Safety Checks

- source-derived data: no real POS/store CSV.
- generated outputs: `src/lib/bindings.ts` only after `generate_bindings`; route tree remains per project convention.
- secrets: no `.env*`, auth, keys, certificates.
- local-only files: DB/log/backup/dist/target not committed.
- synthetic sample boundaries: L3 sample data must use fake product codes.

## Main Wiring / Integration Checks

- helper connected to main path: request builder and row utils are used by `DisposalPage`.
- output reaches manifest/report: `createDisposal` / `listDisposals` are in `collect_commands!` and `bindings.ts`.
- effective config reaches runtime: `navigation.ts` points UI-05 to `/inventory/disposal`.
- CLI arg reaches implementation: traceability generator sees REQ-204 tests.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? validation and pending RTL tests.
- If a threshold comparison changes, which test fails? quantity/cost validation unit and RTL tests.
- If a guard is removed, which test fails? pending lock and invalid submit tests.
- If an output field is omitted, which test fails? result panel RTL test and typecheck.
- If output order changes, which test fails? candidate selection test only if the UI incorrectly assumes first auto-add on multiple.
- If duplicate merge key changes, which test fails? same type/reason merge and different reason separation tests.
- If a JSON number crosses JavaScript safe integer range, which test fails? no dedicated test; quantities/costs are operator-entered normal integers.
- If a state token is round-tripped through browser/client code, which test fails? idempotency retry tests.

## Residual Test Gaps

- Windows native barcode scanner physical HID timing is not automated; L3 uses keyboard Enter equivalent.
- Visual readability is manual L3 rather than visual regression.
- L3 is in progress as of implementation verification. 1-4 passed. L3 found reason-input focus loss after one character; automated coverage now includes that regression. Operator readability and the remaining save/recent-list flow still need owner confirmation before merge.

## Execution Results

- `npm test -- --run src/features/disposal/DisposalPage.test.tsx` PASS（12 tests）
- `npm test` PASS（71 files / 452 tests）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm run build` PASS
- `cd src-tauri && cargo test` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
