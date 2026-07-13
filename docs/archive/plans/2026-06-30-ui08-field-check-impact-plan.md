# UI-08 Field Check Impact Plan

## Risk

Risk: R3

Reason:
UI-08 touches PLU TSV output, CASIO PC tool workflow, POS CSV import assumptions, report inputs, operator workflow, and real store/POS artifacts. This plan does not implement code or inspect private raw data, but the follow-up work can affect POS data interpretation and inventory movement behavior.

## Goal

Fold the UI-08前の PLU/実機確認調査結果 into source-of-truth docs, identify the scope that must change before implementation, and sequence the next PRs so UI-08 does not proceed on the stale "Z004 drives current sales import" premise.

## Scope

- Record the field-check conclusion that the current store daily report workflow uses PC tool / SD-card `Z001`, `Z002`, and `Z005`, while `Z004` is the PLU/product track and is not the current daily-report primary input.
- Separate REQ-401 SALES redesign from REQ-402 PLU export implementation.
- Promote the POS adapter boundary so register-specific facts do not leak into app-core contracts without a Design Phase decision.
- Split remaining work into fact checks and design decisions.
- Record CV17 version/header uncertainty before UI-08 implementation.
- Identify implementation, docs, tests, and manual verification affected by the new premise.
- Produce this Plan Packet and a Test Design Matrix for the follow-up work.

## Non-scope

- No Rust/TypeScript implementation.
- No schema migration.
- No raw POS CSV, register backup, Excel cell values, JAN, product names, or sales amounts are committed or quoted.
- No CASIO PC tool write operation, register write, DB deletion, backup restore, or destructive operation.
- No GitHub PR creation unless requested separately.

## Acceptance Criteria

- `docs/project-memory.md` no longer states that `Z004` unconditionally drives current sales import logic.
- `docs/plu-export-and-real-csv-verification.md` records the field-check result and the new split between SALES and PLU tracks.
- Existing Z004/CSV import and PLU formatter/service design docs carry a visible pre-field-check/stale-premise note before implementation starts.
- `Plans.md` names the next action as design split / impact plan, not direct UI-08 implementation.
- Test Design Matrix exists at `docs/archive/plans/test-matrices/2026-06-30-ui08-field-check-impact-plan.md`.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0, or any failure is recorded in Implementation Results.
- This plan `Review Response` records the fresh review-only sub-agent result and confirms no inherited context / no edit permission, or records a blocking reason.

## Design Sources

- Requirements / spec: `docs/spec/README.md`, `docs/project-memory.md`, `docs/PROJECT_HANDOFF.md`
- Architecture: `docs/architecture/ui-task-specs.md`, `docs/plu-export-and-real-csv-verification.md`
- Function / command / DTO: `docs/function-design/23-io-z004-parser.md`, `docs/function-design/25-io-plu-formatter.md`, `docs/function-design/32-biz-csv-import-service.md`, `docs/function-design/33-biz-plu-export-service.md`, `docs/function-design/41-cmd-pos.md`, `docs/function-design/55-ui-csv-import.md`
- DB: `docs/DB_DESIGN.md`, existing `sale_records`, `csv_imports`, `inventory_movements`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`
- Decision log / ADR: `docs/decision-log.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | New or revised SALES import function design for `Z001`/`Z002`/`Z005`; revised Z004 role | intentionally deferred to SALES design PR |
| Command / DTO / generated binding / wire shape | Decide whether current `parseAndValidateCsv`/`commitCsvImport` stays Z004-only or becomes a multi-file import command | intentionally deferred to SALES design PR |
| DB / transaction / audit / rollback / migration | Decide whether aggregate daily report data belongs in existing `sale_records` or new daily report tables | intentionally deferred to SALES design PR |
| Screen / UI / route state / Japanese wording | UI-07 wording and UI-08 PLU export workflow need revised guidance | intentionally deferred to SALES/UI-08 design PRs |
| CSV / TSV / report / import / export format | PLU TSV CV17 1.1.1 compatibility and `Z001`/`Z002`/`Z005` parser contracts | partially updated now, detailed contracts deferred |
| Durable decision / ADR | Record field-check track split, ECR+ non-primary stance, and POS adapter boundary | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401 | `plu-export-and-real-csv-verification.md` field-check section | D-022 | Current operation uses `Z001`/`Z002`/`Z005`; rejected continuing Z004-only as current daily import premise | future SALES parser/service/UI design | Matrix SALES-01..07 |
| REQ-402 | `25-io-plu-formatter.md`, `33-biz-plu-export-service.md`, `plu-export-and-real-csv-verification.md` | D-022 | Field tool is CV17 1.1.1 and header labels differ; rejected coding UI-08 against Ver.2.0.1-only certainty | future UI-08 PLU implementation | Matrix PLU-01..08 |
| POS adapter boundary | `ARCHITECTURE.md` POS Adapter Boundary | D-023 | Register-specific formats/procedures must remain replaceable; rejected leaking CASIO Z-code assumptions into app-core contracts | future SALES/PLU design docs and adapter modules | Matrix ADAPT-01..05 |
| SAFE/POS real data | `AGENTS.md`, external field-check `AGENTS.md`, this plan Data Safety | D-002 | Real store files must stay outside repo; rejected copying or quoting source data | docs-only evidence | Matrix SAFE-01..03 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: partially after this PR. Detailed SALES and UI-08 contracts still require follow-up source-doc PRs before implementation.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: the `Z001`/`Z002`/`Z005` vs `Z004` split is promoted to `project-memory`, `plu-export-and-real-csv-verification`, and `decision-log`; the POS adapter boundary is promoted to `ARCHITECTURE.md`, `project-memory`, and `decision-log`.
- Assumptions and constraints: external field-check summaries are treated as sanitized evidence; raw private data is not inspected; approved-readable source bodies are not committed or quoted.
- Deferred design gaps, risk, and follow-up target: SALES import schema/DTO/UI wording, PLU TSV accepted header/version, and app-core internal models for daily report / product-sales imports must be resolved before implementation.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, matrix rows cite D-022 and the updated source docs.

## Design Readiness

State: not ready for UI-08 implementation yet.

- Existing design docs are not sufficient because they still encode a Z004-only current-sales premise and a CV17 Ver.2.0.1-only PLU import premise.
- Source docs updated in this PR: `docs/project-memory.md`, `docs/plu-export-and-real-csv-verification.md`, `docs/function-design/23-io-z004-parser.md`, `docs/function-design/25-io-plu-formatter.md`, `docs/function-design/32-biz-csv-import-service.md`, `docs/function-design/33-biz-plu-export-service.md`, `docs/function-design/55-ui-csv-import.md`, `docs/decision-log.md`, `Plans.md`, `docs/PROJECT_HANDOFF.md`.
- Design gaps intentionally deferred: exact SALES data model, multi-file parser APIs, UI-07 wording, UI-08 route behavior, `plu_dirty` reset/confirmation behavior, PC tool import acceptance.
- Durable decisions discovered in this plan and promoted to source docs: D-022 and D-023.

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): future SALES parsing belongs in IO, validation/report semantics in BIZ, commands stay thin, UI only orchestrates file selection and operator confirmation.
- Backend function design: not ready; requires new/revised source docs before code.
- Command / DTO / data contract: not ready; current Z004 DTO must not be stretched casually to aggregate Z001/Z002/Z005 report data.
- Persistence / transaction / audit impact: not ready; aggregate report imports may not fit item-level `sale_records` and `inventory_movements`.
- Operator workflow / Japanese UI wording: not ready; current UI-07 text says Z004 sales CSV and may mislead.
- Error, empty, retry, and recovery behavior: not ready; multi-file import and PLU confirmation need separate negative paths.
- Testability and traceability IDs: matrix created; tests come with implementation PRs.

## Test Plan

For this docs/design PR:

- targeted docs gate: `bash scripts/doc-consistency-check.sh --target plan`
- data safety check: `git status --short` confirms no external field-check files were copied into repo
- review-only: fresh sub-agent review of docs drift, source-doc promotion, follow-up sequencing, and data safety

For follow-up implementation PRs, use `docs/archive/plans/test-matrices/2026-06-30-ui08-field-check-impact-plan.md` as the seed matrix.

## Boundary / Wire Contract

- producer: CASIO PC tool / SD card (`Z001`, `Z002`, `Z004`, `Z005`) and app PLU exporter (`PLU_{YYYYMMDD}.tsv`)
- consumer: inventory-system IO parsers, BIZ import services, UI-07/UI-08 operator screens, reports
- wire type: CP932 CSV for Z files, CP932 TSV for PLU import file
- internal type: not finalized for SALES; existing Z004 parser types remain implemented-current only
- precision/range: monetary and quantity values remain integer; exact aggregate semantics to be designed
- round-trip path: PLU TSV app -> PC tool/register; sales/report files PC tool -> app
- invalid input: CP932 decode, header/pre-header shape, column-count mismatch, NEL/CRLF handling, missing companion files, unsupported CV17 header label
- compatibility: current Z004 implementation must remain guarded until reclassified; UI-08 must verify CV17 1.1.1 header acceptance before relying on Ver.2.0.1 labels

## Review Focus

- Did the docs clearly prevent direct UI-08 implementation on stale Z004-only assumptions?
- Are durable decisions promoted to source docs rather than left only in this Plan Packet?
- Are SALES and PLU follow-ups separated enough to avoid mixing aggregate daily reports with item-level inventory movements?
- Are data-safety boundaries explicit and honored?
- Are unresolved design gaps named as blockers before implementation?

## Impact Review Lenses

Use these lenses before the SALES design PR and UI-08 PLU design readiness PR. They are prompts for review, not implementation scope for this docs-only PR.

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | CASIO file names, CV17, SD-card, and PC-tool details must stay adapter facts unless source design explicitly promotes an app-core concept. | SALES design PR, PLU design readiness PR, `ARCHITECTURE.md` |
| Fact check / design decision split | Field-check observations are facts; DB model, DTOs, inventory decrement conditions, and UI wording are design decisions. | SALES design PR, PLU design readiness PR, `docs/decision-log.md` |
| Lifecycle / retry | Import/export/re-export, duplicate import, rollback, PC-tool import failure, and operator cancellation need explicit paths before implementation. | SALES Test Matrix rows, PLU-05, future function/UI design |
| Operator workflow | The actual sequence spans SD card, PC tool, Excel print sheet, app screen, and backup/recovery. | `plu-export-and-real-csv-verification.md`, future UI function design |
| Replacement path | Future register changes replace adapter files/procedures, not app-core report/inventory/import lifecycle contracts. | `ARCHITECTURE.md`, future adapter design |
| Data safety / evidence | Field-check claims must be supported by anonymized shape/count/hash/procedure evidence without repo exposure. | Plan Data Safety, review-only packet, future PR body |
| Reporting / accounting semantics | Daily report totals, payment/key summaries, department summaries, item sales, returns, and inventory movements must not be collapsed into false stock movement. | SALES DB/function design, Test Matrix SALES-05 / ADAPT-03 |
| Manual verification | CV17 import acceptance, PC-tool behavior, real-register reflection, and Windows native operator checks cannot be proven by docs-only tests. | PLU design readiness, UI-08 implementation PR manual checks |

## Spec Contract

Contract ID: SPEC-UI08-FIELD-CHECK-2026-06-30

- Current operation contract: `Z001`/`Z002`/`Z005` are the current daily report main inputs; `Z004` is a PLU/product track and must not be treated as the only current sales import source without a follow-up design decision.
- PLU contract: UI-08 exports an app-to-PC-tool/register PLU TSV; PC tool/import/register acceptance is an operational confirmation step, not automatically proven by app-side TSV generation.
- Data safety contract: real POS files, register backups, JAN/product names/sales amounts, Excel cell values, and Windows native DB files stay outside git and are not quoted into docs.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-401 | Reclassify SALES source | SALES-01..07 deferred | No Z004-only current-operation premise | updated source docs |
| REQ-402 | Reclassify UI-08 readiness | PLU-01..08 deferred | CV17 1.1.1/header uncertainty visible | updated PLU docs |
| SAFE-POS | Enforce field data boundary | SAFE-01..03 | no raw data copied or quoted | `git status --short`, review-only |

## Data Safety

- Must not commit: real POS CSV bodies, PLU TSV exports from store data, register backups, Excel cell values, JAN, product names, sales amounts, screenshots with sensitive data, local app DB, logs, secrets.
- Local-only paths: `/home/kosei/Downloads/inventory-field-check/**`, especially `raw-private/**`.
- Synthetic-only paths: repo fixtures and future tests must use synthetic/anonymized data only.
- Approved summaries may be cited as sanitized findings; raw approved-readable files are not copied or quoted unless a later explicit task needs a shape check, and even then only shape metadata may be recorded.

## Implementation Results

- Source docs updated to promote D-022 and D-023, stop direct UI-08 implementation on the stale Z004-only premise, and define the POS adapter boundary.
- Added active Plan Packet and Test Design Matrix:
  - `docs/archive/plans/2026-06-30-ui08-field-check-impact-plan.md`
  - `docs/archive/plans/test-matrices/2026-06-30-ui08-field-check-impact-plan.md`
- Validation:
  - `bash scripts/doc-consistency-check.sh --target plan` -> pass
  - `bash scripts/doc-consistency-check.sh` -> pass
  - `git status --short` -> only repo docs/plan changes; no external field-check files copied into repo
- External data handling:
  - Used sanitized summaries from `/home/kosei/Downloads/inventory-field-check`.
  - Did not inspect `raw-private/**`.
  - Did not copy or quote raw POS bodies, JAN, product names, sales amounts, Excel cell values, register backups, or Windows native DB files.

## Review Response

- Fresh review-only sub-agent `Parfit` was spawned with `fork_context=false`; prompt explicitly required no edits and review-only output.
- Initial findings: P2 x2.
  - P2 accepted: `docs/PROJECT_HANDOFF.md` still had unqualified old Z004-only guidance in later sections. Fixed by rewriting POS連携方針、REQ-401/402、P30実現方法 to the SALES/PLU split.
  - P2 accepted: `docs/plu-export-and-real-csv-verification.md` still allowed retaining sensitive evidence such as receipt/product/price. Fixed by changing evidence guidance to anonymized/shape-only and explicitly banning real JAN/product names/sales amounts/Excel cell values/receipt images in repo evidence.
- Fresh review-only sub-agent `Singer` was spawned with `fork_context=false`; prompt explicitly required no edits and review-only output.
- Follow-up findings: P2 x1, P3 x1.
  - P2 accepted: `docs/ARCHITECTURE.md` still treated PLU limits / CV17-derived details too much like core facts. Fixed by moving them under adapter-provided constraints and marking CV17 1.1.1 compatibility as a confirmation blocker.
  - P3 accepted: this plan mentioned the field-check split decision but did not consistently name both durable decisions. Fixed by recording both `D-022` and `D-023` in the Design Intent Trace / Implementation Results.
- Fresh review-only sub-agent `Plato` was spawned with `fork_context=false`; prompt explicitly required no edits and review-only output.
- Final pre-PR findings: P2 x2.
  - P2 accepted: this plan used `Additional Missed-Issue Lenses` while the new workflow/template contract expects `Impact Review Lenses`. Fixed by renaming the section and aligning it to the template table so review-only packets can reuse it.
  - P2 accepted: generated traceability still described REQ-401 as Z004-only current daily operation. Fixed the source row in `docs/spec/requirements.md`, regenerated `docs/function-design/90-traceability.md`, and verified `cargo run --bin generate_traceability -- --check` passes with ERROR 0 / WARN 0.
