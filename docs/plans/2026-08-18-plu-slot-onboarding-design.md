# Plan Packet: PLU slot 永続割当 + bulk onboarding（design-first）

## Workflow State

- Phase: plan-draft
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet
- Final Reviewer: Sonnet
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval（owner 裁定事項 Q1〜Q5 を含む）/ Ready / merge。Windows native L3 は docs-only design-first PR ではなし

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2
- Plan Review round 天井: 3（既定）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
products / 新 table のスキーマ（migration）、PLU 書出し BIZ の割当・TX、Tauri command DTO / generated bindings、CV17 向け出力ファイルの行構成、レジ設定ファイルの取込み、operator の段階移行手順を横断して変更する設計である。誤ると CV17 取込みでレジ側の既存 PLU を上書きして商品がレジから消える、または廃番商品が旧単価でスキャン可能なまま残るため、docs-only の起草段階から R3 とする。

## Goal

Goal Invariant:
商品（スキャニングコード = JAN）ごとにレジのメモリNo. を永続的に固定割当し、既存のレジ登録を空き扱いせず、Diff / Full どちらの書出しファイルも CV17 へそのまま取り込める設計に改める。併せて、部門キー販売から PLU 販売へ商品群を段階的に移す operator 手順（一括対象化・移行状態の可視化）を設計する。

### 最小完了条件

- 本 design-first PR の完了時、source design docs と candidate D-072 が本 packet の SPEC-PLS-D1〜D10 どおりに改訂され、後続実装者が chat や issue を読まずに schema、割当規則、レジ設定読込みの照合規則、書出し行構成、command / DTO、UI 文言、テストを実装できる。
- 本発注の停止時、packet / Test Design Matrix / `Plans.md` が plan-first commit と Draft PR で review 可能になり、source design amendments と実装 code は未着手のまま残る。

### 失敗定義

- 書出しのたびにメモリNo. を再採番する余地（`217 + 行インデックス`）が source docs に残る。
- レジ側の既存登録（アプリ外で登録された PLU）を app が空き扱いして上書きし得る割当規則になる。
- 廃番 / PLU 対象解除した商品のスロットが、レジ側の解放確認前に別 JAN へ再利用され得る、または解放経路が設計されない。
- 段階移行で「どの商品がレジ登録済みか」を operator が画面から判別できない。

### 非目的

- 本 design-first PR で Rust / TypeScript 実装、generated bindings、DB schema、実 POS / レジ設定 fixture を変更しない。
- Z004 layout B（連結型）対応、受入台本第2版（runway ⑤）、`EcrDatas` 保持期間 / 命名設計を同乗させない。
- レジ側 PLU の反映を API で自動確認する仕組み（存在しない、UI-08-D2）を新設しない。
- インストアコード発番（JAN なし商品①④の PLU 化）を採用しない（D-028 で却下済み、JAN なし商品は部門キー販売のまま）。
- 通常 PLU 枠（メモリNo. 1〜216）を app が管理・書込みしない。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

本 design-first PR の将来 amendment scope（plan-approved 後の次発注で source docs へ昇格）:

- candidate D-072 と SPEC-PLS-D1〜D10 を durable source docs へ昇格する（25-io / 33-biz / 20-io / 30-biz / 40-cmd / 41-cmd / 50-ui / 51-ui / 60-ui / 67-ui / DB_DESIGN + db-design 新 file / 22-mnt-migration / architecture task specs / spec requirements + coverage / decision-log）。
- `plu_slots` table（migration v5）と slot 状態遷移、レジ設定スナップショット読込みの照合規則、prepare 時の冪等予約、confirm 時の active 化、解放（clear 行）とその確認、Full / Diff の行構成を契約化する。
- 新規 command（レジ設定読込み / スロット要約 / 一括 PLU 対象化）と既存 command（prepare / confirm）の DTO 変更を wire contract として確定する。
- 商品一括インポート（REQ-104）の任意列 `PLU対象`、商品一覧の一括 PLU 対象化と移行状態 filter / 表示、商品詳細のメモリNo. 表示、UI-08 のレジ設定読込み step と占有要約表示を契約化する。
- UI-08-D9（Full-only 投入ガード）を「Diff / Full とも投入可」へ改訂し、D-028 の暫定ガード語彙の stale target を全列挙する。
- 後続実装 PR の分割（実装 A = slot core、実装 B = bulk onboarding）と各 PR の Ledger 予約を Test Design Matrix に記録する。

本発注で実際に編集する scope:

- 本 packet、対応 Test Design Matrix、`Plans.md` active link のみ。
- source design amendments は plan-approved 後の次発注まで intentionally deferred。

## Non-scope

- `docs/function-design/*.md`、`docs/db-design/*.md`、`docs/DB_DESIGN.md`、`docs/decision-log.md`、`docs/spec/*` その他 source docs の本文 amendment（次発注）。
- `src-tauri/**`、`src/**`、`src/lib/bindings.ts` の変更。
- 実レジ設定ファイル（`ｽｷｬﾆﾝｸﾞPLU(商品).txt`）、実 Z004、実店舗コード・名称・単価の commit。Contract Probe は構造・件数のみ記録する。
- CV17 が clear 行（空スロット形状）の取込みで実際にスロットを未設定へ戻すかの実機確認（実装 A の L3 項目として予約。SPEC-PLS-D4 に fallback を定義）。
- Z004 取込み時のスロット照合（Z004 全スロットダンプと `plu_slots` の突合警告）。follow-up として `Plans.md` backlog に記録する。
- 通常 PLU 枠（1〜216）、部門マスタ、価格履歴の変更。
- archive packet / matrix の歴史的記録の書換え。

## Acceptance Criteria

- `docs/plans/2026-08-18-plu-slot-onboarding-design.md` が template 必須節、13 field Workflow State、SPEC-PLS-D1〜D10、owner 裁定事項 Q1〜Q5、Contract Probe 結果、amendment 契約を持つ。
- `docs/plans/test-matrices/2026-08-18-plu-slot-onboarding-design.md` が本 design-first PR の検証行（M-D*）と後続実装予約（A-* / B-*）を明示的に分離する。
- `Plans.md` の `次の行動` に本 packet と matrix の active link がある。
- `git diff --name-only origin/main...HEAD` の plan-first commit 対象が上記 3 path のみで、`src/` / `src-tauri/` / source design docs を含まない。
- `bash scripts/doc-consistency-check.sh --target plan` を pipe なしで実行し、exit code `0` を確認する。
- Draft PR body が `.github/pull_request_template.md` と `docs/DEV_WORKFLOW.md` `Commit / PR Messages` に従い、Risk R3、Phase plan-draft、source amendment 未着手、Hosted CI required、owner 裁定事項 Q1〜Q5 を明記する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-104 / REQ-402（+ candidate REQ-907）、`docs/spec/requirements-coverage.md` REQ-402 行（現 `superseded`）
- Architecture: `docs/ARCHITECTURE.md` POS Adapter Boundary、`docs/architecture/io-task-specs.md` IO-03 / IO-04、`biz-task-specs.md` BIZ-01 / BIZ-04、`cmd-task-specs.md` CMD-01 / CMD-08、`ui-task-specs.md` UI-01a / UI-01b / UI-01c / UI-08
- Function / command / DTO: `docs/function-design/25-io-plu-formatter.md` §12（line 3 / 5 の暫定注記、§12.3 `generate_plu_tsv` 内の採番規則）、`33-biz-plu-export-service.md` §16.2〜16.8、`20-io-product-repo.md` §2.3 `_for_plu` 系、`30-biz-product-service.md` §4.8 / §4.9（line 349 の plu_target 導出）/ `toggle_discontinue`、`26-io-product-csv-importer.md` §18、`40-cmd-product.md`、`41-cmd-pos.md` §17.6（CMD-08）、`50-ui-product-list.md` §50.4〜50.6、`51-ui-product-form.md` UI-01b-D18、`53-ui-home.md` PluNotificationBar、`60-ui-product-import.md` §60.1 / §60.4 / §60.5、`67-ui-plu-export.md` §67.5 UI-08-D1〜D10 / §67.7 / §67.8 / §67.9
- DB: `docs/DB_DESIGN.md` §D-2、`docs/db-design/master-tables.md` products（plu_target / plu_dirty / plu_exported_at）、`docs/function-design/22-mnt-migration.md` §10〜§11（migration v3 / v4 の様式）、`src-tauri/src/db/schema_v4.rs` / `migration.rs`（実査のみ）
- Screen / UI: `docs/SCREEN_DESIGN.md`、`docs/design-system/01-decision-rules.md`、`02-component-catalog.md`（⑭ FilePicker、EmptyState、Alert）
- Decision log / ADR: `docs/decision-log.md` D-023 / D-027 / D-028 / D-054（レジ設定読込みの file 選択は共通 FilePicker を使う）/ D-070 / D-071、candidate D-072
- Field / adapter facts: `docs/plu-export-and-real-csv-verification.md` 「店舗運用から導いた公開設計前提」「Z004 の実構造」、`docs/project-memory.md` POS Facts（CV17 11 列 profile、2026-08-01 owner rollout intent = PLU への gradual migration）、`docs/archive/plans/2026-07-03-post-ui08-janless-plu-target-design.md` §Adapter Facts / D-6 / Deferred、GitHub issue #76（R-F-01 初日優先商品群）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 33-biz（BIZ-04 slot 割当 / 解放 / 予約 TX）、25-io（レジ設定 parser、clear 行）、20-io（slot repo 依存）、30-biz（bulk 対象化 / discontinue 連動 / CSV 列）、40-cmd / 41-cmd | intentionally deferred to plan-approved 後の次発注 |
| Command / DTO / generated binding / wire shape | 41-cmd §17 新 command 3 + prepare / confirm DTO 変更、40-cmd bulk command + Boundary / Wire Contract | packet で契約確定、source は intentionally deferred |
| DB / transaction / audit / rollback / migration | `db-design/plu-tables.md` 新設（`plu_slots`）、DB_DESIGN.md §D-2 改訂 + 索引、22-mnt-migration §12 migration v5 | packet で契約確定、source は intentionally deferred |
| Screen / UI / route state / Japanese wording | 67-ui（レジ設定読込み step、占有要約、D9 改訂、文言）、50-ui（移行状態 filter / 一括操作）、51-ui（メモリNo. 表示）、60-ui（`PLU対象` 列） | packet で文言確定、source は intentionally deferred |
| CSV / TSV / report / import / export format | 25-io §12 に書出し行構成（割当 memory No. / clear 行）と読込み profile（同一 11 列） | packet で契約確定、source は intentionally deferred |
| Durable decision / ADR | candidate D-072（slot authority 分割 / discontinue 連動 / Diff 投入可） | next amendment で `docs/decision-log.md` 新 ID として起案 |
| Requirements | candidate REQ-907（開発拡張）+ coverage 行 | next amendment で起案、traceability 再生成は実装 PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command（`import_plu_register_snapshot` / `get_plu_slot_summary` / `bulk_set_plu_target`） | 実装 PR で `lib.rs` の specta `collect_commands` 登録 + `#[tauri::command]` / `#[specta::specta]` の対 + `cargo run --bin generate_bindings` 再生成。本 design-first PR では 41-cmd / 40-cmd の command 契約と Ledger 行のみ |
| function-design doc 新設 | 新設は `docs/db-design/plu-tables.md` のみ（function-design は既存 25 / 33 / 30 / 40 / 41 / 50 / 51 / 60 / 67 の改訂）。25-io に新 module `io::plu_register_snapshot` を持たせる場合は実装 PR で `design_compliance_test.rs` の map entry を追加 |
| source / workflow doc 新設・改名 | `db-design/plu-tables.md` を `DB_DESIGN.md` の索引へ登録 |
| REQ coverage 追加 | candidate REQ-907 を `requirements.md` / `requirements-coverage.md` に追加。test 追加後の `cargo run --bin generate_traceability` は実装 PR |
| route 新設 | なし（既存 `/products/plu-export` / `/products` / `/products/import` の内部拡張） |
| operator 画面新設 | なし。navigation / routeTree 生成義務なし |
| migration | 実装 A で `schema_v5.rs` + `migration.rs` registry 追加、22-mnt-migration §12 に v5 節 |

## Design Decisions / Amendment Contract

以下は本 plan-draft の採用候補であり、Plan Gate で Coordinator が裁定する（Q1〜Q5 は owner 裁定）。採用後は同じ ID と意味を source docs に昇格し、実装 PR は source docs を引用する。実装開始時に unresolved placeholder を残さない。

用語: 「app 管理スロット」= `plu_slots.status ∈ {reserved, active, release_pending}`。「既存登録」= `status = external`（アプリ外でレジに登録済み）。「空き」= `status = free`。

### SPEC-PLS-D1 — スロット identity は JAN、割当は `plu_slots` table に永続

- 新 table `plu_slots`（migration v5、`docs/db-design/plu-tables.md`）: `memory_no INTEGER PRIMARY KEY CHECK (217 <= memory_no AND memory_no <= 5000)`、`scanning_code TEXT`（app 管理 = 13 桁 JAN、既存登録 = レジ観測コードそのまま、free = NULL）、`status TEXT NOT NULL CHECK IN ('free','external','reserved','active','release_pending')`、`reserved_at` / `activated_at` / `released_at` / `updated_at`。migration v5 で 217〜5000 の 4,784 行を `free` で事前投入する（範囲は SCANNING_PLU_MEMORY_START / SCANNING_PLU_EXPORT_LIMIT の既存定数から導く）。
- 一意性: `scanning_code` は `status <> 'free'` の行の中で一意（partial UNIQUE index）。1 JAN = 1 スロット。products との対応は `products.jan_code = plu_slots.scanning_code` で、D-028 の同一 JAN dedup（グループコード商品。33-biz §16.3 step 4、2026-07-03 packet 内 ID D-4）と整合する。
- 割当 key を product_id ではなく JAN にする理由: レジ側 identity がスキャニングコードであり、グループコード商品（同一 JAN 複数 product）は 1 スロットを共有する。
- 却下: products への `plu_memory_no` 列追加方式（既存登録 / 空きを表せない。JAN 共有 product 間の整合が取れない）; 書出しごとの再採番（現行、D-6 の事故経路）。

### SPEC-PLS-D2 — レジ設定スナップショット読込み（既存登録を空き扱いしない）

- 入力 = CV17「レジスターの設定」スキャニング PLU 書出し `.txt`（IO-04 が書くのと同じ 11 列 / tab / CP932 / CRLF profile。Contract Probe 参照: メモリNo. は 6 桁ゼロ埋め、コード欄は 14 桁固定幅・右 space padding、空スロットは 14 桁ゼロ + 名称空 + `\0` + `税1(内税)` + `いいえ`×4 + `無し` + `ノンリンク`）。新 IO 関数（`io::plu_register_snapshot`、25-io §12 に節追加）は 11 列ヘッダ検査・行 parse・コード正規化（trim / 全ゼロ = 空）のみ行い、業務判断は BIZ-04。
- BIZ-04 `import_plu_register_snapshot` は 1 TX で 217〜5000 の各行を照合し、結果 summary（`free` / `external` / `app_managed` 件数、`adopted` / `released_confirmed` / `reservation_dropped` / `conflicts` / `missing_on_register` の一覧）を返す。照合規則（レジ側コード × app 側 status）:
  - レジ空 × app `free` / `external` → `free`（既存登録が消えていれば空きへ戻す）
  - レジ空 × app `reserved` → 維持（未書込み）
  - レジ空 × app `active` → `active` 維持 + `missing_on_register` として報告 + 該当 JAN の product を `plu_dirty=1`（次回書出しで再書込み）
  - レジ空 × app `release_pending` → `free`（解放確認）
  - レジ有 × app 同一コード（reserved / active / release_pending） → `reserved` は `active` へ昇格、他は維持
  - レジ有 × app `free` → コードが 13 桁 JAN で、`plu_target=1` かつ未廃番の product に一致し、その JAN が未割当 → `active` として採用（adopted、同 JAN 複数スロットは最小 memory_no を採用し残りは app 管理 `release_pending` = 重複 stale として解放対象）; それ以外 → `external`
  - レジ有 × `reserved` と異なるコード → 予約を破棄して `external`（観測コード）にする。`reserved` はレジへ未書込みのため、その間にレジ側で行われた登録が正であり app は上書きしない。当該 JAN は次回 prepare で改めて最小空き番号へ予約される（`reservation_dropped` として報告）
  - レジ有 × `active` と異なるコード → `conflicts` として報告。app 割当は維持し、該当 JAN の product を `plu_dirty=1`（app が書き込んだスロットは app が authority、次回書出しで上書き。operator が手動登録を残したい場合は UI-01b で `plu_target` を外し解放する導線を文言で示す）
  - レジ有 × `release_pending` と異なるコード → `external`（レジ側で既に別登録に置き換わっているため clear 行不要、解放済み扱い）
  - レジ有 × app `external` と異なるコード → `external` のままコード更新
- 読込み日時と summary は `app_settings`（`plu_register_snapshot_at` / `plu_register_snapshot_summary`）へ保存し operation_logs に記録する。UI-08 は最終読込み日時と占有要約（空き / 既存登録 / アプリ管理）を常時表示する。
- 初回 gate: スナップショット未読込みの状態で `prepare_plu_export` を呼ぶと `BizError::ValidationFailed`（理由 `register_snapshot_required`、UI 文言「レジ設定の読込みが必要です」+ 手順導線）。「既存登録を一律に空き扱いしない」（`plu-export-and-real-csv-verification.md` 公開設計前提）の実装形。2 回目以降の再読込みは任意（推奨タイミング = レジ側で手動登録を行った後）。
- 却下: Z004 全スロットダンプを占有ソースにする案（売上取込みと slot 管理が結合し、単価等の設定列を持たない）。follow-up として Z004 取込み時の照合**警告**のみ backlog に記録。

### SPEC-PLS-D3 — 割当は prepare 時の冪等予約、最小空き番号

- `prepare_plu_export`（Full / Diff）は三分バケット + D-028 同一 JAN dedup 後の PLU 対象 JAN のうち app 管理スロットを持たないものへ、`free` の最小 memory_no を `reserved` として割り当て、同一 TX で永続化する。同じ JAN は何度 prepare しても同じスロット（sticky）。UI-08-D1「prepare は DB を変えない」は「prepare は products（`plu_dirty` / `plu_exported_at`）を変えない。`plu_slots` の予約は冪等に永続化する」へ改訂する。
- 空きが尽きた JAN は生成から除外し「要修正」バケットに理由 `no_free_slot`（文言「レジの空きスロットがありません」）で返す。SCANNING_PLU_EXPORT_LIMIT（4,784）による件数比較は撤廃し、定数は範囲サイズ（migration v5 の行数）としてのみ残す。
- `release_pending` の JAN が再び PLU 対象になった場合（plu_target 0→1 / 廃番解除後の再設定）は同じスロットで解放前の状態へ戻す（`activated_at` があれば `active`、なければ `reserved`）。D-3 により product 側は `plu_dirty=1` になるので再書出しされる。
- 却下: 商品保存（BIZ-01）時の割当（スナップショット前に商品が一括登録される onboarding 順序と衝突し、割当責務が BIZ-01 / BIZ-04 に分散する）; confirm 時の割当（confirm 前に書出しファイルへ memory No. が必要）。

### SPEC-PLS-D4 — 解放は release_pending → clear 行書出し → confirm で free

- 解放 trigger: (i) `plu_target` 1→0（商品編集 / 一括 OFF）、(ii) `toggle_discontinue` で廃番化 — **廃番化時は `plu_target=0` を自動設定**（2026-07-03 packet §Deferred の未決を解消。廃番 = 全部売れて販売終了、master-tables 廃番特価フロー）、(iii) `jan_code` 変更。いずれも、その JAN に `plu_target=1` かつ未廃番の product が 1 件も残らなくなった時点で slot を `release_pending` にする。`reserved`（一度も confirm されていない）なら直接 `free`。廃番解除は `plu_target` を自動復帰しない（operator が UI-01b で再設定）。
- clear 行: Full / Diff の書出しファイルは app 管理 `release_pending` スロットについて、Contract Probe で観測した空スロット形状（14 桁ゼロコード / 名称空 / `\0` / `税1(内税)` / `いいえ`×4 / `無し` / `ノンリンク`）の 1 行を当該 memory No. で出力する。`confirm_plu_export_saved` は書出しに含めた `release_pending` を `free` にし再利用可能にする。
- 安全性: CV17 import はメモリNo. キーの部分更新のため、clear 行が万一レジ側で未設定に戻らなくても、free 後の再利用書込みは同スロットを上書きし data corruption を起こさない。残る影響は「stale 商品が clear 前にスキャン可能」に限られる。
- 未検証前提と fallback: 「clear 行を CV17 が受理しスロットを未設定へ戻す」は実機未確認。実装 A の L3 で確認し、受理されない場合は clear 行を書出しから外し `release_pending → free` を禁止（no-reuse。空き 3,851 枠に対し想定 churn では実用上十分、D-072 Revisit）へ切り替える。切替は BIZ-04 の定数 1 箇所で行い、両モードを test する。
- 却下: 解放即 free（レジ側に stale JAN が残ったまま別 JAN を同スロットへ書き込む順序が operator 操作次第で前後し得るため、明示 clear を挟む）; 物理 DELETE（範囲固定 table）。

### SPEC-PLS-D5 — Full / Diff の行構成と Diff 投入ガードの改訂

- Full = 全 app 管理スロット（`reserved` / `active` = 商品行、`release_pending` = clear 行）を memory_no 昇順で出力。既存登録 / 空きスロットは出力しない（`外部登録を上書きしない`）。
- Diff = `plu_dirty=1` の PLU 対象 JAN の商品行 + 全 `release_pending` の clear 行。
- 両モードとも memory No. は `plu_slots` から取り、行インデックスによる採番は廃止する（25-io §12.3 改訂）。D-028 同一 JAN dedup の `target_product_codes` 全メンバー規則、`count ≠ target_product_codes.len()` 注記は維持。
- UI-08-D9「CV17 へ投入してよいのは Full のみ」は撤廃し「Diff / Full とも投入可。Full はレジ側 app 管理スロット全体の再同期、Diff は未反映分 + 解放分」へ改訂。UI-08-D5 の Full バックアップ Alert は維持。UI-08-D4 の回復文言「保存済み Full の再投入または Full 再書出し」は「保存済みファイルの再投入、または Diff / Full の再書出し」へ改訂。67-ui §67.9 / §67.12 と 33-biz / DB_DESIGN D-2 / biz-task-specs の同語彙 stale target は次発注の Mechanical Impact Inventory で全列挙する（`rg -n "Full.*のみ|全件.*のみ|Diff.*点検用途|Full-only" docs/ src/`）。
- 却下: Diff を廃止して Full 一本化（毎回 4,000 行規模の全件を CV17 へ流すのは operator 負担 / 取込み時間で不利）。

### SPEC-PLS-D6 — bulk onboarding: 一括 PLU 対象化の 2 経路

- (a) 商品一括インポート（REQ-104 / IO-03 / BIZ-01 §4.8〜4.9 / UI-01c）: 任意列 `PLU対象`（値 `1` / `0` / 空）。列が無い or 空 → 新規行は現行導出規則（`is_discontinued=0` かつ 13 桁数字 JAN → 1）、更新行は既存値維持（現行どおり）。列あり → 指定値を適用。`1` 指定で JAN が 13 桁数字でない行は preview で警告し `0` として取り込む（要修正バケットへ無意味に流さない）。26-io は列名 parse のみ、判断は BIZ-01。
- (b) 商品一覧（UI-01a）一括操作: 現在の filter（`q` / `dept` / `discontinued`）に一致する**全件**（ページ内ではない）を対象に「表示中の商品を PLU 対象にする / 対象から外す」を実行する新 command `bulk_set_plu_target(filter, plu_target: bool)`。実行前に件数付き確認 dialog、実行後に結果（更新 / JAN 不備で skip / 廃番で skip）を表示。ON は未廃番かつ 13 桁数字 JAN の商品のみ更新し、それ以外は skip 件数として返す。OFF は filter 一致全件。0→1 は `plu_dirty=1`（D-3）、1→0 は D4 の解放 trigger。1 TX、operation_logs に filter 要約 + 件数を記録。
- 初日優先商品群（R-F-01: 布・切り売り以外 = 毛糸 / 糸類 / メタリックヤーン / キット類 / 裁縫用具）は部門 filter で選べることを (b) の設計根拠とし、UI 文言は「PLU 対象にする」（「レジに登録する」とは言わない = UI-08-D2 と同じ、書出し + CV17 取込みが別途必要）。
- 却下: (b) を page 内選択 checkbox 方式にする案（数百件規模の移行で操作回数が非現実的）; filter ではなく product_id 配列を渡す案（全件取得を frontend が抱える）。

### SPEC-PLS-D7 — 移行状態の可視化

- 移行状態は products の既存 2 flag から導出する固定語彙: `対象外`（`plu_target=0`）/ `未反映`（`plu_target=1` かつ `plu_dirty=1`）/ `反映済み`（`plu_target=1` かつ `plu_dirty=0`）。schema 追加なし。
- UI-01a: 一覧に移行状態 badge（色のみの符号化禁止 = 文字 label 併記）と URL filter `plu`（`all|target|pending|synced|excluded`、既存 §50.4 の search param 規約と §50.8 の範囲外回復に従う）。
- UI-01b（詳細 / 編集）: app 管理スロットがあれば「レジメモリNo.」を読み取り専用で表示（`plu_slots` 参照。DTO 追加は Boundary / Wire Contract）。
- UI-08: レジ設定の最終読込み日時 + 占有要約（空き / 既存登録 / アプリ管理 / 解放待ち）を上部に常設（UI-08-D10 の above-the-fold 方針を継承）。PluNotificationBar（UI-00）は変更なし。
- 却下: 反映済みを `plu_exported_at` の有無で判定（1→0→1 の再対象化で stale になる）。

### SPEC-PLS-D8 — 混在期間の会計・在庫意味論（Z-03）

- 部門キー販売（未移行 / JAN なし①④）と PLU 販売（移行済み）が同日に混在しても、公式日報系列（Z001/Z002/Z005）と商品別系列（Z004）は D-025 どおり別系列のままで横加算しない（D-071 は各系列**内**の同日 active import 合算を定める別契約で、系列間の分離には関与しない）。本 packet は会計契約を変更しない。
- 移行済み商品を部門キーで打つと Z004 に載らず在庫が減らない（master-tables 廃番特価フローの既知問題と同型）。app 側の防御は D7 の状態可視化と受入台本第2版（runway ⑤）の店頭手順（移行済み商品はスキャン）に置き、自動検知は非目的。
- 却下: 部門別集計と商品別集計の突合による自動検知（REQ-403 deferred と重複、別責務）。

### SPEC-PLS-D9 — REQ / coverage / traceability

- candidate REQ-907（開発拡張）「PLU メモリNo. を商品（JAN）単位で永続割当し、レジ設定スナップショットとの照合で既存登録を保護できること」を `requirements.md` に追加し、coverage 行を `current` で起票。REQ-402 coverage の `superseded` 理由文に「メモリNo. 採番規則は REQ-907 で永続割当へ置換」を追記。REQ-104 の設計書に `PLU対象` 列を追記。
- 実装 PR で test に REQ-907 / REQ-402 / REQ-104 を付与し `generate_traceability` を再生成する（design-first PR では生成物を触らない）。

### SPEC-PLS-D10 — durable decision と stale vocabulary closure

- candidate D-072: (1) スキャニング PLU 領域の authority 分割 — app 管理スロットは app、既存登録はレジ、空きの判定はレジ設定スナップショット必須 (2) 割当は JAN 単位の永続予約・最小空き番号・解放は clear 行 + confirm (3) 廃番化は `plu_target=0` を伴う (4) Diff / Full とも CV17 投入可（D-028 の Full-only 暫定ガードを supersede）。Revisit: 空きスロット枯渇の兆候（要修正 `no_free_slot` の発生）、または CV17 が clear 行を受理しないことが L3 で判明したとき。
- 25-io line 3 / 5、33-biz §16.3（line 119 の Full-only 回復注記）/ §16.6、67-ui UI-08-D9、DB_DESIGN §D-2、biz-task-specs BIZ-04 の「再採番」「Full のみ投入」語彙は次発注で全 hit を改訂し、archive は書き換えない。

## Owner 裁定事項（Plan Gate 前に確定）

| ID | 論点 | 推奨 | 代替と tradeoff |
|---|---|---|---|
| Q1 | 実装 PR の分割 | design-first（本 PR）→ 実装 A（D1〜D5 + D7 の UI-08 / 詳細表示 + D9/D10）→ 実装 B（D6 + D7 の一覧 filter / 一括操作） | 単一実装 PR: レビュー対象が schema + IO + BIZ + CMD + UI 3 画面に及び rally 天井 3 に収まりにくい。D-070 の「R3 4〜5 本」見積りは本便で 6〜7 本へ超過する見込み（Revisit 条件該当、配布時期との衝突有無は owner 判断） |
| Q2 | 占有スナップショットの入力 | CV17「レジスターの設定」書出し `.txt`（11 列、Probe 済み。owner が CV17 で 1 回書き出す） | Z004 全スロットダンプ: 追加操作不要だが設定列を持たず売上取込みと結合する。両対応は scope 増 |
| Q3 | 廃番化で `plu_target=0` を自動設定 | する（D4） | しない: 廃番商品が PLU 対象に残り要修正 / 解放が operator 手作業になる |
| Q4 | 一括対象化の経路 | (a) CSV 列 + (b) 一覧一括の両方（実装 B） | (a) のみ: 実装最小だが operator が CSV を再作成する必要。(b) のみ: 初回 onboarding の CSV 作成時に対象を指定できない |
| Q5 | Diff 投入ガードの撤廃 | 撤廃（D5）。永続割当が前提条件 | 維持: 永続割当後も Full 一本運用。毎回全件を CV17 へ流す負担 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-402 / REQ-907 | plu-tables.md（新）/ 22-mnt §12 / DB_DESIGN D-2 | SPEC-PLS-D1 | 再採番と product 列方式は既存登録・JAN 共有を表せない | schema_v5 / plu_slot_repo | Matrix A-S1〜A-S4 |
| REQ-907 | 25-io §12（parser 節）/ 33-biz §16（snapshot）/ 67-ui | SPEC-PLS-D2 | 既存登録を空き扱いしない公開設計前提 | io::plu_register_snapshot / BIZ-04 / UI-08 step | Matrix A-N1〜A-N9 |
| REQ-402 | 33-biz §16.3 / 25-io §12.3 / 67-ui UI-08-D1 | SPEC-PLS-D3 | 商品保存時 / confirm 時割当は順序・責務で不利 | prepare TX / formatter 入力 | Matrix A-P1〜A-P5 |
| REQ-402 | 33-biz §16.4 / 30-biz toggle_discontinue / 51-ui | SPEC-PLS-D4 | 解放即 free は stale JAN 上書き順序が不定 | release trigger / clear 行 / confirm | Matrix A-R1〜A-R7 |
| REQ-402 | 25-io §12.3 / 33-biz §16.3 / 67-ui UI-08-D4/D5/D9 | SPEC-PLS-D5 | Full 一本化は operator 負担 | formatter / UI 文言 | Matrix A-E1〜A-E5 |
| REQ-104 / REQ-402 | 30-biz §4.8-4.9 / 26-io / 60-ui / 50-ui / 40-cmd | SPEC-PLS-D6 | page 内選択・ID 配列は規模に合わない | CSV 列 / bulk command / UI-01a 操作 | Matrix B-C1〜B-C4 / B-L1〜B-L6 |
| REQ-402 | 50-ui §50.4-50.6 / 51-ui / 67-ui | SPEC-PLS-D7 | plu_exported_at 判定は再対象化で stale | 一覧 badge/filter / 詳細 / UI-08 要約 | Matrix B-V1〜B-V4 / A-V1 |
| REQ-401 / REQ-402 | plu-export-and-real-csv-verification / D-025 | SPEC-PLS-D8 | 自動突合は REQ-403 と重複 | docs のみ | Matrix M-D8 |
| REQ-907 / REQ-402 / REQ-104 | requirements / coverage | SPEC-PLS-D9 | — | spec docs / traceability | Matrix M-D9 |
| 横断 | decision-log / 25 / 33 / 67 / DB_DESIGN | SPEC-PLS-D10 / candidate D-072 | 再採番・Full-only 語彙の再導入防止 | source docs sweep | Matrix M-D10 |

## Design Intent Audit

- Source docs can answer what/why without chat history: **現時点では No**。current docs は再採番（25-io §12.3）と Full-only ガード（UI-08-D9）を正本化している。next amendment で SPEC-PLS-D1〜D10 と candidate D-072 を昇格するまで implementation forbidden。
- Plan-only durable decisions found and promoted: candidate D-072 / REQ-907 を特定済み。promotion は本発注では禁止されているため次 amendment の mandatory target。
- Assumptions and constraints: CV17 import はメモリNo. キーの部分更新（ECRCV17.pdf p.71-73 の読み、D-6）。レジ設定書出しは 11 列 / 4,784 行 / 217 始まり（Contract Probe で構造確認）。clear 行のレジ側効果は未確認（D4 fallback で吸収）。スキャニング枠は出荷時固定 217〜5000。
- Deferred design gaps: source-doc amendment、Q1〜Q5 の owner 裁定、Plan Reviewer review、Z004 取込み時のスロット照合警告（backlog）。いずれも implementation 前 blocker または記録済み follow-up。
- Test Design Matrix can cite decisions: Yes。別紙が SPEC-PLS-D1〜D10 を root にする。
- Absolute guarantee self-check: 「既存登録を上書きしない」は最終スナップショット以降にレジ側で手動登録された slot を保護できない escape hatch がある → UI-08 の再読込み推奨文言と、書出し直前の最終読込み日時表示で明示し、絶対保証と表現しない。「1 JAN = 1 スロット」は snapshot 採用時の重複 stale（release_pending）を経て収束する。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 11 列 profile、6 桁ゼロ埋め、14 桁固定幅コード、空スロット形状、217〜5000 は CASIO adapter fact（25-io）。JAN 単位永続割当・authority 分割・状態遷移は app core（33-biz / plu-tables / D-072） | 25-io / 33-biz / D-072 |
| Fact check / design decision split | 観測 fact = Probe の構造 / 件数、CV17 部分更新（取説）。決定 = 最小空き番号、release_pending、廃番連動、Diff 投入可 | Contract Probe / D-072 |
| Lifecycle / retry | 予約 → 書出し → 保存失敗 / キャンセル（reserved 維持、UI-08-D4）→ confirm → active → 解放 → clear → free → 再利用。再 prepare は冪等。snapshot 再読込みは冪等（同一 file で結果不変） | 33-biz + Matrix A-P / A-R / A-N |
| Operator workflow | 初回: CV17 設定書出し → app 読込み → 商品一括 PLU 対象化 → Full 書出し → CV17 取込み → SD → レジ → 書出し済み確認。以後: 差分 → Diff 書出し。廃番 / 解除は次回 Diff で clear | 67-ui / 50-ui / 受入台本第2版（⑤） |
| Replacement path | レジ機種変更時は 25-io の profile と 217〜5000 範囲定数を差し替え、`plu_slots` の意味と BIZ-04 契約は残る | D-072 Revisit / ARCHITECTURE |
| Data safety / evidence | Probe は構造・件数のみ記録。実コード・名称・単価・レジ設定 file は commit しない。実装 fixture は synthetic | Data Safety |
| Reporting / accounting semantics | 会計契約不変（D8）。slot 状態は在庫・売上に影響しない | D8 |
| Manual verification | design-first は docs-only で L3 なし。実装 A の L3 = clear 行の CV17 受理 + レジ側未設定化、Diff 投入、スナップショット再読込み。実装 B の L3 = 一括操作の件数確認 dialog | 実装 packet |
| 環境・再現性 | toolchain 変更なし。Probe は local-only file を iconv CP932→UTF-8 で構造検分 | Contract Probe |

## Design Readiness

State: **not ready for implementation; ready for Plan Review of this design-first draft**。

- Existing design docs are sufficient because: 現行挙動 / code mapping / schema / CV17 profile の調査元としては sufficient。ただし desired behavior（永続割当・解放・snapshot・bulk）は未設計または stale。
- Source docs updated in this PR: 本発注時点では none（明示 non-scope）。
- Design gaps intentionally deferred: SPEC-PLS-D1〜D10 の source promotion と D-072 / REQ-907 起案を plan-approved 後の次発注へ defer。clear 行の実機効果は実装 A の L3。
- Durable decisions discovered: candidate D-072。next amendment で decision-log に追加しない限り本 design-first PR は完了扱いにしない。

Minimum design checks:

- Layer ownership: UI は読込み / 要約 / 一括操作 / 状態表示、CMD は薄い bridge、BIZ-04 は割当 / 解放 / 照合 / 行構成、BIZ-01 は bulk 対象化と CSV 列と廃番連動、IO は parser / formatter / repo、MNT は migration v5。
- Backend function design: D2 / D3 / D4 / D5 / D6 で inputs / outputs / TX / error / 状態遷移を定義。
- Command / DTO / data contract: Boundary / Wire Contract に新 command 3 と既存 DTO 変更、generated binding を定義。
- Persistence / transaction / audit: migration v5 追加のみ（products 変更なし）。予約 / 解放 / 照合 / bulk は各 1 TX、operation_logs 記録。
- Operator workflow / wording: D2 / D5 / D6 / D7 で日本語 exact wording の枠を定義（最終文言は source docs 昇格時に固定）。
- Error / empty / retry / recovery: snapshot 未読込み gate、no_free_slot、conflicts / missing 報告、保存失敗時の reserved 維持、fallback no-reuse。
- Testability / traceability: REQ-907 / 402 / 104 と matrix A-* / B-* / M-* 予約を結線。

## Contract Probe

- public-writer environment: `pwd` -> `/home/kosei/Projects/inventory-system-public`; `git rev-parse --short origin/main` -> `4eecd71`; `git status --short --branch` -> `## agent/plu-slot-onboarding-design`（plan-first commit 前は path entries なし）。
- レジ設定書出し profile（local-only `~/Downloads/inventory-field-check/approved-readable/ｽｷｬﾆﾝｸﾞPLU(商品).txt`、2026-07-03 採取、構造のみ）: `iconv -f CP932 -t UTF-8 | wc -l` -> `4785`（header 1 + data 4,784）; 全行 tab 11 field; header = `メモリNo.|ｽｷｬﾆﾝｸﾞｺｰﾄﾞ|名称|単価|課税方式|単品売り|負単価|品番PLU|ゼロ単価|入力桁制限|部門リンク`; メモリNo. は 6 桁ゼロ埋めで data 範囲 `000217..005000`; コード非ゼロ行 933（`000217..001149`、= 既存 929 + 検証用 4）、コード欄長 14 が 932 行（13 桁 + space 1 / 8 桁 + space 6）、13 が 1 行; コード全ゼロ行 3,851 は全て `名称 空 / \0 / 税1(内税) / いいえ / いいえ / いいえ / いいえ / 無し / ノンリンク` の同一形状 -> D2 の入力 profile と D4 の clear 行形状の根拠。実コード・名称・単価は転記しない。
- CV17 部分更新前提: `docs/archive/plans/2026-07-03-post-ui08-janless-plu-target-design.md` §Adapter Facts（ECRCV17.pdf p.71-73「一番左側には、メモリーNo.を記述」「インポートしたい列だけを、設定することができます」）-> 記載スロットのみ更新（未記載不変は推論、D4 の安全性論拠はこの推論に依存しない）。
- schema premise: `rg -n "plu_memory|plu_slot|memory_no" src-tauri/src/db docs/db-design` -> hit なし（新 table 名の衝突なし、migration v5 が必要）。
- 現行採番: `rg -n "scanning_plu_memory_start|SCANNING_PLU_MEMORY_START" src-tauri/src/io/plu_formatter.rs src-tauri/src/constants.rs` -> formatter が行インデックス採番、定数 217 / 4784 は constants.rs（改訂対象の実在確認）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-PLS-D1 | schema_v5 / plu_slot_repo / plu-tables.md | A-S1〜A-S4（実装 A） | — |
| SPEC-PLS-D2 | io::plu_register_snapshot / BIZ-04 snapshot / UI-08 step / app_settings | A-N1〜A-N9 / A-V1（実装 A） | 実機 CV17 設定書出しの再読込みは L3（実装 A） |
| SPEC-PLS-D3 | prepare TX 予約 / formatter 入力 / no_free_slot | A-P1〜A-P5（実装 A） | — |
| SPEC-PLS-D4 | release trigger（product_service / bulk）/ clear 行 / confirm free / fallback 定数 | A-R1〜A-R7（実装 A） | clear 行の CV17 受理 + レジ未設定化は L3（実装 A） |
| SPEC-PLS-D5 | formatter 行構成 / UI-08 文言 D4/D5/D9 | A-E1〜A-E5（実装 A） | Diff 投入の実機確認は L3（実装 A） |
| SPEC-PLS-D6 | BIZ-01 CSV 列 / bulk_set_plu_target / UI-01a 操作 / UI-01c preview | B-C1〜B-C4 / B-L1〜B-L6（実装 B） | 件数確認 dialog の native 表示は L3 candidate（実装 B） |
| SPEC-PLS-D7 | UI-01a badge/filter / UI-01b メモリNo. / UI-08 要約 | B-V1〜B-V4 / A-V1 | — |
| SPEC-PLS-D8 | docs（会計契約不変の明記） | M-D8 | 受入台本第2版（⑤） |
| SPEC-PLS-D9 | requirements / coverage / traceability | M-D9（実装 PR で generator） | — |
| SPEC-PLS-D10 / candidate D-072 | decision-log + stale 語彙 sweep | M-D10 | archive rewrite non-scope |
| Q1〜Q5 | owner 裁定 → 該当 D の採否 | M-Q（packet 記録） | Human Gate |

## Test Plan

Test Design Matrix: [2026-08-18-plu-slot-onboarding-design.md](test-matrices/2026-08-18-plu-slot-onboarding-design.md)

- targeted tests: 本 PR は docs anchor / sweep 検証（M-D*）。後続の Rust repo / BIZ / IO / CMD + RTL / hook tests は A-* / B-* として予約。
- negative tests: snapshot 未読込み gate、conflicts / missing_on_register、no_free_slot、release_pending の再対象化、clear 行 fallback、bulk ON の JAN 不備 skip、CSV `PLU対象` 不正値。
- compatibility checks: 既存 confirm 契約（exact set / plu_exported_at）、D-028 同一 JAN dedup、PluNotificationBar 不変、既存 UI-08 state machine、migration v4 → v5 の順序と v3 backfill 不変。
- data safety checks: synthetic fixtures only、実レジ設定 file / コード / 単価を commit しない、物理 DELETE なし。
- main wiring / integration checks: FilePicker → generated command → CMD → BIZ-04 snapshot TX → plu_slots；prepare → 予約 TX → formatter memory_no；bulk → BIZ-01 → plu_dirty / release → D-052 invalidation。

## Boundary / Wire Contract

- producer: BIZ-04 新 DTO（`PluRegisterSnapshotResult` / `PluSlotSummary`）、BIZ-01 `BulkSetPluTargetResult`、既存 `PluExportPrepared` の row に `memory_no`、excluded reason に `no_free_slot`、product 詳細 DTO に `plu_memory_no: number | null`；CMD-08 `import_plu_register_snapshot(path)` / `get_plu_slot_summary()`、CMD-01 `bulk_set_plu_target(filter, plu_target)`；specta generator。
- consumer: `src/lib/bindings.ts`、`PluExportPage`、`ProductListPage` / `useProductList`、`ProductImportPage` preview、product 詳細 / form。
- wire type: 件数は non-negative integer、memory_no は 217〜5000 の integer、status は closed enum、filter は UI-01a §50.4 の既存 search param DTO と同型。
- internal type: `plu_slots` 行 / 状態遷移は BIZ 内部。レジ観測コード（external）は wire へ露出しない（summary 件数のみ）。
- precision/range: memory_no 範囲外・重複は DB CHECK / partial UNIQUE で拒否。money 列は書出し file 側のみ（既存 IO-04 契約）。
- round-trip path: CV17 `.txt` -> IO parser -> BIZ 照合 -> plu_slots -> prepare 予約 -> IO-04 書出し（memory_no 付き）-> CV17 import。書出し file の memory No. は 6 桁ゼロ埋めで CV17 設定書出しと同型。
- invalid input: 11 列ヘッダ不一致 / 範囲外 memory No. / 行数不整合 → `ImportError`（TX 全 rollback、slot 不変）。snapshot 未読込みでの prepare → `ValidationFailed(register_snapshot_required)`。bulk の filter 不正 → `ValidationFailed`。
- compatibility: 既存 prepare / confirm の引数は維持し戻り値へ field 追加（generated TS は再生成）。DB は additive（新 table + app_settings key）。旧 Full 書出し file（再採番）は再投入しない旨を UI-08 回復文言で明示（D5）。

## Review Focus

- D2 の照合規則が「既存登録を空き扱いしない」「app 管理は app が authority」を全組合せ（レジ空 / 有 × free / external / reserved / active / release_pending）で矛盾なく定義しているか。
- D3 / D4 が sticky 予約・解放・再対象化・fallback no-reuse を状態機械として閉じているか（到達不能状態 / 抜け遷移がないか）。
- D5 が旧 Full-only ガードの stale 語彙を全列挙する sweep 計画を持ち、UI-08-D4/D5 の回復契約と衝突しないか。
- D6 (b) が page 内ではなく filter 一致全件を対象にし、ON の skip 規則が三分バケットと整合するか。
- Q1〜Q5 の推奨に見落とした tradeoff がないか。D-070 見積り超過の記録が Revisit 条件を満たすか。
- current order の non-scope（source amendment / implementation）を越えていないか。

## Spec Contract

Contract ID: SPEC-PLS-2026-08-18

- Every scanning-PLU memory slot 217..5000 has exactly one persisted status; app-managed slots are keyed by JAN and never renumbered.
- Prepare requires a register snapshot to have been imported; slots occupied on the register by non-app codes are never written.
- Prepare reserves the lowest free slot per JAN idempotently; confirm activates reserved slots and frees cleared ones.
- Release (target off / discontinue / JAN change) yields a clear row on the next export and reuse only after confirm; a documented fallback disables reuse if the register rejects clear rows.
- Both Diff and Full files carry persisted memory numbers and are safe to import.
- Bulk onboarding is available via CSV column and filter-wide list action; migration status vocabulary is derived from plu_target / plu_dirty.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-PLS-D1 | source amendment then 実装 A | M-D1 / A-S1〜S4 | table / uniqueness / range | migration + repo tests |
| SPEC-PLS-D2 | source amendment then 実装 A | M-D2 / A-N1〜N9 | 照合 matrix 全組合せ | BIZ tests + Probe |
| SPEC-PLS-D3 | source amendment then 実装 A | M-D3 / A-P1〜P5 | sticky / lowest free / no_free_slot | BIZ TX tests |
| SPEC-PLS-D4 | source amendment then 実装 A | M-D4 / A-R1〜R7 | trigger 3 種 / clear / fallback | BIZ + formatter tests + L3 |
| SPEC-PLS-D5 | source amendment then 実装 A | M-D5 / A-E1〜E5 | 行構成 / D9 撤廃 sweep | formatter + RTL + rg |
| SPEC-PLS-D6 | source amendment then 実装 B | M-D6 / B-C1〜C4 / B-L1〜L6 | CSV 列 / filter 全件 / skip | BIZ + RTL tests |
| SPEC-PLS-D7 | source amendment then 実装 A/B | M-D7 / B-V1〜V4 / A-V1 | 語彙固定 / 色のみ禁止 | RTL tests |
| SPEC-PLS-D8 | source amendment | M-D8 | 会計不変 | docs anchor |
| SPEC-PLS-D9 | source amendment then 実装 PR | M-D9 | REQ-907 / coverage | rg + generator |
| SPEC-PLS-D10 / D-072 | durable promotion / sweep | M-D10 | stale 語彙 closure | rg output / decision-log |

## Data Safety

- Commit してはいけないもの: 実レジ設定 file、実 Z004、実スキャニングコード / 商品名 / 単価、店舗名 / 端末情報、DB、backup、secret。
- local-only paths: `~/Downloads/inventory-field-check/**`、`.local/**`、Tauri app data、CI evidence logs。
- synthetic-only paths: 後続実装の Rust fixture（11 列 synthetic `.txt`、空スロット形状は Probe の構造のみ再現）/ frontend mock。
- generated outputs: `src/lib/bindings.ts` / `90-traceability.md` は後続実装で generator から再生成し、hand edit しない。
- source-derived data: 本 packet は構造・件数（4,784 / 933 / 3,851 / 11 列 / 範囲）だけを記録し、実値を複製しない。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Gate round 1（2026-08-18、Sonnet Plan Reviewer、P1 2 / P2 3 / P3 2 → REVISE）

- P1-1「D-4 dedup」引用: 採用（是正）。反論付き — D-4 は 2026-07-03 packet 内ローカル ID として実在するが、DB_DESIGN の D-4（在庫少閾値）と衝突する曖昧引用のため、全 5 site を「D-028 同一 JAN dedup（33-biz §16.3 step 4）」へ改訂。
- P1-2 `reserved` × レジ有別コードの app 上書き: 採用。`reserved` はレジ未書込みのため予約破棄 → `external` + `reservation_dropped` 報告 + 次回 prepare で再予約へ改訂（SPEC-PLS-D2）。`active` は app authority 維持、`release_pending` × 別コードは `external`（解放済み扱い）を追加。
- P2-1 State Lifecycle Matrix の欠落遷移: 採用。A-N3b / A-N6b / A-N8b / A-N9b / A-N9c を追加し照合の全組合せを表に固定。
- P2-2 D-071 の誤引用: 採用。SPEC-PLS-D8 と Trace は D-025 単独引用へ、D-071 は系列内合算契約である旨を明記。
- P2-3 project-memory 「段階移行」: 反論（`docs/project-memory.md` 2026-08-01 rollout intent 行は英文で実在）。wording を実文言に合わせて是正のみ。
- P3 節番号 6 件 / D-054 根拠: 全て採用（§12.3 `generate_plu_tsv` 内、41-cmd §17.6、50-ui §50.8、60-ui §60.5、33-biz §16.3 line 119、2026-07-03 packet §Deferred、D-054 = 共通 FilePicker）。
