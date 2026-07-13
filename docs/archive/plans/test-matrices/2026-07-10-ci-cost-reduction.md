# Test Design Matrix: CI cost reduction — hosted final-only + local verification ladder

> Parent Plan Packet: [../2026-07-10-ci-cost-reduction.md](../2026-07-10-ci-cost-reduction.md)

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-CI2-01: hosted CI is final-only. Draft pushes do not trigger it; docs-only uses zero hosted runs; Ready direct/opened and Draft-to-Ready are covered; dispatch always runs full gates.
- SPEC-WF-CI2-02: local evidence is keyed by exact HEAD SHA and distinguishes CLEAN/DIRTY.
- SPEC-WF-CI2-03: Actions cache stores Cargo dependency download data only and does not store target/bin build output.
- SPEC-WF-CI2-04: CI/local/pre-push share one classifier with generated, traceability, workflow, and unknown handling.
- SPEC-WF-CI2-05: local-ci changed uses the PR-wide merge-base diff; full runs the remote-equivalent gate set and fails nonzero on gate errors.
- SPEC-WF-CI2-06: pre-push is a push-increment fast gate, generates the frontend route tree before typecheck/lint, propagates each gate failure, blocks Ready pushes, and records sanctioned bypass.
- SPEC-WF-CI2-07: npm security monitor is weekly + dispatch while D-030 install guards stay unchanged.
- SPEC-WF-CI2-08: D-026 Rust three-job split, aggregate name, and disk telemetry remain.
- SPEC-WF-CI2-09: Disabled migration, 75%/90% budget modes, and 2026-08-01 re-evaluation are executable and documented.

## Failure Modes

- Draft push or `push: main` starts hosted CI.
- docs-only or explicit R0/R1 skip consumes a runner.
- A body token alone suppresses hosted CI without owner/Risk authorization.
- Ready-direct PR gets no run because only `ready_for_review` is handled.
- Ready-state follow-up push leaves stale green for an older SHA.
- main `workflow_dispatch` uses merge-base=HEAD and produces a zero-diff light green instead of full validation.
- multi-commit PR changed mode examines only the latest commit.
- origin/main is unavailable or a path is unknown and the classifier silently skips heavy gates.
- generated binding and traceability inputs collapse into a category that a consumer forgets to run.
- frontend source/config is omitted from pre-push; docs-only runs frontend unnecessarily.
- copy old-side ownership is omitted, or local full never proves lockfile clean installability.
- raw bypass leaves no evidence.
- evidence filename/body lacks SHA, DIRTY is indistinguishable, or a failed gate exits zero.
- target/bin remains cached, dependency cache is deleted, or Rust jobs create three duplicate cache keys.
- workflow syntax is untested while Actions is Disabled.
- daily npm monitor remains active.
- required check names disappear and future branch protection migration becomes ambiguous.

## Test Matrix

Timing: pre-merge is local in this Draft PR; post-merge requires owner Enable.

| Contract | Failure mode | Type | Timing | Test / evidence | Would fail if... |
|---|---|---|---|---|---|
| SPEC-WF-CI2-01 | Draft push / main push trigger | static workflow | pre-merge | YAML asserts no push/synchronize; only opened/ready_for_review + dispatch | old trigger remains |
| SPEC-WF-CI2-01 | docs-only billed job | static + post-merge | both | paths-ignore fixture/review; first docs-only PR run count 0 | docs path reaches runner |
| SPEC-WF-CI2-01 | Ready direct missing | static + post-merge | both | opened + non-draft guard; first Ready-direct case gets one run | opened is missing or Draft guard inverted |
| SPEC-WF-CI2-01 | R0/R1/Draft skip ignored | workflow fixture | pre-merge | changes guard + every `always()` consumer (Rust aggregate included) yields runner 0 | aggregate still starts/fails |
| SPEC-WF-CI2-01 | unauthorized skip token | workflow fixture | pre-merge | skip requires owner actor plus `Risk: R0` / `Risk: R1`; dispatch ignores skip | body token alone suppresses required CI |
| SPEC-WF-CI2-01 | template accidentally opts into skip | workflow fixture | pre-merge | default PR template does not contain the exact skip token | changing only Risk silently suppresses CI |
| SPEC-WF-CI2-01 | template change event-filtered | workflow fixture | pre-merge | root Markdown/docs are ignored but `.github/pull_request_template.md` is not covered by broad Markdown ignore | merge-gate template bypasses hosted validation |
| SPEC-WF-CI2-01 | unguarded runner job added | workflow graph mutation | pre-merge | every job except `changes` depends on `changes`; injected unguarded job is rejected | later job bypasses Draft/R0/R1 guard |
| SPEC-WF-CI2-01 | main dispatch light green | static + post-merge | both | dispatch sets all area outputs true; first main dispatch runs every job | dispatch reuses zero diff |
| SPEC-WF-CI2-01 | duplicate runs | static + post-merge | both | concurrency group + cancel-in-progress true | old run is not cancelled |
| SPEC-WF-CI2-02 | stale/dirty evidence | shell integration | pre-merge | full log filename/body SHA; DIRTY is diagnostic-only; final exact-HEAD CLEAN evidence required | dirty evidence is accepted for merge |
| SPEC-WF-CI2-02 | gate mutates checkout | shell integration | pre-merge | injected gate mutation makes end tree DIRTY and local-ci fails | start-only CLEAN marker remains falsely valid |
| SPEC-WF-CI2-03 | target/bin cache | static | pre-merge | cache paths include registry index/cache + git db; exclude target/bin | build output remains or dependencies vanish |
| SPEC-WF-CI2-03 | cache multiplication | review | pre-merge | all Rust jobs retain same OS+Cargo.lock key/restore prefix | job suffix creates three entries |
| SPEC-WF-CI2-04 | docs-only | shell fixture | pre-merge | classifier expected docs=true only | heavy area becomes true |
| SPEC-WF-CI2-04 | frontend-only | shell fixture | pre-merge | `src/**`, public, package/config patterns set frontend | FE is skipped |
| SPEC-WF-CI2-04 | Rust-only | shell fixture | pre-merge | src-tauri sets rust + generated + traceability + rust_drift | drift checks are lost |
| SPEC-WF-CI2-04 | frontend test + traceability | shell fixture | pre-merge | `src/**/*.test.ts(x)` sets frontend + traceability + rust_drift | traceability is skipped |
| SPEC-WF-CI2-04 | env-only | shell fixture | pre-merge | root/nested env patterns set env + frontend | env safety is skipped |
| SPEC-WF-CI2-04 | generated-only | shell fixture | pre-merge | bindings path sets generated + rust_drift | binding drift is skipped |
| SPEC-WF-CI2-04 | workflow change | shell fixture | pre-merge | workflow/scripts path routes all gates | routing edits self-skip |
| SPEC-WF-CI2-04 | unknown path | shell negative | pre-merge | unknown root and nested paths set unknown + all areas true | unknown silently skips |
| SPEC-WF-CI2-04 | indeterminate base | shell negative | pre-merge | nonexistent base sets unknown + all areas true | fallback gets lighter |
| SPEC-WF-CI2-04 | deleted source/test path | git fixture | pre-merge | delete-only branch still classifies the removed path | diff-filter silently omits deletions |
| SPEC-WF-CI2-04 | cross-area rename/copy | git fixture | pre-merge | `src/**` to `docs/**` rename and copy classify old and new paths | old frontend ownership is omitted |
| SPEC-WF-CI2-05 | latest-commit-only diff | git fixture | pre-merge | multi-commit branch with origin/main merge-base includes every PR file | changed sees only HEAD^ |
| SPEC-WF-CI2-05 | invalid mode | shell negative | pre-merge | `local-ci.sh foo` prints usage and exits nonzero | invalid input passes |
| SPEC-WF-CI2-05 | missing gate / swallowed error | shell integration | pre-merge | changed/full log gate names + exit codes; injected/real failure is nonzero | gate is absent or error swallowed |
| SPEC-WF-CI2-05 | full equivalence | integration | pre-merge | local full runs Rust, generated, traceability, FE, env, docs, workflow tests | remote-important gate is absent |
| SPEC-WF-CI2-05 | stale/uninstallable node_modules | static + full integration | pre-merge | local full runs `npm ci` before frontend checks | local dependencies hide lockfile install failure |
| SPEC-WF-CI2-06 | frontend fast gate/shared classifier absent | shell fixture | pre-merge | pre-push calls shared classifier; FE push calls generate:routes before typecheck + lint; docs-only calls neither; unknown routes full | stale route tree or duplicated/incomplete routing |
| SPEC-WF-CI2-06 | classifier process fails | shell negative | pre-merge | nonzero classifier exits block push and record `FAIL classifier` | failure becomes all-false SKIP |
| SPEC-WF-CI2-06 | GitHub PR state lookup unavailable | shell negative | pre-merge | missing gh or nonzero gh lookup blocks push and records `FAIL ready-state-lookup` | Ready state is assumed safe and stale green can survive |
| SPEC-WF-CI2-06 | Ready push allowed | shell fixture | pre-merge | fake gh Ready state makes pre-push nonzero before push | stale path remains |
| SPEC-WF-CI2-06 | pushed ref differs from checkout branch | shell fixture | pre-merge | Ready state is checked for stdin `remote_ref`; evidence records stdin `local_oid` | `HEAD:ready-branch` bypasses the guard or logs wrong SHA |
| SPEC-WF-CI2-06 | bypass invisible | shell fixture | pre-merge | approved fixed reason exits zero and appends BYPASS; free-form reason rejects | bypass has no evidence or leaks text |
| SPEC-WF-CI2-07 | daily monitor remains | static | pre-merge | cron is weekly and workflow_dispatch remains | daily consumption continues |
| SPEC-WF-CI2-08 | D-026 regression | diff review | pre-merge | three Rust jobs, aggregate check name, disk telemetry unchanged | disk mitigation is removed |
| SPEC-WF-CI2-09 | YAML/event/job graph gap | static | pre-merge | Ruby YAML + Prettier + `ci-workflow.test.sh`; actionlint when installed | syntax passes but trigger/guard graph is broken |
| SPEC-WF-CI2-09 | only first shell file syntax-checked | local-ci fixture + integration | pre-merge | local-ci loops over every discovered `*.sh` and runs `bash -n` separately | later script syntax errors are positional args and ignored |
| SPEC-WF-CI2-09 | migration/budget docs gap | docs consistency/review | pre-merge | source docs contain Disabled steps, 75/90, Aug-1 review, owner actions | operation cannot be followed |
| SPEC-WF-CI2-09 | runtime gap | Actions evidence | post-merge | owner Enable then one main dispatch; all jobs success at exact headSha | workflow expressions/runtime are broken |

## Red Tests Before Implementation

1. Add `scripts/tests/classify-changes.test.sh` first. It must fail because the shared classifier does not exist.
2. Cover docs-only, frontend-only, Rust-only, frontend test + traceability, env-only, generated-only, workflow, unknown root/nested, missing base, and multi-commit merge-base before implementing the classifier.
3. Add `scripts/tests/local-ci.test.sh` before local-ci. It must fail for the missing entrypoint, then cover invalid mode, exact SHA, CLEAN/DIRTY, command/exit evidence, and nonzero propagation.
4. Add `scripts/tests/pre-push.test.sh` before changing pre-push. It must fail for missing frontend routing / Ready block / bypass evidence.
5. Add `scripts/tests/ci-workflow.test.sh` before changing YAML. It must fail for old triggers, missing guards/dispatch/concurrency/cache policy.
6. Verify each RED failure is caused by the missing contract, then implement the minimum behavior.

## Negative Paths

- Missing `origin/main`: try local `main`; if no trustworthy merge-base exists, full fallback.
- Unknown path: unknown=true and all area booleans true.
- Empty diff in local changed: docs consistency still runs; no false claim of full evidence.
- workflow_dispatch empty diff: all gates run by explicit workflow branch, not classifier output.
- `.local/` not writable: evidence creation fails nonzero.
- Invalid bypass token or free-form reason: block without logging the supplied text.
- GitHub remote + PR-state lookup failure: Ready guard fails closed; sanctioned bypass is the recovery path.
- Generated command changes tracked output: drift gate fails and leaves inspectable diff; no silent cleanup.

## Boundary / Wire Checks

- Output keys: rust, rust_drift, frontend, docs, env, generated, traceability, workflow, unknown.
- Values: exactly `true` or `false`, one `key=value` per line on stdout; diagnostics go to stderr.
- `rust_drift == generated || traceability`.
- One file may set multiple categories.
- Any unknown or base failure makes every area true.
- CI writes the plain output to `GITHUB_OUTPUT`; local/pre-push parse the same output without GitHub-only environment variables.

## Compatibility Checks

- Existing six keys and job names remain available.
- Aggregate check remains `Rust (fmt + clippy + test)`.
- `.local/quality-check.log` remains append-only with timestamp + HEAD + result + gate names.
- npm setup-node `cache: npm` remains unchanged.
- Rust three-job split remains unchanged.

## Data Safety Checks

- Fixtures use synthetic path strings and temporary git repositories only.
- No `.env*` content, credentials, POS/store data, DB, backup, log content, or receipt image is read.
- Evidence logs commands/results only and do not dump environment variables.
- `.local/ci-evidence/` and `.local/quality-check.log` remain ignored.

## Mutation-style Adequacy Questions

- Invert Draft/non-draft guard: Ready-direct/Draft static test fails.
- Remove dispatch full override: main zero-diff contract test/review fails.
- Remove a frontend config glob: classifier fixture fails.
- Treat unknown as false: unknown fixtures fail.
- Change merge-base to HEAD^: multi-commit fixture fails.
- Remove Ready block: pre-push fixture fails.
- Check the checkout branch instead of pushed remote ref: cross-ref pre-push fixture fails.
- Remove evidence SHA/DIRTY: integration assertion fails.
- Accept a gate-created tracked change: end-state local-ci fixture fails.
- Ignore rename source paths: cross-area rename fixture fails.
- Disable copy detection: cross-area copy fixture fails.
- Remove full-mode `npm ci`: local-ci fixture fails.
- Honor skip without owner/R0-R1 authorization: workflow fixture fails.
- Add a runner job without `needs: changes`: workflow graph mutation fixture fails.
- Re-add target or per-job key suffix: cache static review fails.

## Residual Test Gaps

- Before merge, GitHub event delivery and Actions expressions could not be fully proven while CI was Disabled. The first main dispatch proved workflow runtime; the next R3 PR must prove opened/ready_for_review behavior.
- A raw `git push --no-verify` can bypass any local hook. It is an explicit policy violation; exact-HEAD merge evidence remains the final detection layer.
- Branch protection cannot enforce the exact-HEAD run on the current Free private repository. Owner review must perform the documented SHA check until repository plan/settings change.
- Billed-minute savings and cache eviction behavior require observation after 2026-08-01.

## Post-Merge Evidence（2026-07-10）

- PR #160 merge SHA: `25e945b9a32243d6cff6b49f6188d68f4b14c09e`.
- Owner enabled `CI`; `main` manual dispatch run 29091831468 (private archive Actions evidence 29091831468) succeeded with the exact SHA.
- This docs-only R1 closeout uses `Risk: R1` and `Hosted CI: skip`; expected hosted run count is zero.
- Remaining post-merge tests: first R3 dogfood for Draft push suppression, Ready event execution count, stale-green prevention, and owner runbook; WER follows that dogfood.
