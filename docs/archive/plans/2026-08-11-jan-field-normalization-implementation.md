# JAN 専用欄正規化 implementation Plan Packet

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 2439c03
- Amendments: none
- Draft Provenance: 本 packet 初稿は誤配された引き継ぎを起点に Codex が起草（正式発注フロー外）。Coordinator が設計正本（archived design packet / matrix）と突き合わせて監査（Sonnet 5 independent 一次監査 12 観点 = Ledger 継承 / fixture 置換対象表 / golden 2 profile / 既存 test 凍結 / scope 整合 / 編成 D-062 / Coordinator 所有 field / D-062 数値主張 / fixture sweep / Plans.md 導線 / commit 体裁 / 幻覚検査、P1 = 0 + Coordinator による fixture sweep 独立再実行、2026-08-11）し、是正のうえ採用した。監査時是正の内訳 = (1) W5 へ golden 2 profile 配置契約を設計正本 SPEC-JAN-D4 から転記 (2) frontend sweep の実測コマンド + 出力を embed (3) Fixture Sweep 節へ Coordinator 独立再実行記録を追記 (4) 本 Provenance 記録の追加 (5) commit subject を repo 標準の `docs(plans):` へ修正
- Coordinator: Fable 5（main thread / owner relay）
- Writer: Codex（本 branch の実装担当）
- Plan Reviewer: Sonnet 5（independent / fresh context）
- Final Reviewer: Sonnet 5（independent / fresh context）
- Reviewed Content HEAD: 834f5e9
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval（消化済み 2026-08-11、介入 1/3）; Windows native L3（IME ON/OFF・paste・HID scanner・保存拒否/許可・JAN-8/13 境界・文言視認性）; Ready/merge approval

STATECAP 予算 3 本設計（state-only 遷移 commit）: ① `plan-gate -> plan-approved -> implementing`（本遷移）② `independent-review -> human-confirm` ③ `human-confirm -> ready-hosted-final`。その他の遷移は content commit 同乗。各 forward materialize 直後に `bash scripts/check-workflow-git.sh` を実行する。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

開始時は既定値を使う。design-first の実績 5 回を先取りして予算化せず、超過が必要になった時だけ理由・追加量・goal 維持を記録して owner に事前提示する。最初の owner plan 承認依頼を `この change での介入 1 回目 / 予算 3 回` と数える。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

AGENT_OPERATING_MANUAL §5.5 の remote order branch は使わない。owner relay では本 Packet / Matrix と Plan Reviewer findings を会話で中継し、target branch に発注書専用 commit を混ぜない。

## Risk

Risk: R3

Reason:
operator-facing JAN 入力、保存前 validation、BIZ create validation、共通商品候補欄 5 画面の入力通知を横断して変える。DB schema / wire shape / import adapter は不変だが、誤受理・誤拒否は商品登録や PLU 対象判定へ波及するため R3 とする。

## Goal

Goal Invariant:

JAN 専用欄へ入力された半角・全角の数字列を composition 境界を壊さず同じ ASCII JAN として保存し、EAN-8 / EAN-13 の長さと check digit が正しい値だけを UI と BIZ の両方で受理する。商品追加共通欄の paste でも、親 state と候補検索 controller が同じ正規化値を観測する。

### 最小完了条件

- create mode の JAN 欄で全角数字列を入力・paste・composition 確定すると ASCII 数字へ正規化され、mixed input は加工されない。
- frontend は trim -> 正規化 -> EAN-8/EAN-13 validation の順で保存値を作り、BIZ はその wire 値を再正規化せず再検証する。
- EAN-13 `4901234567887` と EAN-8 `96385074` / `49123456` を正しく受理し、`4901234567890` と誤った長さ・文字種を正しい literal 文言で拒否する。
- `suggestPluTarget` と ProductAddSuggest D12 が正規化後の値を用い、既存 D1〜D11、import、POS adapter、5 画面の回帰契約を壊さない。

### 失敗定義

- UI と BIZ で受理集合・エラー文言・保存値がずれる。
- EAN-8 の重みを EAN-13 からコピーし、先頭 data digit の重み 3 を取り違える。
- mixed input や composition 中の文字列を加工する、または D12 で親と controller へ異なる値を通知する。
- frozen test の削除、skip、assert 構造変更、許可外 fixture 置換、import / `io/plu_formatter.rs` / `db/product_repo.rs` の変更を行う。

### 非目的

- ISBN-10 対応、JAN 自動補正、NFKC、記号・空白・かなの入力時除去、スキャナ設定変更。
- update wire / DTO / command / bindings / DB schema / transaction / import validation の変更。
- ProductAddSuggest D1〜D11、5 画面固有挙動、POS adapter の validator 共通化。

## Scope

### W1 — fixture inventory と TDD baseline

- 実装前に本 Packet の Fixture Sweep を current HEAD で再実行し、create 13 occurrence、import 4 occurrence、frontend 許可 2 occurrence と凍結 2 occurrence の行・値・分類が一致することを確認する。
- Matrix の failure mode に沿って frontend / Rust の failing test を先に追加し、Red を個別実行で確認する。既存 test を削除・skip・assert 弱化して Red を解消しない。

### W2 — frontend JAN core helper

- `src/features/products/lib/jan-code.ts` を新設し、trim + `normalizeComposedDigits` による候補正規化、EAN-8/EAN-13 check digit 判定、PLU 対象提案に必要な最小 named export を置く。
- `src/features/products/lib/jan-code.test.ts` を新設し golden 2 profile、長さ・非 ASCII、EAN-8/EAN-13 parity inversion kill を固定する。
- frontend request builder と ProductForm の suggest 評価はこの helper を共用し、inline validator / regex pipeline を残さない。

### W3 — ProductForm と request builder

- `ProductForm.tsx` の create JAN 欄で既存 `normalizeComposedDigits` / `isComposedDigitsOnly` を import し、non-composition `onChange`（paste を含む）と `onCompositionEnd` に全体数字列だけの正規化を適用する。composition 中・mixed input は不変。
- `product-form-request.ts` は trim -> 正規化 -> validate の順で create request を作り、保存値を正規化後の値にする。空欄 + `code_prefix` 規則は不変。
- 長さ / 非 ASCII は `JANコードは13桁または8桁で入力してください`、check digit 不一致は `JANコードのチェックディジットが一致しません。入力値を確認してください` を返す。
- `suggestPluTarget` は trim + 正規化後の ASCII 13 桁だけを true とし、JAN-8 は false。manual override の既存契約は維持する。

### W4 — ProductAddSuggest D12

- `ProductAddSuggest.tsx` の non-composition `onChange` でも全体数字列を正規化し、親 `onChange` と `controller.onInputChange` の両方へ同一値を渡す。
- D1〜D11 と既存 S1〜S27 は不変とし、D12 専用 assertion を `ProductAddSuggest.test.tsx` に分離追加する。5 画面 test は編集しない。

### W5 — BIZ core validation

- BIZ owned の JAN validator module を `src-tauri/src/biz/jan_code.rs` として新設し（`biz/mod.rs` へ `pub mod jan_code;` を登録、frontend `src/features/products/lib/jan-code.ts` との層対称命名）、EAN-8/EAN-13 の ASCII digit・長さ・check digit を検証する。EAN-8 は data index 0 の重み 3、EAN-13 は data index 0 の重み 1 として別 profile を明示する。
- golden 独立転記 oracle は設計正本どおり 2 profile で拘束する: (a) 三側共通 profile = EAN-13 golden（valid `4901234567887` / invalid `4901234567890`、偶奇反転 mutation の kill case = `4901234567887`。`4901234567894` は反転 survivor のため kill case に使わない）、(b) core/frontend 二側 profile = EAN-8 golden（`96385074` / `49123456`、偶奇反転の kill case = `49123456`）。adapter には EAN-8 golden を置かない（実装・test とも不変）。
- `validate_create_request` step 1g に wire 値検証を追加する。trim・全角変換・再正規化を行わず、frontend と同じ 2 literal を返す。
- BIZ の `should_default_plu_target` は normalized wire domain の ASCII 13 桁だけを true とする既存責務を維持し、frontend と同じ semantic case table を独立 test する。

### W6 — fixture replacement と frozen boundary

- `src-tauri/src/biz/product_service.rs` の create-side 13 `jan_code` occurrence を下記 12 logical fixture へ置換し、そこから導出される `product_code` の引数・SQL・期待 literal も同一 replacement へ連動置換する。L1204/L1209 の同一 test pair だけ同じ値を維持し、他の logical test 間は固有値にする。
- import-side 4 occurrence、`src-tauri/src/io/plu_formatter.rs`、`src-tauri/src/db/product_repo.rs` の `find_by_jan_code` test、PR #65 の 5 画面 test は diff 0 とする。
- `product-form-request.test.ts` は current L20 input と L36 expected wire の同一 logical fixture だけ `2000000000138` へ連動置換し、current L89 / L102 は変更しない。

### W7 — generation, verification, review handoff

- REQ token 付き test 追加後に `cd src-tauri && cargo run --bin generate_traceability` を実行し、`docs/function-design/90-traceability.md` を生成物として commit する。手編集しない。
- targeted test、frontend / Rust gate、doc consistency、env safety、design compliance、L1 full、`cargo check --release` を通す。
- Writer が mutation X1〜X11 を一時注入して red を確認し全て戻す。Coordinator は clean Writer diff に対して独立に同 mutation class と fixture/frozen sweep を再検証する。
- independent Plan Review と Final Review は Sonnet 5 の fresh context で実施し、Codex Writer の self-closure にしない。

## Fixture Sweep（Coordinator prerequisite / current HEAD 実測）

実測コマンド:

```text
rg -n 'jan_code = Some\("[^"]*"' src-tauri/src/biz/product_service.rs
```

実測出力（2026-08-11、branch 作成直後）:

```text
1041:        req.jan_code = Some("4976383262108".to_string());
1066:        req.jan_code = Some("CREATE-PLU-TARGET".to_string());
1204:        req.jan_code = Some("4976383262108".to_string());
1209:        req.jan_code = Some("4976383262108".to_string());
1310:        req.jan_code = Some("UP-PRICE".to_string());
1343:        req.jan_code = Some("UP-COST".to_string());
1388:        req.jan_code = Some("UP-PLU-TARGET".to_string());
1464:        req.jan_code = Some("UP-DEPT".to_string());
1487:        req.jan_code = Some("UP-SUP".to_string());
1526:        req.jan_code = Some("UP-JSON".to_string());
1627:        req.jan_code = Some("UP-RB".to_string());
1665:        req.jan_code = Some("DISC-01".to_string());
1685:        req.jan_code = Some("DISC-02".to_string());
2087:        req.jan_code = Some("4901234567894".to_string());
2091:        req.jan_code = Some("123456789012".to_string());
2093:        req.jan_code = Some("49012345678A4".to_string());
2110:        req.jan_code = Some("123456789012".to_string());
```

分類: create-side 13 occurrence / current 11 distinct literal、import-side 4 occurrence / frozen。置換後は create-side 12 logical fixture（13 occurrence。L1204/L1209 の pair が 1 logical fixture）とする。

| current JAN site | linked product_code / expectation sites | logical role | replacement | rule |
|---|---|---|---|---|
| L1041 | L1046 | create happy path | `2000000000015` | unique / linked literal 同値 |
| L1066 | result-derived lookup only | create PLU target | `2000000000022` | unique |
| L1204 + L1209 | result/error type only | duplicate JAN pair | `2000000000039` | pair 内同一 |
| L1310 | L1318/L1323/L1331 | update price setup | `2000000000046` | unique / all linked literals 同値 |
| L1343 | L1350/L1362/L1366/L1373 | update cost setup | `2000000000053` | unique / all linked literals 同値 |
| L1388 | L1395/L1405/L1412/L1420/L1430/L1437 | update PLU target setup | `2000000000060` | unique / all linked literals 同値 |
| L1464 | L1472 | update department setup | `2000000000077` | unique / linked literal 同値 |
| L1487 | L1495 | update supplier setup | `2000000000084` | unique / linked literal 同値 |
| L1526 | L1534 | update JSON setup | `2000000000091` | unique / linked literal 同値 |
| L1627 | L1637/L1643/L1651 | rollback setup | `2000000000107` | unique / all linked literals 同値 |
| L1665 | L1669/L1672 | discontinue setup 1 | `2000000000114` | unique / all linked literals 同値 |
| L1685 | L1689/L1690 | discontinue setup 2 | `2000000000121` | unique / all linked literals 同値 |
| frontend current L20 + L36 | input + expected wire | request fixture | `2000000000138` | pair 内同一 |

linked literal sweep command:

```text
rg -n '4976383262108|CREATE-PLU-TARGET|UP-PRICE|UP-COST|UP-PLU-TARGET|UP-DEPT|UP-SUP|UP-JSON|UP-RB|DISC-01|DISC-02|4901234567890|DIFFERENT' src-tauri/src/biz/product_service.rs src/features/products/lib/product-form-request.test.ts
```

上表の line inventory と一致。実装時は replacement 後に旧 create literal が 0 hit、frozen frontend L89/L102 が各残存、import literal が元の行で残存することを再測定する。行番号は編集で移動するため、実装後の判定は test 名 + literal + diff hunk で行う。

synthetic 13 values は次の read-only Node check で全て valid EAN-13 = `true` を実測した。実装 test oracle は新 helper / BIZ validator 自身ではなく、固定表と独立計算で扱う。

```text
2000000000015 true
2000000000022 true
2000000000039 true
2000000000046 true
2000000000053 true
2000000000060 true
2000000000077 true
2000000000084 true
2000000000091 true
2000000000107 true
2000000000114 true
2000000000121 true
2000000000138 true
```

frontend sweep 実測コマンド:

```text
rg -n '4901234567890|DIFFERENT' src/features/products/lib/product-form-request.test.ts
```

実測出力（2026-08-11、Coordinator 実行）:

```text
20:    janCode: "4901234567890",
36:      jan_code: "4901234567890",
89:      jan_code: "4901234567890",
102:      janCode: "DIFFERENT",
```

frontend sweep 追加確認: `product-form-request.test.ts` current L20/L36 のみ置換可、L89 `4901234567890` と L102 `DIFFERENT` は update-path frozen。`test-fixtures.ts` / `ProductForm.test.tsx` の同 literal は replacement table 対象外であり、必要な新 test は別 synthetic fixture を使う。

Coordinator 独立再実行記録（2026-08-11、packet 監査時）: 上記 backend sweep（17 occurrence = create-side 13 / import-side 4）と frontend sweep（L20/L36/L89/L102）を Coordinator が同一コマンドで独立に再実行し、行番号・literal とも本節の記載と全一致を確認した。本節の実測出力は Coordinator 再実行時の実出力（indent 含む）に揃えてある。

## Non-scope

- import request、import test、DB lookup test、POS formatter の実装・test変更。
- ISBN-10、バーコードなし部門17商品の escape hatch、JAN correction UX。
- edit mode の JAN 編集解禁、update request shape 変更。
- ProductAddSuggest の debounce / sequence token / Enter / focus / aria / commit lifecycle の変更。
- route、navigation、dependency、schema、migration、command、DTO、bindings の変更。

## Acceptance Criteria

- AC1: `jan-code.test.ts` と BIZ core test が EAN-13 valid `4901234567887` / invalid `4901234567890`、EAN-8 valid `96385074` / parity-kill `49123456` を正しく判定し、重み反転 mutation で red になる。
- AC2: `ProductForm.test.tsx` が non-composition onChange/paste と compositionend の全角数字列を ASCII 化し、mixed/composition 中を不変と証明する。
- AC3: `product-form-request.test.ts` が trim + 全角正規化後の wire 値、JAN-8/JAN-13 受理、長さ/非ASCIIと check digit の exact literal、blank rule 不変を証明する。
- AC4: `ProductForm.test.tsx` が fullwidth/spaced EAN-13 を PLU true、JAN-8 を false とし manual override を維持する。
- AC5: `ProductAddSuggest.test.tsx` の D12 test が non-composition paste で親 `onChange` と controller input の同一正規化値を assertion し、S1〜S27 と 5 画面 test は green / diff 0。
- AC6: BIZ unit/service tests が normalized wire の valid 8/13 を受理し、fullwidth/spaced/length/non-digit/checkdigit を再正規化せず exact literal で拒否する。
- AC7: fixture sweep が replacement table と一致し、import 4 occurrence・許可外 frontend 2 occurrence・frozen test群・`io/plu_formatter.rs`・`db/product_repo.rs` に diff がない。
- AC8: `cd src-tauri && cargo run --bin generate_traceability -- --check`、`cargo test --test design_compliance_test`、`bash scripts/doc-consistency-check.sh`、`bash scripts/check-env-safety.sh` が exit 0。
- AC9: `npm run test`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`、`cargo fmt --check`、`cargo test`、`cargo clippy -- -D warnings`、repo L1 full が green。
- AC10: owner native L3 が Packet の checklist を全項目 PASS し、Writer の事前 `cargo check --release` が green。
- AC11: independent Final Reviewer が frozen boundary、golden parity、UI->BIZ ownership、mutation evidenceを監査し P1/P2=0。hosted final は exact HEAD 三点一致で success。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-101 / REQ-102 / REQ-402; `docs/function-design/51-ui-product-form.md` §7.5〜§7.6 UI-01b-D16/D17/D18; `docs/function-design/30-biz-product-service.md` §4.2 BIZ-01-D1/D2; `docs/design-system/02-component-catalog.md` ⑮ SPEC-SUGGEST-D12; `docs/db-design/master-tables.md` products/departments
- Architecture: `docs/ARCHITECTURE.md` POS Adapter Boundary; D-023 adapter/core replacement boundary
- Function / command / DTO: `docs/function-design/30-biz-product-service.md`; `docs/function-design/51-ui-product-form.md`; command/DTO unchanged
- DB: `docs/db-design/master-tables.md`; schema/transaction unchanged
- Screen / UI: `docs/SCREEN_DESIGN.md` 商品登録・修正画面; `docs/UI_TECH_STACK.md` §6.4; `docs/design-system/02-component-catalog.md` ⑮
- Decision log / ADR: `docs/decision-log.md` D-023; archived design Packet / Matrix は implementation fixture・test freeze の引継ぎ証跡

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend validation / error | 30-biz §4.2 BIZ-01-D1/D2 | existing sufficient |
| Command / DTO / binding / wire shape | existing create request contract | existing sufficient; shape unchanged |
| DB / transaction / audit / rollback | master-tables products | existing sufficient; no behavior change |
| Screen / Japanese wording | 51 §7.6 D16-D18, SCREEN_DESIGN, UI_TECH_STACK §6.4 | existing sufficient |
| shared suggest input | component catalog ⑮ D12 | existing sufficient |
| adapter boundary | ARCHITECTURE POS Adapter Boundary / D-023 | existing sufficient; diff-zero boundary |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| REQ token 付き frontend / Rust test | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成後 `--check` |
| BIZ module | `src-tauri/src/biz/mod.rs` に module 登録し、main create validation path から到達する test を置く |

Tauri command、function-design doc、route、operator 画面は新設しない。bindings / route generation output は L1 full と diff review で不変を確認する。

## Design Intent Trace

| Spec / requirement ID | Source section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-101 | 51 §7.5 | UI-01b-D16 | IME composition を壊さず whole-digits だけ写像; NFKC/mixed correction は不採用 | ProductForm JAN handlers | ProductForm input/composition tests |
| REQ-101 | 51 §7.6 | UI-01b-D17 | UI UX と BIZ invariant の二重防御 | jan-code.ts, request builder, BIZ validator, validate_create_request | frontend/BIZ golden + error tests |
| REQ-402 | 51 §7.6 / 30-biz §4.2 | UI-01b-D18 / BIZ-01-D2 | frontend candidate は trim+normalize、BIZ は normalized wire domain | jan-code.ts suggestion / should_default_plu_target | paired semantic case tables |
| REQ-101/402 | catalog ⑮ | SPEC-SUGGEST-D12 | parent と controller の split-brain 防止 | ProductAddSuggest onChange | D12 dual-notification test |
| REQ-101 | master-tables | JAN-8/13 constraint | ISBN-10 特例を追加しない owner 裁定 | create validation only | length boundary tests |
| REQ-101/402 | ARCHITECTURE / D-023 | adapter/core separation | POS EAN-13 と business JAN-8/13 は所有・受理集合が異なる | biz JAN module; adapter diff zero | separate golden tests + diff guard |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。D16-D18、BIZ D1/D2、D12、master-table contract が durable SSOT。
- Plan-only durable decisions found and promoted: none。fixture mapping / test names / work ordering は implementation evidence。
- Assumptions and constraints: frontend helper は既存 composition utilityを再利用する。BIZ wire 値は frontend 正規化後だが BIZ 自身も独立に invalid 値を拒否する。
- Deferred design gaps: ISBN-10 / 部門17 escape hatch は Plans backlog。scanner configuration変更は非目的。
- Matrix trace: all rows cite D-ID / source section and concrete target。
- Absolute guarantee check: diff-zero は tracked content boundaryに限定し、generated traceability と plan artifactsは明示例外。import behavior は既存 test green + relevant files diff-zeroで互換を確認する。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | core accepts 8/13、POS adapter accepts EAN-13 only; sharing forbidden | Ledger + frozen diff check |
| Fact / design split | golden parityとfixture invalidityは実測、受理契約は source design | Matrix mutation rows |
| Lifecycle / retry | ProductForm local state/save retry、ProductAddSuggest debounce lifecycleは既存維持 | State Lifecycle Matrix |
| Operator workflow | IME/paste/scanner/save reject-allow changes visible | Human Gate checklist |
| Replacement path | invalid create fixtures only synthetic validへ連動置換 | Fixture Sweep table |
| Data safety / evidence | real store JAN / product / scanner screenshotsをcommitしない | Data Safety |
| Reporting semantics | not applicable; report/export format unchanged | none |
| Manual verification | Windows WebView2 + native IME/HID scanner cannot be fully proven in jsdom | L3 |
| 環境・再現性 | new dependency/toolchainなし; pinned repo commands使用 | L1 / hosted CI |

## Design Readiness

- Existing design docs are sufficient because: design-first PR #67 が 51 / 30-biz / catalog / UI_TECH_STACK / master-tables を更新し、golden / frozen obligations を archived Packet に固定した。
- Source docs updated in this PR: none planned。behavior drift が見つかった場合は implementation を止め gated Amendment または source design changeへ戻す。
- Design gaps intentionally deferred: ISBN-10 / barcode-less department 17 route。
- Durable decisions discovered here: none。
- Layer ownership: UI normalizes UX; BIZ independently enforces business validity; IO adapter unchanged。
- Backend function design: BIZ-01-D1/D2 sufficient。
- Command / DTO: unchanged。
- Persistence / transaction / audit: unchanged; validation occurs before write。
- Operator workflow / wording: D16-D18 exact。
- Error / retry / recovery: invalid save stays on form with exact message; correction and resubmit is recovery。
- Testability / traceability: REQ-101/402 named tests + generated 90 traceability。

## Contract Probe

- N/A: no unverified external library, new OS API, device protocol, schema, command, route, or generated binding premise。Native IME/HID behavior is an explicit Human L3 acceptance item rather than an implementation premise asserted from a local probe。

## Contract Coverage Ledger

| Contract / decision | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-01b-D16 whole-digits mapping / mixed & composing unchanged | ProductForm JAN handlers | ProductForm D16 tests | IME ON/OFF + paste + scanner |
| UI-01b-D17 trim-normalize-validate-save / exact errors | jan-code.ts + request builder | jan-code / request tests | valid/reject UI messages |
| UI-01b-D18 suggestion after trim+normalize | jan-code.ts + ProductForm | ProductForm REQ-402 table | PLU checkbox observation |
| BIZ-01-D1 normalized wire validation / no renormalization | BIZ JAN core + step 1g | core + service negative tests | none |
| BIZ-01-D2 ASCII13 default only | should_default_plu_target | BIZ semantic case table | none |
| SPEC-SUGGEST-D12 dual same-value notification | ProductAddSuggest onChange | D12 test | representative product-add field |
| SPEC-SUGGEST-D1-D11 frozen | no lifecycle changes | existing S1-S27 + five screen tests | scanner Enter regression |
| master-tables JAN 8/13 / no ISBN-10 | validators | length boundary tests | JAN-8/13 save boundary |
| D-023 adapter boundary | no adapter edits | existing adapter golden test | non-scope |
| import compatibility | no import validation | frozen import test | non-scope |
| fixture freeze | exact replacements only | rg/diff evidence | non-scope |
| error visibility / recovery | existing form errors | request + page regression | L3 exact wording and retry |
| REQ trace registration | generated 90 traceability | generator `--check` | non-scope |

Adjacent-contract sweep excludes edit-mode JAN read-only behavior, product code auto-generation, supplier/price/stock validation, PLU manual override internals, ProductAddSuggest D1-D11 implementation, and import/DB/POS behavior because Scope cannot intentionally change them; regression tests and diff guards still protect them.

PLU suggestion semantic table（同じ case label を両側へ独立転記）:

| case | frontend candidate / expected | BIZ normalized-wire domain / expected |
|---|---|---|
| null | `null` -> false | `None` -> false |
| ASCII EAN-13 | `4901234567887` -> true | `4901234567887` -> true |
| JAN-8 | `96385074` -> false | `96385074` -> false |
| fullwidth EAN-13 | `４９０１２３４５６７８８７` -> true after normalize | producer result `4901234567887` -> true; raw fullwidth direct input -> false |
| spaced ASCII EAN-13 | ` 4901234567887 ` -> true after trim | producer result `4901234567887` -> true; spaced direct input -> false |
| spaced fullwidth EAN-13 | ` ４９０１２３４５６７８８７ ` -> true after trim+normalize | producer result `4901234567887` -> true; raw direct input -> false |
| alphanumeric | `490123456788A` -> false | same raw wire -> false |
| 12 / 14 digits | `123456789012` / `12345678901234` -> false | same raw wire -> false |

この表は frontend が candidate normalization を所有し、BIZ が再 trim / 再正規化しない domain split を同時に検出する。BIZ の create validation は invalid nonblank wire を `ValidationFailed` の exact literal で拒否する。

## Test Plan

- Matrix: `docs/plans/test-matrices/2026-08-11-jan-field-normalization-implementation.md`
- targeted: new jan-code/BIZ core unit tests, ProductForm, request builder, ProductAddSuggest, product_service。
- negative: wrong length、non-ASCII/mixed、bad check digit、BIZ spaced/fullwidth wire、composition intermediate、split notification。
- compatibility: S1-S27 + `ReceivingPage.suggest.test.tsx` / `ManualSalePage.suggest.test.tsx` / `ReturnExchangePage.suggest.test.tsx` / `DisposalPage.suggest.test.tsx` / `StocktakePage.suggest.test.tsx`、import test、find_by_jan_code tests、adapter tests、blank/prefix rule、manual PLU override。
- data safety: exact fixture rg sweep、synthetic-only values、frozen diff paths。
- main wiring: request wire、create_product service path、ProductForm suggestion、ProductAddSuggest controller search、biz module registration。
- Writer native prerequisite: `cargo check --release` before owner L3 build。

## Boundary / Wire Contract

- producer: ProductForm -> `buildProductFormRequest`
- consumer: create product command -> BIZ `validate_create_request`
- wire type: existing nullable JAN string; DTO/binding unchanged
- internal type: JS/Rust UTF-8 string; frontend normalized ASCII for nonblank accepted JAN
- precision/range: exactly 8 or 13 ASCII digits after frontend trim+normalize; mod10 check digit
- round-trip: UI state -> request builder -> existing invoke -> BIZ validation -> existing repository persistence
- invalid input: frontend exact form error; bypassed frontend is rejected by BIZ with same literal
- compatibility: blank + department `code_prefix` rule unchanged; update/import/adapter paths unchanged

## Review Focus

- EAN-8/EAN-13 parity direction and golden kill cases; reject `4901234567894` as inversion-kill evidence because it survives the faulty profile。
- helper ownership: frontend shared pipeline one place、BIZ separate core、POS adapter diff-zero。
- composition/paste contract and D12 identical dual notification。
- fixture replacement table completeness and frozen-path hunk audit。
- exact Japanese error literals、save value normalization、blank/manual override compatibility。
- traceability generation、main-path wiring、mutation survivor 0、L3 reachability/recovery。

## Spec Contract

Contract ID: SPEC-JAN-NORMALIZATION-IMPL

- UI input mapping is whole-string digit-only and composition-aware; it is not general text normalization。
- accepted nonblank JAN set is valid EAN-8 union valid EAN-13 after frontend trim/fullwidth-digit normalization; BIZ accepts only the already-normalized wire representation of that set。
- frontend PLU suggestion normalizes candidate input; BIZ PLU default evaluates normalized wire. Both independently yield true only for ASCII 13-digit candidates。
- ProductAddSuggest D12 emits one normalized value to both parent state and controller on every non-composition change。
- import / POS adapter / DB lookup / update wire stay compatible and unchanged。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-01b-D16 | W3 | ProductForm D16 tests | IME/mixed/paste | targeted test + L3 |
| UI-01b-D17 | W2/W3/W5 | jan-code/request/BIZ tests | golden/parity/errors | targeted + mutation X5-X8 |
| UI-01b-D18 / BIZ-01-D2 | W2/W3/W5 | paired suggest tables | domain split | frontend + Rust results |
| SPEC-SUGGEST-D12 | W4 | ProductAddSuggest D12 | same-value dual notify | test + mutation X10 |
| D-023 | W5/W6 | existing adapter tests | no sharing/no diff | git diff path guard |
| fixture freeze | W1/W6 | rg sweep | permitted occurrences only | recorded command/output |
| REQ-101/402 trace | W7 | generate_traceability --check | generated SSOT | exit 0 |

## Human Gate / Windows native L3 checklist

前提: Writer の `cargo check --release` green 後、synthetic test DB で実施。実 JAN、実商品名、実価格、店舗 DB、scanner serial/settings screenshot は repo / PR へ添付しない。

| ID | 到達手順 | 操作 | 観測する合格条件 |
|---|---|---|---|
| L3-1 | 商品管理 -> 商品登録、JAN欄へ focus | IME OFF で `4901234567887` を入力 | 値が欠落せず、PLU対象提案が true |
| L3-2 | 同 JAN欄 | IME ON で全角 `４９０１２３４５６７８８７` を composition 確定 | 確定前は入力を壊さず、確定後 `4901234567887`、二重入力なし |
| L3-3 | 同 JAN欄 | fullwidth 13 digits を paste | 即時 ASCII 化し、PLU対象提案 true |
| L3-4 | 同 JAN欄 | mixed `１２A３` を入力/paste | mixed のまま勝手に部分変換しない。保存は長さ文言で拒否 |
| L3-5 | 同 JAN欄 | HID scanner で synthetic valid EAN-13 を IME OFF / ON の現行確定設定で各読取 | 欠落・重複なし、ASCII 値が残る。scanner Enter が既存 UI を壊さない |
| L3-6 | 必須項目を synthetic 値で埋める | `4901234567890` を保存 | check digit literal が通常距離で読め、formに残り訂正可能 |
| L3-7 | L3-6 から訂正 | `4901234567887` で再保存 | 保存成功し、再表示値が normalized JAN |
| L3-8 | 新しい synthetic 商品 | `96385074` または `49123456` を保存 | JAN-8 を受理し PLU対象提案は false |
| L3-9 | 新しい synthetic 商品 | 12桁 `123456789012` と invalid EAN-8 `49123457` を順に保存 | 前者は長さ literal、後者は check digit literal。いずれも訂正して再試行可能 |
| L3-10 | 入庫画面の商品追加欄（同runで作った synthetic JAN商品） | fullwidth JAN paste、候補表示後 Enter/click | 表示入力と検索候補が同じ ASCII 値に対応し、既存追加動作が成立 |
| L3-11 | 商品登録 form 全体 | error / success / checkbox / focus を通常距離で確認 | 日本語文言・必須表示・focusが色だけに依存せず既存レイアウトを維持 |

## Data Safety

- 実店舗 JAN、商品名、価格、在庫、DB、scanner 固有情報、credential を commit / log / PR evidence に含めない。
- local-only: Windows native L3 DB、scanner 設定、実機画面、mutation 一時差分。
- synthetic-only: 本 Packet の `2000000000015`〜`2000000000138`、golden public/synthetic values、L3 synthetic products。
- generated output: `90-traceability.md` は generator のみで更新し、bindings / routes は変更しない。

## Implementation Results

- Codex Writer が W1〜W7 を実装完了。frontend JAN helper、ProductForm / request builder、ProductAddSuggest D12、BIZ JAN core / create validation を配線した。
- fixture replacement は本 Packet の置換対象表どおり実施し、旧 create literal 0 hit、import / POS adapter / DB lookup / 5 画面 test の frozen path diff 0 を再測定した。
- TDD Red を実測後に targeted test を Green 化し、mutation X1〜X11 は全 class で Red を実測して一時差分を全て戻した。
- `generate_traceability` で `90-traceability.md` を再生成し、bindings diff 0、frontend / Rust / docs / env / design / release gates を Green 化した。exact content HEAD と L1 full evidence は Draft PR body に記録する。
- Windows native L3 と independent Final Review は未実施であり、Coordinator / owner の後続 Human Gate として残す。

## Review Response

- Findings Freeze: frozen 2026-08-11（human-confirm 遷移時、P1/P2 = 0 確定後）; post-freeze exceptions: none.
- Plan Review rally round 1（Sonnet 5 independent / fresh context、2026-08-11）: P1 0 / P2 1 / P3 2。
  - P2-1（Draft Provenance に是正内訳の itemized 記録がない）: accept、Workflow State の Draft Provenance へ監査観点と是正 5 点を itemize。
  - P3-1（BIZ validator の新設 file path 未指定で Writer 裁量が残る）: accept、W5 へ `src-tauri/src/biz/jan_code.rs` + `biz/mod.rs` 登録を明記。
  - P3-2（Matrix に None 明示行がない・design archive「None通過」引用）: 前提を refute — 引用された文言は設計正本に存在せず（`rg -n 'None'` 0 hit）、Matrix Negative Paths / Boundary Checks に None 契約は既存。evidence 紐付け欠如のみ accept し、Negative Paths へ「`default_create_request()`（jan_code: None、product_service.rs L955 実読）を使う既存 create test 群の無改変 green 維持」を検証条件として追記。round 2 で独立再検証する。
- Plan Review rally round 2（Sonnet 5 independent / fresh context、2026-08-11、reviewed HEAD 9dbde52）: round 1 裁定 3 件（P2-1 itemize / P3-1 `jan_code.rs` 命名の repo 慣行整合 / P3-2 refute + None 検証条件）を独立再検証で全件 VERIFY、新規指摘 0。fixture sweep 17+4 行・D-ID 6 個・step 1g の空き文字・W3/W4 の実装現況前提（`ProductForm.tsx` `id="jan-code"` 1 箇所 / `onCompositionEnd` 未配線 / `product-form-request.ts` trim のみ / ProductAddSuggest non-composition onChange 未正規化）も現 HEAD 実測と一致。**rally 収束（P1/P2 = 0、新規指摘 0）、owner plan 承認待ちへ遷移。**
- owner plan 承認（2026-08-11、介入 1/3）: rally 収束（P1/P2 = 0、round 2 新規指摘 0）を受けた plan 承認。併せて owner 指示 = repo root の stale `Plans.md`（公開スナップショット初期化残骸、live 正本 = `docs/Plans.md`）の整理を本 change 完了後すぐ着手 → Plans.md backlog へ起票。遷移 `plan-gate -> plan-approved -> implementing` は state-only 遷移 commit（STATECAP ①）で実体化、Plan Commit = `2439c03`（承認対象の packet 状態 = rally 収束記録込み）。
- Writer implementation handoff（Codex、2026-08-11）: W1〜W7、全 automated gate、mutation X1〜X11 の Red / revert、fixture / frozen sweep を完了し Draft PR へ引き渡す。Workflow State / `docs/Plans.md` の遷移は Coordinator 所有のため未変更。
- Final Review（Sonnet 5 independent / fresh context、2026-08-11、reviewed content = 834f5e9）: Contract Coverage Ledger 13/13 適合、P1/P2 = 0、P3×1（compositionend 二重発火は jsdom で exercise 不能 — Matrix Residual Test Gaps 開示済みのため追加対応不要と裁定、L3-2 を実機優先確認へ繰上げ）。frozen 境界 diff 0 + 実行 green、fixture 置換の表準拠、EAN-8/13 重み独立検算一致、エラー文言 frontend/BIZ 完全一致、層境界 drift なしを独立確認。
- Coordinator mutation 独立再実測（2026-08-11、注入形は Matrix 定義から独自設計・Writer 注入形非参照）: X1〜X11 全 class kill を再現（X5/X6/X7 は等価でない変形でも red、X10 は通知順序形も red）。X11 主形（adapter が core を流用）は `pub(super)` 可視性により compile-time で構造遮断（E0603）— Matrix 想定の diff guard より強い防御を確認。注記 1 = X2 の helper 内部 guard 単独撤去形は call-site の同一 guard 重複（defense-in-depth）により素通し（両 guard 同時撤去で red）。helper `normalizeComposedDigits` は本 PR diff 外の PR #65 既存コードで直接 unit oracle を持たない — production 欠陥ではなく mutation adequacy 注記として記録。注記 2 = X7 の index shift は EAN-13 データ桁 12（偶数）で weight swap と代数的等価のため非等価変形が構成不能（EAN-8 データ桁 7 では非等価変形の red を確認済み）。
- 遷移 implementing -> local-verified -> independent-review -> human-confirm を本 state-only commit（STATECAP ②）で一括実体化。evidence = Writer L1 full PASS（PR #68 body）+ Final Review P1/P2 = 0 + Coordinator の mutation / fixture / frozen 独立再検証。
- Windows native L3（owner、2026-08-11、tested HEAD = e066090）: L3-1〜L3-11 全件 PASS（L3-2 の二重入力なし優先確認を含む）。evidence 正本 = PR #68 body。
- owner Ready/merge authorization（2026-08-11、介入 3/3、owner 表明 = 「終結」）: Ready 化・hosted final・squash merge・archive closeout の終結処理を Coordinator へ委任。遷移 human-confirm -> ready-hosted-final を state-only commit（STATECAP ③）で実体化。exact-HEAD L1 / hosted 三点一致の volatile evidence は PR body 所有。
