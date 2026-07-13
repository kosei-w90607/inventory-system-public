# Inventory Traceability Foundation Plan

## Risk

Risk: R3

Reason:
`inventory_movements` の返却 DTO、BIZ/CMD contract、generated binding、REQ-207 / REQ-303 の追跡前提に触る。DB schema は変更しないが、後続 UI-06c の wire shape になるため shared contract として扱う。

## Goal

商品別在庫変動履歴で、各 movement がどの業務記録に由来するかを backend から解決できるようにする。`reference_type/reference_id` を保持するだけでなく、人間向けラベルと遷移先 route を返し、UI-06c が元記録へリンクできる状態にする。

## Scope

- `MovementRecord` に元記録リンク用の optional DTO を追加する。
- `reference_type/reference_id` の対応表を BIZ 層で定義し、業務記録ラベルと route を解決する。
- `list_movements` の返却結果に解決済み source link を含める。
- 解決不能または NULL reference は movement 自体を残し、source link を `None` にする。
- Tauri generated binding を更新し、TypeScript 側の型 drift をなくす。
- source docs / active dashboard / traceability evidence を同期する。

## Non-scope

- DB migration、`movement_kind`、`reversal_of_movement_id`、record status 追加。
- 業務記録詳細画面、入出庫履歴ハブ、UI-06c 画面本体。
- 取消 / 訂正 command と逆 movement 作成。
- `operation_logs` UI や業務記録 link 表示。
- 既存 `reference_type/reference_id` の整合性を JOIN で検証してエラーにすること。

## Acceptance Criteria

- `src-tauri/src/db/inventory_repo.rs` の `MovementRecord` が `source` optional field を返す。
- `src-tauri/src/biz/inventory_service/list.rs` が `reference_type/reference_id` から `label` と `route` を解決する。
- Rust test が `receiving_record`、`disposal_record`、`csv_import`、NULL / unknown reference の source 解決を検証する。
- `src-tauri/src/cmd/inventory_cmd.rs` の list_movements 統合 test が source field を通して返せることを確認する。
- `src/lib/bindings.ts` に更新後の `MovementRecord` / source DTO が生成される。
- `cd src-tauri && cargo run --bin generate_bindings` 実行後、generated binding diff が意図した型差分だけになる。
- `cd src-tauri && cargo test inventory_service::list` と `cd src-tauri && cargo test inventory_cmd` が通る。
- `cd src-tauri && cargo run --bin generate_traceability -- --check` が `ERROR 0 / WARN 0` で通る。
- `npm run typecheck` が通る。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が ERROR なしで通る。
- `Review Response` に R3 review-only sub-agent の P1/P2 結果を記録し、P1/P2 が 0、または同 PR で修正済みになる。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-206 / REQ-207 / REQ-303 / REQ-902
- Architecture: `docs/ARCHITECTURE.md`、`docs/architecture/biz-task-specs.md`
- Function / command / DTO: `docs/function-design/65-inventory-record-traceability.md`、`docs/function-design/44-cmd-inventory.md`、`docs/function-design/31-biz-inventory-service.md`、`docs/function-design/21-io-inventory-repo.md`
- DB: `docs/DB_DESIGN.md`、`docs/db-design/tracking-system-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`
- Decision log / ADR: `docs/decision-log.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `65-inventory-record-traceability.md` §65.7、`44-cmd-inventory.md` §23.8〜23.10 | existing sufficient |
| Command / DTO / generated binding / wire shape | `65-inventory-record-traceability.md` §65.7/§65.8.2 | updated in this PR if concrete field names differ |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`、`tracking-system-tables.md` | existing sufficient; schema change intentionally deferred |
| Screen / UI / route state / Japanese wording | `65-inventory-record-traceability.md` §65.3/§65.8.2 | existing sufficient; UI implementation deferred |
| CSV / TSV / report / import / export format | none | intentionally deferred |
| Durable decision / ADR | `65-inventory-record-traceability.md` TRACE-D2 | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-207 / REQ-303 | `65-inventory-record-traceability.md` §65.2/§65.7/§65.8.2 | TRACE-D2 | movement から元業務記録へ戻れないと在庫変動の根拠を追えない | `list_movements` source link DTO | source label/route tests |
| REQ-206 | `65-inventory-record-traceability.md` §65.3 | TRACE-D1/D7 | recent list は保存直後確認であり履歴 UI の代替ではない | route mapping constants | route mapping tests |
| REQ-902 | `65-inventory-record-traceability.md` §65.1/§65.2 | TRACE-D3 | operation_logs は監査補助で、業務記録の正本ではない | movement source は業務記録 route を指す | review-only focus |
| REQ-303 | `44-cmd-inventory.md` §23.8 | existing CMD-06 | 既存 `list_movements` contract を壊さず optional source を増やす | generated `MovementRecord` | binding/typecheck |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `65-inventory-record-traceability.md` が元記録 link と実装スライスを定義している。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none at start; concrete field nameが source docs と差分になる場合は本 PR で追記する。
- Assumptions and constraints: 詳細 route は未実装でも route string を contract として返す。NULL / unknown reference は壊れた movement にせず、source なしとして扱う。
- Deferred design gaps, risk, and follow-up target: DB status/movement_kind/cancel/correct は後続スライス。UI-06c で source route を実際にリンクにする。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: PR #111 で完成形、route、source link、実装スライスが source docs に昇格済み。
- Source docs updated in this PR: concrete DTO field namesが既存 §65.7 とズレる場合のみ `65-inventory-record-traceability.md` / `44-cmd-inventory.md` を更新する。
- Design gaps intentionally deferred: cancel/correct、record detail、history hub、operation log link。
- Durable decisions discovered in this plan and promoted to source docs: none yet.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): IO は raw movement を返し、BIZ が source link を解決し、CMD は薄く返す。
- Backend function design: existing `inventory_service::list_movements` に解決処理を追加する。
- Command / DTO / data contract: `MovementRecord` に optional `source` を追加する。
- Persistence / transaction / audit impact: read-only。DB 書込み、TX、audit 追加なし。
- Operator workflow / Japanese UI wording: source label は日本語で「入庫記録 #ID」等を返す。
- Error, empty, retry, and recovery behavior: unknown reference は error にせず `source=None`。
- Testability and traceability IDs: Rust tests に REQ-207 / REQ-303 / TRACE-D2 を付与する。

## Test Plan

Test Design Matrix: [test-matrices/2026-06-27-inventory-traceability-foundation.md](test-matrices/2026-06-27-inventory-traceability-foundation.md)

- targeted tests: BIZ source resolver、`list_movements` enrichment、CMD integration、generated binding。
- negative tests: NULL reference、unknown reference_type、missing reference_id。
- compatibility checks: existing movement fields unchanged、old rows with NULL reference still readable。
- data safety checks: in-memory DB and synthetic product/movement only。
- main wiring/integration checks: `collect_commands!` / bindings / typecheck。

## Boundary / Wire Contract

- producer: `src-tauri/src/cmd/inventory_cmd.rs::list_movements`
- consumer: future UI-06c and current generated `commands.listMovements`
- wire type: `PaginatedResult<MovementRecord>` with optional source link DTO
- internal type: DB `MovementRecord` plus BIZ-resolved source metadata
- precision/range: SQLite integer IDs; route string includes decimal ID without recalculation
- round-trip path: DB `inventory_movements.reference_type/reference_id` -> IO row -> BIZ resolver -> CMD -> generated TS binding
- invalid input: movement query validation remains existing BIZ behavior
- compatibility: additive optional field; no DB schema change

## Review Focus

- Source resolution belongs in BIZ, not CMD or UI.
- NULL / unknown references do not hide movement rows or turn the list into an error.
- Route mapping matches `65-inventory-record-traceability.md` §65.3.
- Existing fields and paging/filter behavior are preserved.
- Generated binding was produced, not hand-edited.

## Spec Contract

Contract ID: SPEC-TRACE-FOUNDATION-REQ207-REQ303

- `list_movements` must return an optional source link for known `reference_type/reference_id` pairs.
- A source link must include a Japanese label and route string for the originating business record.
- Unknown or missing references must leave the movement visible with no source link.
- The change must be additive to existing movement list behavior.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-207 / TRACE-D2 | source resolver | `test_resolve_movement_source_req207_known_references` | route/label correctness | cargo test |
| REQ-303 | list enrichment | `test_list_movements_req303_includes_source_link` | existing paging preserved | cargo test |
| REQ-303 | NULL compatibility | `test_list_movements_req303_null_reference_has_no_source` | old rows still visible | cargo test |
| REQ-207 | CMD integration | `test_list_movements_req207_source_link_through_biz` | CMD thin wrapper | cargo test |
| REQ-303 | generated binding | `cargo run --bin generate_bindings`, `npm run typecheck` | TS contract drift | command output + diff |

## Data Safety

- Do not commit real POS CSV, store DB files, backups, logs, receipt images, or secrets.
- Local-only paths: `src-tauri/target/`, runtime DB/log directories, `dist/`.
- Synthetic-only paths: in-memory DB tests with fake product codes and movement rows.

## Implementation Results

- Added `MovementSourceLink { label, route }` and `MovementRecord.source` to the movement DTO.
- Added Specta metadata for `MovementQuery` / `MovementRecord` / `MovementSourceLink` and exposed generated `commands.listMovements`.
- Kept IO `inventory_repo::list_movements` as the raw SQL/paging source and filled `source` in BIZ `inventory_service::list_movements`.
- Added BIZ resolver coverage for known references, NULL reference, unknown reference, list enrichment, and source-less compatibility.
- Added CMD-path coverage for `list_movements` returning BIZ-enriched source link.
- Updated `44-cmd-inventory.md` and `65-inventory-record-traceability.md` to make `source: { label, route }` the concrete backend contract.
- Regenerated `src/lib/bindings.ts` and `docs/function-design/90-traceability.md`.

Verification:

- `cd src-tauri && cargo test inventory_service::list` PASS
- `cd src-tauri && cargo test inventory_cmd` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（569 tests）
- `cd src-tauri && cargo run --bin generate_bindings` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm test` PASS（71 files / 452 tests）
- `npm run build` PASS
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS

## Review Response

Review-only sub-agent: completed.

- P1/P2: none.
- P3 accepted: `Review Response` was still marked as running. Fixed by recording this result.
- P3 accepted: active Plan Packet / Test Matrix were untracked at review time. They must be included in the PR commit with this implementation.

Reviewer verification:

- `cargo test inventory_service::list` PASS（13 tests）
- `cargo test inventory_cmd` PASS（11 tests）
- `git diff --check` PASS

Main-agent follow-up after review:

- No code changes required for P1/P2.
- Re-run plan/doc checks after updating this review evidence.
