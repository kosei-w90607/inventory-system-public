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
| SPEC-CI-SYNC-01 | synchronize欠落または余分event | regression / CLI | TDS-CI-SYNC-01 `validate exact pull_request type set` | 実効YAMLの `on.pull_request.types` が3値完全一致でない、または文字列が別位置/コメントにしかない |
| SPEC-CI-SYNC-02 | Draft runner起動 | policy / CLI | TDS-CI-SYNC-02 `draft guards cover all jobs` | `changes.if`が完全契約からdriftする、jobがchanges依存を外す、always guardが弱まる |
| SPEC-CI-SYNC-03 | required-check scope誤認 | contract / docs | TDS-CI-SYNC-03 `required-check defer is explicit` | protection有効化やpaths-ignore解決済みと記載する |
| SPEC-CI-SYNC-02 | skip token拡大 | negative / CLI | TDS-CI-SYNC-04 `skip remains owner R0/R1 only` | 構造parseした`changes.if`のactor/Risk guardが弱まる |
| SPEC-CI-SYNC-04 | stale run残存 | policy / CLI | TDS-CI-SYNC-05 `concurrency cancels superseded runs` | 実効`concurrency.cancel-in-progress`がtrueでない |
| SPEC-CI-SYNC-04 | main重複run | negative / CLI | TDS-CI-SYNC-06 `automatic trigger set remains closed` | root triggerにquoted push、merge_group、その他eventが追加される |
| SPEC-CI-SYNC-04 | wrong SHA classification | integration / CLI | TDS-CI-SYNC-07 `classifier uses PR base/head SHA` | filter stepの実run nodeがgithub.shaや古い固定refへ変わる |
| SPEC-CI-SYNC-03 | docs-only required deadlockを見逃す | contract probe / review | TDS-CI-SYNC-08 `path-filter risk remains deferred` | required checksを本PRで有効化する |
| SPEC-CI-SYNC-04 | Ready pushがstale greenを許す | regression / CLI | TDS-CI-SYNC-09 `pre-push blocks Ready refs` | `pre-push.test.sh`のReady/current-target casesがpushを許す |
| D-043 compatibility | manual trigger/check名drift | regression / CLI | TDS-CI-SYNC-10 `workflow_dispatch and check names remain stable` | root trigger完全一致またはjob name mappingが変わる |

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

- missing input: event set lacks `synchronize` -> structural YAML test and deletion mutation fail。
- invalid input: extra/unknown event、quoted `push`、`merge_group` -> root trigger exact-set mutationがfail。
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
- effective config reaches runtime: Ruby parser validates the effective root trigger、`pull_request`、guard、concurrency、classifier、job-name nodes; hosted final validates the changed workflow; synchronize runtime is next-PR dogfood。
- CLI arg reaches implementation: not applicable。

## Mutation-style Adequacy Questions

- If `synchronize` is removed, an extra event is added, or the expected string exists only in a comment/wrong node, does TDS-CI-SYNC-01 fail?
- If the Draft guard gains `|| true`, is inverted, or removed, does TDS-CI-SYNC-02 fail?
- If owner/R0/R1 skip conditions gain a decoy expected string but are weakened, does TDS-CI-SYNC-04 fail?
- If `cancel-in-progress` becomes false while the old text remains in a comment, does TDS-CI-SYNC-05 fail?
- If quoted `push` or `merge_group` enters the root trigger map, does TDS-CI-SYNC-06 fail?
- If classifier head changes from `pull_request.head.sha` to another SHA while a comment keeps the old string, does TDS-CI-SYNC-07 fail?
- If Ready/current-target push blocking is removed, does TDS-CI-SYNC-09 fail?
- If `workflow_dispatch` or an established check name drifts, does TDS-CI-SYNC-10 fail?
- If required checks are enabled while `paths-ignore` remains, does TDS-CI-SYNC-08 block scope completion?
- If docs retain the old two-event contract, does drift grep/review fail?
- If tracked Workflow State stores the current PR HEAD, does state transition review reject it?
- If a hosted URL/headSha is committed after the run, does Evidence Ownership review reject it?

## Residual Test Gaps

- This PR cannot prove its own new `synchronize` trigger before the changed workflow exists on default branch; first post-merge non-doc PR is the runtime dogfood target。
- GitHub-hosted event scheduling and cancellation cannot be fully simulated locally; exact-head hosted evidence covers the final Ready path only。
- Required-check/docs-only behavior remains deliberately unresolved until a separate R3 design removes the path-filter deadlock risk。
- Closeout observation: Draft branch更新では`synchronize` event生成とrunner jobs skipを実動作確認した。Ready head更新とcancellationは最初のpost-merge non-doc PRに残る。
