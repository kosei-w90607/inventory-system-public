# Plan Packet: AI Quality Workflow Retrofit

## Risk

Risk: R3

Reason:
This changes workflow docs, repo-local skills, review routing, active plan gates, and the live project dashboard.

## Goal

Bring the companion-project AI Quality Workflow into inventory-system while preserving inventory source-of-truth boundaries and avoiding source-project terminology drift.

## Scope

- Create inventory workflow index and review overlay.
- Add spec and ADR indexes that point to existing source documents.
- Add `$inventory-workflow-start` and `$inventory-implementation`.
- Update templates with Boundary / Wire Contract, stronger Test Design Matrix checks, and coverage-first review-only packet wording.
- Add PK1/PK2/PK3 active Plan Packet checks to `scripts/doc-consistency-check.sh`.
- Compress `Plans.md` into a dashboard and archive the prior long version.
- Update existing active plan packet metadata so the new gate can run.

## Non-scope

- Runtime app behavior, DB schema, Tauri command DTOs, generated bindings, POS CSV, PLU TSV, and report CSV schemas.
- Moving existing research ADRs.
- Moving existing design documents into `docs/spec/`.
- GitHub PR metadata, labels, thread state, merge, or branch deletion.

## Acceptance Criteria

- `docs/DEV_WORKFLOW.md`, `docs/code_review.md`, `docs/spec/README.md`, and `docs/adr/README.md` exist and use inventory terminology.
- `.agents/skills/inventory-workflow-start/SKILL.md` and `.agents/skills/inventory-implementation/SKILL.md` exist with matching `agents/openai.yaml`.
- `bash scripts/doc-consistency-check.sh` finishes with no ERROR.
- `bash scripts/doc-consistency-check.sh --target plan` finishes with no ERROR.
- Source-project terminology drift search has no hits in `docs/DEV_WORKFLOW.md`, `docs/project-profile.md`, `docs/code_review.md`, or `.agents/skills/inventory-workflow-start/SKILL.md`.

## Test Plan

For R3/R4, include or link a Test Design Matrix.

Test Design Matrix: [test-matrices/2026-06-06-ai-workflow-retrofit.md](test-matrices/2026-06-06-ai-workflow-retrofit.md)

- targeted tests: doc consistency full run and plan-mode run.
- negative tests: active plan missing/malformed Risk is blocked by PK1.
- compatibility checks: existing inventory design checks remain active.
- data safety checks: workflow docs do not add real POS/store artifacts.
- main wiring/integration checks: `docs/DEV_WORKFLOW.md`, skills, `project-profile.md`, `AGENTS.md`, and `Plans.md` route to the same workflow.

## Boundary / Wire Contract

- producer: workflow docs, templates, repo-local skills, and doc-consistency shell script.
- consumer: Codex sessions, review agents, pre-review checks, and project maintainers.
- wire type: Markdown plan packets, YAML skill metadata, shell script output, and active plan file names.
- internal type: R0-R4 risk classification, PK1/PK2/PK3 check state, review routing.
- precision/range: `Risk: R0` through `Risk: R4` only; active plan file names follow `YYYY-MM-DD-*.md`.
- round-trip path: request -> `$inventory-workflow-start` -> Plan Packet/Test Matrix -> implementation -> doc-consistency checks -> review packet.
- invalid input: malformed Risk line, missing required section, unresolved placeholder, or empty bullet.
- compatibility: existing inventory design checks and active plan content remain readable.

## Review Focus

- Source-project terminology does not leak into inventory workflow docs or skills.
- Workflow docs route to existing inventory source-of-truth documents rather than duplicating product contracts.
- PK checks enforce active plan structure without scanning archives or test matrices as plans.
- `Plans.md` becomes dashboard-only while the previous content remains archived.
- New skills stay concise and align with skill-creator guidance.

## Spec Contract

Contract ID: WF-2026-06-06

- The workflow entrypoint is `$inventory-workflow-start`.
- Implementation work routes through `$inventory-implementation`.
- R2+ active plans use Plan Packet structure.
- R3/R4 plans use Test Design Matrix and review-only sub-agent by default or with an explicit skip reason for R3.
- Source-of-truth product behavior remains in existing design docs, not in workflow docs.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| WF-2026-06-06 | workflow docs and skills | doc-consistency full run | inventory terminology and links | `bash scripts/doc-consistency-check.sh` |
| WF-2026-06-06 | PK gate graft | plan-mode check | active plan enforcement | `bash scripts/doc-consistency-check.sh --target plan` |
| WF-2026-06-06 | source-project drift cleanup | drift search | no source-project terms in workflow surface | drift command |
| WF-2026-06-06 | Plans dashboard cleanup | markdown link check | archive preserved and linked | `bash scripts/doc-consistency-check.sh` |

## Data Safety

- Do not read or commit `.env*`, credentials, keys, `auth.json`, real POS CSV, PLU export files, SQLite DB files, backups, logs, receipt images, or store sales/cost data.
- Keep local app data and generated outputs ignored.
- This change only adds or edits docs, skills, and workflow script logic.

## Implementation Results

- Added inventory workflow docs, review overlay, spec/ADR indexes, and repo-local skills.
- Added active Plan Packet/Test Matrix artifacts for this workflow retrofit.
- Added PK1/PK2/PK3 checks to `scripts/doc-consistency-check.sh`.
- Compressed `Plans.md` and archived the previous dashboard as `docs/archive/plans/2026-06-06-plans-dashboard-cleanup.md`.
- Split the workflow retrofit onto `chore/inventory-ai-quality-workflow`; `fix/seed-stockout-and-monthly-card` was left clean before switching.
- Validation:
  - `bash scripts/doc-consistency-check.sh --target plan` -> exit 0.
  - `bash scripts/doc-consistency-check.sh` -> exit 0 with existing warnings only.
  - negative `/tmp` malformed-plan fixture -> exit 1 through PK1.
  - negative `/tmp` R3 plan without Test Design Matrix -> exit 1 through PK1.
  - negative `/tmp` R4 plan with review-only skip -> exit 1 through PK1.
  - `git diff --check` -> exit 0.

## Review Response

Review-only sub-agent completed. Addressed findings:

- Dashboard routing now points `docs/DEV_WORKFLOW.md` at root `../Plans.md`.
- R3/R4 Plan Packet checks now require a Test Design Matrix link or section.
- R4 Plan Packet checks now reject `Review-only skipped because:`.
- `docs/project-profile.md` no longer contains stale setup assumptions.
- `docs/ai-workflow/` is marked as common reference; inventory routing is authoritative in `docs/DEV_WORKFLOW.md` and `docs/project-profile.md`.
- Active workflow docs remove source-project terminology from live acceptance and dashboard wording.
- `docs/DOC_STYLE_GUIDE.md` no longer claims a fixed 19-check total.

Claude pre-PR review returned P1=0 / P2=0. Addressed P3 follow-ups:

- `docs/DEV_WORKFLOW.md` now clarifies that `$...` workflow skills are Codex/OpenAI harness entries and Claude Code can follow docs routing directly.
- `Plans.md` now preserves live visibility for deferred backlog categories while keeping the full snapshot archived.
- `AGENTS.md` now includes `npm test` in the frontend gate, and `docs/project-profile.md` points canonical gate/risk routing back to `docs/DEV_WORKFLOW.md`.

## PR Status

- Ready PR: #72 (private archive)
- Branch: `chore/inventory-ai-quality-workflow`
- Head commit at PR open: `be28303`
