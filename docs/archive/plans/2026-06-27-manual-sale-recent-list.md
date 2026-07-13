# 手動販売出庫 recent list follow-up

## Risk

Risk: R3

Reason:
operator-facing UI-04 に保存直後確認用の recent list を追加し、`/inventory/records` と手動販売詳細への route 導線を増やす。DB schema と command wire shape は変更しないが、画面内の query / navigation / L3 確認対象が増える。

## Goal

UI-04 手動販売出庫に、入庫 / 返品・交換 / 廃棄・破損と同じ保存直後確認用の recent list を追加する。

## Scope

- `/inventory/manual-sale` に `直近の手動販売出庫` セクションを追加する。
- recent list は既存 `commands.listInventoryRecords(query)` を `record_type="manual_sale"`, `page=1`, `per_page=5` で呼ぶ。
- セクション見出し右側に `すべての履歴を見る` を置き、`/inventory/records?recordType=manual_sale` へ遷移する。
- 各行に `詳細を見る` を置き、`/inventory/manual-sale/records/$recordId` へ遷移する。
- 保存成功時の既存 `queryKeys.inventoryRecords.root()` invalidation で recent list も更新されることを確認する。
- UI-04 / 65 / SCREEN_DESIGN の source docs を current behavior に更新する。

## Non-scope

- 新規 backend command / DTO / generated binding 追加。
- 手動販売作成画面内での検索、取消、訂正、詳細本文表示。
- 手動販売専用履歴一覧 route `/inventory/manual-sale/records` の実装。
- CSV出力、印刷、帳票控え。

## Acceptance Criteria

- `src/features/manual-sale/ManualSalePage.test.tsx` に `REQ-203/REQ-206: recent list exposes all-history and detail links` 相当のテストがあり、`すべての履歴を見る` href が `/inventory/records?recordType=manual_sale`、`詳細を見る` href が `/inventory/manual-sale/records/{id}` であることを確認する。
- `ManualSalePage` が `commands.listInventoryRecords` を `record_type: "manual_sale"` で呼ぶ。
- `ManualSalePage.test.tsx` の empty/error tests で、recent list 0件・取得失敗時も `手動販売商品検索` が enabled のままであることを確認する。
- 保存成功後に `queryKeys.inventoryRecords.root()` が invalidate される既存 behavior が維持される。
- `npm test -- src/features/manual-sale/ManualSalePage.test.tsx` が成功する。
- `npm run typecheck` / `npm run lint` / `npm run format:check` / `bash scripts/doc-consistency-check.sh` / `bash scripts/doc-consistency-check.sh --target plan` が成功する。
- Windows native L3 で `直近の手動販売出庫`、`すべての履歴を見る`、`詳細を見る`、保存後の recent 更新を確認する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-203 / REQ-206 / REQ-207、`docs/function-design/90-traceability.md`
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`
- Function / command / DTO: `docs/function-design/44-cmd-inventory.md`, `docs/function-design/62-ui-manual-sale.md`, `docs/function-design/65-inventory-record-traceability.md`
- DB: existing sufficient; no schema change
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/design-system/README.md`
- Decision log / ADR: existing workflow lesson in `docs/decision-log.md`; no new ADR

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `44-cmd-inventory.md`, `65-inventory-record-traceability.md` | existing sufficient; reuse `listInventoryRecords` |
| Command / DTO / generated binding / wire shape | `44-cmd-inventory.md` | existing sufficient; no new binding |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md` | existing sufficient; read-only list |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `62-ui-manual-sale.md`, `65-inventory-record-traceability.md` | updated in this PR |
| CSV / TSV / report / import / export format | — | intentionally deferred |
| Durable decision / ADR | `65` TRACE-D7, `62` UI-04-D15 | updated in source docs |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-203 / REQ-206 | `62` §62.1/§62.5/§62.7, `65` §65.10 | UI-04-D15 / TRACE-D7 | UI-02/03/05 と保存直後確認をそろえる。検索・取消・訂正を作成画面へ持ち込む案は責務過多のため不採用。 | `ManualSalePage` recent section | `ManualSalePage.test.tsx` recent links |
| REQ-206 | `65` §65.8/§65.10 | TRACE-D1/D7 | recent list は履歴検索の代替ではなく `/inventory/records` への入口。 | all-history link with manual_sale filter | href assertion |
| REQ-207 | `65` §65.5/§65.8 | TRACE-D2 | recent detail link は手動販売詳細 route の再確認導線。 | detail link | href assertion |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `62` UI-04-D15 と `65` §65.10 が recent list の責務と非 scope を定義する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 手動販売 recent list 追加は `62` / `65` / `SCREEN_DESIGN` へ昇格済み。
- Assumptions and constraints: recent list は `listInventoryRecords` の manual_sale filter を使う。表示はヘッダ単位で、明細検索や取消は扱わない。
- Deferred design gaps, risk, and follow-up target: 専用履歴一覧、取消/訂正、CSV/印刷は完成形後続 slice。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: `listInventoryRecords` と手動販売 detail route は PR #115 で実装済み。
- Source docs updated in this PR: `62-ui-manual-sale.md`, `65-inventory-record-traceability.md`, `SCREEN_DESIGN.md`。
- Design gaps intentionally deferred: 専用一覧 route / 取消 / 訂正 / export。
- Durable decisions discovered in this plan and promoted to source docs: UI-04-D15。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は existing generated command のみを呼ぶ。BIZ/IO 追加なし。
- Backend function design: `listInventoryRecords` の manual_sale filter を再利用。
- Command / DTO / data contract: new command/type なし。
- Persistence / transaction / audit impact: read-only list と existing create invalidation のみ。
- Operator workflow / Japanese UI wording: `直近の手動販売出庫`, `すべての履歴を見る`, `詳細を見る`。
- Error, empty, retry, and recovery behavior: recent 取得失敗は section-local Alert。入力フォームは継続。
- Testability and traceability IDs: REQ-203 / REQ-206 を RTL に付与。

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-06-27-manual-sale-recent-list.md`

- targeted tests:
  - `npm test -- src/features/manual-sale/ManualSalePage.test.tsx`
- negative tests:
  - recent list 0件 empty state
  - recent list command error
- compatibility checks:
  - existing save result detail link remains unchanged
  - existing createManualSale query invalidation still includes `inventoryRecords.root()`
- data safety checks:
  - synthetic fixtures only
- main wiring/integration checks:
  - `commands.listInventoryRecords` query shape
  - all-history and detail link href

## Boundary / Wire Contract

- producer: existing Rust CMD `list_inventory_records`
- consumer: React `ManualSalePage`
- wire type: existing `InventoryRecordQuery` / `PaginatedResult<InventoryRecordSummary>`
- internal type: existing `InventoryRecordSummary`
- precision/range: existing local SQLite IDs as TS number
- round-trip path: DB -> IO/BIZ listInventoryRecords -> CMD -> generated binding -> TanStack Query -> recent table -> detail link
- invalid input: fixed UI query; no user-provided recent filters
- compatibility: additive UI only; no command/schema change

## Review Focus

- Do not add duplicate manual-sale-specific list command unless existing `listInventoryRecords` cannot satisfy the UI.
- Recent list must stay section-local; do not add search/cancel/correct controls to UI-04.
- Links must use `recordType=manual_sale` and `/inventory/manual-sale/records/$recordId`.
- Save success must refresh recent list through `queryKeys.inventoryRecords.root()`.

## Spec Contract

Contract ID: SPEC-MANUAL-SALE-RECENT-2026-06-27

- UI-04 manual sale shows a recent list for save-confirmation only, backed by existing inventory records list contract.
- UI-04 recent list links to filtered inventory records and manual sale detail without introducing a new backend command.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-203 / REQ-206 | recent list render | `ManualSalePage.test.tsx` recent test | query shape and Japanese labels | RTL |
| REQ-206 | all-history link | `ManualSalePage.test.tsx` href assertion | `recordType=manual_sale` | RTL |
| REQ-207 | detail link | `ManualSalePage.test.tsx` href assertion | detail route id | RTL |

## Data Safety

- Do not read or commit real POS CSV, PLU export files, store data, DB files, backups, logs, receipt images, secrets, credentials, or `.env*`.
- Local-only paths remain `.local/`, app data, generated logs, `target/`, `src-tauri/target/`, `node_modules/`, `dist/`.
- Tests use synthetic products and synthetic business records only.

## Implementation Results

- Implemented `直近の手動販売出庫` in `src/features/manual-sale/ManualSalePage.tsx`.
  - Uses existing `commands.listInventoryRecords` with `record_type="manual_sale"`, `page=1`, `per_page=5`, and null user filters.
  - Adds `すべての履歴を見る` to `/inventory/records?recordType=manual_sale`.
  - Adds row `詳細を見る` to `/inventory/manual-sale/records/$recordId`.
  - Keeps loading / empty / error states section-local so the manual-sale input form remains usable.
- Added RTL coverage in `src/features/manual-sale/ManualSalePage.test.tsx`.
  - recent query shape, all-history href, detail href
  - empty state keeps `手動販売商品検索` enabled
  - error state keeps `手動販売商品検索` enabled
  - existing save-result invalidation continues to cover `queryKeys.inventoryRecords.root()`
- Updated source docs: `62-ui-manual-sale.md`, `65-inventory-record-traceability.md`, `SCREEN_DESIGN.md`.
- Regenerated `docs/function-design/90-traceability.md`.
- Archived PR #115 plan/test matrix and added Workflow Effectiveness Review for the previous R3 PR.
- Validation:
  - `npm test -- src/features/manual-sale/ManualSalePage.test.tsx` pass, 14 tests.
  - `npm test -- src/features/manual-sale/ManualSalePage.test.tsx src/features/inventory-records/InventoryRecordsPage.test.tsx` pass, 18 tests.
  - `npm run typecheck` pass.
  - `npm run lint` pass.
  - `npm run format:check` pass.
  - `npm run build` pass.
  - `npm test` pass, 81 files / 482 tests.
  - `bash scripts/doc-consistency-check.sh --target plan` pass.
  - `bash scripts/doc-consistency-check.sh` pass.
  - `cargo run --bin generate_traceability -- --check` pass, ERROR 0 / WARN 0.
  - `git diff --check` pass.
- L3 feedback after owner checks 1-8:
  - Owner confirmed the manual-sale recent list checkpoints through item 8.
  - Added same-PR follow-up so UI-02/03/04/05 scroll to the page top after save success, PLU confirmation, or command failure because result panels and save Alerts render near the top while save buttons can be below the fold.
  - Frontend validation errors intentionally stay near the invalid field/table and do not force a page-top scroll.
  - Added shared `scrollPageToTop` helper coverage plus save-result, command-failure, PLU confirmation, and representative validation no-scroll RTL expectations.
- Windows native L3 completion:
  - Owner confirmed the page-top scroll behavior works as expected.
  - All PR #116 manual test checkpoints are complete.
  - Follow-up captured outside PR #116 scope: UI-03 返品・交換の備考が項目立て不足と薄い文字で見づらい。返品・交換では備考の必要性が高いため、次回 UI-03 visibility improvement で独立項目化とコントラストを見直す。
- L3 feedback validation:
  - `npm test -- src/lib/page-scroll.test.ts src/features/receiving/ReceivingPage.test.tsx src/features/return-exchange/ReturnExchangePage.test.tsx src/features/manual-sale/ManualSalePage.test.tsx src/features/disposal/DisposalPage.test.tsx` pass, 5 files / 54 tests.
  - `npm run typecheck` pass.
  - `npm run lint` pass.
  - `npm run format:check` pass.
  - `npm test` pass, 82 files / 485 tests.
  - `npm run build` pass.
  - `bash scripts/doc-consistency-check.sh --target plan` pass.
  - `bash scripts/doc-consistency-check.sh` pass.
  - `cargo run --bin generate_traceability -- --check` pass, ERROR 0 / WARN 0.
  - `git diff --check` pass.
- Pending: push the L3 completion / follow-up documentation update, then mark PR #116 Ready when the owner asks.

## Review Response

- Review-only sub-agent `Ohm` result: P1/P2 none.
- P3 accepted: Plan Packet / `Plans.md` / `PROJECT_HANDOFF.md` still described the work as preparation-only after implementation and gates had completed.
  - Action: recorded implementation results, review result, validation, and pending Windows native L3 in this Plan Packet and live status docs.
- L3 feedback review-only sub-agent `Chandrasekhar` result: P1 none, P2 accepted.
  - Finding: save-result scrolling tests covered success only, while the source docs also required command-failure, PLU confirmation, and validation no-scroll behavior.
  - Action: added command-failure scroll assertions for UI-02/03/04/05, PLU confirmation scroll assertion for UI-04, and representative frontend validation no-scroll assertions.
- Residual risk: TanStack Router click behavior is covered by RTL Link mocks and build; native click/navigation is intentionally left for Windows native L3 before Ready/merge.
