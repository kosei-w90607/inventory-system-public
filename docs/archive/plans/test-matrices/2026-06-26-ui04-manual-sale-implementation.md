# UI-04 手動販売出庫 Test Design Matrix

## Risk

Risk: R3

## Contracts Under Test

- UI-04-D2: UI uses generated `commands.createManualSale` only.
- UI-04-D4/D5: product add input supports 0/1/multiple search results and focus return.
- UI-04-D6/D7: duplicate product codes merge into one row and invalid quantities/amounts are blocked.
- UI-04-D8/D9/D10: PLU confirmation and idempotency key lifecycle prevent double recording.
- UI-04-D11/D12/D13: pending lock, result panel, and cache invalidation are correct.
- UI-04-D14: Windows native L3 covers operator readability and daily sales manual Badge.

## Failure Modes

- UI calls an untyped/ad hoc invoke path and misses binding drift.
- A broad search auto-adds the first product without operator selection.
- Same product code creates duplicate rows instead of incrementing quantity.
- Decimal/zero quantity or negative amount reaches backend.
- `needs_confirmation=true` is treated as a saved sale.
- Editing after PLU confirmation reuses a stale token/key.
- Saving invalidates PLU dirty state unnecessarily or misses daily/monthly sales cache.
- Saving appears cancellable while the command is in flight.
- Daily sales "手動" Badge remains unverified after UI-04 makes it reachable.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-04-D2 | untyped command path | integration / schema | `npm run typecheck`; binding diff review | `createManualSale` is absent from generated bindings or UI imports a fallback |
| UI-04-D4/D5 | 1 result not added / focus lost | RTL | `REQ-203 adds a single matching product and restores focus` | Enter search does not add exactly one result or input focus is not returned |
| UI-04-D4/D5 | multiple candidates auto-add | RTL | `REQ-203 requires explicit selection when multiple products match` | first candidate is added without pressing `手動販売に追加` |
| UI-04-D4/D5 | 0 result recovery missing | RTL | `REQ-203 shows product registration guidance for no match` | no-result text or `/products/new` link is missing |
| UI-04-D6 | duplicate rows created | unit / RTL | `REQ-203 merges duplicate product codes into one row` | row count increases for the same `product_code` |
| UI-04-D7 | invalid numbers submitted | unit / RTL | `REQ-203 blocks invalid quantity and amount before submit` | quantity 0/1.5 or amount -1 calls `createManualSale` |
| UI-04-D8 | PLU warning saved as result | RTL | `REQ-203 shows PLU confirmation without result when confirmation is required` | `needs_confirmation=true` displays sale result or invalidates cache |
| UI-04-D8 | confirm omits token/key | RTL | `REQ-203 resubmits PLU confirmation with same key and token` | second request lacks returned `confirmation_token` or changes key |
| UI-04-D9/D10 | stale token reused after edit | RTL / unit | `REQ-203 clears confirmation after editing sale contents` | edit leaves old confirmation panel/token active |
| UI-04-D11 | pending operation appears cancellable | RTL | `REQ-203 disables return and editing while saving` | back/reset/input controls remain enabled during pending mutation |
| UI-04-D12 | incomplete result | RTL | `REQ-203 displays manual sale result and follow-up links` | sale_id/item count/warnings/daily link/stock link are missing |
| UI-04-D13 | wrong cache invalidation | RTL | `REQ-203 invalidates inventory and sales queries after save` | product/stock/daily/monthly keys are not invalidated or `pluDirty` is invalidated |
| UI-04-D14 | manual badge not reachable | manual L3 | `Windows native L3: daily sales manual Badge` | saved manual sale cannot be checked on daily sales or Badge is unreadable |

## Negative Paths

- missing input: sale date empty, no rows.
- invalid input: quantity 0, quantity decimal, amount negative.
- duplicate/ambiguous input: same product code, multiple search candidates.
- unknown reference: product search returns empty result.
- dependency missing: product search or create command rejects.
- permission/write failure: backend command rejects; UI preserves form and idempotency key for same-content retry.
- dry-run side effect: `needs_confirmation=true` must not show result or invalidate caches.

## Boundary Checks

- threshold: quantity min `1`; amount min `0`.
- null/default: note `null` when blank; confirmation token `null` on first submit; reason default `"plu_unregistered"`.
- empty/non-empty: rows empty disables submit; warnings empty/non-empty render correctly.
- min/max: integer amount and quantity fields preserve numeric parsing.
- status/policy enum: `"plu_unregistered"` / `"other"` wire values, Japanese labels in UI.
- wire type: Specta generated request/result.
- internal type: UI row type maps to `{ product_code, quantity, amount }`.
- producer/consumer: Rust CMD -> generated binding -> React page.
- round-trip token: `confirmation_token` and `idempotency_key` survive confirm submit only for unchanged content.
- precision/range: JS number safe for normal sale amounts; SQLite ids displayed, not recalculated.
- cross-language parse: `YYYY-MM-DD` sale date reaches Rust unchanged.

## Compatibility Checks

- old schema/input: no DB migration required; existing backend manual sale tests remain valid.
- new schema/input: generated binding includes existing Rust structs without changing field names.
- output order: candidate list order follows `searchProducts` response; no UI sort promise beyond command input.
- optional field behavior: blank note sends `null`; `sale_id=null` only in confirmation state.

## Data Safety Checks

- source-derived data: no real POS/store CSV.
- generated outputs: `src/lib/bindings.ts` only after `generate_bindings`; route tree remains per project convention.
- secrets: no `.env*`, auth, keys, certificates.
- local-only files: DB/log/backup/dist/target not committed.
- synthetic sample boundaries: L3 sample data must use fake product codes.

## Main Wiring / Integration Checks

- helper connected to main path: request builder and row utils are used by `ManualSalePage`.
- output reaches manifest/report: `createManualSale` is in `collect_commands!` and `bindings.ts`.
- effective config reaches runtime: `navigation.ts` points UI-04 to `/inventory/manual-sale`.
- CLI arg reaches implementation: traceability generator sees REQ-203 tests.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? PLU `needs_confirmation` RTL test.
- If a threshold comparison changes, which test fails? quantity/amount validation unit and RTL tests.
- If a guard is removed, which test fails? pending lock and invalid submit tests.
- If an output field is omitted, which test fails? result panel RTL test and typecheck.
- If output order changes, which test fails? candidate selection test only if the UI incorrectly assumes first auto-add on multiple.
- If dry-run performs a side effect, which test fails? PLU confirmation cache invalidation assertion and Rust backend tests.
- If a JSON number crosses JavaScript safe integer range, which test fails? no dedicated test; amounts are operator-entered normal integers.
- If a state token is round-tripped through browser/client code, which test fails? confirm resubmit and edit-clears-token tests.

## Residual Test Gaps

- Windows native barcode scanner physical HID timing is not automated; L3 uses keyboard Enter equivalent.
- Daily sales "手動" Badge readability is manual L3 rather than visual regression.
