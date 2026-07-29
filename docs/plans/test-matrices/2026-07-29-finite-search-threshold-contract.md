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
| C1 product finite values | route/local union drift | unit/schema | existing `search.test.ts` | allowed/invalid/default/mapがずれる |
| C2 movement search | type/label/schema drift | unit/RTL | existing StockMovementsPage test | type variant/fallback/page resetがずれる |
| C3 records search | recordType/status drift | unit/RTL | existing InventoryRecordsPage test | parse/normalize/returnToがずれる |
| C4 daily/monthly | Page propsとschema drift | unit/RTL | existing Daily/Monthly Page tests | finite sort/mode/date fallbackがずれる |
| C5 low_stock | navigation literal drift | unit/RTL | navigation + SidebarLink tests | deep-link/active predicateが片側変更される |
| C6 threshold descriptor | schema/save/extract drift | unit/RTL | ThresholdSettingsPage + extract tests | field/key/order/labelが同期しない |
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
| route finite schema | all production routes | product/movement/records/daily/monthly/stock | scalar/date-only routes | repository rg |
| threshold field set | schema/extract/Page/save hook | all 4 | backend generic KVS | targeted tests |

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

- exported schema reaches actual route `validateSearch`
- `LOW_STOCK_FILTER` reaches navigation config
- descriptor reaches actual updateSetting entries

## Mutation-style Adequacy Questions

- add/remove one tuple variant: typecheck or corresponding existing test turns red
- restore a local `z.enum` literal: static ownership review/test turns red
- change `LOW_STOCK_FILTER`: navigation/Sidebar test turns red
- add descriptor field without render/save: typecheck or threshold tests turn red

## Residual Test Gaps

- visual/native behavior is intentionally unchanged; no L3 rerun
