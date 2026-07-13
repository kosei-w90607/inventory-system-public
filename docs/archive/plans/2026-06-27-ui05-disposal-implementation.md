# UI-05 廃棄・破損 Implementation Plan

## Risk

Risk: R3

Reason:
新規 operator-facing 画面、Tauri generated binding、廃棄・破損による在庫減算、query invalidation、Windows native L3 確認を含む。既存 backend BIZ/CMD/IO はあるが、frontend route と command binding の接続で回帰影響が出る。

## Goal

UI-05 廃棄・破損を実装し、販売や返品ではない理由で商品在庫を減らし、ロス原価と理由を帳面に残せるようにする。保存後は在庫照会へ確認導線を出し、直近の廃棄・破損記録を画面内で確認できるようにする。

## Scope

- `/inventory/disposal` route と `DisposalPage` を追加する。
- `createDisposal` / `listDisposals` を generated binding に出し、UI は generated `commands.*` のみを使う。
- 商品コード / JAN / 商品名の Enter 検索、1件自動追加、複数候補選択、0件時の商品登録導線を実装する。
- 明細ごとに種別（廃棄 / 破損 / その他）、数量、原価、理由を入力できるようにする。
- 同一 `product_code + disposal_type + reason` 再追加時は数量を加算し、種別または理由が違う場合は別行にする。
- 廃棄日、数量、原価、種別、理由 validation を日本語で表示する。
- 保存成功後に廃棄一覧・在庫系 query を invalidate し、保存結果と在庫照会への導線を表示する。
- 直近の廃棄・破損記録を `listDisposals(1, 10, null, null)` で表示する。
- Windows native L3 で UI-05 主要フローを確認する。

## Non-scope

- 廃棄・破損記録の詳細表示、編集、取消。
- 廃棄取消に伴う在庫復元。
- inline 商品登録。
- global barcode scan detection。
- cm / m 表示切替。
- ロス集計レポート、部門別ロス分析。
- 画像添付。

## Acceptance Criteria

- `src/routes/inventory/disposal.tsx` から `/inventory/disposal` が開き、`src/config/navigation.ts` の UI-05 が active route になる。
- `src/lib/bindings.ts` に `createDisposal` / `listDisposals` / `DisposalCreateRequest` / `DisposalCreateResult` / `DisposalRecordSummary` が生成され、UI に ad hoc invoke がない。
- `DisposalPage` の RTL で 1件自動追加、複数候補選択、0件時の商品登録導線、同一商品+種別+理由の数量加算、種別/数量/原価/理由 validation、保存結果、recent list、query invalidation を確認できる。
- RTL test `REQ-204 disables return and editing while saving` で、保存中は戻る / リセット / 入力 / 商品追加が disabled になり、未完了の処理を中断可能に見せないことを確認できる。
- 保存成功 result に `record_id`、明細数、ロス原価合計、在庫警告、`idempotent_replay` が表示される。
- `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` が通る。
- `cd src-tauri && cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`、`cargo run --bin generate_bindings`、`cargo run --bin generate_traceability -- --check` が通る。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が ERROR なしで通る。
- `Review Response` に review-only sub-agent の P1/P2 結果を記録し、P1/P2 が 0、または同 PR で修正済みになる。
- Windows native L3 で UI-05 の主要フローが確認される。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-204
- Architecture: `docs/ARCHITECTURE.md`、`docs/architecture/ui-task-specs.md` UI-05、`docs/architecture/cmd-task-specs.md` CMD-05、`docs/architecture/biz-task-specs.md` BIZ-02
- Function / command / DTO: `docs/function-design/64-ui-disposal.md`、`docs/function-design/31-biz-inventory-service.md` §12.6、`docs/function-design/44-cmd-inventory.md` §23.7、`docs/function-design/21-io-inventory-repo.md` §10.5
- DB: `docs/DB_DESIGN.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`、`docs/UI_TECH_STACK.md` §5.3、`docs/design-system/README.md`、`docs/design-system/01-decision-rules.md`、`docs/design-system/02-component-catalog.md`
- Decision log / ADR: `docs/decision-log.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `docs/function-design/31-biz-inventory-service.md`、`44-cmd-inventory.md`、`21-io-inventory-repo.md` | existing sufficient |
| Command / DTO / generated binding / wire shape | `docs/function-design/64-ui-disposal.md` §64.4 | updated in this PR |
| DB / transaction / audit / rollback / migration | `docs/DB_DESIGN.md`、`31-biz-inventory-service.md` | existing sufficient |
| Screen / UI / route state / Japanese wording | `docs/function-design/64-ui-disposal.md`、`docs/SCREEN_DESIGN.md` | updated in this PR |
| CSV / TSV / report / import / export format | none | intentionally deferred: UI-05 has no file format |
| Durable decision / ADR | `docs/function-design/64-ui-disposal.md` | updated in this PR; ADR not needed |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-204 | `64-ui-disposal.md` §64.1/§64.4 | UI-05-D2 | generated binding only; ad hoc invoke rejected | Rust specta annotations, `collect_commands!`, `bindings.ts`, `DisposalPage` | binding generation check, UI import path |
| REQ-204 | `64-ui-disposal.md` §64.1/§64.5 | UI-05-D5/D6 | UI-02/03/04 と同じ scan-like flow | product add input and candidates | RTL product search tests |
| REQ-204 | `64-ui-disposal.md` §64.1/§64.5 | UI-05-D3/D4/D7/D8 | 明細単位の種別/理由と validation | row utils, request validation, table controls | unit + RTL validation tests |
| REQ-204 | `64-ui-disposal.md` §64.1/§64.6 | UI-05-D9/D10 | 冪等性と保存中 lock | mutation flow and idempotency key lifecycle | RTL idempotency/pending tests |
| REQ-204 | `64-ui-disposal.md` §64.1/§64.7 | UI-05-D11/D12/D13/D14 | 保存後確認と在庫 cache 更新 | result panel, recent list, query invalidation | RTL invalidation/result + Windows L3 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `64-ui-disposal.md` に route、DTO、state、UI、error、cache、L3 を記載した。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none; route / row identity / cache / L3 は source doc に昇格済み。
- Assumptions and constraints: barcode scanner は HID keyboard 前提。廃棄・破損は売上帳票や PLU dirty を変えない。実 POS / 店舗データは使わない。
- Deferred design gaps, risk, and follow-up target: disposal detail/edit/cancel、stock restoration、inline product registration、global scan detection、loss report、image attachment は別設計。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: BIZ/CMD/IO の廃棄・破損処理、transaction、idempotency、DB persistence は既存設計と Rust tests がある。
- Source docs updated in this PR: `docs/function-design/64-ui-disposal.md`、`docs/FUNCTION_DESIGN.md`、`docs/SCREEN_DESIGN.md`
- Design gaps intentionally deferred: non-scope に記載。
- Durable decisions discovered in this plan and promoted to source docs: none beyond `64-ui-disposal.md`。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated command のみ、validation は UX 補助、最終判定は BIZ。
- Backend function design: existing `create_disposal` / `list_disposals`。
- Command / DTO / data contract: `DisposalCreateRequest` / `DisposalCreateResult` / `DisposalRecordSummary` を generated binding 化。
- Persistence / transaction / audit impact: BIZ が disposal_records、disposal_items、inventory_movements、operation log を単一 TX で扱う。
- Operator workflow / Japanese UI wording: `64-ui-disposal.md` §64.5。
- Error, empty, retry, and recovery behavior: `64-ui-disposal.md` §64.6。
- Testability and traceability IDs: FE/Rust tests に REQ-204 / UI-05-D* を付与する。

## Test Plan

Test Design Matrix: [test-matrices/2026-06-27-ui05-disposal-implementation.md](test-matrices/2026-06-27-ui05-disposal-implementation.md)

- targeted tests: row utils、request validation、DisposalPage RTL、binding generation、existing Rust disposal tests。
- negative tests: empty rows、quantity 0 / decimal、cost negative、reason empty、not found、command failure。
- compatibility checks: generated command shape、existing disposal backend tests、query key behavior。
- data safety checks: synthetic products only、no DB/log/backup/real POS data。
- main wiring/integration checks: route, navigation, `collect_commands!`, query invalidation, recent list, result links。

## Boundary / Wire Contract

- producer: `src-tauri/src/cmd/disposal_cmd.rs` / `src-tauri/src/biz/inventory_service/disposal.rs`
- consumer: `src/features/disposal/DisposalPage.tsx`
- wire type: `DisposalCreateRequest` / `DisposalCreateResult` / `DisposalRecordSummary` generated by Specta
- internal type: UI row state with `productCode`, `disposalType`, `quantity`, `costPrice`, `reason`; BIZ Rust structs
- precision/range: quantity integer `> 0`; cost_price integer `>= 0`; record_id is SQLite integer but displayed only
- round-trip path: UI form -> `commands.createDisposal` -> CMD -> BIZ -> DB -> result panel
- invalid input: blocked by FE validation and BIZ validation
- compatibility: no DB schema change; existing backend tests remain valid

## Review Focus

- UI が generated `commands.createDisposal` / `commands.listDisposals` のみを使い、ad hoc invoke に戻っていないか。
- 同一 idempotency key で異なる内容を送る UI path がないか。
- 明細一意性が `product_code + disposal_type + reason` で、理由違いを誤統合していないか。
- query invalidation が在庫系に効き、売上 / PLU dirty を不要に invalidation していないか。
- 保存中に戻る / リセット / 入力が可能に見えないか。
- operator-facing Japanese が短く、ロス理由や原価の意味を誤解させないか。

## Spec Contract

Contract ID: SPEC-UI05-REQ204-IMPLEMENTATION

- UI-05 must submit disposal records through generated `createDisposal` only.
- UI-05 must list recent disposal records through generated `listDisposals`.
- UI-05 must record disposal type, quantity, cost price, and reason per line item.
- UI-05 must create no duplicate row for the same product code, disposal type, and reason.
- UI-05 must show result and navigation paths that let the operator verify stock after saving.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-204 | route/navigation | `DisposalPage` route/navigation tests | UI route active | route file + navigation diff |
| REQ-204 | generated command | binding generation + typecheck | no ad hoc invoke | `bindings.ts` diff, `npm run typecheck` |
| REQ-204 | product add flow | RTL product search tests | 0/1/multiple behavior | Vitest output |
| REQ-204 | validation | request unit tests + RTL validation | Japanese errors | Vitest output |
| REQ-204 | idempotency/pending | RTL retry + pending tests | duplicate prevention / no cancel illusion | Vitest output |
| REQ-204 | result/cache/recent | RTL result/invalidation/recent tests | stock query freshness | Vitest output |
| REQ-204 | operator flow | Windows native L3 checklist | readability / state distinction | PR comment / final handoff |

## Data Safety

- Do not commit real POS CSV, store DB files, backups, logs, receipt images, or secrets.
- Local-only paths: `dist/`, `src-tauri/target/`, runtime DB/log directories.
- Synthetic-only paths: test fixtures and manual L3 sample data created for this PR.

## Implementation Results

- Added `docs/function-design/64-ui-disposal.md` and wired it from `docs/FUNCTION_DESIGN.md` / `docs/SCREEN_DESIGN.md`.
- Exposed generated disposal commands by adding Specta metadata for `DisposalCreateRequest` / `DisposalItemInput` / `DisposalCreateResult` / `DisposalRecordSummary`, registering `create_disposal` / `list_disposals` in `collect_commands!`, and regenerating `src/lib/bindings.ts`.
- Added `/inventory/disposal` route, navigation activation, query keys, `DisposalPage`, disposal row utilities, and disposal request validation.
- Implemented operator flow for 0/1/multiple product search results, line-level disposal type / quantity / cost / reason, duplicate merge by `product_code + disposal_type + reason`, different-reason separation, save result, recent list, and stock-related query invalidation.
- Added `src/features/disposal/DisposalPage.test.tsx` with REQ-204 RTL coverage for product search, duplicate merge, reason separation, validation, save result, recent list, pending lock, and query invalidation.
- Regenerated `docs/function-design/90-traceability.md`; REQ-204 moved from `rust-only` to `covered`.
- Registered `64-ui-disposal.md` as a UI-only doc in `src-tauri/tests/design_compliance_test.rs`.
- Added workflow source-doc guidance in `docs/DEV_WORKFLOW.md` and `docs/decision-log.md` D-020: new capabilities must be designed from the intended finished product shape before implementation PRs are sliced.

Verification:

- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS
- `npm run generate:routes` PASS
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm test -- --run src/features/disposal/DisposalPage.test.tsx` PASS（12 tests）
- `npm test` PASS（71 files / 452 tests）
- `npm run build` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（563 lib tests + integration/doc tests）
- `cd src-tauri && cargo run --bin generate_bindings` PASS
- `cd src-tauri && cargo run --bin generate_traceability` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）

Manual / L3 status:

- Windows native L3 completed by owner on 2026-06-27. Route/navigation, product search, candidate selection, no-match recovery, row merge/separation, validation, save result, recent record display, and stock-inquiry return path were checked.
- L3 found that the reason field accepted only one character because `rowId` changed on each reason edit and remounted the table row; fixed in this PR and covered by `REQ-204 keeps focus while typing a disposal reason`.
- L3 confirmed the fixed save flow: record ID, item count, loss total, stock reflection status, and recent disposal record display were visible after saving.

## Review Response

Review-only sub-agent: Helmholtz

- P2 accepted/fixed: idempotency key lifecycle was implemented but not directly tested. Added `REQ-204 keeps the idempotency key for same-content retry and rotates it after edits or reset`, covering same-content failure retry, edited retry, and next-record reset.
- P3 accepted/fixed: query invalidation test asserted required keys but not absence of unrelated sales / PLU keys. Added negative assertions for `["daily-sales"]`, `queryKeys.monthlySalesRoot()`, and `queryKeys.pluDirty()`.
- Additional self-review fix: late product-search results after save could add a row through a stale async response. Added `isFormLockedRef` guard and `REQ-204 ignores late product search results after the form is locked`.
- L3 feedback accepted/fixed: reason input lost focus after one character because `rowId` was derived from editable `reason` and used as the React table row key. Changed disposal rows to keep stable `rowId` values and compute duplicate merge identity separately from `productCode + disposalType + trimmed reason`. Added `REQ-204 keeps focus while typing a disposal reason`. Same-pattern scan found UI-02 / UI-03 / UI-04 use stable product/direction keys and do not derive React keys from editable reason text.

Post-review verification:

- `npm test -- --run src/features/disposal/DisposalPage.test.tsx` PASS（12 tests）
- `npm run lint` PASS
- `npm run format:check` PASS
- `bash scripts/doc-consistency-check.sh` PASS after the workflow docs follow-up commit
