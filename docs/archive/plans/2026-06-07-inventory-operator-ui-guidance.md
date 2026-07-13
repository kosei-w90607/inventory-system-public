# Inventory Operator UI Guidance and Skill Extraction

## Risk

Risk: R3

Reason:
This change updates operator-facing UI design contracts, the review checklist, workflow-facing project profile notes, and repo-local Skills. It does not change runtime code, DB, Tauri command DTOs, generated bindings, package files, or app behavior, but it affects how future operator UI work is designed and reviewed.

## Goal

Promote the PR #70 L3 visibility lesson into durable inventory-system UI guidance and add a narrow repo-local Skill for operator-facing business UI work.

## Scope

- Add cross-screen operator visibility rules to `docs/SCREEN_DESIGN.md`.
- Add shadcn/lucide/status implementation guidance to `docs/UI_TECH_STACK.md`.
- Add operator UI visibility checks to `docs/quality/review-checklist.md`.
- Add workflow-facing test focus notes to `docs/project-profile.md`.
- Add the new Skill to `docs/TOOLING_SKILL_COMMANDS.md`.
- Add `.agents/skills/inventory-operator-ui/SKILL.md` and Codex UI metadata.
- Add a Claude Code symlink for the new repo-local Skill.
- Add negative routing in `$inventory-workflow-start` so inventory operator UI work does not default to generic UI Skills.
- Remove generic `frontend-design` and `web-design-guidelines` from the active repo Skill registry and `skills-lock.json`.
- Update `Plans.md` to close this extraction step and point to the high-visibility stock inquiry R3 follow-up.

## Non-scope

- Implementing the stock inquiry high-visibility UI.
- Changing `src/`, `src-tauri/`, package files, lockfiles, Tauri capabilities, DB schema, generated bindings, or runtime config.
- Installing external Skills or running Skill package managers.
- Deleting archived mentions of earlier Skill usage or survey references.
- Adding webview zoom, display-size settings, persistence, or cross-screen layout scaling.
- Resolving npm audit vulnerabilities.
- Changing the current stock inquiry contract H implementation in `docs/function-design/58-ui-stock-inquiry.md`; that belongs in the follow-up implementation PR.

## Acceptance Criteria

- `docs/SCREEN_DESIGN.md` records that operator-facing status meaning must not rely on hue alone.
- `docs/UI_TECH_STACK.md` records an inventory status pattern using existing shadcn/Radix/lucide components and no new package.
- `docs/quality/review-checklist.md` contains an operator UI visibility category and its category count is internally consistent.
- `.agents/skills/inventory-operator-ui/SKILL.md` exists with `name: inventory-operator-ui` and routes agents to inventory source docs.
- `.agents/skills/inventory-workflow-start/SKILL.md` routes operator-facing UI work to `$inventory-operator-ui` and does not make generic UI Skills the main guidance.
- `frontend-design` and `web-design-guidelines` are absent from `.agents/skills/`, `.claude/skills/`, `skills-lock.json`, and the active Skill list in `docs/TOOLING_SKILL_COMMANDS.md`.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.
- `bash scripts/doc-consistency-check.sh` exits with no ERROR.
- `git diff --check` exits 0.

## Test Plan

Test Design Matrix: [test-matrices/2026-06-07-inventory-operator-ui-guidance.md](test-matrices/2026-06-07-inventory-operator-ui-guidance.md)

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan`, `bash scripts/doc-consistency-check.sh`, `git diff --check`.
- negative tests: no `src/`, `src-tauri/`, package, lockfile, DB, Tauri capability, generated binding, or runtime config changes; no archived plan/history cleanup.
- compatibility checks: new Skill uses current `.agents/skills/` frontmatter shape and optional `agents/openai.yaml` metadata; Claude access uses the existing symlink pattern under `.claude/skills/`.
- data safety checks: no POS CSV, PLU export, DB, backup, log, receipt image, `.env*`, credential, key, or auth file touched.
- main wiring/integration checks: `Plans.md` links this plan and keeps the next high-visibility implementation as a separate R3 task.

## Boundary / Wire Contract

No runtime wire contract changes.

- producer: design docs, review checklist, project profile, and repo-local Skill metadata.
- consumer: Codex/OpenAI harness, Claude Code skill registry via symlink, future UI implementation/review sessions, PR reviewers.
- wire type: Markdown source docs, YAML frontmatter, and `agents/openai.yaml` interface metadata.
- internal type: operator UI rule/checklist text and Skill routing procedure.
- precision/range: status meaning requires Japanese text plus at least one non-color signal; color is secondary.
- round-trip path: PR #70 L3 finding -> durable docs -> repo-local Skill -> future high-visibility Plan Packet.
- invalid input: external beauty/landing-page Skills must not override inventory operator UI rules.
- compatibility: external UI Skill survey references remain as historical evidence, but generic UI Skills are no longer active in this repo.
- compatibility: no runtime code, package, DB, command DTO, generated binding, or Tauri capability compatibility impact.

## Review Focus

- Whether the new guidance is narrow enough for a single-store Windows desktop business app.
- Whether the Skill prevents generic "visually striking" UI guidance from overriding operator readability.
- Whether color-only status encoding is clearly prohibited without falsely claiming current code has already been fixed.
- Whether the next high-visibility stock inquiry implementation remains a separate R3 task.

## Spec Contract

Contract ID: UI-GUIDE-2026-06-07

- Operator-facing business status meaning must not rely on hue alone.
- Existing semantic colors remain allowed as secondary emphasis.
- Future operator UI work must preserve the existing inventory-system visual language unless a Plan Packet explicitly changes the shared UI direction.
- Inventory UI implementation/review guidance must prioritize non-IT older operator readability, Japanese business labels, stable table/card layout, and Windows native L3 validation.
- Repo-local UI Skills must route to inventory source docs and must not ask agents to make generic landing-page or visually striking SaaS-style UI.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-GUIDE-2026-06-07 | screen design visibility rule | docs review | color-only status prohibition | `docs/SCREEN_DESIGN.md` |
| UI-GUIDE-2026-06-07 | UI tech implementation pattern | docs review | shadcn/lucide/no-new-package guidance | `docs/UI_TECH_STACK.md` |
| UI-GUIDE-2026-06-07 | review checklist category | docs review | operator visibility review coverage | `docs/quality/review-checklist.md` |
| UI-GUIDE-2026-06-07 | repo-local Skill | docs review | Skill routes to docs and rejects visual novelty | `.agents/skills/inventory-operator-ui/SKILL.md` |
| UI-GUIDE-2026-06-07 | docs validation | CLI | active Plan Packet and link checks | `bash scripts/doc-consistency-check.sh --target plan` |

## Data Safety

- Do not commit real POS CSV, PLU exports, SQLite DB files, backups, logs, receipt images, or store sales/cost data.
- Do not read or commit `.env*`, credentials, keys, certificates, cookies, or `auth.json`.
- Keep Windows native app data, screenshots, and local Skill experiments out of commits unless sanitized and explicitly approved.
- This change may add only documentation and Skill metadata/instructions.

## Implementation Results

- Added `docs/SCREEN_DESIGN.md` cross-screen operator visibility rules: status colors are secondary, and operator-facing status meaning must be readable without hue.
- Added `docs/UI_TECH_STACK.md` status implementation guidance for existing shadcn/Radix/lucide components, non-color signals, text/role/value tests, and display-size separation.
- Added `docs/quality/review-checklist.md` category 9 for Operator UI visibility and corrected the category count wording.
- Added `docs/project-profile.md` test focus bullets for non-color operator status indicators and readability L3 checks.
- Added `$inventory-operator-ui` to `docs/TOOLING_SKILL_COMMANDS.md`.
- Added `.agents/skills/inventory-operator-ui/SKILL.md` plus `agents/openai.yaml`.
- Added negative routing so `$inventory-operator-ui` is used instead of generic `frontend-design` / `web-design-guidelines` when inventory operator UI work is in scope.
- Added `.claude/skills/inventory-operator-ui` symlink to expose the same Skill to Claude Code sessions.
- Removed `frontend-design` and `web-design-guidelines` from `.agents/skills/`, `.claude/skills/`, `skills-lock.json`, and the active Skill list because they are superseded by `$inventory-operator-ui` for this project.
- Updated `Plans.md` to mark the extraction work complete and keep the stock inquiry high-visibility implementation as the next separate R3 task.

## Review Response

Review-only sub-agent pass completed with P1/P2 = 0 and P3 = 3.

- Accepted P3: monthly previous-period text still described green/gray/red too directly. Fixed `docs/SCREEN_DESIGN.md` so numeric/text meaning is primary and color is secondary.
- Accepted P3: `docs/TOOLING_SKILL_COMMANDS.md` implied all Skill provenance comes from `skills-lock.json`. Fixed wording to split external Skills from repo-local Skills under `.agents/skills/`.
- Accepted P3: `Plans.md` next stock inquiry task still said to promote visibility rules already added in this branch. Fixed wording to apply/refine the new rules in `58-ui-stock-inquiry.md` and implementation.

Post-review scope clarification:

- User classified removal of generic `frontend-design` and `web-design-guidelines` as part of the Skill refresh. Accepted as same-branch registry cleanup because `$inventory-operator-ui` supersedes them for this project and the change only removes active Skill entries, symlinks, and `skills-lock.json` records.
- Re-ran `bash scripts/doc-consistency-check.sh --target plan`, `bash scripts/doc-consistency-check.sh`, `git diff --check`, and `skills-lock.json` JSON parse after the registry cleanup.

Additional post-review clarification:

- User asked whether `$inventory-operator-ui` also preserves the existing design atmosphere across pages. Accepted as part of the Skill definition: future UI work must inspect and reuse existing inventory-system visual language, and any intentional departure belongs in a Plan Packet as a shared UI direction change.

External PR #73 review response:

- Accepted P2: Test Matrix still said no review-only sub-agent pass had run even though the Plan Packet recorded the completed pass. Updated Residual Test Gaps to reflect the completed gate.
- Accepted P2: generic frontend/UI Skills can still exist in machine/global registries even after repo-local registry cleanup. Added explicit negative routing to `$inventory-operator-ui` and `$inventory-workflow-start` so inventory operator UI work uses the repo-local Skill as the main guidance.
