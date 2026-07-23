# Test Design Matrix — 監査是正 順7: filesystem failure observability

Plan Packet:
[2026-07-24-filesystem-failure-observability.md](../2026-07-24-filesystem-failure-observability.md)

Status: plan-gate。owner承認前はproduction code未着手。

## Risk

Risk: R3

## Contracts Under Test

- SPEC-MNT-FS-ERR-01: NotFoundだけを正常空とし、判定/結果を変えるIO errorは返す。
- MNT-01-D6: restoreの補助cleanupはwarn継続、auto-backup entry errorと
  create/list metadata errorは既存Result境界へ伝搬する。
- MNT-01-D1/D4/D5: restoreの原子性・復旧variant・manifest durabilityは不変。
- MNT-04-D1: diagnostic logのtop-level read errorはNotFoundと区別し、
  個別entry/name/date/remove failureはwarn後に後続entryを継続する。
- test oracleはproductionのprefix/定数/helperをimportせず、synthetic filename、
  expected error kind、visible log anchorを独立転記する。

## Failure Modes

- F1: initial manifest write失敗後のtemp remove failureが無記録で残る。
- F2: auto-backup entry errorが消え、今日のbackupなしと誤判定して新規backupを作る。
- F3: create metadata errorを`size_bytes=0`成功として返し、成功operation logを記録する。
- F4: list metadata errorを`size_bytes=0`のpartial/inaccurate rowとして返す。
- F5: diagnostic log dirのpermission/metadata errorを不存在扱いしてcleanupをskipする。
- F6: diagnostic個別entry errorを無言skipし、障害の存在を観測できない。
- F7: non-Unicode filename / invalid calendar dateを無言skipする。
- F8:個別failureをerror化しすぎ、後続eligible entryのcleanupまで中断する。
- F9: restore warn是正がRecovered→Unrecoverable等へvariant/復旧semanticsを変える。

## Test Matrix

既存testの実在は現HEADで`rg`とtargeted baselineを確認済み。

| ID / Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| R1 / MNT-01-D6(a), D1/D4/D5 | F1,F9 | unit + mock failure injection | `test_restore_req901_manifest_temp_cleanup_failure_warns_and_preserves_recovered_error` | remove failureがsilent、元のmanifest write error/Recoveredがcleanup errorへ置換、file mutationへ進む |
| B1 / MNT-01-D6(b) | F2 | unit + injected entry iterator | `test_check_auto_backup_req901_entry_error_propagates_without_creating_backup` | entry Errをskipしてcreate/cleanupへ進む |
| B2 / MNT-01-D6(c) | F3 | unit + metadata failpoint | `test_create_backup_req901_metadata_error_propagates_without_success_log` | `.unwrap_or(0)`へ戻りsuccess result/logを返す |
| B3 / MNT-01-D6(d) | F4 | unit + metadata failpoint | `test_list_backups_req901_metadata_error_propagates` | size 0のBackupInfoを返す、またはentryをsilent skip |
| B4 / existing top-level contract | regression | existing unit（変更禁止） | `test_check_auto_backup_req901_read_dir_error` | top-level other IO errorをempty扱いに戻す |
| B5 / MNT-01 §71.5 | F8 | existing unit（変更禁止） | `test_cleanup_old_backups_req901_warns_and_continues_on_delete_failure` | remove failureで全体中断、warn消失、後続fileを削除しない |
| D1 / MNT-04-D1(a) | F5 | unit + real fs boundary | `test_cleanup_req700_distinguishes_not_found_from_read_dir_error` | catch-allでnot-a-directory/permission errorもOk(0)にする |
| D2 / MNT-04-D1(b) | F6,F8 | unit + injected entry iterator | `test_cleanup_req700_entry_error_warns_and_continues` | entry Errをsilent continue、または後続eligible fileを処理しない |
| D3 / MNT-04-D1(c) | F7,F8 | unit + synthetic owned filename | `test_cleanup_req700_invalid_calendar_date_warns_and_continues` | parse Errをsilent continue、または後続eligible fileを処理しない |
| D4 / MNT-04-D1(c) | F7 | cfg-aware unit | `test_cleanup_req700_non_unicode_filename_warns_and_continues` | non-Unicode entryをsilent skip。非対応platformはhelper-level oracle |
| D5 / MNT-04-D1(d) | F8 | unit + real fs trick | `test_cleanup_req700_delete_failure_warns_and_continues` | matching directoryへのremove_file failureをsilent化/全体中断 |
| G1 / integration | scope drift | CLI/generated | traceability check + bindings diff 0 | REQ mapping/DTO/wireへ未計画変更が入る |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| restore manifest temp | absent | write/sync/rename | canonical active | N/A | N/A | residual tempは起動T0対象 | reconcile T0 | write失敗+remove失敗はRecovered+WARN | 再起動後cleanなら再実行 | R1 + existing reconcile suite |
| auto-backup scan | enabled | read_dir/entry列挙 | exact today setでcreate/skip判定 | N/A | 60秒timer/起動 | same dir再走査 | 起動時再試行 | entry errorはErr、副作用なし | 次tick/再起動 | B1/B4 |
| backup create result | no new file | VACUUM INTO | metadata成功後にresult/log | N/A | listで再読取 | fileはdirに残る | 次起動でscan | metadata Err時file残置可能、成功宣言なし | operator/auto retryで重複可能 | B2 + review |
| backup list | directory contents | entry/metadata走査 | complete Vec | N/A | query再実行 | UI再訪 | app再起動 | metadata Errでpartial listなし | same command retry | B3 |
| diagnostic cleanup | log dir | entry走査 | eligible files削除 | N/A | N/A | 次起動 | 起動時毎回 | top-level Errはcaller WARN、個別ErrはWARN継続 | 次起動cleanup | D1-D5 |

UI、cache、route/search、import/export stateは非接触。上表はfilesystem/retry stateを
初期/処理中/成功/失敗/再試行まで固定する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `let _ = Result` | `src-tauri/src/mnt/**` | restore S1 | test code以外のhitなし | sweep + R1 |
| `.ok()` / `filter_map` | `src-tauri/src/mnt/**` | backup S2 | filename/date validator、MNT-02 parseはScope表で除外 | sweep + B1 |
| `Err(_) => continue` | `src-tauri/src/mnt/**` | diagnostic S6-S8 | restore log分類はMNT-01-D5契約 | sweep + D2-D4 |
| filesystem catch-all | metadata/read_dir/exists/remove全site | S3-S5 | Option pattern mismatchはerrorでない | B2/B3/D1 |
| warn + continue precedent | backup cleanup delete failure | diagnostic + restoreへ適用 | restore committed cleanup既存warnは非変更 | B5/D5/R1 |
| failure injection | `RestoreFileOps`, backup real-fs trick, `test_tracing` | R1/B1-B3/D1-D5 | full diagnostic traitは不採用 | concrete generic signature + same-path review |

## Negative Paths

- missing input: nonexistent directoryはNotFoundとして空/0。
- invalid input: prefix不一致は正常skip。owned prefix/shapeのinvalid dateはwarn skip。
- duplicate/ambiguous input: 同日backup複数は既存判定不変。
- unknown reference: non-Unicode filenameはpath contextでwarn、削除対象にしない。
- dependency missing: N/A、新dependencyなし。
- permission/write failure: top-level read error伝搬、remove error warn継続。
- dry-run side effect: mutation実測はtracked mutantをcommitせずexact復元。

## Boundary Checks

- threshold: `age_days > retention_days`既存境界不変。
- null/default: NotFound/未設定dirとother IO errorを分離。
- empty/non-empty: 空dir、entry Errのみ、Err+有効entry、有効entryのみ。
- min/max: `size_bytes: u64`。unknownを0 sentinelへ変換しない。
- status/policy enum: `RestoreError::Recovered`維持。
- wire type: `BackupResult` / `BackupInfo` / `CmdError`不変。
- internal type: `DbError::QueryFailed` / `io::Error`。
- producer/consumer: std fs → MNT → lib/CMD既存caller。
- round-trip token: literal `inventory_backup_YYYYMMDD_HHMMSS.db` /
  `app.YYYY-MM-DD`をtestへ独立転記。
- precision/range: metadata lenの正確値、0 fallback禁止。
- cross-language parse: bindings shape不変。

## Compatibility Checks

- old schema/input: DB schema非接触。
- new schema/input: なし。
- output order: list sort順不変。
- optional field behavior: なし。
- NotFound: existing empty behavior維持。
- restore: D1/D4/D5 existing suite全green。
- startup: diagnostic cleanup Errでもlibの既存warn + 起動継続。

## Data Safety Checks

- source-derived data: 使用禁止。
- generated outputs: traceabilityはgenerator管理、bindings diff 0。
- secrets: `.env*` / credentials非読取。
- local-only files: `target/` / `.local/` / tempdir artifacts非commit。
- synthetic sample boundaries: file content、日付、pathはtest内synthetic。

## Main Wiring / Integration Checks

- helper connected to main path: public `check_auto_backup` / `create_backup` /
  `list_backups` / `cleanup_old_log_files` / private production restore pathがhelperを使用。
- entry injection same-path: public production関数とfailure-injection testが
  function-design記載の同一generic helperを呼び、production-only/test-only loopがない。
- output reaches manifest/report: restore variant/log、backup Result/operation logをassert。
- effective config reaches runtime: retention/prefix既存configを使用。
- CLI arg reaches implementation: existing CMD/lib callerをdiff review、shape変更なし。

## Mutation-style Adequacy Questions

- X1: S1を`let _ = remove_if_exists(...)`へ戻す → R1のWARN assertionがred。
- X2: S2を`.filter_map(|e| e.ok())`へ戻す → B1がErr/副作用oracleでred。
- X3: S3をmetadata `.unwrap_or(0)`へ戻す → B2がErr/log不在oracleでred。
- X4: S4をmetadata `.unwrap_or(0)`へ戻す → B3がErr oracleでred。
- X5: S5をcatch-all empty（または`exists()==false`早期return）へ戻す →
  D1のother-error branchがred。
- X6: S6のWARNを削除してsilent continueへ戻す → D2は後続削除がgreenでも
  WARN assertionでred。
- X7: S8のWARNを削除してsilent continueへ戻す → D3は後続削除がgreenでも
  WARN assertionでred。
- non-Unicode branchはplatformで実file作成可否が異なる。D4をhelper-levelで固定し、
  mutation実測の必須集合はX1-X7とする。
- mock accidental constantをどう防ぐか: production prefix、default retention、
  log message定数をimportせずliteral path/error kind/operation typeを転記する。
- output order changes: existing sorted list test。
- dry-run side effect: 各mutant復元後にtargeted green + clean status。

## Mutation 感度実測手順

実装/testをcommitしたclean baselineだけで行う。各X1-X7について:

1. `git status --short` 空を確認。
2. Matrix記載のproduction mutantを1件だけ注入。
3. 対応する単一test（必要時はmodule test）を実行しnonzero/redを保存。
4. 対象fileをbaseline exact contentへ復元。
5. 同test green、`git status --short` 空を確認してから次へ進む。

test countはtracked docsへ転記せず、exact command / exit / failure anchor / baseline SHAを
PR body evidenceへ記録する。harness上判別不能なmutantが出た場合はkillと主張せず、
Matrixの防御手段/残余gapをamendしてownerへ戻す。

## Residual Test Gaps

- `ReadDir` entry errorはreal filesystem timingで安定再現できないため、
  production iterator helperへErrを注入する。OS kernelの全列挙挙動は試験しない。
- create metadata error後、VACUUM生成fileが残り次回retryでbackupが増える可能性がある。
  これは不正確な成功を返さない代償としてowner判断点に残す。
- non-Unicode filenameの実filesystem再現はplatform差がある。production helperの
  WARN分岐をtestし、Windows/Linux双方のnative filename semantics全体は保証しない。
- tracing subscriber自体が利用不能なinit失敗時のwarn永続化はMNT-04初期化契約の
  既存escape hatchであり、本scopeでは扱わない。
