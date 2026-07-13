# Design Phase Workflow Addition

## Risk

Risk: R3

Reason:
This is docs-only, but it changes the repository workflow gate between specification and implementation. The new Design Phase affects what may proceed to Plan Packet, review-only focus, PR evidence, and how durable design decisions are promoted into source-of-truth docs.

## Goal

Add an explicit Design Phase to the inventory-system workflow so business-app implementation starts from durable design docs, not from Plan Packets or chat-only design decisions.

## Scope

- Update `docs/DEV_WORKFLOW.md` flow and rules to include `Spec Check -> Design -> Plan`.
- Define Design Phase inputs, outputs, and completion criteria.
- Make Plan Packet explicitly reference design sources instead of carrying durable design decisions.
- Update workflow skills and review guidance so kickoff, implementation, and review all check design readiness.
- Update test-design and workflow-effectiveness-review skills so Design Phase is part of test planning and post-change evaluation.
- Update PR evidence expectations for design source docs and design readiness.
- Record the workflow-level decision in `docs/decision-log.md`.
- Update `Plans.md` with the current workflow baseline and next action.

## Non-scope

- No Phase 3 UI-01a implementation plan.
- No UI-01a function-design content changes beyond workflow routing, if any.
- No new runtime, DB, Tauri DTO, route/search, frontend, or Rust behavior.
- No machine enforcement for design readiness in this PR.
- No broad rewrite of existing function-design or screen-design documents.

## Acceptance Criteria

- `docs/DEV_WORKFLOW.md` flow includes an explicit Design Phase before Plan.
- `docs/DEV_WORKFLOW.md` explains that Plan Packets are not durable design source of truth.
- `docs/templates/plan-packet.md` includes design source / design readiness fields that force a Plan Packet to point to source design docs.
- `docs/DEV_WORKFLOW.md` and `docs/templates/plan-packet.md` include a design artifact selection step so upcoming specs can be mapped to required design outputs before implementation.
- `docs/DEV_WORKFLOW.md` and `docs/templates/plan-packet.md` include Design Intent Trace / Audit so spec IDs, decision rationale, implementation targets, and test targets can be traced before implementation.
- `.agents/skills/inventory-workflow-start/SKILL.md` and `.agents/skills/inventory-implementation/SKILL.md` mention design readiness before implementation.
- `.agents/skills/test-design/SKILL.md` extracts contracts from source design docs first, and `.agents/skills/workflow-effectiveness-review/SKILL.md` evaluates Design Phase effectiveness.
- `docs/code_review.md` and `docs/templates/subagent-review-packet.md` ask reviewers to check source design docs versus implementation, not only Plan Packet versus implementation.
- `docs/decision-log.md` records why Design Phase exists for this business app workflow.
- `docs/Plans.md` records PR #86 as the current baseline and names Design Phase workflow addition as the active work.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.
- `bash scripts/doc-consistency-check.sh` exits 0.

## Design Sources

- Requirements / spec: `docs/spec/README.md`, `docs/inventory_system_v2.1.xlsx`
- Architecture: `docs/ARCHITECTURE.md`, `docs/DEV_WORKFLOW.md`
- Function / command / DTO: not applicable; no runtime command/function contract changes.
- DB: not applicable; no DB design changes.
- Screen / UI: not applicable; no UI behavior or screen design changes.
- Decision log / ADR: `docs/decision-log.md` records the workflow-level decision; no new product/runtime architecture decision.

## Design Readiness

- Existing design docs are sufficient because `docs/project-profile.md` already identifies design docs as source of truth and PR #86 WER evidence identified the missing workflow phase.
- Source docs updated in this PR: `docs/DEV_WORKFLOW.md`, `docs/project-profile.md`, `docs/code_review.md`, `docs/decision-log.md`, workflow/test/review Skills, and templates.
- Design gaps intentionally deferred: no machine enforcement for design readiness; this PR adds workflow rules only.
- Durable decisions discovered in this plan and promoted to source docs: Design Phase must sit between Spec Check and Plan; Plan Packets must not be the only durable home for design decisions.

Minimum design checks for this workflow change:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): workflow now requires design docs to assign layer responsibility before implementation.
- Required design artifact selection: workflow now maps upcoming spec/change types to required source design artifacts before Plan, so backend, DB, UI, wire, format, and durable decision outputs are not left to unstated intuition.
- Design Intent Trace / Audit: workflow now requires R3/R4 plans to connect spec IDs, source design sections, design decision IDs, implementation targets, and test targets; durable rationale must live in source docs, decision-log, or ADR, not only in the Plan Packet.
- Backend function design: no runtime backend design change. Workflow now requires function-design docs when service, repository, command, DTO, validation, error, invariant, or cross-layer behavior is newly designed or changed.
- Command / data contract: no runtime command/data contract change. Workflow now asks Design Phase to identify DTO, generated binding, URL/search state, CSV/report, and compatibility impact before Plan.
- Persistence / transaction / audit impact: no DB/runtime persistence change. Workflow now asks Design Phase to identify transaction, idempotency, audit/log, rollback, and migration impact.
- Operator workflow / Japanese UI wording: not applicable; no runtime UI. The workflow is written for business-app implementation, including operator workflow and Japanese UI wording checks when UI work is in scope.
- Error, empty, retry, and recovery behavior: no runtime behavior change. Workflow now requires these paths to be part of operator-facing design when applicable.
- Testability and traceability IDs: Plan Packet and review docs now require design sources/readiness so Test Design Matrix and reviews can derive checks from source docs.

## Test Plan

Test Design Matrix: [test-matrices/2026-06-09-design-phase-workflow.md](test-matrices/2026-06-09-design-phase-workflow.md)

- targeted tests: docs consistency and active plan check.
- negative tests: review grep for old `Kickoff -> 1. Plan` flow and Plan Packet-as-design wording.
- compatibility checks: no runtime/code contract files under `src/` or `src-tauri/` are changed.
- data safety checks: no POS/store artifacts, DB files, logs, backups, receipt images, or secrets are read or committed.
- main wiring/integration checks: workflow index, Plan Packet template, PR template, skills, and review docs agree on Design Phase placement and evidence.

## Boundary / Wire Contract

- producer: repository workflow docs, Plan Packet template, PR template, workflow skills.
- consumer: Codex/Claude/human implementers and reviewers.
- wire type: Markdown workflow instructions and PR evidence fields.
- internal type: workflow phase ordering and gate expectations.
- precision/range: Design Phase applies before Plan for R2+ work when source design docs may be affected; R3/R4 require explicit design readiness.
- round-trip path: kickoff skill -> source design docs -> Plan Packet -> implementation -> review-only/external review -> archive/WER.
- invalid input: implementation plan containing durable design decisions with no source design doc update or explicit design readiness note.
- compatibility: no runtime behavior, DB schema, Tauri command DTO, generated bindings, route/search state, or report output changes.

## Review Focus

- Whether Design Phase is concrete enough to use before UI-01a without creating a vague extra ceremony.
- Whether source-of-truth ownership is clear: design docs / decision-log hold durable design, Plan Packet holds implementation scope and evidence.
- Whether R2/R3/R4 routing remains coherent and does not overburden R0/R1 work.
- Whether review-only packets have enough context to catch design drift.
- Whether no machine enforcement is introduced prematurely.

## Spec Contract

Contract ID: SPEC-WF-DESIGN-PHASE-2026-06-09

- The workflow must include a Design Phase between Spec Check and Plan.
- R3/R4 work must not proceed to implementation until design readiness is documented in source design docs or the Plan Packet's design readiness field.
- Durable design decisions must be promoted to source docs or decision-log in the same PR; Plan Packets may cite them but must not be their only durable home.
- Review must compare implementation against source design docs, not only against the Plan Packet.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-DESIGN-PHASE-2026-06-09 | Add Design Phase to workflow index | `doc-consistency-check.sh` + review grep | phase order and gate wording | `docs/DEV_WORKFLOW.md` |
| SPEC-WF-DESIGN-PHASE-2026-06-09 | Add design evidence to Plan Packet template | `doc-consistency-check.sh --target plan` + review | Plan Packet cites source design docs | `docs/templates/plan-packet.md` |
| SPEC-WF-DESIGN-PHASE-2026-06-09 | Add Design Intent Trace / Audit | `doc-consistency-check.sh --target plan` + review | spec IDs, decision rationale, implementation targets, and test targets are traceable | `docs/DEV_WORKFLOW.md`, `docs/templates/plan-packet.md` |
| SPEC-WF-DESIGN-PHASE-2026-06-09 | Update skills and review guidance | review-only sub-agent | kickoff / implementation / review all enforce design readiness | `.agents/skills/*`, `docs/code_review.md` |
| SPEC-WF-DESIGN-PHASE-2026-06-09 | Update dashboard | `doc-consistency-check.sh` | current work and baseline accurate | `docs/Plans.md` |

## Data Safety

- Do not read or commit `.env*`, credentials, keys, certificates, `auth.json`, real POS CSV, PLU exports, DB files, backups, logs, receipt images, or store-specific sales/cost data.
- This PR is docs/workflow only and must not touch `src/`, `src-tauri/`, generated bindings, local app data, or store artifacts.
- Synthetic-only fixtures are not needed.

## Implementation Results

- Added `Spec Check -> Design -> Plan` phase order and Design Phase rules to `docs/DEV_WORKFLOW.md`.
- Added Design artifact selection so upcoming work is mapped to required function-design, DB design, screen/UI design, wire contract, format contract, or decision-log/ADR outputs before Plan.
- Added Design Intent Trace / Audit so spec IDs, design decision IDs, why/rejected alternatives, implementation targets, and test targets are checked before implementation.
- Added a demand-driven backfill note so mid-project Design Phase adoption does not create blanket historical cleanup scope.
- Added business-app design checklist for layer ownership, backend function design, command/data contracts, persistence/audit/recovery, operator workflow, and testability.
- Added `Design Sources` / `Design Readiness` fields to the Plan Packet template and source-design verification context to the subagent review packet.
- Updated kickoff, implementation, test-design, workflow-effectiveness-review, review docs, PR template, project profile, and decision log to keep durable design in source docs.
- Updated `docs/Plans.md` with PR #86 baseline and this active workflow addition.

## Review Response

- Review-only sub-agent finding P3: workflow skill synchronization was incomplete for `test-design`, `workflow-effectiveness-review`, and the `inventory-workflow-start` description.
- Response: accepted and fixed in this PR. `test-design` now reads `Design Sources` / `Design Readiness` and source design docs first; WER now evaluates Design Phase effectiveness; workflow-start description now routes R2+ through Design Phase before Plan Packet.
