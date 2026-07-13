# UI-02 入庫記録 Design Readiness Plan

## Risk

Risk: R3

Reason:
UI-02 は operator-facing の新規入出庫画面で、在庫数量を更新する CMD-02 / BIZ-02 契約、generated binding、route/navigation、商品検索、取引先候補、query invalidation、Windows native L3 に関わる。今回は実装前 Design Phase だが、次の implementation PR の runtime contract を決めるため R3 として扱う。

## Goal

REQ-201 / UI-02 入庫記録の実装前に、route、generated command、入庫ヘッダ/明細、商品追加/バーコード入力、冪等キー、保存中挙動、recent list、query invalidation、Windows native L3 を source design docs へ昇格する。

## Scope

- `docs/function-design/61-ui-receiving.md` を新設する。
- `docs/FUNCTION_DESIGN.md` に UI-02 を登録する。
- `docs/SCREEN_DESIGN.md` に入庫記録画面の operator-facing 設計を追加する。
- `docs/UI_TECH_STACK.md` §5.3 の UI-02 scanner 方針を、初回実装の責務に合わせて明確化する。
- `docs/function-design/21-io-inventory-repo.md` の `ListQuery.per_page` 上限記述を実装/CMD設計の100に同期する。
- UI-02 implementation 用の Test Design Matrix を作る。

## Non-scope

- Runtime code implementation。
- UI-02 React / route / Rust command の追加。
- 入庫伝票の詳細表示、編集、取消。
- inline 商品登録 / inline 取引先登録。
- グローバル barcode scan detection。
- cm / m 表示切替。
- 仕入先別原価履歴、発注書連携、納品書画像添付。

## Acceptance Criteria

- `docs/function-design/61-ui-receiving.md` に `UI-02-D1`〜`UI-02-D13` があり、why / rejected alternatives が source doc に残っている。
- `docs/SCREEN_DESIGN.md` に入庫記録画面があり、route、generated command、商品追加、取引先候補、冪等キー、保存中挙動、L3 が説明されている。
- `docs/UI_TECH_STACK.md` §5.3 が、UI-02 初回実装では HID 入力欄 + Enter + focus return を採用し、グローバル検知を非 scope と説明している。
- `docs/function-design/21-io-inventory-repo.md` と `docs/function-design/44-cmd-inventory.md` の `per_page` 上限が矛盾しない。
- `docs/plans/test-matrices/2026-06-25-ui02-design-readiness.md` が、次 implementation PR の failure modes を UI-02 decision IDs に結び付けている。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が通る。

## Design Sources

- Requirements / spec: `docs/inventory_system_v2.1.xlsx` REQ-201, `docs/architecture/ui-task-specs.md` UI-02
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`, `docs/architecture/cmd-task-specs.md`, `docs/architecture/biz-task-specs.md`
- Function / command / DTO: `docs/function-design/31-biz-inventory-service.md`, `docs/function-design/44-cmd-inventory.md`, `docs/function-design/21-io-inventory-repo.md`, `docs/function-design/40-cmd-product.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/52-ui-shared-layout.md`, `docs/design-system/02-component-catalog.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `31-biz-inventory-service.md`, `44-cmd-inventory.md`, `21-io-inventory-repo.md` | Existing sufficient, with `21-io-inventory-repo.md` per_page wording synced to current CMD/BIZ. |
| Command / DTO / generated binding / wire shape | `44-cmd-inventory.md`, `61-ui-receiving.md` | Updated in this PR: generated `createReceiving` / `listReceivings` requirement and DTO list. |
| DB / transaction / audit / rollback / migration | `db-design/transaction-tables.md`, `tracking-system-tables.md`, `31-biz-inventory-service.md` | Existing sufficient. No schema/migration change. |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `61-ui-receiving.md`, `UI_TECH_STACK.md` | Updated in this PR: route, form behavior, scanner scope, errors, L3. |
| CSV / TSV / report / import / export format | None | Intentionally not applicable. |
| Durable decision / ADR | `61-ui-receiving.md`, `SCREEN_DESIGN.md` | Updated in source docs. No separate ADR needed because decisions are UI-02-local. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-201 / UI-02 | `61-ui-receiving.md §61.1` | UI-02-D1 | 入出庫 route を独立。query mode は不採用。 | `/inventory/receiving` route, navigation | route/nav tests |
| REQ-201 / CMD-02 | `61-ui-receiving.md §61.4` | UI-02-D2 | generated commands only。ad hoc invoke は不採用。 | specta derives, collect_commands, bindings | binding/typecheck |
| REQ-201 / suppliers | `61-ui-receiving.md §61.1` | UI-02-D3 | complete supplier master data。inline create は deferred。 | `listSuppliers` query | supplier failure tests |
| REQ-201 / product add | `61-ui-receiving.md §61.5` | UI-02-D4 | 検索/候補/登録導線。inline 商品登録は不採用。 | product add component/hook | search result tests |
| REQ-201 / scanner | `61-ui-receiving.md §61.1`, `UI_TECH_STACK.md §5.3` | UI-02-D5 | HID field + Enter。global detection は deferred。 | focus management | Enter/focus tests + L3 |
| REQ-201 / rows | `61-ui-receiving.md §61.1` | UI-02-D6 | 同一商品は数量加算。重複行は不採用。 | row reducer/utils | duplicate add tests |
| REQ-201 / quantities | `61-ui-receiving.md §61.5` | UI-02-D7 | 整数数量/原価を保存前 validation。 | validation schema | negative tests |
| REQ-201 / idempotency | `61-ui-receiving.md §61.1` | UI-02-D8 | 同内容 retry は同 key。成功/リセット/編集再送で新 key。 | request builder/form state | retry/edit key tests |
| REQ-201 / submit | `61-ui-receiving.md §61.3` | UI-02-D9 | 保存中 cancel 風 UI は不採用。 | pending state | disabled tests |
| REQ-201 / result | `61-ui-receiving.md §61.5` | UI-02-D10 | record_id/warnings/replay を表示。 | result panel | result tests |
| REQ-201 / list | `61-ui-receiving.md §61.5` | UI-02-D11 | recent list だけ。詳細/取消は deferred。 | `listReceivings` query | list states tests |
| REQ-201 / cache | `61-ui-receiving.md §61.7` | UI-02-D12 | 在庫系 query invalidate。`receivings` query key helper 追加。PLU dirty は不要。 | mutation success / query-key helper | invalidation tests |
| REQ-201 / native | `61-ui-receiving.md §61.9` | UI-02-D13 | 連続入力/日本語/フォーカスは L3 必須。 | PR evidence | Windows native L3 |

## Design Readiness

- Existing design docs are sufficient because: BIZ-02 / CMD-02 create/list contracts and DB transaction tables already exist; UI-02 needs frontend-facing command exposure and operator workflow definition.
- Source docs updated in this PR: `61-ui-receiving.md`, `FUNCTION_DESIGN.md`, `SCREEN_DESIGN.md`, `UI_TECH_STACK.md`, `21-io-inventory-repo.md`。
- Design gaps intentionally deferred: inline master creation、global scan detection、cm/m display toggle、伝票詳細/取消、画像添付。
- Durable decisions discovered in this plan and promoted to source docs: all UI-02-D1〜D13 decisions promoted to `61-ui-receiving.md` and summarized in `SCREEN_DESIGN.md`。

## Test Plan

See `docs/plans/test-matrices/2026-06-25-ui02-design-readiness.md`.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-02-D1 | route design | route/nav tests | route belongs to inventory area | `61-ui-receiving.md §61.1` |
| UI-02-D2 | generated command design | `grep-bindings-ui02-commands` | no ad hoc invoke | `61-ui-receiving.md §61.4` |
| UI-02-D3 | supplier candidates | supplier options tests | complete master data, optional failure | `61-ui-receiving.md §61.1` |
| UI-02-D4 | product add flow | product search component tests | 0/1/multiple result handling | `61-ui-receiving.md §61.5` |
| UI-02-D5 | scanner scope | Enter/focus tests + L3 | focused field only, no global detection | `UI_TECH_STACK.md §5.3` |
| UI-02-D6 | row merge behavior | row utils tests | duplicate product quantity increment | `61-ui-receiving.md §61.1` |
| UI-02-D7 | validation | validation tests | invalid quantity/cost/date blocked before CMD | `61-ui-receiving.md §61.5` |
| UI-02-D8 | idempotency | request builder tests | retry key reuse, edit/reset new key | `61-ui-receiving.md §61.1` |
| UI-02-D9 | pending state | pending component tests | cancel/reset/back not shown as available | `61-ui-receiving.md §61.3` |
| UI-02-D10 | result display | result panel tests | saved evidence visible | `61-ui-receiving.md §61.5` |
| UI-02-D11 | recent list | recent list tests | list states and perPage 10 | `61-ui-receiving.md §61.5` |
| UI-02-D12 | cache invalidation | mutation success tests | inventory/product stock stale prevention | `61-ui-receiving.md §61.7` |
| UI-02-D13 | native verification | Windows native L3 | continuous input/focus/Japanese UI | `61-ui-receiving.md §61.9` |

## Data Safety

- Do not commit `.env*`, credentials, local DB files, real POS CSV/PLU TSV/store exports, backups, logs, receipt images, or secrets.
- This Design Readiness PR changes docs only; no runtime DB write, migration, POS/CSV/PLU/report behavior, or local data operation is in scope.
- Future implementation tests must use mocked commands, synthetic fixtures, or in-memory DB only.

## Boundary / Wire Contract

- producer: Rust CMD-02 `create_receiving`, `list_receivings`; CMD-01 `search_products`, `list_suppliers`; TanStack Router route.
- consumer: UI-02 React route/components/hooks and generated `src/lib/bindings.ts`。
- wire type: Tauri typed result `{ status: "ok", data } | { status: "error", error }`; route path.
- internal type: `ReceivingCreateRequest`, `ReceivingItemInput`, `ReceivingCreateResult`, `ReceivingRecordWithSupplier`, `ProductWithRelations`, `Supplier`, UI row state.
- precision/range: quantity integer `> 0`; cost_price integer yen `>= 0`; date `YYYY-MM-DD`; supplier nullable.
- compatibility: additive commands/types; existing receiving BIZ/CMD runtime behavior and DB schema unchanged.

## Review Focus

- Does the design close the generated binding gap for CMD-02?
- Is retry idempotency handled without double receiving?
- Does product add/search avoid inline master mutation while still giving recovery?
- Is scanner scope honest and testable for initial implementation?
- Are save success invalidations sufficient without wrongly marking PLU dirty?
- Are validation and pending states understandable for a non-IT operator?

## Spec Contract

Contract ID: SPEC-UI-02-DESIGN-READINESS-2026-06-25

- REQ-201 create receiving uses existing BIZ-02 transaction contract and generated command bindings.
- UI-02 product and supplier candidates come from existing generated product commands.
- UI-02 preserves idempotency key across retry and generates a new one only after success/reset/new form.
- UI-02 initial scanner support is focused input + Enter, not global detection.
- Windows native L3 is planned for implementation PR because continuous input and focus return are in scope.

## Review Response

- review-only sub-agent: P2 1 件、P3 1 件。
- P2 accepted: 冪等キー生成責務が `61-ui-receiving.md` と既存 `31-biz-inventory-service.md` で矛盾していた。
  - 対応: `31-biz-inventory-service.md` の `ReceivingCreateRequest.idempotency_key` を、UI/caller が安定キーを生成し CMD は中継、BIZ は検証する契約に同期した。
- P3 accepted: 保存失敗後に同じ `idempotency_key` のまま入力編集して再送する扱いが曖昧だった。
  - 対応: 同内容 retry は同 key、編集再送は新 key とする方針を `61-ui-receiving.md` / Plan / Test Matrix に追加した。
  - 対応: `queryKeys.receivings.*` は実装 PR で追加する helper と明記した。
