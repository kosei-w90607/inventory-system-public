# Test Design Matrix: 同日複数精算の冪等取込み実装

## Risk

Risk: R3

## Contracts Under Test

- D-071 / SPEC-SDI-D1: active content hash identity、same-date distinct hash additive admission。
- SPEC-SDI-D2: explicit per-import rollback + separate re-import。
- SPEC-SDI-D3: new duplicate enums、all same-date summaries、`additional_import_confirmed`、generated bindings。
- SPEC-SDI-D4: preview snapshot-bound confirmation、hash-first / snapshot-second TX recheck、retry/token lifecycle。
- SPEC-SDI-D5: adjacent Z004/daily addition confirmation UI with exact Japanese wording。
- SPEC-SDI-D6 / D-025: all-active same-date aggregate、NULL completeness、group identity、official/product series separation。
- SPEC-SDI-D7 / D-052: per-import rollback display/list/invalidation/refetch。
- SPEC-SDI-D8: active stale vocabulary closure and I-W4 split-pin reunification。

## Failure Modes

- 同日別 hash の second commit が先行 import / sale / movement / report lines を void / rollbackする。
- exact hash が confirmation や stale preview を経由して二重commitされる。
- preview後にactive same-date ID集合が追加・削除・置換されてもold snapshotでcommitする。
- summaryがlatest 1件だけ、順序不定、filename metadata欠損を捏造、またはhashをoperator wireへ露出する。
- statusとboolが不整合でもwriteする、snapshot mismatch後に同じtokenをblind retryする。
- rollbackが日付単位、返品補正の符号が逆、同日の他importのstock/reportまで変える。
- official dailyがlatest parentのみ、nullable値を部分SUM、同じ未対応部門をimport回数分警告する。
- daily productが同商品同sourceを未集約、またはauto/manualを混ぜる。
- UIが旧上書き語彙、checkbox-only、first IDだけ、cancel commit、double submit、曖昧rollback targetを残す。
- invalidation不足でrollback後も取消前aggregateが表示される。
- monthly queryが同一日2parentの片方を落とす、または将来coverageをparent countで数える。
- old oracleを削除するだけで新契約のdistinguishable fixture/oracleを追加しない。

## Test Matrix

全 test名は実装時のcanonical候補。既存 test の実在は plan-draft で `rg -n "^\\s*(fn test_|it\\(|test\\()"` により確認済み。各mutantはclean treeで1個ずつ注入し、対応testがredになることを独立再実測する。

| ID / Contract | Failure Mode | Test Type | Test Name | 注入する mutant | Oracle / Would fail if... |
|---|---|---|---|---|---|
| I-B1 / D1 | active hashを許可、rolled_back hashを拒否 | Rust integration | `test_parse_req401_active_hash_blocked_rolled_back_hash_allowed_both_pipelines` | blocking queryからstatus filterを除去、またはactive hitを`None`扱い | Z004はactive bytes error / rolled_back preview成功、dailyはAlreadyImported / rolled_back bundle preview成功を独立assert |
| I-B2 / D1/D4 | TX内same hash race | Rust integration | `test_commit_req401_rechecks_content_hash_before_snapshot_both_pipelines` | commitのhash recheckを削除またはsnapshot後へ移動 | preview後にsame hash active行を挿入し、Idempotency error、全table count/stock before=after、snapshot errorでないことをassert |
| I-B3 / D1 | Z004 second importがfirstをvoid | Rust integration | `test_commit_req401_same_date_additive_preserves_first_import_sales_movements_stock` |旧rollback/void branchを復活 | distinct quantities/amountsの2importが両status active、各sales/movement non-void、stock=initial-(q1+q2) |
| I-B4 / D1 | daily second parentがfirstをrolled_back | Rust integration | `test_daily_report_req401_commit_same_date_additive_keeps_both_completed_and_lines` |旧same-date rollback updateを復活 | 2parent completed、各3系列child残存、parent/line distinct値が両方読める |
| I-B5 / D4 | bool/status bypass | Rust integration | `test_commit_req401_confirmation_status_matrix_has_zero_writes_both_pipelines` |NoDuplicate trueまたはRequired falseを許可、AlreadyImportedを通す | 4分岐がValidation/Idempotency error、imports/sales/movements/lines/stock before=after |
| I-B6 / D2/D7 | Z004 rollbackがdate-wide | Rust integration | `test_rollback_req401_selected_same_date_import_only_preserves_sibling_contribution` |WHEREをimport_idからsettlement_dateへ変更 | secondだけrolled_back/void、first active/non-void、stockはfirst寄与分だけ減少状態へ戻る |
| I-B7 / D2 | return rollback sign inversion | Rust integration | `test_rollback_req401_selected_negative_return_reverses_only_return_contribution` |rollback補正の符号反転を削除または二重反転 | first sale + second negative returnのstockで、return rollback後だけreturn増加分が除かれfirst sale寄与が残る |
| I-B8 / D2/D7 | daily rollbackがsame-date siblingsを消す | Rust integration | `test_daily_report_req401_rollback_selected_parent_keeps_sibling_visible_and_is_idempotent` |repo rollback predicateをreport_dateへ変更 | selectedのみrolled_back、sibling completed、aggregate=sibling、repeatは同じresult/追加副作用なし |
| I-B9 / D2 | log ID欠落またはlog failureがbusiness rollback | Rust integration | `test_import_rollback_req401_logs_exact_selected_id_and_preserves_commit_on_log_failure` |detail IDをsibling IDにする、log errorでTXを戻す | operation log detail/summaryがselected ID、log failureでもbusiness status/stockは既定契約どおり |
| I-W1 / D3 | generated union/fields drift | Rust/CLI contract | `test_generated_bindings_req401_same_day_addition_wire_exact` |old variant/fieldをbindings fixtureへ戻す | generated fileがnew variants、summary arrays、`additionalImportConfirmed`、`source_import_count`をexactに持ちold symbols不在 |
| I-W2 / D3 | Z004 summaryがfirst-only/order不定 | Rust integration | `test_parse_req401_same_date_csv_summaries_include_all_fields_in_desc_order` |`same_date[0]`だけmap、ORDER BY削除 | distinct IDs/filenames/counts/amounts/timestampsの全件とdesc order、cached ID列一致 |
| I-W3 / D3 | daily filenames/totals欠落 | Rust integration | `test_daily_report_req401_same_date_summaries_include_all_files_totals_in_desc_order` |source_files_jsonをfirst filenameだけにする、NULLを0化 | 全parent、全filenames、gross/net nullable、time/order。corrupt metadataは安全側error |
| I-W4 / D3 | command rename片側drift / split pin残存 | Rust/TS contract | `test_import_internal_contract_req401_is_minimal` + `test_import_command_req401_additional_confirmation_reaches_biz` |Rust argだけ旧名、TS callを常にfalse、docs/code配列を分離のまま残す |単一field pin exact一致、generated camelCaseでtrueがCMD/cache/BIZ requestへ到達 |
| I-W5 / D4 | snapshot driftをblind commit/retry | Rust/CMD integration | `test_commit_req401_same_date_snapshot_add_remove_replace_requires_new_preview` |ID比較を削除、set比較にしてorder/replaceを見逃す、CMD tokenを保持 |add/remove/replace各caseがexact re-preview error、zero writes/voids/stock、old token cache miss、new previewのみcommit可 |
| I-U1 / D5 | Z004旧destructive dialog | RTL | `test_z004_req401_additional_import_alert_dialog_exact_wording_and_actions` |title/actionを旧「上書き」に戻す |55-ui exact Alert title/description、dialog title/common description、Badge、Cancel/追加actionが一致 |
| I-U2 / D5 | Z004 first IDだけ表示 | RTL | `test_z004_req401_additional_dialog_lists_all_existing_and_incoming_summaries` |`same_date_imports.slice(0,1)`、amount/count入替 |複数existingのID/file/count/amount/timeとincoming file/count/amount、scroll region到達をassert |
| I-U3 / D5 | daily checkbox-only/adjacent drift | RTL | `test_daily_report_req401_additional_import_uses_shared_dialog_exact_wording` |checkboxを復活、tab固有文言へ変更 |Z004と同じtitle/description/actions/Badge、checkbox不在、buttonからAlertDialogを開く |
| I-U4 / D5 | daily bundle summary partial | RTL | `test_daily_report_req401_additional_dialog_lists_all_existing_and_incoming_bundles` |first parentのみ、filenames/gross/net/timeの1 field削除 |複数existingの全files/gross/net/timeとincoming同順、NULLは未取得表示 |
| I-U5 / D5 | cancel/Escでcommit/preview消失 | RTL | `test_additional_import_dialog_req401_cancel_and_escape_keep_preview_without_command` |onOpenChange(false)でconfirmを呼ぶ、cancelでreset |両タブでcommand 0、preview内容/token state保持、dialogのみ閉じる |
| I-U6 / D5 | confirm二重送信/false送信/exact hash bypass | RTL/hook | `test_additional_import_req401_confirm_sends_true_once_and_blocks_exact_hash` |confirmをfalse、二重handler、AlreadyImported button enable |追加action1回でgenerated command true 1回、importing中disabled、AlreadyImported command 0 |
| I-U7 / D7 | rollback target曖昧 | RTL | `test_import_result_req401_rollback_dialog_identifies_exact_import_and_sibling_survival` |ID/file/amountを省略、他import残存文言を削除 |Z004/dailyのexact ID/date/files/amountと「この取込みだけ…他…残ります」exact text、selected ID call |
| I-U8 / D7/D-052 | failure state消失 / invalidation不足 | hook integration | `test_import_rollback_req401_failure_retries_same_id_success_refetches_remaining_aggregate` |failureでidleへ、別ID retry、daily/monthly/list/detail keyを1つ除外 |failure後result/ID保持、retry same ID、success exact D-052 oracle、refetch mockがremaining totalを表示 |
| I-R1 / D6 | official daily latest-only | Rust repo/BIZ | `test_get_completed_daily_report_aggregate_req501_sums_two_same_date_parents` |`ORDER BY id DESC LIMIT 1`復活 |distinct parent gross/net/payment/department値の和、`source_import_count=2` |
| I-R2 / D6 | NULLをpartial sum/0で偽装 | Rust repo/BIZ | `test_get_completed_daily_report_aggregate_req501_propagates_parent_and_line_nulls` |SQLを`SUM(COALESCE(...,0))`へ |一親/一行NULLでaggregate NULL、non-null fieldsは合算、source countは正確 |
| I-R3 / D6 | grouping/representative/warning重複 | Rust repo/BIZ | `test_get_completed_daily_report_aggregate_req501_groups_identities_deterministically` |department NULLを一括group、labelをlatest row、warningをrow数化 |payment_key、department_id、normalized/raw fallback別group、min sort/id label、unmatched group数の単一warning |
| I-R4 / D6/D-025 | product rows未集約/auto-manual混合 | Rust repo/BIZ | `test_get_daily_sales_records_req501_sums_product_and_source_across_imports` |GROUP BYからsource削除、SUMなし |same product auto 2rowsを1row合算、manualは別row、voided除外、grand/subtotalも同値 |
| I-R5 / D6 | source count非表示/cross-series total | RTL | `test_daily_sales_page_req501_shows_source_import_count_without_cross_series_sum` |countを1固定、official+productをsummaryへ加算 |`2回の取込みを合算`、official/product見出し別、各distinct total、NULL「未取得」 |
| I-R6 / D6/D7 | rolled_back寄与残存 | Rust + hook/RTL | `test_daily_sales_req501_after_selected_rollback_returns_remaining_import_only` |status/is_voided filter削除、cache refetch省略 |official/product各fixtureでrollback後aggregate=siblingのみ、UI refetch表示もremaining値 |
| I-R7 / D6 | monthly same-date片方欠落 | Rust repo regression | `test_get_monthly_official_department_totals_req502_includes_two_same_date_parents` |DISTINCT date parent、latest-parent subqueryを導入 |同一report_dateのdistinct valuesが両方SUM、rolled_back thirdは除外 |
| I-R8 / D6 | future coverageをparent count化 | Static contract | `test_sales_design_req502_future_coverage_counts_distinct_report_dates` |source anchorを`COUNT(*)`へ変更 |24 §14.22 / 34 §19.4の`COUNT(DISTINCT report_date)` exact pin。runtime DTO追加はしない |
| I-G1 / D8 | old sales-import vocabulary残存/広域誤置換 | CLI regression | `test_active_sales_import_vocabulary_sweep_i_g1` |active対象へold tokenを1つ再導入 |test 内蔵の token sweep（外部 binary 非依存の file walk + literal 検索。hosted runner に rg が無く fail した 2026-08-16 の教訓で tool 非依存化）が active Rust/TS/tests/generated で 0。archive/unrelated product-stocktake-restoreはdiffなし |

## Oracle Replacement Map

| Existing test / oracle | Disposition | New ID / reason |
|---|---|---|
| `test_commit_req401_overwrite_flow` | rename + expected DB stateを「first rollback後secondのみ」から「first+second active/stock cumulative」へ置換 | I-B3。旧oracleはD-071に反するため削除でなく新契約へ反転 |
| `test_commit_req401_overwrite_not_confirmed` | error kind/messageとzero-writeをadditional confirmationへ置換 | I-B5 |
| `test_commit_req401_toctou_check` | hash-first conflictとして維持・強化 | I-B2 |
| `test_commit_req401_settlement_date_toctou` | 同日存在自体のerrorからordered snapshot mismatchのadd/remove/replaceへ拡張 | I-W5 |
| `test_commit_req401_overwrite_confirmed_without_duplicate` | `additional_import_confirmed=true` + NoDuplicate ValidationFailedへrename | I-B5 |
| `test_parse_and_validate_req401_settlement_date_overwrite` | full `same_date_imports` summary/order oracleへ置換 | I-W2 |
| `test_parse_and_validate_req401_no_duplicate` | `same_date_imports=[]` oracleへ置換 | I-W2 |
| `rollback_tests.rs` normal/idempotent/stock |既存single-import oracle維持 + same-date sibling/return fixtures追加。assert削除なし | I-B6 / I-B7 / I-B9 |
| `test_daily_report_req401_overwrite_required_for_same_date_different_bundle` | new enum + all summary fields/orderへ置換 | I-W3 |
| `test_daily_report_req401_commit_overwrite_rolls_back_old` | both completed/child rows preservedへoracle反転 | I-B4 |
| `test_daily_report_req401_commit_overwrite_unconfirmed_validation_failed` | new status/flag + zero-writeへ置換 | I-B5 |
| `test_daily_report_req401_stale_overwrite_preview_same_bundle_conflicts` | same hash conflictをI-B2に保持し、snapshot driftをI-W5へ分離 | I-B2 / I-W5 |
| `test_daily_report_req401_rollback_idempotent_and_no_stock_change` |在庫非変更/idempotent維持 + sibling visibility/log exact ID | I-B8 / I-B9 |
| sales_repo `test_get_latest_completed_daily_report_*` | aggregate function名へrenameし、latest-only/after-overwrite oracleをsum/NULL/remainingへ置換 | I-R1〜I-R3 / I-R6 |
| `DailyReportImportPage.test.tsx` overwrite checkbox/warning | shared dialog exact wording + content/cancel/confirmへ置換 | I-U3〜I-U6 |
| csv/daily reducersの`overwriteConfirmed` payload | field rename後もsnapshot carry exact assert維持 | I-W4 |
| csv/daily hook commit call tests | generated arg false/true とtoken/invalidationをassert | I-W4 / I-W5 / I-U6 / I-U8 |
| result rollback page/hook tests | dialog target metadata + sibling wording + same-ID retryを追加 | I-U7 / I-U8 |
| `test_daily_sales_page_official_without_items_req501` / warning fixtures | singular IDを削除しcount表示、NULL/group warningを追加 | I-R2 / I-R3 / I-R5 |
| monthly repo/Page official totals tests | same-date 2parent fixtureを追加、visible total維持 | I-R7 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| exact hash import | active hitなし | parse / TX recheck | rolled_back hashならnew preview/commit | success token delete + report/list keys | aggregate/list更新 | active hashは常時block | rolled_back後new preview | ImportError / AlreadyImported / IdempotencyConflict、zero write | same active bytesはblockのまま | I-B1/I-B2 |
| distinct hash same date | active summaries取得 | Alert/Dialogで比較 | insert-onlyでold/new active | D-052 commit keys | aggregateに両方 | 次のdistinctも再確認 | new preview token | cancel/validation errorはno write | current snapshotで再confirm | I-B3/I-B4/I-B5/I-U1〜U6 |
| preview snapshot | ordered IDs cache | operator確認中 | TX IDs exact match後insert | success or mismatchでtoken delete | new previewがlatest summaries | add/remove/replace | file selectionからpreview | exact message + zero side effect | old token不可、新tokenのみ | I-W5 |
| per-import rollback | selected ID/result snapshot | rollback TX | selectedのみlogical invalidation | D-052 rollback keys | remaining aggregate | rollback済みrepeatは冪等 | resultからsame action | failureはresult/ID保持 | same ID | I-B6〜B9/I-U7〜U8/I-R6 |
| daily report read | active parents 0/1/複数 | query | same series aggregate + count | import/rollback | latest active values | rollback allでNone | page再訪もquery | DB errorはerror state | same date query retry | I-R1〜R6 |
| implementation workflow | plan-draft | Plan Gate | plan-approved後のみcode | content candidateでL1 | reviewでLedger再検証 | findingはimplementingへ | exact HEAD再検証 | design gapはdesignへ戻る | gated amendment後re-review | packet Workflow State |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| sales import duplicate flow | Z004 PreviewStep/dialog/hook/reducer + daily page/hook/reducer | shared AdditionalImportConfirmDialog、両tab state/flags | product import duplicateはrow UPDATEで別contract | I-U1〜I-U6 / I-G1 |
| hash idempotency | both `find_blocking_*_hash`、parse、commit | both pipelinesのpreview/TX | `LIMIT 1` existence guardは正しいため維持 | I-B1/I-B2 |
| snapshot retry | both cached preview、CSV CMD cache、daily CMD cache | add/remove/replace、exact token破棄 | ordinary DB failureはsame token retryを維持 | I-W5 |
| per-import rollback | both BIZ rollback、repo void/status、result dialogs、hooks invalidation、list order | exact selected ID + remaining aggregate | new history routeなし | I-B6〜B9/I-U7〜U8/I-R6 |
| report aggregation | daily product/official、monthly product/department/official、DailySales/MonthlySales | daily remediation + monthly regression | home latest import dateはaggregateでない | I-R1〜I-R8 |
| confirmation accessibility | shared shadcn AlertDialog、warning Alert、scroll region | both tabs | backup restoreはdestructive replacementのため不変 | I-U1〜I-U6 + visual confirmation |
| D-052 invalidation | csv/daily commit+rollback hooks and oracle helper | existing exact key setsを維持 | unrelated product import invalidationなし | I-U8 |

## Negative Paths

- missing input:既存file count/size/parse validationを維持し、有効previewなしではdialog/commitしない。
- invalid input: NoDuplicate+true、Required+false、AlreadyImported、expired token、unknown enumをwrite前に拒否。
- duplicate/ambiguous input: exact hash hard block。distinct hashは全summary確認。semantic duplicateは残存リスクとして自動blockを主張しない。
- unknown reference: rollback unknown IDはNotFound。date-wide fallbackなし。
- dependency missing: DB/query/source_files_json parse failureはinsert/voidなし。
- permission/write failure: TX rollback。operation log best-effort境界は既存契約どおり。
- dry-run side effect: preview、dialog open/cancel/Esc、snapshot mismatchはwrite 0。

## Boundary Checks

- threshold: same-date list 0 / 1 / scrollが必要な複数。固定表示件数上限を新設しない。
- null/default: gross/net/payment count/department quantity/countのall present / one NULL。NoDuplicate list empty。
- empty/non-empty: no active parent -> None、two active -> Some count 2、one rollback -> remaining、all rollback -> None。
- min/max: signed return quantity/amount、zero quantity/amount、既存JS number convention。
- status/policy enum: every new variant exhaustively handled、old variants absent。
- wire type: summary arrays、new bool、source count exact。
- internal type: ordered ID snapshotはfrontend非送信。
- producer/consumer: specta Rust -> generated binding -> hooks/pages/fixtures。
- round-trip token: success delete、ordinary failure retain、snapshot mismatch delete + new preview。
- precision/range: i64 money signed、count non-negative、range policy不変。
- cross-language parse: Rust snake_case command arg -> generated camelCase、struct fieldsはgenerator contract。

## Compatibility Checks

- old schema/input:既存completed/partial/rolled_back rowsをmigrationなしで読む。rolled_back hashは再取込み可能。
- new schema/input: table/index/check/FK追加なし。
- output order: summaries `imported_at DESC, id DESC`、history date/time/id desc、group代表 min sort/min id。
- optional field behavior: any NULL -> aggregate NULL。metadata破損はfilename捏造なし。
- mixed binary:非対応。Rust/TS/generatedを同一commitで切替える。

## Data Safety Checks

- source-derived data: D-071とanonymized design shapeのみ。issue/raw attachmentをfixtureへ複製しない。
- generated outputs: bindings/traceabilityをhand editしない。
- secrets: `.env*`、credentials、auth、keysを読まない/commitしない。
- local-only files: `.local/**`、app DB/backups/logs、L1 evidence。
- synthetic sample boundaries:架空の日付、filenames、products、hash、互いに異なるamount/countでoracleを独立させる。

## Main Wiring / Integration Checks

- helper connected to main path: active query -> BIZ summary/cache -> CMD token -> UI -> commit recheck。
- output reaches report: commit/rollback -> D-052 invalidation -> daily/monthly query -> visible combined/remaining totals。
- effective config reaches runtime: N/A、config不変。
- CLI arg reaches implementation: generated `additionalImportConfirmed` reaches both CMD/BIZ without hand bridge。

## Mutation-style Adequacy Questions

- distinct-hash branchへ旧rollbackを戻すとI-B3/I-B4のstatus/stock/line oracleがredになるか。
- hash recheckをsnapshot後へ移すとI-B2がerror kind/orderでredになるか。
- snapshotをset比較やfirst ID比較に弱めるとI-W5のreplace/order fixtureがredになるか。
- summaryをfirst rowへ切るとI-W2/I-W3/I-U2/I-U4がredになるか。
- confirm actionをfalseまたは2回送信にするとI-U6がredになるか。
- rollback predicateをdateへ広げるとI-B6/I-B8のsibling oracleがredになるか。
- return補正符号を反転するとI-B7の独立stock値がredになるか。
- official SQLに`LIMIT 1`を戻すとI-R1、COALESCEを入れるとI-R2がredになるか。
- group labelをlatestへ変える、未対応warningをrow数にするとI-R3がredになるか。
- daily product GROUP BYからsourceを外すとI-R4がredになるか。
- `source_import_count`をconstant 1にするとI-R1/I-R5がredになるか。
- D-052 keyを1つ削るとI-U8の独立oracleがredになるか。
- old tokenをactive codeへ戻すとI-G1、片側renameだとI-W4がredになるか。
- archive/unrelated overwriteを変えるとscope diff auditが検出するか。

## Residual Test Gaps

- byte違い同内容fileのsemantic duplicateは自動testで完全識別不能。D5のoperator comparisonはresidual guardであり絶対防止ではない。
- upstream cumulative snapshot化は現契約外。証跡観測時にD-071 Revisitでadapterを再設計する。
- human visual confirmationは文言・階層・scroll到達を補う。Windows native L3実施要否はPlan Gate裁定待ち。
- operation log failure injectionが既存test seamで困難な場合は、production behaviorを弱めずtest seamの最小追加をPlan Gate後に実装する。新しい意味判断が必要なら停止する。
