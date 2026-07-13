# Test Design Matrix: UI-02 入庫記録 Design Readiness

## Risk

Risk: R3

## Contracts Under Test

- UI-02-D1: `/inventory/receiving` route と navigation を有効化する。
- UI-02-D2: UI-02 は generated `commands.*` だけを使う。
- UI-02-D3: supplier options は `listSuppliers` 由来の complete master data である。
- UI-02-D4: 商品追加は searchProducts の 0/1/複数件を分けて扱う。
- UI-02-D5: scanner 相当入力は focused field + Enter + focus return で扱う。
- UI-02-D6: 同一商品再追加は数量加算で、重複行を増やさない。
- UI-02-D7: 数量/原価/date/items validation を command 呼び出し前に行う。
- UI-02-D8: 同内容 retry 時に idempotency_key を再利用し、成功/リセット/編集再送後は新 key にする。
- UI-02-D9: submit 中は中断可能に見せない。
- UI-02-D10: result で record_id / item count / warnings / idempotent replay が読める。
- UI-02-D11: recent receiving list の空/成功/失敗状態を表示する。
- UI-02-D12: 保存成功時に receiving/product/lowStock/stockInquiry query を invalidate する。
- UI-02-D13: Windows native L3 で連続入力とフォーカスを確認する。

## Failure Modes

- route が商品管理配下などに置かれ、入出庫ナビと一致しない。
- UI が generated binding にない receiving command を ad hoc invoke で呼ぶ。
- `create_receiving` は runtime 登録済みだが `bindings.ts` に出ず、実装時に型なし呼び出しへ戻る。
- 取引先候補を現在の商品や入庫履歴から派生して候補が欠ける。
- 商品検索 0件時に recovery がなく、未登録商品をどう扱うか分からない。
- 複数候補を自動で先頭選択して誤商品が入る。
- 同じ商品を連続スキャンすると重複行が増え、数量確認が難しくなる。
- 数量 0 / 負数 / 原価負数が command まで届く。
- internal error 後の再試行で idempotency_key が変わり、二重入庫になる。
- 保存失敗後に内容を編集しても idempotency_key が変わらず、fingerprint conflict または note 変更の未反映が起きる。
- 保存中に戻る/リセットが押せるように見え、処理中断と誤認する。
- 保存成功後に在庫照会や商品一覧が stale のままになる。
- PLU dirty を誤って invalidate し、入庫だけで PLU 未反映に見える。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-02-D1 | route/nav drift | route/component | `ReceivingPage.test.tsx: route and navigation active` | `/inventory/receiving` route or nav active is missing |
| UI-02-D2 | generated command gap | Rust/generated/review | `grep-bindings-ui02-commands` | `createReceiving` or `listReceivings` missing |
| UI-02-D3 | supplier candidates incomplete | hook/component | `useReceivingOptions.test.tsx: suppliers from listSuppliers` | suppliers are derived from products/list |
| UI-02-D3 | optional supplier too strict | component | `ReceivingPage.test.tsx: supplier failure still allows no-supplier save` | supplier query failure blocks all saves |
| UI-02-D4 | product 1-hit add drift | hook/component | `ReceivingProductSearch.test.tsx: enter adds single result` | 1 result does not add a row |
| UI-02-D4 | product candidates unsafe | component | `ReceivingProductSearch.test.tsx: multiple results require selection` | first candidate is auto-selected |
| UI-02-D4 | product not found recovery | component | `ReceivingProductSearch.test.tsx: not found shows product registration link` | 0 results dead-end the flow |
| UI-02-D5 | focus return drift | component/L3 | `ReceivingProductSearch.test.tsx: focus returns after add` | focused field is lost after add |
| UI-02-D6 | duplicate rows | unit | `receiving-row-utils.test.ts: duplicate product increments quantity` | duplicate product creates another row |
| UI-02-D7 | validation gap | unit/component | `receiving-validation.test.ts` | invalid date/items/quantity/cost pass |
| UI-02-D8 | retry double-write risk | unit/component | `build-receiving-request.test.ts: idempotency key lifecycle` | same-content retry generates a new key, or reset/edit retry keeps old key |
| UI-02-D9 | pending cancel illusion | component | `ReceivingPage.test.tsx: submit pending disables editing and navigation actions` | editing/reset/back actions remain enabled |
| UI-02-D10 | result unclear | component | `ReceivingResultPanel.test.tsx` | record_id/count/warnings/replay are hidden |
| UI-02-D11 | recent list states | component/hook | `ReceivingRecentList.test.tsx` | empty/error/success states are indistinguishable |
| UI-02-D12 | cache stale | component | `ReceivingPage.test.tsx: successful submit invalidates query keys` | required query invalidations are missing or PLU dirty is invalidated |
| UI-02-D13 | native input drift | manual L3 | `Windows native UI-02 L3` | Enter add, continuous scan-like input, focus return, save result fail in native app |

## Negative Paths

- blank receiving date shows Japanese field error and does not call `createReceiving`.
- no item rows disables submit and explains why.
- quantity blank / 0 / negative / decimal is blocked before command payload.
- cost price negative / decimal is blocked before command payload.
- product search command failure preserves existing rows.
- supplier query failure shows warning but allows `supplier_id=null`.
- create validation error preserves form state and idempotency key.
- create internal error preserves form state and idempotency key for same-content retry.
- editing after a create error generates a new idempotency key before resubmit.

## Boundary Checks

- command DTO: `ReceivingCreateRequest` / `ReceivingItemInput` / `ReceivingCreateResult` generated types match Rust.
- nullable fields: `supplier_id` and `note` can be null.
- date field: `receiving_date` is `YYYY-MM-DD`.
- integer fields: `quantity`, `cost_price`.
- list paging: `listReceivings(1, 10, null, null)` stays under CMD/BIZ per_page upper 100.
- query invalidation: receiving/product/lowStock/stockInquiry yes; PLU dirty no.
- query key helper: UI-02 implementation adds `queryKeys.receivings.root()` and `queryKeys.receivings.recent()`.

## Compatibility Checks

- Existing `commands.searchProducts` and `commands.listSuppliers` generated names remain stable.
- Existing receiving BIZ/CMD Rust tests continue to pass.
- Existing product list and stock inquiry query keys remain valid.
- No DB schema/migration change.

## Data Safety Checks

- No real POS CSV, store data, local DB, backups, logs, receipt images, or secrets.
- Tests use synthetic products/suppliers only.
- Receiving save tests use mocked commands or in-memory DB only.

## Main Wiring / Integration Checks

- `collect_commands!` and `tauri::generate_handler!` include generated UI-02 commands.
- `cargo run --bin generate_bindings` updates only intended command/type additions.
- `/inventory/receiving` appears in generated route tree/build.
- Navigation `入庫記録` points to `/inventory/receiving`.

## Residual Test Gaps

- Global barcode detection is deferred, so no timing-threshold test is designed here.
- Receiving detail/edit/cancel is deferred.
- inline product/supplier creation is deferred.
- cm / m display toggle is deferred; UI-02 only covers `stock_unit='cm'` display and cm integer input.
