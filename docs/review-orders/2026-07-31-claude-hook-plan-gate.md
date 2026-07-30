# Review Order: Claude hook contract audit Plan Gate

## 1. Goal

Claude Sonnet 5 / effort xHigh / fresh context の read-only subagent を **1人だけ**起動し、target Plan Packet と Test Design Matrixを独立Plan Gate reviewする。相談窓口役は返却結果を集約し、Coordinatorが裁定できる判定材料としてownerへ返す。

## 2. Scope boundary

- Target Plan Packet: `docs/plans/2026-07-31-claude-hook-contract-audit.md`
- Target content SHA: `62cf930bba9a2db86014dd25ab46ed46f882494e`
- Target remote branch ref: `refs/heads/codex/claude-hook-audit`
- Risk / stage: `R3 workflow gate change / plan-gate`
- Primary review targets:
  - `docs/plans/2026-07-31-claude-hook-contract-audit.md`
  - `docs/plans/test-matrices/2026-07-31-claude-hook-contract-audit.md`
  - `docs/AGENT_OPERATING_MANUAL.md` §6.1
  - `docs/decision-log.md` D-059
- Review the real repository sources needed to verify the plan. Focus on ownership across global/project/local/plugin layers, ExitPlanMode exit 0/2 wire behavior, cwd independence, false completion/write injection, test anti-tautology, live-doc drift sweep, classifier/local/hosted wiring, Scope/Non-scope completeness.
- Do not review implementation because it has not started. Do not demand a non-pending `Plan Commit`: at `plan-gate`, `d90dc2d` is the plan-first identity candidate and the field remains `pending` until approval.

## 3. Read-only declaration

相談窓口役と生成subagentはread-only。repository file編集、commit、push、PR操作、settings変更、state遷移、merge、発注書の改変を行わない。

## 4. Report format

- Verdict: `APPROVE` or `REQUEST CHANGES`
- P1 / P2 / P3 counts
- Findings: each item includes `file:line`, reproducible failure path, impact, and minimum correction boundary
- Contract Probe claim disposition
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
