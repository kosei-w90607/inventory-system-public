# Plan Packet: import内部contract最小化と日報parse診断接続（監査是正 順20 / P6-3+P6-4、wave 2 lane 2）

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・レビュー裁定・main/Registry/train管理）
- Writer: Codex（plan-approved後の別session、`../inventory-worktree-lane2` とlane branchへpin）
- Plan Reviewer: Sonnet 5 fresh context（owner relay、read-only、実装非関与）
- Final Reviewer: Sonnet 5 fresh context（Plan Reviewerとは別context、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready承認（wave batch可）/ merge。視認・L3なし（internal Rust contractと診断境界、operator UI不変）

Narrative（append-only）:

- 2026-07-28 kickoff -> spec-check -> design -> plan-draft: ownerがwave 2と順19+順20を選定（本lane介入1/3）。CoordinatorがCSV cache/commit consumer、日報parser/BIZ consumer、IO/BIZ architecture、D-053 error boundaryを再確認した。
- 2026-07-28 design decision: P6-4の二択をhybridで閉じた。格納先から自明なline `source_file` は削除する一方、source判定前に失敗するunknown fileの識別に必要なerror `filename` を含むparse error 5fieldはdiagnostic WARNへ接続する。利用者向けerrorとoperation logは汎用のまま（IO-07-D1 / BIZ-08-D1）。
- 2026-07-28 plan-draft -> plan-gate: 本packet、Matrix、source docs、Wave Registryをmain上のwave scaffoldingとして実装より先にcommitする。lane branch/worktreeはPlan Gate収束後にこのplan-first lineageから分岐する。
- 2026-07-28 Codex independent preflight（正式Sonnet review前）: P1=0 / P2=4。全件をCoordinatorが再実測してacceptし、REQ正本path、CMD-07 owner、unknown source filenameの診断維持、Rust test関数名 `_req401`、`Some(line_no)` fixture変更許可を是正した。正式Plan Gateは未収束。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 2 / lane選定）、relay 0/2

## Risk

Risk: R3

CSV importの30分cache/BIZ request、日報parser/BIZ error handlingというimport contractを変更する。wire/DB schema/commit semanticsは不変でも、field削除や診断接続漏れが取込み失敗解析・再試行契約へ影響しうるためR3。

Rollbackはlane implementation commitのrevert。DB migrationなし、保存済みrow/JSON互換なし、preview token wireは不変。

## Goal

Goal Invariant: import内部型はproduction consumerが実際に必要なfieldだけを保持し、日報parse errorの5fieldは開発者向け診断へ到達する。一方、利用者向けerror、operation log、CSV commit/rollback、token/TTL/wire、日報preview/commitの業務挙動は変えない。

### 最小完了条件

- `MatchedRow` から未使用 `jan_code` / `name`、`CommitRequest` から未使用 `preview_token` を削除
- 日報summary/payment/department lineから重複 `source_file` を削除し、parse errorの5fieldはdiagnostic consumerへ接続
- 未対応部門warningはline fieldに依存せず `source_file=Z005` を維持
- parse errorの `source_file` / `filename` / `line_no` / `error_type` / `error_message` がdiagnostic WARNへ構造化出力される
- `BizError` と `daily_report_parse_failed` operation logは汎用文言、`detail_json IS NULL`、import row 0を維持
- REQ-401 test追加/変更に伴うtraceability再生成を本laneだけが行う

### 失敗定義

- raw parser detailまたは入力filenameをCmdError/wire/operation log detailへ露出する
- preview token validation/cache lookup/TTL/success remove/retry保持を変更する
- CSV importのquantity/amount/stock/rollback意味論、日報commit/duplicate意味論を変更する
- `source_file` 全削除により未対応部門warningのZ005 provenanceを失う

### 非目的

- wire DTO、generated bindings、DB schema、operator UI、取込みファイルformatの変更
- 日報parserのlayout A/B対応拡張、実店舗fixture追加
- diagnostic logの永続化・閲覧UI追加

## Scope

- CSV BIZ: `src-tauri/src/biz/csv_import_service/{mod.rs,parse.rs}`、commit/rollback testの`CommitRequest` literal機械更新
- CSV CMD: `src-tauri/src/cmd/csv_import_cmd.rs`（BIZ request最小化。CMD token lifecycleは不変）
- Daily IO: `src-tauri/src/io/daily_report_parser.rs`（line source縮小、parse error 5field維持とinline test更新）
- Daily BIZ: `src-tauri/src/biz/daily_report_import_service/{parse.rs,tests.rs}`（structured WARN、generic boundary、Z005 warning）
- add: `src-tauri/tests/import_internal_contract_test.rs`（source contractの再膨張防止、REQ-401）
- source docs: 29 / 32 / 37 / 41、architecture IO/BIZ task specs（IO-07-D1、BIZ-03-D1、BIZ-08-D1）
- generated: `docs/function-design/90-traceability.md`（generator lane専有）
- packet / Matrix（state更新はCoordinatorのみ）

既存test変更の限定例外: `CommitRequest` field削除に必要なstruct literalの機械更新、parser line field削除に必要なassert更新、`test_daily_report_req401_parse_error_logs_parse_failed` の入力をsynthetic malformed rowへ変えて `Some(line_no)` を作るfixture変更と診断/漏えい防止assert強化だけを許可する。test削除、skip、期待緩和は禁止。

## Non-scope

- Tauri command signature、frontend `preview_token`、AppState cache key/TTL
- DB repositories/schema/migration、operation log schema
- bindings/routes
- CSV parser input/output format、ErrorRow/PreviewData wire
- `Plans.md` とlane 1 files（Coordinator管理/別lane）
- 実POS・日報fixture、DB、diagnostic/operation log実出力のcommit

## Acceptance Criteria

- `cargo test test_daily_report_req401_parse_error_logs_parse_failed -- --nocapture` green: synthetic malformed rowでdiagnostic 5field（`Some(line_no)`を含む）、generic BizError、operation type/summary、`detail_json IS NULL`、import 0をassert
- 未対応部門warning testで `source_file=Some(Z005)` green
- `cargo test --test import_internal_contract_test` green: removed fieldsのsource-doc/production再導入を検出
- CSV commit/rollback既存tests green、token lifecycle command tests green
- `cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test --all-targets --all-features` PASS
- `cargo run --bin generate_traceability` 後にgenerated diffが90だけで、REQ-401 mappingが追加testを含む
- `bash scripts/doc-consistency-check.sh` PASS、`bash scripts/local-ci.sh full` CLEAN
- `cargo test` を観測commandとしてMatrix X1〜X8をcommit済みclean treeで注入→red→復元→greenし、Coordinatorが独立再実測する

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-401、`docs/spec/requirements-coverage.md` REQ-401（単一形式前提はsuperseded、現行2-trackのリンク先を正とする）
- Architecture: `docs/architecture/io-task-specs.md` IO-07、`docs/architecture/biz-task-specs.md` BIZ-03/BIZ-08、`docs/ARCHITECTURE.md` operation/diagnostic boundary
- Function / command / DTO: 29 IO-07、32 BIZ-03、37 BIZ-08、41 CMD POS
- DB: operation log schema不変、daily report/csv import tables不変
- Screen / UI: operator UI不変
- Decision log / ADR: D-053（raw技術詳細はdiagnostic、wireは安全な汎用文言）、監査P6-3/P6-4

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend internal request/cache/error | 32 / 37 | updated in plan-first |
| Command / DTO / wire shape | 41 | internal `CommitRequest`だけ更新、wire signature existing sufficient |
| CSV/report format | 29 / architecture IO | format不変、internal metadata boundary更新 |
| DB / transaction / audit | architecture BIZ / 37 | operation log generic/null detailを明記、schema/TX不変 |
| Durable decision | IO-07-D1 / BIZ-03-D1 / BIZ-08-D1 | source docsへ昇格済み |

## Registration / Generation Obligations

- 新規 Rust integration testの関数名を `test_import_internal_contract_req401_is_minimal` のように `_req401_` 付きとし、`cargo run --bin generate_traceability` で `docs/function-design/90-traceability.md` を再生成する（コメントだけのREQ-401はRust test coverageへ計上されない）。
- 本laneをwave 2唯一のgenerator laneとし、lane 1は生成物に触れない。
- 新規command / route / screen / function-design docなし。bindings / routes再生成不要。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401 / P6-3 | 32 §15.2/§15.4、41 §17.5 | BIZ-03-D1 | BIZが読まないdisplay/token fieldをcache/requestに複製しない | CSV mod/parse/CMD | internal contract test + existing commit tests |
| REQ-401 / P6-4 | 29 §29.2/§29.3 | IO-07-D1 | 全詳細削除は診断価値を失う。line側の重複sourceだけを削り、unknown識別を含むerror 5fieldは診断へ接続するhybrid採用 | daily parser | parser + contract tests |
| REQ-401 / D-053 | 37 §37.3 | BIZ-08-D1 | rawをwire/operation logへ出さずdiagnosticだけで消費 | daily BIZ parse | strengthened parse failure test |

## Design Intent Audit

- Source docs answer what/why: 3 decision IDがfield集合、layer owner、露出禁止を定義。
- Plan-only durable decisions: なし。hybrid判断は29/37/architectureへ昇格済み。
- Assumptions: line sourceはtarget vectorから一意、department warningだけはZ005 provenanceをoperator previewに使う。
- Deferred gaps: diagnostic永続化/閲覧UIは別課題。現行tracing captureを使う。
- Escape hatch: parser error messageはsynthetic/local diagnosticに残るがwire/operation logへ出さない。実fixture/log outputをcommitしない。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | IO structured error -> BIZ diagnostic、wire generic | IO-07-D1 / BIZ-08-D1 |
| Fact / decision split | consumer 0はfact、hybrid縮小はdecision | source docs |
| Lifecycle / retry | token/TTL/cache retry不変 | existing CMD tests |
| Operator workflow | error文言・preview不変 | regression |
| Data safety / evidence | raw detailはlocal diagnosticのみ | leakage assertions |
| Reporting semantics | CSV/daily amounts・commit不変 | existing BIZ tests |
| Manual verification | UI/wire不変、L3不要 | automated |

## Design Readiness

- Layer ownership: UI -> CMD token/cache -> BIZ commit、IO parse -> BIZ diagnosticを明示。
- Backend function design: internal type field集合とerror consumerを29/32/37に定義。
- Wire: command arg/response不変、bindings不要。
- Persistence: schema/TX不変。operation log generic/null detailをassert。
- Error/retry: user error generic、diagnostic structured、cache失敗時保持。
- Testability/traceability: REQ-401 behavior + static contract + generated 90。

## Contract Probe

- internal consumer sweep: `MatchedRow`は5field、`CommitRequest`は2fieldだけをBIZで読む -> removed field候補を実証。
- daily provenance sweep: summary/payment sourceは捨てられ、department sourceだけwarningで使用 -> constant Z005へ置換可能。
- tracing probe: `src-tauri/src/test_tracing.rs::capture` がthread-local outputを既存testで取得可能 -> external premiseなし。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| BIZ-03-D1-A MatchedRow最小5field | csv mod/parse | internal contract test + compile | UI display non-scope |
| BIZ-03-D1-B CommitRequest 2field | csv mod/CMD | internal contract + CMD/commit tests | wire token不変 |
| IO-07-D1-A line source重複なし | daily parser/BIZ | internal contract + parser/BIZ tests | format不変 |
| IO-07-D1-B parse error 5field | daily parser | internal contract + parser tests | filenameはdiagnostic専用 |
| BIZ-08-D1-A structured diagnostic | daily BIZ parse | strengthened REQ-401 test | L3なし |
| BIZ-08-D1-B generic wire/operation | daily BIZ parse | error/SQL assertions | raw detail露出禁止 |
| BIZ-08-D1-C unmatched dept Z005 | daily BIZ parse | warning regression | operator wording不変 |
| REQ-401 traceability | generated 90 | generator + docs check | lane 2専有 |

## Test Plan

- Matrix: [test-matrices/2026-07-28-import-internal-contract-minimization.md](test-matrices/2026-07-28-import-internal-contract-minimization.md)
- targeted: strengthened parse failure、warning provenance、internal structure
- negative: diagnostic削除/field欠落/raw leak/Z005欠落/removed field再導入
- compatibility: CSV commit/rollback/token lifecycle、daily preview/commit tests
- data safety: synthetic dataのみ、DB/log artifact未track
- main wiring: production BIZ pathを直接呼び、tracing + DB operation log双方をassert

## Boundary / Wire Contract

- producer: frontend `preview_token` -> CMD cache lookup、IO parser -> BIZ parse result
- consumer: CMD cache lifecycle、BIZ commit、BIZ diagnostic tracing
- wire type: Tauri command args/responses不変
- internal type: BIZ-03-D1 / IO-07-D1の最小field集合
- precision/range: quantity/amount/line_no不変
- round-trip: preview tokenはfrontend->CMDで完結、BIZへ再格納しない
- invalid input: generic ImportError + generic operation log + structured local WARN
- compatibility: DB schema/bindings/serialized DTO変更なし

## Review Focus

- static testがfield名の単純0-hitだけでなく対象struct blockを限定し、false positive/negativeを避けること
- diagnostic fieldsがproduction BIZ pathで消費され、test-only consumerに留まらないこと
- raw detailがBizError/operation_logsへ混入しないこと
- existing testsの変更が限定例外を超えて期待緩和になっていないこと
- traceability generator ownershipとgenerated diffの限定

## Spec Contract

Contract ID: REQ-401 / BIZ-03-D1 / IO-07-D1 / BIZ-08-D1

- import内部型を必要fieldへ縮小し、日報parse detailは診断専用に消費する。operator-facing/DB/wire/business semanticsは不変。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-401 / BIZ-03-D1 | CSV field削減 | internal contract + commit tests | token lifecycle不変 | cargo test |
| REQ-401 / IO-07-D1 | parser field削減 | parser + contract tests | useful metadata保持 | cargo test |
| REQ-401 / BIZ-08-D1 | diagnostic接続 | strengthened parse failure | leakなし/main path | captured tracing + DB assertions |
| REQ-401 | traceability再生成 | design compliance | generated diff限定 | 90 + docs check |

## Data Safety

fixtureはsyntheticのみ。実店舗CSV、DB、operation/diagnostic log出力、filename、secretをcommitしない。diagnosticは既存local tracing sinkだけに流し、新規永続化しない。

## Implementation Results

（plan-approved後にWriterが追記）

## Review Response

- Findings Freeze: 未発効
