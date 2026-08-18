# Test Design Matrix: PLU slot 永続割当 + bulk onboarding（design-first）

## Risk

Risk: R3

## Contracts Under Test

- SPEC-PLS-D1: `plu_slots` table / JAN 単位 identity / 範囲・一意性
- SPEC-PLS-D2: レジ登録状況スナップショット（Z004 全スロットダンプ）読込みと照合規則 / 初回 gate
- SPEC-PLS-D3: prepare 時の冪等予約（最小空き番号、sticky、no_free_slot）
- SPEC-PLS-D4: 解放 trigger / clear 行 / confirm で free / fallback no-reuse
- SPEC-PLS-D5: Full / Diff 行構成と Diff 投入ガード改訂
- SPEC-PLS-D6: bulk onboarding（CSV `PLU対象` 列 / filter 全件一括操作）
- SPEC-PLS-D7: 移行状態語彙 / 一覧 filter / メモリNo. 表示 / UI-08 要約
- SPEC-PLS-D8: 混在期間の会計契約不変
- SPEC-PLS-D9: REQ-907 / coverage / traceability
- SPEC-PLS-D10 / candidate D-072: durable decision と stale 語彙 closure

## Failure Modes

- 書出しのたびに memory No. が再採番され、Diff 投入で既存スロットを上書きする（D-6 事故経路の残存）。
- レジ側の既存登録（アプリ外 933 件相当）を空き扱いして書き込み、商品がレジから消える。
- スナップショット未読込みで初回 Full を書き出せてしまう。
- 同一 JAN が複数スロットへ割り当たる、または 2 つの JAN が同一スロットを取り合う。
- 保存失敗 / キャンセル後の再 prepare で別スロットが予約され、レジ側に stale 行が増える。
- 廃番 / 対象解除後にスロットが即座に再利用され、clear 前に別 JAN が同スロットへ書き込まれる（順序依存）。
- clear 行が CV17 に拒否され、ファイル全体の取込みが失敗するのに fallback がない。
- 一括対象化が page 内だけを対象にし、operator が数百件を数十ページに分けて操作する。
- JAN 不備 / 廃番の商品が一括 ON で `plu_target=1` になり要修正バケットを汚染する。
- 移行状態が `plu_exported_at` 有無で判定され、再対象化した商品が「反映済み」に見える。
- 旧 Full-only ガードの語彙が UI 文言 / docs に残り、operator が Diff 投入を避け続ける。
- 会計系列（公式日報 / 商品別）を横加算する契約変更が紛れ込む。

## Test Matrix

`M-D*` は本 design-first PR の source amendment 検証（本発注では予約、plan-approved 後の次発注で実行）。`A-*` は実装 A（slot core）、`B-*` は実装 B（bulk onboarding）への予約であり、本 design-first PR の green 条件には数えない。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-PLS-D1 [本 design-first PR] | table / 一意性が docs にない | CLI/contract review | M-D1: `db-design/plu-tables.md` に `memory_no` CHECK 217..5000 / status 5 値 / partial UNIQUE anchor、22-mnt §13 に migration v5、DB_DESIGN 索引 | schema 契約が packet だけに残る |
| SPEC-PLS-D2 [本 design-first PR] | 照合規則が部分的 | CLI/contract review | M-D2: 33-biz に レジ空/有 × 5 status の照合表 + `register_snapshot_required` anchor、23-io に Z004 全スロット占有読み取り mode（5,000 行必須 / raw code）、67-ui に読込み step | 組合せ欠落 or 初回 gate 未記載 |
| SPEC-PLS-D3 [本 design-first PR] | 再採番が残る | CLI/negative rg | M-D3: `rg -n "行インデックス|scanning_plu_memory_start \+ " docs/function-design/25-io-plu-formatter.md docs/function-design/33-biz-plu-export-service.md` の active hit 0、`最小空き` / `no_free_slot` anchor present | 採番規則が旧のまま |
| SPEC-PLS-D4 [本 design-first PR] | 解放 / fallback 未定義 | CLI/contract review | M-D4: 33-biz に trigger 3 種（plu_target off / toggle_discontinue / jan_code 変更）+ clear 行形状 + fallback 定数 anchor、30-biz toggle_discontinue に `plu_target=0` | いずれかの trigger または fallback 欠落 |
| SPEC-PLS-D5 [本 design-first PR] | Full-only 語彙が残る | CLI/negative rg | M-D5: `rg -n "Full.*のみ|全件.*のみ|Diff.*点検用途|Full-only" docs/function-design/67-ui-plu-export.md docs/function-design/33-biz-plu-export-service.md docs/DB_DESIGN.md docs/architecture/biz-task-specs.md` の active hit 0（archive 除外）、UI-08-D9 が改訂文言 | stale ガード語彙が active docs に残る |
| SPEC-PLS-D6 [本 design-first PR] | bulk 経路が片方のみ / page 内 | CLI/contract review | M-D6: 30-biz §4.8-4.9 に `PLU対象` 列規則、40-cmd に `bulk_set_plu_target(filter, plu_target)`、50-ui に filter 一致全件 + 確認 dialog + skip 結果 anchor | (a)/(b) 欠落 or `全件` 明記なし |
| SPEC-PLS-D7 [本 design-first PR] | 語彙 / 判定式が曖昧 | CLI/contract review | M-D7: 50-ui に `対象外 / 未反映 / 反映済み` と導出式（plu_target × plu_dirty）+ `plu` search param、51-ui に メモリNo. 読み取り専用、67-ui に占有要約 | 語彙不一致 or plu_exported_at 判定 |
| SPEC-PLS-D8 [本 design-first PR] | 会計契約が変わる | CLI/contract review | M-D8: 33-biz / plu-tables に「売上・在庫・会計集計へ影響しない」anchor、D-025 参照（D-071 は系列内合算のみ） | 横加算や series 統合の記述 |
| SPEC-PLS-D9 [本 design-first PR] | REQ 未起票 | CLI/contract review | M-D9: `requirements.md` に REQ-907 行、`requirements-coverage.md` に REQ-907 `current` 行 + REQ-402 理由文追記 | REQ 追加なし |
| SPEC-PLS-D10 [本 design-first PR] | durable decision 未昇格 | CLI/contract review | M-D10: `decision-log.md` に D-072（authority 分割 / JAN 単位予約 / 廃番連動 / Diff 投入可 / Revisit）、25-io line 3 / 5 の暫定注記が D-072 参照へ改訂 | decision-log 追加なし or 暫定注記残存 |
| Q1〜Q5 [本 design-first PR] | 裁定未記録 | packet review | M-Q: packet の Owner 裁定事項表に owner 判断と日付が追記され、不採用代替が Review Response に残る | 裁定なしで plan-approved |

### M-D1〜M-D10 実行結果（2026-08-18、source amendment）

- **M-D1 PASS** — `rg -n "plu_slots|memory_no|partial UNIQUE|migration v5" docs/db-design/plu-tables.md docs/function-design/22-mnt-migration.md docs/DB_DESIGN.md` → exit 0。範囲 / status / partial UNIQUE / v5 / DB index を確認。
- **M-D2 PASS** — `rg -n "register_snapshot_required|全スロット占有|5,000|raw_code|UI-08-D11|レジ登録状況" docs/function-design/33-biz-plu-export-service.md docs/function-design/23-io-z004-parser.md docs/function-design/67-ui-plu-export.md` → exit 0。照合 grid、初回 gate、Z004 mode、UI step を確認。
- **M-D3 PASS** — negative `rg -n "行インデックス|scanning_plu_memory_start \+ " docs/function-design/25-io-plu-formatter.md docs/function-design/33-biz-plu-export-service.md` → exit 1 / 0 hit。positive `rg -n "最小.*free|NoFreeSlot|no_free_slot|最小空き" ...` → exit 0。
- **M-D4 PASS** — `rg -n "plu_target.*1.*0|廃番化|jan_code.*変更|PLU_CLEAR_ROW_ENABLED|11 field" docs/function-design/33-biz-plu-export-service.md docs/function-design/30-biz-product-service.md docs/function-design/25-io-plu-formatter.md` → exit 0。release trigger、exact clear、no-reuse fallback を確認。
- **M-D5 PASS** — `rg -n "Full.*のみ|全件.*のみ|Diff.*点検用途|Full-only" docs/function-design/67-ui-plu-export.md docs/function-design/33-biz-plu-export-service.md docs/DB_DESIGN.md docs/architecture/biz-task-specs.md` → exit 1 / 0 hit。UI-08-D9 は Diff / Full 投入可へ改訂済み。
- **M-D6 PASS** — `rg -n "PLU対象|bulk_set_plu_target|filter.*全件|件数.*dialog|invalid_jan" docs/function-design/30-biz-product-service.md docs/function-design/40-cmd-product.md docs/function-design/50-ui-product-list.md` → exit 0。CSV / filter 全件の両経路を確認。
- **M-D7 PASS** — `rg -n "対象外|未反映|反映済み|plu_target=0|plu_dirty=1|plu_dirty=0|plu_memory_no|plu.*search param|占有要約" docs/function-design/50-ui-product-list.md docs/function-design/51-ui-product-form.md docs/function-design/67-ui-plu-export.md` → exit 0。
- **M-D8 PASS** — `rg -n "売上.*在庫.*会計|売上、在庫、会計|D-025" docs/function-design/33-biz-plu-export-service.md docs/db-design/plu-tables.md` → exit 0。集計非影響を確認。
- **M-D9 PASS** — `rg -n "REQ-907|REQ-402" docs/spec/requirements.md docs/spec/requirements-coverage.md` → exit 0。REQ-907 `current` と REQ-402 理由を確認。
- **M-D10 PASS** — `rg -n "D-072|authority|JAN 単位|廃番化|Diff / Full|Revisit" docs/decision-log.md docs/function-design/25-io-plu-formatter.md` → exit 0。D-072 の四点 / revisit と formatter 注記を確認。

## State Lifecycle Matrix

| State（plu_slots.status） | Event | Next | Side effect | Test（予約） |
|---|---|---|---|---|
| free | prepare で JAN に割当 | reserved | reserved_at | A-P1 |
| free | snapshot: レジ空 | free | 変化なし（no-op） | A-N4b |
| free | snapshot: レジ有（外部コード） | external | scanning_code = 観測値 | A-N2 |
| free | snapshot: レジ有（app JAN 未割当） | active | adopted 報告 | A-N3 |
| free | snapshot: レジ有（既に採用済み app JAN の重複） | release_pending | 重複 stale として解放対象（D4 trigger (iv)） | A-N3b |
| external | snapshot: レジ空 | free | — | A-N4 |
| external | snapshot: レジ有 同一コード | external | 維持（定常状態） | A-N5b |
| external | snapshot: レジ有 別コード | external | コード更新 | A-N5 |
| reserved | confirm（書出しに含む） | active | activated_at | A-P3 |
| reserved | snapshot: レジ空 | reserved | 維持（未書込み） | A-N6b |
| reserved | snapshot: レジ有 同一コード | active | 昇格 | A-N6 |
| reserved | snapshot: レジ有 別コード | external | 予約破棄 + reservation_dropped 報告、次回 prepare で再予約 | A-N8b |
| reserved | 解放 trigger | free | released_at（レジ未書込み） | A-R1 |
| reserved | 保存失敗 / キャンセル → 再 prepare | reserved（同番号） | 変化なし | A-P2 |
| active | 解放 trigger（JAN に対象 product が残らない） | release_pending | released_at | A-R2〜R4 |
| active | snapshot: レジ空 | active | missing 報告 + plu_dirty=1 | A-N7 |
| active | snapshot: レジ有 同一コード | active | 維持 | A-N8c |
| active | snapshot: レジ有 別コード | active | conflicts 報告 + plu_dirty=1 | A-N8 |
| release_pending | 書出し（clear 行）→ confirm | free | 再利用可 | A-R5 |
| release_pending | snapshot: レジ空 | free | 解放確認 | A-N9 |
| release_pending | snapshot: レジ有 同一コード | release_pending | 維持（clear 行待ち） | A-N9b |
| release_pending | snapshot: レジ有 別コード | external | 解放済み扱い、clear 行不要 | A-N9c |
| release_pending | 再対象化 | 解放前状態（active / reserved） | plu_dirty=1（2026-07-03 packet 内 ID D-3） | A-R6 |
| release_pending | fallback no-reuse 有効 | release_pending（固定） | clear 行を出さない | A-R7 |

## Adjacent Pattern Audit

- 既存 confirm 契約（exact product_code set、`plu_dirty=false` / `plu_exported_at=now`）は維持し、slot の reserved→active / release_pending→free を同 TX に追加する（33-biz §16.4）。
- D-028 同一 JAN dedup（`target_product_codes` に群全体）と 1 JAN = 1 スロットは同じ key で整合。dedup 代表の入替えでスロットは動かない。
- UI-08 state machine（§67.7）の `saved` / `confirmed` は変更せず、`prepare` 前に `snapshot_required` 分岐を足す。
- 商品一覧の URL state（§50.4）へ `plu` param を追加する際、既存 `q` / `dept` / `discontinued` / sort / page の規約（既定値省略、範囲外回復）に従う。
- 商品一括インポート preview（§60.5 表示 / 操作、DTO は §60.4）の警告行表示に `PLU対象` 不備を載せる際、既存の必須列欠落 `ImportError` とは区別する（任意列のため error にしない）。

## Negative Paths

- snapshot 未読込みで prepare → `ValidationFailed(register_snapshot_required)`、slot 不変（A-N1）。
- Z004 ヘッダ不一致 / memory No. 範囲外 / データ行数 ≠ 5,000（従来 shape）→ `ImportError`、TX rollback、slot 不変（A-N1b）。
- 空き 0 で新 JAN を prepare → 要修正 `no_free_slot`、他 JAN の生成は続行（A-P4）。
- 同一 JAN が別 product 2 件（グループコード）→ 1 スロット、`target_product_codes` は 2 件（A-P5）。
- bulk ON で JAN なし / 8 桁 / 廃番 → skip 件数、`plu_target` 不変（B-L3〜L4）。
- CSV `PLU対象` に `1` / `0` / 空 以外 → preview 警告、`0` 扱い or 行 error（source docs で確定、B-C3）。
- clear 行 fallback 有効時に release_pending が free へ遷移しない（A-R7）。
- 要修正判定中（同一 JAN 群の売価 / 税率不一致）で既に `active` の JAN → Full / Diff とも商品行・clear 行を出さず slot 維持、excluded 一覧に理由（A-E6）。

## Boundary Checks

- memory_no 217 と 5000 の両端で予約 / 照合が動く（A-S2）。
- 216 以下 / 5001 以上の行を含む snapshot は `ImportError`（A-N1b）。
- 14 桁固定幅コード（13 桁 + `E`、8 桁 + `E`×6、全ゼロ）を正規化し、8 桁コードは raw のまま external に使う（A-N2b）。
- 全ゼロ 14 桁 = 空スロット、名称空でも判定は code のみ（A-N2c）。
- clear 行の 11 field 形状 exact（14 桁ゼロ / 名称空 / `\0` / `税1(内税)` / `いいえ`×4 / `無し` / `ノンリンク`）と memory No. 6 桁ゼロ埋め（A-R5b）。

## Compatibility Checks

- migration v4 → v5 の順序、v3 backfill 不変、既存 DB での v5 事前投入 4,784 行（A-S3）。
- 既存 prepare / confirm の引数不変、戻り値 field 追加のみ、generated TS 再生成（A-E4）。
- PluNotificationBar / `list_plu_dirty` 契約不変（A-V1 の非回帰）。
- 旧 Full 書出しファイル（再採番）を再投入しない旨の UI-08 回復文言（A-E5）。

## Data Safety Checks

- 実 Z004 / 実レジ設定 file / 実コードを fixture にしない。synthetic Z004（5,000 行）/ 11 列 fixture は Probe の構造（行数 / 列 / 空スロット形状）のみ再現。
- Probe 記録は件数 / 範囲 / 形状のみ。packet / PR body に実値を転記しない。
- 物理 DELETE / schema 破壊変更なし。

## Main Wiring / Integration Checks

- UI-08 FilePicker → `import_plu_register_snapshot` → CMD → BIZ-04 TX → `plu_slots` + `app_settings` → summary 表示 → invalidation（A-V1）。
- prepare → 予約 TX → formatter に memory_no → 書出し file の 1 列目が 6 桁ゼロ埋め（A-E1）。
- 商品一覧 filter → `bulk_set_plu_target` → BIZ-01 → plu_dirty / 解放 → D-052 invalidation（一覧 / home pluDirty / UI-08）（B-L5〜L6）。

## Mutation-style Adequacy Questions

- 最小空き番号の選択を「最大 + 1」に変えたら A-P1 が落ちるか（既存登録の間の空きを使う case を持つか）。
- 照合規則の「レジ有 × active × 別コード」を silent 上書きに変えたら A-N8 が落ちるか（conflicts 件数と plu_dirty の両方を assert）。
- 「レジ有 × reserved × 別コード」を active と同じ app 上書きに変えたら A-N8b が落ちるか（external 化と次回 prepare の別番号予約を assert）。
- confirm で release_pending → free を外したら A-R5 が落ちるか。
- clear 行の形状 1 field（`ノンリンク`）を変えたら A-R5b が落ちるか（形状 exact assert）。
- bulk ON の skip 条件から「廃番」を外したら B-L4 が落ちるか。
- 移行状態導出を `plu_exported_at` 有無に変えたら B-V2 が落ちるか（0→1 再対象化 fixture）。

## 実装 PR への予約（本 design の Ledger 対応）

実装 A（slot core）:

- A-S1〜A-S4: migration v5 / plu_slots CHECK・partial UNIQUE / 事前投入 4,784 行 / repo CRUD。
- A-N1〜A-N9c: snapshot 未読込み gate、parse error、照合 全組合せ（State Lifecycle Matrix の snapshot 行 = レジ空 / 有 × 5 status、重複 JAN と reserved 予約破棄を含む）、summary 件数、app_settings 保存、operation_logs。
- A-P1〜A-P5: 最小空き予約、sticky 再 prepare、confirm active 化、no_free_slot、JAN 共有。
- A-R1〜A-R7 + A-R5b: reserved 直 free、trigger 3 種 + snapshot 重複 (iv)、clear 行形状 exact（A-R5b）、confirm free、再対象化復帰、fallback no-reuse。
- A-E1〜A-E6: Full / Diff 行構成、memory_no 6 桁、外部登録非出力、DTO / bindings 再生成、UI-08 文言（D4/D5/D9 改訂）、要修正判定中 slot の維持・非出力（A-E6）。
- A-V1: UI-08 読込み step / 占有要約 / snapshot_required 導線（RTL）。
- L3（実装 A）: 実機 Z004 の占有読込み（初回 + 再読込み）、Diff 投入、clear 行受理とレジ側未設定化。

実装 B（bulk onboarding）:

- B-C1〜B-C4: CSV `PLU対象` 列あり / なし / 不正値 / 更新行維持。
- B-L1〜B-L6: filter 全件対象、確認 dialog 件数、ON skip（JAN 不備 / 廃番）、OFF 全件、TX / operation_logs、invalidation。
- B-V1〜B-V4: 移行状態語彙 3 種の導出、`plu` filter、色のみ符号化なし、UI-01b メモリNo. 表示。

## Residual Test Gaps

- CV17 実機の clear 行受理は自動化不能（L3）。fallback 定数の両モードを unit test で担保する。
- レジ側で snapshot 後に手動登録された slot は次回読込みまで検出できない（設計上の escape hatch、UI 文言で明示）。
- Z004 取込み時のスロット照合警告は backlog（本 runway 非目的）。
