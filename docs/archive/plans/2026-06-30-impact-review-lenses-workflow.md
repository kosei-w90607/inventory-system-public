# Impact Review Lenses Workflow Plan

## Risk

Risk: R2

Reason:
This changes workflow source docs, the workflow-start skill, and the Plan Packet template. It does not change runtime behavior, product contracts, DB schema, POS file parsing, PLU output, or merge gates.

## Goal

Make field investigation / real-device / external integration follow-up reviews pick up the missed-issue lenses automatically during the normal workflow path, without requiring the owner to remember a special prompt.

## Scope

- Add canonical Impact Review Lenses to `docs/DEV_WORKFLOW.md`.
- Add a matching recording section to `docs/templates/plan-packet.md`.
- Add workflow-start triage and artifact rules that trigger the lenses for applicable tasks.
- Add review-only sub-agent packet guidance so the same lenses can be handed to a fresh reviewer.
- Record the durable workflow decision in `docs/decision-log.md`.
- Update `Plans.md` so the active UI-08 field-check work records this workflow hardening.

## Non-scope

- No runtime code changes.
- No new machine enforcement or hook.
- No changes to POS/PLU product design beyond making future reviews more reliable.
- No review-only sub-agent requirement for this R2 docs/workflow change.

## Acceptance Criteria

- `docs/DEV_WORKFLOW.md` contains a canonical Impact Review Lenses section.
- `docs/templates/plan-packet.md` contains an `Impact Review Lenses` section.
- `.agents/skills/inventory-workflow-start/SKILL.md` instructs Codex to apply the lenses for field-check / external-integration / operator-workflow discovery tasks.
- `docs/templates/subagent-review-packet.md` and `.agents/skills/review-only-subagent/SKILL.md` instruct Codex to include the lenses in review-only packets when present or applicable.
- `docs/decision-log.md` records the durable workflow decision as `D-024`.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.
- `bash scripts/doc-consistency-check.sh` exits 0.

## Design Sources

- Requirements / spec: not applicable; workflow-only change.
- Architecture: not applicable; no product architecture change.
- Function / command / DTO: not applicable.
- DB: not applicable.
- Screen / UI: not applicable.
- Decision log / ADR: `docs/decision-log.md`
- Workflow: `docs/DEV_WORKFLOW.md`, `.agents/skills/inventory-workflow-start/SKILL.md`, `.agents/skills/review-only-subagent/SKILL.md`, `docs/templates/plan-packet.md`, `docs/templates/subagent-review-packet.md`, `docs/project-profile.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | None | existing sufficient |
| Command / DTO / generated binding / wire shape | None | existing sufficient |
| DB / transaction / audit / rollback / migration | None | existing sufficient |
| Screen / UI / route state / Japanese wording | None | existing sufficient |
| CSV / TSV / report / import / export format | None | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` workflow decision | updated in this PR |
| Workflow source | `docs/DEV_WORKFLOW.md`, `inventory-workflow-start`, Plan Packet template, review-only packet/template | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-IMPACT-LENSES-2026-06-30 | `docs/DEV_WORKFLOW.md` Impact Review Lenses | D-024 | Owner prompt memory is unreliable; rejected prompt-only or plan-only storage | workflow docs / skills / templates | docs consistency checks |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes; `docs/DEV_WORKFLOW.md` owns the canonical lenses and `D-024` records the reason.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: yes; D-024 captures the durable workflow choice.
- Assumptions and constraints: this is guidance and evidence structure only; machine enforcement remains out of scope.
- Deferred design gaps, risk, and follow-up target: Workflow Effectiveness Review is scheduled after the next applicable R2/R3 field-check or external-integration task dogfoods the lenses.
- Test Design Matrix can cite design decision IDs or source doc sections: not required for R2 workflow docs; this Plan Packet cites D-024.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Applicable as a lens to preserve for POS/external integrations; no product boundary changed in this PR | `docs/DEV_WORKFLOW.md`, template |
| Fact check / design decision split | Applicable for field investigations; the lens is now part of Design Phase | `docs/DEV_WORKFLOW.md`, template |
| Lifecycle / retry | Applicable for import/export/operator workflows; lens added for future plans | `docs/DEV_WORKFLOW.md`, template |
| Operator workflow | Applicable for real store operation discoveries; lens added for future plans | `docs/DEV_WORKFLOW.md`, template |
| Replacement path | Applicable for replaceable external systems; lens added for future plans | `docs/DEV_WORKFLOW.md`, template |
| Data safety / evidence | Applicable for real store/POS evidence; lens added for future plans | `docs/DEV_WORKFLOW.md`, template |
| Reporting / accounting semantics | Applicable for sales/report/inventory interpretation changes; lens added for future plans | `docs/DEV_WORKFLOW.md`, template |
| Manual verification | Applicable for assertions requiring Windows native, external tool, or real-device checks | `docs/DEV_WORKFLOW.md`, template |

## Design Readiness

State: ready for docs/workflow implementation.

- Existing design docs are sufficient because: `docs/DEV_WORKFLOW.md` already defines Design Phase, Plan Packet rules, workflow changes, and dogfood/WER expectations.
- Source docs updated in this PR: `docs/DEV_WORKFLOW.md`, `.agents/skills/inventory-workflow-start/SKILL.md`, `.agents/skills/review-only-subagent/SKILL.md`, `docs/templates/plan-packet.md`, `docs/templates/subagent-review-packet.md`, `docs/decision-log.md`, `Plans.md`.
- Design gaps intentionally deferred: machine enforcement and examples beyond this active Plan Packet.
- Durable decisions discovered in this plan and promoted to source docs: D-024.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): not applicable; no runtime layer change.
- Backend function design: not applicable.
- Command / DTO / data contract: not applicable.
- Persistence / transaction / audit impact: not applicable.
- Operator workflow / Japanese UI wording: workflow guidance only; no user-facing app UI.
- Error, empty, retry, and recovery behavior: lens added for future work; no runtime behavior changed.
- Testability and traceability IDs: SPEC-WF-IMPACT-LENSES-2026-06-30 / D-024.

## Test Plan

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan`
- compatibility checks: `bash scripts/doc-consistency-check.sh`
- data safety checks: `git status --short --branch` shows only repo docs/workflow files and no external field-check files.

## Boundary / Wire Contract

Not applicable. No JSON API, browser state, CSV, config, manifest, cache schema, Tauri command DTO, generated binding, report output, or DB-backed compatibility contract changes.

## Review Focus

- Is the canonical lens list in `docs/DEV_WORKFLOW.md`, not duplicated as product truth in a skill?
- Does `inventory-workflow-start` trigger the lenses at the right task types?
- Does the Plan Packet template make future use visible in PR evidence?
- Is the workflow change scoped to guidance and evidence, without adding unimplemented machine enforcement?

## Implementation Results

- Added canonical Impact Review Lenses to `docs/DEV_WORKFLOW.md`.
- Added `Impact Review Lenses` to `docs/templates/plan-packet.md`.
- Updated `.agents/skills/inventory-workflow-start/SKILL.md` so field-check / external-integration / operator-workflow discovery tasks apply the lenses during Design Phase and record them in the Plan Packet.
- Updated `docs/templates/subagent-review-packet.md` and `.agents/skills/review-only-subagent/SKILL.md` so the same lenses can be handed to review-only sub-agents as review prompts.
- Added durable workflow decision `D-024` to `docs/decision-log.md`.
- Updated `Plans.md` with the active workflow hardening item and dogfood/WER expectation.
- Validation:
  - `bash scripts/doc-consistency-check.sh --target plan` -> pass
  - `bash scripts/doc-consistency-check.sh` -> pass

## Review Response

Review-only skipped because: R2 docs/workflow guidance change with no runtime contract, merge gate, POS format, DB, command DTO, operator UI, or data lifecycle impact. Local docs gates are the planned verification.
