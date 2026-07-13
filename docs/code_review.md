# Code Review Overlay

Use this alongside [quality/review-checklist.md](quality/review-checklist.md). The checklist defines the inventory-specific categories; this file defines review discipline and escalation.

## Source Order

1. Live code, diff, tests, and generated files.
2. [ARCHITECTURE.md](ARCHITECTURE.md), [FUNCTION_DESIGN.md](FUNCTION_DESIGN.md), [DB_DESIGN.md](DB_DESIGN.md), [SCREEN_DESIGN.md](SCREEN_DESIGN.md), [UI_TECH_STACK.md](UI_TECH_STACK.md).
3. [project-profile.md](project-profile.md), [DEV_WORKFLOW.md](DEV_WORKFLOW.md), and the active Plan Packet's `Design Sources` / `Design Readiness`.
4. Author summaries, validation logs, and AI comments.

Treat summaries as claims until checked against source files or commands.
If the Plan Packet contains durable design decisions that are absent from source design docs, treat that as design drift unless the PR explicitly keeps the work in design-only scope or names a concrete follow-up.

## Blocking Review Focus

- Bugs, behavioral regressions, data loss, unsafe defaults, or broken runtime paths.
- Drift from `UI -> CMD -> BIZ -> IO/MNT`.
- CMD gaining business rules, UI duplicating BIZ rules, or IO/MNT leaking higher-layer error types.
- SQLite schema, migration, FK/CHECK/index, transaction, or stock consistency drift.
- POS CSV parsing, CP932/NEL handling, JAN normalization, negative return handling, duplicate import, or rollback drift.
- PLU file format, encoding, dirty/exported state, register workflow messaging, or 5000 PLU limit drift.
- Tauri command argument/return shape, `CmdError`, tauri-specta registration, or `src/lib/bindings.ts` drift.
- Report CSV schema, BOM/encoding, filename, or export UX contract drift.
- UI route/search state, daily operator workflow, Japanese labels, query invalidation, import/unsaved guards, or Windows native behavior drift.
- Missing tests for changed contracts, negative paths, compatibility, data safety, or main wiring.

## Finding Severity

| Severity | Use when |
|---|---|
| P1 | Data loss, destructive behavior, committed secret/store data, broken default runtime, unsafe schema/runtime break. |
| P2 | Contract violation, missing critical test, misleading UI/report/output, layer-boundary drift, data safety gap, compatibility break. |
| P3 | Non-blocking robustness, docs/status drift, maintainability, small test clarity issue. |

Risk tier describes the change. Severity describes each finding.

## Verification Rules

- P1 must include direct evidence: file/line, command output, schema contract, or reproducible path.
- Split the problem claim from the suggested fix. A weak fix idea does not weaken a real finding.
- Search for drift before final review when renaming or changing a contract:
  `rg -n "<old-term>|<new-term>|<related-term>" docs src src-tauri scripts`.
- Check generated bindings after command or DTO changes.
- Check active plans with `bash scripts/doc-consistency-check.sh --target plan` when workflow artifacts changed.
- For R2+ work, check whether Design Phase completed before implementation: source design docs are cited as sufficient or updated in the same PR.
- For R3/R4 work, check `Design Intent Trace`: spec IDs, design decision IDs, source design sections, implementation targets, and test targets should be connected.
- Treat Plan Packet-only design rationale as drift when it is durable and absent from source design docs, `docs/decision-log.md`, or ADRs.
- For UI changes affecting operator flow, state whether Windows native L3 verification is required.

## Same PR vs Follow-up

Fix in the same PR:

- Broken behavior introduced by the PR.
- Source-of-truth or generated-file drift created by the PR.
- Missing tests for the changed contract.
- Data safety or layer-boundary gaps.
- Review findings that block a correct merge.

Track as follow-up:

- Existing unrelated debt.
- New feature expansion outside the Plan Packet.
- Optional polish that does not affect the changed contract.
- Tooling improvements discovered while reviewing but not needed for this merge.

## Review-only Sub-agent Protocol

- Use [templates/subagent-review-packet.md](templates/subagent-review-packet.md) for R3/R4 before PR/external review.
- The sub-agent is read-only and findings-only.
- The implementer verifies every finding independently before fixing, rejecting, or deferring.
- For R3 skip, record `Review-only skipped because:` in the Plan Packet or PR body.
- R4 review-only is required.

## Output Shape

Lead with findings.

```md
## Findings
- P2 - path:line - issue / impact / smallest safe fix

## Verification Performed
- command -> result

## Residual Risks
- risk or test gap
```

If no blocking issue is found, say `No blocking findings.` and list remaining test gaps or residual risks.
