# UI-08 PLU Design Readiness Plan Packet

## Risk

Risk: R3

Reason:
REQ-402 touches PLU TSV output, Tauri command DTOs, `plu_dirty` / `plu_exported_at` business state, operator workflow, CV17 1.1.1 compatibility, and manual register-tool verification. The current change is design/docs only, but it defines the future implementation contract.

## Goal

Make UI-08 implementation-ready by resolving CV17 1.1.1 compatibility handling, PC-tool import failure recovery, and `plu_dirty` update timing in source design docs.

## Scope

- Update source docs for REQ-402 UI-08 PLU export design readiness.
- Split PLU TSV generation from app-side exported confirmation.
- Define UI-08 route, state machine, wording, query invalidation, and manual gates.
- Create the R3 Test Design Matrix for the later implementation PR.
- Keep SALES implementation and Z004 product-sales evaluation out of this change.

## Non-scope

- Rust/TypeScript implementation changes.
- Generated bindings.
- Real CV17 / SR-S4000 execution.
- Z004 parser changes or daily report implementation.
- New DB tables for PLU export history.

## Acceptance Criteria

- `docs/function-design/67-ui-plu-export.md` defines UI-08 route, state machine, command contract, recovery, wording, and L3/manual gate.
- `docs/function-design/33-biz-plu-export-service.md` defines `prepare_plu_export` and `confirm_plu_export_saved` separately.
- `docs/function-design/41-cmd-pos.md` and `docs/architecture/cmd-task-specs.md` define the future CMD-08 wire contract.
- `docs/DB_DESIGN.md` and `docs/db-design/master-tables.md` state that `plu_exported_at` is app-side export confirmation only, not PC-tool/register proof.
- `docs/archive/plans/test-matrices/2026-07-01-ui08-plu-design-readiness.md` exists and covers PLU format, dirty lifecycle, UI recovery, data safety, and manual CV17 checks.
- `bash scripts/doc-consistency-check.sh` exits 0.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-402
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/{biz,cmd,io,ui}-task-specs.md`
- Function / command / DTO: `docs/function-design/25-io-plu-formatter.md`, `33-biz-plu-export-service.md`, `41-cmd-pos.md`, `67-ui-plu-export.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/master-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/design-system/01-decision-rules.md`, `docs/design-system/02-component-catalog.md`
- Decision log / ADR: `docs/decision-log.md` D-011, D-022, D-023, D-024, D-027

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `33-biz-plu-export-service.md`, `41-cmd-pos.md` | updated in this PR |
| Command / DTO / generated binding / wire shape | `41-cmd-pos.md`, `architecture/cmd-task-specs.md` | updated in this PR; bindings deferred to implementation |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `db-design/master-tables.md` | updated in this PR; no schema change |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `67-ui-plu-export.md`, `UI_TECH_STACK.md` | updated in this PR |
| CSV / TSV / report / import / export format | `25-io-plu-formatter.md`, `plu-export-and-real-csv-verification.md` | updated in this PR; CV17 manual check deferred to implementation |
| Durable decision / ADR | `decision-log.md` | D-027 added |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-402 | `67-ui-plu-export.md` §67.5 | UI-08-D1 / D-027 | Prevent dirty reset before PC-tool recovery; rejected single `export_plu` mutation | `src-tauri/src/biz/plu_export_service.rs`, UI page | Matrix T02, T03, T07 |
| REQ-402 | `25-io-plu-formatter.md` §12.3/12.7 | UI-08-D3 | Keep 10-column profile until CV17 1.1.1 proves otherwise | IO formatter tests and manual CV17 check | Matrix T01, T10 |
| REQ-402 | `67-ui-plu-export.md` §67.5/67.9/67.11 | UI-08-D2/D4 | Avoid implying register reflection; preserve recovery paths | UI wording and result panel | Matrix T04, T05, T06 |
| REQ-402 | `DB_DESIGN.md` D-2 | D-027 | `plu_exported_at` is app-side only; rejected real-register confirmation without API | confirm command transaction | Matrix T03, T08 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, via D-027 and `67-ui-plu-export.md`.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: yes, two-step PLU export confirmation promoted to D-027 and source docs.
- Assumptions and constraints: CV17 1.1.1 acceptance is not proven; register reflection has no API; no real store files may be committed.
- Deferred design gaps, risk, and follow-up target: CV17 manual acceptance and UI implementation are deferred to UI-08 implementation PR; PLU export history table is deferred.
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | CV17 headers, PC-tool flow, SD-card, register reflection are adapter facts; `plu_dirty` is app core state | `ARCHITECTURE.md`, `25-io-plu-formatter.md`, `67-ui-plu-export.md` |
| Fact check / design decision split | CV17 1.1.1 acceptance remains fact-check pending; D-027 is app design decision | `plu-export-and-real-csv-verification.md`, test matrix |
| Lifecycle / retry | prepare, save, cancel, save failure, PC-tool failure before confirm, confirm success/failure are explicit | `67-ui-plu-export.md` |
| Operator workflow | UI states and Japanese labels describe PC-tool/SD-card/register next steps | `SCREEN_DESIGN.md`, `67-ui-plu-export.md` |
| Replacement path | CASIO-specific TSV remains IO adapter; core uses app-side exported state only | `ARCHITECTURE.md`, `25-io-plu-formatter.md` |
| Data safety / evidence | Real PLU, CSV, backups, JAN/name/price not committed; use shape/count/error evidence | Data Safety section, verification checklist |
| Reporting / accounting semantics | Not applicable to totals/reports in this PR; Z004 product-sales evaluation remains separate | Non-scope |
| Manual verification | CV17 1.1.1 import, SD-card/register reflection, Windows native L3 are manual gates | Test matrix, future PR body |

## Design Readiness

- Existing design docs are sufficient because: they already define REQ-402, IO-04 formatter, BIZ-04, CMD-08, POS adapter boundary, and design-system constraints.
- Source docs updated in this PR: listed in Required Design Artifacts.
- Design gaps intentionally deferred: CV17 1.1.1 real import acceptance, Windows native L3, and implementation tests.
- Durable decisions discovered in this plan and promoted to source docs: D-027.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI saves and confirms; CMD thinly converts; BIZ owns dirty/exported state; IO owns TSV format.
- Backend function design: two-step prepare/confirm in BIZ-04.
- Command / DTO / data contract: future `prepare_plu_export`, `confirm_plu_export_saved`, `target_product_codes`.
- Persistence / transaction / audit impact: no schema change; confirm transaction updates exact products and logs outside TX.
- Operator workflow / Japanese UI wording: defined in `67-ui-plu-export.md`.
- Error, empty, retry, and recovery behavior: defined in §67.11.
- Testability and traceability IDs: REQ-402 / UI-08-D1..D5 / D-027.

## Test Plan

For R3/R4, include or link a Test Design Matrix.

- targeted tests: see `docs/archive/plans/test-matrices/2026-07-01-ui08-plu-design-readiness.md`
- negative tests: save cancel/failure, confirm failure, invalid product_codes, CV17 acceptance failure as manual blocker
- compatibility checks: CV17 1.1.1 manual import check; generated bindings in implementation PR
- data safety checks: `git status --short`; no real PLU/CSV/backups/logs
- main wiring/integration checks: future route, navigation, query invalidation, command registration, generated bindings

## Boundary / Wire Contract

- producer: CMD-08 / BIZ-04 / IO-04
- consumer: UI-08
- wire type: Tauri JSON command result with `bytes_base64`, `suggested_filename`, `content_type`, `encoding`, `count`, `target_product_codes`, `over_limit_warning`
- internal type: `PluExportPreparedResult`, `PluExportConfirmResult`
- precision/range: product_codes non-empty for confirm, max `PLU_EXPORT_LIMIT`; count usize; timestamp `YYYY-MM-DDTHH:MM:SS`
- round-trip path: UI prepare -> native save -> UI confirm with prepare exact set -> BIZ updates products
- invalid input: bad mode, empty/duplicate/over-limit product_codes, missing products
- compatibility: existing `export_plu` command is replaced in implementation; bindings must be regenerated then

## Review Focus

- Dirty/exported lifecycle: no path clears dirty at generation/save-cancel time.
- UI wording does not imply register reflection.
- CV17 1.1.1 facts remain adapter facts and manual gates.
- No real store data or real export artifacts enter repo.

## Spec Contract

Contract ID: SPEC-UI08-PLU-DESIGN-2026-07-01

- REQ-402 PLU export prepares a CV17 TSV without changing `plu_dirty`, and only explicit app-side export confirmation updates the exact prepared products.
- App UI must make external PC-tool/register confirmation limits visible in Japanese.
- CV17 1.1.1 acceptance is a manual compatibility gate, not an assumed fact.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-402 | Source doc update | Matrix T01-T10 | format/lifecycle/UI/manual/data safety | changed docs + doc check |
| UI-08-D1 / D-027 | BIZ/CMD contract | Matrix T02-T03 | prepare does not mutate; confirm exact set | `33-biz`, `41-cmd`, DB docs |
| UI-08-D2/D4 | UI recovery wording | Matrix T04-T06 | no false register reflection; recovery paths | `67-ui`, `SCREEN_DESIGN` |
| UI-08-D3 | CV17 gate | Matrix T10 | manual gate and adapter profile | `25-io`, checklist |

## Data Safety

- Do not commit real POS CSV, real PLU TSV, real register backup, store DB, logs, receipt images, secrets, or `.env*`.
- Local-only paths: `.local/`, `docs/research/real-csv/`, `docs/reference/`, app data directories, Windows native local clone.
- Synthetic-only paths: future tests under `src-tauri/tests/` and `src/` must use synthetic rows/product names.

## Implementation Results

Docs/design only. Source docs and active R3 evidence were updated. `bash scripts/doc-consistency-check.sh`, `bash scripts/doc-consistency-check.sh --target plan`, and `git diff --check` passed.

## Review Response

Fresh review-only sub-agent `Gibbs` ran with `fork_context:false`.

- P1/P2: none.
- P3 accepted/fixed: `docs/plu-export-and-real-csv-verification.md` still referenced old single-step `exportPlu(mode)`. Updated it to the `preparePluExport` / `confirmPluExportSaved` two-step contract.
- Residual risk: CV17 1.1.1 import, Windows native L3, save cancel/failure, confirm rollback, and query invalidation remain implementation/manual gates tracked by the Test Matrix.
