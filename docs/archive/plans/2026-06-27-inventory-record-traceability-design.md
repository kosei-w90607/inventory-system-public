# 入出庫記録・在庫変動追跡 Design Phase Plan

## Risk

Risk: R3

Reason:
入出庫系の業務記録、在庫変動履歴、操作ログ、DB schema 方針、Tauri command DTO、operator-facing route / navigation にまたがる横断設計。実装はまだ行わないが、後続実装の source contract になる。

## Goal

商業用在庫管理として、入庫・返品交換・手動販売出庫・廃棄破損・CSV取込み・棚卸し補正を後から追跡できる完成形を source docs に定義する。作成画面の recent list と、業務記録一覧/詳細・在庫変動履歴・操作ログの役割を分ける。

## Scope

- REQ-206 / REQ-207 / REQ-208 を Design Phase 補足要求として追加する。
- 入出庫業務記録、在庫変動履歴、操作ログの役割分担を定義する。
- 完成形 route、一覧検索、詳細表示、相互リンク、取消/訂正、CSV出力、印刷、画像添付の設計方針を source docs に置く。
- DB 完成形として record status、取消/訂正、逆方向 movement、operation_logs の扱いを定義する。
- 後続実装 PR の分割順を提案する。
- UI-05 PR #110 の完了済み Plan Packet / Test Matrix を archive へ移す。

## Non-scope

- DB migration 実装。
- Rust command / BIZ / IO 実装。
- React route / UI 実装。
- Excel 原本 `docs/inventory_system_v2.1.xlsx` の編集。
- GitHub PR 作成。

## Acceptance Criteria

- `docs/spec/requirements.md` に REQ-206 / REQ-207 / REQ-208 が `coverage=deferred` で追加される。
- `docs/function-design/65-inventory-record-traceability.md` が入出庫記録・在庫変動追跡の完成形を説明する。
- `docs/DB_DESIGN.md` と `docs/db-design/*` が取消/訂正/operation_logs 役割分担の入口を持つ。
- `docs/SCREEN_DESIGN.md` と `docs/function-design/52-ui-shared-layout.md` が `入出庫履歴` と在庫変動リンク方針を持つ。
- UI-05 Plan Packet / Test Matrix が `docs/archive/plans/` 配下へ移動される。
- `bash scripts/doc-consistency-check.sh` が PASS する。
- `cd src-tauri && cargo run --bin generate_traceability -- --check` が PASS する。

## Design Sources

- Requirements / spec: `docs/inventory_system_v2.1.xlsx`, `docs/spec/requirements.md`
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`, `docs/architecture/cmd-task-specs.md`, `docs/architecture/biz-task-specs.md`
- Function / command / DTO: `docs/function-design/21-io-inventory-repo.md`, `docs/function-design/31-biz-inventory-service.md`, `docs/function-design/44-cmd-inventory.md`, `docs/function-design/55-ui-csv-import.md`, `docs/function-design/61-ui-receiving.md`, `docs/function-design/62-ui-manual-sale.md`, `docs/function-design/63-ui-return-exchange.md`, `docs/function-design/64-ui-disposal.md`, `docs/function-design/72-mnt-log-manager.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`, `docs/db-design/pos-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/function-design/52-ui-shared-layout.md`
- Decision log / ADR: `docs/decision-log.md` D-020

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `docs/function-design/65-inventory-record-traceability.md`, existing BIZ/CMD docs | updated in this PR |
| Command / DTO / generated binding / wire shape | `65-inventory-record-traceability.md` §65.7 | updated in this PR |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `transaction-tables.md`, `tracking-system-tables.md` | updated in this PR |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `52-ui-shared-layout.md`, `65-inventory-record-traceability.md` | updated in this PR |
| CSV / TSV / report / import / export format | `65-inventory-record-traceability.md` §65.9 | updated in this PR |
| Durable decision / ADR | `decision-log.md` D-020 | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-206 | `65-inventory-record-traceability.md` §65.1/§65.3/§65.4/§65.5 | TRACE-D1/D7/D8/D9/D10 | recent list だけでは商業用の追跡に不足 | records list/detail routes | future RTL + Rust list/detail tests |
| REQ-207 | `65-inventory-record-traceability.md` §65.1/§65.5/§65.8 | TRACE-D2/D6 | movement と元記録を相互参照する | movement DTO + detail links | future movement link tests |
| REQ-208 | `65-inventory-record-traceability.md` §65.6/§65.7 | TRACE-D4/D5/D6 | 物理削除・上書き更新は監査性が弱い | cancel/correct BIZ/CMD/DB | future cancellation/correction tests |
| REQ-902 | `65-inventory-record-traceability.md` §65.1/§65.8.3 | TRACE-D3 | operation_logs を業務正本にしない | operation log UI/link | future log role tests |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `65-inventory-record-traceability.md` に完成形を集約し、DB/Screen/Route 入口からリンクした。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: yes, 入出庫追跡の完成形と操作ログの役割分担を source docs へ昇格した。
- Assumptions and constraints: Excel原本はこのPRでは編集しない。REQ-206〜208 は補足要求として `coverage=deferred` にする。
- Deferred design gaps, risk, and follow-up target: 実装順は §65.10。DB migration と command DTO 詳細は次の実装 Plan Packet で確定する。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: inventory_movements と各業務記録テーブルの土台は既存設計にある。
- Source docs updated in this PR: `docs/spec/requirements.md`, `docs/function-design/65-inventory-record-traceability.md`, `docs/FUNCTION_DESIGN.md`, `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`, `docs/SCREEN_DESIGN.md`, `docs/function-design/52-ui-shared-layout.md`, `docs/Plans.md`
- Design gaps intentionally deferred: Excel原本反映、DB migration、Rust/React実装、L3。
- Durable decisions discovered in this plan and promoted to source docs: completed-capability traceability design.

Minimum design checks for business-app work:

- Layer ownership: UI は検索/詳細/取消確認、CMD は薄い中継、BIZ は取消/訂正 TX と validation、IO は query/mutation、MNT は operation log cleanup。
- Backend function design: `list/get/cancel/correct` 系を完成形として定義。
- Command / DTO / data contract: §65.7 に command family を定義。
- Persistence / transaction / audit impact: §65.6 に status / reversal movement / operation log role を定義。
- Operator workflow / Japanese UI wording: `入出庫履歴`、`有効`、`取消済み`、`訂正済み` を主表示にする。
- Error, empty, retry, and recovery behavior: implementation Plan Packet で詳細化する。
- Testability and traceability IDs: REQ-206〜208 / TRACE-D* を使う。

## Test Plan

Test Design Matrix: [test-matrices/2026-06-27-inventory-record-traceability-design.md](test-matrices/2026-06-27-inventory-record-traceability-design.md)

- targeted tests: docs consistency, traceability check.
- negative tests: REQ-206〜208 が deferred のため T3 WARN を出さないこと。
- compatibility checks: existing UI-05 archived plan links remain valid.
- data safety checks: no runtime DB / store data / logs / image files.
- main wiring/integration checks: source docs cross-links exist.

## Boundary / Wire Contract

- producer: future BIZ/CMD/IO implementation.
- consumer: future records list/detail UI and movement UI.
- wire type: future typed DTOs in generated bindings.
- internal type: business record summary/detail, movement record with reference label, cancellation/correction request.
- precision/range: record IDs are SQLite integers; dates are `YYYY-MM-DD`; datetimes are local ISO text.
- round-trip path: records list/detail UI -> generated command -> BIZ -> IO -> DB -> detail/result.
- invalid input: implementation PR must validate page/perPage, dates, record status, cancellation reason, idempotency key.
- compatibility: current DB schema does not yet include all completion fields; migration must preserve existing records as active.

## Review Focus

- Does the design describe the completed commercial capability, not only the first implementation slice?
- Are business records, inventory movements, and operation logs clearly separated?
- Is cancellation/correction append-only enough for auditability?
- Are route additions understandable without bloating daily creation screens?
- Are new REQ rows correctly deferred until implementation starts?

## Spec Contract

Contract ID: SPEC-INVENTORY-TRACEABILITY-DESIGN

- Every inventory-impacting business record type must have a path to list and detail views in the completed product.
- Inventory movement rows must link to the originating business record when `reference_type/reference_id` exists.
- Business record cancellation/correction must not physically delete the original record.
- Operation logs must not be treated as the source of truth for inventory movements.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-206 | Source docs update | doc-consistency | records list/detail completeness | `65-inventory-record-traceability.md` |
| REQ-207 | Source docs update | traceability check | movement reference links | `65-inventory-record-traceability.md` |
| REQ-208 | Source docs update | doc-consistency | cancel/correct append-only design | DB/function docs |
| REQ-902 | Source docs update | doc-consistency | operation log role separation | `65-inventory-record-traceability.md` |

## Data Safety

- Do not commit real POS CSV, store DB files, backups, logs, receipt images, or secrets.
- Local-only paths: runtime DB/log/image directories.
- Synthetic-only paths: none added in this design PR.

## Implementation Results

- Added `REQ-206` / `REQ-207` / `REQ-208` as Design Phase supplemental requirements with `coverage=deferred`.
- Added `docs/function-design/65-inventory-record-traceability.md` as the completed-capability source doc for business records, `inventory_movements`, operation log role separation, list/detail/search, movement source links, cancellation/correction, CSV/print/image output, and implementation slices.
- Updated DB, screen, function index, shared layout, requirements, Plans, project memory, and handoff docs to point at the completed traceability design.
- Updated `src-tauri/tests/design_compliance_test.rs` so the new function design doc is registered in the design-doc-to-module compliance map.
- Archived the completed UI-05 Plan Packet and Test Design Matrix under `docs/archive/plans/`.
- Regenerated `docs/function-design/90-traceability.md`.
- Validation:
  - `bash scripts/doc-consistency-check.sh`: PASS
  - `bash scripts/doc-consistency-check.sh --target plan`: PASS
  - `cd src-tauri && cargo run --bin generate_traceability -- --check`: PASS
  - `cd src-tauri && cargo test --test design_compliance_test`: PASS
  - `git diff --check`: PASS

## Review Response

- Review-only sub-agent `Galileo` completed.
- Accepted P2: CSV取込み and 棚卸し were included in REQ-206 and the business-record definition but were missing explicit completed route/command targets. Fixed by adding `/csv-import/records`, `/csv-import/records/$importId`, `/stocktake/records`, `/stocktake/records/$stocktakeId`, plus `listCsvImportRecords` / `getCsvImportRecord` and `listStocktakeRecords` / `getStocktakeRecord`.
- Accepted P2: `correct*Record` wording could conflate canceled and corrected states. Fixed by making pure cancel use `status='canceled'` and correction use `status='corrected'` with reversal movements and a new active replacement record in the same transaction.
- Accepted P3: `SCREEN_DESIGN.md` screen status rows were stale for UI-02 / UI-03 / UI-04 / UI-05. Fixed to show merged PRs #103 / #107 / #104 / #110.
- CI follow-up: Rust CI failed because the new `65-inventory-record-traceability.md` source doc was not registered in `build_doc_to_modules_map()`. Accepted as same-PR gate drift and fixed by adding the cross-cutting inventory/csv/stocktake/log module mapping.
