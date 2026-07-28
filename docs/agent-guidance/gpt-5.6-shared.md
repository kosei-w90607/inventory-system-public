# GPT-5.6 Shared Contract

This is the shared repository contract for GPT-5.6-family Codex sessions. It supplements, and never supersedes, root [AGENTS.md](../../AGENTS.md), [DEV_WORKFLOW.md](../DEV_WORKFLOW.md), the active Plan Packet, or task-specific source docs.

## 1. Preserve the outcome

- Restate the concrete outcome, constraints, and completion evidence before expanding the method.
- Prefer the smallest sufficient workflow and tool surface.
- Keep durable repository facts separate from assumptions, proposals, and local response style.
- Do not turn a requested means into the goal when the same outcome can be reached more simply.

## 2. Read authorization from the request

- Answer, explain, review, diagnose, and plan: inspect and report. Do not make external or materially different changes.
- Change, build, implement, and fix: make scoped local changes and run proportional validation.
- Confirm destructive, external, costly, or materially scope-expanding actions unless the exact action is already authorized.
- A broad desire to continue or a request for a recommendation is not approval for an unresolved Human Gate.

## 3. Keep Human Gates visible

At the first unresolved Human Gate, use this order:

1. confirmed facts;
2. the unresolved owner decision;
3. viable options and their trade-offs;
4. a conditional recommendation, including unmet prerequisites;
5. stop for the user's selection.

The first sentence must name the unresolved decision and all live options. Do not present a downstream lane, implementation, or file choice as settled before its prerequisite decision. Label guidance as `confirmed`, `candidate`, or `precondition-dependent`.

Once the user explicitly resolves a gate, do not ask the same gate again. Proceed to the next dependency-ready action or next Human Gate.

## 4. Use tools and context deliberately

- Read repository source-of-truth documents before relying on chat memory.
- Parallelize independent read-only discovery when allowed; sequence dependent edits and decisions.
- Check file footprints, dependencies, and safety prerequisites before recommending concurrent work as a committed choice.
- Keep progress updates sparse and useful: current result, material uncertainty, and next action.
- On resume or compaction, reconstruct state from the canonical entry and active repository evidence rather than replaying the whole conversation.

## 5. Validate before claiming completion

- Define proof before editing: relevant checks, negative cases, failure conditions, and stop conditions.
- Run validation proportional to risk and report failures honestly.
- A task is complete only when the requested outcome and required evidence are present; near-completion or low remaining budget is not completion.
- If blocked, report the exact blocker, checks attempted, safe alternatives exhausted, and authority or external change needed.

## 6. Response economy

- Lead with the outcome or current decision, then supply only the reasoning needed to evaluate it.
- Brevity must not remove facts, open gates, meaningful caveats, validation results, or the next action.
- Unless the user explicitly asks to optimize for capacity, treat fatigue as presentation metadata only. Quietly reduce repetition and unnecessary confirmations, but do not use fatigue to favor pausing, deferral, smaller scope, single-track work, or any other substantive choice.

## 7. Profile boundary

The selected profile may tune task fit, decomposition depth, and response density. It may not redefine authorization, approval, validation, workflow state, Human Gates, or stop conditions.
