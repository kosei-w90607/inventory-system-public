# Test Design Matrix: UI-03 返品・交換 Implementation

## Risk

Risk: R3

## Contracts Under Test

- UI-03-D2: `createReturn` / `listReturns` / `saveReceiptImage` are generated commands.
- UI-03-D5: create failure after image save reuses `savedReceiptPath`.
- UI-03-D6: BIZ and UI reject `return` with `out` rows.
- UI-03-D7: BIZ and UI reject one-sided `exchange`.
- UI-03-D8: register processed explanation is visible text + Badge.
- UI-03-D11: rows are unique by `productCode + direction`.
- UI-03-D13: idempotency key survives same-content retry and rotates after edit/image/note change.
- UI-03-D17: returns invalidation always runs; stock invalidation runs only when `register_processed=false`.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-03-D6 | BIZ accepts invalid return out | Rust BIZ | `test_create_return_req202_rejects_return_with_out_direction` | `return_type=return` with `direction=out` is inserted |
| UI-03-D7 | BIZ accepts one-sided exchange | Rust BIZ | `test_create_return_req202_rejects_exchange_missing_in_or_out` | exchange with only in or only out is inserted |
| UI-03-D2 | generated binding gap | Rust generated/typecheck | `generate_bindings` + TS typecheck | commands/types missing from `bindings.ts` |
| UI-03-D11 | row merge loses direction | unit | `return-exchange-row-utils.test.ts: duplicate product increments by direction` | same product in/out merge together |
| UI-03-D6/D7/D12 | request builder misses validation | unit | `return-exchange-request.test.ts` | invalid return/exchange/date/quantity reaches command |
| UI-03-D4 | image helper cannot create payload | unit | `receipt-image.test.ts: builds save image request from file` | file bytes are not converted to base64 or extension is not validated |
| UI-03-D5 | retry repeats image save | component | `ReturnExchangePage.test.tsx: retry after create failure reuses saved receipt path` | unchanged retry calls `saveReceiptImage` again |
| UI-03-D8 | register meaning unclear | component/L3 | `ReturnExchangePage.test.tsx: register processed explanation text changes` | true/false lacks explicit inventory meaning |
| UI-03-D17 | cache stale/over-invalidated | component | `ReturnExchangePage.test.tsx: submit invalidates returns and conditional stock keys` | returns key missing or stock invalidates for register processed |

## Boundary / Negative Paths

- blank date, no rows, zero/negative/decimal quantity, unsupported image extension.
- return with out row; exchange with only in; exchange with only out.
- product search 0/1/multiple results.
- image save fails before `createReturn`.
- `createReturn` fails after image save and retry keeps existing relative path.
- same-content retry keeps idempotency key; edit/image/note retry rotates key.

## Main Wiring Checks

- `collect_commands!` includes `return_cmd::create_return`, `return_cmd::list_returns`, `settings_cmd::save_receipt_image`.
- `generate_handler!` remains aligned with runtime commands.
- `src/lib/bindings.ts` contains return/image commands and DTOs.
- `/inventory/return` route builds.
- navigation UI-03 is active and points to `/inventory/return`.

## Manual L3

Windows native L3 must cover navigation, product Enter add/focus return, direction switching, register processed explanation, validation, image select/preview, save result, recent list, and stock inquiry return path.
