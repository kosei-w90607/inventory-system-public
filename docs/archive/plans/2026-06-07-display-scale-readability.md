# Display Scale and Product Code Readability

## Risk

Risk: R3

Reason:
Operator-facing UI readability is a functional concern for the daily 5-screen workflow. This change adds cross-screen WebView zoom state, Tauri capability, browser-state persistence, and Windows native L3 verification.

## Goal

Address H-6 feedback that product codes are small by improving product-code readability directly and adding a global display-size option for the whole application.

## Scope

- Add a 3-step display-size option: `standard` / `large` / `extra_large`.
- Persist display-size choice in frontend `localStorage` under `inventory.displayScale.v1`.
- Apply display-size choice through Tauri WebView zoom.
- Add a visible control in the sidebar footer.
- Keep the display-size control reachable after switching to an enlarged WebView zoom.
- Increase product-code readability in stock inquiry and daily sales tables.
- Fix Windows native L3 feedback in stock inquiry: after selecting one department, the department Select must still allow switching directly to other departments.
- Document E2E / visual regression reevaluation for this global display-scale timing.

## Non-scope

- No new settings screen.
- No `app_settings` DB key or CMD-11 contract change.
- No new npm dependency.
- No Playwright / screenshot-diff implementation in this PR.
- No selection-tone follow-up.

## Acceptance Criteria

- `src-tauri/capabilities/default.json` includes `core:webview:allow-set-webview-zoom`.
- Sidebar shows `表示サイズ` with `標準`, `大きめ`, `特大` options.
- Sidebar navigation remains shrinkable/scrollable so `表示サイズ` can still be reached after selecting `大きめ` or `特大`.
- Changing display size writes `inventory.displayScale.v1` and calls `setZoom` with `1`, `1.15`, or `1.3`.
- Invalid stored display-size values fall back to `standard` without crashing.
- Tauri zoom failure is covered by `UI-12: WebView zoom failure is non-fatal` and does not break rendering.
- Product code cells in `ProductListTable`, the stock detail header, and daily `ProductTable` no longer use `text-xs`.
- Stock inquiry DepartmentFilter keeps other department options available after selecting an individual department, covered by `useStockInquiry.test.tsx`.
- `npm test -- src/components/layout/Sidebar.test.tsx src/components/layout/useDisplayScale.test.tsx src/features/stock-inquiry/hooks/useStockInquiry.test.tsx src/features/stock-inquiry/components/ProductListTable.test.tsx src/features/daily-sales/components/ProductTable.test.tsx` passes.
- `bash scripts/doc-consistency-check.sh --target plan` exits 0.

## Test Plan

Test Design Matrix: [test-matrices/2026-06-07-display-scale-readability.md](test-matrices/2026-06-07-display-scale-readability.md)

- targeted tests: display-scale hook localStorage / WebView zoom tests, Sidebar scroll reachability test, stock inquiry department-option recovery test, product-code class regression tests.
- negative tests: invalid storage token, rejected `setZoom`.
- compatibility checks: no Tauri command DTO, generated binding, DB schema, or package dependency change.
- data safety checks: no POS CSV, DB file, backup, log, receipt image, or secret access.
- main wiring/integration checks: sidebar imports `DisplayScaleControl`; default capability allows WebView zoom.

## Boundary / Wire Contract

- producer: `DisplayScaleControl` / `useDisplayScale`
- consumer: Tauri WebView `setZoom(scaleFactor)`
- wire type: localStorage string token `standard | large | extra_large`; WebView zoom number `1 | 1.15 | 1.3`
- internal type: `DisplayScaleValue`
- precision/range: explicit fixed factors only; arbitrary numeric zoom is not accepted
- round-trip path: user Select -> React state -> localStorage -> WebView zoom; reload -> localStorage -> React state -> WebView zoom
- invalid input: unknown localStorage token normalizes to `standard`
- compatibility: no DB, CMD, generated binding, or URL-state compatibility impact

## Review Focus

- Whether localStorage fallback and Tauri zoom failure are non-fatal.
- Whether product-code readability is improved without turning the PR into a broader typography redesign.
- Whether UI-11 settings screen scope is correctly deferred.
- Whether E2E / visual regression reevaluation is recorded without adding a premature gate.

## Spec Contract

Contract ID: SPEC-UI-DISPLAY-SCALE-2026-06-07

- Display size has exactly three public choices: `標準`, `大きめ`, `特大`.
- The persisted token is frontend-local and may be migrated to UI-11 settings later.
- The implementation must not introduce threshold, stock-state, sales, or DB business rules.
- Product code readability is handled in stock inquiry and daily sales tables because those are the Phase 2 daily screens where product codes are visible.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-UI-DISPLAY-SCALE-2026-06-07 | Add display-scale hook | `useDisplayScale.test.tsx` | localStorage + zoom + failure path | `npm test -- src/components/layout/useDisplayScale.test.tsx` |
| SPEC-UI-DISPLAY-SCALE-2026-06-07 | Add sidebar control | `Sidebar.test.tsx` / review | discoverability, scroll reachability, and UI-12 wiring | `Sidebar.tsx` imports `DisplayScaleControl`; Sidebar root / ScrollArea use `min-h-0` |
| SPEC-UI-DISPLAY-SCALE-2026-06-07 | Improve product-code cells | `ProductListTable.test.tsx`, `ProductTable.test.tsx` | no `text-xs` regression | targeted Vitest |
| SPEC-UI-DISPLAY-SCALE-2026-06-07 | Fix UI-06a L3 filter feedback | `useStockInquiry.test.tsx` | department filter remains switchable after individual selection | dept-selected path runs department-options query without `dept` |
| SPEC-UI-DISPLAY-SCALE-2026-06-07 | Add WebView permission | review / build | Tauri capability matches schema | `core:webview:allow-set-webview-zoom` |
| SPEC-UI-DISPLAY-SCALE-2026-06-07 | Update source docs | doc check | settings scope deferred | `doc-consistency-check.sh --target plan` |

## Data Safety

- Do not read or commit real POS CSV, PLU exports, DB files, backups, logs, receipt images, secrets, credentials, or `.env*`.
- Browser persistence is limited to the non-sensitive display-size token.
- No generated output or local app data is committed.

## Implementation Results

In progress:

- Added `src/lib/display-scale.ts`, `useDisplayScale`, and `DisplayScaleControl`.
- Mounted `表示サイズ` in the Sidebar footer.
- Kept Sidebar navigation shrinkable/scrollable with `min-h-0` and kept `DisplayScaleControl` as `shrink-0`, so enlarged zoom can be reverted from the Sidebar.
- Kept stock inquiry department options switchable after selecting an individual department by adding a dept-unfiltered options query for the selected-dept path.
- Added `core:webview:allow-set-webview-zoom` to the default Tauri capability.
- Updated UI-06a stock inquiry and UI-09a daily sales product-code cells / detail header from smallest table text to normal readable table text.
- Updated source docs for UI shared layout, daily sales, stock inquiry, screen design, and UI tech stack.
- Review-only P2 accepted and fixed: `window.localStorage` getter failure now stays inside the non-fatal storage read/write paths, with hook coverage for `SecurityError`.
- Validation passed:
  - `npm test -- src/components/layout/Sidebar.test.tsx src/components/layout/useDisplayScale.test.tsx src/features/stock-inquiry/hooks/useStockInquiry.test.tsx src/features/stock-inquiry/components/ProductListTable.test.tsx src/features/daily-sales/components/ProductTable.test.tsx` (5 files / 26 tests after L3 feedback fixes)
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm test` (35 files / 242 tests)
  - `npm run build` (Vite chunk-size warning only)
  - `npm run tauri -- build --debug --no-bundle --ci` (Vite chunk-size warning only)
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `bash scripts/doc-consistency-check.sh` (known `per_page` WARN 1 only, no ERROR)

Remaining before PR judgment:

- none. Windows native L3 passed after L3 feedback fixes.

## Review Response

Review-only sub-agent: completed.

- P1: none
- P2: 1 accepted/fixed. `readDisplayScale` / `writeDisplayScale` previously evaluated the `window.localStorage` default parameter outside their `try` blocks. The fix moves localStorage lookup inside the `try` and adds a hook test for `SecurityError`.
- P3: 1 accepted/fixed from external review. `StockDetailContent` kept the detail header product code at `text-xs`; the fix changes it to `text-sm font-medium` and adds a regression test.
- L3 feedback accepted/fixed. After increasing display size, the Sidebar navigation could not shrink/scroll and the operator could not reliably reach the display-size control to change it again. The fix adds `min-h-0` to the Sidebar root / navigation ScrollArea, keeps `DisplayScaleControl` `shrink-0`, and adds a Sidebar layout regression test.
- L3 feedback accepted/fixed. After selecting an individual department in stock inquiry, the DepartmentFilter offered only `すべての部門` and the current department. The fix keeps other departments available by deriving options from the same q/status with dept omitted, and adds a hook regression test.
- Windows native L3 passed after both fixes. The operator can return from enlarged display sizes and can switch directly from one stock inquiry department to another.

Remaining: PR #77 merge judgment.
