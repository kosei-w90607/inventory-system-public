# Test Design Matrix: UI-01a 商品検索・一覧 Implementation

## Risk

Risk: R3

## Contracts Under Test

- UI-01a-D1: 初期表示は active products search を実行する。
- UI-01a-D2: URL search params が UI state と command payload を再現する。
- UI-01a-D3: `commands.searchProducts` payload が `ProductSearchQuery` / generated enum と一致する。
- UI-01a-D4: pagination は `total_count`, `page`, `per_page` を正として扱う。
- UI-01a-D5: 検索欄 Enter は HID keyboard input と同じ経路で検索を確定する。
- UI-01a-D6: 在庫数は単位付きで表示し、cm/m toggle を実装済みに見せない。
- UI-01a-D7: 部門候補は `commands.listDepartments()` 由来の complete master data である。
- CMD-01: `list_departments` は CMD -> BIZ -> IO の thin read-only wrapper である。

## Failure Modes

- 初期表示が blank / disabled になり、`searchProducts` が呼ばれない。
- URL search params の invalid value が command payload に流れる。
- URL `sort=product_code` が Rust enum `"ProductCode"` に変換されない。
- 部門候補を `searchProducts().items` から作り、現在ページにない部門が消える。
- `perPage` 200 超や `page=0` が UI から送られる。
- filter/sort/perPage change で page reset されない。
- page change で filters が失われる。
- generated binding に `listDepartments` が出ず、UI が untyped invoke や ad hoc wrapper を使う。
- CMD/BIZ が IO を迂回する、または DB write/audit/migration を混ぜる。
- Error/empty/loading state が controls を消して復旧できない。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| CMD-01 list_departments | BIZ wrapper missing or wrong result | Rust unit/integration | `test_list_departments_req103_biz_wrapper_returns_all_departments` | BIZ does not call `product_repo::list_departments` or returns partial departments |
| CMD-01 list_departments | CMD does not normalize errors / command missing | Rust unit/review | `test_list_departments_req103_cmd_signature_and_error_shape` | CMD lacks `#[specta::specta]`, returns wrong type, or bypasses BIZ |
| Generated binding | `listDepartments` not exported | generated diff/review | `grep-bindings-list-departments` | `src/lib/bindings.ts` lacks `commands.listDepartments` or `Department` |
| UI-01a-D1 | initial list is blank | frontend component | `ProductListPage.test.tsx: initial active query` | initial render does not call `searchProducts` with active defaults |
| UI-01a-D2 | URL invalid value leaks | frontend route/unit | `products route search default test` | invalid `page/perPage/sort/dir/discontinued/dept` reaches payload |
| UI-01a-D3 | enum/null mapping drift | frontend unit | `buildProductSearchQuery.test.ts` | URL values do not map to `"ProductCode"` / `"Asc"` / nulls |
| UI-01a-D4 | pagination math drift | frontend component | `ProductPagination.test.tsx` | total pages, disabled states, page selection, or perPage options are wrong |
| UI-01a-D4 | filter changes do not reset page | frontend component | `ProductListPage.test.tsx: filter reset page` | q/dept/discontinued/sort/perPage updates keep stale `page` |
| UI-01a-D4 | page change drops filters | frontend component | `ProductListPage.test.tsx: page preserves filters` | page navigation clears q/dept/discontinued/sort/perPage |
| UI-01a-D5 | Enter does not search | frontend component | `ProductSearchBar.test.tsx` | Enter key does not update `q` / reset page |
| UI-01a-D6 | unit/status unreadable | frontend component | `ProductTable.test.tsx` | stock unit missing or discontinued shown by color only |
| UI-01a-D7 | department options incomplete | frontend component | `ProductListPage.test.tsx: departments from listDepartments` | options are derived from current `searchProducts` page |
| Error/empty/loading | recovery impossible | frontend component | `ProductListPage.test.tsx: error empty loading` | controls disappear or retry/condition change cannot re-run |
| Existing UI-06a | additive command breaks existing search | regression | existing `stock-inquiry` tests | `commands.searchProducts` wrapper or ProductSearchQuery type changes incompatibly |

## Negative Paths

- missing input: blank `q` maps to `keyword=null`, not empty-string keyword search.
- invalid input: invalid URL `page`, `perPage`, `sort`, `dir`, `discontinued`, `dept` are defaulted or dropped before command payload.
- duplicate/ambiguous input: repeated URL params use router/schema behavior; command receives a single normalized value.
- unknown reference: unknown `dept` id can be sent as `department_id`; backend search returns empty, while DepartmentFilter options still come from master data.
- dependency missing: `listDepartments` command failure shows error without breaking product search controls.
- permission/write failure: not applicable; read-only commands only.
- dry-run side effect: not applicable.

## Boundary Checks

- threshold: `perPage` only 50 / 100 / 200; never 201+ from UI.
- null/default: blank `q`, absent `dept`, active discontinued mode.
- empty/non-empty: zero results empty state; non-empty table; departments can render even when product results empty.
- min/max: `page` min 1; last page from `total_count`.
- status/policy enum: `active` / `all` / `discontinued` -> `false` / `null` / `true`.
- wire type: Tauri typed result via generated `commands.*`.
- internal type: URL strings to `ProductSearchQuery`.
- producer/consumer: Rust CMD producer, generated TS wrapper consumer, React query consumer.
- round-trip token: URL state -> command payload -> table/pagination -> URL update.
- precision/range: department id / prices are JS numbers within seeded master data range.
- cross-language parse: Rust enum strings `"ProductCode"`, `"Name"`, `"StockQuantity"`, `"SellingPrice"`, `"Asc"`, `"Desc"`.

## Compatibility Checks

- old schema/input: no DB schema change; existing `searchProducts` DTO remains.
- new schema/input: additive `listDepartments` command in generated binding.
- output order: department options ordered by `id ASC`; product sorting follows `sort/dir`.
- optional field behavior: `keyword`, `department_id`, `is_discontinued` null behavior preserved.

## Data Safety Checks

- source-derived data: use in-memory test DB / existing seed helpers only.
- generated outputs: `src/lib/bindings.ts` reviewed after `cargo run --bin generate_bindings`.
- secrets: do not read or commit `.env*`, credentials, certs, auth files.
- local-only files: do not commit local app DB, POS/store data, screenshots unless explicitly requested.
- synthetic sample boundaries: frontend tests use mock products/departments only.

## Main Wiring / Integration Checks

- helper connected to main path: `ProductListPage` uses generated `commands.searchProducts` and `commands.listDepartments`.
- output reaches manifest/report: not applicable.
- effective config reaches runtime: `src/routes/products/index.tsx` is file route and appears in route tree/build.
- CLI arg reaches implementation: not applicable.
- command registration reaches runtime: `collect_commands!` and `generate_handler!` both include `list_departments`.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? discontinued mode mapping test fails when active/all/discontinued maps incorrectly.
- If a threshold comparison changes, which test fails? perPage option and payload tests fail if 200 max is exceeded.
- If a guard is removed, which test fails? invalid URL default test fails when `page=0` or invalid enum reaches payload.
- If an output field is omitted, which test fails? table/pagination tests fail when `items` or `total_count` is ignored.
- If output order changes, which test fails? department order test and sort payload/render tests fail.
- If dry-run performs a side effect, which test fails? not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? not expected for current master data; review generated types and fixture ranges.
- If a state token is round-tripped through browser/client code, which test fails? route/search state and page preserve/reset tests fail.

## Residual Test Gaps

- Windows native L3 is not part of this Plan PR; UI implementation PR should decide whether operator-facing smoke check is needed before merge.
- Exact UI-01b edit/new route target may remain a navigation placeholder until UI-01b Design Phase; reviewers should ensure it does not claim UI-01b is implemented.
