# Public repository Phase B runbook design hardening

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: codex-only
- Plan Commit: 9b43677
- Amendments: db6ece0, 776af81, a035e1a
- Coordinator: root Codex; contract design, scope control, and human-gate routing
- Writer: root Codex; source-doc and plan-first edits only
- Plan Reviewer: fresh independent Codex subagent; no writing role
- Final Reviewer: separate fresh independent Codex subagents A/B; no writing role
- Reviewed Content HEAD: a035e1a
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: not-required
- Human Gate: completed for this design slice; Phase B execution retains separate R4 owner gates

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 20分
- relay 往復上限: 2

This budget applies only to the design-hardening PR. The later R4 execution Packet must budget four owner interventions for the success path: initial contract/repository-creation approval, private-first push, visibility change, and development-remote cutover. A failed candidate stops execution and requires the Coordinator to amend the budget and obtain owner approval before requesting a destructive retry; it is not silently counted as a fifth intervention.

For this current R3 design PR, `Hosted CI Requirement: not-required` uses the closed non-release R2/R3 Budget Pressure route added to `docs/ci.md` because the source hosted allocation is unavailable; it does not inherit the future destination's Actions-disabled rationale. Exact-HEAD local full plus mandatory Double Audit are the temporary evidence, the PR body must record the omitted hosted gate, and owner disposition is required. Because this PR clarifies the merge-evidence policy and self-applies that exception, it is a workflow gate change and cannot merge without the owner disposition. The later R4 execution independently uses the narrower public-repository Phase B bootstrap exception.

## Risk

Risk: R3

Reason:
This slice changes the stable migration contract, data-safety boundary, and unavailable-hosted merge-evidence policy that the R4 public cutover will rely on. It makes no repository, GitHub, remote, visibility, or history mutation. A missed contract defect could nevertheless turn a later operator error into irreversible disclosure, so workflow-gate Double Audit applies.

## Goal

Make the Phase B runbook executable without confusing private workflow evidence with the public payload, auditing a candidate before it exists, treating containment as rollback, or scanning the wrong commit authority.

Failure means that the design still permits information classified as non-public to enter a public commit, object/ref, repository surface, review artifact, retained command output, or public push-capable clone.

## Scope

- Define the private control plane and initial public payload as separate artifact sets.
- Order the R4 lifecycle as Plan Gate and owner contract approval, private-first candidate creation, two independent candidate audits, Findings Freeze, frozen-finding closure/candidate revalidation, then visibility approval.
- Distinguish the sanitized source baseline from the final parentless root and define their allowed equivalence delta.
- Isolate builder Git configuration, templates, hooks, filters, signing, credentials, and URL handling from the source/user environment.
- Define fail-closed recovery for a rejected private candidate as deletion and full recreation of the destination.
- Define post-public failure handling as containment and incident response, never disclosure rollback.
- Make the Phase B hosted-CI exception and compensating evidence explicit.
- Clarify the closed Actions-unavailable exceptions in `docs/ci.md` for this R3 design slice and the later Phase B R4 bootstrap; preserve required hosted evidence for all other R4/release/workflow executable changes.
- Expand pre-creation inherited-access, Security & Analysis, destination/public-surface inspection, public closeout schema, and just-in-time owner gates.
- Append the durable clarification as D-041 and synchronize `Plans.md`.
- Produce the later R4 execution contract and test surface, without executing it.

## Non-scope

- Creating, deleting, renaming, or changing visibility of any repository.
- Creating or pushing the parentless snapshot, changing remotes, applying a graft, or deleting any builder/source clone.
- Choosing the destination owner/name, public identity, signature state, or LICENSE/SECURITY/CONTRIBUTING contents.
- Changing CI workflow executable files, enabling CI, branch protection, rulesets, Pages, packages, or other repository features.
- Cleaning up the owner-retained source repository or copies.
- Product code, schema, runtime, UI, test fixture, or application behavior changes.

## Acceptance Criteria

- `PUB-BD-01`: `docs/PUBLIC_REPO_MIGRATION.md` states that active R4 control artifacts remain in the private control plane, are absent from the initial root, and are replaced after cutover only by a minimal public-safe closeout record.
- `PUB-BD-02`: the runbook requires `Plan Gate -> owner R4 contract approval -> private-first push/fresh clone -> two independent Contract Audits -> Findings Freeze -> frozen P1/P2 closure and candidate revalidation -> owner visibility approval`; Freeze occurs after both initial passes regardless of finding count, and no text requires final candidate audit before the candidate exists.
- `PUB-BD-03`: source baseline SHA and final parentless root SHA are distinct authorities; final-root tree/archive/fresh-clone scans are mandatory, and an explicit governance-file allowlist is the only accepted tree delta.
- `PUB-BD-04`: every failure discovered after candidate bytes were pushed requires owner-approved deletion and recreation of the whole destination regardless of provenance. A source-derived failure additionally invalidates the baseline and returns through a gated amendment/Plan Gate; a proven-clean baseline may be retained for other provenance classes. Force push, branch deletion, ref replacement, and repair commits are explicitly forbidden.
- `PUB-BD-05`: a post-public finding invokes containment and incident response, states that disclosure cannot be rolled back, and requires a new fully gated snapshot before republishing.
- `PUB-BD-06`: `docs/ci.md` defines two closed Actions-unavailable `not-required` routes: non-release R2/R3 Budget Pressure and Phase B bootstrap R4. This current PR and the future R4 Packet each use only their matching route, require owner disposition, and use exact-candidate local full plus mandated independent review; all other release/R4/workflow executable changes remain `required`.
- `PUB-BD-07`: the runbook and Matrix cover builder Git configuration/hooks/filters and ephemeral authentication, immutable pre-push `H1` plus `H1`-referencing post-push `H2` private evidence readable by both audits, pre-creation namespace inheritance, Security & Analysis automation and forced-on public state, commit identity/signature, refs/objects/alternates/submodules/LFS, repository relationships/features/apps/keys/secrets/environments, unauthenticated views, clone roles, exact public closeout content, and four success-path owner interventions with failure re-budgeting.
- `PUB-BD-08`: this diff contains only plan/design/dashboard docs, `bash scripts/doc-consistency-check.sh --target docs/plans/2026-07-14-public-repo-phase-b-design-hardening.md` and the full docs gate pass, and a public-safe scan reports zero prohibited artifact classes.

## Design Sources

- Requirements / spec: `docs/PUBLIC_REPO_MIGRATION.md` Purpose and Public-safe evidence rule
- Architecture: `docs/PUBLIC_REPO_MIGRATION.md` Persistent clone roles and Control plane and public payload
- Function / command / DTO: not applicable; no application interface changes
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: `docs/decision-log.md` D-040 and D-041
- Workflow: `docs/DEV_WORKFLOW.md` R3/R4 Plan Gate, Contract Audit, Findings Freeze, and Human Gate rules
- CI evidence routing: `docs/ci.md` Risk Routing and Budget Pressure

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | none | intentionally non-scope |
| Command / DTO / generated binding / wire shape | none | intentionally non-scope |
| DB / transaction / audit / rollback / migration | Phase B failure/recovery contract | updated in `PUBLIC_REPO_MIGRATION.md` |
| Screen / UI / route state / Japanese wording | none | intentionally non-scope |
| CSV / TSV / report / import / export format | none | intentionally non-scope |
| Durable decision / ADR | D-040 clarification | D-041 appended in this PR |
| R4 public-surface and state lifecycle | Test Design Matrix | added in this PR |
| Hosted merge-evidence exception | `docs/ci.md` Budget Pressure | closed route updated in this PR; workflow executable unchanged |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| PUB-BD-01 | Control plane and public payload | PUB-BD-D1 | Active private ancestry cannot be copied into a parentless one-commit public root | runbook, D-041 | TDS-PUB-BD-01 |
| PUB-BD-02 | Phase B R4 gate | PUB-BD-D2 | Actual object/surface audit requires an actual private candidate; D-038 freezes the set after both broad passes, not after closure | runbook lifecycle | TDS-PUB-BD-02 |
| PUB-BD-03 | Prepare/Builder/Go-no-go | PUB-BD-D3 | Governance and metadata make the final root different from the export baseline | runbook authority rules | TDS-PUB-BD-03 |
| PUB-BD-04 | Private-first go/no-go | PUB-BD-D4 | In-place repair cannot prove rejected objects and surfaces are absent | runbook recovery | TDS-PUB-BD-04 |
| PUB-BD-05 | Visibility and development cutover | PUB-BD-D5 | Public observation may already be copied; private flip is containment only | runbook incident route | TDS-PUB-BD-05 |
| PUB-BD-06 | `ci.md` Budget Pressure + Phase B R4 gate | PUB-BD-D6 | Current R3 allocation outage and future destination-disabled bootstrap are different exceptions; neither may weaken general R4/release policy | `ci.md` + runbook evidence contract | TDS-PUB-BD-06 |
| PUB-BD-07 | Builder/Prepare/Go-no-go/Closeout | PUB-BD-D7 | Git tree scanning alone does not cover inherited executable config, auditability after builder destruction, repository automation/metadata, or the actual closeout content | runbook + Matrix ledger | TDS-PUB-BD-07 |
| PUB-BD-08 | workflow and docs rules | PUB-BD-D8 | Design must close before mutation and remain public-safe itself | Packet, Matrix, Plans | TDS-PUB-BD-08 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes; the executable contract is in the runbook and D-041.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: control-plane/payload split, real-candidate audit order, dual SHA authority, private recreate-only recovery, public containment semantics, sealed builder evidence, and the two closed hosted-evidence exceptions.
- Assumptions and constraints: the initial destination is private and empty; builder configuration is isolated; Actions and optional analyzers stay disabled until their approved state; owner approvals are just in time; detailed evidence remains local/private.
- Deferred design gaps, risk, and follow-up target: destination metadata, governance contents, public identity/signature, exact commands, incident contacts, and final surface allowlist belong to the later R4 execution Packet and owner gate.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, via `TDS-PUB-BD-*` and the public-surface ledger.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable; no application boundary changes | none |
| Fact check / design decision split | local synthetic Git probe verifies feasibility; durable policy is D-041 | Contract Probe + D-041 |
| Lifecycle / retry | private retry is recreate-only; public failure is incident containment | Matrix lifecycle rows |
| Operator workflow | owner receives one initial and three just-in-time execution gates | future R4 Packet budget |
| Replacement path | new public writer replaces development use of the source clone | runbook cutover |
| Data safety / evidence | final-root authority, isolated Git execution, control-plane separation, and analyzer-surface inventory close evidence leak paths | Matrix surface ledger |
| Reporting / accounting semantics | not applicable | none |
| Manual verification | repository surfaces and unauthenticated view require owner-authorized R4 execution | future R4 Matrix |

## Design Readiness

- Existing design docs are sufficient because: D-040 already establishes parentless snapshot and clone-role separation.
- Source docs updated in this PR: migration runbook, D-041, and `Plans.md`.
- Design gaps intentionally deferred: destination-specific values and irreversible command execution are intentionally withheld until the R4 Packet and owner gates.
- Durable decisions discovered in this plan and promoted to source docs: all `PUB-BD-D1` through `PUB-BD-D7` are represented in the runbook and D-041.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): unchanged.
- Backend function design: unchanged.
- Command / DTO / data contract: unchanged.
- Persistence / transaction / audit impact: Git/GitHub migration state only; lifecycle specified in the Matrix.
- Operator workflow / Japanese UI wording: not applicable.
- Error, empty, retry, and recovery behavior: uncertainty fails closed; source failure invalidates baseline; other private failures recreate under re-budgeted approval; public finding contains and escalates.
- Testability and traceability IDs: `PUB-BD-*`, `PUB-BD-D*`, and `TDS-PUB-BD-*`.

## Contract Probe

- Control-plane/payload separation: `git archive <synthetic-baseline>` -> clean `git init --template=<empty>` builder -> parentless commit -> `git init --bare` destination -> one explicit no-tags refspec -> fresh clone topology/control-artifact checks -> PASS; one commit, zero parents, and zero active control artifacts. The status-only private probe record is `LOCAL-PHASE-B-PROBE`; rerun and seal it in the future R4 control evidence rather than tracking real temporary paths.

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| PUB-BD-D1 | runbook control-plane section and closeout | TDS-PUB-BD-01 content/absence audit | actual cutover is future R4 |
| PUB-BD-D2 | runbook R4 gate | TDS-PUB-BD-02 ordered lifecycle audit | two real audits are future R4 |
| PUB-BD-D3 | prepare/builder/go-no-go | TDS-PUB-BD-03 authority and allowlist audit | final root does not yet exist |
| PUB-BD-D4 | private failure route | TDS-PUB-BD-04 forbidden repair sweep | repository deletion requires future owner approval |
| PUB-BD-D5 | public incident route | TDS-PUB-BD-05 rollback-language sweep | incident contacts are private R4 control data |
| PUB-BD-D6 | `docs/ci.md` closed exceptions + runbook hosted evidence rule | TDS-PUB-BD-06 exception/compensation audit | Actions executable redesign is a later R3 task |
| PUB-BD-D7 | builder isolation/evidence bundle, analyzer surfaces, actual closeout content, and owner gates | TDS-PUB-BD-07 surface-ledger coverage | destination-specific inspection is future R4 |
| PUB-BD-D8 | plan-first docs-only boundary | TDS-PUB-BD-08 diff/gates/public-safe scan | GitHub mutation is non-scope |

## Test Plan

Test Design Matrix: [2026-07-14-public-repo-phase-b-design-hardening.md](test-matrices/2026-07-14-public-repo-phase-b-design-hardening.md)

- targeted tests: ordered contract audit, hosted-route classification, sealed-evidence coverage, surface-ledger coverage, source/final authority/provenance checks, actual-closeout content gate, forbidden recovery-language sweep, doc consistency.
- negative tests: active control artifact in payload, pre-candidate audit, late Freeze, baseline-only scan, inherited Git hook/filter/URL rewrite, source-failure baseline reuse, in-place repair, rollback claim, analyzer/closeout surface omission, incidental repository mutation.
- compatibility checks: D-040 clone isolation and one explicit initial refspec remain unchanged.
- data safety checks: status-only public-safe artifact scan; no private identifiers, paths, identities, literals, or detailed logs.
- main wiring/integration checks: `Plans.md` links this Packet, Matrix, runbook, and D-041-backed work item.

## Boundary / Wire Contract

- producer: fixed sanitized source-baseline archive plus owner-approved public governance inputs.
- consumer: transient isolated snapshot builder and private-first destination.
- wire type: archive payload and a single explicit Git refspec.
- internal type: one parentless final-root commit and one `main` branch.
- precision/range: exactly one commit, zero parents, one branch, zero tags, and zero unexpected refs/objects/surfaces.
- round-trip path: source baseline -> clean archive -> isolated builder -> final root -> private destination -> fresh clone/unauthenticated surface.
- invalid input: missing authority, unexpected delta/surface, scan error, or identity mismatch stops progression.
- compatibility: D-040's public-writer/history-view separation and explicit no-tags push remain mandatory.

## Review Focus

- Can any active private control artifact reach the initial public root or its evidence surfaces?
- Is every audit performed against an artifact that already exists and is immutable?
- Does every privacy assertion name the final root rather than relying only on the source baseline?
- Can source-derived failure reuse an invalid baseline, or can a rejected private destination retain objects or metadata through an in-place repair path?
- Is every post-public action described accurately as containment rather than rollback?
- Can both audit contexts verify destroyed-builder claims from an integrity-protected private bundle?
- Does the surface ledger cover builder executable configuration, pre-creation inherited access, Security & Analysis behavior, actual public closeout content, non-tree GitHub state, and unauthenticated observation?

## Spec Contract

Contract ID: SPEC-PUB-BD

- `PUB-BD-01` through `PUB-BD-08` are the complete design-hardening contract.
- This slice is fail-closed and docs-only; it cannot authorize or perform any Phase B repository mutation.
- The later R4 execution Packet must instantiate the runbook with destination-specific owner decisions without copying private values into the public payload.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| PUB-BD-01 | define control plane/payload | TDS-PUB-BD-01 | ancestry and evidence separation | source-doc diff + synthetic probe status |
| PUB-BD-02 | reorder lifecycle | TDS-PUB-BD-02 | actual-candidate audit | ordered section review |
| PUB-BD-03 | split SHA authorities | TDS-PUB-BD-03 | final-root scan scope | authority/allowlist review |
| PUB-BD-04 | close private retry path | TDS-PUB-BD-04 | rejected object retention | recovery wording sweep |
| PUB-BD-05 | define public incident route | TDS-PUB-BD-05 | no false rollback promise | incident wording sweep |
| PUB-BD-06 | define hosted exception | TDS-PUB-BD-06 | compensating evidence completeness | runbook/Packet review |
| PUB-BD-07 | expand surfaces/gates | TDS-PUB-BD-07 | non-tree exposure | surface-ledger coverage |
| PUB-BD-08 | close docs-only R3 | TDS-PUB-BD-08 | scope and public safety | diff, docs gates, independent review |

## Data Safety

- Must not be committed: source repository identity/URL, destination draft identity before owner publication, local path names, personal email, owner copy locations or hashes, canary literals, credentials, tokens/keys, effective-config values, detailed scan/audit logs, or incident contacts.
- Local-only aliases: `SOURCE_BASELINE`, `FINAL_ROOT`, `DESTINATION`, `LOCAL_PRIVACY_MANIFEST`, and owner gate records; aliases are descriptive only and never resolve to tracked real values.
- Synthetic-only evidence: probes use temporary synthetic repositories and record only PASS/FAIL plus aggregate topology counts.
- This design slice must not add/change a Git remote, ref, repository, visibility, feature, credential, or local graft.

## Implementation Results

Fill after source-doc implementation and independent review.

## Review Response

- Plan Gate round 1 (`9b43677`): P1=4 / P2=4, not approved. Accepted design fixes: isolate every Git config/template/hook/filter/signing/URL execution source; add Security & Analysis and inherited automation surfaces; align Findings Freeze with D-038; distinguish this R3 Budget Pressure route from the future R4 Actions-disabled exception; put the cutover approval at its action; invalidate a source-derived baseline; re-budget failed retries; and define a closed public cutover-record schema. Return to `design -> plan-draft`, commit the fixes, and request a new independent Plan Gate pass.
- Plan Gate round 2 (`67d285f`): P1=1 / P2=3, not approved. Round 1 closure was confirmed except the hosted route; baseline routing was partial, and exact closeout content/auditable destroyed-builder evidence were new gaps. Accepted fixes: promote both closed unavailable-hosted exceptions to `docs/ci.md` and treat this slice as a Double-Audit workflow gate change; seal a private builder evidence bundle for A/B; classify baseline failure by proven provenance; and require exact `PUBLIC_REPO_CUTOVER.md` schema/privacy/docs/independent review before its public push. Return to `design -> plan-draft` and request round 3.
- Plan Gate round 3 (`72d760e`): P1=0 / P2=1, not approved. Prior hosted, provenance, and exact-closeout findings are closed. The builder bundle was complete but its seal lifecycle tried to append post-push facts after the pre-push hash. Fix with immutable pre-push `H1` and a separately sealed post-push `H2` addendum that commits to `H1`; both audits verify the hash chain. Request round 4 closure.
- Plan Gate round 4 (`f235779`): P1=0 / P2=0, approved. The immutable `H1` / `H2` chain closed the final finding without reopening hosted routing, provenance, or exact-closeout gates. The original plan-first commit `9b43677` precedes every correction/content commit. This state-only record materializes `plan-draft -> plan-gate -> plan-approved -> implementing`; no repository/GitHub mutation is authorized.
- Double Audit initial broad pass: Audit A reported P1=0/P2=5; Audit B reported P1=2/P2=2/P3=1. Independent verification merged overlaps into the frozen set: candidate-identity audit restart; source-derived post-push destination disposal; hosted-policy SSOT alignment; recreate-only surface routing; actual-empty-destination pre-push gate; durable GitHub-surface coverage; and public closeout dashboard synchronization.
- Findings Freeze: frozen after both initial broad passes completed; closure-only from this point; post-freeze exceptions: none.
- Frozen finding closure: the source docs, workflow/CI routing, Matrix, decision record, and dashboard corrections closed the full frozen set. Audit A and Audit B each reported final P1/P2=0 after targeted closure; the independent Plan Reviewer approved both gated amendments with P1/P2=0. The final content candidate passed clean local full and public-sanitization gates; volatile exact-HEAD evidence remains in the PR body.
- State transition evidence: the clean local-full result predates this commit and materializes `implementing -> local-verified`; both independent closure reports on the final content candidate then materialize `local-verified -> independent-review -> human-confirm`. Human Gate remains owner Ready, hosted-unavailable residual-risk disposition, and merge approval; no repository/GitHub mutation is authorized by this transition.
- Owner Ready authorization: the owner confirmed the public-repository chronology and authorized Ready under the closed non-release R2/R3 Actions-unavailable route. This state-only transition materializes `human-confirm -> ready-hosted-final` and authorizes exact-HEAD L1 plus PR Ready only; merge approval and every Phase B repository mutation remain pending.
- Merge and archive: the owner explicitly approved merge after the PR body, live PR HEAD, and exact-HEAD L1 evidence matched. PR #168 was squash-merged as `d298f76`; this Post-Merge Closeout records `ready-hosted-final -> merge -> archive`. No Phase B repository mutation was performed by this design slice.
