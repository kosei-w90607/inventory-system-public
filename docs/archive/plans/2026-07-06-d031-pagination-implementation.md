# Plan Packet: D-031 pagination constant implementation

> **Status**: 完了（PR #140 squash merge `8b41ddd`、2026-07-06。Fable レビュー指摘ゼロ approve。2026-07-06 closeout で archive）

## Risk

Risk: R2

Reason:
IO 層の pagination 挙動を D-031 の既定方針どおりに実装する小変更。UI / CMD / BIZ / wire shape / schema は変更しないが、`search_products` の大きすぎる `per_page` が reject ではなく 200 clamp になるため backend behavior change として R2 とする。

## Goal

D-031 の follow-up PR #140 として、実在する `PAGINATION_MAX_PER_PAGE = 200` 定数を導入し、`search_products` と既存 inline clamp 箇所を同じ定数へ寄せる。

## Scope

- `src-tauri/src/constants.rs` に `PAGINATION_MAX_PER_PAGE: u32 = 200` を追加する。
- `db/product_repo.rs::search_products` の `per_page` を 200 clamp にする。
- `db/stocktake_repo.rs` / `db/system_repo.rs` の inline `200` clamp を定数参照へ置換する。
- `search_products` の per_page=500 -> 200 clamp テストを追加する。
- D-031 実装済みとして source docs と `docs/Plans.md` を小さく同期する。

## Non-scope

- UI / CMD / BIZ 層の変更。
- `biz/inventory_service/list.rs` の `MAX_PER_PAGE = 100` reject 変更。
- `sales_repo` の取込み履歴系 100 reject 変更。
- receiving / return / disposal repo への IO clamp 追加。
- pagination UI（「すべて」50 件超の操作等）。

## Acceptance Criteria

- `search_products` は `per_page > 200` を reject せず、200 に clamp し、`PaginatedResult.per_page` も 200 を返す。
- `search_products` の `per_page >= 1` 検証と offset overflow チェックは維持される。
- stocktake / system log list の挙動は変えず、定数参照だけに変わる。
- D-031 の例外である inventory BIZ 100 reject と sales history 100 reject は変更しない。
- `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test` / `cargo test --test architecture_test` / `cargo test --test design_compliance_test` / `bash scripts/doc-consistency-check.sh` が green。

## Design Sources

- Requirements / spec: REQ-103
- Architecture: [../ARCHITECTURE.md](../../ARCHITECTURE.md)
- Function / command / DTO: [../function-design/10-common-rules.md](../../function-design/10-common-rules.md), [../function-design/20-io-product-repo.md](../../function-design/20-io-product-repo.md), [../function-design/42-cmd-sales-stocktake.md](../../function-design/42-cmd-sales-stocktake.md), [../function-design/43-cmd-settings-log.md](../../function-design/43-cmd-settings-log.md)
- DB: no schema change
- Screen / UI: no UI change
- Decision log / ADR: [../decision-log.md](../../decision-log.md) D-031

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend repository pagination behavior | `10-common-rules.md`, `20-io-product-repo.md`, `42-cmd-sales-stocktake.md`, `43-cmd-settings-log.md` | updated in this PR |
| Command / DTO / generated binding / wire shape | none | intentionally not touched |
| DB / transaction / audit / rollback / migration | none | intentionally not touched |
| Screen / UI / route state / Japanese wording | none | intentionally not touched |
| Durable decision / ADR | `decision-log.md` D-031 | existing sufficient; Impact line updated after PR number is known |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-103 | `20-io-product-repo.md` `search_products` | D-031 | Introduce real 200 clamp constant; preserve BIZ 100 reject exception | `src-tauri/src/db/product_repo.rs`, `src-tauri/src/constants.rs` | `test_search_products_req103_per_page_clamps_to_max` |
| MNT / CMD settings log | `43-cmd-settings-log.md` | D-031 | Replace inline 200 without behavior change | `src-tauri/src/db/system_repo.rs` | existing `test_list_operation_logs_req902_per_page_clamp` |
| CMD stocktake | `42-cmd-sales-stocktake.md` | D-031 | Replace inline 200 without behavior change | `src-tauri/src/db/stocktake_repo.rs` | existing stocktake pagination tests |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, D-031 and function-design docs define the exact scope.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none.
- Assumptions and constraints: `PAGINATION_MAX_PER_PAGE` is an IO clamp constant; existing BIZ 100 reject contracts remain exceptions.
- Deferred design gaps, risk, and follow-up target: pagination UI remains existing backlog.
- Test Design Matrix can cite design decision IDs or source doc sections: R2; no separate matrix required.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable; no POS adapter or external format | none |
| Fact check / design decision split | applicable only as docs drift closure; D-031 already records the fact split | docs updated in this PR |
| Lifecycle / retry | not applicable; read-only list pagination | none |
| Operator workflow | not applicable; no UI flow change | none |
| Replacement path | not applicable | none |
| Data safety / evidence | no real data, fixtures, or POS artifacts touched | PR body |
| Reporting / accounting semantics | not applicable | none |
| Manual verification | not applicable; automated Rust/docs checks cover scope | PR body |

## Design Readiness

- Existing design docs are sufficient because: D-031 explicitly defines the constant, clamp targets, and exceptions.
- Source docs updated in this PR: common rules, product repo, stocktake CMD, settings/log CMD docs, decision-log D-031 Impact.
- Design gaps intentionally deferred: pagination UI.
- Durable decisions discovered in this plan and promoted to source docs: none.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): IO-only clamp; CMD/BIZ unchanged.
- Backend function design: `search_products` clamp and existing stocktake/system clamps are documented.
- Command / DTO / data contract: no wire shape change.
- Persistence / transaction / audit impact: none.
- Operator workflow / Japanese UI wording: none.
- Error, empty, retry, and recovery behavior: `per_page=0` still errors; `per_page>200` now clamps.
- Testability and traceability IDs: REQ-103 unit test added.

## Test Plan

- targeted tests: `cargo test test_search_products_req103_per_page_clamps_to_max`
- negative tests: existing `per_page=0` and page validation tests remain.
- compatibility checks: `cargo test --test architecture_test`, `cargo test --test design_compliance_test`
- data safety checks: no real data or local artifacts touched.
- main wiring/integration checks: `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `bash scripts/doc-consistency-check.sh`

## Boundary / Wire Contract

Not applicable. No command DTO, generated binding, JSON wire shape, route state, DB schema, or report output changes.

## Review Focus

- D-031 exception boundaries are respected: inventory BIZ and sales history 100 reject remain unchanged.
- `PaginatedResult.per_page` returns the clamped value.
- Source docs do not describe follow-up work as pending after this PR.

## Implementation Results

- Added `PAGINATION_MAX_PER_PAGE: u32 = 200` to `src-tauri/src/constants.rs`.
- `product_repo::search_products` now clamps `per_page` to 200 after the existing `>= 1` validation and returns the clamped value in `PaginatedResult.per_page`.
- `stocktake_repo::list_stocktake_items` and `system_repo::list_operation_logs` now reference the shared constant instead of inline `200`.
- Added `test_search_products_req103_per_page_clamps_to_max`.
- Updated source docs and `docs/Plans.md` to remove the consumed `search_products` pagination backlog item.
- Verification:
  - Red: `cargo test test_search_products_req103_per_page_clamps_to_max` failed before implementation with `left: 500`, `right: 200`.
  - Green targeted: `cargo test test_search_products_req103_per_page_clamps_to_max`
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
  - `cargo test --test architecture_test`
  - `cargo test --test design_compliance_test`
  - `cargo run --bin generate_traceability -- --check`
  - `bash scripts/doc-consistency-check.sh`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `git diff --check`

## Review Response

Review-only skipped because: R2 narrow IO-layer pagination implementation of already-accepted D-031, with no UI/CMD/BIZ wire shape, schema, data lifecycle, POS, or operator workflow change. Local Rust and docs gates cover this scope.
