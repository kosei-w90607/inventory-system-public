# UI-01a 商品検索・一覧 Implementation Plan

## Risk

Risk: R3

Reason:
UI-01a は operator-facing route/search state、Tauri command binding、Rust CMD/BIZ wiring、generated `src/lib/bindings.ts`、pagination、filter/select control を同時に触る。DB schema / migration / POS data は触らないが、runtime contract と利用者操作に影響するため R3。

## Goal

REQ-103 / UI-01a 商品検索・一覧を実装し、商品管理の入口として初期表示、検索、部門絞込み、廃番 mode、sort、pagination、新規/修正導線を使える状態にする。

## Scope

- `list_departments` BIZ/CMD を実装し、tauri-specta の generated binding に追加する。
- `/products` route と UI-01a feature を実装する。
- `commands.searchProducts(query)` と `commands.listDepartments()` を TanStack Query + `unwrapResult` で呼び出す。
- URL search params `q`, `dept`, `discontinued`, `sort`, `dir`, `page`, `perPage` を実装する。
- DepartmentFilter は departments 全件を候補にし、検索結果の現在ページから候補を派生しない。
- pagination は `total_count`, `page`, `per_page` を使い、`perPage` は 50 / 100 / 200 の選択式にする。
- UI-01a の frontend/Rust tests と docs gate を追加・実行する。

## Non-scope

- UI-01b 商品登録・修正 form の実装。
- DB schema / migration 変更。
- 商品作成・更新・廃番切替の runtime 変更。
- cm / m 表示切替 UI。
- 専用バーコードスキャン UX / 連続スキャン検知。
- `DepartmentFilter` / `DepartmentOption` の feature 間共通化。
- CSV / PLU / report 出力変更。

## Acceptance Criteria

- `src-tauri/src/biz/product_service.rs` に `pub fn list_departments(conn: &DbConnection) -> Result<Vec<Department>, BizError>` があり、`product_repo::list_departments` を薄く呼ぶ。
- `src-tauri/src/cmd/product_cmd.rs` に `#[tauri::command] #[specta::specta] pub fn list_departments(...) -> Result<Vec<Department>, CmdError>` がある。
- `src-tauri/src/lib.rs` の `collect_commands!` と `tauri::generate_handler!` に `cmd::product_cmd::list_departments` が登録されている。
- `src/lib/bindings.ts` に `commands.listDepartments` と `Department` 型が生成され、`commands.searchProducts` 既存契約が壊れていない。
- `src/routes/products/index.tsx` が `validateSearch` で URL search params を受け、無効値を safe default に補正する。
- UI-01a の初期 query payload が `keyword=null`, `department_id=null`, `is_discontinued=false`, `sort_key=\"ProductCode\"`, `sort_order=\"Asc\"`, `page=1`, `per_page=50` になる。
- 部門候補 test が `commands.listDepartments()` 由来の候補を検証し、`searchProducts().items` から候補を作る実装では失敗する。
- pagination test が page change では filter を維持し、filter/sort/perPage change では `page=1` に戻ることを検証する。
- `cargo run --bin generate_bindings` 後、`src/lib/bindings.ts` diff が command/type 追加に限定される。
- `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `bash scripts/doc-consistency-check.sh` が通る。

## Design Sources

- Requirements / spec: `inventory_system_v2.1.xlsx` REQ-103, `docs/architecture/ui-task-specs.md` UI-01a
- Architecture: `docs/ARCHITECTURE.md`, `docs/UI_TECH_STACK.md`, `docs/project-profile.md`
- Function / command / DTO: `docs/function-design/20-io-product-repo.md`, `docs/function-design/30-biz-product-service.md §4.6-4.7`, `docs/function-design/40-cmd-product.md §5.4`, `docs/function-design/50-ui-product-list.md`
- DB: `docs/DB_DESIGN.md` departments / products
- Screen / UI: `docs/SCREEN_DESIGN.md` 商品検索・一覧画面, `docs/function-design/50-ui-product-list.md §50.3-50.7`
- Decision log / ADR: `docs/decision-log.md`, `docs/DEV_WORKFLOW.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `30-biz-product-service.md §4.7`, `40-cmd-product.md §5.4`, `20-io-product-repo.md list_departments/search_products` | Existing sufficient. Implementation follows thin wrapper design. |
| Command / DTO / generated binding / wire shape | `50-ui-product-list.md §50.5`, `ProductSearchQuery`, generated `commands.searchProducts`, future `commands.listDepartments` | Existing sufficient. Binding regeneration is in implementation scope. |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md` departments/products; IO `list_departments` read-only | Existing sufficient. No schema, TX, audit, or migration change. |
| Screen / UI / route state / Japanese wording | `50-ui-product-list.md §50.3-50.7`, `SCREEN_DESIGN.md` 商品検索・一覧画面 | Existing sufficient. |
| CSV / TSV / report / import / export format | None | Intentionally not applicable. |
| Durable decision / ADR | `50-ui-product-list.md §50.2` UI-01a-D1 through D7 | Existing sufficient. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-103 / UI-01a | `50-ui-product-list.md §50.2` | UI-01a-D1 | 商品管理入口は active products を初期表示する。検索前 blank は不採用。 | `ProductListPage`, search query builder | `ProductListPage.test.tsx` initial payload |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.4` | UI-01a-D2 | URL state で F5/repro/review stability を保つ。local-only state は不採用。 | `src/routes/products/index.tsx` | route search defaults/invalid correction test |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.5` | UI-01a-D3 | 検索は既存 `searchProducts` を使う。検索用新 CMD は不採用。 | `useProductList` / query builder | payload mapping test |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.2` | UI-01a-D4 | 4000 products に備え pagination を実装する。hidden truncation は不採用。 | `ProductPagination` | page/perPage reset/preserve tests |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.6` | UI-01a-D5 | HID scanner は keyboard input として扱う。専用 scanner UX は deferred。 | `ProductSearchBar` | Enter search test |
| REQ-103 / SP-103-08 | `50-ui-product-list.md §50.2` | UI-01a-D6 | 単位付き在庫表示は行い、cm/m toggle は deferred。 | `ProductTable` | unit display / no false toggle test |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.2` | UI-01a-D7 | 部門候補は master data 全件。current page `items` 派生は不採用。 | `list_departments`, `DepartmentFilter` | department full-list option test |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes. `50-ui-product-list.md` と BIZ/CMD docs に実装判断がある。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none in this PR. This Plan Packet only references existing source docs.
- Assumptions and constraints: UI keeps `UI -> CMD -> BIZ -> IO/MNT`; command errors use `CmdError`; searchProducts `per_page` max remains 200; departments initial data is the complete option source.
- Deferred design gaps, risk, and follow-up target: UI-01b route/form, cm/m toggle, dedicated scanner UX, shared DepartmentFilter are deferred to separate Design Phase / backlog.
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: PR #88 produced UI-01a-D1 through D7, URL state, command mapping, Department option source, pagination, display/error behavior, and BIZ/CMD wrapper design.
- Source docs updated in this PR: none planned unless implementation discovers design ambiguity.
- Design gaps intentionally deferred: UI-01b, cm/m toggle, dedicated scanner UX, cross-feature DepartmentFilter sharing.
- Durable decisions discovered in this plan and promoted to source docs: none yet.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI calls generated `commands.*`; CMD thin wrapper; BIZ thin wrapper for list; IO owns DB query.
- Backend function design: `search_products` exists; `product_repo::list_departments` exists; BIZ/CMD wrapper implementation needed.
- Command / DTO / data contract: `ProductSearchQuery`, `SortKey`, `SortOrder`, `Department`, `PaginatedResult<ProductWithRelations>`, generated binding update required.
- Persistence / transaction / audit impact: read-only `list_departments` and search/list UI. No transaction, audit, schema, migration change.
- Operator workflow / Japanese UI wording: active list default, Japanese labels, color-not-only discontinued status.
- Error, empty, retry, and recovery behavior: list area handles loading/empty/error; controls remain editable; retry/condition change re-runs query.
- Testability and traceability IDs: UI-01a-D1 through D7.

## Test Plan

See `docs/plans/test-matrices/2026-06-09-ui01a-implementation.md`.

- targeted tests: Rust BIZ/CMD wrapper, binding generation diff, route search parsing, query payload mapping, DepartmentFilter, pagination, table display, error/empty/loading.
- negative tests: invalid search params, `page=0`, invalid `perPage`, invalid `sort/dir/discontinued`, department options not derived from result page.
- compatibility checks: existing `searchProducts` wrapper remains; existing UI-06a stock inquiry tests still pass; generated binding names remain stable except `listDepartments` addition.
- data safety checks: no real POS/store data; no `.env*`; no DB deletion/migration.
- main wiring/integration checks: `collect_commands!`, `generate_handler!`, route registration, queryKeys, `unwrapResult` path.

## Boundary / Wire Contract

- producer: Rust CMD `search_products` / `list_departments`, TanStack Router search params
- consumer: `src/features/products/*`, generated `src/lib/bindings.ts`, TanStack Query
- wire type: Tauri command typed result `{ status: \"ok\", data } | { status: \"error\", error }`; browser search params strings
- internal type: `ProductSearchQuery`, `Department`, `PaginatedResult<ProductWithRelations>`, UI search state
- precision/range: `page >= 1`; `perPage` 50 / 100 / 200; Rust i64 department id and prices remain within JS safe integer for seeded/master data
- round-trip path: URL params -> validateSearch -> query builder -> `commands.searchProducts` -> `items/total_count` -> pagination -> URL update
- invalid input: invalid URL values are caught/defaulted by route schema; invalid command result surfaces as UI error
- compatibility: `searchProducts` DTO and IO clamp policy unchanged; `listDepartments` is additive command

## Review Focus

- `list_departments` is wired through CMD/BIZ/bindings without bypassing layers.
- Department options come from `commands.listDepartments()`, not current search results.
- URL state mapping exactly matches `SortKey` / `SortOrder` generated enum values.
- Pagination reset/preserve behavior matches `50-ui-product-list.md §50.4`.
- Generated binding diff is additive and reviewed.
- Tests cover D1-D7 and do not depend on real data.

## Spec Contract

Contract ID: SPEC-UI-01A-IMPLEMENTATION-2026-06-09

- REQ-103 product list starts with active products and supports keyword, department, discontinued mode, sort, and pagination.
- UI-01a-D7 department options are complete master data options from `list_departments`.
- `searchProducts` payload remains within existing IO contract: `per_page` 50 / 100 / 200, max 200.
- `listDepartments` command is additive and read-only.
- Route state is reproducible through URL search params.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-01a-D1 | initial search query | `ProductListPage.test.tsx` initial payload | default active listing | `is_discontinued=false`, `page=1`, `per_page=50` |
| UI-01a-D2 | route search state | route/search tests | invalid URL safety | `q/dept/discontinued/sort/dir/page/perPage` defaults |
| UI-01a-D3 | search command payload | query builder/component tests | enum and null mapping | `SortKey.ProductCode`, `SortOrder.Asc`, null keyword/dept |
| UI-01a-D4 | pagination | `ProductPagination` / page tests | reset/preserve behavior | page changes preserve filters; filter changes reset page |
| UI-01a-D5 | search input | `ProductSearchBar.test.tsx` | HID-compatible Enter flow | Enter updates `q` and page reset |
| UI-01a-D6 | table display | `ProductTable.test.tsx` | unit + discontinued readability | unit text and Japanese badge |
| UI-01a-D7 | departments | Rust + frontend tests | complete option source | `listDepartments` command called; current items ignored |
| CMD-01 | command wiring | Rust tests / generated binding diff | layer boundary | CMD -> BIZ -> IO |

## Data Safety

- Do not commit `.env*`, credentials, local DB files, real POS CSV/PLU TSV/store exports.
- Use repo test fixtures / in-memory test DB only.
- Generated output allowed: `src/lib/bindings.ts` after `cargo run --bin generate_bindings`.
- Local-only paths: app data directories, demo DBs, screenshots not requested for this PR.

## Implementation Results

- `list_departments` を BIZ/CMD の thin wrapper として追加し、`collect_commands!` / `tauri::generate_handler!` に登録した。
- `Department` に `specta::Type` を付与し、`cargo run --bin generate_bindings` で `src/lib/bindings.ts` に `commands.listDepartments()` と `Department` 型を追加した。binding diff は command/type 追加のみ。
- `/products` route、`ProductListPage`、`useProductList`、`ProductSearchBar`、`DepartmentFilter`、`ProductPagination`、`ProductTable` を追加し、navigation の UI-01a を active にした。
- URL search params `q`, `dept`, `discontinued`, `sort`, `dir`, `page`, `perPage` を `ProductSearchQuery` へ変換する `search.ts` を追加した。
- Department options は `commands.listDepartments()` 由来だけを使い、`searchProducts().items` から候補を派生しない。
- `perPage` は 50 / 100 / 200 のみ。filter / sort / perPage change は `page=1` に reset し、page change は filters を維持する。
- UI-01b 商品登録・修正 route は引き続き非 scope。UI-01a 上の登録 / 修正 action は disabled placeholder として、実装済み導線には見せない。

Validation:

- `cargo test test_list_departments_req103_biz_wrapper_returns_all_departments` -> pass
- `cargo test --test design_compliance_test` -> pass
- `cargo test --test architecture_test` -> pass
- `cargo run --bin generate_bindings` -> pass
- `cargo fmt --check` -> pass
- `cargo clippy --all-targets --all-features -- -D warnings` -> pass
- `cargo test` -> pass（557 unit + 2 integration + 8 seed + doc-tests 0）
- `npm run typecheck` -> pass
- `npm run lint` -> pass
- `npm run format:check` -> pass
- `npm test -- src/features/products` -> pass（6 files / 14 tests）
- `npm test` -> pass（43 files / 261 tests）
- `npm run build` -> pass（Vite chunk size warning は既存系の build warning）
- `bash scripts/doc-consistency-check.sh --target plan` -> pass
- `bash scripts/doc-consistency-check.sh` -> pass

## Review Response

- review-only sub-agent: P1/P2 なし。P3 1 件（`listDepartments` 失敗時の部門フィルタ error 表示が Test Matrix の negative path とずれている）を accepted。
- 対応: 商品検索 controls と product list は維持したまま、部門取得失敗時に「部門一覧の取得に失敗しました」を表示する。`ProductListPage.test.tsx` に failure path test を追加。
- 対応後 validation:
  - `npm test -- src/features/products` -> pass（6 files / 14 tests）
  - `npm run typecheck` -> pass
  - `npm run lint` -> pass
  - `npm run format:check` -> pass
