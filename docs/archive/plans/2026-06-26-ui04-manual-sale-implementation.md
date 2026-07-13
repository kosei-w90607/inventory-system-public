# UI-04 手動販売出庫 Implementation Plan

## Risk

Risk: R3

Reason:
新規 operator-facing 画面、Tauri generated binding、手動販売の売上・在庫反映、PLU 登録済み確認、query invalidation、Windows native L3 確認を含む。既存 backend BIZ はあるが、frontend route と command binding の接続で回帰影響が出る。

## Goal

UI-04 手動販売出庫を実装し、レジCSVに入らない販売を手入力で売上記録・在庫減算へ反映できるようにする。保存後は日次売上と在庫照会へ確認導線を出し、PR #99 で持ち越した日次売上の「手動」Badge 可読性も L3 で確認する。

## Scope

- `/inventory/manual-sale` route と `ManualSalePage` を追加する。
- `createManualSale` を generated binding に出し、UI は generated `commands.createManualSale` のみを使う。
- 商品コード / JAN / 商品名の Enter 検索、1件自動追加、複数候補選択、0件時の商品登録導線を実装する。
- 同一商品再追加時に数量と販売金額を加算し、重複行を作らない。
- 販売日、理由、備考、数量、販売金額 validation を日本語で表示する。
- PLU登録済み警告時は `needs_confirmation` を保存完了にせず、同じ `idempotency_key` と `confirmation_token` で確認保存する。
- 保存成功後に在庫・売上系 query を invalidate し、保存結果と日次売上 / 在庫照会への導線を表示する。
- Windows native L3 で UI-04 と日次売上「手動」Badge を確認する。

## Non-scope

- 手動販売記録の一覧、詳細、編集、取消。
- 手動販売明細の CSV import。
- inline 商品登録。
- global barcode scan detection。
- cm / m 表示切替。
- PLU書出し画面への自動誘導。
- レシート添付。

## Acceptance Criteria

- `src/routes/inventory/manual-sale.tsx` から `/inventory/manual-sale` が開き、`src/config/navigation.ts` の UI-04 が active route になる。
- `src/lib/bindings.ts` に `createManualSale` / `ManualSaleCreateRequest` / `ManualSaleCreateResult` が生成され、UI に ad hoc invoke がない。
- `ManualSalePage` の RTL で 1件自動追加、複数候補選択、0件時の商品登録導線、同一商品数量加算、validation、PLU確認、保存結果、query invalidation を確認できる。
- RTL test `REQ-203 disables return and editing while saving` で、保存中は戻る / リセット / 入力 / 商品追加が disabled になり、未完了の処理を中断可能に見せないことを確認できる。
- 保存成功 result に `sale_id`、明細数、PLU警告件数、在庫警告、`idempotent_replay` が表示される。
- `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` が通る。
- `cd src-tauri && cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`、`cargo run --bin generate_traceability -- --check` が通る。
- `bash scripts/doc-consistency-check.sh` が ERROR なしで通る。
- `Review Response` に review-only sub-agent の P1/P2 結果を記録し、P1/P2 が 0、または同 PR で修正済みになる。
- Windows native L3 で UI-04 の主要フローと日次売上「手動」Badge が確認される。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-203
- Architecture: `docs/ARCHITECTURE.md`、`docs/architecture/ui-task-specs.md` UI-04、`docs/architecture/cmd-task-specs.md` CMD-04、`docs/architecture/biz-task-specs.md` BIZ-02
- Function / command / DTO: `docs/function-design/62-ui-manual-sale.md`、`docs/function-design/31-biz-inventory-service.md` §12.5、`docs/function-design/44-cmd-inventory.md` §23.6、`docs/function-design/21-io-inventory-repo.md`
- DB: `docs/DB_DESIGN.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`、`docs/UI_TECH_STACK.md` §5.3、`docs/design-system/README.md`、`docs/design-system/02-component-catalog.md`
- Decision log / ADR: `docs/decision-log.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `docs/function-design/31-biz-inventory-service.md`、`44-cmd-inventory.md`、`21-io-inventory-repo.md` | existing sufficient |
| Command / DTO / generated binding / wire shape | `docs/function-design/62-ui-manual-sale.md` §62.4 | updated in this PR |
| DB / transaction / audit / rollback / migration | `docs/DB_DESIGN.md`、`31-biz-inventory-service.md` | existing sufficient |
| Screen / UI / route state / Japanese wording | `docs/function-design/62-ui-manual-sale.md`、`docs/SCREEN_DESIGN.md` | updated in this PR |
| CSV / TSV / report / import / export format | none | intentionally deferred: UI-04 has no file format |
| Durable decision / ADR | `docs/function-design/62-ui-manual-sale.md` | updated in this PR; ADR not needed |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-203 | `62-ui-manual-sale.md` §62.1/§62.4 | UI-04-D2 | generated binding only; ad hoc invoke rejected | Rust specta annotations, `collect_commands!`, `bindings.ts`, `ManualSalePage` | binding generation check, UI import path |
| REQ-203 | `62-ui-manual-sale.md` §62.1/§62.5 | UI-04-D4/D5 | UI-02 と同じ scan-like flow | product add input and candidates | RTL product search tests |
| REQ-203 | `62-ui-manual-sale.md` §62.1/§62.5 | UI-04-D6/D7 | 重複行を避け、入力前に日本語 validation | row utils, request validation | unit + RTL validation tests |
| REQ-203 | `62-ui-manual-sale.md` §62.1/§62.6 | UI-04-D8/D9/D10 | PLU登録済み二重記録防止と冪等性 | mutation flow and idempotency key lifecycle | RTL PLU confirmation/idempotency tests |
| REQ-203 | `62-ui-manual-sale.md` §62.1/§62.7 | UI-04-D12/D13/D14 | 保存後確認と売上/在庫 cache 更新 | result panel, query invalidation, daily sales link | RTL invalidation/result + Windows L3 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `62-ui-manual-sale.md` に route、DTO、state、UI、error、cache、L3 を記載した。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none; route / confirmation / cache / L3 は source doc に昇格済み。
- Assumptions and constraints: barcode scanner は HID keyboard 前提。PLU登録済み確認で DB は未変更。実 POS / 店舗データは使わない。
- Deferred design gaps, risk, and follow-up target: manual sale list/detail/edit/cancel、inline product registration、global scan detection、receipt attachment は別 UI で扱う。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: BIZ/CMD/IO の手動販売処理、PLU token、idempotency、DB transaction は既存設計と Rust tests がある。
- Source docs updated in this PR: `docs/function-design/62-ui-manual-sale.md`、`docs/FUNCTION_DESIGN.md`、`docs/SCREEN_DESIGN.md`
- Design gaps intentionally deferred: non-scope に記載。
- Durable decisions discovered in this plan and promoted to source docs: none beyond `62-ui-manual-sale.md`。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated command のみ、validation は UX 補助、最終判定は BIZ。
- Backend function design: existing `create_manual_sale`。
- Command / DTO / data contract: `ManualSaleCreateRequest` / `ManualSaleCreateResult` を generated binding 化。
- Persistence / transaction / audit impact: BIZ が manual_sales、sale_records、inventory_movements、operation log を単一 TX で扱う。
- Operator workflow / Japanese UI wording: `62-ui-manual-sale.md` §62.5。
- Error, empty, retry, and recovery behavior: `62-ui-manual-sale.md` §62.6。
- Testability and traceability IDs: FE/Rust tests に REQ-203 / UI-04-D* を付与する。

## Test Plan

Test Design Matrix: [test-matrices/2026-06-26-ui04-manual-sale-implementation.md](test-matrices/2026-06-26-ui04-manual-sale-implementation.md)

- targeted tests: row utils、request validation、ManualSalePage RTL、binding generation、existing Rust manual sale tests。
- negative tests: empty rows、quantity 0 / decimal、amount negative、not found、PLU confirmation edit/retry。
- compatibility checks: generated command shape、daily sales date search param、existing manual sale backend tests。
- data safety checks: synthetic products only、no DB/log/backup/real POS data。
- main wiring/integration checks: route, navigation, `collect_commands!`, query invalidation, result links。

## Boundary / Wire Contract

- producer: `src-tauri/src/cmd/manual_sale_cmd.rs` / `src-tauri/src/biz/inventory_service/manual_sale.rs`
- consumer: `src/features/manual-sale/ManualSalePage.tsx`
- wire type: `ManualSaleCreateRequest` / `ManualSaleCreateResult` generated by Specta
- internal type: UI row state with `productCode`, `quantity`, `amount`; BIZ Rust structs
- precision/range: quantity integer `> 0`; amount integer `>= 0`; sale_id is SQLite integer but displayed only
- round-trip path: UI form -> `commands.createManualSale` -> CMD -> BIZ -> DB -> result panel
- invalid input: blocked by FE validation and BIZ validation
- compatibility: no DB schema change; existing backend tests remain valid

## Review Focus

- `needs_confirmation=true` を保存完了として扱っていないか。
- 同一 idempotency key で異なる内容を送る UI path がないか。
- query invalidation が在庫 / 売上に効き、PLU dirty を不要に invalidation していないか。
- 保存中に戻る / リセット / 入力が可能に見えないか。
- operator-facing Japanese が短く、誤解を招かないか。

## Spec Contract

Contract ID: SPEC-UI04-REQ203-IMPLEMENTATION

- UI-04 must submit manual sales through generated `createManualSale` only.
- UI-04 must not persist when PLU confirmation is required until the user confirms with the returned token.
- UI-04 must create no duplicate row for the same product code.
- UI-04 must show result and navigation paths that let the operator verify daily sales and stock.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-203 | route/navigation | `ManualSalePage` route/navigation tests | UI route active | route file + navigation diff |
| REQ-203 | generated command | binding generation + typecheck | no ad hoc invoke | `bindings.ts` diff, `npm run typecheck` |
| REQ-203 | product add flow | RTL product search tests | 0/1/multiple behavior | Vitest output |
| REQ-203 | validation | request unit tests + RTL validation | Japanese errors | Vitest output |
| REQ-203 | PLU confirmation | RTL confirmation tests + Rust tests | DB unchanged before confirm | Vitest/cargo output |
| REQ-203 | result/cache | RTL result/invalidation tests | daily/stock query freshness | Vitest output |
| REQ-203 | manual badge L3 | Windows native L3 checklist | badge readable | PR comment / final handoff |

## Data Safety

- Do not commit real POS CSV, store DB files, backups, logs, receipts, or secrets.
- Local-only paths: `dist/`, `src-tauri/target/`, runtime DB/log directories.
- Synthetic-only paths: test fixtures and manual L3 sample data created for this PR.

## Implementation Results

- Added `/inventory/manual-sale` route and activated UI-04 navigation.
- Added generated `createManualSale` binding by adding `specta::Type` to manual sale DTOs and `#[specta::specta]` / `collect_commands!` wiring.
- Added `ManualSalePage`, row/request helpers, and 16 frontend tests covering product add, duplicate merge, validation, stale row-error cleanup, PLU confirmation, idempotency token/key behavior, pending lock, result links, and query invalidation.
- Updated traceability so REQ-203 is `covered` by Rust and FE tests.
- Windows native L3: owner confirmed navigation, 1-match Enter add + focus return, duplicate merge, multi-candidate explicit add, no-match recovery link, validation messages, successful result, daily sales link, and daily sales `手動` Badge readability. PLU-registered manual confirmation could not be exercised with the local DB data and remains covered by BIZ tests + RTL PLU confirmation flow.
- L3 follow-up: owner found stale row validation errors after deleting an invalid row and re-adding the same product. Fixed UI-04 and the same UI-02 row-error pattern by clearing stale row/item errors only for changed/deleted line items, with regression tests for both REQ-203 and REQ-201. A follow-up review-only P3 noted that unchanged row errors must remain visible; accepted/fixed with additional tests. Windows native recheck passed: the stale error no longer remains after delete/re-add.
- Verification run:
  - `npm test -- --run src/features/manual-sale`: 3 files / 16 tests passed after stale row-error fix.
  - `npm test -- --run src/features/manual-sale/ManualSalePage.test.tsx`: 1 file / 11 tests passed after stale row-error fix.
  - `npm test -- --run src/features/receiving/ReceivingPage.test.tsx`: 1 file / 12 tests passed after same-pattern UI-02 stale row-error fix.
  - `npm test`: 66 files / 420 tests passed after stale row-error fix.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run format:check`: passed.
  - `npm run build`: passed with existing Vite >500 kB chunk warning.
  - `cd src-tauri && cargo fmt --check`: passed.
  - `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`: passed.
  - `cd src-tauri && cargo test`: passed.
  - `cd src-tauri && cargo run --bin generate_traceability -- --check`: OK with existing REQ-403 no-test WARN.
  - `bash scripts/doc-consistency-check.sh`: passed.
  - `bash scripts/check-env-safety.sh`: passed.

## Review Response

Review-only sub-agent completed with P1 0 / P2 1 / P3 1. Follow-up review-only pass for the L3 stale row-error fix completed with P1 0 / P2 0 / P3 1.

- P2 accepted/fixed: hidden the `商品登録へ進む` recovery link while a manual sale save is pending, and extended `REQ-203 disables return and editing while saving` to cover the link.
- P3 accepted/fixed: updated `docs/SCREEN_DESIGN.md` UI-04 status from `未着手` to implementation-in-progress.
- Follow-up P3 accepted/fixed: stale row-error cleanup now removes only changed/deleted row errors and preserves unchanged row errors, with UI-04 and UI-02 regression tests.

Residual before merge: PLU登録済み商品の実DB目視確認は未実施。local DB に PLU登録済み商品を用意できなかったため、BIZ/RTL coverage を証跡として受容する。
