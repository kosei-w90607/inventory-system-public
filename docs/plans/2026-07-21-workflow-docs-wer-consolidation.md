# Plan Packet — workflow docs WER consolidation（roadmap 1-1）

## Workflow State

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 7f09ed8
- Amendments: 1efe836（Double Audit 2 pass P1 = Handoff Ledger 行 + D7 cutoff 是正 + Trace 略記是正）
- Coordinator: Claude Code（Fable、main thread）
- Writer: Codex（発注、public-writer clone。発注 prompt は Coordinator 作成）
- Plan Reviewer: Codex 独立 fresh context（相互修正案方式 — findings に修正案添付、Coordinator が採否裁定）
- Final Reviewer: Double Audit（1 pass = Coordinator inline 契約突合 / 2 pass = Codex 独立 fresh context、waive 不可）
- Reviewed Content HEAD: ad0cffa
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready 承認 = **済み**（2026-07-21、介入 2 回目 / 予算 2 回。「後処理まで任せる」により Ready 化実操作・dispatch・merge・closeout を Coordinator へ委任）。R3 のため R4 explicit approval は非該当（plan 承認 = 介入 1 回目は 2026-07-21 消化済み）
- State Narrative（append-only）: 本 packet の plan-first commit で `kickoff -> spec-check -> plan-draft -> plan-gate` を実体化。evidence: spec-check = Risk R3 の分類記録（本 packet Risk 節。plan rally round 1 で `DEV_WORKFLOW.md` `Risk Tiers` の impact 原則により R2 から昇格裁定）/ design skip = Design Readiness が WER 5 本 + 既存 workflow 正本（反映先の節構造を file:line 実在確認済み）を十分と引用（許可された唯一の skip 経路）/ plan-gate = packet + Test Design Matrix complete and committed（本 commit）。plan 本体は harness plan file 上で Plan agent rally 6 round（新規指摘 9→3→3→2→3→1、実体指摘は round 4 で枯渇）を経て owner 承認済み、残余精査は本 packet への Codex Plan Gate へ移管（owner 指示 2026-07-21）。
- State Narrative 追記（append-only、2026-07-21）: Codex Plan Gate round 1（P1×5 + P2×3 + P3×1、全 accept）反映の plan-gate 修正 commit。D5 は D-050 (iv) へ defer（Workflow State 節 不改変へ変更）、D7 は WER 原文範囲へ限定、D-050 を decision-log へ起票、Ledger 増補（D4-A / D9-A / D13 + D5 defer 行）、Matrix を exact-command / baseline-red 前提へ全面改訂、PROJECT_HANDOFF.md 同期を Scope 追加、「WER 5 本」の count 誤記と repo-relative path 誤りを是正（D7 新規範の自己適用）。
- State Narrative 追記（append-only、2026-07-21）: Codex Plan Gate round 2（P1×3 + P2×3、全 accept）反映の plan-gate 修正 commit 第 2 弾。D-050 defer (ii)/(iii) へ発動条件事実・却下理由を補完、M-D5N を Workflow State 節の byte-level diff guard へ強化（3 語検索の迂回反例を Codex が実演）、M-DIFF の regex escape 欠陥を fenced literal command 化で解消、Matrix を per-assertion literal command（M-D2a〜M-HANDOFF）へ再構成、D1 anchor を義務 phrase「親文書の目次・索引を更新」へ変更、packet 後半（Risk / Design Intent Audit / Design Readiness / Test Plan / Review Focus / Trace Matrix）の round 1 前 stale 記述を全同期。**訂正明示**: 初期 narrative の「WER 5 本」は誤記（正 = 6 ファイル、Design Sources 列挙が正本）— append-only 原則により初期行は書き換えず本行で訂正を宣言する。
- State Narrative 追記（append-only、2026-07-21）: Codex Plan Gate round 3（P1×0 + P2×3 + P3×1、全 accept）反映の plan-gate 修正 commit 第 3 弾。純追記例外の節間矛盾を Matrix「実装制約」基準に統一（M-DIFF 3 ファイル純追記 / 例外 = D6 2 行 + D4-A 隣接 2 ファイル / D13・Handoff は対象外）、M-D12a〜f の抽出範囲を awk で D-050 節に閉包（D-051 追加時の誤集計を mock 実証で遮断）、PROJECT_HANDOFF.md 同期を §2 実質同期（branch / packet path / 次 action の 3 要素、M-HANDOFFa〜c）へ具体化（Codex 推奨案を採用）、M-D4A 表記を M-D4Aa〜b へ統一。Matrix literal 全 36 本の baseline 整合は Codex round 3 が全数実行で確認済み。
- State Narrative 追記（append-only、2026-07-21）: Codex Plan Gate round 4（P1×0 + P2×1 + P3×0、accept）反映の plan-gate 修正 commit 第 4 弾。M-HANDOFFa〜c の 3 分割 assert は token 分散・遷移列欠落を検出できない（Codex 反例実演）ため、§2 節内・同一 bullet 行・完全遷移列（`Double Audit.*Ready.*merge`）を一括検証する単一 M-HANDOFF へ置換（Codex 提案コマンドをそのまま採用 — `/^### /` 終端は `:63` の次見出しで正しく閉じることを Coordinator が実測確認、baseline exit 1 追認済み）。packet Scope / AC / Matrix overview を新 assertion 名へ同期。
- State Narrative 追記（append-only、2026-07-21）: state-only commit で隣接 forward 2 遷移 `plan-gate -> plan-approved -> implementing` を実体化。evidence: plan-approved = Codex Plan Gate 独立 5 round 収束（round 5 = 新規 P1/P2/P3 全ゼロ + Matrix literal 全数実行の baseline 整合 + M-HANDOFF 感度実証。findings 推移 9→6→4→1→0、全件 Coordinator 実証裏取りの上で採否裁定）+ `Plan Commit` = plan-first commit `7f09ed8` 記入（実装 commit は本遷移時点でゼロであり plan-first commit が全実装 commit に先行する）/ implementing = owner の plan 承認（2026-07-21、介入 1 回目 / 予算 2 回。R3 のため R4 explicit approval は非該当、plan 承認が実装開始 authorization を兼ねる）。実装 = Codex 発注（発注書は Coordinator 作成、Writer 向け注意点 = Plan Gate round 5 の引き継ぎ事項を含む）。
- State Narrative 追記（append-only、2026-07-21）: Double Audit 完了記録。実装 = Codex `bc4269c`（Draft PR #18、assertion 反転表 + local full 記録）。1 pass = Coordinator inline 契約突合 + 全 guard/anchor 独立再実行、blocker 0 + same-PR 是正 2 件（D7 出典誤帰属 / PROJECT_HANDOFF 改行コード、`75a448d`）。2 pass = Codex 独立 fresh context、P1×1 + P2×2 + P3×1 検出 — **P1 = 本 packet への adjacent-contract sweep 自己適用で Handoff 契約の Ledger 行欠落を検出**（本 PR が正本化した規律の dogfood での実効性実証）、P2 = D7 cutoff 意味論（文書作成日条件 → 記述作成日条件へ是正、D-038 原文と同型化）+ PR body freshness、P3 = Trace 略記の解決可能性。実 mutation 4 種（anchor 削除 / 節外移動 / D-050 heading 破損 / 発動条件事実 1 件削除）全 red 確認済み。全 4 件 accept → gated amendment（Ledger へ SPEC-WF-WERC-HANDOFF 行 + Trace 行 + Matrix Contracts Under Test 追加）+ same-PR 是正を本 commit で適用。Findings Freeze は amendment SHA の Amendments 記入と PR body refresh の完了をもって発効。
- State Narrative 追記（append-only、2026-07-21）: state-only commit で隣接 forward 3 遷移 `implementing -> local-verified -> independent-review -> human-confirm` を実体化。evidence: local-verified = content HEAD `ad0cffa` での `local-ci full` RESULT=PASS（機能 gate 全 green。Coordinator clone は untracked harness file により MERGE_EVIDENCE_VALID=false のため、merge evidence は ready-hosted-final の exact-HEAD 再実行〔clean clone〕で確定する。Writer clean clone では `bc4269c` 時点 MERGE_EVIDENCE_VALID=true 実績あり）/ independent-review = Double Audit 両 pass 完了（1 pass blocker 0 + 是正 `75a448d` / 2 pass P1×1 + P2×2 + P3×1 → gated amendment `1efe836` + 是正、実 mutation 4 種 red、上記記録参照）/ human-confirm = findings 全裁定済み P1/P2 = 0、`Reviewed Content HEAD` = `ad0cffa` 記入、Findings Freeze 発効。残 = owner Ready 承認（介入 2/2）→ Ready 化実操作 → exact final HEAD での L1 full 再実行（clean clone）+ PR body 最終 refresh → workflow_dispatch 明示 1 run → 三点 SHA 一致 → merge。
- State Narrative 追記（append-only、2026-07-21）: state-only commit で `human-confirm -> ready-hosted-final` を実体化（STATECAP 3/3、最終枠）。evidence: owner の Ready 承認（2026-07-21、介入 2 回目 / 予算 2 回）+「後処理まで任せる」による Ready 化・dispatch・merge・closeout の Coordinator 委任。本 commit が最終 tracked HEAD であり、この exact HEAD で L1 full を再実行して PR body を最終 refresh する（以降 tracked commit なしで PR HEAD = PR body final L1 SHA = hosted run headSha の三点一致を merge gate とする）。

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 15分
- relay 往復上限: 2

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
`DEV_WORKFLOW.md` `Risk Tiers` の「Risk is based on impact, not file type」に基づく。本 PR は gate script / CI / runtime contract に触れないが、Review Rules への新標準手順追加・Contract Audit 判定基準の強化・Draft PR Checkpoint / Implementation Rules への gate 要求追記は「merge gate が何を要求するか」の impact 変更であり、R3 定義「... or merge gate changes」に該当する（Workflow State は D5 defer により不改変 = M-D5N guard）。precedent = PR #14（R3 docs-only）。workflow gate change のため Double Audit（2 pass、waive 不可）を適用する。

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

採否の正本は `docs/decision-log.md` **D-050**（plan-gate 修正 commit で起票済み）。各採用規範文は Test Design Matrix が固定する **anchor phrase を含む文**で実装する（anchor の baseline-red 実証 = 実装前に各 rg が exit 1 であることを PR body に記録）。

- `docs/DEV_WORKFLOW.md`: D-050 採用規範文の追記（Review Rules = D2 / Design checklist = D3, D10 / Contract Audit = D4, D11 / Evidence Ownership 段落 = D7 / Implementation Rules = D9 / Draft PR Checkpoint = D8。既存節への追記のみ、新節なし。**Workflow State は不改変** — D5 は D-050 (iv) で defer）
- `docs/templates/plan-packet.md`: Registration / Generation Obligations 表へ「doc 目次」行（D1）/ Design Intent Audit 節へ絶対保証自己突合 1 行（D3）/ Test Plan 節へ release-profile check 条件行（D9）/ Contract Coverage Ledger 節へ adjacent-contract sweep 1 行（D11）
- `docs/templates/test-design-matrix.md`: 既存テスト引用の rg 実在確認 1 行（D10）
- `docs/templates/subagent-review-packet.md` + `.agents/skills/inventory-code-review/SKILL.md`: D4 の隣接文言追随（旧「mock 可弁別性」のみの anti-tautology 記述へ実 mutation 注入要求を追加。Plan Gate round 1 F4 の adjacent-contract sweep 検出）
- `docs/DEV_SETUP_CHECKLIST.md`: `:248,:251` の Windows clone パスへ `-public` 付与（D6。**この 2 箇所のみ**）
- `docs/Plans.md`: roadmap 1-1 列挙の是正（消化済み 4 件の整理 + 本 PR の active 反映）（D13）
- `docs/PROJECT_HANDOFF.md`: §2「現在地（ここから再開）」の「直近の作業状態」へ現在作業の同期 bullet を**追加**（AGENTS.md「meaningful progress 後に更新」義務。実装 commit で実施。既存 bullet の書換不要）。必須 = **単一 bullet 行**に 3 要素を同居させる: 作業 branch `impl/workflow-docs-wer-consolidation` / active packet path `docs/plans/2026-07-21-workflow-docs-wer-consolidation.md` / 完全な次 action 遷移列（`Double Audit` → `Ready` → `merge` の語順）— M-HANDOFF が節内・同一行・遷移列を一括 assert する（round 4 F1）

## Non-scope

- **D5（STATECAP cap 枯渇時フォールバックの正規手順化）**: D-050 (iv) で defer。narrative-only の正規化は state-only Ready commit 必須・exact-HEAD sequence・`check-workflow-git.sh` の一律計数と両立せず、workflow-state 再設計（script / fixture 込み）が必要なため本 PR では **Workflow State 節を一切変更しない**（Plan Gate round 1 F1）
- `docs/DEV_SETUP_CHECKLIST.md:92`（§3.1 履歴記録）/`:252`（既に正しい）/`:261`（旧 private repo との意図的対比）の変更
- 契約文言 drift grep の hook / CI 機械化（D-050 で却下理由を記録）
- release-profile check の CI gate 化（2026-08-01 CI 再評価へ）
- 監査発注書への読取経路健全性チェック（roadmap 1-2 の発注書作成時へ defer、D-050 記録）
- archived packet / WER / adjudication.md の改訂

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh` full = exit 0（packet 段階は `--target plan docs/plans/2026-07-21-workflow-docs-wer-consolidation.md` = exit 0）
- D-050 裁定表で「採用」の全項目について、Test Design Matrix の Test Matrix 表が固定する **exact command** が期待値（exit code / 出力）どおりに pass する。anchor phrase は plan-gate 修正時点で対象ファイル全てで baseline 0 件を実証済み（未実装なら必ず red になる弁別性。実行記録は PR body。固定 count は書かない — Evidence Ownership 準拠、正本は D-050 裁定表）
- PROJECT_HANDOFF.md の実質同期: M-HANDOFF（§2「直近の作業状態」節内・同一 bullet 行に branch / packet path / 完全遷移列を一括 assert、Matrix literal command 参照）= exit 0
- `rg -P 'projects\\inventory-system(?!-public)' docs/DEV_SETUP_CHECKLIST.md` = 0 件（exit 1）
- M-DIFF（Matrix literal command と同一）: `git diff main --unified=0 -- docs/DEV_WORKFLOW.md docs/templates/plan-packet.md docs/templates/test-design-matrix.md | rg '^-([^-]|$)'` = exit 1。M-DIFF 対象 3 ファイルは純追記。既存行改訂の例外 = D6 の `DEV_SETUP_CHECKLIST.md:248,:251` 置換（M-D6 が個別 guard）と D4-A の隣接 2 ファイル（M-DIFF 対象外パス）。D13 の `Plans.md` / `PROJECT_HANDOFF.md` も M-DIFF 対象外
- `bash scripts/local-ci.sh full` = green（completed HEAD、local full evidence SHA は PR body 正本）
- hosted final: owner Ready 後の `workflow_dispatch` 明示 1 run success + 三点 SHA 一致（PR HEAD = PR body final L1 SHA = hosted run headSha。docs-only のため PR event では CI 不発火 = `ci.yml` paths-ignore 実文確認済み）

## Design Sources

- Requirements / spec: 非該当（runtime 要件に触れない workflow docs change）
- Architecture: 非該当
- Function / command / DTO: 非該当
- DB: 非該当
- Screen / UI: 非該当
- Decision log / ADR: **D-050**（本 packet の採否裁定正本、plan-gate 修正 commit で起票済み）、D-034/D-035/D-038（bundle precedent・Evidence Ownership）/ D-039 / D-049、WER 群（以下の 6 ファイル。repo-relative path）: `docs/archive/plans/2026-07-15-ui13-integrity-check-workflow-effectiveness-review.md` / `docs/archive/plans/2026-07-16-sidebar-pending-links-workflow-effectiveness-review.md` / `docs/archive/plans/2026-07-17-backup-migration-failure-contract-design-workflow-effectiveness-review.md` / `docs/archive/plans/2026-07-18-codex-clone-routing-and-safe-read-boundary-workflow-effectiveness-review.md` / `docs/archive/plans/2026-07-18-backup-migration-failure-contract-impl-pr1-workflow-effectiveness-review.md` / `docs/archive/plans/2026-07-18-backup-migration-failure-contract-impl-pr2-workflow-effectiveness-review.md`、`docs/research/audit-2026-07/adjudication.md`（(5 残滓) の defer 判断根拠）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 非該当 | — |
| Command / DTO / generated binding / wire shape | 非該当 | — |
| DB / transaction / audit / rollback / migration | 非該当 | — |
| Screen / UI / route state / Japanese wording | 非該当 | — |
| CSV / TSV / report / import / export format | 非該当 | — |
| Durable decision / ADR | `decision-log.md` D-050（採否裁定 bundle） | updated at plan-gate correction commit（起票済み） |

## Registration / Generation Obligations

該当なし（新規 command / doc / REQ / route / 画面の追加なし。`templates/plan-packet.md` の表編集は既存 doc の改訂であり新設物ではない）

## Design Intent Trace

Source 列の略記は Design Sources 節に列挙した WER 6 ファイルへの対応（例: `impl-pr1 WER:22` = `docs/archive/plans/2026-07-18-backup-migration-failure-contract-impl-pr1-workflow-effectiveness-review.md` の 22 行目）。

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| roadmap 1-1（Plans.md） | ui13 WER:83,:96 | SPEC-WF-WERC-D1 | doc 目次義務が checklist 表に未反映（8 分類中の残り 1）。代替 = 消化済み扱いで放置 → 積み残しが不可視化するため却下 | `templates/plan-packet.md` Registration 表 | M-D1 |
| 同上 | design WER:67 | SPEC-WF-WERC-D2 | 相互修正案方式は空転 round ゼロ化の効果実証済み。代替 = 慣行のまま → session 依存で失伝するため却下 | `DEV_WORKFLOW.md` Review Rules | M-D2 |
| 同上 | design WER:68 | SPEC-WF-WERC-D3 | 絶対保証と escape hatch の自己矛盾は checklist 1 行で防げる（実例 = design 第 6 round） | `DEV_WORKFLOW.md` Design checklist + template Design Intent Audit | M-D3 |
| 同上 | clone-routing WER:87,:99 | SPEC-WF-WERC-D4 | 推論ベース anti-tautology 判定は 5 件見逃しの実証があり、実 mutation 注入を要求に昇格。隣接 2 doc（subagent-review-packet / inventory-code-review SKILL）の旧文言も追随（Plan Gate F4） | `DEV_WORKFLOW.md` Contract Audit + 隣接 2 doc | M-D4, M-D4Aa〜b |
| 同上 | impl-pr1 WER:22 | SPEC-WF-WERC-D5 | **不採用 defer（D-050 (iv)、Plan Gate F1）**: narrative-only の正規化は state-only Ready commit 必須・exact-HEAD sequence・check-workflow-git.sh の一律計数と両立しない。workflow-state 再設計 PR へ。PR #16 方式は記録付き逸脱のまま | 変更なし（Workflow State 節 不改変） | M-D5N（不変 guard） |
| 同上 | impl-pr1 WER:23 | SPEC-WF-WERC-D6 | §4.6 の Windows clone パス 2 箇所のみ stale。`:92`/`:252`/`:261` は履歴・正・意図的対比のため不改訂 | `DEV_SETUP_CHECKLIST.md:248,:251` | M-D6 |
| 同上 | sidebar WER:20,:91,:103 | SPEC-WF-WERC-D7 | **WER 原文範囲に限定（Plan Gate F3）**: 「設計 doc 内の、別正本から導出される volatile count の prose 転記禁止」。固定契約定数（13-phase / STATECAP 3 等）・enum 数・閾値は対象外。2026-07-12 cutoff と archive 非遡及は維持。全 tracked docs への拡張は WER を超える新規裁定になるため不採用 | `DEV_WORKFLOW.md` Evidence Ownership 段落 | M-D7 |
| 同上 | design WER:66 | SPEC-WF-WERC-D8 | 部分採用: 旧文言 grep 0 件の PR evidence 記録を規範化。full 機械化は却下（発動条件成立の事実と却下理由 = 実行可能性を D-050 (i) で分離記録） | `DEV_WORKFLOW.md` Draft PR Checkpoint | M-D8 |
| 同上 | impl-pr1 WER:21 | SPEC-WF-WERC-D9 | norm 昇格のみ採用（PR #17 で効果実証済み）。CI gate 化は 2026-08-01 CI 再評価へ（D-050 (ii)）。`docs/ci.md` Risk Routing は不改変 | `DEV_WORKFLOW.md` Implementation Rules + template Test Plan 節 | M-D9, M-D9A |
| 同上 | impl-pr2 WER:19 | SPEC-WF-WERC-D10 | Matrix の「既存テストで回帰担保」行は実在しないテスト引用が Double Audit まで潜伏した実例あり。rg 実在確認を起票時要求に | `templates/test-design-matrix.md` + `DEV_WORKFLOW.md` Design checklist | M-D10 |
| 同上 | impl-pr2 WER:20-21 | SPEC-WF-WERC-D11 | Ledger 起票時の adjacent-contract sweep。「規律変更なし、検出タイミング前倒しのみ」の WER 制約を遵守した最小文 | `DEV_WORKFLOW.md` Contract Audit + template Contract Coverage Ledger 節 | M-D11 |
| 同上 | 本 packet 採否裁定 | SPEC-WF-WERC-D12 | 採用 / 部分採用 / 不採用 defer 4 件を D-038 bundle precedent で D-050 に集約（起票済み） | `decision-log.md` D-050 | M-D12 |
| 同上 | Plans.md:90,:92 | SPEC-WF-WERC-D13 | roadmap 1-1 列挙の是正（消化済み 4 件除去 + 消化先明記）。Plan Gate F4 で独立契約行に昇格 | `docs/Plans.md` 次の行動 節 | M-D13 |
| 同上 | AGENTS.md:34（meaningful progress 更新義務） | SPEC-WF-WERC-HANDOFF | Handoff §2 の実質同期は独立契約（Plan Gate round 3 で具体化、Double Audit 2 pass P1 = 本 packet への adjacent-contract sweep 自己適用で Ledger 昇格。gated amendment） | `docs/PROJECT_HANDOFF.md` §2 直近の作業状態 | M-HANDOFF |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: 可 — 各規範文は WER 原文（archive、恒久保存）を出典に持ち、D-050 が採否と理由を集約する。
- Plan-only durable decisions found and promoted: 採否裁定（不採用 defer 4 件の発動条件事実・却下理由・revisit を含む）→ D-050 へ昇格・起票済み。
- Assumptions and constraints: 反映先の節構造・行位置は 2026-07-21 の file:line 実在確認に基づく（実装時に行番号がずれても節名で特定可能）。M-DIFF 対象 3 ファイル（DEV_WORKFLOW / plan-packet template / test-design-matrix template）は純追記。既存行改訂の例外 = D6 の DEV_SETUP_CHECKLIST 2 行置換と D4-A の隣接 2 ファイル（M-DIFF 対象外パス）。D13 の Plans.md と PROJECT_HANDOFF.md も M-DIFF 対象外（Matrix「実装制約」と同一の規定）。
- Deferred design gaps, risk, and follow-up target: D-050 defer 4 件 = (i) 契約文言 registry → 供給規約成立時 or drift 再発時 / (ii) release-profile CI gate 化 → 2026-08-01 CI 再評価 / (iii) 読取経路健全性チェック → roadmap 1-2 監査発注書作成時 / (iv) D5 cap 枯渇フォールバック → workflow-state 再設計 PR。
- Test Design Matrix can cite design decision IDs: 可（Assertion Commands の M-* 系が SPEC-WF-WERC-D1〜D13 に対応、Matrix overview 表参照）。

## Impact Review Lenses

not applicable — 本 PR は workflow docs の規範文のみで、実地調査・実機・外部 tool・POS 連携・CSV/TSV・operator workflow の発見に由来しない（由来は全て過去 PR の WER）。

## Design Readiness

- Existing design docs are sufficient because: 変更意図の正本 = WER 6 ファイル（Design Sources 列挙が正本）+ adjudication.md（全て archive / research で恒久保存、file:line 突合済み）。反映先の節構造は `DEV_WORKFLOW.md` / templates / `DEV_SETUP_CHECKLIST.md` の実文確認済み。
- Source docs updated in this PR: `DEV_WORKFLOW.md` / `templates/plan-packet.md` / `templates/test-design-matrix.md` / `templates/subagent-review-packet.md` / `.agents/skills/inventory-code-review/SKILL.md` / `DEV_SETUP_CHECKLIST.md` / `decision-log.md`（D-050 起票済み）/ `Plans.md` / `PROJECT_HANDOFF.md`。
- Design gaps intentionally deferred: D-050 defer 4 件（(i)〜(iv)、各 revisit target 付き）。
- Durable decisions discovered and promoted: D-050。

Minimum design checks: 全行 非該当（business-app 実装なし）— Layer ownership / Backend / DTO / Persistence / operator UI / Error / Traceability いずれも触れない。

## Contract Probe

- docs-only PR で hosted CI が自動発火しない前提: `.github/workflows/ci.yml` paths-ignore（`docs/**`, `*.md`）実文確認 + `docs/ci.md` Risk Routing 表確認 -> workflow_dispatch 明示 1 run が必要（PR #14 precedent で実績あり）。
- 上記以外の外部未検証前提: N/A — 全前提が repo 内 docs の実文確認で閉じる。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-WF-WERC-D1（doc 目次行） | `templates/plan-packet.md` Registration 表 | doc-consistency-check full + M-D1 | non-scope（L3 なし） |
| SPEC-WF-WERC-D2（相互修正案方式） | `DEV_WORKFLOW.md` Review Rules | M-D2（3 要素の個別 assertion）+ review evidence | non-scope |
| SPEC-WF-WERC-D3（絶対保証自己突合） | `DEV_WORKFLOW.md` Design checklist + template Design Intent Audit | M-D3 | non-scope |
| SPEC-WF-WERC-D4（実 mutation 注入） | `DEV_WORKFLOW.md` Contract Audit | M-D4 | non-scope |
| SPEC-WF-WERC-D4-A（隣接文言追随） | `templates/subagent-review-packet.md:137` + `.agents/skills/inventory-code-review/SKILL.md:58` | M-D4Aa〜b（per-file） | non-scope |
| SPEC-WF-WERC-D5（defer、D-050 (iv)） | 変更なし — Workflow State 節・`check-workflow-git.sh`・fixture は不改変のまま互換維持 | M-D5N（Workflow State 節の diff ゼロ guard） | non-scope（workflow-state 再設計 PR へ defer） |
| SPEC-WF-WERC-D6（clone パス追随） | `DEV_SETUP_CHECKLIST.md:248,:251` | M-D6（diff hunk 限定 + 対象外 exact 不変 assert） | non-scope（owner 実機確認は次回 L3 機会に自然実施） |
| SPEC-WF-WERC-D7（volatile count 限定拡張） | `DEV_WORKFLOW.md` Evidence Ownership | M-D7（cutoff 行の不変 guard 込み） | non-scope |
| SPEC-WF-WERC-D8（旧文言 grep evidence） | `DEV_WORKFLOW.md` Draft PR Checkpoint | M-D8 | non-scope |
| SPEC-WF-WERC-D9（release-profile check norm） | `DEV_WORKFLOW.md` Implementation Rules + template Test Plan | M-D9 | non-scope |
| SPEC-WF-WERC-D9-A（CI gate 非変更互換） | 変更なし — `docs/ci.md` Risk Routing（`:39,:159` 相当の workflow 行 / 再評価記述）を不改変で維持、gate 化は 2026-08-01 再評価へ | M-D9A（`docs/ci.md` の diff ゼロ guard） | non-scope |
| SPEC-WF-WERC-D10（Matrix 実在確認） | `templates/test-design-matrix.md` + Design checklist | M-D10 | non-scope |
| SPEC-WF-WERC-D11（adjacent-contract sweep） | `DEV_WORKFLOW.md` Contract Audit + template Ledger 節 | M-D11 | non-scope |
| SPEC-WF-WERC-D12（D-050 採否裁定） | `decision-log.md`（起票済み） | M-D12（3 区分 + defer 4 件の存在 assert）+ doc-consistency-check | non-scope |
| SPEC-WF-WERC-D13（Plans.md roadmap 是正） | `docs/Plans.md` 次の行動 節 | M-D13（節限定 rg で stale 4 件の不在 assert） | non-scope |
| SPEC-WF-WERC-HANDOFF（current-work sync） | `docs/PROJECT_HANDOFF.md` §2「直近の作業状態」 | M-HANDOFF（節内・同一行・完全遷移列の一括 assert） | non-scope |

## Test Plan

Test Design Matrix: `test-matrices/2026-07-21-workflow-docs-wer-consolidation.md`

- targeted tests: doc-consistency-check（--target plan → full）+ Matrix「Assertion Commands」の全 literal command（M-D1〜M-D13 系 + M-DIFF + M-HANDOFF）
- negative tests: M-D6c（旧パス negative lookahead）、M-DIFF（純追記 guard。例外 = D6 の 2 行置換と D4-A の隣接 2 doc 改訂、Matrix「実装制約」参照）
- compatibility checks: M-D5N（Workflow State 節の byte 一致）+ M-D9A（ci.md 不変）+ M-D7b（cutoff 行不変）+ M-D6d（履歴行不変）
- data safety checks: 非該当（実データ・秘匿情報なし）
- main wiring/integration checks: local-ci.sh full green + workflow_dispatch 三点 SHA 一致

## Boundary / Wire Contract

非該当 — JSON / browser state / CSV / config / manifest / cache schema / DTO / bindings / report / DB のいずれにも触れない。

## Review Focus

- WER 原文 ↔ 規範文の**意味等価性**（要約による意図の希釈・増幅がないか）
- Workflow State 節が完全不変か（M-D5N byte 一致。D5 は D-050 (iv) defer であり追記自体が違反）
- 既存文への splice が発生していないか（M-DIFF 純追記 guard、例外は Matrix「実装制約」の 2 種）
- D-050 の裁定記録と実装の一致（defer 4 件の発動条件事実・却下理由・revisit の分離記録）
- Plans.md 列挙と実体の一致（消化済み 4 件の除去と消化先の特定可能性）
- anchor phrase の実装文への埋め込みが自然な規範文になっているか（anchor 合わせの不自然な文の検出）

## Spec Contract

Contract ID: SPEC-WF-WERC

- WER Adjustment の各採用項目は WER 原文の意図と意味等価な規範文として指定節に存在し、各不採用項目は D-050 に「発動条件・事実認定」と「却下理由」を分離した形で記録され、Plans.md roadmap 1-1 の列挙は実体と一致する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-WERC-D1〜D4, D4-A, D6〜D11 | 実装 commit（規範文追記 + D4-A 隣接改訂） | 対応 M-*（Matrix Assertion Commands） | 意味等価性 / 純追記 | doc-consistency-check + PR body |
| SPEC-WF-WERC-D5（defer） | 変更なし（Workflow State 不変） | M-D5N | byte 一致 | PR body |
| SPEC-WF-WERC-D9-A（非変更互換） | 変更なし（ci.md 不変） | M-D9A | gate 化先走りなし | PR body |
| SPEC-WF-WERC-D12（plan-gate 確定済み） | plan-gate 修正 commit（起票済み） | M-D12a〜f | 採否と理由の分離記録 | decision-log |
| SPEC-WF-WERC-D13 | 実装 commit（Plans.md 是正） | M-D13a〜d | 列挙と実体の一致 | PR body |
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
