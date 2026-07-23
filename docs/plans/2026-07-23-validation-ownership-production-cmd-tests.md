# Plan Packet — 監査是正 順5: 業務 validation 所有層一本化 + production CMD test

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: e9757f8
- Amendments: 082379c
- Coordinator: Sol（本 thread、scope 精査・design・packet・実装・PR）
- Writer: Sol（owner Plan承認済み、実装中）
- Plan Reviewer: owner が起動した Sonnet 5 fresh context（P1 = 0 / P2 = 1 → gated amendment反映で残P1/P2 = 0、承認）
- Final Reviewer: owner が起動する Sonnet 5 fresh context（production CMD / BIZ 契約監査、pending）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner Ready / merge（Plan承認済み、介入1/3）

- State Narrative（append-only、2026-07-23）: 本state-only commitで隣接forward遷移
  `plan-gate -> plan-approved -> implementing` をmaterializeする。evidence:
  `plan-gate -> plan-approved` = Sonnet 5 fresh contextの一次review
  P1 = 0 / P2 = 1に対し、P2をgated amendment `082379c` で反映した時点をownerが
  Plan承認と明示し、残P1/P2 = 0。`Plan Commit` = plan-first commit `e9757f8` であり、
  実装commitはまだ存在せず全実装commitへの先行性が成立する。
  `plan-approved -> implementing` = 同じowner指示がSolの実装着手を明示承認。

## Owner Effort Budget

- 介入回数上限: 3（Plan 承認 / Ready / merge）
- 実働時間上限: 30分
- relay 往復上限: 2

検証・mutation・review round の計算資源は本発注どおり制限しない。一方、owner
介入は `docs/DEV_WORKFLOW.md` の既定上限内に保つ。

## Risk

Risk: R3

Reason:
Tauri command の wire error (`kind` / `message` / `field`) を保持したまま、
商品・棚卸し・整合性の stable BIZ validation contract と CMD→BIZ 境界を変更する。
CMD signature、generated bindings、DB schema、operator workflow は変更しないが、
`docs/project-profile.md` が R3 例として挙げる stocktake / integrity / product BIZ
service と Tauri command error mapping に触れるため R3。destructive data lifecycle は
なく R4 ではない。

## Goal

Goal Invariant:

### 最小完了条件

- P2-2 の商品・棚卸し・整合性にある業務 validation をBIZだけが所有し、CMDは
  wire変換・BIZ呼出し・response/error変換だけを行う。
- P8-1 の4 CMD moduleにある対象 validation testを、test内分岐ではなく実
  production command呼出しへ置換する。期待値は production 定数/helperから
  導出せず、`kind` / `message` / `field` の独立転記 oracle と完全一致比較する。
- 実装をcommitした clean baselineから、対象moduleごとにproduction分岐を
  削除・改変し、対応testがredになることを実測して復元後のclean treeを確認する。

### 失敗定義

- CMDとBIZに同じ業務条件が残る、またはBIZを直接呼ぶ経路とCMD経路で
  error contractが分かれる。
- 旧testのgreen、helper単体test、test内再実装のgreenを完了証拠にする。
- wire上の既存 `kind` / `message` / `field`、validation条件、閾値を意図せず変える。
- mutationを未commit是正上で行う、またはmutantがgreenのまま生存する。

### 非目的

- 監査順8の利用者向けerror表示・診断相関・PLU error語彙の再設計
  （P3-4 / P7b-3）。
- 監査順14の `SalesMode` generated enum化、CMD signature / bindings変更。
- CMD-11 settings/backup/image service境界（監査順12）や、P8-1外のCMD validation
  の横断移設。
- validation条件の強化・緩和、message体系の刷新、frontend表示変更。

## Scope

### 現 HEAD 再精査

基準 HEAD: `a0668c5`。

| Module / command | 現条件と所有 | 現 wire oracle | P8-1 test状態 | 是正 |
|---|---|---|---|---|
| `product_cmd::preview_import` | CMDだけが `file_bytes.is_empty()` (`product_cmd.rs:122`)。BIZ `preview_import` (`product_service.rs:596`) には空guardなし | `validation` / `ファイルが空です` / `None` | `product_cmd.rs:162` はtest内 `is_empty()` 再実装 | 同条件をBIZ-01先頭へ移し、CMD guard削除、実command test化 |
| `integrity_cmd::fix_integrity` | CMD (`integrity_cmd.rs:35`) とBIZ (`integrity_service.rs:134`) に空 `product_codes` guard重複 | `validation` / `補正対象の商品が指定されていません` / `None` | 監査時 `:58` から現 `:70` へdrift。PR #20で既に実command呼出し化済み | CMD guardだけ削除。現実command testを保持・完全一致化 |
| `stocktake_cmd::update_count` | CMD (`stocktake_cmd.rs:153`) とBIZ (`stocktake_service.rs:178`) に負数guard重複。CMDと設計は「カウント数」、BIZ実装だけ「カウント値」 | `validation` / `カウント数は0以上で入力してください` / `None` | `:214` 負数、`:235` zeroがtest内比較再実装 | BIZ messageを設計・現wireの「カウント数」へ同期、CMD guard削除、実command test化 |
| `stocktake_cmd::get_stocktake_items` | CMDだけが page/per_page下限guard (`:72`, `:79`)。BIZ wrapper (`stocktake_service.rs:95`) は未検証 | page: `validation` / `ページ番号は1以上で指定してください` / `Some("page")`; per_pageも同型 | `:252`, `:271` がtest内比較再実装 | BIZ-06へ下限guard移設。field付きBIZ errorでwireを保持し、実command test化 |
| `sales_cmd::get_monthly_sales` | CMDの `String -> SalesMode` 変換 (`sales_cmd.rs:57`)。BIZは変換済enumを受領 | invalid: `validation` / `不正な集計モードです` / `Some("mode")` | `:127`, `:148` がmatchをtest内再実装 | 業務validationではないためCMD変換を維持。実commandでinvalid/valid双方を検査 |

監査証拠からの主なdriftは integrity testの実command化。product / stocktake /
salesのP8-1再実装testと、P2-2のproduction重複は現存する。

### Production / test / docs

- `src-tauri/src/biz/mod.rs`: field付きBIZ validation variantを追加し、
  `CmdError.field` を維持できる内部contractにする。
- `src-tauri/src/cmd/mod.rs`: field付きvariantを `kind="validation"` へ変換する。
- `src-tauri/src/biz/product_service.rs`: 空file guardを追加。
- `src-tauri/src/biz/stocktake_service.rs`: page/per_page下限guardを追加し、
  actual_count message driftを是正。
- `src-tauri/src/cmd/product_cmd.rs` / `integrity_cmd.rs` /
  `stocktake_cmd.rs`: 業務validation guardを削除してBIZ呼出しへ一本化。
- `src-tauri/src/cmd/sales_cmd.rs`: production mode変換は維持し、testだけ実command化。
- 4 CMD moduleの対象testを実production command呼出しへ置換する。
- source docsは本plan-first changeで `ARCH-VAL-D1` / `BIZ-01-VAL-D1` /
  `BIZ-06-VAL-D1` / `BIZ-07-VAL-D1` / `CMD-09-CONV-D1` を固定する。

## Non-scope

- `csv_import_cmd.rs`、`daily_report_import_cmd.rs`、`settings_cmd.rs`、
  `plu_export_cmd.rs` にある別contractのCMD validation。repository-wide sweepで
  存在を確認したが、P2-2/P8-1の4module evidenceに含まれず、他の監査是正単位を
  混ぜないため除外する。特に `41-cmd-pos.md` のfile size早期拒否は
  resource-safety guardとしてsource designが明示しており、ARCH-VAL-D1の
  業務validation単一所有とは区別して保全する。
- `SalesReportType` serde test、sales export response reconstruction test、
  DB lock reconstruction testの刷新。P8-1 cited evidenceはmonthly mode testであり、
  追加のtest-quality是正は別findingなしに拡張しない。
- frontend、bindings、DB、migration、CSV format。

## Acceptance Criteria

- `product_cmd.rs` / `integrity_cmd.rs` / `stocktake_cmd.rs` の対象業務条件に
  直接 `CmdError { kind: "validation", ... }` を返すproduction guardが残らない。
- `product_service::preview_import`、`integrity_service::fix_integrity`、
  `stocktake_service::{get_stocktake_items,update_count}` が表の条件を所有する。
- field付きBIZ validationが `CmdError` の
  `("validation", exact message, Some(exact field))` へ変換される。
- 置換対象test（`test_preview_import_req104_empty_file_validation` ほかMatrix記載）
  はすべてproduction commandを呼び、hard-coded oracleで `kind` / `message` /
  `field` を完全一致比較する。zero/valid modeは実commandのsuccess responseを検査する。
- 対象4 CMD moduleのtest本体が `biz::*_service` 由来の文字列定数・helperを
  `use` / importしていないことを `rg` で確認し、コマンドと結果0件をPR evidenceに含める。
- test名またはtest commentに既存REQ IDを維持し、削除・skip・ignoreしない。
- `cargo test <matrix test name>` を使い、clean committed baselineからTest Matrix
  X1〜X4のmutantを注入してred、復元後に同commandがgreen、
  `git status --short`がcleanになる。
- `cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、
  `cargo test`、`cargo test --test design_compliance_test`、
  `cargo run --bin generate_traceability -- --check`、
  `bash scripts/doc-consistency-check.sh`、`bash scripts/local-ci.sh full` がpassする。
- generated command signatureを変えないため `src/lib/bindings.ts` diffは0。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-104 / REQ-205 / REQ-501 /
  REQ-502 / REQ-904
- Architecture: `docs/ARCHITECTURE.md` `CMD層の責務ルール`
- Function / command / DTO:
  `docs/function-design/30-biz-product-service.md` §4.8,
  `35-biz-stocktake-service.md` §20.3.1 / §20.4,
  `36-biz-integrity-check.md` §21.4,
  `40-cmd-product.md` §5.3,
  `42-cmd-sales-stocktake.md` §22.2 / §22.4〜§22.7
- DB: schema / transaction変更なし
- Screen / UI: operator表示変更なし
- Decision log / ADR: 新規なし。既存architecture contractの矛盾是正であり、
  新しいcross-cutting方針は導入しない

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend validation / error | 30 / 35 / 36 function-design | 本plan-first changeで更新 |
| Command / wire error mapping | ARCHITECTURE / 40 / 42 function-design | 本plan-first changeで更新 |
| DB / transaction | 該当なし | validationはDB access前、schema/TX変更なし |
| Screen / UI | 該当なし | wire exact-preservation、表示変更なし |
| CSV format | 該当なし | empty input guardのみ、format contract不変 |
| Durable decision / ADR | ARCH-VAL-D1 | ARCHITECTUREへ昇格済み、ADR追加不要 |

## Registration / Generation Obligations

新規command、DTO、doc、REQ、routeは追加しない。command signatureも変えないため
登録・bindings再生成義務はない。最終gateでbindings diff 0とtraceability checkを確認する。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-104 | 30 §4.8 / 42 §22.6 | BIZ-01-VAL-D1 | CMD-only guardはBIZ直接利用と乖離するため不採用 | product service / command | product production CMD test |
| REQ-205 | 35 §20.3.1 / §20.4 / 42 §22.5 | BIZ-06-VAL-D1 | CMD+BIZ重複とfield消失の双方を避ける | BizError / stocktake service / command | stocktake production CMD tests |
| REQ-904 | 36 §21.4 / 42 §22.7 | BIZ-07-VAL-D1 | 既存BIZ guardを正本としCMD重複を除く | integrity command | existing production CMD test |
| REQ-502 | 34 §19.4 / 42 §22.4 | CMD-09-CONV-D1 | enum化は順14へ保全し、現wire変換を維持 | sales command | invalid/valid production CMD tests |
| CMD error contract | 40 §5.3 | ARCH-VAL-D1 | BIZ ownershipとfield互換を両立 | biz/mod + cmd/mod | exact triple oracle |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes
- Plan-only durable decisions found and promoted: ARCH-VAL-D1と各local decisionをsource docsへ反映
- Assumptions and constraints: command signatures / wire triples / validation条件は不変
- Deferred design gaps: SalesMode enum化は監査順14、error表示再設計は順8
- Test Design Matrix can cite source sections: yes
- Absolute guarantee / escape hatch self-check: CMD validation sweepを行い、対象4moduleと
  explicit non-scopeを分離。SalesMode変換だけがCMDに残る理由をsource doc化

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable。POS adapter format変更なし | none |
| Fact check / design decision split | audit lineは現HEADで再確認しdrift表へ分離 | 本packet |
| Lifecycle / retry | state lifecycle変更なし | MatrixでN/A |
| Operator workflow | wire triple不変、画面変更なし | L3不要 |
| Replacement path | CMD/BIZ責務だけを変更 | ARCH-VAL-D1 |
| Data safety / evidence | synthetic temp DBのみ。実店舗data禁止 | Data Safety |
| Reporting / accounting semantics | sales集計意味論不変 | non-scope |
| Manual verification | 全contractを自動test/mutationで証明可能 | L3不要 |

## Design Readiness

- Existing design docs are sufficient because: validation条件・現wire期待値自体は既存docsと
  production CMDで確定している
- Source docs updated in this PR: ARCHITECTURE、30、35、36、40、42
- Design gaps intentionally deferred: 順8 error表示、順14 enum化
- Durable decisions discovered: ARCH-VAL-D1として昇格済み

Minimum design checks:

- Layer ownership: business validation=BIZ、wire conversion=CMD
- Backend function design: exact condition/message/fieldを各service節へ記載
- Command / DTO / data contract: signature不変、wire triple不変
- Persistence / transaction / audit impact: none
- Operator workflow / Japanese UI wording:既存文言完全一致
- Error, empty, retry, recovery: empty/negative/page/modeの境界をMatrix化
- Testability and traceability:既存REQ ID + production CMD実呼出し + mutation

## Contract Probe

N/A。外部library / OS / hardware premise、登録・生成gap、実機依存はない。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| ARCH-VAL-D1 | targeted CMD guards削除 + BIZ guards | repository sweep + 4 module tests | L3不要 |
| BIZ-01-VAL-D1 | product_service::preview_import | product CMD empty test / X1 | format変更はnon-scope |
| BIZ-06-VAL-D1 page | stocktake_service::get_stocktake_items | page exact oracle / X3a | upper clamp非変更 |
| BIZ-06-VAL-D1 per_page | same | per_page exact oracle / X3b | upper clamp非変更 |
| BIZ-06-VAL-D1 count | stocktake_service::update_count | negative + zero CMD tests / X3c/X3d | count条件非変更 |
| BIZ-07-VAL-D1 | integrity_service::fix_integrity | existing CMD empty test / X2 | integrity意味論非変更 |
| CMD-09-CONV-D1 | sales_cmd::get_monthly_sales | invalid + valid mode CMD tests / X4 | enum化は順14 |
| CmdError wire triple | BizError + From mapping | exact oracle assertions | error表示再設計は順8 |
| P8-1 anti-tautology | 4 CMD module test bodies | production function call review + X1〜X4 | helper-only test不可 |

Adjacent-contract sweep対象は上記source sectionsのvalidation / conversion /
error mapping / pagination clamp、および41-cmdのresource-safety例外。stocktake completion、sales aggregation、
integrity fix transaction、product CSV row validationはこのchangeで実行されずnon-scope。

## Test Plan

Test Design Matrix:
[2026-07-23-validation-ownership-production-cmd-tests.md](test-matrices/2026-07-23-validation-ownership-production-cmd-tests.md)

- targeted tests: 4 CMD moduleの置換対象
- negative tests: empty / negative / page=0 / per_page=0 / invalid mode
- compatibility checks: zero / valid modes / exact wire triple / per_page上限非変更
- data safety checks: `tempfile` + synthetic DBだけ
- main wiring/integration checks: `tauri::test::mock_builder` から実commandを呼ぶ

## Boundary / Wire Contract

- producer: product / stocktake / integrity BIZ service、sales CMD conversion
- consumer: Tauri CMD caller / generated frontend command
- wire type: command signatures不変、`CmdError { kind, message, field }`
- internal type: `BizError::ValidationFailed` +
  `ValidationFailedAt { message, field }`
- precision/range: empty Vec/bytes、i64 `<0`/`0`、u32 `0`/`1`、mode finite strings
- round-trip path: CMD args → BIZ/enum conversion → CmdError/response
- invalid input: 本packetのexact oracle表
- compatibility: bindings変更なし、既存message/field完全保持

## Review Focus

- CMDから削除したguardと同一条件がBIZ先頭に存在し、DB/IO side effect前に止まるか。
- `ValidationFailedAt` がfieldを落とさず、他のBizError mappingを変えないか。
- production command testがtest内分岐やservice直呼びへ逃げていないか。
- hard-coded oracleがproduction constant/helperをimportしていないか。
- X1〜X4が本当にproduction mutantだけを変え、red後にexact fileを復元したか。

## Spec Contract

Contract ID: SPEC-CMD-VALIDATION-OWNERSHIP-01

- 商品・棚卸し・整合性の業務validationはBIZが単独所有する。
- CMDはBIZ errorを既存wire tripleへ変換し、SalesModeのwire変換だけを保持する。
- 対象CMD testsは実production commandと独立oracleの完全一致でcontractを検査する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-104 | BIZ empty guard + CMD削除 | product CMD test | empty guard ownership | X1 red |
| REQ-205 | BIZ page/count guards + CMD削除 | 4 stocktake CMD tests | thresholds + field | X3 red |
| REQ-904 | CMD duplicate削除 | integrity CMD test | BIZ-only path | X2 red |
| REQ-502 | production mode conversion test化 | sales CMD tests | invalid/valid mapping | X4 red |
| ARCH-VAL-D1 | error mapping維持 | exact triple assertions | layer boundary | docs + grep |

## Data Safety

- 実POS CSV、商品、価格、店舗DB、backup、log、receipt、secretを読込・commitしない。
- test DBは `tempfile` と既存synthetic seedだけを使用する。
- mutation evidenceはcommand出力要約とdiffだけをPR bodyへ記録し、
  `.local/` / `target/` はcommitしない。

## Implementation Results

owner Plan 承認前のため未実装。

## Review Response

- 2026-07-23 Plan review一次（Sonnet 5 fresh context）: P1 = 0 / P2 = 1、
  総評「修正後承認」。P2「独立転記oracleの担保が人手Review Focus止まり」を受理し、
  対象4 CMD moduleのtest本体に対する`biz::*_service`由来文字列定数・helperの
  import不在を`rg` 0件でPR evidence化するAcceptance Criteriaをgated amendmentとして追加。
- ownerは上記gated amendment完了をもってPlan承認とし、Workflow Stateの
  `implementing` 遷移とSolによる実装着手を許可（介入1/3）。
- Findings Freeze: not yet frozen; post-freeze exceptions: none
