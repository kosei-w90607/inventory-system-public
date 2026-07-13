# Test Design Matrix: 在庫照会 高視認性 follow-up

## Risk

Risk: R3

## Contracts Under Test

- UI-STOCK-VIS-2026-06-07: 在庫状態は色だけではなく、状態列の日本語ラベル + icon + Badge で伝える。
- UI-STOCK-VIS-2026-06-07: frontend は低在庫閾値を持たず、`source` と `stock_quantity` から既存 `StockStatus` を派生する。
- UI-STOCK-VIS-2026-06-07: 6 列化後も選択行直下の detail expansion は table 構造と一致する。
- UI-STOCK-VIS-2026-06-07: `StatusChips` は 1 つ選択を維持し、active state を DOM state と tone で示す。

## Failure Modes

- `在庫切れ` / `在庫少` が色クラスだけで表示され、text label がない。
- `source="search"` の通常在庫まで `在庫少` と誤表示する。
- `source="low_stock"` の positive stock が `通常` と誤表示される。
- 状態列追加後に detail expansion の `colSpan` が 5 のままで table layout が崩れる。
- StatusChips の空文字 deselect で active filter が消える。
- Tests が Tailwind class だけを assert し、非色シグナルの欠落を検出できない。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-STOCK-VIS-2026-06-07 | stockout label missing | component / regression | `REQ-302: stockout row renders 在庫切れ badge label` | stockout is encoded only by `text-rose-*` class |
| UI-STOCK-VIS-2026-06-07 | low-stock label missing | component / regression | `REQ-302: low-stock row renders 在庫少 badge label` | low stock is encoded only by `text-amber-*` class |
| UI-STOCK-VIS-2026-06-07 | ok state mislabeled | component / regression | `REQ-302: search positive stock renders 通常 status label` | search positive stock is marked low or left unlabeled |
| UI-STOCK-VIS-2026-06-07 | colSpan stale | component / regression | `REQ-301: 選択行の nextElementSibling が colSpan 展開行（td[colspan=6]、旧下部固定の混入 guard）` | table has 6 columns but expansion remains `colSpan=5` |
| UI-STOCK-VIS-2026-06-07 | main path misses stockout label | integration / regression | `REQ-302: search result stockout reaches page as 在庫切れ` | `StockInquiryPage` omits the status column or passes wrong source |
| UI-STOCK-VIS-2026-06-07 | main path misses low label | integration / regression | `REQ-302: low_stock result reaches page as 在庫少` | `listLowStock` flow is not wired to status badge |
| UI-STOCK-VIS-2026-06-07 | chip selected state can clear | component / negative | `REQ-302: deselect empty value is ignored` | empty ToggleGroup value calls `onChange` or clears selection |
| UI-STOCK-VIS-2026-06-07 | chip active state missing | component / regression | `REQ-302: selected chip exposes data-state=on` | active chip no longer carries Radix selected state |

## Negative Paths

- missing input: not applicable; list rows are existing DTOs.
- invalid input: unexpected URL search values remain handled by existing route validator.
- duplicate/ambiguous input: multiple matching products remain table rows; status derivation is per row.
- unknown reference: selected product missing from current list remains handled by existing clear effect.
- dependency missing: no new package dependency; `lucide-react` and `Badge` already exist.
- permission/write failure: no filesystem write behavior.
- dry-run side effect: not applicable.

## Boundary Checks

- threshold: no frontend threshold; use existing `deriveStockState` source + quantity contract.
- null/default: `ok` state displays `通常` only for search positive stock.
- empty/non-empty: empty list behavior remains unchanged.
- min/max: `stock_quantity <= 0` includes zero and negative stockout; `stock_quantity = 1` follows source-specific path.
- status/policy enum: `StockStatus` remains `"ok" | "low" | "stockout"`.
- wire type: existing `ProductWithRelations`.
- internal type: existing `StockStatus`.
- producer/consumer: `useStockInquiry` -> `ProductListTable`.
- round-trip token: `source="search" | "low_stock"` is preserved into `deriveStockState`.
- precision/range: integer stock quantities, no currency/date precision changes.
- cross-language parse: no Rust/TS DTO or generated binding change.

## Compatibility Checks

- old schema/input: existing query result DTOs still accepted.
- new schema/input: no new schema.
- output order: table column order becomes `商品コード / 商品名 / 部門 / 状態 / 在庫数 / 売価`.
- optional field behavior: no optional DTO field behavior change.

## Data Safety Checks

- source-derived data: no real POS/register/store sample files.
- generated outputs: no generated bindings or route tree commits expected.
- secrets: no `.env*`, credentials, keys, certificates, or `auth.json`.
- local-only files: Windows native app data stays local.
- synthetic sample boundaries: tests use `makeMockProductWithRelations` only.

## Main Wiring / Integration Checks

- helper connected to main path: `ProductListTable` renders status labels from `deriveStockState`.
- output reaches manifest/report: not applicable.
- effective config reaches runtime: not applicable.
- CLI arg reaches implementation: not applicable.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? `low_stock result reaches page as 在庫少` and existing `derive-stock-state.test.ts`.
- If a threshold comparison changes, which test fails? Existing `derive-stock-state.test.ts` for `stock_quantity=0` and `stock_quantity=1`.
- If a guard is removed, which test fails? `deselect empty value is ignored`.
- If an output field is omitted, which test fails? `stockout row renders 在庫切れ badge label` / `low-stock row renders 在庫少 badge label`.
- If output order changes, which test fails? Review catches column-order drift; component tests verify status column content and colSpan.
- If dry-run performs a side effect, which test fails? Not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? Not applicable for this UI-only change.
- If a state token is round-tripped through browser/client code, which test fails? `StockInquiryPage` integration tests for search and low_stock paths.

## Residual Test Gaps

- jsdom cannot prove human readability, icon shape distinction, or table visual density. Windows native L3 remains required.
- Tests do not assert exact Tailwind color classes by design; visual tone is covered by review and L3.
