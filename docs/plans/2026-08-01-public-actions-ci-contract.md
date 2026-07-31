# Plan Packet: public Actions CI contract re-evaluation

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex (GPT-5.6, main session)
- Writer: Codex (GPT-5.6, main session)
- Plan Reviewer: Claude Sonnet 5 (external, fresh context)
- Final Reviewer: Claude Sonnet 5 (external, fresh context; Double Audit first pass) + independent fresh second pass
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready authorization + merge approval (pending)

Narrative (append-only):

- 2026-08-01 kickoff -> spec-check -> design -> plan-draft -> plan-gate: owner は CI reality audit と現状に沿わない source-doc 記述の一括是正を承認した。GitHub 公式 contract、repository visibility、workflow runner class、recent run history、cache usage、branch protection / ruleset を read-only 実測し、D-063 / CI-PUBLIC-D1 / CI-TRIGGER-D1 を source docs に起草した。implementation は Plan Review 後の static / mutation regression test 追加だけで、workflow YAML は変更しない。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

規範値確認: `sed -n '269,272p' docs/DEV_WORKFLOW.md` -> `interventions ≤3, hands-on time ≤30 minutes, relay round-trips ≤2`。現時点の owner 介入は kickoff / scope 承認の 1 回。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
`docs/ci.md` / `docs/DEV_WORKFLOW.md` の hosted merge evidence 契約と、その drift を hosted/local gate で検出する `scripts/tests/ci-workflow.test.sh` を変更する workflow gate change。product code、DB、wire、operator UI は変更しないため R4 ではない。workflow gate change なので independent Plan Review と Final Double Audit を必須とする。

## Goal

Goal Invariant: public repository + standard GitHub-hosted runner という現状に CI source contract を一致させ、private-era billed-minute 閾値を current gate から退役させる。同時に Ready / `synchronize` と `workflow_dispatch` の選択を completed HEAD ごとに一意化し、Actions service 自体の障害時にだけ使う closed fail-closed route と exact-HEAD evidence は維持する。

### 最小完了条件

- live source docs が CI-PUBLIC-D1 と CI-TRIGGER-D1 を同じ意味で参照し、private-era minute 閾値を current instruction として持たない。
- event-eligible / event-filtered hosted-required / recovery / already-successful の各 HEAD 状態で選ぶ trigger が一意に読める。
- `scripts/tests/ci-workflow.test.sh` が live docs の契約 drift を検出し、archive / historical D-033 は検査対象外にする。
- Actions-unavailable closed route、L1/L2 exact-HEAD、Draft guard、job graph、cache contract は維持する。

### 失敗定義

- public standard runner に private monthly-minute threshold を適用し続ける。
- event-eligible change に Ready と pre-emptive dispatch の両方を標準手順として許す。
- free minutes を理由に Actions outage / product failure / stale-head evidence を無視する。
- observed evidence なしに workflow YAML、Rust job graph、self-hosted runner、required checks まで scope を拡大する。

### 非目的

- `.github/workflows/ci.yml` / `.github/workflows/npm-security-monitor.yml` の変更
- branch protection / ruleset / required checks / merge queue の有効化
- Rust job 再統合、aggregate job 廃止、self-hosted / larger runner 導入
- cache の手動削除や key 変更
- 2026-08-05 以降の npm dependency change B

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/ci.md`: migration state、Public Standard-Runner Policy、CI-TRIGGER-D1 trigger table、Stale Green Prevention、2026-08-01 Re-evaluation を同期する。
- `docs/DEV_WORKFLOW.md`: current hosted routing summary から private-era threshold を除去し、CI-TRIGGER-D1 を参照する。
- `docs/decision-log.md`: D-063 を追加し、D-033 / D-043 を歴史として維持する。
- `Plans.md` / `docs/PROJECT_HANDOFF.md`: current state、scheduled npm dogfood、change B との分離を同期する。
- `scripts/tests/ci-workflow.test.sh`: live CI docs contract の static validator と mutation fixtures を追加する。
- 本 Plan Packet と Test Design Matrix。

## Non-scope

- `docs/archive/**` の private-era history 書換え
- D-033 / D-043 の本文書換え
- product / frontend / Rust / DB / Tauri config
- GitHub repository settings の mutation
- Actions run の cancel / rerun / dispatch

## Acceptance Criteria

- `rg -n 'CI-PUBLIC-D1|CI-TRIGGER-D1' docs/ci.md docs/DEV_WORKFLOW.md docs/decision-log.md` が live source contract の参照を返す。
- `rg -n '75%|90%|月間 billed minutes|枠 reset' docs/ci.md docs/DEV_WORKFLOW.md Plans.md docs/PROJECT_HANDOFF.md` が 0 hit。
- `bash scripts/tests/ci-workflow.test.sh` が baseline と public-doc mutation fixtures を含めて `PASS: ci-workflow` / exit 0。
- private quota 文言の再導入、trigger table の required row 除去、Actions-unavailable route の除去を行う synthetic mutation `M1` / `M2` / `M3` がそれぞれ validator で non-zero。
- archive に private-era wording が残っていても validator の `M4 archive exclusion` は pass する。
- `git diff -- .github/workflows/ci.yml .github/workflows/npm-security-monitor.yml` が empty。
- `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-08-01-public-actions-ci-contract.md` と `bash scripts/doc-consistency-check.sh` が exit 0。
- Plan Reviewer と Final Double Audit がそれぞれ `P1/P2 = 0` を報告するまで implementation / Ready へ進まない。

## Design Sources

- Requirements / spec: `docs/ci.md` CI-PUBLIC-D1 / CI-TRIGGER-D1
- Architecture: 該当なし
- Function / command / DTO: 該当なし
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: `docs/decision-log.md` D-026 / D-033 / D-043 / D-063

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | 該当なし |
| Command / DTO / generated binding / wire shape | 該当なし | 該当なし |
| DB / transaction / audit / rollback / migration | 該当なし | 該当なし |
| Screen / UI / route state / Japanese wording | 該当なし | 該当なし |
| CSV / TSV / report / import / export format | 該当なし | 該当なし |
| Durable decision / ADR | `docs/decision-log.md` D-063 | updated in this PR |

## Registration / Generation Obligations

新規 source / workflow doc は作らない。既存 `scripts/tests/ci-workflow.test.sh` に test case を追加するため、`scripts/local-ci.sh` / hosted `ci.yml` の test registration は既存配線を再利用し、新規登録は不要。active Plan Packet は `Plans.md` `次の行動` から link する。

| 新規追加物 | 登録・生成義務 |
|---|---|
| D-063 | `docs/ci.md` / `docs/DEV_WORKFLOW.md` / `Plans.md` / `docs/PROJECT_HANDOFF.md` の current contract 同期 |
| CI docs drift fixture | 既存 `scripts/tests/ci-workflow.test.sh` 内に追加し、既存 local/full + hosted routing を維持 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-CI-PUBLIC-D1 | `docs/ci.md` Public Standard-Runner Policy | D-063-D1 | public standard runner に private quota gate を残さない。棄却: self-hosted / larger runner は費用・security boundary を増やす | live CI docs | `validate_public_actions_doc_contract` / M1 |
| SPEC-WF-CI-TRIGGER-D1 | `docs/ci.md` Final Trigger Selection | D-063-D2 | trigger intent を HEAD state ごとに一意化。棄却: YAML 単独で future event intent を推測する | live CI docs | `validate_public_actions_doc_contract` / M2 |
| SPEC-WF-CI-AVAIL-D1 | `docs/ci.md` Public Standard-Runner Policy | D-063-D3 | billing-free と service availability を分離し closed exception を維持 | live CI docs | `validate_public_actions_doc_contract` / M3 |
| SPEC-WF-CI-HISTORY-D1 | `docs/decision-log.md` D-033 / D-063 | D-063-D4 | historical rationale は非遡及。current instructions だけ guard | validator file allowlist | M4 |
| SPEC-WF-CI-YAML-D1 | `.github/workflows/ci.yml` | D-063-D5 | observed duplicates は運用順で説明可能。YAML/job graph は不変 | none | existing `validate_workflow_contract` + zero diff |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes; `docs/ci.md` と D-063 が current contract と rationale を所有する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: yes; D-063 に昇格。
- Assumptions and constraints: public visibility / runner class / billing contract は Contract Probe 済み。future billing / runner-class change は Revisit trigger。
- Deferred design gaps, risk, and follow-up target: required checks は path-filter compatibility の別 R3、scheduled npm dogfood は 2026-08-03 JST、dependency change B は 2026-08-05 以降。
- Test Design Matrix can cite design decision IDs or source doc sections: yes; companion Matrix が D-063-D1..D5 を参照。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: `1 HEAD 1 final` は normal path の運用 invariant。service failure recovery と closed not-required route を明示し、重複が絶対発生しないという YAML 保証は主張しない。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 該当なし | none |
| Fact check / design decision split | GitHub billing / cache / run history は実測事実、trigger selection / non-adoption は D-063 decision | Contract Probe / D-063 |
| Lifecycle / retry | Ready auto run、dispatch recovery、already-successful の lifecycle を明示 | CI-TRIGGER-D1 / Matrix lifecycle rows |
| Operator workflow | repository owner の Ready / dispatch 操作 | `docs/ci.md` trigger table |
| Replacement path | private quota gate を public standard-runner policy へ置換 | live-doc drift grep / M1 |
| Data safety / evidence | local `.local/` logs と external run URLs を commit しない | Data Safety |
| Reporting / accounting semantics | billable minutes と free standard-runner execution を混同しない | CI-PUBLIC-D1 |
| Manual verification | Sonnet 5 Plan Review、Final Double Audit、owner Ready / merge | Review Focus / Human Gate |
| 環境・再現性 | repository visibility / runner class / official contract を probe。future drift は Revisit | Contract Probe / static guard |

## Design Readiness

- Existing design docs are sufficient because: `docs/ci.md` が trigger / evidence / availability / cache / required-check boundary を所有する。
- Source docs updated in this PR: `docs/ci.md`, `docs/DEV_WORKFLOW.md`, `docs/decision-log.md`, `Plans.md`, `docs/PROJECT_HANDOFF.md`。
- Design gaps intentionally deferred: required checks / merge queue、runner topology、dependency change B。
- Durable decisions discovered in this plan and promoted to source docs: D-063。

Minimum design checks:

- Layer ownership: product architecture 非接触。
- Backend function design: 該当なし。
- Command / DTO / data contract: 該当なし。
- Persistence / transaction / audit impact: 該当なし。
- Operator workflow / Japanese UI wording: product UI 非接触。repository owner の trigger workflow のみ。
- Error, empty, retry, and recovery behavior: missing / failed / cancelled auto run の recovery と already-successful no-op を CI-TRIGGER-D1 に定義。
- Testability and traceability IDs: SPEC-WF-CI-PUBLIC-D1 / TRIGGER-D1 / AVAIL-D1 / HISTORY-D1 / YAML-D1。

## Contract Probe

- repository visibility: `gh repo view --json nameWithOwner,visibility --jq '{nameWithOwner,visibility}'` -> `{"nameWithOwner":"kosei-w90607/inventory-system-public","visibility":"PUBLIC"}`。
- runner class: `rg -n '^\s*runs-on:' .github/workflows/*.yml` -> `ci.yml` の 8 job と `npm-security-monitor.yml` の 1 job がすべて `ubuntu-latest`、larger / self-hosted は 0 hit。
- official billing premise: GitHub Docs [Product billing / GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions) と [Viewing job execution time](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time) -> public repository の standard GitHub-hosted runner は billable execution minutes を消費せず、larger runner は課金対象。
- duplicate final observation: `gh run list --workflow ci.yml --limit 100 --json headSha,event,conclusion,url --jq '[.[] | select(.conclusion == "success")] | group_by(.headSha) | map(select(length > 1 and ([.[].event] | index("workflow_dispatch")) and ([.[].event] | index("pull_request")))) | length'` -> `4` HEAD。例: head `adfc16...` の dispatch run `30636788316` と PR run `30637072357` は双方 full success。
- cache usage: `gh api repos/kosei-w90607/inventory-system-public/actions/cache/usage` -> `active_caches_size_in_bytes=2481447333`, `active_caches_count=51`。GitHub Docs [Dependency caching reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) の repository default `10 GB` 未満。
- required-check premise: `gh api repos/kosei-w90607/inventory-system-public/branches/main/protection` -> HTTP `404 Branch not protected`; `gh api repos/kosei-w90607/inventory-system-public/rulesets` -> `[]`。
- capacity sample: `gh run view 30636788316 --job 91176335558 --log` -> root available `87G` before / `82G` after、`target` `5.3G`、test profile `2m18s`。単一 sample のため一般的 capacity 保証には使わず、即時再統合 / self-hosted を支持しない反証としてだけ扱う。
- npm monitor: `gh run list --workflow npm-security-monitor.yml` -> manual run `30482903914` success。cron `0 21 * * 0` の次回 scheduled dogfood は 2026-08-03 JST、dependency change B は 2026-08-05 以降の別 change。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-063-D1 / CI-PUBLIC-D1 | `docs/ci.md`, `docs/DEV_WORKFLOW.md`, dashboard / handoff | `validate_public_actions_doc_contract`, M1 | L3 not applicable |
| D-063-D2 / CI-TRIGGER-D1 | `docs/ci.md` trigger table + DEV_WORKFLOW summary | validator, M2 | owner Ready/dispatch remains Human Gate |
| D-063-D3 / Actions unavailable | `docs/ci.md` closed routes | validator, M3 | actual outage disposition remains Human Gate |
| D-063-D4 / history boundary | validator live-doc allowlist | M4 | archive non-scope |
| D-063-D5 / YAML unchanged | no workflow YAML implementation | existing `validate_workflow_contract`, workflow zero diff | required checks / job topology non-scope |

Adjacent-contract sweep: touched `docs/ci.md` sections Hosted Trigger Model / Risk Routing / Public Standard-Runner Policy / Stale Green Prevention / Cache Policy / Required Check Impact / Re-evaluation を全確認し、exact-HEAD、skip restrictions、Actions-unavailable、cache、required-check defer を Ledger または Non-scope に分類した。

## Test Plan

Test Design Matrix: [test-matrices/2026-08-01-public-actions-ci-contract.md](test-matrices/2026-08-01-public-actions-ci-contract.md)

- targeted tests: `bash scripts/tests/ci-workflow.test.sh`; `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-08-01-public-actions-ci-contract.md`。
- negative tests: M1 private quota wording、M2 trigger row removal、M3 availability route removal。
- compatibility checks: existing workflow trigger/job/cache validator; workflow YAML zero diff; M4 archive wording non-input。
- data safety checks: `git status --short`; `.local/` / gh cache / run log 非追跡。
- main wiring/integration checks: `bash scripts/local-ci.sh full` before Final Review / Ready; hosted exact-HEAD final after owner authorization。

## Boundary / Wire Contract

該当なし。JSON API、browser state、CSV、config、manifest、cache schema、Tauri DTO、DB compatibility は変更しない。GitHub workflow YAML も不変。

## Review Focus

- public standard-runner billing の事実から、private quota gate を除去する推論が official docs と一致するか。
- D-033 / D-043 の final-only / `synchronize` / exact-HEAD / availability fail-closed を弱めていないか。
- CI-TRIGGER-D1 の 4 状態が排他的かつ recovery を塞がず、duplicate successful final を normal path から除けるか。
- workflow YAML 無変更が実測に対して十分か。文書契約では防げない具体的 failure mode がある場合だけ amendment 候補として示すこと。
- static guard が archive / historical decision を誤って current instruction と判定しないか、mutation が production validator と同じ source を循環参照していないか。
- required checks / self-hosted / Rust topology / npm change B が scope creep していないか。

## Spec Contract

Contract ID: SPEC-WF-CI-PUBLIC-D1

- public + standard GitHub-hosted runner の間、private monthly-minute threshold を hosted gate 入力にしない。
- CI-TRIGGER-D1 の HEAD state table から 1 trigger path を選び、successful / in-progress の同一 HEAD に pre-emptive dispatch を重ねない。
- billing-free は availability-free を意味しない。Actions unavailable closed route と product/gate failure blocker を維持する。
- historical D-033 / archive は保存し、live docs だけを current drift guard の対象にする。
- workflow YAML / job graph / cache keys / required-check settings は不変。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-CI-PUBLIC-D1 | live docs + D-063 | validator / M1 | billing fact / larger-runner exception | official docs + visibility / runs-on probe |
| SPEC-WF-CI-TRIGGER-D1 | trigger table | validator / M2 | state exclusivity / recovery | duplicate-run probe |
| SPEC-WF-CI-AVAIL-D1 | closed routes | validator / M3 | fail-closed preservation | source diff + test output |
| SPEC-WF-CI-HISTORY-D1 | validator allowlist | M4 | archive non-retroactivity | mutation fixture |
| SPEC-WF-CI-YAML-D1 | no YAML edit | existing workflow tests | no unsupported scope | zero diff + full gate |

## Data Safety

- secrets、credentials、billing account details、private repository data、store data を読まない・commit しない。
- `.local/**`、`/tmp/inventory-ci-audit-gh-cache/**`、Actions logs は local / external evidence で tracked file に追加しない。
- run URL / SHA は public repository の operational evidence のみ。volatile exact-HEAD final evidence は PR body に置く。
- mutation fixtures は `mktemp -d` 配下の synthetic copies だけを変更する。

## Implementation Results

Plan Gate 前のため未実装。source contract draft と Plan / Matrix のみ。

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
- Plan Review: pending Claude Sonnet 5 fresh-context review。
