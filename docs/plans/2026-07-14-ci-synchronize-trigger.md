# CI synchronize trigger correction

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: codex-only
- Plan Commit: pending
- Amendments: none
- Coordinator: root Codex; scope, evidence, phase transitions, and Human Gate stops
- Writer: root Codex; source docs, workflow, tests, and dashboard
- Plan Reviewer: fresh independent Codex subagent; no writing role
- Final Reviewer: two fresh independent Codex subagents A/B; no writing role
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner Ready authorization, exact-HEAD hosted final, and merge

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 0

## Risk

Risk: R3

Reason:
GitHub Actions の `pull_request` event と merge evidence 契約を変更する workflow gate change。誤ると更新後 HEAD に check が作られない、Draft push で runner を消費する、または stale green を current evidence と誤認する。

## Goal

public repository で `pull_request.synchronize` を復旧し、Ready PR の head 更新を current-SHA CI 対象に戻す。Draft guard、final-only evidence、`push: main` 不使用は維持する。

## Scope

- `.github/workflows/ci.yml` の `pull_request.types` に `synchronize` を追加する。
- `scripts/tests/ci-workflow.test.sh` を、`synchronize` 拒否から必須契約へ変更する。
- `docs/ci.md`、`docs/DEV_WORKFLOW.md`、`docs/decision-log.md` に public repository 向け trigger 契約を正本化する。
- `docs/Plans.md` に public 化、初回 hosted CI green、public-writer/history-view 分離、ならびに本 active packet を public-safe に反映する。
- workflow script test、docs check、local full、独立 Double Audit、exact-HEAD hosted final を実施する。

## Non-scope

- branch protection、ruleset、required check の有効化。
- required workflow と両立させるための `paths-ignore` 撤去、常時 aggregate check、docs-only routing 再設計。
- `reopened`、`merge_group`、`push: main` の追加。
- Ready PR への通常 push を拒否する pre-push 契約の撤去。
- product code、DB、CMD、UI、POS/store data。

## Acceptance Criteria

- `scripts/tests/ci-workflow.test.sh` が `types: [opened, ready_for_review, synchronize]` を必須として exit 0 になる。
- `.github/workflows/ci.yml` が `pull_request.synchronize` を含み、`push: main` を含まない。
- Draft PR は既存 job-level guard により runner job を開始せず、Ready PR の `synchronize` は changed-area classification へ到達する契約が source docs と静的 test で一致する。
- `concurrency.cancel-in-progress: true` と `github.event.pull_request.head.sha` による current-head routing が維持される。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/tests/ci-workflow.test.sh` が exit 0 になる。
- completed HEAD で `bash scripts/local-ci.sh full` が開始・終了とも CLEAN になる。
- Double Audit 後の P1/P2 が 0 で、owner Ready 後の hosted final `headSha` が PR HEAD と一致する。

## Design Sources

- Requirements / spec: `docs/PUBLIC_REPO_MIGRATION.md` `CI and branch protection`
- Architecture: not applicable; repository workflow only
- Function / command / DTO: `.github/workflows/ci.yml` event/job graph and `scripts/tests/ci-workflow.test.sh`
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: `docs/decision-log.md` D-033 and new D-043

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | not applicable | intentionally deferred |
| Command / DTO / generated binding / wire shape | GitHub Actions event/config contract in `docs/ci.md` | updated in this PR |
| DB / transaction / audit / rollback / migration | not applicable | intentionally deferred |
| Screen / UI / route state / Japanese wording | not applicable | intentionally deferred |
| CSV / TSV / report / import / export format | not applicable | intentionally deferred |
| Durable decision / ADR | `docs/decision-log.md` D-043 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-CI-SYNC-01 | `PUBLIC_REPO_MIGRATION.md` CI and branch protection | SPEC-CI-SYNC-2026-07-14-D1 | public repository の更新後 HEAD に event を作る。全 push 復活は予算とDraft契約を壊す | `.github/workflows/ci.yml` | TDS-CI-SYNC-01 |
| SPEC-CI-SYNC-02 | `docs/ci.md` Hosted Trigger Model | SPEC-CI-SYNC-2026-07-14-D2 | Draft runner 0 と Ready current-head を両立。job guard撤去は不採用 | workflow job guards | TDS-CI-SYNC-02 |
| SPEC-CI-SYNC-03 | `docs/ci.md` Required Check Impact | SPEC-CI-SYNC-2026-07-14-D3 | path-filter skip はrequired checkをPendingにするため protection有効化を本PRに混ぜない | docs/non-scope | TDS-CI-SYNC-03 |
| SPEC-CI-SYNC-04 | `docs/ci.md` Stale Green Prevention | SPEC-CI-SYNC-2026-07-14-D4 | Ready push blockを主経路、synchronizeを外部更新/bypass時の防御にする | pre-push unchanged + CI trigger | TDS-CI-SYNC-04 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: `docs/ci.md`、D-043、`PUBLIC_REPO_MIGRATION.md` に trigger、guard、defer 境界を記録する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-043 に昇格する。
- Assumptions and constraints: Actions は有効、初回 manual dispatch は green、branch protection/ruleset は未設定、public writer と history-view は分離済み。
- Deferred design gaps, risk, and follow-up target: required check を有効にする前に `paths-ignore` と stable aggregate context を別R3で設計する。
- Test Design Matrix can cite design decision IDs or source doc sections: yes; `docs/plans/test-matrices/2026-07-14-ci-synchronize-trigger.md`。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable; GitHub workflow boundaryのみ | none |
| Fact check / design decision split | GitHub event/path-filter仕様とlive repository設定をprobeし、採用契約はD-043へ分離 | Contract Probe / D-043 |
| Lifecycle / retry | Draft push、Ready、Ready head更新、cancel、再ReadyをMatrix化 | Test Matrix |
| Operator workflow | owner操作はReady/mergeのみ。branch protection設定は本scope外 | PR body |
| Replacement path | event contract修正は通常PRで置換し、失敗時はDraftへ戻す | `docs/ci.md` |
| Data safety / evidence | public-safeな状態語だけをtracked docsへ記録し、credentialやprivate履歴を入れない | Data Safety |
| Reporting / accounting semantics | not applicable | none |
| Manual verification | exact-HEAD hosted finalはowner Ready後に確認。synchronize実event dogfoodはmerge後の次PR | PR body / follow-up |

## Design Readiness

- Existing design docs are sufficient because: `PUBLIC_REPO_MIGRATION.md` が open/ready/synchronize の必要性を既に定義し、今回 `docs/ci.md` とD-043で実装可能な境界へ具体化する。
- Source docs updated in this PR: `docs/ci.md`、`docs/DEV_WORKFLOW.md`、`docs/decision-log.md`。
- Design gaps intentionally deferred: required-check context とdocs-only path filtering、merge queue。
- Durable decisions discovered in this plan and promoted to source docs: SPEC-CI-SYNC-2026-07-14-D1..D4 をD-043へ昇格する。
- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): product layer非接触。
- Backend function design: not applicable。
- Command / DTO / data contract: GitHub Actions YAML event listとevent payload fieldsのみ。
- Persistence / transaction / audit impact: none。
- Operator workflow / Japanese UI wording: none。
- Error, empty, retry, and recovery behavior: Draftへ戻して修正、new HEADでL1/hostedを再実行。
- Testability and traceability IDs: SPEC-CI-SYNC-01..04 / TDS-CI-SYNC-01..08。

## Contract Probe

- `pull_request.synchronize` premise: GitHub公式 `Events that trigger workflows` はhead branch更新時に `synchronize` が発火し、明示 `types` はeventを限定すると確認 -> PASS。
- required-check/path-filter premise: GitHub公式 `Workflow syntax` はpath filterでskipしたworkflowのcheckがPendingに残りmergeをblockすると確認 -> PASS; required-check有効化は本scope外。
- live repository premise: read-only APIでActions enabled、初回 manual dispatch success、rulesetなし、main branch protectionなしを確認 -> PASS。
- local wiring premise: `.github/workflows/ci.yml` は `synchronize` を欠き、`scripts/tests/ci-workflow.test.sh` は現在それを明示拒否 -> RED premise confirmed。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-CI-SYNC-2026-07-14-D1 | `.github/workflows/ci.yml` types | TDS-CI-SYNC-01 | hosted runtime dogfoodは次PR |
| SPEC-CI-SYNC-2026-07-14-D2 | `jobs.changes.if` と全job依存guard | TDS-CI-SYNC-02 / 04 | no L3 |
| SPEC-CI-SYNC-2026-07-14-D3 | `paths-ignore`維持 + required-check defer明記 | TDS-CI-SYNC-03 / 08 | branch protectionはnon-scope |
| SPEC-CI-SYNC-2026-07-14-D4 | pre-push契約維持、concurrency維持 | TDS-CI-SYNC-05 / 06 | no L3 |
| D-033 final-only evidence | `push: main` absent、head SHA routing | TDS-CI-SYNC-06 / 07 | no L3 |

## Test Plan

- Test Design Matrix: [2026-07-14-ci-synchronize-trigger.md](test-matrices/2026-07-14-ci-synchronize-trigger.md)
- targeted tests: `bash scripts/tests/ci-workflow.test.sh`
- negative tests: missing `synchronize`、Draft guard欠落、`push: main`再追加、concurrency/head-sha drift
- compatibility checks: opened / ready_for_review / workflow_dispatch と既存check名を維持
- data safety checks: tracked diffにcredential、private clone path、private control evidenceがないこと
- main wiring/integration checks: `bash scripts/local-ci.sh full` とReady後hosted final

## Boundary / Wire Contract

- producer: GitHub `pull_request` webhook
- consumer: `.github/workflows/ci.yml`
- wire type: YAML `on.pull_request.types` enum list and `github.event.pull_request` payload
- internal type: job-level boolean guard and classifier `base.sha` / `head.sha`
- precision/range: event typesは `opened` / `ready_for_review` / `synchronize` の3値、manualは `workflow_dispatch`
- round-trip path: head push -> synchronize event -> Draft/skip判定 -> classifier -> selected jobs -> check conclusion
- invalid input: Draft、skip token不正、classification failureは既存fail-safe契約を維持
- compatibility: `push: main`なし、opened/ready/manual、aggregate check names、concurrencyを維持

## Review Focus

- `synchronize` 追加がDraft runner抑止とstale-green防止を弱めていないか。
- D-033のprivate-repository前提をpublic契約で正しくsupersedeしているか。
- `paths-ignore`とrequired-checkの未解決問題を完了扱いしていないか。
- testが単なる文字列存在ではなく、拒否契約の反転と周辺guard維持を検証するか。

## Spec Contract

Contract ID: SPEC-CI-SYNC-2026-07-14

- Ready PRのhead branch更新は `pull_request.synchronize` によりcurrent HEADのCI候補となる。
- Draft PRではeventが生成されてもrunner jobを開始しない。
- normal correctionはDraftへ戻してpushし、Ready化でfinalを得る。Readyのままの通常pushはpre-pushで拒否する。
- branch protection/required checkを有効にする前にpath-filterとstable contextを別R3で閉じる。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-CI-SYNC-01 | workflow types更新 | TDS-CI-SYNC-01 | event set | ci workflow test |
| SPEC-CI-SYNC-02 | Draft guard維持 | TDS-CI-SYNC-02 / 04 | runner 0 | ci workflow test |
| SPEC-CI-SYNC-03 | required-check defer | TDS-CI-SYNC-03 / 08 | scope control | docs check + review |
| SPEC-CI-SYNC-04 | stale-green契約維持 | TDS-CI-SYNC-05 / 06 / 07 | exact HEAD | local full + hosted final |

## Data Safety

- credential、token、key、auth file、private repository identity、local clone実pathをcommitしない。
- `.local/` のCI evidenceとreview raw logsはlocal-only。
- tracked docsにはpublic-safeなqualitative statusのみを記録し、private control-plane evidenceを転記しない。

## Implementation Results

Pending Plan Gate approval.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
