# Test Design Matrix: 価格改定支援 実装 A（backend + UI-01a 原価列 + UI-01b 価格履歴・取引先 inline 追加）

Plan Packet: `docs/plans/2026-08-22-price-revision-impl-a.md`。予約元: `docs/archive/plans/test-matrices/2026-08-22-price-revision-design.md`「実装 PR への予約 → 実装 A」（本 Matrix は予約名を全件引き継ぎ、追加分を明記する）。

## Risk

Risk: R3

## Contracts Under Test

- SPEC-PRV-D2: `search_products` / `find_products_for_bulk_plu_target` の keyword が 商品名 / product_code / jan_code / maker_code の 4 列に部分一致する（20-io §2、30-biz §4.9.1）。
- SPEC-PRV-D5: `revise_product_price` の step 1〜6（NotFound / 負値 validation / no-op / 4 値履歴 / operation_log `product_price_revise` / 売価変更時のみ plu_dirty / NULL のときだけ supplier_id / 3 テーブル rollback、30-biz §4.4.1）。
- SPEC-PRV-D6: `create_supplier` の trim / 空文字 reject / 同名は既存行（30-biz §4.7.2）、UI-01b-D21 inline 追加。
- SPEC-PRV-D9: `list_price_history` の `changed_at DESC, id DESC` / limit 丸め / 不存在は空配列（20-io §2.6、30-biz §4.7.3）、UI-01b-D20 価格履歴セクション。
- SPEC-PRV-D10 / UI-01a-D13: 「原価」列が「売価」の右隣。
- SPEC-PRVA-D1〜D5（packet）: placeholder 文言 / 価格履歴の空・失敗表示 / 不存在 assign_supplier_id の NotFound / 価格 no-op + supplier 紐付けだけの呼出し / DTO 配置。
- 境界（archived Matrix 予約）: 10^7 直下の価格値の exact 永続化（上限契約は source docs に無く、10^7 は `未実測` の前提）。
- 登録・生成: lib.rs 2 list、bindings.ts、90-traceability、design_compliance_test。

## Failure Modes

- keyword の maker_code 追加が片方の関数にだけ入る（UI-01a の見え方と一括 PLU 母集団がずれる）。
- no-op なのに price_history / operation_log が書かれる、または変更ありなのに片方しか書かれない。
- 原価のみ変更で plu_dirty が立つ / 売価変更で立たない。
- 既存の非 NULL supplier_id が上書きされる / NULL なのに設定されない。
- 途中失敗で products だけ更新され price_history / operation_logs が欠ける。
- create_supplier が trim せず同名を二重作成する / 空文字で INSERT する。
- list_price_history が昇順、limit 無視、不存在で error。
- CMD が collect_commands! か generate_handler! の片方にしか登録されず、bindings にあるのに invoke できない（またはその逆）。
- UI-01b create mode で価格履歴が出る / edit mode で出ない / 「すべて表示」が 10 のまま再取得。
- 取引先 inline 追加が空白で CMD を呼ぶ / 成功後に候補が更新されない / 失敗で入力が消える。
- 原価列が売価の左や末尾に置かれる。
- REQ token を持つ test を足したのに 90-traceability が未再生成で T1 drift。

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- 既存 test（無改変で PASS を要求）: `test_update_product_req102_cost_only_no_plu_dirty`（product_service）、`test_find_or_create_supplier_req101_creates_new` / `_finds_existing`、`test_insert_price_history_req102_normal`、`test_search_products_req103_keyword_name` / `_keyword_product_code`（product_repo）— いずれも rg で実在確認済み（2026-08-22）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-PRV-D2 search_products | maker_code 非一致 | unit (product_repo) | `test_search_products_req105_keyword_matches_maker_code` | LIKE 句に `p.maker_code` がない、または maker_code だけ一致する商品が結果に含まれない |
| SPEC-PRV-D2 既存 3 列 | 列が落ちる | regression (product_repo) | `test_search_products_req103_keyword_matches_existing_three_columns` | name / product_code / jan_code のいずれかの部分一致が消える（1 test 内で 3 列を個別 assert） |
| SPEC-PRV-D2 一括 PLU 母集団 | bulk 側だけ旧 3 列 | unit (product_repo) | `test_find_products_for_bulk_plu_target_req105_keyword_matches_maker_code` | `find_products_for_bulk_plu_target` の LIKE 句に maker_code がなく、maker_code のみ一致の商品が母集団から漏れる |
| SPEC-PRV-D5 step 1 | 不存在でも成功 | unit (product_service) | `test_revise_product_price_req105_not_found_product` | 不存在 product_code で `Err(BizError::NotFound)` 以外が返る |
| SPEC-PRV-D5 step 1 | 負値売価を受理 | unit | `test_revise_product_price_req105_validation_negative_selling_price` | `new_selling_price = -1` で `ValidationFailed` 以外、または DB が更新される |
| SPEC-PRV-D5 step 1 | 負値原価を受理 | unit | `test_revise_product_price_req105_validation_negative_cost_price` | `new_cost_price = -1` で `ValidationFailed` 以外 |
| SPEC-PRV-D5 step 2 | no-op で履歴書込み | unit | `test_revise_product_price_req105_no_op_when_unchanged` | 現値と同じ入力で `changed != false`、または price_history 行数が増える、または `updated_at` が変わる |
| SPEC-PRV-D5 step 2 | no-op で operation_log | unit | `test_revise_product_price_req105_no_op_writes_no_operation_log` | no-op 後に `operation_type = "product_price_revise"` の operation_logs 行が存在する |
| SPEC-PRV-D5 step 3 | 4 値の欠落 / 取り違え | unit | `test_revise_product_price_req105_writes_price_history_four_values` | price_history の old_selling / new_selling / old_cost / new_cost が入力と現値の独立転記 oracle と一致しない（old/new 逆転、cost に selling 値混入を含む） |
| SPEC-PRV-D5 step 3 | operation_log 欠落 | unit | `test_revise_product_price_req105_writes_operation_log` | 変更ありで `"product_price_revise"` 行が 1 件増えない |
| SPEC-PRV-D5 step 4 | 売価変更で plu_dirty 不変 | unit | `test_revise_product_price_req105_plu_dirty_on_selling_change` | 売価変更後 `plu_dirty != 1` または `plu_dirty_set != true` |
| SPEC-PRV-D5 step 4 | 原価のみで plu_dirty | unit | `test_revise_product_price_req105_cost_only_no_plu_dirty` | 原価のみ変更で `plu_dirty` が 0 → 1 になる、または `plu_dirty_set != false`（既存 `test_update_product_req102_cost_only_no_plu_dirty` と対） |
| SPEC-PRV-D5 step 5 / D6 | NULL なのに未設定 | unit | `test_revise_product_price_req106_assigns_null_supplier_id` | supplier_id NULL の商品に `Some(id)` を渡しても設定されない、または `supplier_assigned != true` |
| SPEC-PRV-D6 | 非 NULL を上書き | unit | `test_revise_product_price_req106_keeps_existing_supplier_id` | 既存 supplier_id=A の商品に `Some(B)` を渡すと A が B になる、または `supplier_assigned != false` |
| SPEC-PRVA-D3 | 不存在 supplier を黙認 | unit | `test_revise_product_price_req106_unknown_supplier_id_not_found` | 存在しない id を `Some` で渡して `NotFound` 以外が返る、または価格が更新される |
| SPEC-PRVA-D4 | 価格 no-op で supplier 紐付けも skip / 余計な書込み | unit | `test_revise_product_price_req106_assigns_supplier_when_price_unchanged` | 現値と同じ価格 + `Some(存在 id)` + supplier_id NULL で、supplier_id が設定されない、`supplier_assigned != true`、`changed != false`、または price_history / `product_price_revise` 行が増える |
| 境界 10^7 直下 | 大きな値の丸め / 桁落ち | unit | `test_revise_product_price_req105_persists_large_values_exactly` | `new_selling_price = 9_999_999` / `new_cost_price = 9_999_998` が products と price_history の new 値に exact に残らない（oracle は literal を独立転記） |
| SPEC-PRV-D5 step 6 | 部分 commit | unit | `test_revise_product_price_req105_tx_atomicity_rollback` | 途中失敗（例: price_history insert を失敗させる test hook / 制約違反）後に products の価格が変わっている、または operation_logs に行が残る |
| SPEC-PRV-D6 create_supplier | trim なし | unit (product_service) | `test_create_supplier_req106_trims_and_creates` | `"  メーカーX  "` が trim されず保存される、または新規行が返らない |
| SPEC-PRV-D6 create_supplier | 空文字で INSERT | unit | `test_create_supplier_req106_rejects_empty_name` | `"   "` で `ValidationFailed` 以外、または suppliers 行数が増える |
| SPEC-PRV-D6 create_supplier | 同名二重作成 | unit | `test_create_supplier_req106_returns_existing_row_for_duplicate_name` | 同名 2 回目で id が変わる、または suppliers 行数が 2 になる |
| SPEC-PRV-D9 | 昇順 | unit (product_repo) | `test_list_price_history_req102_desc_order` | `changed_at` 異なる 3 行で返却順が新しい順でない |
| SPEC-PRV-D9 | tie-break 欠落 | unit (product_repo) | `test_list_price_history_req102_id_desc_tie_break_on_same_changed_at` | 同一 `changed_at` を持つ 2 行（id 小 → 大の順で insert）で返却順が id DESC でない（`id ASC` mutant が生存する。Final Review で実証された survivor の是正） |
| SPEC-PRV-D9 | limit 無視 | unit | `test_list_price_history_req102_respects_limit` | 行数 > limit で limit 件より多く返る |
| SPEC-PRV-D9 | 上限丸めなし | unit | `test_list_price_history_req102_clamps_limit_over_max` | `limit = 101` で 100 件超が返る（fixture は 101 行以上、または SQL の LIMIT 引数を観測） |
| SPEC-PRV-D9 | 不存在で error | unit | `test_list_price_history_req102_unknown_product_returns_empty` | 不存在 product_code で `Ok(vec![])` 以外 |
| 40-cmd 3 CMD | シグネチャ不一致 | integration (design_compliance_test) | `cargo test --test design_compliance_test` | 実装の pub fn 名 / 引数が 20-io / 30-biz / 40-cmd のコードブロックと一致しない |
| 登録 lib.rs 2 list | 片方だけ登録 | CLI | `rg -n "revise_product_price\|create_supplier\|list_price_history" src-tauri/src/lib.rs` が両 list に各 3 行 | `collect_commands!` か `generate_handler!` の片方にない |
| bindings 再生成 | 生成物未 commit | CLI | `cd src-tauri && cargo run --bin generate_bindings && git diff --stat src/lib/bindings.ts` が空 + `rg -c "reviseProductPrice\|createSupplier\|listPriceHistory" src/lib/bindings.ts` ≥ 3 | bindings が stale または CMD 未生成 |
| SPEC-PRVA-D1 | placeholder 旧文言 | RTL (ProductListPage.test.tsx) | `商品一覧の検索欄 placeholder がメーカー品番を含む` | `getByLabelText("商品検索")` の placeholder が「商品コード・商品名・JAN・メーカー品番で検索」でない |
| UI-01a-D13 | 原価列の位置 | RTL (ProductTable.test.tsx) | `原価列が売価の右隣に表示される` | `columnheader` の配列で「売価」の次が「原価」でない、または行セルに `cost_price` の値が出ない |
| UI-01a-D13 | 一覧で原価 header 欠落 | RTL (ProductListPage.test.tsx) | `一覧に原価列ヘッダが存在する` | `getByRole("columnheader", {name: "原価"})` が見つからない |
| UI-01b-D20 | edit で非表示 / create で表示 | RTL (ProductForm.test.tsx) | `edit mode で価格履歴セクションが表示され create mode では表示されない` | edit で h2「価格履歴」なし、または create で h2 あり、または `listPriceHistory` が create で呼ばれる |
| UI-01b-D20 | 10 件 / 新しい順 | RTL | `価格履歴は listPriceHistory(code, 10) の結果を新しい順に表示する` | 呼出し引数が `(code, 10)` でない、または mock の返却順と描画順が異なる（oracle は mock 配列から独立に転記した changed_at 文字列） |
| UI-01b-D20 | すべて表示 | RTL | `すべて表示で limit 100 を再取得する` | button 押下後の呼出しが `(code, 100)` でない |
| SPEC-PRVA-D2 | 空表示 | RTL | `履歴 0 件で「価格履歴はまだありません」を表示する` | 空配列で文言が出ない |
| SPEC-PRVA-D2 | 失敗 + 再試行 | RTL | `取得失敗で再試行ボタンから再取得できる` | reject 後に error 文言 / 「再試行」が出ない、または押下で再呼出しされない |
| UI-01b-D21 | 空白で CMD | RTL | `取引先名が空白のみなら createSupplier を呼ばず field error を出す` | `createSupplier` が呼ばれる、または error 文言が出ない |
| UI-01b-D21 | trim / 成功後の再取得と選択 | RTL | `新しい取引先を追加すると listSuppliers を再取得し返却 supplier を選択状態にする` | `createSupplier` の引数が trim 後の値でない、`listSuppliers` 再呼出しがない、select 値が返却 id でない |
| UI-01b-D21 | 失敗で入力消失 / form 値消失 | RTL | `createSupplier 失敗時に入力値と既存の商品 form 値を保持し error を表示する` | reject 後に取引先名 input が空になる、先に入力した 商品名 field の値が変わる、または error 文言が出ない（51-ui「既存の商品 form 保存値を失わない」） |
| REQ-105 / 106 traceability | T3 WARN 残存 / T1 drift | CLI | `cd src-tauri && cargo run --bin generate_traceability -- --check` exit 0 + `rg -c "REQ-105.*no-test\|REQ-106.*no-test" docs/function-design/90-traceability.md` = 0 | 再生成漏れ、または test 名の REQ token が誤り |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| UI-01b 価格履歴セクション（edit） | mount 時 `listPriceHistory(code, 10)` | 「読み込み中…」 | 新しい順に行表示 / 0 件は「価格履歴はまだありません」 | 「すべて表示」押下 | `listPriceHistory(code, 100)` | 画面再訪で再取得（10 件に戻る） | アプリ再起動で同じ | inline error + 「再試行」 | 「再試行」で同 limit を再呼出し | RTL ProductForm（UI-01b-D20 / SPEC-PRVA-D2 行） |
| UI-01b 取引先 inline 追加 | 導線 button のみ | 入力欄 + 追加 button 表示、送信中 disabled | `createSupplier` 成功 → `listSuppliers` 再取得 → 返却 supplier を select | 候補 list | `listSuppliers` | 再訪で通常 select | — | error 表示、入力保持 | 再送信 | RTL ProductForm（UI-01b-D21 行） |
| UI-01a 検索（keyword） | URL search params | debounce 200ms（既存） | 4 列一致の結果 | 入力変更 | `searchProducts` | 既存どおり | 既存どおり | 既存 error 表示 | 既存 | 既存 RTL + Rust keyword test |
| products / price_history / operation_logs（revise_product_price） | 現値 | TX 開始 | 3 テーブル commit | — | — | — | — | 3 テーブル rollback | 呼出し側が再実行（冪等: 同値なら no-op） | Rust step 2 / 3 / 6 test |
| Workflow State（packet） | plan-draft | plan-gate | plan-approved → implementing | content candidate → L1 | independent-review | human-confirm（Reviewed Content HEAD） | Ready state-only → exact-HEAD L1 → PR body | state-only violation → implementing へ戻す | state-backtrack | `check-workflow-git.sh` |

Workflow-state rows:

- content candidate -> L1 / independent review -> state-only human-confirm commit: Writer の content commit 後に L1 full、独立 Sonnet Final Review、P1/P2 = 0 で human-confirm 遷移 commit 内に `Reviewed Content HEAD` を設定。
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit: L3 PASS + Ready 承認 → state-only `human-confirm->ready-hosted-final` → exact-HEAD L1 → PR body → Ready（CI-TRIGGER-D1 自動 run）→ 三点一致 → merge。
- state-only violation: file allowlist と `git diff --unified=0` hunk の両方で検査。Scope / AC / Ledger / test / bindings に触れた state-only commit は implementing へ戻す。
- hosted-not-required incidental failure: 該当なし（Hosted CI Requirement = required）。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| keyword LIKE（商品検索） | `product_repo::search_products`、`product_repo::find_products_for_bulk_plu_target`（rg `LIKE` in product_repo.rs） | 両方に `p.maker_code` 追加 | 在庫照会 / 入出庫履歴の keyword は別 repo の契約（58-ui / 60 系 doc）で maker_code を規定しないため除外 | D2 の 3 test |
| plu_dirty 設定規則 | `product_service::update_product`（売価変更時のみ）、`bulk_set_plu_target`（PLU 対象化時） | `revise_product_price` step 4 | `bulk_set_plu_target` は価格を触らないため除外 | step 4 の 2 test + 既存 `test_update_product_req102_cost_only_no_plu_dirty` |
| price_history 書込み | `product_service::update_product` → `insert_price_history` | `revise_product_price` step 3（同 helper 流用） | — | step 3 test |
| operation_log 書込み | `product_service` の `product_create` / `product_update` / `product_discontinue` | `"product_price_revise"` | no-op では書かない（D5 step 2） | step 2 / 3 test |
| not-found / validation の error 正規化 | `product_cmd` 既存 CMD の `From<BizError>` 変換 | 新 3 CMD | 新 variant は作らない | design_compliance_test + clippy、Final Review の目視 |
| SearchBar placeholder | `ProductListPage` / `InventoryRecordsPage` / `StockInquiryPage`（rg `<SearchBar`） | `ProductListPage` のみ prop 上書き | 他 2 画面は maker_code 一致を持たないため除外、`InventoryRecordsPage.test.tsx` の既存 assertion を維持 | RTL placeholder + 既存 test 無改変 |
| フォーム内 fetch 失敗の復旧（取引先取得失敗） | `ProductForm` の departments / suppliers 取得 error 表示 | `PriceHistorySection` の error + 再試行 | — | SPEC-PRVA-D2 RTL |
| IME 合成中 Enter の無視 | `SearchBar`（UI-01a-D9）、ProductForm 既存入力 | 取引先 inline 入力欄（Enter で追加する場合は composition 中を無視） | Enter 送信を持たない実装なら該当なし（Writer 判断、報告に明記） | L3 item 3 |

## Negative Paths

- missing input: `create_supplier("")` / `"   "` → ValidationFailed、CMD / INSERT なし。UI は CMD を呼ばない。
- invalid input: 負値売価 / 負値原価 → ValidationFailed。`limit` は u32 のため負値は型で排除。
- duplicate/ambiguous input: 同名取引先 → 既存行を返し行数不変。
- unknown reference: 不存在 product_code → `revise_product_price` は NotFound、`list_price_history` は空配列（読取り専用）。不存在 `assign_supplier_id` → NotFound（SPEC-PRVA-D3）。
- dependency missing: `listPriceHistory` reject → セクション内 error + 再試行（form の他セクションは操作可能）。`listSuppliers` 再取得失敗 → 既存の取引先取得失敗の復旧に従う。
- permission/write failure: TX 途中失敗 → 3 テーブル rollback（step 6 test）。
- dry-run side effect: 該当なし（dry-run なし）。

## Boundary Checks

- threshold: `limit` 100 超 → 100（`test_list_price_history_req102_clamps_limit_over_max`）。`limit = 0` は SQL `LIMIT 0` どおり空配列、UI は 10 / 100 以外を送らない（契約化せず、`未実測` の test も置かない）。
- null/default: `assign_supplier_id = None` で supplier 処理なし、`supplier_assigned=false`。`supplier_id` NULL の商品に Some → 設定。
- empty/non-empty: 履歴 0 件 → 空配列 + UI 文言。maker_code NULL の商品は keyword 一致対象外（LIKE NULL は偽、既存 jan_code NULL と同じ挙動）。
- min/max: 円は 0 以上（0 は許容、負値 reject）。
- status/policy enum: `CmdErrorKind::Validation` / `NotFound` のみ使用、新 variant なし。
- wire type: `PriceRevisionInput` / `PriceRevisionResult` / `PriceHistoryEntry` は 40-cmd どおり。`limit: number`（u32）。
- internal type: Rust `i64` / `u32` / `String`。
- producer/consumer: product_cmd → bindings.ts → ProductForm / ProductListPage（本 PR）、UI-14 / UI-02（後続）。
- round-trip token: 該当なし（URL state token は既存 search params のみ、変更なし）。
- precision/range: 上限契約は source docs に無い（schema `INTEGER NOT NULL`、30-biz は `>= 0` のみ）。JS `number` ↔ `i64` で、10^7 円未満は `未実測` の前提。archived Matrix 予約の境界 test は `test_revise_product_price_req105_persists_large_values_exactly`（9,999,999）で消化。
- cross-language parse: `changed_at` は ISO 文字列のまま表示（既存 price_history と同じ、変換しない）。

## Compatibility Checks

- old schema/input: schema 変更なし。既存 `update_product` の price_history / plu_dirty 規則は不変（既存 test 無改変 PASS）。
- new schema/input: なし。
- output order: `list_price_history` は `changed_at DESC, id DESC`。`search_products` の sort は不変（keyword 列追加は WHERE のみ）。
- optional field behavior: `assign_supplier_id` 省略（None）で supplier 処理なし。`bindings.ts` は追加のみで既存 consumer に影響なし。

## Data Safety Checks

- source-derived data: 実店舗の商品 / 取引先 / 価格を fixture に使わない。
- generated outputs: `bindings.ts` / `90-traceability.md` は generator 出力をそのまま commit（手動編集なし）。
- secrets: 該当なし。
- local-only files: owner の local DB（L3）。
- synthetic sample boundaries: Rust test は in-memory / temp DB、RTL は mock `commands`。

## Main Wiring / Integration Checks

- helper connected to main path: `revise_product_price` / `create_supplier` / `list_price_history` が product_cmd から呼ばれ、lib.rs の 2 list に登録（rg 検証）。`PriceHistorySection` が `ProductForm` の edit mode で mount（RTL）。
- output reaches manifest/report: `bindings.ts` に 3 型 + 3 command（rg 検証）。
- effective config reaches runtime: 該当なし。
- CLI arg reaches implementation: `generate_traceability` が `_req105_` / `_req106_` / `_req102_` token を拾い 90-traceability の `no-test` が消える（--check exit 0）。

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant?: Rust の price_history 4 値 test は入力値と fixture 現値を test 内で独立転記した oracle と比較する（production の DB 読み戻しを oracle にしない）。RTL の価格履歴表示 test は mock 配列から独立に書いた changed_at / 価格文字列で `getByText` する（feedback: Test oracle must not share SSOT）。
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct?: 「すべて表示」RTL は 1 回目 `(code, 10)` → 2 回目 `(code, 100)` の呼出し順を `mock.calls` で検証する。取引先 inline RTL は `createSupplier` 解決後に `listSuppliers` が再呼出しされ select 値が返却 id になる順序を検証する。
- If a key branch is inverted, which test fails?: D6 の「NULL のときだけ設定」が「常に上書き」に反転 → `test_revise_product_price_req106_keeps_existing_supplier_id`。「NULL でも設定しない」に反転 → `test_revise_product_price_req106_assigns_null_supplier_id`。D5 の no-op 判定が反転 → `test_revise_product_price_req105_no_op_when_unchanged`。
- If a threshold comparison changes, which test fails?: limit の `> 100` 丸めを外す → `test_list_price_history_req102_clamps_limit_over_max`。`>= 0` を `> 0` に変える → 0 円を reject し、L3 / 境界 test（`test_revise_product_price_req105_validation_negative_selling_price` は 0 を許容することも assert する）が落ちる。
- If a guard is removed, which test fails?: 負値 guard → `_validation_negative_selling_price` / `_validation_negative_cost_price`。空文字 guard → `test_create_supplier_req106_rejects_empty_name`。supplier 存在検証 → `test_revise_product_price_req106_unknown_supplier_id_not_found`。
- If an output field is omitted, which test fails?: `PriceRevisionResult.plu_dirty_set` を省略 → `cargo run --bin generate_bindings` 後の `npm run typecheck`（RTL / 後続 UI の型）と `design_compliance_test` の struct field 照合がないため、step 4 の Rust test が `plu_dirty_set` を assert することで捕捉する。`PriceHistoryEntry.changed_at` 省略 → DESC 順 test と RTL 表示 test。
- If tracked Workflow State stores the current PR HEAD, does a state commit make it stale immediately?: `Reviewed Content HEAD` は human-confirm 遷移 commit 内でのみ設定し、exact-HEAD evidence は PR body に置く。
- If a hosted URL/headSha is committed after the run, does the merge three-point check fail because PR HEAD changed?: hosted URL / headSha は packet に commit しない。Ready 後の tracked commit を作らない。
- If a state-only commit edits Scope/AC in the same packet file, does hunk-level review reject it even though the filename is allowlisted?: `git diff --unified=0` で hunk を検査し、Workflow State と遷移記録以外の hunk があれば implementing へ戻す。
- If output order changes, which test fails?: `changed_at DESC` を ASC に → `test_list_price_history_req102_desc_order`。`id DESC` だけを ASC に → `test_list_price_history_req102_id_desc_tie_break_on_same_changed_at`（Final Review で `id ASC` mutant の生存を実証し、tie-break 専用 test として分離）。
- If dry-run performs a side effect, which test fails?: 該当なし。
- If a JSON number crosses JavaScript safe integer range, which test fails?: 上限契約が無いため到達を防ぐ test は置けない（`未実測` 前提 10^7 未満）。桁落ちなしの exact 永続化は `test_revise_product_price_req105_persists_large_values_exactly` が 10^7 直下で検証する。新原価案の整数除算 overflow は実装 B の Matrix に残す。
- If a state token is round-tripped through browser/client code, which test fails?: 該当なし（新 token なし）。
- 追加（SPEC-PRV-D2）: `search_products` の LIKE から maker_code を落とす → `test_search_products_req105_keyword_matches_maker_code`。`find_products_for_bulk_plu_target` 側だけ落とす → `test_find_products_for_bulk_plu_target_req105_keyword_matches_maker_code`。
- 追加（SPEC-PRV-D5 step 4）: 売価変更時の plu_dirty 設定を削除 → `test_revise_product_price_req105_plu_dirty_on_selling_change`。原価のみでも立てるよう変更 → `test_revise_product_price_req105_cost_only_no_plu_dirty`。
- 追加（SPEC-PRV-D5 step 2 / 3）: no-op でも price_history を書く → `test_revise_product_price_req105_no_op_when_unchanged`。operation_log 書込みを削除 → `test_revise_product_price_req105_writes_operation_log`。
- 追加（SPEC-PRV-D6）: 同名判定を外す → `test_create_supplier_req106_returns_existing_row_for_duplicate_name`。
- 追加（UI-01a-D13）: 原価列を末尾に移す → `原価列が売価の右隣に表示される`。
- Final Reviewer は上記のうち最低 D5 step 2 / step 4 / D6 keep / D2 bulk の 4 mutant を clean tree で実注入し、対応 test が落ちることを独立再現する（feedback: Mutation kill claims need reproduction）。

## Residual Test Gaps

- CMD 層の error 正規化（BizError → CmdErrorKind）は既存 `From` 変換の流用で新 test を置かない。Final Review で目視確認。
- `limit = 0` の挙動は契約化しない（UI は送らない）。
- TX 原子性 test の失敗注入手段（制約違反 / test hook）は Writer が既存 `update_product` の TX test 先例に合わせて選び、報告に明記する。
- Windows native の IME 合成中 Enter（取引先 inline 入力）は RTL で判別不能なため L3 item 3 に依存。
- 後続 UI-14（実装 B）/ cost_diffs（実装 C）の契約は本 Matrix の対象外（archived Matrix の予約どおり）。
