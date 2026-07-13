# 入出庫履歴ハブ + 廃棄・破損詳細

## Risk

Risk: R3

Reason:
operator-facing route/search state、Tauri command DTO / generated bindings、在庫変動 traceability の業務記録導線に触れる。DB schema は変更しないが、REQ-206 の最初の実装 slice として backend/frontend contract を追加する。

## Goal

`65-inventory-record-traceability.md` §65.10 の 3 番目として、`/inventory/records` の入出庫履歴ハブと `/inventory/disposal/records/$recordId` の廃棄・破損詳細を実装し、UI-06c の movement 元記録リンクから実際の詳細確認へ到達できるようにする。

## Scope

- `/inventory/records` route を追加し、入出庫履歴ハブを sidebar から開けるようにする。
- 横断履歴ハブの初回実装は `disposal_record` のみを実データとして表示する。他種別は後続 slice として空/準備中の扱いにする。
- `/inventory/disposal/records/$recordId` route を追加し、廃棄・破損ヘッダ、明細、ロス原価合計、関連 `inventory_movements`、商品別在庫変動履歴への導線を表示する。
- `listInventoryRecords(query)` と `getDisposalRecord(id)` 相当の generated command / BIZ / IO contract を追加する。
- UI-05 の recent list から「すべての履歴を見る」と詳細導線を追加する。

## Non-scope

- 入庫 / 返品・交換 / 手動販売 / CSV取込み / 棚卸しの詳細画面。
- 取消 / 訂正 command と UI。
- CSV出力、印刷、廃棄・破損画像添付。
- DB schema migration（status / movement_kind / attachment table 追加など）。
- 操作ログ UI。

## Acceptance Criteria

- `src/config/navigation.ts` の入出庫エリアに `入出庫履歴` が active で表示され、`/inventory/records` へ遷移できる。
- `commands.listInventoryRecords(...)` が generated binding に存在し、`record_type="disposal_record"` の記録を `business_date DESC, record_id DESC` で返す。
- `commands.getDisposalRecord(recordId)` が generated binding に存在し、存在しない ID は `CmdError.kind="not_found"` になる。
- `/inventory/records` が日付範囲 / 種別 / 記録ID / 商品キーワードを URL search state として扱い、filter 変更で page を 1 に戻す。
- `/inventory/disposal/records/$recordId` がヘッダ、明細、ロス原価合計、関連 movement、商品別在庫変動履歴 link を表示する。
- `src/features/disposal/DisposalPage.test.tsx` または新規 records test が recent list から履歴・詳細導線を検証する。
- `cargo test disposal_repo::tests`、`cargo test inventory_service::list`、`npm test -- InventoryRecordsPage DisposalRecordDetailPage DisposalPage`、`cargo run --bin generate_bindings`、`bash scripts/doc-consistency-check.sh` が成功する。
- Windows native L3 は owner 手動確認枠を残し、`/inventory/records` sidebar 導線、records filter、`/inventory/disposal/records/$recordId`、movement から detail への導線を確認する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-204 / REQ-206 / REQ-207、`docs/function-design/90-traceability.md`
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`
- Function / command / DTO: `docs/function-design/31-biz-inventory-service.md`, `docs/function-design/44-cmd-inventory.md`, `docs/function-design/64-ui-disposal.md`, `docs/function-design/65-inventory-record-traceability.md`, `docs/function-design/66-ui-stock-movements.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/transaction-tables.md`, `docs/db-design/tracking-system-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/function-design/52-ui-shared-layout.md`, `docs/design-system/README.md`
- Decision log / ADR: not required; existing `TRACE-D1/D2/D7` cover this slice.

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `65-inventory-record-traceability.md` §65.4/§65.5/§65.7, `64-ui-disposal.md`, `44-cmd-inventory.md` | existing sufficient for behavior; `44-cmd-inventory.md` updated in this PR if concrete command names differ |
| Command / DTO / generated binding / wire shape | `65-inventory-record-traceability.md` §65.7 | updated in this PR with concrete DTO names/fields |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `tracking-system-tables.md`, `transaction-tables.md` | existing sufficient; schema migration intentionally deferred |
| Screen / UI / route state / Japanese wording | `65-inventory-record-traceability.md` §65.3/§65.8, `SCREEN_DESIGN.md`, `52-ui-shared-layout.md` | existing sufficient for route/wording; nav implementation updated |
| CSV / TSV / report / import / export format | `65-inventory-record-traceability.md` §65.9 | intentionally deferred |
| Durable decision / ADR | `TRACE-D1/D2/D7` | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-206 | `65` §65.1/§65.3/§65.4/§65.8.1 | TRACE-D1 / TRACE-D7 | recent list だけでは過去記録調査に不足。作成画面へ検索 UI を詰め込む案は棄却。 | `listInventoryRecords`, `/inventory/records`, navigation | Rust list tests, `InventoryRecordsPage.test.tsx` |
| REQ-204 / REQ-206 | `64` §64.8, `65` §65.5 | TRACE-D1 | UI-05 初回は detail 非 scope だったため、今回 detail を追加する。 | `getDisposalRecord`, `/inventory/disposal/records/$recordId` | Rust detail tests, `DisposalRecordDetailPage.test.tsx` |
| REQ-207 | `65` §65.2/§65.5/§65.8.2, `66` §66.2 | TRACE-D2 | movement から元記録へ到達できないと在庫変動の根拠を追えない。 | movement source route の到達先 detail | detail link / movement list tests |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes. `65` が完成形と slice order、`64` が廃棄記録の既存作成 contract、`66` が movement source link を定義している。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none expected. Concrete DTO namesが source docs とズレる場合のみ `44` / `65` を更新する。
- Assumptions and constraints: 初回ハブは廃棄・破損実データのみ。返却単位は業務記録ヘッダ単位。検索対象が明細 JOIN でも duplicate header を返さない。
- Deferred design gaps, risk, and follow-up target: 取消/訂正、出力、画像添付、他記録種別の詳細は `Plans.md` の後続 slice。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: route、一覧/詳細項目、検索、役割分担、movement link、非 scope が `65` と `64` に明示されている。
- Source docs updated in this PR: concrete command / DTO names if implementationで確定した名前が既存 docs にない場合。
- Design gaps intentionally deferred: status/cancel/correct/attachment/export/print/schema migration。
- Durable decisions discovered in this plan and promoted to source docs: none yet.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated commands のみ。CMD は thin wrapper。BIZ は page validation と DTO assembly。IO は SQL。
- Backend function design: list は header 単位、detail は header + item + movement を返す。
- Command / DTO / data contract: generated binding を commit し、frontend は `commands.*` + `unwrapResult` のみ。
- Persistence / transaction / audit impact: read-only。schema / TX write impact なし。
- Operator workflow / Japanese UI wording: `入出庫履歴`, `廃棄・破損`, `有効`, `元記録`, `ロス原価合計` を主表示。
- Error, empty, retry, and recovery behavior: list/detail 取得失敗は inline Alert。0件は EmptyState。not_found は戻り導線。
- Testability and traceability IDs: REQ-204 / REQ-206 / REQ-207 を Rust/RTL tests に付与。

## Test Plan

Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-27-inventory-records-disposal-detail.md`

- targeted tests:
  - `cargo test disposal_repo`
  - `cargo test inventory_service::list`
  - `npm test -- InventoryRecordsPage DisposalRecordDetailPage DisposalPage`
- negative tests:
  - missing disposal record -> not_found
  - invalid page / per_page -> validation
  - filters with no matching rows -> empty
- compatibility checks:
  - existing `listDisposals` remains recent-list compatible
  - `listMovements` source route remains `/inventory/disposal/records/$id`
- data safety checks:
  - synthetic fixtures only; no real POS/store files
- main wiring/integration checks:
  - generated `commands.listInventoryRecords` / `commands.getDisposalRecord`
  - navigation active route

## Boundary / Wire Contract

- producer: Rust CMD `list_inventory_records`, `get_disposal_record`
- consumer: React `InventoryRecordsPage`, `DisposalRecordDetailPage`, UI-05 recent list links
- wire type:
  - `InventoryRecordQuery { record_type, date_from, date_to, record_id, product_keyword, department_id, status, page, per_page }`
  - `InventoryRecordSummary { record_type, record_id, business_date, representative_item, item_count, status, created_at, detail_route }`
  - `DisposalRecordDetail { id, disposal_date, status, created_at, items, total_loss_cost, movements }`
- internal type: DB repository structs under `disposal_repo` and `inventory_service::list`
- precision/range: IDs and money/quantity are i64 in Rust, JS number in generated binding; local SQLite IDs remain far below unsafe integer range
- round-trip path: DB -> IO -> BIZ -> CMD -> generated binding -> TanStack Query -> table/detail UI -> Link route
- invalid input: page/per_page invalid -> validation; missing detail ID -> not_found
- compatibility: additive commands/types only. Existing command names and `listDisposals` behavior unchanged.

## Review Focus

- Header-level list must not duplicate rows when multiple disposal items match a filter.
- Detail movement list must not hide rows lacking source; source route should point back to implemented detail.
- CMD must remain thin; business/page validation belongs in BIZ.
- UI must not infer business status by color only.
- Route/search state must be URL-reproducible and filter changes reset page to 1.

## Spec Contract

Contract ID: SPEC-INV-RECORDS-DISPOSAL-2026-06-27

- `/inventory/records` shows traceable business records separately from UI-05 recent list; first implementation returns disposal records and links to `/inventory/disposal/records/$recordId`.
- `/inventory/disposal/records/$recordId` is read-only and shows the disposal record, item rows, loss cost total, and related stock movements.
- Existing UI-06c movement source route for `disposal_record` becomes a live detail route without changing `listMovements` source contract.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-206 | list command + records route | Rust list tests / `InventoryRecordsPage.test.tsx` | header-level pagination/filter | command output + UI table |
| REQ-204 | detail command + detail route | Rust detail tests / `DisposalRecordDetailPage.test.tsx` | item rows and loss total | detail UI |
| REQ-207 | movement source route reaches detail | `MovementTable` existing + detail route tests | link contract not broken | generated binding + route |

## Data Safety

- Do not read or commit real POS CSV, PLU export files, store data, DB files, backups, logs, receipt images, secrets, credentials, or `.env*`.
- Local-only paths remain `.local/`, app data, generated logs, `target/`, `src-tauri/target/`, `node_modules/`, `dist/`.
- Tests use synthetic products and disposal records only.

## Implementation Results

- Backend:
  - `list_inventory_records(query)` / `get_disposal_record(record_id)` を CMD/BIZ/IO に追加し、generated bindings に `commands.listInventoryRecords` / `commands.getDisposalRecord` を追加した。
  - 初期スライスは `disposal_record` のみ実データ対応。`record_id` / `product_keyword` / `department_id` / `status` / date range でヘッダ単位検索し、明細 JOIN による重複を `EXISTS` で避ける。
  - 廃棄詳細は header / item / line_loss_cost / total_loss_cost / non-voided movements を返し、BIZ で movement source link を補完する。
- Frontend:
  - `/inventory/records` と `/inventory/disposal/records/$recordId` route を追加し、sidebar の入出庫エリアに `入出庫履歴` を active 追加した。
  - 履歴ハブは種別、日付、商品、記録ID、部門、状態を URL search state として扱い、filter 変更で page を 1 に戻す。
  - UI-05 recent list から「すべての履歴を見る」と廃棄詳細へ遷移できるようにした。
  - UI-06c movement 元記録リンクに `returnTo` を付け、廃棄詳細から filtered/paged movement list に戻れるようにした。
- Docs:
  - `21-io-inventory-repo.md` と `44-cmd-inventory.md` に新規 IO/CMD/BIZ contract を追記し、`90-traceability.md` を再生成した。
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm test`（77 files / 466 tests）
  - `npm run build`
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`（575 lib tests + integration/doc tests）
  - `cargo run --bin generate_bindings`
  - `cargo run --bin generate_traceability -- --check`
  - `bash scripts/doc-consistency-check.sh`

## Review Response

- review-only sub-agent: Volta（fresh context / fork_context=false）
- P2 accepted: 履歴ハブ UI が記録ID・部門・状態 filter を操作不能だった。`InventoryRecordsPage` / route search schema / tests に recordId / departmentId / status を追加して対応。
- P2 accepted: movement list から廃棄詳細へ入った場合の戻り先が `/inventory/records` 固定だった。`MovementTable` に `returnTo` 付与、detail route/search と `DisposalRecordDetailPage` の戻り導線で保持するよう対応。
- P3 accepted: `InventoryRecordSummary.representative_item` の docs が nullable、実装が non-null だった。IO/CMD docs を `String` に合わせた。
- Windows native L3 feedback accepted: `/inventory/records` 商品検索欄で日本語 IME 変換中に `ボタン` が `bおtあnn` のように崩れる。原因は商品検索 input が composition 中の `onChange` でも URL search state を即時更新し、Windows WebView の IME composition を再描画で壊していたこと。`InventoryRecordsPage` の商品検索を local draft + composition guard に変更し、合成中は URL state を更新せず、確定後に `q` と page reset を反映するよう修正した。
- Windows native L3 feedback accepted: `/inventory/records` の `詳細を見る` が `/inventory/disposal` 作成画面へ落ち、UI-05 recent list の `詳細を見る` も遷移しない。原因は二段階で、まず `src/routeTree.gen.ts` が `.gitignore` 対象のため Windows native clone の古い generated route tree が残っても `npm run tauri dev` で明示再生成されなかった。加えて、detail route は `/inventory/disposal` の子として生成されるが、親 route が `DisposalPage` を直接描画し `<Outlet />` を持たないため、detail URL でも作成画面だけが表示されていた。`package.json` の `dev` script を `npm run generate:routes && vite` に変更し、`/inventory/disposal` を `<Outlet />` 付き親 route、廃棄入力画面を index 子 route に分離して修正した。
- Windows native L3 feedback accepted: ID 3 detail 表示は OK。詳細から戻ると `/inventory/records` 自体には戻れるが、直前の一覧フィルター状態が保持されなかった。`/inventory/records` は URL search state を source of truth とするため、一覧 detail link は現在の検索条件付き `/inventory/records?...` を `returnTo` に渡し、戻り導線でフィルター状態を復元するよう修正した。
- Windows native L3 feedback accepted: UI-05 recent list の操作列 `詳細を見る` が text/ghost 寄りで押せる操作として弱かった。operator-facing table の操作として判別しやすいよう、outline button + `Eye` icon に変更した。
- Design follow-up accepted: 一覧 detail から戻る filter 保持は、movement list の戻り条件保持とは別シーンだったため、既存仕様の実装漏れではなく L3 feedback による新仕様追加として扱う。`docs/function-design/65-inventory-record-traceability.md` に TRACE-D11 を追加し、`returnTo` はアプリ内 path のみ許可、不正値は `/inventory/records` へフォールバックする方針を source docs に昇格した。あわせて `docs/DEV_WORKFLOW.md` / `docs/decision-log.md` に、仕様追加・見直し時は隣接仕様との整合・悪用/誤解・将来横展開を一旦高めの risk で確認し、必要な mitigation を source docs に入れる運用を記録した。
- Verification after L3 feedback:
  - `npm test -- src/features/inventory-records/InventoryRecordsPage.test.tsx`
  - `npm test -- src/features/disposal/DisposalPage.test.tsx`
  - `npm test -- src/config/dev-script.test.ts`
  - `npm test -- src/features/inventory-records/DisposalRecordDetailRoute.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- Windows native L3 result: owner 手動確認完了。sidebar / filter 1-9、ID 3 detail（毛糸/布 2 明細、ロス原価合計 8,080、在庫変動 2 行）、一覧 detail から戻った際の filter return、UI-05 recent list の「すべての履歴を見る」/ detail button、UI-06c `L3IR-K001` movement -> ID 3 detail -> movement return（種別 filter 保持含む）を確認済み。
- Ready review accepted: PR #114 を Ready for review に切り替えた後、fresh context の review-only sub-agent Meitner で初回実装から現在までの full diff を確認した。P2 accepted: UI-05 で廃棄・破損保存後に `queryKeys.inventoryRecords.root()` を invalidate しておらず、直前に `/inventory/records` を開いていた場合に staleTime 中は新規記録が履歴一覧へ出ない可能性があった。`DisposalPage` の保存成功時 invalidate と `DisposalPage.test.tsx` の期待に `queryKeys.inventoryRecords.root()` を追加して対応。
- Verification after Ready review:
  - `npm test -- src/features/disposal/DisposalPage.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
- Merge result: PR #114 squash merge 済み（`97811b7`、2026-06-27 JST）。post-merge で active plan / test matrix を archive へ移送し、`Plans.md` / `PROJECT_HANDOFF.md` / `project-memory.md` を同期した。
- residual risk: Windows native L3 で確認した範囲に未解決の利用者指摘なし。後続 risk は次スライスの入庫 / 返品・交換 / 手動販売 detail 横展開時の sibling route consistency。今回追加した隣接仕様整合の workflow ルールは次の detail 横展開 Design Phase で dogfood する。
