# Plan Packet: 価格改定支援 実装 A — backend（revise_product_price / create_supplier / list_price_history / keyword maker_code）+ UI-01a 原価列 + UI-01b 価格履歴・取引先 inline 追加（issue #90、SPEC-PRV 実装 A）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: ae80660
- Amendments: none
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet
- Final Reviewer: Sonnet
- Reviewed Content HEAD: f87a363
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Plan Gate 承認済み → human visual confirmation（Windows native L3 3 項目）PASS + Ready 承認済み（2026-08-23、介入 2/3）→ hosted final（Rust / TS / bindings を含む non-doc change のため CI-TRIGGER-D1 の Ready / `synchronize` 経路で自動 run。予防的 `workflow_dispatch` はしない）→ 三点一致 → merge

## Owner Effort Budget

- 介入回数上限: 3（Plan Gate 承認 + L3 PASS/FAIL と Ready 承認 + 予備 1）
- 実働時間上限: 30分
- relay 往復上限: 2（第 1 発注 = 実装本体、第 2 発注 = Final Review 是正 delta がある場合のみ）
- Plan Review round 天井: 3（既定 3）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。使う場合はtarget branch / PRへorder commitを混ぜず、artifact pathと専用remote order branch refを宣言する。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
(a) Tauri command DTO を 3 件新設し `bindings.ts` を再生成する（wire contract）、(b) `products` 部分更新 + `price_history` + `operation_logs` を 1 transaction で書く BIZ を新設し、売価変更時の `plu_dirty` は POS 連携（PLU TSV）へ波及する、(c) 検索 keyword の一致範囲拡張は一括 PLU 対象化（`find_products_for_bulk_plu_target`）の母集団も意図的に変える、(d) operator 画面 2 つ（UI-01a / UI-01b）の変更を含む。DB 書込み + DTO + operator workflow のいずれも R3 条件（`docs/DEV_WORKFLOW.md` Risk Level）に該当する。

## Goal

Goal Invariant: 値上げリストの行から商品へ到達し（メーカー品番でも検索できる）、売価・原価を no-op / plu_dirty / supplier の絶対保証を守って改定し、履歴を残し、必要な取引先をその場で追加できる backend と、既存 UI-01a / UI-01b での最小の可視化（原価列 / 価格履歴 / 取引先追加）を、実装 B（UI-14）と実装 C（入庫 cost_diffs）が追加の backend 実装なしに依存できる形で main に入れる。

### 最小完了条件

- UI-01a の検索欄にメーカー品番の一部を入力すると該当商品が一覧に出て、一覧の「原価」列が「売価」の右隣に表示される。
- UI-01b 修正モードに「価格履歴」セクションが表示され、売価または原価を変えて保存し直すと新しい履歴行が増える。新規登録モードではセクションが出ない。
- UI-01b の取引先欄の「新しい取引先を追加」で取引先を登録すると、候補一覧に現れて選択状態にできる。
- CMD `revise_product_price` / `create_supplier` / `list_price_history` が `src/lib/bindings.ts` に生成され、`commands.reviseProductPrice` / `commands.createSupplier` / `commands.listPriceHistory` として呼べる（実装 B / C の前提）。

### 失敗定義

- no-op で `price_history` または `operation_logs` が書かれる / 原価のみの変更で `plu_dirty` が立つ / 既存の非 NULL `supplier_id` が上書きされる、のいずれかが起こる（SPEC-PRV-D5 / D6 の絶対保証の破れ）。
- 既存の `update_product` / `search_products` / `bulk_set_plu_target` の test が退行する、または既存 CMD の wire が変わる。
- 登録・生成義務（`lib.rs` の `collect_commands!` と `generate_handler!` の両方 / `bindings.ts` 再生成 / `90-traceability.md` 再生成）の漏れが L1 以降で顕在化する。

### 非目的

- UI-14 一括価格改定画面（実装 B）/ 入庫時原価差分検出 `cost_diffs`（実装 C）/ navigation への画面追加。
- schema 変更（price_history の契機カラム、掛率や暫定原価の永続化）。
- 取引先の改名・統合・約 80 社の事前一括投入（D-075）。
- 共有 `SearchBar` の default placeholder 文言の変更（58-ui / InventoryRecordsPage が現文言を契約として持つ）。
- 既存 `update_product` の契約変更（価格改定の入口は新設 `revise_product_price` に限定）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- IO `src-tauri/src/db/product_repo.rs`:
  - `search_products` と `find_products_for_bulk_plu_target` の keyword LIKE 句に `p.maker_code LIKE '%keyword%'` を追加（SPEC-PRV-D2、20-io §2 `ProductSearchQuery.keyword` / `ProductBulkFilter`、30-biz §4.9.1 の母集団拡張の明記に従う）。
  - `list_price_history(conn: &DbConnection, product_code: &str, limit: u32) -> Result<Vec<PriceHistoryEntry>, DbError>` と `PriceHistoryEntry { id, old_selling_price, new_selling_price, old_cost_price, new_cost_price, changed_at }` を新設（20-io §2.6）。`limit` は 100 超を 100 に丸め、`WHERE product_code = ? ORDER BY changed_at DESC, id DESC LIMIT ?`、不存在 product_code は空配列。
  - 既存 `insert_price_history` / `find_or_create_supplier` / `find_supplier_by_id` / `list_suppliers` は流用し、契約を変えない。
- BIZ `src-tauri/src/biz/product_service.rs`:
  - `revise_product_price(conn: &mut DbConnection, input: PriceRevisionInput) -> Result<PriceRevisionResult, BizError>` と `PriceRevisionInput` / `PriceRevisionResult` を新設（30-biz §4.4.1 step 1〜6）。operation_type は文字列 `"product_price_revise"`（既存 `"product_update"` と同じ free-string 慣行、`system_repo::insert_operation_log`）。
  - `create_supplier(conn: &DbConnection, name: String) -> Result<product_repo::Supplier, BizError>`（§4.7.2: trim → 空文字 `ValidationFailed` → `find_or_create_supplier`）。
  - `list_price_history(conn: &DbConnection, product_code: String, limit: u32) -> Result<Vec<product_repo::PriceHistoryEntry>, BizError>`（§4.7.3）。
  - error 対応: 不存在 product → `BizError::NotFound`、負値 / 空文字 → `BizError::ValidationFailed`、`assign_supplier_id = Some(id)` で supplier 不存在 → `BizError::NotFound`（SPEC-PRVA-D3、40-cmd の「不存在 `assign_supplier_id` は not-found へ正規化」の BIZ 側具体化）。
- CMD `src-tauri/src/cmd/product_cmd.rs`: `revise_product_price` / `create_supplier` / `list_price_history` を 40-cmd のシグネチャどおり新設（`#[tauri::command]` + `#[specta::specta]`、DTO は 40-cmd の struct 名・field 名・型どおり）。`src-tauri/src/lib.rs` の `collect_commands!` と `tauri::generate_handler!` の **両方** に追加する。
- 生成物: `cd src-tauri && cargo run --bin generate_bindings` で `src/lib/bindings.ts` を再生成し commit する（archived Matrix 予約節の `npm run generate:bindings` は存在しない script のため、本 packet の cargo コマンドを正とする）。`cargo run --bin generate_traceability` で `docs/function-design/90-traceability.md` を再生成し、REQ-105 / REQ-106 の T3 WARN（`no-test`）を解消する。
- UI-01a `src/features/products/components/ProductTable.tsx`: 「原価」列ヘッダと値（`cost_price`）を「売価」列の右隣に追加し、売価と同じ右寄せ・通貨書式にする（UI-01a-D13 / SPEC-PRV-D10、50-ui §50.6）。`src/features/products/ProductListPage.tsx` の `SearchBar` に `placeholder="商品コード・商品名・JAN・メーカー品番で検索"` を渡す（SPEC-PRVA-D1、共有 default は変えない）。`docs/function-design/50-ui-product-list.md` §50.6 の検索欄 bullet に placeholder 文言を 1 文追記する（updated in this PR）。
- UI-01b `src/features/products/components/ProductForm.tsx` + 新設 `src/features/products/components/PriceHistorySection.tsx`: edit mode のみ第 5 セクション「価格履歴」（h2）を末尾に置き、`commands.listPriceHistory(productCode, 10)` を新しい順に表示、「すべて表示」で limit 100 を再取得、create mode では描画しない（UI-01b-D20）。空 / 取得中 / 取得失敗の表示は SPEC-PRVA-D2 に従い、`docs/function-design/51-ui-product-form.md` の UI-01b-D20 行へ 1 文追記する（updated in this PR）。
- UI-01b 取引先 inline 追加（UI-01b-D21）: 「分類と取引先」セクションの取引先 select に「新しい取引先を追加」導線を併設。入力 name は trim、空文字は field error として CMD を呼ばない、`commands.createSupplier(name)` 成功後に `listSuppliers` を再取得して返された supplier を選択状態にし、失敗時は入力を保持して error を表示する。
- テスト: Rust は archived Matrix「実装 PR への予約 → 実装 A」の test 名を全件実装し、本 packet の Matrix で追加した名前（`test_revise_product_price_req105_not_found_product` / `test_revise_product_price_req106_unknown_supplier_id_not_found` / `test_revise_product_price_req106_assigns_supplier_when_price_unchanged` / `test_revise_product_price_req105_persists_large_values_exactly` / `test_list_price_history_req102_clamps_limit_over_max` / `test_list_price_history_req102_unknown_product_returns_empty`）を加える。DTO の配置は SPEC-PRVA-D5（BIZ 所有、CMD は qualified path 参照）。RTL は `ProductTable.test.tsx` / `ProductListPage.test.tsx` / `ProductForm.test.tsx` を拡張する（既存 test は改変しない）。
- Writer 完了条件に `cd src-tauri && cargo check --release`（Human Gate が L3 を含むため、CI gate ではない）。

## Non-scope

- `docs/function-design/77-ui-bulk-price-revision.md`（UI-14）の実装、`src/config/navigation.ts` の変更、route 追加。
- `create_receiving` / `ReceivingCreateResult.cost_diffs`（実装 C）。
- `suppliers` / `products` / `price_history` の schema 変更、migration 追加（既存 `schema_v1.rs` で全テーブル・全列が存在）。
- 共有 `src/components/patterns/SearchBar.tsx` の default placeholder、`InventoryRecordsPage` / `StockInquiryPage` の検索文言。
- 既存 `update_product` の price_history / plu_dirty 規則の変更。
- 取引先の編集・削除・統合 UI。

## Acceptance Criteria

- `cd src-tauri && cargo test` が PASS し、Test Design Matrix の Rust test 名が各 file に 1 回ずつ存在する（`rg -c "fn <name>" src-tauri/src/db/product_repo.rs src-tauri/src/biz/product_service.rs` で各 1）。
- `cd src-tauri && cargo run --bin generate_traceability -- --check` が exit 0 で、`rg -c "REQ-105.*no-test|REQ-106.*no-test" docs/function-design/90-traceability.md` が 0。
- `cd src-tauri && cargo run --bin generate_bindings` 実行後に `git diff --stat src/lib/bindings.ts` が空（commit 済みと一致）で、`rg -c "reviseProductPrice|createSupplier|listPriceHistory" src/lib/bindings.ts` が 3 以上、`rg -c "PriceRevisionInput|PriceRevisionResult|PriceHistoryEntry" src/lib/bindings.ts` が 3 以上。
- `rg -n "revise_product_price|create_supplier|list_price_history" src-tauri/src/lib.rs` が `collect_commands!` と `generate_handler!` の両 list に各 3 件（合計 6 行以上）。
- `cd src-tauri && cargo test --test design_compliance_test` が PASS（新 pub fn は 20-io / 30-biz / 40-cmd のコードブロックに既に存在するため allowlist 追加なし）。
- `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm test` が PASS し、`ProductTable.test.tsx` / `ProductListPage.test.tsx` / `ProductForm.test.tsx` に Matrix 記載の RTL case が存在する。
- `bash scripts/doc-consistency-check.sh` exit 0（既存 WARN を除く）、`bash scripts/doc-consistency-check.sh --target plan` 全チェック通過。
- `bash scripts/local-ci.sh full` RESULT=PASS / END_TREE_STATE=CLEAN（content candidate と Ready exact-HEAD の 2 回、evidence は PR body）。
- human visual confirmation（Windows native L3）の結果が PR body の `Human Gate` 欄に `L3: PASS` または `L3: FAIL` の文字列で記録されている（`gh pr view --json body` で確認）。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-102 / REQ-103 / REQ-105 / REQ-106、`docs/spec/requirements-coverage.md` SP-102-08 / SP-103-04
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO）
- Function / command / DTO: `docs/function-design/20-io-product-repo.md` §2 keyword / §2.6、`docs/function-design/30-biz-product-service.md` §4.4.1 / §4.7.2 / §4.7.3 / §4.9.1、`docs/function-design/40-cmd-product.md` revise_product_price / create_supplier / list_price_history
- DB: `docs/db-design/master-tables.md` §3（suppliers 意味 / 漸進補完）、`docs/db-design/tracking-system-tables.md` §15 price_history / §18 operation_logs
- Screen / UI: `docs/function-design/50-ui-product-list.md` UI-01a-D13 / §50.6、`docs/function-design/51-ui-product-form.md` UI-01b-D7 / D20 / D21
- Decision log / ADR: `docs/decision-log.md` D-075、archived design packet `docs/archive/plans/2026-08-22-price-revision-design.md` SPEC-PRV-D2 / D5 / D6 / D9 / D10、archived Matrix `docs/archive/plans/test-matrices/2026-08-22-price-revision-design.md`「実装 PR への予約 → 実装 A」

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 20-io §2 / §2.6、30-biz §4.4.1 / §4.7.2 / §4.7.3 / §4.9.1 | existing sufficient |
| Command / DTO / generated binding / wire shape | 40-cmd 3 CMD + DTO、`bindings.ts`（生成） | existing sufficient（bindings は生成物） |
| DB / transaction / audit / rollback / migration | master-tables §3、tracking-system-tables §15 / §18、schema_v1.rs 既存 | existing sufficient（migration なし） |
| Screen / UI / route state / Japanese wording | 50-ui UI-01a-D13 / §50.6、51-ui UI-01b-D20 / D21 | existing sufficient + updated in this PR（50-ui §50.6 placeholder 1 文、51-ui D20 の空 / 失敗表示 1 文） |
| CSV / TSV / report / import / export format | 該当なし（PLU TSV 契約は不変、`plu_dirty` は既存経路） | existing sufficient |
| Durable decision / ADR | D-075、SPEC-PRV-D2 / D5 / D6 / D9 / D10（source docs 転記済み） | existing sufficient |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command（`revise_product_price` / `create_supplier` / `list_price_history`） | `lib.rs` の `collect_commands!` **と** `tauri::generate_handler!` の両 list へ登録 / `#[tauri::command]` + `#[specta::specta]` の対 / `cd src-tauri && cargo run --bin generate_bindings` で `bindings.ts` 再生成 + commit |
| function-design doc 新設 | 該当なし（新設 doc なし。新 pub fn は既存 20-io / 30-biz / 40-cmd のコードブロックに記載済みで `design_compliance_test` の regex が検出する） |
| source / workflow doc 新設・改名 | 該当なし（50-ui / 51-ui は既存 doc への 1 文追記のみ） |
| AGENT_OPERATING_MANUAL §5.5 consultation relay 使用 | 該当なし |
| REQ coverage 追加（テスト追加） | `_req105_` / `_req106_` / `_req102_` token を持つ test 追加のため `cd src-tauri && cargo run --bin generate_traceability` で `90-traceability.md` 再生成（手動編集禁止） |
| route 新設 | 該当なし |
| operator 画面新設 | 該当なし（既存 UI-01a / UI-01b の変更、到達導線は既存） |

## Design Decisions（packet-local、SPEC-PRVA-D1〜D5）

### SPEC-PRVA-D1: UI-01a 検索欄の placeholder 文言

- `ProductListPage` の `SearchBar` に `placeholder="商品コード・商品名・JAN・メーカー品番で検索"` を渡す。共有 `SearchBar` の default（`"商品コード・商品名・JANで検索"`）は変えない（`docs/function-design/58-ui-stock-inquiry.md` の placeholder 記載と `InventoryRecordsPage.test.tsx` の既存 assertion が現文言を契約として持つ）。
- 理由: 50-ui §50.6 は keyword がメーカー品番を扱うことを契約にするが、placeholder 文言は未記載。操作者がメーカー品番で探せることを検索欄自体で示す。
- 却下: 共有 default の変更（在庫照会 / 入出庫履歴の検索は maker_code 一致を持たず、文言が嘘になる）。
- 転記先: 50-ui §50.6 検索欄 bullet に 1 文（本 PR）。

### SPEC-PRVA-D2: 価格履歴セクションの空 / 取得中 / 取得失敗の表示

- 履歴 0 件: 「価格履歴はまだありません」を本文に表示（セクションと h2 は出す）。取得中: 「読み込み中…」。取得失敗: セクション内に inline error と「再試行」button（取引先取得失敗と同じ復旧パターン、51-ui §エラー処理）。いずれも色だけで状態を表さない。
- 理由: UI-01b-D20 は 10 件 / すべて表示 / create 非表示だけを決めており、空 / 失敗の operator 文言が source docs にないと Writer と Final Reviewer の判断が割れる。
- 転記先: 51-ui の UI-01b-D20 行（または §エラー処理 bullet）に 1 文（本 PR）。

### SPEC-PRVA-D3: `assign_supplier_id` 不存在の検証順序

- `assign_supplier_id = Some(id)` のとき、価格変更の有無に関わらず最初に `product_repo::find_supplier_by_id` で存在を検証し、不存在は `BizError::NotFound`（40-cmd「不存在 `assign_supplier_id` は not-found の既存 `CmdErrorKind` へ正規化」の BIZ 側具体化）。存在すれば 30-biz step 5 どおり `supplier_id` が NULL のときだけ設定し、`supplier_assigned` は実際に設定したときのみ true。
- 理由: FK 違反を SQLite に任せると `Internal` に落ちて UI が原因を示せない。入力整合性は BIZ step 1 の validation と同じ位置で先に落とす。
- 却下: 不存在 id を黙って無視して `supplier_assigned=false` にする案（UI-14 の filter 取引先が削除済みだった等の異常を隠す）。
- 隣接パターンとの差: 既存 `create_product` は supplier 不存在を `ValidationFailed("指定された取引先が存在しません")` にしている（30-biz create_product step f）。本 CMD は 40-cmd が「不存在 `assign_supplier_id` は not-found」と明示するため `NotFound` を採り、既存 `create_product` の error kind は変えない。
- 転記先: なし（40-cmd の既存文言の範囲内。30-biz step 5 の挙動を変えない）。

### SPEC-PRVA-D4: 価格 no-op + supplier 紐付けだけの呼出し

- 売価・原価とも現値と同じで `assign_supplier_id = Some(存在する id)`、かつ商品の `supplier_id` が NULL のとき、価格改定は no-op（`changed=false`、price_history / operation_log なし、`plu_dirty` 不変）のまま step 5 の supplier 紐付けだけを実行し、`supplier_id` と `updated_at` を更新して `supplier_assigned=true` を返す。`supplier_id` が既に非 NULL なら何も書かず `supplier_assigned=false`。
- 理由: 30-biz §4.4.1 step 2 の no-op は「価格改定」に限定した文言で、step 5 は価格変更に条件付けられていない。UI-14 の「未設定の商品にこの取引先を設定する」は価格を変えない行でも有効になり得る。
- 却下: 価格 no-op のとき supplier 紐付けも skip する案（UI-14 で取引先だけ補完したい行が成立しない）/ supplier-only の書込みに operation_log を出す案（30-biz は `product_price_revise` を価格変更時に限定しており、契約外の log 種別を増やさない）。
- 転記先: なし（30-biz step 2 / 5 の文言の範囲内の解釈を固定。Ledger の `test_revise_product_price_req106_assigns_supplier_when_price_unchanged` で契約化）。

### SPEC-PRVA-D5: DTO の配置

- `PriceRevisionInput` / `PriceRevisionResult` は `src-tauri/src/biz/product_service.rs` に置き（既存 `ProductCreateRequest` / `ProductUpdateRequest` と同じ）、CMD は `product_service::PriceRevisionInput` として参照する。`PriceHistoryEntry` は `product_repo.rs`（20-io §2.6 の所有）に置き、BIZ が re-export、CMD は BIZ 経由で参照する。`design_compliance_test` は fn シグネチャのみ照合し struct 配置は検査しないため、ここで固定する。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-105 / REQ-103 | 20-io §2 keyword、30-biz §4.9.1、50-ui §50.6 | SPEC-PRV-D2 / SPEC-PRVA-D1 | リストの品番から商品へ到達。UI-14 専用検索 field は却下 | product_repo 2 関数 / ProductListPage placeholder | `test_search_products_req105_keyword_matches_maker_code` / `test_find_products_for_bulk_plu_target_req105_keyword_matches_maker_code` / RTL placeholder |
| REQ-105 | 30-biz §4.4.1、40-cmd revise_product_price、tracking-system-tables §15 / §18 | SPEC-PRV-D5 / SPEC-PRVA-D3 | 行単位確定。update_product 流用は却下 | product_service / product_cmd / lib.rs | `test_revise_product_price_req105_*` / `_req106_*` |
| REQ-106 | 30-biz §4.7.2、40-cmd create_supplier、master-tables §3、51-ui D21 | SPEC-PRV-D6 | 漸進補完。80 社一括投入は却下 | product_service / product_cmd / ProductForm | `test_create_supplier_req106_*` / RTL inline 追加 |
| REQ-102 | 20-io §2.6、30-biz §4.7.3、40-cmd list_price_history、51-ui D20 | SPEC-PRV-D9 / SPEC-PRVA-D2 | 紙の前年リスト参照の置換。契機列は出さない | product_repo / product_service / product_cmd / PriceHistorySection | `test_list_price_history_req102_*` / RTL 価格履歴 |
| REQ-103 / SP-103-04 | 50-ui UI-01a-D13 / §50.6 | SPEC-PRV-D10 | 店主の日常作業は原価中心 | ProductTable | RTL 原価列 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（SPEC-PRV-D2 / D5 / D6 / D9 / D10 は PR #93 で source docs へ転記済み。本 packet は実装対象と test の対応を固定するだけ）。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: SPEC-PRVA-D1（50-ui §50.6）/ SPEC-PRVA-D2（51-ui D20）を本 PR で転記。SPEC-PRVA-D3 / D4 は 40-cmd / 30-biz 既存文言の範囲内の解釈固定で転記不要（Ledger の test で契約化）、SPEC-PRVA-D5 は実装配置の pin で設計判断ではない。
- Assumptions and constraints: schema 変更なし / `price_history.changed_at` は既存 `insert_price_history` が現在日時を入れる / `plu_dirty` は売価変更時のみ / 既存 `update_product` の price_history 書込みは不変 / `limit` は UI から 10 または 100 のみ送られる。
- Deferred design gaps, risk, and follow-up target: UI-14（実装 B）/ cost_diffs（実装 C）/ 取引先の改名・統合（別起票）/ `list_price_history` の `limit = 0` は SQL の `LIMIT 0` どおり空配列で UI は送らない（Matrix Boundary Checks に記録、契約化しない）。
- Test Design Matrix can cite design decision IDs or source doc sections: yes（SPEC-PRV-D2 / D5 / D6 / D9 / D10、SPEC-PRVA-D1〜D5、UI-01a-D13、UI-01b-D20 / D21）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 絶対保証 = no-op で書込みなし / 原価のみで plu_dirty なし / 非 NULL supplier_id 不変 / 3 テーブル同時 rollback。escape hatch なし。既存 CMD の wire は不変、`bindings.ts` は追加のみ。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | POS 連携は `plu_dirty` 既存経路のみ。新 adapter なし | — |
| Fact check / design decision split | 事実 = PR #93 source docs。判断 = SPEC-PRVA-D1〜D5 | 本 packet |
| Lifecycle / retry | 価格履歴取得失敗は「再試行」で再取得。取引先追加失敗は入力保持 | Matrix State Lifecycle |
| Operator workflow | UI-01a でメーカー品番検索 → 原価列で確認 → UI-01b で価格修正 → 履歴で確認 | L3 checklist |
| Replacement path | 紙の前年リスト参照 → 価格履歴セクション | Goal |
| Data safety / evidence | 実店舗データは commit しない。L3 は owner の local DB で行い screenshot は commit しない | Data Safety |
| Reporting / accounting semantics | 原価更新は棚卸し評価（`valuation_cost_price` 凍結）に遡及しない（tracking-system-tables 既存契約） | — |
| Manual verification | UI-01a / UI-01b の human visual confirmation（Windows native L3） | Test Plan |
| 環境・再現性 | 該当なし（新設の環境依存なし） | — |

## Design Readiness

- Existing design docs are sufficient because: 20-io / 30-biz / 40-cmd にシグネチャ・処理ステップ・DTO・error 正規化が揃い、50-ui / 51-ui に決定 ID（UI-01a-D13 / UI-01b-D20 / D21）と受入条件 bullet が存在し、schema は既存（`schema_v1.rs` の suppliers / products.supplier_id / maker_code / price_history）。
- Source docs updated in this PR: 50-ui §50.6（placeholder 1 文）、51-ui UI-01b-D20（空 / 失敗表示 1 文）、90-traceability（再生成）。
- Design gaps intentionally deferred: Design Intent Audit 参照。
- Durable decisions discovered in this plan and promoted to source docs: SPEC-PRVA-D1 / D2。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI-01a / UI-01b → product_cmd → product_service → product_repo / system_repo。価格改定・履歴・操作ログ・supplier 紐付けの判断は BIZ のみ。CMD は接続取得と error 正規化だけ。
- Backend function design: 30-biz §4.4.1 / §4.7.2 / §4.7.3、20-io §2.6。
- Command / DTO / data contract: 40-cmd の 3 CMD + `PriceRevisionInput` / `PriceRevisionResult` / `PriceHistoryEntry` / 既存 `Supplier`。
- Persistence / transaction / audit impact: products 部分更新（`selling_price` / `cost_price` / `updated_at` / 条件付き `plu_dirty` / 条件付き `supplier_id`）+ `price_history` insert + `operation_logs` insert を 1 transaction。schema 変更なし。
- Operator workflow / Japanese UI wording: 「原価」列 / 「価格履歴」「すべて表示」「価格履歴はまだありません」「再試行」/ 「新しい取引先を追加」/ placeholder「商品コード・商品名・JAN・メーカー品番で検索」。色のみの状態表現禁止（inventory-operator-ui）。
- Error, empty, retry, and recovery behavior: 負値 / 空文字 = validation、不存在 = not-found、履歴 0 件 = 空文言、取得失敗 = inline error + 再試行、取引先追加失敗 = 入力保持。
- Testability and traceability IDs: REQ-102 / 103 / 105 / 106、SPEC-PRV-D2 / D5 / D6 / D9 / D10、SPEC-PRVA-D1〜D5、UI-01a-D13、UI-01b-D20 / D21。

## Contract Probe

- tauri-specta が `Option<i64>` field と `Vec<PriceHistoryEntry>` 戻り値を既存 CMD と同じ形で生成するか: 既存 `ProductCreateRequest.supplier_id: Option<i64>`（30-biz の create_product request 定義 / product_service.rs、特別な attribute なし）と `list_suppliers`（`Vec<Supplier>`）が同型で生成済み → N/A（既存先例。`Option<Option<i64>>` の supplier_id は custom attribute が要る別型で、本 PR の `assign_supplier_id: Option<i64>` は該当しない）。
- `design_compliance_test` が新 pub fn を doc 側コードブロックから検出するか: 20-io §2.6 / 30-biz §4.4.1・§4.7.2・§4.7.3 / 40-cmd の 3 CMD は全て ```rust コードブロック内にシグネチャがある（PR #93 で転記）→ N/A（`KNOWN_ALLOWLIST` 追加不要。Writer は実装後に `cargo test --test design_compliance_test` で確認）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-PRV-D2 `search_products` keyword が maker_code に部分一致 | product_repo `search_products` | `test_search_products_req105_keyword_matches_maker_code` | — |
| SPEC-PRV-D2 既存 3 列（name / product_code / jan_code）の回帰 | 同上 | `test_search_products_req103_keyword_matches_existing_three_columns` | — |
| SPEC-PRV-D2 一括 PLU 対象化の母集団も maker_code 一致を含む（30-biz §4.9.1） | product_repo `find_products_for_bulk_plu_target` | `test_find_products_for_bulk_plu_target_req105_keyword_matches_maker_code` | — |
| SPEC-PRVA-D1 UI-01a placeholder 文言 | ProductListPage | RTL `ProductListPage.test.tsx`: 検索欄の placeholder が「商品コード・商品名・JAN・メーカー品番で検索」 | L3: 検索欄の文言目視 |
| SPEC-PRV-D5 step 1 不存在 product → NotFound | product_service `revise_product_price` | `test_revise_product_price_req105_not_found_product` | — |
| SPEC-PRV-D5 step 1 負値 selling → ValidationFailed | 同上 | `test_revise_product_price_req105_validation_negative_selling_price` | — |
| SPEC-PRV-D5 step 1 負値 cost → ValidationFailed | 同上 | `test_revise_product_price_req105_validation_negative_cost_price` | — |
| SPEC-PRV-D5 step 2 no-op（`changed=false`、price_history なし） | 同上 | `test_revise_product_price_req105_no_op_when_unchanged` | — |
| SPEC-PRV-D5 step 2 no-op で operation_log なし | 同上 | `test_revise_product_price_req105_no_op_writes_no_operation_log` | — |
| SPEC-PRV-D5 step 3 price_history old/new 4 値 | 同上 + `insert_price_history` | `test_revise_product_price_req105_writes_price_history_four_values` | — |
| SPEC-PRV-D5 step 3 operation_log `product_price_revise` | 同上 + `system_repo::insert_operation_log` | `test_revise_product_price_req105_writes_operation_log` | — |
| SPEC-PRV-D5 step 4 売価変更で plu_dirty=1（`plu_dirty_set=true`） | 同上 | `test_revise_product_price_req105_plu_dirty_on_selling_change` | — |
| SPEC-PRV-D5 step 4 原価のみで plu_dirty 不変（`plu_dirty_set=false`） | 同上 | `test_revise_product_price_req105_cost_only_no_plu_dirty` | — |
| SPEC-PRV-D5 step 5 / D6 NULL のときだけ supplier_id 設定（`supplier_assigned=true`） | 同上 | `test_revise_product_price_req106_assigns_null_supplier_id` | — |
| SPEC-PRV-D6 既存の非 NULL supplier_id は不変（`supplier_assigned=false`） | 同上 | `test_revise_product_price_req106_keeps_existing_supplier_id` | — |
| SPEC-PRVA-D3 不存在 assign_supplier_id → NotFound | 同上 | `test_revise_product_price_req106_unknown_supplier_id_not_found` | — |
| SPEC-PRVA-D4 価格 no-op + NULL supplier への紐付けだけ実行（`changed=false` / `supplier_assigned=true` / price_history・operation_log なし） | 同上 | `test_revise_product_price_req106_assigns_supplier_when_price_unchanged` | — |
| 境界（archived Matrix 予約）10^7 直下の値を exact に永続化（products + price_history 4 値） | 同上 | `test_revise_product_price_req105_persists_large_values_exactly` | — |
| SPEC-PRV-D5 step 6 3 テーブル同時 rollback | 同上 | `test_revise_product_price_req105_tx_atomicity_rollback` | — |
| SPEC-PRV-D6 create_supplier trim して作成 | product_service `create_supplier` | `test_create_supplier_req106_trims_and_creates` | — |
| SPEC-PRV-D6 create_supplier 空文字 reject（CMD / SQL なし） | 同上 | `test_create_supplier_req106_rejects_empty_name` | — |
| SPEC-PRV-D6 create_supplier 同名は既存行 | 同上 | `test_create_supplier_req106_returns_existing_row_for_duplicate_name` | — |
| SPEC-PRV-D9 list_price_history `changed_at DESC`（主順序） | product_repo `list_price_history` | `test_list_price_history_req102_desc_order` | — |
| SPEC-PRV-D9 list_price_history 同一 `changed_at` の tie-break `id DESC` | 同上 | `test_list_price_history_req102_id_desc_tie_break_on_same_changed_at`（Final Review P2 で追加） | — |
| SPEC-PRV-D9 limit どおりの件数 | 同上 | `test_list_price_history_req102_respects_limit` | — |
| SPEC-PRV-D9 limit 100 超は 100 に丸め | 同上 | `test_list_price_history_req102_clamps_limit_over_max` | — |
| SPEC-PRV-D9 不存在 product_code は空配列 | 同上 | `test_list_price_history_req102_unknown_product_returns_empty` | — |
| 40-cmd 3 CMD + DTO（シグネチャ一致、error 正規化 Validation / NotFound） | product_cmd | `cargo test --test design_compliance_test` PASS + `cargo clippy` PASS（error 変換は既存 `From<BizError> for CmdError` を流用、review focus） | — |
| 登録: `collect_commands!` + `generate_handler!` + bindings 再生成 | lib.rs / bindings.ts | AC の rg 件数 + `generate_bindings` 後の diff 空 + `npm run typecheck` | — |
| UI-01a-D13 / SPEC-PRV-D10 「原価」列が「売価」の右隣 | ProductTable | RTL `ProductTable.test.tsx`: header 配列で「売価」の直後が「原価」、値セルが `cost_price` / `ProductListPage.test.tsx`: 一覧描画で「原価」header 存在 | L3: 原価列の目視 |
| UI-01b-D20 edit mode のみ「価格履歴」h2 + 直近 10 件（新しい順） | ProductForm / PriceHistorySection | RTL `ProductForm.test.tsx`: edit で `listPriceHistory(code, 10)` 呼出し + 行表示、create で非表示 | L3: 修正モードで履歴行が見える |
| UI-01b-D20 「すべて表示」で limit 100 再取得 | PriceHistorySection | RTL `ProductForm.test.tsx`: button 押下で `listPriceHistory(code, 100)` | — |
| SPEC-PRVA-D2 空 / 取得失敗 + 再試行 | PriceHistorySection | RTL `ProductForm.test.tsx`: 0 件で「価格履歴はまだありません」、reject で error + 「再試行」再呼出し | — |
| UI-01b-D21 trim + 空文字は CMD を呼ばない | ProductForm | RTL `ProductForm.test.tsx`: 空白のみで `createSupplier` 未呼出し + field error | — |
| UI-01b-D21 成功で候補再取得 + 返却 supplier を選択 | ProductForm | RTL `ProductForm.test.tsx`: `createSupplier` 解決後に `listSuppliers` 再呼出し + select 値が返却 id | L3: 追加した取引先が候補に出る |
| UI-01b-D21 失敗時入力保持（取引先名の入力値 + 既存の商品 form 保存値の両方） | ProductForm | RTL `ProductForm.test.tsx`: reject 後も取引先名の入力値が残り error 表示、かつ先に入力済みの 商品名 など他 field の値が不変 | — |
| REQ-105 / 106 traceability（T3 WARN 解消） | 90-traceability | `generate_traceability -- --check` exit 0 + `no-test` 0 hit | — |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-22-price-revision-impl-a.md`。
Human Gate が L3 を含むため、Writer 完了条件に `cd src-tauri && cargo check --release` を含める（CI gate ではない）。

- targeted tests: Ledger の Rust test 全件（product_repo / product_service の inline `#[cfg(test)]`）、RTL 3 file、`design_compliance_test`、`generate_traceability -- --check`、`generate_bindings` diff。
- negative tests: 負値 / 空文字 / 不存在 product / 不存在 supplier / no-op の書込みなし / create mode で価格履歴非表示 / 空白 name で CMD 未呼出し。
- compatibility checks: 既存 `test_search_products_req103_*` / `test_update_product_req102_*` / `bulk_set_plu_target` 系 / `InventoryRecordsPage.test.tsx` の placeholder assertion が無改変で PASS。既存 CMD の wire 不変（bindings diff が追加のみ）。
- data safety checks: fixture は synthetic のみ。L3 は owner の local DB、screenshot / DB は commit しない。
- main wiring/integration checks: lib.rs 2 list、bindings.ts に 3 CMD + 3 型、ProductForm から `PriceHistorySection` が edit mode で mount、ProductListPage の placeholder prop。

Human visual confirmation checklist（Windows native L3、owner は目視と PASS/FAIL のみ。evidence 整形は agent）:

1. 商品一覧（UI-01a）: 検索欄の placeholder に「メーカー品番」が含まれ、メーカー品番の一部で検索すると該当商品が出る。一覧の「原価」列が「売価」の右隣にある。
2. 商品修正（UI-01b、既存商品）: 第 5 セクション「価格履歴」が表示される。売価を変えて保存し、同じ商品を開き直すと履歴に新しい行（旧売価 → 新売価）が増えている。商品登録（新規）にはセクションが出ない。
3. 商品修正 / 登録の取引先欄: 「新しい取引先を追加」で日本語名を入力（IME 確定の Enter で誤送信しない）→ 追加 → 候補に現れ選択状態になる。空白だけでは追加されず field error が出る。

## Boundary / Wire Contract

- producer: CMD `revise_product_price` / `create_supplier` / `list_price_history`（product_cmd）
- consumer: `list_price_history` / `create_supplier` = UI-01b（本 PR）と UI-14（実装 B）。`revise_product_price` = UI-14（実装 B）/ UI-02（実装 C）のみで、本 PR では UI から呼ばない（UI-01b の保存は既存 `update_product` のまま）— いずれも `src/lib/bindings.ts` 経由
- wire type: `PriceRevisionInput { product_code: string, new_selling_price: number, new_cost_price: number, assign_supplier_id: number | null }` / `PriceRevisionResult { product_code: string, changed: boolean, plu_dirty_set: boolean, supplier_assigned: boolean }` / `Supplier { id: number, name: string, created_at: string }`（既存、product_repo の `Supplier` struct どおり）/ `PriceHistoryEntry { id: number, old_selling_price: number, new_selling_price: number, old_cost_price: number, new_cost_price: number, changed_at: string }` / `list_price_history(product_code: string, limit: number)`
- internal type: Rust `i64` 円 / `u32` limit / `String` ISO 日時（既存 price_history と同じ）/ `Option<i64>` supplier id
- precision/range: 円整数 ≥ 0（負値 reject）。上限は source docs に契約がない（schema は `INTEGER NOT NULL`、30-biz §4.4.1 は下限のみ）。wire は JS `number` ↔ Rust `i64` で、手芸店の売価・原価が 10^7 円未満に収まるのは `未実測` の前提。archived Matrix が予約した「10^7 直下の境界 unit test」は本 PR で `test_revise_product_price_req105_persists_large_values_exactly`（9,999,999 円の exact 永続化）として消化し、新原価案の整数除算の overflow 境界は実装 B（導出は UI-14 側）に残す。limit は u32、100 超は 100 に丸め
- round-trip path: UI-01b 保存（既存 update_product）→ price_history → `listPriceHistory(code, 10)` → セクション表示。取引先: 入力 → `createSupplier` → `listSuppliers` 再取得 → select 値
- invalid input: 負値 / 空文字 → `CmdErrorKind::Validation`、不存在 product / supplier → `CmdErrorKind::NotFound`（新 variant なし）
- compatibility: 既存 CMD の入出力不変。`bindings.ts` は型 3 件 + command 3 件の追加のみ

## Review Focus

- 絶対保証 3 点（no-op 書込みなし / 原価のみで plu_dirty なし / 非 NULL supplier_id 不変）と TX 原子性が実装とテストの両方にあるか。mutation 実注入（Matrix の Adequacy Questions）で各 test が実際に落ちるか。
- keyword LIKE の追加が `search_products` と `find_products_for_bulk_plu_target` の **両方** に入っているか（片方だけだと UI-01a の見え方と一括 PLU 母集団がずれる）。
- lib.rs の 2 list 両方への登録、bindings.ts の再生成 commit、design_compliance_test PASS。
- CMD が判断を持っていないか（trim / 検証 / 丸めは BIZ / IO）。
- RTL の oracle が production 定数（bindings の mock 戻り値）を共有せず独立転記か。既存 test の改変・skip がないか。
- 50-ui / 51-ui への 1 文追記が SPEC-PRVA-D1 / D2 と一致し、旧 placeholder 文言が UI-01a 側に残っていないか。
- D-062: packet / Matrix 内の数値主張は契約値（source doc 由来）か `未実測` tag か。

## Spec Contract

Contract ID: SPEC-PRVA

- SPEC-PRV-D2 / D5 / D6 / D9 / D10（source docs 転記済み、実装対象）と SPEC-PRVA-D1〜D5（本 packet の Design Decisions 節）を正とする。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-PRV-D2 | product_repo keyword 2 関数 | `test_search_products_req105_*` / `test_search_products_req103_keyword_matches_existing_three_columns` / `test_find_products_for_bulk_plu_target_req105_*` | 両関数に追加 | cargo test |
| SPEC-PRVA-D1 | ProductListPage placeholder + 50-ui 1 文 | RTL ProductListPage | 共有 default 不変 | npm test / PR diff |
| SPEC-PRV-D5 / SPEC-PRVA-D3 | product_service revise_product_price + CMD + lib.rs | `test_revise_product_price_req105_*` / `_req106_*` | 絶対保証 + TX | cargo test + mutation 注入 |
| SPEC-PRV-D6 | product_service create_supplier + CMD + ProductForm inline | `test_create_supplier_req106_*` / RTL ProductForm | trim / 同名 / 入力保持 | cargo test / npm test |
| SPEC-PRV-D9 / SPEC-PRVA-D2 | product_repo list_price_history + BIZ + CMD + PriceHistorySection + 51-ui 1 文 | `test_list_price_history_req102_*` / RTL ProductForm | DESC / 丸め / 空配列 / 空文言 | cargo test / npm test |
| SPEC-PRV-D10 | ProductTable 原価列 | RTL ProductTable / ProductListPage | 売価の右隣 | npm test + L3 |
| REQ-105 / 106 / 102 | generate_traceability 再生成 | `generate_traceability -- --check` | no-test 0 | exit 0 |
| 登録義務 | lib.rs 2 list / generate_bindings | AC rg + diff | 2 list 両方 | rg 出力 |

## Data Safety

- 実店舗の商品名・価格・取引先名を test fixture / PR / screenshot に commit しない。
- local-only paths: owner の local DB（L3 用、repo 外）。
- synthetic-only paths: `src-tauri/src/**/tests`、`src/features/products/**/*.test.tsx` の fixture。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Plan Review round 1（Sonnet、独立 context、2026-08-22、packet `ae80660`）: P1 1 / P2 3 / P3 2、verdict fail。全件 accept して是正 `b298094`: P1-1 「円単位 10^7 未満の既存契約」は source docs に上限契約が無く archived Matrix の予約 test も未消化 → `未実測` 前提へ書き換え + `test_revise_product_price_req105_persists_large_values_exactly` を Ledger / Matrix に追加 / P2-1 Wire Contract consumer 行が UI-01b を `revise_product_price` の呼出し元に含めていた → 本 PR では UI から呼ばないと明記 / P2-2 価格 no-op + supplier 紐付けだけの呼出しが未契約 → SPEC-PRVA-D4 + `test_revise_product_price_req106_assigns_supplier_when_price_unchanged` / P2-3 Plans.md entry の test 本数が archived 予約値のまま drift → 本数を外し Ledger 参照へ / P3-1 Contract Probe 先例 / P3-2 DTO 配置未 pin → SPEC-PRVA-D5。
- Plan Review round 2（Sonnet、fresh context、2026-08-22、packet `b298094`）: P1 0 / P2 1 / P3 1、全件 accept して是正 `1e333c6`: P2-1 round 1 是正で差し替えた Contract Probe の先例 `department_id` は `i64` で `Option<i64>` ではない（Coordinator の是正主張の裏取り不足）→ `ProductCreateRequest.supplier_id: Option<i64>` へ訂正 / P3-1 UI-01b-D21 失敗時入力保持の oracle が取引先名 field のみで「既存の商品 form 保存値を失わない」を見ていない → Ledger / Matrix に他 field 不変を追加。あわせて SPEC-PRVA-D3 に隣接 `create_product`（ValidationFailed）との差を明記。
- Plan Review round 3（Sonnet、fresh context、delta 検証、2026-08-22、packet `1e333c6`）: P1 0 / P2 0 / P3 0、verdict pass。round 2 是正 3 hunk の anchor 実在と regression sweep、Workflow State 13 field、`doc-consistency-check.sh --target plan` exit 0（WARN は未実装 test token の PK3 のみ）を確認。Plan rally 収束（round 3/3、天井内）。Plan Commit 候補 = plan-first commit `ae80660`（本 branch の全 content commit の祖先）。
- Final Review（Sonnet、fresh context、worktree 隔離、2026-08-22、content candidate `cb880db`）: P1 0 / P2 1 / P3 2 → OPEN。Ledger 36/36 行を実装 + test 本体で監査、mutant 9 件（no-op 早期 return 除去 / plu_dirty 条件除去・反転 / NULL guard 除去 / bulk 側 maker_code 除去 / changed_at ASC / clamp 除去 / id ASC / 原価列移動）を clean worktree で実注入、AC 全項目を再実測（Writer 報告と一致）、scope 15 file が packet Scope と一致、既存 test 無改変、PR body 充足。P2-1 `list_price_history` の tie-break `id DESC` が未テスト（`id ASC` mutant が生存。Matrix の desc_order 行に書いた「同一 changed_at 2 行」を Writer が実装せず、Adequacy の記述も事実に反していた）→ accept、`test_list_price_history_req102_id_desc_tie_break_on_same_changed_at` を Ledger / Matrix に分離追加し Codex relay 2/2 で実装 / P3-1 発注書の mutant 1（no-op 早期 return 除去）では `_no_op_writes_no_operation_log` が RED にならない（operation_log は `if changed` で独立に guard、defense-in-depth）→ 実装変更なし、記述として記録 / P3-2 Wire Contract の既存 `Supplier` に `created_at` 欠落 → packet 記述を訂正。是正 delta は Coordinator の packet / Matrix 記述是正 commit + Codex の test 追加 commit で構成し、fresh context の delta 再検証で P1/P2 = 0 を確認してから human-confirm 遷移する。
- Final Review delta 再検証（Sonnet、fresh context、worktree 隔離、2026-08-22、content candidate `f87a363`）: P1 0 / P2 0 / P3 0 = PASS。`f87a363` は test module 追記 + 生成 traceability のみ、既存 test 無改変、新 test の oracle は literal 独立転記、`id ASC` mutant で新 test RED / `_desc_order` GREEN（独立性）→ 復元で全 GREEN、traceability --check exit 0、`--target plan` 全チェック通過、PR #94 body の SHA / evidence path が `f87a363` に同期済み。
- Findings Freeze: frozen after Final Review + delta 再検証（2026-08-22）; post-freeze exceptions: none.

### 遷移記録（2026-08-22、state-only 遷移 plan-draft -> plan-gate -> plan-approved -> implementing）

- plan-draft -> plan-gate の evidence: packet と Test Design Matrix を plan-first commit `ae80660` で commit 済み、`doc-consistency-check.sh --target plan` exit 0（WARN は未実装 test token の PK3 のみ）。
- plan-gate -> plan-approved の evidence: 独立 Sonnet Plan Reviewer 3 round（round 1 P1 1 / P2 3 → 是正 `b298094`、round 2 P1 0 / P2 1 → 是正 `1e333c6`、round 3 fresh delta 検証 P1 0 / P2 0 / P3 0 = pass、Review Response 参照）、owner plan approval（2026-08-22、介入 1 回目 / 予算 3 回）、Plan Commit = plan-first commit `ae80660`（本 branch の全 content commit の祖先）。
- plan-approved -> implementing の evidence: 実装は Codex Writer 発注（cwd pin / Plan Commit 記入 / 本遷移を Coordinator が先行）で着手し、plan-first commit が全実装 commit に先行する。隣接 3 遷移を 1 state-only commit で圧縮記録（PR #84 / #93 と同型、DEV_WORKFLOW 圧縮規則、forward state-only 1 本目 / cap 3）。

### 遷移記録（2026-08-22、state-only 遷移 implementing -> local-verified -> independent-review -> human-confirm）

- implementing -> local-verified: content candidate `cb880db`（Codex Writer 第 1 発注）と是正 delta `f87a363`（Codex Writer 第 2 発注、relay 2/2）の両方で L1 `local-ci.sh full` RESULT=PASS / END_TREE_STATE=CLEAN（evidence path は PR #94 body）。Coordinator の記述是正 `a15ce06` は packet / Matrix のみ。exact-HEAD の L1 full は Ready 遷移 commit で再実施する。
- local-verified -> independent-review: 独立 Sonnet Final Reviewer（fresh context、worktree 隔離）が Contract Audit（Ledger 全行の実装 + test 監査、Matrix 記載の mutant 群の実注入、AC 再実測、scope / 既存 test 無改変 / PR body。件数は Review Response の Final Review 行と reviewer 報告が正）を実施。
- independent-review -> human-confirm: Final Review P1 0 / P2 1 / P3 2 を全件裁定・是正（`a15ce06` + `f87a363`）し、fresh context の delta 再検証で P1/P2/P3 = 0。`Reviewed Content HEAD` = `f87a363`。隣接 3 遷移を 1 state-only commit で圧縮記録（post-implementation state-only 1 本目 / forward 合計 2 本目 / cap 3、PR #93 と同型）。

### 遷移記録（2026-08-23、state-only 遷移 human-confirm -> ready-hosted-final）

- Windows native L3: checklist 1〜3 を owner が全件 PASS。UI-01a はメーカー品番検索と売価直後の原価列、UI-01b は修正時の価格履歴（売価の旧値 → 新値）と新規時の非表示、取引先 inline 追加は空白 reject・IME 確定 Enter の誤送信なし・追加後の選択状態を確認した。
- Data recovery: L3 前の控えへ通常復元し、復元後に synthetic maker code が検索結果へ出ないことを確認した。break-glass は未使用。
- owner Ready 承認（2026-08-23、介入 2 回目 / 予算 3 回）: 本 state-only commit で `human-confirm -> ready-hosted-final` を materialize（forward state-only 3 本目 / cap 3、post-implementation 2 本目 / cap 2）。resulting exact HEAD で L1 full を再実行し、PR body を更新してから Draft を解除する。Ready event の同一 HEAD hosted final を待ち、三点一致前は merge しない。
