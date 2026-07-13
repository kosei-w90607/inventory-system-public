# Test Design Matrix: UI-01a Design Readiness Trial

## Risk

Risk: R3

## Contracts Under Test

- Completed PR87 workflow plan is archived and no longer active.
- UI-01a source design docs define implementation-ready decisions for REQ-103.
- Design Intent Trace IDs are durable and testable.
- This PR is docs/design-only and does not alter runtime, DB, command, or generated binding contracts.
- Live workflow docs point at the current work.

## Failure Modes

- Stale active plan remains and misleads the workflow dashboard.
- UI-01a design remains on old `pages/products/` structure and lacks modern route/search state.
- Plan Packet becomes the only place where important design intent exists.
- UI-01a claims backend, DB, scanner UX, or cm/m toggle work that is not implemented.
- Docs update touches runtime scope accidentally.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| PR87 archive hygiene | Active completed plan still exists | review / file existence | `archive-design-phase-workflow-plan` | `docs/plans/2026-06-09-design-phase-workflow.md` remains active |
| UI-01a durable design | Trace IDs missing | review / grep | `grep-ui01a-design-trace` | `UI-01a-D1` ... `UI-01a-D7` are absent from `50-ui-product-list.md` |
| UI-01a command contract | New command or unclear DTO mapping | review / grep | `grep-search-products-contract` | `commands.searchProducts` or `ProductSearchQuery` mapping is absent |
| Department filter contract | Department candidates are derived from current page | review / grep | `grep-list-departments-contract` | `commands.listDepartments` / `list_departments` design is absent |
| URL state design | Local-only state remains the design | review / grep | `grep-ui01a-url-state` | `q`, `dept`, `discontinued`, `sort`, `dir`, `page`, `perPage` are not documented |
| Pagination contract | 200超 clamp policy not reflected in UI | review / grep | `grep-ui01a-perpage-options` | 50 / 100 / 200 options are absent or UI suggests 200超 |
| Operator screen design | Screen remains 未着手 only | review / grep | `grep-screen-design-ui01a` | `SCREEN_DESIGN.md` lacks `商品検索・一覧画面` or status update |
| Source summary sync | FUNCTION_DESIGN points to old pages | review / grep | `grep-function-design-ui01a-summary` | `FUNCTION_DESIGN.md` still says UI-01a is old `pages/products/` awaiting Phase 9 update |
| Runtime non-scope | Runtime files changed | review / git diff | `git-diff-runtime-scope` | `src/` or `src-tauri/` source changes appear |
| Docs consistency | Broken doc references | CLI | `bash scripts/doc-consistency-check.sh` | doc checker exits non-zero |

## Negative Paths

- missing input: Plan Packet must not omit Design Sources / Required Design Artifacts.
- invalid input: invalid URL values must be documented as normalized by route validation for implementation.
- duplicate/ambiguous input: search keyword maps to the existing keyword field, not separate product code / JAN fields in UI; department candidates come from department master, not paginated product rows.
- unknown reference: UI-01b route exactness is deferred instead of invented as final.
- dependency missing: no new dependency or generated binding is needed.
- permission/write failure: docs-only patch must not require external write paths.
- dry-run side effect: no GitHub mutation or runtime generation is part of verification.

## Boundary Checks

- threshold: `perPage` allowed values 50 / 100 / 200; backend 200超 clamp remains compatibility behavior.
- null/default: blank `q` -> `keyword = null`; missing `dept` -> `department_id = null`; default discontinued -> `false`.
- empty/non-empty: initial active list may be empty and must show empty state, not error.
- min/max: `page >= 1`; `perPage <= 200`.
- status/policy enum: `active` / `all` / `discontinued`.
- wire type: `ProductSearchQuery`, `Vec<Department>`.
- internal type: TanStack Router search params.
- producer/consumer: UI route -> `commands.searchProducts`; DepartmentFilter -> `commands.listDepartments`.
- round-trip token: URL state -> command payload -> `PaginatedResult.total_count` -> pagination.
- precision/range: JS numbers are safe for page/perPage and IDs in this local app contract.
- cross-language parse: generated binding names must remain authoritative during implementation.

## Compatibility Checks

- old schema/input: existing `ProductSearchQuery` remains accepted by Rust side.
- new schema/input: implementation PR must add `list_departments` command/binding before UI-01a DepartmentFilter is wired.
- output order: sort key/order documented but no output order implementation in this PR.
- optional field behavior: `keyword`, `department_id`, `is_discontinued` null behavior preserved.

## Data Safety Checks

- source-derived data: do not inspect or commit real POS/store CSVs.
- generated outputs: none.
- secrets: do not read `.env*`, keys, certificates, auth files.
- local-only files: do not touch DB, backup, log, receipt image paths.
- synthetic sample boundaries: docs-only evidence is sufficient.

## Main Wiring / Integration Checks

- helper connected to main path: `Plans.md` next action points to UI-01a design readiness.
- output reaches manifest/report: `PROJECT_HANDOFF.md` current work mentions Design Phase and UI-01a trial.
- effective config reaches runtime: not applicable.
- CLI arg reaches implementation: not applicable.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? `grep-ui01a-design-trace` and reviewer check catch missing active/default discontinued mapping.
- If a threshold comparison changes, which test fails? `grep-ui01a-perpage-options` catches lost 200 max design.
- If a guard is removed, which test fails? `grep-ui01a-url-state` catches missing route validation/default discussion.
- If an output field is omitted, which test fails? `grep-search-products-contract` catches missing `total_count`/pagination contract; future implementation tests must catch missing department id/name fields.
- If output order changes, which test fails? Future implementation tests for sort payload and rendered order; design-only PR records the target.
- If dry-run performs a side effect, which test fails? `git-diff-runtime-scope` catches non-doc runtime edits; GitHub mutation is outside scope.
- If a JSON number crosses JavaScript safe integer range, which test fails? Not applicable to page/perPage; product IDs remain generated binding responsibility.
- If a state token is round-tripped through browser/client code, which test fails? Future URL state tests; this matrix records required test target.

## Residual Test Gaps

- Review-only sub-agent pass is still needed before PR/merge.
- Windows native L3 is not run because no runtime UI changed.
- Actual UI-01a implementation tests will be created in the implementation PR.
