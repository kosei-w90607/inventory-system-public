# Test Design Matrix: CI synchronize trigger correction

## Risk

Risk: R3

## Contracts Under Test

- SPEC-CI-SYNC-01: Ready PR head更新は `pull_request.synchronize` の対象になる。
- SPEC-CI-SYNC-02: Draft PRはrunner jobを開始しない。
- SPEC-CI-SYNC-03: required-check/path-filter再設計を本変更の完了に含めない。
- SPEC-CI-SYNC-04: exact-HEAD、concurrency、pre-push stale-green防止を維持する。

## Failure Modes

- `types` に `synchronize` がなく、Ready PR更新後のHEADにrunが作られない。
- `synchronize` 追加と同時にDraft guardが外れ、Draft pushごとにrunnerを消費する。
- `push: main` が復活し、merge後の重複runを作る。
- `paths-ignore`をrequired-check対応済みと誤記し、docs-only PRがPendingでdeadlockする。
- classifierが古いSHAまたはmerge refを使い、current PR headと違う差分を検査する。
- concurrencyが外れ、superseded runが残る。
- skip tokenがR2+またはowner以外でhosted gateを抑止する。
- source docs、workflow、静的testのevent setがdriftする。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-CI-SYNC-01 | synchronize欠落 | regression / CLI | TDS-CI-SYNC-01 `require synchronize trigger` | workflow typesが旧2値のまま |
| SPEC-CI-SYNC-02 | Draft runner起動 | policy / CLI | TDS-CI-SYNC-02 `draft guards cover all jobs` | changesまたはalways jobのguardが外れる |
| SPEC-CI-SYNC-03 | required-check scope誤認 | contract / docs | TDS-CI-SYNC-03 `required-check defer is explicit` | protection有効化やpaths-ignore解決済みと記載する |
| SPEC-CI-SYNC-02 | skip token拡大 | negative / CLI | TDS-CI-SYNC-04 `skip remains owner R0/R1 only` | actor/Risk guardが弱まる |
| SPEC-CI-SYNC-04 | stale run残存 | policy / CLI | TDS-CI-SYNC-05 `concurrency cancels superseded runs` | cancel-in-progressがfalse/欠落 |
| SPEC-CI-SYNC-04 | main重複run | negative / CLI | TDS-CI-SYNC-06 `push main remains absent` | push triggerが追加される |
| SPEC-CI-SYNC-04 | wrong SHA classification | integration / CLI | TDS-CI-SYNC-07 `classifier uses PR base/head SHA` | github.shaや古い固定refへ変わる |
| SPEC-CI-SYNC-03 | docs-only required deadlockを見逃す | contract probe / review | TDS-CI-SYNC-08 `path-filter risk remains deferred` | required checksを本PRで有効化する |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Draft PR update | Draft | synchronize event評価 | all runner jobs skipped | PR Ready化 | current payload | every push | new head event | runner starts | restore guards | workflow test / Actions UI |
| Ready PR update | Ready | synchronize run | current head jobs conclude | new push | current headSha | merge gate | Draft correction | missing/stale run | Draft -> fix -> Ready | hosted run metadata |
| superseded run | old head running | new synchronize | old cancelled/new continues | another head | latest event | before merge | concurrency group | both continue | fix concurrency | Actions run list |
| docs-only PR | opened/updated | path filter | event-level no run under current contract | required checks enabled | ruleset state | before protection | separate R3 | Pending deadlock | redesign stable context | official docs + API |
| content candidate | implementing | L1 / Double Audit | human-confirm state-only commit | content fix | source docs/diff | before Ready | implementing | P1/P2 or gate fail | new candidate | PR body |
| owner authorization | human-confirm | Draft state-only Ready commit -> exact-HEAD L1 -> PR body | Ready/hosted exact head | later tracked commit | PR head/run | merge | implementing | SHA mismatch | new review/L1/Ready | PR body |
| state-only violation | state transition | hunk audit | allowlisted state only | forbidden hunk | zero-context diff | each transition | implementing | Scope/AC/code change | re-review | git diff |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| D-033 final-only event set | `.github/workflows/ci.yml`, `docs/ci.md`, `docs/DEV_WORKFLOW.md`, D-033, workflow test | all active source/test sites | archive docs are historical | TDS-CI-SYNC-01/06 + drift grep |
| Draft/skip job guards | every job `if:` including `always()` aggregate jobs | no code change intended | none | TDS-CI-SYNC-02/04 |
| exact-head classifier | workflow filter step, local CI, stale-green docs | workflow remains on PR base/head payload | local CI merge-base is a different documented path | TDS-CI-SYNC-07 |

## Negative Paths

- missing input: event set lacks `synchronize` -> static test fails。
- invalid input: unknown event or `push` section -> review/static rejection。
- duplicate/ambiguous input: duplicate trigger or conflicting docs -> drift grep/review failure。
- unknown reference: classifier cannot resolve base/head -> existing all-gates fail-safe。
- dependency missing: Actions unavailable -> hosted-required change blocks。
- permission/write failure: no retry with broader GitHub mutation; stop before Ready。
- dry-run side effect: read-only Contract Probe must not alter rulesets/protection/Actions。

## Boundary Checks

- threshold: exactly the three automatic PR activity types in scope。
- null/default: explicit `types` list; do not rely on GitHub defaults。
- empty/non-empty: event list and classifier output cannot be empty。
- min/max: one current PR head per run; superseded run cancelled。
- status/policy enum: Draft / Ready; R0/R1 / R2+; required / not-required。
- wire type: YAML activity-type strings and pull_request payload SHA fields。
- internal type: boolean job guards and classifier key/value outputs。
- producer/consumer: GitHub webhook -> Actions workflow -> classifier/jobs。
- round-trip token: `pull_request.head.sha` -> checkout/run -> hosted `headSha`。
- precision/range: full SHA handled by GitHub; tracked docs store no volatile SHA。
- cross-language parse: YAML parser + shell static tests。

## Compatibility Checks

- old schema/input: opened、ready_for_review、workflow_dispatch remain valid。
- new schema/input: synchronize added without push/reopened/merge_group。
- output order: job/check names unchanged。
- optional field behavior: absent PR body does not satisfy skip token。

## Data Safety Checks

- source-derived data: public workflow/docs only; private control evidence is not copied。
- generated outputs: local CI logs remain `.local/`。
- secrets: no credentials, auth state, key names, or secret values in diff/output。
- local-only files: clone paths and history graft inventory remain untracked。
- synthetic sample boundaries: workflow tests use static/synthetic fixtures only。

## Main Wiring / Integration Checks

- helper connected to main path: `ci-workflow.test.sh` is invoked by local full workflow tests。
- output reaches manifest/report: YAML event reaches GitHub Actions parser after merge。
- effective config reaches runtime: hosted final validates the changed workflow; synchronize runtime is next-PR dogfood。
- CLI arg reaches implementation: not applicable。

## Mutation-style Adequacy Questions

- If `synchronize` is removed again, does TDS-CI-SYNC-01 fail?
- If the Draft guard is inverted or removed, does TDS-CI-SYNC-02 fail?
- If owner/R0/R1 skip conditions are weakened, does TDS-CI-SYNC-04 fail?
- If `cancel-in-progress` becomes false, does TDS-CI-SYNC-05 fail?
- If `push: main` returns, does TDS-CI-SYNC-06 fail?
- If classifier head changes from `pull_request.head.sha` to another SHA, does TDS-CI-SYNC-07 fail?
- If required checks are enabled while `paths-ignore` remains, does TDS-CI-SYNC-08 block scope completion?
- If docs retain the old two-event contract, does drift grep/review fail?
- If tracked Workflow State stores the current PR HEAD, does state transition review reject it?
- If a hosted URL/headSha is committed after the run, does Evidence Ownership review reject it?

## Residual Test Gaps

- This PR cannot prove its own new `synchronize` trigger before the changed workflow exists on default branch; first post-merge non-doc PR is the runtime dogfood target。
- GitHub-hosted event scheduling and cancellation cannot be fully simulated locally; exact-head hosted evidence covers the final Ready path only。
- Required-check/docs-only behavior remains deliberately unresolved until a separate R3 design removes the path-filter deadlock risk。
