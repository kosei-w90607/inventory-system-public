# Plan Packet: PLU bulk onboarding 実装（実装 B）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: f0cd25c
- Amendments: fd2fd5f, 2650408, fa1659f, d7e4ed1, a8487b7, e72c1ce
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet subagent（独立、Writer と別 context）
- Final Reviewer: Sonnet subagent（独立、Writer と別 context）
- Reviewed Content HEAD: e72c1ce
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval / human visual confirmation（Windows native、UI-01a badge・`plu` filter・一括操作 dialog・結果表示、UI-01c preview `PLU対象` 列 + warning。レジ / CV17 は不要 = `67-ui §67.12` scope 明文化に従う）/ Ready / merge

Transition narrative（append-only）:

- 本 packet 作成 commit で kickoff → spec-check → design → plan-draft → plan-gate を materialize する。evidence: task scope と Risk は本 packet に記録（kickoff → spec-check）/ in-scope source docs は Design Sources に列挙し、PR #84 正本化済み + 本 PR 内の追随（Required Design Artifacts）で実装可能と判定（spec-check → design）/ 設計判断は Spec Contract に確定、未解決の設計問題なし（design → plan-draft）/ packet + Test Design Matrix を同一 commit で commit（plan-draft → plan-gate）。
- branch `agent/plu-bulk-onboarding-implementation` は PR #85 branch `agent/plu-slot-core-implementation`（`92bd76f`）の上に stack する（PR #85 packet Human Gate Proposal の「店舗訪問遅延時は実装 B を本 branch の上に stack して runway を止めない」規定。owner 判断 2026-08-19、介入に数えない）。Draft PR の base は PR #85 branch とし、PR #85 merge 後に base を main へ付け替えて rebase + L1 再取得する。PR #85 が L3 round 2 で gated amendment（`PLU_CLEAR_ROW_ENABLED=false` 等）を受けた場合も本 packet の契約は clear 行挙動に依存しないため契約面の影響はない。file-level の衝突リスク: 両 lane が `67-ui-plu-export.md`（lane 1 は §67.8 / §67.9 / C17、lane 2 は §67.12 末尾の scope 条項）と `src/lib/bindings.ts`（再生成）を触るが、lane 2 は lane 1 の現 HEAD を base に持つため衝突は lane 1 が merge 前に同 file を再変更した場合のみ発生し、その際は lane 1 merge 後の base 付け替え rebase で解消して L1 を再取得する（lane 2 の Ready は lane 1 merge 後にしか来ない train 順序）。Wave Operation の「file footprint 互いに素 / 生成 file は 1 lane」規則は並行 merge を前提とした条件であり、本 wave 5 は逐次依存の stacked train（lane 2 は lane 1 の merged state へ rebase してから Ready）なので適用対象外と整理する。stacked train の扱いは `docs/DEV_WORKFLOW.md` Wave Operation に未定義のため、明文化は別の workflow docs PR（follow-up）とし、本 packet では Wave Registry wave 5 の注記 + 本 narrative を根拠とする。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 45分（Windows native visual confirmation 15 分程度を含む）
- relay 往復上限: 2
- Plan Review round 天井: 3（既定 hard cap）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` に従う。介入は decision point 単位で計上する（想定 = plan approval / visual confirmation の結果報告 / Ready 承認）。本 plan-draft の Draft PR 作成は owner 介入を消費しない。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
商品 CSV 取込み契約（任意列 `PLU対象` の受理・正規化・行 error）、Tauri command 新設（`bulk_set_plu_target`）+ 既存 command の DTO 拡張（`search_products` の `plu` filter）+ generated bindings、商品一覧の URL search param（`plu`）、filter 一致全件を 1 transaction で更新する operator workflow（誤実行で PLU slot の解放・未反映化が一括で起きる）、D-052 invalidation 契約の追加（C19）を同時に変更する。schema 変更はなく、会計・在庫系列（D-025 / SPEC-PLS-D8）には触れない。

## Goal

Goal Invariant:

### 最小完了条件

- operator が商品一覧で PLU 移行状態（`対象外` / `未反映` / `反映済み`）を商品ごとに読め、`plu` filter で絞り込め、現在の filter 一致全件を「PLU 対象にする / 対象から外す」で件数確認のうえ一括更新できる。
- operator が商品 CSV に任意列 `PLU対象`（`1` / `0` / 空欄）を書いて取込みでき、`1` だが JAN 不備の行は preview で warning + 実適用値 `対象外` を読んだうえで取込める。
- 一括 ON は未廃番かつ有効 13 桁 JAN の商品だけを対象化（0→1 のみ `plu_dirty=1`）、一括 OFF は filter 一致全件を対象外化し 1→0 は PR #85 の共通解放 service を同一 TX で呼ぶ。結果（更新 / JAN 不備 skip / 廃番 skip）が operator に見える。

### 失敗定義

- 一括操作が page 内だけ、または `plu` filter を無視した集合に作用する（operator が見ている filter 全件と一致しない）。
- 一括 ON が既に対象の商品の `plu_dirty` を立て直し、反映済みを未反映へ戻す。
- 一括 OFF の 1→0 で slot 解放 trigger が呼ばれない、または TX 途中失敗で商品更新 / slot 解放 / operation_log が部分的に残る。
- CSV `PLU対象` の `1` / `0` / 空欄 以外が黙って受理される、または `1` + JAN 不備が warning なしに `1` で保存される。
- `plu` filter の server-side 条件が UI-01a-D10 の導出式（`plu_target × plu_dirty`）と不一致。

### 非目的

- PLU slot の照合 / 予約 / 解放 / 書出しロジックの変更（PR #85 の責務、本 packet は呼び出すのみ）。
- 受入台本第2版（⑤）、商品一覧の他 filter / sort の変更、CSV 取込みの既存列契約の変更。

## Scope

In scope:

1. IO-03 / BIZ-01 CSV 任意列 `PLU対象`（`26-io §IO-03-D1` / `30-biz §4.8〜4.9` / SPEC-PLS-D6 (a)）: `preview_import` が header `PLU対象` を読み `1` / `0` / 空欄のみ受理（他は行 error、`POS在庫連動` の `true/はい` 系同義語は受理しない = 設計どおり）。`ImportRow` に `plu_target: Option<bool>`（正規化済み適用値。空欄 / 列なし = `None`）と `warnings: Vec<String>`（`1` + JAN 不備 → warning 文言 + `Some(false)` へ正規化）を追加。`commit_import` は新規行 = `Some` なら適用 / `None` なら既存導出規則（`should_default_plu_target`）、上書き行 = `Some` なら適用（1→0 と JAN 変更は同一 TX で共通解放 service）/ `None` なら既存値維持。
2. BIZ-01 `bulk_set_plu_target(conn, filter: ProductBulkFilter, plu_target: bool) -> Result<BulkPluTargetResult, BizError>`（`30-biz §4.9.1`）: `ProductBulkFilter { keyword, department_id, is_discontinued, plu }` = 商品一覧 filter と同一意味（page / per_page なし）。型は `db::product_repo` 所有で `biz/mod.rs` が再 export（`ProductSearchQuery` と同じ。gated amendment 2）。ON = filter 一致のうち未廃番 + 有効 13 桁 JAN（13 桁数字 **かつ** check digit 有効。既定導出 `should_default_plu_target`（BIZ-01-D2、ASCII 13 桁のみ）とは別の適格 predicate。CSV `PLU対象=1` の JAN 不備判定（30-biz §4.8: 13 桁数字でない、または check digit 不正）と同一、gated amendment 4）かつ `plu_target=0` の行を `plu_target=1, plu_dirty=1`、既に 1 の行は無変更、廃番 / JAN 不備は skip 件数。OFF = filter 一致全件のうち `plu_target=1` を 0 にし、各行で `plu_export_service::release_plu_slot_for_jan` を呼ぶ。1 TX、`operation_logs` に filter 正規化要約 + 要求値 + 4 件数（JAN 一覧は残さない）。result = `matched_count / updated_count / invalid_jan_skipped_count / discontinued_skipped_count`。
3. IO `product_repo`: filter 一致全件を取得する unpaged 読取り `find_products_for_bulk_plu_target(conn, &ProductBulkFilter)`（`20-io` 本文で既に命名済みの名を維持。fenced signature を追加し、同 prose の「keyword / department / discontinued 条件」に `plu` を追記）と `ProductSearchQuery.plu: Option<PluMigrationFilter>`（`20-io §search_products` 設計済み: Target / Pending / Synced / Excluded の WHERE 条件、All は無条件）。`PluMigrationFilter` は db 層 enum（serde `rename_all` + specta）。`ProductSearchQuery.plu` は `#[serde(default)]` 付き（specta の `?:` 生成のため。Contract Probe 参照）。
4. CMD-01 `bulk_set_plu_target` command（`40-cmd §bulk_set_plu_target`）: `lib.rs` `collect_commands!` + `generate_handler!` 双方へ登録（60 → 61）、`cargo run --bin generate_bindings` で `src/lib/bindings.ts` 再生成（`bulkSetPluTarget` / `ProductBulkFilter` / `BulkPluTargetResult` / `PluMigrationFilter` / `ImportRow.plu_target` / `ImportRow.warnings` / `ProductSearchQuery.plu`）。
5. UI-01a（`50-ui` UI-01a-D10 / D11）: `search.ts` に `plu` param（`all|target|pending|synced|excluded`、既定 `all`、無効値は `all` へ正規化、`discontinued` と同じ `OPTIONS / normalizeEnum / payload` 機構）と filter UI（SegmentedControl 同列）、一覧に独立「PLU」列（3 語彙 text badge + 補助 icon、色のみ符号化なし、行減衰なし）、一括操作ボタン「PLU 対象にする」「PLU 対象から外す」→ `AlertDialog`（現在の filter 一致件数 = 一覧 query の `total_count` を表示）→ `commands.bulkSetPluTarget(filter, plu_target)` → 結果 toast（DSR-03: 完了通知）+ 失敗時は destructive Alert → D-052 C19 invalidation。
6. UI-01c（`60-ui` UI-01c-D16）: preview 表に `PLU対象` 列（表示値 `対象` / `対象外` / `既定（13桁JANなら対象）`）と同行 warning（text + icon）、列の意味説明 1 行。
7. D-052 C19（`bulk_set_plu_target` 成功）: `src/lib/invalidation-contract.ts` `pluBulkTarget` = `productList.root / pluDirty / productForm.root / pluSlotSummary`。同一 PR で独立 oracle test、`decision-log.md` D-052 Contract 行、`UI_TECH_STACK.md §2.5`、`50-ui` に新規決定行 `UI-01a-D12`（一括操作成功後の invalidation = D-052 C19 を引用。50-ui は現状 D-052 参照行を持たないため更新ではなく新設）を追加（PR #85 Final Review P2 の再発防止）。
8. source doc 追随（Required Design Artifacts 参照）: `30-biz §4.9.1` / `40-cmd` / `cmd-task-specs` の `ProductBulkFilter` に `plu` を追加（理由は Spec Contract B-D2）、`30-biz §4.9.1` に「既に 1 の行は無変更」を明記、`40-cmd §search_products` に `plu` を追記、`50-ui` に PLU 列の置き場（独立列、DSR-04 判定）、`67-ui §67.12` に native L3 の scope 条項 + `decision-log` D-073、fenced signature（`20-io` / `30-biz` / `40-cmd`）、REQ-907 traceability 再生成。
9. PR #85 Final Review P3 follow-up の消化（Rust test 追加のみ）: A-S1 を「既存 v4 fixture DB → migrate → `plu_slots` 4,784 行」形へ（B-F1）、A-N8b に「`reservation_dropped` 後の再 prepare で別 slot 予約」oracle 追加（B-F2）。

## Non-scope

- `plu_slots` / migration / IO-02 / IO-04 / BIZ-04 prepare・confirm・解放ロジックの変更（PR #85）。
- 商品一覧の他 filter・sort・ページング、CSV 取込みの既存列 / 重複判定 / 初期在庫規則、商品 form の `plu_target` 編集。
- 受入台本第2版（⑤）、UI-08 の変更、売上・在庫・会計系列。
- `PluMigrationFilter` を `ProductBulkFilter` 以外の command に広げること。

## Acceptance Criteria

- `cargo test` で B-C1〜B-C5（CSV `PLU対象`: 列あり `1` / `0` / 空欄 / 不正値 → 行 error / `1` + JAN 不備 → warning + `Some(false)` / 上書き行の既存値維持と 1→0 解放）が通る。
- B-L1〜B-L7: filter 一致全件（page 外を含む fixture）を対象、ON の skip（JAN なし / 8 桁 / check digit 不正 / 廃番）と既に 1 の行の無変更（`plu_dirty` 不変）、OFF 全件 + 各 1→0 で `release_plu_slot_for_jan`（reserved → free / active → release_pending を `plu_slots` で assert）、TX 途中失敗で商品 / slot / operation_log とも無変化、operation_logs の要約（JAN 非含有）、`plu` を含む filter が一覧 `search_products` の同 filter と同じ集合を返す。
- B-S1〜B-S2: `ProductSearchQuery.plu` の 5 値で WHERE 条件が `20-io` の定義と一致（fixture: 0/0, 1/1, 1/0 の 3 商品で各 filter の件数）、`plu` 省略 / `null` は All。
- B-V1〜B-V3（RTL）: 3 語彙 badge の導出（`plu_target × plu_dirty`）と text / icon 併用、`plu` URL param の復元・無効値正規化・`discontinued` との併用、一括操作 dialog の件数表示 → confirm で `bulkSetPluTarget` が現在の filter（`plu` 込み）で呼ばれる → 結果 toast、cancel で呼ばれない。
- B-P1（RTL）: preview の `PLU対象` 列表示値と warning 行の表示（色以外）。
- B-W1〜B-W3: bindings 再生成 diff 0、`collect_commands!` / `generate_handler!` 双方 61、`design_compliance_test` unexpected 0、`generate_traceability --check` PASS（REQ-907 に B-* test 付与）。
- B-I1: `npx vitest run src/lib` で D-052 C19 の独立 oracle test（C1〜C19 の完全一致比較、production SSOT 非 import）PASS、`decision-log.md` / `UI_TECH_STACK.md` / `50-ui` に C19 記載。
- B-F1 / B-F2: `cargo test` で PR #85 P3 follow-up test（v4 fixture → migrate、`reservation_dropped` 後の再予約）が追加され PASS。
- B-G1: `rg -n "PLU対象" src-tauri/src/biz/product_service.rs` で `"1"` / `"0"` / 空のみ受理（`true` / `はい` 同義語なし）を reviewer が実読確認（sweep は `rg -n '"はい"|"true"' src-tauri/src/biz/product_service.rs` の hit が `POS在庫連動` 行のみ）。
- L1 `scripts/local-ci.sh full` PASS、Writer 完了時 `cargo check --release` PASS、owner の Windows native visual confirmation（Human Gate Proposal の checklist）結果を PR body に記録、hosted CI と exact-HEAD 三点一致。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-907 / REQ-104 / `docs/spec/requirements-coverage.md` REQ-907 行
- Architecture: `docs/architecture/biz-task-specs.md` BIZ-01-D4 / SPEC-PLS-D6 節、`io-task-specs.md` IO-03-D1、`cmd-task-specs.md` `search_products` / `bulk_set_plu_target` 行、`ui-task-specs.md` UI-01a / UI-01c
- Function / command / DTO: `docs/function-design/30-biz-product-service.md §4.8〜4.9.1`（BIZ-01-D2 / D4）/ `26-io-product-csv-importer.md` IO-03-D1 / `20-io-product-repo.md §search_products`（`ProductSearchQuery.plu`）/ `40-cmd-product.md §bulk_set_plu_target`（CMD-01-D4）/ `33-biz-plu-export-service.md §16.6`（共通解放 service、呼ぶのみ）
- Screen / UI: `docs/function-design/50-ui-product-list.md` UI-01a-D10 / D11 + search param 表 / `60-ui-product-import.md` UI-01c-D16 / `docs/design-system/01-decision-rules.md` DSR-03 / DSR-04 / DSR-07
- Decision log / ADR: `docs/decision-log.md` D-072（段階導入）/ D-052（invalidation SSOT）/ D-028
- 前便: PR #85 packet `docs/plans/2026-08-18-plu-slot-core-implementation.md`（共通解放 service / `plu_slot_repo` / Final Review P3 follow-up）、archive `docs/archive/plans/2026-08-18-plu-slot-onboarding-design.md` SPEC-PLS-D6 節 + Matrix B-* 予約（durable 設計は上記 source docs が正本）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 30-biz §4.8〜4.9.1 / 20-io §search_products / 26-io IO-03-D1 / 33-biz §16.6 | updated in this PR（30-biz §4.8: `ImportRow` fenced 定義に `warnings: Vec<String>` 追加（gated amendment 1）/ 30-biz §4.9.1: `ProductBulkFilter` に `plu` 追加 + 「既に 1 の行は無変更」明記 + fenced signature は既存 / 20-io: `find_products_for_bulk_plu_target` の fenced signature 追加 + 同 prose の filter 条件に `plu` 追記、`ProductSearchQuery.plu` は既存 / 26-io: 不変） |
| Command / DTO / generated binding / wire shape | 40-cmd §bulk_set_plu_target + §search_products / cmd-task-specs | updated in this PR（40-cmd: 戻り値を `BulkPluTargetResult`（BIZ 型を直接返す既存慣行、gated amendment 1）へ訂正、`ProductBulkFilter` に `plu`、`search_products` 節に `plu` 追記 / cmd-task-specs: 同期） |
| DB / transaction / audit / rollback / migration | plu-tables.md / 22-mnt | existing sufficient（schema 変更なし。operation_logs は既存 table） |
| Screen / UI / route state / Japanese wording | 50-ui UI-01a-D10 / D11 + search param 表 / 60-ui UI-01c-D16 / design-system DSR-03 / 04 / 07 | updated in this PR（50-ui: PLU 列の置き場 = 独立列（DSR-04 判定理由）+ 文言表（dialog / toast / badge）+ D11 の filter に `plu` を含む旨 / 60-ui: preview 表示値 3 種の文言） |
| CSV / TSV / report / import / export format | 26-io IO-03-D1 / 30-biz §4.8 | existing sufficient（値文法 `1` / `0` / 空欄、不正値 = 行 error、`1` + JAN 不備 = warning + 0 は設計済み） |
| Invalidation contract | decision-log D-052 / UI_TECH_STACK §2.5 / `src/lib/invalidation-contract.ts` / 50-ui | updated in this PR（C19 追加、SSOT + 独立 oracle + decision-log + UI_TECH_STACK + 50-ui 新規 `UI-01a-D12` を同一 PR） |
| Human Gate scope | 67-ui §67.12 / decision-log | updated in this PR（§67.12 に scope 条項: CV17 / SR-S4000 を伴う native L3 は PLU file 形状・レジ向け field 値・書出し / confirm / 復帰の operator flow に触れる PR に必須、触れない PR は human visual confirmation のみ。D-073 として記録、owner 提案 2026-08-19） |
| Durable decision / ADR | D-072 / D-052 / D-073（新設） | updated in this PR（D-073 新設、D-052 C19） |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command `bulk_set_plu_target` | `lib.rs` `collect_commands!` + `generate_handler!` 双方へ登録（60 → 61）/ `#[tauri::command]` + `#[specta::specta]` / `cargo run --bin generate_bindings` → `src/lib/bindings.ts` 再生成（B-W1）。fenced signature は `40-cmd` に既存 |
| 新規 pub fn（BIZ-01 `bulk_set_plu_target` / `product_repo` unpaged 読取り + bulk 更新 helper） | `30-biz §4.9.1`（既存 fenced）/ `20-io`（新規 fenced）に signature、`design_compliance_test` PASS（B-W2）。`KNOWN_ALLOWLIST` 追加は原則禁止 |
| 新 type（`ProductBulkFilter` / `BulkPluTargetResult` / `PluMigrationFilter`、`ImportRow.plu_target` / `warnings`、`ProductSearchQuery.plu`） | `specta::Type` + serde（`ProductSearchQuery.plu` / `ImportRow.plu_target` は `#[serde(default)]` で TS 側 `?:`、`ImportRow.warnings: Vec<String>` は Rust 側 missing 許容のためにも `#[serde(default)]` 必須）、bindings 再生成 + consumer 同一 commit 切替（B-W1） |
| URL search param `plu` | `src/features/products/search.ts` の OPTIONS / schema / normalize / payload / patch の 5 箇所同時追加、`50-ui` search param 表は既存 |
| D-052 C19 | `invalidation-contract.ts` `pluBulkTarget` + 独立 oracle test + `decision-log.md` D-052 Contract 行 + `UI_TECH_STACK.md §2.5` + `50-ui` 新規決定行 `UI-01a-D12`（B-I1） |
| REQ-907 test 付与 | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成、`--check` PASS（B-W3）。hand edit 禁止 |
| decision-log D-073 / 67-ui §67.12 scope 条項 | 同一 PR。`doc-consistency-check.sh` PASS |
| route / navigation / operator 画面新設 | 該当なし（既存 `/products` と `/products/import` 内の変更） |
| Consultation Relay | 該当なし |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-104 / REQ-907 / SPEC-PLS-D6 (a) | 30-biz §4.8〜4.9 / 26-io IO-03-D1 / 60-ui UI-01c-D16 | BIZ-01-D4 / IO-03-D1 / UI-01c-D16 | CSV で初日商品群を一括対象化できる。値文法を `1` / `0` / 空欄に限定し、`1` + JAN 不備は要修正バケットへ流さず warning + 0（rejected: 行 error 化 = 取込み全体を止める） | `preview_import` / `commit_import` / `ImportRow` / preview 表 | B-C1〜B-C5 / B-P1 |
| REQ-907 / SPEC-PLS-D6 (b) | 30-biz §4.9.1 / 40-cmd §bulk_set_plu_target / 50-ui UI-01a-D11 | BIZ-01-D4 / CMD-01-D4 / UI-01a-D11 | page 内でなく filter 一致全件（operator の期待）。filter に `plu` を含める（B-D2、rejected: `q / dept / discontinued` のみ = `対象から外す` が未反映分を巻き込む）。1 TX + 件数 dialog（DSR-07: filter 全件の高影響操作） | `bulk_set_plu_target` / `ProductBulkFilter` / command / 一覧 UI | B-L1〜B-L7 / B-V3 |
| REQ-907 / SPEC-PLS-D7（一覧） | 50-ui UI-01a-D10 / 20-io §search_products | UI-01a-D10 | 3 語彙（`plu_target × plu_dirty`）と `plu` URL filter で段階移行を商品単位で追跡。独立列（B-D3、DSR-04: この画面では移行状態が filter / 一括操作の主情報）。rejected: `plu_exported_at` 基準（再対象化で stale、archive 記録） | badge / `search.ts` / `ProductSearchQuery.plu` | B-V1 / B-V2 / B-S1 / B-S2 |
| D-052 | decision-log D-052 / UI_TECH_STACK §2.5 | C19 | bulk 成功後に一覧 / home 未反映 / 商品 form / slot 要約を stale 化 | `invalidation-contract.ts` | B-I1 |
| D-072 Human Gate | 67-ui §67.12 | D-073 | file 形状・レジ挙動に触れない PR に CV17 / SR-S4000 L3 を課さない（owner 提案、PR #85 L3 round 1 の観測起源） | 67-ui §67.12 / decision-log | review / Human Gate |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: はい。SPEC-PLS-D6 / D7 の what / why は PR #84 で `30-biz` / `40-cmd` / `50-ui` / `60-ui` / `20-io` / `26-io` に正本化済み。本 packet で足すのは `ProductBulkFilter.plu`（B-D2）/ 既に 1 の行の無変更（B-D1）/ PLU 列の置き場（B-D3）/ 文言表 / §67.12 scope（D-073）で、いずれも同一 PR で source docs へ書く。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: B-D1〜B-D4（Spec Contract）→ 30-biz / 40-cmd / cmd-task-specs / 50-ui / 60-ui、D-073 → decision-log + 67-ui。
- Assumptions and constraints: PR #85 の共通解放 service `release_plu_slot_for_jan` と `plu_slots` が存在する（stack 前提）。`should_default_plu_target`（backend、ASCII 13 桁）と `suggestPluTarget`（frontend）の二重実装は BIZ-01-D2 の意図どおり維持し **改変しない**。bulk ON / CSV 明示 `1` の適格判定は check digit 込みの別 predicate（backend のみ）で、既定導出とは意図的に異なる（既定導出は入力補助、明示 / bulk は書出し適格性、gated amendment 4）。商品数は数千規模で unpaged 読取り + 1 TX は許容（per-row 解放は `release_plu_slot_for_jan` 1 回 / 行）。
- Deferred design gaps, risk, and follow-up target: D-052 C2（商品 update の 1→0 解放）が `pluSlotSummary` を invalidate していない既存 gap は本 packet で触れない（Review Focus に記録、follow-up）。stacked train（逐次依存 lane）の Wave Operation 上の扱いは `DEV_WORKFLOW.md` に未定義 → 別 workflow docs PR で明文化（follow-up、Plan Gate round 1 P2-6）。preview の `既定` 表示は新規行のみ意味を持ち、上書き行の空欄 = 既存値維持は説明文で補う。
- Test Design Matrix can cite design decision IDs or source doc sections: はい（B-C / B-L / B-S / B-V / B-P / B-W / B-I / B-F / B-G）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 「一括 ON は反映済みを未反映に戻さない」は `plu_target=0` の行だけを更新することで保証（B-L3）。「一括 OFF は見えている集合だけ」は `ProductBulkFilter` が一覧 filter と同型（`plu` 込み）であることで保証し、UI は一覧 query と同じ正規化 filter を渡す（B-V3 で call 引数を assert）。例外: dialog 表示後〜実行までに他操作でデータが変わった場合、matched_count が dialog の件数と異なり得る（結果 toast に matched を出す、escape hatch）。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | IO-03 は raw 値 parse のみ、意味付けは BIZ-01。CMD は TX / 解放判定を持たない（40-cmd） | 30-biz / 40-cmd |
| Fact check / design decision split | PR #85 L3 round 1 の観測（`単品売り`）は本 packet の対象外。owner 提案「file 形状に触れない PR は実機 L3 不要」を D-073 として design decision 化 | decision-log D-073 / 67-ui §67.12 |
| Lifecycle / retry | bulk は冪等（ON 再実行 = updated 0、OFF 再実行 = updated 0）。TX 失敗は全 rollback、再実行可 | B-L5 / B-L3 |
| Operator workflow | filter → 件数 dialog → 実行 → toast。dialog 文言は「レジに登録する」と言わない（UI-08-D2 と同じ: 書出し + CV17 取込みが別途必要） | 50-ui 文言表 / B-V3 |
| Replacement path | 旧 `ImportRow`（`plu_target` なし）の localStorage / 旧 bindings 利用はない（preview → commit は同一 session）。`#[serde(default)]` で旧 payload も deserialize 可 | Boundary |
| Data safety / evidence | 実 JAN / 商品名は fixture に使わない。operation_logs に JAN 一覧を残さない | Data Safety / B-L6 |
| Reporting / accounting semantics | 不変（SPEC-PLS-D8） | — |
| Manual verification | Windows native visual（badge / filter / dialog / toast / preview 列）。CV17 / SR-S4000 不要（D-073） | Human Gate Proposal |
| 環境・再現性 | 新設の環境依存なし | — |

## Design Readiness

- Existing design docs are sufficient because: PR #84 で D6 / D7 の契約（値文法、skip 規則、filter 全件、3 語彙導出、`plu` WHERE 条件、preview 表示）が関数 / command / 画面 doc に正本化済み。
- Source docs updated in this PR: Required Design Artifacts の「updated in this PR」行（`ProductBulkFilter.plu` / 既に 1 の行 / PLU 列置き場 + 文言表 / `40-cmd §search_products` の `plu` / 20-io fenced / D-052 C19 / 67-ui §67.12 scope + D-073）。
- Design gaps intentionally deferred: D-052 C2 の `pluSlotSummary` gap（follow-up）。
- Durable decisions discovered in this plan and promoted to source docs: B-D1〜B-D4、D-073。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI-01a / UI-01c → `product_cmd` → `product_service`（TX 所有、解放判定）→ `product_repo` / `plu_export_service::release_plu_slot_for_jan` / `plu_slot_repo`。
- Backend function design: `30-biz §4.8〜4.9.1`。
- Command / DTO / data contract: `40-cmd` / `cmd-task-specs` / Boundary 節。
- Persistence / transaction / audit impact: 1 TX、operation_logs 1 行（filter 要約 + 件数）、schema 不変。
- Operator workflow / Japanese UI wording: `50-ui` 文言表（本 PR 追記）: badge `対象外` / `未反映` / `反映済み`、ボタン `PLU 対象にする` / `PLU 対象から外す`、dialog title `表示中の商品をPLU対象にしますか` / `表示中の商品をPLU対象から外しますか`、description `現在の絞り込み条件に一致する {n} 件が対象です。レジへの反映には PLU 書出しと PC ツールの取込みが別途必要です。`、結果 toast `{updated} 件を更新しました（JAN 不備 {a} 件 / 廃番 {b} 件は対象外）`、preview 列 `PLU対象` 表示値 `対象` / `対象外` / `既定（13桁JANなら対象）`、warning `JAN が13桁でないため対象外として取り込みます`。
- Error, empty, retry, and recovery behavior: matched 0 は dialog で `対象 0 件` を示し実行ボタン無効、command 失敗は destructive Alert + 再試行、TX rollback で無変化。
- Testability and traceability IDs: REQ-907 / REQ-104 を B-* test に付与、`90-traceability.md` 再生成。

## Contract Probe

- `#[serde(default)]` の役割は TS 側の optional key（specta が `plu?: PluMigrationFilter | null` を生成し、`plu` 未指定の既存 TS caller が型 error にならない）である。Rust 側の missing field → `None` は `Option<T>` の serde 組込み挙動で、属性の有無に依存しない（round 3 reviewer が scratch crate で実証）。precedent: `ProductUpdateRequest` は container-level `#[serde(default)]`（`product_service.rs:47`）を持ち `bindings.ts` で `plu_target?: boolean | null`、属性なしの型では `plu_target: boolean | null`（必須 key）になる -> `ProductSearchQuery.plu` と `ImportRow.plu_target` に field-level `#[serde(default)]` を付けて `?:` を得る。`ImportRow.warnings: Vec<String>` は missing → Err になるため `#[serde(default)]` が Rust 側でも必須。実装時に bindings diff で再確認（B-W1）。
- `AlertDialog` で件数付き確認を出す既存実装: `AdditionalImportConfirmDialog.tsx`（件数 `toLocaleString("ja-JP")` 表示、open / onCancel / onConfirm）-> 同型で流用可。
- その他の外部前提なし（CV17 / レジは本 packet の対象外）。

## Mechanical Implementation Inventory

| 層 | 既存 anchor | 変更 | Matrix |
|---|---|---|---|
| IO-03 | `io/product_csv_importer.rs` `ParsedRow.fields`（header 非 allowlist、未知列は raw 保持） | 変更なし（`PLU対象` は fields に乗る） | B-C1 |
| BIZ-01 import | `biz/product_service.rs` `preview_import`（`POS在庫連動` parse block が同型）/ `commit_import` insert 経路（`should_default_plu_target`）/ overwrite 経路（`ProductUpdates.plu_target = None` + JAN 変更解放） | `PLU対象` parse（`1` / `0` / 空）+ JAN 不備 warning、`ImportRow.plu_target` / `warnings`、commit 両経路の適用規則 + 1→0 解放 | B-C1〜B-C5 |
| BIZ-01 bulk | `product_service.rs` `update_product` の 1→0 解放 block（`release_plu_slot_for_jan`）/ `toggle_discontinue` | `bulk_set_plu_target` 新設（TX 所有、operation_log） | B-L1〜B-L7 |
| IO repo | `db/product_repo.rs` `ProductSearchQuery` / `search_products` WHERE 構築 | `plu: Option<PluMigrationFilter>` + WHERE、unpaged 読取り fn、bulk 更新 helper | B-S1 / B-S2 / B-L1 |
| CMD | `cmd/product_cmd.rs`（biz 型を直接 return する慣行）/ `lib.rs` 2 macro | `bulk_set_plu_target` + 登録 61 | B-W1 |
| UI-01a | `features/products/search.ts`（`discontinued` 機構）/ `ProductListPage.tsx` filter 行 + `ProductTable.tsx` / `components/ui/alert-dialog.tsx` / `AdditionalImportConfirmDialog.tsx`（件数 dialog 先例） | `plu` param、PLU 列 badge、一括ボタン + dialog + toast | B-V1〜B-V3 |
| UI-01c | `features/products/import/ProductImportPreview.tsx` `ImportRowsTable`（5 列） | `PLU対象` 列 + warning | B-P1 |
| D-052 | `src/lib/invalidation-contract.ts` / oracle test / decision-log / UI_TECH_STACK | C19 | B-I1 |
| docs | 30-biz / 40-cmd / cmd-task-specs / 50-ui / 60-ui / 20-io / 67-ui / decision-log / 90-traceability | Required Design Artifacts | B-W2 / B-W3 |

## Oracle Replacement Ledger

| 既存 test / oracle | 置換理由 | 新 oracle | Matrix |
|---|---|---|---|
| `test_commit_import_req104_derives_plu_target_like_backfill_and_keeps_on_overwrite` | 列なし時の挙動は不変のため維持。列あり case は新規 test で追加（既存 test 改変禁止） | 維持 + B-C1〜B-C5 新規 | B-C4 |
| `ProductListPage.test.tsx` / `ProductImportPage.test.tsx` 既存 assert | 既存 filter / 列の assert は不変。PLU 列 / `plu` param / dialog は新規 test | 維持 + 新規 | B-V1〜B-V3 / B-P1 |
| `ProductListPage.test.tsx` 既存 test（一覧 empty 系）への追加 assert | 一覧 0 件で一括操作ボタン 2 種が disabled であることを既存の empty case に追記（既存 expected 値は不変、Final Review P2 で Ledger 追記） | 既存 assert 維持 + `toBeDisabled()` 2 件追加 | B-V3 |
| `search.test.ts` 既存 test（descriptor 一致）への追加 assert | `PRODUCT_PLU_OPTIONS` の descriptor 検査を既存 descriptor test に追記（既存 expected 値は不変、同上） | 既存 assert 維持 + `PRODUCT_PLU_OPTIONS` block 追加 | B-V2 |
| D-052 oracle test（C1〜C18 完全一致） | C19 追加で期待集合を独立転記更新 | C1〜C19 | B-I1 |
| `src/features/products/search.test.ts` / `src/features/products/hooks/useProductList.test.tsx` の default / normalize payload の exact object assert | `ProductSearchQuery.plu` と URL 既定値 `all` の追加で payload が 1 field 増える（`discontinued` 既定 `active` → `is_discontinued: false` と同じく既定値も送る契約、gated amendment 3） | default / 無効 URL → `plu: "all"`、有効値 → 対応 enum 値（既存 field の期待は不変） | B-V2 / B-S2 / B-W1 |

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| IO-03-D1（`PLU対象` raw 保持、列なしは error でない） | `product_csv_importer.rs`（不変） | B-C1（列あり）/ B-C4（列なし） | — |
| BIZ-01-D4 CSV: `1` / `0` / 空欄のみ受理、他は行 error | `preview_import` | B-C1 / B-C3 | — |
| BIZ-01-D4 CSV: `1` + JAN 不備 → warning + 0 | `preview_import` | B-C2 | visual（preview 表示） |
| BIZ-01-D4 CSV: 新規行 `None` → 既存導出 / 上書き行 `None` → 既存値維持 / `Some` 適用 + 1→0・JAN 変更で解放 | `commit_import` | B-C4 / B-C5 | — |
| BIZ-01-D4 bulk: filter 一致全件（page 外含む）、`plu` 込み（B-D2） | `bulk_set_plu_target` / unpaged 読取り | B-L1 / B-L7 | — |
| BIZ-01-D4 bulk ON: 未廃番 + 有効 13 桁 JAN のみ、0→1 だけ `plu_dirty=1`、既に 1 は無変更（B-D1） | 同上 | B-L2 / B-L3 | — |
| BIZ-01-D4 bulk OFF: 全件 0、1→0 は共通解放 service | 同上 | B-L4 | — |
| BIZ-01-D4 bulk: 1 TX rollback / operation_logs 要約 | 同上 | B-L5 / B-L6 | — |
| CMD-01-D4 command + DTO、CMD は TX / 判定を持たない | `product_cmd.rs` | B-W1 + review | — |
| 20-io `ProductSearchQuery.plu` WHERE 5 値 | `product_repo.rs` | B-S1 / B-S2 | — |
| UI-01a-D10 3 語彙導出 + text / icon、`plu` URL param（既定 all、無効値正規化） | `ProductTable.tsx` / `search.ts` | B-V1 / B-V2 | visual |
| UI-01a-D11 件数 dialog → filter 全件 → 結果表示 | `ProductListPage.tsx` | B-V3 | visual |
| B-D3 PLU 独立列（DSR-04） | `ProductTable.tsx` | B-V1 | visual（密度） |
| UI-01c-D16 preview `PLU対象` 列 + warning | `ProductImportPreview.tsx` | B-P1 | visual |
| D-052 C19 | `invalidation-contract.ts` | B-I1 | — |
| DSR-03 toast / DSR-07 dialog | UI | B-V3 | visual |
| D-073 / 67-ui §67.12 scope | docs | review | — |
| SPEC-PLS-D8 不変 | — | 既存 test 維持 | non-scope |
| PR #85 P3 follow-up（A-S1 形 / A-N8b oracle） | Rust test | B-F1 / B-F2 | — |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-19-plu-bulk-onboarding-implementation.md`。Human Gate に visual confirmation を含むため Writer 完了時に `cargo check --release` を実行する。

- targeted tests: `cargo test`（`product_service` / `product_repo` / design_compliance / traceability）、`npx vitest run src/features/products src/lib`（RTL + D-052 oracle）。
- negative tests: CSV 不正値 / JAN 不備、bulk の skip 4 種、TX 途中失敗、`plu` 無効値、dialog cancel。
- compatibility checks: `plu` 省略の `search_products` 旧 payload、`ImportRow` 旧 shape の deserialize、既存 RTL 全 PASS。
- data safety checks: fixture は synthetic JAN（check digit 有効な架空 13 桁）、operation_logs に JAN 非含有。
- main wiring/integration checks: UI filter → `bulkSetPluTarget` → BIZ → repo + 解放 → invalidation（B-V3 + B-L4 + B-I1）、bindings diff 0、`collect_commands!` / `generate_handler!` 61。

## Boundary / Wire Contract

- producer: `product_cmd::bulk_set_plu_target` / `search_products`（`plu` 拡張）/ `preview_import`（`ImportRow` 拡張）
- consumer: `ProductListPage`（`commands.bulkSetPluTarget` / `searchProducts`）、`ProductImportPreview` / `useProductImportFlow`（`previewImport` → `commitImport`）
- wire type: `ProductBulkFilter { keyword: string | null, department_id: number | null, is_discontinued: boolean | null, plu: PluMigrationFilter | null }`、`BulkPluTargetResult { matched_count, updated_count, invalid_jan_skipped_count, discontinued_skipped_count }`（u32 → number）、`PluMigrationFilter = "all" | "target" | "pending" | "synced" | "excluded"`（serde rename_all snake/lowercase）、`ImportRow.plu_target: boolean | null`、`ImportRow.warnings: string[]`、`ProductSearchQuery.plu?: PluMigrationFilter | null`
- internal type: `PluMigrationFilter` enum と `ProductBulkFilter` struct は db 層 `product_repo` 所有（`ProductSearchQuery` と同じ慣行: `biz/mod.rs` が `pub use` で再 export し CMD は biz 経由で参照。`architecture_test` の db → biz 依存禁止を守るため、gated amendment 2）、`BulkPluTargetResult` は biz 層（cmd は直接 return）
- precision/range: 件数は usize → u32、商品数上限は実運用数千
- round-trip path: UI `search.ts` の正規化 filter → `buildProductSearchQuery` と同じ source から `ProductBulkFilter` を構築（page / per_page を除く）
- invalid input: `plu` 不明値 = serde error → CmdError（UI は `search.ts` で事前正規化）、CSV 不正値 = 行 error
- compatibility: `plu` / `plu_target` は `Option<T>` 組込みで Rust 側省略可 + `#[serde(default)]` で TS 側 `?:`、`warnings` は `#[serde(default)]` で省略可。既存 caller 無改変で動作

## Human Gate Proposal

Confirmed facts:

- 本 packet は PLU file 形状（IO-04 出力）・レジ向け field 値・書出し / confirm の operator flow に触れない。`67-ui §67.12` の checklist は UI-08 書出し flow に閉じており、一覧 / CSV preview の項目を含まない。archive 設計 packet は「件数確認 dialog の native 表示」を実装 B の L3 candidate として予約していた。
- owner は 2026-08-19 に「PLU 周りに新しく file / レジ挙動を加えない限りレジ + CV17 を使う試験は不要ではないか」と提案した（PR #85 L3 round 1 で product 行の CV17 受理は実証済み）。

Coordinator 提案:

- 採用: Human Gate = owner の Windows native visual confirmation のみ（レジ / CV17 / 店舗訪問不要）。checklist = (1) 商品一覧に PLU 列（`対象外` / `未反映` / `反映済み`、text + icon）が出て密度が許容範囲 (2) `plu` filter の 5 値で一覧が絞り込まれ URL に復元される (3) 一括操作ボタン → 件数付き dialog（文言がレジ反映を約束しない）→ 実行 → toast（更新 / skip 件数）→ 一覧 badge と home の未反映件数が更新 (4) 対象から外す → 商品詳細の `レジメモリNo.` は維持（release_pending、PR #85 契約）(5) CSV preview に `PLU対象` 列 + JAN 不備 warning が色以外で読める。synthetic CSV fixture（`PLU対象` 列あり、`1` / `0` / 空 / 不正値 / `1` + 8 桁 JAN の 5 行）は Ready 依頼と同時に渡す。
- 同時に `67-ui §67.12` へ scope 条項を追記し D-073 として記録する（上記 Required Design Artifacts）。Plan Gate reviewer はこの scope 判定の妥当性（本 packet が条項の「触れない」側に該当するか）を審査する。
- 不採用 alternative: 店舗で CV17 / SR-S4000 を伴う L3 を実施 — 本 packet の変更は file 1 byte も変えず、観測できる差分がないため不採用。
- 残る Human Gate = owner plan approval / visual confirmation 結果報告 / Ready / merge。

## Review Focus

- `ProductBulkFilter` が一覧 filter と同型（`plu` 込み）で、UI が一覧 query と同じ正規化 source から構築していること（B-V3 の call 引数 assert）。
- bulk ON が `plu_target=0` の行だけを更新し `plu_dirty` を立て直さないこと（B-L3 の fixture = 反映済み商品を含む）。
- bulk OFF の 1→0 が PR #85 の `release_plu_slot_for_jan` を呼び、`plu_slots` の遷移（reserved → free / active → release_pending）が A の契約と一致すること（B-L4）。
- CSV `PLU対象` の値文法が `1` / `0` / 空欄のみで、`POS在庫連動` の同義語集合を流用していないこと（B-G1）。
- `search_products` の `plu` WHERE が `20-io` の定義と 1 対 1（B-S1）、`#[serde(default)]` で旧 caller 互換（B-W1 の bindings diff）。
- D-052 C19 の 4 点同時更新（SSOT / oracle / decision-log / UI_TECH_STACK + 50-ui）。既存 gap だった C2 の `pluSlotSummary` 欠落は PR #85 gated amendment 5 で解消済み（本 PR 不変）。
- 67-ui §67.12 scope 条項 + D-073 の文面が、将来 PR の判定に使える粒度（「触れる / 触れない」の判定対象 3 種を列挙）になっていること。
- stack 運用の file-level 衝突（`67-ui-plu-export.md` / `bindings.ts`）: lane 1（PR #85）が merge 前に同 file を再変更した場合、base 付け替え rebase 後に L1 を再取得し、§67.12 条項と bindings 再生成結果が保たれていること。

## Spec Contract

Contract ID: SPEC-PLS-D6 / SPEC-PLS-D7（一覧）/ B-D1〜B-D4

- B-D1（30-biz §4.9.1 明確化）: bulk ON は `plu_target=0` かつ未廃番かつ有効 13 桁 JAN の行だけを `plu_target=1, plu_dirty=1` にする。既に `plu_target=1` の行は `plu_dirty` を含め無変更（2026-07-03 packet 内 ID D-3「0→1 のみ dirty」規則の明文化。`DB_DESIGN.md` の D-3 とは別物）。Test: B-L2 / B-L3。
- B-D2（30-biz §4.9.1 / 40-cmd / cmd-task-specs / 50-ui UI-01a-D11 追記）: `ProductBulkFilter` は一覧 filter と同型 `{ keyword, department_id, is_discontinued, plu }`、page / per_page を持たない。理由: operator が見ている filter 一致全件 = 操作対象でなければ、`plu=pending` で「対象から外す」が反映済みまで巻き込み、`plu=excluded` で「対象にする」の件数表示が一覧と食い違う。Test: B-L7 / B-V3。
- B-D3（50-ui 追記）: PLU 移行状態は商品一覧の独立列「PLU」に text badge + 補助 icon で表示し、行減衰は行わない（DSR-04: この画面では移行状態が `plu` filter と一括操作の主情報。rejected: 商品名セル内 badge + 行減衰 = PR #95 が廃番に採った形だが、廃番は少数行の従的属性で「表示中」badge を出さない前提が成り立つのに対し、PLU 3 語彙は全行に値があり多数派が `対象外` → `反映済み` へ移ろうため、セル内に全行 badge を置くと商品名の可読性（DSR-04 の Why）をより強く壊す。列は狭幅 3 文字 label、密度は visual confirmation で判定し過密なら「`対象外` は無表示 + 他 2 語彙のみセル内 badge」へ後退する follow-up 候補）。Test: B-V1 + visual。
- B-D4（60-ui / 30-biz §4.8）: `ImportRow.plu_target: Option<bool>` は正規化済み適用値（`1` + JAN 不備は `Some(false)` + `warnings` 1 件、空欄 / 列なしは `None`）。preview 表示値 = `対象` / `対象外` / `既定（13桁JANなら対象）`。commit は `Some` を適用、`None` は新規 = 既存導出 / 上書き = 既存値維持。Test: B-C1〜B-C5 / B-P1。
- SPEC-PLS-D7（一覧）: `PluMigrationFilter` 5 値の WHERE = Target `plu_target=1` / Pending `plu_target=1 AND plu_dirty=1` / Synced `plu_target=1 AND plu_dirty=0` / Excluded `plu_target=0` / All 無条件。badge 導出 = `0 → 対象外`、`1 × dirty=1 → 未反映`、`1 × dirty=0 → 反映済み`。Test: B-S1 / B-V1。
- D-073: CV17 / SR-S4000 を伴う Windows native L3 は (1) PLU file 形状（IO-04 出力、header / field / 値）(2) レジ向け field 値（固定列 / 課税 / 部門等）(3) UI-08 書出し・confirm・復帰の operator flow、のいずれかに触れる PR に必須。触れない PR は human visual confirmation で足りる。Test: review。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-PLS-D6 (a) / B-D4 | CSV 列 parse / 正規化 / commit | B-C1〜B-C5 / B-P1 | 値文法 / warning / 解放 | cargo test + RTL + visual |
| SPEC-PLS-D6 (b) / B-D1 / B-D2 | bulk service / command / UI | B-L1〜B-L7 / B-V3 / B-W1 | filter 同型 / 既に 1 無変更 / 解放 / TX | cargo test + RTL + bindings diff + visual |
| SPEC-PLS-D7 / B-D3 | `plu` filter / badge / 列 | B-S1 / B-S2 / B-V1 / B-V2 | WHERE 1 対 1 / 導出式 / 独立列 | cargo test + RTL + visual |
| D-052 C19 | invalidation | B-I1 | 4 点同時更新 | vitest |
| D-073 | 67-ui §67.12 / decision-log | review | scope 判定 | Plan Gate / doc check |
| PR #85 P3 follow-up | Rust test | B-F1 / B-F2 | oracle 独立性 | cargo test |
| Registration | bindings / macro / traceability / compliance | B-W1〜B-W3 | 61 / diff 0 | local-ci |

## Data Safety

- 実 JAN・商品名・価格・実 CSV・DB・backup を fixture / PR / docs に含めない。fixture の JAN は check digit 有効な架空 13 桁（`4901234567894` 系）を使う。
- operation_logs には filter 要約と件数のみ（JAN 一覧を残さない）。
- local-only: `.local/ci-evidence/`、owner の visual confirmation 用 synthetic CSV は `.local/` 配下または scratch に置き commit しない。
- 物理 DELETE は行わない。bulk OFF は `plu_target=0` 更新 + slot 遷移のみ。

## Implementation Results

CSV の `PLU対象` 契約、filter 全件の一括対象更新、PLU 移行検索・一覧表示、確認 dialog と結果通知、C18 invalidation を実装した。PR #85 follow-up として v4→v5 migration および reservation dropped 後の再予約 oracle も追加し、generated bindings と source docs を同期した。

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Gate round 1（2026-08-19、独立 Sonnet Plan Reviewer、対象 `ea239d7`）

- Verdict: P1 0 / P2 6 / P3 2。事実主張 18 件の裏取りは全件 OK（`60 → 61` / `ProductBulkFilter` 3 field / `ProductSearchQuery.plu` 未実装 / `setup_v4_only_db` 不在 / D-052 C1〜C17 / D-073 次番 等）。
- P2-1（accept）: repo fn 名を `20-io` 本文で既に命名済みの `find_products_for_bulk_plu_target` に統一し、同 prose の filter 条件に `plu` を追記する旨を Scope / Required Design Artifacts に明記。
- P2-2（accept）: B-D3 の rejected alternative に PR #95（廃番の状態列 → セル内 badge への reversal）との対比を追加。PLU 3 語彙は全行に値があり多数派が移ろうため、セル内全行 badge は商品名可読性をより強く壊すと整理。後退案も「`対象外` 無表示 + 2 語彙セル内」へ具体化。
- P2-3（accept）: 「archive D-3」を「2026-07-03 packet 内 ID D-3」に修飾（`DB_DESIGN.md` D-3 との衝突回避、`feedback-qualify-packet-local-decision-ids`）。
- P2-4（accept）: 50-ui は D-052 参照行を持たないため「該当行更新」ではなく新規決定行 `UI-01a-D12`（C18 引用）の追加と明記（Scope 7 / Registration / Required Design Artifacts）。
- P2-5（accept）: IO-03 `parse_product_csv` が全列を無条件 trim する既存事実を Matrix B-C3 に反映（` 1 ` は正例側）。
- P2-6（accept、部分）: Transition narrative に file-level 衝突リスク（`67-ui` / `bindings.ts`）の評価と stacked train の Wave Operation 規則適用外の整理を追記、Review Focus に rebase 後の再確認を追加、`DEV_WORKFLOW.md` への stacked train 明文化は別 workflow docs PR の follow-up とする（本 feature PR に workflow gate 変更を同乗させない）。
- P3-1（accept）: B-L5 の rollback fixture を既存 `product_service::failpoint` 機構の再利用に具体化。
- P3-2（記録）: D-073 / §67.12 条項の実文面は Writer が source doc に書く段階で確定し、Final Review が粒度（判定対象 3 種の列挙）を検証する。
- Phase は plan-gate に留まる in-place 是正。round 2 は fresh delta 再検証。

### Plan Gate round 2（2026-08-19、fresh 独立 Sonnet Plan Reviewer、対象 `4feed6c`）

- round 1 是正 8 件（`git show 4feed6c` の delta、reviewer 報告）は全件「適正」（20-io 命名 / DSR-04 PR #95 記述 / DB_DESIGN D-3 別物 / 50-ui D-12 未使用 / importer 無条件 trim / Wave Operation 並行前提 / failpoint mod / D-073 先送り を source で裏取り）。事実主張 17 件 OK。
- 新規 P2 1（accept）: Mutation 設問に B-V2 / B-S2 / B-P1 の mutant が不在 → 3 件追加（`normalizeEnum` bypass / `#[serde(default)]` 除去 / preview 表示値 swap）。
- 新規 P3 1（accept）: `Plans.md` 次の行動の本 packet 行が `plan-draft` 表記のまま → `plan-gate` へ同期（同 commit）。
- round 3 は fresh delta 再検証（P1/P2 = 0 収束確認）。

### Plan Gate round 3（2026-08-19、fresh 独立 Sonnet Plan Reviewer、対象 `fa90206`、rally 天井）

- round 2 是正: `Plans.md` 同期 = 適正、mutation 3 行追加 = B-V2 / B-P1 適正、B-S2 の mutant は equivalent（P2）。
- P2 1（accept、Coordinator 是正）: 「`#[serde(default)]` を外す」は Rust 側 deserialize を変えない equivalent mutant（`Option<T>` は属性なしでも missing → `None`、reviewer が scratch crate で実証）。是正 = B-S2 の mutant を `PluMigrationFilter` の `rename_all` 除去へ差し替え、`#[serde(default)]` 除去は TS 側 `?:` 消失として B-W1（bindings diff + tsc）で検出する旨を Matrix に明記。Contract Probe の precedent 記述を訂正（`ProductUpdateRequest` は container-level `#[serde(default)]`（`product_service.rs:47`）を持ち、それが specta の `?:` を生む。Rust 側 missing 許容は `Option<T>` 組込み）。Scope 3 / Registration / Boundary の `#[serde(default)]` の役割記述も同期（`warnings: Vec<String>` のみ Rust 側でも必須）。
- rally 天井到達時の disposition（`DEV_WORKFLOW.md` Review Rules）: 残 finding は本 P2 1 件のみで、是正は Matrix / packet 記述の訂正（設計変更なし）。Coordinator が同型指摘の一括是正として閉じ、次 round は開始しない。Final Review が実装時の bindings diff（`plu?:` / `plu_target?:` / `warnings?:`）で再確認する。
- Plan Gate 収束: round 1〜3 で P1 = 0、round 3 残 P2 は上記 disposition で是正済み。owner plan approval 待ち。

### owner plan approval / 遷移記録（2026-08-19）

- owner plan approval（介入 1 回目 / 予算 3 回、owner 発言 `承認するよ`）。Coordinator 裁定（B-D1〜B-D4 / Human Gate = visual のみ + D-073 / stacked train 運用 / 予算）に異論なし。
- state-only 遷移（append-only、STATECAP forward 1 本目）: `plan-gate -> plan-approved -> implementing`。plan-approved の evidence = Plan Gate rally 3 round で P1/P2 = 0 収束（round 3 残 P2 は天井 disposition で是正 `51f53c3`）+ owner approval。implementing の evidence = Plan Commit `f0cd25c`（plan-first、全実装 commit に先行）確定、Codex 発注書は本遷移後に提示。
- 以後の予定: Codex 実装 → L1 full → 独立 Sonnet Final Review → owner visual confirmation（介入 2 回目）→ Ready 承認（介入 3 回目）→ state-only 2 本目（`local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 圧縮。`implementing -> local-verified` は content commit 同乗）。PR #85 merge 後に base を main へ付け替え rebase + L1 再取得。

### gated amendment 1（2026-08-19、Codex Writer fail-closed 起源、true positive）

- 事象: Writer が実装前の source contract 監査で停止 — (1) `40-cmd §bulk_set_plu_target` の戻り値 `BulkPluTargetResponse` と packet Boundary（`BulkPluTargetResult` を BIZ 型として CMD から直接返す）の不一致 (2) `30-biz §4.8` の `ImportRow` fenced 定義に `warnings: Vec<String>` がなく、Required Design Artifacts に §4.8 DTO 更新が未列挙。
- 裁定: (1) `40-cmd` を `BulkPluTargetResult` へ訂正（`create_product` が `ProductCreateResult` を直接返す既存慣行と `cmd-task-specs` の表記に一致。別 DTO を作らない）(2) `30-biz §4.8` `ImportRow` fenced 定義に `warnings: Vec<String>` を追加し、Required Design Artifacts の Backend 行に明記。設計意味（契約・遷移・文言）は不変、Plan Commit `f0cd25c` 維持。
- amendment commit = `fd2fd5f`（40-cmd + packet）+ 追補 commit（30-biz §4.8 `ImportRow.warnings`、`fd2fd5f` で sd 複数行置換が空振りしたため分離）。Workflow State `Amendments` には両 SHA を記録。

### gated amendment 2（2026-08-19、Codex Writer fail-closed 起源、true positive）

- 事象: packet Boundary が `ProductBulkFilter` を biz 層所有と書く一方、Scope 3 は `product_repo::find_products_for_bulk_plu_target(conn, &ProductBulkFilter)` を要求しており、`architecture_test.rs` の db → biz 依存禁止（例外なし）と両立しない。
- 選択肢: A = IO 層に内部型 `ProductBulkQuery` を置き biz の `ProductBulkFilter` から変換（20-io fenced signature と Scope 3 を `&ProductBulkQuery` へ変更）/ B = `ProductBulkFilter` を db 層 `product_repo` 所有にし biz が `pub use` で再 export（`ProductSearchQuery` / `ProductWithRelations` の既存慣行、`biz/mod.rs:21`）。裁定 = **B**。A は同じ field 集合の型を 2 つ持ち変換 1 段を増やすだけで、既存の検索 filter（`ProductSearchQuery`）が db 所有である慣行とも揃わない。B は 20-io の fenced 形・30-biz / 40-cmd の signature を変えずに済み、`PluMigrationFilter`（db 層 enum）と同居する。
- 是正: packet Boundary の internal type 行と Scope 2 の所有記述を更新。source docs は不変（型の所有層は function-design の signature に現れない）。設計意味は不変、Plan Commit `f0cd25c` 維持。
- amendment commit = `fa1659f`（Workflow State `Amendments` に記録）。

### gated amendment 3（2026-08-19、Codex Writer fail-closed 起源、true positive）

- 事象: `buildProductSearchQuery` が新契約で `plu: "all"` を送るため、既存 `search.test.ts` / `useProductList.test.tsx` の旧 payload exact assert が FAIL（frontend 全回帰 1 件）。Oracle Replacement Ledger に両 test が未列挙で、既存 test の expected 変更禁止条件に抵触。
- 選択肢: A = Ledger に両 test を追加し default payload `plu: "all"` を確定 / B = `all` のとき payload を省略する契約へ変更。裁定 = **A**。`discontinued` の既定 `active` が `is_discontinued: false` として送られる既存慣行と揃い、serde 側の `#[serde(default)]` は旧 caller 互換（TS `?:`）のために残す。B は「既定値だけ省略」という例外を 1 param にだけ作り、B-V2 の oracle と bindings 契約を曖昧にする。
- 是正: packet Oracle Replacement Ledger に 2 test の置換行を追加（置換理由 / 新 oracle / Matrix B-V2 / B-S2 / B-W1）、Matrix B-V2 の「or 省略」を削除して `plu: "all"` 送信に確定。設計意味は不変、Plan Commit `f0cd25c` 維持。
- amendment commit = `d7e4ed1`（Workflow State `Amendments` に記録）。

### gated amendment 4（2026-08-19、Codex Writer review-only P2 起源、true positive）

- 事象: packet Scope 2 が bulk ON の適格判定を「`should_default_plu_target` と同一判定」と書いたため、Writer が既定導出を check digit 込みへ変更し、`30-biz §4.4`（BIZ-01-D2: ASCII 13 桁数字なら true）/ `§4.8`（新規行の既定導出）と不一致 → CSV `PLU対象` 空欄 / 列なしの新規行で「13 桁数字だが check digit 不正」の JAN が従来 1 → 0 に変わる互換性退行。Writer の review-only が検出、Coordinator が source で裏取り。
- 裁定: 既定導出 `should_default_plu_target` は従来どおり ASCII 13 桁数字判定を維持（frontend `suggestPluTarget` との二重実装契約も不変）。CSV 明示 `1` と bulk ON の適格判定は check digit 込みの別 predicate（`30-biz §4.8` の `1` + JAN 不備判定と同一、`§4.9.1` の「有効な 13 桁 JAN」）。packet Scope 2 / Design Intent Audit を訂正。Matrix: B-C4 に回帰 case（13 桁 + check digit 不正 + 空欄 → 既定 1）と `should_default_plu_target` の新規 test、mutation 設問に「適格判定を既定導出へ差し替え / 既定導出を check digit 込みへ」を追加。
- 同時 accept（review-only P3）: B-L7 に同一 keyword・別部門 / 別廃番の decoy を追加し、bulk query が `department_id` / `is_discontinued` を落とす mutant を件数差で殺す。
- source docs は不変（30-biz の記述が正しく、packet 側の誤記）。設計意味は不変、Plan Commit `f0cd25c` 維持。Writer は修正後の content HEAD で mutation 再確認・review-only・L1 full・`cargo check --release` を再実行する。
- amendment commit = `a8487b7`（Workflow State `Amendments` に記録）。

### Final Review round 1（2026-08-19〜20、独立 Sonnet Final Reviewer、content `f10b3cd`、worktree 隔離）

- Verdict: P1 0 / P2 1 / P3 1。Contract Audit（Ledger 10 行）全 OK — B-D1 `if product.plu_target { continue; }` / B-D2 `buildProductBulkFilter` が `normalizeProductListSearch` を共有 / B-D3 独立列 + 行減衰なし / B-D4 / gated amendment 4 の別 predicate `is_plu_target_eligible_jan` + 回帰 test / 20-io WHERE 5 値が search と bulk で同一 match arm / OFF の解放 / 1 TX + JAN 非含有 / D-052 C18 4 点 / db 所有 + biz 再 export（`architecture_test` PASS）。文言 exact 突合 9/9 一致（badge / ボタン / dialog title×2 + description / toast / preview 3 値 / warning / §67.12 + D-073 条項）。
- Mutation: Matrix 23 行を clean tree で独立注入 → 22 KILLED + equivalent 1（`#[serde(default)]` 除去は bindings `plu?:`→`plu:` + `tsc --noEmit` 7 caller error で検出、round 3 disposition どおり）。復元後 tree clean。B-L7 decoy は `department_id` 側のみ実注入（`is_discontinued` 側は同型 code の inspection）。
- Registration / Generation: `collect_commands!` / `generate_handler!` 61 / bindings 再生成 diff 0 / design_compliance unexpected 0 / traceability `--check` PASS / doccheck ERROR 0（既存 per_page WARN のみ）/ `cargo test` 全 PASS / `npx vitest run` 全 PASS / `search.ts` の `plu` 5 箇所。
- P2（accept、Coordinator docs-only 是正）: 既存 test 2 件（`ProductListPage.test.tsx` empty case / `search.test.ts` descriptor test）に additive な assert が挿入され Ledger 未記載。expected 値の変更・削除・skip はなし → Ledger に 2 行追記（本 commit）。実装は不変。
- P3（accept、同上）: packet Required Design Artifacts の D-073 要約 cell が「復帰」を落としていた → 同期。Matrix prose の mutant 数 22 → 23 も同期。
- 既存 test の削除 / skip / `.todo` は diff 全域で 0。Writer は `docs/plans/**` の Workflow State を変更せず Implementation Results のみ追記（SHA / 件数なし）。
- Coordinator 判定: P2 / P3 とも docs-only で実装非接触。fresh delta 再検証は packet 3 箇所の転記確認に限定して実施する。

### Human visual confirmation 結果 / 記録（2026-08-20）

- 結果（owner 報告、PR #86 comment、tested HEAD `230f0e5`、開発 PC Windows native、レジ / CV17 なし）: **V1〜V6 すべて PASS**。PLU 独立列の 3 語彙 text + icon / 行減衰なし、`plu` filter 5 値 + URL 復元 + `?plu=bogus` → `すべて` 正規化、一括 ON の件数 dialog → cancel 無変化 → 実行 toast（更新 / JAN 不備 / 廃番）→ badge `未反映` + ホーム未反映件数の即時反映（OFF→ON で 11→10→11）、一括 OFF → `対象外` + 未予約商品の `レジメモリNo.` = `未割当`、CSV preview の `PLU対象` 列 3 表示値 + 不正値 error 行 + JAN 不備 warning（text + icon）、commit 後の一覧 badge。DB は基準線から復元（3 file SHA-256 一致、RESTORE=PASS）。
- fixture 代替: Coordinator 提示の fixture は UTF-8 BOM で、商品 CSV 取込みは CP932 前提のため「文字コードが判別できません」で fail-closed（DB 無変化 = 既存契約どおり）。owner が同内容を CP932 で作成して使用。Coordinator の fixture encoding 誤りで、実装欠陥ではない（次回以降の fixture は CP932 で提示）。
- 非ブロッキング所見（owner）: (1) 一覧の列見出しで数値列 / 操作列と文字列列の左右寄せが混在しリズムが不揃い → UI polish P3 候補として follow-up（実装 B の scope 外、PR body Follow-up に記録）(2) 一覧の既定 `表示中` が廃番を除外するため「未反映」件数が一覧 9 / ホーム 10 と途中で異なって見える → 仕様どおり（`すべて` で一致、owner がコード走査でも確認）。
- Owner Effort Budget 実績: decision point 単位で 介入 2/3（plan approval / visual 結果報告）。owner comment の `owner intervention 3/3` は実施中の手動操作回数（V3 再確認を含む）で計上基準が異なる。Ready 承認 = 介入 3/3（予算内）。
- 残る Human Gate = Ready 承認。merge train は PR #85 → PR #86 のため、Ready 遷移 commit（state-only 2 本目、`implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 圧縮、Reviewed Content HEAD 設定）+ exact HEAD L1 再取得 + PR body refresh は PR #85 merge 後の base 付け替え rebase の後に実施する。

### owner Ready 承認記録（2026-08-20）

- owner Ready 承認（介入 3 回目 / 予算 3 回、owner 発言 `承認するよ`）。Human Gate の owner 項目（plan approval / visual confirmation / Ready 承認）は全消化、merge のみ残る。
- Phase は implementing のまま据え置く。merge train PR #85 → PR #86 のため、Ready 遷移は次の順で実施する: PR #85 merge → 本 branch の base を main へ付け替え rebase（conflict は `67-ui-plu-export.md` / `bindings.ts` を中心に解消、L1 再取得）→ state-only 2 本目（`implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 圧縮。evidence = rebase 後 exact HEAD の L1 full / Final Review round 1 + delta 再検証 P1/P2 = 0 / visual confirmation 全 PASS / 本 Ready 承認、Reviewed Content HEAD = rebase 後の content HEAD）→ 同 HEAD で L1 full → PR body 全面 refresh → owner が Ready トリガー → hosted CI → merge。
- rebase 後に content が変わる場合（conflict 解消が実装に及ぶ場合）は Final Review の delta 再検証を挟んでから遷移する。docs-only の conflict 解消なら delta ack のみ。

### main 吸収の merge 記録 + gated amendment 5（2026-08-20、D-052 C 番号衝突の C19 改番）

- PR #85 merge（squash `f88037d`）後の base 付け替えは、packet 計画の rebase 方式を破棄して **origin/main の単段 merge 方式**へ切替した（PR #85 packet「main drift 吸収の merge 記録」と同じ D-055 判断）。根拠 2 点:
  - rebase 試行は plan-first commit `f0cd25c` 自体が `docs/Plans.md` 衝突 + closeout の archive 移動に伴う directory-rename 誤検出で即衝突し、D-055 Rebase Map（mapped pair の patch-id 同値）が原理的に証明不能（PR #85 の実測と同型）。
  - PR #85 branch tip の merge を併用する 2 段 merge も試作したが、squash による ancestry 断絶のため PR #85 の state-only 遷移 commit 群が STATECAP 検査範囲 `merge-base(origin/main, HEAD)..HEAD` に入り込み、上限 3 を機械超過することを `check-workflow-git.sh` 実行で確認し破棄した。
- merge commit = `e72c1ce`（parents = 本 branch 先端 `2fbb3af` + origin/main `242b7b3`）。squash 由来の旧 merge-base に落ちるため見かけ衝突が広域に出るが、解消は次のとおり検分済み:
  - PR #85 実装と lane 2 実装の重複 6 file（UI_TECH_STACK / decision-log / 90-traceability / invalidation-contract + meta test + oracle）は、PR #85 amendment 5 の C18 = prepare と lane 2 の C19 = bulk を両立する織り合わせで解消。90-traceability は generator 再生成。
  - closeout の archive 移動を尊重して docs/plans の lane 1 packet / Matrix 複製を除去（archive 側と byte 一致を検分）。`docs/Plans.md` / `docs/PROJECT_HANDOFF.md` は main 側 closeout 記録を採用し、実装 B 行と wave 5 registry を保持。
  - PR 実効 diff（`git diff origin/main HEAD`）が lane 2 の reviewed 内容 + C19 改番のみで構成されることを file 一覧で検分（PROJECT_HANDOFF は main と diff 0）。
  - 原 SHA（Plan Commit `f0cd25c` / Amendments 全 SHA / visual confirmation の tested HEAD `230f0e5`）はすべて現 HEAD の祖先として保存され、Rebase Map は不要。
- gated amendment 5（Coordinator 裁定、merge 衝突解消起源の true positive）: PR #85 gated amendment 5 が D-052 **C18 = PLU prepare 成功** を先取りしており、本 packet の C18 = `bulk_set_plu_target` と番号が衝突した。merge・archive 済みの main / PR #85 側を不変とし、本 packet の bulk entry を **C19 へ改番**する。sweep = decision-log D-052 Contract / Decision 行（19 entry / 22 success handler、`rg -c "invalidateByContract\(" src/features --glob '!**/*.test.*'` 合計 22 を 2026-08-20 実測）/ UI_TECH_STACK §2.5 / 50-ui UI-01a-D12 / `invalidation-contract.ts`・`invalidation-oracle.ts`・meta test（19 entries、`pluExportPrepare` と `pluBulkTarget` を両立）/ `ProductListPage.test.tsx` test 名（以上 `e72c1ce` に同乗）/ packet・Matrix の契約行（本 commit）。append-only の round 記録・Implementation Results・Final Review 記録は原文（C18 表記）のまま維持し、本記録を改番の正とする。invalidate 対象集合・oracle 独立性・設計意味は不変、Plan Commit `f0cd25c` 維持。Workflow State `Amendments` へは実体変更を担う `e72c1ce` を追記する。
- 併せて終結: 本 packet が follow-up と記録していた「C2 の `pluSlotSummary` 欠落」は PR #85 gated amendment 5 で解消済み（本 PR は不変のまま成立、Matrix 該当セルを同期）。

### Final Review delta 再検証（2026-08-20、独立 Sonnet Final Reviewer、worktree 隔離）

- Verdict: **P1 0 / P2 0 / P3 0** — merge + C19 改番は reviewed content を壊していない。対象 candidate は本 HEAD と code tree 同値（差分は packet narrative 記録のみ）で、worktree 隔離の独立 Sonnet Final Reviewer が検証。
- 確認範囲: invalidation 契約 trio の 19 entries 一貫性 + oracle 独立性（production 非 import）維持 / C19 改番の live 契約文書全一致（C18 = prepare 参照は未改変、packet append-only 原文維持は指摘対象外の整理どおり）/ `product_service.rs`・`migration.rs`・`plu_export_service.rs` の PR 実効 diff が lane 2 実装のみで PR #85 ロジック温存 / §67.12 維持 / bindings・90-traceability 再生成 diff 0 / conflict marker 残存 0 / 既存 test の削除・skip・`.todo` 0。frontend / Rust の full suite・`tsc --noEmit` は全 PASS（件数と log は PR body evidence）。

### 遷移記録: content commit 同乗による implementing -> ready-hosted-final（2026-08-20）

- 本 commit（packet sweep を含む content commit）に `implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 遷移を同乗させる。canonical state-only commit を新設しない理由: stacked train の継承 history に PR #85 期の forward state-only 遷移 commit 2 本（`61e4d88` / `4835073`、いずれも stack 点 `92bd76f` の祖先で squash 後の main から不可達）が残り、本 packet 自身の plan approval 遷移 `7b29c04` と合わせて STATECAP 計数が既に 3/3。4 本目の state-only commit は機械 FAIL するため、DEV_WORKFLOW「content commit 同乗」（PR #58 / PR #80 先例の正規手段）で圧縮する。stacked train が他 lane の遷移 commit を自 PR の STATECAP に計上してしまう構造は Wave Operation 未定義 gap として workflow docs PR（follow-up、Plan Gate round 1 P2-6 と同枠）へ引き継ぐ。
- evidence: local-verified = Writer 実装時 L1 full PASS + 本 commit 直後の exact-HEAD L1 full（envelope は PR body）。independent-review = Final Review round 1 P1/P2 = 0（content `f10b3cd` + docs-only 是正 `230f0e5`）+ 上記 delta 再検証。human-confirm = visual confirmation V1〜V6 全 PASS（tested HEAD `230f0e5`、本 HEAD の祖先）。ready-hosted-final = owner Ready 承認（`2fbb3af` 記録、介入 3/3）。
- `Reviewed Content HEAD` は直前の content commit `e72c1ce` を設定する（本 commit の packet sweep 分は delta 再検証が tree 同値 candidate で確認済み、差分は本 narrative 記録のみ）。
