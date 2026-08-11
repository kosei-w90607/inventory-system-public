# JAN 専用欄正規化 implementation Test Design Matrix

## Risk

Risk: R3

## Contracts Under Test

- UI-01b-D16: JAN専用欄の whole-digits / composition-aware 正規化。
- UI-01b-D17 / BIZ-01-D1: frontend trim-normalize-validate と BIZ normalized-wire validation。
- UI-01b-D18 / BIZ-01-D2: frontend candidate / BIZ wire の PLU target default。
- SPEC-SUGGEST-D12: parent と controller への同一 normalized value 通知。
- D-023 / frozen contract: BIZ core と POS adapter 非共有、import・DB lookup・既存5画面不変。
- fixture contract: create 13 occurrence のみ synthetic validへ連動置換、frontend L20/L36 のみ置換。

## Failure Modes

- EAN-8 と EAN-13 の偶奇 weight を同一実装にして valid JAN を拒否する。
- length/ASCII だけ確認して bad check digit を受理する、または exact literal を崩す。
- frontend が保存時に正規化せず、BIZ が暗黙に trim/全角変換して層契約を隠す。
- composition中/mixed値を加工、pasteだけ未正規化、compositionendで二重通知する。
- suggestion が raw値を評価、または D12 で parent/controller が split-brainになる。
- invalid fixtureを残して無関係なcreate testsが新validationで崩れる。
- import / adapter / DB lookup / screen regression testsを都合よく編集する。

## Test Matrix

| Contract | Failure Mode | Type | Test Name / target | Would fail if... |
|---|---|---|---|---|
| UI-01b-D17 frontend core | EAN-13 parity inversion / no check digit | unit | `REQ-101 validates EAN-13 golden profile and rejects wrong check digit` | `4901234567887`を拒否、`4901234567890`を受理、weight反転 |
| UI-01b-D17 frontend core | EAN-8 copied parity | unit | `REQ-101 validates EAN-8 golden profile with index zero weight three` | `96385074`/`49123456`を拒否、EAN-13 parityを流用 |
| UI-01b-D17 frontend core | bad length/non-digit accepted | unit | `REQ-101 rejects non ASCII and lengths other than eight or thirteen` | regex/length guard欠落 |
| UI-01b-D16 | paste/onChange fullwidth remains | component | `REQ-101 UI-01b-D16 normalizes whole fullwidth digits outside composition` | onCompositionEndだけ対応、paste bypass |
| UI-01b-D16 | mixed or composing gets corrupted | component | `REQ-101 UI-01b-D16 preserves mixed and composing input` | per-character変換、isComposing guard欠落 |
| UI-01b-D16 | composition end not normalized / double state update | component | `REQ-101 UI-01b-D16 normalizes once at compositionend` | commit境界欠落、二重更新 |
| UI-01b-D17 request | trim/normalize order wrong | unit | `REQ-101 saves trimmed normalized JAN wire value` | validationをraw値へ先行、wire raw保存 |
| UI-01b-D17 request | invalid length literal drift | unit | `REQ-101 returns exact JAN length error` | nonASCII/length文言が異なる |
| UI-01b-D17 request | check literal drift | unit | `REQ-101 returns exact JAN check digit error` | bad checkを受理、文言違い |
| UI-01b-D17 request | blank escape regression | regression | existing blank + code_prefix tests | blankをJAN validatorが先に拒否 |
| UI-01b-D18 | fullwidth/spaced 13 stays false | component/unit | `REQ-402 suggests PLU target after JAN candidate normalization` | raw regex評価、trim/normalize欠落 |
| UI-01b-D18 | JAN-8 becomes PLU target | unit | same semantic case table | 8桁をtrueにする |
| UI-01b-D18 | null/fullwidth/spaced/mixed/12/14 case drift | unit | Packet `PLU suggestion semantic table` を独立転記 | trimと全角mapping順、null、境界のいずれかが崩れる |
| manual override | suggestion overwrites operator | regression | existing `REQ-402 suggests PLU target ... preserves manual override` | touched guard退行 |
| SPEC-SUGGEST-D12 | parent only normalized | component | `S28: 非composition全角数字を親とcontrollerへ同一正規化値で通知する` | controllerへraw値 |
| SPEC-SUGGEST-D12 | controller only normalized | component | same S28 | parentへraw値 |
| SPEC-SUGGEST-D1-D11 | debounce/Enter/IME/race regress | regression | existing S1-S27 | D12変更が既存lifecycleを壊す |
| 5 screen freeze | screen wiring regression | regression | `ReceivingPage.suggest` / `ManualSalePage.suggest` / `ReturnExchangePage.suggest` / `DisposalPage.suggest` / `StocktakePage.suggest` suites | common component変更が画面を壊す |
| BIZ-01-D1 core | EAN profiles wrong | Rust unit | `REQ-101 validates EAN-8 and EAN-13 golden profiles` | parity/check digit誤り |
| BIZ-01-D1 service | bypassed UI bad wire accepted | Rust service | `REQ-101 create rejects invalid JAN wire with exact message` | step 1g未配線 |
| BIZ-01-D1 domain | BIZ trims/normalizes wire | Rust service | `REQ-101 create does not normalize fullwidth or spaced JAN wire` | BIZがraw user input UXを肩代わり |
| BIZ-01-D2 | default predicate drift | Rust unit | `REQ-402 defaults PLU target only for normalized ASCII EAN-13 domain` | fullwidth/spaced/JAN8をtrue |
| D-023 | adapter shared/changed | regression/data safety | existing `plu_formatter` golden tests + diff guard | BIZ validatorをadapterへ流用・adapter編集 |
| import freeze | import begins validating JAN | regression | frozen import request test | create validationをimportへ波及 |
| DB lookup freeze | lookup fixture/semantics changed | regression | frozen `test_find_by_jan_code_req103_*` | replacement sweepがDB testへ波及 |
| fixture contract | occurrence missed/overreplaced | CLI/data safety | Packet fixture rg + path diff checks | invalid create fixture残存、frozen値変更 |
| traceability | REQ tests unregistered | generated | `generate_traceability -- --check` | 90-traceability drift |
| main wiring | helper unused/inline duplicate | integration/review | request/ProductForm/service targeted suites + rg review | helper existsするだけ、旧regex残存 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| ProductForm JAN state | raw/blank controlled value | composition中は加工しない | non-compositionまたはcompositionendでwhole-digitsだけASCII | none | none | editはread-only既存値 | persisted valueを再読込 | form errorでstate保持 | correctionしてsave | ProductForm/request tests + L3-1..9 |
| create save | form values | existing saving state | valid 8/13 persisted | existing query behavior | existing | saved product表示 | app restart後もASCII | exact inline error、writeなし | edit and resubmit | request+BIZ tests + L3-6..9 |
| ProductAddSuggest query | controlled input | existing debounce/in-flight | parent/controller同じnormalized query | existing D1-D11 | existing | existing screen state | no persistence | existing close/error behavior | type/paste/Enter再試行 | S1-S28 + 5 screens + L3-10 |
| PLU suggestion | untouched false/default | synchronous evaluation | normalized 13 => true; 8 => false | none | none | manual touched state優先 | form reset | invalid candidate => false | correct JAN | ProductForm REQ-402 test + L3 |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions | Test / evidence |
|---|---|---|---|---|
| `normalizeComposedDigits` / composition | utility + ProductAddSuggest + ProductForm | ProductForm JAN and D12 non-composition path | 5 screens use shared component; no per-screen edits | helper tests, S22-S28, ProductForm tests |
| JAN suggestion | ProductForm local regex + product_service predicate | frontend jan-code helper; BIZ predicate stays independent | POS formatter is adapter-owned | paired tables + diff guard |
| JAN validators | io/plu_formatter EAN13 + new BIZ core | BIZ new core only | adapter not imported/shared | golden profiles + path diff |
| create validation | request builder + validate_create_request | both layers | update/import excluded | request/service tests |
| frozen fixture patterns | product_service create/import + frontend request + DB lookup | only table-listed create/frontend sites | import/update/DB/five screens frozen | rg output + git diff |

## Negative Paths

- missing input: blank retains existing code_prefix rule; `None` does not enter JAN core validation。検証 = `default_create_request()` の `jan_code: None`（product_service.rs L955、2026-08-11 時点）を使う既存 create test 群が step 1g 追加後も無改変 green を維持すること。
- invalid input: 7/9/12/14 digits、ASCII letter/mixed/fullwidth/spaced BIZ wire、bad EAN-8/13 check digit。
- duplicate/ambiguous input: L1204/L1209 pair remains identical; duplicate product semantics unchanged。
- unknown reference: not applicable; department/supplier validation unchanged。
- dependency missing: no dependency added。
- permission/write failure: existing create error path unchanged; validation fails before write。
- dry-run side effect: not applicable。

## Boundary Checks

- threshold: length exactly 8 or 13; 7/9/12/14 reject。
- null/default: blank/None follows existing rule; PLU default false unless normalized ASCII13。
- empty/non-empty: trim-empty vs valid/nonvalid nonempty。
- min/max: all-zero/checkdigit edge may be unit test candidate; mandatory golden values cover parity。
- status/policy enum: not applicable。
- wire type/internal type: nullable string / ASCII digit string after frontend pipeline。
- producer/consumer: request builder / BIZ create validator。
- round-trip token: normalized JAN persisted and reloaded unchanged。
- precision/range: string only; never JS/Rust numeric conversion。
- cross-language parse: same golden profiles independently evaluated, implementation not shared。

## Compatibility Checks

- old schema/input: DB nullable text unchanged; existing valid ASCII JAN works。
- new input: fullwidth-only UI candidate becomes ASCII before wire; bypassed fullwidth BIZ wire rejects。
- output order: not applicable。
- optional field behavior: blank + code_prefix auto product code unchanged; update JAN read-only unchanged。

## Data Safety Checks

- source-derived data: real store JAN/product data forbidden。
- generated outputs: 90-traceability generator only; binding/route diff zero。
- secrets: env safety gate and no captured scanner metadata。
- local-only files: native DB/screenshots/mutation diffs。
- synthetic boundaries: Packet mapping plus public golden values only。

## Main Wiring / Integration Checks

- helper connected: `jan-code.ts` imported by request builder and ProductForm suggestion path; no equivalent inline mod10/regex pipeline。
- output reaches runtime: normalized request reaches existing create invoke; service step 1g calls BIZ core。
- module registration: BIZ module declared in `biz/mod.rs`。
- effective config/CLI/manifest: no change; L1 and hosted CI protect drift。

## Mutation-style Adequacy Questions

- X1: non-composition normalization bypass -> ProductForm paste test and S28 red。
- X2: mixed value partially normalized -> ProductForm mixed test red。
- X3: `isComposing` guard removed -> composition intermediate test red。
- X4: suggest uses raw/no-trim value -> fullwidth/spaced suggestion table red。
- X5: validation checks length only -> invalid checkdigit tests red。
- X6: EAN-8 index0 weight changed 3 -> 1 -> `49123456` red。
- X7: EAN-13 parity inverted -> `4901234567887` red。`4901234567894`はsurvivorなのでkillに使わない。
- X8: BIZ trims/normalizes wire -> fullwidth/spaced BIZ reject test red。
- X9: create validation leaks into import -> frozen import test red。
- X10: D12 sends raw to either parent/controller -> S28 corresponding assertion red。
- X11: adapter/core shared or adapter edited -> import/architecture review + path diff guard red/fail。
- Mock expected値を実装と同じhelperで導出せず、golden literalをoracleにする。
- Lifecycle invalidate/refetch、output order、JSON safe integer、workflow tokenは本change非該当。

## Residual Test Gaps

- jsdom は Windows IME と HID scanner の native event order/character lossを完全再現できないため L3必須。
- BIZ と frontend は仕様上の独立二重実装であり、将来 drift は paired golden/semantic tables と reviewで検出する。
- scanner設定そのものは本changeで変更・保存しない。既存現行設定での観測だけを acceptance とする。
