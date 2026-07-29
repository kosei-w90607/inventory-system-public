# Test Design Matrix: finite search / threshold descriptor contract

## Risk

Risk: R3

## Contracts Under Test

- UI-STATE-D2 finite URL values
- D-047 / UI-12-D1 `low_stock` deep-link
- UI-11a-D8 threshold descriptor
- D-055 generated artifact lane ownership

## Failure Modes

- route / feature / normalizerの片側variant変更
- invalid URL fallback、page reset、payload drift
- threshold fieldがvalidationだけ通り保存されない
- lane 1がtraceability generated fileを奪う

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| C1 product finite values | route/Page/local union drift | unit/schema + static | `products/search.test.ts`: product全variant/invalid + route/Page owner guard; `ProductListPage.test.tsx`: option render | allowed/invalid/default/map、route import、Page option ownerがずれる |
| C2 movement search | type/label/schema drift | unit/schema + RTL | `products/search.test.ts`: movement全variant/invalid + route owner guard; `StockMovementsPage.test.tsx` | type variant/fallback/page reset、route importがずれる |
| C3 records search | recordType/status/Page cast drift | unit/schema + static + RTL | `products/search.test.ts`: records全variant/invalid + route/Page owner guard; `InventoryRecordsPage.test.tsx` | parse/normalize/returnTo、option owner、castがずれる |
| C4 daily/monthly | route/Page/component optionとschema drift | unit/schema + static + RTL | `products/search.test.ts`:全variant/invalid + route/Page/component owner guard; daily ProductTable、monthly ModeTabs/ProductRankingTable/DepartmentTable + Page tests | finite sort/mode/date fallback、全descriptor、mode別subset、header/option ownerがずれる |
| C5 low_stock | route/StatusChips/navigation literal drift | unit/schema + static + RTL | `products/search.test.ts`: stock全variant/invalid + route/StatusChips owner guard; StatusChips/navigation/SidebarLink tests | deep-link/option/active predicateが片側変更される |
| C6 threshold descriptor | schema/save/extract/render drift | unit/static + RTL | `extract-thresholds.test.ts`: descriptor全件 + owner guard; `ThresholdSettingsPage.test.tsx`: descriptor全件render/save | field追加、手書きkey set、key/order/labelの片側変更が生存する |
| C7 generated ownership | 90生成差分 | CLI | generate_traceability check + diff | 新ID/fileを追加する |

## State Lifecycle Matrix

| State / subject | Initial | Success | Revisit | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|
| URL search | raw URL | schema output→normalized Page state | F5で同値 | invalidは既存fallback | 条件変更 | schema/Page tests |
| threshold form | fetched 2 values | dirty-only固定順保存 | refetch | 先頭失敗で停止 / 部分成功表示 | 再保存 | threshold tests |
| navigation active | pathname+search | ui-06a/06b排他 | extra search | 両方active | navigation | Sidebar tests |

## Adjacent Pattern Audit

| Pattern | Sites inspected | Ported sites | Exclusions | Evidence |
|---|---|---|---|---|
| route finite schema | all production routes、ProductListPage、InventoryRecordsPage、daily ProductTable、monthly ModeTabs/ProductRankingTable/DepartmentTable、StatusChips | product/movement/records/daily/monthly/stockの全exercising site | scalar/date-only routes | schema table + helper-scoped source ownership guard |
| sales finite choices | daily sort descriptor、monthly mode/sort descriptorとmode別subset | ProductTable / ModeTabs / ProductRankingTable / DepartmentTable | 非sortable列 | descriptor全件/subset反復component tests |
| threshold field set | descriptor/schema/extract/Page/save hook | all 5 | backend generic KVS | descriptor反復test + helper-scoped source ownership guard |

## Negative Paths

- invalid enum / malformed page/date: existing fallback
- unknown threshold issue path: guard false
- threshold first/second save failure: existing partial-failure behavior
- generated output mutation: diff must remain zero

## Boundary Checks

- product perPage 50/100/200; threshold 1/99999
- absent/unknown enum; page min 1
- `low_stock` with/without extra search
- threshold 0/decimal/100000 rejected

## Compatibility Checks

- URL keys/values/defaults/output order unchanged
- query/CMD payload unchanged
- threshold key/order/wording unchanged

## Data Safety Checks

- generated outputs: `90-traceability.md`, bindings, route tree diff 0
- secrets/local data: none

## Main Wiring / Integration Checks

- `products/search.test.ts`のsource guardでexported schemaがactual route `validateSearch`へ届き、route-local `z.enum` / unionとPage / ModeTabs / 3 sortable table / StatusChipsの独立value arrayが0
- daily/monthly componentはfeature descriptorをimportし、全件またはmode別subsetを表示してexact column / option payloadを返す
- `LOW_STOCK_FILTER` reaches navigation config
- descriptor reaches actual schema/extract/render/updateSetting entries

## Mutation-style Adequacy Questions

- add/remove one tuple variant: schema全variant tableまたは対応Page option test turns red
- add/remove daily sort、monthly mode/sort variant、またはmode別subsetから1件削除: descriptor全件/subset component test red
- restore a route-local `z.enum` / union、Page / ModeTabs / 3 sortable table / StatusChipsの独立value array/cast: `products/search.test.ts` source ownership guard turns red
- change `LOW_STOCK_FILTER`: navigation/Sidebar test turns red
- add descriptor field without schema/extract/render/save、または手書きthreshold key setを再導入: descriptor反復case / source ownership guard turns red

## Residual Test Gaps

- visual/native behavior is intentionally unchanged; no L3 rerun
