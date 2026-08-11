# Plan Packet: JAN 専用欄の共通正規化 + 保存 validation design-first

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: e1ee908
- Amendments: none
- Coordinator: Fable 5（main thread）
- Writer: Fable 5（design amendment 起草。docs-only、実装 PR は本 packet の後続で Codex 発注）
- Plan Reviewer: Sonnet 5 独立 subagent（rally）+ Codex（プラン全体レビュー、owner relay。D-062: Writer と別 vendor 要件は Fable 起草のため Sonnet/Codex どちらでも充足）
- Final Reviewer: Codex（owner relay）
- Reviewed Content HEAD: e2f4736
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required（R3 は原則 hosted final 1 run。docs-only の paths-ignore で auto run が作成されない場合は CI-TRIGGER-D1 に従い `workflow_dispatch` を 1 回実行し、PR HEAD = PR body L1 SHA = hosted headSha の三点一致を merge 条件とする）
- Human Gate: none（owner plan 承認 2026-08-11 / owner Ready 承認 + 後処理委任 2026-08-11〈介入 3/3〉で全消化。docs-only のため L3 なし、実機の入力・保存実測は実装 PR 側 L3）

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

- JAN 専用欄（商品登録フォーム）の全角→半角正規化・保存時 JAN 形式 validation（JAN-8/13 + チェックディジット）・PLU 提案の全角 13 桁問題解消・フロント/BIZ 判定重複の整理・兼用 5 欄 paste known limitation 解消の設計契約が、51 / 30-biz / catalog ⑮ / UI_TECH_STACK / master-tables に確定し、後続実装 PR を発注書 1 本で Codex に出せる状態になる。

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
- `docs/design-system/02-component-catalog.md`: ⑮ へ SPEC-SUGGEST-D12（paste 経由全角数字の正規化）追加。D11 の「paste 経由は対象外（既知の制限）」文言を D12 参照へ更新（D1〜D11 の契約意味論は不変）
- `docs/UI_TECH_STACK.md`: §6.4 の例示文言「JANコードは13桁または8桁で入力してください」へ、51 UI-01b-D17 を正本とする実体 validation である旨の参照追記
- `docs/db-design/master-tables.md`: products 設計意図節へ「jan_code の形式 validation は BIZ 保存時（手入力 create 経路）で行い、DB CHECK は追加しない（既存データ互換・グループコード運用維持）」を追記。jan_code 列説明〈13桁〉と部門 17「本」の「JAN/ISBN有り」表記を JAN-8/13 契約へ同期（ISBN-10 特例なし = owner 裁定 2026-08-11、Codex round 1 P2-2）
- `docs/Plans.md`: backlog 行へ着手注記 + 「次の行動」active packet link
- 本 packet + Test Design Matrix

## Non-scope

- `src/` / `src-tauri/` 配下の一切（実装 PR で実施）
- 既存 test の変更・削除。限定例外 = SPEC-JAN-D5 の fixture 値置換（新契約違反の jan_code fixture を synthetic 有効値へ値のみ置換。assert 構造変更・削除・skip は引き続き禁止、対象は実装 PR 発注前の rg sweep で全数列挙 — rally round 2 P1-A）。特に以下は凍結（新契約が矛盾しないことを D5 の適用境界で保証する）:
  - `src-tauri/src/biz/product_service.rs` `test_commit_import_req104_derives_plu_target_like_backfill_and_keeps_on_overwrite`（非正規 JAN 値 `IMP-SHORT` 12 桁 / `IMP-ALPHA` 英字混在の import 保存を固定）
  - `src-tauri/src/db/product_repo.rs` `test_find_by_jan_code_req103_*`（同一 jan_code 複数商品の許容を固定）
  - `src/features/products/` 配下の既存 ProductForm / product-form-request / ProductFormPage test（実装 PR では仕様反映の追記のみ、既存 assert の削除・skip 禁止）
  - PR #65 凍結の兼用 5 画面 test（D12 は半角入力に対し写像不変のため既存 assert 影響なし見込み。実証は実装 PR AC）
- `search_products` / bindings 生成物 / ProductCreateRequest の wire shape 変更
- 25-io / 33-biz / 41-cmd / 67-ui の PLU 書出し系統は doc・実装とも一切不変（adapter 所有の `is_valid_ean13_code` を含む = Codex round 1 P2-1 裁定で共有設計を撤回）

### fixture 置換対象表（Codex round 1 P2-8 起源、Coordinator 実測 2026-08-11）

実測 = `rg -n 'jan_code = Some\("[^"]*"' -o src-tauri/src/biz/product_service.rs` -> 17 occurrence / 14 unique 値。置換は occurrence 単位ではなく**論理 fixture 単位**で行い、入力値・product_code 参照・期待 literal を同じ値へ連動置換する（Codex round 2 P2-2 是正）。境界規律 = **同値置換のみ許可。assert の構造・意味の変更、test 削除・skip は禁止。import 側 fixture は完全凍結**。

| 区分 | 対象（行番号 = 2026-08-11 時点） | 裁定 |
|---|---|---|
| create 側 Rust（置換対象） | L1041 `4976383262108`（invalid: 正 check 5 / 実末尾 8）、L1066 `CREATE-PLU-TARGET`、L1310 `UP-PRICE`、L1343 `UP-COST`、L1388 `UP-PLU-TARGET`、L1464 `UP-DEPT`、L1487 `UP-SUP`、L1526 `UP-JSON`、L1627 `UP-RB`、L1665 `DISC-01`、L1685 `DISC-02`、および L1199 `test_create_product_req101_duplicate_jan` の L1204/L1209 同一値 pair（計 13 occurrence / 11 unique、全て新契約違反） | test 間では固有の有効 synthetic EAN-13 へ置換。**ただし意図的重複 test の L1204/L1209 pair は同一値を維持**（重複検出の test 意味論を保存）。期待 product_code literal の連動置換込み |
| import 側 Rust（凍結） | L2087 `4901234567894`（valid）、L2091/L2110 `123456789012`、L2093 `49012345678A4` | 完全凍結（import 経路は SPEC-JAN-D5 で validation 対象外。なお `IMP-SHORT` / `IMP-ALPHA` は product_code であり jan fixture は左記値） |
| frontend TS | `product-form-request.test.ts` の論理 fixture 1 個 = L20 入力 `4901234567890`（invalid: 正 check 4 / 実末尾 0）+ L36 期待 wire literal の 2 occurrence | 有効 synthetic へ連動置換。**L89 は update 経路 test（jan_code 非送信、SPEC-JAN-D5 で edit 対象外）のため L102 `DIFFERENT` と同じく凍結**（Codex round 2 P2-2 是正） |

## Acceptance Criteria

- AC1: 新設 D-ID 6 個（UI-01b-D16 / UI-01b-D17 / UI-01b-D18 / BIZ-01-D1 / BIZ-01-D2 / SPEC-SUGGEST-D12）が各対応 doc に存在する。51 の 3 D-ID は §7.1 設計判断節 + 該当契約節の節単位 2 箇所以上、SPEC-SUGGEST-D12 は catalog ⑮ 内 2 箇所以上（契約本文 + D11 参照更新箇所）、narrative 流儀の 30-biz の 2 D-ID は 1 箇所以上 + 契約 literal 検査で機械検証する（検査 = Matrix M-J1〜M-J8 系の `rg -F` PASS。rally round 1 P2-2 是正。IO-04-D2 は Codex round 1 P2-1 の adapter/core 境界裁定により廃止）
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
| Backend function / command / repository / validation / error | 30-biz-product-service.md（25-io は不変 = Codex round 1 P2-1 の adapter 境界裁定） | updated in this PR |
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
| REQ-101 | 30-biz §4.2 | BIZ-01-D1 | チェックディジット判定は BIZ 所有 core validator 新設（D-023 境界により adapter 関数を共有しない。frontend は `src/features/products/lib/jan-code.ts` 所有）。三独立実装は同一 golden の独立転記 oracle で拘束 | BIZ core validator + frontend jan-code.ts（実装 PR） | 実装 PR S/T 系（golden 双方必須） |
| REQ-101 | catalog ⑮ | SPEC-SUGGEST-D12 | 兼用 5 欄の paste known limitation 解消。D11 の composition 経路と対で全経路を閉じる | ProductAddSuggest onChange（実装 PR） | 実装 PR S/W 系 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 本 PR で 51 / 30-biz / catalog ⑮ / UI_TECH_STACK / master-tables に契約と理由を正本化する
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: SPEC-JAN-D5（適用境界・既存データ互換）と D6（意図的二重実装）を 51 / 30-biz / master-tables へ昇格
- Assumptions and constraints: 実装現況の実査（2026-08-11 Explore 2 系統 + Coordinator 実読）= JAN 専用欄は `ProductForm.tsx` `id="jan-code"` の 1 箇所のみ（create のみ編集可、edit readOnly）/ 正規化 util = `src/components/patterns/normalizeComposedDigits.ts`（純関数 named export 2 個）/ チェックディジット既存実装 = `src-tauri/src/io/plu_formatter.rs` `is_valid_ean13_code`（`pub(crate)`、`biz/plu_export_service.rs` から呼出し実例あり）/ 保存 validation は frontend `product-form-request.ts`（blank+code_prefix 規則のみ）・BIZ `validate_create_request`（jan_code 言及なし）
- Deferred design gaps, risk, and follow-up target: import 経路の JAN 寛容性は意図的維持（Non-scope）。将来 import 側 validation が必要になれば別 change
- Test Design Matrix can cite design decision IDs or source doc sections: Matrix M-J 系が SPEC-JAN-D1〜D8 と新設 D-ID を直接引用する
- Absolute guarantee / escape hatch self-check completed: 保存拒否の escape hatch は「JAN 欄を空にして code_prefix あり部門で登録」既存経路が残る（バーコード読取り不能・欄空白の運用は従来どおり成立）。互換: 既存 DB 行・import 経路は無影響

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 保存 validation は core（BIZ validator 新設 + frontend jan-code.ts）所有。CASIO adapter の plu_formatter 検証は共有せず不変（D-023 換装境界維持 = Codex round 1 P2-1 裁定） | 30-biz BIZ-01-D1 |
| Fact check / design decision split | 「実バーコードはチェックディジット整合」は GS1 標準の事実。「手入力 typo を block する」は設計判断（warn-only 不採用） | 51 UI-01b-D17 |
| Lifecycle / retry | validation は同期・保存前。retry 概念なし | not applicable |
| Operator workflow | 拒否文言は是正方法（桁数確認・再スキャン）へ誘導する日本語固定文言。JAN なし商品は従来どおり欄空白 + code_prefix 部門で登録可 | 51 §7.6 文言 |
| Replacement path | なし（新規契約の追加のみ） | not applicable |
| Data safety / evidence | 実店舗 JAN は使わない。契約例・test は公開標準例 + synthetic 値の区別使用 | Data Safety 節 |
| Reporting / accounting semantics | 影響なし（集計・帳票は jan_code 形式に依存しない） | not applicable |
| Manual verification | 実装 PR 側 L3（IME ON/OFF・paste・スキャナ・保存拒否/許可の実機確認） | 実装 PR packet |
| 環境・再現性 | 新設の環境依存なし（既存 toolchain のまま） | not applicable |

## Design Readiness

- Existing design docs are sufficient because: 不足（保存時 JAN validation の規定が皆無、UI_TECH_STACK §6.4 の文言が例示止まり、D11 known limitation が未解消）を本 PR で埋める
- Source docs updated in this PR: Scope 節の 7 doc
- Design gaps intentionally deferred: import 経路 validation（Non-scope 明記）、部門 17「本」のバーコードなし本・ISBN-10 本の登録経路（owner 裁定で対象外。owner 指示により Plans.md backlog へ起票 2026-08-11 — 要望発生時に code_prefix 付与 or ISBN-10 対応を再裁定）
- Durable decisions discovered in this plan and promoted to source docs: SPEC-JAN-D5 / D6

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI = 正規化 + 一次 validation（`jan-code.ts` 所有）、BIZ = defense in depth + core checkdigit validator 所有、IO = 不変（adapter 検証は plu_formatter 所有のまま = D-023 境界）。CMD 薄いまま
- Backend function design: validate_create_request への追加のみ、シグネチャ不変
- Command / DTO / data contract: wire shape 不変（validation のみ追加）
- Persistence / transaction / audit impact: なし（schema・transaction 不変）
- Operator workflow / Japanese UI wording: 拒否文言 2 種を D17 で固定
- Error, empty, retry, and recovery behavior: 空欄は既存 blank 規則、違反は同期エラー表示、回復 = 入力修正
- Testability and traceability IDs: REQ-101 / REQ-402 配下、新設 D-ID 6 個（IO-04-D2 は Codex round 1 P2-1 裁定で廃止）

## Contract Probe

- adapter/core 境界（Codex round 1 P2-1 裁定）: `io/plu_formatter.rs` の `is_valid_ean13_code` は CV17 出力検証専用の CASIO adapter 所有（ARCHITECTURE.md「POS Adapter Boundary」/ D-023 を実読確認）。core 保存 validation は共有せず BIZ 所有 validator を新設し、golden 独立転記 oracle で drift を拘束する
- 正規化 util の流用可能性: `src/components/patterns/normalizeComposedDigits.ts` は DOM 非依存の純関数 named export -> import のみで流用可。probe 済み（実読）
- EAN-8 チェックディジットの重み配分（rally round 1 P1-1 起源、probe 済み）: GS1 公表例 `96385074` = 9·3+6·1+3·3+8·1+5·3+0·1+7·3 = 86 -> check 4 一致 / synthetic `49123456` = 4·3+9·1+1·3+2·1+3·3+4·1+5·3 = 54 -> check 6 一致。7 桁データ部は先頭桁 idx 0 が重み 3（EAN-13 の先頭重み 1 と偶奇逆）。実装 PR の test はこの golden 値を独自導出せず転記する（独立転記 oracle）。偶奇反転 mutation の弁別性（Codex round 2 P2-1 で検証、Coordinator 再計算一致）: EAN-8 の kill case = `49123456`（反転で check 2）、`96385074` は反転後も check 4 の survivor。EAN-13 の kill case = `4901234567887`（反転で check 5）、`4901234567894` は survivor

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-JAN-D1（JAN 欄正規化: 非 composition onChange + compositionend、値全体数字のみ写像） | ProductForm JAN 欄（実装 PR） | 実装 PR S 系 | 実装 PR L3（IME ON/OFF・paste） |
| SPEC-JAN-D2（PLU 提案は正規化後評価、13 桁 ASCII のみ true、JAN-8 false 維持） | suggestPluTarget 呼出し順（実装 PR） | 実装 PR S 系 | — |
| SPEC-JAN-D3（保存時 8/13 桁 + チェックディジット、固定文言 2 種、blank 規則不変、frontend validator = jan-code.ts 所有） | product-form-request.ts + src/features/products/lib/jan-code.ts（実装 PR） | 実装 PR S 系（golden `96385074` / `49123456` + 偶奇反転 mutation 必須） | 実装 PR L3（保存拒否/許可） |
| SPEC-JAN-D4（BIZ defense in depth、BIZ 所有 core validator 新設・adapter 非共有、ValidationFailed 文言一致） | validate_create_request + BIZ core validator（実装 PR） | 実装 PR T 系（golden + 偶奇反転 mutation 必須） | — |
| SPEC-JAN-D5（適用境界: create 手入力のみ。import・既存行・DB CHECK 対象外 + fixture 値置換の限定許可） | 30-biz / master-tables 契約文 | 既存 import test 凍結が実質 guard + 実装 PR 発注前の fixture rg sweep（違反 fixture の全数列挙を実装 packet に記録） | non-scope 境界の明文化 |
| SPEC-JAN-D6（二重実装の契約化 + 独立転記 oracle drift-guard 両側） | 51 / 30-biz 相互参照（実装 PR で test） | 実装 PR S/T 系 | — |
| SPEC-JAN-D7 = SPEC-SUGGEST-D12（兼用 5 欄 paste 正規化、D1〜D11 不変） | ProductAddSuggest（実装 PR） | 実装 PR S/W 系 | 実装 PR L3（paste 実機） |
| SPEC-JAN-D8（UI_TECH_STACK §6.4 例示文言の実体化参照） | §6.4 追記（本 PR） | Matrix M-J 系 rg 検査 | — |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-11-jan-field-normalization-design.md`

- targeted tests: docs-only のため本 PR の自動検査は doc-consistency / traceability 差分なし + Matrix M-J 系（契約文 literal の `rg -c` 存在・件数検査）
- negative tests: Matrix M-J 系 mutation（契約文の削除・数値改変・D-ID 改番で rg count が期待から外れることを検証）
- compatibility checks: catalog ⑮ D1〜D11 既存 literal の残存検査（AC3）
- data safety checks: packet / Matrix / doc 追記に実店舗 JAN 値が含まれない（公開標準例 + synthetic のみ、Data Safety 節の区別に従う）
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
- SPEC-JAN-D2: `suggestPluTarget` は「trim -> D1 と同一写像の正規化」を適用した candidate に対して評価する（D3 の保存前 pipeline と同一 helper を共用。前後空白 + 全角 13 桁が「保存は通るのに提案 false」となる非対称を閉じる = Codex round 1 P2-3 是正）。判定は ASCII 数字 13 桁のみ true（JAN-8 は false 維持 = PLU 書出し 13 桁前提との整合）。BIZ `should_default_plu_target` の入力 domain は正規化後 wire 値であり trim を行わない（現実装どおり）。composition 中は D1 により正規化されないため評価は transient になり得るが、onCompositionEnd の正規化で収束する。この transient は許容し追加の抑制はしない（rally round 2 P3-C 明記）
- SPEC-JAN-D3: create 保存時、janCode 非 null なら「trim -> D1 と同一写像の全角→半角正規化 -> 検証」の順で適用する。この trim -> 正規化 -> 検証は `product-form-request.ts`（frontend）が実行し、BIZ-01-D1（SPEC-JAN-D4）は受領済みの正規化後 wire 値を検証のみ行う（再正規化しない = rally round 3 P3-1 明確化）。frontend の桁数 + チェックディジット判定は新設の `src/features/products/lib/jan-code.ts`（named export）が所有し、`product-form-request.ts` と D2 の suggest 評価 pipeline が共用する（inline 実装禁止 = Codex round 1 P2-5 是正）。正規化後の値が「ASCII 数字 8 桁または 13 桁」かつ「モジュラス 10 チェックディジット整合」を必須とする。保存値は正規化後の値とする（入力時正規化 D1 と重ねて冪等。前後空白 + 全角数字の入力が D1 の全体一致条件を外れて全角のまま保存検証に到達する経路を閉じる = rally round 2 P2-B 是正）。桁数違反文言 = 「JANコードは13桁または8桁で入力してください」、チェックディジット不一致文言 = 「JANコードのチェックディジットが一致しません。入力値を確認してください」。既存の blank + code_prefix なし部門の規則・文言は不変
- SPEC-JAN-D4: BIZ `validate_create_request` に同一契約の検証を追加し、違反は `ValidationFailed`（文言は SPEC-JAN-D3 の 2 文言と完全一致 literal = UI_TECH_STACK §6.4 の message 直接表示契約に整合、Codex round 1 P2-5 是正）。チェックディジット判定は **BIZ 所有の core validator を新設**して行う。D-023 の adapter/core 境界により、CASIO adapter 所有の `io/plu_formatter.rs` `is_valid_ean13_code`（CV17 出力検証専用）は共有せず不変のまま残す = adapter 詳細を core 契約へ昇格しない（Codex round 1 P2-1 是正で共有設計から転換）。EAN-8 は 7 桁データ部の先頭桁（idx 0）に重み 3 を割り当てる交互配分（idx 偶数 = 3 / 奇数 = 1）とし、EAN-13（idx 偶数 = 1 / 奇数 = 3）とは重み配分の偶奇が逆であることを契約に明記し、既存 adapter 関数のコピー実装を禁止する（rally round 1 P1-1 是正）。core validator（BIZ）/ frontend validator（D3）/ adapter validator（io、不変）は同一 GS1 標準の意図的独立実装とし、golden 独立転記 oracle は 2 profile で拘束する（Codex round 2 P2-1 是正 — adapter は EAN-13 専用で 8 桁を拒否するため「三側同一 golden」は成立しない）: (a) 三側共通 profile = EAN-13 golden（valid `4901234567887` / invalid `4901234567890`、adapter 既存 test fixture から独立転記。偶奇反転 mutation の kill case は `4901234567887`〈反転で check 5〉であり、`4901234567894` は反転後も check 4 の survivor のため kill case に使わない）、(b) core/frontend 二側 profile = EAN-8 golden（`96385074` / `49123456`。偶奇反転の kill case は `49123456`〈反転で check 2〉、`96385074` は反転後も check 4 の survivor）。adapter には EAN-8 golden を置かない（実装・test とも不変）
- SPEC-JAN-D5: 新 validation の適用は手入力 create 経路のみ。edit（jan_code readOnly）・CSV/Z004 import 経路・既存 DB 行は対象外。DB CHECK/UNIQUE は追加しない（同一 JAN 複数商品のグループコード運用維持）。ISBN-10 は許容しない — 部門 17「本」は 13 桁 JAN（EAN-13/ISBN-13）で登録する（owner 裁定 2026-08-11、Codex round 1 P2-2）。既存 test fixture の置換規律は本 packet「fixture 置換対象表」節と実装 PR Matrix が所掌し、51 / 30-biz の正本には fixture waiver を書かない（rally round 2 P1-A + Codex round 1 P2-8 是正）
- SPEC-JAN-D6: frontend `suggestPluTarget` と BIZ `should_default_plu_target` は「ASCII 数字 13 桁のみ true」の同一意味論を持つ意図的二重実装として契約化し、51 / 30-biz の相互参照で結ぶ。実装統合はしない。両側に独立転記 oracle の同一ケース表 drift-guard test を置く
- SPEC-JAN-D7（= SPEC-SUGGEST-D12）: ProductAddSuggest は composition 中でない onChange について、値全体が `[0-9０-９]+` に一致する場合のみ正規化値で親 onChange を発火する（paste 経由を含む）。正規化値は親 onChange と suggest controller の `onInputChange` の**双方**へ同一値で渡す（片側 raw 値の渡し漏れで候補 fetch が旧全角値のまま走る実装を禁止 = Codex round 1 P2-4 是正）。半角のみの値は写像で同値のため既存挙動不変。D1〜D11 は不変とし、D11 の paste 除外文言は D12 参照へ更新する
- SPEC-JAN-D8: UI_TECH_STACK §6.4 の JAN 桁数文言は 51 UI-01b-D17 を正本とする実体 validation 文言である旨の参照を §6.4 に追記する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-JAN-D1 | 51 §7.5 追記 + UI-01b-D16 | Matrix M-J1 系 | 正規化の適用経路網羅 | rg -c PASS |
| SPEC-JAN-D2 | 同上 | Matrix M-J2 系 | JAN-8 false 維持の整合 | rg -c PASS |
| SPEC-JAN-D3 | 51 §7.6 追記 + UI-01b-D17 | Matrix M-J3 系 | 文言・blank 規則不変 | rg -c PASS |
| SPEC-JAN-D4 | 30-biz §4.2 追記 + BIZ-01-D1 | Matrix M-J4 系 + M-J7a | core validator 所有・adapter 非共有・EAN-8 重み配分 | rg -c PASS |
| SPEC-JAN-D5 | 30-biz + master-tables 追記 | Matrix M-J5 系（M-J5c 含む） | 凍結 test との無矛盾・ISBN 裁定同期 | rg -c PASS |
| SPEC-JAN-D6 | 51 + 30-biz 相互参照 | Matrix M-J6 系 | oracle 独立性の設計 | rg -c PASS |
| SPEC-JAN-D7 | catalog ⑮ D12 追加 | Matrix M-J8 系 | D1〜D11 不変 | rg -c PASS |
| SPEC-JAN-D8 | UI_TECH_STACK §6.4 追記 | Matrix M-J10 系 | 参照の一方向性 | rg -c PASS |

## Data Safety

- 実店舗の商品 JAN・商品名・原価を doc / packet / Matrix に含めない
- 契約例・test 例は「公開標準例」（GS1 公表例 `96385074`）と「synthetic 値」（`4901234567894` / `49123456` 型の合成値）を区別して使用し、実店舗の実商品コードは使わない（Codex round 1 P3 是正）
- local-only paths: なし（docs-only）

## Implementation Results

PR #67（squash merge、2026-08-11）で 5 doc への設計正本化を完了。Plan Gate = Sonnet rally 3 round + Codex cross-vendor 3 round（単調収束、全 findings accept）、Final Review = Codex 1 round + closure PASS。三点一致は PR body Verification 節が evidence owner。実績 = 介入 3/3・relay 5/5（recorded-reason 調整 2 回）・STATECAP forward 3/3（うち state-only 1 本、残 2 本は content 同乗）。実装は後続 PR（Codex 発注、本 packet の Ledger「実装 PR への予約」+ fixture 置換対象表が凍結義務）。

## Review Response

- Plan Gate rally round 1（Sonnet 5 独立 subagent、2026-08-11）: P1×1 / P2×2 / P3×1、全件 accept・同 round 内是正。
  - P1-1（EAN-8 チェックディジットの重み配分が契約文に未記載。EAN-13 の重みパターンをコピー実装すると偶奇が逆で、実在 JAN-8 の登録が誤拒否される = Goal 失敗定義直撃）: SPEC-JAN-D4 / Scope 25-io 行へ重み配分（先頭桁 idx 0 = 重み 3、EAN-13 と偶奇逆）とコピー実装禁止を明文化、Contract Probe へ golden oracle（GS1 公表例 `96385074` + synthetic `49123456`、Coordinator 独立再計算で検算済み）を記録、Matrix M-J7a 新設。
  - P2-1（Non-scope の凍結 test パス誤り `io/product_repo.rs` -> `db/product_repo.rs`）: Coordinator が `fd` で db/ 実在・io/ 不在を実査のうえ是正。packet 内 sweep で同型残存なし。
  - P2-2（AC1 の「全 D-ID 2 箇所以上」と Matrix 検査範囲の不一致）: AC1 を doc 流儀別（51 系 = 節単位 2 箇所 / narrative 系 = 1 箇所 + literal 検査）へ改訂、M-J6b 新設・M-J8 強化。
  - P3-1（25-io の既存契約は §12 narrative で、関数名 `is_valid_ean13_code` の doc 言及は本 amendment が初出）: accept、IO-04-D2 文言を §12 実体に即して明確化。
- Plan Gate rally round 2（Sonnet 5 独立 subagent・fresh context、2026-08-11）: round 1 是正 3 点は独立再検証で全て一致（EAN-8 重み配分は実装 ground truth + GS1 標準 + golden 値再計算の三点整合）。新規 P1×1 / P2×1 / P3×1、全件 accept・同 round 内是正。
  - P1-A（既存 test の fixture 衝突が Non-scope 監査から漏れ、字義通り実装すると核心 happy-path `test_create_product_req101_jan`〈fixture `4976383262108` は check 5 / 実末尾 8 の invalid 値〉+ update 系 setup の `UP-*` 非 JAN 文字列 + frontend 共有 fixture `4901234567890`〈check 4 / 実末尾 0〉が即 fail し、既存 test 削除禁止規律と正面衝突）: SPEC-JAN-D5 へ fixture 値のみ置換の限定許可（assert 構造変更・削除・skip 禁止）+ 発注前 rg sweep 義務を明文化、Non-scope 更新、Matrix M-J5b + 予約節追記。Coordinator は fixture 実在とチェックディジット不一致を独立再計算・rg で裏取り済み。
  - P2-B（D1 の全体一致条件と D3 の trim 後検証の適用順ギャップ = 前後空白 + 全角数字の実バーコードが誤拒否される新規経路）: SPEC-JAN-D3 を「trim -> D1 同一写像の正規化 -> 検証、保存値は正規化後の値」へ改訂。
  - P3-C（composition 中の suggestPluTarget transient 評価が未規定）: SPEC-JAN-D2 へ transient 許容 + onCompositionEnd 収束を明記。
- Plan Gate rally round 3（Sonnet 5 独立 subagent・fresh context、2026-08-11、天井 round）: round 2 是正 3 点は独立再検証で全て一致（fixture の checkdigit 不一致は独立計算で再確認、BIZ `product_code = jan.clone()` 経路と D3 の frontend 責務の整合も実読確認）。新規 P1 = 0 / P2×1 / P3×2、全件 accept・同 round 内是正。
  - P2-1（Trace Matrix の Test 列 drift = D7 行が M-J7〈IO-04-D2 用〉、D8 行が M-J8〈catalog 用〉を誤参照、D4 行の M-J7a 欠落）: D7 -> M-J8 系 / D8 -> M-J10 系 / D4 -> M-J4 系 + M-J7a へ是正（Coordinator の転記ミス、Matrix 本体の検査は独立に有効）。
  - P3-1（D3 の「保存値 = 正規化後」の層責務が prose 単独で未確定）: D3 へ「frontend が実行、BIZ は正規化後 wire 値の検証のみ（再正規化しない）」を明文化。
  - P3-2（fixture 置換対象の実規模が例示 3 件より広い）: Coordinator 実測 = `rg -c 'jan_code = Some\(' src-tauri/src/biz/product_service.rs` -> 17 行（distinct fixture 値 14 個）。**訂正（Codex round 1 P2-8 で検出）**: 当初記録の「新契約適合 0 個の見込み」は誤り — import 側に有効値 `4901234567894` を含む。内訳の正本は「fixture 置換対象表」節。
  - verdict = P1/P2 は本 round 是正で 0。同一 vendor rally は 3 round 天井に到達、reviewer 勧告どおり cross-vendor（Codex プラン全体レビュー、owner relay）へ切替。
- Codex プラン全体レビュー round 1（owner relay、2026-08-11）: P1 = 0 / P2×8 / P3×1、全件 accept・同 round 内是正（各主張は Coordinator が ARCHITECTURE.md D-023 節・master-tables 部門表・ProductAddSuggest.tsx 2 consumer・`ValidationFailed` 14 hit・fixture 全数を実読/実測で裏取り）。
  - P2-1（core validation が CASIO adapter 所有 `io/plu_formatter` に依存し D-023 換装境界に抵触）: accept、**共有設計を撤回**し BIZ 所有 core validator 新設 + adapter 関数不変 + frontend `jan-code.ts` の三独立実装を golden 独立転記 oracle で拘束する設計へ転換。IO-04-D2 廃止、25-io は完全 Non-scope 化。
  - P2-2（ISBN 整合未確定）: owner 裁定 2026-08-11 = 本は 13 桁 JAN（EAN-13/ISBN-13）で登録、ISBN-10 特例なし。master-tables の部門 17 表記・jan_code 列説明を JAN-8/13 契約へ同期する Scope を追加。
  - P2-3（suggest 評価の入力 domain 曖昧 + trim 非対称）: accept、D2 を「trim -> D1 写像正規化後の candidate 評価（D3 と同一 helper）」へ改訂、BIZ 側は正規化後 wire 値・trim なしを明記。共通ケース表は実装 PR Matrix の S 系ケース表として引き継ぎ（D2/D3 の pipeline 契約文で domain は確定済み）。
  - P2-4（D12 の正規化値通知先が親 onChange のみ）: accept、suggest controller `onInputChange` への同一値通知を D7 へ追加、W 系予約を双方 assert へ強化。
  - P2-5（frontend EAN 検証の重み契約・golden 未拘束、validator 配置未指定、BIZ 文言）: accept、`src/features/products/lib/jan-code.ts` 所有を D3 へ明記、S 系 golden + 偶奇反転 mutation 必須化、BIZ 文言は frontend 2 文言と完全一致 literal 契約化。
  - P2-6（`rg -c "<literal>"` が regex 解釈 + backtick shell 展開で実行不能、`ValidationFailed` は 30-biz 14 hit）: accept、Matrix 実行形式を `rg -F -c -- '<literal>'` + 節抽出コマンド明記 + 原則 exact count へ全面改訂。
  - P2-7（load-bearing 節の anchor 欠落、M-J9 が D1〜D10 を検出しない）: accept、M-J1c / M-J3c 新設、M-J9 を allowed-diff 検査（catalog ⑮ の変更 hunk = D12 追加 + D11 paste 除外文置換のみ）へ改訂。
  - P2-8（fixture evidence 不正確 = import 側に有効値、IMP-* は product_code、期待 literal 同値置換の境界曖昧）: accept、「fixture 置換対象表」を packet に確定（create 13 occ 置換 / import 4 occ 完全凍結 / frontend 3 occ 置換 + DIFFERENT 凍結）、waiver 正本を packet / 実装 Matrix へ分離、Review Response の誤記録「適合 0 個見込み」を訂正。
  - P3（synthetic / 公開標準例の分類矛盾）: accept、Data Safety を区別表記へ是正。
- Codex プラン全体レビュー round 2（owner relay、2026-08-11）: round 1 是正の主要転換（adapter/core 境界・D12 双方通知・trim→正規化順・escape hatch）は妥当と独立確認、golden 再計算一致、fixture 実測一致。新規 P1 = 0 / P2×4 / P3×1、全件 accept・同 round 内是正（Coordinator は adapter fixture `4901234567887`/`4901234567890` の実在、L1199 重複 JAN test の同一値 pair 意味論、frontend L89 の update test 帰属、30-biz `###` 見出し、mutation 数理〈96385074 反転 survivor / 49123456 反転 kill / 4901234567894 反転 survivor / 4901234567887 反転 kill〉を実読・再計算で裏取り）。
  - P2-1（「三側同一 golden」が adapter の EAN-13 専用契約と両立せず、96385074/4901234567894 が偶奇反転 survivor）: accept、golden を 2 profile 契約へ改訂（EAN-13 三側共通 = 4901234567887/4901234567890、EAN-8 は core/frontend のみ、kill case 明記）+ 実装 PR に plu_formatter.rs の diff なし検査を追加。旧 Failure Mode の矛盾文も是正。
  - P2-2（「相互重複不可」が重複検出 test を破壊、frontend L89 は update 経路で凍結側、置換は論理 fixture 単位であるべき）: accept、fixture 置換対象表を論理 fixture 単位 + L1204/L1209 同一値維持 + frontend L20/L36 のみ置換へ改訂。
  - P2-3（節抽出コマンドが placeholder のまま、30-biz は `###` 見出しで共通 `^##` 不成立、M-J9 base SHA 未定）: accept、実ファイル・実見出しの実コマンドを preamble に固定、exact count 凍結規律と M-J9 の Plan Commit 実 SHA 置換義務（未置換 = 検査失敗）を明記。
  - P2-4（ISBN 裁定・master-tables 同期が Matrix から脱落）: accept、M-J5c 新設 + Trace Matrix D5 行更新。
  - P3-1（round 1 是正後の旧記述残存 = synthetic のみ表記 / D-ID 7 個 / 旧 Failure Mode）: accept、全箇所 sweep 是正。
- Codex プラン全体レビュー round 3（owner relay、2026-08-11）: P1 = 0 / P2×1、accept・同 round 内是正。
  - P2（M-J5c の products 節抽出範囲が部門 17 を含まず、2 anchor が必ず 0 件 = round 2 P2-4 の未閉塞）: Coordinator 実査で部門 17 が `## 2. departments` 節（L99 配下、部門行 L154）にあることを確認し accept。M-J5c を M-J5c-1（products 節 = jan_code 列説明）/ M-J5c-2（departments 節 = 部門 17 + ISBN-10 注記）へ二分割し、preamble の節抽出コマンドへ departments 節と実見出し行番号を追加。是正 commit = `1123de7`。
- relay 予算の recorded-reason 調整（D-038、2026-08-11）: 3 -> 4。理由 = Codex round 3 verdict に機械的 P2×1 が同梱され、その閉塞確認に 1 往復が不可避。owner は調整提示後の closure 確認 relay 実行をもって承認。
- **Plan Gate closure（2026-08-11）**: Codex 最終 verdict「Plan Gate closure 可（P1/P2=0）」（対象 = `1123de7`）。経路 = Sonnet 独立 rally 3 round（P1+P2: 3→2→1 単調収束）+ Codex cross-vendor 3 round（P2: 8→4→1 単調収束）、全 findings accept・是正済み。relay 実績 4/4（調整後）。
- owner plan 承認（2026-08-11、介入 2/3）: Plan Gate closure 後の plan 承認。併せて「ISBN-10・バーコードなし本の登録経路 gap は対応すべき点として残す」との owner 指示 → Plans.md backlog へ起票済み。遷移 `plan-gate -> plan-approved -> implementing` は本 content commit に同乗して実体化（STATECAP state-only 残枠温存）、Plan Commit = `e1ee908`（承認対象の packet 状態）。M-J9 の base SHA も同時に実値へ置換。
- relay 予算の recorded-reason 調整 2 回目（D-038、2026-08-11）: 上限を 4 から 5 へ引き上げ（未実測: 予算宣言値）。理由 = Final Reviewer は packet 指定どおり Codex（owner relay）を維持する owner 選択（Sonnet 変更案は提示のうえ不採用）。Final Review 1 往復分。
- implementing 完了（2026-08-11、Writer = Fable）: 51（UI-01b-D16〜D18 + §7.5/§7.6/§7.7/§7.9）/ 30-biz（step 1g + BIZ-01-D1/D2 設計判断）/ catalog ⑮（D12 追加 + D11 paste 文置換 + 見出し D1〜D12 化）/ UI_TECH_STACK §6.4（UI-01b-D17 正本参照）/ master-tables（jan_code 列説明 JAN-8/13 化 + DB CHECK 非追加理由 + 部門 17 行の ISBN 裁定同期）を amendment。M-J 全 anchor を実測し Matrix「Frozen anchor counts」節へ exact count 凍結。M-J9 の allowed-diff は 2 hunk（見出し更新は D12 追加の一部と裁定、D1〜D10 本文変更 0）で PASS。M-J12 = src/ 変更 0。
- Final Review round 1（Codex、owner relay、2026-08-11）: Ledger / SPEC-JAN-D1〜D8 の 5 doc 正本化・M-J9・凍結境界・AC1/3/5/6 は PASS 判定。P1 = 0 / P2×2 / P3×1、全件 accept・是正。
  - FR-P2-1（Frozen anchor counts が記載実行形式で再現不能 = M-J3a の節スコープと file 全体値の混同 / M-J3c row の旧 literal「D1」残存 / M-J5c・M-J9 の placeholder 未固定）: Matrix を実文言・節スコープ値へ全面固定（M-J3a = 1/1/1〈節〉、M-J3c (a) = UI-01b-D16 表記、M-J5c-1/2 と M-J9 D11 anchor 4 本を引用符付き完全 literal 化）、再実測で全一致確認。
  - FR-P2-2（PR body の L1 SHA `2ab97c7` が PR HEAD `4bc1f71` と不一致 = 後続 packet commit が evidence 対象外）: 本是正 commit を含む最終 HEAD で L1 full を再実行し、PR body の exact HEAD / evidence を更新。
  - FR-P3（relay 調整の数値主張が PK6 WARN）: 予算宣言値（実測値ではない）と明示する表現へ是正。
- Final Review closure（Codex、owner relay、2026-08-11）: 是正 commit `e2f4736`（= PR #67 HEAD = L1 exact HEAD）に対し最終 verdict「Final Review PASS（P1/P2=0）」。
- 遷移記録（recording compression、本 content commit に同乗 — state-only 残枠は ③ ready-hosted-final へ温存）: `implementing -> local-verified -> independent-review -> human-confirm` の隣接 forward 遷移を一括実体化する。evidence = local-verified: L1 full RESULT=PASS / EXIT_CODE=0（exact HEAD `e2f4736`、PR body Verification 節が evidence owner）/ independent-review: Final Review round 1 P2×2 是正 + closure verdict PASS（本節）/ human-confirm: Findings Freeze 発効 + Reviewed Content HEAD = `e2f4736` 設定（本 commit）。残 Human Gate = owner Ready 承認（介入 3/3）。
- Findings Freeze: **frozen after Final Review closure（2026-08-11）**; post-freeze exceptions: none
