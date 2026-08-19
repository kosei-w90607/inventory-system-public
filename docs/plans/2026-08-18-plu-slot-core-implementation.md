# Plan Packet: PLU slot core 実装（実装 A）

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: fade732
- Amendments: c76fdbd, ebf4a31, 56e5fda, 42d88bf
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet
- Final Reviewer: Sonnet
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Windows native L3（`67-ui §67.12` が UI-08 実装 PR に必須と規定。実機 Z004 読込み・Diff 投入・clear 行の CV17 受理 + レジ側未設定化、店舗訪問と同期）/ human visual confirmation（UI-08 snapshot step + 要約、UI-01b レジメモリNo.）/ Ready / merge（owner plan approval は 2026-08-18 に完了、介入 1 回目）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 60分（うち店舗での L3 実施 30 分程度を含む）
- relay 往復上限: 2
- Plan Review round 天井: 3（既定 hard cap）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` に従う。介入は decision point 単位で計上し、L3 round も個別に数える（想定 = plan approval / L3 round 1 の結果報告 / Ready 承認。L3 が 2 round になれば 4 回目として超過報告する）。本 plan-draft の Draft PR 作成は owner 介入を消費しない。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
schema migration（v5、4,784 行事前投入）、新規 repository、IO-02 の新 mode、BIZ-04 の prepare / confirm の書換え、BIZ-01 の解放 trigger 3 種、IO-04 の行構成、Tauri command 2 本の新設と DTO 変更 + generated bindings、UI-08 の operator workflow、UI-01b の表示を同時に変更する。誤実装は memory No. の重複割当（レジ側の既存登録上書き）、レジ側の意図しない PLU 消去、書出しファイルの CV17 拒否につながるため R3 とする。会計系列（D-025 / D-071）には触れない。

## Goal

Goal Invariant:
D-072 / SPEC-PLS-D1〜D5 + D7（UI-08 / UI-01b 部分）を backend・wire・UI・test に実装し、レジ登録状況スナップショット（Z004 全スロットダンプ）で空きを確定したうえで、JAN 単位に永続する memory No. を prepare 時に最小空きへ冪等予約し、confirm で active 化、対象外化・廃番化・JAN 変更で clear 行経由の解放へ回す。既存登録（external）と app 管理 slot を混同せず、Diff / Full とも CV17 へ投入できる書出しにする。

### 最小完了条件

- operator が UI-08 で Z004 を選んでレジ登録状況を読み込み、最終読込み日時と free / external / app managed / conflict の要約を見られる。未読込みのままでは書出しへ進めず、`レジ設定の読込みが必要です` の導線が出る。
- prepare は対象 JAN ごとに最小 `free` memory No. を予約し、保存キャンセル・再 prepare でも同じ memory No. を返す。空きがなければその JAN だけ `no_free_slot`（`レジの空きスロットがありません`）で excluded になり、他は続行する。
- confirm で `reserved → active`、`release_pending → free`、`plu_dirty=0` が 1 TX で確定し、リトライは冪等。
- `plu_target 1→0` / 廃番化 / `jan_code` 変更で slot が解放され（`reserved` は直接 `free`、`active` は `release_pending`）、次回 Diff / Full に exact 11 field の clear 行が入る。
- 商品詳細（UI-01b edit）で「レジメモリNo.」が読取り専用で見え、未割当は `未割当`。
- Rust producer / `src/lib/bindings.ts` / frontend consumer が同一 commit で切り替わり、`90-traceability.md` に REQ-907 が載る。

### 失敗定義

- snapshot で観測した既存登録（external）を prepare が予約対象の空きとして使う、または `active × 別コード` conflict を app 側で上書きする。
- 同一 JAN の再 prepare で別 memory No. を返す、または confirm 前の予約が消える。
- clear 行が 11 field 形状（14 桁ゼロ / 名称空 / `\0` / 内税 / いいえ×4 / 無し / ノンリンク）から外れる、または `PLU_CLEAR_ROW_ENABLED=false` で `release_pending → free` が起きる。
- 要修正判定中の JAN が持つ既存 slot を Full が壊す（clear 化 / 別 JAN へ再割当）。
- migration v5 が既存 v4 DB で 4,784 行以外を投入する、または schema_versions を更新しない。
- 既存 test の削除・skip による通過。

### 非目的

- bulk onboarding（SPEC-PLS-D6: CSV `PLU対象` 列 / `bulk_set_plu_target` / UI-01a badge・`plu` filter）は実装 B。
- 売上取込みに占有更新を同乗させない。
- 会計・在庫系列（Z001/Z002/Z005 / 日報）に slot 状態を流さない（SPEC-PLS-D8）。
- plan-gate 前に実装 code を変更しない。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- MNT-03 / DB: `src-tauri/src/db/schema_v5.rs`（新設）+ `db/migration.rs` `migrations()` へ v5 追加。DDL は `db-design/plu-tables.md §25` の完全形（memory_no CHECK / status 5 値 CHECK / `status IN ('external','reserved','active')` の partial UNIQUE（`release_pending` 対象外、gated amendment 2）/ timestamp 列）、事前投入範囲は `SCANNING_PLU_MEMORY_START` と `PLU_EXPORT_LIMIT`（or `SCANNING_PLU_EXPORT_LIMIT`）から導出し magic number を増やさない。既存の migration test（version max/count = 4、table 一覧）を 5 / `plu_slots` 込みへ更新。
- IO: `src-tauri/src/db/plu_slot_repo.rs`（新設、`db/mod.rs` 公開、`design_compliance_test.rs` の doc→module map 登録）— 全件 ordered read、JAN / status lookup、最小 `free` 予約、sticky 取得、snapshot / prepare / confirm / release の状態遷移を呼び出し側 TX 内で提供。
- IO-02: `src-tauri/src/io/z004_parser.rs` に `parse_plu_register_snapshot(raw_bytes)`（`23-io §13.3.1`）を追加。layout A の preamble / header 検査と CP932 decode を再利用し、5,000 行の `(memory_no, raw_code)` を返す。全ゼロ = None、13 桁 + `E` は 13 桁へ、8 桁 + `E×6` は raw、行数不一致 / memory No. 欠落・重複 / header 未検出は fail-closed。
- BIZ-04: `src-tauri/src/biz/plu_export_service.rs` — `import_plu_register_snapshot(conn, raw_bytes)`（`33-biz §16.3` 照合表 12 行 + 重複 JAN → release_pending + `app_settings` 2 key + operation_log、1 TX）、`get_plu_slot_summary(conn)`、`prepare_plu_export` の書換え（`§16.4` 8 step: snapshot gate / eligible 判定 / D-028 dedup / sticky / 同一コード external の active 採用 / 最小空き予約 / Diff・Full 行構成 / 要修正中 slot 維持・非出力 / memory_no 付き行）、`confirm_plu_export_saved` の拡張（`§16.5`: exact set 再検証、reserved→active、release_pending→free、冪等）、共通解放 service（`§16.6`）。`SCANNING_PLU_EXPORT_LIMIT` との件数比較を撤廃。`PLU_CLEAR_ROW_ENABLED` 定数を `src-tauri/src/constants.rs` に置き、行構成関数は flag を引数で受けて const は 1 箇所で配線（両 mode を test 可能にする）。
- BIZ-01: `src-tauri/src/biz/product_service.rs` — `update_product` の `plu_target 1→0` と `jan_code` 変更、`toggle_discontinue` の廃番化（`plu_target=0` 同時設定、廃番解除は復帰しない）から共通解放 service を同一 TX で呼ぶ（`30-biz §4.4` step 4b / `§4.5`）。同一 JAN を共有する `plu_target=1` 未廃番商品が残れば解放しない。
- IO-04: `src-tauri/src/io/plu_formatter.rs` — 行インデックス採番（`SCANNING_PLU_MEMORY_START + i`）を撤去し入力行の `memory_no` を 6 桁ゼロ埋めで出力、範囲外は reject、clear 行の exact 11 field 出力（`25-io §12.3`）。product 行の固定列 `単品売り` は `いいえ`（`25-io §12.3` 2f / IO-04-D5、gated amendment 4）。
- CMD-08 / CMD-01 / wire: `import_plu_register_snapshot(file_bytes)`（FilePicker D-054 の bytes、`CSV_IMPORT_FILE_SIZE_LIMIT` 超過は sibling と同じ Validation error）/ `get_plu_slot_summary()`（`41-cmd §CMD-08-D4/D5`）の新設 + `lib.rs` の `collect_commands!` と `generate_handler!` 双方へ登録、prepare / confirm DTO へ `prepared_rows`（memory_no / row_kind / target_product_codes）と `no_free_slot` reason、`ProductWithRelations.plu_memory_no: Option<i64>`（`40-cmd §5.4` get_product、`20-io §` JAN LEFT JOIN）。`cargo run --bin generate_bindings` で `src/lib/bindings.ts` 再生成、同一 commit で consumer 切替。
- UI-08: `src/features/plu-export/PluExportPage.tsx` — 「レジ登録状況を読み込む」step（共通 FilePicker D-054）+ 要約表示 above the fold + `register_snapshot_required` 導線 + D4/D5/D9 改訂文言 + `no_free_slot` 理由表示 + 旧 Full-only 注意文（`PluExportPage.tsx:589`）の撤去 / 旧 Full file 再投入禁止文言。既存の localStorage 復帰・確認ボタン配置・invalidation（`67-ui §67.7〜67.11`）は維持。
- UI-01b: `src/features/products/*` edit form に「レジメモリNo.」read-only 表示（`51-ui` UI-01b-D19、未割当 = `未割当`）。
- Source doc 追随（実装で判明した最小限、design_compliance の fenced signature 契約を含む）: (1) `67-ui-plu-export.md §67.9` の full-only import note 行を撤去（UI-08-D9 と矛盾）(2) `40-cmd-product.md §5.4` 末尾の「`plu_memory_no` を含む response は後続実装 B」を実装 A へ訂正 (3) `67-ui-plu-export.md §67.8` の `confirmPluExportSaved` 行を `41-cmd` の `{ product_codes, prepared_rows }` に同期 (4) `design_compliance_test` が pub fn を function-design doc の fenced code block から検出する規約に合わせ、`33-biz §16.3` に `fn get_plu_slot_summary(...)`、`§16.6` に共通解放 service の `fn` signature、`23-io §13.3.1` に `fn parse_plu_register_snapshot(...)` の fenced block を追加し、`20-io-product-repo.md` に `db::plu_slot_repo` の pub fn signature 一覧 subsection を新設する（fn 名は Writer が確定、doc と code を一致させる）。他の source docs は PR #84 で正本化済み。
- Tests: Test Design Matrix の A-S1〜A-S4 / A-N1〜A-N9c / A-V1 / A-P1〜A-P5 / A-R1〜A-R7 + A-R5b / A-E1〜A-E6 / A-U1 / A-W1〜A-W3 / A-G1 を実装。REQ-907（必要箇所は REQ-402 併記）を test comment に付与し、`cargo run --bin generate_traceability` で `90-traceability.md` を再生成する（hand edit 禁止）。

## Non-scope

- SPEC-PLS-D6 一式（CSV `PLU対象` 列、`bulk_set_plu_target`、`ProductBulkFilter`、UI-01a の三分バケット badge / `plu` search param / 一括対象化 UI）。実装 B。
- 受入台本第2版（⑤）。
- 売上取込み（Z004 sales mode）への占有更新同乗、日報 / 集計 / 在庫の変更。
- 既存 migration v1〜v4 の変更、物理 DELETE、既存 row の変換。
- CV17 / SR-S4000 側の挙動を code で推定する（clear 行受理は L3 で確認、fallback は定数）。
- 新規 route / navigation。

## Acceptance Criteria

- `cargo test` で A-S1〜A-S4（migration v5: 既存 v4 DB へ適用して `plu_slots` 4,784 行 / CHECK / partial UNIQUE / schema_versions max=5）が通る。
- A-N1〜A-N9c: 照合表 12 行 + 重複 JAN の各 case で before/after の `plu_slots` 行と `products.plu_dirty` を assert し、`active × 別コード` が上書きされない、`reserved × 別コード` が `external + reservation_dropped` になる、行数 ≠ 5,000 / header 未検出は zero write。
- A-P1〜A-P5: 空き番号に穴がある fixture で最小空きを取る、再 prepare で同一 memory No.、`no_free_slot` は該当 JAN のみ excluded、同一 JAN 群の `target_product_codes` は全件。
- A-R1〜A-R7 + A-R5b: trigger (i)(ii)(iii)(iv) の解放、reserved 直接 free、active → release_pending、confirm で free、再対象化の復帰、`PLU_CLEAR_ROW_ENABLED=false` で clear 行非出力 + `release_pending` 維持、clear 行の 11 field exact 比較（`ノンリンク` を含む）。
- A-E1〜A-E6: `cargo test` の `plu_export_service` / `plu_formatter` tests で Full / Diff の行構成（external / free 非出力、release_pending の clear 行、要修正判定中 slot の維持・非出力）、memory No. 6 桁 `000217`、範囲外 216 / 5001 の reject（`Err`）を assert する。A-E7: product 行の固定列 `単品売り` = `いいえ` を exact で assert する（gated amendment 4）。
- A-V1 / A-U1（RTL）: UI-08 の snapshot step・要約・`レジ設定の読込みが必要です`・`レジの空きスロットがありません`・旧 Full-only 文言の不在、UI-01b の `レジメモリNo.` / `未割当`。A-E5: 回復手順文言 2 箇所が `67-ui §67.9` failure note before confirm の exact 文言で旧 Full-only 回復文言は不在（gated amendment 4）。
- A-W1〜A-W3: `bindings.ts` に `importPluRegisterSnapshot` / `getPluSlotSummary` / `pluMemoryNo` / `preparedRows` が生成され `confirmPluExportSaved` が `{ product_codes, prepared_rows }` を受け、`scripts/local-ci.sh` の `generated-bindings-diff` と `traceability` が PASS。`90-traceability.md` に REQ-907 行が入る。`cargo test --test design_compliance_test` が unexpected 0 で PASS。
- A-G1: `rg -n "全件書出しのファイルだけ|差分書出しのファイルは取り込まない|SCANNING_PLU_MEMORY_START \+ " src src-tauri/src docs --glob '!docs/archive/**' --glob '!docs/plans/**'` が 0 hit。
- L1 `scripts/local-ci.sh full` PASS、Windows native L3 で `67-ui §67.12` の checklist のうち本 PR 該当項目（snapshot / Diff・Full 投入 / clear 行受理 / レジ側未設定化）を owner が確認し結果を PR body に記録、hosted CI と exact-HEAD 三点一致。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-907（REQ-402 superseded 経緯）/ `docs/spec/requirements-coverage.md`
- Architecture: `docs/architecture/biz-task-specs.md` / `io-task-specs.md` の SPEC-PLS 節、`cmd-task-specs.md` の CMD-08 / get_product 行、`ui-task-specs.md` の UI-08 / UI-01b PLU 節（後 2 者は SPEC-PLS ラベルなしで内容のみ）
- Function / command / DTO: `docs/function-design/33-biz-plu-export-service.md §16.2〜16.8`（BIZ-04-D3〜D6）/ `30-biz-product-service.md §4.4 4b / §4.5` / `23-io-z004-parser.md §13.3.1`（IO-02-D1）/ `25-io-plu-formatter.md §12.3` / `41-cmd-pos.md` CMD-08-D4/D5 + prepare/confirm DTO / `40-cmd-product.md §5.4` get_product / `20-io-product-repo.md` plu_memory_no JOIN
- DB: `docs/db-design/plu-tables.md`（§25 plu_slots / app_settings key / 集計境界）/ `22-mnt-migration.md §13`（MNT-03-D9）
- Screen / UI: `docs/function-design/67-ui-plu-export.md §67.4〜67.12`（UI-08-D1/D4/D5/D9/D11）/ `51-ui-product-form.md §7.1` UI-01b-D19 / `60-ui-common.md` FilePicker（D-054）
- Decision log / ADR: `docs/decision-log.md` D-072（+ D-025 / D-028 / D-054）
- 前便: `docs/archive/plans/2026-08-18-plu-slot-onboarding-design.md` と同 Matrix（A-* 予約の出所。durable 設計は上記 source docs が正本）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 33-biz §16 / 30-biz §4.4・4.5 / plu-tables.md repo 責務 / 23-io §13.3.1 / 25-io §12.3 / 20-io | updated in this PR（fenced signature 追加のみ: 33-biz §16.3 summary・§16.6 解放 service、23-io §13.3.1 parser、20-io plu_slot_repo 一覧。設計内容は不変） |
| Command / DTO / generated binding / wire shape | 41-cmd CMD-08-D4/D5 + DTO / 40-cmd §5.4 / 67-ui §67.8 / cmd-task-specs | updated in this PR（40-cmd §5.4 末尾の A/B 割当 1 行、67-ui §67.8 confirm 行の `prepared_rows` 同期） |
| DB / transaction / audit / rollback / migration | plu-tables.md §25 / 22-mnt §13 | existing sufficient |
| Screen / UI / route state / Japanese wording | 67-ui §67.5・67.9・67.12 / 51-ui UI-01b-D19 | updated in this PR（67-ui §67.9 の stale full-only note 撤去のみ。回復手順文言は §67.9 既存契約へ実装を同期、doc 不変 — gated amendment 4） |
| CSV / TSV / report / import / export format | 25-io §12.3（clear 行 11 field）/ 23-io §13.3.1 | updated in this PR（gated amendment 4: §12.3 2f 固定列 `単品売り` を `はい` → `いいえ`、IO-04-D5 追記。L3 round 1 S6 実機観測起源） |
| Durable decision / ADR | D-072 | existing sufficient（Revisit 条件は L3 結果で判定） |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command `import_plu_register_snapshot` / `get_plu_slot_summary` | `lib.rs` `collect_commands!` + `generate_handler!` 双方へ登録 / `#[tauri::command]` + `#[specta::specta]` / `cargo run --bin generate_bindings` → `src/lib/bindings.ts` 再生成（A-W1）。cmd の fenced signature は `41-cmd` に既存 |
| 新規 pub fn（BIZ-04 `get_plu_slot_summary` / 共通解放 service、IO-02 `parse_plu_register_snapshot`） | 上記 Scope (4) の fenced signature を該当 function-design doc へ追加（`design_compliance_test` PASS = A-W3） |
| DTO 変更（`PluPreparedRow` / `no_free_slot` / `ProductWithRelations.plu_memory_no`） | 同上 bindings 再生成 + consumer 同一 commit 切替（A-W1） |
| 新 module `db/plu_slot_repo.rs` / `db/schema_v5.rs` | `db/mod.rs` 公開。`design_compliance_test.rs` は `docs/function-design/*.md` のみ走査し（`DESIGN_DOCS_DIR`）、src 全 module の `pub fn` が mapped doc の fenced code block に無ければ fail する。よって (a) `20-io-product-repo.md` に `db::plu_slot_repo` の pub fn signature 一覧 subsection を追加し `build_doc_to_modules_map()` の `"20-io-product-repo.md"` vec へ `db::plu_slot_repo` を追加 (b) `schema_v5.rs` の関数は v3 / v4 と同じ `pub(crate)`（検出対象外）(c) `KNOWN_ALLOWLIST` 追加は原則禁止（理由コメント付きの例外のみ、Final Review で正当性を審査） |
| migration v5 | `db/migration.rs` `migrations()` 登録 + 既存 version/table pin test 更新（A-S1） |
| REQ-907 test 付与 | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成、`--check` PASS（A-W2）。hand edit 禁止 |
| route / navigation / operator 画面新設 | 該当なし（既存 `/products/plu-export` と `/products/$code/edit` 内の変更） |
| Consultation Relay | 該当なし |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-907 / SPEC-PLS-D1 | plu-tables.md §25 / 22-mnt §13 | MNT-03-D9 | JAN 単位永続 + 事前投入で「空き = free 行」を DB で表現。products 列追加は JAN 共有群と slot 状態の分離ができず却下 | schema_v5 / migration.rs / plu_slot_repo | A-S1〜A-S4 |
| REQ-907 / SPEC-PLS-D2 | 23-io §13.3.1 / 33-biz §16.3 / plu-tables.md app_settings | IO-02-D1 / BIZ-04-D3 | Z004 全スロットダンプ 1 本で占有確定（Q2 = A）。CV17 設定書出しは不採用 | z004_parser 占有 mode / import_plu_register_snapshot / get_plu_slot_summary | A-N1〜A-N9c / A-V1 |
| REQ-907 / SPEC-PLS-D3 | 33-biz §16.4 | BIZ-04-D4 | prepare 時 idempotent 最小空き sticky。件数上限比較は実状態を表さないため撤廃 | prepare_plu_export / plu_slot_repo 予約 | A-P1〜A-P5 |
| REQ-907 / SPEC-PLS-D4 | 33-biz §16.5・16.6 / 30-biz §4.4・4.5 / 25-io §12.3 | BIZ-04-D5 / BIZ-04-D6 / BIZ-01-D3 | clear 行 + confirm で free。受理未確認のため fallback 定数 1 箇所 | 共通解放 service / product_service / confirm / formatter / constants | A-R1〜A-R7 + A-R5b |
| REQ-907 / SPEC-PLS-D5 | 33-biz §16.4 step 6-7 / 67-ui UI-08-D9 | UI-08-D9 | Diff / Full とも投入可。要修正判定中 slot は維持・非出力（Plan Gate 2 P1-3 起源） | prepare 行構成 / UI-08 文言 | A-E1〜A-E7 |
| REQ-907 / SPEC-PLS-D7（A 部分） | 67-ui UI-08-D11 / 51-ui UI-01b-D19 / 40-cmd §5.4 / 20-io | UI-08-D11 / UI-01b-D19 / CMD-01-D3 | 占有要約と read-only メモリNo. の可視化。一覧 badge / filter は B | PluExportPage / product edit form / ProductWithRelations（get_product 応答）| A-V1 / A-U1 / A-W1 |
| REQ-907 / SPEC-PLS-D9・D10 | requirements-coverage.md / decision-log D-072 | — | 実装 A で traceability test を付与、stale 語彙を残さない | test comment / 90-traceability / sweep | A-W2 / A-G1 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（PR #84 で SPEC-PLS-D1〜D10 / D-072 / REQ-907 を正本化済み。本 packet は実装順序・test 具体化・L3 段取りだけを持つ）。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: (1) `plu_memory_no` response と UI-01b 表示の A/B 割当 → `40-cmd §5.4` を実装 A へ訂正 (2) 67-ui §67.9 の stale full-only note 撤去 (3) 67-ui §67.8 confirm 行の `prepared_rows` 同期 (4) 新規 pub fn の fenced signature（design compliance 規約）。いずれも本 PR で source doc へ反映。
- Assumptions and constraints: CV17 が clear 行を受理しスロットを未設定へ戻す — L3 で確認。受理されなければ `PLU_CLEAR_ROW_ENABLED=false` へ切替（fallback、D-072 Revisit）。
- Deferred design gaps, risk, and follow-up target: bulk onboarding（実装 B）/ 受入台本第2版 / snapshot 後の手動レジ登録は escape hatch（再読込み案内文言で扱う、`67-ui` UI-08-D11）。
- Test Design Matrix can cite design decision IDs or source doc sections: yes（[Matrix](test-matrices/2026-08-18-plu-slot-core-implementation.md)）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 「既存登録を空き扱いしない」は snapshot 時点の観測が前提。snapshot 後にレジ側で手動登録された slot は次回読込みまで検出できない（escape hatch、UI 文言で再読込みを案内）。conflict は app 側で上書きせず dirty 化して operator に示す（`33-biz §16.8`）。
- 前便 WER 候補 3 点の消化: (1) 発注書の doc 節番号は本 packet 起草時に `rg -n "^## |^### "` で実在確認済み（22-mnt §13 / 33-biz §16.3〜16.6 / 23-io §13.3.1 / 25-io §12.3 / 67-ui §67.5・67.9・67.12 / 51-ui §7.1 / 40-cmd §5.4）(2) archive packet のローカル ID は引かず、正本 ID（MNT-03-D9 / BIZ-04-D3〜D6 / IO-02-D1 / UI-08-D9・D11 / UI-01b-D19 / D-028 / D-072）のみを使う (3) `90-traceability.md` 再生成を Scope / AC / Registration Obligations に明記。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Z004 layout A parser の占有 mode は adapter（IO-02）に閉じ、authority 判定は BIZ-04。CV17 の受理は adapter 側 unknown で fallback 定数化 | 23-io §13.3.1 / 33-biz §16.5 |
| Fact check / design decision split | 実機事実（clear 行受理 / Diff 投入 / 5,000 行ダンプ）は L3 で確認、設計判断は D-072 に固定済み | PR body L3 記録 |
| Lifecycle / retry | prepare 冪等・confirm 冪等・snapshot 再読込み冪等。TX 失敗は zero write | A-P2 / A-R6 / A-N4 |
| Operator workflow | UI-08 に snapshot step が先行、未読込みは gate。旧 Full-only 注意文撤去、旧 Full file 再投入禁止文言 | A-V1 / L3 |
| Replacement path | 旧 Full file は再投入しない（memory No. 永続化前）。既存 register 登録は external として保護 | 67-ui UI-08-D9 |
| Data safety / evidence | 実 Z004 / 実 PLU file は repo に入れない。fixture は synthetic 5,000 行。summary JSON に実コード・名称・価格を含めない | Data Safety |
| Reporting / accounting semantics | 不変（SPEC-PLS-D8 / D-025 / D-071）。sales mode の `parse_z004` は変更しない | A-N 非回帰（`parse_z004` 既存 test 全通） |
| Manual verification | Windows native L3 必須（`67-ui §67.12`）。店舗訪問と同期、L3 用の手順と fixture を Ready 依頼と同時に渡す | Human Gate Proposal |
| 環境・再現性 | 新設の環境依存なし。Writer 完了条件に `cargo check --release`（release build blind spot 対策） | Test Plan |

## Design Readiness

- Existing design docs are sufficient because: PR #84 で SPEC-PLS-D1〜D10 を function-design / db-design / architecture / spec / decision-log に正本化し、Plan Gate 3 round + Final Review を通過している。
- Source docs updated in this PR: `40-cmd-product.md §5.4` 末尾の A/B 割当 1 行、`67-ui-plu-export.md §67.9` の full-only import note 撤去、`67-ui §67.8` confirm 行の `prepared_rows` 同期、design compliance 用の fenced signature 追加（33-biz §16.3・16.6 / 23-io §13.3.1 / 20-io plu_slot_repo 一覧）。
- Design gaps intentionally deferred: 実装 B（D6 / UI-01a）、CV17 受理の実機事実。
- Durable decisions discovered in this plan and promoted to source docs: 上記 2 点（軽微）。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): CMD は DTO 変換のみ、TX と状態遷移は BIZ-04 / BIZ-01、slot CRUD は `db::plu_slot_repo`、parser は IO-02、行出力は IO-04。BIZ-01 → BIZ-04 の共通解放 service 呼び出しは同層依存で `architecture_test` の層規則に抵触しない。
- Backend function design: 33-biz §16.3〜16.6 / 30-biz §4.4・4.5。
- Command / DTO / data contract: 41-cmd CMD-08-D4/D5、`PluPreparedRow` / `PluRegisterSnapshotSummary` / `ProductWithRelations.plu_memory_no`。
- Persistence / transaction / audit impact: v5 migration、snapshot / prepare / confirm / release は 1 TX、operation_log に snapshot 要約。
- Operator workflow / Japanese UI wording: 67-ui §67.9 の文言表（`レジ設定の読込みが必要です` / `レジの空きスロットがありません` / 旧 Full file 再投入禁止）、51-ui `レジメモリNo.` / `未割当`。
- Error, empty, retry, and recovery behavior: 33-biz §16.8 / 67-ui §67.11。
- Testability and traceability IDs: A-* ID + REQ-907 comment + traceability 再生成。

## Contract Probe

- 「Z004 全スロットダンプは 5,000 行 layout A で、既存登録は 14 桁 E 埋めコード、空きは全ゼロ」: PR #84 の Contract Probe で実 file を local 検分（5,000 行 / 非ゼロ 929）→ 成立。本 PR は同 shape の synthetic fixture で自動 test、実 file は L3。
- 「clear 行（全ゼロコード / 名称空 / …）を CV17 が受理しスロットを未設定へ戻す」: 未検証。実験 = L3 で test PLU（レジ登録済みの test 用 JAN）を対象外化 → Diff 書出し → CV17 投入 → レジ側 slot 確認。結果に応じて `PLU_CLEAR_ROW_ENABLED` を決める（受理されなければ Ready 前に `false` へ切替、D-072 Revisit を decision-log に追記する gated amendment）。
- 「clear 行の 単価 field `\0` の実体」: local-only レジ設定書出し（`~/Downloads/inventory-field-check/approved-readable/ｽｷｬﾆﾝｸﾞPLU(商品).txt`、構造のみ）の全ゼロ行 1 行を `iconv -f CP932 -t UTF-8 | xxd` で検分 -> 単価 field は byte `5c 30`（ASCII バックスラッシュ + `0` の 2 文字。NUL でも `0` 1 文字でもない）、行末は CRLF。A-R5b の exact oracle はこの 2 文字で固定する（実コード・名称は転記しない）。
- 「共通 FilePicker（D-054）は選択 file の path を command へ渡せる」: `src/components/FilePicker.tsx` 実読 -> `onSelect` は `{ bytes, filename, size }` のみ、native dialog の path は component 外へ出さず drag&drop 経路は path 自体を持たない（`UI_TECH_STACK.md §6.5.4` と一致）。既存 `parse_and_validate_csv` / 日報取込み command は `file_bytes: Vec<u8>` 入力 -> 設計 PR #84 の `import_plu_register_snapshot(path)` は接続不能。gated amendment で bytes 入力へ改訂（Writer 差し戻し起源、2026-08-18）。
- 「migration v5 の 4,784 行事前投入は既存 v4 DB でも同一 TX で完了する」: A-S1 が既存 v4 fixture DB へ適用して検証（probe 不要、test で固定）。
- 「レジ既存登録（external）は同一コードを複数 slot に持たない」: local-only の実 Z004 全スロットダンプ（`approved-readable/Z004_01 _0001.CSV`、構造のみ）を `iconv -f CP932 | awk` で件数集計（コードは出力しない）-> `data_rows=5000 zero=4071 nonzero=929 distinct_nonzero=929 duplicate_extra=0`。external × external の同一コードは現状の実 file には無い。あれば partial UNIQUE で snapshot 全体が fail-closed（zero write）になる。gated amendment 2 の UNIQUE 対象決定（external を対象に残す）の根拠。

## Mechanical Implementation Inventory

使用 command（plan-draft 実査。実装中は symbol で再検索する）:

```text
rg -n "SCANNING_PLU_MEMORY_START|SCANNING_PLU_EXPORT_LIMIT|PLU_EXPORT_LIMIT" src-tauri/src
rg -n "全件書出しのファイルだけ|差分書出しのファイルは取り込まない|full-only" src docs --glob '!docs/archive/**'
rg -n "plu_target|plu_dirty|toggle_discontinue|jan_code" src-tauri/src/biz/product_service.rs
rg -n "fn migrations|version: 4|v1\+v2\+v3\+v4" src-tauri/src/db/migration.rs
```

| Change group | Current target | Planned result | Matrix |
|---|---|---|---|
| migration v5 | `db/migration.rs` `migrations()`（v1〜v4）、`schema_v4.rs`、pin test（max=4 / count=4 / table 一覧） | `schema_v5.rs` 追加、pin を 5 / `plu_slots` へ | A-S1〜A-S3 |
| slot repository | なし | `db/plu_slot_repo.rs` 新設 + mod 公開 + compliance map | A-S4 |
| IO-02 占有 mode | `z004_parser.rs` `parse_data_line` が `fields[0]`（メモリNo.）を読み捨て | `parse_plu_register_snapshot` 新設。`parse_z004` は不変 | A-N1b / A-N2〜A-N2c |
| BIZ-04 snapshot / summary | なし | `import_plu_register_snapshot` / `get_plu_slot_summary` + app_settings + operation_log | A-N1〜A-N9c |
| BIZ-04 prepare | `prepare_plu_export` の `count > SCANNING_PLU_EXPORT_LIMIT` 比較、memory No. 概念なし | snapshot gate / sticky 最小空き予約 / 行構成 / `NoFreeSlot` | A-P1〜A-P5 / A-E1〜A-E6 |
| BIZ-04 confirm | `confirm_plu_export_saved` が dirty clear + exported_at + log | + reserved→active / release_pending→free / exact set 再検証 / 冪等 | A-R5 / A-R6 |
| BIZ-01 trigger | `update_product`（`plu_target_enabled` のみ検知）/ `toggle_discontinue`（dirty のみ） | 1→0 / 廃番化 `plu_target=0` / JAN 変更で共通解放 service | A-R1〜A-R4 |
| IO-04 formatter | `plu_formatter.rs` `SCANNING_PLU_MEMORY_START + i` 採番、clear 行なし | 入力 `memory_no` 6 桁 / 範囲外 reject / clear 行 11 field | A-R5b / A-E2 / A-E3 |
| constants | `SCANNING_PLU_EXPORT_LIMIT` = 比較上限 | 範囲サイズ定数として維持 + `PLU_CLEAR_ROW_ENABLED` 追加 | A-R7 |
| CMD / wire | `plu_export_cmd.rs` 3 command、`product_cmd.rs` の get_product 応答 `ProductWithRelations` | + 2 command、`prepared_rows`、`no_free_slot`、`plu_memory_no`、bindings 再生成 | A-W1 |
| UI-08 | `PluExportPage.tsx`（Full-only 注意文 :589、mode 選択、dirty query） | snapshot step + 要約 + gate + 文言改訂 + 注意文撤去 | A-V1 |
| UI-01b | product edit form | `レジメモリNo.` read-only | A-U1 |
| docs 追随 | `67-ui §67.9:134` full-only note、`40-cmd §5.4` A/B 割当 | 撤去 / 訂正 | A-G1 |
| traceability | `90-traceability.md` に REQ-907 なし | 再生成 | A-W2 |

## Oracle Replacement Ledger

| Existing test / oracle | Old expectation | New expectation | Replacement (not deletion) |
|---|---|---|---|
| `plu_export_service` tests の件数上限（`SCANNING_PLU_EXPORT_LIMIT` 超過 → ValidationFailed） | 4,785 件目で拒否 | 上限比較なし。空きが尽きた JAN のみ `NoFreeSlot` excluded | A-P4 へ置換 |
| `plu_formatter` tests の memory No. = 217 + index | 先頭行 217、連番 | 入力 `memory_no` をそのまま 6 桁、範囲外 reject | A-E2 / A-E3 へ置換 |
| UI-08 RTL の Full-only 注意文 assert（存在すれば） | 文言表示 | 不在 + 旧 Full file 再投入禁止文言 | A-V1 へ置換 |
| migration pin test | max=4 / count=4 / 21 table | max=5 / count=5 / `plu_slots` 含む | A-S1 で更新 |
| `prepare_plu_export` の snapshot 前提なし | 直ちに生成 | 未読込みは `register_snapshot_required` | 既存 prepare test は fixture に snapshot 済み状態を前置して維持 |

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-PLS-D1 / MNT-03-D9（DDL / CHECK / partial UNIQUE / 4,784 行 / v5） | schema_v5 / migration.rs / plu_slot_repo | A-S1〜A-S4 | — |
| SPEC-PLS-D2 / IO-02-D1（5,000 行 / 正規化 / fail-closed） | z004_parser 占有 mode | A-N1b / A-N2〜A-N2c | 実機 Z004 読込み（初回 + 再読込み）は L3 |
| SPEC-PLS-D2 / BIZ-04-D3（照合表 12 行 + 重複 JAN + gate + app_settings + log） | import_plu_register_snapshot / get_plu_slot_summary | A-N1 / A-N3〜A-N9c | — |
| SPEC-PLS-D3 / BIZ-04-D4（eligible / dedup / sticky / 最小空き / NoFreeSlot / 行構成 / 要修正中維持） | prepare_plu_export / plu_slot_repo | A-P1〜A-P5 / A-E1 / A-E6 | — |
| SPEC-PLS-D4 / BIZ-04-D6 + BIZ-01-D3（trigger 4 種 / 共有 JAN 残存で非解放 / 廃番解除非復帰） | 共通解放 service / product_service | A-R1〜A-R4 / A-R6 | — |
| SPEC-PLS-D4 / BIZ-04-D5（confirm exact set / active 化 / free 化 / 冪等） | confirm_plu_export_saved | A-R5 / A-R6 | — |
| SPEC-PLS-D4 / IO-04 §12.3（clear 行 11 field / 6 桁 / 範囲外 reject） | plu_formatter | A-R5b / A-E2 / A-E3 | clear 行の CV17 受理 + レジ側未設定化は L3 |
| SPEC-PLS-D4 fallback（`PLU_CLEAR_ROW_ENABLED`） | constants + 行構成関数 | A-R7 | L3 結果で値確定 |
| SPEC-PLS-D5 / UI-08-D9（Diff・Full 投入可 / external・free 非出力 / release_pending clear） | prepare / UI-08 文言 | A-E1 / A-E4 / A-E5 / A-V1 | Diff 投入は L3 |
| SPEC-PLS-D7 / UI-08-D11（snapshot step / 要約 / gate 導線） | PluExportPage | A-V1 | above the fold は L3 |
| SPEC-PLS-D7 / UI-01b-D19 + CMD-01-D3（`plu_memory_no` read-only / 未割当） | ProductWithRelations（get_product 応答）/ product_repo JOIN / edit form | A-U1 / A-W1 | — |
| UI-08-D1 / D4 / D7 既存契約（confirm 分離 / キャンセルで予約維持 / localStorage 復帰） | PluExportPage 既存 | 既存 RTL 非回帰 + A-P2 | — |
| CMD-08-D4 / D5 + wire | plu_export_cmd / lib.rs / bindings.ts | A-W1 | — |
| SPEC-PLS-D8（集計不変） | 変更なし | `parse_z004` / sales 既存 test 非回帰 | — |
| SPEC-PLS-D9 / D10（REQ-907 traceability / stale 語彙 0） | test comment / 90-traceability / sweep | A-W2 / A-G1 | — |
| design compliance（新規 pub fn の fenced signature / module map） | 20-io 新 subsection + map、33-biz §16.3・16.6、23-io §13.3.1 | A-W3（`design_compliance_test` unexpected 0） | — |
| 41-cmd confirm 入力 `{ product_codes, prepared_rows }` / 67-ui §67.8 同期 | plu_export_cmd / PluExportPage / 67-ui §67.8 | A-W1 / A-R5 | — |
| D-028 三分バケット / 同一 JAN dedup（既存） | prepare | 既存 test 維持 + A-P5 | — |

## Test Plan

Test Design Matrix: [test-matrices/2026-08-18-plu-slot-core-implementation.md](test-matrices/2026-08-18-plu-slot-core-implementation.md)

- targeted tests: A-S / A-N / A-P / A-R / A-E（Rust unit + repo integration）、A-V1 / A-U1（RTL）、A-W1〜A-W2（generated 差分 0 + traceability）。
- negative tests: 行数 ≠ 5,000 / header 未検出 / memory No. 重複 / 範囲外 memory No. / snapshot 未読込み prepare / confirm の set 不一致 / NoFreeSlot。
- compatibility checks: 既存 v4 DB への v5 適用、`parse_z004` sales mode 不変、confirm の exact set 契約不変、`list_plu_dirty` / PluNotificationBar 不変。
- data safety checks: fixture は synthetic のみ、summary JSON に実コード等なし、物理 DELETE なし。
- main wiring/integration checks: FilePicker → `import_plu_register_snapshot` → BIZ-04 TX → `plu_slots` + `app_settings` → `get_plu_slot_summary` → UI 要約 → invalidation（A-V1）。
- mutation adequacy: Matrix の Mutation-style Adequacy Questions に列挙した mutant を Writer が実注入して kill を確認し、Final Reviewer が clean tree で Matrix どおりに独立再現する（kill 主張の写しは不可）。
- Human Gate に L3 を含むため Writer 完了条件に `cargo check --release` を含める（CI gate ではない）。

## Boundary / Wire Contract

- producer: Rust `cmd/plu_export_cmd.rs`（`import_plu_register_snapshot(file_bytes: Vec<u8>) -> PluRegisterSnapshotSummary`、`get_plu_slot_summary() -> PluRegisterSnapshotSummary`、`prepare_plu_export` response に `prepared_rows: Vec<PluPreparedRow>` と excluded reason `no_free_slot`、`confirm_plu_export_saved(product_codes, prepared_rows)` の 2 入力（`41-cmd`）、`cmd/product_cmd.rs` `ProductWithRelations.plu_memory_no: Option<i64>`。
- consumer: `src/features/plu-export/*`、`src/features/products/*` edit form。
- wire type: specta 生成 TS（`fileBytes: number[]`（既存 `parseAndValidateCsv` と同型）、`snapshotAt: string | null`、`freeCount` 等 number、`preparedRows[].rowKind: "product" | "clear"`、`pluMemoryNo: number | null`）。
- internal type: `PluSlotStatus` 5 値 enum、`memory_no: i64`（DB INTEGER）。
- precision/range: memory_no 217..5000（DB CHECK + formatter reject）、count は usize → number。
- round-trip path: DB `plu_slots` → BIZ summary → CMD DTO → bindings → UI。書出し側は `plu_slots.memory_no` → `PluPreparedRow` → IO-04 6 桁文字列。
- invalid input: 5,000 行以外 / header 未検出 → `ImportError`（CMD で `CmdError` 変換、UI は既存 error alert）、範囲外 memory_no は formatter reject。
- compatibility: 既存 `prepare_plu_export` / `confirm_plu_export_saved` / `list_plu_dirty` の command 名と既存 field は維持し追加のみ。bindings は同一 commit で切替。

## Human Gate Proposal

Confirmed facts:

- `67-ui §67.12` は UI-08 実装 PR に Windows native L3 と外部手順確認を必須と規定しており、本 PR の unknown（clear 行受理 / レジ側未設定化 / Diff 投入 / 実機 Z004 読込み）は native + 実機でしか観測できない。
- L3 は CV17 PC と SR-S4000 のある店舗でしか実施できないため、店舗訪問の予定と同期する必要がある。訪問まで PR は Draft のまま待機し、その間の main drift は Ready 前に rebase + L1 再取得で吸収する。

Coordinator 提案:

- 採用: Windows native L3 = required（source doc 規定）。実施項目 = (1) 実 Z004 ダンプの読込みと要約の妥当性（既存 929 + test PLU が external / app managed に正しく分かれる）(2) test PLU の JAN を対象化 → Diff 書出し → CV17 投入 → レジ scan-call で確認 (3) 同 test PLU を対象外化 → Diff 書出し（clear 行入り）→ CV17 投入 → レジ側 slot が未設定に戻るか (4) 再度 Z004 ダンプ → 再読込みで `release_pending → free` になるか (5) Full 書出しの CV17 投入。手順書と synthetic 事前確認 fixture は Ready 依頼と同時に渡す（既知 graceful stop は disposition を PR body に記録）。
- clear 行が受理されない、またはスロットが未設定へ戻らない場合: `PLU_CLEAR_ROW_ENABLED=false` へ切替（gated amendment、decision-log D-072 Revisit 追記）→ Final Review delta → Ready。
- 不採用 alternative: L3 を受入台本第2版（⑤）へ後送りして merge。source doc 規定に反し、受理されない clear 行が operator の書出しを丸ごと CV17 拒否させる runtime risk を merge 後に残すため不採用。ただし店舗訪問が大きく遅れる場合は、実装 B の packet 起草・実装を本 branch の上に stack して runway を止めない（owner 判断、介入には数えない）。
- 残る Human Gate = owner plan approval / L3（結果報告）/ human visual confirmation（L3 と同時実施可）/ Ready / merge。

## Review Focus

- 照合表 12 行 + 重複 JAN の分岐が `33-biz §16.3` と一致し、`active × 別コード` と `reserved × 別コード` が app 側上書きにならないこと（mutation A-N8 / A-N8b）。
- 最小空きが「穴」を取ること（末尾追加ではない）と sticky 再利用（A-P1 / A-P2）。
- clear 行の 11 field exact 形状と `PLU_CLEAR_ROW_ENABLED` の両 mode（A-R5b / A-R7）。
- 要修正判定中 slot を Full が壊さないこと（A-E6）。
- BIZ-01 trigger が同一 TX で呼ばれ、共有 JAN 残存で解放しないこと（A-R1〜A-R4）。
- migration v5 が既存 v4 DB で 4,784 行 exact、magic number を導入していないこと（A-S1〜A-S3）。
- bindings / traceability の generated 差分 0（A-W1 / A-W2）と stale 語彙 sweep 0（A-G1）。
- 既存 test の削除・skip がないこと。Oracle Replacement Ledger の各行が置換であること。

## Spec Contract

Contract ID: SPEC-PLS-D1〜D5、D7（A 部分）、D9、D10（正本 = 上記 Design Sources。本 packet では再定義しない）

- SPEC-PLS-D1: `plu_slots`（memory_no PK CHECK 217..5000 / scanning_code / status 5 値 / partial UNIQUE）を migration v5 で作り 4,784 行を free で事前投入する。Test: A-S1〜A-S4。
- SPEC-PLS-D2: `parse_plu_register_snapshot` は 5,000 行の `(memory_no, raw_code)` を返し fail-closed。`import_plu_register_snapshot` は照合表どおりに 1 TX で遷移し、初回未読込みの prepare は `register_snapshot_required`。Test: A-N1〜A-N9c / A-V1。
- SPEC-PLS-D3: prepare は eligible JAN に最小 free を sticky 予約し、空きなしは `no_free_slot` で当該 JAN のみ excluded。件数上限比較は行わない。Test: A-P1〜A-P5。
- SPEC-PLS-D4: (i)(ii)(iii)(iv) で解放、reserved→free / active→release_pending、clear 行 11 field、confirm で free、`PLU_CLEAR_ROW_ENABLED=false` で no-reuse。Test: A-R1〜A-R7 + A-R5b。
- SPEC-PLS-D5: Full = app 管理 slot 全体 + release_pending clear、Diff = dirty + release_pending clear、external / free 非出力、要修正判定中 slot は維持・非出力。Test: A-E1〜A-E6。
- SPEC-PLS-D7（A）: UI-08 snapshot step / 要約 / gate 導線、UI-01b `レジメモリNo.` read-only。Test: A-V1 / A-U1。
- SPEC-PLS-D9 / D10: REQ-907 traceability、stale 語彙 0。Test: A-W2 / A-G1。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-PLS-D1 | migration v5 + repo | A-S1〜A-S4 | 4,784 exact / magic number なし | cargo test |
| SPEC-PLS-D2 | parser mode + snapshot service + UI step | A-N1〜A-N9c / A-V1 | 照合表一致 / 上書き禁止 | cargo test + RTL + L3 |
| SPEC-PLS-D3 | prepare 書換え | A-P1〜A-P5 | 最小空き / sticky / NoFreeSlot | cargo test |
| SPEC-PLS-D4 | trigger + confirm + formatter + fallback | A-R1〜A-R7 + A-R5b | 11 field / 両 mode | cargo test + L3 |
| SPEC-PLS-D5 | 行構成 + UI 文言 | A-E1〜A-E7 | 要修正中維持 + 固定列 `単品売り=いいえ` | cargo test + RTL + L3 |
| SPEC-PLS-D7 | UI-08 / UI-01b / DTO | A-V1 / A-U1 / A-W1 | 文言 / read-only | RTL + bindings diff |
| SPEC-PLS-D9 / D10 | traceability / sweep | A-W2 / A-G1 | generated 差分 0 | local-ci |

## Data Safety

- 実 Z004 ダンプ、実 PLU 書出し `.txt`、店舗の商品データは commit しない（fixture は synthetic 5,000 行のみ、コードは test 用 JAN）。
- `app_settings.plu_register_snapshot_summary` は件数のみ（実コード・名称・価格を含めない）。
- local-only paths: `.local/`、L1 evidence log。
- L3 記録は匿名化して PR body に残す（CV17 エラー文言・列差異）。物理 DELETE は行わない。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Gate round 1（2026-08-18、独立 Sonnet Plan Reviewer）

- P1 1 件: Registration Obligations の `db-design/plu-tables.md` ↔ `db::plu_slot_repo` map entry は `design_compliance_test` が `docs/function-design/*.md` のみ走査するため無効（Coordinator も同時に自己検出）。実読で追加確認: `get_plu_slot_summary` / 共通解放 service / `parse_plu_register_snapshot` / `plu_slot_repo` の pub fn は function-design doc に fenced signature が無く、そのままでは unexpected 0 の assertion で fail する。是正 = Registration Obligations 行を書換え（20-io 一覧 subsection + map、schema_v5 は `pub(crate)`、allowlist 原則禁止）、Scope (4) に fenced signature 追加を明記、Ledger 行 + A-W3 追加。Reviewer 提案の allowlist 化は不採用（設計書更新が望ましいと test 自身が規定、既存 v3/v4 は `pub(crate)` で回避している精度に合わせる）。
- P2 1 件: `67-ui §67.8` の `confirmPluExportSaved({ product_codes })` が `41-cmd` の 2 入力（`prepared_rows` 追加）と不一致 → 実読確認、Scope (3) / Required Design Artifacts / Ledger / Boundary へ追加。
- P3 1 件: Design Sources の Architecture 引用が `cmd-task-specs.md` / `ui-task-specs.md` に SPEC-PLS ラベルが無い点で過大（`rg -n "SPEC-PLS"` 0 hit）→ 表現を精緻化。
- Checked but OK: Ledger 完全性 / 照合表 12 行の 1:1 / A・B 境界（Q1 裁定と整合）/ Matrix の oracle 独立・穴あり fixture・A-R5b exact / 13 field / 層規則 / 全 § anchor 実在 / Inventory の code 現況主張。
- Workflow State: Phase plan-gate、Plan Commit `fade732`。round 2 で fresh delta 再検証。

### Plan Gate round 2（2026-08-18、同 reviewer による fresh delta 再検証）

- round 1 の P1（design compliance 義務）/ P2（`67-ui §67.8`）/ P3（引用）はいずれも closed。extractor は fenced block を言語タグ不問で走査し `pub` 任意の `fn name(` regex で検出することを `design_compliance_test.rs` 実読で確認、`20-io` は mapped 済み doc、`schema_v3` / `v4` の `pub(crate)` 先例も一致。他の新規 pub fn の未文書化なし。
- delta 起因の regression なし（Workflow State 13 field、AC の evidence token 維持）。
- Verdict: P1/P2 = 0（`91a026a` 時点）。Plan Gate 収束、owner plan approval へ。

### gated amendment 1（2026-08-18、Writer 差し戻し起源）

- 事象: Codex Writer が環境確認後・実装着手前に停止し報告 — `import_plu_register_snapshot(path)`（33-biz §16.3 / 41-cmd CMD-08-D4 / 67-ui §67.8 / cmd-task-specs）は共通 FilePicker（D-054、`{ bytes, filename, size }` のみ出力）から呼べない。Coordinator が `FilePicker.tsx` / `UI_TECH_STACK.md §6.5.4` / 既存 `parse_and_validate_csv` を実読して確認。
- 選択肢: A = FilePicker に path 出力を追加（D-054 の path 非公開契約を壊し drag&drop と非整合）/ B = command・BIZ を bytes 入力へ（既存取込み command と同型、FilePicker 不変）/ C = FilePicker 迂回（D-054 違反）。裁定 = **B**。
- 変更: `33-biz §16.3` signature `raw_bytes: &[u8]` + 入力説明、`41-cmd` CMD-08-D4 `file_bytes: Vec<u8>` + size limit、`67-ui §67.8` `{ fileBytes }`、`cmd-task-specs` 入力欄、packet Scope / Boundary / Contract Probe、matrix A-V1 / Main Wiring。設計意味（照合・遷移・文言）は不変。
- WER 候補: 設計 PR の Plan Gate 2 round + Final Review が「command 入力 shape と共通 component の出力契約の接続」を見ていない。次 R3 の Plan Review 観点に「新 command の入力は呼出し側 component の出力契約と型で接続できるか」を追加する。
- Writer は同 HEAD から再開可（実装・commit 未着手のため backtrack 不要）。amendment commit = `c76fdbd`（Workflow State `Amendments` に記録）。

### gated amendment 2（2026-08-18、Writer 差し戻し起源 + Coordinator 監査追加）

- 事象: Codex Writer が実装着手前の source contract 監査で停止し報告 — `plu_slots.scanning_code` の partial UNIQUE（`status <> 'free'`）は `active` + `release_pending` の同一コード共存を拒否するため、`33-biz §16.3` の重複 JAN 解消（最小 active、残り release_pending）と `§16.6 (4)` の結果を保存できない。Coordinator が `plu-tables.md §25` / `22-mnt §13` / `33-biz §16.3〜16.6` / `20-io` / Matrix を実読して確認。`plu-tables.md §25` の散文は「スナップショット照合時の重複解消処理を除いて DB が拒否する」と例外を宣言していたが、DDL 条件がその例外を表現していなかった（設計 PR #84 の DDL と散文の不一致）。
- 選択肢: A = partial UNIQUE の対象を `status IN ('external','reserved','active')` に絞り `release_pending` を例外にする / B = 解放元コード用の別カラム追加 / C = `release_pending.scanning_code=NULL` + 追加 lifecycle 契約。裁定 = **A**。B は A と同じ不変条件（live な 3 status で code 一意）しか得られず、照合・JOIN・復元の全経路に列分岐を増やす。C は再 snapshot 時の同一 / 別コード判定（照合表 3 行）と外部登録保護を壊す。A は散文の宣言どおりに DDL を合わせるだけで、`reserved` / `active` / `external` 間の code 一意（prepare の二重確保防止・app の 1 JAN = 1 live slot）は維持される。
- A の直接帰結として明文化（既存設計で既に成立し得た `active` + `release_pending` 同一 JAN の曖昧さ解消、設計意味は不変）: (1) `20-io` / `plu-tables.md` の `plu_memory_no` JOIN は `reserved` / `active` 優先、`release_pending` のみなら最小 memory No. の 1 行 (2) `33-biz §16.4` step 4 の再対象化復元は `release_pending` 複数行なら最小 memory No. の 1 行のみ、残りは clear 対象維持（Matrix A-R6 追記）。
- Coordinator 監査で追加検出した同一 index 上の接続不能 2 件（A では解消せず、承認済み設計の未定義箇所。設計意味の**拡張**として裁定、owner が異議あれば本 commit を revert）: (iii) snapshot 時に `external` になったコードの JAN を後から `plu_target=1` にすると、`§16.4` step 5 が新規 `free` を `reserved` にし `external` + `reserved` 同一コードで UNIQUE 違反 → prepare 全体が DbError（実装 B の bulk onboarding と本 PR の L3 手順「snapshot → test PLU 対象化 → Diff」で踏む経路）。裁定 = prepare が同一コードの `external` slot を `active`（activated_at）として採用し新規予約しない（レジ既存登録の app 管理への移行、`plu_target=1` は operator の app 管理宣言、archive 設計 163 行の導線と整合）。Matrix A-P3b。(v) `reserved` / `active` を持つ JAN と同一コードを別 `free` slot で観測すると照合表が `external` にし `external` + `active` 同一コードで UNIQUE 違反 → snapshot 全体が DbError。裁定 = 重複 stale として `release_pending`（app 管理 slot の memory No. 維持、`§16.6 (4)` を「reserved / active があればそれ以外、なければ最小以外」へ精緻化。初回 snapshot の重複解消と同じ「1 JAN = 1 slot、重複は clear」の原則）。Matrix A-N3c。照合表は 12 行を維持し row 7（occupied × free）の分岐を拡張。
- 変更 file: `db-design/plu-tables.md §25`（UNIQUE 条件 / JOIN tie-break / 遷移表 3 行追加・2 行追記）、`22-mnt §13` step 2、`33-biz §16.3` row 7 + 重複 JAN 段落 / `§16.4` step 4・5 / `§16.6 (4)`、`20-io` JOIN 文、`biz-task-specs` BIZ-04 処理構造 2、packet Scope（MNT-03 / BIZ-04）/ Contract Probe（実 Z004 の distinct 集計）、matrix A-S3 / A-N3b / A-N3c 新設 / A-P3b 新設 / A-R6 / lifecycle external 行 / mutation 3 行。
- WER 候補: 設計 PR の Plan Gate は「DB 制約と状態遷移表の全遷移の両立」を機械的に突合していない。次 R3 の Plan Review 観点に「UNIQUE / CHECK の各制約について、遷移表・照合表の全行が保存可能か（制約 × 遷移の総当たり）」を追加する。
- Writer は同 HEAD から再開可（実装・commit 未着手のため backtrack 不要）。amendment commit = `ebf4a31`（Workflow State `Amendments` に記録）。

### Final Review round 1（2026-08-19、独立 Sonnet Final Reviewer、content `69a93df`）

- Verdict: P1 0 / P2 1 / P3 3。実装ロジック（照合表 12 行 / prepare 優先順位 / confirm / formatter / migration）に機能欠陥なし。mutation 12 件を clean tree に独立注入して 12/12 KILLED（復元 diff 0、SURVIVED なし）。bindings 再生成 diff 0、traceability --check OK、design_compliance PASS、`collect_commands!` / `generate_handler!` 双方登録、既存 test の不当な削除・skip なし（置換 2 件は Oracle Replacement Ledger と対応）。
- P2（accept、Coordinator が docs-only 是正）: D-052 の Revisit 条項「契約変更では production SSOT・独立 oracle・UI_TECH_STACK・該当 function-design を同一 PR で更新」に対し、Writer は SSOT + oracle のみ更新し `decision-log.md` D-052 Contract 行 / `UI_TECH_STACK.md:245` / `67-ui §67.5・67.8` が未更新（Writer 自身が権限外として申告）。是正 = 3 doc に C17（レジ登録状況 snapshot 取込み）を追記、entry / handler 件数を実測値（17 / 20、command 併記）へ更新。
- P3（accept、Coordinator が docs-only 是正）: `40-cmd §5.4:148` の応答型名 `ProductResponse` は設計 PR 由来の drift（実 get_product 応答 = `ProductWithRelations`、`ProductResponse` は PLU dirty 一覧用の別型）。doc を実型名へ訂正、packet / matrix の同語も同期（gated amendment 3）。
- P3（backlog、follow-up）: (a) A-S1 の「既存 v4 fixture DB へ適用」が新規 DB への v1〜v5 一括適用で代替されている（v5 は table 新設 + seed のみで既存 table 非依存、実害低）(b) A-N8b の oracle が `external` 化のみで「旧 JAN が次 prepare で別 slot に再予約」を直接 assert していない（ロジック自体は reviewer が code 上確認）。いずれも Rust test 追加のみで実装 B packet の Registration / test 義務に積む。relay 予算超過下で Writer 往復を増やさないための routing（P3 = same-PR optional）。
- Coordinator 判定の理由: P2 / P3 是正がすべて docs-only（6 file、16 行）で、Writer ≠ Final Reviewer の独立性を保ったまま Coordinator が最小 route で閉じられる。fresh delta は同 reviewer が再検証。

### gated amendment 3（2026-08-19、Final Review 起源）

- 事象: (1) AC A-G1 の sweep command が packet / matrix 自身（command 記載と旧状態説明）を hit し、字義どおりには成立しない（実装・source docs 側は 0 hit）(2) packet / matrix の `ProductResponse.plu_memory_no` 表記が実 wire 型と不一致。
- 是正: A-G1 command（AC / matrix A-G1 の 2 箇所。Mechanical Implementation Inventory 節の command は plan-draft 時の別系統調査用で A-G1 の assertion ではなく対象外）に `--glob '!docs/plans/**'` を追加、`ProductResponse` → `ProductWithRelations`（get_product 応答）へ packet 5 箇所 + matrix 1 箇所を同期。設計意味は不変。
- amendment commit = `56e5fda`（Workflow State `Amendments` に記録）。

### owner plan approval / 遷移記録（2026-08-18）

- owner plan approval（介入 1 回目 / 予算 3 回、owner 発言 `承認するよ`）。Coordinator 裁定（UI-01b 表示を A に含める / Windows native L3 を merge 前必須 / 予算）に異論なし。
- state-only 遷移（append-only、STATECAP forward 1 本目）: `plan-gate -> plan-approved -> implementing`。plan-approved の evidence = Plan Gate round 2 P1/P2 = 0（`91a026a`）+ owner approval。implementing の evidence = Plan Commit `fade732` 確定済み、Codex 発注書は本遷移後に提示。
- 以後の予定: Codex 実装 → L1 full → 独立 Sonnet Final Review → state-only 2 本目（`local-verified -> independent-review -> human-confirm`）→ L3 + visual → Ready 承認 → state-only 3 本目（`ready-hosted-final`）。

### 実装完了 / 遷移記録（2026-08-19）

- state-only 遷移（append-only、STATECAP forward 2 本目、post-implementation 1 本目）: `implementing -> local-verified -> independent-review -> human-confirm`。
- local-verified の evidence = content candidate `f30d9ff` に対する L1 `scripts/local-ci.sh full` RESULT=PASS / END_TREE_STATE=CLEAN / MERGE_EVIDENCE_VALID=true（evidence log は PR body に記録。Writer content `69a93df` 時点の L1 PASS もあり、以後は docs-only）。
- independent-review の evidence = 独立 Sonnet Final Review round 1（P1 0 / P2 1 / P3 3、mutation 12/12 独立 KILLED）+ fresh delta 再検証（`1c9571a`、P1/P2 = 0）+ narrative 1 行 delta の ack（`f30d9ff`、verdict 維持）。
- human-confirm の evidence = findings 裁定済み（P2 / P3 accept 是正 = `56e5fda`、P3 2 件 follow-up routing）、Reviewed Content HEAD = `f30d9ff`。
- 残る Human Gate = Windows native L3（`67-ui §67.12` 該当項目、店舗訪問と同期。手順書と synthetic fixture は Coordinator が owner へ提示済み）/ human visual confirmation（L3 と同時）/ Ready 承認 / merge。L3 で clear 行が受理されない場合は `PLU_CLEAR_ROW_ENABLED=false` の gated amendment + Final Review delta を経て Ready。
- Owner Effort Budget 実績（2026-08-19 時点）: 介入 1/3（plan approval）、relay 往復 3/2（初回発注 / amendment 1 再開 / amendment 2 再開。超過は Coordinator の設計監査不足に起因、Writer 往復はこれ以上増やさない）、STATECAP forward 2/3。

### Windows native L3 round 1 FAIL / state-backtrack 記録（2026-08-19）

- 結果（owner 報告、店 PC、exact HEAD = `4835073`、AppData なし、register baseline 確認済み）: Phase 0 / S1〜S5 PASS（Z004 読込み free 3,851 / external 933 / app managed 0 / conflict 0 = 合計 4,784、T1 対象化で `未割当`、Diff 保存で 6 桁 memory No. 割当 + 旧 Full file 再投入禁止文言、CV17 1.1.1 受理、SD 書込み + SR-S4000 設定読込み）。**S6 FAIL**: アプリ生成行が `単品売り=はい` のため scan-call だけで現金ちょうどの自動会計 + レシート発行となる（operator の選択なし）。owner が CV17 上で T1 のみ `単品売り=いいえ` に変更して再投入すると scan-call 後は通常の会計待ちになり、原因が `単品売り=はい` であることを実機確認。S7〜S14（confirm / 対象外化 / clear 行 / CV17 clear 受理 / 未設定化 / 再 Z004 / Full）は未実施。テスト売上は戻モードで相殺、追加診断取引は取引中止済み、アプリの「未反映から外す」は未操作。register baseline 復元は owner 判断で省略（店舗はスキャニング PLU を実運用していない）。実 JAN・商品名・価格・実ファイル・DB・backup は転記しない。
- 追加 UI 所見（owner）: 保存済み未確認の復帰 Alert の回復手順文言が Full-only の再書出し案内（`未反映を外さずに全件を書き出し直して取り込んでください`）のままで、source contract `67-ui §67.9`「failure note before confirm」= `保存済みファイルを再投入するか、差分または全件を書き出し直してください。`（UI-08-D4 / D10、PR #84 で改訂済み）と不一致。保存完了後の独立 warning Alert も同文のため同一欠陥。
- 根本原因: (1) `25-io §12.3` 処理ステップ 2f の固定列 `単品売り=はい` は CV17 template 由来の値で、SR-S4000 ではこの値が scan-call 即時会計（単品売り）を意味する。実装（`plu_formatter.rs` 固定列 + test assert）は設計どおりで、設計契約が実機挙動と不一致（設計起源、Writer 責任外）。(2) 回復手順文言は PR #84 の `67-ui §67.9` 文言表改訂に対する実装同期漏れ + Final Review の文言表突合漏れ（A-V1 は「旧 Full-only 注意文（保存前 warning）の不在」のみ assert し、回復手順文言は旧文言を test が pin していた）。
- 裁定: state-backtrack `human-confirm -> implementing`（最早影響 phase = implementing、code 是正を伴うため）。Reviewed Content HEAD は pending へ戻す（`f30d9ff` の監査記録は Review Response に保持）。是正は gated amendment 4（`25-io §12.3` 2f `単品売り=いいえ` + `67-ui` 文言表はそのまま実装同期）として Coordinator/Writer 兼務で実施する（PR #81 先例。relay 往復 3/2 超過につき Writer 往復を増やさない budget 判断、独立 Sonnet Final Review delta で自己承認を回避）。`implementing -> local-verified` は是正 content commit に同乗し、以後は L3 round 2（次回店舗訪問、Phase 0 から S1〜S14 全再走。S6 はアプリ生成 file の `いいえ` で再確認）→ Ready 承認後に state-only 3 本目（`local-verified -> independent-review -> human-confirm -> ready-hosted-final` の隣接 forward 圧縮、Reviewed Content HEAD 設定）。
- Owner Effort Budget 実績: 介入 2/3（plan approval / L3 round 1 結果報告）。packet 想定どおり L3 round 2 = 3/3、Ready 承認 = 4/3 の超過が確定（超過報告は Ready 依頼時に明示）。STATECAP forward 2/3（backtrack は cap 対象外）。

### gated amendment 4（2026-08-19、Windows native L3 round 1 FAIL 起源）

- 事象: 上記 L3 round 1 記録のとおり (1) `25-io §12.3` 2f の固定列 `単品売り=はい` が SR-S4000 で scan-call 即時の自動会計 + レシート発行になる（設計契約と実機挙動の不一致、owner が `いいえ` で通常会計待ちになることを実機確認）(2) 回復手順文言 2 箇所（保存後 warning Alert / 復帰 Alert）が `67-ui §67.9` failure note before confirm（PR #84 改訂）の exact 文言に未同期。
- 是正: (1) `25-io §12.3` 2f を `単品売り=いいえ` へ改め IO-04-D5（理由 = 実機観測）を追記、`plu_formatter.rs` の固定列 + 既存 unit test の assert を `いいえ` へ（Matrix A-E7 新設 + mutation 設問「`はい` に戻す → A-E7」）、`docs/project-memory.md` CV17 profile 行に観測を追記 (2) `PluExportPage.tsx` 2 箇所 + RTL 2 箇所を `67-ui §67.9` の exact 文言へ同期（Matrix A-E5 拡張 + mutation 設問）。packet Scope IO-04 / AC / Required Design Artifacts / Trace Matrix を同期。`67-ui` 本文は不変（既存契約へ実装を合わせるのみ）。
- 設計意味の影響: 書出し file の列構成・行選択・slot 遷移は不変。変わるのは product 行 field[5] の固定値のみ。D-072 の Decision / Revisit は変更なし（clear 行受理は L3 round 2 で判定）。
- 実装者: Coordinator/Writer 兼務（PR #81 gated Amendment 4 先例。relay 往復 3/2 超過で Writer 往復を増やさない budget 判断）。独立 Sonnet Final Reviewer が delta を再検証して自己承認を回避する。
- amendment commit = `42d88bf`（Workflow State `Amendments` に記録）。

### Final Review delta（2026-08-19、独立 Sonnet Final Reviewer、content `42d88bf`）

- Verdict: P1 0 / P2 0 / P3 1。worktree 隔離の clean tree で mutation 3 件（formatter 固定列 `いいえ→はい` / 回復手順文言 2 箇所の各旧文言化）を独立注入し 3/3 KILLED（復元後 tree clean）。sweep: `単品売り` の forward-looking 残存 0（旧値 `はい` は packet / 25-io の理由説明文のみ）、旧 Full-only 回復文言は `src` 0 hit、新文言は `67-ui §67.9` と byte 一致 4 hit、A-G1 0 hit。A-E7 / A-E5 の oracle と実 assert が一致、oracle は production 定数非依存、既存 test の削除・skip なし、packet 記載の file / 箇所数は diff と一致。
- P3（accept、Coordinator が docs-only 是正）: Matrix の A-E7 行が A-E6 の前に挿入されていた並び順を A-E6 の後へ移動（本記録 commit に同乗）。
- L1 full は `42d88bf` で RESULT=PASS / END_TREE_STATE=CLEAN / MERGE_EVIDENCE_VALID=true（evidence は PR body）。Phase は implementing のまま据え置き、L3 round 2 PASS + Ready 承認後に state-only 3 本目で `implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final` を隣接 forward 圧縮で materialize する（evidence = 本 L1 / 本 Final Review delta / L3 round 2 / Ready 承認、Reviewed Content HEAD を同 commit で設定）。
