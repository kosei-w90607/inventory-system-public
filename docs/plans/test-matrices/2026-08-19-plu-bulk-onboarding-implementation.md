# Test Design Matrix: PLU bulk onboarding 実装（実装 B）

Packet: `docs/plans/2026-08-19-plu-bulk-onboarding-implementation.md`

## Risk

Risk: R3

## Contracts Under Test

- SPEC-PLS-D6 (a): CSV 任意列 `PLU対象` — `1` / `0` / 空欄のみ受理、他は行 error、`1` + JAN 不備は warning + `0`、新規行 `None` = 既存導出、上書き行 `None` = 既存値維持、`Some` 適用 + 1→0 / JAN 変更で共通解放 service（B-D4）。
- SPEC-PLS-D6 (b): `bulk_set_plu_target(filter, plu_target)` — filter 一致全件（page 外含む、`plu` 込み = B-D2）、ON は未廃番 + 有効 13 桁 JAN + `plu_target=0` のみ（既に 1 は無変更 = B-D1）、OFF は全件 + 1→0 解放、1 TX、operation_logs 要約、4 件数。
- SPEC-PLS-D7（一覧）: `PluMigrationFilter` 5 値の WHERE、3 語彙 badge 導出（`plu_target × plu_dirty`）、`plu` URL param の既定 / 正規化、独立列（B-D3）。
- UI-01a-D11 / DSR-07 / DSR-03: 件数 dialog → confirm で command 呼出し（現在の正規化 filter）→ toast、cancel で呼ばない。
- UI-01c-D16: preview の `PLU対象` 列表示値と同行 warning（色以外）。
- D-052 C19: `pluBulkTarget` = `productList.root / pluDirty / productForm.root / pluSlotSummary`。
- Registration: bindings 再生成 diff 0、`collect_commands!` / `generate_handler!` 61、design_compliance unexpected 0、traceability `--check`。
- PR #85 Final Review P3 follow-up: A-S1（v4 fixture → migrate）、A-N8b（再予約 oracle）。

## Failure Modes

- bulk が page 内 / `plu` 無視の集合に作用する。ON が反映済みの `plu_dirty` を立て直す。OFF で解放が呼ばれない。TX 部分残り。
- CSV 不正値の黙認、`1` + JAN 不備の `1` 保存、上書き行の空欄で既存値が壊れる、`POS在庫連動` 同義語の流用。
- `plu` WHERE と導出式の不一致、`plu` 無効値で画面 error、旧 caller（`plu` 未指定）が壊れる。
- dialog 件数が一覧と異なる / cancel でも実行される / toast が skip 件数を落とす。
- invalidation 漏れで一覧 badge / home 未反映 / slot 要約が stale。
- 登録漏れ（macro 片側 / bindings 未再生成 / fenced signature 欠落 / traceability 未再生成）。

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- oracle は production 定数 / 定義から導出せず test 側へ独立転記する（`feedback-test-oracle-must-not-share-ssot`）。空集合期待の case は非空期待 case と対で持つ。

| ID | Contract | Test Type | Oracle（期待 / fixture） | 比較 |
|---|---|---|---|---|
| B-C1 | D6 (a) 列あり | Rust unit（`preview_import`） | header に `PLU対象` を含む CSV: `1`（13 桁有効 JAN）→ `plu_target=Some(true)`, warnings 空 / `0` → `Some(false)` / 空欄 → `None`。既存列の parse 結果は不変 | field 値 |
| B-C2 | D6 (a) `1` + JAN 不備 | Rust unit | `1` かつ JAN なし / 8 桁 / check digit 不正の 3 行 → `Some(false)` + `warnings` 1 件（文言 `JAN が13桁でないため対象外として取り込みます` を独立転記）、行は `valid_rows` に残る（error_rows へ行かない） | field + 文言 exact |
| B-C3 | D6 (a) 不正値 | Rust unit | `PLU対象` = `true` / `はい` / `2` / ` 1 `（IO-03 `parse_product_csv` が全列を無条件 `trim` するため `1` として受理される = 既存事実。本 case は正例側に置く）、`true` / `はい` / `2` → 行 error（`error_rows`、理由文言）。`POS在庫連動` の同義語集合を流用していないことの負例 = `はい` が error | error_rows + 文言 |
| B-C4 | D6 (a) 列なし / `None` | Rust integration（`commit_import`） | 列なし CSV: 新規行 = 既存導出（13 桁 JAN → 1、他 0）、上書き行 = 既存値維持（既存 `test_commit_import_req104_derives_plu_target_like_backfill_and_keeps_on_overwrite` は不変のまま維持し、本 test は `PLU対象` 列ありで空欄の行を追加した新規 test）。回帰 case（gated amendment 4）: 13 桁数字だが check digit 不正の JAN を持つ新規行 + 空欄 → 既定導出で `plu_target=1`（従来どおり）。あわせて `should_default_plu_target` 単体の新規 test で同 JAN → true を固定（既存 test は改変しない） | products 行 |
| B-C5 | D6 (a) `Some` 適用 + 解放 | Rust integration | 上書き行 `0` で既存 `plu_target=1`（reserved slot 持ち）→ 0 + slot free（`plu_slots` 行 status）/ 上書き行 `1` で既存 0 → 1 + `plu_dirty=1` / 新規行 `0` で 13 桁 JAN でも 0 / JAN 変更 + `1` → 旧 JAN slot 解放 + 新 JAN は次 prepare で予約 | products + plu_slots 行 |
| B-L1 | D6 (b) filter 全件 | Rust integration（`bulk_set_plu_target`） | 商品 fixture 250 件（per_page 上限 200 超）、`keyword` / `department_id` 一致 230 件、ON → `matched_count=230`、page 外の行も更新 | 件数 + 行 |
| B-L2 | D6 (b) ON skip | Rust integration | filter 一致 6 件: 有効 JAN 未廃番 2 / JAN なし 1 / 8 桁 1 / check digit 不正 1 / 廃番（有効 JAN）1 → `updated=2, invalid_jan_skipped=3, discontinued_skipped=1, matched=6`、skip 行は `plu_target=0` のまま | 4 件数 + 行 |
| B-L3 | D6 (b) ON 既に 1 無変更（B-D1） | Rust integration | 一致 3 件: `1 × dirty=0`（反映済み）/ `1 × dirty=1` / `0` → ON → `updated=1`、反映済み行の `plu_dirty=0` 不変、未反映行も不変、0 行のみ `1 × dirty=1`。`updated_at` は更新行のみ変化 | 行 + updated_count |
| B-L4 | D6 (b) OFF + 解放 | Rust integration | 一致 4 件: reserved slot 持ち `1` / active slot 持ち `1` / `1` で slot なし / `0` → OFF → 全件 `plu_target=0`、`updated=3`、`plu_slots`: reserved → free（scanning_code NULL）/ active → release_pending、`0` 行は updated に数えない | products + plu_slots 行 |
| B-L5 | D6 (b) TX rollback | Rust integration | 既存 `product_service::failpoint` 機構（`CREATE_PRODUCT_AFTER_INSERT` 等と同型の test 専用 flag）に bulk 用 failpoint を 1 つ追加し、2 行目更新後に Err → 、商品 / `plu_slots` / operation_logs すべて before と一致 | 行 exact |
| B-L6 | D6 (b) operation_logs | Rust integration | 成功 1 回で operation_logs 1 行: action 種別、filter 要約（keyword / dept / discontinued / plu の正規化表記）、要求値、4 件数を含み、fixture の JAN 文字列を含まない（負例: `rg` 相当の substring assert） | 行 + 非含有 |
| B-L7 | B-D2 filter 同型 | Rust integration | 同一 fixture で `search_products(plu=Pending, per_page=200)` の total_count と `bulk_set_plu_target(filter{plu=Pending}, OFF)` の matched_count が一致（非空、`plu=All` では一致かつ件数が異なる = plu が効いている）。decoy（gated amendment 4、review-only P3）: 同一 keyword で別部門 / 別廃番状態の行を fixture に含め、`department_id` / `is_discontinued` を落とす mutant が件数差で検出されること | 件数一致 |
| B-S1 | D7 `plu` WHERE | Rust integration（`product_repo::search_products`） | fixture 3 商品 `0/0` / `1/1` / `1/0` + 廃番 1: All 4 / Target 2 / Pending 1 / Synced 1 / Excluded 2（廃番 `0` を含む）。`is_discontinued=Some(false)` との AND も 1 case | total_count + items |
| B-S2 | D7 `plu` 省略互換 | Rust unit（serde） | `ProductSearchQuery` JSON に `plu` なし → `None`（All）、`"plu":null` → `None`、`"plu":"pending"` → `Some(Pending)`、`"plu":"bogus"` → Err | deserialize 結果 |
| B-V1 | D7 badge + 独立列（B-D3） | RTL（`ProductTable` / `ProductListPage`） | items 3 件 `0/0` / `1/1` / `1/0` → 列 header `PLU`、各行に `対象外` / `未反映` / `反映済み` の text + icon（`aria-hidden` icon + visible text、色 class のみの差分ではない）、行 `text-muted-foreground` なし | text / role |
| B-V2 | D7 `plu` URL param | RTL（`search.ts` + page） | `?plu=pending` → filter UI 選択状態 + `searchProducts` に `plu: "pending"` / `?plu=bogus` → `all` 正規化 + query に `plu: "all"`（既定値も送る。`discontinued` 既定 `active` → `is_discontinued: false` と同じ方針、gated amendment 3 で確定）/ `discontinued=all&plu=synced` 併用 / filter 変更で `page` reset | call 引数 + URL |
| B-V3 | UI-01a-D11 dialog → command → toast | RTL | 一覧 total_count 37 で `PLU 対象にする` → dialog に `37 件` + 文言（レジ反映は別途必要）→ confirm → `bulkSetPluTarget({ keyword, department_id, is_discontinued, plu }, true)` が現在の正規化 filter（`plu` 込み、page/per_page なし）で 1 回 → toast に updated / skip 件数 → invalidation（`productList` refetch 呼出し）。cancel → 0 回。`対象から外す` も同型で `false`。total 0 → 実行ボタン disabled | call 引数 exact + text |
| B-P1 | UI-01c-D16 preview 列 | RTL（`ProductImportPreview`） | valid_rows 3 行 `Some(true)` / `Some(false)`+warning / `None` → 列 `PLU対象` に `対象` / `対象外` + warning text（icon 併用、色のみ不可）/ `既定（13桁JANなら対象）`。説明 1 行の存在 | text |
| B-W1 | wire | generated | `generate_bindings` 後 diff 0、`bindings.ts` に `bulkSetPluTarget` / `ProductBulkFilter` / `BulkPluTargetResult` / `PluMigrationFilter` / `ImportRow.plu_target` / `ImportRow.warnings` / `ProductSearchQuery.plu?`、`collect_commands!` / `generate_handler!` とも 61 | local-ci `generated-bindings-diff` + rg -c |
| B-W2 | design compliance | cargo test | `design_compliance_test` unexpected 0（20-io / 30-biz / 40-cmd の fenced signature） | PASS |
| B-W3 | traceability | cargo run | `generate_traceability --check` PASS、REQ-907 行に B-* test | PASS |
| B-I1 | D-052 C19 | vitest（独立 oracle） | 期待集合 C1〜C19 を test 側へ独立転記し `invalidationContract` の実集合と順序非依存・重複検出付きで完全一致。C19 = `productList.root / pluDirty / productForm.root / pluSlotSummary` | 完全一致 |
| B-F1 | PR #85 P3 (a) | Rust integration | `setup_v1_only_db` / `setup_v2_only_db`（`db/migration.rs` tests）と同型の `setup_v4_only_db` を新設（v1〜v4 適用済み DB）→ migrate → `schema_versions` max=5 + `plu_slots` 4,784 行（直値）。新規 DB への一括適用 test は維持 | 直値 |
| B-F2 | PR #85 P3 (b) | Rust integration | `reserved × 別コード` → `external + reservation_dropped` の後、同 JAN を再 prepare → 別 memory_no（最小 free）で `reserved`、旧 slot は `external` のまま | 行 |
| B-G1 | 値文法 sweep | review | `rg -n '"はい"|"true"' src-tauri/src/biz/product_service.rs` の hit が `POS在庫連動` parse block のみ（`PLU対象` block は `"1"` / `"0"` / `""`） | hit 箇所 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| `plu` search param | URL なし = all | — | filter 変更で URL 更新 + page reset | — | query key に plu | URL から復元 | 同左 | 無効値 → all | — | B-V2 |
| 一括操作 | ボタン有効（total>0） | dialog 表示（件数） | toast + C19 invalidation | productList / pluDirty / productForm / pluSlotSummary | 一覧 refetch で badge 更新 | — | — | destructive Alert + 再試行 | 再実行は冪等 | B-V3 / B-L3 / B-I1 |
| products.plu_target / plu_dirty | 既存値 | TX 中 | ON: 0→1 + dirty / OFF: 1→0 | — | — | — | 永続 | rollback 無変化 | 再実行 | B-L2〜B-L5 |
| plu_slots（解放） | reserved / active | TX 中 | free / release_pending | pluSlotSummary | UI-08 要約 | — | 永続 | rollback | — | B-L4 / B-L5 |
| CSV preview `PLU対象` | 列なし = 既定表示 | preview 中 | 列 + warning 表示 | — | — | — | preview は session 内 | 不正値 = error_rows | 再 preview | B-C1〜B-C3 / B-P1 |
| commit_import 適用 | — | TX | 新規 / 上書き規則 | productImport（既存 C3） | — | — | 永続 | rollback（既存） | — | B-C4 / B-C5 |
| content candidate → L1 / independent review → human-confirm | — | — | state-only commit | — | — | — | — | 差戻しは implementing へ backtrack | — | packet narrative |
| owner 承認 → Ready state-only → exact-HEAD L1 → PR body → Ready → merge | — | — | 3 本目 state-only | — | — | — | — | product/gate 失敗は implementing | — | packet narrative |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| URL enum param 正規化（`discontinued`） | `search.ts` の OPTIONS / schema / normalizeEnum / payload / patch の 5 箇所 | `plu` 同 5 箇所 | `sort` / `dir`（enum だが payload 方式が異なる）は対象外 | B-V2 |
| CSV 任意列 parse（`POS在庫連動` / `初期在庫`） | `preview_import` の各列 block | `PLU対象` block（値文法は別） | 同義語集合は流用しない（B-G1） | B-C1〜B-C3 |
| 件数付き AlertDialog | `AdditionalImportConfirmDialog.tsx` / `DiscontinueConfirmDialog.tsx` | `PluBulkTargetConfirmDialog`（新設） | — | B-V3 |
| D-052 invalidation entry | `invalidation-contract.ts` 18 entry + oracle test | C19 追加 | C2 の `pluSlotSummary` 欠落は PR #85 gated amendment 5 で解消済み（本 PR 不変） | B-I1 |
| 共通解放 service 呼出し（PR #85） | `update_product` / `toggle_discontinue` / `commit_import` JAN 変更 | `bulk_set_plu_target` OFF + `commit_import` 上書き `0` | — | B-L4 / B-C5 |
| text + icon badge（色以外） | `StockStatusBadge` / 廃番 Badge | PLU 列 badge | 行減衰は 廃番 のみ（B-D3） | B-V1 |

## Negative Paths

- missing input: `PLU対象` 列なし → 既存挙動（B-C4）、filter 一致 0 → 実行 disabled（B-V3）、`plu` 省略 → All（B-S2）
- invalid input: `PLU対象` 不正値 → 行 error（B-C3）、`plu` 無効値 → all（B-V2）/ serde Err（B-S2）、JAN 不備 + `1` → warning + 0（B-C2）、bulk ON の skip 4 種（B-L2）
- duplicate/ambiguous input: ON 再実行 → updated 0、反映済みは不変（B-L3）、同一 JAN 複数商品は PR #85 の共有 JAN 規則（解放は残存判定、A-R1）に委ね本 packet では OFF 1 行ずつ呼ぶだけ（B-L4 fixture に共有 JAN 1 組を含め、解放が残存で抑止されることを assert）
- TX 途中失敗 → 全 rollback（B-L5）

## Boundary Checks

- per_page 上限 200 超の filter 一致（B-L1）、matched 0 / 1 / 多数
- `plu` 5 値 + 省略 + null + 不明値（B-S1 / B-S2）
- CSV 値 `1` / `0` / `` / 空白混じり / 同義語（B-C1〜B-C3）
- 件数 toast の 0 件 skip 表記（B-V3）

## Compatibility Checks

- `search_products` 旧 payload（`plu` なし）互換（B-S2 / B-W1 bindings で `plu?:`）
- `ImportRow` 旧 shape（`plu_target` / `warnings` なし）の deserialize（`#[serde(default)]`）
- 既存 RTL（ProductListPage / ProductImportPage）と Rust test の無改変 PASS（Oracle Replacement Ledger）
- PR #85 契約（解放 service / slot 遷移）を変更しない（B-L4 は A-R1 / A-R5 の oracle と整合）

## Data Safety Checks

- fixture JAN は架空（check digit 有効）、実商品名なし
- operation_logs に JAN 非含有（B-L6）
- 物理 DELETE なし、bulk は UPDATE のみ

## Main Wiring / Integration Checks

- UI filter（正規化）→ `bulkSetPluTarget` → CMD → BIZ TX → repo 更新 + `release_plu_slot_for_jan` → operation_log → C19 invalidation → 一覧 / home 更新（B-V3 + B-L4 + B-I1）
- CSV preview → `ImportRow.plu_target` → commit 適用（B-C1 → B-C5）
- `collect_commands!` / `generate_handler!` 61、bindings diff 0（B-W1）

## Mutation-style Adequacy Questions

Writer は下記 mutant（23 行。`#[serde(default)]` 除去は equivalent で B-W1 検出）を実注入して各 test の kill を確認し、Final Reviewer は clean tree で同 Matrix どおりに独立再現する。

| Mutant | Must be killed by |
|---|---|
| bulk ON の `plu_target=0` 条件を外す（既に 1 も dirty=1 に） | B-L3 |
| bulk ON の廃番 skip を外す | B-L2 |
| bulk ON の JAN 判定を「13 桁数字」のみ（check digit 不問）に | B-L2（check digit 不正 fixture） |
| bulk ON の適格判定を `should_default_plu_target` に差し替える（= check digit 不問）/ 逆に既定導出を check digit 込みへ変える | B-L2 / B-C4 回帰 case + `should_default_plu_target` 新規 test |
| bulk query から `department_id` または `is_discontinued` 条件を落とす | B-L7（decoy） |
| bulk OFF で `release_plu_slot_for_jan` 呼出しを外す | B-L4 |
| bulk の読取りを `search_products` の page 1 に差し替え | B-L1 |
| `ProductBulkFilter` の `plu` を WHERE に反映しない | B-L7 |
| TX を行ごとの autocommit に | B-L5 |
| operation_log に JAN 一覧を含める | B-L6 |
| CSV `PLU対象` に `はい` / `true` を受理 | B-C3 |
| `1` + JAN 不備を `Some(true)` のまま通す | B-C2 |
| 上書き行 `None` で `plu_target` を導出規則で上書き | B-C4 |
| `Pending` の WHERE を `plu_target=1` のみに | B-S1 |
| badge 導出で `1 × dirty=0` を `未反映` に | B-V1 |
| dialog cancel でも command 呼出し | B-V3 |
| command 引数から `plu` を落とす | B-V3 |
| C19 から `pluSlotSummary` を落とす | B-I1 |
| A-N8b 再予約で旧 slot を再利用 | B-F2 |
| `search.ts` の `plu` 正規化（`normalizeEnum`）を bypass して不正値を payload へ通す | B-V2 |
| `PluMigrationFilter` の `#[serde(rename_all = ...)]` を外す / 変える（`"pending"` → `Some(Pending)` が Err） | B-S2 |
| `ProductSearchQuery.plu` の `#[serde(default)]` を外す（Rust の deserialize は `Option<T>` 組込みで `None` のまま = equivalent、TS 側は specta が `plu` を必須 key にするため既存 caller が型 error） | B-W1（bindings diff + tsc）。B-S2 では殺せない equivalent mutant と明記 |
| preview の `PLU対象` 表示値 `対象` / `対象外` を swap | B-P1 |

## Residual Test Gaps

- PLU 列の密度 / 読みやすさ、dialog / toast の視認は Windows native visual confirmation（Human Gate）。
- 商品数が数万規模の bulk 性能は対象外（実運用数千）。
- D-052 C2 の `pluSlotSummary` 欠落は follow-up。
