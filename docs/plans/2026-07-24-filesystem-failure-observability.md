# Plan Packet — 監査是正 順7: filesystem failure の記録と判定変更 IO error の伝搬

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: 94f303b
- Amendments: c0fd2f0
- Coordinator: Sol（本 thread、scope 精査・design・packet・実装・検証・PR）
- Writer: Sol（Plan 承認後の単独 writer）
- Plan Reviewer: owner が起動する Sonnet 5 fresh context
- Final Reviewer: owner が起動する Sonnet 5 fresh context
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending Ready / merge。Windows native L3 は不要

- State Narrative（2026-07-24）: public-writer clone、期待 origin、clean `main`、
  基準 HEAD `508db72`、active packet 不在を確認し、fetch / checkout / pull で
  latest main を確定した。監査 P3-2 の現 HEAD drift と `mnt/` 全体の
  `let _ =` / `.ok()` / `Err(_) => continue` / catch-all fallback を sweep し、
  source design 更新、Plan Packet、Test Design Matrix を同じ plan-first content
  commit にまとめる。`kickoff -> spec-check -> design -> plan-draft -> plan-gate` を
  materialize するが、owner の Plan 承認前には production code を変更しない。

- State Narrative（2026-07-24、gated amendment）: Plan Review一次（Sonnet 5 fresh
  context）はP1=0 / P2=1 / P3=1、総評「承認可」。P2-1として
  `cleanup_log_entries<I>(config, today, entries) -> u32` と
  `collect_today_backup_names<I>(backup_dir, today_prefix, entries) -> Result<Vec<String>, DbError>`
  （`I: IntoIterator<Item = std::io::Result<PathBuf>>`）をsource design / packetへ追記し、
  productionとfailure-injection testが同一generic helperを通ることを固定した。
  P3-1としてMNT-02 retention parse fallbackの除外理由を「P3-1同型のconfig parse
  fallback（R2/M相当）の別是正単位」へ訂正した。amendment commitは`c0fd2f0`。

- State Narrative（2026-07-24、state-only）: ownerはJ1-J7を全件承認し、J7は
  `c0fd2f0`反映を条件としてPlan承認した。元のplan-first commit `94f303b`を
  `Plan Commit`へ固定し、amendmentを`Amendments`へ追記する。
  `plan-gate -> plan-approved -> implementing`を隣接forward transitionとして
  materializeし、Sol単独writerのproduction実装を開始する。P1/P2レビュー条件、
  source design、Matrix、workflow gate evidenceはこのstate-only commitより前に存在する。

## Owner Effort Budget

- 介入回数上限: 3（Plan 承認 / Ready / merge）
- 実働時間上限: 30分
- relay 往復上限: 2

計算資源は本発注どおり制限しない。承認依頼は
`この change での介入 N 回目 / 予算 3 回` と利用者可視の完了1文を添える。

## Risk

Risk: R3

Reason:
`check_auto_backup` の entry 走査失敗を「本日の backup なし」から
`DbError::QueryFailed` へ変え、`create_backup` / `list_backups` の metadata
失敗も成功値 `size_bytes=0` へ変換せず上位へ返す。これは既存 MNT Result 契約、
自動 backup の実行判定、CMD が受け取る runtime behavior を変えるため R2 ではない。
一方、restore は失敗済み manifest temp の best-effort cleanup に warn を追加する
だけで、MNT-01-D1/D4/D5 の原子性・復旧 semantics・`RestoreFileOps` 契約を変えない。
削除対象・保持日数・DB snapshot・利用者向け文言・wire shapeも変えないため、
destructive lifecycle / restore semantics 変更を伴う R4 には上げない。

想定労力は監査時の S から **M** へ再見積りする。理由は現 HEAD sweep で
metadata fallback 2箇所と diagnostic log の top-level existence fallback が追加され、
entry 単位失敗を OS 非依存で決定論注入する internal helper 設計が必要になったため。
full filesystem trait は導入せず、既存 `RestoreFileOps` と最小の iterator / test hook
で抑える。

## Goal

Goal Invariant:

### 最小完了条件

- 継続可能な個別 filesystem failure は、対象 path / entry / operation と error を
  `tracing::warn!` に残し、後続 entry または既存の復旧経路を継続する。
- backup の有無・一覧結果・成功結果を変える entry / metadata error は
  NotFound の正常な空状態と区別し、既存 Result 境界から上位へ返す。
- clean committed baseline で silent discard へ戻す各 mutant を、独立転記 oracle の
  failure-injection test が red にする。

### 失敗定義

- 対象 production code に filesystem Result の `let _ =` / `.ok()` /
  catch-all success fallback / 無記録 `Err(_) => continue` が残る。
- entry error 後に余分な自動 backup を作る、metadata error を
  `size_bytes=0` の成功として返す、または NotFound と permission/IO error を同一視する。
- restore の warn 追加が MNT-01-D1/D4/D5 の variant、rollback、manifest durability、
  再接続、`RestoreFileOps` の既存 failpoint semantics を変える。
- mutation を dirty tree で行う、指定 mutant が green のまま生存する、復元後の
  `git status --short` が空でない。

### 非目的

- 順8 / P3-4 の利用者向け error 表示、`CmdError` 文言、correlation ID の再設計。
- 順12 / CMD-11 service 境界への先回り。
- `check_auto_backup` top-level `read_dir` の既存 NotFound / other error 分岐と
  `test_check_auto_backup_req901_read_dir_error` の再変更。
- restore の原子性、復旧 snapshot、manifest phase、operation log 補完、wire kind の変更。
- MNT-02 の設定値 parse fallback、環境 filter、パス文字列化等、filesystem Result
  ではない隣接 fallback の同時是正。
- 既存 test の削除、skip、無効化、assertion 弱化。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

### 現 HEAD sweep と分類

基準 HEAD: `508db72`。監査 finding の旧行番号ではなく、現実装を実読した。

| ID | 現 HEAD | 失敗 | 現在 | 分類 / 提案 |
|---|---|---|---|---|
| S1 | `mnt/restore.rs:457` | initial manifest write 失敗後の temp remove 失敗 | `let _ =` で無記録 | **継続可能**。元の `RestoreError::Recovered` を維持し、error / path / cleanup 文脈を warn |
| S2 | `mnt/backup.rs:324` | `ReadDir` の個別 entry error | `.filter_map(|e| e.ok())` で「entry なし」化 | **判定変更**。`DbError::QueryFailed` を返し、backup 作成・cleanupへ進まない |
| S3 | `mnt/backup.rs:203-205` | 作成済み backup の metadata error | `size_bytes=0` で成功 | **判定変更**。成功結果と operation log を確定せず `DbError::QueryFailed` を返す |
| S4 | `mnt/backup.rs:286` | 一覧 entry の metadata error | `size_bytes=0` の行を返す | **判定変更**。partial / inaccurate list を返さず `std::io::Error` を返す |
| S5 | `mnt/diagnostic_log.rs:96` | log dir の metadata / permission error | `Path::exists()==false` で `Ok(0)` | **判定変更**。`read_dir` を直接 match し NotFound だけ `Ok(0)`、他は `Err` |
| S6 | `mnt/diagnostic_log.rs:106` | `ReadDir` の個別 entry error | 無記録 continue | **継続可能**。entry error を warn し、後続 entry を処理 |
| S7 | `mnt/diagnostic_log.rs:111` | entry filename の Unicode 変換失敗 | 無記録 continue | **継続可能**。path / reason を warn し、当該 entry のみ skip |
| S8 | `mnt/diagnostic_log.rs:122` | owned prefix/shape に一致する日付の calendar parse 失敗 | 無記録 continue | **継続可能**。filename / reason を warn し、当該 entry のみ skip |

### 明示除外した sweep hit

| 現 HEAD | 除外理由 |
|---|---|
| `backup.rs:128-146` の `.ok()?` | backup filename validator の期待された `Option::None` 変換。filesystem failure ではない |
| `backup.rs:359` の `Err(_)` | `backup_time` の利用者設定 parse。既に warn + 定時処理 skip |
| `backup.rs:380` の `.unwrap_or(false)` | filename pattern 不一致を false にする `Option`。error discard ではない |
| `restore.rs:538/555` | DB row / JSON 分類失敗を `LogClassification::Failed` に集約する MNT-01-D5 の明示契約 |
| `restore.rs:490/518` | non-Unicode path の文字列 fallback。filesystem `Result` 破棄ではなく、変更は restore 契約へ侵入する |
| `diagnostic_log.rs:72` | `RUST_LOG` 不正時の既定 filter。filesystem ではなく初期化前 fallback |
| `log_manager.rs:38-39` | `log_retention_days` parse fallback は filesystem P3-2 ではない。P3-1同型のconfig parse fallback（R2/M相当）として別是正単位に分ける |
| `migration.rs` / `mnt/mod.rs` | 対象 pattern なし |

### 実装方針

- S1 は既存 `RestoreFileOps` mock に manifest write failure + temp remove failure を
  同時注入し、外向き variant/message と復旧 semanticsを変えず warn だけ追加する。
- S2 は production / test が同じ
  `collect_today_backup_names<I>(backup_dir, today_prefix, entries) -> Result<Vec<String>, DbError>`
  （`I: IntoIterator<Item = io::Result<PathBuf>>`）を通る。test から entry error を
  決定論注入し、production-only collectorを作らない。top-level `read_dir` の
  既存分岐/testは変更しない。
- S3/S4 は既存 `SETTING_READ_FAILURE` と同型の test-only metadata failpointを
  production metadata helper の境界に置き、public `create_backup` /
  `list_backups` を通して検証する。production の Result shape / DTO は不変。
- S5-S8 は full trait を増やさず、top-level `read_dir` match と
  `cleanup_log_entries<I>(config, today, entries) -> u32`
  （`I: IntoIterator<Item = io::Result<PathBuf>>`）に分ける。production / test は
  同じhelperを通り、test iteratorへ `Err` と有効pathを並べてwarn後の後続削除を
  検証する。production-only / test-only cleanup loopを作らない。
- warn event は最低限 `error`、`path` または `file`、operation contextを持つ。
  利用者向け message / CMD mapping は変更しない。

## Non-scope

- `src-tauri/src/cmd/**`、frontend、Tauri command registration、generated binding。
- cleanup の保持期間、対象 filename、削除順、retry 間隔。
- operation log / diagnostic log の保存形式・表示導線。
- 新 crate、filesystem plugin、capability、DB schema / migration。
- real backup / DB / diagnostic log を fixture に使うこと。

## Acceptance Criteria

- AC1: `rg -n 'let _ =|filter_map\\(\\|e\\| e\\.ok\\(\\)\\)|Err\\(_\\) => continue|metadata\\(\\).*unwrap_or\\(0\\)|\\.exists\\(\\)' src-tauri/src/mnt` と final diffで、S1-S8 の silent path が0。Scope の明示除外は意味論を実読して維持する。
- AC2: S1 failure injectionで `RestoreError::Recovered` の元原因が維持され、temp remove failure の path / error / cleanup 文脈を含む WARN が記録される。
- AC3: S2 entry error injectionで `DbError::QueryFailed` が返り、synthetic backup dir の file setが不変（新規 backup / cleanup なし）。
- AC4: S3 metadata injectionで `create_backup` は `DbError::QueryFailed` を返し、`BackupResult(size_bytes=0)` と `backup_create` operation logを成功扱いで返さない。VACUUM が作った file の残置可能性は state matrix / reviewで確認する。
- AC5: S4 metadata injectionで `list_backups` は `std::io::Error` を返し、`size_bytes=0` の partial listを返さない。
- AC6: S5 は nonexistent dirのみ `Ok(0)`。not-a-directory / permission / other read errorは `Err` で、`lib.rs` の既存 callerが warnして起動継続する。
- AC7: S6 entry error injectionで WARN 後に後続の期限超過 synthetic logを削除し、S7/S8 の変換・calendar parse失敗も WARN + 当該 entry skipとなる。prefix不一致は正常非対象のため無警告。
- AC8: clean committed baselineで Matrix X1-X7を実装へ1件ずつ注入し、指定testが red。各 mutant は exact-file 復元後に targeted greenと `git status --short` 空を確認する。
- AC9: `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test` / `bash scripts/local-ci.sh full` がpassし、hosted CIはexact PR HEADでpass。
- AC10: `cd src-tauri && cargo run --bin generate_traceability -- --check` がpassし、`git diff origin/main -- src/lib/bindings.ts`が空。既存testの削除・skip・無効化が0。
- AC11: `bash scripts/doc-consistency-check.sh --target plan`がpassし、independent Plan ReviewerのP1/P2=0とowner承認後だけimplementationへ進む。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-700 / REQ-901
- Architecture: `docs/ARCHITECTURE.md` MNT-01 / MNT-04、
  `docs/architecture/mnt-task-specs.md`
- Function / command / DTO: `docs/function-design/70-mnt-diagnostic-log.md`
  MNT-04-D1、`docs/function-design/71-mnt-backup.md` MNT-01-D1/D4/D5/D6、
  `.claude/rules/implementation-quality.md` filesystem error handling
- DB: schema / transactionは非接触。operation log INSERTの既存順序を維持
- Screen / UI: 非接触。順8の表示 contract は non-scope
- Decision log / ADR: 新規 durable decisionなし。既存 function designへ昇格
- Finding: `docs/research/audit-2026-07/findings/p3-error-handling.md` P3-2、
  `docs/research/audit-2026-07/report.md` 順7

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend filesystem / error | `70-mnt-diagnostic-log.md` MNT-04-D1 / `71-mnt-backup.md` MNT-01-D6 | updated in plan-first commit |
| Command / DTO / generated binding | 既存 CMD-11 / bindings | intentionally unchanged、bindings diff 0 |
| DB / transaction / audit | MNT-01-D5 operation log ordering | existing sufficient、非変更 |
| Screen / UI / wording | 順8 P3-4 | intentionally deferred |
| CSV / report format | なし | 非接触 |
| Durable decision / ADR | function-design decision IDs | source docsへ記録、ADR不要 |

## Registration / Generation Obligations

新規 command / DTO / route / source doc / REQ は追加しない。
REQ-700 / REQ-901 test追加後に `cargo run --bin generate_traceability -- --check` を実行し、
必要なら generatorで `90-traceability.md` を同期する。bindings生成対象は非変更で
`src/lib/bindings.ts` diff 0を確認する。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-901 | 71 §71.4/6/7/8 | MNT-01-D6 | 「未観測成功」禁止。全entry abortやsize=0 fallbackを拒否 | `backup.rs`, `restore.rs` | Matrix B1-B4 / R1 |
| REQ-901 | 71 §71.7 | MNT-01-D1/D4/D5 | restore cleanup warnだけ追加し原子性variant不変 | `restore.rs:456-458` | R1 |
| REQ-700 | 70 §70.5 | MNT-04-D1 | NotFoundだけ空、個別entryはwarn継続、top-level IOは返す | `diagnostic_log.rs` | D1-D4 |
| P3-2 | quality rule §filesystem | MNT-01-D6 / MNT-04-D1 | catch-allと無記録破棄を遡及是正 | `mnt/` sweep | X1-X7 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。MNT-01-D6 / MNT-04-D1へ failure classification を記録
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: source docsへ昇格、plan-only decisionなし
- Assumptions and constraints: `ReadDir` entry errorは稀だがAPI contract上発生可能。testはOS timing/permission raceへ依存しない
- Deferred design gaps, risk, and follow-up target: `log_manager.rs` retention parse fallbackはP3-1同型のconfig parse fallback（R2/M相当）として別是正単位。順8表示、順12service境界は既定順
- Test Design Matrix can cite design decision IDs or source doc sections: yes
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: restoreはwarn追加のみ。diagnostic個別entryはbest-effort、backup判定/metadataはfail-fast。NotFoundのみ空

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | filesystem adapter内部のみ。CMD/UIへ規則を複製しない | MNT-01-D6 / MNT-04-D1 |
| Fact check / design decision split | 現HEAD実測と監査旧lineを分離。S1-S8を実読確定 | Scope表 |
| Lifecycle / retry | warn継続は次回cleanup/reconcile、error伝搬は次tick/operator retry | State Lifecycle Matrix |
| Operator workflow | UI文言不変。余分なbackup作成より判定失敗を選ぶ | owner判断点 J1 |
| Replacement path | 順12 service境界が本failure contractを維持継承 | Non-scope |
| Data safety / evidence | synthetic tempdirのみ。real DB/backup/log禁止 | Data Safety |
| Reporting / accounting semantics | 非該当 | N/A |
| Manual verification | deterministic Rust testsで観測可能、Windows L3不要 | Test Matrix |

## Design Readiness

- Existing design docs are sufficient because: architecture、MNT-01-D1/D4/D5、
  quality rule、CMD error境界は既存契約で足りる
- Source docs updated in this PR: `70-mnt-diagnostic-log.md` MNT-04-D1、
  `71-mnt-backup.md` MNT-01-D6
- Design gaps intentionally deferred: 順8、順12、MNT-02 retention parse fallback
- Durable decisions discovered in this plan and promoted to source docs: failure分類2件

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): MNT内で完結。既存CMD mappingのみ使用
- Backend function design: S1-S8のbefore/afterと継続/伝搬根拠をsource docsへ記録
- Command / DTO / data contract: shape不変、Result outcomeだけ変更
- Persistence / transaction / audit impact: schema/transaction不変。S3 error時はoperation log成功記録なし
- Operator workflow / Japanese UI wording: 不変
- Error, empty, retry, and recovery behavior: NotFound空、個別warn継続、判定error返却、次回retry
- Testability and traceability IDs: REQ-700 / REQ-901 + independent literal oracle

## Contract Probe

- N/A: 外部library / OS固有挙動を前提にしない。entry errorはproduction iterator helper、
  metadata errorはtest-only failpoint、restoreは既存 `RestoreFileOps` で注入する。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| MNT-01-D1/D4/D5 restore semantics不変 | `restore.rs:456-458` | R1 + existing restore suite | L3不要 |
| MNT-01-D6(a) initial manifest temp remove warn継続 | `restore.rs` | R1 | L3不要 |
| MNT-01-D6(b) auto-backup entry error伝搬 | `backup.rs` | B1 | L3不要 |
| MNT-01-D6(c) create metadata error伝搬 | `backup.rs` | B2 | residual fileをreview |
| MNT-01-D6(d) list metadata error伝搬 | `backup.rs` | B3 | L3不要 |
| MNT-01-D6(e) top-level NotFound / other | `backup.rs` existing branch | existing read_dir test（非変更） | non-scope regression |
| MNT-04-D1(a) NotFoundだけ空 | `diagnostic_log.rs` | D1 | L3不要 |
| MNT-04-D1(b) entry error warn継続 | `diagnostic_log.rs` | D2 | L3不要 |
| MNT-04-D1(c) filename/date failure warn継続 | `diagnostic_log.rs` | D3/D4 | invalid Unicodeはplatform gap記録 |
| MNT-04-D1(d) remove failure warn継続 | `diagnostic_log.rs` existing branch | D5 | L3不要 |
| `.claude/rules` filesystem catch-all禁止 | `mnt/` final sweep | static grep + X1-X7 | L3不要 |

Adjacent-contract sweep: touched 70 §70.5/70.8 と 71 §71.4-71.8/71.10 を実読し、
init_diagnostics、retention条件、backup filename filter、restore原子性、
CMD/UI表示、top-level check既存testを明示非変更とした。

## Test Plan

Test Design Matrix:
[2026-07-24-filesystem-failure-observability.md](test-matrices/2026-07-24-filesystem-failure-observability.md)

- targeted tests: `cargo test mnt::backup::tests` /
  `cargo test mnt::restore::tests` / `cargo test mnt::diagnostic_log::tests`
- negative tests: entry error、metadata error、NotFound以外の read_dir、
  manifest temp remove二重失敗
- compatibility checks: existing NotFound/cleanup/restore suites green、CMD/bindings shape不変
- data safety checks: tempdir + synthetic filenames/contentのみ
- main wiring/integration checks: public MNT functionsとproduction helperを通し、
  lib/CMD caller mappingをdiff review

## Boundary / Wire Contract

- producer: MNT-01 / MNT-04 filesystem adapter
- consumer: `lib.rs` startup、CMD-11 existing mapping
- wire type: existing `BackupResult` / `BackupInfo` / `CmdError` shape（不変）
- internal type: `DbError::QueryFailed` / `std::io::Error` /
  `RestoreError::Recovered`（既存variant）
- precision/range: `size_bytes: u64`。metadata不明を0へ偽装しない
- round-trip path: filesystem Err → MNT Result → existing lib warn / CMD internal mapping
- invalid input: filename pattern不一致は正常skip、owned patternのinvalid calendar dateはwarn skip
- compatibility: NotFound空、restore atomics、利用者向け文言、bindingsは不変

## Owner 判断点

| ID | 変更前 | 推奨する変更後 | 影響 / 代替 |
|---|---|---|---|
| J1 | auto-backup entry errorをskipし、空判定なら余分なbackupを作る | 判定全体を `DbError::QueryFailed`、作成/cleanupなし | 可用性より判定正確性。次tickでretry。代替のwarn継続は誤判定を残すため非推奨 |
| J2 | create metadata errorをsize=0成功 + operation log記録 | `DbError::QueryFailed`、成功result/logなし | VACUUM fileが残る可能性と次回重複を残余riskとして開示。代替warn+0は成功誤認を残すため非推奨 |
| J3 | list metadata errorをsize=0行として返す | list全体を `Err` | 一覧一時不可になるが不正確なsizeを返さない。代替warn+当該entry skipはbackup存在を隠すため非推奨 |
| J4 | diagnostic top-level metadata errorを不存在扱い | NotFoundだけ空、他はErr→lib既存warn、起動継続 | 起動可用性は不変。運用診断性だけ改善 |
| J5 | diagnostic entry/name/date errorを無言skip | WARN + 当該entryのみskip、後続継続 | cleanupはbest-effort維持。prefix不一致は無警告 |
| J6 | restore temp cleanup失敗を無記録 | WARN + 元のRecovered errorを維持 | MNT-01-D1/D4/D5と`RestoreFileOps`契約は不変。error化はしない |
| J7 | diagnostic test injection前例なし | 上記の具体generic signatureをproduction/test双方が使用、full traitなし | 工数 M。production-only経路を実装レビューで拒否 |

ownerの Plan 承認を J1-J7 の挙動差・残余risk・工数Mの受容判断とする。
別案を選ぶ場合は implementation前に packet/source designをamendし再reviewする。

## Review Focus

- J1-J3の安全側が「不正確な成功」より「明示的失敗」でよいか。
- S1 warn追加が restore variant / manifest cleanup / reconcileを変えていないか。
- helper/test hookがtest専用分岐を増やしすぎず、production main pathを実際に通すか。
- public production関数とfailure-injection testが同一generic helperを呼び、
  entry分類・warn・filename filterのproduction-only経路が存在しないか。
- filename pattern不一致（正常）とowned entry parse failure（warn）の境界。
- metadata error後の残置fileとretry重複を隠さずtest/state matrixへ記録しているか。

## Spec Contract

Contract ID: SPEC-MNT-FS-ERR-01

- NotFoundは未作成の正常空状態として扱う。判定・結果を変える他の filesystem
  errorは既存 Result境界へ返す。個別entry/remove等、処理全体を無効にしない失敗は
  path/error/context付きWARNを残して継続する。restoreの原子性契約は不変。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-901 / MNT-01-D6(a) | restore warn | R1 | variant/atomics不変 | WARN + Recovered |
| REQ-901 / MNT-01-D6(b) | entry error伝搬 | B1 | create/cleanup副作用0 | QueryFailed + file set |
| REQ-901 / MNT-01-D6(c/d) | metadata伝搬 | B2/B3 | size=0偽装禁止 | exact Err |
| REQ-700 / MNT-04-D1(a) | NotFound分離 | D1 | other errorを空にしない | Ok(0)/Err |
| REQ-700 / MNT-04-D1(b/c/d) | warn継続 | D2-D5 | 後続entry処理 | WARN + deleted count |
| P3-2 | final sweep / mutation | X1-X7 | silent discard survivor 0 | red→restore green |

## Data Safety

- real DB、backup、diagnostic/operation log、POS CSV、価格・原価、receipt、secret、
  `.env*`を読まない・生成しない・commitしない。
- testsは`tempfile::tempdir()`とsynthetic filename/contentだけを使う。
- `.local/`、`target/`、生成された一時backup/logはcommitしない。
- mutationはcommit後clean treeでのみ行い、mutant自体はcommitしない。

## Implementation Results

Plan Gate前。production codeは未変更。

## Review Response

Review-only sub-agent skipped because: 本発注はSol単独サイクルを指定し、
Plan Reviewer / Final ReviewerはownerがSonnet 5 fresh contextで実施する。

- 2026-07-24 Plan Review一次（Sonnet 5 fresh context）: P1=0 / P2=1 /
  P3=1、総評「承認可」。P2-1はentry注入用internal iterator helperの具体signatureと
  production/test同一路を70/71 source design、Scope、Review Focusへ追記した。
  P3-1はMNT-02除外理由を「P3-1同型config parse fallback（R2/M相当）の別是正単位」
  へ訂正した。ownerはJ1-J7を全件承認し、J7は本amendment完了を条件とした。
  amendment反映後の独立再reviewはowner条件に含まれず、反映完了をもってPlan承認とする。
- Findings Freeze: not yet frozen; post-freeze exceptions: none。
