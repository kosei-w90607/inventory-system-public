# Test Design Matrix: UI-01b 商品登録・修正 Implementation

## Risk

Risk: R3

## Contracts Under Test

- UI-01b-D1: `/products/new` と `/products/$code/edit` route mode。
- UI-01b-D2: safe `returnTo` is product list only.
- UI-01b-D3: generated commands only.
- UI-01b-D4: JANなし + prefix対象部門 only.
- UI-01b-D5: edit read-only unsupported fields.
- UI-01b-D6: cm proposes POS sync off but preserves override.
- UI-01b-D7: supplier options from complete master data.
- UI-01b-D8: required/optional failure recovery.
- UI-01b-D9: Windows native Japanese input/focus/save verification.

## Failure Modes

- UI calls ad hoc invoke because CRUD commands are not generated.
- `list_suppliers` exists only in IO and is not wired through BIZ/CMD/runtime.
- safe return accepts `/products/new`, `/products/ABC/edit`, `/products/import`, external URL, or unrelated route.
- JAN blank + prefixなし department can submit.
- edit sends `stock_unit`, `stock_quantity`, `jan_code`, or `product_code`.
- cm switch forces `pos_stock_sync=false` permanently and blocks user override.
- supplier options come from current product or search result.
- department failure still allows save.
- supplier failure blocks no-supplier save.
- duplicate/not_found/internal errors lose form state or hide recovery.
- discontinued state is color-only.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| CMD/BIZ list_suppliers | wrapper missing | Rust unit | `test_list_suppliers_req101_biz_wrapper_returns_all_suppliers` | BIZ does not call IO list_suppliers |
| CMD/BIZ list_suppliers | CMD/runtime/generated wiring missing | Rust/generated/review | `list_suppliers_wiring_review` | `product_cmd::list_suppliers`, `collect_commands!`, `generate_handler!`, or bindings `listSuppliers` is missing |
| UI-01b-D3 | generated command gap | generated/review | `grep-bindings-ui01b-commands` | generated command/type missing |
| UI-01b-D1 | route mode drift | frontend route/component | `ProductFormPage.test.tsx: create and edit modes` | mode is wrong |
| UI-01b-D2 | unsafe return target | frontend unit | `sanitizeReturnTo.test.ts` | form/import/external route accepted |
| UI-01b-D4 | create payload drift | frontend unit | `buildCreateProductRequest.test.ts` | JAN/prefix mapping wrong |
| UI-01b-D4 | prefix validation missing | frontend component | `ProductForm.test.tsx: prefix required for JAN blank` | prefixなし department submits |
| UI-01b-D5 | readonly drift | frontend component | `ProductForm.test.tsx: edit readonly fields` | unsupported fields editable |
| UI-01b-D5 | update payload drift | frontend unit | `buildUpdateProductRequest.test.ts` | unsupported/unchanged fields sent |
| UI-01b-D6 | POS sync proposal drift | frontend component | `StockUnitField.test.tsx` | cm proposal or override broken |
| UI-01b-D7 | supplier source drift | hook/component | `useProductFormOptions.test.tsx` | options not from `listSuppliers` |
| UI-01b-D8 | required option failure | frontend component | `ProductFormPage.test.tsx: department failure blocks save` | save remains enabled |
| UI-01b-D8 | optional option failure | frontend component | `ProductFormPage.test.tsx: supplier failure allows no-supplier save` | no-supplier save blocked |
| UI-01b-D8 | getProduct not found | frontend component | `ProductFormPage.test.tsx: edit not found` | blank stale form shown |
| UI-01b-D8 | save error recovery | frontend component | `ProductFormPage.test.tsx: duplicate preserves form` | inputs lost or no actionable message |
| UI-01b-D8 | discontinued color-only | frontend component | `ProductForm.test.tsx: discontinued state text` | state lacks Japanese text |
| UI-01b-D9 | native drift | manual L3 | `Windows native UI-01b L3` | IME/focus/save/toggle fails |

## Negative Paths

- invalid `returnTo` cases: external, `/reports/daily`, `/products/new`, `/products/ABC/edit`, `/products/import`.
- blank required fields, negative/non-integer price/cost/initial stock.
- JAN blank + prefixなし department.
- `listDepartments` error, `listSuppliers` error, `getProduct` not found.
- duplicate product code and internal save error.

## Boundary Checks

- generated DTOs: create/update/result/supplier.
- nullable fields: clear supplier and maker code.
- enum/string fields: tax rate and stock unit.
- integer fields: yen and stock.
- path/search state: `code`, `returnTo`.
- status: discontinued state text + action label.

## Compatibility Checks

- UI-01a route and search params remain valid.
- existing product BIZ tests pass.
- generated `searchProducts`, `getProduct`, `listDepartments` names remain stable.
- no DB schema/migration change.

## Data Safety Checks

- synthetic data only.
- no `.env*`, local DB, POS/store artifacts, backups, logs, receipt images.
- no destructive commands.

## Main Wiring / Integration Checks

- `collect_commands!` and `generate_handler!`.
- `cargo run --bin generate_bindings` and binding diff review.
- route tree generation / typecheck / build.
- UI-01a `商品登録` and `修正` navigation to new routes.

## Residual Test Gaps

- Windows native L3 is manual evidence, not automated.
- inline supplier creation, manual product code, edit stock unit/quantity, cm/m toggle, and scanner UX are intentionally deferred.
