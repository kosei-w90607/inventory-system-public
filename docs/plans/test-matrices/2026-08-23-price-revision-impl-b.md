# Test Design Matrix: 価格改定支援 実装 B（UI-14 一括価格改定画面 + `ProductSearchQuery` 取引先 filter 拡張）

Plan Packet: `docs/plans/2026-08-23-price-revision-impl-b.md`。予約元: `docs/archive/plans/test-matrices/2026-08-22-price-revision-design.md`「実装 PR への予約 → 実装 B」（`usePriceRevisionList.test.tsx` / `PriceRevisionPage.test.tsx` / `navigation.test.ts` の予約名を引き継ぎ、`priceRevisionSearch.test.ts` / `price-revision-math.test.ts` / Rust 4 件 / D-052 C20 を本 Matrix で追加する）。実装 A packet から defer された整数除算 overflow 境界は本 Matrix の `price-revision-math.test.ts` 境界行で消化する。

## Risk

Risk: R3

## Contracts Under Test

- SPEC-PRVB-D1: `ProductSearchQuery.supplier_id` / `include_unassigned` の WHERE（`Some + true` = `supplier_id = X OR IS NULL`、`Some + false` = `supplier_id = X`、`None` = 条件なし）、COUNT / SELECT 同一、他条件と AND、wire は optional（20-io / 40-cmd 改訂）。
- SPEC-PRV-D3 / SPEC-PRVB-D5: 取引先指定時「取引先未設定の商品も含める」既定 on / off 可、在庫ゼロ含む、URL 8 param の正規化（無効値 → 既定、supplier 指定で includeUnassigned 既定 true、sort 無効 → product_code 昇順、filter 変更で page 1、perPage 50 / 100 / 200）。
- SPEC-PRV-D4 / SPEC-PRVB-D3: 新原価案 `floor(新売価 × 現原価 ÷ 現売価)`、現売価 0 は現原価 fallback + 掛率 `—`、掛率小数 1 桁四捨五入、新売価は空から、pure module 隔離、10^7 直下の exact 計算。
- SPEC-PRV-D5 / SPEC-PRVB-D4: 行単位確定（1 行 1 request）、行状態 idle / editing / pending / error、成功後の再取得と入力消去、失敗行の入力保持、新原価案の手編集保持、負値 / 非整数で CMD 未呼出し。
- SPEC-PRV-D6 / SPEC-PRVB-D7: 「未設定の商品にこの取引先を設定する」（取引先選択中のみ、既定 on、supplier 変更で on へ戻る）→ `assign_supplier_id`、「新しい取引先を追加」の trim / 空白 reject / 再取得 / 選択状態 / 失敗時保持。
- SPEC-PRV-D7 / SPEC-PRVB-D2: 行別 `listPriceHistory(code, 1)` と本日判定（`changed_at` 先頭 10 文字 = ローカル `YYYY-MM-DD`）、badge `最近改定` icon + text、再読込で入力が消える常時文言。
- SPEC-PRVB-D6: D-052 C20 `productPriceRevise(productCode)` = `productList.root / productForm.product(code) / pluDirty / priceRevision.root`、oracle 独立転記、件数 20。
- SPEC-PRVB-D8 / D9: perPage 200 × 2 page での 400 行級（L3）、Empty（filter 有無）/ 一覧 error 導線。
- 到達導線（REQ-105）: `navigation.ts` の `ui-14` active entry + route file。
- 登録・生成: bindings.ts、90-traceability、routeTree.gen.ts（gitignore）、C20 docs。

## Failure Modes

- `OR p.supplier_id IS NULL` が欠け未設定商品が既定で漏れる / flag false でも NULL 行が混ざる / `None` でも条件が付いて全件が出ない / COUNT と SELECT で条件が食い違い total_count がずれる。
- bindings の新 field が required で生成され UI-01a の `buildProductSearchQuery` が型エラー（または Writer が既存 test を改変して通す）。
- 新原価案が浮動小数で 1 円ずれる / 現売価 0 で NaN・Infinity・例外 / 掛率が `toFixed` の 2 進丸めで x.x5 を切り捨てる / 10^7 直下で桁落ち。
- 確定が他行の入力も送る / 成功後に旧価格が残る（invalidate 漏れ）/ 失敗で入力が消える / pending 中に二重送信 / 新売価変更で手編集した新原価案が消える。
- `assign_supplier_id` が toggle off でも送られる / 取引先未選択で null 以外 / 取引先変更後に toggle が off のまま。
- 本日判定が `Date` parse で TZ ずれ / 昨日の行に badge / 履歴取得失敗で一覧が消える。
- URL: `includeUnassigned` が supplier 未指定でも残る / 無効 sort で例外 / filter 変更で page が残り 0 件表示。
- C20 の key 集合が SPEC-PRVB-D6 と不一致（E3 除外 key を含む、`pluDirty` 欠落）/ oracle 未転記 / meta 件数未更新 / decision-log 未追記。
- navigation entry が pending のまま / 位置が表順と異なる / route file が無く 404 / `routeTree.gen.ts` を commit してしまう。
- 77-ui §77.9 の「後続実装 PR B」bullet が残り docs が実装状態と食い違う / 90-traceability 未再生成で T1 drift。

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- 既存 test（無改変で PASS を要求、rg で実在確認済み 2026-08-23）: `test_search_products_req103_department_filter` / `test_search_products_req103_all_filter_combinations` / `test_search_products_req103_combined_filters_with_pagination` / `test_search_products_req907_filters_plu_migration_states` / `test_search_products_req105_keyword_matches_maker_code`（product_repo.rs）、`test_navigation_all_items_no_pending_status` / `test_navigation_req101_ui01b_active_at_products_new`（navigation.test.ts）、`src/features/products/search.test.ts` / `hooks/useProductList.test.tsx` / `ProductListPage.test.tsx`（file 単位）、`invalidation-contract.meta.test.ts` の `REQ-907 B-I1`（件数 literal のみ 19 → 20 に更新、他 assertion 不変）、`unsaved-changes-guard-sweep.test.ts` の `T16` / `T17`（gated amendment 1: `EXCLUDED_PAGES` に `PriceRevisionPage` 1 entry 追加のみ、assertion 不変）、Rust 既存 test の `ProductSearchQuery` struct literal（`supplier_id: None, include_unassigned: false` の機械的追従のみ、assertion 不変）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-PRVB-D1 `Some + false` | NULL / 他取引先が混ざる | unit (product_repo) | `test_search_products_req105_supplier_filter_matches_only_selected_supplier` | fixture（supplier A 2 件 / supplier B 1 件 / NULL 2 件）で `supplier_id = Some(A), include_unassigned = false` の items が A の 2 件以外を含む、または `total_count != 2` |
| SPEC-PRVB-D1 `Some + true` | NULL が漏れる / 他取引先が混ざる | unit | `test_search_products_req105_supplier_filter_includes_unassigned_when_flag_set` | 同 fixture で `Some(A), true` の items が A 2 件 + NULL 2 件の 4 件と一致しない（B が混ざる、NULL が欠ける）、または `total_count != 4` |
| SPEC-PRVB-D1 `None` | flag だけで条件が付く | unit | `test_search_products_req105_no_supplier_filter_when_unspecified` | `supplier_id = None, include_unassigned = true` で全 5 件 / `total_count = 5` にならない（`None` で `IS NULL` 条件が付くと NULL 2 件だけになる） |
| SPEC-PRVB-D1 AND 結合 | supplier 条件が他条件を上書き | unit | `test_search_products_req105_supplier_filter_combines_with_other_conditions` | `Some(A), true` + `department_id = Some(d1)`（A の 1 件と NULL の 1 件だけが d1）で結果が 2 件 / `total_count = 2` にならない（OR が括弧なしで department 条件を飲み込むと 4 件以上になる） |
| SPEC-PRVB-D1 wire | required 生成 / 既存呼出し元退行 | CLI + 既存 test | `cd src-tauri && cargo run --bin generate_bindings && git diff --stat src/lib/bindings.ts` 空 + `rg -n "include_unassigned" src/lib/bindings.ts` ≥ 1 + `npm run typecheck` + `search.test.ts` / `useProductList.test.tsx` 無改変 PASS | bindings stale、新 field 欠落、または UI-01a 側の型エラー / test 改変 |
| 20-io / 40-cmd 改訂 | docs 未転記 | CLI | `rg -c "include_unassigned" docs/function-design/20-io-product-repo.md docs/function-design/40-cmd-product.md` 各 ≥ 1、`rg -c "後続実装 PR B" docs/function-design/77-ui-bulk-price-revision.md` = 0 | amendment の転記漏れ、または 77-ui §77.9 の旧 bullet 残存 |
| SPEC-PRV-D3 / SPEC-PRVB-D5 | 取引先指定で flag が送られない | unit (usePriceRevisionList.test.tsx) | `取引先指定時は supplier_id と include_unassigned=true を searchProducts に渡す` | `searchProducts` の引数が `supplier_id: 7, include_unassigned: true` でない（mock 引数を `toHaveBeenCalledWith(expect.objectContaining(...))` で検証） |
| SPEC-PRVB-D5 | off が伝わらない / 未指定で条件が付く | unit | `includeUnassigned=false のとき include_unassigned=false を渡す` / `取引先未指定なら supplier_id null と include_unassigned false を渡し URL の includeUnassigned は無視する` | 引数が `include_unassigned: false` でない / `supplier` 未指定 + URL `includeUnassigned=true` で `supplier_id` が null 以外または flag true |
| SPEC-PRV-D3 在庫ゼロ | 在庫条件の混入 | unit | `在庫数 0 の商品も一覧に含まれ query に在庫条件を載せない` | mock 返却の `stock_quantity: 0` 行が rows から消える、または query に stock 系 key が含まれる（`Object.keys` の完全一致で検証） |
| SPEC-PRVB-D2 | 履歴呼出しなし / 結び付け誤り | unit | `page 内の各行について listPriceHistory(code, 1) を呼び changed_at を行に結び付ける` | 3 行 mock で `listPriceHistory` が各 `(code, 1)` で呼ばれない、または行の `latestChangedAt` が mock と独立転記した code → changed_at 対応と一致しない（取り違え） |
| SPEC-PRVB-D5 正規化 | 無効値で例外 / 既定ずれ | unit (priceRevisionSearch.test.ts) | `無効な search 値は既定へ回復する` | `perPage=999` / `page=0` / `dept="x"` / `discontinued="maybe"` が既定（50 / 1 / undefined / false）にならない |
| SPEC-PRVB-D5 includeUnassigned | 既定 true にならない / 未指定で残る | unit | `supplier 指定時は includeUnassigned 欠落を true にし未指定時は落とす` | `{supplier: 7}` の normalize が `includeUnassigned: true` でない、`{includeUnassigned: false}`（supplier なし）が URL に残る |
| SPEC-PRVB-D5 sort | 無効 sort で例外 / 既定以外 | unit | `sort は無効値と欠落で product_code 昇順になる` | `sort="bogus"` / 欠落で `sort_key` が `ProductCode` + `Asc` 以外 |
| SPEC-PRVB-D5 page reset | filter 変更で page 残存 | unit | `filter patch は page を 1 に戻す` | `updatePriceRevisionSearch({q: "x"})` 後の `page` が 1 でない、`{page: 3}` patch だけは 3 |
| SPEC-PRVB-D3 floor | 丸め誤り | unit (price-revision-math.test.ts) | `deriveProposedCost は整数除算で切り捨てる` | (1200, 700, 1000) → 840 / (1250, 333, 1000) → 416 / (999, 700, 1000) → 699 のいずれかが不一致（`Math.round` なら 416.25 → 416 は同じだが 699.3 → 699 も同じ、(1001, 999, 1000) → 999.999 → 999 を加えて round（1000）と区別する） |
| SPEC-PRVB-D3 fallback | 現売価 0 で例外 / NaN | unit | `deriveProposedCost は現売価 0 で現原価を返す` | (1200, 700, 0) → 700 でない（`Infinity` / `NaN` / throw） |
| 境界（実装 A defer） | 桁落ち | unit | `deriveProposedCost は 10^7 直下の値でも exact に計算する` | (9_999_999, 9_999_999, 1) → 99_999_980_000_001 の `toBe` が落ちる（oracle は literal 独立転記） |
| SPEC-PRVB-D3 掛率 | 丸め / 桁 | unit | `formatMarkupRate は小数 1 桁に四捨五入する` | (700, 1000) → "70.0" / (333, 1000) → "33.3" / (1, 16) → "6.3" / (2, 3) → "66.7"  / (23, 80) → "28.8" のいずれか不一致（`toFixed(1)` 直接実装は 2 進丸めで (23, 80) = 28.75 を "28.7" にする。(1, 16) = 6.25 は両実装で "6.3" になり判別しない） |
| SPEC-PRVB-D3 掛率 0 | `—` でない | unit | `formatMarkupRate は現売価 0 で — を返す` | (700, 0) が "—" 以外 |
| SPEC-PRVB-D2 本日判定 | TZ / 境界 | unit | `isRevisedToday は changed_at の日付部分と today の一致で判定する` | ("2026-08-23T09:15:00", "2026-08-23") → true / ("2026-08-22T23:59:59", "2026-08-23") → false / (undefined, "2026-08-23") → false のいずれか不一致 |
| SPEC-PRV-D3 toggle | 既定 off / off 不可 | RTL (PriceRevisionPage.test.tsx) | `取引先を選ぶと「取引先未設定の商品も含める」が既定 on で表示され off にすると include_unassigned=false で再検索する` | 取引先選択後に checkbox（`getByRole("checkbox", {name: "取引先未設定の商品も含める"})`）が未表示 / unchecked、または off 後の `searchProducts` 引数が `include_unassigned: false` でない |
| SPEC-PRV-D6 toggle | 常時表示 / 既定 off / 取引先変更で保持 | RTL | `「未設定の商品にこの取引先を設定する」は取引先選択中だけ表示され既定 on で supplier 変更時に on へ戻る` | 取引先未選択で表示される、選択直後に unchecked、off → 別取引先選択後も off のまま |
| SPEC-PRV-D4 導出 | 初期化なし / 0 行の例外 / 新売価に初期値 | RTL | `新売価入力で新原価（案）が導出され現売価 0 の行は掛率「—」と現原価 fallback になり新売価は空から始まる` | 新売価 1200 入力後に新原価案 input の value が "840"（現売価 1000 / 現原価 700）でない、現売価 0 行の掛率セルが "—" でなく新原価案が現原価と異なる、新売価 input の初期 value が "" でない |
| SPEC-PRVB-D4 手編集 | 上書き / 追従せず | RTL | `新原価（案）を手で編集した後は新売価変更で上書きせず未編集なら追従する` | 新売価 1200 → 1300 で新原価案が 840 → 910 に追従しない、または新原価案を 800 に手編集後の新売価変更で 800 以外になる |
| SPEC-PRV-D5 / SPEC-PRVB-D4 | 複数行送信 / assign 誤り | RTL | `確定は該当行 1 商品だけを reviseProductPrice に送り assign_supplier_id は取引先選択 + toggle on のとき supplier_id、それ以外 null` | `reviseProductPrice` が 2 回以上呼ばれる、引数の `product_code` が確定行以外、toggle on + 取引先 7 で `assign_supplier_id !== 7`、toggle off または取引先未選択で `null` でない |
| SPEC-PRVB-D4 / D6 | invalidate 漏れ / 旧価格残存 / 入力残存 | RTL | `確定成功後に D-052-C20 の独立 oracle 集合を invalidate し再取得した新価格を表示して行入力を消す` | `invalidateQueries` spy の key 集合が test 側 oracle（`["product-list"]` / `["product-form","product",{productCode}]` / `["plu-dirty"]` / `["price-revision"]` を literal 転記）と順序非依存・重複なしで完全一致しない、再取得 mock の新売価が行に出ない、行の新売価 input が "" に戻らない |
| SPEC-PRV-D5 失敗 | 入力消失 / 他行消失 | RTL | `確定失敗時は該当行だけ「確定できませんでした」と再試行を出し入力を保持し他行は変わらない` | reject 後に該当行の新売価 value が消える、「確定できませんでした」/「再試行」が無い、他行の入力 value や表示が変わる、再試行で `reviseProductPrice` が再呼出しされない |
| SPEC-PRVB-D4 pending | 二重送信 / 他行 disabled | RTL | `確定の送信中は同じ行の入力と確定が無効化され他行は操作できる` | 未解決 promise 中に同行の input / button が disabled でない、他行の input が disabled |
| SPEC-PRVB-D4 validation | 負値 / 非整数で CMD | RTL | `新売価が負値または非整数なら field error を出し reviseProductPrice を呼ばない` | `-1` / `12.5` 入力で確定が有効または `reviseProductPrice` が呼ばれる、field error 文言なし |
| SPEC-PRV-D7 badge | 昨日にも出る / 色のみ | RTL | `本日の changed_at を持つ行だけ「最近改定」badge を icon + text で表示する` | `vi.setSystemTime(2026-08-23T10:00 local)` で changed_at `2026-08-23T09:15:00` の行に text「最近改定」が無い、`2026-08-22T23:59:59` の行に出る、履歴 0 件 / reject の行に出る、icon（`aria-hidden` svg）が無い |
| SPEC-PRV-D7 文言 | 常時文言欠落 | RTL | `再読み込みで確定前の入力が失われる旨の文言を常時表示する` | 「画面を再読み込みすると、確定前に入力した新売価・新原価は失われます。1行ずつ確定してください。」の exact text が無い（0 件 / error 時も） |
| SPEC-PRV-D6 / SPEC-PRVB-D7 | 再取得なし / 選択されない | RTL | `新しい取引先を追加すると createSupplier 後に listSuppliers を再取得し追加した取引先が filter で選択状態になる` | `createSupplier` 引数が trim 後の値でない、解決後に `listSuppliers` が再呼出しされない、filter select の value が返却 id でない、`includeUnassigned` が true にならない |
| SPEC-PRV-D6 空白 / 失敗 | CMD 呼出し / 入力消失 | RTL | `取引先名が空白のみなら createSupplier を呼ばず field error を出し失敗時は入力を保持する` | 空白で `createSupplier` が呼ばれる、reject 後に dialog が閉じる / 入力が消える / Alert + 再試行が無い |
| SPEC-PRVB-D9 | 導線欠落 | RTL | `filter なしの 0 件は商品一覧への導線、filter ありの 0 件は「条件に一致する商品がありません」と「絞り込みを解除」を出す` | filter なし 0 件で「該当する商品がありません」の text または `/products` link が無い、filter あり 0 件で文言 / button が無い、「絞り込みを解除」で全 param が既定に戻らない |
| SPEC-PRVB-D9 error | Alert なし | RTL | `一覧取得失敗で Alert と再試行を出し再試行で再取得する` | reject で `role="alert"` + 「再試行」が無い、押下で `searchProducts` が再呼出しされない |
| REQ-105 到達 | pending / 経路違い | unit (navigation.test.ts) | `test_navigation_req105_ui14_active_at_products_price_revision` | `ui-14` entry が無い、`status !== "active"`、`to !== "/products/price-revision"` |
| D-052 C20 登録 | 件数 / oracle 不一致 | unit + CLI | `invalidation-contract.meta.test.ts`（`toHaveLength(20)`、oracle に C20 転記）PASS + `invalidation-contract.static.test.ts` PASS + `rg -c "C20" docs/decision-log.md docs/UI_TECH_STACK.md` 各 ≥ 1 | entry 数 19 のまま、oracle 欠落、success handler が `invalidateByContract` 以外、docs 未追記 |
| gated amendment 1 (i) UI-USW-D3 (c) 分類 | 未分類で T17 FAIL / 誤って APPLIED に配線 | unit 既存 (unsaved-changes-guard-sweep.test.ts) + CLI | 既存 `T17: 適用6画面の配線と全Page分類を明示manifestへ完全一致させる` PASS + `rg -c "PriceRevisionPage" src/hooks/unsaved-changes-guard-sweep.test.ts` = 1 + `rg -c "UI-USW-D3" docs/function-design/77-ui-bulk-price-revision.md` ≥ 1 | `PriceRevisionPage` が manifest に無い、`APPLIED_PAGES` 側にある、または 77-ui §77.6 に非適用の 1 文が無い |
| gated amendment 1 (ii) 共有 ListSkeleton | 描画なし / 行数無視 | unit (ListSkeleton.test.tsx) | `ListSkeleton は指定行数の skeleton 行を描画し読み込み中を示す` | `rows={3}` で skeleton 行が 3 つ描画されない、または読み込み中を示す role / aria 属性が無い |
| 登録: bindings / traceability / routes | 生成漏れ | CLI | AC の `generate_bindings` diff 空 + `cd src-tauri && cargo run --bin generate_traceability -- --check` exit 0 + `npm run generate:routes && npm run typecheck` PASS + `git ls-files src/routeTree.gen.ts` 空 | 生成物 stale、traceability drift、route 未生成、生成物を commit |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| UI-14 一覧（search） | URL search → `searchProducts` | ListSkeleton（列構造維持） | 行表示 + page | 確定成功 → C20（`priceRevision.root` 配下） | 同 search key を再取得 | F5 / 再訪で URL から同条件再現 | アプリ再起動で同じ | Alert + 再試行 | 再試行で `refetch` | hook test / RTL Empty・Error |
| UI-14 行（価格改定） | 現売価 = DB 値、入力空、idle | editing（新売価 / 新原価案入力）→ pending（送信中、同行 disabled） | `reviseProductPrice` 成功 → 入力消去 → 再取得で新価格 + badge | C20 | search + 同行 `listPriceHistory(code, 1)` | 再訪で確定済み行は新価格、確定前の入力は破棄（常時文言） | 同左 | 行内 error + 再試行、入力保持、他行不変 | 同行再確定 | RTL 確定 / 失敗 / pending |
| UI-14 行 badge（履歴） | page 内各行 `listPriceHistory(code, 1)` | badge 非表示 | 本日なら badge | C20（`priceRevision.root` 配下） | 同 code の history key | 再訪で再取得 | 同左 | badge 非表示（一覧は隠さない） | 一覧再試行に同乗 | hook test / RTL badge |
| 取引先候補 / 追加 | `listSuppliers` | dialog 入力 + 送信中 disabled | `createSupplier` → suppliers `refetch()` → URL `supplier` set | — | `refetch()` | 再訪で通常 select | — | dialog 保持 + Alert + 再試行 / 候補取得失敗は inline error | 再送信 | RTL 取引先追加 |
| products / price_history / operation_logs | 現値 | TX（実装 A） | 3 テーブル commit | — | — | — | — | rollback（実装 A） | 行再確定（同値なら no-op） | 実装 A Rust test（無改変） |
| Workflow State（packet） | plan-draft | plan-gate | plan-approved → implementing | content candidate → L1 | independent-review | human-confirm（Reviewed Content HEAD） | Ready state-only → exact-HEAD L1 → PR body | state-only violation → implementing へ戻す | state-backtrack | `check-workflow-git.sh` |

Workflow-state rows:

- content candidate -> L1 / independent review -> state-only human-confirm commit: Writer の content commit 後に L1 full、独立 Sonnet Final Review、P1/P2 = 0 で human-confirm 遷移 commit 内に `Reviewed Content HEAD` を設定。
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit: L3 PASS + Ready 承認 → state-only `human-confirm->ready-hosted-final` → exact-HEAD L1 → PR body → Ready（CI-TRIGGER-D1 自動 run）→ 三点一致 → merge。
- state-only violation: file allowlist と `git diff --unified=0` hunk の両方で検査。Scope / AC / Ledger / test / bindings に触れた state-only commit は implementing へ戻す。
- hosted-not-required incidental failure: 該当なし（Hosted CI Requirement = required）。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| 検索 WHERE 条件の追加（`department_id` / `plu`） | `product_repo::search_products`（conditions vec + params、COUNT / SELECT 共有） | supplier 条件を同じ conditions に追加 | `find_products_for_bulk_plu_target` / `ProductBulkFilter` は UI-01a に取引先 filter が無く母集団を変えないため除外 | Rust 4 test + 既存 `_req103_*` 無改変 |
| `#[serde(default)]` optional field | `ProductSearchQuery.plu`（bindings.ts `plu?:`） | `supplier_id` / `include_unassigned` | bool の先例なし → Contract Probe 1 | bindings diff + typecheck |
| URL search schema / normalize / buildQuery | `src/features/products/search.ts`（zod `.catch`、`normalizeEnum`、`PRODUCT_PER_PAGE_OPTIONS`） | `priceRevisionSearch.ts`（定数 import、UI-14 専用 schema） | `productListSearchSchema` 自体は拡張しない（UI-01a URL に漏れる） | `priceRevisionSearch.test.ts` |
| useQuery + queryKeys namespace | `useProductList`（`queryKeys.productList.search(normalized)`） | `usePriceRevisionList`（`queryKeys.priceRevision.*`） | `productList.*` key は UI-01a 所有のため流用しない（C20 が `productList.root` を invalidate する側） | hook test |
| mutation 成功時 invalidation（D-052） | `ProductFormPage`（`invalidateByContract(..., productUpdate(code))`）、`ProductListPage`（`pluBulkTarget`） | `useReviseProductPrice` → C20 | C2 集合の `lowStock` / `stockInquiryRoot` / `stockMovements.root` は価格列が E3、取引先（`supplier_id`）は consumer が supplier を読まないため非該当（別理由、SPEC-PRVB-D6）、`pluSlotSummary` は plu_dirty 非依存（Probe 2）で除外 | RTL C20 oracle + meta 20 + static test |
| 取引先 inline 追加（実装 A UI-01b-D21） | `ProductForm`（`createSupplier` → `listSuppliers` 再取得 → select） | `CreateSupplierDialog` + suppliers `refetch()` → URL `supplier` | `ProductForm` の実装は流用せず別 component（form 文脈と filter 文脈で選択先が異なる） | RTL 取引先追加 |
| 本日 / 日付文字列比較 | `useYesterdayDate.ts` / `date-nav.ts`（`toLocaleDateString("sv-SE")`） | `isRevisedToday` + Page の today 取得 | `Date` parse した比較は TZ ずれのため採らない | unit + RTL（`vi.setSystemTime`） |
| 行内 error + 再試行（操作者 UI） | `PriceHistorySection`（inline error + 再試行）、UI-01b 取引先取得失敗 | 行確定 error / 取引先候補 error | — | RTL |
| EmptyState 文言（操作者 UI） | `ProductListPage`（`EmptyState` title「該当する商品がありません」）、`src/components/patterns/EmptyState.tsx` | UI-14 filter なし 0 件は同 title + 商品一覧 link（SPEC-PRVB-D9）、filter あり 0 件は 77-ui §77.7 の「条件に一致する商品がありません」+「絞り込みを解除」 | 77-ui が文言を規定する filter あり側は先例と揃えない（正本優先） | RTL Empty |
| 未保存編集の離脱ガード分類（UI-USW-D3） | `unsaved-changes-guard-sweep.test.ts` の `APPLIED_PAGES`（form 6 画面）/ `EXCLUDED_PAGES`（`StocktakePage` = (c) 行単位即時保存） | `PriceRevisionPage` を `EXCLUDED_PAGES` へ（(c) 同型、77-ui §77.6 常時文言が代替）（gated amendment 1） | `APPLIED_PAGES` 側の `useUnsavedChangesWarning` 配線は 77-ui 契約外のため採らない | 既存 T17 PASS + 77-ui 1 文 |
| 一覧 Loading 表示 | `StockInquiryPage`（`ui/skeleton.tsx` を直接 3 行並べる）、04-backbone 原則 11「共通 `ListSkeleton`」 | 共有 `patterns/ListSkeleton.tsx` 新設 + UI-14 で使用（gated amendment 1） | 既存画面の `Skeleton` 直書きを `ListSkeleton` へ置換するのは UI batch の backlog で本 PR では触らない | `ListSkeleton.test.tsx` + 02-component-catalog 1 行 |
| navigation active entry + 到達テスト | `ui-01b-new`（`test_navigation_req101_ui01b_active_at_products_new`） | `ui-14` + `test_navigation_req105_ui14_active_at_products_price_revision` | — | navigation.test.ts |
| IME 合成中 Enter の無視 | `SearchBar`（UI-01a-D9）、実装 A 取引先 inline | `CreateSupplierDialog`（Enter で追加する場合は composition 中を無視） | Enter 送信を持たない実装なら該当なし（Writer 判断、報告に明記） | L3 item 2 |

## Negative Paths

- missing input: 新売価空 → 確定 disabled、CMD なし。取引先名空白 → field error、CMD なし。
- invalid input: 新売価負値 / 非整数 → field error、CMD なし。URL 無効値 → 既定へ回復。
- duplicate/ambiguous input: 同名取引先 → 実装 A の既存行返却（UI-14 は返却 id を選択）。同じ行の連打 → pending 中 disabled で二重送信なし。
- unknown reference: 削除済み取引先が URL `supplier` にある → 候補に無い値は select 未選択扱いで query には送る（0 件 → 「絞り込みを解除」導線）。確定時の不存在 supplier は CMD `NotFound` → 行内 error。
- dependency missing: `listSuppliers` / `listDepartments` 失敗 → filter 枠 inline error + 再試行、一覧は表示。`listPriceHistory` 失敗 → badge 非表示のみ。
- permission/write failure: `reviseProductPrice` reject → 行内 error + 入力保持（DB 側 rollback は実装 A）。
- dry-run side effect: 該当なし。

## Boundary Checks

- threshold: perPage 50 / 100 / 200（UI）、IO clamp `PAGINATION_MAX_PER_PAGE = 200`（D-031、既存 test `test_search_products_req103_per_page_clamps_to_max`）。400 行級は 2 page（SPEC-PRVB-D8、L3）。
- null/default: `supplier_id = None` → 条件なし（flag 無視）。`supplier_id` NULL の商品は `Some + true` で含み `Some + false` で除外。`includeUnassigned` 欠落 + supplier 指定 → true。`assign_supplier_id` は toggle off / 取引先未選択で null。
- empty/non-empty: 0 件 → filter 有無で導線を分ける（SPEC-PRVB-D9）。履歴 0 件 → badge なし。
- min/max: 円は 0 以上（0 は許容、負値 reject）。新原価案は `selling = 0` で cost fallback。掛率は `selling = 0` で `—`。
- status/policy enum: 行状態 idle / editing / pending / error は UI local（persist しない）。新 `CmdErrorKind` なし。
- wire type: `ProductSearchQuery` + `supplier_id?: number | null` / `include_unassigned?: boolean`（optional 表記は Probe 1 で確定）。`PriceRevisionInput` / `PriceRevisionResult` は実装 A どおり。
- internal type: Rust `Option<i64>` / `bool`。TS `number`（整数、UI validation）。
- producer/consumer: product_cmd → bindings.ts → UI-14（本 PR）/ UI-01a（既存、新 field 省略）。
- round-trip token: URL 8 param（`q` / `supplier` / `includeUnassigned` / `dept` / `discontinued` / `sort` / `page` / `perPage`）の normalize → query → URL 更新。行入力は URL に載せない。
- precision/range: 上限契約は source docs に無く 10^7 円未満は `未実測` 前提（実装 A と同じ）。`newSelling × cost < 10^14 < 2^53` で exact。境界 test は (9_999_999, 9_999_999, 1) → 99_999_980_000_001。掛率は `Math.round(cost × 1000 / selling) / 10` → `toFixed(1)`。
- cross-language parse: `changed_at` は `%Y-%m-%dT%H:%M:%S`（Local）の先頭 10 文字を文字列比較。`Date` parse しない。

## Compatibility Checks

- old schema/input: schema 変更なし。`search_products` の既存入力（新 field 省略）は従来どおり全件 / 他条件のみ。既存 Rust test 無改変 PASS。
- new schema/input: `ProductSearchQuery` に optional 2 field（bindings 追加のみ）。
- output order: `search_products` の ORDER BY 不変。UI-14 既定は `product_code` 昇順（URL `sort` 受理、UI なし）。
- optional field behavior: UI-01a は新 field を送らない（`#[serde(default)]` で None / false）。Probe 1 で required 生成なら `buildProductSearchQuery` に `include_unassigned: false` を明示（既存 test 無改変）。

## Data Safety Checks

- source-derived data: 実店舗の商品 / 取引先 / 価格を fixture に使わない。
- generated outputs: `bindings.ts` / `90-traceability.md` は generator 出力をそのまま commit。`routeTree.gen.ts` は commit しない。
- secrets: 該当なし。
- local-only files: owner の local DB、L3 用 synthetic 商品 CSV（repo 外 / `$TMPDIR`）。
- synthetic sample boundaries: Rust test は in-memory / temp DB、RTL は mock `commands`、L3 fixture は synthetic 400 行級。

## Main Wiring / Integration Checks

- helper connected to main path: `price-revision-math.ts` の 3 関数が `PriceRevisionTable` から呼ばれる（component 内に算式なし、Final Review の目視 + mutation 注入で `deriveProposedCost` の floor を round に変えると RTL 導出 test も落ちる）。`useReviseProductPrice` が `invalidateByContract(..., productPriceRevise(code))` を呼ぶ（static test + RTL oracle）。
- output reaches manifest/report: `bindings.ts` の `ProductSearchQuery` に 2 field、`navigation.ts` に `ui-14`、`routeTree.gen.ts`（生成）に `/products/price-revision`、`90-traceability.md` に UI-14 / REQ-105 / REQ-106 の test 参照。
- effective config reaches runtime: `PRODUCT_PER_PAGE_OPTIONS` が UI-14 の perPage select と normalize の両方で同じ定数（import）。
- CLI arg reaches implementation: `generate_traceability` が `src/**/*.test.{ts,tsx}` の `REQ-105` / `REQ-106` / `UI-14` 参照を拾う（--check exit 0）。

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant?: `price-revision-math.test.ts` は入力と期待値を literal で独立転記し production 関数を oracle に使わない。RTL の導出 test は mock 商品の現売価 1000 / 現原価 700 と新売価 1200 から期待 "840" を test 内 literal で持つ。C20 oracle は test 側 literal key で `invalidationContract` を import しない（D-052-S1）。badge test の changed_at と today は literal。
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct?: 確定成功 RTL は `reviseProductPrice` 解決 → `invalidateQueries`（C20 集合）→ 2 回目 `searchProducts` の mock が新価格 → 行表示が新価格、の順を `mock.calls` と `findByText` で検証する。取引先追加 RTL は `createSupplier` 解決後に `listSuppliers` 再呼出し → select value。
- If a key branch is inverted, which test fails?: `include_unassigned` の true / false 分岐反転 → `_matches_only_selected_supplier` と `_includes_unassigned_when_flag_set` の両方。`None` で条件付与 → `_no_supplier_filter_when_unspecified`。toggle on/off の `assign_supplier_id` 反転 → RTL 確定 test。`costTouched` 反転 → RTL 手編集 test。filter 有無の Empty 分岐反転 → RTL Empty test。
- If a threshold comparison changes, which test fails?: `selling === 0` guard を `<= 0` / `< 0` に変える → 0 fallback test（0 は fallback、負値は UI で到達しない）。新売価 validation の `>= 0` を `> 0` に変える → RTL validation test に 0 円許容 case を含めて検出する。
- If a guard is removed, which test fails?: `OR p.supplier_id IS NULL` 除去 → `_includes_unassigned_when_flag_set`。負値 guard 除去 → RTL validation。空白 guard 除去 → RTL 取引先空白。pending disabled 除去 → RTL pending。
- If an output field is omitted, which test fails?: query の `include_unassigned` 省略 → hook test の `toHaveBeenCalledWith(objectContaining)`。`assign_supplier_id` 省略 → RTL 確定 test。C20 の `pluDirty` 省略 → RTL oracle 完全一致 + meta oracle。
- If tracked Workflow State stores the current PR HEAD, does a state commit make it stale immediately?: `Reviewed Content HEAD` は human-confirm 遷移 commit 内でのみ設定し、exact-HEAD evidence は PR body に置く。
- If a hosted URL/headSha is committed after the run, does the merge three-point check fail because PR HEAD changed?: hosted URL / headSha は packet に commit しない。Ready 後の tracked commit を作らない。
- If a state-only commit edits Scope/AC in the same packet file, does hunk-level review reject it even though the filename is allowlisted?: `git diff --unified=0` で hunk を検査し、Workflow State と遷移記録以外の hunk があれば implementing へ戻す。
- If output order changes, which test fails?: UI-14 既定 sort を `Name` に変える → `priceRevisionSearch.test.ts` の sort 既定 test。`search_products` の ORDER BY は不変（既存 test）。
- If dry-run performs a side effect, which test fails?: 該当なし。
- If a JSON number crosses JavaScript safe integer range, which test fails?: 上限契約が無いため到達を防ぐ test は置けない（`未実測` 前提）。10^7 直下の exact 計算は `deriveProposedCost は 10^7 直下の値でも exact に計算する` で検証（実装 A からの defer 消化）。
- If a state token is round-tripped through browser/client code, which test fails?: URL 8 param の normalize / patch → `priceRevisionSearch.test.ts`。`includeUnassigned` の落とし漏れ → `supplier 指定時は includeUnassigned 欠落を true にし未指定時は落とす`。
- 追加（SPEC-PRVB-D1）: `(p.supplier_id = ? OR p.supplier_id IS NULL)` の括弧を外す → `_combines_with_other_conditions`（department 条件が OR に飲まれて件数が増える）。COUNT 側だけ条件を落とす → 4 test の `total_count` assertion。
- 追加（SPEC-PRVB-D3）: `Math.floor` → `Math.round` → `deriveProposedCost は整数除算で切り捨てる`（(1001, 999, 1000) → 999 が 1000 になる）。`Math.round(x*1000)/10` → `toFixed(1)` 直接 → 掛率 test の (23, 80) → "28.8"（"28.7" になる。Coordinator が node で実測、2026-08-23）。`slice(0, 10)` → `Date` parse → 本日判定 test は同値になり得るため `isRevisedToday` の文字列 API を Final Review の目視で確認（TZ 依存 mutant は RTL で判別不能、Residual に記録）。
- 追加（SPEC-PRVB-D4）: 確定 handler が全 editing 行を送る → RTL 確定 test（`toHaveBeenCalledTimes(1)`）。成功後の入力消去を削除 → RTL 成功 test。
- 追加（SPEC-PRVB-D6）: C20 から `pluDirty` を落とす / `lowStock` を足す → RTL oracle 完全一致 + meta oracle 完全一致。
- 追加（SPEC-PRV-D7）: badge 条件を「履歴があれば常に」に変える → RTL badge test（昨日の行）。
- Final Reviewer は上記のうち最低 D1 `IS NULL` 除去 / D1 括弧除去 / D3 floor → round / D3 掛率 `toFixed(1)` 直接 / D4 全行送信 / D6 `pluDirty` 除去 / D7 昨日 badge の 7 mutant を clean worktree で実注入し、対応 test が落ちることを独立再現する（feedback: Mutation kill claims need reproduction）。

## Residual Test Gaps

- 行別 `listPriceHistory(code, 1)` × 最大 200 件の体感遅延は自動化不能（`未実測`、L3 item 3 で実測し PR body に記録。許容外なら SPEC-PRVB-D2 却下案を別起票）。
- 400 行級の操作性（絞り込み → 突合 → 入力 → 確定の反復速度）は L3 手動確認に依存（archived design Matrix の Residual どおり）。
- `isRevisedToday` を `Date` parse に置き換える TZ 依存 mutant は RTL / unit では同値になり得るため Final Review の目視（文字列 API 使用）で防御する。
- Windows native の IME 合成中 Enter（取引先追加 dialog）は RTL で判別不能なため L3 item 2 に依存。
- CMD 層の error 正規化は実装 A の既存 `From` 変換で新 test なし。
- 実装 C（cost_diffs）の契約と D-052 C21 以降は本 Matrix の対象外。
