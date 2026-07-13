# Workflow Effectiveness Review: UI-04 手動販売出庫 implementation

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-26-ui04-manual-sale-implementation.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-26-ui04-manual-sale-implementation.md`
- review-only sub-agent: 実施。L3 stale row-error 修正後に follow-up review-only pass も実施。
- external review: なし
- human approval: PR #104 merge 承認、Windows native L3 owner confirmation
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
  - `cargo run --bin generate_traceability -- --check`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `bash scripts/doc-consistency-check.sh`
  - `bash scripts/check-env-safety.sh`
  - pre-push hook
  - GitHub Actions CI: Rust / Frontend / Design doc consistency

## What Worked

Which workflow step caught or prevented a real issue?

- Design Phase kept UI-04 behavior in `62-ui-manual-sale.md` before implementation: generated command only, scan-like add, duplicate merge, PLU confirmation, idempotency, result links, cache invalidation, and daily sales `手動` Badge L3 scope.
- Test Design Matrix made PLU confirmation and pending lock automated evidence instead of depending on fast manual timing.
- Initial review-only sub-agent caught a real P2: `商品登録へ進む` recovery link was still available while saving. This was fixed before merge.
- Windows native L3 caught a real stale validation issue that automated tests did not originally cover: invalid row error remained after deleting the row and re-adding the same product.
- Follow-up review-only sub-agent caught the first stale-error fix being too broad: unchanged row errors must remain visible. The fix was narrowed and regression tests were added for UI-04 and UI-02.

## What Did Not Work

Which step was overhead, noisy, unclear, or too heavy?

- PLU登録済み商品の実DB目視確認手順が不足していた。local DB に対象商品を用意できず、owner L3 では PLU confirmation path を確認できなかった。
- Initial tests covered validation and row merge, but not delete/re-add after validation error. Row-form validation lifecycle needs to be an explicit review/test point.

## Issues Caught Before Implementation

- UI-04 kept product registration out of the manual sale screen; the 0件 path is a recovery link to UI-01b, not inline master mutation.
- PLU confirmation was designed as non-commit state: `needs_confirmation=true` does not show a saved result or invalidate caches until confirmation succeeds.
- The command path was limited to generated `commands.createManualSale`; ad hoc invoke was rejected.

## Issues Caught by Tests

- 1件 search adds the product and returns focus.
- Broad search requires explicit `手動販売に追加`; it does not auto-add the first candidate.
- Same product code merges into one row and increments quantity / amount.
- Quantity `0` / decimal and negative amount are blocked with Japanese errors before command invocation.
- PLU confirmation resubmits the same idempotency key and confirmation token.
- Editing after confirmation clears the stale token.
- Pending save disables return, reset, inputs, product add, and recovery link.
- Save success shows sale id, item count, PLU warning count, stock warning count, and follow-up links.
- Cache invalidation covers inventory and sales queries without invalidating PLU dirty state.
- Stale row errors are cleared only for changed/deleted rows; unchanged row errors remain visible.

## Issues Caught by Review-only Subagent

| Finding | Classification | Result |
|---|---|---|
| 保存 pending 中も `商品登録へ進む` recovery link が使える | accepted | `isFormLocked` 中は link を非表示にし、pending-state test を拡張 |
| `SCREEN_DESIGN.md` の UI-04 status が stale | accepted | implementation-in-progress に同期 |
| stale row-error cleanup が全 row error を消してしまう | accepted | changed/deleted rows だけを消し、unchanged row error を保持する実装と tests を追加 |

## Issues Caught by External Review

- なし。

## Escaped / Late Findings

What reached a later stage and should have been caught earlier?

- Stale row validation error reached Windows native L3. The defect was not data-destructive, but operator confusionにつながるため、row-form UI では追加 / 編集 / 削除 / 再追加後の error lifecycle を実装レビュー観点に入れる必要がある。
- PLU登録済み商品の実DB目視確認は最後まで未実施。BIZ tests と RTL PLU confirmation flow で受容したが、特殊な backend state が必要な L3 は事前に seed / fixture / 作成手順を用意するべきだった。

## Test Adequacy

Strong tests:
- `ManualSalePage.test.tsx` covers product search 0/1/multiple, focus return, duplicate merge, validation, pending lock, PLU confirmation, idempotency, result links, cache invalidation, and stale row-error lifecycle.
- `manual-sale-request.test.ts` and `manual-sale-row-utils.test.ts` isolate request validation and row merge behavior.
- Same-pattern UI-02 stale row-error regression was added to `ReceivingPage.test.tsx`.

Weak or missing tests:
- Real local DB PLU-registered manual confirmation remains unverified manually.
- Native keyboard scanner timing and WebView focus feel still require Windows native L3.

Mutation-style observations:
- If `needs_confirmation=true` is treated as success, the PLU confirmation RTL test fails.
- If pending lock omits the recovery link, the pending-state RTL test fails.
- If stale row-error cleanup clears all errors, the unchanged row error regression test fails.
- If stale row-error cleanup clears nothing on delete/re-add, the delete/re-add regression test fails.

## Signal / Noise

- sub-agent findings total: 3
- accepted: 3
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: R3 Plan Packet / Test Matrix / review-only sub-agent were justified. The follow-up review-only pass caught a subtle regression in the first stale-error fix.
- excessive friction: none severe.
- confusing steps: PLU登録済み L3 setup was underspecified.

## Recommended Workflow Adjustment

Keep:
- R3 Plan Packet / Test Matrix / review-only sub-agent default for new operator-facing screens with command wire changes.
- Windows native L3 for new Tauri operator screens.
- RTL tests for pending lock, idempotency, and confirmation states that are hard to verify manually.

Change:
- L3 checklists that require special backend state must include a concrete synthetic setup path, or explicitly say automated evidence is accepted.
- Row-form implementations should test validation error lifecycle across add / edit / delete / re-add, especially when errors are keyed by product code or row id.

Follow-up:
- Next inventory movement UI should reuse UI-02/UI-04 row-form regression patterns.
- Post UI-04, run `tooling/npm-thaw-assessment` and `workflow/parallelization-map` before starting multiple feature PRs in parallel.

## Applied / Deferred Workflow Changes

Applied:
- Added a row-form stale validation error checklist item to `docs/quality/review-checklist.md`.
- Added UI-04 and UI-02 regression tests for stale row-error cleanup.
- Recorded PLU registered path as automated evidence accepted, not a completed native L3 check.

Deferred:
- No new seed fixture for PLU-registered products in this PR. Add it when a future L3 requires this backend state again.
- No E2E / visual regression addition. Component tests and Windows native L3 covered the material UI risk for this PR.

Not applied:
- No workflow gate change. The issue was better addressed by checklist and focused tests than by adding a new global gate.
