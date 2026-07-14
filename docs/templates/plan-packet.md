# Plan Packet

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: <kickoff|spec-check|design|plan-draft|plan-gate|plan-approved|implementing|local-verified|independent-review|human-confirm|ready-hosted-final|merge|archive>
- Risk: <R2|R3|R4>
- Execution Mode: <fable-window|dual-vendor-no-fable|codex-only>
- Plan Commit: <pending|SHA>
- Amendments: <none|SHA list of gated amendments (append-only)>
- Coordinator: <role assignment>
- Writer: <role assignment>
- Plan Reviewer: <role assignment>
- Final Reviewer: <role assignment>
- Reviewed Content HEAD: <pending|audited content SHA>
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: <required|not-required>
- Human Gate: <pending items|none>

## Owner Effort Budget

- 介入回数上限: <N>
- 実働時間上限: <N分>
- relay 往復上限: <N>

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: <R2|R3|R4>

Reason:
<why this risk level>

## Goal

Goal Invariant:

### 最小完了条件

- <user-visible minimum completion condition>

### 失敗定義

- <what outcome means this change failed>

### 非目的

- <what this change must not optimize or expand into>

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- <in scope>

## Non-scope

- <explicitly out of scope>

## Acceptance Criteria

- <observable success condition>

For R3/R4, each bullet should include an observable evidence token such as a command, file path, test name, output field, exit code, or explicit `WARN` / `ERROR` expectation.

## Design Sources

List the source design docs this plan relies on. Plan Packets are not durable design source of truth.

- Requirements / spec:
- Architecture:
- Function / command / DTO:
- DB:
- Screen / UI:
- Decision log / ADR:

## Required Design Artifacts

Use `docs/DEV_WORKFLOW.md` Design artifact selection to decide what must exist before implementation.

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error |  |  |
| Command / DTO / generated binding / wire shape |  |  |
| DB / transaction / audit / rollback / migration |  |  |
| Screen / UI / route state / Japanese wording |  |  |
| CSV / TSV / report / import / export format |  |  |
| Durable decision / ADR |  |  |

## Design Intent Trace

Use spec/requirement IDs as the root. Use child decision IDs such as `UI-01a-D1`, `BIZ-08-D2`, or `SPEC-WF-...-D1` when a design choice needs rationale.

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets:
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR:
- Assumptions and constraints:
- Deferred design gaps, risk, and follow-up target:
- Test Design Matrix can cite design decision IDs or source doc sections:

## Impact Review Lenses

Fill this when the task starts from field investigation, real-device confirmation, external tool behavior, POS/register integration, CSV/TSV/report format changes, operator workflow discoveries, or a finding that may change source design assumptions. Otherwise write `not applicable` and why.

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary |  |  |
| Fact check / design decision split |  |  |
| Lifecycle / retry |  |  |
| Operator workflow |  |  |
| Replacement path |  |  |
| Data safety / evidence |  |  |
| Reporting / accounting semantics |  |  |
| Manual verification |  |  |

## Design Readiness

State whether the design is ready for implementation.

- Existing design docs are sufficient because:
- Source docs updated in this PR:
- Design gaps intentionally deferred:
- Durable decisions discovered in this plan and promoted to source docs:

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`):
- Backend function design:
- Command / DTO / data contract:
- Persistence / transaction / audit impact:
- Operator workflow / Japanese UI wording:
- Error, empty, retry, and recovery behavior:
- Testability and traceability IDs:

## Contract Probe

Required for R3/R4 plans that rely on an unverified external premise (external library behavior, OS/hardware behavior, etc.). Record the minimal experiment and its result as one line per premise. If not applicable, state N/A and the reason in one line instead of deleting the section.

- <unverified external premise>: <experiment> -> <result>

## Contract Coverage Ledger

Required for R3/R4. Include every contract or design decision in the touched source-doc sections; a missing row is a Plan Gate blocker. Re-verify every row against real implementation at independent-review.

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
|  |  |  |  |

## Test Plan

For R3/R4, include or link a Test Design Matrix.

- targeted tests:
- negative tests:
- compatibility checks:
- data safety checks:
- main wiring/integration checks:

## Boundary / Wire Contract

Required when the change touches JSON API, browser state, CSV, config, manifest, cache schema, Tauri command DTOs, generated bindings, report output, or DB-backed compatibility.

- producer:
- consumer:
- wire type:
- internal type:
- precision/range:
- round-trip path:
- invalid input:
- compatibility:

## Review Focus

- <what reviewers should focus on>

## Spec Contract

Required for R3/R4.
Use at least one data row. Put concrete test names in the Test column when a regression test exists; use review/evidence labels only for plan-only checks.

Contract ID: <SPEC-...>

- <contract>

## Trace Matrix

Required for R3/R4.

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|

## Data Safety

Required for R3/R4.

- <what must not be committed>
- <local-only paths>
- <synthetic-only paths>

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: <not yet frozen|frozen after Broad Audit>; post-freeze exceptions: <none|reason>.
