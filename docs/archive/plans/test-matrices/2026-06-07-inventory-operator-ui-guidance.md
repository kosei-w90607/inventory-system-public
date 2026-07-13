# Test Design Matrix: Inventory Operator UI Guidance

## Risk

Risk: R3

## Contracts Under Test

- UI-GUIDE-2026-06-07 operator status meaning is not color-only.
- Inventory UI implementation uses existing shadcn/Radix/lucide patterns.
- Future operator UI work preserves the existing inventory-system visual language across pages unless a Plan Packet explicitly changes shared UI direction.
- Review checklist covers operator visibility as a first-class category.
- Repo-local Skill routes agents to inventory source documents and rejects generic visual novelty.
- `$inventory-workflow-start` routes inventory operator UI tasks to `$inventory-operator-ui` instead of generic UI Skills.
- Generic visual/Web UI Skills are removed from the active repo Skill registry after `$inventory-operator-ui` supersedes them.

## Failure Modes

- Design docs still imply red/yellow hue alone is sufficient for stock status.
- UI tech guidance recommends new packages or local font-size-only fixes as the first answer.
- The Skill improves one screen in a style that feels disconnected from existing pages.
- Reviewers lack a checklist category for older non-IT operator readability.
- The new Skill repeats generic frontend-design instructions and pulls work toward marketing or landing-page aesthetics.
- `$inventory-workflow-start` does not protect inventory operator UI work from generic machine/global UI Skills.
- `frontend-design` or `web-design-guidelines` remains active and can be selected instead of the inventory-specific Skill.
- Runtime, package, Tauri, DB, or generated files are changed during a docs/Skill extraction task.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-GUIDE-2026-06-07 | color-only status remains accepted | docs / review | screen design visibility read-through | `SCREEN_DESIGN.md` lacks a non-color status rule |
| UI-GUIDE-2026-06-07 | implementation pattern expands dependencies | docs / review | UI tech stack package-scope check | `UI_TECH_STACK.md` recommends new packages for the status pattern |
| UI-GUIDE-2026-06-07 | page-to-page visual drift | docs / review | existing visual language check | `inventory-operator-ui` does not require checking existing implemented screens/components before changing a screen |
| UI-GUIDE-2026-06-07 | review checklist misses operator readability | docs / review | review checklist category count check | `quality/review-checklist.md` lacks operator UI visibility checks |
| UI-GUIDE-2026-06-07 | Skill triggers generic visual design | docs / review | Skill scope read-through | `inventory-operator-ui` asks for striking/landing-page UI instead of business readability |
| UI-GUIDE-2026-06-07 | workflow entry routes to generic UI Skill | docs / review | workflow routing read-through | `$inventory-workflow-start` does not point operator UI work to `$inventory-operator-ui` or does not reject generic UI Skills as main guidance |
| UI-GUIDE-2026-06-07 | generic UI Skills remain active | registry / review | active Skill registry check | `frontend-design` or `web-design-guidelines` remains in `.agents/skills/`, `.claude/skills/`, or `skills-lock.json` |
| UI-GUIDE-2026-06-07 | active Plan Packet malformed | CLI / regression | plan packet gate | `bash scripts/doc-consistency-check.sh --target plan` exits non-zero |

## Negative Paths

- missing input: future UI task has no specific function-design doc; Skill still routes to `SCREEN_DESIGN.md`, `UI_TECH_STACK.md`, and the closest source doc.
- invalid input: request asks for beauty/landing-page polish; Skill redirects to operator workflow, readability, and business meaning.
- duplicate/ambiguous input: external UI Skills conflict with inventory docs; inventory docs win.
- stale active input: generic `frontend-design` or `web-design-guidelines` is present in active registry; remove it instead of relying on humans to avoid it.
- unknown reference: new Markdown links must resolve through doc consistency checks.
- dependency missing: no external Skill install command is used.
- permission/write failure: no app data or Windows app/config path is touched.
- dry-run side effect: docs checks are read-only.

## Boundary Checks

- threshold: operator-facing UI behavior or status contracts stay R3.
- null/default: docs-only Skill extraction has no runtime defaults.
- empty/non-empty: active plan includes non-empty acceptance criteria and trace rows.
- min/max: review checklist category count matches the actual category list.
- status/policy enum: color is secondary; text/icon/shape/position carry meaning.
- wire type: Markdown and YAML frontmatter only.
- internal type: Skill routing instructions and design-review rules.
- producer/consumer: design docs and Skill feed future Plan Packets, implementations, and PR reviews.
- round-trip token: `在庫切れ` / `在庫少` stay business labels in docs and tests.
- precision/range: no exact color class is treated as the only regression assertion.
- cross-language parse: no Rust/TypeScript command wire parsing changes.

## Compatibility Checks

- old schema/input: existing design docs and review checklist remain readable Markdown; archived references to removed Skills remain historical evidence.
- new schema/input: new Skill follows existing `.agents/skills/*/SKILL.md` shape and optional `agents/openai.yaml` convention.
- output order: no generated output is committed.
- optional field behavior: Claude symlink mirrors existing repo-local skill access pattern.

## Data Safety Checks

- source-derived data: no real POS CSV, PLU export, store data, or receipt image.
- generated outputs: no app build output, local DB, log, or screenshot committed.
- secrets: no `.env*`, credentials, keys, certs, cookies, or `auth.json`.
- local-only files: Windows native app data and local Skill experiments remain untracked.
- synthetic sample boundaries: no sample data added.

## Main Wiring / Integration Checks

- helper connected to main path: `.agents/skills/inventory-operator-ui/SKILL.md` is discoverable through Skill metadata.
- stale helper removed from main path: `frontend-design` and `web-design-guidelines` are no longer active repo Skills.
- output reaches manifest/report: `agents/openai.yaml` gives Codex UI metadata.
- effective config reaches runtime: not applicable; no runtime config change.
- CLI arg reaches implementation: `--target plan` validates this active Plan Packet.

## Mutation-style Adequacy Questions

- If the non-color status rule is removed from `SCREEN_DESIGN.md`, which review check catches it?
- If the Skill tells agents to make the UI visually striking, which read-through catches it?
- If `quality/review-checklist.md` says 9 categories but lists 8, which review catches it?
- If a package file changes in this docs-only task, which negative check catches it?
- If the high-visibility implementation is accidentally included, which scope check catches it?

## Residual Test Gaps

- This change does not visually validate the stock inquiry UI. Windows native L3 belongs to the follow-up implementation PR.
- Review-only sub-agent pass completed and is recorded in the Plan Packet Review Response; no residual gap remains for that gate.
