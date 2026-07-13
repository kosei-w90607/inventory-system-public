# Workflow Effectiveness Review: UI-03 返品・交換 implementation

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-26-ui03-implementation.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-26-ui03-implementation.md`
- review-only sub-agent: 実施。initial implementation review と retry follow-up review を実施。
- external review: なし
- human approval: PR #107 merge 承認、Windows native L3 owner confirmation
- gates:
  - `cargo run --bin generate_bindings`
  - `npm run generate:routes`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm test -- src/features/return-exchange`
  - `npm test`
  - `npm run build`
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
  - `cargo run --bin generate_traceability -- --check`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `bash scripts/doc-consistency-check.sh`
  - pre-push hook
  - GitHub Actions CI: Rust / Frontend / Design doc consistency

## What Worked

- Design Phase made the key double-counting boundary explicit before implementation: `register_processed=true` records only and CSV import later reflects stock; `false` updates stock in this save.
- Test Design Matrix correctly identified retry/idempotency/image-save behavior as high risk and led to focused RTL tests.
- Review-only sub-agent caught real issues before merge: semantic validation before idempotency replay, same product as return-in and exchange-out, receipt preview/delete, image-save ordering, key rotation, and return-mode out controls.
- Windows native L3 caught operator-facing issues that automated tests did not judge well: receipt image picker affordance, file input name after delete, duplicate scrollbars, and register status readability.

## What Did Not Work

- `レジ戻し状況` wording was technically present but not readable enough in the first L3 pass. The initial inline radio + standalone Badge made the inventory effect feel detached from the selected option.
- Retry L3 could not be manually forced through normal operation. The workflow handled this by recording review-only plus RTL retry tests as accepted evidence, but the L3 checklist should flag non-user-triggerable failure paths earlier.

## Issues Caught Before Implementation

- `createReturn`, `listReturns`, and `saveReceiptImage` had to be generated bindings; ad hoc invoke was kept out.
- `return` vs `exchange` semantics were kept in both UI validation and BIZ final validation.
- Receipt image save was designed as a separate command with retry path reuse, not a combined transaction.

## Issues Caught by Tests

- BIZ rejects return rows with `out` and exchange rows missing either side.
- Request builder validates date, rows, direction, and exchange cardinality before command invocation.
- Same product can exist as both `戻り` and `渡し` rows in exchange mode.
- Receipt image retry reuses saved path and rotates idempotency key after content/image/note changes.
- `register_processed=false` invalidates stock/product queries; `true` invalidates returns only.
- Pending save hides recovery links and locks form controls.

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| idempotency replay ran before final semantic validation | accepted | BIZ validation moved before replay and regression test added |
| same product could not be added as both `in` and `out` through normal UI | accepted | add direction control and row direction merge behavior added |
| receipt image state lacked preview/delete/drop affordance | accepted | preview, drop zone, delete button, and tests added |
| invalid form saved receipt image before request validation | accepted | request validation now runs before image save |
| failed no-image submit followed by image change did not rotate key | accepted | image add/change/delete now rotates key after failed attempt |
| return mode still exposed `out` controls | accepted | return rows are fixed to `in` and exchange-to-return normalizes rows |
| pending save left product registration recovery link reachable | accepted | `isFormLocked` hides the recovery link |
| retry tests did not assert same-content key reuse | accepted | equality and edit-rotation assertions added |

## Issues Caught by External Review

- なし。

## Escaped / Late Findings

- Duplicate outer/main scrollbars escaped to Windows native L3. Comparing with existing screens earlier would have narrowed the cause faster to app shell overflow.
- Register status readability escaped after the first wording fix. The lesson is that status explanations tied to a selected option should be visually colocated with that option, not placed as a separate trailing Badge.
- Tauri npm/Rust minor mismatch appeared during native dev startup and was fixed by dependency alignment. This was a tooling consistency issue, not UI-03 logic.

## Test Adequacy

Strong tests:
- Rust BIZ tests cover final semantic validation and idempotency replay ordering.
- RTL tests cover high-risk UI flow: row direction handling, receipt image deletion, retry key reuse/rotation, pending lock, result copy, and cache invalidation.
- Pure helper tests isolate request building, receipt extension handling, and row merge behavior.

Weak or missing tests:
- Browser/native visual issues such as duplicate scrollbars and poor visual grouping still require Windows native L3.
- Command failure retry remains hard to manually trigger through normal UI and depends on mock-based RTL plus review-only inspection.

Mutation-style observations:
- If image save runs before request validation, the validation-before-save RTL test fails.
- If same-content retry changes idempotency key, retry key equality test fails.
- If register status text is removed or not toggleable, the page test fails.

## Signal / Noise

- sub-agent findings total: 8
- accepted: 8
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: R3 Plan Packet / Test Matrix / review-only sub-agent were justified. The review-only passes caught several data integrity and retry bugs before merge.
- excessive friction: retry L3 had no natural manual failure trigger, so purely manual checklist execution stalled.
- confusing steps: register-processed copy needed multiple L3 iterations because the first fix addressed wording but not grouping/readability.

## Recommended Workflow Adjustment

Keep:
- R3 workflow for new operator-facing screens with generated commands and inventory effects.
- Review-only sub-agent for retry/idempotency/data-integrity logic.
- Windows native L3 for layout, file picker affordance, and operator readability.

Change:
- L3 checklist should mark non-user-triggerable failure paths as automated-evidence candidates up front.
- For selected business status controls, put the state label and consequence text inside each option when the consequence prevents double-counting or data mistakes.
- When a new screen shows duplicate scrollbars, compare with an existing same-shell screen before local CSS edits.

Follow-up:
- Post UI-03, clean up existing warning noise from `npm run build` and traceability so future verification output is quieter.
- Next feature lane remains UI-05 廃棄・破損, then UI-08 PLU書出し unless the owner changes the order.

## Applied / Deferred Workflow Changes

Applied:
- Recorded hard-to-manually-trigger retry evidence in the UI-03 plan.
- Post-merge cleanup removes known build / traceability warning noise.

Deferred:
- No new global L3 template change in this PR. Reuse the lesson in the next operator screen checklist.

Not applied:
- No E2E / visual regression gate added. RTL + Windows native L3 covered the material UI-03 risk.
