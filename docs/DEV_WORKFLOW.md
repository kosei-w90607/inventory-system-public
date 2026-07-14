# Development Workflow

This is the inventory-system workflow index. Keep the detailed product truth in the linked source documents, and keep this file focused on how work moves from request to review.

## Flow

`0. Kickoff -> 1. Spec Check -> 2. Design -> 3. Plan -> 4. Implement -> 5. Verify -> 6. Review -> 6.5 Draft PR -> 7. Human Confirm / Ready -> 8. Archive`

## Source Index

| Purpose | Source |
|---|---|
| Agent entry and safety | [../AGENTS.md](../AGENTS.md) |
| Stable memory | [project-memory.md](project-memory.md) |
| Live dashboard | [Plans.md](../Plans.md) |
| Workflow profile | [project-profile.md](project-profile.md) |
| CI routing | [ci.md](ci.md) |
| Current spec map | [spec/README.md](spec/README.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md), `docs/architecture/` |
| Function contracts | [FUNCTION_DESIGN.md](FUNCTION_DESIGN.md), `docs/function-design/` |
| DB contracts | [DB_DESIGN.md](DB_DESIGN.md), `docs/db-design/` |
| Screen and UI contracts | [SCREEN_DESIGN.md](SCREEN_DESIGN.md), [UI_TECH_STACK.md](UI_TECH_STACK.md), [design-system/README.md](design-system/README.md) |
| Review checklist | [quality/review-checklist.md](quality/review-checklist.md), [code_review.md](code_review.md) |
| ADR index | [adr/README.md](adr/README.md) |
| Doc style | [DOC_STYLE_GUIDE.md](DOC_STYLE_GUIDE.md) |

## Artifact Map

| Artifact | Location | Rule |
|---|---|---|
| Live dashboard | [Plans.md](../Plans.md) | Current phase, active work, blockers, next actions only. |
| Active plan packets | `docs/plans/` | Dated `YYYY-MM-DD-*.md` files. R2+ should use [templates/plan-packet.md](templates/plan-packet.md). |
| Test design matrices | `docs/plans/test-matrices/` | Required for R3/R4, optional for tricky R2. |
| Archived plans | `docs/archive/plans/` | Completed or superseded task evidence. |
| Review packets | [templates/subagent-review-packet.md](templates/subagent-review-packet.md) | Use before PR/external review for R3/R4. |
| ADRs | [adr/README.md](adr/README.md) | New durable decisions use [templates/adr.md](templates/adr.md). |
| Workflow effectiveness | [templates/workflow-effectiveness-review.md](templates/workflow-effectiveness-review.md) | Use after R3/R4 or workflow changes when evidence exists. |
| Workflow Skills | [inventory-workflow-start](../.agents/skills/inventory-workflow-start/SKILL.md), [inventory-implementation](../.agents/skills/inventory-implementation/SKILL.md), [inventory-code-review](../.agents/skills/inventory-code-review/SKILL.md), [inventory-operator-ui](../.agents/skills/inventory-operator-ui/SKILL.md) | Codex/OpenAI harness entrypoints. Other agents can read them as plain procedure docs. |

## Risk Tiers

Risk is based on impact, not file type.

| Risk | Meaning | Required workflow |
|---|---|---|
| R0 | Typo, link, non-semantic doc cleanup. | No Plan Packet. Run doc check when relevant. |
| R1 | Local refactor or isolated helper with unchanged contracts. | Targeted tests or lint as relevant. |
| R2 | Local developer workflow, UI helper, fixture, or docs change that affects maintainability but not runtime contracts. | Plan Packet. Test Matrix optional. |
| R3 | DB, POS CSV, PLU TSV, Tauri command DTO, report CSV, route/search state, operator workflow, or merge gate changes. | Plan Packet, Test Matrix, targeted gates, review-only sub-agent by default. |
| R4 | Destructive data lifecycle, backup restore, real POS/store data exposure, secrets, irreversible git/local cleanup. | R3 workflow plus explicit human approval and rollback/recovery notes. |

If uncertain between R2 and R3, choose R3 when the change touches a stable contract, output schema, data safety boundary, command wire shape, UI route/search behavior, or workflow gate.

## Plan Packet Rules

- Plan Packets are implementation planning artifacts, not durable design source of truth.
- Every R2+ Plan Packet `Goal` defines a **Goal Invariant** with three parts: the user-visible minimum completion condition, the failure definition, and explicit non-goals. Adjudication priority is `Goal Invariant > Acceptance Criteria > supporting evidence`; an AC or evidence task that no longer advances the Goal Invariant must be simplified, deferred, or removed rather than becoming a substitute goal.
- Before writing or updating a Plan Packet for R2+ work, run Design Phase: confirm whether the source design docs are sufficient for implementation.
- R2+ active plans live under `docs/plans/` and use [templates/plan-packet.md](templates/plan-packet.md).
- R3/R4 plans must include `Spec Contract`, `Trace Matrix`, `Data Safety`, and a Test Design Matrix.
- R3/R4 plans must include `Design Sources` and `Design Readiness`: either cite the updated source design docs or state why existing design docs are sufficient.
- Changes that touch JSON, browser state, CSV, config, manifest, cache schema, Tauri command DTOs, or generated bindings must fill `Boundary / Wire Contract`.
- R3/R4 plans that rely on an unverified external premise (external library behavior, OS/hardware behavior, etc.) must run a **Contract Probe** — a minimal experiment — before Plan Gate and record the result as one line in the packet; this extends the existing Impact Review Lenses "Fact check / design decision split" lens rather than duplicating it as a new concept. The probe inspects the concrete artifacts the premise depends on — e.g. CI workflow config files, experiment scripts, or `git log` commit-subject history — not narrative claims alone.
- Active plans are checked by `bash scripts/doc-consistency-check.sh --target plan`. If there are no active plans, run the full docs check instead; when changing archived plans, check the changed archive files by explicit path.
- Completed plans move to `docs/archive/plans/` with evidence preserved.
- For R2+ work, the Plan Packet's Scope and Test Design Matrix must be authored and committed before implementation code is written — as a change separate from the implementation commit, not folded into it. This applies regardless of who implements (Claude, Codex, or a sub-agent): letting the implementer author the Plan Packet as part of the same commit that adds implementation code removes the independent check that Plan authoring provides. When a Plan Packet is missing or was only written after the fact, treat design-doc contracts (e.g. specific interaction behaviors, not just data/error contracts) as unverified until the implementation and its tests are checked against the source design doc line by line.

## Workflow State

Every R2+ Plan Packet carries a fixed-format `## Workflow State` section as the machine-checkable per-change state (D-034). The format is a fixed Markdown section, not YAML frontmatter: the existing doc checker (`scripts/doc-consistency-check.sh` PK checks) and this repo's plan templates are Markdown-line based, so a future PK4 check can validate this section with the same line-regex mechanism without adding a YAML parser.

Fields, one `- Key: value` line each:

- `Phase`: kickoff | spec-check | design | plan-draft | plan-gate | plan-approved | implementing | local-verified | independent-review | human-confirm | ready-hosted-final | merge | archive
- `Risk`: R2 - R4 (same value as the packet `Risk` section; R0/R1 do not use a Plan Packet or Workflow State)
- `Execution Mode`: fable-window | dual-vendor-no-fable | codex-only (see [AGENT_OPERATING_MANUAL.md](AGENT_OPERATING_MANUAL.md))
- `Plan Commit`: SHA of the plan-first commit; `pending` until plan-approved
- `Amendments`: `none`, or the SHA list of gated amendments recorded after Plan Gate (see PK5 below); the original `Plan Commit` value is never rewritten
- `Coordinator` / `Writer` / `Plan Reviewer` / `Final Reviewer`: role assignment for this change (role definitions in AGENT_OPERATING_MANUAL; concrete model names appear only as values here, never in normative rules)
- `Reviewed Content HEAD`: `pending` or the SHA of the content-bearing commit audited by the Final Reviewer. It is written only by a later state-only transition commit, so it never claims to be the SHA of the tracked file that contains it
- `Final Exact-HEAD Evidence`: the literal `PR body`. The PR body is the sole authority for the current PR HEAD's L1 evidence SHA and, when required, hosted run URL/headSha; do not embed the current PR HEAD in this tracked field
- `Hosted CI Requirement`: required | not-required. This tracked field records merge-evidence obligation only, never a run URL or headSha. `not-required` does not suppress an otherwise eligible Ready event: a non-doc R2 PR may still run hosted CI under the current workflow. Use it only when [ci.md](ci.md) does not require hosted evidence. Workflow/release changes remain `required` even when their diff is docs-only unless they exactly match one of `ci.md`'s two closed Actions-unavailable routes; those routes define their own compensating evidence and owner disposition. Any observed product/gate failure still blocks; only infrastructure/cancel/availability outcomes on a matching `not-required` route may be accepted by the owner as a recorded residual risk
- `Human Gate`: pending L3 / R4 approval / Ready / merge items, or `none`

Transition table — every transition requires the listed evidence. Phases move forward only through this table:

| Transition | Required evidence / condition |
|---|---|
| kickoff → spec-check | task scoped; Risk classified and recorded in the packet |
| spec-check → design | in-scope source design docs identified; design updates are needed |
| spec-check → plan-draft | the only permitted skip: Design Readiness cites existing design docs as sufficient |
| design → plan-draft | design outputs are in source docs (or in the same plan-first change); no unresolved design questions |
| plan-draft → plan-gate | packet complete and committed; Test Design Matrix committed for R3/R4 (optional for tricky R2, per Risk Tiers) |
| plan-gate → plan-approved | independent Plan Reviewer (not the Writer) reports P1/P2 = 0 on the plan; `Plan Commit` set; the plan-first commit precedes every implementation commit |
| plan-approved → implementing | the only entry into implementation: writing implementation code for the scoped change is allowed only while Phase is plan-approved or implementing |
| implementing → local-verified | L1 `local-ci.sh full` CLEAN evidence for the content candidate; record the candidate SHA and evidence location in the PR body |
| local-verified → independent-review | independent reviewer engaged, or the R3 review-only skip recorded per Review Rules; for R3/R4 the Contract Audit below runs in this phase from source docs — when review-only is skipped, the Final Reviewer runs it directly |
| independent-review → human-confirm | findings adjudicated, P1/P2 = 0; create a state-only transition commit that sets `Reviewed Content HEAD` to the audited content commit and materializes `human-confirm` |
| human-confirm → ready-hosted-final | Human Gate items resolved and owner authorizes Ready; create the state-only Ready transition commit while Draft, run L1 full on that resulting exact HEAD, refresh the whole PR body, then the owner triggers Ready / required dispatch |
| ready-hosted-final → merge | without another tracked commit, PR HEAD = PR-body final L1 SHA = successful hosted run headSha when hosted is required; any observed product/gate failure resolved; a `not-required` infrastructure/cancel outcome is recorded with owner disposition; owner merges |
| merge → archive | Post-Merge Closeout: packet and matrix moved to `docs/archive/plans/`; `Plans.md` synced |

- Every transition not in this table is invalid. A correction returns explicitly to the earliest affected phase and re-walks the table from there. Concretely: a plan-gate rejection corrected in place stays at plan-gate for re-review; a rejection that invalidates Scope or design returns to plan-draft or design; an independent-review finding that needs a code fix returns to implementing; a fix after Ready returns the PR to Draft and the Phase to implementing.
- A correction that moves to an earlier phase is a D-035 state-only transition commit and uses the canonical subject `docs(plans): state-backtrack <from>-><to>`. It records exactly one backward transition to the earliest affected phase, is excluded from the forward STATECAP count, and cannot contain a forward transition, same-phase transition, unknown phase, or transition chain. Two `state-backtrack` commits may not be adjacent in history: splitting one multi-phase jump into consecutive single-hop commits is the same forbidden chain and fails the git check; legitimate separate corrections have real work commits between them. The state-only file allowlist and zero-context hunk audit still apply. After the backtrack, re-walk forward transitions under the normal evidence rules. Preserve the original `Plan Commit`; if the correction changes a gated packet contract, record the reviewed change as an append-only `Amendments` SHA instead of rewriting the original plan identity.
- A state-only commit may materialize multiple **adjacent forward transitions** from the table when every transition's required evidence already exists before that commit. The packet's append-only narrative must name the complete sequence and evidence. This is recording compression, not a phase skip: implementation content remains forbidden until the `plan-gate -> plan-approved` evidence exists, and every intermediate transition must be reconstructable. For example, after a fresh Plan Reviewer reports P1/P2 = 0 and the plan-first commit is known to precede implementation, one state-only commit may materialize `plan-gate -> plan-approved -> implementing` immediately before implementation begins.
- Fail-closed rule: any reader — a resume procedure, reviewer, or implementer — that finds the `## Workflow State` section missing, incomplete, or holding a value outside the enums must treat the packet as still pre-plan-gate: no implementation, no phase progression, no Ready. Report the defect to the owner instead of repairing it silently. This rule applies from day one, independent of whether the mechanical PK4 check has landed.
- Packet selection rule for resume: start from the single active packet linked from the current-work section of `Plans.md`. If `docs/plans/` holds multiple active packets for the task, the packet disagrees with `Plans.md`, the linked packet is missing, or the packet's branch/PR no longer matches the work being resumed, stop and report to the owner instead of picking one (same fail-closed posture).

State / evidence separation (D-035):

- A tracked file cannot contain its own commit SHA. `Reviewed Content HEAD` therefore identifies the earlier content-bearing commit reviewed by the Final Reviewer; it is not merge evidence and need not equal the current PR HEAD.
- A **state-only transition commit** may change only Workflow State, `Plans.md`, and append-only narrative review/evidence records. Within the packet, Scope, Non-scope, Acceptance Criteria, Design, contracts, matrices, and implementation instructions are forbidden even though they share the same file. Validate both the file allowlist and the zero-context diff hunks. If any forbidden content changes, it is a new content commit: return to `implementing`, rerun review, and do not use the state-only exception.
- Under the adjacent-transition rule above, after the Final Reviewer reports P1/P2 = 0, one state-only transition commit may materialize the already-evidenced `local-verified → independent-review → human-confirm` sequence. The PR body must name the content candidate, its L1 evidence, reviewer result, and the resulting state-only HEAD.
- After owner Ready authorization, create the `ready-hosted-final` state-only transition commit while the PR is still Draft. Run L1 full on that resulting HEAD and update the PR body. Ready / explicit dispatch must run on that same HEAD. Do not commit the L1 SHA or hosted URL back into the packet.
- The merge gate has one definition: compare the live PR HEAD with `Local full evidence HEAD SHA` in the PR body and, when required, the hosted run `headSha`. All must be identical. `Reviewed Content HEAD` is audit traceability and is deliberately excluded from this three-point match.
- `merge` is the external owner merge event; do not create a pre-merge phase-only commit after hosted final. Post-Merge Closeout records the merged state and moves the packet to `archive` on subsequent work.

**Evidence Ownership** (D-038, extends D-035): test counts are volatile evidence exactly like exact-HEAD SHAs — do not transcribe them into tracked docs (Plan Packet, `Plans.md`, source docs); the PR body and CI output remain the sole authority. This applies to descriptions written from 2026-07-12 forward only; already-archived packets and WERs are not revised retroactively. State-only transition commits are capped at 3 per PR (counting only forward `state-only遷移` subjects; `state-backtrack` correction commits are governed by the backtrack contract above, not by this cap): one may materialize the plan-approval entry (`plan-gate → plan-approved → implementing`, per the existing compression rule's canonical example) and two match the required post-implementation transitions in the table above (`independent-review → human-confirm` and `human-confirm → ready-hosted-final`); every other transition rides an adjacent content commit under the existing compression rule.

**Plan Commit ancestry (D-039, PK5)**: `Plan Commit`'s SHA must be an ancestor of the first implementation commit; the check runs at the pre-merge gate (pre-push / local-ci), since squash merge breaks ancestry afterward. The original `Plan Commit` is immutable once set. A **gated amendment** is a packet modification that happens after Plan Gate (plan-approved): it never rewrites the original `Plan Commit`, only appends its SHA to the `Amendments` line; rewriting the original is a PK5 violation. The canonical state-only commit subject is `docs(plans): state-only遷移 <from>-><to>[->…]`, because the post-implementation state-only cap (Evidence Ownership above) is judged from the transition-name tokens in that subject. Vocabulary: "checker" is `scripts/doc-consistency-check.sh` (the PK checks); "drift test" is a bash test under `scripts/tests/`.

The Writer updates this section at each materialized tracked transition. Keep it state-only, apply the state-only transition rules above, and put volatile exact-HEAD evidence in the PR body.

## Design Phase Rules

Design Phase sits between Spec Check and Plan. It is required whenever R2+ work might change source docs, shared UI behavior, workflow gates, command/data contracts, or operator-facing behavior.

Design inputs:

- Requirements and spec map: `docs/spec/requirements.md`, `docs/spec/requirements-coverage.md`, `docs/spec/README.md`
- Architecture / layer design: `docs/ARCHITECTURE.md`, `docs/architecture/`
- Function / command / DTO design: `docs/FUNCTION_DESIGN.md`, `docs/function-design/`
- DB design: `docs/DB_DESIGN.md`, `docs/db-design/`
- Screen / UI design: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`
- Durable decisions: `docs/decision-log.md` and ADR index where relevant

Design artifact selection:

| Upcoming spec / change touches | Required design artifact before Plan |
|---|---|
| New or changed BIZ, IO, CMD, service, repository, validation, error, invariant, or cross-layer behavior | Update `docs/FUNCTION_DESIGN.md` and the relevant `docs/function-design/` file, or create a new function-design file. |
| New or changed Tauri command, DTO, generated binding, frontend command contract, or JSON wire shape | Update the relevant CMD/function-design doc and `Boundary / Wire Contract` in the Plan Packet. |
| New or changed table, column, index, migration, transaction boundary, idempotency, audit/log, rollback, or persistence behavior | Update `docs/DB_DESIGN.md` and the relevant `docs/db-design/` file. |
| New or changed operator workflow, route/search state, form/table behavior, empty/error/retry UI, Japanese wording, or Windows native interaction | Update `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, and the relevant UI function-design file. |
| New or changed CSV/TSV/report/import/export format or compatibility rule | Update the relevant architecture/function/DB design docs and record the format contract in `Boundary / Wire Contract`. |
| Durable cross-cutting choice, workflow gate change, architecture tradeoff, or decision likely to be revisited | Add or update `docs/decision-log.md` or an ADR. |
| Existing design docs already cover the upcoming work without ambiguity | Cite the exact source docs in `Design Sources` and explain sufficiency in `Design Readiness`; do not duplicate durable design in the Plan Packet. |

Design outputs:

- Updated source design docs when behavior, contracts, boundaries, UI state, or workflow gates change.
- Function design docs under `docs/function-design/` when backend service, repository, command, DTO, validation, or error behavior is newly designed or changed.
- DB design docs under `docs/db-design/` when schema, transaction, persistence, audit, or rollback behavior is newly designed or changed.
- Screen / UI design docs only when operator interaction, route/search state, visual behavior, or Japanese UI wording is in scope.
- A decision-log or ADR entry when the choice is durable, cross-cutting, or likely to be revisited.
- A Plan Packet `Design Sources` / `Design Readiness` section that cites the source docs and states whether design is ready for implementation.
- A Plan Packet `Design Intent Trace` section for R3/R4 work that connects spec IDs, design doc sections, design decision IDs, implementation targets, and test targets.

Design decision IDs:

- Requirement/spec IDs are the trace root: `REQ`, `SP`, `UI`, `BIZ`, `CMD`, `IO`, `MNT`, or workflow/spec IDs used by the touched docs.
- Local design decisions use a child ID of the root, such as `UI-01a-D1`, `BIZ-08-D2`, `CMD-03-D1`, or `SPEC-WF-DESIGN-PHASE-2026-06-09-D1`.
- Cross-cutting durable decisions use `docs/decision-log.md` IDs or ADR IDs, and the local design decision ID should cite that durable record.
- Source design docs carry the decision, why, rejected alternatives, and revisit trigger. Plan Packets cite those records but do not become their only durable home.

Design intent audit:

- Before implementation, check whether a future implementer can answer "what are we building, why this design, and what was rejected" from source docs alone.
- Check whether every in-scope spec/requirement ID has a design artifact selected, or a documented reason why existing design is sufficient.
- Check whether every durable design decision in the Plan Packet is promoted to source docs, `docs/decision-log.md`, or an ADR.
- Check whether assumptions, constraints, and deferred design gaps are explicit enough to review, test, or schedule as a follow-up.
- Check whether the design describes the intended finished product capability before implementation slicing. A PR may deliver a smaller safe increment, but source docs should not shrink the business need just because the first implementation slice is smaller.
- Check whether the Test Design Matrix can cite design decision IDs or source doc sections for the failure modes it covers.
- When adding or revising a behavior spec, temporarily evaluate it at the higher plausible risk tier if it touches route/search state, data lifecycle, validation, security boundaries, or operator recovery. Compare adjacent specs, distinguish "same pattern" from "different scenario", and record the required mitigation in the source design doc instead of leaving it only in the Plan Packet.

Impact Review Lenses:

Use these lenses during Design Phase whenever the task starts from field investigation, real-device confirmation, external tool behavior, POS/register integration, CSV/TSV/report format changes, operator workflow discoveries, or a finding that may change source design assumptions. The goal is to make the agent pick up the missed-issue checklist without the owner supplying a special prompt.

| Lens | Question to answer | Evidence home |
|---|---|---|
| Adapter / core boundary | Which concepts belong to replaceable external adapters, and which concepts are stable app-core contracts? | Architecture, function design, decision-log, Plan Packet |
| Fact check / design decision split | Which claims are observed facts from hardware/tool/files, and which are app decisions that need source-doc promotion? | Investigation doc, source design docs, decision-log |
| Lifecycle / retry | What happens before, during, after, and after failure for import/export, duplicate input, rollback, retry, cancellation, and re-run? | Function design, DB design, UI design, Test Matrix |
| Operator workflow | What does the operator do in the real sequence across app, external tool, media, print/export, backup, and recovery? | Screen/UI design, function design, Plan Packet manual checks |
| Replacement path | If the external system changes, which files/modules/docs are replaced and which app-core contracts remain stable? | Architecture, function design, decision-log |
| Data safety / evidence | How can the claim be supported by anonymized shape/count/hash/procedure evidence without committing real store data? | Plan Packet Data Safety, investigation doc, review evidence |
| Reporting / accounting semantics | Are totals, summaries, item records, returns, corrections, and inventory movements modeled separately enough to avoid false business meaning? | DB design, function design, report design, Test Matrix |
| Manual verification | Which assertions cannot be proven by automated tests and require Windows native L3, external tool import, or real-device confirmation? | Plan Packet, Test Matrix, PR body |

For applicable R2+ work, record the lenses used in the Plan Packet `Impact Review Lenses` section. If a lens is not applicable, state why in one line instead of deleting the section.

Backfill note:

- Design Phase is not a blanket backfill requirement. Because this workflow was adopted mid-project, backfill historical design gaps only when the area is about to change, is a dependency for upcoming work, is high-risk, or review/testing exposes missing design intent.

Design checklist:

- Layer ownership: which responsibility belongs to UI, CMD, BIZ, IO, and MNT; CMD remains thin and product rules stay in BIZ or source design docs.
- Backend function design: service/repository/command function responsibilities, inputs/outputs, validation, error variants, invariants, and cross-layer call flow.
- Command / data contract: DTO fields, validation, error shape, generated binding impact, CSV/report format, URL/search state, and backward compatibility.
- Persistence and safety: transaction boundary, idempotency, audit/log behavior, rollback/recovery path, and whether schema or migration design changes.
- Operator workflow: intended user action, normal path, empty / error / retry paths, and Japanese UI wording when relevant.
- Adjacent-spec consistency: similar flows, sibling routes, return paths, filters, and recovery actions are compared explicitly. If the new behavior is a different scenario, the source doc states the scenario and the accepted differences.
- Filter / select controls: source of complete option lists, whether options come from master data or current results, and why paginated / filtered result rows are safe or rejected as option sources.
- Testability: requirement/spec IDs, unit/integration/UI checks, negative cases, fixtures, and whether Windows native or hardware-adjacent verification is needed.
- Scope control: what the completed capability should eventually include, what this PR deliberately defers, why it is safe to defer implementation, and where the follow-up is recorded.

Design completion criteria:

- A future implementer can understand the intended behavior from source design docs without reading chat history or archived Plan Packets.
- The Test Design Matrix can be derived from the source design docs without inventing missing behavior.
- The Plan Packet only scopes implementation and tests; it does not become the only home for durable design decisions.
- If design is missing, stale, ambiguous, or has an unresolved placeholder for an in-scope behavior, update source design docs before implementation or explicitly keep the work in design-only scope.
- If a Plan Packet discovers a durable design decision during implementation, promote it to source docs in the same PR or record a concrete follow-up before merge.

## Implementation Rules

- Start from the canonical reading order in [../AGENTS.md](../AGENTS.md) `Session Start`. Do not restate that order anywhere, including this file; link to it.
- Use `$inventory-workflow-start` ([Skill doc](../.agents/skills/inventory-workflow-start/SKILL.md)) for kickoff and `$inventory-implementation` ([Skill doc](../.agents/skills/inventory-implementation/SKILL.md)) for scoped implementation work.
- `$...` workflow skills are Codex/OpenAI harness entrypoints under `.agents/skills/`. Claude Code sessions that do not load those skills should follow `AGENTS.md`, this document, and the linked Skill files as plain procedure docs.
- Keep `UI -> CMD -> BIZ -> IO/MNT` intact. UI must not call IO. CMD must stay thin.
- Put product rules in BIZ or design docs, not in presentational UI wrappers.
- Attach REQ, SP, UI, BIZ, CMD, IO, MNT, or design section IDs to tests when the touched area has traceability.
- Behavior changes update the relevant source document in the same change.
- Implementation must not start from a Plan Packet that contains unresolved design questions. Return to Design Phase first.
- Implementation must not start before a Plan Packet exists and its `Workflow State` Phase has reached plan-approved (see Plan Packet Rules and the Workflow State transition table: Scope + Test Design Matrix committed as a change separate from the implementation commit, independent Plan Reviewer P1/P2 = 0).
- Do not commit real POS CSV, PLU exports, DB files, backups, logs, receipt images, secrets, or local app data.
- Session coordination tools such as `goal` or `$agmsg` may organize work, but durable workflow state belongs in repository evidence: `Plans.md`, Plan Packets, PR bodies, archived plans, and source docs.
- Dashboard-only merge baseline sync can be batched with the next related docs cleanup when there is no blocker, user-facing ambiguity, or stale next action.

## Subagent Budget

Risk-tiered ceiling for delegated sub-agents, regardless of harness (D-034):

| Risk / stage | Max concurrent sub-agents |
|---|---|
| R0 / R1 | 0 |
| R2 | 0 - 1 |
| R3 | 2 |
| R4 or workflow gate change | 3 |

- Max delegation depth is 1: sub-agents must not spawn sub-agents.
- One-writer rule: at most one agent holds write ownership of a file set at a time. Write-parallelism requires separate worktrees or non-overlapping file ownership declared in the Plan Packet.
- Sub-agent output contract: a bounded evidence summary (about 20 items max) with file:line references. No raw logs, no full-file dumps.
- Load-bearing decisions (plan gate, final review, finding adjudication) require the responsible role to read the source docs directly; sub-agent summaries are claims until verified.
- Do not re-engage a higher-cost model or reviewer for P3-only findings.

## Owner Effort Budget

R2+ Plan Packets carry a default owner-effort ceiling (D-038): interventions ≤3, hands-on time ≤30 minutes, relay round-trips ≤2. A packet may adjust these with a recorded reason. This ceiling is a hard stop, not a target that the owner absorbs.

- Every owner approval request must state `この change での介入 N 回目 / 予算 M 回` and one sentence explaining what becomes complete from the user's point of view if approved. Include the approximate elapsed hands-on time when known.
- When any ceiling is likely to be exceeded, stop before requesting another approval or generating more evidence, scripts, or ceremony. Restate the Goal Invariant and return to its minimal sufficient completion route; defer optional evidence and follow-ups. If the remaining route cannot fit, report the blocker instead of silently widening the budget.
- An owner's qualitative discomfort such as “this is taking too long” or “I cannot tell what is being built” is a `goal-drift signal`. Stop immediately, compare the current outcome state with the Goal Invariant, classify candidate-safety work separately from supporting evidence, and do not resume until the next step visibly advances the minimum completion condition within the remaining budget.
- For the one-time, irreversible, owner-gated task shape, use the `one-shot irreversible` owner-attended time-boxed session in [AGENT_OPERATING_MANUAL.md](AGENT_OPERATING_MANUAL.md) §3.5. This task-shape choice is separate from the vendor-oriented Execution Mode.

## Verification Gates

CI / merge evidence is a three-layer ladder:

- L0 local changed: `scripts/pre-push.sh` runs fast checks for the push increment.
- L1 local full: `bash scripts/local-ci.sh full` runs the complete local gate set and writes HEAD-SHA evidence under `.local/ci-evidence/`.
- L2 hosted final: GitHub Actions runs only for a completed HEAD at Ready creation/transition or explicit dispatch.

For implementation iteration, use `bash scripts/local-ci.sh changed`. It classifies the PR-wide diff from `git merge-base origin/main HEAD`; it is not the same as the pre-push push increment. Before merge, L1 evidence must be `full`, start and end `CLEAN`, and match the current PR HEAD at both boundaries. Record this final SHA in the PR body, not in a tracked Workflow State field. A gate-created HEAD/tree change fails the run; `DIRTY` evidence is diagnostic only.

| Change area | Commands |
|---|---|
| Docs/design | `bash scripts/doc-consistency-check.sh` |
| Active plan packet | `bash scripts/doc-consistency-check.sh --target plan` |
| Rust/backend | `cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test` |
| Rust design compliance | `cd src-tauri && cargo test --test design_compliance_test` |
| Tauri command DTOs | `cd src-tauri && cargo run --bin generate_bindings`, then inspect `src/lib/bindings.ts` diff |
| Frontend | `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` |
| env or gitignore | `bash scripts/check-env-safety.sh` |
| Traceability (REQ / design docs / tests) | `cd src-tauri && cargo run --bin generate_traceability -- --check` |
| PR-wide changed gate | `bash scripts/local-ci.sh changed` |
| Merge-candidate full gate | `bash scripts/local-ci.sh full` |

Traceability check details (WF-TRACE-01..04): T1 = `docs/function-design/90-traceability.md` drift (ERROR, regenerate with `cd src-tauri && cargo run --bin generate_traceability`), T2 = REQ ID used by tests but missing from `docs/spec/requirements.md` (ERROR), T3 = REQ with zero tests and `coverage=required` (WARN only; `coverage=deferred` is excluded until implementation starts), T4 = count of FE test files without `REQ-NNN` / `UI-NN` references vs baseline, both directions (ERROR). CI rust job and the pre-push hook run the same command.

Use targeted gates first while iterating, then run the relevant full gate set before finalizing.

CI routing:

- CI routing details live in [ci.md](ci.md). Keep this section as the workflow-facing summary only.
- GitHub Actions does not run on `push: main`. It is triggered by a PR's `opened` / `ready_for_review` / `synchronize` event or explicit `workflow_dispatch`; Draft events start no runner jobs because the job-level guard skips them.
- Pure docs-only R0/R1 changes are excluded at event level. Eligible non-doc R0/R1 may use the PR-body `Hosted CI: skip` token together with `Risk: R0` / `Risk: R1`; it is honored only when the repository owner triggers Ready. R2+ and workflow/release changes must not use it. A workflow/release contract change that is docs-only still receives its required final through owner-directed `workflow_dispatch` unless `ci.md` classifies the exact change under a closed Actions-unavailable `not-required` route.
- A manual dispatch always runs the full gate set, including a zero-diff dispatch on `main`.
- Draft / `Hosted CI: skip` guards must skip every runner job, including jobs that otherwise use `if: always()` such as the Rust aggregate.
- Ready PR pushes are blocked by pre-push using each actual pushed remote ref from hook stdin, not only the checkout branch. Return the PR to Draft before a correction, then rerun local full and Ready final on the new HEAD.
- GitHub Actions starts with `Detect changed areas`, then uses job-level routing. Unknown paths and classification failures route to all gates.
- `Design doc consistency` runs for every non-skipped CI trigger because it protects source-of-truth docs.
- Rust-heavy work is split into `Rust fmt/clippy`, `Rust tests`, and `Rust generated drift`. Frontend test files and traceability source docs can run only the drift job when Rust source is unchanged. The existing `Rust (fmt + clippy + test)` check name is an aggregate status that fails if any required Rust sub-job fails.
- `Env safety` is an independent lightweight job for `.env*` / `.gitignore` changes.
- Classifier outputs distinguish frontend, Rust, docs, env, generated, traceability, workflow, and unknown paths; `rust_drift` remains the generated/traceability compatibility aggregate.
- Rust jobs print disk and target directory usage before and after the expensive command group so hosted-runner capacity failures can be diagnosed from CI logs.
- actions/cache stores Cargo dependency download data only. `src-tauri/target/` and `~/.cargo/bin/` are not cached; npm remains on setup-node's package-manager cache.
- Hosted policy is 1 change 1 final run for routes that require hosted evidence, and 0 run for pure docs-only R0/R1. Workflow/release contract changes remain hosted-required even when docs-only except for the two closed Actions-unavailable routes in `ci.md`; matching those routes requires their exact compensating evidence, PR-body disclosure, and owner disposition. At 75% monthly usage, R2 defaults to local full; at 90% or Actions unavailable, defer hosted evidence only through `ci.md`'s risk route and record the deferral in the PR body.

### Human Visual Confirmation For Screen Changes

- When a PR creates or materially changes an operator-facing screen, add a human visual confirmation slot before merge.
- Record the expected check target in the Plan Packet and PR body: screen route, main happy path, visible state distinction, Japanese wording, and whether Windows native L3 is also required.
- CI, unit tests, and review-only sub-agent approval do not replace this visual confirmation. If it is skipped, record who accepted the residual risk and why.
- **L3 Eligibility**: an item belongs in human L3 only when it meets all three conditions — (1) it is observable only on Windows/Tauri native, (2) the human gate step requires no newly introduced tool, and (3) it does not require a manual fault-injection-grade procedure such as DB lock manipulation, synthetic row insertion, or config restore (route those to automated tests instead). UI-11c's L3-7/L3-8 grew into SQLite CLI setup, synthetic row insertion, and DB lock/WAL manipulation and were ultimately waived — that incident is the basis for this rule. Within L3 Eligibility scope, the owner's role is limited to eye confirmation and a PASS/FAIL call; evidence packaging, PR body formatting, and waiver wording are the agent's responsibility.
- The generic human visual confirmation slot above stays mandatory for every operator-facing screen change regardless of L3 Eligibility; L3 Eligibility only narrows which items belong on the separate Windows native L3 checklist, it does not decide whether visual confirmation happens at all.

## Review Rules

- Use [code_review.md](code_review.md) and [quality/review-checklist.md](quality/review-checklist.md).
- Review against source design docs first, then the Plan Packet. If they disagree, fix the source docs or the plan before merging.
- Classify findings by decision purpose, without creating another review lane: `candidate safety` (the current candidate can cause actual harm), `mutation authority` (the intended state change lacks current authorization or exceeds its boundary), or `evidence quality` (a receipt, narrative, or historical proof is incomplete). Evidence quality supports the first two classifications but is not an independent deliverable and cannot alone justify destructive repair.
- Before an irreversible finding can authorize deletion, recreation, forceful repair, or another destructive mutation, it must state all four items: `actual harm path`, `affected candidate or mutation`, `non-destructive revalidation`, and `blocker reason`. Run the cheapest safe revalidation first; a missing item keeps the finding non-authoritative for destructive action.
- When the Plan Packet includes `Impact Review Lenses`, pass those lenses into the review-only sub-agent packet and ask the reviewer to use them as prompts for missing design, evidence, tests, manual checks, or replacement-boundary risks.
- For R3, run review-only sub-agent by default; if skipped, record `Review-only skipped because:` in the Plan Packet or PR body.
- For narrow docs-only PRs where review-only is skipped, the PR body must state why local verification is enough.
- For R4, review-only sub-agent is required and destructive or irreversible actions need explicit human approval.
- Sub-agent findings are claims. Verify each finding against files, diffs, specs, and test output before accepting or rejecting it.
- Same-PR fixes are for regressions, contract drift, data safety gaps, missing critical tests, and merge blockers. Future improvements go to the dashboard or archive evidence.
- **Findings Freeze** (D-038): ① the finding set is frozen once the initial Broad Audit completes; rounds after that are closure confirmation only. Whenever two Contract Audit passes actually run — the mandatory Double Audit on R4/workflow gate changes, or an R3 change that opted into the Contract Audit section's recommended second pass — both passes together constitute that "initial Broad Audit", and Freeze takes effect only after both passes complete; this proviso is required so a Double Audit still catches what a single pass would miss. ② a new P2 found after Freeze is a blocker only when it is proven by a runtime failure. ③ a new P3 found after Freeze is a follow-up, not a blocker. ④ there is one broad review lane per change, chosen by where the risk sits: cross-layer/contract risk uses the Contract Audit lane, UI-presentation risk uses review-checklist §9 + the operator-ui skill, and both lanes run only when the change genuinely spans both.

## Contract Audit (R3/R4)

Standard independent-review step (D-034), introduced after PR #159: design-doc contracts were dropped from both implementation and tests and survived multiple code-reading review rounds ([2026-07-08 WER](archive/plans/2026-07-08-ui10-stocktake-workflow-effectiveness-review.md)). The audit runs from source design docs directly, never from the Writer's summary. It extends the review-only sub-agent packet and does not replace human visual confirmation.

- Contract Coverage Ledger: the Plan Packet lists every design decision ID / contract of the touched design doc sections in a 4-column ledger — design contract → implementation target → automated test → L3 or non-scope. Authored at plan-draft, checked at plan-gate, re-verified at independent-review. For R3/R4, a touched contract with no ledger row is a plan-gate blocker, and re-verification checks that each row's implementation actually matches the contract, not merely that a row exists (PR #159 miss #6/#11/#14 class).
- Double audit: for R4 and workflow gate changes, run the Contract Audit twice in independent contexts — in PR #159 the second independent audit caught miss #13 after the first audit had missed it. For other R3 changes, a second audit is recommended when the change touches operator-visible state lifecycle.
- State Lifecycle Matrix: for stateful UI/data changes, the Test Design Matrix covers initial / pending / success / invalidate / refetch / revisit / restart / failure / retry transitions (miss #13 class: post-commit refetch replaced the "previous stocktake" snapshot).
- Adjacent Pattern Audit: when porting an established pattern (IME isComposing, Enter handling, focus order, formatter, query invalidation, error-kind mapping, route/search state, accessibility), enumerate every site of the source pattern and verify each was ported or explicitly excluded (miss #10/#15 class).
- Mutation / anti-tautology check: mock values must be distinguishable from design-doc expected values; verify that a broken implementation cannot stay green when a mock value or the invalidate/refetch order changes (T11/T13 class).
- Negative-space audit: list what the touched source design docs specify that appears nowhere in the ledger, the implementation, or the tests.
- Drift-fix sweep: on first receipt of a drift finding, `rg` the finding's keyword across the whole repository and fix every hit in one commit, instead of letting the same drift resurface across later review rounds.
- Manual verification boundary: assertions not provable by automated tests become explicit L3 checklist items in 画面 / 到達手順 / 観測可能な合格基準 form.
- PR body freshness: before Ready, re-read the whole PR body against the final state of the change and refresh stale sections.

## Draft PR Checkpoint

After the first implementation pass is complete, Codex should be able to publish a Draft PR without waiting for every human/manual confirmation.

Definition of first implementation pass complete:

- planned code, tests, generated bindings, route generation, and source docs for the scoped change are in the working tree;
- relevant automated gates have passed, or any failures are understood and recorded as blockers;
- R3/R4 review-only has run, or the skip reason is recorded;
- the branch contains only the intended scope.

Default behavior:

- Open a Draft PR after Verify + Review when the branch is ready for external review, Windows native L3, or owner handoff.
- The PR body includes a `Human Gate` field for each pending owner approval: `この change での介入 N 回目 / 予算 M 回` plus one user-visible completion sentence. This field is the approval interface; do not hide the counter in review logs or tracked evidence.
- Keep the PR Draft while required Windows native L3, human visual confirmation, or owner manual checks are still pending.
- Record pending manual checks in the PR body and `Plans.md`.
- Keep the Plan Packet `Workflow State` Phase in sync with the PR state: a Draft PR opens during implementing / local-verified, Ready happens only at ready-hosted-final, and a Draft return moves the Phase back to implementing.
- Do not mark the PR Ready until required manual checks are done and the project owner explicitly asks to ready it.
- Ready 化 authorizes the hosted final for hosted-required R3/R4 and workflow/release changes. It requests the run through the Ready event when that event is eligible; a hosted-required docs-only workflow/release change is event-filtered and therefore needs the owner-directed explicit dispatch after Ready. A change on one of `ci.md`'s closed Actions-unavailable `not-required` routes does not dispatch an unavailable run and instead closes the route's compensating evidence plus owner disposition. Run `bash scripts/local-ci.sh full` at the completed HEAD before this transition.
- PRs created directly as Ready are covered by the `opened` event. Eligible non-doc R0/R1 that do not need hosted CI must say `Hosted CI: skip` in the PR body; pure docs-only R0/R1 changes are event-filtered. Hosted-required workflow/release docs-only changes use the explicit-dispatch rule in [ci.md](ci.md); matching closed Actions-unavailable routes use their documented compensation instead.
- If a Ready PR needs another push, return it to Draft first. The pre-push hook blocks the normal Ready-push path so an old green cannot be mistaken for the new HEAD.
- If the user explicitly asks for an earlier PR, a Draft PR may be opened before full validation only when the known missing gates and residual risk are written in the PR body.
- If the user explicitly asks not to create a PR, leave the branch local and record the next publish step in `Plans.md`.

Workflow-change dogfood:

- This checkpoint is first dogfooded by the `codex/inventory-records-other-details` PR. Revisit after that PR to see whether the checkpoint belongs in the archive / PR-ready flow unchanged.

## Post-Merge Closeout

Use this when the owner says the PR is OK and asks for post-merge cleanup. Keep it small and mechanical; do not reopen product scope.

Before merge:

- Confirm the PR is Ready or explicitly approved to become Ready.
- Confirm the PR body's local full evidence SHA equals the PR HEAD; `Reviewed Content HEAD` is not part of this merge comparison.
- For hosted-required changes, confirm a successful `CI` run exists for the exact PR HEAD and record its URL/headSha in the PR body. A green run from an older HEAD is stale and must not be reused.
- Confirm CI/checks are green and the PR is merge-clean. When Actions are disabled or the monthly budget exception is active, record the missing hosted evidence and owner acceptance explicitly.
- If manual checks, Windows native L3, or residual risks were accepted instead of evidenced, record that in the PR body before merging.
- The agent records manual check results (L3 outcomes, waivers, residual-risk notes); the owner is not asked to transcribe them.

Merge and sync:

- Squash merge the PR using the approved subject/body and delete the remote PR branch when appropriate.
- Sync local `main` with `origin/main`, then confirm the working tree is clean.

Repository evidence:

- Move completed active Plan Packets and Test Matrices from `docs/plans/` to `docs/archive/plans/`, preserving evidence and fixing links.
- Update `Plans.md` so it reflects current live state, completed work, archived evidence, and next action.
- Update `docs/PROJECT_HANDOFF.md` after meaningful project progress.
- For R3/R4 or workflow changes, complete Workflow Effectiveness Review or name the next dogfood target.

Verification and publish:

- Run `bash scripts/doc-consistency-check.sh`; if active plans remain, also run `bash scripts/doc-consistency-check.sh --target plan`.
- Commit docs-only closeout separately, normally as `docs(plans): ...`, and push to `main` for this single-developer repository.
- Finish by checking `git status --short --branch`.
- After D-033 migration, a normal `push: main` does not start CI. Use `workflow_dispatch` only when main itself needs an explicit clean-room recheck.

## Commit / PR Messages

PR body is the durable change history because this repository normally uses squash merge. Commit messages help review the in-progress branch, but the PR description must explain what changed, why, validation, and follow-up.

- Commit subject format: `<type>(<scope>): <outcome>`.
- Allowed types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.
- Use a concrete outcome, not a vague action such as `update docs`.
- Add a short body only when the subject cannot carry the scope: 1-3 bullets for rationale, validation, or follow-up.
- Do not add `Co-Authored-By` trailers.
- Use [.github/pull_request_template.md](../.github/pull_request_template.md) for PR descriptions.
- PR description と repository docs は、project owner が直接読めるように原則日本語で書く。command name、function/type name、branch name、commit type、ID など標準表記が英語の technical identifier は英語のままにする。
- Review comments follow [code_review.md](code_review.md): `P1/P2/P3 - path:line - issue / impact / smallest safe fix`.

## Done Definition

- Scope matches the Plan Packet or explicitly stated R0/R1 task.
- Relevant docs and source contracts are updated.
- Design Phase is complete for R2+ work: design docs are cited as sufficient or updated in the same PR.
- Required gates are run or explicitly reported as skipped with reason.
- Draft PR is opened after Verify + Review when the branch is ready for external review, Windows native L3, or owner handoff, unless the user explicitly keeps the work local.
- Operator-facing screen changes have human visual confirmation recorded, or an explicit skip/deferral with accepted residual risk.
- `Plans.md` reflects the live state, not the full PR history.
- Completed evidence is archived when it no longer belongs in the live dashboard.
- If completed active plans are left unarchived to keep a PR small, `Plans.md` or the PR body must name the archive follow-up.
- Workflow changes either complete Workflow Effectiveness Review or name the first dogfood target.
