# Plan Packet: D-028 JANなし商品のPLU対象扱い実装

> **親文書**: [Plans.md](../../Plans.md) / workflow: [DEV_WORKFLOW.md](../../DEV_WORKFLOW.md)
> **設計正本**: PR #123 で merge 済みの source docs（§Design Sources）と decision-log D-028。設計合意の経緯は archived packet [2026-07-03-post-ui08-janless-plu-target-design.md](../../archive/plans/2026-07-03-post-ui08-janless-plu-target-design.md)
> **実装担当**: Codex CLI（経路A: 本 packet を実装指示として手渡し）

## Risk

Risk: R3

Reason:
DB migration（products.plu_target 追加 + backfill）、PLU書出しの BIZ/CMD 契約変更（excluded / 上限撤廃）、Tauri command DTO / generated bindings、operator-facing UI 文言に触れる。

## Goal

PR #123 で確定した D-028 設計（三分バケット / plu_target / 同一JAN dedup / plu_dirty 意味限定 / Full-only 投入ガード文言）を実装し、JANなし商品が存在する実データで PLU 書出し（REQ-402）が破綻しない状態にする。

## Scope

実装は設計書が正。以下は対象モジュールの列挙であり、詳細仕様は §Design Sources の各設計書を読むこと。

- **MNT-03 migration v3**: `src-tauri/src/db/schema_v3.rs` 新設 + `migration.rs` の migrations() へ v3 登録（v2 の直後）。`ALTER TABLE products ADD COLUMN plu_target BOOLEAN NOT NULL DEFAULT 0` + 同一TX内 backfill（`is_discontinued = 0 AND jan_code IS NOT NULL AND length(jan_code) = 13 AND jan_code NOT GLOB '*[^0-9]*'` → 1）。仕様: [22-mnt-migration.md](../../function-design/22-mnt-migration.md) §10
- **IO product_repo**: `Product` / `NewProduct` / `ProductUpdates` に plu_target 追加、insert_product / update_product の SQL 列追加、`find_plu_dirty_products` / `find_plu_dirty_products_for_plu` / `find_active_products_for_plu` に `AND plu_target = 1`。仕様: [20-io-product-repo.md](../../function-design/20-io-product-repo.md)
- **BIZ-01 product_service**: `ProductCreateRequest.plu_target: bool` / `ProductUpdateRequest.plu_target: Option<bool>` 追加、create_product で設定、update_product で 0→1 遷移時に plu_dirty=true（1→0 は plu_dirty を触らない）、commit_import 新規行のインライン導出（backfill と同一規則）+ 上書き行は plu_target 不変。仕様: [30-biz-product-service.md](../../function-design/30-biz-product-service.md) §4.2 / §4.4 / §4.9
- **BIZ-04 plu_export_service**: `PluExcludedProduct` / `PluExcludedReason`（MissingJan / InvalidJanFormat / InvalidCheckDigit / GroupPriceMismatch）新設、prepare を三分バケット化（要修正は excluded で返し生成をブロックしない）、同一JAN dedup（売価・税率全一致 → product_code 最小の代表 1 行、不一致 → 群を excluded）、上限チェックを dedup 後の生成行数基準へ移動、生成行 0 件のみ ValidationFailed、`target_product_codes` は dedup 群全メンバー、confirm の件数上限比較（現行 step の `SCANNING_PLU_EXPORT_LIMIT` 比較）を撤廃。仕様: [33-biz-plu-export-service.md](../../function-design/33-biz-plu-export-service.md) §16.2-16.5
- **CMD**: `PluExportPrepareResponse.excluded: Vec<PluExcludedProductResponse>`（reason は `missing_jan` / `invalid_jan_format` / `invalid_check_digit` / `group_price_mismatch` の snake_case 文字列）、product_cmd の Create/Update request への plu_target 反映、`cargo run --bin generate_bindings` で bindings 再生成。仕様: [41-cmd-pos.md](../../function-design/41-cmd-pos.md)、[cmd-task-specs.md](../../architecture/cmd-task-specs.md) CMD-08
- **constants.rs**: 値は不変（`SCANNING_PLU_EXPORT_LIMIT` = 4784 / 通常PLU 216）。コメントの「現地観測」表現を「工場出荷時配分（SR-S4000 取説確認済み）」へ格上げ
- **seed（seed_demo.rs）**: products INSERT に plu_target 列追加（valid EAN13 商品 → 1）。三分バケットを demo で確認できるよう、決定的な少数商品を追加: JANなし独自コード商品（対象外）、同一JAN・同一売価の 2 商品（dedup 確認）、同一JAN・売価不一致の 2 商品（要修正）、チェックディジット不正 JAN の 1 商品（要修正）。**rng 決定性の維持（rally R1 P2-1 対応）: 追加商品は `gen_ean13(&mut rng)` を消費せずハードコードした jan_code 値（または NULL）を使い、既存 100 商品ループの後の `run_seed` 内独立 phase として INSERT する**（rng カーソルをずらすと決定性テストが壊れるため）。追加件数は seed 側で定数化し、summary（products_inserted / products_skipped）と件数系テストの `100` 比較を `100 + 定数` へ更新する（rally R3 P2-2。書き換え対象は matrix 参照）
- **UI-08（PluExportPage）**: prepare 結果の `excluded` を理由付き一覧で表示（`PluExcludedTable`、日本語文言は [67-ui-plu-export.md](../../function-design/67-ui-plu-export.md) §67.9 の excluded reasons）、failure note / full-only import note の文言差し替え（§67.9）、既存の「JAN不備で prepare 失敗」前提の表示・テストを新契約へ更新
- **UI-01b（ProductFormPage、実装済み画面）**: `plu_target` フィールドを Create / Edit フォームへ追加（rally R1 P1-1 対応: `src/features/products/lib/product-form-request.ts` の `buildCreateProductRequest` / `buildUpdateProductRequest` が `ProductCreateRequest` / `ProductUpdateRequest` を構築しており、required field 追加は form 更新とセットでないと typecheck が落ちる）。仕様は [51-ui-product-form.md](../../function-design/51-ui-product-form.md) §7.5 4b / Edit editable fields: JAN 欄の 13 桁数字判定から初期値提案（pos_stock_sync と同じ touched 区別パターン）、Edit では off→on 変更時に PLU 未反映扱いになる旨の補足文言。bindings 再生成と form 更新は同一 commit で行う
- **constants.rs rename（rally R1 P2-3 対応）**: `OBSERVED_STANDARD_PLU_MEMORY_COUNT` → `DEFAULT_STANDARD_PLU_MEMORY_COUNT` へ rename（値 216 と導出式は不変。「観測値」から「取説確認済みの出荷時既定値」へ実態が変わったため名前を追従。rg で全参照を一括更新）
- **schema_v3 の可視性**: `schema_v1` に合わせ `pub(crate)` にする（rally R2 P3-A 訂正: `schema_v2::apply_v2_idempotency` は `pub fn` で design_compliance の allowlist 入り済みのため**変更対象外**。schema_v3 を `pub(crate)` にすることで allowlist 追加を不要にする）。`design_compliance_test` の `22-mnt-migration.md` マッピングへ `db::schema_v3` を追記
- **テスト**: Test Design Matrix（[test-matrices/2026-07-03-d028-janless-plu-implementation.md](test-matrices/2026-07-03-d028-janless-plu-implementation.md)）の全行。既存テストの削除・skip は不可、契約変更に伴う書き換えのみ可（対象は matrix に列挙）

## Non-scope

- PLUスロット永続割当の恒久設計・実装（Plans.md backlog）
- Post-PLU track（実売 Z004 検証、Diff 部分 import 実機挙動、アプリ生成 `.txt` 実機再確認）
- REQ-401 SALES implementation
- 一括インポート CSV への plu_target 列追加（インライン導出のみ）

## Acceptance Criteria

- `cd src-tauri && cargo test` PASS（既存 + Test Matrix 新規行。JAN不備 excluded 化で書き換えるテストは matrix 記載のもののみ）
- `cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo run --bin generate_bindings` 後の `src/lib/bindings.ts` diff に `excluded` / `PluExcludedProductResponse` / `plu_target`（Create/Update request）が現れる
- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` PASS
- `cd src-tauri && cargo test --test design_compliance_test` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` OK（ERROR 0）
- `bash scripts/doc-consistency-check.sh` / `--target plan` PASS
- `cargo run --bin seed_demo_data -- --reset` 後、prepare(Full) が成功し excluded に要修正商品が理由付きで載る（demo で三分バケットが観察できる）
- 既存テストの削除・skip・弱体化なし（`git diff` レビューで確認）

## Design Sources

- 恒久判断: [decision-log.md](../../decision-log.md) D-028（D-027 / D-023 / D-011 と併読）
- BIZ: [33-biz-plu-export-service.md](../../function-design/33-biz-plu-export-service.md)、[30-biz-product-service.md](../../function-design/30-biz-product-service.md)
- IO / DB: [20-io-product-repo.md](../../function-design/20-io-product-repo.md)、[master-tables.md](../../db-design/master-tables.md) products、[22-mnt-migration.md](../../function-design/22-mnt-migration.md) §10
- CMD: [41-cmd-pos.md](../../function-design/41-cmd-pos.md)、[cmd-task-specs.md](../../architecture/cmd-task-specs.md)
- UI: [67-ui-plu-export.md](../../function-design/67-ui-plu-export.md)（UI-08-D8 / D9 / excluded reasons / full-only note）、[53-ui-home.md](../../function-design/53-ui-home.md)（通知 scope 注記）
- アーキ: [biz-task-specs.md](../../architecture/biz-task-specs.md) BIZ-04、[ARCHITECTURE.md](../../ARCHITECTURE.md) BIZ-04 行

## Design Readiness

- 設計は PR #123（`e558abf`）で source docs へ昇格済み。rally 3 round + Sonnet review-only + Codex CLI 2 round で収束しており、未解決の設計問題はない
- 本 packet は実装とテストの scope 指定のみを行い、設計判断を新設しない。実装中に恒久判断が必要になった場合は実装を止めて Design Phase に戻す（DEV_WORKFLOW Implementation Rules）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-402 | 33-biz §16.3 三分バケット / dedup | D-028 / UI-08-D8 | 全体ブロックは実データで恒久失敗（却下: 現行維持） | biz/plu_export_service.rs | matrix「BIZ-PLU 三分バケット」「dedup」行 |
| REQ-402 | 33-biz §16.4 上限撤廃 | D-028 | dedup 群展開で正当に超え得る（却下: 上限維持） | biz/plu_export_service.rs confirm | matrix「confirm 上限撤廃」行 |
| REQ-402 | 22-mnt §10 migration v3 | D-028 | ALTER TABLE で足りる（却下: テーブル再作成） | db/schema_v3.rs, migration.rs | matrix「migration v3」行 |
| REQ-101 / REQ-102 | 30-biz §4.2 / §4.4 | D-028 | pos_stock_sync 前例と同型の明示フラグ（却下: 導出のみ） | biz/product_service.rs | matrix「BIZ-01」行 |
| REQ-104 | 30-biz §4.9 | D-028 | CSV 列を増やさずインライン導出 | biz/product_service.rs commit_import | matrix「commit_import」行 |
| REQ-402 | 67-ui §67.9 / UI-08-D9 | D-028 / UI-08-D9 | Diff 投入はスロット上書き事故（却下: 文言据え置き） | features/plu-export/ | matrix「RTL」行 |
| REQ-101 / REQ-102 | 51-ui §7.5 4b / Edit fields | D-028 | JAN 有効性からの初期値提案 + 変更可（pos_stock_sync と同型） | features/products/（ProductFormPage / product-form-request） | matrix「UI-01b」行 |

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | plu_target / 三分バケットは app core。メモリNo. 規則・上限値は adapter profile（constants）で値不変 | 本 packet Scope |
| Fact check / design decision split | 実装は確定済み設計の反映のみ。新規の事実確認なし | — |
| Lifecycle / retry | prepare 再実行・要修正→修正→再 prepare・plu_target 遷移は設計済み。テストで固定 | Test Matrix |
| Operator workflow | excluded 一覧と full-only 文言が operator-facing。Windows native L3 対象 | §Test Plan manual 節 |
| Replacement path | レジ更改時も plu_target / バケットは残る。constants の profile 値のみ差し替え | — |
| Data safety / evidence | 実データ不使用。fixtures は合成のみ | §Data Safety |
| Reporting / accounting semantics | 売上集計に影響なし（PLU 書出しと商品マスタのみ） | — |
| Manual verification | excluded 表示・full-only 文言・demo 三分バケットは Windows native L3 で目視確認 | §Test Plan manual 節 |

## Boundary / Wire Contract

- producer: CMD `prepare_plu_export`（tauri-specta 生成）
- consumer: `src/features/plu-export/PluExportPage.tsx`（generated `commands.preparePluExport`）
- wire type: `PluExportPrepareResponse` に `excluded: PluExcludedProductResponse[]` を追加。`PluExcludedProductResponse = { product_code: string, jan_code: string | null, name: string, reason: string }`、reason は `missing_jan | invalid_jan_format | invalid_check_digit | group_price_mismatch` の 4 値
- internal type: BIZ `PluExcludedProduct { product_code, jan_code, name, reason: PluExcludedReason }`。CMD で snake_case 文字列へ変換し、`jan_code` / `name` は UI-08 の要修正4列表示へ渡す
- precision/range: excluded は最大でも products 総行数。空配列が正常値
- round-trip path: BIZ → CMD 変換 → specta 生成 → UI 表示（日本語文言変換は UI 側、67-ui §67.9）
- invalid input: 未知 reason 文字列は UI 側で「要修正（詳細不明）」fallback 表示（前方互換）
- compatibility: `PluExportPrepareResponse.excluded` は field 追加だが、RTL の `mockDefaultCommands` が response 全 field を型付きで構築しているため mock へ `excluded: []` の追加が必要（rally R1 P2-2）。`ProductCreateRequest.plu_target: bool` は required field 追加 = 破壊的で、実在する呼び出し元 `src/features/products/lib/product-form-request.ts` / `ProductFormPage.tsx` を同一 commit で更新する（rally R1 P1-1）。migration v3 は一方向・冪等（schema_versions 記録で再実行スキップ）

## Test Plan

- Test Design Matrix: [test-matrices/2026-07-03-d028-janless-plu-implementation.md](test-matrices/2026-07-03-d028-janless-plu-implementation.md)
- targeted tests: `cargo test plu_export_service --lib` / `cargo test product_service --lib` / `cargo test migration` / `npm test -- --run src/features/plu-export/PluExportPage.test.tsx`
- negative tests: matrix の Failure Modes 全行（excluded 各理由、dedup 不一致、生成 0 件、backfill 境界）
- compatibility checks: generate_bindings diff、既存 confirm exact-set テスト維持
- data safety checks: fixtures 合成のみ、実 JAN / 実商品名の非混入
- main wiring/integration checks: seed → prepare(Full) → excluded 表示の through 確認（RTL + demo）

Manual（Windows native L3、Draft PR の pending checks として記録）:

- `/products/plu-export` で要修正一覧が理由の日本語文言付きで表示される
- full-only note（「PCツール（CV17）に取り込んでよいのは全件書出しのファイルだけです…」）と failure note の文言が §67.9 どおり
- demo データで Full 書出しが成功し、対象外商品（JANなし）が差分一覧・書出しに現れない

## Spec Contract

Contract ID: SPEC-D028-IMPL

- prepare は plu_target=1 のみ抽出し、JAN 不備・同一JAN価格不一致を excluded で返して生成をブロックしない（生成行 0 件のみ ValidationFailed）
- 同一JAN は売価・税率全一致で product_code 最小の代表 1 行に dedup し、target_product_codes は群全メンバーを含む
- confirm は件数上限比較を持たず、重複拒否 + 全件存在確認 + 全体 ROLLBACK を維持する
- migration v3 は ALTER TABLE + 同一TX backfill で、廃番・JANなし・非13桁数字を plu_target=0 に保つ
- plu_target 0→1 遷移は plu_dirty=1 をセットし、1→0 は plu_dirty を変更しない

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-D028-IMPL-1（三分バケット） | BIZ-04 prepare 改修 | matrix「excluded 各理由」「対象外非抽出」行 | prepare が Err でなく Ok+excluded を返すこと | `cargo test plu_export_service --lib` |
| SPEC-D028-IMPL-2（dedup） | BIZ-04 prepare 改修 | matrix「dedup 一致/不一致」行 | 代表選定の決定性と target 全メンバー包含 | 同上 |
| SPEC-D028-IMPL-3（confirm 上限撤廃） | BIZ-04 confirm 改修 | matrix「confirm 上限撤廃」行 | 既存 exact-set / ROLLBACK 契約の維持 | 同上 |
| SPEC-D028-IMPL-4（migration v3） | schema_v3 + backfill | matrix「migration v3」5 行 | backfill 境界（廃番 / NULL / 12桁 / 英字混在） | `cargo test migration` |
| SPEC-D028-IMPL-5（plu_target 遷移） | BIZ-01 改修 | matrix「BIZ-01」行 | 0→1 で dirty、1→0 で不変 | `cargo test product_service --lib` |
| SPEC-D028-IMPL-6（wire）| CMD + bindings | matrix「CMD-PLU wire」行 | excluded / plu_target が bindings に出る | `generate_bindings` diff |
| SPEC-D028-IMPL-7（UI 文言） | UI-08 改修 | matrix「RTL」行 | §67.9 文言との一致、色のみ符号化禁止 | `npm test` + L3 |

## Review Focus

- prepare の分岐順序（抽出 → 要修正分離 → dedup → 上限 → 生成 0 件判定）が 33-biz §16.3 のステップ順と一致しているか
- dedup の代表選定が決定的（product_code 昇順最小）で、name / 売価 / 税率が代表行から取られているか
- confirm から上限比較を消した後も、重複拒否・存在確認・全体 ROLLBACK が既存テストで守られているか
- migration v3 の backfill 条件が設計書の SQL と一字一句一致するか（`NOT GLOB '*[^0-9]*'`）
- 既存テストの書き換えが matrix 列挙分に限られ、削除・skip がないか
- UI 文言が 67-ui §67.9 と一致し、状態を色だけで符号化していないか

## Data Safety

- 実 POS CSV / 実 PLU ファイル / 実 JAN / 実商品名 / 実価格 / 店舗 DB / バックアップを読まない・コミットしない
- テスト fixtures と seed 追加商品は合成データのみ（EAN13 はチェックディジット計算で合成）
- migration は demo/dev DB でのみ実行確認。実店舗 DB は未配備のため本番 migration リスクなし（v1.0 配備時に v1→v3 が一括適用される前提を migration 冪等性テストで担保）

## Rally Record

- Round 1（Plan agent / Sonnet、fact-check 指定）: fact-check 18 項目中 17 一致、事実誤認 1（F-14: UI-01b 未実装の思い込み → ProductFormPage が createProduct を呼んでいる）。P1 4 / P2 3 / P3 2。P1-1（required field 追加の typecheck 直撃）→ UI-01b フォーム更新を Scope へ組み入れ、P1-2（migration version assert 3 テスト）/ P1-3（confirm over_limit サブケース衝突）/ P1-4（insert_test_product_for_plu SQL）→ 書き換え対象テーブルへ追加。P2-1（seed rng 決定性）→ ハードコード + 独立 phase を明記、P2-2（RTL mock excluded）→ 書き換え対象へ、P2-3（OBSERVED 定数名の乖離）→ rename を Scope へ。P3 2 件（setup_v2_only_db 指示 / schema_v3 可視性）も採用。
- Round 2（Plan agent / Sonnet）: R1 修正 9 件すべて反映確認済み（constants rename の波及 4 箇所を rg 実測、migration assert 行番号一致確認込み）。新規 P1 0 / P2 1 / P3 1。P2-A（`test-fixtures.ts` の `makeMockProductWithRelations` が `ProductWithRelations.plu_target` required 化で typecheck 落ち）→ 書き換え対象へ追加、P3-A（schema_v2 可視性の記述誤り: pub fn + allowlist 入り済みで変更対象外）→ Scope 記述を訂正。
- Round 3（Plan agent / Sonnet）: R2 修正 2 件反映確認済み。新規 P1 0 / P2 2。P2-1（`makeMockProductWithRelations` が stock-inquiry 側にも同名分散 — factory 定義元の更新は typecheck の呼び出し元検出では救済されない）→ 書き換え対象へ追加、P2-2（seed 件数 assert 3 テストと「決定性テスト変更しない」記述の内部矛盾）→ 追加件数の定数化 + `100 + 定数` 更新へ方針固定し矛盾解消。
- Round 4（Plan agent / Sonnet）: R3 修正 2 件反映確認済み。新規 P1 0 / P2 1 / P3 1。P2（StockMovementsPage.test.tsx の `makeStockDetail` が factory 非経由の直書きリテラル）→ 反映済み。
- **収束判断（Round 4 で打ち切り、orchestrator 判断）**: R2 以降の新規 P2 は全て「bindings 再生成 → 型リテラルの required field 化 → typecheck 検出」という**単一の機械検出可能クラス**だった。round を重ねて 1 件ずつ拾う代わりに、orchestrator が marker field（`pos_stock_sync:`）で src/ 全体を網羅 grep して該当 7 ファイルを一括列挙し、matrix に【クラス一括】行として固定した。個別の見落としは AC の `npm run typecheck` が確定的に検出するため、これをもって収束とする（設計・契約レベルの新規 P1/P2 は R2 以降ゼロ）。

## Self-Review

1. **前提条件**: 実装対象の現状（constants 行番号、既存テスト名、seed の INSERT 列、query 定義位置）は Explore agent の棚卸しで列挙し、rally R1 の fact-check 18 項目で実コードと再突合済み。R1 が「UI-01b 未実装」という当初の事実誤認（実際は ProductFormPage が createProduct を呼んでいる）を検出し、UI-01b フォーム更新を Scope に組み入れて解消した。
2. **検証手段**: Acceptance Criteria は全て command + 期待出力の evidence token 付き。Test Matrix が failure mode 起点で、設計決定 ID（D-028 / UI-08-D8/D9）を引ける。
3. **後処理**: merge 後に packet + matrix を archive へ移動、Plans.md 同期、traceability 再生成は実装 PR 内で実施。
4. **制約整合**: 既存テスト削除・skip 禁止（CLAUDE.md）を AC に明記。CMD 薄層維持（reason 変換のみ CMD、業務ルールは BIZ）。実データ非混入。
5. **scope 規律**: UI-01b フォーム・スロット永続割当を Non-scope に明示。設計判断の新設禁止と Design Phase 差し戻し条件を Design Readiness に明記。
6. **commit 分割**: migration+IO → BIZ → CMD+bindings → seed → UI+RTL → docs 同期 の順で commit を分け、各段で targeted gate を回す（Codex への指示に含める）。
7. **残リスク**: `ProductCreateRequest.plu_target` required 追加の破壊影響は、既知の呼び出し元（product-form-request / ProductFormPage / RTL mock）を書き換え対象として列挙済み。未知の呼び出し元が残っていれば `npm run typecheck` が検出する。L3 目視は owner 待ちのため Draft PR で pending 管理。

## Implementation Results

2026-07-04 Codex implementation branch: `codex/d028-janless-plu-implementation` / Draft PR #124

### Implemented

- MNT-03: `products.plu_target BOOLEAN NOT NULL DEFAULT 0` を追加する migration v3 を実装。既存行 backfill は §10 の `jan_code IS NOT NULL AND length(jan_code) = 13 AND jan_code NOT GLOB '*[^0-9]*'` と `is_discontinued = 0` で実装。
- IO-01: `Product` / `NewProduct` / `ProductUpdates` に `plu_target` を追加し、PLU抽出3クエリを `plu_target = 1` でフィルタ。
- BIZ-01: create/update/import に `plu_target` を配線。0→1 は `plu_dirty=true`、1→0 は dirty を強制しない。CSV import 新規行は migration と同じ13桁数字規則で導出し、overwrite は既存値を維持。
- BIZ-04: prepare を三分バケット化。JANなし/形式不正/チェックディジット不正/同一JAN価格・税率不一致を `excluded` に分離。生成0件は ValidationFailed。同一JAN同価格・同税率は product_code 最小を代表行にし、`target_product_codes` は同一JANグループ全員を含める。上限判定は dedup 後の行数。confirm の件数上限拒否は撤廃し、空/重複/欠番/ROLLBACK は維持。
- CMD + bindings: `PluExportPrepareResponse.excluded` / `PluExcludedProductResponse` / `Product.plu_target` / `ProductCreateRequest.plu_target` / `ProductUpdateRequest_Deserialize.plu_target` を生成済み。
- seed: 既存100商品の乱数消費を変えず、D-028 PLU確認用固定6商品を追加。seed Full prepare で 101 行生成 / target codes 102 / excluded 3 を確認する unit test を追加。
- UI-08: excluded table と日本語理由表示、full-only note / failure note、dedup 後の pending recovery count 条件を更新。
- UI-01b: `pluTarget` form state、13桁数字JANからの自動提案 + touched guard、edit off→on note、create/update payload 配線を実装。
- docs/workflow: `design_compliance_test` に `db::schema_v3` を登録し、`90-traceability.md` を再生成。
- review follow-up: Test Matrix の BIZ 契約テスト不足（confirm 上限撤廃 / create / update / import）、UI unknown reason fallback、ローカル SQLite DB 誤追加防止を同 PR で補強。migration v3 test は v2 適用済み DB へ v3 を適用する形に更新。
- acceptance review Round 1 follow-up: P2-1 全件要修正時の ValidationFailed message に product_code + 日本語理由を含める契約へ修正。P2-2 dedup 群の `target_product_codes` を confirm し、全メンバーの `plu_dirty=0` を確認する Rust test を追加。P3-1 prepare の上限チェック → 生成0件チェック順へ設計順同期。P3-2 `PluExcludedProduct` / `PluExcludedProductResponse` の `jan_code` / `name` を 33-biz / 41-cmd / Boundary に同期。P3-3 RTL の旧 prepare Err mock を、全件要修正時 message 契約の表示検証へ書き換え。

### Validation

- RED確認: `cargo test req402_excludes` が `PluExportPreparedResult.excluded` / `PluExcludedReason` 未実装で失敗。
- Targeted Rust:
  - `cargo test req402_excludes` -> PASS
  - `cargo test v3_adds_plu_target` -> PASS
  - `cargo test req402_deduplicates` -> PASS
  - `cargo test seed_req402_supports_plu_export_three_bucket_demo` -> PASS
  - `cargo test accepts_target_codes_exceeding_row_limit` -> PASS
  - `cargo test stores_plu_target_from_request` -> PASS
  - `cargo test sets_plu_dirty_when_plu_target_turns_on` -> PASS
  - `cargo test derives_plu_target_like_backfill` -> PASS
- Acceptance review Round 1 targeted:
  - `cargo test req402_ --lib` -> PASS（20 tests）
  - `npm test -- PluExportPage.test.tsx` -> PASS（1 file / 15 tests）
- Rust full:
  - `cargo test` -> PASS（593 unit + 14 generate_traceability + architecture/design/seed/doc-tests）
  - `cargo fmt --check` -> PASS
  - `cargo clippy --all-targets --all-features -- -D warnings` -> PASS
- Frontend:
  - `npm run typecheck` -> PASS
  - `npm run lint` -> PASS
  - `npm run format:check` -> PASS
  - `npm test` -> PASS（83 files / 506 tests）
  - `npm run build` -> PASS
- Generated:
  - `cargo run --bin generate_bindings` -> updated `src/lib/bindings.ts`
  - `cargo run --bin generate_traceability` -> updated `docs/function-design/90-traceability.md`
  - `cargo run --bin generate_traceability -- --check` -> OK（ERROR 0 / WARN 0）
- Docs:
  - `bash scripts/doc-consistency-check.sh` -> PASS
  - `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-03-d028-janless-plu-implementation.md` -> PASS
  - `bash scripts/check-env-safety.sh` -> PASS
  - `git diff --check` -> PASS
- Seed:
  - `cargo run --bin seed_demo_data -- --reset`（TTY `yes`）-> products 106 inserted / receiving 100 / sale_records 300 / sale_auto 300 / completed

### Review / Manual Follow-up

- R3 review-only sub-agent: `Ramanujan` の P2 2件 / P3 1件を反映済み。
  - P2: Test Matrix の BIZ 重要行不足 -> `confirm accepts target codes exceeding row limit`、create/update/import の `plu_target` 契約テストを追加。
  - P2: repo 直下の未追跡 SQLite DB -> `src-tauri/*.db` を `.gitignore` に追加し、PR誤追加を防止。
  - P3: unknown excluded reason fallback -> UI fallback を `要修正（詳細不明）` に変更し RTL を追加。
- Windows native / CV17 / SR-S4000 latest app-generated `.txt` 実機確認は Draft PR #124 body の pending checklist に残す。PR #122 と同じく、承認済みfield fileとの構造一致を根拠にmerge blockerからは外す。

## Review Response

レビュー後に記入。
