# Test Design Matrix — 監査是正 順5: validation ownership / production CMD

Packet:
[2026-07-23-validation-ownership-production-cmd-tests.md](../2026-07-23-validation-ownership-production-cmd-tests.md)

## Risk

Risk: R3

## Contracts Under Test

- ARCH-VAL-D1: 業務validationはBIZ単独所有、CMDはwire変換とBIZ/response/error変換のみ。
- BIZ-01-VAL-D1 / BIZ-06-VAL-D1 / BIZ-07-VAL-D1:
  empty / negative / pagination条件と既存message/field。
- CMD-09-CONV-D1: monthly modeの既存String→SalesMode変換。
- P8-1: 4 CMD moduleの対象testは実production commandを呼ぶ。
- oracleはproduction定数/helperをimportしない独立転記で、
  `kind` / `message` / `field` を完全一致比較する。

## Failure Modes

- F1: CMDとBIZの条件・message・fieldが再び分岐する。
- F2: BIZ guardを削除してもtest内再実装がgreenを維持する。
- F3: page/per_page移設時に `CmdError.field` が `None` へ退行する。
- F4: actual_countの境界が `<0` から `<=0` へ変わり、0が拒否される。
- F5: valid monthly modeのmappingが入れ替わる、またはinvalid modeが通る。
- F6: command testと称してservice/helperだけを直接呼び、main wiringを通らない。
- F7: empty/negative guardがDB/IO side effect後へ移り、別errorが先に返る。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| REQ-104 / BIZ-01-VAL-D1 | F1,F2,F6,F7 | CMD integration regression | `test_preview_import_req104_empty_file_validation` | BIZ empty guard削除、CMD再実装、wire triple drift |
| REQ-904 / BIZ-07-VAL-D1 | F1,F2,F6,F7 | CMD integration regression | `test_fix_integrity_req904_t6_empty_codes_validation` | BIZ empty guard削除またはCMDだけで拒否 |
| REQ-205 / BIZ-06-VAL-D1 count negative | F1,F2,F6,F7 | CMD integration regression | `test_update_count_req205_negative_validation` | BIZ負数guard削除、message drift |
| REQ-205 / zero boundary | F4,F6 | CMD integration boundary | `test_update_count_req205_zero_is_valid` | 比較が `<=0` へ強化、command wiringが壊れる |
| REQ-205 / page field | F1,F2,F3,F6 | CMD integration regression | `test_get_stocktake_items_req205_page_zero_validation` | BIZ page guard削除、field/message drift |
| REQ-205 / per_page field | F1,F2,F3,F6 | CMD integration regression | `test_get_stocktake_items_req205_per_page_zero_validation` | BIZ per_page guard削除、field/message drift |
| REQ-502 / invalid mode | F2,F5,F6 | CMD integration regression | `test_monthly_sales_req502_invalid_mode` | invalid modeがvariantへfallback、field/message drift |
| REQ-502 / valid modes | F5,F6 | CMD integration boundary | `test_monthly_sales_req502_valid_modes` | by_product/by_department mappingが反転 |
| field付きBizError mapping | F3 | unit regression | `cmd::tests` mapping test追加または既存拡張 | `ValidationFailedAt` がfieldを落とす |
| architecture/docs | F1 | design / CLI | design compliance + doc consistency | CMD重複容認文言やBIZ契約がdrift |

既存test実在は現HEADで `rg` 確認済み。実装ではtest名を維持し、bodyだけを
production command呼出しへ置換する。integrity testは既に実command呼出し済み。

## 置換前後の網羅対応

| 置換前 | 問題 | 置換後 |
|---|---|---|
| product empty testの `if empty.is_empty()` | production未到達 | mock AppState→`preview_import`→exact triple |
| integrity empty test | 既にproduction到達 | 同testを維持しexact message/fieldへ強化 |
| stocktake negative testの `if count < 0` | production未到達 | valid item fixture→`update_count(-1)`→exact triple |
| stocktake zero testの `if count < 0` | production未到達 | valid item fixture→`update_count(0)`→success response |
| stocktake page testの `if page < 1` | production未到達 | valid stocktake fixture→`get_stocktake_items(page=0)`→exact triple |
| stocktake per_page testの `if per_page < 1` | production未到達 | valid stocktake fixture→`get_stocktake_items(per_page=0)`→exact triple |
| sales invalid testのlocal `match` | production未到達 | mock AppState→`get_monthly_sales(invalid)`→exact triple |
| sales valid testのlocal `match` | production未到達 | mock AppState→実command2 mode→response.mode |

## Mutation 感度実測

実装commit後、`git status --short`が空のbaselineから各mutationを開始する。
mutantをcommitしない。各red確認後は対象fileだけを
`git restore --source=HEAD -- <exact-path>` で復元し、対応testのgreenとclean treeを
確認してから次へ進む。

| ID | Production mutation | 期待するred |
|---|---|---|
| X1 product | `product_service::preview_import` のempty guardを削除 | product empty CMD test |
| X2 integrity | `integrity_service::fix_integrity` のempty guardを削除 | integrity empty CMD test |
| X3a stocktake | BIZ page guardを削除 | page=0 CMD test |
| X3b stocktake | BIZ per_page guardを削除 | per_page=0 CMD test |
| X3c stocktake | BIZ actual_count guardを削除 | negative CMD test |
| X3d stocktake | BIZ actual_count比較を `<0`→`<=0` | zero valid CMD test |
| X4a sales | invalid mode fallbackを有効variantへ変える | invalid mode CMD test |
| X4b sales | valid mode2種のmappingを入れ替える | valid mode CMD test |

module単位の最低要件はX1/X2/X3/X4。stocktakeとsalesは複数分岐を持つため、
全分岐を個別に実測する。

## State Lifecycle Matrix

not applicable。永続state、cache、route、retry lifecycleは変更せず、各commandは
validation成功時だけ既存read/write pathへ進む。side effect前拒否はF7で検査する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `tauri::test::mock_builder` + managed AppState | stocktake CMD実command tests、integrity CMD test | product / stocktake / sales対象test | settings等はP8-1外 | 4module test |
| BizError→CmdError mapping | `cmd/mod.rs` 全variant | `ValidationFailedAt` 追加 | 順8 error表示は非変更 | mapping test + exact oracle |
| CMD validation sweep | 全 `src-tauri/src/cmd/*.rs` のvalidation construction | P2-2/P8-1対象4module | csv/daily-report/settings/pluは別contract | packet Scope / grep evidence |

## Negative Paths

- missing input: empty file / empty product_codes
- invalid input: negative count / zero page / zero per_page / invalid mode
- duplicate/ambiguous input: not applicable
- unknown reference: valid fixtureを使い、NotFoundがvalidation mutationを隠さない
- dependency missing: not applicable
- permission/write failure: not applicable
- dry-run side effect: invalid入力ではDB変更なし。valid zeroだけfixture row更新を確認

## Boundary Checks

- threshold: actual_count `-1` / `0`; page/per_page `0` / valid counterpart
- null/default: `CmdError.field` None / Someの双方
- empty/non-empty: bytes / product_codes
- min/max: negativeは代表値と `i64::MIN` を必要に応じてtable-driven検査
- status/policy enum: valid 2 mode / invalid mode
- wire type: command signatures不変
- internal type: `ValidationFailed` / `ValidationFailedAt`
- producer/consumer: BIZ→CMD mapping
- round-trip token: mode string→SalesMode
- precision/range: i64/u32境界
- cross-language parse: bindings変更なし

## Compatibility Checks

- old schema/input: schema変更なし
- new schema/input: 入力shape変更なし
- output order: not applicable
- optional field behavior: exact `None` / `Some("page"|"per_page"|"mode")`
- per_page上限: D-031 200 clampを維持し、下限移設だけを行う

## Data Safety Checks

- source-derived data: 使用禁止
- generated outputs: bindings差分0
- secrets: 読取・出力禁止
- local-only files: target / `.local` は非commit
- synthetic sample boundaries: tempfile DBと既存seed helperのみ

## Main Wiring / Integration Checks

- helper connected to main path: 各testが公開production command関数を直接呼ぶ
- output reaches manifest/report: not applicable
- effective config reaches runtime: not applicable
- CLI arg reaches implementation: command argsがBIZ guard / mode conversionへ到達

## Mutation-style Adequacy Questions

- key branch削除で何が落ちるか: X1/X2/X3a-c/X4a
- threshold反転で何が落ちるか: X3d
- mapping反転で何が落ちるか: X4b
- output field省略で何が落ちるか: exact triple assertions
- mock accidental constantをどう防ぐか: expected tripleはsource docsから独立転記し、
  production constant/helperをimportしない
- test内再実装をどう防ぐか: body reviewでproduction command callを必須にし、
  X1〜X4のreal mutation redを証拠化

## Residual Test Gaps

- Tauri IPC serde harness全体は直接起動しない。Rust command関数とmanaged Stateまでを
  実行し、signature/bindings不変をgenerated driftで確認する。
- P8-1外のsales export response / DB lock reconstruction testsは残る。今回のfindingの
  validation evidenceではなく、scope拡張を避けて別途扱う。
