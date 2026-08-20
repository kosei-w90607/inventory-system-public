# Test Design Matrix: PLU slot core 実装（実装 A）

Plan Packet: [2026-08-18-plu-slot-core-implementation.md](../2026-08-18-plu-slot-core-implementation.md)

## Risk

R3。schema migration、新規 repository、IO-02 新 mode、BIZ-04 prepare / confirm 書換え、BIZ-01 解放 trigger、IO-04 行構成、command 2 本 + DTO + bindings、UI-08 / UI-01b。誤りはレジ側の既存 PLU 上書き・意図しない消去・CV17 拒否に直結する。会計系列は不変。

## Contracts Under Test

- SPEC-PLS-D1 / MNT-03-D9: `plu_slots` DDL、partial UNIQUE、4,784 行事前投入、schema_versions v5（`db-design/plu-tables.md §25`、`22-mnt §13`）
- SPEC-PLS-D2 / IO-02-D1: `parse_plu_register_snapshot` の 5,000 行 `(memory_no, raw_code)`、正規化、fail-closed（`23-io §13.3.1`）
- SPEC-PLS-D2 / BIZ-04-D3: 照合表 12 行 + 重複 JAN、`register_snapshot_required`、app_settings 2 key、operation_log（`33-biz §16.3`）
- SPEC-PLS-D3 / BIZ-04-D4: eligible / D-028 dedup / sticky / 最小 free / `NoFreeSlot` / Diff・Full 行構成 / 要修正中維持（`33-biz §16.4`）
- SPEC-PLS-D4 / BIZ-04-D5・D6 / BIZ-01-D3: confirm exact set + active 化 + free 化 + 冪等、trigger 4 種、共有 JAN 残存で非解放、廃番解除非復帰（`33-biz §16.5・16.6`、`30-biz §4.4・4.5`）
- SPEC-PLS-D4 / IO-04: clear 行 11 field exact、memory No. 6 桁、範囲外 reject（`25-io §12.3`）、`PLU_CLEAR_ROW_ENABLED` 両 mode
- SPEC-PLS-D5 / UI-08-D9: Diff・Full 投入可文言、external / free 非出力
- SPEC-PLS-D7 / UI-08-D11 / UI-01b-D19 / CMD-01-D3: snapshot step + 要約 + gate 導線、`レジメモリNo.` read-only / `未割当`、`ProductWithRelations.plu_memory_no`
- SPEC-PLS-D9 / D10: REQ-907 traceability、stale 語彙 0

## Failure Modes

- snapshot で external を free 扱い → prepare がレジ既存登録の memory No. を予約し CV17 投入で上書き
- `active × 別コード` / `reserved × 別コード` を app 側で上書き（conflict / reservation_dropped にしない）
- 再 prepare で別 memory No.（sticky 欠落）、confirm 前に予約が消える
- 最小空きではなく末尾 + 1 を取る（穴を埋めない）
- clear 行の field 欠落・順序違い（特に `ノンリンク` / `\0`）、または fallback=false でも clear 行 / free 化が起きる
- 要修正判定中 JAN の既存 slot を Full が clear 化 / 再割当
- migration v5 が行数不一致・schema_versions 未更新・magic number 重複
- bindings 未再生成 / consumer 旧 field 参照 / traceability 未再生成
- 既存 test の削除・skip

## Test Matrix

| ID | Contract | Type | Target / test name（Writer が具体名を確定、`REQ-907` comment 必須） | Oracle |
|---|---|---|---|---|
| A-S1 | D1 migration v5 | Rust integration | `db/migration.rs` tests: 既存 v4 fixture DB へ `run_migrations` → `plu_slots` 行数 = 4,784、`MIN/MAX(memory_no)` = 217 / 5000、全 status = free、schema_versions max=5 count=5、既存 pin test 更新 | 直値 4,784 / 217 / 5000 を test 側に独立転記（production 定数から導出しない） |
| A-S2 | D1 CHECK | Rust unit | memory_no 216 / 5001、status `'unknown'` の INSERT が CHECK 違反 | `DbError` |
| A-S3 | D1 partial UNIQUE | Rust unit | 同一 scanning_code を `active` × 2 → 違反、`external` + `active` / `external` + `reserved` 同一コードは違反、`free` × 2（NULL）は許容、`active` + `release_pending` / `release_pending` × 2 / `external` + `release_pending` 同一コードは許容（index 対象 = external / reserved / active） | 違反 / 成功 |
| A-S4 | D1 repo | Rust unit | `plu_slot_repo`: ordered 全件 / JAN lookup / 最小 free 取得（穴あり fixture）/ 状態遷移 update / TX 内 rollback で無変化 | 期待 memory_no と行 |
| A-N1 | D2 gate | Rust unit | snapshot 未読込みで `prepare_plu_export` → `ValidationFailed(register_snapshot_required)`、write 0 | error kind + DB before/after 同値 |
| A-N1b | D2 parser fail-closed | Rust unit | 4,999 行 / 5,001 行 / header 未検出 / memory_no 重複 / 欠落 / 範囲外 → `ImportError`、部分結果なし | error + Vec 不返却 |
| A-N2 | D2 parser 正規化 | Rust unit | 13 桁 + `E` → 13 桁、8 桁 + `E×6` → 14 桁 raw、全ゼロ → None（行は skip しない、5,000 行維持） | 各 raw_code |
| A-N2b | D2 parser sales 不変 | Rust unit | 同 fixture を `parse_z004` に通した既存 test が全通、`ParsedRow` 型不変 | 既存 test |
| A-N2c | D2 parser 非 JAN raw | Rust unit | 上記以外の非空コード（例 12 桁 + `EE`）は trim / 補正せず raw | raw 一致 |
| A-N3 | D2 free × occupied 採用 | Rust integration | free slot に eligible 未割当 JAN と一致するコード → active（activated_at）、products.plu_dirty 不変 | 行 status |
| A-N3b | D2 重複 JAN | Rust integration | free 2 slot に同一 eligible JAN → 最小のみ active、他は release_pending（scanning_code 保持、TX commit 成功） | 行 status + scanning_code |
| A-N3c | D2 app 管理 JAN の重複観測 | Rust integration | reserved（レジ空）/ active を持つ JAN と同一コードを別 free slot で観測 → その slot は release_pending（scanning_code 保持）、app 管理 slot の memory No. / status は不変、external にならない | 行 status |
| A-N4 | D2 空 × free/external | Rust integration | free 維持 / external → free + scanning_code NULL | 行 |
| A-N4b | D2 空 × reserved | Rust integration | reserved 維持（reserved_at 不変） | 行 |
| A-N5 | D2 同一 × external | Rust integration | external 維持 | 行 |
| A-N5b | D2 別 × external | Rust integration | 観測値で external 更新 | scanning_code |
| A-N6 | D2 同一 × reserved | Rust integration | active + activated_at | 行 |
| A-N6b | D2 空 × active | Rust integration | active 維持 + `missing_on_register` + 対応商品 plu_dirty=1 | summary conflict + products |
| A-N7 | D2 同一 × active / release_pending | Rust integration | 現 status 維持 | 行 |
| A-N8 | D2 別 × active | Rust integration | active 維持 + conflict + 対応商品 dirty。scanning_code は app JAN のまま | 行 + summary |
| A-N8b | D2 別 × reserved | Rust integration | 観測値を external + `reservation_dropped`、旧 JAN は次 prepare で再予約（別 slot） | 行 + summary + 再 prepare 結果 |
| A-N8c | D2 occupied × free 非 eligible | Rust integration | eligible でない（対象外 / 無効 JAN / 8 桁）→ external | 行 |
| A-N9 | D2 空 × release_pending | Rust integration | free + released_at | 行 |
| A-N9b | D2 別 × release_pending | Rust integration | 観測値を external | 行 |
| A-N9c | D2 app_settings / log | Rust integration | `plu_register_snapshot_at` ISO8601 + `plu_register_snapshot_summary` JSON（件数のみ）+ operation_log 1 行、TX 失敗時は 3 者とも無変化 | key 値 / 件数 |
| A-P1 | D3 最小空き | Rust integration | free = {300, 217, 5000, 401} の穴あり fixture で新規 JAN → 217、次 → 300 | memory_no |
| A-P2 | D3 sticky | Rust integration | 同 mode / 別 mode で再 prepare → 同一 memory_no、reserved 行数不変 | memory_no / 行数 |
| A-P3 | D3 confirm active 化 | Rust integration | prepare → confirm → reserved→active、plu_dirty=0、plu_exported_at | 行 + products |
| A-P3b | D3 external 採用 | Rust integration | snapshot で external になったコードの JAN を後から plu_target=1 → prepare は新規 free を予約せず同 slot を active（activated_at）に採用、product 行の memory_no = その slot、free 行数不変。DbError にならない | 行 + rows |
| A-P4 | D3 NoFreeSlot | Rust integration | free 0 の fixture で 2 JAN → 両方 `NoFreeSlot` excluded、既存 active 行は出力継続、error にならない | excluded reason + rows |
| A-P5 | D3 JAN 群 | Rust integration | 同一 JAN 3 商品 → 1 slot、`target_product_codes` 3 件、価格不一致は既存 `group_price_mismatch` | rows / codes |
| A-R1 | D4 trigger (i) | Rust integration | `update_product` plu_target 1→0: reserved → free（直接）/ active → release_pending。同 JAN の他商品が plu_target=1 未廃番なら不変 | 行 |
| A-R2 | D4 trigger (ii) | Rust integration | `toggle_discontinue` 廃番化 → plu_target=0 + 解放、廃番解除で plu_target は 0 のまま・slot 不変 | products + 行 |
| A-R3 | D4 trigger (iii) | Rust integration | `jan_code` 変更 → 旧 JAN slot 解放（共有残存なら維持）、新 JAN は次 prepare で予約 | 行 |
| A-R4 | D4 trigger (iv) | Rust integration | = A-N3b（snapshot 重複）で release_pending | 行 |
| A-R5 | D4 confirm free 化 | Rust integration | release_pending の clear 行を含む confirm → free + scanning_code NULL + released_at；set 不一致（別 memory_no / 別 product_code）は reject + 無変化；同一 set 再 confirm は冪等 | 行 / error |
| A-R5b | D4 clear 行形状 | Rust unit | formatter: clear 行 = `000217\t00000000000000\t\t\\0\t税1(内税)\tいいえ\tいいえ\tいいえ\tいいえ\t無し\tノンリンク` + CRLF の exact 11 field を `25-io §12.3` の定義文から独立転記して完全一致。単価 field は ASCII 2 文字 `\` (0x5C) + `0` (0x30)（packet Contract Probe で実 file byte 検分済み）、NUL や `0` 1 文字は不可 | 文字列 exact |
| A-R6 | D4 再対象化 | Rust integration | release_pending の JAN を plu_target=1 に戻して prepare → active（activated_at あり）または reserved に復帰、clear 行は出ない；同一 JAN の release_pending 2 行なら最小 memory_no のみ復帰し残り 1 行は release_pending のまま clear 行に出る | 行 / rows |
| A-R7 | D4 fallback | Rust unit | 行構成関数に `clear_row_enabled=false` → clear 行 0、confirm 経路で release_pending 維持（free 化なし）；`true` は A-R5 どおり。const の配線箇所が 1 つ | rows / 行 |
| A-E1 | D5 Full 構成 | Rust integration | Full = reserved/active の product 行 + release_pending clear 行、memory_no 昇順、external / free 0 行 | rows |
| A-E2 | D5 memory No. 6 桁 | Rust unit | 217 → `000217`、5000 → `005000` | 文字列 |
| A-E3 | D5 範囲外 reject | Rust unit | 216 / 5001 を持つ行 → formatter error | error |
| A-E4 | D5 Diff 構成 | Rust integration | Diff = plu_dirty=1 の product 行 + 全 release_pending clear 行 | rows |
| A-E5 | D5 UI 文言 | RTL | UI-08 に「Diff / Full とも投入可」系文言と旧 Full file 再投入禁止文言、旧 Full-only 注意文は不在。回復手順文言（保存後 warning Alert + 復帰 Alert の 2 箇所）は `67-ui §67.9` failure note before confirm の exact 文言（`保存済みファイルを再投入するか、差分または全件を書き出し直してください。`）で、旧 Full-only 回復文言（`未反映を外さずに全件を書き出し直して`）は不在（gated amendment 4） | text |
| A-E6 | D5 要修正中維持 | Rust integration | active slot を持つ JAN を check digit 不正にして Full / Diff → 行 0（product / clear とも）、slot 不変、excluded に理由付き | rows / 行 / excluded |
| A-E7 | D5 固定列 | Rust unit | product 行の field[5] `単品売り` = `いいえ`（`25-io §12.3` 2f から独立転記、exact）。field[6..9] = `いいえ` / `いいえ` / `いいえ` / `無し` も同 test で exact（gated amendment 4、L3 round 1 S6 FAIL 起源） | 文字列 exact |
| A-V1 | D7 UI-08 | RTL | FilePicker `onSelect` の `bytes` → `importPluRegisterSnapshot({ fileBytes })` 呼出し（path を渡さない）→ 要約表示（日時 + 4 表示件数 + wire の `release_pending_count`）→ 未読込み時の `レジ設定の読込みが必要です` と書出し無効化 → 読込み後の有効化 → invalidation → `no_free_slot` 理由表示 `レジの空きスロットがありません`。既存 localStorage 復帰・confirm 導線 test は不変 | text / call / query |
| A-V1b | D5/D7 UI-08-D11 / D-052 | Rust + RTL | summary fixture を active 1 + release_pending 1 として app managed=2 / release pending=1 を独立 assert。商品 dirty=0 / release=1 は解除待ち文言 + Diff 1 + prepare 呼出し、商品 dirty=0 / app managed=1 / release=0 は Diff 0 + disabled。C2 product update、C18 prepare、C14 confirm は独立 oracle と exact invalidation | app managed を release count に代入、release count を無視、3 lifecycle の slot summary key 欠落を red |
| A-U1 | D7 UI-01b | RTL | edit form に `レジメモリNo.` read-only、値あり / `未割当` | text / readonly 属性 |
| A-W1 | D7 wire | generated | `generate_bindings` 後 diff 0、`bindings.ts` に `importPluRegisterSnapshot` / `getPluSlotSummary` / `pluMemoryNo` / `preparedRows`、`confirmPluExportSaved` の入力が `{ product_codes, prepared_rows }` | local-ci `generated-bindings-diff` |
| A-W2 | D9 traceability | generated | `generate_traceability --check` PASS、`90-traceability.md` に REQ-907 行 | local-ci `traceability` |
| A-W3 | design compliance | Rust integration | `cargo test --test design_compliance_test` unexpected 0（新規 pub fn は 33-biz §16.3・16.6 / 23-io §13.3.1 / 20-io plu_slot_repo 一覧の fenced signature と一致、`schema_v5` は `pub(crate)`、allowlist 追加なし） | test PASS + allowlist diff 0 |
| A-G1 | D10 sweep | rg | `rg -n "全件書出しのファイルだけ|差分書出しのファイルは取り込まない|SCANNING_PLU_MEMORY_START \+ " src src-tauri/src docs --glob '!docs/archive/**' --glob '!docs/plans/**'` = 0 | 0 hit |

## Oracle Replacement Map

| Existing oracle | Replaced by | Reason |
|---|---|---|
| `SCANNING_PLU_EXPORT_LIMIT` 超過 → ValidationFailed | A-P4 | 件数上限比較撤廃（SPEC-PLS-D3） |
| formatter memory No. = 217 + index | A-E2 / A-E3 | 入力 memory_no 採用（25-io §12.3） |
| migration pin max=4 / count=4 / 21 table | A-S1 | v5 追加 |
| prepare の snapshot 前提なし | 既存 test は fixture に snapshot 済み状態を前置 | gate 追加（A-N1） |
| UI-08 Full-only 注意文 | A-E5 | UI-08-D9 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| plu_slot free | v5 事前投入 | prepare で reserved | confirm で active | — | snapshot で external/active 化 | — | 起動で不変 | CHECK/UNIQUE 違反で TX rollback | 同 prepare 冪等 | A-S / A-P1 / A-N3 |
| plu_slot reserved | prepare | 保存待ち | confirm → active | plu_target 0 → free 直接 | snapshot 同一 → active / 別 → external + dropped / 空 → 維持 | 再 prepare sticky | 予約は永続 | confirm set 不一致 reject | 同 set 冪等 | A-P2 / A-N6 / A-N6b・A-N8b / A-R1 |
| plu_slot active | confirm | — | 維持 | trigger で release_pending | snapshot 空 → missing + dirty / 別 → conflict + dirty | 再対象化で維持 | 永続 | 上書き禁止 | — | A-P3 / A-N6b / A-N8 / A-R1 |
| plu_slot release_pending | trigger | clear 行出力待ち | confirm → free（enabled 時） | 再対象化 → active/reserved 復帰 | snapshot 空 → free / 別 → external | Diff/Full 毎に clear 行 | 永続 | fallback=false で維持 | 冪等 | A-R5 / A-R6 / A-R7 / A-N9 |
| plu_slot external | snapshot | — | 維持 | snapshot 空 → free | 別コードで更新 | prepare は同一 JAN 対象化時のみ active へ採用、他は触らない | 永続 | — | — | A-N4 / A-N5 / A-N5b / A-N8c / A-P3b |
| snapshot summary（app_settings + live slots） | 未読込み = null / 0 | 読込み TX | 日時 + 4 表示件数 + release pending 内数 | C2 update / C18 prepare / C14 confirm / C17 snapshot | slot summary refetch | 再訪で再取得 | 永続 | TX 失敗で無変化 | 再操作 | A-N9c / A-V1 / A-V1b |
| UI-08 gate | 未読込み → 書出し無効 | FilePicker | 有効化 | — | 要約 refetch | 再訪でも summary で判定 | localStorage 復帰は既存どおり | ImportError alert | 再選択 | A-V1 |
| implementation workflow | plan-draft | Plan Gate | plan-approved 後のみ code | content candidate で L1 | review で Ledger 再検証 | finding は implementing へ | exact HEAD 再検証 | design gap は design へ | gated amendment 後 re-review | packet Workflow State |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| layout A parser（IO-02 sales mode） | `io/z004_parser.rs` `parse_z004` / `parse_data_line` | 占有 mode は preamble / header / decode を共有 | sales 側の JAN 妥当性・売上列評価は共有しない（SPEC-PLS-D8） | A-N2b |
| migration 追加パターン（v2〜v4） | `db/migration.rs` / `schema_v4.rs` | v5 同型 | v3 backfill / v4 table は不変 | A-S1 |
| product_service の dirty 更新 | `update_product` / `toggle_discontinue` / `create_product` | trigger 呼出しを追加 | `create_product` は解放対象なし（新規 JAN は次 prepare） | A-R1〜A-R3 |
| CMD DTO 変換 / specta 登録 | `cmd/plu_export_cmd.rs` / `lib.rs` | 2 command 追加 | bulk 系は B | A-W1 |
| FilePicker（D-054） | 既存 CSV / Z004 / 日報取込み UI | UI-08 snapshot step | — | A-V1 |
| REQ comment + traceability | 既存 `// REQ-xxx:` 慣行 | REQ-907 | — | A-W2 |

## Negative Paths

- 行数 ≠ 5,000 / header 未検出 / memory_no 重複・欠落・範囲外 → ImportError、無変化（A-N1b）
- snapshot 未読込みの prepare → `register_snapshot_required`（A-N1）
- confirm の set 不一致 → reject 無変化（A-R5）
- free 0 → `NoFreeSlot` 該当 JAN のみ excluded（A-P4）
- 範囲外 memory_no の行 → formatter error（A-E3）
- CHECK / UNIQUE 違反 → DbError + rollback（A-S2 / A-S3）

## Boundary Checks

- memory_no 217 / 5000 / 216 / 5001（A-S1 / A-S2 / A-E2 / A-E3）
- 5,000 ± 1 行（A-N1b）
- clear 行 11 field exact（`ノンリンク` を含む）と 6 桁ゼロ埋め（A-R5b / A-E2）
- 同一 JAN × 複数 slot / 複数商品（A-N3b / A-P5）
- 空き番号の穴（A-P1）

## Compatibility Checks

- 既存 v4 DB への v5 適用（A-S1）
- `parse_z004` sales mode と `ParsedRow` 不変（A-N2b）
- `prepare_plu_export` / `confirm_plu_export_saved` / `list_plu_dirty` の command 名 + 既存 field 維持、PluNotificationBar 非回帰（既存 RTL）
- UI-08 の localStorage 復帰・confirm 導線・D-054 FilePicker 契約不変（既存 RTL）
- 会計・在庫系列 test 全通（SPEC-PLS-D8）

## Data Safety Checks

- fixture は synthetic 5,000 行 layout A / test 用 JAN のみ、実店舗データを commit しない
- summary JSON に件数以外を含めない（A-N9c で key 集合を assert）
- 物理 DELETE なし（release は status 遷移）
- L3 記録は匿名化

## Main Wiring / Integration Checks

- FilePicker `PickedFile.bytes` → `import_plu_register_snapshot(file_bytes)` → CMD → BIZ-04 TX → `plu_slots` + `app_settings` + operation_log → `get_plu_slot_summary`（release pending 内数を別集計）→ UI 要約 / Diff gate → C2 / C18 / C14 / C17 query invalidation（A-V1 + A-V1b + A-N9c）
- product edit → `get_product` → `plu_memory_no` → UI-01b 表示（A-U1 + A-W1）
- prepare → `PluPreparedRow` → formatter → TSV bytes → confirm exact set（A-P3 / A-R5）
- `lib.rs` `collect_commands!` と `generate_handler!` の双方に 2 command（A-W1、片方欠落は bindings diff または実行時 error で検出）

## Mutation-style Adequacy Questions

Writer は下記 mutant を実注入して各 test の kill を確認し、Final Reviewer は clean tree で同 Matrix どおりに独立再現する。

| Mutant | Must be killed by |
|---|---|
| 照合 `別 × active` を「観測値で scanning_code 上書き（active 維持）」に変更 | A-N8 |
| 照合 `別 × reserved` を「app 予約維持（external 化しない）」に変更 | A-N8b |
| 照合 `空 × active` の dirty 化を削除 | A-N6b |
| 重複 JAN で最小以外を release_pending にせず全 active | A-N3b |
| 最小 free 選択を `MAX(memory_no)+1` に変更 | A-P1（穴あり fixture 必須） |
| sticky 取得を外し毎回新規予約 | A-P2 |
| snapshot gate を削除 | A-N1 |
| `NoFreeSlot` を全体 error（ValidationFailed）に変更 | A-P4 |
| clear 行の `ノンリンク` を `無し` に、または field を 10 個に | A-R5b |
| confirm の `release_pending → free` を削除 | A-R5 |
| `clear_row_enabled=false` でも clear 行を出す / free 化する | A-R7 |
| trigger (ii) 廃番化で plu_target=0 を設定しない | A-R2 |
| trigger (iii) JAN 変更で旧 slot を解放しない | A-R3 |
| 共有 JAN 残存判定を外して常に解放 | A-R1（共有 fixture） |
| 要修正判定中 JAN の既存 slot を clear 行に | A-E6 |
| Full に external 行を出す | A-E1 |
| formatter を index 採番に戻す | A-E2 / A-P1（memory_no 不一致） |
| 範囲外 memory_no を許容 | A-E3 |
| v5 投入行数を 4,783 / 4,785 に | A-S1（直値 oracle） |
| partial UNIQUE の対象を `status <> 'free'` に戻す / 外す | A-S3（active + release_pending が違反になる / free × 2 が違反になる） |
| prepare の external 採用を新規 free 予約に置換 | A-P3b（UNIQUE 違反 or free 行数減） |
| 重複観測（A-N3c）を external にする | A-N3c（status 不一致 or UNIQUE 違反で TX 失敗） |
| `parse_plu_register_snapshot` の 5,000 行検査を外す | A-N1b |
| 8 桁 + E×6 を JAN error に | A-N2 |
| product 行の固定列 `単品売り` を `はい` に戻す | A-E7 |
| 回復手順文言を旧 Full-only 文言に戻す（2 箇所のいずれか） | A-E5 |
| `release_pending_count` に `app_managed_count` を代入、または UI Diff 件数で release pending を無視 | A-V1b |
| D-052 C2 / C14 / C18 のいずれかから `pluSlotSummary` を削除 | A-V1b exact invalidation |

oracle は production 定数・定義から導出せず test 側へ独立転記する（`feedback-test-oracle-must-not-share-ssot`）。空集合期待の case（A-E6 の行 0、A-N1 の write 0）は非空期待 case（A-E1 / A-N3）と対で持つ。

## Residual Test Gaps

- clear 行の CV17 受理とレジ側未設定化、実機 Z004 の読込み、Diff / Full 投入は L3（Human Gate）。
- snapshot 後にレジ側で手動登録された slot は次回読込みまで検出できない（escape hatch、UI 文言で案内）。
- UI の above the fold / 色以外の区別は L3 目視。
