# Test Design Matrix: CI gate optimization

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-CI-01: CI uses job-level changed-area routing while preserving merge-gate confidence.
- SPEC-WF-CI-01: Rust fmt/clippy, Rust tests, and generated drift checks do not share one runner workspace.
- SPEC-WF-CI-01: The existing `Rust (fmt + clippy + test)` check name remains as an aggregate status.

## Failure Modes

- Docs-only PR still runs heavy Rust/frontend jobs.
- Rust code change skips fmt/clippy, tests, bindings drift, or traceability.
- Generated binding or traceability-related doc change skips drift checks.
- Frontend test file change skips traceability baseline checks.
- Env file or `.gitignore` change skips env safety.
- Frontend tooling config change skips frontend gates.
- A failed required Rust sub-job is hidden by the aggregate check.
- CI disk exhaustion recurs without enough telemetry to diagnose.
- Workflow syntax is invalid and only discovered after merge.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-WF-CI-01 | Plan evidence malformed | docs CLI | `bash scripts/doc-consistency-check.sh --target plan` | active Plan Packet or matrix violates workflow checks |
| SPEC-WF-CI-01 | Source docs inconsistent | docs CLI | `bash scripts/doc-consistency-check.sh` | workflow docs or linked plan references are inconsistent |
| SPEC-WF-CI-01 | GitHub workflow syntax invalid | GitHub Actions | PR CI run | edited `.github/workflows/ci.yml` cannot parse or start |
| SPEC-WF-CI-01 | Rust sub-job failure hidden | review/evidence | aggregate job shell logic review + PR CI | aggregate job ignores failed `rust_lint`, `rust_test`, or `rust_drift` when Rust is required |
| SPEC-WF-CI-01 | Docs-only path still heavy | review/evidence | changed-area classifier review | docs-only paths classify as Rust/frontend unnecessarily |
| SPEC-WF-CI-01 | Rust/traceability path skipped | review/evidence | changed-area classifier review | `src-tauri/**`, `src/lib/bindings.ts`, or traceability docs do not require Rust drift checks |
| SPEC-WF-CI-01 | FE test traceability skipped | review/evidence | changed-area classifier review | `src/**/*.test.ts(x)` does not require Rust generated drift |
| SPEC-WF-CI-01 | env safety skipped | review/evidence | changed-area classifier review | `.env*`, nested `.env*`, or `.gitignore` do not require `Env safety` |
| SPEC-WF-CI-01 | frontend config skipped | review/evidence | changed-area classifier review | `.npmrc` or `.prettierrc*` do not require frontend gates |
| SPEC-WF-CI-01 | Disk failure lacks evidence | review/evidence | workflow step review | Rust jobs do not print disk/target usage before and after expensive commands |

## Negative Paths

- missing input: push event with all-zero `before` SHA falls back to parent commit or tree listing.
- invalid input: workflow change runs heavy gates through `workflow=true`.
- duplicate/ambiguous input: paths can classify into multiple areas; each relevant gate runs.
- unknown reference: if base SHA is unavailable, changed-area detection falls back instead of failing silently.
- dependency missing: GitHub PR CI is the only authoritative syntax/runtime proof.
- permission/write failure: no local destructive actions or generated output commits are required.
- dry-run side effect: local docs checks should not write generated files.

## Boundary Checks

- threshold: none.
- null/default: empty changed file list keeps docs job running and heavy jobs skipped unless workflow is touched.
- empty/non-empty: `files` loop ignores blank lines.
- min/max: no numeric range.
- status/policy enum: outputs are only `true` / `false`.
- wire type: GitHub Actions job outputs.
- internal type: bash booleans.
- producer/consumer: `changes` job outputs consumed by job `if:` expressions and Rust aggregate shell logic.
- round-trip token: `rust`, `frontend`, `docs`, `workflow`.
- precision/range: file path prefix and root filename patterns.
- cross-language parse: YAML expressions to bash strings.

## Compatibility Checks

- old schema/input: existing check name `Rust (fmt + clippy + test)` remains.
- new schema/input: internal Rust sub-jobs appear as additional check contexts.
- output order: not applicable.
- optional field behavior: skipped heavy jobs must be represented by aggregate/status behavior rather than missing workflow run.

## Data Safety Checks

- source-derived data: no real POS/store files are added.
- generated outputs: no generated bindings/traceability files are modified by this PR.
- secrets: no `.env*`, keys, tokens, or auth files are read or committed.
- local-only files: `target/`, `src-tauri/target/`, `.local/`, `node_modules/`, `dist/` remain untracked.
- synthetic sample boundaries: not applicable.

## Main Wiring / Integration Checks

- helper connected to main path: `changes` job is a dependency of Rust/frontend/docs jobs.
- output reaches manifest/report: PR checks show job routing and disk telemetry.
- effective config reaches runtime: GitHub Actions runs edited `.github/workflows/ci.yml`.
- CLI arg reaches implementation: docs checks run with and without `--target plan`.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? PR CI or review of aggregate logic catches Rust aggregate passing/skipping incorrectly.
- If a threshold comparison changes, which test fails? not applicable.
- If a guard is removed, which test fails? Workflow change no longer forces heavy gates; classifier review catches it.
- If an output field is omitted, which test fails? GitHub workflow parse/runtime fails or jobs cannot evaluate outputs.
- If output order changes, which test fails? not applicable.
- If dry-run performs a side effect, which test fails? `git status --short` after docs checks.
- If a JSON number crosses JavaScript safe integer range, which test fails? not applicable.
- If a state token is round-tripped through browser/client code, which test fails? not applicable.

## Residual Test Gaps

- Local validation cannot fully emulate GitHub Actions job scheduling or check-context behavior; PR CI is required evidence.
