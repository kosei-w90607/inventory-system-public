# Workflow Effectiveness Review: UI workflow / Skill dogfood

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-05-22-tone-and-nav-fix.md`, `docs/archive/plans/2026-06-07-display-scale-readability.md`, `docs/archive/plans/2026-06-08-plan-packet-backfill-audit.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-05-22-tone-and-nav-fix.md`, `docs/archive/plans/test-matrices/2026-06-07-display-scale-readability.md`
- review-only sub-agent: used for R3 display-scale / selection-tone work and for docs-only PR #83/#84 review checks; skipped for PR #85 local docs-only contract clarification
- external review: used on PR #77 and PR #82; PR #83/#84/#85 were docs-only and clean after local verification
- human approval: used for GitHub push / PR / ready / merge decisions
- gates: targeted Vitest, full frontend gates, Tauri debug build, Rust gates where relevant, `bash scripts/doc-consistency-check.sh --target plan`, and full `bash scripts/doc-consistency-check.sh`

## What Worked

- R3 Plan Packets kept scope boundaries clear. Display-scale stayed out of UI-11 settings / DB, selection-tone stayed out of broad redesign, and PR #82 split archive migration out of the audit PR.
- Test matrices forced useful negative cases. Display-scale covered invalid storage and WebView zoom failure; selection/nav work covered search-param active-state regressions and positive low-stock samples separately from stockout.
- Review-only / external review caught real issues before merge. The accepted findings were concrete implementation or plan-contract drift, not style noise.
- `$agmsg` dogfood exposed a real harness asymmetry: the database roots must be writable for messages, but the supported mode differs by harness. PR #84 documented the Codex sandbox setup instead of hiding it in chat.
- PR #85 showed the docs check value: the lingering `per_page` WARN became a small source-contract clarification instead of being buried in dashboard text.

## What Did Not Work

- The goal tool was useful for grouping work, but after one completed goal it still blocked a new goal in this thread. It should remain an operator aid, not the workflow source of truth.
- PR #85 did not get a recorded review-only sub-agent pass even though earlier instructions asked for review comments as record. The local review was enough for a narrow docs-only fix, but the skip reason should have been written down.
- `Plans.md` baseline sync lagged after PR #85 until this cleanup. Status-sync PRs are cheap, but they still create churn if every merge produces a separate dashboard-only PR.
- Active plan archive migration stayed pending after PR #77 / #80 / #82 until a separate cleanup. The separation was good for review scope, but the live dashboard carried stale "archive candidate" state longer than needed.

## Issues Caught Before Implementation

- PR #82 identified that durable Plan Packet decisions were already mostly promoted to `SCREEN_DESIGN.md`, `UI_TECH_STACK.md`, function-design docs, review checklist, decision-log, and Skills; only UI-06a pagination / DepartmentFilter backlog references were dangling.
- PR #83 kept PR #82 post-merge dashboard sync docs-only and did not mix in the `$agmsg` setup doc.
- PR #84 kept `$agmsg` sandbox notes in `DEV_SETUP_CHECKLIST.md` instead of normalizing broad new tool permissions.
- PR #85 confirmed `search_products` already had an IO-layer `per_page` clamp at 200 before documenting the contract.

## Issues Caught by Tests

- Display-scale targeted tests covered invalid persisted tokens, localStorage access failure, WebView zoom failure, sidebar reachability, product-code readability classes, and stock inquiry department switching.
- Selection/nav tests covered search-param active-state regressions and deterministic stockout / positive low-stock seed data.
- Full docs checks caught the lingering `per_page` WARN until PR #85 resolved it.

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Display-scale storage helpers evaluated `window.localStorage` before the non-fatal `try` path. | accepted | Moved lookup inside guarded paths and added `SecurityError` coverage. |
| PR #83/#84 docs-only review passes. | accepted / clean | No code changes required before ready / merge. |

## Issues Caught by External Review

- PR #77: stock detail header still used `text-xs` for product code after the broader readability change. Accepted and fixed.
- PR #82: Plan Packet drifted from the actual PR scope after `DEV_WORKFLOW.md`, `CLAUDE.md`, and PR template updates were included. Accepted and fixed by syncing Risk / Scope / Non-scope / Review Focus / Implementation Results.

## Escaped / Late Findings

- PR #85 status was not reflected in `Plans.md` until this cleanup.
- Completed active plans for PR #77 / #80 / #82 remained under `docs/plans/` after merge.
- The review-only skip for PR #85 was not recorded at PR time.
- The goal tool state mismatch surfaced only when starting the grouped 1+2 cleanup.

## Test Adequacy

Strong tests:

- R3 UI work had targeted negative tests plus full frontend / build gates.
- R3 seed work separated stockout from positive low-stock samples.
- Docs-only work had `doc-consistency-check.sh --target plan` and full docs check.

Weak or missing tests:

- No automated check flags completed active plans that should be archived.
- No automated check flags stale `Plans.md` merge baseline after a PR is merged.
- No automated check can validate whether a review-only sub-agent pass was intentionally skipped.

Mutation-style observations:

- Flipping `includeSearch` back to the default would be caught by the search-param active-state tests.
- Breaking display-scale storage error handling would be caught by the `SecurityError` test.
- Removing the IO-layer `per_page` clamp would not be caught by docs checks; it needs Rust coverage or contract tests if UI-01a changes the search surface.

## Signal / Noise

- sub-agent findings total: 1 actionable finding plus clean docs-only passes
- accepted: 1
- rejected: 0
- deferred: 0
- question: 0

The strongest signals were implementation defects and plan-contract drift. The weakest signal was process overhead around status-sync PRs when the only change was dashboard freshness.

## Cost / Friction

- useful cost: Plan Packet / Test Matrix / review-only gates were worthwhile for R3 UI and workflow changes.
- excessive friction: one-off dashboard sync PRs after every docs-only merge are easy to review but add operational churn.
- confusing steps: goal state is separate from repository evidence and can get stuck; review-only skip criteria for narrow docs-only PRs should be explicit in PR evidence.

## Recommended Workflow Adjustment

Keep:

- R3 Plan Packet + Test Design Matrix + review-only default.
- `Plans.md` as live dashboard only, with completed evidence moved to `docs/archive/plans/`.
- `$agmsg` sandbox guidance in setup docs, not in chat-only memory.

Change:

- Treat goal usage as optional session organization. Do not rely on it for durable workflow state.
- When skipping review-only on a narrow docs-only PR, write `Review-only skipped because:` in the PR body or plan evidence.
- Batch dashboard-only merge baseline sync with the next related docs cleanup when there is no blocker or user-facing ambiguity.

Follow-up:

- Phase 3 first cross-screen workflow plan should explicitly decide E2E / visual regression timing before UI-01a implementation.
- UI-01a should carry the existing `search_products` `per_page` contract into pagination UI design.

## Applied / Deferred Workflow Changes

Applied:

- `DEV_WORKFLOW.md` now treats `goal` / `$agmsg` as coordination aids, not durable workflow state.
- `DEV_WORKFLOW.md`, `docs/code_review.md`, the inventory implementation Skill, and the PR template now require `Review-only skipped because:` in Plan Packet or PR body when review-only is skipped.
- `DEV_WORKFLOW.md` now allows dashboard-only baseline sync to be batched with related docs cleanup when there is no blocker or stale next action.
- `DEV_WORKFLOW.md` now clarifies that default `--target plan` only applies when active plans exist; archive files should be checked by explicit path when edited.
- The PR template now includes dashboard / archive follow-up so intentional cleanup deferrals are visible before merge.
- The workflow-effectiveness-review Skill and template now make applying or explicitly deferring actionable lessons part of completing the review.
- PR #86 received a fresh review-only sub-agent pass after WER application. It found no P1/P2 blockers and two P3 evidence/wording drifts, both accepted and fixed in the same PR.

Deferred:

- No machine enforcement for stale dashboard baseline, unarchived completed plans, or review-only skip detection. The WER evidence showed process gaps, but not enough repeated cost to justify enforcement.

Not applied:

- No changes to runtime, CI gates, or risk tiers. The evidence supports workflow evidence hygiene, not stricter merge gates.
