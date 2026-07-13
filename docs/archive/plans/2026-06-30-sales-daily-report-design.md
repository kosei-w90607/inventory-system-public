# SALES Daily Report Design Plan

## Risk

Risk: R3

Reason:
REQ-401 changes POS import, DB schema design, command/DTO design, report semantics, operator workflow, rollback behavior, and replacement-boundary documentation. This is design-only, but it changes source contracts that later implementation will follow.

## Goal

Redesign REQ-401 around current store daily report inputs `Z001`/`Z002`/`Z005`, while keeping existing `Z004` as a separate product-sales / inventory-decrement track after PLU verification.

## Scope

- Define daily report import DB model.
- Define IO/BIZ/CMD contracts for `Z001`/`Z002`/`Z005` bundle import.
- Update UI/report design so daily report aggregates and item-level sales are not mixed.
- Record the durable decision in `docs/decision-log.md`.
- Create a Test Design Matrix for the later implementation PR.

## Non-scope

- No Rust/TypeScript implementation.
- No DB migration code.
- No generated bindings update.
- No real POS CSV/PLU files or store data.
- No UI-08 PLU TSV readiness implementation.
- No Z004 real-file parser changes.
- No `Z006` / `Z009` / `Z011` import. They exist in the CASIO PC tool, but group / time-band / clerk reporting is not needed for the initial single-store daily report unless the owner confirms a concrete use.

## Acceptance Criteria

- `docs/DB_DESIGN.md` and `docs/db-design/pos-tables.md` define daily report import tables and rollback semantics.
- `docs/ARCHITECTURE.md` and `docs/architecture/*-task-specs.md` include IO-07, BIZ-08, CMD-12, and updated UI-07 responsibility.
- `docs/FUNCTION_DESIGN.md` links the new function design files.
- `docs/function-design/29-io-daily-report-parser.md`, `37-biz-daily-report-import-service.md`, and `45-cmd-daily-report-import.md` exist.
- `docs/function-design/34-biz-sales-service.md`, `55-ui-csv-import.md`, `56-ui-daily-sales.md`, and `57-ui-monthly-sales.md` distinguish official daily report aggregates from item-level sales.
- `docs/decision-log.md` contains D-025.
- `bash scripts/doc-consistency-check.sh` exits 0.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-401, REQ-501, REQ-502
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/io-task-specs.md`, `docs/architecture/biz-task-specs.md`, `docs/architecture/cmd-task-specs.md`, `docs/architecture/ui-task-specs.md`
- Function / command / DTO: `docs/FUNCTION_DESIGN.md`, `docs/function-design/29-io-daily-report-parser.md`, `docs/function-design/37-biz-daily-report-import-service.md`, `docs/function-design/45-cmd-daily-report-import.md`, `docs/function-design/34-biz-sales-service.md`, `docs/function-design/55-ui-csv-import.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/pos-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/56-ui-daily-sales.md`, `docs/function-design/57-ui-monthly-sales.md`
- Decision log / ADR: `docs/decision-log.md` D-022, D-023, D-025

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `docs/function-design/29-io-daily-report-parser.md`, `37-biz-daily-report-import-service.md`, `45-cmd-daily-report-import.md`, `24-io-csv-import-repo.md` | updated in this PR |
| Command / DTO / generated binding / wire shape | `45-cmd-daily-report-import.md` + Boundary / Wire Contract below | updated in this PR |
| DB / transaction / audit / rollback / migration | `docs/DB_DESIGN.md`, `docs/db-design/pos-tables.md` | updated in this PR |
| Screen / UI / route state / Japanese wording | `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `55-ui-csv-import.md`, `56-ui-daily-sales.md`, `57-ui-monthly-sales.md` | updated in this PR |
| CSV / TSV / report / import / export format | `29-io-daily-report-parser.md`, `37-biz-daily-report-import-service.md`, `pos-tables.md` | updated in this PR |
| Durable decision / ADR | `docs/decision-log.md` D-025 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401 | `DB_DESIGN.md` POS日報と商品別売上のデータ境界; `pos-tables.md` 12b-12e/B-2 | D-025 | Aggregate daily reports cannot become item-level sales. Rejected forcing into `sale_records`. | DB migration + repository + BIZ-08 | Matrix T1-T8 |
| REQ-401 | `ARCHITECTURE.md` POS Adapter Boundary; IO-07/BIZ-08/CMD-12 | D-023/D-025 | Keep register-specific parsing replaceable. | IO-07/BIZ-08/CMD-12 modules | Matrix T1-T6, T12 |
| REQ-401 | `55-ui-csv-import.md` 55.0 | UI-07-D9/D10/D11 | Operator must see daily report import vs item-level import separately. | UI-07 redesign | Matrix T9-T11 |
| REQ-501 | `34-biz-sales-service.md` 19.2/19.3; `56-ui-daily-sales.md` 56.1 | UI-09a-D12 | Daily report summary and item-level table have different meaning. | BIZ-05 DTO/query + DailySalesPage | Matrix T13-T15 |
| REQ-502 | `34-biz-sales-service.md` 19.4; `57-ui-monthly-sales.md` 57.1 | UI-09b-D8 | Z005 department totals and product ranking have different roots. | BIZ-05 monthly DTO/query + MonthlySalesPage | Matrix T16-T18 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, D-025 and source docs carry the decision.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-025 promoted.
- Assumptions and constraints: CASIO SR-S4000 adapter, CP932/NEL, Z001/Z002/Z005 shape observed from field check, no real data committed.
- Deferred design gaps, risk, and follow-up target: exact adapter line-key mapping and real fixture tests belong to SALES implementation PR; PLU/CV17 1.1.1 readiness remains separate.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, `docs/archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md`.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Applicable. Z001/Z002/Z005/CV17 remain adapter details; daily report model is app core. | `ARCHITECTURE.md`, `29-io-daily-report-parser.md`, D-023/D-025 |
| Fact check / design decision split | Applicable. Field facts are recorded separately; D-025 is the design decision. | `plu-export-and-real-csv-verification.md`, `decision-log.md` |
| Lifecycle / retry | Applicable. Parse/Validate/Preview/Commit, duplicate, overwrite, rollback, cache expiry documented. | `37-biz-daily-report-import-service.md`, `45-cmd-daily-report-import.md` |
| Operator workflow | Applicable. UI-07 daily report main path and Z004 separate track documented. | `SCREEN_DESIGN.md`, `55-ui-csv-import.md` |
| Replacement path | Applicable. IO-07/CASIO adapter can be swapped while DB/BIZ report model remains. | `ARCHITECTURE.md`, `29-io-daily-report-parser.md` |
| Data safety / evidence | Applicable. No real CSV/PLU/store data committed; source_files_json stores hashes/metadata only. | `DB_DESIGN.md`, Data Safety below |
| Reporting / accounting semantics | Applicable. Official daily report aggregates are separated from item-level sales and inventory. | `34-biz-sales-service.md`, `56-ui-daily-sales.md`, `57-ui-monthly-sales.md` |
| Manual verification | Applicable later. Exact Z001/Z002/Z005 parsing and UI-08 PLU path require real-device / Windows native checks. | Test Matrix manual section, future implementation PR body |

## Design Readiness

- Existing design docs are sufficient because: POS adapter boundary was already introduced by D-023 and is now connected to task IDs and function/DB/UI contracts.
- Source docs updated in this PR: DB, architecture, function, screen/UI, requirement inventory, decision log.
- Design gaps intentionally deferred: exact parser fixtures from sanitized/shape-only Z001/Z002/Z005 examples; Windows native L3; real PC-tool/SD-card verification.
- Durable decisions discovered in this plan and promoted to source docs: D-025.

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): IO-07 parses, BIZ-08 validates/commits, CMD-12 wraps, UI-07 presents.
- Backend function design: new IO/BIZ/CMD docs define functions and error paths.
- Command / DTO / data contract: CMD-12 and BIZ-08 types defined; bindings update deferred to implementation.
- Persistence / transaction / audit impact: new DB tables, transaction steps, operation_logs, rollback semantics defined.
- Operator workflow / Japanese UI wording: UI-07, daily report, item-level track wording documented.
- Error, empty, retry, and recovery behavior: parse errors, duplicate, overwrite, rollback, cache expiry documented.
- Testability and traceability IDs: REQ-401/501/502 and decision IDs mapped to matrix.

## Test Plan

See `docs/archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md`.

- targeted tests: IO-07 parser, BIZ-08 duplicate/commit/rollback, BIZ-05 report separation.
- negative tests: missing source, duplicate source, CP932 decode failure, date mismatch, invalid number, duplicate bundle.
- compatibility checks: generated bindings after CMD-12 implementation, existing Z004 tests remain green.
- data safety checks: no real POS/store files, no CSV body in source_files_json.
- main wiring/integration checks: UI-07 daily report flow, query invalidation, daily/monthly report display.

## Boundary / Wire Contract

- producer: frontend file input sends `DailyReportSourceFileRequest[]`.
- consumer: CMD-12 / BIZ-08.
- wire type: Tauri command JSON with `{ filename: string, fileBytes: number[] }[]`, `previewToken: string`, `overwriteConfirmed: boolean`.
- internal type: `DailyReportPreviewData`, `DailyReportImportResult`, `DailyReportRollbackResult`.
- precision/range: amounts/counts are signed 64-bit integers; UI displays Japanese currency/count labels.
- round-trip path: UI-07 select files -> CMD-12 parse -> BIZ-08 preview -> cache token -> CMD-12 commit -> DB daily_report tables -> BIZ-05 reports.
- invalid input: missing/duplicate/unknown source, decode failed, date mismatch, invalid number, expired token.
- compatibility: existing CMD-07/Z004 command names remain; CMD-12 is additive. `DailySalesReport`/`MonthlySalesReport` DTO expansion requires regenerated bindings in implementation PR.

## Review Focus

- Does any doc still imply Z001/Z002/Z005 create item-level `sale_records` or inventory movements?
- Are daily report rollback and Z004 rollback clearly different?
- Are adapter facts separated from app-core contracts?
- Are UI/report docs clear enough for a non-IT operator to understand daily report vs product-sales meanings?
- Are follow-up implementation tests concrete enough?

## Spec Contract

Contract ID: SPEC-SALES-DAILY-REPORT-2026-06-30

- REQ-401 daily report import consumes a required `Z001`/`Z002`/`Z005` bundle and writes only `daily_report_imports` + child lines.
- REQ-401 product-sales import remains Z004 and writes `sale_records` / optional inventory movements.
- REQ-501/502 reports distinguish official daily report aggregates from item-level sale details.
- Rollback of daily report imports never changes product stock.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-401 | DB/function design | T1-T8 | no false item-level expansion | `DB_DESIGN.md`, `pos-tables.md`, BIZ-08 doc |
| REQ-401 | UI-07 design | T9-T11 | operator wording and separate tracks | `SCREEN_DESIGN.md`, `55-ui-csv-import.md` |
| REQ-501 | BIZ/UI daily report design | T13-T15 | daily report vs item-level separation | `34-biz-sales-service.md`, `56-ui-daily-sales.md` |
| REQ-502 | BIZ/UI monthly report design | T16-T18 | Z005 totals vs product ranking separation | `34-biz-sales-service.md`, `57-ui-monthly-sales.md` |

## Data Safety

- Must not commit real POS CSV, real PLU export files, Excel day reports, store sales values, product names/JANs, DB files, backups, logs, receipt images, secrets, or `.env*`.
- Local-only paths: `.local/`, `docs/research/real-csv/`, `docs/reference/`, app data directory.
- Synthetic-only paths: future parser fixtures under tests must use generated/sanitized values and shape-only evidence.

## Implementation Results

- Source design docs updated for DB, architecture, function, screen/UI, requirement inventory, decision log, live dashboard, and handoff.
- Traceability output regenerated.
- Design-only PR remains implementation-free: no Rust/TypeScript implementation, no migration code, no bindings generation, no real POS/store artifacts.

## Review Response

- Accepted P2: untracked design artifacts must be included in the PR. Resolution is packaging-only; `docs/function-design/29-io-daily-report-parser.md`, `37-biz-daily-report-import-service.md`, `45-cmd-daily-report-import.md`, and `docs/plans/` will be staged and committed before PR creation.
- Accepted P2: BIZ-08/CMD-12 DTO contract was incomplete. Added missing DTO definitions in `37-biz-daily-report-import-service.md` and made CMD-12 explicitly reference §37.2 as the owning source.
- Accepted P2: daily report import/rollback operation logs were inside the DB transaction. Moved successful `daily_report_import` / `daily_report_rollback` logging outside the main transaction in BIZ/DB design docs and stated log failure is warning-only follow-up, not rollback of the committed daily report state.
