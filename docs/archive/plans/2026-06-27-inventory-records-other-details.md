# 入庫 / 返品・交換 / 手動販売の業務記録詳細横展開

## Risk

Risk: R3

Reason:
operator-facing route/search state、Tauri command DTO / generated bindings、在庫変動 traceability の元記録導線、入出庫履歴ハブの横断検索対象を拡張する。DB schema は変更しないが、REQ-201/202/203/206/207 の read contract と UI route を追加する。

## Goal

`65-inventory-record-traceability.md` §65.10 の 4 番目として、入庫 / 返品・交換 / 手動販売の業務記録詳細を `/inventory/records` と UI-06c movement 元記録リンクから開けるようにする。

## Scope

- `/inventory/receiving/records/$recordId`、`/inventory/return/records/$recordId`、`/inventory/manual-sale/records/$recordId` を追加する。
- `getReceivingRecord(id)` / `getReturnRecord(id)` / `getManualSaleRecord(id)` 相当の generated command / BIZ / IO contract を追加する。
- `listInventoryRecords(query)` を `receiving_record` / `return_record` / `manual_sale` に横展開し、`all` では廃棄・破損を含む4種を業務日付 DESC、記録ID DESC で返す。
- 各詳細画面は header、明細、金額/原価サマリ、関連 `inventory_movements`、商品別在庫変動履歴への導線を表示する。
- `/inventory/records` の種別 filter と detail returnTo は4種で維持する。
- UI-02 / UI-03 の recent list から「すべての履歴を見る」と詳細導線を追加する。UI-04 は現行作成画面に recent list を持たないため、保存結果から手動販売詳細へ遷移できる導線を追加する。

## Non-scope

- 種別別履歴一覧 route（`/inventory/receiving/records` など）の専用一覧。
- 取消 / 訂正 command と UI。
- CSV出力、印刷、帳票控え。
- DB schema migration（status / movement_kind / attachment table 追加など）。
- 返品レシート画像の asset 表示。初回 detail は保存済み path の有無/相対パス表示に留める。
- 操作ログ UI と業務記録リンク。

## Acceptance Criteria

- `commands.getReceivingRecord` / `commands.getReturnRecord` / `commands.getManualSaleRecord` が `src/lib/bindings.ts` に生成される。
- `commands.listInventoryRecords(...)` が `record_type` `receiving_record` / `return_record` / `manual_sale` / `disposal_record` / `all` を受け、対象外 status は `CmdError.kind="validation"` を返す。
- `/inventory/records` の記録種別 select に `入庫` / `返品・交換` / `手動販売出庫` / `廃棄・破損` が表示され、各行の `詳細を見る` が対応 detail route へ遷移する。
- 入庫 detail は `OtherRecordDetailPages.test.tsx` で取引先、明細、原価合計、関連 movements を表示し、missing ID は BIZ/CMD で `not_found` に写像される。
- 返品・交換 detail は種別、レジ戻し済み、画像添付有無、明細方向、関連 movements を表示し、`register_processed=true` では movement 0件も正常に扱う。
- 手動販売 detail は `OtherRecordDetailPages.test.tsx` で理由、販売金額合計、明細、関連 movements、`/reports/daily` 導線を表示する。
- UI-06c の元記録リンクから3種 detail へ遷移でき、detail の「前の画面へ戻る」で movement list の search state に戻る。
- `/inventory/records` から3種 detail へ遷移した場合、戻る導線で一覧の検索条件と page が保持される。
- `npm test -- src/features/inventory-records/OtherRecordDetailPages.test.tsx src/features/inventory-records/InventoryRecordsPage.test.tsx src/features/receiving/ReceivingPage.test.tsx src/features/return-exchange/ReturnExchangePage.test.tsx src/features/manual-sale/ManualSalePage.test.tsx`、`cargo test inventory_service::list`、`cargo test receiving_repo`、`cargo test return_repo`、`cargo test manual_sale_repo`、`cargo test disposal_repo`、`cargo run --bin generate_bindings`、`bash scripts/doc-consistency-check.sh` が成功する。
- Windows native L3 で `/inventory/records` 4種 filter、3種 detail、UI-02/03 recent list 導線、UI-04 保存結果 detail 導線、movement link return を確認する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-201 / REQ-202 / REQ-203 / REQ-206 / REQ-207、`docs/function-design/90-traceability.md`
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`
- Function / command / DTO: `docs/function-design/21-io-inventory-repo.md`, `docs/function-design/31-biz-inventory-service.md`, `docs/function-design/44-cmd-inventory.md`, `docs/function-design/61-ui-receiving.md`, `docs/function-design/62-ui-manual-sale.md`, `docs/function-design/63-ui-return-exchange.md`, `docs/function-design/65-inventory-record-traceability.md`, `docs/function-design/66-ui-stock-movements.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/design-system/README.md`
- Decision log / ADR: `docs/decision-log.md` の仕様追加時の隣接仕様整合ルール

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `21-io-inventory-repo.md`, `31-biz-inventory-service.md`, `44-cmd-inventory.md`, `65-inventory-record-traceability.md` | updated in this PR with concrete detail functions and list expansion |
| Command / DTO / generated binding / wire shape | `44-cmd-inventory.md`, `65-inventory-record-traceability.md` | updated in this PR |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `transaction-tables.md`, `tracking-system-tables.md` | existing sufficient; read-only and no schema migration |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `61/62/63/65/66` | updated in this PR for detail route scope, UI-02/03 recent detail navigation, and UI-04 result detail navigation |
| CSV / TSV / report / import / export format | `65` §65.9 | intentionally deferred |
| Durable decision / ADR | `TRACE-D1/D2/D11`, `decision-log.md` workflow lesson | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-201 / REQ-206 | `61` §61.8, `65` §65.5/§65.10 | TRACE-D1/D2/D11 | 入庫 recent list は保存直後確認であり、月末確認には詳細 route が必要。作成画面内 detail は避ける。 | `getReceivingRecord`, receiving detail route, records list expansion | Rust detail/list tests, receiving detail RTL |
| REQ-202 / REQ-206 | `63` §63.8, `65` §65.5/§65.10 | TRACE-D1/D2/D11 | 返品/交換はレジ戻し済みや画像有無を後から確認できる必要がある。画像 asset 表示は権限設計込みで後続。 | `getReturnRecord`, return detail route | Rust detail/list tests, return detail RTL |
| REQ-203 / REQ-206 | `62` §62.8, `65` §65.5/§65.10 | TRACE-D1/D2/D11 | 手動販売は売上金額と日次売上への照合が必要。日次売上本体の再設計は不要。 | `getManualSaleRecord`, manual sale detail route | Rust detail/list tests, manual detail RTL |
| REQ-207 | `65` §65.2/§65.5/§65.8.2, `66` §66.2 | TRACE-D2 | movement から元記録へ到達できないと在庫変動の根拠を追えない。 | movement source route -> 3種 detail | movement table/route tests |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `65` が完成形と slice order、`61/62/63` が作成画面の責務、`44/21` が concrete command / IO contract を持つ。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 3種 detail DTO と list expansion は source docs へ追記する。
- Assumptions and constraints: 既存テーブルから読み取れる情報だけを表示する。status は現行 schema では `active` 固定。返却単位は業務記録ヘッダ単位。
- Deferred design gaps, risk, and follow-up target: 取消/訂正、出力、画像 asset 表示、種別別専用一覧は後続 slice。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: route、詳細表示項目、returnTo、movement 相互リンクは `65` に定義済み。
- Source docs updated in this PR: `21` / `44` / `61` / `62` / `63` / `65`。
- Design gaps intentionally deferred: status/cancel/correct/attachment asset/export/print/schema migration。
- Durable decisions discovered in this plan and promoted to source docs: listInventoryRecords の4種 union と3種 detail DTO。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated commands のみ。CMD は thin wrapper。BIZ は validation と movement source 補完。IO は SQL。
- Backend function design: list は header 単位、detail は header + item + movement を返す。
- Command / DTO / data contract: generated binding を commit し、frontend は `commands.*` + `unwrapResult` のみ。
- Persistence / transaction / audit impact: read-only。schema / TX write impact なし。
- Operator workflow / Japanese UI wording: `入庫`, `返品・交換`, `手動販売出庫`, `有効`, `元記録`, `原価合計`, `販売金額合計` を主表示。
- Error, empty, retry, and recovery behavior: list/detail 取得失敗は inline Alert。0件 movement は EmptyState。not_found は戻り導線。
- Testability and traceability IDs: REQ-201 / REQ-202 / REQ-203 / REQ-206 / REQ-207 を Rust/RTL tests に付与。

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-06-27-inventory-records-other-details.md`

- targeted tests:
  - `cargo test inventory_service::list`
  - `cargo test receiving_repo`
  - `cargo test return_repo`
  - `cargo test manual_sale_repo`
  - `npm test -- src/features/inventory-records`
- negative tests:
  - missing receiving / return / manual sale record -> not_found
  - invalid page / per_page -> validation
  - unsupported status -> validation
  - filters with no matching rows -> empty
- compatibility checks:
  - existing `listReceivings` / `listReturns` / `listDisposals` remain recent-list compatible
  - manual sale result panel links to the detail route without adding a new in-form recent list
  - `listMovements` source routes become live for receiving / return / manual_sale
- data safety checks:
  - synthetic fixtures only; no real POS/store files
- main wiring/integration checks:
  - generated commands and routes
  - routeTree regeneration
  - navigation/recent list/result links

## Boundary / Wire Contract

- producer: Rust CMD `list_inventory_records`, `get_receiving_record`, `get_return_record`, `get_manual_sale_record`
- consumer: React `InventoryRecordsPage`, three detail pages, UI-02/03 recent list links, UI-04 result detail link, UI-06c movement source links
- wire type:
  - `InventoryRecordQuery { record_type, date_from, date_to, record_id, product_keyword, department_id, status, page, per_page }`
  - `InventoryRecordSummary { record_type, record_id, business_date, representative_item, item_count, status, created_at, detail_route }`
  - `ReceivingRecordDetail`, `ReturnRecordDetail`, `ManualSaleRecordDetail`
- internal type: DB repository structs under `receiving_repo`, `return_repo`, `manual_sale_repo`, `disposal_repo`, `inventory_repo::MovementRecord`
- precision/range: IDs and money/quantity are i64 in Rust, JS number in generated binding; local SQLite IDs remain far below unsafe integer range
- round-trip path: DB -> IO -> BIZ -> CMD -> generated binding -> TanStack Query -> table/detail UI -> Link route
- invalid input: page/per_page invalid -> validation; missing detail ID -> not_found; unsupported record type/status -> validation
- compatibility: additive commands/types and list expansion. Existing recent list commands remain unchanged.

## Review Focus

- Header-level list must not duplicate rows when multiple items match a filter.
- `all` ordering across four record tables must be stable and not page each type independently before union.
- Return detail must not imply stock movement exists when `register_processed=true`.
- Manual sale detail must not conflate `manual_sale.id` with `sale_records.id`; display uses manual sale record ID, daily sales link uses date.
- CMD must remain thin; business/page validation belongs in BIZ.
- UI must not encode status/方向/増減 by color only.
- `returnTo` must stay app-local and preserve `/inventory/records` / movement search state.

## Spec Contract

Contract ID: SPEC-INV-RECORDS-OTHER-DETAILS-2026-06-27

- `/inventory/records` lists receiving, return/exchange, manual sale, and disposal records as traceable business records with detail routes.
- Each new detail route is read-only, shows record header, item rows, business totals, related stock movements, and a safe return path.
- UI-06c movement source routes for `receiving_record`, `return_record`, and `manual_sale` become live detail routes without changing the source link DTO shape.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-201 / REQ-206 | receiving detail command + route | Rust receiving detail tests / `OtherRecordDetailPages.test.tsx` | supplier, cost total, movement link | detail UI + generated binding |
| REQ-202 / REQ-206 | return detail command + route | Rust return detail tests / `OtherRecordDetailPages.test.tsx` | register_processed and direction semantics | detail UI + movement empty state |
| REQ-203 / REQ-206 | manual sale detail command + route | Rust manual detail tests / `OtherRecordDetailPages.test.tsx` | sale amount and daily sales link | detail UI |
| REQ-206 | list expansion | Rust list union tests / `InventoryRecordsPage.test.tsx` | header-level union filtering/order | list UI |
| REQ-207 | movement source routes | `MovementTable.test.tsx` / route tests | returnTo preservation | route links |

## Data Safety

- Do not read or commit real POS CSV, PLU export files, store data, DB files, backups, logs, receipt images, secrets, credentials, or `.env*`.
- Local-only paths remain `.local/`, app data, generated logs, `target/`, `src-tauri/target/`, `node_modules/`, `dist/`.
- Tests use synthetic products and synthetic business records only.

## Implementation Results

- Added `getReceivingRecord` / `getReturnRecord` / `getManualSaleRecord` across IO -> BIZ -> CMD -> generated bindings.
- Expanded `listInventoryRecords` to return `receiving_record` / `return_record` / `manual_sale` / `disposal_record` header rows with common search filters.
- Added read-only detail routes for `/inventory/receiving/records/$recordId`, `/inventory/return/records/$recordId`, and `/inventory/manual-sale/records/$recordId`.
- Added UI-02 / UI-03 recent detail buttons and UI-04 result detail button; save success now invalidates `queryKeys.inventoryRecords.root()`.
- Added Rust detail/union tests and RTL detail/list/result-link tests. Verified targeted frontend tests, repo tests, `inventory_service::list`, full `npm test` (80 files / 474 tests), full `cargo test` (579 lib tests plus bin/integration/doc-tests), `typecheck`, `lint`, `format:check`, `build`, `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and doc consistency.
- Windows native L3 owner confirmation passed: `/inventory/records` filters and detail links, UI-02/UI-03 recent list all-history/detail links, UI-04 save result detail link, UI-06c movement source links for receiving / return / manual sale, and detail return preserving movement filters.
- L3 feedback fixed in this PR: parent routes for `/inventory/receiving`, `/inventory/return`, and `/inventory/manual-sale` now render child detail routes via `<Outlet />` + index routes; UI-02/UI-03 recent sections now expose `すべての履歴を見る`.
- UI-04 manual sale still has no recent list by current source spec. This was accepted for PR #115 and recorded as a separate UX follow-up candidate.

## Review Response

- review-only sub-agent `Cicero`: P1/P2なし。
- final full-diff review-only sub-agent `Euclid`: P1/P2なし。route/search state、parent route layout、UI-02/UI-03 recent links、UI-04 result detail link、4種横断 list、manual_sale ID、movement source links、BIZ/CMD/IO 境界を確認。自動テストは再実行せず差分レビューのみ。
- Review scope: 4種横断 SQL の UNION/order/page/filter、`manual_sale` と `sale_records` の ID 混同、movement `reference_type` / route、`returnTo` 外部 URL 拒否、主要レイヤー境界。
- Note: initial review-only sub-agent `Hegel` was stopped after timeout without findings; `Cicero` reran a narrowed P1/P2 review.
