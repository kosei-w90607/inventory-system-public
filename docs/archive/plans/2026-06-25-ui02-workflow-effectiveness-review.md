# Workflow Effectiveness Review: UI-02 入庫記録 implementation

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-25-ui02-implementation.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-25-ui02-implementation.md`
- review-only sub-agent: 実施
- external review: なし
- human approval: PR #103 merge 承認、Windows native L3 owner confirmation
- gates:
  - `cargo run --bin generate_bindings`
  - `npm run generate:routes`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm test`
  - `npm run build`
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `bash scripts/doc-consistency-check.sh`
  - pre-push traceability check
  - GitHub Actions CI: Rust / Frontend / Design doc consistency

## What Worked

Which workflow step caught or prevented a real issue?

- Design Readiness kept the UI-02 behavior in `61-ui-receiving.md` before implementation: 0/1/multiple product search, duplicate quantity increment, idempotency key lifecycle, recent list, and Windows native L3 scope were available as source design.
- Test Design Matrix correctly marked pending/error states as controlled automated tests. This mattered because "処理中に戻る導線が出ない" was too fast to verify reliably in native manual testing.
- review-only sub-agent caught two real P2 issues before merge: success state still allowed a second save with a new idempotency key, and candidate add buttons remained active during pending save.
- Owner Windows native L3 caught a wording/flow ambiguity: the 0件 search "商品登録へ進む" link needed a short explanation, and the future manual should explain the difference between product registration and receiving.

## What Did Not Work

Which step was overhead, noisy, unclear, or too heavy?

- The L3 phrase "commit 中" / processing state was ambiguous and hard to observe. For this screen, a pending-state RTL test is better evidence than manual timing.
- The first L3 checklist did not explicitly state the exact expected text for the 0件 search recovery path. The owner had to ask what the link meant.

## Issues Caught Before Implementation

- UI-02 Design Readiness avoided inline product registration and inline supplier registration in the receiving screen, keeping master mutations in UI-01b / future supplier design.
- The Plan Packet fixed cache invalidation scope up front: receiving, product list, low-stock, and stock inquiry are invalidated; PLU dirty is not.

## Issues Caught by Tests

- Duplicate product add increments the existing row quantity instead of adding a second row.
- Quantity and cost validation reject invalid values before command invocation.
- Same-content retry reuses the idempotency key; edit-after-failure, reset, and success create a new key.
- Pending state hides the header return action and disables form/candidate actions.
- Save success displays result evidence and invalidates the intended query keys.

## Issues Caught by Review-only Subagent

| Finding | Classification | Result |
|---|---|---|
| 保存成功後も同じ内容を再保存でき、二重入庫になり得る | accepted | `result !== null` をフォームロック条件に含め、成功後は「続けて入庫」だけに限定 |
| pending 中も複数候補の「入庫に追加」を押せる | accepted | 候補ボタンと search/add handlers に `isFormLocked` guard を追加 |
| 既存明細がある状態で商品登録へ進む未保存警告がない | accepted | 未保存警告を追加 |
| idempotency key lifecycle の component coverage が薄い | accepted | same-content retry / edited retry / success no-resubmit tests を追加 |

## Issues Caught by External Review

- なし。

## Escaped / Late Findings

What reached a later stage and should have been caught earlier?

- 0件 search の商品登録導線は、実装としては動いていたが、リンクの意味が owner L3 まで分かりにくかった。operator-facing recovery link は実装時に「なぜその導線なのか」を短く添える観点で確認する。
- 商品登録と入庫記録の役割差は、UI-02 側だけでなく UI-01b / manual 作成時の説明にも必要だった。`51-ui-product-form.md` に説明書作成時の注意として反映済み。

## Test Adequacy

Strong tests:
- `ReceivingPage.test.tsx` covers 0/1/multiple product search, focus return, duplicate quantity increment, pending lock, success result, recent list, invalidation, and idempotency lifecycle.
- `receiving-request.test.ts` and `receiving-row-utils.test.ts` isolate validation, request build, and row merge behavior.

Weak or missing tests:
- Native IME / focus feel and route navigation still require Windows native L3.
- Exact operator comprehension of recovery copy is not automated; L3 remains appropriate for wording clarity.

Mutation-style observations:
- If the header return link is always rendered during pending, the pending-state RTL test fails.
- If success state unlocks save again, the success no-resubmit RTL test fails.
- If duplicate search appends a new row, the row utils and page tests fail.

## Signal / Noise

- sub-agent findings total: 4
- accepted: 4
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: R3 Plan Packet / Test Matrix / review-only sub-agent were justified. The sub-agent found double-save and pending-action issues that were real behavioral risks.
- excessive friction: none severe.
- confusing steps: native L3 should separate manually observable states from controlled automated states. The owner should not need to chase a sub-second pending UI.

## Recommended Workflow Adjustment

Keep:
- R3 Plan Packet / Test Matrix / review-only sub-agent default for new operator-facing screens with command wire changes.
- Windows native L3 for new Tauri operator screens.
- Controlled RTL pending-state tests for states too fast to verify manually.

Change:
- L3 checklists should label fast transient states as "automated evidence" when manual observation is not expected.
- Recovery links such as "商品登録へ進む" should include a concise explanation or be captured for manual text, especially when the destination has a different business purpose.

Follow-up:
- Next入出庫 UI should reuse the UI-02 evidence pattern: owner L3 for route/focus/wording, RTL for pending lock and double-submit prevention.

## Applied / Deferred Workflow Changes

Applied:
- Plan Packet records that pending-state return hiding was accepted based on RTL and implementation lock condition, not native visual timing.
- `51-ui-product-form.md` records that future manuals should explain product registration versus receiving.

Deferred:
- No new workflow automation. Current evidence supports better L3 wording, not a new machine gate.

Not applied:
- No E2E / WebDriver addition for this PR. The relevant transient behavior is already covered by component tests, and native L3 covered the human-visible flow.
