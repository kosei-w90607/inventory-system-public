# CI gate optimization

## Risk

Risk: R3

Reason:
This changes GitHub Actions merge gates and the conditions under which Rust/frontend checks run.

## Goal

Reduce CI disk pressure and docs-only PR cost while preserving the same merge confidence for code, generated bindings, traceability, docs, and frontend gates.

## Scope

- Add changed-area detection to CI.
- Skip heavy Rust/frontend jobs for docs-only changes.
- Split the Rust gate into fmt/clippy, test, and generated drift jobs.
- Keep the existing `Rust (fmt + clippy + test)` check name as an aggregate status.
- Add runner disk telemetry around Rust jobs.
- Document the CI routing contract in workflow source docs.

## Non-scope

- Changing Rust, frontend, or product behavior.
- Changing local pre-push semantics beyond documentation alignment.
- Replacing npm, GitHub Actions, or hosted runners.
- Changing branch protection settings.

## Acceptance Criteria

- `.github/workflows/ci.yml` contains a changed-area detection job and job-level routing for Rust/frontend gates.
- `.github/workflows/ci.yml` keeps an aggregate check named `Rust (fmt + clippy + test)`.
- Rust fmt/clippy, Rust tests, and generated drift checks no longer share the same runner workspace.
- Rust jobs print `df -h` and `du -sh target` evidence before and after the expensive command group.
- `docs/ci.md`, `docs/DEV_WORKFLOW.md`, and `docs/project-profile.md` describe the path-filtered CI contract.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.
- `bash scripts/doc-consistency-check.sh` exits 0.
- GitHub PR CI shows `Detect changed areas` and `Rust (fmt + clippy + test)` check contexts for the edited workflow.

## Design Sources

- Requirements / spec: `docs/DEV_WORKFLOW.md` Verification Gates / Draft PR Checkpoint
- Architecture: not applicable
- Function / command / DTO: not applicable
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: `docs/decision-log.md` D-026

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | not applicable | intentionally deferred |
| Command / DTO / generated binding / wire shape | `docs/DEV_WORKFLOW.md` verification gates | updated in this PR |
| DB / transaction / audit / rollback / migration | not applicable | intentionally deferred |
| Screen / UI / route state / Japanese wording | not applicable | intentionally deferred |
| CSV / TSV / report / import / export format | not applicable | intentionally deferred |
| Durable decision / ADR | `docs/decision-log.md` | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-CI-01 | `docs/DEV_WORKFLOW.md` Verification Gates | D-026 | Split heavy Rust work and route by changed area; reject workflow-level `paths` because required checks can disappear. | `.github/workflows/ci.yml` | GitHub PR CI, local doc checks |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `docs/DEV_WORKFLOW.md`, `docs/project-profile.md`, and D-026 own the routing contract.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-026 records job-level routing and Rust split.
- Assumptions and constraints: GitHub hosted runner disk is finite; docs consistency is light enough to run on every CI trigger.
- Deferred design gaps, risk, and follow-up target: Branch protection settings are not changed here; PR CI is the workflow syntax proof.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, see `docs/archive/plans/test-matrices/2026-07-01-ci-gate-optimization.md`.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable; CI tooling boundary only | none |
| Fact check / design decision split | PR #119 showed hosted-runner disk failure; this PR chooses job split/path routing as the mitigation. | D-026, PR validation |
| Lifecycle / retry | CI must still produce required status evidence when heavy jobs are skipped. | aggregate Rust job and PR body |
| Operator workflow | not applicable; no operator UI change | none |
| Replacement path | If hosted runner behavior changes, `.github/workflows/ci.yml` routing can be adjusted without product code changes. | `docs/DEV_WORKFLOW.md` |
| Data safety / evidence | CI logs may show file names and disk usage only; no real POS/store data is introduced. | Data Safety section |
| Reporting / accounting semantics | not applicable | none |
| Manual verification | GitHub PR CI is required to prove workflow syntax and routing. | PR checks |

## Design Readiness

- Existing design docs are sufficient because: `docs/DEV_WORKFLOW.md` already defines verification gates; this PR only refines their CI execution policy.
- Source docs updated in this PR: `docs/ci.md`, `docs/DEV_WORKFLOW.md`, `docs/project-profile.md`, `docs/decision-log.md`, `Plans.md`.
- Design gaps intentionally deferred: Branch protection configuration audit.
- Durable decisions discovered in this plan and promoted to source docs: D-026.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): product layers untouched.
- Backend function design: not applicable.
- Command / DTO / data contract: generated binding drift remains checked by CI.
- Persistence / transaction / audit impact: none.
- Operator workflow / Japanese UI wording: none.
- Error, empty, retry, and recovery behavior: aggregate check must fail if any required Rust sub-job fails.
- Testability and traceability IDs: SPEC-WF-CI-01 anchors the workflow change.

## Test Plan

See `docs/archive/plans/test-matrices/2026-07-01-ci-gate-optimization.md`.

- targeted tests: plan/doc consistency, workflow diff review, GitHub PR CI.
- negative tests: aggregate Rust job fails on any required failed sub-job.
- compatibility checks: old Rust check name remains present as aggregate.
- data safety checks: `git status --short` excludes generated/local/secret artifacts.
- main wiring/integration checks: PR CI runs the edited workflow.

## Boundary / Wire Contract

- producer: GitHub Actions changed-area detection job.
- consumer: Rust, frontend, docs, and aggregate jobs.
- wire type: string outputs `true` / `false`.
- internal type: shell booleans in workflow steps.
- precision/range: exact file path prefixes and selected root files.
- round-trip path: `changes` outputs feed job `if:` conditions and aggregate result logic.
- invalid input: unknown paths leave heavy jobs off unless the workflow itself changes; docs consistency still runs.
- compatibility: old Rust check name remains as aggregate status.

## Review Focus

- Path classification does not skip required code checks for Rust, frontend, generated bindings, or traceability-affecting docs.
- Aggregate Rust check cannot pass when any required Rust sub-job fails.
- Docs-only changes skip Rust/frontend heavy jobs.
- Disk telemetry is useful without exposing sensitive data.

## Spec Contract

Contract ID: SPEC-WF-CI-01

- CI uses job-level changed-area routing, not workflow-level path exclusion, so check contexts remain available.
- Docs consistency runs for every CI trigger.
- Rust work is split into fmt/clippy, test, and generated drift jobs.
- The old `Rust (fmt + clippy + test)` check name is preserved as an aggregate status.
- Workflow changes run the heavy gates.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-CI-01 | Update CI workflow | GitHub PR CI | Routing and aggregate status | PR checks |
| SPEC-WF-CI-01 | Update source docs | `bash scripts/doc-consistency-check.sh` | Docs reflect CI contract | command exit 0 |
| SPEC-WF-CI-01 | Add plan evidence | `bash scripts/doc-consistency-check.sh --target plan` | Active plan schema | command exit 0 |

## Data Safety

- Do not commit real POS CSV, PLU exports, DB files, backups, logs, receipt images, secrets, or local app data.
- Local-only paths remain `.local/`, `target/`, `src-tauri/target/`, `node_modules/`, `dist/`, and app data.
- CI disk telemetry must only print filesystem usage and target directory size, not file contents.

## Implementation Results

- Added `.github/workflows/ci.yml` changed-area detection with outputs for `rust`, `frontend`, `docs`, and `workflow`.
- Split Rust into `Rust fmt/clippy`, `Rust tests`, and `Rust generated drift` jobs.
- Kept `Rust (fmt + clippy + test)` as an aggregate check that fails if any required Rust sub-job fails.
- Kept `Design doc consistency` running on every CI trigger after changed-area detection succeeds.
- Split `Env safety` into an independent lightweight job for `.env*` / `.gitignore` changes.
- Added disk/target usage telemetry before and after each Rust command group.
- Added `docs/ci.md` as the thin CI routing reference and updated D-026, `docs/DEV_WORKFLOW.md`, `docs/project-profile.md`, and `docs/Plans.md`.

Validation:

- `bash scripts/doc-consistency-check.sh --target plan` passed.
- `bash scripts/doc-consistency-check.sh` passed.
- `git diff --check` passed.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml'); puts 'yaml ok'"` passed.
- Bash `case` classifier spot-check passed for `src/foo/bar.test.tsx`, `.env.local`, `src-tauri/.env`, `.npmrc`, `.prettierrc.json`, and `docs/function-design/x.md`.
- GitHub PR CI run #524 passed on commit `e4abb7c`: `Detect changed areas`, `Env safety`, `Design doc consistency`, `Frontend (typecheck + lint + format + build)`, `Rust fmt/clippy`, `Rust tests`, `Rust generated drift`, and aggregate `Rust (fmt + clippy + test)` all completed successfully.
- Same-PR docs-only follow-up pushes still include `.github/workflows/ci.yml` in the PR-wide diff, so they intentionally continue to run heavy gates. Docs-only skip behavior must be proven by the first later PR or post-merge run that does not include workflow/script changes.

## Review Response

- Fresh review-only sub-agent `Pasteur` reported no P1 findings.
- Accepted P2: FE test file changes were not routed to traceability drift. Fixed by adding `rust_drift` output and routing `src/*.test.ts(x)` to `Rust generated drift` without forcing Rust fmt/clippy/test.
- Accepted P2: `.env.local`, nested `.env`, and other `.env*` changes could skip env safety because it lived inside the frontend job. Fixed by adding an independent `Env safety` job and `env` changed-area output.
- Accepted P2: `.npmrc` and `.prettierrc*` changes could skip frontend gates. Fixed by adding those tooling files to the frontend classifier.
- GitHub PR CI run #524 proved Actions runtime expressions, workflow-change heavy gate routing, disk telemetry steps, and aggregate Rust status on a workflow-changing commit.
- Residual gap: docs-only skip behavior cannot be proven inside this workflow-changing PR because GitHub evaluates the PR-wide diff; confirm it on the first later docs-only PR or post-merge run without workflow/script changes.
