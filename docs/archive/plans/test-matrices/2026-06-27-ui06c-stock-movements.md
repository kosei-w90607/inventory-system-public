# Test Design Matrix: UI-06c 商品別在庫変動履歴

## Risk

Risk: R3

## Contracts Under Test

- SPEC-UI06C-MOVEMENTS: `/stock/$code/movements` が URL state から `MovementQuery` を生成し、商品別 movement を表示する。
- REQ-207: movement 行から元業務記録へ戻れる。`source` がない行も表示を落とさない。
- DSR-08 / UI-06c-D5: 増減は色だけでなく符号と日本語ラベルで表示する。

## Failure Modes

- route param `code` ではなく別の商品コードで query してしまう。
- `dateFrom` / `dateTo` / `type` / `page` が `MovementQuery` に反映されない。
- `source=null` の movement を非表示にする、またはクラッシュする。
- 増減が数字だけ、または色だけになり、意味が読めない。
- product detail 失敗で movement list まで消える。
- 在庫照会詳細カードの「在庫変動履歴」が disabled のまま残る。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| REQ-303 / UI-06c-D1/D2 | URL state が command query に反映されない | component | `REQ-303: URL searchからMovementQueryを作りlistMovementsを呼ぶ` | product_code/date/type/page/per_page のいずれかが誤る |
| REQ-303 / UI-06c-D4/D5/D6 | movement table が業務情報を欠落する | component | `REQ-303: movement rows show type quantity stock source and note` | 種別/増減/在庫/元記録/備考の表示が欠ける |
| REQ-207 / UI-06c-D6 | source null で落ちる、または行を隠す | component | `REQ-207: sourceなしのmovementは元記録なしとして表示する` | source null を扱えない |
| UI-06c-D3 | product detail fail が movement list を巻き添えにする | component | `REQ-303: 商品情報取得失敗でもmovement listを表示する` | product query error で page 全体が error になる |
| UI-06c-D5 | 増減意味が非色シグナルを持たない | unit | `REQ-303: formatMovementQuantity returns sign and label` | +/−/増加/減少/変動なしが壊れる |
| REQ-301 / UI-06c-D1 | 在庫照会詳細から遷移できない | component | `REQ-301: StockDetailContent shows active movement history link` | CTA が disabled のまま、または href が違う |

## Negative Paths

- missing input: search params 未指定 -> page 1 / type all / dates null
- invalid input: route validateSearch で不正 search は fallback
- duplicate/ambiguous input: not applicable
- unknown reference: `source=null` or unknown movement_type は表示を継続
- dependency missing: product detail fail / movement fail は別々に扱う
- permission/write failure: read-only UI; not applicable
- dry-run side effect: not applicable

## Boundary Checks

- threshold: `per_page=20`, page min 1
- null/default: `date_from/date_to/movement_type=null`
- empty/non-empty: movement empty -> EmptyState
- min/max: page fallback
- status/policy enum: known movement type labels + unknown fallback
- wire type: `MovementQuery`
- internal type: formatter display strings
- producer/consumer: generated `commands.listMovements`
- round-trip token: URL search -> command query -> table
- precision/range: numeric quantities as integer display
- cross-language parse: generated binding types only; no DTO change

## Compatibility Checks

- old schema/input: existing `MovementRecord.source=null` rows display
- new schema/input: `MovementRecord.source` link rows display
- output order: backend order used as-is
- optional field behavior: `note=null`, `source=null`, unknown movement_type

## Data Safety Checks

- source-derived data: none
- generated outputs: `src/routeTree.gen.ts` generation only, not committed if ignored
- secrets: none
- local-only files: none
- synthetic sample boundaries: frontend fixtures only

## Main Wiring / Integration Checks

- helper connected to main path: StockDetailContent CTA -> route
- output reaches manifest/report: not applicable
- effective config reaches runtime: route generation
- CLI arg reaches implementation: not applicable

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? `source=null` and product-detail-fail tests.
- If a threshold comparison changes, which test fails? page/per_page query test.
- If a guard is removed, which test fails? product detail fail + movement list test.
- If an output field is omitted, which test fails? movement row display test.
- If output order changes, which test fails? no order-sensitive frontend test; backend owns ordering.
- If dry-run performs a side effect, which test fails? not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? not covered; DB ids are ordinary local SQLite ids.
- If a state token is round-tripped through browser/client code, which test fails? query mapping test.

## Residual Test Gaps

- Windows native L3 completed by owner: movement history navigation, filters, pagination, source-null display, and narrow-width table readability were confirmed.
- No browser E2E; route/component tests plus owner manual confirmation are the chosen gate.
- 元記録詳細 route itself remains non-scope, so link destination completion is covered by later business-record detail slices.
