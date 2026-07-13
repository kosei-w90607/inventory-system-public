# UI-01b 商品登録・修正 Implementation Plan

## Risk

Risk: R3

Reason:
UI-01b は operator-facing form、Tauri command DTO / generated binding、商品 master write commands、route、保存後 navigation、廃番状態、Windows native 日本語入力に関わる。DB schema / migration / POS CSV / PLU format は触らないが、runtime contract と利用者操作に影響するため R3。

## Goal

REQ-101 / REQ-102 / UI-01b 商品登録・修正を実装し、UI-01a の商品登録 / 修正導線から create/edit form を開き、generated `commands.*` 経由で商品登録・更新・廃番切替を行える状態にする。

## Scope

- `create_product` / `update_product` / `toggle_discontinue` を tauri-specta generated binding に追加する。
- `list_suppliers` BIZ/CMD を実装し、generated binding に追加する。
- `/products/new` と `/products/$code/edit` route を追加する。
- UI-01a の disabled placeholder を、新規登録 / 修正 route への実導線にする。
- Product form page / components / hooks / payload helpers を実装する。
- Department / supplier options は complete master data commands から取得する。
- Safe `returnTo` は `/products` 一覧 route + search params のみ許可する。
- `stock_unit='cm'` で `pos_stock_sync=false` を提案し、利用者 override を維持する。
- edit mode では `product_code` / `jan_code` / `stock_quantity` / `stock_unit` を read-only にする。
- Tests、generated binding、docs evidence、review-only sub-agent を実施する。

## Non-scope

- inline 新規取引先作成。
- 商品コードの手入力登録。
- edit mode での `stock_unit` / `stock_quantity` 変更。
- cm / m 表示切替 UI。
- dedicated scanner UX / 連続スキャン検知。
- DB schema / migration 変更。
- POS CSV / PLU / report behavior 変更。

## Acceptance Criteria

- `src-tauri/src/biz/product_service.rs` に `list_suppliers(conn: &DbConnection) -> Result<Vec<Supplier>, BizError>` がある。
- `src-tauri/src/cmd/product_cmd.rs` の `create_product` / `update_product` / `toggle_discontinue` / `list_suppliers` が `#[specta::specta]` 対象になっている。
- `src-tauri/src/lib.rs` の `collect_commands!` と `tauri::generate_handler!` に `list_suppliers` が登録されている。
- `src/lib/bindings.ts` に `createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers` と関連型が生成されている。
- `/products/new` と `/products/$code/edit` route が build / typecheck で有効になる。
- UI-01a の `商品登録` と row `修正` が実 route に遷移する。
- `buildCreateProductRequest.test.ts` / `ProductForm.test.tsx: prefix required for JAN blank` で、Create form が JANあり / JANなし自動発番対象部門 / prefixなし部門 validation を区別する。
- `ProductForm.test.tsx: edit readonly fields` / `buildUpdateProductRequest.test.ts` で、Edit form が unsupported fields を read-only にし、update payload に送らない。
- `ProductFormPage.test.tsx: supplier failure allows no-supplier save` / `ProductFormPage.test.tsx: department failure blocks save` で、Supplier failure は warning に留め、supplier 未指定保存を妨げず、Department failure は保存不可にする。
- Safe `returnTo` は `/products` 一覧 route + search params のみ許可し、form/import/external/other route は `/products` に fallback する。
- `cd src-tauri && cargo run --bin generate_bindings` 後、`src/lib/bindings.ts` diff が intended command/type additions に限定される。
- `cd src-tauri && cargo fmt --check`, `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`, `cd src-tauri && cargo test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `bash scripts/doc-consistency-check.sh` が通る。
- `Windows native UI-01b L3` evidence として、実施要否と結果、または実施できない理由が PR body / Plan `Implementation Results` に残る。

## Design Sources

- Requirements / spec: `docs/inventory_system_v2.1.xlsx` REQ-101 / REQ-102, `docs/architecture/ui-task-specs.md` UI-01b
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`, `docs/architecture/biz-task-specs.md`
- Function / command / DTO: `docs/function-design/20-io-product-repo.md`, `docs/function-design/30-biz-product-service.md`, `docs/function-design/40-cmd-product.md`, `docs/function-design/51-ui-product-form.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/master-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/52-ui-shared-layout.md`
- Decision log / ADR: `docs/decision-log.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `30-biz-product-service.md`, `40-cmd-product.md`, `20-io-product-repo.md` | Existing sufficient after PR #93 Design Readiness. |
| Command / DTO / generated binding / wire shape | `40-cmd-product.md`, `51-ui-product-form.md` | Existing sufficient after PR #93. Implementation regenerates binding. |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `db-design/master-tables.md` | Existing sufficient. No schema/migration change. |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `51-ui-product-form.md`, `52-ui-shared-layout.md` | Existing sufficient after PR #93. |
| CSV / TSV / report / import / export format | None | Intentionally not applicable. |
| Durable decision / ADR | `51-ui-product-form.md`, `SCREEN_DESIGN.md` | Existing sufficient. No new ADR expected. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-101 / UI-01b | `51-ui-product-form.md §7.1` | UI-01b-D1 | route split by mode | route files / page mode | route mode tests |
| REQ-101 / REQ-102 | `51-ui-product-form.md §7.1` | UI-01b-D2 | safe list return only | returnTo sanitizer / save nav | returnTo tests |
| CMD-01 / UI-01b | `51-ui-product-form.md §7.4` | UI-01b-D3 | generated commands only | specta / bindings | binding diff / typecheck |
| REQ-101 | `51-ui-product-form.md §7.5` | UI-01b-D4 | no manual code with current DTO | create payload / validation | JAN/prefix tests |
| REQ-102 / SP-102-04 | `51-ui-product-form.md §7.5` | UI-01b-D5 | unsupported edit fields read-only | edit form / update payload | readonly/payload tests |
| REQ-101 / pos_stock_sync | `51-ui-product-form.md §7.5` | UI-01b-D6 | explicit flag with cm proposal | stock unit field | cm override tests |
| REQ-101 / suppliers | `51-ui-product-form.md §7.1` | UI-01b-D7 | complete master data options | listSuppliers hook/select | supplier options tests |
| REQ-101 / REQ-102 | `51-ui-product-form.md §7.6` | UI-01b-D8 | recovery split by required/optional | error states | error recovery tests |
| REQ-101 / REQ-102 | `51-ui-product-form.md §7.8` | UI-01b-D9 | native Japanese input risk | Windows native L3 | manual evidence |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, PR #93 updated source design docs.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none in this implementation planning PR.
- Assumptions and constraints: current BIZ create/update contracts stay; schema unchanged; generated commands only.
- Deferred design gaps, risk, and follow-up target: inline supplier create、manual product_code、edit stock_unit/quantity、cm/m toggle、scanner UX remain deferred.
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: PR #93 closed route, command, supplier, product-code, read-only, error, and L3 decisions.
- Source docs updated in this PR: none planned, unless implementation planning review finds drift.
- Design gaps intentionally deferred: listed in Non-scope.
- Durable decisions discovered in this plan and promoted to source docs: none.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI calls generated commands; CMD thin; BIZ owns write transactions.
- Backend function design: add `list_suppliers` wrapper; expose existing CRUD commands to specta.
- Command / DTO / data contract: generated command/type additions required.
- Persistence / transaction / audit impact: use existing create/update/toggle BIZ behavior; no schema/migration.
- Operator workflow / Japanese UI wording: labels/errors from `51-ui-product-form.md`.
- Error, empty, retry, and recovery behavior: candidate/product/save failures covered.
- Testability and traceability IDs: UI-01b-D1〜D9.

## Test Plan

See `docs/plans/test-matrices/2026-06-09-ui01b-implementation.md`.

- targeted tests: Rust wrapper/binding, route mode, payload helpers, form behavior, save mutation, UI-01a navigation.
- negative tests: unsafe returnTo, prefixなし部門, getProduct not found, option failures, duplicate save error.
- compatibility checks: UI-01a `/products` route/search remains; existing product BIZ tests pass.
- data safety checks: no real data, no DB schema/migration, no destructive operations.
- main wiring/integration checks: command registration, generated binding, route tree/build.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-01b-D1 | routes | route mode tests | route split | `src/routes/products/new.tsx`, `$code.edit.tsx` |
| UI-01b-D2 | returnTo | sanitizer tests | no form/import return | form navigation helper |
| UI-01b-D3 | generated commands | binding diff | no ad hoc invoke | `src/lib/bindings.ts` |
| UI-01b-D4 | create payload | JAN/prefix tests | DTO alignment | create request builder |
| UI-01b-D5 | edit payload | readonly/payload tests | unsupported fields | edit form |
| UI-01b-D6 | stock unit | cm proposal tests | user override | stock unit field |
| UI-01b-D7 | suppliers | listSuppliers tests | complete options | options hook |
| UI-01b-D8 | recovery | error tests | required/optional split | page states |
| UI-01b-D9 | native | L3 evidence | IME/focus/save | PR evidence |

## Data Safety

- Do not commit `.env*`, credentials, local DB files, real POS CSV/PLU TSV/store exports, backups, logs, or receipt images.
- Use mocked commands, synthetic fixtures, or in-memory DB only.
- No migration, backup restore, POS CSV, PLU export, or real store data operation is in scope.
- Product master write behavior is tested against synthetic data only.

## Boundary / Wire Contract

- producer: Rust CMD-01 commands and TanStack Router.
- consumer: UI-01b React route/components/hooks and generated `src/lib/bindings.ts`.
- wire type: Tauri typed result and route path/search params.
- internal type: `ProductCreateRequest`, `ProductUpdateRequest`, `ProductWithRelations`, `Department`, `Supplier`, UI form state.
- precision/range: integer yen and integer stock quantity.
- round-trip path: route -> option/product queries -> form -> generated command -> success -> safe `/products` return.
- invalid input: frontend blocks invalid form values; route sanitizer rejects unsafe return targets.
- compatibility: additive commands/types; existing search/list behavior unchanged.

## Review Focus

- generated command/type exposure is complete and additive.
- UI does not use ad hoc invoke.
- Product code behavior matches current create DTO.
- Edit form does not imply unsupported stock/code changes.
- Supplier failure does not block no-supplier save.
- Return navigation cannot loop back to form/import route.
- Windows native L3 evidence is recorded or explicitly deferred with reason.

## Spec Contract

Contract ID: SPEC-UI-01B-IMPLEMENTATION-2026-06-09

- REQ-101 create product form saves through generated `createProduct`.
- REQ-102 edit product form saves through generated `updateProduct` and toggles discontinued state through generated `toggleDiscontinue`.
- UI-01b uses complete master data commands for departments and suppliers.
- UI-01b does not expose unsupported product code / stock unit / stock quantity edits.
- UI-01b safe return target is the product list route only.

## Review Response

Planning PR review:

- review-only sub-agent: P2 1 件、P3 1 件。
- P2 accepted: Rust / bindings gate が repo root 起点の `cargo ...` 表記になっていた。
  - 対応: `cd src-tauri && cargo ...` / `cd src-tauri && cargo run --bin generate_bindings` に修正。
- P3 accepted: Test Matrix に `list_suppliers` の BIZ/CMD/runtime/generated wiring check が不足していた。
  - 対応: `list_suppliers_wiring_review` 行を追加し、`product_cmd::list_suppliers`、`collect_commands!`、`generate_handler!`、`bindings.ts listSuppliers` をまとめて確認する観点を追加。

Implementation review:

- review-only sub-agent: P2 1 件。
- P2 accepted: `ProductUpdateRequest` の `Option<Option<T>>` field で、JSON の field omitted と explicit `null` が区別されず、取引先 / メーカー品番の clear が DB 更新へ届かない恐れがあった。
  - 対応: Rust DTO に custom deserializer を追加し、missing は `None`、`null` は `Some(None)`、値は `Some(Some(value))` として扱う。`specta` は deserialize 用 generated type に optional nullable field を出すよう明示。
  - 対応: frontend の update builder は差分 patch として扱い、変更なし field は omitted、clear field は `null` を送る。serde test と frontend payload test で確認。
- review-only verification pass: P1/P2 なし、P3 2 件。
- P3 accepted: edit mode で既存 `supplier_id` がある場合、取引先候補取得失敗の warning が表示されない。
  - 対応: `suppliersQuery.isError` 時は supplier selected 状態に関係なく warning を表示する。
- P3 accepted: Test Matrix にある `edit not found` 復旧分岐の frontend test が不足していた。
  - 対応: `ProductFormPage.test.tsx` に edit target not found の alert / list return test を追加。

## Implementation Results

Status: implementation fixed after review-only P2/P3 on `feat/ui01b-product-form`; final gates passed / PR pending.

Implemented:

- `ProductCreateRequest` / `ProductCreateResult` / `ProductUpdateRequest` / `ProductUpdateResult` / `Supplier` を `specta::Type` 対象にし、`createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers` を generated binding に追加。
- `list_suppliers` BIZ wrapper / CMD wrapper / runtime `generate_handler!` / `collect_commands!` wiring を追加。
- `/products/new` と `/products/$code/edit` route、`ProductFormPage`、`ProductForm`、`StockUnitField`、`useProductFormOptions`、`returnTo` sanitizer、create/update payload builder を追加。
- UI-01a の `商品登録` / row `修正` placeholder を、safe `returnTo` 付き route link に変更。
- JANなし + prefixなし部門 validation、edit read-only fields、cm POS sync proposal + override、supplier failure warning、department failure save block、duplicate save error recovery をテストで確認。
- `update_product` の nullable update field は missing / `null` / value を区別し、取引先 / メーカー品番 clear を command boundary で保持する。

Validation so far:

- `cargo test test_list_suppliers_req101_biz_wrapper_returns_all_suppliers`
- `cargo test test_update_product_req102_deserialize_nullable_clear_fields`
- `npm test -- src/features/products/ProductFormPage.test.tsx`
- `cd src-tauri && cargo run --bin generate_bindings`
- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
- `cd src-tauri && cargo test`
- `npm test -- src/features/products`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`（48 files / 275 tests）
- `npm run build`（Vite chunk size warning only）
- `bash scripts/doc-consistency-check.sh --target plan`
- `bash scripts/doc-consistency-check.sh`
- `git diff --check`

Pending:

> 注記: 下記の目視確認リストは、同 PR #95 に追加した画面デザイン polish（[plans/2026-06-12-ui01b-polish.md](2026-06-12-ui01b-polish.md)）により superseded された。最新の統合 L3 目視確認リスト（旧 6 項目 + polish 7 項目 = 13 項目）は PR #95 body を参照する。

- PR #95 CI green confirmation
- Human visual confirmation before merge:
  - target: `/products/new`, `/products/$code/edit`, UI-01a `商品登録` / row `修正` route link
  - check: happy path layout, Japanese labels, read-only fields, warning/error states, save/cancel/toggle button visibility
  - status: pending owner visual check
- Windows native UI-01b L3: not executed in this PR automation. IME, Tab movement, save navigation, discontinued/active state visibility remain manual check targets before merge or explicitly accepted deferral.
