# Test Design Matrix: UI-01b 商品登録・修正 Design Readiness

## Risk

Risk: R3

## Contracts Under Test

- UI-01b-D1: `/products/new` と `/products/$code/edit` で create/edit mode を分ける。
- UI-01b-D2: 保存後 return target は `/products` 配下だけ許可する。
- UI-01b-D3: UI-01b は generated `commands.*` だけを使う。
- UI-01b-D4: JANなし商品は独自コード発番対象部門だけで保存可能にする。
- UI-01b-D5: edit mode で unsupported fields を編集可能に見せない。
- UI-01b-D6: `stock_unit='cm'` は `pos_stock_sync=false` を提案し、利用者 override を尊重する。
- UI-01b-D7: supplier options は `listSuppliers` 由来の complete master data である。
- UI-01b-D8: 部門 / 取引先 / 商品取得 / 保存失敗を recovery 可能に分ける。
- UI-01b-D9: Windows native L3 で日本語入力と保存 flow を確認する。

## Failure Modes

- create/edit が同じ route state で混ざり、直接 URL 復元時に誤 mode になる。
- `returnTo` に任意 URL / unrelated path / 商品フォーム route / import route が入り、保存後に意図しない画面へ遷移する。
- UI が generated binding にない command を ad hoc invoke で呼ぶ。
- JANなし + prefixなし部門でも保存可能に見え、BIZ validation で初めて落ちる。
- edit mode で `product_code`, `jan_code`, `stock_unit`, `stock_quantity` を変更できるように見える。
- `stock_unit='cm'` にした後、`pos_stock_sync` を true に戻せない。
- supplier options を current product / current result から派生して候補が欠ける。
- 部門取得失敗でも保存可能になり、必須部門なしで送信される。
- 取引先取得失敗で、取引先未指定の商品登録まで不能になる。
- 廃番状態が色だけで示され、状態を読み違える。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-01b-D1 | route mode drift | route/component | `ProductFormPage.test.tsx: create and edit route modes` | `/products/new` or `/products/$code/edit` chooses wrong mode |
| UI-01b-D2 | unsafe return target | unit | `product-form-navigation.test.ts: sanitizeReturnTo` | external/unrelated/form/import return target is accepted |
| UI-01b-D3 | generated command gap | Rust/generated/review | `grep-bindings-ui01b-commands` | `createProduct`, `updateProduct`, `toggleDiscontinue`, `listSuppliers` missing |
| UI-01b-D4 | unsupported manual code | component/unit | `ProductForm.test.tsx: jan blank prefix validation` | JAN blank + prefixなし department can submit |
| UI-01b-D4 | create payload drift | unit | `buildCreateProductRequest.test.ts` | JANあり / JANなし payload maps incorrectly |
| UI-01b-D5 | unsupported edit fields | component | `ProductForm.test.tsx: edit readonly fields` | edit allows stock unit / quantity / code changes |
| UI-01b-D5 | update payload drift | unit | `buildUpdateProductRequest.test.ts` | unchanged/read-only fields are sent |
| UI-01b-D6 | POS sync proposal drift | component | `ProductForm.test.tsx: cm proposes pos sync off` | cm does not propose false or override is lost |
| UI-01b-D7 | supplier candidates incomplete | hook/component | `useProductFormOptions.test.tsx: suppliers from listSuppliers` | options are derived from product/search result |
| UI-01b-D8 | department failure unsafe | component | `ProductFormPage.test.tsx: department failure blocks save` | required department options fail but save remains possible |
| UI-01b-D8 | supplier failure too strict | component | `ProductFormPage.test.tsx: supplier failure still allows no-supplier save` | optional supplier failure blocks all saves |
| UI-01b-D8 | getProduct not found | component | `ProductFormPage.test.tsx: edit not found recovery` | edit form renders stale/empty data |
| UI-01b-D8 | duplicate save error | component | `ProductFormPage.test.tsx: duplicate product code error` | duplicate error loses form input or hides actionable message |
| UI-01b-D8 | discontinued color-only | component | `ProductForm.test.tsx: discontinued badge and action label` | discontinued state lacks Japanese text |
| UI-01b-D9 | IME/native drift | manual L3 | `Windows native UI-01b L3` | Japanese input, Tab order, save navigation, discontinued toggle fail in native app |

## Negative Paths

- blank required fields show Japanese field errors and do not call save command.
- price / cost / initial stock non-integer or negative values are blocked before command payload.
- `returnTo=https://...`, `returnTo=/reports/daily`, `returnTo=/products/new`, `returnTo=/products/ABC/edit`, and `returnTo=/products/import` fall back to `/products`.
- `listDepartments` failure blocks save.
- `listSuppliers` failure shows warning but allows save with `supplier_id=null`.
- `getProduct` not found shows recovery instead of blank edit form.
- duplicate create error preserves form state.

## Boundary Checks

- command DTO: `ProductCreateRequest` / `ProductUpdateRequest` generated types match Rust.
- nullable fields: supplier and maker code can be cleared in edit payload.
- enum/string fields: `tax_rate` `"10" | "8" | "0"`, `stock_unit` `"pcs" | "cm"`.
- path/search state: `code` path param, `returnTo` search param.
- integer fields: price, cost, initial stock.
- status state: `is_discontinued` visible through Japanese text, not color only.

## Compatibility Checks

- UI-01a `/products` route and search params remain valid.
- Existing `commands.searchProducts`, `commands.getProduct`, and `commands.listDepartments` generated names remain stable.
- Existing BIZ create/update/toggle tests continue to pass.
- No DB schema/migration change.

## Data Safety Checks

- No real POS CSV, store data, local DB, backups, logs, receipt images, or secrets.
- Tests use synthetic products/departments/suppliers only.
- Product save tests use mocked commands or in-memory DB only.

## Main Wiring / Integration Checks

- `collect_commands!` and `tauri::generate_handler!` include new generated UI-01b commands.
- `cargo run --bin generate_bindings` updates only intended command/type additions.
- `/products/new` and `/products/$code/edit` appear in generated route tree/build.
- Navigation `商品登録` points to `/products/new`; list/table edit action points to `/products/$code/edit`.

## Residual Test Gaps

- inline supplier creation is deferred, so no test is designed here.
- manual product_code creation is deferred because current BIZ DTO does not accept arbitrary product_code.
- cm / m display toggle is deferred; UI-01b only covers `stock_unit='cm'` input/display and POS sync proposal.
