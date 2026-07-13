# Test Design Matrix: D-028 JANなし商品のPLU対象扱い実装

> **親 packet**: [2026-07-03-d028-janless-plu-implementation.md](../2026-07-03-d028-janless-plu-implementation.md)

## Risk

Risk: R3

## Contracts Under Test

- BIZ-04 prepare 三分バケット契約（[33-biz-plu-export-service.md](../../../function-design/33-biz-plu-export-service.md) §16.3、D-028 / UI-08-D8）
- BIZ-04 confirm 契約（§16.4、上限比較撤廃後も重複拒否・存在確認・全体 ROLLBACK 維持）
- migration v3 backfill 契約（[22-mnt-migration.md](../../../function-design/22-mnt-migration.md) §10）
- BIZ-01 plu_target 設定・遷移契約（[30-biz-product-service.md](../../../function-design/30-biz-product-service.md) §4.2 / §4.4 / §4.9）
- IO 抽出クエリ契約（[20-io-product-repo.md](../../../function-design/20-io-product-repo.md) 3 クエリの plu_target 条件）
- CMD wire 契約（[41-cmd-pos.md](../../../function-design/41-cmd-pos.md) `PluExportPrepareResponse.excluded`）
- UI-08 表示・文言契約（[67-ui-plu-export.md](../../../function-design/67-ui-plu-export.md) §67.9 / UI-08-D9）

## Failure Modes

- JAN不備が prepare 全体を失敗させる（旧契約への回帰）
- 対象外（plu_target=0）商品が抽出・通知に混入する
- dedup が非決定的、または非代表メンバーの plu_dirty が confirm 後も残る
- 同一JANで売価不一致の群が書出しに混入する（レジ側価格が不定になる）
- backfill が廃番・非13桁・英字混在 JAN を plu_target=1 にする
- confirm が dedup 群展開の正当な件数を上限で拒否する（false positive）
- 既存テストの削除・skip で契約検証が消える
- UI が excluded を表示しない / 文言が設計と乖離 / 色のみで状態符号化

## 既存テストの書き換え対象（削除・skip 不可、新契約への書き換えのみ許可）

| 既存テスト | 書き換え内容 |
|---|---|
| `test_prepare_plu_export_req402_rejects_products_without_valid_13_digit_jan` | JAN不備で Err ではなく Ok + excluded（理由付き）を検証する形へ改名・書き換え |
| `test_prepare_plu_export_req402_full_mode` / `..._diff_mode` | fixture に plu_target を設定し、対象外商品が結果に含まれないことを追加検証 |
| `test_confirm_plu_export_saved_req402_rejects_invalid_sets_and_rolls_back` | over_limit サブケース（`SCANNING_PLU_EXPORT_LIMIT + 1` 件で ValidationFailed を期待する部分）を削除し、empty / duplicate / missing の 3 サブケースは維持（rally R1 P1-3） |
| `test_migration_req903_is_idempotent` / `test_v2_req903_idempotent_rerun` / `test_v2_req903_applied_on_fresh_db` | `MAX(version) == 2` / `COUNT == 2` の assert を v3 追加後の `3` へ更新（rally R1 P1-2） |
| `insert_test_product_for_plu` テストヘルパー + `test_find_active_products_for_plu_req402_returns_with_department_name` / `test_find_plu_dirty_products_for_plu_req402_returns_dirty_only` / `test_find_plu_dirty_products_req402_returns_dirty_only` | ヘルパーの直書き SQL に plu_target 列を追加（既定 true 相当）。SQL 文字列はコンパイラ検査対象外のため、追加漏れは 0 件返却の実行時失敗として現れる点に注意（rally R1 P1-4） |
| RTL `REQ-402 shows JAN correction guidance when prepare rejects invalid scanning codes` | prepare 失敗前提 → excluded 一覧表示前提へ書き換え |
| RTL `mockDefaultCommands`（PluExportPage.test.tsx）と参照する全ケース | `preparePluExport` 成功レスポンス mock に `excluded: []` を追加（required field 化で typecheck が落ちるため。rally R1 P2-2） |
| RTL ProductFormPage 系テスト + `src/features/products/lib/product-form-request.ts` の単体テスト | `buildCreateProductRequest` / `buildUpdateProductRequest` の期待値に plu_target を追加（rally R1 P1-1） |
| `src/features/products/lib/test-fixtures.ts` の `makeMockProductWithRelations` | デフォルトオブジェクトに `plu_target: false` を追加（bindings 再生成で `ProductWithRelations` が `plu_target: boolean` を要求するため。`ProductFormPage.test.tsx` / `product-form-request.test.ts` / `manual-sale-row-utils.test.ts` が同 factory を使用。rally R2 P2-A） |
| `src/features/stock-inquiry/lib/test-fixtures.ts` の `makeMockProductWithRelations`（**同名 factory が 2 箇所に分散している点に注意**） | デフォルトオブジェクトに `plu_target: false` を追加（`StockInquiryPage.test.tsx` / `derive-stock-state.test.ts` / `filter-low-stock-list.test.ts` が使用。rally R3 P2-1） |
| **【クラス一括】`Product` / `ProductWithRelations` 型のオブジェクトリテラル直書き全箇所** | bindings 再生成で `plu_target: boolean` が required 化し typecheck が全件検出する。`rg -l "pos_stock_sync:" src/ --type ts` による網羅（2026-07-04 実測、生成物 bindings.ts 除く）: `products/lib/test-fixtures.ts` / `products/lib/product-form-request.ts` / `products/lib/product-form-request.test.ts` / `stock-inquiry/lib/test-fixtures.ts` / `stock-movements/StockMovementsPage.test.tsx`（ローカル `makeStockDetail` の `product:` リテラル、factory 非経由。rally R4 P2）/ `products/ProductImportPage.test.tsx` / `products/import/reducer.test.ts`（後者 2 件は Import 系 DTO 構築なら対象外 — 型判定はコンパイラに従う）。**個別の見落としがあっても AC の `npm run typecheck` が確定的に検出する** — エラーが出たリテラルに `plu_target` を追加して閉じる |
| seed 件数系 `seed_populates_100_products` / `seed_is_idempotent` / `seed_uses_deterministic_rng` の件数 assert | 三分バケット用デモ商品の件数を seed 側で定数化（例: `PLU_BUCKET_DEMO_COUNT`）し、`products_inserted` / `products_skipped` / `rows.len()` の `100` 比較を `100 + 定数` へ更新する。`seed_uses_deterministic_rng` の**決定性検証（2 DB 間の値一致）自体は変更しない** — 件数 assert のみ更新（rally R3 P2-2） |
| seed 整合 `seed_products_have_valid_ean13_jan_for_plu_export` | 三分バケット用追加商品（JANなし等）を除外対象として許容する形へ更新 |
| seed 決定性の rng 検証部分 | 2 DB 間の値一致検証ロジックは変更しない（追加商品がハードコード値なら rng カーソルは不変。値不一致で落ちたら実装が rng を消費している兆候。件数 assert の更新は上の行を参照） |

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| migration v3 | backfill パス不通過 | Rust unit | セットアップ方式の指定: v2 適用済み DB へ手動 INSERT してから v3 を適用する `setup_v2_only_db()` ヘルパーを新設（schema_v2.rs の `setup_v1_only_db()` 前例に倣う）。`init_database`（全 migration 適用後）への INSERT では backfill パスを通らない（rally R1 P3-1） | 全 migration 適用後の INSERT だけで検証し、backfill UPDATE が実行されないままテストが green になる |
| migration v3 | カラム未追加 | Rust unit | `REQ-402 migration v3 adds plu_target with default 0` | v3 適用後に plu_target 列がない、または DEFAULT が 0 でない |
| migration v3 | backfill 誤判定（有効JAN） | Rust unit | `REQ-402 migration v3 backfills valid 13-digit active products to 1` | 有効13桁JAN + is_discontinued=0 の行が 0 のまま |
| migration v3 | backfill 誤判定（境界） | Rust unit | `REQ-402 migration v3 keeps custom-code null-jan 12-digit alpha and discontinued at 0` | 独自コード / jan_code NULL / 12桁 / 英字混在 / 廃番のいずれかが 1 になる |
| migration v3 | 再実行破壊 | Rust unit | `REQ-903 migration v3 is idempotent` | v3 再実行でエラーまたは値が変わる |
| IO 抽出 | 対象外混入（dirty） | Rust unit | `REQ-402 find_plu_dirty_products filters plu_target` | plu_target=0 かつ plu_dirty=1 の商品が返る |
| IO 抽出 | 対象外混入（Full） | Rust unit | `REQ-402 find_active_products_for_plu filters plu_target` | plu_target=0 の有効商品が Full 抽出に返る |
| BIZ-PLU 三分バケット | JAN不備で全体失敗（回帰） | Rust unit | `REQ-402 prepare returns excluded reasons instead of failing on jan defects` | JANなし / 非13桁 / チェックディジット不正の混在で prepare が Err になる、または excluded の理由が対応しない |
| BIZ-PLU 三分バケット | 生成 0 件の黙過 | Rust unit | `REQ-402 prepare fails when all targets are excluded` | 全件要修正で Ok（空ファイル）が返る |
| BIZ-PLU dedup | 重複JAN混入 / 非決定 | Rust unit | `REQ-402 prepare dedups same-jan same-price group to lowest product_code row` | 同一JAN・同一売価/税率の群が複数行出力される、または代表が product_code 最小でない |
| BIZ-PLU dedup | confirm 後の非代表残留 | Rust unit | `REQ-402 prepare target codes include all dedup group members and confirm clears them` | 非代表メンバーが target_product_codes に含まれない、または confirm 後に plu_dirty=1 が残る |
| BIZ-PLU dedup | 価格不一致混入 | Rust unit | `REQ-402 prepare excludes same-jan price-mismatched group with group_price_mismatch` | 売価または税率が不一致の同一JAN群が書出しに含まれる |
| BIZ-PLU limit | 上限位置の誤り | Rust unit | `REQ-402 prepare checks scanning limit against deduped row count` | dedup 前の件数で上限判定される（dedup 後 4,784 行以下なのに Err） |
| BIZ-PLU confirm | 正当な件数の拒否 | Rust unit | `REQ-402 confirm accepts target codes exceeding row limit` | 4,785 件以上の正当な exact set が ValidationFailed になる |
| BIZ-PLU confirm | 既存契約の破壊 | Rust unit | 既存 `..._updates_only_requested_products` / `..._rejects_invalid_sets_and_rolls_back` 維持 | 重複拒否・存在確認・全体 ROLLBACK のいずれかが消える |
| BIZ-01 | create 時の未設定 | Rust unit | `REQ-101 create_product stores plu_target from request` | req.plu_target が products に反映されない |
| BIZ-01 | 遷移トリガー欠落 | Rust unit | `REQ-102 update_product sets plu_dirty on plu_target 0 to 1` | 0→1 で plu_dirty=1 にならない、または 1→0 で plu_dirty が変わる |
| BIZ-01 | import 導出誤り | Rust unit | `REQ-104 commit_import derives plu_target like backfill and keeps it on overwrite` | 新規行の導出が backfill 規則と異なる、または上書きで既存 plu_target が変わる |
| CMD-PLU wire | excluded 欠落 | generated/schema | `cargo run --bin generate_bindings` + diff review | bindings に excluded / PluExcludedProductResponse / plu_target が現れない |
| seed | バケット網羅欠落 | Rust integration | `seed provides deterministic products covering all three plu buckets` | seed 後の prepare(Full) で excluded が空、または対象外商品が抽出される |
| UI-08 表示 | excluded 不可視 | RTL | `REQ-402 shows excluded products with japanese reasons` | excluded がある prepare 成功後に要修正一覧・理由文言が表示されない |
| UI-08 表示 | 未知 reason で崩壊 | RTL | `REQ-402 falls back for unknown excluded reason` | 未知 reason 文字列で例外または空欄になる |
| UI-08 文言 | full-only 文言欠落 | RTL | `REQ-402 shows full-only import note and updated failure note` | §67.9 の full-only note / failure note が表示されない |
| UI-08 文言 | 既存文言 assert の残置 | RTL | 既存 `REQ-402 shows full export backup warning and rejects scanning PLU limit overflow` の文言 assert を §67.9 最新文言と突合し、変わった箇所のみ更新（rally R4 P3） | 旧 failure note 文言の assert が残って落ちる |
| UI-08 回帰 | 保存/confirm 動線破壊 | RTL | 既存 `REQ-402 does not confirm when the save dialog is cancelled` ほか維持 | 既存の保存キャンセル / exact set confirm / recovery 動線テストが落ちる |
| UI-01b 初期値提案 | 提案が発火しない / touched 後も上書き | RTL | `REQ-101 proposes plu_target from 13-digit jan input with touched guard` | 13 桁数字 JAN 入力で on が提案されない、JAN 空で off にならない、または利用者が触った後（touched=true）に提案が値を上書きする |
| UI-01b Edit | off→on の帰結が不可視 | RTL | `REQ-102 shows plu-pending note when plu_target turns on in edit` | Edit で off→on にしても PLU 未反映扱いになる旨の補足文言が出ない |

## Manual（Windows native L3）

- 要修正一覧の理由が日本語で読め、状態が色のみで符号化されていない
- full-only note と failure note が §67.9 の文言で表示される
- demo データで対象外商品が差分一覧に現れず、Full 書出しが成功する
