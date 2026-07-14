# Public migration learning sync

## Workflow State

- Phase: ready-hosted-final
- Risk: R2
- Execution Mode: codex-only
- Plan Commit: 3863c65
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: independent Codex review context
- Final Reviewer: independent Codex review context
- Reviewed Content HEAD: 38f0b9869d2fc3a4ed956c95555da2701799bfda
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: not-required
- Human Gate: none

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 10分
- relay 往復上限: 1

## Risk

Risk: R2

Reason:
Public repository の source-of-truth と振り返りを同期する docs-only change。CI workflow、merge gate、product runtime、repository settings は変更しない。

## Goal

Public 化 Phase B の goal drift、再発防止判断、完了状態を public repository 単体から復元できるようにする。

## Scope

- public-safe な Phase B goal-drift Workflow Effectiveness Review を `docs/archive/plans/` に追加する。
- evidence quality と candidate safety を分離する D-045 を `docs/decision-log.md` に追加する。
- `docs/Plans.md` を public 化・初回 hosted CI green 完了へ同期し、次の独立変更を CI `synchronize` trigger 修正として示す。
- `docs/Plans.md` の最近の archive から新規 WER へリンクする。

## Non-scope

- `.github/workflows/**`、CI trigger、merge gate の変更。
- `docs/DEV_WORKFLOW.md`、Plan Packet template、`inventory-workflow-start` への generic guard 実装。
- private control Packet / Matrix、receipt、hash、path、credential、詳細 scan log の公開。
- repository settings、branch protection、Actions settings の変更。

## Acceptance Criteria

- Public repository 内の WER だけで、goal drift の原因、影響、採用した再発防止判断、deferred follow-up を復元できる。
- `docs/decision-log.md` に D-045 が存在し、actual harm path、non-destructive revalidation、Owner Effort Budget hard stop を durable decision として定義する。
- `docs/Plans.md` が Phase B と初回 hosted CI green を完了扱いにし、旧 private clone は history-view 専用、次は CI `synchronize` trigger 修正と示す。
- 新規・更新文書に private repository identity、private evidence URL、local path、hash、credential、canary literal、詳細 scan log が入らない。
- `bash scripts/doc-consistency-check.sh` と `bash scripts/tests/public-sanitization.test.sh` が PASS する。

## Design Sources

- Requirements / spec: not applicable
- Architecture: `docs/PUBLIC_REPO_MIGRATION.md` clone-role boundary
- Function / command / DTO: not applicable
- DB: not applicable
- Screen / UI: not applicable
- Decision log / ADR: `docs/decision-log.md` D-040/D-041、追加する D-045

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | none | intentionally deferred: runtime非接触 |
| Command / DTO / generated binding / wire shape | none | intentionally deferred: wire非接触 |
| DB / transaction / audit / rollback / migration | none | intentionally deferred: DB非接触 |
| Screen / UI / route state / Japanese wording | none | intentionally deferred: UI非接触 |
| CSV / TSV / report / import / export format | none | intentionally deferred: file contract非接触 |
| Durable decision / ADR | `docs/decision-log.md` D-045 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| WF-PUB-LEARN-01 | goal-drift WER / D-045 | D-045 | private memoryだけではpublic側で復元不能。private evidenceの丸ごと転記は非採用 | WER、decision-log、Plans | docs/public-sanitization gates |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。WERとD-045をpublic側へ置く。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: goal-preservation判断をD-045へ昇格する。
- Assumptions and constraints: public化と初回 hosted CI green は完了済み。実行詳細は公開しない。
- Deferred design gaps, risk, and follow-up target: generic workflow guardは別R3 change。
- Test Design Matrix can cite design decision IDs or source doc sections: R2のためMatrix省略。

## Impact Review Lenses

not applicable。外部format、実機、operator workflow、product contractを変更しないdocs同期。

## Design Readiness

- Existing design docs are sufficient because: public migration runbookと既存WER templateが配置・公開安全性・振り返り形式を定義済み。
- Source docs updated in this PR: WER、decision-log、Plans。
- Design gaps intentionally deferred: generic workflow enforcement。
- Durable decisions discovered in this plan and promoted to source docs: D-045。
- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): not applicable。
- Backend function design: not applicable。
- Command / DTO / data contract: not applicable。
- Persistence / transaction / audit impact: none。
- Operator workflow / Japanese UI wording: none。
- Error, empty, retry, and recovery behavior: not applicable。
- Testability and traceability IDs: WF-PUB-LEARN-01をdocs gateで確認。

## Contract Probe

- N/A: 外部技術前提を導入しないR2 docs-only change。

## Test Plan

- targeted tests: `bash scripts/doc-consistency-check.sh`
- negative tests: `bash scripts/tests/public-sanitization.test.sh`
- compatibility checks: WER linkとD-045参照がrepository内で解決すること。
- data safety checks: private control evidence classを転記していないことをdiff reviewする。
- main wiring/integration checks: `docs/Plans.md`からWERと次作業を辿れること。

## Boundary / Wire Contract

Not applicable。wire/config/runtime contract非接触。

## Review Focus

- WERが失敗を抽象化しつつ、再発防止に十分な具体性を持つか。
- D-045とPlansが矛盾しないか。
- private evidence、path、identity、credential、hashを再導入していないか。
- CI `synchronize`修正やgeneric workflow hardeningを混在させていないか。

## Implementation Results

Public-safe goal-drift WER、D-045、dashboard closeoutを実装した。GitHubのread-only確認でrepository visibility、parentless root、同じrootへの初回manual hosted CI successを裏取りした。docs consistencyとpublic-sanitization regressionはgreen。

## Review Response

- Findings Freeze: 2026-07-14 final review; post-freeze exceptions: none.
- Plan Gate（2026-07-14）: plan-first commit `3863c65` を独立 Codex context が reviewし、P1=0 / P2=0 / P3=0で承認。既存 evidence に基づき `plan-gate -> plan-approved -> implementing` を本state-only記録でmaterializeした。
- Final Review（2026-07-14）: reviewed content HEADを独立 Codex context がreviewし、P1=0 / P2=0 / P3=1で承認。P3はPR本文のWorkflow State表記だけが一段古いというmetadata findingで、content candidate変更なしにPR本文を同期した。これにより `local-verified -> independent-review -> human-confirm` を本state-only記録でmaterializeした。
- Owner Authorization（2026-07-14）: ownerが内容を確認し、Ready化、最終gate確認、問題がなければmergeまで進めることを承認。`human-confirm -> ready-hosted-final` を本state-only記録でmaterializeした。
