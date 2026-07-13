# Test Design Matrix: 手動販売出庫 recent list follow-up

## Risk

Risk: R3

## Contracts Under Test

- UI-04 recent list uses existing `listInventoryRecords` with `record_type="manual_sale"`.
- UI-04 recent list is save-confirmation only and links to `/inventory/records?recordType=manual_sale`.
- UI-04 recent row detail links to `/inventory/manual-sale/records/$recordId`.
- Save success invalidates `queryKeys.inventoryRecords.root()` so recent list can refresh.
- UI-02/03/04/05 save success and command failure scroll the page container to the top so result panels and top Alerts are visible.

## Failure Modes

- Recent list accidentally queries all record types instead of manual sale.
- `すべての履歴を見る` links to unfiltered `/inventory/records`.
- `詳細を見る` links to parent `/inventory/manual-sale` creation page or disposal detail.
- Recent command error breaks the input form.
- Empty recent state looks like a page-level empty state and hides the form.
- Save success does not invalidate inventory records, leaving the recent list stale.
- A bottom save leaves the operator near the bottom while the result panel or save Alert appears off-screen at the top.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| manual-sale recent query | wrong record type | RTL | `REQ-203/REQ-206: recent list exposes all-history and detail links` | query omits `record_type="manual_sale"` |
| all-history link | unfiltered route | RTL | same test | href is not `/inventory/records?recordType=manual_sale` |
| detail link | parent or wrong detail route | RTL | same test | href is not `/inventory/manual-sale/records/{id}` |
| empty state | form hidden / bad wording | RTL | `REQ-203/REQ-206: recent list shows empty state without blocking form` | form disappears or empty text is missing |
| error state | form hidden / no recovery | RTL | `REQ-203/REQ-206: recent list error stays section-local` | form disappears or error is not shown in recent section |
| cache invalidation | stale recent after save | RTL existing/updated result test | `REQ-203 displays manual sale result and invalidates inventory and sales queries` | `inventoryRecords.root()` is not invalidated |
| save result visibility | top result hidden after bottom save | helper + RTL | `scrollPageToTop`; save-result / command-failure tests for receiving / return / manual sale / disposal; manual-sale PLU confirmation test | the page container is not scrolled to `{ top: 0, behavior: "smooth" }` |

## Negative Paths

- recent list command rejects: show Alert in recent section only.
- recent list returns 0 rows: show `直近の手動販売出庫はありません`.
- saved result has `sale_id=null`: result detail link remains hidden; recent list unaffected.
- frontend validation errors stay near the invalid input and do not force a page-top scroll; representative RTL no-scroll assertions cover receiving, manual sale, and disposal row validation.

## Boundary Checks

- `per_page=5` fixed for recent list.
- `page=1` fixed for recent list.
- status/date/product filters are null for recent list.
- record IDs are displayed with `#` and link params use the numeric ID string.

## Compatibility Checks

- Existing product search, validation, PLU confirmation, result panel, daily sales link tests still pass.
- Existing UI-02/03/05 save-result tests cover the same page-top scroll convention for adjacent save flows.
- No generated binding diff is expected.
- No DB migration is expected.

## Data Safety Checks

- Test fixtures are synthetic.
- No real app DB, receipt images, POS CSV, PLU exports, backups, logs, secrets, or `.env*`.

## Main Wiring / Integration Checks

- `ManualSalePage` imports `useQuery` and calls generated `commands.listInventoryRecords`.
- query key is under `queryKeys.inventoryRecords`.
- save success invalidates the same root key.

## Mutation-style Adequacy Questions

- If `record_type` changes to `null`, which test fails? recent query assertion.
- If all-history href loses the filter, which test fails? href assertion.
- If detail route points to `/inventory/manual-sale`, which test fails? href assertion.
- If error state returns `null`, which test fails? error-state RTL.
- If save invalidation is removed, which test fails? result invalidation test.

## Residual Test Gaps

- Windows native visual density and actual click navigation are covered by L3, not CI.
- TanStack Router integration is represented by mocked `Link`; full app route behavior was covered in PR #115 and will be manually spot-checked in L3.
