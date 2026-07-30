# Review Order: Claude hook contract audit Plan Gate closure round 3

## 1. Goal

Claude Sonnet 5 / effort xHigh / fresh context の read-only subagent を **1人だけ**起動し、closure round 2で残ったP2-1をproject hook inventory 0本へのdesign pivotが閉じたかclosure-only reviewする。相談窓口役は返却結果を集約し、Coordinatorが裁定できる判定材料としてownerへ返す。

## 2. Scope boundary

- Target Plan Packet: `docs/plans/2026-07-31-claude-hook-contract-audit.md`
- Target content SHA: `863c25b2291af981413b541e741d0e16313af939`
- Target remote branch ref: `refs/heads/codex/claude-hook-audit`
- Risk / stage: `R3 workflow gate change / plan-gate`
- Closure targets:
  - `docs/plans/2026-07-31-claude-hook-contract-audit.md`
  - `docs/plans/test-matrices/2026-07-31-claude-hook-contract-audit.md`
  - `docs/AGENT_OPERATING_MANUAL.md` §6.1
  - `docs/decision-log.md` D-059
- Verify P2-1 closure: the adopted contract is project hook inventory 0, harness disabled, and no ExitPlanMode checker connection. Manual §6.1, D-059, Packet, Matrix, Plans.md, and PROJECT_HANDOFF must agree. The Plan must preserve the existing independent Plan Review / doc-consistency / pre-push / local full / hosted final owners instead of inventing a second lightweight checker.
- Verify the runtime premise and disposition: full checker measurements are 33.53 / 33.70 / 33.64 seconds, `--target plan` measurements are 20.73 / 20.01 seconds, tracked project outer timeout is 10 seconds, old global outer timeout was 30 seconds, and the abandoned inner proposal had a 22-second maximum. It is acceptable to independently rerun read-only timing probes, but do not require a fixed timeout value for an implementation that adopts no project hook.
- Verify Matrix sensitivity at plan level: adding any project hook, enabling the harness, reintroducing a tracked hook script, removing canonical gate wiring, or disconnecting the inventory test must have a named red oracle. A runtime stdin/stdout/exit/timeout fixture is not required because the adopted implementation has no hook process.
- P2-2 is already CLOSED. Do not reopen Self-Review ownership unless this correction directly regressed it.
- Check only correction regressions and direct drift from the zero-hook pivot. Do not reopen the accepted Scope/Non-scope boundary or add unrelated review lenses.
- Do not review implementation because it has not started. Do not demand a non-pending `Plan Commit`: at `plan-gate`, `d90dc2d` is the plan-first identity candidate and the field remains `pending` until approval.

## 3. Read-only declaration

相談窓口役と生成subagentはread-only。repository file編集、commit、push、PR操作、settings変更、state遷移、merge、発注書の改変を行わない。

## 4. Report format

- Verdict: `APPROVE` or `REQUEST CHANGES`
- P1 / P2 / P3 counts
- Closure table for P2-1 and confirmation that P2-2 remains closed
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
