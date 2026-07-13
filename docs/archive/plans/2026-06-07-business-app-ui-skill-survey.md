# Business-app UI Skill Survey

## Risk

Risk: R2

Reason:
This is a workflow/design-support survey. It may influence repo-local Skills and UI review guidance, but it does not change runtime code, product behavior, DB, Tauri capabilities, command DTOs, report output, or merge gates.

## Goal

Identify external UI/accessibility Skills worth learning from, decide what not to install during the npm supply-chain freeze, and define the next inventory-local operator UI guidance/Skill work.

## Scope

- Read-only survey of public Skills relevant to business-app UI, shadcn, accessibility, data tables, cognitive load, and dashboards.
- Capture extraction targets for inventory-system guidance.
- Keep external Skill installation out of scope.
- Identify the path from this survey into `SCREEN_DESIGN.md`, `UI_TECH_STACK.md`, `quality/review-checklist.md`, and a future repo-local Skill.

## Non-scope

- Running `npx skills add`, `npx skills find`, or any package-executing Skill CLI command.
- Installing external Skills globally or into this repository.
- Implementing stock inquiry high-visibility UI.
- Changing app runtime code.
- Adding Tauri webview zoom or display-size settings.
- Resolving npm audit vulnerabilities.

## Acceptance Criteria

- Survey records at least three relevant external Skills and the reason to adopt, adapt, or reject each.
- Survey records that external Skills are read-only references during npm supply-chain freeze.
- `Plans.md` separates completed survey work from next extraction/implementation work.
- `bash scripts/doc-consistency-check.sh --target plan` passes.
- `bash scripts/doc-consistency-check.sh` finishes with no ERROR.

## Test Plan

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan`
- negative tests: no external Skill install command is run; no `.agents/skills/` or `.claude/skills/` changes in this survey step
- compatibility checks: no runtime, package, lockfile, Tauri, DB, or generated binding changes
- data safety checks: no real POS/store data, DB, logs, backups, or secrets touched
- main wiring/integration checks: `Plans.md` next actions point to the extraction work and high-visibility R3 plan

## Boundary / Wire Contract

Not applicable. This survey does not touch JSON API, browser state, CSV, config, manifest, cache schema, Tauri command DTOs, generated bindings, report output, or DB-backed compatibility.

## Review Focus

- Whether candidate Skills fit a non-IT, older operator business desktop app.
- Whether the survey avoids beauty/landing-page oriented guidance as the primary source.
- Whether install avoidance is explicit enough during the npm supply-chain freeze.
- Whether the next extraction step is actionable.

## Survey Results

| Candidate | Source | Useful parts | Fit for inventory-system | Decision |
|---|---|---|---|---|
| shadcn | https://skills.sh/shadcn/ui/shadcn | Component selection, Badge/Table/Card composition, `truncate`, semantic colors, Dialog/Sheet title accessibility, existing-component-first discipline | Good implementation reference because the app already uses shadcn/Radix/Tailwind. Contains shell-command directives and registry install flows, so it must not be installed or blindly followed during npm freeze. | Adapt rules manually; do not install now. |
| ui-doctor | https://skills.sh/iress/design-system/ui-doctor | WCAG review, no reliance on color alone, cognitive load, Nielsen heuristics, information architecture, visible active states | Strong conceptual fit for business-app review. IDS-specific component names are not applicable, but the audit modes map well to inventory UI review. | Best source for review checklist shape; adapt, do not install. |
| web-design-guidelines | https://skills.sh/ehmo/platform-design-skills/web-design-guidelines | WCAG/web-platform rules, labels, focus, target size, no horizontal page overflow, zoom accessibility | Useful as generic accessibility baseline. Mobile-first guidance is less central because this is a Windows Tauri desktop app, but target size, zoom, reflow, and label rules still matter. | Adapt selected accessibility rules. |
| ui-audit | https://skills.sh/tommygeoco/ui-audit/ui-audit | Decision scaffolding, trade-off evaluation, visual hierarchy, progressive disclosure, accessibility checklist references | Useful for structuring UI decisions under time pressure, but less concrete than ui-doctor for this project. | Use as process inspiration only. |
| data-visualization | https://skills.sh/anthropics/knowledge-work-plugins/data-visualization | Never rely on color alone in charts, provide labels/patterns/tables, readable text and black-and-white checks | Relevant to sales reports and future charts, not the immediate stock status badge fix. | Backlog as report/chart-specific reference. |
| ui-ux-pro-max | https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max | Broad UX/accessibility coverage, dashboards/admin panels, data-table fallback ideas | Too broad and noisy for this constrained desktop business app. It risks pulling the work toward generic SaaS/marketing polish. | Do not install; extract only specific accessibility/table ideas if needed. |

## Decision

Do not adopt an external UI Skill wholesale.

The current `frontend-design`-style Skills over-index on visual polish, landing pages, or broad product aesthetics. This project needs a narrower operator UI discipline:

- non-IT older operator readability
- Japanese labels matching business meaning
- high-density but readable tables
- status indicators that do not rely on hue alone
- shadcn/Radix component correctness
- Windows native L3 validation for operator-facing changes
- restrained visual tone rather than striking aesthetics

The next work creates inventory-local guidance/Skill from this survey and existing project memory. Durable product rules belong in design docs; the Skill routes agents to those docs and provides a review/implementation checklist.

## Candidate Extraction Targets

- `SCREEN_DESIGN.md`
  - Add common operator-visibility principles.
  - State that color is a secondary signal; status meaning requires text/icon/shape/position support.
  - Treat failed L3 readability as a functional defect, not polish.
- `UI_TECH_STACK.md`
  - Add shadcn/Radix implementation patterns for Badge/icon/status, table overflow, focus, labels, and display-size handling.
  - Record that simple font-size increases are not the default answer; cross-screen display scale or webview zoom needs a separate design.
- `docs/quality/review-checklist.md`
  - Add operator UI review checks: color-only status, text readability, table density, keyboard/focus, active-state visibility, grayscale check, Windows native L3.
- `.agents/skills/inventory-operator-ui/SKILL.md`
  - Future repo-local Skill that reads the above docs and applies this app-specific operator UI checklist.
  - It must not ask agents to create visually striking UI.

## Implementation Results

- Read-only public Skill survey completed on 2026-06-07.
- No external Skill was installed.
- No package, lockfile, runtime, Tauri, DB, generated binding, or app source file was changed.
- This survey found useful rules, but no existing external Skill is a clean direct fit.

## Review Response

No review yet.
