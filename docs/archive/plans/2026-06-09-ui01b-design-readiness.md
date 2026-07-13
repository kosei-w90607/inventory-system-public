# UI-01b 商品登録・修正 Design Readiness Plan

## Risk

Risk: R3

Reason:
UI-01b は operator-facing form、Tauri command DTO / generated binding、route、商品 master 更新、廃番状態、POS 在庫同期フラグ、Windows native 日本語入力に関わる。今回は実装前 Design Phase で source design docs を更新するが、次の implementation PR の runtime contract を決めるため R3 として扱う。

## Goal

REQ-101 / REQ-102 / UI-01b 商品登録・修正の実装前に、route、generated command、supplier/department 候補、JANなし商品コード、edit read-only fields、cm / m 表示切替の扱い、Windows native L3 要否を source design docs へ昇格する。

## Scope

- `docs/function-design/51-ui-product-form.md` を UI-01b Design Phase 基準で更新する。
- `docs/SCREEN_DESIGN.md` に商品登録・修正画面の operator-facing 設計を追加する。
- `docs/function-design/30-biz-product-service.md` に `list_suppliers` BIZ wrapper 設計を追加する。
- `docs/function-design/40-cmd-product.md` に generated command 対象と `list_suppliers` CMD 設計を追加する。
- `docs/architecture/ui-task-specs.md` の古い部門取得記述を `list_departments` / `list_suppliers` に更新する。
- UI-01b implementation 用の Test Design Matrix を作る。

## Non-scope

- Runtime code implementation。
- UI-01b React / route / Rust command の追加。
- inline 新規取引先作成。
- 商品コードの手入力登録。
- edit mode での `stock_unit` / `stock_quantity` 変更。
- cm / m 表示切替 UI。
- dedicated scanner UX / 連続スキャン検知。

## Acceptance Criteria

- `docs/function-design/51-ui-product-form.md` に `UI-01b-D1`〜`UI-01b-D9` があり、why / rejected alternatives が source doc に残っている。
- `docs/SCREEN_DESIGN.md` に商品登録・修正画面があり、route、generated command、JANなし発番、edit read-only、supplier、Windows native L3 が説明されている。
- `docs/function-design/40-cmd-product.md` に `create_product` / `update_product` / `toggle_discontinue` の `#[specta::specta]` 方針と `list_suppliers` CMD が記載されている。
- `docs/function-design/30-biz-product-service.md` に `list_suppliers` BIZ wrapper が記載されている。
- `docs/architecture/ui-task-specs.md` が UI-01b の部門取得を search 経由と書いていない。
- `docs/plans/test-matrices/2026-06-09-ui01b-design-readiness.md` が、次 implementation PR の failure modes を UI-01b decision IDs に結び付けている。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が通る。

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
| Backend function / command / repository / validation / error | `30-biz-product-service.md`, `40-cmd-product.md`, `20-io-product-repo.md` | Updated in this PR: `list_suppliers` BIZ/CMD and generated CRUD command exposure. |
| Command / DTO / generated binding / wire shape | `40-cmd-product.md`, `51-ui-product-form.md` | Updated in this PR: generated `createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers`. |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `db-design/master-tables.md` | Existing sufficient. No schema/migration change. |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `51-ui-product-form.md`, `52-ui-shared-layout.md` | Updated in this PR: route, returnTo, form behavior, errors, L3. |
| CSV / TSV / report / import / export format | None | Intentionally not applicable. |
| Durable decision / ADR | `51-ui-product-form.md`, `SCREEN_DESIGN.md` | Updated in source docs. No separate ADR needed because decisions are UI-01b-local. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-101 / UI-01b | `51-ui-product-form.md §7.1` | UI-01b-D1 | create/edit mode を path で明示。query-only mode は不採用。 | `src/routes/products/new.tsx`, `src/routes/products/$code.edit.tsx` | route mode tests |
| REQ-101 / REQ-102 | `51-ui-product-form.md §7.1` | UI-01b-D2 | `returnTo` は `/products` 一覧 route だけ許可。フォーム / import / 任意遷移は不採用。 | route search validation / save navigation | returnTo safety tests |
| CMD-01 / UI-01b | `51-ui-product-form.md §7.4`, `40-cmd-product.md §5.4` | UI-01b-D3 | generated commands only。ad hoc invoke は不採用。 | Rust specta derives, generated `bindings.ts` | binding diff / typecheck |
| REQ-101 | `51-ui-product-form.md §7.5` | UI-01b-D4 | manual product_code は現 DTO が受けないため不採用。 | create form validation / payload builder | JANあり / JANなし / prefixなし tests |
| REQ-102 / SP-102-04 | `51-ui-product-form.md §7.5` | UI-01b-D5 | edit で code / stock unit / quantity 変更は非 scope。 | edit form read-only fields / update payload | read-only and payload tests |
| REQ-101 / pos_stock_sync | `51-ui-product-form.md §7.5` | UI-01b-D6 | stock_unit だけで同期を決めない。UI提案 + user override。 | stock unit control / pos sync toggle | cm suggestion / override tests |
| REQ-101 / suppliers | `51-ui-product-form.md §7.1`, `30-biz-product-service.md §4.7.1` | UI-01b-D7 | supplier options は complete master data。inline create は deferred。 | `list_suppliers` BIZ/CMD/hook | supplier options tests |
| REQ-101 / REQ-102 | `51-ui-product-form.md §7.6` | UI-01b-D8 | 必須候補と任意候補の失敗を分ける。 | error state rendering | department/supplier/getProduct error tests |
| REQ-101 / REQ-102 | `51-ui-product-form.md §7.8` | UI-01b-D9 | 日本語入力は Windows native L3 が必要。 | L3 checklist / PR evidence | manual L3 evidence |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes. `51-ui-product-form.md` と `SCREEN_DESIGN.md` に route、command、form behavior、deferred scope を記録した。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: generated CRUD command、supplier候補、JANなし商品コード、edit read-only、cm / m defer を source docs に昇格した。
- Assumptions and constraints: UI uses generated commands only; existing BIZ create/update contracts remain; DB schema does not change; supplier inline create is deferred.
- Deferred design gaps, risk, and follow-up target: inline supplier create、manual product_code、edit stock_unit/quantity、cm/m toggle、scanner UX は別 Design Phase。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: backend create/update/toggle and IO suppliers/departments are already specified; DB schema is complete.
- Source docs updated in this PR: `51-ui-product-form.md`, `SCREEN_DESIGN.md`, `30-biz-product-service.md`, `40-cmd-product.md`, `architecture/ui-task-specs.md`。
- Design gaps intentionally deferred: inline supplier create、manual product_code、edit stock unit/quantity、cm/m display toggle、dedicated scanner UX。
- Durable decisions discovered in this plan and promoted to source docs: all UI-01b-D1〜D9 decisions promoted to `51-ui-product-form.md` and summarized in `SCREEN_DESIGN.md`。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI calls generated CMD only; BIZ owns create/update transaction and validation; IO owns master queries.
- Backend function design: `list_suppliers` wrapper added; CRUD commands must be generated in implementation PR.
- Command / DTO / data contract: generated command/type additions are required; `ProductUpdateRequest` remains partial.
- Persistence / transaction / audit impact: implementation PR uses existing BIZ transactions; no schema or migration change.
- Operator workflow / Japanese UI wording: required labels and error messages defined; color-only discontinued state rejected.
- Error, empty, retry, and recovery behavior: department/supplier/product/save error handling defined.
- Testability and traceability IDs: UI-01b-D1〜D9 mapped to tests.

## Test Plan

See `docs/plans/test-matrices/2026-06-09-ui01b-design-readiness.md`.

- targeted tests: route mode, form payload builders, generated binding, supplier/departments hooks, save mutations.
- negative tests: prefixなし部門 + JAN blank、invalid returnTo、getProduct not found、candidate query failures、duplicate save error。
- compatibility checks: existing UI-01a `/products` route and search state remain; existing backend create/update tests remain.
- data safety checks: no real POS/store data; no DB schema/migration; no destructive commands.
- main wiring/integration checks: `collect_commands!`, `generate_handler!`, generated `bindings.ts`, navigation links.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-01b-D1 | route design | route mode tests | create/edit route split | `51-ui-product-form.md §7.2-7.3` |
| UI-01b-D2 | returnTo design | `sanitizeReturnTo` | safe list return path | `51-ui-product-form.md §7.1` |
| UI-01b-D3 | generated command design | `grep-bindings-ui01b-commands` | no ad hoc invoke | `40-cmd-product.md §5.4` |
| UI-01b-D4 | create code design | JAN/prefix validation tests | current BIZ DTO alignment | `51-ui-product-form.md §7.5` |
| UI-01b-D5 | edit field design | edit readonly / payload tests | unsupported field protection | `51-ui-product-form.md §7.5` |
| UI-01b-D6 | POS sync design | cm proposal / override tests | explicit flag preserved | `51-ui-product-form.md §7.5` |
| UI-01b-D7 | supplier candidates | supplier options tests | complete master data | `30-biz-product-service.md §4.7.1` |
| UI-01b-D8 | error recovery | error state tests | required vs optional failure split | `51-ui-product-form.md §7.6` |
| UI-01b-D9 | native verification | Windows native L3 | Japanese input risk | `51-ui-product-form.md §7.8` |

## Data Safety

- Do not commit `.env*`, credentials, local DB files, real POS CSV/PLU TSV/store exports, backups, logs, receipt images, or secrets.
- This Design Readiness PR changes docs only; no runtime DB write, migration, POS/CSV/PLU/report behavior, or local data operation is in scope.
- Future implementation tests must use mocked commands, synthetic fixtures, or in-memory DB only.
- Supplier inline creation and product-code manual creation are deferred to avoid accidental master data mutation without a dedicated design.

## Boundary / Wire Contract

- producer: Rust CMD-01 `create_product`, `update_product`, `toggle_discontinue`, `get_product`, `list_departments`, `list_suppliers`; TanStack Router routes.
- consumer: UI-01b React route/components/hooks and generated `src/lib/bindings.ts`。
- wire type: Tauri typed result `{ status: "ok", data } | { status: "error", error }`; route path/search params.
- internal type: `ProductCreateRequest`, `ProductUpdateRequest`, `ProductWithRelations`, `Department`, `Supplier`, UI form state.
- precision/range: prices and stock are integer yen / integer quantity; frontend sends integer values only.
- round-trip path: `/products/new|$code/edit` -> candidate/product queries -> form -> generated command -> save result -> `/products` return.
- invalid input: route `returnTo` outside the `/products` list route defaults to `/products`; `/products/new`, `/products/$code/edit`, `/products/import`, external URL, and other screen routes are rejected.
- compatibility: additive commands/types; existing `searchProducts`, UI-01a route, DB schema unchanged.

## Review Focus

- Does the design close the generated binding gap for create/update/toggle?
- Does supplier option sourcing avoid current product/current page derivation?
- Is JANなし商品コード behavior aligned with current BIZ DTO?
- Are edit read-only fields aligned with `ProductUpdateRequest` and DB design?
- Is cm / m toggle correctly deferred while still allowing `stock_unit='cm'` creation?
- Are error/recovery paths usable for a non-IT operator?

## Spec Contract

Contract ID: SPEC-UI-01B-DESIGN-READINESS-2026-06-09

- REQ-101 create product form uses existing BIZ create contract and generated command bindings.
- REQ-102 edit product form does not claim unsupported product_code / stock_unit / stock_quantity updates.
- UI-01b supplier and department candidates come from complete master data commands.
- POS stock sync remains an explicit user-controllable flag, with `cm` only as UI proposal.
- Windows native L3 is planned for implementation PR because Japanese form input is in scope.

## Review Response

- review-only sub-agent: P2 1 件、P3 1 件。
- P2 accepted: `returnTo` の許可範囲が広く、`/products/new` や `/products/$code/edit` へ保存後に戻る余地があった。
  - 対応: `returnTo` は `/products` 一覧 route と search params のみ許可し、フォーム route、import route、外部 URL、他画面 route は `/products` に fallback する設計へ修正。
  - 対応: Test Matrix に `/products/new`、`/products/ABC/edit`、`/products/import` を negative case として追加。
- P3 accepted: `SCREEN_DESIGN.md` 最終更新と `architecture/ui-task-specs.md` 用語を UI-01b 商品登録・修正に同期。
