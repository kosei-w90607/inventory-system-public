# Workflow Effectiveness Review: UI-08 PLU implementation

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-07-01-ui08-plu-implementation.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-07-01-ui08-plu-implementation.md`
- review-only sub-agent: `Kant`, `Turing`, `Boyle`, `Ampere`
- external review: PR comments and owner field feedback
- human approval: Windows native L3, owner structural-equivalence decision for external gate
- gates: full frontend/Rust/docs gates locally during implementation, GitHub CI green before merge

## What Worked

- Draft PR checkpoint worked as intended. The PR stayed Draft while Windows native L3 and field-gate feedback found real operator and CV17 compatibility issues.
- Impact Review Lenses forced adapter/core separation: CV17 1.1.1 profile, SD-card flow, and SR-S4000 behavior stayed adapter/manual evidence while app state remained app-side confirmation.
- Review-only passes caught practical issues after each scope expansion: route inclusion, fs scope, saved pending recovery safety, stale TSV wording, and over-limit test drift.
- TDD/regression coverage scaled with risk: backend tests covered two-step lifecycle, exact target confirmation, invalid rollback, shared PLU memory, JAN validation, and seed EAN13 generation; RTL covered save/cancel/failure/confirm/recovery/error wording.

## What Did Not Work

- The first field profile assumption was stale. The implementation initially targeted old 10-column `.tsv` behavior before CV17 1.1.1 field evidence forced the 11-column `.txt` profile.
- Real-device confirmation became a long blocker. The final owner decision to accept structural equivalence and defer latest app-generated `.txt` recheck was reasonable, but the follow-up needed explicit recording to avoid losing it.
- JANなし商品 policy was discovered late from actual prepare failure. It is correctly split out now, but it should have been called out earlier as a product-design follow-up for scanning PLU.

## Issues Caught Before Implementation

- PLU file generation and app-side exported confirmation must be separate; `prepare_plu_export` must not mutate `plu_dirty`.
- `confirm_plu_export_saved` must update only the exact product_code set prepared/saved by the operator.
- App-side `plu_exported_at` is not proof of PC-tool acceptance or register reflection.

## Issues Caught by Tests

- Prepare no-mutation and confirm exact-set behavior.
- Confirm rollback on invalid empty/duplicate/missing product_code input.
- CV17 1.1.1 output shape: `.txt`, 11 columns, CP932/CRLF, memory 217 start under observed normal PLU count.
- 13-digit JAN/EAN-13 validation and no `product_code` fallback.
- Shared total PLU memory derivation.
- Saved pending recovery state does not persist PLU file bytes or product details.
- Demo seed products now generate valid 13-digit EAN values for the PLU gate.

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| `Kant`: route/page/test/plan files were untracked before PR. | accepted | Included intended files before publish. |
| `Kant`: static `$HOME/**` fs scope was too broad. | accepted | Removed broad scope and kept dialog-selected save path behavior plus fs write permission. |
| `Kant`: operation log and confirm target limit needed contract coverage. | accepted | Added operation log alignment and target limit guard/tests. |
| `Turing`: confirm failure appeared inside save-success status. | accepted | Added separate destructive confirm-failed state. |
| `Turing`: duplicate primary actions after save could confuse operator. | accepted | Kept confirm as primary and made re-export outline. |
| `Boyle`: recovery JSON accepted disallowed payload fields. | accepted | Tightened schema and added RTL rejection coverage. |
| `Ampere`: stale `TSV` wording remained after `.txt` switch. | accepted | Replaced operator-facing wording with `PLUファイル`. |
| `Ampere`: over-limit RTL mocked an unreachable success path. | accepted | Changed test to actual prepare validation failure path. |

## Issues Caught by External Review

- Windows native L3 found UI-08 spacing inconsistent with other business screens and save-confirm action too low on the page.
- Field gate showed CV17 1.1.1 rejected legacy 10-column `.tsv`, memory 1 start, and product_code fallback.
- Owner clarified SR-S4000 PLU total memory is shared by normal PLU and scanning PLU.
- Owner confirmed JAN8 is obsolete for this PLU path and JANなし product handling should become a separate PR.

## Escaped / Late Findings

- JANなし商品のPLU対象扱い escaped the initial UI-08 design and was found through native DB prepare failure. It is recorded as a Post-UI-08 follow-up rather than expanding PR #122.
- Latest app-generated `.txt` full real-device confirmation is deferred. It remains a known residual follow-up with sanitized evidence requirements.

## Test Adequacy

Strong tests:
- BIZ lifecycle and validation tests are specific enough to catch accidental prepare mutation, broad confirm updates, invalid rollback, and EAN13 regressions.
- Formatter tests pin the CV17 1.1.1 profile without using real store data.
- RTL recovery tests cover storage safety and restored exact target confirmation.

Weak or missing tests:
- CV17 import, SD-card write, SR-S4000 read-in, and register spot-check cannot be automated in repo.
- Native save dialog behavior still depends on Windows native L3 and Tauri plugin behavior.
- JANなし product policy is not designed yet; tests should be added with that follow-up.

Mutation-style observations:
- If formatter returns to 10 columns or `.tsv`, formatter tests fail.
- If `product_code` fallback returns, invalid JAN tests fail.
- If recovery stores bytes/product details, RTL schema rejection fails.
- If seed returns JAN8, seed integration test fails.

## Signal / Noise

- sub-agent findings total: 8 grouped findings
- accepted: 8
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: Draft PR + repeated review-only passes caught real data safety, UI, and adapter-profile issues before merge.
- excessive friction: real-device gate blocked progress after procedure/profile evidence was already strong.
- confusing steps: field evidence, app-generated-file evidence, and app-side confirmation evidence needed clearer labels earlier.

## Recommended Workflow Adjustment

Keep:
- Draft PR until Windows native L3 and manual external-tool evidence are either completed or explicitly accepted/deferred by owner.
- Impact Review Lenses for POS/PLU/register work.
- Separate app-side confirmation from external-device proof in docs and UI wording.

Change:
- For external-file features, record structure-only acceptance criteria early: column count, encoding, line ending, row count bounds, memory range, and sanitized evidence shape.
- When real-device confirmation repeatedly blocks progress, require a named owner decision that either keeps it as gate or moves it to follow-up with pickup instructions.

Follow-up:
- Post-UI-08 latest app-generated PLU real-device confirmation.
- Post-UI-08 JANなし商品 PLU対象扱い Design Phase.

## Applied / Deferred Workflow Changes

Applied:
- No workflow template change. The decision was captured in `docs/project-memory.md`, `Plans.md`, PR body, and this WER.

Deferred:
- Consider adding an explicit "structural equivalence accepted by owner" checkbox to future external-file Plan Packets if this pattern repeats.

Not applied:
- No E2E or device automation requirement added; CV17/SR-S4000 remains manual/external by design.
