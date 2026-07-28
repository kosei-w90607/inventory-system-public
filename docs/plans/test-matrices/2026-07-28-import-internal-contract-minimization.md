# Test Design Matrix: import内部contract最小化と日報parse診断接続（順20 / P6-3+P6-4、wave 2 lane 2）

## Risk

Risk: R3

## Contracts Under Test

- C1: `MatchedRow` はcommitに必要な5fieldだけ
- C2: `CommitRequest` は`overwrite_confirmed` + `cached_data`だけ、token lifecycleはCMD内で不変
- C3: 日報lineは格納先から自明なsourceを重複保持しない
- C4: parse errorはsource/line/type/messageの4fieldを保持し、filenameを複製しない
- C5: parse error 4fieldはproduction BIZ diagnostic WARNへ到達
- C6: BizError/operation logはgeneric、detail_json null、import row 0
- C7: unmatched department warningはsource Z005を維持
- C8: REQ-401 traceabilityとgenerator lane境界

## Failure Modes

- F1: dead display/token metadataがcache/requestへ再導入される
- F2: token validation/TTL/remove/retry responsibilityがBIZへ漂流する
- F3: parser metadataを全削除して障害解析不能になる
- F4: raw parse detailがoperator wire/operation logへ漏れる
- F5: diagnostic emissionまたはfieldが欠落し、値を生成するだけのdead contractへ戻る
- F6: line source削除の巻き添えでwarning provenanceを失う
- F7: generated traceabilityが未更新または他laneと競合する

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1/C2 | F1/F2 | static Rust integration | `import_internal_contract_test` | target structへjan/name/tokenが再導入 | X1: `MatchedRow.name`再導入、X2: `CommitRequest.preview_token`再導入でred |
| C1/C2 | F2 | regression | existing CSV commit/rollback/CMD tests | commit totals/stock/rollback/token TTL lifecycleが変化 | existing suites red |
| C3/C4 | F3 | static + unit | internal contract + daily parser inline tests | line source/error filename再導入、または4field削除 | X3: error_type field削除でcompile/test red |
| C5 | F5 | integration | `test_daily_report_req401_parse_error_logs_parse_failed` + `test_tracing::capture` | WARN自体またはsource/line/type/messageのいずれかが欠落 | X4: emission削除、X5: line/type field省略でred |
| C6 | F4 | integration + SQL | 同testのBizError exact generic、operation summary/detail/import count assertions | raw detail混入、detail non-null、partial import | X6: detail_jsonへerrorを入れてred |
| C7 | F6 | integration | unmatched department warning existing/strengthened test | `source_file` がNone/非Z005 | X7: constantをNoneへ変更してred |
| C8 | F7 | generator/docs | traceability generation + docs check | REQ-401 test mapping未反映、90以外のgenerated drift | X8: new testのREQ token除去後generator/check red |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| CSV preview cache | tokenで30分保持 | CMD lookup | commit成功時remove | TTL時remove | — | — | cache消失 | generic import error、cache保持 | 同token再試行可 | CMD/commit tests |
| Daily parse | source bundle | IO parse | preview cache生成 | — | — | — | no persistence | diagnostic WARN + generic error/log、import 0 | file再選択 | strengthened test |
| Daily warning | Z005 row | department lookup | matched/unmatched preview | — | — | preview再作成 | cache消失 | unmatchedはwarning | master是正後再parse | warning test |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| CSV token lifecycle | CMD §17.5 + command implementation + tests | 変更なし、BIZ requestのみ縮小 | wire token/TTL非scope | existing tests + diff |
| MatchedRow consumers | csv service repo-wide | mod/parse/commit/tests | ErrorRow/PreviewDataはwire/DBで現役 | rg + contract test |
| Daily line source | parser生成 + BIZ変換 | source field除去、warningはZ005 constant | source_files metadataは監査用途で現役 | parser/BIZ tests |
| Error boundary | D-053/CmdError/tracing/operation logs | BIZ structured WARN | diagnostic永続化/UI非scope | capture + SQL |

## Negative Paths

- missing input: missing Z002/Z005でsource/type/messageを診断
- invalid input: line-level invalid formatでline/type/messageを診断
- duplicate/ambiguous source: parser tests維持
- unknown reference: unmatched department warning Z005
- dependency missing: not applicable
- permission/write failure: operation log best-effort既存契約
- dry-run side effect: parse failureでdaily_report_imports 0

## Boundary Checks

- threshold: preview TTL 30分不変
- null/default: optional source/lineはdiagnostic上`None`を構造化
- empty/non-empty: parse_errors emptyはpreview、non-emptyはcommit不可
- min/max: line/amount/quantity既存tests
- status/policy enum: duplicate/import status不変
- wire type: command DTO不変
- internal type: exact target struct field集合
- producer/consumer: IO error -> BIZ diagnostic
- round-trip token: frontend -> CMD cache key、BIZ非所有
- precision/range/cross-language parse: 不変

## Compatibility Checks

- old/new schema/input: file format・DB schema不変
- output order: preview/commit output不変
- optional field: source/line diagnostic option、warning source Z005

## Data Safety Checks

- source-derived data: synthetic stringsだけでassert
- generated outputs: 90 only
- secrets/local-only: 0
- raw detail: wire/operation detailへ非露出

## Main Wiring / Integration Checks

- helper connected to main path: `parse_and_validate_daily_report`を直接呼び、production emissionを捕捉
- output reaches report: diagnostic captureとoperation_logsを別々にassert
- effective config/CLI: not applicable
- token reaches implementation: CMD lookupまで、BIZ requestには到達しないことをassert

## Mutation-style Adequacy Questions

- diagnostic emission全削除と各field省略を別mutationでkillできるか
- raw detailをBizErrorまたは`detail_json`へ混入したときexact/generic assertionがredか
- optional source/lineがすべてNoneのfixtureだけで済ませず、line_noがSomeのsynthetic invalid rowを最低1case含むか
- target struct block限定oracleで、別型の`name`/`preview_token`を誤検出しないか
- testがproduction error structから期待値を導出せず、synthetic source/line/type/messageを独立転記するか
- Z005 warningの非空期待があり、Noneへmutateしてredになるか

## Residual Test Gaps

- tracing sinkの本番保存・rotationは既存runtime設定の責務で、本changeはevent生成までを保証する。閲覧UIや永続化はnon-scope。
- static source contract testはRust AST parserではなくtarget struct blockの限定抽出を想定するため、Plan Reviewでfalse-openのないanchor設計を重点確認する。
