---
name: inventory-workflow-start
description: "Entry and resume router for inventory-system AI Quality Workflow. Use when the user asks to start, resume, plan, implement, modify code/docs, prepare a scoped task, classify risk, or apply the repo workflow. It follows the canonical entry and state machine, selects an availability-based execution mode, and stops at human gates. Do not use for simple factual questions or review-only requests that already trigger a dedicated review skill."
---

# Inventory Workflow Start

## Purpose

Start inventory-system work without asking the user to remember workflow prompts. Classify risk, choose the lightest sufficient workflow, and route to the repo-local skills.

## Required Reading

Follow the single canonical reading order in `AGENTS.md` `Session Start`; do not restate or reorder it here.

## Start / Resume Router

1. Identify the request scope and task identity before selecting any packet. Decide whether the request resumes the same current task or starts a genuinely new change; do not attach an unrelated request to whichever packet happens to be active. Classify Risk from `docs/DEV_WORKFLOW.md` before requiring plan artifacts.
2. For R0/R1, do not select or create a Plan Packet and do not require Workflow State or Plan Commit. Route directly to the targeted checks in the Risk table, report `Current Phase: not applicable`, and still honor repository-wide blockers recorded in `Plans.md` or the governing source docs.
3. For an R2+ task being resumed, use its current-work entry in `Plans.md` to select the single active Plan Packet. Apply `docs/DEV_WORKFLOW.md` `Workflow State` packet-selection and fail-closed rules exactly; never guess among missing, conflicting, stale, or malformed packets. Read the complete state and resume idempotently from its recorded Phase without repeating completed phases or silently advancing it.
4. For a genuinely new R2+ change, start at kickoff rather than reusing another task's packet. Still honor repository-wide blockers and blocking workflow follow-ups recorded in `Plans.md` or the governing source docs. Determine required artifacts from `docs/DEV_WORKFLOW.md`. For every risk tier, determine `Execution Mode` from `docs/AGENT_OPERATING_MANUAL.md` based on available roles. Missing a scarce/highest-capability slot or a vendor capability changes the mode; it does not block the workflow.
5. For R2+, derive the next action from the next valid transition in `docs/DEV_WORKFLOW.md`: kickoff/spec-check/design prepare design evidence; plan-draft/plan-gate complete and independently review artifacts; plan-approved enters implementation; implementing verifies the content candidate and records L1 in the PR body; local-verified enters independent review; independent-review adjudicates findings, then a state-only commit records `Reviewed Content HEAD` and `human-confirm`; human-confirm stops for the named human gate; after owner authorization, a Draft state-only commit enters ready-hosted-final, exact-HEAD L1/PR body/Ready or dispatch all use that resulting HEAD; merge creates no further tracked pre-merge commit; archive follows Post-Merge Closeout. One state-only commit may materialize multiple adjacent forward transitions only when every transition's evidence predates the commit and the append-only narrative reconstructs every intermediate phase; never use this recording compression to bypass Plan Gate or owner authorization.
6. Before work begins, report Risk, Execution Mode, required artifacts, current Phase, next action, and unresolved questions. For R2+, if the state is pre-plan-approved, do not route to implementation. If design questions remain unresolved, return to Design Phase.
7. Stop at every human gate. Never mark Ready, run an owner-only Ready transition, merge, or close without explicit owner direction.

## Triage

1. Identify request mode: simple question, plan only, implementation, docs/workflow change, PR-prep, or review-only.
2. If review-only, route to `$inventory-code-review` or `$pr-review` and do not use this skill as the main workflow.
3. Classify Risk Level using `docs/project-profile.md` and `docs/DEV_WORKFLOW.md`.
4. If uncertain between R2 and R3, choose R3 when DB, POS CSV, PLU TSV, Tauri command DTO, report CSV, route/search state, operator workflow, generated bindings, source design contracts, or merge gates may be affected.
5. If the request involves field investigation, real-device confirmation, external tool behavior, POS/register integration, CSV/TSV/report formats, operator workflow discoveries, or a finding that may change source design assumptions, apply `docs/DEV_WORKFLOW.md` Impact Review Lenses during Design Phase and record them in the Plan Packet.
6. State the classification briefly before proceeding.

## Routing

`docs/DEV_WORKFLOW.md` is the source of truth for Risk routing, phase transitions, artifacts, gates, review requirements, and workflow-change dogfood. This skill only selects the applicable route and hands it off; it does not redefine the table.

## Handoff

- Continue implementation with `$inventory-implementation`; R0/R1 use its no-Plan route, while R2+ require the valid Workflow State entry defined above.
- Use `$inventory-operator-ui` for inventory-system operator-facing UI design, implementation, or review work.
- Use `$inventory-code-review` for inventory implementation review.
- Use `$pr-review` for external-style PR/diff review.
- Do not use the generic `$implementation` skill as the main workflow when this repo-local skill applies.
- Do not use generic `$frontend-design` or `$web-design-guidelines` as the main UI guidance when `$inventory-operator-ui` or inventory UI docs apply.

## Artifact Rules

- Enumerate the artifacts required by the selected route from `docs/DEV_WORKFLOW.md`; do not create a second artifact policy here.
- Reuse an adequate active artifact instead of recreating it. For routes that require artifacts (R2+), missing or inconsistent required artifacts are a stop condition, not permission to infer completion. R0/R1 do not gain a Plan Packet requirement here.
- For workflow changes, preserve the dogfood target and Workflow Effectiveness Review follow-up in the Plan Packet and `Plans.md`.
- For post-implementation resume, read tracked Phase / `Reviewed Content HEAD` together with the PR body's final evidence. Treat a PR-body SHA mismatch or a state-only commit with forbidden hunks as a stop condition under `docs/DEV_WORKFLOW.md` D-035.

## Output Shape

For kickoff:

```md
## Workflow Kickoff
- Risk: Rn
- Reason: ...
- Execution Mode: fable-window | dual-vendor-no-fable | codex-only
- Required artifacts: ...
- Current Phase: <Workflow State phase | not applicable for R0/R1>
- Next action: ...
- Open questions: ...
```

For final:

```md
## Workflow Result
- Risk handled: ...
- Artifacts created/updated: ...
- Validation: ...
- Workflow effectiveness review: completed / scheduled / not required, with reason
```

## Rules

- Treat AI validation claims as claims until checked against files, tests, diffs, specs, or generated outputs.
- Do not commit real POS CSV, PLU export files, store data, DB files, backups, logs, receipt images, secrets, credentials, or `.env` data.
- Do not silently widen scope beyond the Plan Packet.
- Do not let Plan Packets become the only home for durable design decisions; promote design to source docs or decision-log.
- Do not use review-only sub-agent findings as authority without independent verification.
