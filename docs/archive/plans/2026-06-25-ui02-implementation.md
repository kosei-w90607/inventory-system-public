# Plan Packet: UI-02 入庫記録 implementation

## Risk

Risk: R3

Reason:
REQ-201 の operator-facing 入庫画面を新規実装する。CMD-02 generated bindings、在庫数量を更新する `create_receiving`、商品検索、取引先候補、route/navigation、query invalidation、Windows native L3 に触れるため R3。

## Goal

`/inventory/receiving` で、商品検索またはスキャナ相当の Enter 入力から入庫明細を作り、取引先・入庫日・備考とともに保存し、保存結果と直近入庫一覧を確認できるようにする。

## Scope

- Rust CMD-02 `create_receiving` / `list_receivings` と関連 DTO に `#[specta::specta]` / `specta::Type` を追加し、`src/lib/bindings.ts` を再生成する。
- `/inventory/receiving` route、navigation UI-02 active 化、`ReceivingPage` と入庫フォーム / 商品検索 / recent list / result 表示を実装する。
- `queryKeys.receivings.root()` / `queryKeys.receivings.recent()` を追加する。
- 保存成功時に `receivings`、商品一覧、在庫少、在庫照会を invalidate する。PLU dirty は対象外。
- validation、商品追加、冪等キー lifecycle、保存中状態、recent list の frontend tests を追加する。
- Windows native L3 で、連続入力、候補選択、保存結果、recent list、戻り導線を owner 確認する。

## Non-scope

- 入庫伝票の詳細表示、編集、取消。
- inline 商品登録 / inline 取引先登録。
- グローバル barcode scan detection。
- cm / m 表示切替。
- 仕入先別原価履歴、発注書連携、納品書画像添付。
- DB schema / BIZ / IO の業務仕様変更。

## Acceptance Criteria

- `src/lib/bindings.ts` に `createReceiving`, `listReceivings`, `ReceivingCreateRequest`, `ReceivingItemInput`, `ReceivingCreateResult`, `ReceivingRecordWithSupplier` が生成される。
- `/inventory/receiving` route が存在し、入出庫ナビの UI-02 が active になる。
- 商品検索は 0件 / 1件 / 複数件を分け、1件は追加、複数件は選択必須、0件は商品登録への導線を出す（`ReceivingPage.test.tsx` / UI-02-D4）。
- 同じ商品を再追加した場合は重複行を作らず数量を +1 する（`receiving-row-utils.test.ts` / UI-02-D6）。
- 数量は整数 `> 0`、原価は整数 `>= 0`、入庫日は必須、明細 1 件以上を command 前に validation する。
- create 失敗後の同内容 retry は同じ `idempotency_key` を使い、編集後再送 / 成功 / リセット / 続けて入庫では新しい key を使う。
- 保存中は明細編集・商品追加・リセット・戻りができるように見せない（`ReceivingPage.test.tsx` / UI-02-D9）。
- 完了後に record id、明細件数、stock warnings、idempotent replay が読め、続けて入庫 / 在庫照会へ戻る導線がある（`ReceivingPage.test.tsx` / UI-02-D10）。
- `listReceivings(1, 10, null, null)` の recent list が空 / 成功 / 失敗状態を表示する。
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `bash scripts/doc-consistency-check.sh --target plan`, `bash scripts/doc-consistency-check.sh` が green。
- review-only sub-agent と Windows native L3 の結果をこの Plan Packet / PR body に記録する（`docs/plans/2026-06-25-ui02-implementation.md` / UI-02-D13）。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-201, `docs/architecture/ui-task-specs.md` UI-02
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`, `docs/architecture/cmd-task-specs.md`, `docs/architecture/biz-task-specs.md`
- Function / command / DTO: `docs/function-design/61-ui-receiving.md`, `docs/function-design/31-biz-inventory-service.md`, `docs/function-design/44-cmd-inventory.md`, `docs/function-design/21-io-inventory-repo.md`, `docs/function-design/40-cmd-product.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/52-ui-shared-layout.md`, `docs/design-system/02-component-catalog.md`

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Implementation target | Test target |
|---|---|---|---|---|
| REQ-201 / UI-02 | `61-ui-receiving.md §61.1` | UI-02-D1 | route/navigation | route/nav checks |
| REQ-201 / CMD-02 | `61-ui-receiving.md §61.4` | UI-02-D2 | specta derives, collect_commands, bindings | generated binding/typecheck |
| REQ-201 / suppliers | `61-ui-receiving.md §61.1` | UI-02-D3 | `listSuppliers` query | supplier failure tests |
| REQ-201 / product add | `61-ui-receiving.md §61.5` | UI-02-D4 | product search/add UI | 0/1/multiple tests |
| REQ-201 / scanner | `61-ui-receiving.md §61.1`, `UI_TECH_STACK.md §5.3` | UI-02-D5 | focused field + Enter + focus return | Enter/focus tests + L3 |
| REQ-201 / rows | `61-ui-receiving.md §61.1` | UI-02-D6 | row utils | duplicate add tests |
| REQ-201 / quantities | `61-ui-receiving.md §61.5` | UI-02-D7 | validation/request builder | validation tests |
| REQ-201 / idempotency | `61-ui-receiving.md §61.1` | UI-02-D8 | idempotency lifecycle state | retry/edit key tests |
| REQ-201 / submit | `61-ui-receiving.md §61.3` | UI-02-D9 | pending state | disabled tests |
| REQ-201 / result | `61-ui-receiving.md §61.5` | UI-02-D10 | result panel | result tests |
| REQ-201 / list | `61-ui-receiving.md §61.5` | UI-02-D11 | recent list query | list state tests |
| REQ-201 / cache | `61-ui-receiving.md §61.7` | UI-02-D12 | mutation success invalidation | invalidation tests |
| REQ-201 / native | `61-ui-receiving.md §61.9` | UI-02-D13 | PR evidence | Windows native L3 |

## Test Plan

See `docs/plans/test-matrices/2026-06-25-ui02-implementation.md`.

## Boundary / Wire Contract

- producer: Rust CMD-02 `create_receiving`, `list_receivings`; CMD-01 `search_products`, `list_suppliers`; TanStack Router route.
- consumer: UI-02 React route/components/hooks and generated `src/lib/bindings.ts`。
- wire type: Tauri typed result `{ status: "ok", data } | { status: "error", error }` through generated `commands.*` wrappers.
- internal type: `ReceivingCreateRequest`, `ReceivingItemInput`, `ReceivingCreateResult`, `ReceivingRecordWithSupplier`, `ProductWithRelations`, `Supplier`, UI row state.
- precision/range: quantity integer `> 0`; cost_price integer yen `>= 0`; date `YYYY-MM-DD`; supplier nullable.
- compatibility: additive commands/types; existing receiving BIZ/CMD runtime behavior and DB schema unchanged.

## Review Focus

- UI uses generated `commands.*` only, no ad hoc invoke and no backend business rules in UI.
- Retry idempotency does not double receive on internal error.
- Editing after failure creates a new key before resubmit.
- Product add/search avoids accidental first-candidate selection.
- Save success invalidations cover stale inventory/product views without PLU dirty.
- Pending state and Japanese labels are clear for non-IT operator usage.

## Spec Contract

Contract ID: SPEC-UI02-REQ201-IMPLEMENTATION

- REQ-201: The operator can record received stock for one or more products, causing the existing BIZ-02 transaction to add inventory and operation logs.
- UI-02-D2: Frontend command calls use generated `commands.*`; no ad hoc invoke path.
- UI-02-D8: Same-content retry preserves `idempotency_key`; success/reset/edit-resubmit uses a new key.
- UI-02-D12: Save success invalidates receiving/product/inventory query caches and does not mark PLU dirty.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-201 / UI-02-D2 | generated command exposure | `cargo run --bin generate_bindings`, `npm run typecheck` | no ad hoc invoke, receiving commands present | `src/lib/bindings.ts` diff |
| UI-02-D4/D5 | product add flow | `ReceivingPage.test.tsx` 0/1/multiple/focus cases | no unsafe auto-select, focus return | RTL output |
| UI-02-D6/D7 | row merge and validation | `receiving-row-utils.test.ts`, `receiving-request.test.ts` | duplicate rows avoided, invalid numbers blocked | `npm test` |
| UI-02-D8 | idempotency lifecycle | `receiving-request.test.ts`, `ReceivingPage.test.tsx` retry/pending paths | same-content retry and edit-resubmit keys | `npm test` |
| UI-02-D9/D10 | pending/result UI | `ReceivingPage.test.tsx` pending/result cases | false cancel avoided, result evidence visible | RTL output |
| UI-02-D11/D12 | recent list and invalidation | `ReceivingPage.test.tsx` recent/invalidation cases | stale inventory prevention, no PLU dirty | query invalidation spy |
| UI-02-D13 | native operator check | Windows native L3 | scan-like entry, readability, save result | PR body / Implementation Results |

## Data Safety

- Do not commit `.env*`, credentials, local DB files, real POS CSV/PLU TSV/store exports, backups, logs, receipt images, or secrets.
- Tests use mocked commands, synthetic fixtures, or in-memory DB only.
- No destructive DB cleanup, migration rollback, or generated data deletion is in scope.

## Implementation Results

- Implemented generated command exposure for REQ-201 receiving:
  - added `#[specta::specta]` for `create_receiving` / `list_receivings`
  - added `specta::Type` to `ReceivingCreateRequest`, `ReceivingItemInput`, `ReceivingCreateResult`, and `ReceivingRecordWithSupplier`
  - added CMD-02 commands to `collect_commands!`
  - regenerated `src/lib/bindings.ts`
- Implemented `/inventory/receiving`:
  - route file: `src/routes/inventory/receiving.tsx`
  - navigation UI-02 active: `to: "/inventory/receiving"`
  - page flow: supplier/date/note header, product search add, candidate selection, row quantity/cost editing, save result, recent receiving list
  - duplicate product add increments quantity instead of adding another row
  - supplier query failure warns but allows `supplier_id=null`
  - successful save invalidates `queryKeys.receivings.root()`, `queryKeys.productList.root()`, `queryKeys.lowStock(false)`, and `queryKeys.stockInquiryRoot()`; `queryKeys.pluDirty()` is not invalidated
  - pending save disables editing/reset and hides the header "在庫照会へ戻る" action
- Added tests:
  - `receiving-row-utils.test.ts`: new row defaults and duplicate quantity increment
  - `receiving-request.test.ts`: request build, integer validation, content signature
  - `ReceivingPage.test.tsx`: product search 0/1/multiple, focus return, unsaved registration warning, supplier failure save, result/invalidation, pending state, same-content retry idempotency key reuse, edit-after-failure key renewal, recent list
- Gate evidence:
  - `cargo run --bin generate_bindings`: pass
  - `npm run generate:routes`: pass
  - `npm run typecheck`: pass
  - `npm run lint`: pass
  - `npm run format:check`: pass
  - `npm test`: pass, 63 files / 402 tests after review fixes
  - `npm run build`: pass; Vite keeps the existing >500 kB main chunk warning, UI-02 `receiving` chunk is 13.40 kB minified
  - `cargo fmt --check`: pass
  - `cargo clippy --all-targets --all-features -- -D warnings`: pass
  - `cargo test`: pass
  - `bash scripts/doc-consistency-check.sh --target plan`: pass with PK3 heuristic WARN only
  - `bash scripts/doc-consistency-check.sh`: pass with PK3 heuristic WARN only
- Manual / owner gate:
  - Windows native L3 completed by owner before merge: `/inventory/receiving` nav、focused product input + Enter、0/1/multiple candidates、duplicate quantity increment、supplier optional save、0件時の商品登録導線、validation、result summary、recent list、在庫照会へ戻る導線。
  - `pending` 中に header の「在庫照会へ戻る」が出ないことは、処理が速く native 目視確認が困難だったため manual pass ではなく RTL と実装ロック条件で pass とした。`ReceivingPage.test.tsx` holds `createReceiving` pending and confirms the header return action is absent while form controls are disabled.

## Review Response

- Implementation review-only sub-agent:
  - P2 accepted: 保存成功後も同じ明細を再度保存でき、成功時に更新された新 idempotency key で二重入庫になり得る。
    - 対応: `result !== null` をフォームロック条件に含め、成功後はフォーム本文・保存・リセット・ヘッダー戻りを操作不可にした。次の入力は「続けて入庫」だけに限定した。
    - 対応: `ReceivingPage.test.tsx` に成功後の再保存不可を追加した。
  - P2 accepted: 複数候補の「入庫に追加」ボタンが保存 pending 中も押せる。
    - 対応: 候補追加ボタンにも `disabled={isFormLocked}` を適用し、`addProduct` / `handleProductSearch` 側にも guard を追加した。
    - 対応: pending 中に候補追加ボタンが disabled になる RTL を追加した。
  - P3 accepted: 既存明細がある状態で未登録商品への「商品登録へ進む」が未保存警告なしで表示される。
    - 対応: 明細がある場合は「未保存の入庫内容があります。商品登録へ進むとこの画面の入力は残りません。」を表示する。
  - P3 accepted: idempotency key lifecycle の component coverage が薄い。
    - 対応: 同内容 retry は同 key、編集後 retry は新 key、成功後は再保存不可を `ReceivingPage.test.tsx` で固定した。
- Windows native L3 feedback:
  - accepted: 0件検索時の「商品登録へ進む」リンクだけでは、なぜ商品登録へ行くのか分かりにくい。
  - 対応: 0件検索時に「未登録商品の場合は、商品マスタに登録してから入庫記録に戻って追加します。」を追加し、リンクの意味を補足した。
  - manual pickup: 商品登録側の説明書でも、商品登録は商品マスタ作成と初期在庫の設定、入庫記録は通常仕入の在庫加算であることを明記する。`51-ui-product-form.md` に説明書作成時の注意として反映済み。
