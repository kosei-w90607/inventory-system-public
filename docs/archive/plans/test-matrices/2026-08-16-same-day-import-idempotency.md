# Test Design Matrix: 同日複数精算の冪等取込み再設計

## Risk

Risk: R3

## Contracts Under Test

- SPEC-SDI-D1: content hash identity / same-date additive admission
- SPEC-SDI-D2: explicit per-import rollback + separate re-import
- SPEC-SDI-D3: DuplicateStatus / preview summary / command wire replacement
- SPEC-SDI-D4: preview snapshot bound confirmation and TOCTOU fail-closed
- SPEC-SDI-D5: adjacent Z004/daily-report addition confirmation UI
- SPEC-SDI-D6: all-active same-date aggregation without cross-series double counting
- SPEC-SDI-D7: per-import rollback presentation/list/invalidation
- SPEC-SDI-D8 / candidate D-071: durable contract and overwrite vocabulary closure

## Failure Modes

- distinct hash の second settlement が既存 import を rollback/void し、最初の売上・在庫変動が消える。
- exact hash が confirmation 経由で通り、二重計上される。
- preview 後に同日 import が変わっても stale summary のまま commit する。
- singular `existing_import_id` が残り、複数 active import の一部だけを表示または暗黙取消する。
- UI が「上書き」と表示し、operator が既存分が消える/消えないを誤認する。
- official daily が latest parent だけを表示する、または Z004 product rows が同商品を未合算で表示する。
- official daily と Z004 totals を横加算して売上を二重計上する。
- rollback が同日の他 import まで触る、または refetch 後も取消前 aggregate が残る。
- monthly query を不必要に single-parent 化し、既に正しい additive behavior を退行させる。
- archive や product/stocktake/restore の正当な「上書き」まで機械置換する。

## Test Matrix

`M-D*` は本 design-first PR の source amendment 検証（本発注では予約、plan-approved 後の次発注で実行）。`I-*` は別の後続 implementation PR への予約であり、本 design-first PR の green 条件には数えない。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-SDI-D1 [本 design-first PR] | durable docs が replacement のまま | CLI/contract review | M-D1: 24/32/37/pos-tables に exact hash block + distinct hash additive + no implicit void anchors | source amendment のどれかが旧意味のまま |
| SPEC-SDI-D2 [本 design-first PR] | rollback 対象が日単位 | CLI/contract review | M-D2: 32/37/55 に `per-import` / `同日の他の取込みは残る` anchor | rollback+re-import の明示分解が欠落 |
| SPEC-SDI-D3 [本 design-first PR] | singular ID / overwrite wire が source docs に残る | CLI/negative rg | M-D3: active source docs で `OverwriteRequired|overwrite_confirmed|existing_import_id` sales-import hit が 0、new enum/field anchors present | wire amendment が部分的 |
| SPEC-SDI-D4 [本 design-first PR] | stale confirmation 契約なし | CLI/contract review | M-D4: 32/37 commit steps に snapshot equality / re-preview / no side effect anchors | TOCTOU の blind retry を許す |
| SPEC-SDI-D5 [本 design-first PR] | tab 間の文言/flow drift | CLI/adjacent spec | M-D5: 55 に両タブ共通 title/description/actions と表示 field list | checkbox/dialog の不一致が残る |
| SPEC-SDI-D6 [本 design-first PR] | latest 1 parent / cross-series sum | CLI/contract review | M-D6: 24/34/56/57 に all completed parents、source_import_count、series separation、distinct-day anchor | accounting meaning が曖昧 |
| SPEC-SDI-D7 [本 design-first PR] | rollback display/list collapse | CLI/contract review | M-D7: 32/37/55 に exact ID / source file / amount / per-row list order / retry anchors | operator が対象 import を識別不能 |
| SPEC-SDI-D8 [本 design-first PR] | current truth が packet-only | CLI/decision audit | M-D8: decision-log D-071 + active source docs cross-reference、archive diff 0 | durable promotion 欠落 or archive rewrite |
| Plan discipline [現在の発注] | code/source amendment の先行混入 | CLI/diff | M-P1: `git diff --name-only origin/main...HEAD` が packet/matrix/Plans のみ | plan-draft scope を越える |
| Plan discipline [現在の発注] | packet selection/check failure | CLI | M-P2: `bash scripts/doc-consistency-check.sh --target plan` exit 0 | Workflow State / Plans link / template 契約不備 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| exact hash import | no active same hash | parse/preview check | preview/commit blocked | none | choose another file or rollback exact import | rolled_back allows re-import | new preview | ImportError/IdempotencyConflict | same bytes remain blocked | I-B1/I-B2 |
| distinct hash / same date | active same-date list | addition confirmation | new import inserted, old remain active | daily/monthly/list/detail caches | aggregates include both | next distinct input repeats confirmation | new preview token | cancel = no effect | confirm after current preview | I-B3/I-U1〜U6 |
| preview snapshot | ordered active IDs cached | operator reads summaries | TX IDs match then commit | token removed on success | queries refetch | active set changes | full re-preview | mismatch = no side effect | new token only | I-W5 |
| per-import rollback | selected active ID | rollback TX | selected status/rows/movements only invalidated | D-052 producers | remaining aggregate | rolled_back repeat | same result state on failure | error retains target ID | same ID | I-B6〜B9/I-U7〜U8 |
| design-first workflow | plan-draft | Plan Review / source amendments | source truth ready, then separate implementation | packet state only | N/A | finding returns to design/plan | gated amendment | unresolved design blocks implementation | next authorized order | M-D*/M-P* |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| sales import duplicate flow | Z004 PreviewStep/Dialog/hook/reducer + daily DailyReportImportPage/hook/reducer | both tabs, shared wording/summary order | product import duplicates are row UPDATE, not same-date file input | M-D5 / I-U1〜U6 |
| hash idempotency | both `find_blocking_*_by_*_hash`, parse and commit rechecks | unchanged hard block in both pipelines | `LIMIT 1` is sufficient existence guard | I-B1/I-B2 |
| per-import rollback | csv rollback, daily rollback, result dialogs, list endpoints | exact selected ID and remaining aggregate | new history route non-scope | I-B6〜B9/I-U7〜U8 |
| report aggregation | daily product, daily official, monthly product/department/official | daily remediation + monthly regression | home latest import is not a daily aggregate | I-R1〜R8 |
| confirmation dialog | design-system AlertDialog, discontinue dialog, existing overwrite dialog | addition warning/dialog | backup restore remains destructive replacement | M-D5/I-U* |

## Negative Paths

- missing input: existing file-count/parse validation unchanged; no confirmation without valid preview。
- invalid input: confirmation true with NoDuplicate or AlreadyImported -> validation failure。
- duplicate/ambiguous input: exact hash hard block; distinct hash requires summary confirmation; semantic duplicate remains explicit residual risk。
- unknown reference: rollback unknown ID -> NotFound; no date-wide fallback。
- dependency missing: DB/query error -> no commit/rollback partial state。
- permission/write failure: TX rollback, preview/result retained according to current retry contract。
- dry-run side effect: preview and confirmation cancellation must write nothing。

## Boundary Checks

- threshold: active same-date list empty versus non-empty; list long enough to require scroll。
- null/default: daily gross/net and optional quantity/count all-present versus one NULL; NoDuplicate list empty。
- empty/non-empty: no official parent -> None; two active parents -> combined Some; rollback one -> remaining Some; rollback all -> None。
- min/max: signed return quantities/amounts; zero amount/quantity; JS number compatibility unchanged。
- status/policy enum: every new variant exhaustively handled; old variant absent after regeneration。
- wire type: `same_date_imports[]`, `additionalImportConfirmed`, `source_import_count` producer/consumer match。
- internal type: cached ordered ID snapshot is not frontend supplied。
- producer/consumer: specta Rust -> bindings -> hooks/pages。
- round-trip token: preview token success delete / failure retain / snapshot mismatch requires replacement token。
- precision/range: i64/usize generated convention unchanged; negative money preserved。
- cross-language parse: snake_case struct fields and camelCase command args remain generator-owned。

## Compatibility Checks

- old schema/input: existing csv/daily_report rows require no migration; rolled_back rows stay excluded。
- new schema/input: no new table/index/constraint。
- output order: same-date summaries date/time/id deterministic; grouped report rows deterministic by sort/id representative。
- optional field behavior: NULL completeness rule is explicit; filenames derived from stored metadata, missing/corrupt metadata fails safely rather than inventing a name。
- mixed binary: old frontend/new backend is not supported; app bundle updates producer/consumer together。

## Data Safety Checks

- source-derived data: issue URL/shape only; no raw store data copied。
- generated outputs: bindings generated in implementation PR, not edited manually。
- secrets: none; `gh` output must not be pasted wholesale if it contains unrelated/private detail。
- local-only files: `.local/**`, app DB/backups/logs remain ignored。
- synthetic sample boundaries: same-date multi-import fixtures use synthetic filenames/products/dates/amounts。

## Main Wiring / Integration Checks

- helper connected to main path: parse duplicate context reaches cached preview and UI, commit consumes cached snapshot。
- output reaches report: commit/rollback invalidation reaches daily/monthly queries and visible combined/remaining totals。
- effective config reaches runtime: not applicable, config unchanged。
- CLI arg reaches implementation: generated `additionalImportConfirmed` reaches Rust `additional_import_confirmed` without hand bridge drift。

## Mutation-style Adequacy Questions

- Flip distinct-hash branch back to rollback: I-B3/I-B6 stock/status assertions fail?
- Remove exact-hash recheck inside TX: which concurrent duplicate test fails? I-B2。
- Ignore snapshot mismatch: which no-side-effect assertion fails? I-W5。
- Keep only first same-date import in DTO: which multi-row UI assertion fails? I-U2/I-U4。
- Change `source_import_count` to constant 1: which UI/BIZ assertion fails? I-R2/I-R5。
- Drop one active parent from gross/net: which independent per-parent values prove the sum source? I-R1。
- Merge manual and auto product rows: which source-preservation assertion fails? I-R4。
- Roll back by date instead of ID: which remaining import/status/stock assertion fails? I-B6〜I-B9。
- Omit invalidation: which before/after refetch value assertion fails? I-U8。
- Reintroduce old term in active code/docs: which negative rg guard fails? M-D3/I-G1。
- Change archive docs during sweep: which archive diff guard fails? M-D8。

## 実装 PR への予約（本 design の Ledger 対応）

以下は後続 implementation packet/matrix が最低限持つ test 系列。予約名であり、本 design-first PR では test 実装しない。

| ID | Contract | 予約 test / evidence | Kill target |
|---|---|---|---|
| I-B1 | D1 exact hash | both parse paths: active same hash blocked; rolled_back hash allowed | hard block removal / rolled_back block |
| I-B2 | D1/D4 TX idempotency | both commit paths recheck same hash in TX | preview-after duplicate race |
| I-B3 | D1 additive Z004 | second same-date distinct hash leaves first import/sales/movements active and adds stock delta | implicit void/rollback |
| I-B4 | D1 additive daily | second bundle leaves first completed and both child rows present | old parent rolled_back |
| I-B5 | D4 confirmation/status | false required, true NoDuplicate, AlreadyImported, snapshot mismatch all fail with zero writes | bool/status bypass |
| I-B6 | D2 Z004 rollback | rollback second import only, first sales/movements/stock contribution remains | date-wide void |
| I-B7 | D2 Z004 rollback return | negative quantity movement correction only for selected import | sign inversion / cross-import stock change |
| I-B8 | D2 daily rollback | rollback one parent leaves other completed/visible, repeat idempotent | date-wide rollback |
| I-B9 | D2 logging/error | exact import ID in operation log; TX/log failure semantics unchanged | missing audit / rollback reversal |
| I-W1 | D3 generated enum | old variants/fields absent, new union/list fields present | stale generated binding |
| I-W2 | D3 Z004 summary | multiple existing imports return every ID/filename/count/amount/time in order | first-ID sampling |
| I-W3 | D3 daily summary | multiple existing imports return source filenames/gross/net/time in order | metadata omission |
| I-W4 | D3 command rename | generated camelCase reaches CMD/BIZ; internal contract test updated | overwrite bool drift |
| I-W5 | D4 snapshot lifecycle | active ID set added/removed/replaced after preview -> re-preview error, no insert/void | stale confirmation |
| I-U1 | D5 Z004 alert/dialog | exact shared title/description/actions and warning tone | old destructive overwrite dialog |
| I-U2 | D5 Z004 content | all existing rows + incoming filename/count/amount/time accessible | single ID display |
| I-U3 | D5 daily alert/dialog | same structure/actions as Z004; no checkbox-only path | adjacent drift |
| I-U4 | D5 daily content | all existing bundles + incoming files/gross/net/time accessible | partial summary |
| I-U5 | D5 cancellation | cancel/Esc retains preview and sends no command | accidental commit |
| I-U6 | D5 confirmation | confirm sends true once; exact hash remains disabled/blocked | double mutation / bypass |
| I-U7 | D7 rollback dialog | exact ID/date/files/amount + other-imports-remain wording | ambiguous target |
| I-U8 | D7 invalidation/retry | selected rollback failure retains state; success refetch shows remaining aggregate | stale cache / wrong retry ID |
| I-R1 | D6 official daily parent totals | two same-date active parents with distinct values sum gross/net | latest-only read |
| I-R2 | D6 official daily NULL | one parent NULL -> aggregate NULL; source_import_count still exact | partial sum masquerades complete |
| I-R3 | D6 line grouping | payment/department identities aggregate; deterministic label/order; unmatched warning de-duplicates | duplicate/missing lines |
| I-R4 | D6 product daily grouping | same product across two Z004 imports sums; manual/auto stay separate | duplicate UI rows / source merge |
| I-R5 | D6 daily UI | visible `N回の取込みを合算`; official and product sections remain separate | hidden multiple source / double total |
| I-R6 | D6 rollback read | after one rollback official/product aggregate equals remaining import only | rolled_back inclusion |
| I-R7 | D6 monthly regression | two same-date active daily parents both included in official monthly SUM | accidental DISTINCT/latest parent |
| I-R8 | D6 monthly coverage contract | future coverage uses distinct report_date, not parent count | same day counted twice as days |
| I-G1 | D8 sweep | active code/docs zero old sales-import terms; unrelated and archive hits unchanged | partial rename / broad replacement |

## Residual Test Gaps

- byte 違い同内容 file の semantic duplicate は automated oracle で完全識別できない。D5 の operator comparison は residual guard であり、絶対防止を test claim にしない。
- upstream が cumulative snapshot を出す将来変更は current field evidence 外。D-071 Revisit で adapter semantic mode を再設計する。
- Windows native L3 の要否は implementation packet で UI change の native-only observability を再判定する。backend correctness は automated tests で完結させる。
