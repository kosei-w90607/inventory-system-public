# UI-03 返品・交換 Design Readiness Plan

## Risk

Risk: R3

Reason:
UI-03 は operator-facing の新規返品・交換画面で、在庫数量を更新し得る CMD-03 / BIZ-02 契約、generated binding、route/navigation、商品検索、レシート画像保存、query invalidation、Windows native L3 に関わる。今回は実装前 Design Phase だが、次の implementation PR の runtime contract を決めるため R3 として扱う。

## Goal

REQ-202 / UI-03 返品・交換の実装前に、route、generated command、レジ戻し済み分岐、返品/交換明細、レシート画像添付、商品追加/バーコード入力、冪等キー、保存中挙動、recent list、query invalidation、Windows native L3 を source design docs へ昇格する。

## Scope

- `docs/function-design/63-ui-return-exchange.md` を新設する。
- `docs/FUNCTION_DESIGN.md` に UI-03 を登録する。
- `docs/SCREEN_DESIGN.md` に返品・交換画面の operator-facing 設計を追加する。
- `docs/UI_TECH_STACK.md` §5.3 / §6.5.4 / §6.7 を UI-03 初回実装の scanner / receipt image 方針に同期する。
- UI-03 implementation 用の Test Design Matrix を作る。

## Non-scope

- Runtime code implementation。
- UI-03 React / route / Rust command の追加。
- 返品・交換記録の詳細表示、編集、取消、画像再表示。
- 保存済み receipt image の削除 / orphan cleanup。
- `createReturn` と画像保存を単一 command / 擬似TX にまとめる再設計。
- `@tauri-apps/plugin-dialog` + filesystem plugin による path-based 画像選択。
- inline 商品登録。
- グローバル barcode scan detection。
- cm / m 表示切替。
- 返品・交換と売上帳票の連動表示。

## Acceptance Criteria

- `docs/function-design/63-ui-return-exchange.md` に `UI-03-D1`〜`UI-03-D18` があり、why / rejected alternatives が source doc に残っている。
- `docs/SCREEN_DESIGN.md` に返品・交換画面があり、route、generated command、レジ戻し済み分岐、商品追加、画像添付、冪等キー、保存中挙動、L3 が説明されている。
- `docs/UI_TECH_STACK.md` §5.3 が、UI-03 初回実装では HID 入力欄 + Enter + focus return を採用し、グローバル検知を非 scope と説明している。
- `docs/UI_TECH_STACK.md` §6.5.4 / §6.7 が、UI-03 初回実装では bytes が必要なため file input/drop を使い、plugin-dialog path-based input と保存済み画像表示/リサイズを deferred と説明している。
- `docs/plans/test-matrices/2026-06-26-ui03-design-readiness.md` が、次 implementation PR の failure modes を UI-03 decision IDs に結び付けている。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が通る。

## Design Sources

- Requirements / spec: `docs/inventory_system_v2.1.xlsx` REQ-202, `docs/spec/requirements.md`, `docs/architecture/ui-task-specs.md` UI-03
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`, `docs/architecture/cmd-task-specs.md`, `docs/architecture/biz-task-specs.md`, `docs/architecture/io-task-specs.md`
- Function / command / DTO: `docs/function-design/28-io-image-manager.md`, `docs/function-design/31-biz-inventory-service.md`, `docs/function-design/43-cmd-settings-log.md`, `docs/function-design/44-cmd-inventory.md`, `docs/function-design/63-ui-return-exchange.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/52-ui-shared-layout.md`, `docs/design-system/02-component-catalog.md`
- Decision log / ADR: none. Decisions are UI-03-local and promoted to source docs.

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `31-biz-inventory-service.md`, `43-cmd-settings-log.md`, `44-cmd-inventory.md`, `28-io-image-manager.md` | Updated in this PR: return/exchange direction rules are BIZ-02 validation, not UI-only. Existing create/list/image save runtime remains otherwise sufficient. UI-facing generated exposure is added in `63-ui-return-exchange.md`. |
| Command / DTO / generated binding / wire shape | `44-cmd-inventory.md`, `43-cmd-settings-log.md`, `63-ui-return-exchange.md` | Updated in this PR: generated `createReturn` / `listReturns` / `saveReceiptImage` requirement and DTO list. |
| DB / transaction / audit / rollback / migration | `db-design/transaction-tables.md`, `tracking-system-tables.md`, `31-biz-inventory-service.md` | Existing sufficient. No schema/migration change. File-save + DB-save non-transactional residual risk is documented in `63-ui-return-exchange.md`. |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `63-ui-return-exchange.md`, `UI_TECH_STACK.md` | Updated in this PR: route, form behavior, scanner scope, image attach, errors, L3. |
| CSV / TSV / report / import / export format | None | Intentionally not applicable. |
| Durable decision / ADR | `63-ui-return-exchange.md`, `SCREEN_DESIGN.md`, `UI_TECH_STACK.md` | Updated in source docs. No separate ADR needed because decisions are UI-03-local or UI_TECH corrections for this screen. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-202 / UI-03 | `63-ui-return-exchange.md §63.1` | UI-03-D1 | Route agreement uses `/inventory/return`; query mode not used. | `/inventory/return` route, navigation | route/nav tests |
| REQ-202 / CMD-03 | `63-ui-return-exchange.md §63.4` | UI-03-D2 | generated commands only; ad hoc invoke rejected. | specta derives, collect_commands, bindings | binding/typecheck |
| REQ-202 / image | `63-ui-return-exchange.md §63.4` | UI-03-D3 | existing image command returns relative path; combined command deferred. | `saveReceiptImage` binding + mutation sequence | image save tests |
| REQ-202 / image input | `63-ui-return-exchange.md §63.5`, `UI_TECH_STACK.md §6.5.4` | UI-03-D4 | bytes are required, plugin-dialog path-only input deferred. | file input/drop, base64 builder | receipt image tests |
| REQ-202 / image retry | `63-ui-return-exchange.md §63.6` | UI-03-D5 | avoid repeated image saves after create failure. | saved receipt path state | retry tests |
| REQ-202 / return type | `31-biz-inventory-service.md §12.4`, `63-ui-return-exchange.md §63.5` | UI-03-D6 / D7 | return/exchange semantics visible; ambiguous exchange rejected at UI and BIZ boundary. | BIZ validation, return type controls, row validation | Rust BIZ negative tests + frontend validation tests |
| REQ-202 / register_processed | `63-ui-return-exchange.md §63.5` | UI-03-D8 | prevent double counting by text + Badge. | status explanation | visibility tests + L3 |
| REQ-202 / product add | `63-ui-return-exchange.md §63.5` | UI-03-D9 / D10 | UI-02/UI-04 scan-like flow; global detection deferred. | product search/add | product search tests + L3 |
| REQ-202 / rows | `63-ui-return-exchange.md §63.1` | UI-03-D11 | product+direction uniqueness preserves exchange meaning. | row utils | duplicate/direction tests |
| REQ-202 / validation | `63-ui-return-exchange.md §63.6` | UI-03-D12 | frontend stops operator errors before CMD. | request builder/form state | negative tests |
| REQ-202 / idempotency | `63-ui-return-exchange.md §63.3` | UI-03-D13 | same retry key; edit/image/note new attempt. | request builder/form state | key lifecycle tests |
| REQ-202 / submit | `63-ui-return-exchange.md §63.3` | UI-03-D14 | image save + DB save must not look cancellable. | pending state | disabled tests |
| REQ-202 / result | `63-ui-return-exchange.md §63.5` | UI-03-D15 | saved evidence visible. | result panel | result tests |
| REQ-202 / list | `63-ui-return-exchange.md §63.5` | UI-03-D16 | recent list only; details/cancel deferred. | `listReturns` query | list states tests |
| REQ-202 / cache | `63-ui-return-exchange.md §63.7` | UI-03-D17 | stock invalidation only when this screen changes stock. | mutation success / query keys | invalidation tests |
| REQ-202 / native | `63-ui-return-exchange.md §63.9` | UI-03-D18 | image/input/register status need real visual check. | PR evidence | Windows native L3 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `63-ui-return-exchange.md`, `SCREEN_DESIGN.md`, and `UI_TECH_STACK.md` carry the durable UI-03 decisions.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-03-D1〜D18 were promoted to `63-ui-return-exchange.md`; image input/resizing reality was promoted to `UI_TECH_STACK.md`.
- Assumptions and constraints: existing `create_return`, `list_returns`, and `save_receipt_image` runtime commands remain; image save and DB save cannot share one TX in initial UI-03; tests use synthetic images only.
- Deferred design gaps, risk, and follow-up target: image cleanup/orphan handling, saved image display, native dialog + filesystem read, image resize/compression, return detail/edit/cancel.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, see `docs/plans/test-matrices/2026-06-26-ui03-design-readiness.md`.

## Design Readiness

State whether the design is ready for implementation.

- Existing design docs are sufficient because: BIZ-02 / CMD-03 create/list contracts, DB transaction tables, and IO-06 image save contract already exist after this PR clarifies return/exchange direction validation in BIZ-02.
- Source docs updated in this PR: `63-ui-return-exchange.md`, `FUNCTION_DESIGN.md`, `SCREEN_DESIGN.md`, `UI_TECH_STACK.md`.
- Design gaps intentionally deferred: image cleanup / saved image display / native path input / image resize / detail-edit-cancel / inline product creation / global scanner detection / cm-m display toggle.
- Durable decisions discovered in this plan and promoted to source docs: all UI-03-D1〜D18 decisions promoted to `63-ui-return-exchange.md`, with screen summary in `SCREEN_DESIGN.md` and image/scanner constraints in `UI_TECH_STACK.md`.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI builds DTO and calls generated CMD; CMD delegates to BIZ or IO/MNT image command; BIZ owns stock movement and return validation.
- Backend function design: existing `list_returns` and `save_receipt_image` are sufficient for initial UI-03; `create_return` needs the clarified BIZ validation for return/out and exchange one-sided requests in the implementation PR. Generated exposure remains to implement.
- Command / DTO / data contract: `ReturnCreateRequest`, `ReturnItemInput`, `ReturnCreateResult`, `ReturnRecordSummary`, `SaveImageRequest`, `SaveImageResponse` listed in source doc.
- Persistence / transaction / audit impact: no schema change; DB save remains BIZ TX; image save is separate and retry behavior is explicit.
- Operator workflow / Japanese UI wording: register processed status and direction meaning are Japanese labels, not color-only.
- Error, empty, retry, and recovery behavior: covered in `63-ui-return-exchange.md §63.6`.
- Testability and traceability IDs: UI-03-D1〜D18 map to matrix rows.

## Test Plan

See `docs/plans/test-matrices/2026-06-26-ui03-design-readiness.md`.

- targeted tests: route/nav, generated binding, row utils, request builder, image builder, page component.
- negative tests: invalid type/direction/date/quantity/image extension, exchange missing side, return with out row. Return/exchange semantic negatives must include Rust BIZ tests, not only frontend tests.
- compatibility checks: existing valid BIZ/CMD runtime tests continue; return semantic Rust tests are added/updated; no DB schema change.
- data safety checks: synthetic image bytes only; no real receipt images.
- main wiring/integration checks: `collect_commands!`, `generate_handler!`, generated `bindings.ts`, route and navigation.

## Boundary / Wire Contract

- producer: Rust CMD-03 `create_return`, `list_returns`; CMD-11 `save_receipt_image`; CMD-01 `search_products`; TanStack Router route.
- consumer: UI-03 React route/components/hooks and generated `src/lib/bindings.ts`.
- wire type: Tauri typed result `{ status: "ok", data } | { status: "error", error }`; route path.
- internal type: `ReturnCreateRequest`, `ReturnItemInput`, `ReturnCreateResult`, `ReturnRecordSummary`, `SaveImageRequest`, `SaveImageResponse`, `ProductWithRelations`, UI row/image state.
- precision/range: quantity integer `> 0`; date `YYYY-MM-DD`; generated extension field is `string` with frontend allowlist `jpg|jpeg|png|gif|webp`; `image_base64` string.
- round-trip path: file input/drop -> base64 -> `saveReceiptImage` -> relative path -> `createReturn.receipt_image_path` -> result/recent list.
- invalid input: bad date/type/direction/return-out/exchange-one-sided/quantity/image extension/base64 yields validation before or at command boundary. Return/exchange semantic violations are rejected by BIZ even if the UI misses them.
- compatibility: additive commands/types in generated bindings; valid return BIZ/CMD runtime behavior and DB schema unchanged. Invalid return/out and one-sided exchange requests become explicit validation errors.

## Review Focus

- Does the design close the generated binding gap for CMD-03 and image command?
- Is register processed wording sufficient to avoid double stock counting?
- Are return vs exchange row rules coherent and testable?
- Is image save + DB save non-transactional behavior explicit enough for retry and residual risk?
- Does idempotency handle image/note edits safely despite BIZ fingerprint exclusion?
- Are invalidations precise enough to avoid stale stock without unnecessary PLU/sales invalidation?

## Spec Contract

Contract ID: SPEC-UI-03-DESIGN-READINESS-2026-06-26

- REQ-202 create return uses existing BIZ-02 transaction contract and generated command bindings.
- UI-03 product candidates come from existing generated product search.
- UI-03 optional receipt image uses existing `saveReceiptImage` bytes-to-relative-path command before `createReturn`.
- UI-03 preserves idempotency key across same-content retry and generates a new one after success/reset/edit/image/note change.
- UI-03 initial scanner support is focused input + Enter, not global detection.
- Windows native L3 is planned for implementation PR because register status meaning, image input, continuous input, and focus return are in scope.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-03-D1 | route design | route/nav tests | route belongs to inventory area | `63-ui-return-exchange.md §63.1` |
| UI-03-D2 | generated command design | `grep-bindings-ui03-commands` | no ad hoc invoke | `63-ui-return-exchange.md §63.4` |
| UI-03-D3/D4 | image save/input design | image builder/component tests | bytes input vs plugin-dialog path input | `63-ui-return-exchange.md §63.4`, `UI_TECH_STACK.md §6.5.4` |
| UI-03-D5 | image retry design | retry component tests | no repeated image save after create failure | `63-ui-return-exchange.md §63.6` |
| UI-03-D6/D7 | return/exchange semantics | Rust BIZ tests + frontend validation tests | return/out and exchange missing side blocked at BIZ and UI | `31-biz-inventory-service.md §12.4`, `63-ui-return-exchange.md §63.5` |
| UI-03-D8 | register processed wording | visibility tests + L3 | double-counting explanation visible | `63-ui-return-exchange.md §63.5` |
| UI-03-D9/D10 | product add/scanner | product search tests + L3 | 0/1/multiple result handling and focus return | `63-ui-return-exchange.md §63.5` |
| UI-03-D11 | row merge behavior | row utils tests | product+direction uniqueness | `63-ui-return-exchange.md §63.1` |
| UI-03-D12 | validation | request builder tests | invalid input blocked before CMD | `63-ui-return-exchange.md §63.6` |
| UI-03-D13 | idempotency | request/key lifecycle tests | retry/edit/image/note key behavior | `63-ui-return-exchange.md §63.3` |
| UI-03-D14 | pending state | pending component tests | image/DB save not cancellable-looking | `63-ui-return-exchange.md §63.3` |
| UI-03-D15 | result display | result panel tests | saved evidence visible | `63-ui-return-exchange.md §63.5` |
| UI-03-D16 | recent list | recent list tests | list states and perPage 10 | `63-ui-return-exchange.md §63.5` |
| UI-03-D17 | cache invalidation | mutation success tests | returns always, stock only when register_processed=false | `63-ui-return-exchange.md §63.7` |
| UI-03-D18 | native verification | Windows native L3 | image/input/register status visible in native app | `63-ui-return-exchange.md §63.9` |

## Data Safety

Required for R3/R4.

- Do not commit `.env*`, credentials, local DB files, real POS CSV/PLU TSV/store exports, backups, logs, receipt images, or secrets.
- This Design Readiness PR changes docs only; no runtime DB write, migration, POS/CSV/PLU/report behavior, image file operation, or local data operation is in scope.
- Future implementation tests must use mocked commands, synthetic fixtures, in-memory DB, or tiny synthetic image bytes only.

## Implementation Results

Fill after implementation.

## Review Response

Review-only sub-agent findings:

- P2 accepted: return/exchange row rules were UI-only. Source docs now promote `return => in only` and `exchange => in/out both required` to BIZ-02 validation, with CMD-03 passing through BIZ validation errors and the implementation Test Matrix requiring Rust BIZ negative tests.
- P3 accepted: `saveReceiptImage.extension` is a Rust/generated `string`, not a generated enum. Source docs and Test Matrix now state that the frontend helper owns the allowlist precheck while CMD/IO retain final validation.
