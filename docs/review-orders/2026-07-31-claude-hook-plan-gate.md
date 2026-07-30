# Review Order: Claude hook contract audit Plan Gate closure

## 1. Goal

Claude Sonnet 5 / effort xHigh / fresh context の read-only subagent を **1人だけ**起動し、Plan Review round 1のP2×2が閉じたかをclosure-only reviewする。相談窓口役は返却結果を集約し、Coordinatorが裁定できる判定材料としてownerへ返す。

## 2. Scope boundary

- Target Plan Packet: `docs/plans/2026-07-31-claude-hook-contract-audit.md`
- Target content SHA: `4c4284fb706e0122ede3f735d074ac9f3a8ec704`
- Target remote branch ref: `refs/heads/codex/claude-hook-audit`
- Risk / stage: `R3 workflow gate change / plan-gate`
- Closure targets:
  - `docs/plans/2026-07-31-claude-hook-contract-audit.md`
  - `docs/plans/test-matrices/2026-07-31-claude-hook-contract-audit.md`
  - `docs/AGENT_OPERATING_MANUAL.md` §6.1
  - `docs/decision-log.md` D-059
- Verify P2-1 closure: strict mode + trap normalizes script-controlled unexpected nonzero to exit 2; an inner checker deadline finishes before the outer runner timeout; Matrix has nonzero and hang cases without claiming the outer runner can always be trapped.
- Verify P2-2 closure: Self-Review ownership misstatement is removed; the old 7-point Self-Review and mandatory plan rally retire without successor, with the rejected promotion alternative and reason recorded.
- Check only correction regressions and direct drift from these two fixes. Do not reopen the accepted Scope/Non-scope boundary or add new review lenses.
- Do not review implementation because it has not started. Do not demand a non-pending `Plan Commit`: at `plan-gate`, `d90dc2d` is the plan-first identity candidate and the field remains `pending` until approval.

## 3. Read-only declaration

相談窓口役と生成subagentはread-only。repository file編集、commit、push、PR操作、settings変更、state遷移、merge、発注書の改変を行わない。

## 4. Report format

- Verdict: `APPROVE` or `REQUEST CHANGES`
- P1 / P2 / P3 counts
- Closure table for P2-1 and P2-2
- New correction-regression findings, if any: each includes `file:line`, reproducible failure path, impact, and minimum correction boundary
- Rejected / Deferred candidates
- Verification Gaps
- Plan Gate disposition: P1/P2=0ならimplementation可、それ以外はplan-gate維持
- 約20項目以内のbounded evidence summary。raw logやfull-file dumpは返さない

## 5. Subagent generation cap

- Target risk ceiling: R3 = concurrent 2
- Target current counted subagents/reviewers: 0
- Wave current counted subagents: 0（wave外の単独change）
- Reserved new generation count for this order: 1
- Arithmetic: target `0 + 1 <= 2`; wave `0 + 1 <= 4`
- このorderで生成してよいsubagentはClaude Sonnet 5 / effort xHigh / fresh contextの1人だけ。depth 1を維持し、生成したsubagentに再委譲させない。完了またはsupersedeまで予約枠を他へ割り当てない
