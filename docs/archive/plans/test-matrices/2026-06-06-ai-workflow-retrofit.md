# Test Design Matrix: AI Quality Workflow Retrofit

## Risk

Risk: R3

## Contracts Under Test

- WF-2026-06-06 workflow entry and routing.
- Active Plan Packet gate behavior.
- Inventory terminology and source-of-truth routing.
- Data safety boundary for workflow artifacts.

## Failure Modes

- Workflow docs retain source-project-specific terms.
- Active plan without valid `Risk: Rn` bypasses the check.
- `docs/plans/test-matrices/` or `docs/archive/plans/` is treated as active plan input.
- `Plans.md` loses previous progress history during dashboard cleanup.
- New skills are verbose, generic, or disconnected from inventory source documents.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| WF-2026-06-06 | source-project terms leak into workflow surface | CLI / regression | source-project drift search | copied docs or skills still mention source-project terms |
| WF-2026-06-06 | malformed active plan bypasses structure gate | CLI / negative | plan-mode PK1 fixture | `Risk:` is absent or malformed and plan check exits 0 |
| WF-2026-06-06 | active plan gate scans wrong directories | CLI / compatibility | plan-mode directory scope | archive plans or test matrices are treated as active Plan Packets |
| WF-2026-06-06 | prior dashboard history is lost | docs / data safety | archive link check | archived `Plans.md` copy is missing or unlinked |
| WF-2026-06-06 | inventory source-of-truth routing is broken | docs / integration | doc consistency link check | workflow docs link to missing files or duplicate product truth |

## Negative Paths

- missing input: active dated plan without `Risk: Rn`.
- invalid input: `Risk: R3 extra` or other malformed Risk line.
- duplicate/ambiguous input: active plan and archived plan with same subject; only active root plan is checked.
- unknown reference: markdown link target missing from new workflow docs.
- dependency missing: `rg` unavailable is already handled by script preflight.
- permission/write failure: not applicable; validation is read-only.
- dry-run side effect: plan checks must not mutate docs.

## Boundary Checks

- threshold: R2 starts Plan Packet requirement; R3 adds Spec Contract / Trace Matrix / Data Safety.
- null/default: no target path defaults to `docs/plans/` root active plans.
- empty/non-empty: empty bullet and placeholder detection in R2+ plans.
- min/max: valid risk range is R0-R4.
- status/policy enum: R0/R1 skip Plan Packet required sections; R2+ enforced.
- wire type: Markdown headings and `Risk: Rn` line.
- internal type: shell-script risk parsing and section presence checks.
- producer/consumer: docs/templates produce Plan Packets; script consumes active plan files.
- round-trip token: `Risk: R3` stays parseable through authoring and validation.
- precision/range: exact risk line match only.
- cross-language parse: Markdown/YAML/shell surfaces stay ASCII-compatible where metadata requires it.

## Compatibility Checks

- old schema/input: existing design checks still run.
- new schema/input: PK1/PK2/PK3 checks run in both default and `--target plan` modes.
- output order: script reports existing design checks plus PK checks.
- optional field behavior: R0/R1 active plans do not need full packet sections.

## Data Safety Checks

- source-derived data: no real POS/store files added.
- generated outputs: no app build output or logs added.
- secrets: no `.env*`, credentials, keys, or auth files read or committed.
- local-only files: archived dashboard is documentation, not app data.
- synthetic sample boundaries: no new sample data added.

## Main Wiring / Integration Checks

- helper connected to main path: PK functions are called in default and plan target modes.
- output reaches manifest/report: script result shows PK sections in validation output.
- effective config reaches runtime: `PLAN_DIR="docs/plans"` controls active plan scan.
- CLI arg reaches implementation: `--target plan` uses root plan files and explicit target path.

## Mutation-style Adequacy Questions

- If `Risk: R3 extra` is accepted, which check fails?
- If archive plans are scanned as active plans, which command exposes it?
- If a required R3 section is removed, which check fails?
- If placeholder stripping misses prose placeholders, which check fails?
- If workflow docs link to a directory with markdown syntax, which check fails?
- If source-project terms remain in new workflow docs, which drift search fails?

## Residual Test Gaps

- Review-only sub-agent behavior is documented but not independently exercised in this change.
- Workflow Effectiveness Review needs the next real R2/R3 inventory task as evidence.
