# UI-03 返品・交換 Implementation Plan

## Risk

Risk: R3

Reason:
UI-03 は新規 operator-facing screen で、BIZ-02 validation、CMD-03 / CMD-11 generated binding、route/navigation、商品検索、画像保存、query invalidation、Windows native L3 に関わる。

## Goal

REQ-202 / UI-03 返品・交換を `/inventory/return` に実装し、返品・交換記録、任意のレシート画像、レジ戻し済み分岐、最近の返品一覧を generated commands 経由で操作できるようにする。

## Scope

- BIZ-02 `create_return` に `return => inのみ`、`exchange => in/out両方必須` validation を追加する。
- CMD-03 `create_return` / `list_returns`、CMD-11 `save_receipt_image` を tauri-specta generated binding に出す。
- `/inventory/return` route と navigation active を追加する。
- `src/features/return-exchange/` に page、request builder、row utils、receipt image helper、tests を追加する。
- query keys に `returns.root()` / `returns.recent()` を追加する。
- implementation result と review response を本 plan に追記する。

## Non-scope

- return detail/edit/cancel。
- 保存済み画像の再表示 / 削除 / orphan cleanup。
- native dialog + filesystem plugin。
- image resize/compression。
- inline 商品登録。
- global barcode detection。
- cm / m 表示切替。

## Acceptance Criteria

- BIZ-02 `create_return` rejects `return` with `out` rows and one-sided `exchange` before DB insert / stock change.
- `src/lib/bindings.ts` contains generated `createReturn` / `listReturns` / `saveReceiptImage` and related DTOs.
- `/inventory/return` route renders `ReturnExchangePage` and navigation UI-03 is active.
- UI-03 can search/add products, validate return/exchange rows, save optional receipt images before `createReturn`, reuse saved image path on retry, show result, and list recent returns.
- `register_processed=false` invalidates returns + stock/product keys; `register_processed=true` invalidates returns only.
- TDD evidence exists for Rust BIZ negatives, frontend helper tests, and page behavior tests.
- `cargo test` / `npm test` / `npm run typecheck` / `npm run lint` / `npm run build` / docs checks pass, or any unavailable gate is explicitly documented.

## Test Plan

See `docs/plans/test-matrices/2026-06-26-ui03-implementation.md`.

TDD order:

1. Rust BIZ negative tests: return with out row, exchange missing in/out.
2. Generated binding compile checks after adding `specta::Type` / `#[specta::specta]`.
3. Frontend pure tests: row utils, request builder, receipt image helper.
4. Frontend component tests: product add, validation, image retry, result/recent list, invalidation.

## Implementation Steps

1. RED: add BIZ negative tests and verify they fail.
2. GREEN: add BIZ validation.
3. Add specta derives/command annotations and generated command registration; regenerate `src/lib/bindings.ts`.
4. RED/GREEN frontend helpers and page tests.
5. Add route/navigation/query keys/page.
6. Run targeted tests and gates.
7. Run review-only sub-agent with fresh context before finalizing.

## Verification Gates

- `cd src-tauri && cargo test`
- `cd src-tauri && cargo run --bin generate_bindings`
- `npm run typecheck`
- `npm run lint`
- `npm test -- src/features/return-exchange`
- `npm test`
- `npm run build`
- `bash scripts/doc-consistency-check.sh --target plan`
- `bash scripts/doc-consistency-check.sh`

## Review Focus

- Is BIZ-02 the final boundary for return/exchange semantic validation?
- Are generated bindings complete without reintroducing ad hoc invoke?
- Does image save retry avoid duplicate image writes after `createReturn` failure?
- Is `register_processed` wording and invalidation precise enough to avoid double counting?
- Does UI-03 stay within `UI -> CMD -> BIZ -> IO/MNT` boundaries?
- Are tests sufficient for the highest-risk failure modes?

## Spec Contract

Contract ID: SPEC-UI-03-IMPLEMENTATION-2026-06-26

- REQ-202 returns use generated `commands.createReturn` and `commands.listReturns`.
- Optional receipt image uses generated `commands.saveReceiptImage` before `createReturn`.
- `return_type="return"` accepts only `direction="in"` rows.
- `return_type="exchange"` requires at least one `direction="in"` row and one `direction="out"` row.
- `register_processed=true` records only; `register_processed=false` updates stock through BIZ.
- The UI preserves the same idempotency key for same-content retry and rotates it after edit/image/note changes.
- Initial scanner support is focused product field + Enter.

## Trace Matrix

| Spec ID | Implementation Step | Test | Evidence |
|---|---|---|---|
| UI-03-D2 | generated commands | `cargo run --bin generate_bindings`, `npm run typecheck` | `src/lib/bindings.ts` |
| UI-03-D5 | image retry | `ReturnExchangePage.test.tsx: retry after create failure reuses saved receipt path` | `ReturnExchangePage.tsx` |
| UI-03-D6 | return semantic validation | `test_create_return_req202_rejects_return_with_out_direction`, page/request tests | `returns.rs`, request builder |
| UI-03-D7 | exchange semantic validation | `test_create_return_req202_rejects_exchange_missing_in_or_out`, request tests | `returns.rs`, request builder |
| UI-03-D8 | register processed wording | page test + L3 | `ReturnExchangePage.tsx` |
| UI-03-D11 | row key by direction | `return-exchange-row-utils.test.ts` | row utils |
| UI-03-D17 | cache invalidation | `ReturnExchangePage.test.tsx: successful submit invalidates...` | mutation success handler |

## Data Safety

Tests use synthetic products and tiny synthetic image data only. Do not commit real receipt images, app data, local DB, logs, backups, POS CSV, PLU export, `.env*`, credentials, or auth files.

## Implementation Results

- Added BIZ-02 final validation for `return_type` / row direction cardinality:
  - `return` rejects `out` rows.
  - `exchange` requires at least one `in` row and one `out` row.
  - DB-independent semantic validation now runs before idempotency replay.
- Exposed generated commands/types for UI-03:
  - `createReturn`, `listReturns`, `saveReceiptImage`
  - `ReturnCreateRequest`, `ReturnCreateResult`, `ReturnItemInput`, `ReturnRecordSummary`, `SaveImageRequest`, `SaveImageResponse`
- Added `/inventory/return` route, navigation active mapping, `returns` query keys, and `src/features/return-exchange/`.
- Implemented product search/add, duplicate row quantity increment, direction collision merge, return/exchange client validation, optional receipt image preview/drop/delete, saved-image retry reuse, idempotency key rotation after content/image changes, success result, and recent returns list.
- Verified `register_processed=true` invalidates only returns; `register_processed=false` invalidates returns + product/stock keys.
- Windows native L3 is still pending in this environment and must be completed before merge.

Verification run:

- `cd src-tauri && cargo test` — passed, 563 lib tests + 13 traceability tests + integration/seed/doc-test suite.
- `cd src-tauri && cargo run --bin generate_bindings` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- src/features/return-exchange` — passed, 16 tests.
- `npm test` — passed, 70 files / 436 tests.
- `npm run format:check` — passed.
- `cd src-tauri && cargo fmt --check` — passed.
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` — passed.
- `npm run build` — passed with the existing Vite chunk-size warning.
- `bash scripts/doc-consistency-check.sh` — passed.

## Review Response

Review-only sub-agent pass:

- P2: idempotency replay ran before final return/exchange semantic validation. Accepted. Added a regression test with a preexisting invalid replay row and moved DB-independent BIZ validation before replay.
- P2: UI could not add the same product as both `in` and `out` through the normal add flow. Accepted. Added `追加方向`, candidate/single-result add support, and row direction collision merge.
- P3: receipt image state stored `previewUrl` but did not render preview/delete/drop affordances. Accepted. Added preview thumbnail, drop handling, and `レシート画像を削除`; added retry/idempotency regression coverage.

Follow-up review-only pass:

- P2: invalid form saved receipt images before `createReturn` request validation. Accepted. The submit mutation now builds/validates the `createReturn` request before `saveReceiptImage`; invalid forms do not create orphan receipt images.
- P2: adding/changing receipt images after a failed no-image submit did not rotate the idempotency key. Accepted. Receipt add/change/delete after a failed attempt now rotates the key, while same-content retry with an already saved receipt path still reuses the path.
- P3: `return_type="return"` still exposed `out` direction controls. Accepted. Return rows are fixed to `in`; switching back from exchange to return normalizes existing `out` rows to `in`.
- Final follow-up review found P1/P2 none and confirmed the previous P2/P3 items were resolved.

Windows native L3 feedback:

- Steps 1〜3 passed: launch/navigation, return mode fixed to `in`, and exchange mode same-product `in`/`out` rows.
- Step 4 found that removing an image cleared app state but left the file input name visible. Accepted/fixed by clearing the file input DOM value on remove/reset/invalid selection.
- Step 4 also found the native file picker control visually weak. Accepted/fixed by replacing the visible native file input with a clickable/drop target while preserving the accessible file input.
- Steps 5〜6 passed: save flow covers `register_processed=true/false`, result copy, recent list, and validation rejects one-sided exchange without adding a recent record.
- Step 7 retry was not manually verified in Windows native because validation blocks invalid requests and command failure is not user-triggerable through normal operation. Following the same evidence pattern as prior pending-state / hard-to-reproduce L3 items, a fresh review-only sub-agent pass plus RTL retry tests are accepted as the verification evidence for D5/D13/D14 retry/idempotency/image-save logic.
- Step 7 review accepted/fixed:
  - P2: the `商品登録へ進む` recovery link stayed reachable during save pending. Fixed by hiding it while `isFormLocked`.
  - P3: retry tests did not explicitly assert same-content `idempotency_key` reuse. Fixed by asserting key equality on retry and key rotation after note edit.
- Windows native rerun evidence after dependency alignment:
  - User ran `git pull --ff-only`, `npm install`, `npm run generate:routes`, `npm run typecheck`, and `npm run tauri dev`.
  - The previous Tauri npm/Rust minor version mismatch warning disappeared after `npm install` and Rust crates updated to Tauri 2.11.x.
  - A subsequent Windows native screenshot still showed two outer/right scrollbars plus a bottom scrollbar, so the initial RootLayout-only overflow fix was insufficient.
  - Follow-up fix constrains the desktop app shell with `html, body, #root { height: 100%; overflow: hidden; }` and keeps scrolling inside RootLayout `main`.
- Register status readability follow-up:
  - User confirmed the duplicate scrollbar fix, then reported `レジ戻し状況` was hard to read, especially the standalone `この保存で在庫を反映` badge.
  - Accepted. The control now uses two selectable option panels so each choice carries its own Badge and explanatory text: `CSV取込みで反映` / `この保存で反映`.
