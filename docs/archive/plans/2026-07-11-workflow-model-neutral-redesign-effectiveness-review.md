# Workflow Effectiveness Review: model-neutral workflow redesign

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-07-10-workflow-model-neutral-redesign.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-07-10-workflow-model-neutral-redesign.md`
- review-only sub-agent: Luna exploration, Terra adversarial review, multiple fresh read-only Sol Plan / Contract Audit passes
- external review: Fable review and GitHub Independent Contract Audit rounds on PR #163
- human approval: owner Plan continuation, Ready, merge, and archive-boundary clarification
- gates: targeted doc checks, `local-ci.sh changed`, repeated CLEAN exact-HEAD `local-ci.sh full`, Ready-event hosted final run 29124260732 (private archive Actions evidence 29124260732), merge three-point match

## What Worked

- Plan-first and independent Plan Gate prevented D-035 state/evidence redesign from being patched directly into skills without a durable source-doc decision.
- Independent contract-oriented review found semantic failures that syntax/doc checks could not: formal Scope conflict, R0/R1 routing drift, tracked SHA self-reference, stale packet state, phase materialization ambiguity, and Plan Commit amendment overwrite.
- D-035's final split worked in the live PR: tracked `Reviewed Content HEAD` remained an audit pointer while the final local SHA and hosted `headSha` stayed in PR metadata.
- D-033 dogfood succeeded: Draft pushes produced zero hosted runs, Ready produced one run, and live PR HEAD / local evidence / hosted `headSha` matched exactly before merge.
- The owner clarification about why the packet remained active preserved the implementation handoff and made the correct archive boundary explicit.

## What Did Not Work

- The active packet carried design history, implementation state, remediation history, and closeout state in one long document. Fresh readers repeatedly found stale future tense and duplicate status in packet/Plans.
- The single `Plan Commit` field did not explain how a later gated amendment relates to the original plan-first commit. It was temporarily overwritten and had to be restored.
- The first final audits were not actually final: new semantic drift continued to appear after state-only transitions. File/hunk boundaries were sound, but field meaning and dashboard freshness still required external review.
- CLEAN full was rerun several times because tracked state transitions create new exact HEADs. This is correct for merge evidence but expensive; the hosted Rust test job alone took 14m33s.

## Issues Caught Before Implementation

- Original D-034 Plan Gate rounds caught missing Ledger coverage, incomplete 13-phase transitions, fail-closed gaps, model-mode role gaps, reading-order duplication, and hosted routing ambiguity.
- D-035 Plan Gate caught stale enums/grep scope, R2 incidental failure ambiguity, insufficient state-only hunk rules, and Ready-event semantics.
- The adjacent-transition amendment Plan Gate caught an inaccurate accepted/pending decision status before its skill/template implementation.

## Issues Caught by Tests

- Doc checks caught broken links, missing required packet substance, placeholder/ambiguity issues, and shell/workflow fixture regressions.
- `local-ci.sh` self-tests verified CLEAN/end-HEAD evidence behavior and expected negative fixtures.
- Tests did not catch semantic contradictions such as a wrong Plan Commit identity, stale human-gate text, or packet sections that described already-implemented work as future work.

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| router selected packet before request identity | accepted | router made task identity first and fail-closed |
| phase next actions / Plans status drift | accepted | transitions and dashboard synchronized |
| Plan Commit ancestry claim after squash | deferred design question | PK5 Design Phase retains the reconciliation problem |
| canonical reading-order / Claude rule drift | accepted | pointers restored; duplicated workflow text reduced |
| D-035 adjacent transition history mismatch | accepted | evidence-first adjacent-forward materialization defined and implemented |

## Issues Caught by External Review

- Formal Scope / Non-scope / Acceptance Criteria did not initially represent implementation slice 1.
- R0/R1 no-Plan and R2 hosted routing were inconsistent across source docs, skills, and templates.
- A tracked current-HEAD field had no fixed point and could not coexist with the exact-HEAD merge gate.
- Packet/Matrix still described implemented slice 1 work as deferred/design-only.
- `Plan Commit` was overwritten by a later amendment SHA; the original plan-first identity was restored and the amendment retained in review history.
- Human Gate and Plans parent/checkpoint text lagged the live phase.

## Escaped / Late Findings

- The SHA self-reference defect escaped the initial D-034 design and first implementation audits; it appeared only when the workflow dogfooded a tracked `human-confirm` commit.
- Scope and dashboard freshness were reviewed late because reviewers followed appendix/history claims instead of first reconciling every normative top-level field.
- Amendment identity was found only after the D-035 correction reached a final state-only HEAD. The workflow needs mechanical assistance, but the exact PK5 model remains intentionally deferred.

## Test Adequacy

Strong tests:
- doc link/substance checks, shell/workflow fixtures, CLEAN/end-HEAD validation, and full Rust/frontend gates.

Weak or missing tests:
- no PK4 semantic checker for Workflow State enums/field relationships or Plans active-link freshness;
- no PK5 model for original plan-first SHA plus later gated amendments;
- no mechanical PR-body versus live PR/head/run comparison.

Mutation-style observations:
- Changing `Reviewed Content HEAD` to the state-only HEAD would recreate self-reference and must be rejected.
- Replacing the original Plan Commit with a later amendment SHA must fail future PK5 validation.
- Changing the Ready-event run `headSha` must fail the three-point merge check.

## Signal / Noise

- sub-agent findings total: multiple overlapping rounds; unique actionable contract categories = 12
- accepted: 10 categories
- rejected: 1 category (current-slice ancestry blocker claim)
- deferred: 1 category (PK4/PK5 mechanical enforcement design)
- question: 0 unresolved at merge

## Cost / Friction

- useful cost: independent vendor/context passes repeatedly found real merge blockers that automated checks missed.
- excessive friction: repeated broad audits re-read the same long packet; several CLEAN full runs were invalidated solely by required state-only commits.
- confusing steps: original Plan Commit versus amendment identity, and whether post-review phases belonged in tracked state or PR metadata.

## Recommended Workflow Adjustment

Keep:
- canonical reading-order pointers, Plan Gate independence, source-doc-first Contract Audit, D-035 state/evidence separation, and owner-only Ready/merge.

Change:
- begin future contract audits with a fixed top-level freshness pass: Workflow State, Scope/Non-scope/AC, Plans active entry, Matrix tense, and PR body before reading historical narrative.
- design PK4/PK5 around field relationships and original-plan/amendment identity rather than only line presence or naive ancestry.

Follow-up:
- mechanical slice 2: PK4/PK5, checker/drift tests, and hook feasibility;
- UI-11c is the next product slice, without repeating the already-completed first D-033 dogfood obligation.

## Applied / Deferred Workflow Changes

Applied:
- D-034 canonical entry/state/audit artifacts and model-neutral routing;
- D-035 Reviewed Content / PR-body evidence split, state-only hunk boundary, adjacent-forward materialization, R2 incidental failure disposition, and exact merge comparison;
- active packet/Matrix/Plans freshness corrections and final archive.

Deferred:
- PK4/PK5/checker/drift-test/hook mechanical enforcement, with the original-plan/amendment reconciliation as an explicit Design Phase input.

Not applied:
- moving every post-local phase to GitHub metadata, because it weakens offline resume and archive history;
- rewriting published branch history to split past state-only transitions, because the evidence-preserving normative fix was safer and auditable.
