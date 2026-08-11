# Plan Packet: JAN 専用欄の共通正規化 + 保存 validation design-first

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable 5（main thread）
- Writer: Fable 5（design amendment 起草。docs-only、実装 PR は本 packet の後続で Codex 発注）
- Plan Reviewer: Sonnet 5 独立 subagent（rally）+ Codex（プラン全体レビュー、owner relay。D-062: Writer と別 vendor 要件は Fable 起草のため Sonnet/Codex どちらでも充足）
- Final Reviewer: Codex（owner relay）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required（R3 は原則 hosted final 1 run。docs-only の paths-ignore で auto run が作成されない場合は CI-TRIGGER-D1 に従い `workflow_dispatch` を 1 回実行し、PR HEAD = PR body L1 SHA = hosted headSha の三点一致を merge 条件とする）
- Human Gate: owner plan 承認 / Ready 承認（docs-only のため L3 なし。実機の入力・保存実測は実装 PR 側 L3）

STATECAP 予算 3 本設計（state-only 遷移 commit）: ① `plan-gate -> plan-approved -> implementing`（発注直前に一括実体化）② `independent-review -> human-confirm` ③ `human-confirm -> ready-hosted-final`。その他の遷移は content commit 同乗。各 forward materialize 直後に `bash scripts/check-workflow-git.sh` を実行する。

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / Codex relay 起点 / Ready 承認）
- 実働時間上限: 30分
- relay 往復上限: 3（Codex プラン全体レビュー想定 2 round + 予備 1）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 3 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

（Codex レビューは通常の発注書 relay 方式。§5.5 の order branch 分離は使わない）

## Risk

Risk: R3

Reason:
商品マスタの入口（商品登録フォーム）に保存拒否条件を新設する設計であり、誤設計は「正しいバーコードの商品が登録できない」という業務停止級の退行になる。加えて凍結正本 catalog ⑮ への D12 追加（兼用 5 欄の paste 経路）を含み、確定する契約が後続実装 PR の凍結義務になるため R3。design-first docs-only。

## Goal

Goal Invariant:

### 最小完了条件

- JAN 専用欄（商品登録フォーム）の全角→半角正規化・保存時 JAN 形式 validation（JAN-8/13 + チェックディジット）・PLU 提案の全角 13 桁問題解消・フロント/BIZ 判定重複の整理・兼用 5 欄 paste known limitation 解消の設計契約が、51 / 30-biz / 25-io / catalog ⑮ / UI_TECH_STACK / master-tables に確定し、後続実装 PR を発注書 1 本で Codex に出せる状態になる。

### 失敗定義

- 正しいチェックディジットを持つ実バーコード（JAN-8/13）の手入力登録が拒否される設計になった場合。
- CSV/Z004 import 経路・既存 DB 行に新 validation が波及し、既存データ・実店舗データとの互換を壊す設計になった場合。
- catalog ⑮ D1〜D11 の既存契約意味論が変更された場合（D12 は追加のみ）。

### 非目的

- 実装そのもの（後続 PR）。
- CSV/Z004 import 経路への validation 追加（寛容性は実店舗データ互換のため意図的に維持）。
- DB スキーマ変更（CHECK/UNIQUE 追加・migration）。
- edit モードでの jan_code 編集解禁（readOnly 維持）。
- PLU 書出し（UI-08）系統の既存 validation の変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/function-design/51-ui-product-form.md`: UI-01b-D16（JAN 欄正規化 + PLU 提案の正規化後評価）/ UI-01b-D17（保存時 JAN 形式 validation）/ UI-01b-D18（フロント/BIZ 判定重複の契約化）新設 + §7.5 / §7.6 追記 + 変更履歴
- `docs/function-design/30-biz-product-service.md`: BIZ-01-D1（validate_create_request の JAN 形式検証 = defense in depth + 適用境界）/ BIZ-01-D2（should_default_plu_target 契約 + 51 相互参照）新設 + §4.2 追記
- `docs/function-design/25-io-plu-formatter.md`: IO-04-D2（`is_valid_ean8_code` 新設 = 先頭桁重み 3 の交互配分〈EAN-13 と偶奇逆〉+ biz への共有境界。既存 §12 チェックディジット要件の narrative 記述と `is_valid_ean13_code` の実装挙動は不変 — 関数名の doc 言及は本 amendment が初出）新設
- `docs/design-system/02-component-catalog.md`: ⑮ へ SPEC-SUGGEST-D12（paste 経由全角数字の正規化）追加。D11 の「paste 経由は対象外（既知の制限）」文言を D12 参照へ更新（D1〜D11 の契約意味論は不変）
- `docs/UI_TECH_STACK.md`: §6.4 の例示文言「JANコードは13桁または8桁で入力してください」へ、51 UI-01b-D17 を正本とする実体 validation である旨の参照追記
- `docs/db-design/master-tables.md`: products 設計意図節へ「jan_code の形式 validation は BIZ 保存時（手入力 create 経路）で行い、DB CHECK は追加しない（既存データ互換・グループコード運用維持）」を追記
- `docs/Plans.md`: backlog 行へ着手注記 + 「次の行動」active packet link
- 本 packet + Test Design Matrix

## Non-scope

- `src/` / `src-tauri/` 配下の一切（実装 PR で実施）
- 既存 test の変更・削除。特に以下は凍結（新契約が矛盾しないことを D5 の適用境界で保証する）:
  - `src-tauri/src/biz/product_service.rs` `test_commit_import_req104_derives_plu_target_like_backfill_and_keeps_on_overwrite`（非正規 JAN 値 `IMP-SHORT` 12 桁 / `IMP-ALPHA` 英字混在の import 保存を固定）
  - `src-tauri/src/db/product_repo.rs` `test_find_by_jan_code_req103_*`（同一 jan_code 複数商品の許容を固定）
  - `src/features/products/` 配下の既存 ProductForm / product-form-request / ProductFormPage test（実装 PR では仕様反映の追記のみ、既存 assert の削除・skip 禁止）
  - PR #65 凍結の兼用 5 画面 test（D12 は半角入力に対し写像不変のため既存 assert 影響なし見込み。実証は実装 PR AC）
- `search_products` / bindings 生成物 / ProductCreateRequest の wire shape 変更
- 25-io / 33-biz / 41-cmd / 67-ui の PLU 書出し validation 契約の変更（`is_valid_ean8_code` は追加のみ）

## Acceptance Criteria

- AC1: 新設 D-ID 7 個（UI-01b-D16 / UI-01b-D17 / UI-01b-D18 / BIZ-01-D1 / BIZ-01-D2 / IO-04-D2 / SPEC-SUGGEST-D12）が各対応 doc に存在する。51 の 3 D-ID は §7.1 設計判断節 + 該当契約節の節単位 2 箇所以上、SPEC-SUGGEST-D12 は catalog ⑮ 内 2 箇所以上（契約本文 + D11 参照更新箇所）、narrative 流儀の 30-biz / 25-io の 3 D-ID は 1 箇所以上 + 契約 literal 検査で機械検証する（検査 = Matrix M-J1 / M-J3 / M-J4〜M-J8 の `rg -c` PASS。rally round 1 P2-2 是正）
- AC2: SPEC-JAN-D1〜D8（下記 Spec Contract）の各契約文が対応正本 doc に 1 対 1 で存在する（検査 = Matrix M-J 系の `rg -c "<literal>"` が全て期待 count で PASS）
- AC3: catalog ⑮ D11 の既存契約文（値全体一致時のみ写像 / composition 中不加工 / one-shot guard / isLocked 尊重）が改変されずに残存する（検査 = Matrix M-J9 の `rg -c "<D11 既存 literal>" docs/design-system/02-component-catalog.md` が全 anchor で >= 1 を維持）
- AC4: `scripts/local-ci.sh full` PASS/CLEAN（docs-only、doc-consistency / traceability 差分なし）
- AC5: Plans.md backlog 行と「次の行動」が本 packet へ link し PK4 を充足する
- AC6: Plan Review closure P1/P2=0 の verdict が PR body に転記され `gh pr view --json body` で確認可能

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-101（新規登録）/ REQ-102（修正）/ REQ-402（PLU 対象初期提案）
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO、biz→io 呼出しは既存許容方向）
- Function / command / DTO: `docs/function-design/51-ui-product-form.md` / `30-biz-product-service.md` / `25-io-plu-formatter.md` / `20-io-product-repo.md`
- DB: `docs/db-design/master-tables.md`（jan_code TEXT NULLABLE、CHECK/UNIQUE なしの設計意図）
- Screen / UI: `docs/design-system/02-component-catalog.md` ⑮（SPEC-SUGGEST-D1〜D11）/ `docs/UI_TECH_STACK.md` §6.4
- Decision log / ADR: D-028（plu_target 提案は UI が行い利用者が変更可）/ PR #65 gated Amendment 3 の owner 裁定（2026-08-09、`docs/archive/plans/2026-08-05-product-add-suggest-impl.md` Review Response）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 30-biz-product-service.md / 25-io-plu-formatter.md | updated in this PR |
| Command / DTO / generated binding / wire shape | 変更なし（ProductCreateRequest shape 不変、validation のみ） | existing sufficient |
| DB / transaction / audit / rollback / migration | master-tables.md（CHECK 非追加の設計意図追記のみ、schema 不変） | updated in this PR |
| Screen / UI / route state / Japanese wording | 51-ui-product-form.md / 02-component-catalog.md ⑮ / UI_TECH_STACK.md §6.4 | updated in this PR |
| CSV / TSV / report / import / export format | 変更なし（import 経路は明示的 Non-scope） | existing sufficient |
| Durable decision / ADR | 本 packet の SPEC-JAN-D5 / D6 は 51 / 30-biz へ正本化（decision-log 新 ID は不要、既存 D-028 の範囲内） | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / doc / REQ / route / 画面の追加なし。90-traceability の再生成は実装 PR 側で REQ token 付き test 追加時に実施）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-101 / REQ-402 | 51 §7.5 | UI-01b-D16 | 入力正規化で全角 13 桁の PLU 提案 false を根治。代替の「suggestPluTarget 側で全角許容」は保存値に全角が残るため不採用 | ProductForm JAN 欄 onChange / onCompositionEnd（実装 PR） | 実装 PR S 系 |
| REQ-101 | 51 §7.6 | UI-01b-D17 | 保存時 8/13 桁 + チェックディジット必須。warn-only は typo 防御にならず不採用 | product-form-request.ts（実装 PR） | 実装 PR S 系 |
| REQ-402 | 51 §7.5 / 30-biz §4.2 | UI-01b-D18 / BIZ-01-D2 | 意図的二重実装の契約化 + 独立転記 oracle test。wire 越え SSOT 化は bindings 定数 export の重さに見合わず不採用 | 両側 drift-guard test（実装 PR） | 実装 PR S/T 系 |
| REQ-101 | 30-biz §4.2 | BIZ-01-D1 | BIZ defense in depth + 適用境界（create 手入力のみ、import/既存行対象外） | validate_create_request（実装 PR） | 実装 PR T 系 |
| REQ-101 | 25-io | IO-04-D2 | チェックディジット判定は io 既存関数の共有。BIZ 複製は drift 温床で不採用 | is_valid_ean8_code 新設（実装 PR） | 実装 PR T 系 |
| REQ-101 | catalog ⑮ | SPEC-SUGGEST-D12 | 兼用 5 欄の paste known limitation 解消。D11 の composition 経路と対で全経路を閉じる | ProductAddSuggest onChange（実装 PR） | 実装 PR S/W 系 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 本 PR で 51 / 30-biz / 25-io / catalog ⑮ / UI_TECH_STACK / master-tables に契約と理由を正本化する
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: SPEC-JAN-D5（適用境界・既存データ互換）と D6（意図的二重実装）を 51 / 30-biz / master-tables へ昇格
- Assumptions and constraints: 実装現況の実査（2026-08-11 Explore 2 系統 + Coordinator 実読）= JAN 専用欄は `ProductForm.tsx` `id="jan-code"` の 1 箇所のみ（create のみ編集可、edit readOnly）/ 正規化 util = `src/components/patterns/normalizeComposedDigits.ts`（純関数 named export 2 個）/ チェックディジット既存実装 = `src-tauri/src/io/plu_formatter.rs` `is_valid_ean13_code`（`pub(crate)`、`biz/plu_export_service.rs` から呼出し実例あり）/ 保存 validation は frontend `product-form-request.ts`（blank+code_prefix 規則のみ）・BIZ `validate_create_request`（jan_code 言及なし）
- Deferred design gaps, risk, and follow-up target: import 経路の JAN 寛容性は意図的維持（Non-scope）。将来 import 側 validation が必要になれば別 change
- Test Design Matrix can cite design decision IDs or source doc sections: Matrix M-J 系が SPEC-JAN-D1〜D8 と新設 D-ID を直接引用する
- Absolute guarantee / escape hatch self-check completed: 保存拒否の escape hatch は「JAN 欄を空にして code_prefix あり部門で登録」既存経路が残る（バーコード読取り不能・欄空白の運用は従来どおり成立）。互換: 既存 DB 行・import 経路は無影響

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | チェックディジット判定は io（plu_formatter）所有を維持し biz が共有。UI は表示文言のみ所有 | 25-io IO-04-D2 |
| Fact check / design decision split | 「実バーコードはチェックディジット整合」は GS1 標準の事実。「手入力 typo を block する」は設計判断（warn-only 不採用） | 51 UI-01b-D17 |
| Lifecycle / retry | validation は同期・保存前。retry 概念なし | not applicable |
| Operator workflow | 拒否文言は是正方法（桁数確認・再スキャン）へ誘導する日本語固定文言。JAN なし商品は従来どおり欄空白 + code_prefix 部門で登録可 | 51 §7.6 文言 |
| Replacement path | なし（新規契約の追加のみ） | not applicable |
| Data safety / evidence | 実店舗 JAN は使わない。契約例・test は synthetic 値のみ | Data Safety 節 |
| Reporting / accounting semantics | 影響なし（集計・帳票は jan_code 形式に依存しない） | not applicable |
| Manual verification | 実装 PR 側 L3（IME ON/OFF・paste・スキャナ・保存拒否/許可の実機確認） | 実装 PR packet |
| 環境・再現性 | 新設の環境依存なし（既存 toolchain のまま） | not applicable |

## Design Readiness

- Existing design docs are sufficient because: 不足（保存時 JAN validation の規定が皆無、UI_TECH_STACK §6.4 の文言が例示止まり、D11 known limitation が未解消）を本 PR で埋める
- Source docs updated in this PR: Scope 節の 7 doc
- Design gaps intentionally deferred: import 経路 validation（Non-scope 明記）
- Durable decisions discovered in this plan and promoted to source docs: SPEC-JAN-D5 / D6

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI = 正規化 + 一次 validation 文言、BIZ = defense in depth、IO = チェックディジット判定関数所有。CMD 薄いまま
- Backend function design: validate_create_request への追加のみ、シグネチャ不変
- Command / DTO / data contract: wire shape 不変（validation のみ追加）
- Persistence / transaction / audit impact: なし（schema・transaction 不変）
- Operator workflow / Japanese UI wording: 拒否文言 2 種を D17 で固定
- Error, empty, retry, and recovery behavior: 空欄は既存 blank 規則、違反は同期エラー表示、回復 = 入力修正
- Testability and traceability IDs: REQ-101 / REQ-402 配下、新設 D-ID 7 個

## Contract Probe

- biz から io/plu_formatter の checkdigit 関数を呼べる（可視性・依存方向）: `rg -n "is_valid_ean13_code" src-tauri/src/biz/plu_export_service.rs` -> 既存呼出し実例あり（`pub(crate)` で biz→io は許容方向）。probe 済み
- 正規化 util の流用可能性: `src/components/patterns/normalizeComposedDigits.ts` は DOM 非依存の純関数 named export -> import のみで流用可。probe 済み（実読）
- EAN-8 チェックディジットの重み配分（rally round 1 P1-1 起源、probe 済み）: GS1 公表例 `96385074` = 9·3+6·1+3·3+8·1+5·3+0·1+7·3 = 86 -> check 4 一致 / synthetic `49123456` = 4·3+9·1+1·3+2·1+3·3+4·1+5·3 = 54 -> check 6 一致。7 桁データ部は先頭桁 idx 0 が重み 3（EAN-13 の先頭重み 1 と偶奇逆）。実装 PR の test はこの golden 値を独自導出せず転記する（独立転記 oracle）

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-JAN-D1（JAN 欄正規化: 非 composition onChange + compositionend、値全体数字のみ写像） | ProductForm JAN 欄（実装 PR） | 実装 PR S 系 | 実装 PR L3（IME ON/OFF・paste） |
| SPEC-JAN-D2（PLU 提案は正規化後評価、13 桁 ASCII のみ true、JAN-8 false 維持） | suggestPluTarget 呼出し順（実装 PR） | 実装 PR S 系 | — |
| SPEC-JAN-D3（保存時 8/13 桁 + チェックディジット、固定文言 2 種、blank 規則不変） | product-form-request.ts（実装 PR） | 実装 PR S 系 | 実装 PR L3（保存拒否/許可） |
| SPEC-JAN-D4（BIZ defense in depth、io 関数共有、ValidationFailed） | validate_create_request（実装 PR） | 実装 PR T 系 | — |
| SPEC-JAN-D5（適用境界: create 手入力のみ。import・既存行・DB CHECK 対象外） | 30-biz / master-tables 契約文 | 既存 import test 凍結が実質 guard | non-scope 境界の明文化 |
| SPEC-JAN-D6（二重実装の契約化 + 独立転記 oracle drift-guard 両側） | 51 / 30-biz 相互参照（実装 PR で test） | 実装 PR S/T 系 | — |
| SPEC-JAN-D7 = SPEC-SUGGEST-D12（兼用 5 欄 paste 正規化、D1〜D11 不変） | ProductAddSuggest（実装 PR） | 実装 PR S/W 系 | 実装 PR L3（paste 実機） |
| SPEC-JAN-D8（UI_TECH_STACK §6.4 例示文言の実体化参照） | §6.4 追記（本 PR） | Matrix M-J 系 rg 検査 | — |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-11-jan-field-normalization-design.md`

- targeted tests: docs-only のため本 PR の自動検査は doc-consistency / traceability 差分なし + Matrix M-J 系（契約文 literal の `rg -c` 存在・件数検査）
- negative tests: Matrix M-J 系 mutation（契約文の削除・数値改変・D-ID 改番で rg count が期待から外れることを検証）
- compatibility checks: catalog ⑮ D1〜D11 既存 literal の残存検査（AC3）
- data safety checks: packet / Matrix / doc 追記に実店舗 JAN 値が含まれない（synthetic のみ）
- main wiring/integration checks: 実装 PR 側（本 packet の Ledger が実装 PR の凍結義務）

## Boundary / Wire Contract

- producer: ProductForm（jan_code 入力値）
- consumer: create_product CMD -> BIZ -> IO（product_code = jan_code 採用の既存経路）
- wire type: `ProductCreateRequest.jan_code: string | null`（不変）
- internal type: 不変
- precision/range: 保存許容値を「ASCII 数字 8 桁 or 13 桁 + チェックディジット整合」へ縮小（新規 create 手入力のみ）
- round-trip path: 不変
- invalid input: frontend = errors.janCode 固定文言 / BIZ = ValidationFailed（同旨文言）
- compatibility: 既存 DB 行・import 経路・edit readOnly は無影響（SPEC-JAN-D5）。bindings 再生成不要（型不変）

## Review Focus

- 保存拒否条件の業務妥当性: チェックディジット block が実運用（破損バーコードの手入力等）を阻害しないか。escape hatch（欄空白 + code_prefix 部門）で足りるか
- SPEC-JAN-D5 の適用境界が既存凍結 test（import 系・重複 JAN 許容系）と矛盾しないか
- SPEC-SUGGEST-D12 追加が catalog ⑮ D1〜D11 の凍結意味論を変えていないか（特に D11 の composition 契約との重複・競合）
- 二重実装契約（D6）の妥当性: wire 越え SSOT 化を不採用とする判断の是非
- 文言 2 種の operator 可読性（非 IT 高齢 operator 前提）

## Spec Contract

Contract ID: SPEC-JAN-D1〜D8

- SPEC-JAN-D1: ProductForm の JAN 専用欄は、(a) composition 中でない onChange（キー入力・paste を含む全経路）と (b) onCompositionEnd の確定値の両方で、値全体が `[0-9０-９]+` に一致する場合のみ U+FF10〜U+FF19 -> ASCII 数字の文字写像を適用する。混在値は無変換、composition 中は不加工。NFKC・trim 変更・記号/かな変換・チェックディジット補正は行わない。util は `normalizeComposedDigits` / `isComposedDigitsOnly` の既存実装を import 流用し、複製・挙動変更を禁止する
- SPEC-JAN-D2: `suggestPluTarget` は正規化適用後の値で評価する。判定は ASCII 数字 13 桁のみ true（JAN-8 は false 維持 = PLU 書出し 13 桁前提との整合）
- SPEC-JAN-D3: create 保存時、janCode 非 null なら trim 後の値が「ASCII 数字 8 桁または 13 桁」かつ「モジュラス 10 チェックディジット整合」を必須とする。桁数違反文言 = 「JANコードは13桁または8桁で入力してください」、チェックディジット不一致文言 = 「JANコードのチェックディジットが一致しません。入力値を確認してください」。既存の blank + code_prefix なし部門の規則・文言は不変
- SPEC-JAN-D4: BIZ `validate_create_request` に同一契約の検証を追加し、違反は `ValidationFailed`。チェックディジット判定は io の `is_valid_ean13_code` + 新設 `is_valid_ean8_code` を共有し、BIZ 側複製を禁止する。`is_valid_ean8_code` は 7 桁データ部の先頭桁（idx 0）に重み 3 を割り当てる交互配分（idx 偶数 = 3 / 奇数 = 1）とし、`is_valid_ean13_code`（idx 偶数 = 1 / 奇数 = 3）とは重み配分の偶奇が逆であることを契約に明記し、既存関数のコピー実装を禁止する（rally round 1 P1-1 是正）
- SPEC-JAN-D5: 新 validation の適用は手入力 create 経路のみ。edit（jan_code readOnly）・CSV/Z004 import 経路・既存 DB 行は対象外。DB CHECK/UNIQUE は追加しない（同一 JAN 複数商品のグループコード運用維持）
- SPEC-JAN-D6: frontend `suggestPluTarget` と BIZ `should_default_plu_target` は「ASCII 数字 13 桁のみ true」の同一意味論を持つ意図的二重実装として契約化し、51 / 30-biz の相互参照で結ぶ。実装統合はしない。両側に独立転記 oracle の同一ケース表 drift-guard test を置く
- SPEC-JAN-D7（= SPEC-SUGGEST-D12）: ProductAddSuggest は composition 中でない onChange について、値全体が `[0-9０-９]+` に一致する場合のみ正規化値で親 onChange を発火する（paste 経由を含む）。半角のみの値は写像で同値のため既存挙動不変。D1〜D11 は不変とし、D11 の paste 除外文言は D12 参照へ更新する
- SPEC-JAN-D8: UI_TECH_STACK §6.4 の JAN 桁数文言は 51 UI-01b-D17 を正本とする実体 validation 文言である旨の参照を §6.4 に追記する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-JAN-D1 | 51 §7.5 追記 + UI-01b-D16 | Matrix M-J1 系 | 正規化の適用経路網羅 | rg -c PASS |
| SPEC-JAN-D2 | 同上 | Matrix M-J2 系 | JAN-8 false 維持の整合 | rg -c PASS |
| SPEC-JAN-D3 | 51 §7.6 追記 + UI-01b-D17 | Matrix M-J3 系 | 文言・blank 規則不変 | rg -c PASS |
| SPEC-JAN-D4 | 30-biz §4.2 追記 + BIZ-01-D1 | Matrix M-J4 系 | io 共有・複製禁止 | rg -c PASS |
| SPEC-JAN-D5 | 30-biz + master-tables 追記 | Matrix M-J5 系 | 凍結 test との無矛盾 | rg -c PASS |
| SPEC-JAN-D6 | 51 + 30-biz 相互参照 | Matrix M-J6 系 | oracle 独立性の設計 | rg -c PASS |
| SPEC-JAN-D7 | catalog ⑮ D12 追加 | Matrix M-J7 系 | D1〜D11 不変 | rg -c PASS |
| SPEC-JAN-D8 | UI_TECH_STACK §6.4 追記 | Matrix M-J8 系 | 参照の一方向性 | rg -c PASS |

## Data Safety

- 実店舗の商品 JAN・商品名・原価を doc / packet / Matrix に含めない
- 契約例・test 例はチェックディジット整合の synthetic 値のみ（例: `4901234567894` / `49123456` 型の合成値。実在企業 GS1 prefix の実商品コードは使わない）
- local-only paths: なし（docs-only）

## Implementation Results

Fill after implementation.

## Review Response

- Plan Gate rally round 1（Sonnet 5 独立 subagent、2026-08-11）: P1×1 / P2×2 / P3×1、全件 accept・同 round 内是正。
  - P1-1（EAN-8 チェックディジットの重み配分が契約文に未記載。EAN-13 の重みパターンをコピー実装すると偶奇が逆で、実在 JAN-8 の登録が誤拒否される = Goal 失敗定義直撃）: SPEC-JAN-D4 / Scope 25-io 行へ重み配分（先頭桁 idx 0 = 重み 3、EAN-13 と偶奇逆）とコピー実装禁止を明文化、Contract Probe へ golden oracle（GS1 公表例 `96385074` + synthetic `49123456`、Coordinator 独立再計算で検算済み）を記録、Matrix M-J7a 新設。
  - P2-1（Non-scope の凍結 test パス誤り `io/product_repo.rs` -> `db/product_repo.rs`）: Coordinator が `fd` で db/ 実在・io/ 不在を実査のうえ是正。packet 内 sweep で同型残存なし。
  - P2-2（AC1 の「全 D-ID 2 箇所以上」と Matrix 検査範囲の不一致）: AC1 を doc 流儀別（51 系 = 節単位 2 箇所 / narrative 系 = 1 箇所 + literal 検査）へ改訂、M-J6b 新設・M-J8 強化。
  - P3-1（25-io の既存契約は §12 narrative で、関数名 `is_valid_ean13_code` の doc 言及は本 amendment が初出）: accept、IO-04-D2 文言を §12 実体に即して明確化。
- Findings Freeze: not yet frozen
