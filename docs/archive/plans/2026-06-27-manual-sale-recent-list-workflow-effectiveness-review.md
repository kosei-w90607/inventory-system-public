# Workflow Effectiveness Review: 手動販売出庫 recent list follow-up

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-27-manual-sale-recent-list.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-27-manual-sale-recent-list.md`
- review-only sub-agent: `Ohm`, `Chandrasekhar`
- external review: none
- human approval: Windows native L3 owner confirmation, including page-top scroll recheck
- gates: frontend targeted tests, full frontend gates, docs checks, traceability check, GitHub CI

## What Worked

- Source docs were updated before and during implementation, so UI-04 recent list behavior did not live only in the Plan Packet.
- Draft PR checkpoint worked well. The PR stayed Draft while Windows native L3 found the page-top visibility issue, and the fix stayed in the same PR.
- Windows native L3 caught an operator-visible problem that CI would not catch: bottom save actions left top result panels out of view.
- Review-only sub-agent `Chandrasekhar` caught that the first page-top scroll tests covered success paths but not command failure, PLU confirmation, or validation no-scroll behavior.

## What Did Not Work

- The first manual test checklist included a `すべての履歴を見る` expectation before confirming it existed in all adjacent UI flows. The implementation was correct after correction, but the checklist wording briefly sent the owner looking for a missing control.
- The initial page-top scroll test design was too optimistic. It encoded happy-path visibility but missed the failure and confirmation branches that the source docs also specified.

## Issues Caught Before Implementation

- UI-04 recent list should reuse `listInventoryRecords(record_type="manual_sale")` instead of adding a dedicated command.
- Manual-sale creation screen should not become a search/edit/cancel hub; the recent list is save-confirmation only and links to `/inventory/records`.

## Issues Caught by Tests

- Recent list query filters to `record_type="manual_sale"`.
- `すべての履歴を見る` links to `/inventory/records?recordType=manual_sale`.
- `詳細を見る` links to `/inventory/manual-sale/records/{id}`.
- Recent list empty/error states do not block the input form.
- Save success invalidates `queryKeys.inventoryRecords.root()`.
- Page-top scroll happens for save success, command failure, and PLU confirmation; representative frontend validation cases do not force top scroll.

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| `Ohm`: Plan Packet / dashboard still looked preparation-only after implementation and gates. | accepted | Updated implementation results, validation, review result, and L3 pending state. |
| `Chandrasekhar`: page-top scroll tests covered success only, despite source docs requiring command failure, PLU confirmation, and validation no-scroll behavior. | accepted | Added command-failure scroll assertions for UI-02/03/04/05, PLU confirmation scroll assertion for UI-04, and representative validation no-scroll assertions. |

## Issues Caught by External Review

- None.

## Escaped / Late Findings

- UI-03 返品・交換の備考 visibility issue escaped the original UI-03 PR and was found during this PR's Windows native L3. It is outside PR #116 scope and is recorded as a follow-up in `docs/function-design/63-ui-return-exchange.md` and `Plans.md`.

## Test Adequacy

Strong tests:
- Manual-sale recent list query and route assertions are specific enough to catch wrong record type and wrong destination routes.
- Page-top scroll helper tests cover the RootLayout `main` scroll container instead of assuming `window.scrollTo`.
- Mutation tests now cover success, command failure, PLU confirmation, and representative validation no-scroll behavior.

Weak or missing tests:
- Real smooth-scroll visibility remains Windows native L3 only.
- TanStack Router click behavior is still represented by mocked `Link`; full native route behavior is covered by L3 rather than browser E2E.

Mutation-style observations:
- If `record_type` changes to `null`, recent query assertion fails.
- If detail links point to the creation page, href assertion fails.
- If `scrollPageToTop` is removed from command failure paths, command-failure assertions fail.
- If frontend validation starts scrolling to top, no-scroll assertions fail.

## Signal / Noise

- sub-agent findings total: 2
- accepted: 2
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: Draft PR + L3 + review-only caught real operator-facing and test-depth issues before merge.
- excessive friction: none significant for R3.
- confusing steps: manual checklist generation should be more tightly derived from source docs and current UI, not adjacent-flow assumptions.

## Recommended Workflow Adjustment

Keep:
- Draft PR until Windows native L3 is complete.
- Review-only after L3 feedback when code/tests materially change.
- Recording L3 feedback as source-doc behavior or explicit follow-up before merge.

Change:
- When generating manual test steps, verify each named control exists in the source docs or current UI before presenting it.
- For behavior added after L3 feedback, update the Test Matrix for every branch named in the source docs before declaring gates complete.

Follow-up:
- UI-03 備考 visibility follow-up should run through Design Phase because it changes operator-facing readability and form/detail presentation.

## Applied / Deferred Workflow Changes

Applied:
- No workflow template changes. Existing Design Phase guidance already says to compare adjacent specs and record mitigations in source docs; this PR followed that after the issue was identified.

Deferred:
- No new automated workflow gate. The issue was checklist discipline and test design depth, not missing infrastructure.

Not applied:
- No E2E/visual regression requirement added. Real visibility remains better covered by Windows native L3 at the current project stage.
