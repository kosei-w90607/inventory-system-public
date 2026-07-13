# UI-01a Design Readiness Trial

## Risk

Risk: R3

Reason:
Design workflow / source-of-truth docs の変更であり、runtime 変更はない。ただし Phase 3 商品管理の実装前提を作るため、設計意図・trace・workflow dogfood の欠落は後続 PR に波及する。

## Goal

新しく追加した Design Phase を UI-01a 商品検索・一覧に適用し、実装前に必要な設計成果物を選別・更新・trace できることを確認する。

## Scope

- PR #87 の完了済み active plan / test matrix を archive へ移送する。
- UI-01a 商品検索・一覧の durable function design を現行 frontend / CMD 契約に合わせて更新する。
- `SCREEN_DESIGN.md` に商品検索・一覧画面の判断ログを追加する。
- `FUNCTION_DESIGN.md` の UI-01a summary を旧 `pages/` 前提から Phase 3 readiness 前提へ更新する。
- `Plans.md` と `PROJECT_HANDOFF.md` を現在状態へ最小同期する。
- この Plan Packet と Test Design Matrix に Design Phase の dogfood evidence を残す。

## Non-scope

- UI-01a runtime 実装。
- Tauri command / Rust backend / DB schema / generated bindings の変更。
- UI-01b 商品登録・修正 route の確定。
- SP-103-08 cm / m 表示切替 UI の実装。
- GitHub push / PR / merge 操作。

## Acceptance Criteria

- `docs/archive/plans/2026-06-09-design-phase-workflow.md` と `docs/archive/plans/test-matrices/2026-06-09-design-phase-workflow.md` が存在し、active `docs/plans/` 側に同名ファイルが残っていない。
- `docs/function-design/50-ui-product-list.md` に `UI-01a-D1` から `UI-01a-D7` までの Design Intent Trace がある。
- `docs/function-design/50-ui-product-list.md` に `commands.searchProducts(query: ProductSearchQuery)`、`commands.listDepartments()`、URL state、`perPage` 50 / 100 / 200、廃番 mode mapping、sort enum mapping が記載されている。
- `docs/SCREEN_DESIGN.md` の画面一覧で 商品検索・一覧 が `設計更新済み / 実装未着手` になっている。
- `docs/SCREEN_DESIGN.md` に `商品検索・一覧画面` の設計判断ログがある。
- `docs/FUNCTION_DESIGN.md` の UI-01a summary が旧 `pages/products/` 更新予定ではなく、Design Phase 更新済みの `function-design/50-ui-product-list.md` を指す。
- `docs/Plans.md` の現在の基準が PR #87 `ef0fd73` を含み、UI-01a design readiness が active work として記録されている。
- `docs/PROJECT_HANDOFF.md` が最新状態を `Plans.md` 優先としつつ、Design Phase workflow merge と UI-01a Design Readiness Trial を現在作業として示している。
- `bash scripts/doc-consistency-check.sh` が通過する、または docs-only 既知 WARN/ERROR を明示する。

## Design Sources

- Requirements / spec: `inventory_system_v2.1.xlsx` REQ-103, `docs/architecture/ui-task-specs.md` UI-01a
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`
- Function / command / DTO: `docs/function-design/20-io-product-repo.md`, `docs/function-design/30-biz-product-service.md`, `docs/function-design/40-cmd-product.md`, `docs/function-design/50-ui-product-list.md`
- DB: `docs/DB_DESIGN.md` products / departments / suppliers
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/58-ui-stock-inquiry.md`
- Decision log / ADR: `docs/decision-log.md`, `docs/DEV_WORKFLOW.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `20-io-product-repo.md`, `30-biz-product-service.md`, `40-cmd-product.md` | Updated in this PR. `search_products` exists; department options require new thin `list_departments` BIZ/CMD design before runtime implementation. |
| Command / DTO / generated binding / wire shape | `ProductSearchQuery`, `PaginatedResult<ProductWithRelations>`, generated `commands.searchProducts`, future generated `commands.listDepartments` | Updated in this PR as design only. Runtime implementation and binding regeneration are deferred to the UI-01a implementation PR. |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md` product master tables | Existing sufficient. No persistence change. |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `50-ui-product-list.md`, `UI_TECH_STACK.md` URL state rules | Updated in this PR. |
| CSV / TSV / report / import / export format | None for UI-01a list | Intentionally not applicable. |
| Durable decision / ADR | `50-ui-product-list.md` Design Intent Trace | Updated in this PR. ADR not needed because no cross-project architectural choice. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-103 / UI-01a | `50-ui-product-list.md §50.2` | UI-01a-D1 | Product management entry shows active products by default; do not copy UI-06a search-driven no-results start. | `ProductListPage`, route defaults | Default query payload test |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.4` | UI-01a-D2 | URL state gives F5/repro/review stability; local-only state rejected. | `src/routes/products/index.tsx` validateSearch | URL default / invalid value tests |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.5` | UI-01a-D3 | Existing command covers search/filter/sort/paging; new CMD rejected. | `commands.searchProducts` call | Payload mapping test |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.2` | UI-01a-D4 | 4000-product list needs paging; hidden truncation rejected. | Pagination component | page/perPage tests |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.6` | UI-01a-D5 | HID scanner acts as keyboard input; dedicated scanner UX deferred. | Search input Enter behavior | Enter search test |
| SP-103-08 | `50-ui-product-list.md §50.2` | UI-01a-D6 | Unit display is required; cm/m toggle needs separate design before implementation. | Table stock display | Unit display / no false toggle test |
| REQ-103 / UI-01a | `50-ui-product-list.md §50.2` | UI-01a-D7 | Full department options must not depend on current search page; deriving options from `items` rejected. | `commands.listDepartments` + DepartmentFilter | Department options full-list test |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, after `50-ui-product-list.md` and `SCREEN_DESIGN.md` updates.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-01a-D1 through D7 promoted to `50-ui-product-list.md`; department command design promoted to `30-biz-product-service.md` / `40-cmd-product.md`; screen wording promoted to `SCREEN_DESIGN.md`.
- Assumptions and constraints: existing `search_products` contract remains stable; UI uses generated command binding; no backend or DB changes.
- Deferred design gaps, risk, and follow-up target: UI-01b route/form design, cm/m toggle, dedicated scanner UX, department filter sharing.
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: backend product search contract already covers search/filter/sort/paging and `per_page` clamp.
- Source docs updated in this PR: `docs/function-design/30-biz-product-service.md`, `docs/function-design/40-cmd-product.md`, `docs/function-design/50-ui-product-list.md`, `docs/FUNCTION_DESIGN.md`, `docs/SCREEN_DESIGN.md`.
- Design gaps intentionally deferred: UI-01b route/form, cm/m toggle UI, dedicated scanner UX.
- Durable decisions discovered in this plan and promoted to source docs: UI-01a-D1 through D7.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI calls existing CMD only; no UI business rule or DB access.
- Backend function design: existing `search_products` is sufficient for product results; `list_departments` BIZ/CMD design is added for complete department options.
- Command / DTO / data contract: `ProductSearchQuery`, `PaginatedResult<ProductWithRelations>`, `SortKey` / `SortOrder` mapping, and future `commands.listDepartments` are documented.
- Persistence / transaction / audit impact: none.
- Operator workflow / Japanese UI wording: active list default, Japanese discontinued labels, color-not-only status documented.
- Error, empty, retry, and recovery behavior: documented in `50-ui-product-list.md §50.7`.
- Testability and traceability IDs: UI-01a-D1 through D7.

## Test Plan

Test Design Matrix: [test-matrices/2026-06-09-ui01a-design-readiness.md](test-matrices/2026-06-09-ui01a-design-readiness.md)

- targeted tests: docs consistency check; file existence checks; grep evidence for trace IDs and stale old `pages/products` wording.
- negative tests: active PR87 plan must not remain; UI-01a must not claim runtime implementation; runtime source files must not be touched.
- compatibility checks: no generated binding or backend contract changes.
- data safety checks: no POS/store data, DB files, backups, logs, receipts, or secrets.
- main wiring/integration checks: `Plans.md` and `PROJECT_HANDOFF.md` point to current active design readiness work.

## Boundary / Wire Contract

- producer: UI-01a route/search state
- consumer: `commands.searchProducts(query)`, `commands.listDepartments()`
- wire type: `ProductSearchQuery`, `Vec<Department>`
- internal type: UI URL params converted to command DTO
- precision/range: `page >= 1`, `per_page in {50,100,200}`; backend still clamps 200超
- round-trip path: URL state -> queryKey/payload -> Tauri command -> `PaginatedResult<ProductWithRelations>` -> table/pagination
- invalid input: route search validation normalizes invalid enum/range values to defaults
- compatibility: no Rust/generated binding change in this PR

## Review Focus

- UI-01a design must be broad enough for product-management implementation and not overfit to UI-06a stock inquiry.
- Design decisions that affect future implementation must live in source docs, not only in this Plan Packet.
- Deferred gaps must be explicit and not accidentally presented as implemented.
- Runtime / backend scope must remain untouched.

## Spec Contract

Contract ID: SPEC-UI-01A-DESIGN-READINESS

- UI-01a implementation can start with source docs that define default search, URL state, command DTO mapping, pagination, discontinued labels, HID scanner assumption, and deferred cm/m toggle scope.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-103 | Update UI-01a function design | docs grep / review | Durable design trace exists | `UI-01a-D1` ... `UI-01a-D7` |
| REQ-103 | Update screen design | docs grep / review | Operator wording and status clear | `商品検索・一覧画面` |
| WF-DESIGN | Archive completed workflow plan | file existence check | Active plan hygiene | archive path exists |
| WF-DESIGN | Sync live docs | docs consistency check | Next action points at UI-01a | `Plans.md` |

## Data Safety

- Do not commit real POS / store artifacts, DB files, backups, logs, receipt images, or secrets.
- Local-only paths: `.env*`, SQLite DB files, generated local logs, receipt images.
- Synthetic-only paths: docs-only changes in this PR.

## Implementation Results

- Archived completed PR #87 Design Phase workflow plan and test matrix into `docs/archive/plans/`.
- Updated UI-01a durable design in `docs/function-design/50-ui-product-list.md` with `UI-01a-D1` through `UI-01a-D7`.
- Added `list_departments` BIZ/CMD design to `docs/function-design/30-biz-product-service.md` and `docs/function-design/40-cmd-product.md` after review found the department filter source was underspecified.
- Updated `docs/FUNCTION_DESIGN.md` and `docs/SCREEN_DESIGN.md` so UI-01a no longer depends on the old `pages/products/` design.
- Synced `docs/Plans.md` and `docs/PROJECT_HANDOFF.md` to PR #87 baseline and the active UI-01a Design Readiness Trial.
- Verification:
  - `bash scripts/doc-consistency-check.sh` -> pass, no WARN / ERROR.
  - `bash scripts/doc-consistency-check.sh --target plan` -> pass, no WARN / ERROR.
  - `git diff --name-only -- 'src/**' 'src-tauri/**'` -> no runtime/backend files changed.

## Review Response

Review-only sub-agent found P2/P3 issues:
- P2 accepted: department filter source was underspecified. Fixed by adding `list_departments` BIZ/CMD design and UI-01a-D7.
- P3 accepted: URL sort / dir values did not document generated `SortKey` / `SortOrder` mapping. Fixed in `50-ui-product-list.md §50.4`.
- Re-ran docs and plan checks after fixes; both pass with no WARN / ERROR.
