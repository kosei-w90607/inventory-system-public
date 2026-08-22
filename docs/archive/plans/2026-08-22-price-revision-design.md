# Plan Packet: 価格改定（値上げ連絡）支援の design-first — 一括価格改定 / 入庫時原価差分検出 / 価格履歴閲覧 / 取引先 = メーカー意味固定（issue #90、D-075）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 0b10e18
- Amendments: none
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet
- Final Reviewer: Sonnet
- Reviewed Content HEAD: 18d87ac
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Plan Gate 承認（owner 裁定 1 件〈SP-103-04 原価列 = (a)〉は 2026-08-22 に完了） → source docs amendment 後の Ready 化 → hosted final（`design_compliance_test.rs` の SKIP_DOCS 1 行を含む non-doc event-eligible change のため、CI-TRIGGER-D1 の Ready / `synchronize` 経路で自動 run。予防的 `workflow_dispatch` はしない）→ 三点一致 → merge。Windows native L3 は design-first PR ではなし

## Owner Effort Budget

- 介入回数上限: 3（裁定 1 件 + Plan Gate 承認 + Ready 承認）
- 実働時間上限: 30分
- relay 往復上限: 2（第 1 発注 = packet / Matrix、第 2 発注 = source docs amendment）
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
docs-only だが、(a) 新規 REQ 3 件（REQ-105 / REQ-106 / REQ-209）と `requirements-coverage.md` の SP-102-08 / SP-103-04 露出により `90-traceability.md` の再生成を伴う（生成系検査）、(b) 新規画面 UI-14 / 新規 CMD 4 件 / 既存 CMD `create_receiving` の DTO 拡張 / `suppliers` の意味論改訂 / `ProductSearchQuery.keyword` の一致範囲拡張という wire contract と意味論の確定を含む、(c) 後続実装 PR（2〜3 本）の Ledger を本 packet が予約する。PR #84（PLU slot design-first、R3）と同型。

## Goal

Goal Invariant: 年次の値上げ連絡（メーカー単位の紙 / PDF リスト）を、紙の棚卸しリストへの手書き転記を経ずに、商品マスタへ直接反映できる設計を source docs に固定する。掛率は導出値のまま、schema 変更なしで、推定原価は入庫伝票の実原価で収束する。

### 最小完了条件

- source docs（requirements / coverage / function-design / db-design / architecture task specs / decision-log）に、① 一括価格改定画面（UI-14）② 入庫時原価差分検出 ③ 価格履歴閲覧 ④ 取引先 inline 追加 + `suppliers` = メーカー意味、⑤ SP-103-04 原価列の判断、が実装に着手できる粒度で記述され、`90-traceability.md` が再生成済みで L1 full の生成系検査を通る。
- 後続実装 PR の分割（実装 A = BIZ/CMD/IO + UI-01b 価格履歴 + 取引先 inline、実装 B = UI-14 一括改定画面、実装 C = 入庫差分）と各 PR の Ledger 予約が Test Design Matrix に記録されている。

### 失敗定義

- 掛率や暫定原価の永続化、PDF 解析、新売価の自動提案、draft 保存テーブルという D-075 で否認済みの方向へ設計が広がる。
- 値上げリストの行を「探して → 入力して → 確定」する主動線が、既存の商品一覧 / 商品修正画面の反復操作より速くならない設計になる。
- 新規 REQ / CMD / 画面 / route の登録義務（`Registration / Generation Obligations`）の列挙漏れが Plan Gate 後に顕在化する。

### 非目的

- 実装（`src-tauri/**` / `src/**` / `bindings.ts`）。本 PR は docs-only。
- 取引先の住所・担当者等の属性、発注、問屋チャネルの保持（DB 設計で除外済み）。
- 補助識別情報によるリニューアル品同定（issue #66 の領域）。
- 棚卸し除外品（issue #91、D-076 で非対象）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

本 design-first PR の amendment scope（plan-approved 後の第 2 発注で source docs へ昇格）:

- `docs/spec/requirements.md`: REQ-105（一括価格改定）/ REQ-106（取引先 inline 追加）/ REQ-209（入庫時原価差分検出）を追加。REQ-102 の対応 UI に価格履歴セクションを明記。
- `docs/spec/requirements-coverage.md`: SP-102 行の直下に SP-102-08 行（→ REQ-105、current）、SP-103 行の直下に SP-103-04 行（→ REQ-103 + UI-01a-D13、current）を追加。完全性契約（distinct ID 件数）の文を実数に合わせて更新。
- `docs/function-design/90-traceability.md`: `cargo run --bin generate_traceability` で再生成（手動編集禁止）。
- `docs/function-design/20-io-product-repo.md`: §2.6 に `list_price_history` 読取り関数、`ProductSearchQuery.keyword` / `ProductBulkFilter.keyword` の一致対象に `maker_code` を追加、`revise_product_price` 用の部分更新関数、`find_or_create_supplier` の入力正規化（trim / 空文字拒否）を追記。
- `docs/function-design/30-biz-product-service.md`: BIZ-01 に `revise_product_price`（行単位確定、operation_type `product_price_revise`）/ `create_supplier` / `list_price_history` を追加。`plu_dirty` 規則（売価変更時のみ）を本経路でも維持する旨を明記。§4.9.1 `bulk_set_plu_target` に keyword の maker_code 拡張で母集団が広がる旨を注記（SPEC-PRV-D2 隣接契約）。
- `docs/function-design/40-cmd-product.md`: CMD `revise_product_price` / `create_supplier` / `list_price_history` の契約と DTO。L144 の「`find_or_create_supplier` の公開 CMD は別 Design Phase」を本 packet で消化した旨に改訂。
- `docs/function-design/31-biz-inventory-service.md`: BIZ-02 `create_receiving` の保存フロー（§12.3）に原価差分検出 step を追加し、`ReceivingCreateResult` に `cost_diffs` を追加。
- `docs/function-design/44-cmd-inventory.md`（`create_receiving` CMD の所有 doc）: `ReceivingCreateResult.cost_diffs` の wire contract。
- `docs/function-design/50-ui-product-list.md`: UI-01a-D13（SP-103-04 原価列を基本列に追加、owner 裁定 2026-08-22）+ §50.6 基本列の文を改訂、keyword 一致対象に メーカー品番 を追加（§50.6 の一致列の文。§50.5 は `keyword` 型行のみで変更なし）。
- `docs/function-design/51-ui-product-form.md`: 第 5 セクション「価格履歴」（UI-01b-D20）、取引先 inline 追加（UI-01b-D7 の改訂、§7.7 非 scope から除去、UI-01b-D21）。
- `docs/function-design/77-ui-bulk-price-revision.md`（新設、UI-14）: 画面構成 / URL state / CMD・DTO 契約 / 表示と操作 / Loading・Empty・Error / テスト観点 / Deferred。50-ui と同じ節立て。
- `docs/function-design/61-ui-receiving.md`（UI-02 入庫画面）: 保存完了時の原価差分ダイアログ（REQ-209）。
- `docs/db-design/master-tables.md` §3 suppliers: 役割文を「メーカー/ブランド（値上げ連絡の主体）」へ改訂（D-075 (6)）、問屋チャネルは保持しない旨を追記。`products.supplier_id` の漸進補完（UI-14 確定時）を補足。
- `docs/db-design/tracking-system-tables.md` price_history: 書込み契機 3 種（手動修正 / 一括改定 / 入庫差分承諾）を列挙し、契機カラムは設けない（導出不能を明記）旨を追記。
- `docs/FUNCTION_DESIGN.md` 索引 / `docs/SCREEN_DESIGN.md` 画面一覧（#20 一括価格改定）/ `docs/architecture/ui-task-specs.md`（UI-14）/ `biz-task-specs.md` / `cmd-task-specs.md` / `io-task-specs.md` の entry 追加。
- `docs/function-design/52-ui-shared-layout.md` §52.3 ルーティング定義: UI-14 行（一括価格改定 / `/products/price-revision` / `src/routes/products/price-revision.tsx` / 商品管理 / サイドバー ○）を追加し、サイドバー項目数の表記を更新。
- `docs/decision-log.md`: D-075 の Impact に本 packet の決定 ID を追記（新 D 番号は起こさない。SP-103-04 の最終判断は UI-01a-D13 として 50-ui に記録）。
- `docs/Plans.md`: active packet link と closeout。
- `src-tauri/tests/design_compliance_test.rs`: `SKIP_DOCS` に `77-ui-bulk-price-revision.md` を追加（登録義務、1 行。これにより本 PR は pure docs-only ではなく hosted CI の path filter 上は通常 run 対象になる）。

本発注（第 1 発注）で実際に編集する scope:

- 本 packet、対応 Test Design Matrix、`docs/Plans.md` active link のみ。
- source design amendments は plan-approved 後の第 2 発注まで intentionally deferred。

## Non-scope

- `src-tauri/**`、`src/**`、`src/lib/bindings.ts` の変更（実装 A/B/C の後続 PR）。唯一の例外 = `src-tauri/tests/design_compliance_test.rs` の `SKIP_DOCS` に `77-ui-bulk-price-revision.md` を 1 行追加する登録義務（新設 doc が未登録だと同 test の unmapped_docs assert が fail する）。
- PDF 自動解析取込 / 上代カラム / 掛率の永続化 / 暫定原価フラグ / 新売価の自動提案 / 指定日の予約反映 / draft 保存テーブル（D-075 で否認済み）。
- 取引先の改名・統合 UI、取引先管理画面（B 案）、CSV による取引先名受理（C 案）。必要になったら別起票。
- リニューアル品（バーコード・品番が変わった同名商品）の同定支援（issue #66）。
- 棚卸し母集団の 1 行明記（issue #91 / D-076、UI-10 意味論突合 follow-up と同一 packet）。
- 実店舗の商品名・価格・取引先名の commit。evidence は `docs/evidence/issue-90/` の匿名化版のみ。

## Acceptance Criteria

- `docs/spec/requirements.md` に REQ-105 / REQ-106 / REQ-209 の行が存在し、`rg -c "REQ-105|REQ-106|REQ-209" docs/spec/requirements.md` = 3 以上。
- `docs/spec/requirements-coverage.md` に `SP-102-08` と `SP-103-04` の行が各 1 行存在し、完全性契約の件数文が更新されている。
- `cd src-tauri && cargo run --bin generate_traceability -- --check` が exit 0（T1 drift なし、T2 phantom REQ なし）。
- `docs/function-design/77-ui-bulk-price-revision.md` が存在し、`> 対応仕様:` 行に REQ-105 を含む。`docs/FUNCTION_DESIGN.md` から link されている。
- `bash scripts/doc-consistency-check.sh` exit 0（ERROR 0。既存 WARN 1 件〈40-cmd ページング上限〉は本 PR と無関係）。
- 本 packet の SPEC-PRV-D1〜D12 が、それぞれ Scope 記載の source doc の決定行または本文へ 1 対 1 で転記され、`docs/plans/test-matrices/2026-08-22-price-revision-design.md` の M-D1〜M-D12 anchor oracle（`rg -F -c` で新文言 ≥ 1 + 旧文言 = 0）が「実行結果」表で全行 PASS。
- Contract Coverage Ledger のうち実装対象行（SPEC-PRV-D2〜D10 + UI-14 到達導線 = 10 行）が `docs/plans/test-matrices/2026-08-22-price-revision-design.md`「実装 PR への予約」表の A / B / C いずれかに予約先付きで列挙されている（D1 = docs-only、D11 = 第 2 発注、D12 = plan 事項の 3 行は予約対象外と同表に明記）。Plan Review 最終 round の Ledger 欠落指摘が 0 件（Review Response に記録）。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md`（REQ-101〜104 / REQ-201 / REQ-907 の書式）、`docs/spec/requirements-coverage.md`（SP-102 / SP-103 行、完全性契約）
- Architecture: `docs/ARCHITECTURE.md`（UI → CMD → BIZ → IO）、`docs/architecture/ui-task-specs.md`（UI-13 まで）/ `biz-task-specs.md` / `cmd-task-specs.md` / `io-task-specs.md`
- Function / command / DTO: `20-io-product-repo.md` §2.6（`insert_price_history` / `NewPriceHistory`）、`ProductSearchQuery` / `ProductBulkFilter`（keyword = 商品名 / product_code / jan_code 部分一致）、`30-biz-product-service.md`（BIZ-01、`plu_dirty` は売価変更または PLU 対象化時のみ）、`40-cmd-product.md`（`list_suppliers`、L144 の別 Design Phase 保留）、`31-biz-inventory-service.md` §12.3（BIZ-02 `create_receiving` 9 step、`ReceivingCreateResult { record_id, created, idempotent_replay, stock_warnings }`）、`25-io-plu-formatter.md`（PLU TSV に原価列なし）
- DB: `docs/db-design/master-tables.md` §1 products（`selling_price` 税込 / `cost_price` / `jan_code` / `maker_code` / `supplier_id` NULL 可 / `plu_dirty`）、§3 suppliers（id / name UNIQUE / created_at）、`docs/db-design/tracking-system-tables.md` price_history（`old_selling` / `new_selling` / `old_cost` / `new_cost` / `changed_at`、契機カラムなし、「商品修正画面の価格履歴セクション（REQ-102）のデータソース」）
- Screen / UI: `docs/SCREEN_DESIGN.md`、`50-ui-product-list.md`（基本列 = 商品コード / 商品名 / 部門 / 売価 / 在庫数 / 操作、UI-01a-D8）、`51-ui-product-form.md`（4 セクション、UI-01b-D7 / D19）、`src/config/navigation.ts` products group、`docs/design-system/`（04-backbone）
- Decision log / ADR: D-075（owner 裁定事実）、D-076（#91 非対象）、D-027（plu_dirty）、D-028（plu_target）、D-072（PLU slot）
- Evidence: `docs/evidence/issue-90/hearing-2026-08-21-22.sanitized.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 20-io / 30-biz / 31-biz / 40-cmd / 入庫 CMD doc | updated in this PR（第 2 発注） |
| Command / DTO / generated binding / wire shape | 40-cmd（`revise_product_price` / `create_supplier` / `list_price_history`）、入庫 CMD（`ReceivingCreateResult.cost_diffs`）、`Boundary / Wire Contract` 節 | updated in this PR（第 2 発注）。bindings 再生成は実装 PR |
| DB / transaction / audit / rollback / migration | master-tables §3 suppliers 意味改訂、tracking-system-tables price_history 契機列挙。schema 変更なし、migration なし | updated in this PR（第 2 発注） |
| Screen / UI / route state / Japanese wording | 77-ui（新設 UI-14）、50-ui（D9 + keyword）、51-ui（D20 / D21）、入庫 UI doc（差分ダイアログ）、SCREEN_DESIGN、ui-task-specs | updated in this PR（第 2 発注） |
| CSV / TSV / report / import / export format | なし（PLU TSV に原価列なし、商品 CSV 取込みは不変） | existing sufficient |
| Durable decision / ADR | decision-log D-075 Impact 追記、50-ui UI-01a-D13 | updated in this PR（第 2 発注） |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command（`revise_product_price` / `create_supplier` / `list_price_history`、`create_receiving` DTO 拡張） | 実装 PR A/C で `lib.rs` `collect_commands` 登録 + `#[tauri::command]` / `#[specta::specta]` + `generate_bindings`。本 PR では 40-cmd / 44-cmd-inventory に契約行として予約 |
| function-design doc 新設（`77-ui-bulk-price-revision.md`） | `docs/FUNCTION_DESIGN.md` 索引 + `src-tauri/tests/design_compliance_test.rs` の `SKIP_DOCS` に追加（第 2 発注で実施。50-ui と同じく CMD 署名は 40-cmd 側に置き 77-ui には inline 署名を置かない。inline 署名を置く場合のみ 73-ui-stocktake の先例で map entry。未登録のままだと unmapped_docs assert が fail）+ 必須セクション充足 |
| source doc 新設・改名 | `FUNCTION_DESIGN.md` / `SCREEN_DESIGN.md` 画面一覧 #20 / `ui-task-specs.md` UI-14 entry |
| REQ coverage 追加 | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成（第 2 発注の完了条件、`-- --check` exit 0） |
| route 新設（`src/routes/products/price-revision.tsx`） | 実装 PR B で `npm run generate:routes` |
| operator 画面新設（UI-14） | 実装 PR B で `src/config/navigation.ts` products group に `ui-14` entry（`to` + `status: "active"`）+ `navigation.test.ts` に REQ-105 到達テスト。本 PR では 77-ui と Ledger に到達導線契約行を立て、52-ui §52.3 の画面 registry に UI-14 行を追加する |
| AGENT_OPERATING_MANUAL §5.5 consultation relay | 該当なし |

L1 full の生成系検査は bindings / frontend routes / traceability の 3 種。本 PR で発火するのは traceability のみ。

## Design Decisions（SPEC-PRV-D1〜D12、第 2 発注で source docs へ転記する契約）

### SPEC-PRV-D1: `suppliers` の意味 = メーカー/ブランド（値上げ連絡の主体）

- `suppliers.name` は値上げ連絡リストの発行主体であるメーカー / ブランド名を保持する。問屋（発注チャネル）は保持しない。owner 語彙の「取引先」はこの意味で使う（D-075 (6)）。
- schema 変更なし。`master-tables.md` §3 の役割文「取引先（仕入れ先）の名前をマスタ管理」を改訂し、`products.supplier_id` は NULL 可のまま UI-14 確定時に漸進補完する（D6）。
- 却下: 問屋を別テーブルで持つ案（発注を扱わない本システムでは使途がない）/ `suppliers` に種別カラムを足す案（1 社の問屋のために列を増やす価値がない）。

### SPEC-PRV-D2: 検索 keyword の一致対象に `maker_code` を追加

- `ProductSearchQuery.keyword` / `ProductBulkFilter.keyword` の部分一致対象を 商品名 / product_code / jan_code / **maker_code** の 4 列にする。UI-01a と UI-14 が共有する。
- 理由: 値上げリストにはバーコードとメーカー品番が必ず記載され、JAN なし商品でもメーカー品番だけある商品が実在する（master-tables §1）。リストの行から商品へ到達する主動線の鍵。
- 却下: UI-14 専用の検索 field を増やす案（同じ repo 関数に別条件を足すより、一致列追加の方が UI-01a の利便も上がり #66 とも整合）。
- 隣接契約: `ProductBulkFilter` は一括 PLU 対象化（`find_products_for_bulk_plu_target`、SPEC-PLS-D6）と共有のため、同機能の keyword 抽出集合も maker_code 一致を含むよう広がる。UI-01a で見えている行と一括 PLU 対象化の母集団を一致させる意図的な同時変更とし、30-biz の一括 PLU 対象化の節にその旨を明記、実装 A で回帰テストを予約する。

### SPEC-PRV-D3: UI-14 一括価格改定画面の絞り込みと対象

- 絞り込み条件: 取引先（suppliers、単一選択、任意）/ 部門（単一選択、任意）/ keyword（D2）/ 廃番を含む（既定 off）。在庫ゼロ商品は常に対象（D-075 (3)）。
- 取引先を指定したとき、既定で「取引先未設定の商品も含める」を on にし、`supplier_id = X OR supplier_id IS NULL` を対象にする（toggle で off 可）。理由: 既存商品の紐付け網羅率は低く、取引先 filter だけでは初年度の母集団が空になる（D-075 (7) の漸進補完の前提）。
- ページングは UI-01a と同じ `ProductSearchQuery`（per_page 上限は既存契約に従う）。並びは商品コード昇順を既定。
- 却下: 取引先必須の絞り込み（母集団が seed 依存になり初年度に使えない）。

### SPEC-PRV-D4: UI-14 の一覧列と新原価案の導出

- 列: 商品コード / JAN / メーカー品番 / 商品名 / 現売価 / 現原価 / 現掛率 / 新売価（入力）/ 新原価案（入力、初期値は導出）/ 行確定。
- 現掛率 = `cost_price ÷ selling_price` を % 表示（小数 1 桁、四捨五入）。`selling_price = 0` のときは「—」。永続化しない。
- 新原価案の初期値 = `floor(new_selling × cost_price ÷ selling_price)` を整数演算で求める（`(new_selling * cost_price) / selling_price` の整数除算、小数点以下切り捨て、D-075 (2)）。`selling_price = 0` のときは現原価をそのまま初期値にする。店主が上書き可。
- 新売価の自動提案はしない（D-075 (4)）。現売価列はリストの「旧売価」との突合に使う（不一致 = 上乗せ品 or 別商品、の目印。追加機能なし、設計意図として 77-ui に明記）。
- 却下: 浮動小数で掛率を保持して乗算する案（±1 円の再現性が崩れる）。

### SPEC-PRV-D5: 行単位確定 = CMD `revise_product_price`

- CMD `revise_product_price(input: PriceRevisionInput) -> Result<PriceRevisionResult, CmdError>`。`PriceRevisionInput { product_code, new_selling_price: i64, new_cost_price: i64, assign_supplier_id: Option<i64> }`。
- BIZ-01: 商品を読み、`new_selling_price >= 0` / `new_cost_price >= 0` を検証（UI-01b の価格 validation と同じ規則を再利用）。売価・原価とも現値と同じなら no-op（`changed = false`、price_history を書かない）。変更があれば 1 transaction で products の `selling_price` / `cost_price` / `updated_at` を更新し、`price_history` に old/new 4 値を insert。`plu_dirty` は売価が変わった場合のみ 1（既存規則「原価のみ変更は plu_dirty を立てない」を維持。PLU TSV に原価列はない）。同 transaction 内で `system_repo::insert_operation_log(operation_type = "product_price_revise")` を書く（`product_update` / `receiving_create` と同じ慣行、QR-06）。no-op のときは operation log も書かない。
- `assign_supplier_id` が Some で、かつ商品の `supplier_id` が NULL のときだけ `supplier_id` を設定する（既存値は上書きしない、D6）。
- `PriceRevisionResult { product_code, changed: bool, plu_dirty_set: bool, supplier_assigned: bool }`。
- 却下: 既存 `update_product`（全項目更新）を UI-14 から呼ぶ案（行ごとに全 field を往復し、意図しない項目更新と競合の余地がある）/ 複数行を 1 CMD でまとめて確定する案（中断・再開を行単位で成立させる設計〈D7〉と相性が悪く、部分失敗の扱いが増える）。

### SPEC-PRV-D6: 取引先の漸進補完と inline 追加

- UI-14 で取引先 filter を指定して行確定したとき、画面上の「未設定の商品にこの取引先を設定する」（既定 on）が on なら `assign_supplier_id` に filter の取引先を渡す。
- CMD `create_supplier(name: String) -> Result<Supplier, CmdError>`。BIZ-01 で trim、空文字は validation error、既存同名は既存行を返す（`find_or_create_supplier` の公開化、40-cmd L144 / UI-01b-D7 の保留を消化）。
- UI-01b の取引先欄と UI-14 の取引先 filter に「新しい取引先を追加」導線を置く（候補一覧は従来どおり `list_suppliers`）。
- 約 80 社の事前一括投入はしない（D-075 (7)）。改名・統合は非 scope。

### SPEC-PRV-D7: 中断・再開 = 行単位確定 + 「最近改定」目印

- draft 保存テーブルは設けない。確定済み行は現売価 = 新売価になっているため、再訪時に未処理行を続きから作業できる。
- 一覧に「最近改定」目印を出す: 当該商品の直近 `price_history.changed_at` が本日（ローカル日付）なら行頭にバッジ。導出のみ、永続化しない。
- 画面遷移・再読込で入力中の確定前の入力値は失われる（明示。保存前の入力を長時間抱えない運用前提、値上げリスト 1 行 = 1 確定）。

### SPEC-PRV-D8: 入庫時原価差分検出（BIZ-02 拡張）

- `create_receiving` の保存フロー（31-biz §12.3）で、明細の `cost_price` と `products.cost_price` を完全一致比較し、不一致の商品を `ReceivingCreateResult.cost_diffs: Vec<CostDiff>` で返す。`CostDiff { product_code, product_name, master_cost_price, received_cost_price }`。
- 検出は §12.3 の既存 9 step の後に step 10 として COMMIT 後の別読取りで行い、保存 transaction の成否に影響しない（`stock_warnings` が TX 内 step 6 で蓄積されるのとは位置が異なる）。idempotent replay 時は空配列。
- 自動更新はしない。UI-02 は保存完了時に差分一覧ダイアログを出し、商品ごとに「マスタ原価をこの実原価に更新する」→ `revise_product_price(product_code, new_selling = 現売価, new_cost = received_cost_price)` を呼ぶ。見送りは記録なし、次回入庫で差分が残れば再提示。
- 理由: 手芸用品以外は値上げ連絡がなく、入庫伝票が唯一の価格改定導線（D-075 Why）。±1 円も差分として提示（端数訂正の現運用がまさにこれ）。
- 却下: 入庫保存時に自動でマスタ原価を上書きする案（約定値引き等の一時差を恒久化する恐れ、店主の確認を挟む現運用と不一致）。

### SPEC-PRV-D9: 価格履歴閲覧（UI-01b 第 5 セクション）

- IO `list_price_history(conn, product_code, limit) -> Vec<PriceHistoryEntry>`（`changed_at DESC, id DESC`）。CMD `list_price_history(product_code: String, limit: u32) -> Result<Vec<PriceHistoryEntry>, CmdError>`。`PriceHistoryEntry { id, old_selling_price, new_selling_price, old_cost_price, new_cost_price, changed_at }`。
- `product_code` 不存在時は空配列を返す（読取り専用のため not-found error にしない）。`limit` は既定 10・上限 100（超過は 100 に丸める）。
- UI-01b 修正モードに「価格履歴」セクション（UI-01b-D20）: 直近 10 件 + 「すべて表示」で limit = 100。新規登録モードでは非表示。
- 契機（手動 / 一括改定 / 入庫差分）の列は出さない（price_history に契機カラムがなく、schema 変更をしない）。

### SPEC-PRV-D10: SP-103-04 商品一覧の原価列 = 基本列に追加（owner 裁定 2026-08-22、UI-01a-D13）

- 確定: 基本列に「原価」を 売価 の右隣に追加する（UI-01a 基本列 = 商品コード / 商品名 / 部門 / 売価 / 原価 / 在庫数 / 操作）。根拠 = 店主の作業（棚卸し / 税理士 / 値付け）は原価中心で、PC 画面は客に見えない（聞き取り第 3 陣 Q4）。原典 SP-103-04 の指定どおり。
- 却下: 非表示のまま判断記録のみ残す案（参照経路 = UI-14 / UI-01b で足りるが、店主の日常作業で原価を一覧で見る頻度が高く、列密度より参照性を優先）。
- 50-ui の決定行 UI-01a-D13 に記録し、実装 A で UI-01a の列を拡張する。

### SPEC-PRV-D11: 要件 / coverage の露出

- REQ-105「取引先（メーカー）・部門で商品を絞り込み、売価・原価を一括で改定できること」（UI-14, BIZ-01、原典 SP-102-08、required）。
- REQ-106「取引先（メーカー/ブランド）を商品登録・価格改定画面から追加登録できること」（UI-01b, UI-14, BIZ-01、Design Phase 補足 2026-08-22、required）。
- REQ-209「仕入入庫の明細原価が商品マスタの原価と異なる場合に検知し、マスタ原価の更新を提案できること」（UI-02, BIZ-02、Design Phase 補足 2026-08-22、required）。
- REQ-102 の対応 UI に「価格履歴セクション」を明記（新 REQ は起こさない。tracking-system-tables が既に REQ-102 を参照）。
- coverage: SP-102-08 行（→ REQ-105、current、差分理由 = 2026-08-21 原典全数突合で dropped-silently と判明し復活）/ SP-103-04 行（→ REQ-103、current、UI-01a-D13 で原価列を基本列に追加）。完全性契約の件数文を更新。

### SPEC-PRV-D12: 実装 PR の分割

- 実装 A（R3）: IO / BIZ / CMD（D2 keyword、D5 `revise_product_price`、D6 `create_supplier`、D9 `list_price_history`）+ UI-01b 価格履歴セクション + 取引先 inline 追加 + UI-01a 原価列（D10）+ bindings 再生成。
- 実装 B（R3）: UI-14 一括価格改定画面（route / navigation / 到達テスト / D3・D4・D7）。A に依存。
- 実装 C（R3）: BIZ-02 原価差分検出 + `ReceivingCreateResult.cost_diffs` + UI-02 ダイアログ（D8）。A に依存、B とは独立。
- 各 PR の Ledger 行は本 packet の Contract Coverage Ledger を予約元とし、Test Design Matrix「実装 PR への予約」に写す。

## Owner 裁定事項（Plan Gate 前に確定）

| # | 事項 | 選択肢 | Coordinator 推奨 | 裁定 |
|---|------|--------|------------------|------|
| 1 | SP-103-04 商品一覧の原価列（SPEC-PRV-D10） | (a) 基本列に追加 / (b) 非表示のまま判断記録のみ | (a) | **(a) 基本列に追加**（owner 裁定 2026-08-22、介入 1/3） |

他の論点（掛率非永続化 / 端数 / 在庫ゼロ / 手入力 / 暫定フラグなし / suppliers 意味 / 登録経路 A / 指定日不要）は D-075 で確定済み。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-105 / SP-102-08 | 77-ui §構成・§表示と操作、30-biz BIZ-01、40-cmd | SPEC-PRV-D3 / D4 / D5 / D7 | 紙転記の置換。draft table / 自動提案は否認 | 実装 B（画面）+ A（CMD） | M-D3 / M-D4 / M-D5 / M-D7（anchor）→ 実装 PR の Rust / RTL test |
| REQ-105 / REQ-103 | 20-io keyword、50-ui §50.5 | SPEC-PRV-D2 | リストの品番から到達 | 実装 A | M-D2 |
| REQ-106 | 40-cmd、51-ui D7 改訂、master-tables §3 | SPEC-PRV-D1 / D6 | 約 80 社の事前投入をしない漸進補完 | 実装 A / B | M-D1 / M-D6 |
| REQ-209 | 31-biz §12.3、入庫 CMD / UI doc | SPEC-PRV-D8 | 伝票が唯一の導線、自動上書きは否認 | 実装 C | M-D8 |
| REQ-102 | 51-ui D20、tracking-system-tables price_history | SPEC-PRV-D9 | 紙の前年リスト参照の置換 | 実装 A | M-D9 |
| REQ-103 / SP-103-04 | 50-ui UI-01a-D13 | SPEC-PRV-D10 | 顧客可視制約なし | 実装 A | M-D10 |
| REQ-105 / 106 / 209 | requirements / coverage / 90-traceability | SPEC-PRV-D11 | dropped-silently の復活 | 第 2 発注 | M-D11（generate_traceability --check） |
| 全体 | Test Design Matrix | SPEC-PRV-D12 | PR 分割 | 実装 A / B / C | M-D12 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 第 2 発注完了時点で yes（D1〜D11 を該当 source docs へ転記、D-075 と evidence file が根拠）。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: SPEC-PRV-D1〜D11 は全件 source docs へ転記（Scope 参照）。D12 は Matrix のみ（PR 分割は plan 事項）。
- Assumptions and constraints: schema 変更なし / price_history に契機カラムなし / PLU TSV に原価列なし / `plu_dirty` は売価変更時のみ / `selling_price` は税込。
- Deferred design gaps, risk, and follow-up target: 取引先の改名・統合（別起票）/ リニューアル品同定（#66）/ 棚卸し母集団 1 行（#91 follow-up）/ UI-14 の per_page 上限と 400 行級の操作性（実装 B の L3 観点）。
- Test Design Matrix can cite design decision IDs or source doc sections: yes（M-D1〜M-D12）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: `revise_product_price` の no-op 条件と `assign_supplier_id` の「NULL のときのみ」、`cost_diffs` の「保存成否に影響しない」を例外として明記。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 値上げリストは紙 / PDF で adapter 外。POS 連携は `plu_dirty` 既存経路のみ | 77-ui Non-scope |
| Fact check / design decision split | 事実 = evidence file / D-075。判断 = SPEC-PRV-D1〜D12 | 本 packet |
| Lifecycle / retry | 行単位確定で部分完了が正常状態。`create_receiving` replay 時 `cost_diffs` 空 | D5 / D7 / D8 |
| Operator workflow | 印刷リストを手元に JAN / 品番で行へ到達 → 新売価入力 → 確定。数日またぎ可 | 77-ui 操作フロー |
| Replacement path | 紙の棚卸しリスト転記（1 週間 + 2〜3 日）を画面直接入力へ置換 | Goal |
| Data safety / evidence | 実店舗の取引先名・価格は commit しない | Data Safety |
| Reporting / accounting semantics | 原価更新は棚卸し評価（`valuation_cost_price` は棚卸し時点で凍結）に遡及しない | tracking-system-tables 追記 |
| Manual verification | 第 2 発注は docs-only。実装 B で UI-14 の L3（400 行級の操作性）を予約 | Matrix 予約 |
| 環境・再現性 | 該当なし（新設の環境依存なし） | — |

## Design Readiness

- Existing design docs are sufficient because: 既存の product / receiving / price_history の契約が揃っており、本 packet は拡張点を決定 ID で固定するだけで足りる。
- Source docs updated in this PR: Scope 参照（第 2 発注）。
- Design gaps intentionally deferred: Design Intent Audit 参照。
- Durable decisions discovered in this plan and promoted to source docs: SPEC-PRV-D1〜D11。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI-14 / UI-01b / UI-02 → CMD（product / receiving）→ BIZ-01 / BIZ-02 → product_repo / receiving repo。掛率導出は UI（表示）と BIZ（新原価案の初期値は UI 側計算でもよいが、確定値は BIZ が受け取る整数のみ）。
- Backend function design: D5 / D6 / D8 / D9。
- Command / DTO / data contract: Boundary / Wire Contract 節。
- Persistence / transaction / audit impact: products 部分更新 + price_history insert を 1 transaction。schema 変更なし。
- Operator workflow / Japanese UI wording: 「一括価格改定」「現掛率」「新原価（案）」「取引先未設定の商品も含める」「最近改定」「マスタ原価をこの実原価に更新する」。inventory-operator-ui の観点（色のみの状態表現禁止）に従う。
- Error, empty, retry, and recovery behavior: 絞り込み結果 0 件の Empty / 確定失敗は行単位で再試行 / 差分ダイアログの見送りは無記録。
- Testability and traceability IDs: REQ-105 / 106 / 209 / 102 / 103、SPEC-PRV-D1〜D12、UI-01a-D13、UI-01b-D20 / D21。

## Contract Probe

- `generate_traceability` が新 REQ 3 件と新 UI doc の `> 対応仕様:` 行を T2 phantom なしで取り込むか: 第 2 発注で `cargo run --bin generate_traceability -- --check` を是正仮適用状態で実行 → 結果は第 2 発注の報告で記録（第 1 発注時点は N/A、docs 構造は REQ-907 / 67-ui の先例と同型）。
- 整数演算 `floor(new_selling × cost ÷ selling)` の i64 範囲: 売価・原価とも円単位 INTEGER で 10^7 未満、積は 10^14 未満で i64 に収まる → N/A（設計上の自明）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-PRV-D1 suppliers = メーカー意味 | master-tables §3（docs）| M-D1 anchor | non-scope（実装なし） |
| SPEC-PRV-D2 keyword に maker_code | 実装 A product_repo | Rust: keyword が maker_code に部分一致 / 既存 3 列の回帰 / 一括 PLU 対象化（`ProductBulkFilter`）でも maker_code 一致が母集団に入る回帰 | — |
| SPEC-PRV-D3 絞り込み + 未設定含む | 実装 B UI-14 + 実装 A query | Rust: `supplier_id = X OR NULL` の抽出 / RTL: toggle 既定 on | L3: 400 行級の操作性 |
| SPEC-PRV-D4 列 + 新原価案導出 | 実装 B UI-14 | RTL: 導出値 floor / selling=0 の「—」と現原価 fallback / % 表示 | — |
| SPEC-PRV-D5 revise_product_price | 実装 A BIZ/CMD | Rust: no-op（price_history / operation_log なし）/ 売価変更で plu_dirty / 原価のみで plu_dirty なし / price_history 4 値 / operation_log `product_price_revise` / 負値 reject / TX 原子性 | — |
| SPEC-PRV-D6 漸進補完 + create_supplier | 実装 A/B | Rust: NULL のみ設定 / 既存値不変 / trim・空文字 reject / 同名は既存行 | — |
| SPEC-PRV-D7 行単位確定 + 最近改定 | 実装 B | RTL: 本日 changed_at のバッジ表示 / 再読込で確定前の入力値消失の明示文言 | — |
| SPEC-PRV-D8 cost_diffs | 実装 C BIZ-02 / UI-02 | Rust: 不一致抽出 / 一致で空 / replay で空 / 保存成否非依存 ; RTL: ダイアログ → revise 呼出し（売価据え置き） | — |
| SPEC-PRV-D9 list_price_history + UI-01b | 実装 A | Rust: DESC 順 / limit 既定 10・上限 100 丸め / 不存在 product_code で空配列 ; RTL: 修正モードのみ表示 / 10 件 + すべて表示 | — |
| SPEC-PRV-D10 原価列追加 | 実装 A UI-01a | RTL: 列ヘッダ「原価」が 売価 の右隣に存在 | — |
| SPEC-PRV-D11 REQ / coverage / traceability | 第 2 発注 | `generate_traceability -- --check` exit 0 / rg anchor | — |
| UI-14 到達導線（navigation） | 実装 B | `navigation.test.ts` REQ-105 到達テスト | — |
| SPEC-PRV-D12 PR 分割 | Matrix | — | plan 事項 |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-22-price-revision-design.md`（docs-only の anchor oracle M-D1〜M-D12 + 実装 PR A/B/C への予約）。

- targeted tests: 各 M-Dn（新文言 exact 存在 + 旧文言 0 hit）、`generate_traceability -- --check`、`doc-consistency-check.sh`。
- negative tests: D-075 で否認した語（「掛率を保存」「上代カラム」「PDF 解析」「draft 保存」「新売価を提案」）が source docs の肯定文に現れない（rg 0 hit、非 scope 節の否定文は除外）。
- compatibility checks: 既存 UI-01a の keyword 3 列 / `plu_dirty` 規則 / `ReceivingCreateResult` 既存 field の不変。
- data safety checks: 実店舗名・価格・取引先名の不在（evidence は匿名化版のみ）。
- main wiring/integration checks: FUNCTION_DESIGN 索引 / SCREEN_DESIGN #20 / task specs の entry 存在。

## Boundary / Wire Contract

- producer: CMD `revise_product_price` / `create_supplier` / `list_price_history`（product_cmd）、`create_receiving`（receiving_cmd、DTO 拡張）
- consumer: UI-14 / UI-01b / UI-01a / UI-02（`src/lib/bindings.ts` 経由）
- wire type: `PriceRevisionInput { product_code: string, new_selling_price: number, new_cost_price: number, assign_supplier_id: number | null }` / `PriceRevisionResult { product_code, changed, plu_dirty_set, supplier_assigned }` / `Supplier { id, name }`（既存）/ `PriceHistoryEntry { id, old_selling_price, new_selling_price, old_cost_price, new_cost_price, changed_at: string }` / `ReceivingCreateResult` に `cost_diffs: CostDiff[]` 追加（`CostDiff { product_code, product_name, master_cost_price, received_cost_price }`）
- internal type: Rust `i64` 円 / `String` ISO 日時（既存 price_history と同じ）
- precision/range: 円整数 ≥ 0。掛率は wire に乗せない（UI 導出）
- round-trip path: UI 入力 → CMD → BIZ 検証 → IO 更新 → `PriceRevisionResult` → UI 行状態更新 → 再検索で現売価反映
- invalid input: 負値 / 不存在 product_code / 空の取引先名 → `CmdError`（既存 CmdErrorKind の validation / not-found 系を再利用、新 variant は起こさない）
- compatibility: 既存 CMD の入出力は不変。`ReceivingCreateResult` は field 追加のみ（既存 consumer は無視可）。bindings 再生成は実装 PR

## Review Focus

- D1〜D12 が D-075 / evidence と矛盾しないか（特に掛率非永続化・暫定フラグなし・自動提案なし・指定日不要）。
- Scope の source doc 列挙に漏れがないか（44-cmd-inventory / 61-ui-receiving の節位置は Plan Review で実在確認）。
- `ProductSearchQuery.keyword` 拡張が UI-01a の既存契約・test と衝突しないか。
- `revise_product_price` の no-op / plu_dirty / supplier 条件の境界が Ledger に漏れなく載っているか。
- Registration / Generation Obligations の列挙漏れ（UI-13 Amendment 1〜4 の failure class）。
- Matrix の anchor が rg で一意に特定できるか（汎用語 anchor 禁止）。

## Spec Contract

Contract ID: SPEC-PRV

- SPEC-PRV-D1〜D12（上記 Design Decisions 節を正とする）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-PRV-D1 | 第 2 発注 master-tables §3 改訂 | M-D1 | suppliers 意味 | PR diff |
| SPEC-PRV-D2 | 第 2 発注 20-io / 50-ui 追記 | M-D2 | keyword 互換 | PR diff |
| SPEC-PRV-D3〜D4 | 第 2 発注 77-ui 新設 | M-D3 / M-D4 | 操作性・導出 | PR diff |
| SPEC-PRV-D5〜D6 | 第 2 発注 30-biz / 40-cmd / 51-ui | M-D5 / M-D6 | no-op / NULL のみ | PR diff |
| SPEC-PRV-D7 | 第 2 発注 77-ui | M-D7 | 中断・再開 | PR diff |
| SPEC-PRV-D8 | 第 2 発注 31-biz / 入庫 CMD・UI doc | M-D8 | 保存非依存 | PR diff |
| SPEC-PRV-D9 | 第 2 発注 20-io / 40-cmd / 51-ui | M-D9 | DESC / limit | PR diff |
| SPEC-PRV-D10 | 第 2 発注 50-ui UI-01a-D13 + §50.6 | M-D10 | 原価列追加 | PR diff |
| SPEC-PRV-D11 | 第 2 発注 spec / coverage / 90 再生成 | M-D11 | traceability | `generate_traceability -- --check` |
| SPEC-PRV-D12 | Matrix | M-D12 | PR 分割 | Matrix |

## Data Safety

- 実店舗の商品名・価格・取引先名・問屋名を commit しない（evidence は `docs/evidence/issue-90/` の匿名化版のみ）。
- local-only paths: なし。
- synthetic-only paths: 実装 PR の fixture は synthetic のみ（本 PR は docs-only）。

## Implementation Results

- SPEC-PRV-D1〜D12 を Scope 記載の source docs、索引、task specs、decision log へ転記した。新設 UI-14 文書は `docs/function-design/77-ui-bulk-price-revision.md` とし、`design_compliance_test.rs` の `SKIP_DOCS` に登録した。
- REQ-105 / REQ-106 / REQ-209 と SP-102-08 / SP-103-04 を追加し、`90-traceability.md` を generator で再生成した。
- M-D1〜M-D12 は全行 PASS。exact anchor の実測件数は Test Design Matrix の実行結果表に記録した。
- targeted gate は `generate_traceability -- --check` exit 0、`doc-consistency-check.sh` exit 0（既存 WARN 1 件のみ）、`doc-consistency-check.sh --target plan` 全チェック通過、`design_compliance_test` PASS。
- exact-HEAD の L1 full evidence / candidate HEAD / remote ref は tracked packet に追記せず、content commit 後の Writer 最終報告で提示する。

## Review Response

Fill after review.
- Plan Review round 2（Sonnet、独立 context、2026-08-22、packet `a035e13`）: P1 2 / P2 2 / P3 0、verdict fail。全件 accept して是正: P1-1 AC の Ledger 予約検証式（`rg -c "SPEC-PRV-D"`）が Matrix 表記と不一致で充足不能 → 実装対象 10 行に限定し D1/D11/D12 を除外と明記、M-D12 も同期 / P1-2 52-ui-shared-layout §52.3 画面 registry（UI-14 行）の登録義務が未列挙 → Scope + Obligations に追加 / P2-1 30-biz §4.9.1 `bulk_set_plu_target` への注記が Scope に未記載 → 追記 / P2-2 Matrix Negative Paths の `list_price_history` 不存在時「要確定」が stale → D9 確定済みへ更新。
- Coordinator sweep（round 2 後、2026-08-22）: 新設 `77-ui` doc は `design_compliance_test.rs` の unmapped_docs assert により `SKIP_DOCS` 登録が必須で、本 PR が test file 1 行を触ることが判明 → Non-scope の例外 / Scope bullet / Registration 行を同期（Human Gate 行の同期は sd pattern 不一致で未適用のまま round 3 へ → round 3 P1-1 で捕捉、是正済み）。
- Plan Review round 3（Sonnet、独立 context、2026-08-22、packet `19c0477`〜`004eadf`）: P1 3 / P2 0 / P3 2、verdict fail。天井 3 到達のため round 4 は起こさず Coordinator disposition = 全件一括是正 + rg sweep（DEV_WORKFLOW Review Rules、PR #84 round 3 と同型）: P1-1 Human Gate の `workflow_dispatch` 文言（non-doc を含むため CI-TRIGGER-D1 の Ready / synchronize 経路が正）→ 是正 / P1-2 Matrix Boundary Checks の limit 上限「第 2 発注で確定」stale → 上限 100 へ / P1-3 Matrix Negative Paths の自動提案 regex が 51-ui の pos_stock_sync 提案文に誤 hit → 77-ui 限定 + 肯定文のみへ特定化 / P3-1 Scope の §50.5 表記 → §50.6 へ / P3-2 Plans.md 次の行動 entry の stale 参照（31-biz L319）→ §12.3 step 10 へ同期。是正後に Coordinator が `rg` で「要確定 / 第 2 発注で確定 / workflow_dispatch 1 run / L319 / UI-01a-D9 / 裁定 (a) の場合」を packet・Matrix・Plans.md 全 sweep し 0 hit を確認。
- Final Review（Sonnet、独立 context fresh、2026-08-22、content candidate `0e60da5`）: P1 0 / P2 1 / P3 1 → OPEN。Ledger 13/13 行、M-D1〜M-D12 の rg 件数が Writer 実測と全一致、traceability --check exit 0（WARN 3 = 未実装 REQ の T3、想定内）、doc-check / --target plan / design_compliance PASS。P2-1 Matrix Negative Paths の否認語 rg 3 件（掛率永続化 / 上代 / PDF 解析）が「現状 0 hit」のまま stale（第 2 発注後は 77-ui の却下理由・Deferred 列挙で各 1 hit、否認文脈）→ 採用、実測 1 hit と許容根拠を明記。P3-1 Plans.md 次の行動 entry の status 文言が stale（Plan Gate 待ちのまま）→ 採用、Coordinator が同期。是正 delta は docs-only のため fresh context の delta 再検証で P1/P2 = 0 を確認してから human-confirm 遷移する。
- Findings Freeze: frozen after Final Review（2026-08-22）; post-freeze exceptions: none.

### 遷移記録（2026-08-22、state-only 遷移 plan-draft -> plan-gate -> plan-approved -> implementing）

- plan-draft -> plan-gate の evidence: packet（`0b10e18`）と Test Design Matrix（同 commit）を commit 済み、`doc-consistency-check.sh --target plan` 全チェック通過。
- plan-gate -> plan-approved の evidence: 独立 Sonnet Plan Reviewer 3 round（round 1 P1 0 / P2 3 → 是正 `a035e13`、round 2 P1 2 / P2 2 → 是正 `19c0477`、round 3 P1 3 / P2 0 = 表記整合のみ → 天井 3 到達で Coordinator 一括是正 `3613456`、残 P1/P2 = 0）、owner 裁定（SP-103-04 原価列 = (a)、介入 1/3）と owner plan approval（2026-08-22、介入 2/3）、Plan Commit = plan-first commit `0b10e18`（本 branch の全 content commit の祖先）。
- plan-approved -> implementing の evidence: 本 design-first PR の implementation = source docs amendment（Codex Writer 第 2 発注）であり、plan-first commit が先行済み。隣接 3 遷移を 1 state-only commit で圧縮記録（PR #84 と同型、DEV_WORKFLOW 圧縮規則）。

### Writer 報告（2026-08-22、Codex）

- SPEC-PRV-D1〜D12 の source docs amendment、REQ / coverage / traceability 更新、UI-14 文書・索引・task specs 登録を完了した。M-D1〜M-D12 は全行 PASS（実測件数は Matrix の実行結果表）。
- Mechanical Impact Inventory: keyword 旧文言は Matrix oracle 1 hit のみ、基本列旧文言 0 hit、40-cmd 旧保留文 0 hit、51-ui §7.7 旧文言は archive 2 hit のみ、suppliers 旧役割文は Packet / Matrix oracle 各 1 hit のみ。archive は履歴保持、Packet / Matrix は置換対象を表す検証用引用として明示除外し、archive 外の source docs に旧契約は残していない。
- provisional 判断: なし。
- Review-only skipped because: 独立 Final Reviewer は Sonnet に固定されており、Writer 自己レビューで代替しないため。

### 遷移記録（2026-08-22、state-only 遷移 implementing -> local-verified -> independent-review -> human-confirm）

- implementing -> local-verified: content candidate `0e60da5`（Codex Writer 第 2 発注）の L1 `local-ci.sh full` RESULT=PASS / END_TREE_STATE=CLEAN（evidence path は PR #93 body）。是正 delta `18d87ac` は packet / Matrix / Plans.md のみで source docs・test に触れず、`doc-consistency-check.sh`（全体 / `--target plan`）exit 0 を再確認。exact-HEAD の L1 full は Ready 遷移 commit で実施する。
- local-verified -> independent-review: 独立 Sonnet Final Reviewer（fresh context）が Contract Audit を実施（Ledger 13/13、M-D1〜M-D12 の rg 件数再実測が Writer 表と全一致、Mechanical Impact Inventory sweep、登録義務、ID 一意性、Non-scope / Data Safety）。
- independent-review -> human-confirm: Final Review P1 0 / P2 1 / P3 1 を全件裁定・是正（`18d87ac`）し、fresh context の delta 再検証で P1/P2 = 0。`Reviewed Content HEAD` = `18d87ac`。隣接 3 遷移を 1 state-only commit で圧縮記録（post-implementation state-only 1 本目 / cap 3、PR #84 と同型）。

### 遷移記録（2026-08-22、state-only 遷移 human-confirm -> ready-hosted-final）

- owner Ready 承認（2026-08-22、介入 3 回目 / 予算 3）。Human Gate の残り = owner の Ready 化と hosted final。`design_compliance_test.rs` SKIP_DOCS 1 行を含む non-doc event-eligible change のため、CI-TRIGGER-D1 の表に従い Ready event の自動 run を待ち、予防的 `workflow_dispatch` はしない。post-implementation state-only 2 本目 / cap 3。exact HEAD（本 commit）の L1 full と hosted run headSha は PR #93 body に記録し、packet には commit しない。
