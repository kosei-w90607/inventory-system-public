# Plan Packet: 同日複数精算の冪等取込み実装

## Workflow State

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: b6c3a40
- Amendments: 7fc7aa1, 980a211
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet
- Final Reviewer: Sonnet
- Reviewed Content HEAD: 980a211
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval / 追加確認 Dialog と「N回の取込みを合算」表示の human visual confirmation（merge 前必須） / Ready / merge。Windows native L3 = not required（Coordinator 裁定 2026-08-16、Human Gate Proposal 参照）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2
- Plan Review round 天井: 3（既定 hard cap）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` に従う。本 plan-draft の Draft PR 作成は owner 介入を消費しない。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
POS import の冪等 identity、Rust BIZ/IO の TX と集計、Tauri command DTO / generated bindings、両取込みタブの operator workflow、日次・月次の会計表示を同時に変更する。誤実装は同日売上の欠落、二重計上、誤った在庫補正、または rollback 対象の拡大につながるため R3 とする。

## Goal

Goal Invariant:
同じ営業日の別 hash を確認付きの独立 input として追加保存し、同一 hash だけを hard block、訂正は対象 import 単位の rollback、読み出しは同じ series 内の全 active import の合算とする D-071 / SPEC-SDI-D1〜D8 を、Z004 と日報の backend・wire・UI・report・test に一貫して実装する。

### 最小完了条件

- operator が同日別 file/bundle を既存分を消さずに追加取込みでき、追加前に同日の全 active import と今回分を比較できる。
- Z004 / 日報の同一 hash は parse と commit の双方で止まり、preview 後に同日 active 集合が変わった commit は副作用なしで再 preview を要求する。
- rollback は選択した import だけに作用し、日次・月次・履歴表示は残った active imports の合算へ再取得される。
- `additional_import_confirmed`、`same_date_imports`、`source_import_count` が Rust producer、generated bindings、frontend consumer で同時に切り替わり、旧 sales-import 語彙が active code から消える。

### 失敗定義

- 同日別 hash の commit が既存 import、sale_records、inventory_movements、daily report lines を暗黙に void / `rolled_back` 化する。
- exact hash、stale preview、status/confirmation 不一致のいずれかが write を発生させる。
- 公式日次が最新 parent のみ、商品別日次が同一 `product_code + source` を未合算、または公式日報と商品別 series を横加算する。
- rollback が同日他 import に作用する、UI が対象 import を識別できない、または D-052 invalidation 後も取消前 aggregate が残る。
- overwrite oracle test を削除・緩和するだけで新しい additive / per-import oracle に置換しない。

### 非目的

- D-070 runway の後続 change を同乗させない。
- byte 違い同内容 file の意味的同一性を自動判定しない。
- schema、既存 row、migration を変更しない。
- plan-gate 前に実装 code を変更しない。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- Rust BIZ-03: `DuplicateStatus` / `DuplicateCheck` / cached preview を `AdditionalImportConfirmationRequired` + ordered `same_date_imports` / active ID snapshot へ変更し、commit を insert-only + TX 内 hash-first / snapshot-second recheck にする。
- Rust BIZ-08: `AlreadyImported` を維持しつつ同日別 bundle の全 summary と snapshot を返し、commit を insert-only、snapshot mismatch を副作用なしの re-preview error にする。
- Rust IO: active same-date query の order/status 契約を固定し、`get_latest_completed_daily_report` を全 completed parent aggregate へ置換する。商品別日次は `product_code + source`、公式支払は `payment_key`、公式部門は設計済み identity で合算し、NULL 安全側伝播と deterministic representative を実装する。
- rollback: Z004 と日報の既存 per-import 経路を同日複数 import fixture で再検証し、operation log、冪等再実行、返品負数の在庫補正を固定する。
- CMD / wire: 両 commit command を `additional_import_confirmed` へ renameし、preview summary DTO と `source_import_count` を specta producer から生成する。同一 implementation commit で Rust producer、`src/lib/bindings.ts`、全 TypeScript consumer / fixture を切り替える。
- I-W4: `src-tauri/tests/import_internal_contract_test.rs` の docs/code 分離 pin を `additional_import_confirmed` の単一 exact pin へ再統一する。
- Frontend: 両タブ共通 `AdditionalImportConfirmDialog` と warning Alert、全件到達可能な summary list、exact 文言、reducer flag、per-import rollback 文言、snapshot mismatch の新 preview 復帰を実装する。
- Reporting: `DailySalesPage` に `N回の取込みを合算` を表示し、official/product series 分離、NULL 表示、monthly additive behavior、rollback 後の残存 aggregate を固定する。
- Tests: 対応 Test Design Matrix の I-B1〜I-B9 / I-W1〜I-W5 / I-U1〜I-U8 / I-R1〜I-R8 / I-G1 を実装し、旧 overwrite oracle を各 I-* の additive / per-import oracle へ置換する。

## Non-scope

- layout A parser 対応。
- PLU slot 永続割当。
- bulk onboarding。
- 受入台本第2版。
- schema migration、既存データ変換、物理 DELETE、日付単位一括 rollback。
- byte 違い同内容 file の自動 semantic duplicate 判定。
- 新規 route、navigation、取込み履歴画面、印刷機能。
- upstream が cumulative snapshot へ変わる場合の adapter 再設計（D-071 Revisit）。

## Acceptance Criteria

- `cargo test` で I-B1〜I-B9、I-W2〜I-W5、I-R1〜I-R4 / I-R6〜I-R8 の Rust test が通り、同日別 hash 追加時に先行 import とその寄与が active のまま残る。
- exact hash、confirmation/status 不一致、active snapshot の追加・削除・置換の各 test が `IdempotencyConflict` / `ValidationFailed` / `再度プレビューしてください` と DB before/after 同値を assert する。
- `cargo run --bin generate_bindings` 後の `src/lib/bindings.ts` が `AdditionalImportConfirmationRequired`、`same_date_imports`、`additionalImportConfirmed`、`source_import_count` を持ち、旧 wire token を持たない。
- `cargo test --test import_internal_contract_test` が docs/code 共通 `additional_import_confirmed` の単一 exact pin で通る。
- RTL / hook / reducer tests I-U1〜I-U8 / I-R5 が両タブの exact 文言、全 existing summary、cancel、single commit、rollback target、D-052 invalidation、`N回の取込みを合算` を検証する。
- monthly repo regression I-R7 が同一日 2 completed parent を両方 SUM し、rolled_back parent を除外する。I-R8 は未実装 coverage field を増やさず、将来 count の `COUNT(DISTINCT report_date)` source contract を静的に pin する。
- I-G1 の active-code sweep が `OverwriteRequired|overwrite_confirmed|overwriteConfirmed|OverwriteConfirmDialog|requiresOverwrite|existing_import_id|get_latest_completed_daily_report` の hit なしを返す。archive と別意味の product / stocktake / restore 語彙は変更しない。
- `cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`、`cd src-tauri && cargo run --bin generate_traceability -- --check`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build`、`bash scripts/doc-consistency-check.sh`、`bash scripts/local-ci.sh changed` が通る。
- content candidate の clean tree で `bash scripts/local-ci.sh full` が `RESULT=PASS` / start-end CLEAN を返し、その SHA と evidence path を PR body にのみ記録する。
- independent Contract Audit が Ledger 全行を source docs から再検証し P1/P2 = 0。operator-visible UI は human visual confirmation を完了するか、owner が残存リスクを明示受理する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-401 / REQ-501 / REQ-502、`docs/spec/requirements-coverage.md`
- Architecture: `docs/ARCHITECTURE.md` POS adapter boundary、`docs/architecture/biz-task-specs.md` BIZ-03 / BIZ-08 / BIZ-05、`docs/architecture/cmd-task-specs.md` CMD-07 / CMD-12、`docs/architecture/ui-task-specs.md` UI-07
- Function / command / DTO: `docs/function-design/24-io-csv-import-repo.md` §14.6 / §14.17〜14.22、`32-biz-csv-import-service.md` §15.2〜15.6、`34-biz-sales-service.md` §19.2〜19.4、`37-biz-daily-report-import-service.md` §37.2〜37.7、`41-cmd-pos.md` §17.4〜17.5、`45-cmd-daily-report-import.md` §45.3〜45.8
- DB: `docs/DB_DESIGN.md` transaction / POS boundary、`docs/db-design/pos-tables.md` §11 / §12b〜12e / B-1 / B-2
- Screen / UI: `docs/SCREEN_DESIGN.md` 売上データ取込み / 日次 / 月次、`docs/function-design/55-ui-csv-import.md` §55.1〜55.8、`56-ui-daily-sales.md`、`57-ui-monthly-sales.md`、`docs/design-system/01-decision-rules.md`、`02-component-catalog.md`
- Decision log / ADR: `docs/decision-log.md` D-023 / D-025 / D-052 / D-070 / D-071
- Implementation inheritance: archived [design-first packet](2026-08-16-same-day-import-idempotency.md) と [Matrix](test-matrices/2026-08-16-same-day-import-idempotency.md) の I-B1〜I-G1 / Ledger

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 24 / 32 / 34 / 37 / 41 / 45、architecture task specs | existing sufficient（PR #79で SPEC-SDI-D1〜D8 を正本化済み） |
| Command / DTO / generated binding / wire shape | 32 §15.2〜15.4、37 §37.2〜37.4、41 §17.4〜17.5、45 §45.3〜45.5 | existing sufficient。実装で generator 追随 |
| DB / transaction / audit / rollback / migration | `pos-tables.md` B-1/B-2、32 §15.4〜15.6、37 §37.4〜37.6 | existing sufficient。migration 不要 |
| Screen / UI / route state / Japanese wording | 55 §55.1〜55.8、56、57、design-system | existing sufficient。route 追加なし |
| CSV / report / import / export format | D-071、32 / 37 の identity と report contract | existing sufficient。parser shape 変更なし |
| Durable decision / ADR | decision-log D-071 | accepted。新規 durable decision なし |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| Tauri command | 新規 command なし。既存 `commit_csv_import` / `commit_daily_report_import` の `#[tauri::command]` / `#[specta::specta]` と `collect_commands` 登録を維持する |
| DTO / enum / command arg | Rust producer と全 consumer を同一 implementation commit で切替え、`cd src-tauri && cargo run --bin generate_bindings` を実行。`src/lib/bindings.ts` の hand edit 禁止 |
| REQ coverage | REQ-401 / 501 / 502 test 追加後、`cargo run --bin generate_traceability` と `-- --check` を実行し、`90-traceability.md` を generator 所有のまま同期する |
| route / navigation | 新規なし。`npm run generate:routes` の変更は想定しないが L1 の generated drift は通す |
| source doc | source design の契約変更なし。実装中に欠陥・曖昧さを発見したら発明せず design へ戻す |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401 | 32 §15.2〜15.6 / 37 §37.2〜37.7 / pos-tables B-1/B-2 | SPEC-SDI-D1 / D2 / D4 / D7、D-071 | business date replacement は delta file の先行売上を失う。date-wide rollback と暗黙置換を却下 | both BIZ services、sales_repo、CMD、UI result | I-B1〜I-B9 / I-W5 / I-U7〜I-U8 |
| REQ-401 | 32 §15.2〜15.4 / 37 §37.2〜37.4 / 41 §17.4〜17.5 / 45 §45.3〜45.5 | SPEC-SDI-D3 | singular ID / overwrite flag は複数 active import を表せない | DTO enum、cached snapshots、commands、bindings、frontend types | I-W1〜I-W5 |
| REQ-401 | 55 §55.1〜55.8 / DSR-07 | SPEC-SDI-D5 / D7 | checkbox-only と destructive dialog の隣接 drift を廃止し、復旧 file の二重計上リスクを比較可能にする | shared dialog、both pages/hooks/reducers、result dialogs | I-U1〜I-U8 |
| REQ-501 | 24 §14.21 / 34 §19.2〜19.3 / 56 | SPEC-SDI-D6、D-025 | latest parent と未集約 product rows は日次を過小/重複表示する。official/product 横加算は却下 | sales_repo、sales_service、DailySalesPage、bindings | I-R1〜I-R6 |
| REQ-502 | 24 §14.22 / 34 §19.4 / 57 | SPEC-SDI-D6 | monthly additive query は既に正しいため構造変更せず regression で守る | sales_repo monthly queries、MonthlySalesPage fixture | I-R7〜I-R8 |
| REQ-401/501/502 | decision-log D-071 / active source docs | SPEC-SDI-D8 | active code の旧語彙は誤った contract を再導入する | repo-wide active code、generated output、split pin | I-G1 / I-W4 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。D-071 と 24 / 32 / 34 / 37 / 41 / 45 / 55 / 56 / 57 に identity、TX、wire、表示、rollback、集計が正本化済み。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none。本 packet は PR #79 の accepted design を実装単位へ写像するだけで、新規 durable decision を持たない。
- Assumptions and constraints: upstream は精算単位 delta、single-store / single-process SQLite、old/new app binary 混在なし、hash 異なり同内容は operator 比較のみ。
- Deferred design gaps, risk, and follow-up target: cumulative snapshot の証跡観測時は D-071 Revisit。layout A / slot / onboarding / 台本第2版は D-070 runway の別 change。
- Test Design Matrix can cite design decision IDs or source doc sections: yes。全 I-* 行が SPEC-SDI-D1〜D8 と section を持つ。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: exact hash hard block は active status のみ、rolled_back hash re-import は許可。semantic duplicate は絶対防止と主張せず D5 confirmation を residual guard とする。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | delta/cumulative は adapter fact、content-hash identity / per-import rollback / additive read は app-core | D-071、32 / 37 / pos-tables |
| Fact check / design decision split | issue #76 の連番 raw 保全は観測事実。追加確認と active aggregate は accepted product decision | D-071、archived design packet |
| Lifecycle / retry | parse hard block、preview snapshot、confirm/cancel、TX recheck、success token delete、ordinary failure retry、snapshot mismatch re-preview、rollback retryを分離 | 32 / 37 / 41 / 45、Matrix State Lifecycle |
| Operator workflow | legitimate second settlement と recovery duplicate を同じ比較 dialog で判別。訂正は rollback + re-import の明示2操作 | 55、human visual confirmation |
| Replacement path | upstream が cumulative snapshot 化した場合だけ adapter semantic contract を再設計し、core contract の無条件流用を止める | D-071 Revisit |
| Data safety / evidence | synthetic fixture のみ。実 raw/hash/amount/DB を repository evidence にしない | Data Safety、PR body |
| Reporting / accounting semantics | official/product series は別。各 series 内で active inputs を加算し、NULL incomplete を0へ落とさない | 24 / 34 / 56 / 57、I-R1〜I-R8 |
| Manual verification | UI wording・全 summary 到達・合算表示は human visual confirmation 対象。backend/concurrency/failure injection は automated | Human Gate、I-U* / I-R* |
| 環境・再現性 | 新規 toolchain / OS dependencyなし。bindings/traceability/routes は repo generator と L1 で固定 | Registration / Generation Obligations |

## Design Readiness

- Existing design docs are sufficient because: PR #79 で SPEC-SDI-D1〜D8 と D-071 が active source docs へ正本化され、wire name、DTO shape、TX順序、exact Japanese wording、NULL/group identity、rollback/list semantics まで確定している。
- Source docs updated in this PR: none。これは implementation plan-first change であり、durable contract は変更しない。
- Design gaps intentionally deferred: D-070 runway の layout A / slot / onboarding / 台本第2版のみ。本 scope の実装を曖昧にする gap はない。
- Durable decisions discovered in this plan and promoted to source docs: none。新しい設計判断が必要になった場合は spec-check → plan-draft skip を無効化し、発明せず design phase へ戻る。
- Workflow transition: source docs sufficient のため `spec-check -> plan-draft` の唯一の許可済み skip を使用する。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated CMD のみ、CMD は token/cache と error conversion、BIZ は identity/confirmation/TX/rollback、IO は query/insert、report mapping は BIZ。
- Backend function design: 24 / 32 / 34 / 37 に signatures、steps、errors、TX、aggregation identity がある。
- Command / DTO / data contract: 41 / 45 と SPEC-SDI-D3 が producer/consumer/bindings の破壊的 rename を確定する。
- Persistence / transaction / audit impact: schema不変。hash recheck → snapshot recheck → insertを同一TX、operation logは既存方針を維持。
- Operator workflow / Japanese UI wording: 55 の Alert/Dialog/actions/badge/rollback 文言を exact oracle とする。
- Error, empty, retry, and recovery behavior: exact hash、AlreadyImported、invalid bool、snapshot mismatch、ordinary failure、cancel、rollback failure、all rolled back empty を Matrix に含める。
- Testability and traceability IDs: REQ-401 / 501 / 502、SPEC-SDI-D1〜D8、I-B1〜I-G1 を test名/commentへ付す。

## Contract Probe

- N/A: unverified external premise はない。field evidence は D-071 と source docs へ正本化済みで、本 plan は local source / test inventory から導出する。Windows native L3 の要否は外部挙動 probe ではなく manual-verification boundary 裁定であり、Coordinator が not required と裁定済み（Human Gate Proposal 参照）。

## Mechanical Implementation Inventory

使用 command:

```text
rg -n "overwrite_confirmed|overwriteConfirmed|OverwriteRequired|OverwriteConfirmDialog|requiresOverwrite|existing_import_id|get_latest_completed_daily_report" src-tauri/src src-tauri/tests src src/lib/bindings.ts
rg -n "^\\s*(fn test_|it\\(|test\\()" <対象 Rust / RTL test files>
rg --files src-tauri/src/biz/csv_import_service src-tauri/src/biz/daily_report_import_service src/features/csv-import src/features/daily-report-import src/features/daily-sales src/features/monthly-sales
```

分類結果（line は plan-draft 実査時点。実装中は symbol で再検索する）:

| Change group | Current target | Planned result | Matrix |
|---|---|---|---|
| BIZ-03 types/parse/commit | `csv_import_service/mod.rs`, `parse.rs`, `commit.rs`, parse/commit tests | singular ID / overwrite branchを全 summary + snapshot + insert-onlyへ | I-B1〜I-B5 / I-W2 / I-W5 |
| BIZ-03 rollback | `rollback.rs`, `rollback_tests.rs`, `sales_repo.rs` void helpers | production pathを維持し、同日2 import isolation / return sign / logを追加 | I-B6 / I-B7 / I-B9 |
| BIZ-08 types/parse/commit/rollback | `daily_report_import_service/{mod,parse,commit,rollback}.rs`, `tests.rs` | AlreadyImported維持、summary/snapshot、insert-only、per-parent rollback | I-B1 / I-B2 / I-B4 / I-B5 / I-B8 / I-B9 / I-W3 / I-W5 |
| IO aggregation | `db/sales_repo.rs` current latest parent query / daily sale row query / monthly query tests | all-parent NULL-safe aggregate、`product_code + source` SUM、monthly regression | I-R1〜I-R4 / I-R6〜I-R8 |
| BIZ report DTO/mapping | `biz/sales_service.rs`, tests/callers | singular ID削除、`source_import_count`追加、warning de-dup | I-R1〜I-R6 |
| CMD/cache/wire | `cmd/csv_import_cmd.rs`, `cmd/daily_report_import_cmd.rs`, `src/lib/bindings.ts` | bool rename、snapshot mismatch token delete、generated DTO | I-W1 / I-W4 / I-W5 |
| Static split pin | `src-tauri/tests/import_internal_contract_test.rs` | Rust/Markdown分離配列を単一 `additional_import_confirmed` pinへ | I-W4 / I-R8 |
| Z004 UI | `src/features/csv-import/**` | shared addition Alert/Dialog、flag rename、per-import result wording | I-U1 / I-U2 / I-U5〜I-U8 |
| 日報 UI | `src/features/daily-report-import/**` | checkboxをshared dialogへ、all summary、flag rename、per-import result wording | I-U3〜I-U8 |
| Daily/monthly UI | `DailySalesPage.tsx/.test.tsx`, monthly regression fixtures | 合算回数表示、NULL/series分離、monthly output維持 | I-R5 / I-R7 |
| active stale vocabulary | 上記 production/tests/generated + `DiscontinueConfirmDialog.tsx` borrowed-reference comment | I-G1 exact sweep 0。別意味語彙/archiveは不変 | I-G1 |

## Oracle Replacement Ledger

旧 test は削除・弱体化せず、設計変更で誤りになった期待値を次の oracle へ置換する。単一-importの正常系、rollback冪等性、在庫非連動、D-052 invalidationは保持し、複数importの独立値を追加する。

| Existing oracle / file | Replacement / extension | Justification ID |
|---|---|---|
| `test_parse_and_validate_req401_settlement_date_overwrite` / `..._no_duplicate` | `..._same_date_additional_summary_ordered` / empty `same_date_imports` | I-W2 |
| `test_commit_req401_overwrite_flow` | `test_commit_req401_same_date_additive_preserves_first_import_sales_movements_stock` | I-B3 |
| `...overwrite_not_confirmed`, `...overwrite_confirmed_without_duplicate` | exact status/flag mismatch + zero-write tests | I-B5 |
| `test_commit_req401_toctou_check`, `...settlement_date_toctou` | hash-first conflict と active snapshot add/remove/replace mismatchを独立 test化 | I-B2 / I-W5 |
| `rollback_tests.rs` の normal/idempotent/stock tests | 単一import oracleを維持し、同日2 importの選択ID isolationと返品負数補正を追加 | I-B6 / I-B7 / I-B9 |
| daily `...overwrite_required_for_same_date_different_bundle` | `...additional_confirmation_returns_all_same_date_summaries` | I-W3 |
| daily `...commit_overwrite_rolls_back_old` | `...commit_same_date_additive_keeps_both_completed_and_lines` | I-B4 |
| daily `...overwrite_unconfirmed...`, `...stale_overwrite_preview...` | status/flag zero-write、same-hash TX conflict、snapshot drift re-previewへ分離 | I-B2 / I-B5 / I-W5 |
| daily rollback idempotent test | 同日2 parentでselectedのみrolled_back、他方 visible、log exact IDを追加 | I-B8 / I-B9 |
| sales repo `get_latest...` 3 tests | all-parent aggregate / NULL / rolled_back exclusion / remaining-parent after rollback | I-R1〜I-R3 / I-R6 |
| `DailyReportImportPage.test.tsx` overwrite checkbox/warning tests | shared Alert/Dialog exact wording、all summaries、cancel/confirm single call | I-U3〜I-U6 |
| csv reducer/hook payload tests | `additionalImportConfirmed` carry と generated command call、snapshot mismatchはpreview tokenを再利用しない | I-W4 / I-W5 / I-U6 |
| daily reducer/hook payload tests | 同じ rename と lifecycle、D-052 exact invalidation維持 | I-W4 / I-U6 / I-U8 |
| result rollback RTL/hook tests | exact ID/date/files/amount + 他import残存文言、failure retry同一ID、success refetch | I-U7 / I-U8 |
| `DailySalesPage.test.tsx` singular ID fixtures | `source_import_count` + `N回の取込みを合算` + NULL/series separation | I-R5 |
| monthly repo/Page tests | 同一日2 parent additive fixtureを追加し既存visible totalを維持 | I-R7 |

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-SDI-D1 / D-071 identity | both parse/commit + active same-date repo queries | I-B1〜I-B5 / I-W2〜I-W3 | real raw再採取は完了済み。synthetic automated |
| SPEC-SDI-D2 correction | both rollback services / logs / UI result | I-B6〜I-B9 / I-U7〜I-U8 | physical delete / date-wide rollback non-scope |
| SPEC-SDI-D3 wire | Rust DTOs/CMD/bindings/TS consumers/split pin | I-W1〜I-W4 | automated generated-contract review |
| SPEC-SDI-D4 snapshot lifecycle | cached previews、TX recheck、CMD token lifecycle（confirmation/status 検証の分岐構造は pipeline で異なる: CSV = 2-branch `matches!`、daily = AlreadyImported を含む 3-way match。挙動は等価でいずれも zero-write — Final Review round 1 P2-1 起源の注記） | I-B2 / I-B5 / I-W5 | manual concurrency injectionをL3へ置かない |
| SPEC-SDI-D5 operator confirmation | shared dialog + both tab alerts/pages/hooks | I-U1〜I-U6 | human visual confirmation必須。Windows native L3 = not required（Coordinator 裁定済み） |
| SPEC-SDI-D6 accounting read | sales_repo/BIZ DTO/DailySales/monthly queries | I-R1〜I-R8 | synthetic values only。series cross-add non-scope |
| SPEC-SDI-D7 per-import list/rollback UI | rollback dialogs/hooks/list order/invalidation | I-B6〜I-B9 / I-U7〜I-U8 / I-R6 | new history route non-scope |
| SPEC-SDI-D8 stale vocabulary | active Rust/TS/tests/generated/comment sweep | I-G1 / I-W4 | archive / unrelated overwrite unchanged |
| D-052 invalidation continuity | both import hooks and report consumers | I-U8 / I-R6 | existing contractを維持 |
| D-025 official/product separation | sales_service / DailySalesPage / monthly | I-R4 / I-R5 / I-R7 | official + productを一つのtotalへ足さない |
| generated registration | specta producers、collect_commands、bindings、traceability | I-W1 / I-W4 / local gates | hand edit non-scope |

Adjacent-contract sweep result: touched source sectionsの identity、status、summary fields/order、TX順、token retry、rollback/log/list、NULL/group representative、series分離、exact UI文言、D-052 invalidation、generated obligationsを上表と Matrix に収載した。parser layout、route、schema、印刷は明示 non-scope。

## Test Plan

Test Design Matrix: [2026-08-16-same-day-import-idempotency-implementation.md](test-matrices/2026-08-16-same-day-import-idempotency-implementation.md)

- targeted tests: BIZ parse/commit/rollback、sales_repo aggregate、CMD cache、internal contract、RTL/hook/reducer、DailySales/MonthlySales。
- negative tests: active same hash、AlreadyImported、invalid confirmation、snapshot add/remove/replace、NULL propagation、unknown rollback ID、rollback failure retry。
- compatibility checks: rolled_back hash re-import、schema不変、manual/auto separation、monthly additive、D-052 invalidation、generated bindings drift。
- data safety checks: synthetic fixtureのみ。実 POS / store DB / hash / amount / backup / logを使わない。
- main wiring/integration checks: BIZ preview snapshot -> CMD cache -> generated bool -> UI dialog、commit/rollback -> invalidation -> aggregate refetch。

Human Gate に L3 が採用された場合、Writer は owner native build 前に `cargo check --release` を完了する。

## Boundary / Wire Contract

- producer: `csv_import_service` / `daily_report_import_service` preview DTOs、`sales_service::OfficialDailyReportSummary`、CMD-07 / CMD-12 command signatures、specta generator。
- consumer: `src/lib/bindings.ts`、両 import hooks/reducers/pages、DailySalesPage、Rust/TS fixtures、static contract test。
- wire type: `DuplicateStatus = NoDuplicate | AdditionalImportConfirmationRequired`、daily variantは `AlreadyImported` を加える。`same_date_imports` summary arrays、`additional_import_confirmed: bool` / generated `additionalImportConfirmed`、`source_import_count`。
- internal type: cached preview の ordered active import ID snapshot + parsed rows。frontendからhashやsnapshot IDsをround-tripしない。
- precision/range: DB `i64` / Rust `usize` は既存 generator convention の JSON number。moneyはsigned、countはnon-negative。range policyは変更しない。
- round-trip path: parse -> BIZ summary/cache -> specta response -> warning/dialog -> generated command arg -> CMD cache lookup -> BIZ commit -> IO hash/snapshot recheck -> insert -> invalidation/refetch。
- invalid input: exact hashは Z004 `ImportError` / daily `AlreadyImported` と commit `IdempotencyConflict`。status/flag mismatchは `ValidationFailed`。snapshot mismatchは exact re-preview message + token破棄 + zero write。
- compatibility:破壊的 rename のためold frontend/new backend混在は非互換。Tauri appは同一bundle配布なのでproducer/consumer/bindingsを同一commitで切替える。schema/既存rows/CSV shapeは互換。
- wire fixtures replaced together: `src/lib/bindings.ts`、both service tests、CMD tests、`import_internal_contract_test.rs`、both import reducer/hook/page fixtures、`DailySalesPage.test.tsx`。

## Human Gate Proposal

Confirmed facts:

- operator-visible Alert/Dialog と日次表示を変更するため、`docs/DEV_WORKFLOW.md` の generic human visual confirmation は必要。
- backend correctness、snapshot race、NULL/grouping、invalidationは automated test で観測可能。
- exact wording、scroll到達、dialog actions、`N回の取込みを合算` は browser/RTLでも検証でき、現時点で Windows/Tauri native にしか観測できない挙動は特定されていない。

Coordinator 裁定（2026-08-16）:

- 採用: Windows native L3 = `not required`。merge 前の human visual confirmation で `/csv-import` の日報/Z004両タブ、同日追加Alert/Dialog、長い既存一覧のscroll、rollback dialog、`/reports/daily` の合算表示を目視する。
- 理由: 現時点で Windows/Tauri native にしか観測できない挙動は特定されておらず、exact 文言・全件到達・cancel/single-submit は I-U1〜I-U8 の RTL が oracle として固定する。native 文脈の end-to-end 確認は D-070 runway の受入台本第2版で構造的に補完される。
- 不採用 alternative: 同項目の Windows native L3 化（fault injection なしの表示確認のみで、native 固有の観測利得がないため）。
- 残る Human Gate = owner plan approval / human visual confirmation / Ready / merge。

## Review Focus

- hash recheck が snapshot recheck より先で、どのerror pathもINSERT/void/stock changeを残さないか。
- additive commitが先行importを保持するだけでなく、inventory contributionとdaily/monthly readsも両方を含むか。
- NULL安全側伝播と未対応部門identity/representativeがSQLとmappingの両方で一致するか。
- `source_import_count` がparent数で、将来coverage日数や商品明細数と混同されていないか。
- shared dialogのexact文言・全件到達・cancel/single-submit・semantic duplicate residual riskが両タブで同型か。
- rollbackがselected IDだけに作用し、failure retryとsuccess invalidationが同じID/snapshotを維持するか。
-旧 oracleを削るだけでなく、distinct fixtureとbefore/after DB oracleへ置換しているか。
- generated bindingsがhand editでなくproducer/consumerと同一commitか。I-W4 split pinが単一 exact pinへ戻ったか。
- I-G1 sweepがarchiveや別意味の上書きを誤変更せずactive codeだけを閉じるか。

## Spec Contract

Contract ID: SPEC-SDI-IMPLEMENTATION-2026-08-16

- Active same hash is hard-blocked at preview and commit; rolled-back same hash can be imported again.
- Same date + distinct hash is confirmation-gated additive input; commit never implicitly invalidates an existing import.
- Confirmation is bound to the ordered active same-date ID snapshot; any drift fails closed to a new preview with zero side effects.
- Correction is selected per-import rollback followed by a separate re-import; same-date siblings remain active.
- Daily/product/monthly reads include all active imports within their own series, preserve NULL incompleteness, and never cross-add official and product totals.
- Rust producer、generated bindings、frontend consumer switch `additional_import_confirmed` and summary DTOs atomically.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-SDI-D1 | BIZ/IO additive admission | I-B1〜I-B5 / I-W2〜I-W3 | exact hash block / no implicit void | Rust DB before/after assertions |
| SPEC-SDI-D2 | rollback implementation | I-B6〜I-B9 / I-U7〜I-U8 | selected ID only / correction sign / audit | status, movement, stock, log assertions |
| SPEC-SDI-D3 | DTO/CMD/bindings atomic rename | I-W1〜I-W4 | old wire absent / summaries complete | generated diff + static contract test |
| SPEC-SDI-D4 | cached snapshot/TX/token lifecycle | I-B2 / I-B5 / I-W5 | stale preview zero side effect | add/remove/replace integration fixtures |
| SPEC-SDI-D5 | shared addition confirmation | I-U1〜I-U6 | exact wording / all rows / cancel / once | RTL + human visual confirmation |
| SPEC-SDI-D6 | aggregate implementation | I-R1〜I-R8 | NULL/group identity/series/monthly | repo/BIZ/RTL regression |
| SPEC-SDI-D7 | per-import UI/list/refetch | I-B6〜I-B9 / I-U7〜I-U8 / I-R6 | remaining aggregate | rollback before/after + invalidation oracle |
| SPEC-SDI-D8 / D-071 | stale vocabulary/split pin closure | I-G1 / I-W4 | no partial rename / archive intact | rg output + exact pin |

## Data Safety

- Commit禁止: 実POS CSV/raw bytes、実店舗 hash/filename/商品/金額、DB、backup、logs、receipt、secrets、`.env*`。
- local-only: `.local/**`、Tauri app data、実店舗 artifact、L1 evidence log。
- synthetic-only: Rust/RTL fixturesは架空の商品、日付、filename、金額、hashを使う。複数importは互いに異なる値を使い、oracleをtautologyにしない。
- generated outputs: `src/lib/bindings.ts` と `docs/function-design/90-traceability.md` はgeneratorのみで更新する。
- schema/data migrationなし。rollbackは論理取消、物理削除を導入しない。

## Implementation Results

- packet scope の BIZ / IO / CMD / generated wire / frontend / reporting / per-import rollback を実装し、Oracle Replacement Ledger を additive / snapshot / per-import / aggregate oracle へ置換した。
- `AdditionalImportConfirmationRequired`、ordered `same_date_imports`、`additional_import_confirmed`、`source_import_count` を producer/consumer/bindings 同時切替し、split pin を単一 pin へ再統一した。
- active-code 旧語彙 sweep、mutation-style adequacy 自己検証、individual gates と L1 full の volatile evidence は PR body に記録する。
- （2026-08-16 是正追記）hosted CI 初回 Ready で I-G1 sweep test の外部 `rg` 依存が hosted runner 不在により fail（true positive）。正規 state-backtrack 後、`980a211` で pure Rust file walk へ是正（走査対象・token 集合・行単位報告は同一、感度は旧 token 実注入 red → 復元 green で確認）+ Matrix I-G1 文言追随（gated amendment）。Final Reviewer 再検証 P1/P2 = 0、L1 full RESULT=PASS。新規 P3（pure walk の gitignore 非尊重による将来偽陽性リスク、安全側のみ）は closeout の follow-up へ。human visual confirmation は test-only 是正のため PASS のまま有効。
- 再前進遷移: implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final を本 content commit に同乗して materialize（STATECAP 3/3 消費済みのため PR #58 先例の正規手段）。評価証跡 = `980a211` の L1 full PASS（evidence は PR body）/ Final Reviewer 再検証 P1/P2 = 0 / human visual confirmation PASS 維持 / owner re-Ready 承認 2026-08-16（介入予算 3 超過 1 回目、CI 赤対応の継続として明示記録）。Reviewed Content HEAD = `980a211`、Amendments へ `980a211` を append。

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none

### Plan Gate（2026-08-16）

- Plan Review round 1（独立 Sonnet）: P1 = 0 / P2 × 1（Human Gate の L3 裁定陳腐化）/ P3 × 1（AC の traceability gate 欠落）→ 両 accept、`fc55ba7` で是正。再検証で新規 P3 × 1（裁定見出しの Phase 先取り表記）→ accept、`a4be4b4` で是正し round 1 CLOSED（P1/P2 = 0）。引用実在性は Oracle Replacement Ledger 全行 + Mechanical Inventory 全 path で幻覚 0、source-doc 突合 drift 0、archived Matrix 継承 31/31 完全一致、wire 切替の replaced-together 列挙漏れ 0 を reviewer が独立実測。
- Coordinator 裁定: Windows native L3 = not required（Human Gate Proposal に確定記録済み）。発注書の「33 行」は Coordinator の誤記で実数 31 行（reviewer 実測が是正、packet 側は当初から正）。
- owner plan approval: 2026-08-16（介入 1/3）。
- 遷移: plan-draft -> plan-gate -> plan-approved -> implementing を本 state-only commit で materialize。評価証跡 = packet/Matrix committed（`b6c3a40`）、Plan Review P1/P2 = 0、Plan Commit `b6c3a40` が全実装 commit に先行。

### Final Review（2026-08-16）

- 実装 = 単一 content commit `c1a70df`（wire 原子性は構造的に充足）。Final Review round 1（独立 Sonnet）: Ledger 全行適合、Matrix 31/31 PASS、TX 順序・NULL/grouping SQL・exact 文言・oracle 置換の非弱体化・層規律・Data Safety を実読検証し、全 gate（cargo/npm/traceability/bindings regenerate diff 0/doc-check/I-G1 sweep）を独立再実行で再現。P1 = 0 / P2 × 1（Ledger の pipeline 別分岐構造注記不足）/ P3 × 2。
- P2-1 → accept、gated amendment `7fc7aa1` で注記追加、reviewer 再検証で round 1 CLOSED（P1/P2 = 0）。P3-1（D-052 直接再現）→ mutation 独立再実測で closure。P3-2（I-R4 fixture tautology 疑い）→ Coordinator の fixture 実読（互いに異なる非空期待 + voided 除外 + 返品負数）で closure。
- Coordinator mutation 独立再実測（隔離 worktree、Writer と別主体）: Matrix の Adequacy Questions から注入形を独立導出し **20 mutant 全 kill、survivor 0**（同日置換復活 / TX 順序入替 / snapshot 弱体化 / 先頭 1 件打切り / rollback 日付拡大 / 符号反転 / LIMIT 1 復活 / NULL→0 / 代表 max 化 / GROUP BY source 脱落 / source_import_count 定数化 / D-052 key 除去 / 旧語彙再導入 / split pin 片側 rename、ほか。archive 除外の負検査も期待どおり green）。
- Writer 自己検証記録の是正 2 点（実カバレッジは健在、記録の瑕疵のみ）: ①unmatched warning mutant の kill test 誤記（正 = sales_service 側 `test_get_daily_sales_warnings_unmatched_department_req501`。誤記載の repo 層 test は warnings field を持たず検出不能）②日報側 rollback 日付拡大 mutant（I-B8）の記録漏れ（実 test `test_daily_report_req401_rollback_keeps_same_date_sibling` が kill することを独立確認）。正しい対応は PR body へ反映。
- 遷移: implementing -> local-verified -> independent-review -> human-confirm を本 state-only commit で materialize。評価証跡 = content candidate `7fc7aa1` の L1 full RESULT=PASS（evidence 位置は PR body）、Final Reviewer engaged + P1/P2 = 0、Reviewed Content HEAD = `7fc7aa1`。残 Human Gate = human visual confirmation（両タブ追加確認 Alert/Dialog / 長一覧 scroll / rollback dialog / 日次合算表示の目視）→ owner Ready → merge。

### Ready（2026-08-16）

- human visual confirmation: PASS（owner 実施 2026-08-16、実測記録は PR body。介入 2/3）。
- 目視起源の P3 follow-up 候補 3 点（日報完了画面の action 間隔 / 両 tab rollback summary のラベル付き構造化・改行 / 追加確認 summary の構造化・折返し回避）は Coordinator 裁定で backlog 起票（本 PR 非同乗、closeout で `Plans.md` backlog へ）。
- owner Ready authorization: 2026-08-16（介入 3/3、予算内完走）。
- 遷移: human-confirm -> ready-hosted-final を本 state-only commit で materialize（Draft のまま）。本 commit 後の exact HEAD で L1 full を実行し、evidence は PR body に記録する（D-038）。

### state-backtrack（2026-08-16、append-only）

- 事象: Ready 化後の hosted CI（run 31907930181）で Rust tests job が fail。原因 = `test_active_sales_import_vocabulary_sweep_i_g1`（I-G1）が外部 binary `rg` を `Command::new` で起動しており、hosted runner に rg が存在せず NotFound panic。local L1 は linuxbrew rg の存在により 2 回とも PASS（環境依存の test 実装欠陥、hosted の検出は true positive）。
- 補正: ready-hosted-final -> implementing へ単一 backward 遷移（本 state-backtrack commit）。PR #80 は Draft へ戻す。是正 = 同 test を外部 binary 非依存の pure Rust file walk + literal 検索へ書き換え（token の concat 自己回避は維持）、Matrix I-G1 行の「指定rg」文言を tool 非依存へ追随（gated amendment、SHA は後続 append）。sweep 感度は旧 token 実注入 → red → 復元で再確認する。
- human visual confirmation（PASS 済み）は operator UI 非変更の test-only 是正のため有効のまま維持。再前進の遷移は STATECAP 3/3 消費済みのため、PR #58 先例の正規手段（Implementation Results 記入の content commit への同乗）で記録する。
