# Test Design Matrix: 入出庫履歴ハブ + 廃棄・破損詳細

## Risk

Risk: R3

## Contracts Under Test

- REQ-206 / TRACE-D1/D7: recent list とは別に、過去の入出庫系業務記録を一覧・詳細で追跡できる。
- REQ-204: 廃棄・破損記録のヘッダ、明細、ロス原価を読める。
- REQ-207 / TRACE-D2: movement の元記録リンクが実装済み detail route に到達する。
- `65` §65.4: 一覧は header 単位で返し、page/per_page 上限を守る。
- `65` §65.5: 詳細は関連 `inventory_movements` を表示する。

## Failure Modes

- 明細 JOIN で disposal header が重複して一覧に出る。
- 商品 keyword filter が header ではなく item にだけ効き、件数と rows がずれる。
- `getDisposalRecord` が存在しない ID を empty detail として返してしまう。
- detail のロス原価合計が数量を掛けず単価だけ合算される。
- movement source route が `/inventory/disposal` 等の作成画面を指したままになる。
- filter 変更後に page が古いままで 0 件に見える。
- UI が色だけで status / type を伝える。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| REQ-206 / §65.4 | 明細 JOIN duplicate | Rust unit/integration | `test_list_inventory_records_req206_disposal_header_once_for_matching_items` | 1 record に複数 item があると一覧行が重複する |
| REQ-206 / §65.4 | page/per_page invalid | Rust unit | `test_list_inventory_records_req206_rejects_invalid_page_params` | BIZ validation を抜けて IO が不正 limit を受ける |
| REQ-204 / §65.5 | missing id is not_found | Rust unit | `test_get_disposal_record_req204_not_found` | 存在しない ID を空 detail として返す |
| REQ-204 / §65.5 | loss total wrong | Rust unit/integration | `test_get_disposal_record_req204_includes_items_total_and_movements` | `quantity * cost_price` で合計せず、movement を返さない |
| REQ-206 / route state | filter change keeps old page | RTL | `REQ-206 resets page when filters change` | page=3 のまま種別/日付/検索を変える |
| REQ-206 / UI | records hub cannot navigate detail | RTL | `REQ-206 shows disposal records and links to detail route` | table に詳細 link がない、または route が違う |
| REQ-204 / UI | detail omits item/movement evidence | RTL | `REQ-204 displays disposal record detail with items and movements` | 明細、ロス原価合計、movement link が表示されない |
| REQ-204 / UI-05 | recent list stays isolated | RTL | `REQ-204 recent disposal records link to all records and detail` | UI-05 から履歴ハブや detail に行けない |
| REQ-207 / source route | movement link is dead | existing + RTL | `REQ-207 disposal movement source route reaches detail page` | source route と route file が一致しない |

## Negative Paths

- missing input: blank recordId route cannot occur; command receives numeric ID.
- invalid input: page=0, per_page=0/101, invalid date format if implemented in BIZ.
- duplicate/ambiguous input: product keyword matching multiple item rows must still return one header row.
- unknown reference: existing movement source resolver returns `None`; detail movements show source only when present.
- dependency missing: list/get command error -> inline Alert.
- permission/write failure: read-only scope; not applicable.
- dry-run side effect: not applicable.

## Boundary Checks

- threshold: per_page max 100.
- null/default: record_type all -> first implementation includes disposal records; status missing -> active display.
- empty/non-empty: 0 records -> EmptyState; 1+ records -> table.
- min/max: page starts at 1; record_id exact match.
- status/policy enum: active / canceled / corrected display; current schema has active only.
- wire type: Rust i64/u32 -> TS number.
- internal type: IO detail structs -> BIZ DTO -> specta generated TS.
- producer/consumer: command output fields used directly by frontend.
- round-trip token: `detail_route` from backend can be used as link href.
- precision/range: local IDs/cost totals below JS unsafe integer.
- cross-language parse: date strings remain `YYYY-MM-DD`, datetime display replaces `T`.

## Compatibility Checks

- old schema/input: no migration; existing disposal tables work.
- new schema/input: additive commands/types only.
- output order: `business_date DESC, record_id DESC`.
- optional field behavior: `status` defaults to `"active"` until schema status fields exist.

## Data Safety Checks

- source-derived data: no real POS/register/store data.
- generated outputs: `src/lib/bindings.ts` only.
- secrets: do not read `.env*`, keys, credentials, `auth.json`.
- local-only files: no DB/log/receipt image files committed.
- synthetic sample boundaries: tests seed synthetic products/disposal records.

## Main Wiring / Integration Checks

- helper connected to main path: `commands.listInventoryRecords` used by `/inventory/records`.
- output reaches manifest/report: Tauri `generate_handler!` and specta `collect_commands!` include new commands.
- effective config reaches runtime: navigation has active `/inventory/records`.
- CLI arg reaches implementation: generated binding wraps snake_case command names.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? Invalid page branch -> Rust validation test.
- If a threshold comparison changes, which test fails? per_page=101 test.
- If a guard is removed, which test fails? missing ID not_found test.
- If an output field is omitted, which test fails? RTL detail tests and TypeScript typecheck.
- If output order changes, which test fails? Rust list ordering assertion.
- If dry-run performs a side effect, which test fails? not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? residual risk only.
- If a state token is round-tripped through browser/client code, which test fails? route search reset RTL test.

## Residual Test Gaps

- Windows native L3 readability / route traversal is manual owner confirmation.
- Other record types remain deferred and are not tested here beyond non-scope messaging.
- Cancel/correct/export/print/image attachment are deferred.
