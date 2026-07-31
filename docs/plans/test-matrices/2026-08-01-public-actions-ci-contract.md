# Test Design Matrix: public Actions CI contract re-evaluation

## Risk

Risk: R3

## Contracts Under Test

- D-063-D1 / SPEC-WF-CI-PUBLIC-D1: public + standard runner では private monthly-minute threshold を current gate にしない。
- D-063-D2 / SPEC-WF-CI-TRIGGER-D1: completed HEAD ごとに Ready / `synchronize` / explicit dispatch / no-op の 1 経路を選ぶ。
- D-063-D3 / SPEC-WF-CI-AVAIL-D1: billing-free と Actions availability を分離し、closed fail-closed route を維持する。
- D-063-D4 / SPEC-WF-CI-HISTORY-D1: archive / historical decisions は非遡及、live docs だけを guard する。
- D-063-D5 / SPEC-WF-CI-YAML-D1: workflow YAML / job graph / cache contract は不変。

## Failure Modes

- live docs に private quota threshold が current instruction として再導入される。
- event-eligible change に Ready と pre-emptive dispatch の両方が許される。
- hosted-required docs-only の explicit dispatch が missing / failed / cancelled になった後、recovery state に入れない。
- successful / in-progress の同一 HEAD に recovery dispatch を重ねる。
- Actions unavailable route または product/gate failure blocker が free-minute 文言と一緒に消える。
- validator が archive の historical wording を current drift と誤判定する。
- docs-only intent なのに workflow YAML / job graph が変更される。
- `ci-workflow.test.sh` の guard を hosted docs job でも実行されると誤記し、実在しない L2 防御を前提にする。

## Test Matrix

既存 test の実在確認: `rg -n 'validate_workflow_contract|validate_job_graph|PASS: ci-workflow' scripts/tests/ci-workflow.test.sh` -> 3 anchor family を確認済み。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| D-063-D1 | private threshold returns | regression | `validate_public_actions_doc_contract` baseline | live `ci.md` / `DEV_WORKFLOW.md` に forbidden current wording がある |
| D-063-D1 | validator is insensitive | mutation | M1 private-quota injection | synthetic live doc に forbidden phrase を追加しても pass する |
| D-063-D2 | trigger states incomplete | regression | trigger anchor/table validation | CI-TRIGGER-D1 または required state row が欠ける |
| D-063-D2 | event-eligible pre-emptive dispatch returns | mutation | M2a event-eligible dispatch injection | event-eligible row の `dispatch しない` を dispatch 許容へ変えても pass する |
| D-063-D2 | event-filtered dispatch loses zero-run check | mutation | M2b zero-run prerequisite removal | hosted-required docs-only row から同一 HEAD run 0 件確認を除去しても pass する |
| D-063-D2 | explicit-dispatch failure becomes orphaned | mutation | M2c recovery narrowing | recovery row を event-eligible auto run 限定へ戻す、または in-progress wait を除去しても pass する |
| D-063-D2 | already-successful no-op disappears | mutation | M2d successful-row removal | already-successful no-op rowを除去しても pass する |
| D-063-D3 | availability exception weakened | mutation | M3 availability-route removal | Actions unavailable markerを除去しても pass する |
| D-063-D4 | history incorrectly scanned | compatibility | M4 archive exclusion | synthetic archiveに private-era phrase があって validator が fail する |
| D-063-D5 | existing YAML contract drifts | regression | `validate_workflow_contract` / `validate_job_graph` | trigger set、Draft guard、job graph、cache contract が変わる |
| D-063-D5 | scope creep edits YAML | diff | workflow zero-diff assertion | `.github/workflows/*.yml` に tracked diff がある |
| plan integrity | Packet / Matrix mismatch | CLI | `doc-consistency-check.sh --target plan` | active link、Workflow State、required R3 section が欠ける |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| content candidate | source draft + Plan / Matrix | L1 / independent review | state-only human-confirm commit | content finding | re-run targeted + full | contract change | implementing | P1/P2 or gate red | fix then fresh review | PR body / test logs |
| Plan Gate | plan-first commit | Sonnet 5 review | P1/P2 = 0 then state-only plan-approved->implementing | Scope/design finding | reread source + Matrix | amendment needed | plan-draft / design | unresolved P1/P2 | revised plan review | review report |
| owner authorization | Draft | state-only Ready commit | exact-HEAD L1 -> PR body -> Ready/dispatch | later tracked commit | repeat full sequence | owner revokes | implementing | HEAD mismatch | new authorization | PR body |
| final trigger | no exact-HEAD final | eligible event or checked dispatch | one successful final | HEAD change | exact-HEAD query | duplicate / missing run | Draft | product/gate failure | fix new HEAD; dispatch only after status check | Actions URL / headSha |
| state-only violation | allowlisted file candidate | zero-context hunk audit | only state/narrative fields changed | Scope/AC/design/test/code hunk | inspect file list + hunks | any forbidden hunk | implementing | checker/review fail | content commit + re-review | `git diff --unified=0` |
| hosted-not-required incidental failure | closed availability route | owner disposition | infrastructure/cancel accepted with record | product/gate failure | inspect logs | availability restored | implementing | product/test/gate red | fix + required route | PR body |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| current CI budget / trigger language | `docs/ci.md`, `docs/DEV_WORKFLOW.md`, `Plans.md`, `docs/PROJECT_HANDOFF.md`, `docs/decision-log.md` | live source / dashboard / handoff | `docs/archive/**` historical | live-doc grep + M4 |
| workflow trigger static tests | `scripts/tests/ci-workflow.test.sh`, `.github/workflows/ci.yml` | same test file | other shell suites do not own CI trigger contract | existing validator + new docs validator |
| public repository facts | repo visibility、all workflow `runs-on` sites | Contract Probe / D-063 | billing account UI is unnecessary and sensitive | gh / rg output + official docs |

## Negative Paths

- missing input: validator receives missing live-doc path -> non-zero。
- invalid input: private quota wording or missing required anchor -> non-zero。
- duplicate/ambiguous input: trigger table allows Ready + dispatch on event-eligible path -> M2a failure。event-filtered dispatch が run 0 件確認を失う -> M2b failure。
- unknown reference: D-063 / CI-PUBLIC-D1 / CI-TRIGGER-D1 missing -> non-zero。
- dependency missing: existing script dependencies (`bash`, `ruby`, `grep`) follow current fail-fast behavior。
- permission/write failure: tests use `mktemp -d`; creation failure is non-zero。
- dry-run side effect: mutation changes temp copies only; tracked docs / workflow remain unchanged。

## Boundary Checks

- threshold: private minute thresholds are absent from live docs; cache `10 GB` remains a capacity boundary, not billing gate。
- null/default: missing contract anchor is fail-closed。
- empty/non-empty: empty trigger table / missing route fails。
- min/max: normal path chooses one final trigger; service recovery remains available。
- status/policy enum: event-eligible / event-filtered / automatic-or-explicit recovery / already-successful states。
- wire type: not applicable。
- internal type: not applicable。
- producer/consumer: `docs/ci.md` produces current policy; DEV_WORKFLOW / owner workflow / validator consume it。
- round-trip token: CI-PUBLIC-D1 / CI-TRIGGER-D1 / D-063 references。
- precision/range: not applicable。
- cross-language parse: Ruby YAML parser coverage remains unchanged。

## Compatibility Checks

- old schema/input: historical D-033 and archive remain readable and unmodified。
- new schema/input: no workflow YAML schema change。
- output order: CI job order / names unchanged。
- optional field behavior: `workflow_dispatch` remains available for docs-only / recovery。

## Data Safety Checks

- source-derived data: only public GitHub repository metadata / run evidence。
- generated outputs: none。
- secrets: billing account details、tokens、`.env*` を読まない。
- local-only files: `.local/**`, `/tmp/inventory-ci-audit-gh-cache/**` are not committed。
- synthetic sample boundaries: all mutations under `mktemp -d`。

## Main Wiring / Integration Checks

- helper connected to main path: `validate_public_actions_doc_contract` is invoked in `ci-workflow.test.sh` baseline before mutation fixtures。
- output reaches manifest/report: `PASS: ci-workflow` only after baseline + mutations。
- effective config reaches runtime: workflow YAML is unchanged and existing validator still parses actual file。
- CLI arg reaches implementation: validator accepts explicit temp doc paths for mutations and defaults to real live docs。
- registration boundary: `scripts/local-ci.sh:214` が `ci-workflow.test.sh` を呼ぶため guard は L1 `local-ci.sh full` で実行される。hosted `ci.yml` docs job はこの check を実行しない。
- deferred hosted wiring: hosted 側で docs contract の実防御が必要になった場合は、CI-PUBLIC-D1 / CI-TRIGGER-D1 guard を `scripts/doc-consistency-check.sh` へ統合する別 R3 change を起票する。

## Mutation-style Adequacy Questions

- If `CI-PUBLIC-D1` remains but private quota prose returns elsewhere in live docs, M1 forbidden-wording assertion fails。
- If event-eligible row permits preventive dispatch, M2a fails。
- If event-filtered hosted-required row drops the zero-run prerequisite, M2b fails。
- If recovery is narrowed back to automatic event only or stops waiting for in-progress runs, M2c fails。
- If the already-successful row is removed while the heading remains, M2d fails。
- If Actions-unavailable route is deleted while billing prose stays correct, M3 fails independently。
- If validator scans the whole repo and starts rejecting archive history, M4 detects the false positive。
- If workflow triggers / Draft guard / job graph change without docs change, existing YAML mutations still fail。
- If a state-only commit edits Scope / AC / tests, hunk-level workflow check returns to implementing。
- If a hosted URL is committed after the run, exact-HEAD three-point check fails because HEAD changes。

## Residual Test Gaps

- GitHub billing policy can change outside the repository; static tests prove current docs consistency, not future official policy. D-063 Revisit requires a fresh official-doc probe。
- Documentation cannot technically prevent a user from dispatching before Ready. The contract makes the correct choice reviewable; Actions run history remains the operational detector。
- HEAD SHA-only concurrency can cancel overlapping same-HEAD runs but would lose current PR-number grouping's cross-HEAD superseded-run cancellation and cannot stop sequential duplicates. Revisit only with a dispatch-to-PR mapping design if CI-TRIGGER-D1 dogfood still shows overlap-driven duplicates。
- required-check Pending behavior is not tested because required checks / rulesets are currently absent and out of scope。
- `ci-workflow.test.sh` の contract drift guard は L1 local-only で、hosted final 自体はこの guard の実行証拠にならない。hosted 実防御が必要になった時点で `doc-consistency-check.sh` 統合を別 R3 として設計・検証する。
