# Plan Packet — workflow docs WER consolidation（roadmap 1-1）

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Claude Code（Fable、main thread）
- Writer: Codex（発注、public-writer clone。発注 prompt は Coordinator 作成）
- Plan Reviewer: Codex 独立 fresh context（相互修正案方式 — findings に修正案添付、Coordinator が採否裁定）
- Final Reviewer: Double Audit（1 pass = Coordinator inline 契約突合 / 2 pass = Codex 独立 fresh context、waive 不可）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready 承認（介入 2 回目 / 予算 2 回）。R3 のため R4 explicit approval は非該当（plan 承認 = 介入 1 回目は 2026-07-21 消化済み）
- State Narrative（append-only）: 本 packet の plan-first commit で `kickoff -> spec-check -> plan-draft -> plan-gate` を実体化。evidence: spec-check = Risk R3 の分類記録（本 packet Risk 節。plan rally round 1 で `DEV_WORKFLOW.md` `Risk Tiers` の impact 原則により R2 から昇格裁定）/ design skip = Design Readiness が WER 5 本 + 既存 workflow 正本（反映先の節構造を file:line 実在確認済み）を十分と引用（許可された唯一の skip 経路）/ plan-gate = packet + Test Design Matrix complete and committed（本 commit）。plan 本体は harness plan file 上で Plan agent rally 6 round（新規指摘 9→3→3→2→3→1、実体指摘は round 4 で枯渇）を経て owner 承認済み、残余精査は本 packet への Codex Plan Gate へ移管（owner 指示 2026-07-21）。

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 15分
- relay 往復上復: 2

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
`DEV_WORKFLOW.md` `Risk Tiers` の「Risk is based on impact, not file type」に基づく。本 PR は gate script / CI / runtime contract に触れないが、Review Rules への新標準手順追加・Contract Audit 判定基準の強化・Workflow State の STATECAP 規則 delta は「merge gate が何を要求するか」の impact 変更であり、R3 定義「... or merge gate changes」に該当する。precedent = PR #14（R3 docs-only）。workflow gate change のため Double Audit（2 pass、waive 不可）を適用する。

## Goal

Goal Invariant:

### 最小完了条件

- `Plans.md` roadmap 1-1 に列挙された WER Adjustment 積み残しが次の 3 状態のいずれかに確定していること: (a) 採用項目 = `DEV_WORKFLOW.md` / `templates/` / `DEV_SETUP_CHECKLIST.md` の正本に WER 原文と意味等価な規範文として存在 (b) 不採用項目 = D-050 に発動条件事実と却下理由を分離した形で記録 (c) 消化済み項目 = Plans.md 列挙から除去され消化先が特定可能。

### 失敗定義

- 規範文が WER 原文の意図と異なる意味で正本化される。消化済み項目が再実装される、または列挙に残存する。追記が既存規範（Workflow State の backtrack 契約 / STATECAP cap 定義 / Evidence Ownership）と矛盾を生む。既存文への splice で本則の文が書き換わる。

### 非目的

- gate script（check-workflow-git.sh / doc-consistency-check.sh / local-ci.sh）・CI workflow・hook の変更。新規 doc / template の新設。archived packet / WER の改訂。workflow 全体の再設計。CI gate 化（release-profile check は CI 再評価 2026-08-01 の判断材料へ送る）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/DEV_WORKFLOW.md`: 採用 9 項目の規範文追記（Review Rules / Design checklist / Contract Audit / Workflow State / Implementation Rules / Draft PR Checkpoint / Evidence Ownership。既存節への追記のみ、新節なし）
- `docs/templates/plan-packet.md`: Registration / Generation Obligations 表へ「doc 目次」行（項目 1 残）/ Design Intent Audit 節へ絶対保証自己突合 1 行（項目 8）/ Test Plan 節へ release-profile check 条件行（項目 10）/ Contract Coverage Ledger 節へ adjacent-contract sweep 1 行（項目 14）
- `docs/templates/test-design-matrix.md`: 既存テスト引用の実在確認 1 行（項目 13）
- `docs/DEV_SETUP_CHECKLIST.md`: `:248,:251` の Windows clone パスへ `-public` 付与（項目 12。**この 2 箇所のみ**）
- `docs/decision-log.md`: D-050 起票（採否裁定 bundle、下記 Ledger と Design Intent Trace が正本)
- `docs/Plans.md`: roadmap 1-1 列挙の是正（消化済み 4 件の整理 + 本 PR の active 反映)

## Non-scope

- `docs/DEV_SETUP_CHECKLIST.md:92`（§3.1 履歴記録）/`:252`（既に正しい）/`:261`（旧 private repo との意図的対比）の変更
- 契約文言 drift grep の hook / CI 機械化（D-050 で却下理由を記録）
- release-profile check の CI gate 化（2026-08-01 CI 再評価へ）
- 監査発注書への読取経路健全性チェック（roadmap 1-2 の発注書作成時へ defer、D-050 記録）
- archived packet / WER / adjudication.md の改訂

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh` full = exit 0（packet 段階は `--target plan docs/plans/2026-07-21-workflow-docs-wer-consolidation.md` = exit 0）
- D-050 裁定表で「採用」の全項目について、規範文が指定節に存在することを rg で確認し各検索が exit 0 を返す（検索語は Test Design Matrix の各行に記載。固定 count は書かない — Evidence Ownership 準拠、正本は D-050 裁定表）
- `rg -P 'projects\\inventory-system(?!-public)' docs/DEV_SETUP_CHECKLIST.md` = 0 件（exit 1）
- `git diff main -- docs/DEV_WORKFLOW.md` に既存行の削除・書換が含まれない（追記のみ。例外 = `docs/DEV_SETUP_CHECKLIST.md:248,:251` の 2 行置換）
- `bash scripts/local-ci.sh full` = green（completed HEAD、local full evidence SHA は PR body 正本）
- hosted final: owner Ready 後の `workflow_dispatch` 明示 1 run success + 三点 SHA 一致（PR HEAD = PR body final L1 SHA = hosted run headSha。docs-only のため PR event では CI 不発火 = `ci.yml` paths-ignore 実文確認済み）

## Design Sources

- Requirements / spec: 非該当（runtime 要件に触れない workflow docs change）
- Architecture: 非該当
- Function / command / DTO: 非該当
- DB: 非該当
- Screen / UI: 非該当
- Decision log / ADR: D-034/D-035/D-038（bundle precedent・Evidence Ownership）/ D-039 / D-049、WER 5 本（`archive/plans/2026-07-15-ui13-integrity-check-workflow-effectiveness-review.md` / `archive/plans/2026-07-16-sidebar-pending-links-workflow-effectiveness-review.md` / `archive/plans/2026-07-17-backup-migration-failure-contract-design-workflow-effectiveness-review.md` / `archive/plans/2026-07-18-codex-clone-routing-and-safe-read-boundary-workflow-effectiveness-review.md` / `archive/plans/2026-07-18-backup-migration-failure-contract-impl-pr1-workflow-effectiveness-review.md` / `archive/plans/2026-07-18-backup-migration-failure-contract-impl-pr2-workflow-effectiveness-review.md`）、`research/audit-2026-07/adjudication.md`（(5 残滓) の defer 判断根拠）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 非該当 | — |
| Command / DTO / generated binding / wire shape | 非該当 | — |
| DB / transaction / audit / rollback / migration | 非該当 | — |
| Screen / UI / route state / Japanese wording | 非該当 | — |
| CSV / TSV / report / import / export format | 非該当 | — |
| Durable decision / ADR | `decision-log.md` D-050（採否裁定 bundle） | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / doc / REQ / route / 画面の追加なし。`templates/plan-packet.md` の表編集は既存 doc の改訂であり新設物ではない）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| roadmap 1-1（Plans.md） | UI-13 WER Deferred | SPEC-WF-WERC-D1 | doc 目次義務が checklist 表に未反映（8 分類中の残り 1）。代替 = 消化済み扱いで放置 → 積み残しが不可視化するため却下 | `templates/plan-packet.md` Registration 表 | M-D1 |
| 同上 | PR #14 WER Change 2 | SPEC-WF-WERC-D2 | 相互修正案方式は空転 round ゼロ化の効果実証済み。代替 = 慣行のまま → session 依存で失伝するため却下 | `DEV_WORKFLOW.md` Review Rules | M-D2 |
| 同上 | PR #14 WER Change 3 | SPEC-WF-WERC-D3 | 絶対保証と escape hatch の自己矛盾は checklist 1 行で防げる（実例 = design 第 6 round） | `DEV_WORKFLOW.md` Design checklist + template Design Intent Audit | M-D3 |
| 同上 | PR #15 WER Change | SPEC-WF-WERC-D4 | 推論ベース anti-tautology 判定は 5 件見逃しの実証があり、実 mutation 注入を要求に昇格 | `DEV_WORKFLOW.md` Contract Audit（Mutation / anti-tautology check 行） | M-D4 |
| 同上 | PR #16 WER Adjustment 2 | SPEC-WF-WERC-D5 | gap = cap 枯渇時のフォールバック未規定。選択肢 (a) 再 walk cap 免除は cap の意義を弱めるため却下、(b) closeout narrative 実体化の正規手順化を採用（PR #16 実績追認） | `DEV_WORKFLOW.md` Workflow State（Evidence Ownership 段落末尾に文単位追記） | M-D5 |
| 同上 | PR #16 WER Adjustment 3 | SPEC-WF-WERC-D6 | §4.6 の Windows clone パス 2 箇所のみ stale。`:92`/`:252`/`:261` は履歴・正・意図的対比のため不改訂 | `DEV_SETUP_CHECKLIST.md:248,:251` | M-D6 |
| 同上 | PR #9 WER Follow-up | SPEC-WF-WERC-D7 | 可変 count の prose 転記は 5 箇所独立 drift の実証。Evidence Ownership の「test counts」を可変 count 全般へ拡張 | `DEV_WORKFLOW.md` Evidence Ownership 段落 | M-D7 |
| 同上 | PR #14 WER Change 1 | SPEC-WF-WERC-D8 | 部分採用: 旧文言 grep 0 件の PR evidence 記録を規範化。full 機械化は却下（old-wording 供給規約が未存在で実行不能）— 「4 回再発 = hook 発動条件成立」の事実は認めた上で却下理由を実行可能性に限定 | `DEV_WORKFLOW.md` Draft PR Checkpoint | M-D8 |
| 同上 | PR #16 WER Adjustment 1 | SPEC-WF-WERC-D9 | norm 昇格のみ採用（PR #17 で効果実証済み）。CI gate 化は 2026-08-01 CI 再評価へ | `DEV_WORKFLOW.md` Implementation Rules + template Test Plan 節 | M-D9 |
| 同上 | PR #17 WER Adjustment 1 | SPEC-WF-WERC-D10 | Matrix の「既存テストで回帰担保」行は実在しないテスト引用が Double Audit まで潜伏した実例あり。rg 実在確認を起票時要求に | `templates/test-design-matrix.md` + `DEV_WORKFLOW.md` Design checklist | M-D10 |
| 同上 | PR #17 WER Adjustment 2 | SPEC-WF-WERC-D11 | Ledger 起票時の adjacent-contract sweep。「規律変更なし、検出タイミング前倒しのみ」の WER 制約を遵守した最小文 | `DEV_WORKFLOW.md` Contract Audit + template Contract Coverage Ledger 節 | M-D11 |
| 同上 | 本 packet 採否裁定 | SPEC-WF-WERC-D12 | 採用 / 部分採用 / 不採用 defer（機械 gate 化・CI gate 化・監査発注書健全性チェック）を D-038 bundle precedent で 1 決定に集約 | `decision-log.md` D-050 | M-D12 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: 可 — 各規範文は WER 原文（archive、恒久保存）を出典に持ち、D-050 が採否と理由を集約する。
- Plan-only durable decisions found and promoted: 採否裁定（特に不採用 3 件の理由）→ D-050 へ昇格。
- Assumptions and constraints: 反映先の節構造・行位置は 2026-07-21 の file:line 実在確認に基づく（実装時に行番号がずれても節名で特定可能）。既存文への splice 禁止（追記のみ、例外 = DEV_SETUP_CHECKLIST の 2 行置換）。
- Deferred design gaps, risk, and follow-up target: (5 残滓) → roadmap 1-2 監査発注書作成時。release-profile CI gate 化 → 2026-08-01 CI 再評価。契約文言 registry → drift 再発時。
- Test Design Matrix can cite design decision IDs: 可（M-D1〜M-D12 が SPEC-WF-WERC-D1〜D12 に対応）。

## Impact Review Lenses

not applicable — 本 PR は workflow docs の規範文のみで、実地調査・実機・外部 tool・POS 連携・CSV/TSV・operator workflow の発見に由来しない（由来は全て過去 PR の WER）。

## Design Readiness

- Existing design docs are sufficient because: 変更意図の正本 = WER 5 本 + adjudication.md（全て archive で恒久保存、file:line 突合済み）。反映先の節構造は `DEV_WORKFLOW.md` / templates / `DEV_SETUP_CHECKLIST.md` の実文確認済み。
- Source docs updated in this PR: `DEV_WORKFLOW.md` / `templates/plan-packet.md` / `templates/test-design-matrix.md` / `DEV_SETUP_CHECKLIST.md` / `decision-log.md`（本 PR 自体が正本更新）。
- Design gaps intentionally deferred: Non-scope 節の 3 件（D-050 に記録）。
- Durable decisions discovered and promoted: D-050。

Minimum design checks: 全行 非該当（business-app 実装なし）— Layer ownership / Backend / DTO / Persistence / operator UI / Error / Traceability いずれも触れない。

## Contract Probe

- docs-only PR で hosted CI が自動発火しない前提: `.github/workflows/ci.yml` paths-ignore（`docs/**`, `*.md`）実文確認 + `docs/ci.md` Risk Routing 表確認 -> workflow_dispatch 明示 1 run が必要（PR #14 precedent で実績あり）。
- 上記以外の外部未検証前提: N/A — 全前提が repo 内 docs の実文確認で閉じる。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-WF-WERC-D1（doc 目次行） | `templates/plan-packet.md` Registration 表 | doc-consistency-check full + M-D1 rg | non-scope（L3 なし） |
| SPEC-WF-WERC-D2（相互修正案方式） | `DEV_WORKFLOW.md` Review Rules | M-D2 rg + review evidence | non-scope |
| SPEC-WF-WERC-D3（絶対保証自己突合） | `DEV_WORKFLOW.md` Design checklist + template Design Intent Audit | M-D3 rg | non-scope |
| SPEC-WF-WERC-D4（実 mutation 注入） | `DEV_WORKFLOW.md` Contract Audit | M-D4 rg | non-scope |
| SPEC-WF-WERC-D5（cap 枯渇フォールバック） | `DEV_WORKFLOW.md` Workflow State | M-D5 rg + 矛盾通し読み | non-scope |
| SPEC-WF-WERC-D6（clone パス追随） | `DEV_SETUP_CHECKLIST.md:248,:251` | M-D6 rg negative lookahead | non-scope（owner 実機確認は次回 L3 機会に自然実施） |
| SPEC-WF-WERC-D7（可変 count 拡張） | `DEV_WORKFLOW.md` Evidence Ownership | M-D7 rg | non-scope |
| SPEC-WF-WERC-D8（旧文言 grep evidence） | `DEV_WORKFLOW.md` Draft PR Checkpoint | M-D8 rg | non-scope |
| SPEC-WF-WERC-D9（release-profile check norm） | `DEV_WORKFLOW.md` Implementation Rules + template Test Plan | M-D9 rg | non-scope |
| SPEC-WF-WERC-D10（Matrix 実在確認） | `templates/test-design-matrix.md` + Design checklist | M-D10 rg | non-scope |
| SPEC-WF-WERC-D11（adjacent-contract sweep） | `DEV_WORKFLOW.md` Contract Audit + template Ledger 節 | M-D11 rg | non-scope |
| SPEC-WF-WERC-D12（D-050 採否裁定） | `decision-log.md` | M-D12 rg + doc-consistency-check | non-scope |

## Test Plan

Test Design Matrix: `test-matrices/2026-07-21-workflow-docs-wer-consolidation.md`

- targeted tests: doc-consistency-check（--target plan → full）、M-D1〜M-D12 の rg 存在確認
- negative tests: 旧パス negative lookahead 0 件、既存行の削除・書換なし（`git diff --unified=0` 検査、例外 2 行）
- compatibility checks: `:105`（backtrack 契約）/`:120`（cap 定義）と D5 追記文の通し読みで矛盾なし
- data safety checks: 非該当（実データ・秘匿情報なし）
- main wiring/integration checks: local-ci.sh full green + workflow_dispatch 三点 SHA 一致

## Boundary / Wire Contract

非該当 — JSON / browser state / CSV / config / manifest / cache schema / DTO / bindings / report / DB のいずれにも触れない。

## Review Focus

- WER 原文 ↔ 規範文の**意味等価性**（要約による意図の希釈・増幅がないか）
- D5 追記が Workflow State の既存 backtrack 契約・STATECAP cap 定義と矛盾しないか
- 既存文への splice が発生していないか（追記のみ制約、例外 2 行）
- D-050 の裁定記録と実装の一致（特に不採用 3 件の理由の書き分け）
- Plans.md 列挙と実体の一致（消化済み 4 件の除去と消化先の特定可能性）

## Spec Contract

Contract ID: SPEC-WF-WERC

- WER Adjustment の各採用項目は WER 原文の意図と意味等価な規範文として指定節に存在し、各不採用項目は D-050 に「発動条件・事実認定」と「却下理由」を分離した形で記録され、Plans.md roadmap 1-1 の列挙は実体と一致する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-WERC-D1〜D11 | 実装 commit（規範文追記） | M-D1〜M-D11 | 意味等価性 / splice なし | doc-consistency-check + rg（PR body） |
| SPEC-WF-WERC-D12 | 実装 commit（D-050） | M-D12 | 採否と理由の分離記録 | decision-log diff |
| SPEC-WF-WERC 全体 | Double Audit 1/2 pass | Matrix 全行再検証 | 契約突合 | Review Response |

## Data Safety

- commit してはいけないもの: `.local/ci-evidence/` の生成物、`~/.claude/plans/` のドラフト、exact-HEAD SHA / test count の packet 転記（Evidence Ownership）
- local-only paths: `.local/ci-evidence/`
- synthetic-only paths: 非該当（テストデータなし）

## Implementation Results

Fill after implementation.

## Review Response

Fill after review.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
