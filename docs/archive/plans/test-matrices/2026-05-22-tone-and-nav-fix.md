# Test Design Matrix: Selection Tone and Navigation Follow-up

## Risk

Risk: R3

## Contracts Under Test

- UI-WF-2026-05-22 route/search active-state behavior.
- Selection state visual consistency across shared UI.
- Demo seed stockout and positive low-stock sample separation.
- Sales summary card overflow containment.

## Failure Modes

- Search params clear active navigation.
- Selection tone becomes inconsistent or conflicts with stockout/low-stock semantic colors.
- Stockout rows are mistaken for positive low-stock samples.
- Summary card values overflow their container.
- Real POS/store artifacts are introduced while adding seed/demo evidence.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-WF-2026-05-22 | search params clear active state | RTL / regression | `SidebarLink.test.tsx`, `TabsHeader.test.tsx` | `includeSearch:false` is removed or not wired to shared links |
| UI-WF-2026-05-22 | shared two-choice control drifts from active tone | RTL / regression | `segmented-control.test.tsx`, `ModeTabs.test.tsx` | `SegmentedControl` stops exposing selected state or ModeTabs stops using the shared two-choice primitive |
| UI-WF-2026-05-22 | stockout counted as low stock | Rust / regression | `seed_test.rs` | positive low-stock assertions omit `stock_quantity > 0` |
| UI-WF-2026-05-22 | selection tone unreadable or inconsistent | L3 visual review | Windows native L3 note | sidebar, tabs, and chips use conflicting active styles |
| UI-WF-2026-05-22 | card overflow persists | L3 visual review | Windows native L3 note | `min-w-0` / `truncate` is missing from summary cards |

## Negative Paths

- missing input: route without search still marks current nav active.
- invalid input: unsupported search fields are handled by existing route validators.
- duplicate/ambiguous input: stockout and low-stock seed samples remain distinct.
- unknown reference: no new command DTO or DB schema reference is introduced.
- dependency missing: no new npm package or crate.
- permission/write failure: not applicable to UI style and synthetic seed changes.
- dry-run side effect: seed tests use test DB only.

## Boundary Checks

- threshold: low stock uses positive quantity under unit threshold.
- null/default: routes without search keep active behavior.
- empty/non-empty: seed output includes at least one stockout and one positive low-stock sample.
- min/max: summary values truncate instead of resizing cards.
- status/policy enum: visual states do not alter domain stock status.
- wire type: browser route/search state and SQLite seed rows.
- internal type: TanStack Router active state and Rust seed product rows.
- producer/consumer: shared links and seed generator feed UI/operator demo.
- round-trip token: URL search state is preserved through active-state calculation.
- precision/range: `stock_quantity <= 0` and `stock_quantity > 0` remain separate cases.
- cross-language parse: no cross-language command wire change.

## Compatibility Checks

- old schema/input: no DB migration or command DTO change.
- new schema/input: no new schema.
- output order: seed determinism tests protect generated ordering assumptions.
- optional field behavior: route validators continue to handle optional search fields.

## Data Safety Checks

- source-derived data: no real POS CSV, PLU export, or store data.
- generated outputs: no app data, logs, or screenshots committed.
- secrets: no `.env*`, credentials, keys, or auth files.
- local-only files: Windows native L3 evidence remains outside commits unless sanitized.
- synthetic sample boundaries: seed data remains synthetic.

## Main Wiring / Integration Checks

- helper connected to main path: shared `SidebarLink`, `TabsHeader`, and `SegmentedControl`/`ModeTabs` paths are covered.
- output reaches manifest/report: not applicable; no report schema change.
- effective config reaches runtime: no config change.
- CLI arg reaches implementation: seed binary behavior is covered by Rust tests.

## Mutation-style Adequacy Questions

- If `includeSearch:false` is removed, which RTL test fails?
- If the shared segmented control stops marking the active option or ModeTabs bypasses it, which RTL test fails?
- If positive low-stock allows zero quantity, which seed test fails?
- If selection color constants diverge, which L3 review catches it?
- If `truncate` is removed, which L3 review catches card overflow?
- If real store data is added as fixture evidence, which data safety review catches it?

## Residual Test Gaps

- jsdom does not calculate actual card overflow, so visual overflow relies on Windows native L3 review.
- Final tone choice remains a human visual decision.
