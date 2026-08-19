# Plan Packet: PLU bulk onboarding 実装（実装 B）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet subagent（独立、Writer と別 context）
- Final Reviewer: Sonnet subagent（独立、Writer と別 context）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval / human visual confirmation（Windows native、UI-01a badge・`plu` filter・一括操作 dialog・結果表示、UI-01c preview `PLU対象` 列 + warning。レジ / CV17 は不要 = `67-ui §67.12` scope 明文化に従う）/ Ready / merge

Transition narrative（append-only）:

- 本 packet 作成 commit で kickoff → spec-check → design → plan-draft → plan-gate を materialize する。evidence: task scope と Risk は本 packet に記録（kickoff → spec-check）/ in-scope source docs は Design Sources に列挙し、PR #84 正本化済み + 本 PR 内の追随（Required Design Artifacts）で実装可能と判定（spec-check → design）/ 設計判断は Spec Contract に確定、未解決の設計問題なし（design → plan-draft）/ packet + Test Design Matrix を同一 commit で commit（plan-draft → plan-gate）。
- branch `agent/plu-bulk-onboarding-implementation` は PR #85 branch `agent/plu-slot-core-implementation`（`92bd76f`）の上に stack する（PR #85 packet Human Gate Proposal の「店舗訪問遅延時は実装 B を本 branch の上に stack して runway を止めない」規定。owner 判断 2026-08-19、介入に数えない）。Draft PR の base は PR #85 branch とし、PR #85 merge 後に base を main へ付け替えて rebase + L1 再取得する。PR #85 が L3 round 2 で gated amendment（`PLU_CLEAR_ROW_ENABLED=false` 等）を受けた場合も本 packet の契約は clear 行挙動に依存しないため影響しない。

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
商品 CSV 取込み契約（任意列 `PLU対象` の受理・正規化・行 error）、Tauri command 新設（`bulk_set_plu_target`）+ 既存 command の DTO 拡張（`search_products` の `plu` filter）+ generated bindings、商品一覧の URL search param（`plu`）、filter 一致全件を 1 transaction で更新する operator workflow（誤実行で PLU slot の解放・未反映化が一括で起きる）、D-052 invalidation 契約の追加（C18）を同時に変更する。schema 変更はなく、会計・在庫系列（D-025 / SPEC-PLS-D8）には触れない。

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
2. BIZ-01 `bulk_set_plu_target(conn, filter: ProductBulkFilter, plu_target: bool) -> Result<BulkPluTargetResult, BizError>`（`30-biz §4.9.1`）: `ProductBulkFilter { keyword, department_id, is_discontinued, plu }` = 商品一覧 filter と同一意味（page / per_page なし）。ON = filter 一致のうち未廃番 + 有効 13 桁 JAN（`should_default_plu_target` と同一判定）かつ `plu_target=0` の行を `plu_target=1, plu_dirty=1`、既に 1 の行は無変更、廃番 / JAN 不備は skip 件数。OFF = filter 一致全件のうち `plu_target=1` を 0 にし、各行で `plu_export_service::release_plu_slot_for_jan` を呼ぶ。1 TX、`operation_logs` に filter 正規化要約 + 要求値 + 4 件数（JAN 一覧は残さない）。result = `matched_count / updated_count / invalid_jan_skipped_count / discontinued_skipped_count`。
3. IO `product_repo`: filter 一致全件を取得する unpaged 読取り（`list_products_for_bulk(conn, &ProductBulkFilter)` 等、`20-io` に fenced signature 追加）と `ProductSearchQuery.plu: Option<PluMigrationFilter>`（`20-io §search_products` 設計済み: Target / Pending / Synced / Excluded の WHERE 条件、All は無条件）。`PluMigrationFilter` は db 層 enum（serde + specta、`#[serde(default)]` で既存 caller 互換）。
4. CMD-01 `bulk_set_plu_target` command（`40-cmd §bulk_set_plu_target`）: `lib.rs` `collect_commands!` + `generate_handler!` 双方へ登録（60 → 61）、`cargo run --bin generate_bindings` で `src/lib/bindings.ts` 再生成（`bulkSetPluTarget` / `ProductBulkFilter` / `BulkPluTargetResult` / `PluMigrationFilter` / `ImportRow.plu_target` / `ImportRow.warnings` / `ProductSearchQuery.plu`）。
5. UI-01a（`50-ui` UI-01a-D10 / D11）: `search.ts` に `plu` param（`all|target|pending|synced|excluded`、既定 `all`、無効値は `all` へ正規化、`discontinued` と同じ `OPTIONS / normalizeEnum / payload` 機構）と filter UI（SegmentedControl 同列）、一覧に独立「PLU」列（3 語彙 text badge + 補助 icon、色のみ符号化なし、行減衰なし）、一括操作ボタン「PLU 対象にする」「PLU 対象から外す」→ `AlertDialog`（現在の filter 一致件数 = 一覧 query の `total_count` を表示）→ `commands.bulkSetPluTarget(filter, plu_target)` → 結果 toast（DSR-03: 完了通知）+ 失敗時は destructive Alert → D-052 C18 invalidation。
6. UI-01c（`60-ui` UI-01c-D16）: preview 表に `PLU対象` 列（表示値 `対象` / `対象外` / `既定（13桁JANなら対象）`）と同行 warning（text + icon）、列の意味説明 1 行。
7. D-052 C18（`bulk_set_plu_target` 成功）: `src/lib/invalidation-contract.ts` `pluBulkTarget` = `productList.root / pluDirty / productForm.root / pluSlotSummary`。同一 PR で独立 oracle test、`decision-log.md` D-052 Contract 行、`UI_TECH_STACK.md §2.5`、`50-ui` 該当行を更新（PR #85 Final Review P2 の再発防止）。
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
- B-I1: `npx vitest run src/lib` で D-052 C18 の独立 oracle test（C1〜C18 の完全一致比較、production SSOT 非 import）PASS、`decision-log.md` / `UI_TECH_STACK.md` / `50-ui` に C18 記載。
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
| Backend function / command / repository / validation / error | 30-biz §4.8〜4.9.1 / 20-io §search_products / 26-io IO-03-D1 / 33-biz §16.6 | updated in this PR（30-biz §4.9.1: `ProductBulkFilter` に `plu` 追加 + 「既に 1 の行は無変更」明記 + fenced signature は既存 / 20-io: unpaged 読取り fn の fenced signature 追加、`plu` は既存 / 26-io: 不変） |
| Command / DTO / generated binding / wire shape | 40-cmd §bulk_set_plu_target + §search_products / cmd-task-specs | updated in this PR（40-cmd: `ProductBulkFilter` に `plu`、`search_products` 節に `plu` 追記 / cmd-task-specs: 同期） |
| DB / transaction / audit / rollback / migration | plu-tables.md / 22-mnt | existing sufficient（schema 変更なし。operation_logs は既存 table） |
| Screen / UI / route state / Japanese wording | 50-ui UI-01a-D10 / D11 + search param 表 / 60-ui UI-01c-D16 / design-system DSR-03 / 04 / 07 | updated in this PR（50-ui: PLU 列の置き場 = 独立列（DSR-04 判定理由）+ 文言表（dialog / toast / badge）+ D11 の filter に `plu` を含む旨 / 60-ui: preview 表示値 3 種の文言） |
| CSV / TSV / report / import / export format | 26-io IO-03-D1 / 30-biz §4.8 | existing sufficient（値文法 `1` / `0` / 空欄、不正値 = 行 error、`1` + JAN 不備 = warning + 0 は設計済み） |
| Invalidation contract | decision-log D-052 / UI_TECH_STACK §2.5 / `src/lib/invalidation-contract.ts` | updated in this PR（C18 追加、SSOT + 独立 oracle + 3 doc を同一 PR） |
| Human Gate scope | 67-ui §67.12 / decision-log | updated in this PR（§67.12 に scope 条項: CV17 / SR-S4000 を伴う native L3 は PLU file 形状・レジ向け field 値・書出し / confirm operator flow に触れる PR に必須、触れない PR は human visual confirmation のみ。D-073 として記録、owner 提案 2026-08-19） |
| Durable decision / ADR | D-072 / D-052 / D-073（新設） | updated in this PR（D-073 新設、D-052 C18） |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command `bulk_set_plu_target` | `lib.rs` `collect_commands!` + `generate_handler!` 双方へ登録（60 → 61）/ `#[tauri::command]` + `#[specta::specta]` / `cargo run --bin generate_bindings` → `src/lib/bindings.ts` 再生成（B-W1）。fenced signature は `40-cmd` に既存 |
| 新規 pub fn（BIZ-01 `bulk_set_plu_target` / `product_repo` unpaged 読取り + bulk 更新 helper） | `30-biz §4.9.1`（既存 fenced）/ `20-io`（新規 fenced）に signature、`design_compliance_test` PASS（B-W2）。`KNOWN_ALLOWLIST` 追加は原則禁止 |
| 新 type（`ProductBulkFilter` / `BulkPluTargetResult` / `PluMigrationFilter`、`ImportRow.plu_target` / `warnings`、`ProductSearchQuery.plu`） | `specta::Type` + serde（`ProductSearchQuery.plu` と `ImportRow` 新 field は `#[serde(default)]` で旧 caller / 旧 localStorage 互換）、bindings 再生成 + consumer 同一 commit 切替（B-W1） |
| URL search param `plu` | `src/features/products/search.ts` の OPTIONS / schema / normalize / payload / patch の 5 箇所同時追加、`50-ui` search param 表は既存 |
| D-052 C18 | `invalidation-contract.ts` `pluBulkTarget` + 独立 oracle test + `decision-log.md` D-052 Contract 行 + `UI_TECH_STACK.md §2.5` + `50-ui` 該当行（B-I1） |
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
| D-052 | decision-log D-052 / UI_TECH_STACK §2.5 | C18 | bulk 成功後に一覧 / home 未反映 / 商品 form / slot 要約を stale 化 | `invalidation-contract.ts` | B-I1 |
| D-072 Human Gate | 67-ui §67.12 | D-073 | file 形状・レジ挙動に触れない PR に CV17 / SR-S4000 L3 を課さない（owner 提案、PR #85 L3 round 1 の観測起源） | 67-ui §67.12 / decision-log | review / Human Gate |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: はい。SPEC-PLS-D6 / D7 の what / why は PR #84 で `30-biz` / `40-cmd` / `50-ui` / `60-ui` / `20-io` / `26-io` に正本化済み。本 packet で足すのは `ProductBulkFilter.plu`（B-D2）/ 既に 1 の行の無変更（B-D1）/ PLU 列の置き場（B-D3）/ 文言表 / §67.12 scope（D-073）で、いずれも同一 PR で source docs へ書く。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: B-D1〜B-D4（Spec Contract）→ 30-biz / 40-cmd / cmd-task-specs / 50-ui / 60-ui、D-073 → decision-log + 67-ui。
- Assumptions and constraints: PR #85 の共通解放 service `release_plu_slot_for_jan` と `plu_slots` が存在する（stack 前提）。`should_default_plu_target`（backend）と `suggestPluTarget`（frontend）の二重実装は BIZ-01-D2 の意図どおり維持し、bulk ON の JAN 判定は backend 側のみ使う。商品数は数千規模で unpaged 読取り + 1 TX は許容（per-row 解放は `release_plu_slot_for_jan` 1 回 / 行）。
- Deferred design gaps, risk, and follow-up target: D-052 C2（商品 update の 1→0 解放）が `pluSlotSummary` を invalidate していない既存 gap は本 packet で触れない（Review Focus に記録、follow-up）。preview の `既定` 表示は新規行のみ意味を持ち、上書き行の空欄 = 既存値維持は説明文で補う。
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
- Source docs updated in this PR: Required Design Artifacts の「updated in this PR」行（`ProductBulkFilter.plu` / 既に 1 の行 / PLU 列置き場 + 文言表 / `40-cmd §search_products` の `plu` / 20-io fenced / D-052 C18 / 67-ui §67.12 scope + D-073）。
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

- `#[serde(default)]` を付けた `Option` field が specta で optional（`plu?: PluMigrationFilter | null`）として生成され、旧 caller（`plu` 未指定）が型 error にならない: 既存 `ProductUpdateRequest.plu_target?: boolean | null`（`bindings.ts`）が同じ機構で生成済み -> 成立（実装時に bindings diff で再確認、B-W1）。
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
| D-052 | `src/lib/invalidation-contract.ts` / oracle test / decision-log / UI_TECH_STACK | C18 | B-I1 |
| docs | 30-biz / 40-cmd / cmd-task-specs / 50-ui / 60-ui / 20-io / 67-ui / decision-log / 90-traceability | Required Design Artifacts | B-W2 / B-W3 |

## Oracle Replacement Ledger

| 既存 test / oracle | 置換理由 | 新 oracle | Matrix |
|---|---|---|---|
| `test_commit_import_req104_derives_plu_target_like_backfill_and_keeps_on_overwrite` | 列なし時の挙動は不変のため維持。列あり case は新規 test で追加（既存 test 改変禁止） | 維持 + B-C1〜B-C5 新規 | B-C4 |
| `ProductListPage.test.tsx` / `ProductImportPage.test.tsx` 既存 assert | 既存 filter / 列の assert は不変。PLU 列 / `plu` param / dialog は新規 test | 維持 + 新規 | B-V1〜B-V3 / B-P1 |
| D-052 oracle test（C1〜C17 完全一致） | C18 追加で期待集合を独立転記更新 | C1〜C18 | B-I1 |

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
| D-052 C18 | `invalidation-contract.ts` | B-I1 | — |
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
- internal type: `PluMigrationFilter` enum（db 層）、`ProductBulkFilter` / `BulkPluTargetResult`（biz 層、cmd は直接 return）
- precision/range: 件数は usize → u32、商品数上限は実運用数千
- round-trip path: UI `search.ts` の正規化 filter → `buildProductSearchQuery` と同じ source から `ProductBulkFilter` を構築（page / per_page を除く）
- invalid input: `plu` 不明値 = serde error → CmdError（UI は `search.ts` で事前正規化）、CSV 不正値 = 行 error
- compatibility: `#[serde(default)]` で `plu` / `plu_target` / `warnings` 省略可、既存 caller 無改変で動作

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
- D-052 C18 の 4 点同時更新（SSOT / oracle / decision-log / UI_TECH_STACK + 50-ui）。既存 gap: C2 が `pluSlotSummary` を含まない点は follow-up として記録のみ。
- 67-ui §67.12 scope 条項 + D-073 の文面が、将来 PR の判定に使える粒度（「触れる / 触れない」の判定対象 3 種を列挙）になっていること。

## Spec Contract

Contract ID: SPEC-PLS-D6 / SPEC-PLS-D7（一覧）/ B-D1〜B-D4

- B-D1（30-biz §4.9.1 明確化）: bulk ON は `plu_target=0` かつ未廃番かつ有効 13 桁 JAN の行だけを `plu_target=1, plu_dirty=1` にする。既に `plu_target=1` の行は `plu_dirty` を含め無変更（archive D-3「0→1 のみ dirty」規則の明文化）。Test: B-L2 / B-L3。
- B-D2（30-biz §4.9.1 / 40-cmd / cmd-task-specs / 50-ui UI-01a-D11 追記）: `ProductBulkFilter` は一覧 filter と同型 `{ keyword, department_id, is_discontinued, plu }`、page / per_page を持たない。理由: operator が見ている filter 一致全件 = 操作対象でなければ、`plu=pending` で「対象から外す」が反映済みまで巻き込み、`plu=excluded` で「対象にする」の件数表示が一覧と食い違う。Test: B-L7 / B-V3。
- B-D3（50-ui 追記）: PLU 移行状態は商品一覧の独立列「PLU」に text badge + 補助 icon で表示し、行減衰は行わない（DSR-04: この画面では移行状態が `plu` filter と一括操作の主情報。列は狭幅 3 文字 label、密度は visual confirmation で判定し過密なら商品名セル内 badge へ後退する follow-up 候補）。Test: B-V1 + visual。
- B-D4（60-ui / 30-biz §4.8）: `ImportRow.plu_target: Option<bool>` は正規化済み適用値（`1` + JAN 不備は `Some(false)` + `warnings` 1 件、空欄 / 列なしは `None`）。preview 表示値 = `対象` / `対象外` / `既定（13桁JANなら対象）`。commit は `Some` を適用、`None` は新規 = 既存導出 / 上書き = 既存値維持。Test: B-C1〜B-C5 / B-P1。
- SPEC-PLS-D7（一覧）: `PluMigrationFilter` 5 値の WHERE = Target `plu_target=1` / Pending `plu_target=1 AND plu_dirty=1` / Synced `plu_target=1 AND plu_dirty=0` / Excluded `plu_target=0` / All 無条件。badge 導出 = `0 → 対象外`、`1 × dirty=1 → 未反映`、`1 × dirty=0 → 反映済み`。Test: B-S1 / B-V1。
- D-073: CV17 / SR-S4000 を伴う Windows native L3 は (1) PLU file 形状（IO-04 出力、header / field / 値）(2) レジ向け field 値（固定列 / 課税 / 部門等）(3) UI-08 書出し・confirm・復帰の operator flow、のいずれかに触れる PR に必須。触れない PR は human visual confirmation で足りる。Test: review。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-PLS-D6 (a) / B-D4 | CSV 列 parse / 正規化 / commit | B-C1〜B-C5 / B-P1 | 値文法 / warning / 解放 | cargo test + RTL + visual |
| SPEC-PLS-D6 (b) / B-D1 / B-D2 | bulk service / command / UI | B-L1〜B-L7 / B-V3 / B-W1 | filter 同型 / 既に 1 無変更 / 解放 / TX | cargo test + RTL + bindings diff + visual |
| SPEC-PLS-D7 / B-D3 | `plu` filter / badge / 列 | B-S1 / B-S2 / B-V1 / B-V2 | WHERE 1 対 1 / 導出式 / 独立列 | cargo test + RTL + visual |
| D-052 C18 | invalidation | B-I1 | 4 点同時更新 | vitest |
| D-073 | 67-ui §67.12 / decision-log | review | scope 判定 | Plan Gate / doc check |
| PR #85 P3 follow-up | Rust test | B-F1 / B-F2 | oracle 独立性 | cargo test |
| Registration | bindings / macro / traceability / compliance | B-W1〜B-W3 | 61 / diff 0 | local-ci |

## Data Safety

- 実 JAN・商品名・価格・実 CSV・DB・backup を fixture / PR / docs に含めない。fixture の JAN は check digit 有効な架空 13 桁（`4901234567894` 系）を使う。
- operation_logs には filter 要約と件数のみ（JAN 一覧を残さない）。
- local-only: `.local/ci-evidence/`、owner の visual confirmation 用 synthetic CSV は `.local/` 配下または scratch に置き commit しない。
- 物理 DELETE は行わない。bulk OFF は `plu_target=0` 更新 + slot 遷移のみ。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
