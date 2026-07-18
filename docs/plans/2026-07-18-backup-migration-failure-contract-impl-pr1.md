# Plan Packet: backup / migration failure contract 実装 PR1（legacy 移行 / restore の原子性 + single-instance ガード + restore error 識別子）

## Workflow State

- Phase: implementing
- Risk: R4
- Execution Mode: fable-window
- Plan Commit: d9f7b53
- Amendments: 1（`1135628` Contract Probe #1〜#4 結果確定。件数は列挙 SHA と一致させる）
- Coordinator: Fable 5（本 session）
- Writer: Codex（実装・テスト・bindings 再生成。発注 cwd は public-writer clone に pin）
- Plan Reviewer: Sonnet subagent（独立 context）
- Final Reviewer: Fable inline（Contract Audit 1 pass）+ Codex 独立 context（2 pass。定義は Acceptance Criteria の Double Audit 項）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: R4 explicit approval **済み**（2026-07-18、介入 1 回目 / 予算 4 回、Data Safety 節を承認対象に含む）+ Draft PR の owner 確認 + Ready 承認 + Windows native L3（Matrix L3-1/L3-2）+ merge
- State Narrative（append-only）: 2026-07-18 の state-only commit で隣接 forward 3 遷移 `plan-draft -> plan-gate -> plan-approved -> implementing` を実体化。evidence: plan-gate = packet + Test Design Matrix の plan-first commit `d9f7b53`（packet complete and committed）/ plan-approved = Plan Gate round 3 の独立 Plan Reviewer 報告 P1/P2 = 0（Review Response 参照）+ `Plan Commit` 記入 / implementing = owner の R4 explicit approval（介入 1 回目）。実装 commit は本遷移時点でゼロであり plan-first commit が全実装 commit に先行する。

## Owner Effort Budget

- 介入回数上限: 4（内訳: (1) R4 発注承認 (2) Codex 実行 relay (3) Ready 承認 (4) Windows native L3 実機確認 + merge。既定 3 から調整 — 実装を Codex 外部実行する本 packet では relay が介入として必ず挟まるため）
- 実働時間上限: 40分（L3 実機確認を含む）
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R4

Reason:
[adjudication](../research/audit-2026-07/adjudication.md) が是正順 1+2 へ R4 を付与しており、本 PR はその destructive data lifecycle（restore の main/WAL/SHM 置換、legacy 移行のファイル生成、起動時 reconcile の遺物削除）の実装挙動を実際に変更する。R4 必須物 = R3 必須物 + explicit human approval（発注前）+ rollback / recovery notes（本 packet Data Safety 節）+ Double Audit。

## Goal

Goal Invariant:

### 最小完了条件

- MNT-01-D1 / MNT-01-D4 / MNT-01-D5、MNT-03-D2 / MNT-03-D3 / MNT-03-D4 の 6 契約（[71-mnt-backup.md](../function-design/71-mnt-backup.md) / [22-mnt-migration.md](../function-design/22-mnt-migration.md) 正本）が実装され、**意味的完了条件「restore / 移行のどの失敗・中断時点でも、元 snapshot または新 snapshot のどちらか一方が完全な形で残る（部分状態・空 DB 偽装が構造的に発生しない）」**を、実 WAL fixture + 失敗注入 + 実 mutation 注入テスト（[Test Design Matrix](test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md)）で検証済みの状態にする。

### 失敗定義

- いずれかの契約が実装から漏れる、または実装されたがテストが意味的完了条件への感度を持たない（mutation を注入しても green のまま = tautological、Matrix X1 で検出）。
- restore 失敗時の復旧経路が create-capable な再接続（空 DB 偽装）を残す。
- frontend の recoverable / unrecoverable 判別に文言部分一致が残る。
- 既存の正しい挙動（restore 成功経路、通常起動、既存 migration v1→v3、既存テスト）を壊す。

### 非目的

- PR2 scope（MNT-01-D2 `resolve_backup_dir` Result 化 / MNT-01-D3 cleanup 保持日数確定条件 / MNT-03-D1 ROLLBACK 失敗契約）。
- 順8（P3-4 利用者向け error 表示統一）の本体。PR1 は restore CMD の wire 具体形のみ確定し、順8 が後からこれに整合する（68 §68.7 の明記どおり）。
- 既存起動失敗 3 経路（`app_data_dir` 失敗等）の無言クラッシュ可視化（Plans.md backlog 済み）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `src-tauri/src/db/mod.rs` `migrate_legacy_db`（MNT-03-D2/D3）: 3 ファイル個別コピーを廃止し、旧 DB を NO_CREATE + 通常モードで開いて `VACUUM INTO` で一時名（`.migrating`）へ生成 → 成功後に最終名へ **no-clobber publish**（rename 直前の destination 不在再確認 + 既存 destination を置換しない platform primitive、Contract Probe #4 で確定 — 22 §12.1 ステップ6）。失敗時は一時ファイルを削除して Err。旧 DB 存在確認の error は skip（`Ok(false)`）ではなく Err（MNT-03-D4 経路）。「新パス main は完成品しか存在しない」不変条件。
- `src-tauri/src/lib.rs` setup（MNT-03-D4 + MNT-01-D5 順序）: legacy 移行 Err で起動を fail-closed 中止（現行の error log + 続行 + 空 DB 新規作成を廃止）。中止時は operator へ理由を可視表示（表示機構は Contract Probe #1 で確定、22 §12.4 の threading 制約に従う）。`if let Ok(cwd)` の無言 skip を廃止し CWD 解決失敗も Err 経路へ。起動順序を `reconcile → legacy 移行判定 → init_database` に固定。
- `src-tauri/src/mnt/backup.rs` `restore_backup`（MNT-01-D1/D5）: 退避（main / 存在する WAL / SHM）一式成功必須、いずれか失敗で本体置換前に巻き戻して中止。checkpoint busy=1 は退避成功時のみ非致命。phase 付き durable manifest（attempt ID + 退避対象存在集合 + active/committed）+ sync_all / 親 dir sync 順序（71 §71.7 の durability 契約）。step 8 巻き戻しは reconcile「一致」分岐（R1）と共通ヘルパー化（71:238、コード重複禁止）。restore 開始時の前回遺物検査（active/temp/退避残存 → Err、例外 = committed のみ補完 1 回 + durable 削除後に新規開始）。
- 起動時 reconcile 新設（MNT-01-D5）: T0/R1〜R7 の 8 分岐（71 §71.7 索引表）。冪等。R4 分岐は manifest を pending marker として保持し、operation_log 補完の 3 値集約（Inserted|AlreadyPresent → manifest 削除 / Failed → 残置 + warn）後に削除。
- single-instance ガード導入（MNT-01-D5 前提条件）: `tauri-plugin-single-instance` を採用（Contract Probe #3 で確定）。後発 instance が mutation（restore / reconcile / legacy 移行 / DB 書込み）へ到達しないこと。**plugin 初期化失敗は fail-closed（起動中止）**（Packet Decision 5 — 本 PR で 71 MNT-01-D5 前提条件節へ昇格）。npm guest bindings が必要な場合は供給網防御ルール（`--save-exact` + min-release-age、lockfile diff レビュー）に従う。
- `src-tauri/src/cmd/settings_cmd.rs` `restore_backup`（MNT-01-D4）: 失敗時再接続を no-create open に限定（create-capable `init_database` の使用禁止）。「退避復元済み = recoverable」「状態不明/未復旧 = unrecoverable（durability 不明サブ分類含む）」を構造化分類識別子で返す（wire 具体形は Contract Probe #2 で確定、順8 前方互換）。
- `src/features/backup-restore/BackupRestorePage.tsx` + bindings 再生成: `isUnrecoverableRestoreError` の文言部分一致（`message.includes(...)`）を生成 bindings の識別子ベース分岐へ置換、frontend テストも識別子で固定（68 §68.7）。durability 不明ケースの非断定文言（68 文言表、design phase で新設済み）の表示分岐。
- テスト（P8b-3 + PR #15 教訓）: [Test Design Matrix](test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md) 全行（fixture / 注入の必須条件は 71 §71.10 / 22 §12.5 を正本とする）。
- docs 書き戻し: `71-mnt-backup.md`（wire 具体形 / 表示機構 / no-clobber primitive / Packet Decision 5 の前提条件節昇格）、`22-mnt-migration.md`（同）、`68-ui-backup-restore.md` / `43-cmd-settings-log.md`（識別子具体形の追随）— いずれも「実装 PR1 で確定」と設計書自身が留保した箇所 + 本 packet の新規 durable 決定のみ。
- `Plans.md` 同期。

## Non-scope

- PR2 対象変更: `src-tauri/src/db/migration.rs` / `schema_v2.rs` / `schema_v3.rs` の ROLLBACK 契約、`resolve_backup_dir` Result 化、cleanup 保持日数確定条件（挙動変更禁止、現状把握のみ）。
- `src-tauri/src/mnt/migration.rs`（空スタブ）への実装移設。legacy 移行の実装配置は現行どおり `db/mod.rs` を正とする（D-048 Impact 節がファイル固定済み。スタブ整理は別途）。
- 順8 本体・UI 画面構成 / state machine の変更。

## Packet Decisions（design 留保の確定 + 曖昧点裁定）

1. **実装配置**: legacy 移行は `db/mod.rs::migrate_legacy_db` を正とする（D-048 Impact 節と現行実装に一致。`mnt/migration.rs` 空スタブは触らない）。
2. **restore error の wire 具体形**（方向性、最終形は Contract Probe #2）: `CmdError` の既存 kind パターン（`"validation"` / `"duplicate"` 等の固定値、`cmd/mod.rs`）に倣い restore 分類識別子を追加。順8 の相関 ID / kind 拡張と前方互換な形にし、message 文字列は表示専用。
3. **`restore_backup` シグネチャ**（方向性、最終形は Contract Probe #2）: mnt 層に recoverable / unrecoverable を型で区別する error 表現を導入し CMD 層で kind へマップ。`DbError` の汎用 variant 汚染は避ける。
4. **MNT-03-D4 表示機構**: `blocking_show` の main-thread 禁止に適合する機構を Contract Probe #1 で確定（worker thread / callback API / 専用 error window のいずれか、22 §12.4）。Windows 実機確認が完了条件（Matrix L3-1）。
5. **single-instance ガード失敗時挙動**: plugin 初期化失敗は fail-closed（起動中止）に倒す。根拠 = D-048 柱③「destructive 操作は前提状態を確定できた場合のみ実行」— ガードは MNT-01-D5 の明示的前提条件（71:193）であり、前提が確立できない状態で mutation へ進まない。設計書に未規定の新規 durable 決定のため、本 PR で 71 MNT-01-D5 前提条件節へ昇格する（Matrix B11 で検証）。

## Acceptance Criteria

- `cd src-tauri && cargo test` / `npm test` / typecheck / lint / format 全 green（既存テストの削除・skip なし）、`bash scripts/doc-consistency-check.sh`（+ `--target plan`）ERROR 0・既存 WARN 増加なし、`bash scripts/local-ci.sh full` PASS。
- traceability: テスト追加が REQ を引用する場合 `cargo run --bin generate_traceability` 再生成で差分整合。
- Contract Coverage Ledger 全 9 行（6 契約 + no-clobber サブ条項 + Packet Decision 5 + bindings 再生成義務）それぞれについて、実装箇所 + `docs/plans/test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md` の行 ID + 実テスト名の対応を PR body の対応表で示せる（対応表と Ledger 行が 1:1）。
- Double Audit 両 pass: Contract Audit lane 全体（**Ledger 全行の実装再検証 + negative-space audit + drift-fix sweep + adjacent pattern audit + mutation check**）を独立 context で 2 周。1 pass = Fable inline、2 pass = Codex。mutation check は Matrix X1 の実注入で red を実証 — 各 mutation について `cd src-tauri && cargo test`（または `npm test`）の fail 出力抜粋を 2 pass 報告に含める（推論ベース anti-tautology 判定のみで完了扱いしない）。
- `rg "message.includes" src/features/backup-restore/` が 0 件（Matrix F1 の evidence token）。
- Windows native L3: `docs/plans/test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md` の L3-1（pre-window ダイアログ）/ L3-2（二重起動）両行 pass。証跡は PR body の L3 チェックリストに実施記録（L3-1 はダイアログのスクリーンショット添付、L3-2 は観測挙動の記述）として残す。

## Design Sources

- Requirements / spec: REQ-903（DB 基盤 / マイグレーション）、MNT-01 / MNT-03 の確定済み failure contract
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO/MNT）
- Function / command / DTO: `docs/function-design/71-mnt-backup.md`（MNT-01-D1/D4/D5、§71.7 索引表、§71.10）、`docs/function-design/22-mnt-migration.md`（MNT-03-D2〜D4、§12）、`docs/function-design/43-cmd-settings-log.md` §43.9
- DB: `docs/DB_DESIGN.md`（WAL mode 運用）
- Screen / UI: `docs/function-design/68-ui-backup-restore.md` §68.7 / §68.11（識別子分岐 + durability 不明文言）
- Decision log / ADR: D-048、[archived design packet](../archive/plans/2026-07-17-backup-migration-failure-contract-design.md)（Contract Coverage Ledger 原型 + Design Intent Trace）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 71 §71.7/71.9/71.10、22 §12（PR #14 で正本確定済み） | existing sufficient（Probe 確定分の書き戻しのみ updated in this PR） |
| Command / DTO / generated binding / wire shape | restore CMD error への構造化 kind 追加 + `bindings.ts` 再生成（Probe #2 で具体形確定 → 71/68/43 へ書き戻し） | updated in this PR |
| DB / transaction / audit / rollback / migration | 22 §12（legacy 移行）、71 §71.7（restore / reconcile）。schema migration の追加なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 68 文言表（durability 不明の非断定文言は design phase で新設済み）。新規文言なし | existing sufficient |
| CSV / TSV / report / import / export format | 該当なし | existing sufficient |
| Durable decision / ADR | D-048（既存）+ Packet Decision 5 を 71 MNT-01-D5 前提条件節へ昇格 | updated in this PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| 新規 Tauri command | なし（既存 `restore_backup` CMD の error wire 変更のみ） |
| `CmdError` wire 変更 | `cargo run --bin generate_bindings` で `bindings.ts` 再生成 + frontend が生成型を参照（Ledger 行あり、Matrix F1） |
| `tauri-plugin-single-instance` | Cargo.toml 追加（Rust 側）。npm guest bindings 要否は Probe #3 で確定 — 必要な場合は `npm install <pkg>@<ver> --save-exact` + min-release-age 遵守 + lockfile diff を PR レビュー対象に明記 |
| route / operator 画面 / function-design doc / REQ | 新設なし |
| traceability | テストが REQ を引用する場合 `cargo run --bin generate_traceability` 再生成 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-903 / MNT-03 | 22 §12.1〜12.3 | MNT-03-D2/D3 | 部分 snapshot の成功扱い + 恒久 skip（P3b-1）。rejected: 3 ファイルコピー / 最終名直接生成 | `db/mod.rs::migrate_legacy_db` | Matrix M1〜M4, M6, M7 |
| REQ-903 / MNT-03 | 22 §12.4 | MNT-03-D4 | 空 DB 隠蔽より可視の起動失敗が安全側。rejected: warn + 続行 | `lib.rs` setup + Probe #1 機構 | Matrix M5, M8 + L3-1 |
| MNT-01 | 71 §71.7 | MNT-01-D1 | 旧 WAL 再生による誤復元（P3b-2）。rejected: warn 継続 | `mnt/backup.rs::restore_backup` | Matrix B1, B2 |
| MNT-01 | 71 §71.7 / 68 §68.7 / 43 §43.9 | MNT-01-D4 | create-capable 復旧による空 DB 偽装 + 文言部分一致の脆弱契約 | `mnt/backup.rs` + `cmd/settings_cmd.rs` + `BackupRestorePage.tsx` + bindings | Matrix B3, F1 |
| MNT-01 | 71 §71.7（manifest / reconcile / durability / (e)(ii) 文言） | MNT-01-D5 | restore 中断の非原子性 + 世代混在 + 並行 attempt + durability 不明の非断定表示 | `mnt/backup.rs`（manifest + reconcile + 共通ヘルパー）+ `lib.rs` 起動順序 + `BackupRestorePage.tsx`（(e)(ii)） | Matrix B4〜B9, B12（D1 二重失敗と共有）, F2 |
| MNT-01 | 71 MNT-01-D5 前提条件（本 PR で昇格） | Packet Decision 5 | ガード前提が確立できない状態で mutation へ進まない（D-048 柱③）。rejected: warn + 続行（前提なし mutation） | `lib.rs` plugin 登録 + 初期化失敗ハンドリング | Matrix B10, B11 + L3-2 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes — PR #14 で 71/22/68/43 の failure contract が why / rejected alternatives 込みで正本確定済み。本 packet は実装計画のみを持つ。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: Packet Decision 5（single-instance 初期化失敗 = fail-closed）を 71 MNT-01-D5 前提条件節へ本 PR で昇格。Decision 1〜4 は既存正本の留保の確定であり、確定結果を各設計書の該当留保箇所へ書き戻す。
- Assumptions and constraints: SQLite 挙動（VACUUM INTO の WAL 取込み / SHM 再構築 / WAL 再生）は design phase で 3 系統検証済み、実 WAL fixture テストが empirical validation を兼ねる。`tauri-plugin-single-instance` の挙動と Rust std `rename` の platform 差は未検証前提 → Contract Probe #3/#4。
- Deferred design gaps, risk, and follow-up target: PR2 契約（MNT-01-D2/D3、MNT-03-D1）、順8 本体、既存 setup 失敗 3 経路の可視化（backlog）。
- Test Design Matrix can cite design decision IDs or source doc sections: yes — 全行が契約 ID を引用（Matrix 冒頭が 71 §71.10 / 22 §12.5 を正本参照）。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable — 外部 adapter なし、MNT/DB 層内部 + CMD wire のみ | — |
| Fact check / design decision split | 未検証の外部前提（plugin 挙動 / rename primitive / dialog threading）を Contract Probe 4 件に分離、設計判断（fail-closed 等）は確定済み正本に依拠 | Contract Probe |
| Lifecycle / retry | restore / 移行の中断・再試行・reconcile が本 PR の中核。契約は 71/22 で固定済み | Matrix B4〜B9 |
| Operator workflow | 起動中止ダイアログ（新設経路）と unrecoverable 時の再起動誘導。文言は 22 §12.4 / 68 文言表の確定済み契約に従い新規文言なし | Matrix L3-1, F2 |
| Replacement path | not applicable — 外部システム置換なし | — |
| Data safety / evidence | 実 DB / backup を commit しない。テストは tempdir + 合成 fixture のみ | Data Safety 節 |
| Reporting / accounting semantics | not applicable — 集計意味論に非接触 | — |
| Manual verification | Windows native L3 2 項目（pre-window ダイアログ表示 / 二重起動）。Linux 開発環境では自動化不能 | Matrix L3-1, L3-2 |

## Design Readiness

- Existing design docs are sufficient because: PR #14 が本実装のための design phase であり、6 契約 + テスト必須条件（71 §71.10 / 22 §12.5）まで正本確定済み。残る決定待ちは設計書自身が「実装 PR1 で確定」と留保した 4 点のみで、すべて Contract Probe でカバーする。
- Source docs updated in this PR: 71 / 22（Probe 確定分の書き戻し + Packet Decision 5 昇格）、68 / 43（識別子具体形の追随）。
- Design gaps intentionally deferred: PR2 契約、順8 本体、既存 3 経路可視化（backlog）。
- Durable decisions discovered in this plan and promoted to source docs: Packet Decision 5。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): MNT/DB 層内部の実装 + CMD error wire + UI 分岐置換。層境界は不変。
- Backend function design: `migrate_legacy_db` 方式変更 / `restore_backup` manifest 化 / reconcile 新設 — いずれも 71/22 の確定済み関数契約に従う。
- Command / DTO / data contract: restore CMD error への kind 追加のみ（Boundary / Wire Contract 節）。他 command 不変。
- Persistence / transaction / audit impact: schema 変更なし。operation_log の `backup_restore` 補完（detail_json 冪等）は 71 §71.7 確定済み契約。
- Operator workflow / Japanese UI wording: 新規文言なし（22 §12.4 / 68 文言表の確定済み文言を使用）。
- Error, empty, retry, and recovery behavior: 本 PR の中核。契約は正本、検証は Matrix。
- Testability and traceability IDs: Matrix 全行が MNT-01/MNT-03 の decision ID を引用。

## Contract Probe

実装着手後・本実装前に Codex が実施し、結果を packet Amendment で確定（是正仮適用状態で end-to-end）:

1. **pre-window エラー表示機構**（22 §12.4）: `blocking_show` の main-thread 禁止下で、setup 失敗時に operator 可視のダイアログを webview マウント前に表示できる機構の実証（worker thread / callback API / 専用 error window から選定、最小再現コード + Windows 実機）。
   - Probe result #1: `blocking_show` worker + main-thread `join` は dispatch 相互待ち、callback は可視化不能だったため不採用。Windows `MessageBoxW` を専用 worker で表示し `join` 後に setup `Err` とする方式で、native pre-window 表示完了（`shown=true`）後の fail-closed 終了を実証し採用。
2. **restore error wire 形**（71 / 68 §68.7）: `CmdError` への restore 分類 kind 追加 + specta `bindings.ts` 再生成が既存 command の wire に波及しないことの実証。
   - Probe result #2: `CmdError.kind: String` を維持して `restore_failed_recovered` / `restore_failed_unrecoverable` / `restore_durability_unknown` を追加する最小差分で生成前後の `bindings.ts` SHA-256 が一致し、既存 command wire 無変更を実証し採用。
3. **single-instance plugin**: `tauri-plugin-single-instance` の導入実証 — Rust 側のみで足りるか（npm guest bindings 要否）、二重起動時の観測可能挙動、初期化失敗の観測可能性（B11 の注入手段）。
   - Probe result #3: `tauri-plugin-single-instance = 2.4.3` は Rust plugin 登録のみ（npm guest bindings 不要）。後発は先発 callback へ args/CWD を送り終了し、B11 は injectable guard plugin の setup `Err` で app setup mutation 不到達を実証する方式を採用。
4. **no-clobber rename primitive**（22 §12.1 ステップ6）: Rust std `rename` は既存 destination を置換し得るため、Windows で「既存 destination を置換しない」ことが保証される primitive の選定と実証。
   - Probe result #4: 同一 directory の `std::fs::hard_link(temp, destination)` publish は native Windows で既存 destination に `AlreadyExists`（内容保持）、不在時は link 作成後 temp unlink で完成 snapshot を公開できたため no-clobber primitive として採用。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| MNT-03-D2 VACUUM INTO 移行 + NO_CREATE open | `db/mod.rs::migrate_legacy_db` | Matrix M1, M2, M6, M7 | non-scope（自動化） |
| MNT-03-D2 ステップ6 no-clobber publish | 同上（Probe #4 の primitive） | Matrix M4 | non-scope（自動化） |
| MNT-03-D3 完成品不変条件（一時名 + 失敗時削除） | 同上 | Matrix M2, M3 | non-scope（自動化） |
| MNT-03-D4 移行失敗の fail-closed 起動中止 + operator 可視化 + 存在確認・CWD エラーの Err 分離（D4 経路への流入） | `lib.rs` setup + Probe #1 機構 | Matrix M5, M8（自動化可能範囲） | L3-1: pre-window ダイアログの Windows 実機確認 |
| MNT-01-D1 退避一式原子性 + checkpoint busy 限定 + 二重失敗契約 | `mnt/backup.rs::restore_backup` | Matrix B1, B2, B12（二重失敗の mnt 層契約） | non-scope（自動化） |
| MNT-01-D4 no-create 復旧 + recoverable/unrecoverable 構造化識別子 | `mnt/backup.rs` + `cmd/settings_cmd.rs` + `BackupRestorePage.tsx` | Matrix B3, F1 | non-scope（自動化） |
| MNT-01-D5 phase 付き manifest + 起動時 reconcile 8 分岐 + durability 順序 + 補完 3 値 + step8 共通化 + durability 不明分類の非断定文言（(e)(ii)） | `mnt/backup.rs` + `lib.rs` 起動順序 + `BackupRestorePage.tsx`（(e)(ii) 表示分岐） | Matrix B4〜B9, B12（D1 行と共有）, F2 | non-scope（自動化） |
| MNT-01-D5 前提: single-instance ガード + 初期化失敗 fail-closed（Packet Decision 5） | `lib.rs` plugin 登録 | Matrix B10, B11 | L3-2: 二重起動の Windows 実機確認 |
| bindings 再生成義務（CmdError wire 変更） | `generate_bindings` → `bindings.ts` | typecheck + Matrix F1 が生成型を参照 | non-scope（自動化） |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md](test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md)（fixture / 注入の必須条件は 71 §71.10 / 22 §12.5 を正本として引用）

- targeted tests: Matrix M1〜M8 / B1〜B12 / F1〜F2（全行が契約 ID を引用）。
- negative tests: 失敗注入・中断注入・fail-closed 分岐（M2〜M6, B1, B3〜B9, B11, B12）が本 PR の主体。
- compatibility checks: M7（skip 判定回帰）、既存 restore 成功系・既存 migration v1→v3・design_compliance_test の維持（G1）。
- data safety checks: tempdir + 合成 fixture のみ（Data Safety 節）。R5 分岐の退避実データ非削除 assert（B6）。
- main wiring/integration checks: reconcile が実 startup dispatcher 経由で到達する統合テスト（B9 内、71 §71.10）、L1 full（G3）。
- 回帰感度: Matrix X1 の実 mutation 注入（Double Audit 2 pass = Codex が red を実証）。

## Boundary / Wire Contract

- producer: `cmd/settings_cmd.rs::restore_backup` の error 経路（`CmdError`）。
- consumer: `BackupRestorePage.tsx`（生成 `bindings.ts` 経由）。
- wire type: `CmdError` の既存 kind パターンに restore 分類識別子を追加（具体形は Probe #2 で確定 → 68/43 へ書き戻し。順8 の kind / 相関 ID 拡張と前方互換）。
- internal type: mnt 層の recoverable / unrecoverable 型区別 → CMD 層で kind へマップ（`DbError` の汎用 variant 汚染回避 — Packet Decision 3）。
- precision/range: 該当なし（識別子は固定値文字列）。
- round-trip path: Rust error 型 → specta 生成 `bindings.ts` → frontend 分岐。テストは生成型の識別子で固定（文言非依存、Matrix F1/F2）。
- invalid input: kind は同一 repo 内で生成型に閉じるため未知値は型レベルで排除。runtime 防御として非該当 kind は従来の通常エラー表示に落とす（unrecoverable 誤昇格をしない）。
- compatibility: 既存 command の wire shape・既存 kind 値は不変（Probe #2 で波及なしを実証）。

## Review Focus

- テストが意味的完了条件（一方の snapshot が完全に残る）への感度を持つか — 構造検査・件数だけの行がないか（Matrix X1 と突合）。
- reconcile 8 分岐の実装が 71 索引表と 1:1 か、step8 共通ヘルパー化でコード重複・挙動分岐が生じていないか。
- no-create / no-clobber の徹底 — create-capable な経路・置換 rename の残存ゼロ。
- scope 境界 — PR2 対象（`resolve_backup_dir` / cleanup / ROLLBACK）への挙動変更混入なし。
- 供給網 — 新規依存（single-instance）の pin と lockfile diff。

## Spec Contract

Contract ID: SPEC-MNT-FAILURE-CONTRACT-2026-07-17（design phase で確定済みの正本契約を実装で満たす）

- backup / restore / legacy 移行の失敗は、成功・既定値・部分状態へ変換されず、記録された上で呼出し元へ伝搬するか、安全に中止される。destructive 操作（DB 置換・遺物削除・起動継続）は入力と前提状態を確定できた場合のみ実行する。検証は Matrix 全行（テスト名は実装時に Matrix 行 ID と対応付けて確定）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-MNT-FAILURE-CONTRACT-2026-07-17 | Scope の実装 8 項目 | Matrix M1〜M8 / B1〜B12 / F1〜F2 / X1 / G1〜G3 | Ledger 全行の実装再検証（Double Audit 2 周） | PR body の契約対応表 + L3 記録 |

## Data Safety

R4 rollback / recovery notes（発注前の explicit human approval 対象）:

- コード変更は git revert で完全に巻き戻せる（schema migration の追加なし、DB ファイル形式の変更なし）。
- runtime の rollback 保証は Goal Invariant そのもの: restore / 移行のどの失敗・中断時点でも元 snapshot または新 snapshot の一方が完全に残り、起動時 reconcile が自動復旧（R1/R2/R4/R6）または fail-closed 停止（R3/R5/R7、遺物不変更）する。手動復旧手順は 71 §71.10 / 68 §68.11 の operator 契約に従う。
- 実 POS / 店舗 DB・実 backup ファイル・実パスを commit / テストに使わない（tempdir + 合成 fixture のみ）。
- fail-closed 分岐（R3/R5/R7）は遺物を変更しないため、診断・手動復旧の証跡が常に保全される。

## Codex 発注条件（Coordinator checklist）

- Plan Gate 収束（新規指摘 0）+ owner R4 explicit approval 済み
- Plan Commit 記入 + Workflow State `plan-approved` → `implementing` 遷移を Coordinator が完了（実装者へ委譲禁止）
- 発注書に cwd pin（public-writer clone）+ Contract Probe 4 件 + Matrix 全行 + 「最終報告は要約 + 判定材料のみ」を明記
- Codex 側は予算制約なし: Probe → 実装 → 自己検証 → mutation testing まで発注書に厚く積む

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Plan Gate round 1（独立 Plan Reviewer = Sonnet subagent、2026-07-18）: P1 = 3 系統 / P2 = 5 / P3 = 3、verdict「要修正（発注不可）」。裁定 = 全件 accept + Coordinator 自己検出 1 件。対応:
  - P1-1（`Phase: planning` が enum 不正値）: accept。`plan-draft` へ訂正。あわせて Coordinator 自己検出の `Execution Mode: codex-order` 不正値も `fable-window` へ訂正（AGENT_OPERATING_MANUAL §3.2 で実証確認）。
  - P1-2（Contract Coverage Ledger 欠落）: accept。archived design packet の Ledger 原型を継承し、実装 target を具体 file::function、test を Matrix 行 ID へ具体化した 9 行を authoring。
  - P1-3（MNT-03-D2 no-clobber publish の網羅漏れ）: accept（22:190 / 22:231 で実証確認）。Scope / Contract Probe #4 / Ledger 行 / Matrix M4 / mutation X1(e) を追加。
  - P1-4（テンプレ必須節の大量欠落）: accept。template 準拠で全節（Required Design Artifacts / Registration・Generation Obligations / Design Intent Trace / Design Intent Audit / Impact Review Lenses / Design Readiness / Boundary・Wire Contract / Review Focus / Spec Contract / Trace Matrix）を補完。
  - P2-1（22 §12.5 の存在確認エラー分離・NO_CREATE 行の欠落）: accept。Matrix M5 / M6 を追加、Scope にも明記。
  - P2-2（Packet Decision 5 の source doc 昇格漏れ）: accept。Scope / Required Design Artifacts / Design Intent Trace に 71 MNT-01-D5 前提条件節への昇格を明記。
  - P2-3（Decision 5 の検証行欠落）: accept。Matrix B11（初期化失敗 fail-closed）を新設、Probe #3 に注入手段の確認を追加。
  - P2-4（Double Audit の mutation testing への矮小化）: accept。AC / Workflow State を Contract Audit lane 全体（Ledger 再検証 + negative-space + drift-fix sweep + adjacent pattern + mutation check）の 2 周として明記。
  - P2-5（Owner Effort Budget 超過理由の欠落）: accept。既定 3 → 4 の調整理由（L3 実機確認の独立介入化）を明記。
  - P3-1（Decision 5 の根拠を柱① → 柱③へ）: accept。訂正済み。
  - P3-2（Matrix 未作成のまま参照）: accept。Matrix を本 round で起票（plan-gate 遷移の前提 — DEV_WORKFLOW transition 表で実証確認）、冒頭で 71 §71.10 / 22 §12.5 を正本参照。
  - P3-3（§71.10 必須条件の要約欠落）: accept。Matrix 冒頭に要約 + 正本参照を記載。
- Plan Gate round 2（同 Plan Reviewer、是正後の全面再レビュー、2026-07-18）: round 1 の 11 件 + 自己検出 1 件は全件クローズ確認。新規 P1 = 0 / P2 = 2 / P3 = 4、verdict「要修正（軽微・再レビュー要）」。裁定 = 全件 accept。対応:
  - P2-1（MNT-01-D5 (e)(ii) の F2 が D5 Ledger 行から辿れない negative-space gap）: accept。Ledger D5 行の契約説明に (e)(ii) 非断定文言を明記し F2 を引用、D4 行は B3/F1 に整理。Design Intent Trace も同一帰属へ同期。
  - P2-2（MNT-01-D1「二重失敗契約」が引用行 B1/B2 で未実証）: accept。Matrix B12（mnt 層の rollback-of-rollback 失敗注入 → 致命的エラー + 遺物残置 + 次回 reconcile 復旧可能）を新設し、Ledger D1 行 / Trace / Test Plan から引用。
  - P3-1（M5 の帰属が Ledger と Trace で不一致）: accept。M5 を MNT-03-D4 行へ統一（D2 行から削除）。
  - P3-2（AC「6 契約と 1:1」表現が Ledger 9 行と不整合）: accept。「Ledger 全 9 行と対応表が 1:1」へ訂正。
  - P3-3（Final Reviewer 欄の書式逸脱）: accept。役割名のみに簡潔化、Double Audit 定義は AC へ一本化。
  - P3-4（Budget 介入 4 の内訳が再確認不能）: accept。内訳 4 件の明示列挙 + 調整理由（Codex relay の介入化）へ書き直し。
- Plan Gate round 3（同 Plan Reviewer、差分最終確認、2026-07-18）: round 2 対応 6 件の全件クローズを確認（B12 期待値は 71 §71.7 二重失敗契約の原文と再突合済み、F2/M5/B12 の旧帰属残存なし）。P1 = 0 / P2 = 0 / P3 = 1（Ledger D5 行と Trace の B12 帰属非対称、non-blocking）、verdict「plan-gate 通過可」。P3 は accept し Ledger D5 行へ B12 を「D1 行と共有」注記付きで追加、Trace と帰属を完全一致させた。
- Contract Audit 1 pass（Fable inline 契約突合、2026-07-18、対象 HEAD `7ddf5e4`）: P1 = 0 / P2 = 0。判定材料:
  - **oracle 変更 5 件の裁定 = 全件 accept**。各件を正本の実文と突合 — 件1 R1 世代削除（71:198「必ず除去する」と一致）/ 件2 補完 3 値分類（71:201 の行分類・集約順序と一致）/ 件3 checkpoint SQL Err warn 継続（71:163・175「退避成功時に限り非致命」と一致、旧 oracle が正本違反）/ 件4 lazy CWD（22:193「新 DB 既存 → skip は CWD に依存しないため先に判定」— 本 PR の書き戻し diff に**含まれない既存正本**であることを確認、循環正当化なし）/ 件5 durability 不明文言（71:195 の正本文言と完全一致）。
  - 設計書書き戻し 4 本（71/22/68/43）の全 hunk が「実装 PR1 確定形」の留保箇所のみで、既存契約の書き換えなし。
  - 実装急所の実査: settings_cmd 復旧経路 = `RestoreError` 3 variant → kind 写像 + Recovered のみ no-create `open_existing_database`（`init_database` 残存は全て `#[cfg(test)]` 内）/ db/mod.rs = READ_WRITE only open + `VACUUM INTO` + `hard_link` no-clobber / `rg "message.includes" src/features/backup-restore/` 0 件 / PR2 対象（migration.rs / schema_v2 / schema_v3 / resolve_backup_dir / cleanup / retention）diff なし。
  - Probe 4 件の結果は Amendment `1135628` で packet 確定済み。X1 mutation 5 種の red 抜粋を Writer 報告で受領。
  - 残タスク: 2 pass（Codex 独立 Contract Audit、Ledger 全行再検証 + negative-space + drift-fix sweep + adjacent pattern + mutation check）は未実施 — waive せず発注する（PR #15 教訓）。
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
