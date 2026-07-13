# Test Design Matrix: Display Scale and Product Code Readability

## Risk

Risk: R3

## Contracts Under Test

- `SPEC-UI-DISPLAY-SCALE-2026-06-07`: display-size token is persisted locally and applied to Tauri WebView zoom.
- `SPEC-UI-DISPLAY-SCALE-2026-06-07`: invalid display-size input falls back to `standard`.
- `SPEC-UI-DISPLAY-SCALE-2026-06-07`: product-code cells are no longer rendered at the smallest table text size.
- `SPEC-UI-DISPLAY-SCALE-2026-06-07`: stock inquiry department filter remains switchable after selecting an individual department.

## Failure Modes

- Unknown localStorage token keeps an unsupported state.
- `setZoom` rejection crashes React rendering.
- UI control is not wired into the shared sidebar.
- Sidebar navigation cannot scroll after WebView zoom, making the display-size control unreachable.
- Stock inquiry department Select collapses to only `すべての部門` and the current department after selecting an individual department.
- Product-code cells remain `text-xs`.
- Capability is missing, causing Windows native WebView zoom to fail at runtime.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| Display scale token | Invalid storage value survives | unit / hook | `UI-12: invalid stored display scale falls back to standard and applies 1x zoom` | unknown token is trusted or persisted |
| Display scale token | User change not persisted | unit / hook | `UI-12: changing display scale persists the token and applies matching WebView zoom` | `localStorage` write or `setZoom` call is missing |
| Display scale token | Tauri zoom failure crashes | unit / hook | `UI-12: WebView zoom failure is non-fatal` | rejected `setZoom` escapes the hook |
| Sidebar wiring | Control omitted from app shell | review / integration | `Sidebar.tsx` review | `DisplayScaleControl` is not mounted |
| Sidebar reachability | Enlarged sidebar cannot shrink/scroll | RTL / layout regression | `UI-12: navigation area can shrink and scroll while display scale control remains mounted` | Sidebar ScrollArea lacks `min-h-0` or the display-size control is lost |
| Stock inquiry department filter | Other departments become unavailable after individual selection | hook / regression | `REQ-302: 個別部門選択中も他部門へ切り替えられる候補を維持する` | department options are derived only from the currently department-filtered list |
| Product-code readability | Stock inquiry stays `text-xs` | RTL / regression | `REQ-301: product code cell uses readable table text size` | stock inquiry product code cell keeps `text-xs` |
| Product-code readability | Stock inquiry detail header stays `text-xs` | RTL / regression | `REQ-301: detail header product code uses readable table text size` | stock inquiry detail header product code keeps `text-xs` |
| Product-code readability | Daily sales stays `text-xs` | RTL / regression | `REQ-501: product code cell uses readable table text size` | daily sales product code cell keeps `text-xs` |
| Tauri capability | Permission missing | config review / build | `src-tauri/capabilities/default.json` review | `core:webview:allow-set-webview-zoom` is absent |

## Negative Paths

- missing input: missing localStorage value -> `standard`
- invalid input: unknown localStorage token -> `standard`
- duplicate/ambiguous input: not applicable
- unknown reference: not applicable
- dependency missing: no new npm dependency
- permission/write failure: rejected `setZoom` does not crash
- dry-run side effect: not applicable

## Boundary Checks

- threshold: no stock threshold or sales business threshold touched
- null/default: missing storage value defaults to `standard`
- empty/non-empty: empty string storage value defaults to `standard`
- min/max: only `1`, `1.15`, `1.3` zoom factors are emitted
- status/policy enum: `DisplayScaleValue = standard | large | extra_large`
- wire type: localStorage string, WebView zoom number
- internal type: `DisplayScaleValue`
- producer/consumer: `useDisplayScale` -> Tauri WebView
- round-trip token: `inventory.displayScale.v1`
- precision/range: fixed factors, no arbitrary floats
- cross-language parse: Tauri receives number only; no Rust DTO generated

## Compatibility Checks

- old schema/input: no DB schema change
- new schema/input: no CMD or binding change
- output order: not applicable
- optional field behavior: not applicable

## Data Safety Checks

- source-derived data: none
- generated outputs: do not edit `src/lib/bindings.ts`
- secrets: do not read `.env*`, credentials, keys, certs, or `auth.json`
- local-only files: no DB, backup, log, receipt image, or POS CSV
- synthetic sample boundaries: component tests use synthetic product codes

## Main Wiring / Integration Checks

- helper connected to main path: `Sidebar` mounts `DisplayScaleControl`
- scroll recovery path: `Sidebar` root and navigation `ScrollArea` keep `min-h-0` so the operator can return from enlarged display sizes
- department recovery path: `useStockInquiry` derives department options from the same q/status with dept omitted when a dept is selected
- output reaches manifest/report: not applicable
- effective config reaches runtime: capability includes WebView zoom permission
- CLI arg reaches implementation: not applicable

## Mutation-style Adequacy Questions

- If a key branch is inverted, invalid storage fallback test fails.
- If a threshold comparison changes, not applicable.
- If a guard is removed, rejected `setZoom` test fails.
- If an output field is omitted, not applicable.
- If output order changes, not applicable.
- If dry-run performs a side effect, not applicable.
- If a JSON number crosses JavaScript safe integer range, not applicable.
- If a state token is round-tripped through browser/client code, hook persistence tests fail.
- If Sidebar loses shrinkable scroll layout after zoom, Sidebar layout regression test fails.
- If department options are derived only from the selected-dept result, stock inquiry hook regression test fails.

## Residual Test Gaps

- jsdom does not prove actual perceived readability or table density under WebView zoom; Windows native L3 remains required.
- No screenshot-diff / visual regression gate is added in this PR; the reevaluation result is documented as a deferred decision.
