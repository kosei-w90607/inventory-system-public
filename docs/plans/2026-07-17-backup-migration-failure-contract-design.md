# Plan Packet: backup / migration failure contract 正本確定（監査是正 順1+2 design phase）

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 3f7fc18
- Amendments: 9（`a4c6f4f` Codex round 裁定記録 + Final P3-1 lens 訂正 / `94fa8bc` closure round 裁定記録 + AC・Ledger の MNT-01-D4/D5 反映 / `c921dd5` Codex 再レビュー round 裁定記録 + Scope・Trace の diff 同期 / `832fc2f` 再々レビュー round 裁定記録 + packet 残存 drift 是正 + wire 契約の識別子化 / `36c9388` 第 4 round 裁定記録 + cleanup durability 契約 / `ad83d3b` 第 5 round + 検証 round 裁定記録 + temp dispatcher 到達性・oracle 分割・durability 不明分類・遅延成功の operator 可視化 / `4786f7f` 第 6 round + 検証第 2 round 裁定記録 + pending marker 化・detail_json 冪等・committed 例外 / `debc232` 第 7 round 裁定記録 + 補完 3 値・best-effort 化・scope 同期 / `fa02439` 第 8 round 裁定記録 + row 分類集約・分岐要約表・68 本文 best-effort 化。件数は列挙 SHA と一致させる（第 6 round P3 — SHA 追記時に件数の更新を怠った）。amendment SHA は直後の状態帳簿 commit で確定追記する運用
- Coordinator: Fable 5（本 session）
- Writer: Fable 5（design docs 改訂）
- Plan Reviewer: Sonnet subagent（独立 context）
- Final Reviewer: Sonnet subagent（Plan Reviewer とは別 context）
- Reviewed Content HEAD: fa02439
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Draft PR の owner 確認 + Ready 承認 + Ready 後の explicit `workflow_dispatch` 1 run（docs-only は paths-ignore で自動 event 対象外のため、ci.md R3 経路の hosted final は owner 指示の dispatch で満たす）+ merge

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 15分
- relay 往復上復: 1

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
docs-only の design phase だが、[adjudication](../research/audit-2026-07/adjudication.md) が是正順 1+2 全体へ R4 を付与しており、本改訂はその destructive data lifecycle の failure contract 正本そのもの。DEV_WORKFLOW Design Phase Rules の「data lifecycle / operator recovery に触れる behavior spec は高い方の tier で評価する」に従い、docs-only の前例（PR #142 = R2）との類推ではなく R3 とする（Plan Gate 独立レビュー P2-1 の裁定）。R4 としない理由: 本 PR 自体は destructive 操作を一切実行せず（docs のみ、git revert で完全に巻き戻せる）、R4 の explicit human approval + rollback/recovery notes は destructive 挙動が実際に変わる実装 2 PR 側の packet に付す。R3 の必須物（Spec Contract / Trace Matrix / Data Safety / Test Design Matrix / Contract Coverage Ledger / review-only 独立レビュー）は本 packet で満たす。

## Goal

Goal Invariant:

### 最小完了条件

- `docs/function-design/71-mnt-backup.md` と `docs/function-design/22-mnt-migration.md` の failure contract が、監査 findings P3-1 / P3-3 / P3b-1 / P3b-2 / P8b-3（[report](../research/audit-2026-07/report.md) 是正順 1+2、[adjudication](../research/audit-2026-07/adjudication.md) で R4 付与）の害経路をすべて契約レベルで塞いだ状態で正本確定しており、後続の実装者が設計書だけから R4 実装 2 PR を計画できる。

### 失敗定義

- 5 findings のいずれかの害経路（誤保持日数での backup 削除 / 部分 snapshot の成功扱いと migration 永久 skip / 旧 WAL 再生による誤復元 / ROLLBACK 失敗の無記録 / 失敗注入なしのテスト完了条件）が改訂後の設計書で依然として許容される、または実装判断に委ねられたまま残る。
- 設計改訂が既存の正しい契約（restore の退避・巻き戻し構造、v2 の foreign_keys 復元保証等）を壊す。

### 非目的

- 実装コードの変更（R4 実装 2 PR で行う）。
- 順7（P3-2 filesystem 記録規律）・順8（P3-4 利用者向け error 表示統一）・順3（整合性補正の正本確定）の設計。
- `docs/function-design/68-ui-backup-restore.md` の画面契約・state machine の変更（§68.7 の CMD 復旧記述の D4 追随と、durability 不明時の非断定文言 + 起動後確認契約の新設のみ scope 内 — 第 7 round P3 で同期）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `docs/function-design/22-mnt-migration.md`:
  - §3.2 エラーハンドリングに ROLLBACK 失敗契約を追加（MNT-03-D1）: ROLLBACK の失敗は `.ok()` で破棄せず `tracing::error!` で記録し、元エラーと併合した `DbError::MigrationFailed`（transaction 状態不明の旨を含む）を返す。migration.rs / schema_v2.rs / schema_v3.rs の全 ROLLBACK 箇所に適用する共通ヘルパー方針を明記。
  - 新節「legacy path 移行（migrate_legacy_db）」を追加: 現在コードコメントにしか存在しない移行契約の正本化。
    - MNT-03-D2: 移行方式を 3 ファイル個別コピーから「旧 DB を開き `VACUUM INTO` で一時ファイル名へ生成 → 成功後に最終名へ rename」へ変更。旧 DB は通常モードで開く（read-only 指定をせず、WAL recovery を SQLite に委ねる — read-only WAL 読取の特殊機構に依存しない）。WAL 取込みが SQLite 保証になり、部分状態が構造的に発生しない（rejected alternative: 3 ファイルコピー + WAL 失敗致命 + 部分削除 — WAL/SHM の意味論を自前で守り続ける必要が残る）。
    - MNT-03-D3: 新パス main は「完成品しか存在しない」を不変条件とする（一時名生成 + rename、失敗時は一時ファイルを削除して Err）。
    - MNT-03-D4: lib.rs は legacy 移行 Err で起動を中止する（fail-closed）。現行の「error log + 続行」は直後の `init_database` が空 DB を新規作成して以後の移行を永久 skip し、旧データを隠蔽するため禁止と明記。起動中止時は operator へ理由（旧データは無事、再起動で再試行、それでも失敗する場合の連絡誘導）を可視表示してから終了し、詳細は診断ログに残す。表示機構は `blocking_show` の main-thread 禁止（Codex P2-2）に適合するものを実装 PR1 の Contract Probe で確定し、本 packet では機構を固定しない。前提事実として、既存の起動失敗経路（`app_data_dir` 失敗等の setup Err → `.expect` panic）は release build（`windows_subsystem = "windows"`）で無言クラッシュになることを設計書に明記する — 本契約は「無言の空 DB 隠蔽（データ喪失に見える + 誤入力の継続）」より「可視の起動失敗（データ無傷 + 再試行可能）」を選ぶ判断であり、既存 3 経路の無言クラッシュの可視化は scope 外として backlog へ切り出す。
  - テスト方針: 未 checkpoint commit を含む実 SQLite WAL fixture での移行 + 新パス再 open での row 検証、失敗注入（VACUUM INTO 失敗 / rename 失敗）で部分状態ゼロ + 再試行可能、を実装 PR の完了条件として明記（P8b-3）。
- `docs/function-design/71-mnt-backup.md`:
  - §71.7 restore 契約改訂（MNT-01-D1): ステップ 2 checkpoint 失敗の非致命根拠を「退避が成功する場合に限る」と限定。ステップ 4 の退避は main / 存在する WAL / 存在する SHM のすべてで成功必須とし、いずれかの rename 失敗時は退避済みファイルを巻き戻して本体置換前に restore を中止（Err）。巻き戻し自体がさらに失敗した場合は既存ステップ 8e と同等の致命的エラー（アプリ再起動誘導、`tracing::error!` 記録）として扱う — 早期中止経路にも二重失敗契約を明示する。
  - §71.7 MNT-01-D4（Codex round 新設）: restore 失敗の「退避復元済み」と「状態不明/未復旧」の型分離。CMD 層の復旧再接続を no-create open に限定し、create-capable `init_database` の使用を禁止（68 §68.7 / 43 の CMD パターン記述も本契約へ追随）。
  - §71.7 MNT-01-D5（Codex round 新設、再レビュー round で manifest 方式へ改訂）: restore 中断（process/power interruption）の復旧契約。durable manifest（attempt ID + 退避対象存在集合）+ 起動時 reconcile + durability 契約（sync_all / 親 directory sync 順序）+ single-instance ガード前提（実装 PR1 の前提条件へ昇格）+ reconcile → legacy 移行 → init_database の順序固定。
  - §71.9 `resolve_backup_dir` の Result 化（MNT-01-D2): DB error は Err で返し、未設定・空文字のみ既定（`app_data/backups`）へ fallback する。現行コード例の `.ok().flatten()` は設計自体の欠陥（P3-1 補強のとおり）として書き換え。呼出し元契約: lib.rs 起動時 = warn + auto-backup skip で起動継続、settings_cmd = internal error として返す。D-032 の復元前強制バックアップ（break-glass 経路含む）は `create_backup` 経由で DB error が internal error として伝搬する既存挙動のままで矛盾しないことを §71.9 改訂に一行明記する。
  - §71.8 / cleanup の保持日数確定条件（MNT-01-D3): destructive fallback 禁止。retention_days は (a) 設定読取成功かつ数値、または (b) 設定行が存在しない（未設定 = 初期既定 3 日）の場合のみ確定。DB error・parse 失敗時は cleanup を skip して warn を記録し、削除は実行しない。
  - §71.10 テスト方針: 失敗注入行を追加（WAL 退避 rename 失敗 → 元 DB 再接続可能かつ置換なし、retention 読取失敗 → 削除 0 件、等）。
- `docs/decision-log.md`: D-048 起票 — failure contract の柱（①失敗を成功・既定値へ変換しない ②main/WAL/SHM 一式の原子性と「完成品しか存在しない」不変条件 ③destructive 操作は入力を確定できた場合のみ実行）+ 実装は R4 2 PR 分割（順1 = migration/restore 原子性、順2 = 設定読取・rollback 失敗処理）。
- `docs/function-design/43-cmd-settings-log.md`: restore CMD 処理ステップの復旧再接続行を MNT-01-D4 準拠（no-create open）へ更新（再レビュー round で drift 検出・是正）。
- `docs/function-design/68-ui-backup-restore.md`: §68.7 の CMD 復旧メカニズム記述を MNT-01-D4 準拠 + 構造化分類識別子へ更新（closure round / 再々レビュー round）。durability 不明ケース（MNT-01-D5 (e)(ii)）の非断定 operator 文言と起動後確認契約（操作ログ best-effort + データ内容確認 fallback）を文言表へ新設（第 5〜7 round）。state machine・既存文言・画面構成は不変。
- `docs/Plans.md`: 監査行を完了 [x] に更新し、本 design phase を進行中作業として追加。backlog に「起動時 setup 失敗の operator 可視化（既存 3 経路の無言クラッシュ解消、MNT-03-D4 起源）」を追加。single-instance ガードは backlog から MNT-01-D5 の前提条件（実装 PR1 scope）へ昇格（再レビュー round P1-3）。

## Non-scope

- 実装コード（src-tauri/）の変更一切。
- P3-2（順7）・P3-4（順8）・P7-1（順3）の設計と実装。ただし 71/22 に書く failure contract の一般原則（記録規律は `.claude/rules/implementation-quality.md` 準拠）を順7 が後で参照することは妨げない。
- 68-ui-backup-restore.md の state machine・既存文言・画面構成の変更（§68.7 の CMD 復旧記述の D4 追随・識別子化と、durability 不明ケースの非断定文言 + 起動後確認契約の新設のみ scope 内）。75-ui-integrity-check.md の変更。
- 監査 findings 自体の再検証（12/12 CONFIRMED 済み）。

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が ERROR 0（既存 WARN の増加なし）。
- 22-mnt-migration.md に MNT-03-D1〜D4、71-mnt-backup.md に MNT-01-D1〜D5 の decision ID が存在し、各 ID に why / rejected alternatives が付く。
- 5 findings（`docs/research/audit-2026-07/findings/p3-error-handling.md` の P3-1/P3-3/P3b-1/P3b-2、`findings/p8-test-quality.md` の P8b-3）それぞれについて、改訂後の設計書のどの節が害経路を塞ぐかを PR body の対応表で示せる（Matrix #8）。
- 独立 Final Review（設計内容 vs findings 突合、`docs/plans/test-matrices/2026-07-17-backup-migration-failure-contract-design.md` の #8/#12 を含む）の報告で P1 = 0 / P2 = 0。

## Design Sources

- Requirements / spec: REQ-903（DB 基盤 / マイグレーション）、MNT-01 / MNT-03 の既存契約
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO/MNT）
- Function / command / DTO: `docs/function-design/71-mnt-backup.md`、`docs/function-design/22-mnt-migration.md`、`docs/function-design/43-cmd-settings-log.md`（restore CMD 呼出しパターン）
- DB: `docs/DB_DESIGN.md`（WAL mode 運用）
- Screen / UI: `docs/function-design/68-ui-backup-restore.md`（§68.7 の CMD 復旧記述の D4 追随・識別子化 + durability 不明ケースの非断定文言・起動後確認契約の新設。state machine・既存文言・画面構成は不変）
- Decision log / ADR: D-032（restore 前強制バックアップ等）、新規 D-048
- 監査証拠: `docs/research/audit-2026-07/findings/p3-error-handling.md`、`findings/p8-test-quality.md`、`adjudication.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 71-mnt-backup.md / 22-mnt-migration.md | updated in this PR |
| Command / DTO / generated binding / wire shape | restore CMD の error に recoverable / unrecoverable の構造化分類識別子を追加（具体形は実装 PR1 で確定、順 8 と整合 — 再々レビュー P2-2）。他 command は変更なし | 68 §68.7 / 71 MNT-01-D4 |
| DB / transaction / audit / rollback / migration | 22-mnt-migration.md（ROLLBACK 契約 / legacy 移行） | updated in this PR |
| Screen / UI / route state / Japanese wording | durability 不明ケースの非断定文言 + 起動後確認契約を 68 文言表へ新設（第 5〜7 round。state machine・既存文言は不変） | 68 §68.7 / §68.11 |
| CSV / TSV / report / import / export format | 該当なし | existing sufficient |
| Durable decision / ADR | decision-log D-048 | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / route / function-design doc / REQ の追加なし。既存 2 doc の改訂と decision-log 追記のみ。traceability は設計書改訂で再生成不要 — テスト追加は実装 PR 側）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-903 / MNT-03 | 22 §3.2 エラーハンドリング | MNT-03-D1 | ROLLBACK 失敗の無記録は transaction 状態不明を隠す（P3-3）。rejected: 現行 `.ok()` 破棄 | 実装 PR2（migration.rs / schema_v2 / schema_v3） | 実装 PR2 の rollback 失敗注入テスト |
| REQ-903 / MNT-03 | 22 新節 legacy 移行 | MNT-03-D2〜D4 | 部分 snapshot の成功扱い + 空 DB 隠蔽（P3b-1）。rejected: 3 ファイルコピー継続 | 実装 PR1（db/mod.rs / lib.rs） | 実装 PR1 の実 WAL fixture テスト（P8b-3） |
| MNT-01 | 71 §71.7 | MNT-01-D1 | 旧 WAL 再生による誤復元（P3b-2）。rejected: warn 継続 | 実装 PR1（mnt/backup.rs） | 実装 PR1 の退避失敗注入テスト（P8b-3） |
| MNT-01 | 71 §71.8 / §71.9 | MNT-01-D2 / D3 | 誤保持日数での削除・保存先誤認（P3-1、設計欠陥の是正） | 実装 PR2（mnt/backup.rs / lib.rs / settings_cmd.rs） | 実装 PR2 の設定読取失敗テスト |
| MNT-01 | 71 §71.7 / 68 §68.7 / 43 | MNT-01-D4 | 二重失敗時の create-capable 復旧による空 DB 偽装（Codex P1-1） | 実装 PR1（mnt/backup.rs / settings_cmd.rs） | 実装 PR1 の巻き戻し失敗注入テスト |
| MNT-01 | 71 §71.7 | MNT-01-D5 | restore 中断の非原子性 + 世代混在 + durability + 並行 attempt（Codex P1-2、再レビュー P1×3） | 実装 PR1（mnt/backup.rs / lib.rs + single-instance ガード） | 実装 PR1 の failpoint 中断・世代混在・二重起動テスト |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 改訂後の 71/22 が failure contract・why・rejected alternatives を自足的に持つことを Final Review で確認する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-048 として起票（本 packet には契約を残さない）。
- Assumptions and constraints: SQLite の確立済み挙動（`VACUUM INTO` は WAL 取込み済み単一ファイルを生成 / `-shm` は再 open 時に再構築される / 旧 WAL は同名 main に対して再生され得る）を前提とする。監査で 3 系統の独立検証済み。実装 PR の実 WAL fixture テストがこの前提の empirical validation を兼ねる。
- Deferred design gaps, risk, and follow-up target: 順7 の記録規律実装・順8 の error 表示統一は本改訂の一般原則を引き継いで別変更で設計する。既存 setup 失敗 3 経路（`app_data_dir` 失敗等）の無言クラッシュ可視化は本 scope 外の既知ギャップとして Plans.md backlog へ切り出す（MNT-03-D4 は新設する移行失敗経路のみ dialog 可視化を契約する）。
- Test Design Matrix can cite design decision IDs or source doc sections: 実装 PR の Matrix が MNT-03-D1〜D4 / MNT-01-D1〜D5 を引用できる粒度で ID を切った。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable — 外部 adapter なし、MNT 層内部契約のみ | — |
| Fact check / design decision split | SQLite 挙動（VACUUM INTO / SHM 再構築 / WAL 再生）= 観測事実、fail-closed 起動・destructive fallback 禁止 = 設計判断として分離して記述 | 22 / 71 / D-048 |
| Lifecycle / retry | 移行・restore・cleanup の before / during / after / after-failure を契約表で固定。失敗後の再試行可能性（部分状態ゼロ）が中核 | 22 新節 / 71 §71.7 |
| Operator workflow | 起動中止（MNT-03-D4）は operator 可視の新経路。既存の起動失敗経路は release build で無言クラッシュ（実証済み: `windows_subsystem = "windows"` + setup Err の `.expect` panic）のため「既存経路に従う」は不成立 — D4 は operator 可視化を契約に含め（表示機構は threading 契約適合の上で実装 PR1 Contract Probe で確定）、文言は 22 新節で新設する。既存 3 経路の可視化は backlog | 22 新節 / Plans.md backlog |
| Replacement path | not applicable — 外部システム置換なし | — |
| Data safety / evidence | 実 DB / backup を commit しない。テスト方針は tempdir + 合成 fixture のみ | Test 方針節 |
| Reporting / accounting semantics | not applicable — 集計意味論に非接触 | — |
| Manual verification | failure injection は自動化。ただし MNT-03-D4 のエラーダイアログ pre-window 表示（機構選定含む）は Windows 実機確認が実装 PR1 の完了条件（Ledger 該当行と 22 §12.5 に整合。旧記述「L3 不要」は Codex Final P3-1 指摘で訂正） | 71 §71.10 / 22 §12.5 / Ledger MNT-03-D4 行 |

## Design Readiness

- Existing design docs are sufficient because: 不十分（本 PR がその是正）。71 §71.9 はコード例が握りつぶしを指定し、§71.7 は WAL 退避失敗の契約を欠き、22 は ROLLBACK 失敗時挙動と legacy 移行契約を持たない。
- Source docs updated in this PR: 71-mnt-backup.md / 22-mnt-migration.md / decision-log.md。
- Design gaps intentionally deferred: 順7・順8・順3（Non-scope 参照）。
- Durable decisions discovered in this plan and promoted to source docs: D-048。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): MNT/DB 層内部の契約変更のみ。層境界は不変。
- Backend function design: `resolve_backup_dir` のシグネチャ変更（Result 化）と `migrate_legacy_db` の方式変更を関数契約として明記。
- Command / DTO / data contract: restore CMD の error に recoverable / unrecoverable の構造化分類識別子を追加する（wire 具体形は実装 PR1 で確定し、順 8 の kind 拡張と整合。68 §68.7 の遷移条件と frontend 判定を message 部分一致から識別子ベースへ移行 — 再々レビュー P2-2）。他 command の wire shape は変更なし。
- Persistence / transaction / audit impact: ROLLBACK 失敗記録・移行原子性・cleanup 確定条件が本改訂の中核。
- Operator workflow / Japanese UI wording: 起動中止経路のみ operator 可視、新規文言なし。
- Error, empty, retry, and recovery behavior: 全 findings が error path の契約化。再試行可能性（部分状態ゼロ）を不変条件として明記。
- Testability and traceability IDs: MNT-03-D1〜D4 / MNT-01-D1〜D5 を実装 PR のテストが引用する。

## Contract Probe

- SQLite `VACUUM INTO` の WAL 取込み: 既存 `create_backup` の本番稼働実績は「既に開いている read-write 接続」上のもの。MNT-03-D2 は「旧 DB を新規に開いた接続」上の実行であり前提が同一ではないため、旧 DB は通常モードで開く設計（read-only WAL 読取の特殊機構に依存しない）とした上で、実装 PR1 の実 WAL fixture テスト（未 checkpoint commit を含む DB を新規接続で開いて VACUUM INTO → 生成物再 open で row 検証、P8b-3 完了条件）を本前提の empirical validation として必須化する。設計段階の追加 probe は行わない（設計は監査 3 系統検証済みの静的事実と SQLite 文書化挙動のみに依拠し、検証は実装 PR のテストが担う）。

## Contract Coverage Ledger

R3 必須。本 design PR の「実装」は設計書改訂そのものなので、Implementation target 列は改訂先の doc 節と後続実装 PR の両方を指す。後続 R4 実装 PR の Ledger 原型を兼ねる。

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| MNT-03-D1 ROLLBACK/COMMIT 失敗の記録 + 併合 + FK 復元の再読取検証 | 実装 PR2 | rollback 失敗注入 + COMMIT=BUSY + FK 復元検証 | non-scope（自動化） |
| MNT-03-D2/D3 legacy 移行の VACUUM INTO + 完成品不変条件 | 実装 PR1 | 実 WAL fixture + 失敗注入 | non-scope（自動化） |
| MNT-03-D4 移行失敗時の起動中止 | 実装 PR1 | lib.rs 経路（可能な範囲で自動化、残りは実装 packet で判断） | 実装 packet で判断。Contract Probe で確定した表示機構の pre-window（setup 段階、webview マウント前）動作を Windows 実機で確認することを実装 PR1 の完了条件に含める |
| MNT-01-D1 退避失敗での restore 中止 | 実装 PR1 | 退避 rename 失敗注入 | non-scope（自動化） |
| MNT-01-D2 resolve_backup_dir Result 化 | 実装 PR2 | DB error 時の Err 伝搬 | non-scope（自動化） |
| MNT-01-D3 cleanup 確定条件 | 実装 PR2 | 読取失敗時 削除 0 件 | non-scope（自動化） |
| MNT-01-D4 二重失敗の unrecoverable 化（no-create 復旧） | 実装 PR1 | 巻き戻し失敗注入で main 不在を作り、CMD 復旧が空 DB を作らず unrecoverable を返す（71 §71.10） | non-scope（自動化） |
| MNT-01-D5 restore 中断の phase 付き manifest + 起動時 reconcile | 実装 PR1（single-instance ガード導入が前提条件） | 各 mutation・sync・manifest 操作直後の failpoint 中断（phase=active 一致 / 真部分集合 / phase=committed + reconcile 再中断）→ 世代混在なく再接続可能 + 遺物ゼロ、fail-closed 3 分岐（旧形式遺物・superset・パース不能）で遺物不変更 + 起動中止、同期巻き戻しの世代掃除、二重起動で後発が mutation へ到達しない（71 §71.10） | non-scope（自動化） |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-17-backup-migration-failure-contract-design.md](test-matrices/2026-07-17-backup-migration-failure-contract-design.md)

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan` / `bash scripts/doc-consistency-check.sh`（docs-only のため設計書整合が主ゲート）。
- negative tests: 実装 PR 側（本 packet では設計書のテスト方針節として固定）。
- compatibility checks: design_compliance_test が要求する 71/22 の必須セクション（シグネチャ / 処理ステップ / エラーハンドリング）を維持。
- data safety checks: 実データ・実 backup をテスト方針に含めない（tempdir + 合成 fixture のみ）。
- main wiring/integration checks: 該当なし（docs-only）。

## Boundary / Wire Contract

restore CMD の error に recoverable / unrecoverable の構造化分類識別子を追加する（wire 具体形 = `CmdError` への kind 等は実装 PR1 で確定し、順 8 の kind 拡張と整合。frontend の message 部分一致判定の置換を含む — 再々レビュー P2-2）。それ以外は非接触 — `resolve_backup_dir` の Result 化は Rust 内部シグネチャで、他 command の wire shape（`get_effective_backup_dir` の返り値等）は不変。

## Review Focus

- 5 findings の害経路それぞれが契約で塞がれているか（穴の残る failure path はないか）。
- MNT-03-D4（起動中止）が operator にとって空 DB 隠蔽より安全side か、tradeoff の記述が十分か。
- MNT-01-D3 の「未設定 = 既定 3 日」と「読取失敗 = skip」の区別が実装可能な形で書かれているか。
- 既存の正しい契約（CMD 層再接続パターン、v2 foreign_keys 復元保証）を壊していないか。

## Spec Contract

Contract ID: SPEC-MNT-FAILURE-CONTRACT-2026-07-17

- backup / restore / legacy 移行 / schema migration の失敗は、成功・既定値・部分状態へ変換されず、記録された上で呼出し元へ伝搬するか、安全に中止される。destructive 操作（backup 削除・DB 置換・起動継続）は入力と前提状態を確定できた場合のみ実行する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-MNT-FAILURE-CONTRACT-2026-07-17 | Scope の 71/22/D-048 改訂 | doc-consistency 2 種 | 5 findings との突合 | PR body 対応表 |

## Data Safety

- 実 POS / 店舗 DB・backup ファイル・実パスを docs に書かない（例示は合成パスのみ）。
- テスト方針は tempdir + 合成 fixture 限定と明記する。
- 本 PR は docs-only であり destructive 操作を含まない。

## Implementation Results

Fill after implementation.

## Review Response

- Plan Gate round 1（独立 Plan Reviewer = Sonnet subagent、2026-07-17）: P1 = 0 / P2 = 3 / P3 = 2、verdict「plan-draft へ差し戻し」。裁定と対応:
  - P2-1（Risk R2 表記の矛盾）: accept。R3 へ訂正し、adjudication の R4 付与との関係と R4 としない理由を Risk 節に明記。Test Design Matrix / Ledger 必須化を反映。
  - P2-2（起動失敗経路の事実誤認）: accept（Coordinator が lib.rs / main.rs で実証再確認）。MNT-03-D4 を blocking dialog 可視化込みの契約へ改訂、既存 3 経路の無言クラッシュは backlog 化。
  - P2-3（退避巻き戻しの二重失敗が未規定）: accept。MNT-01-D1 に致命的エラー契約（既存ステップ 8e と同等）を追記。
  - P3-1（Contract Probe の理由づけ）: accept。read-write 稼働実績と新規接続の前提差を明記し、通常モード open + 実装 PR1 の実 WAL fixture テストを empirical validation として必須化。
  - P3-2（D-032 break-glass との接続明記）: accept。§71.9 改訂項目に一行追加。
- Plan Gate round 3（同 Plan Reviewer、差分最終確認、2026-07-17）: round 2 対応 3 箇所（Workflow State / Ledger MNT-03-D4 行 / Review Response）を確認、残存参照・新規矛盾なし、verdict「plan-gate 通過可（P1/P2 = 0）」。
- state-only 遷移記録（2026-07-17）: `plan-gate -> plan-approved -> implementing` を単一 state-only commit で materialize。根拠 = Plan Reviewer round 3 の P1/P2 = 0 報告（plan-gate -> plan-approved）、Plan Commit `3f7fc18` が全実装（設計書改訂）commit に先行すること（plan-approved -> implementing）。
- Plan Gate round 2（同 Plan Reviewer、差分再レビュー、2026-07-17）: round 1 P2×3 / P3×2 の対応は全件解消と判定。新規 P2 = 1 / P3 = 1、verdict「再差し戻し」。裁定と対応:
  - 新規 P2（Hosted CI Requirement: not-required と R3 の不整合）: accept（Coordinator が ci.md 39〜66 行を再読して誤読を確認 — R3/R4 は「原則 1 run」で、pure docs-only 0 run は R0/R1 対の規定）。`required` へ訂正し、docs-only の hosted final は owner Ready 後の explicit `workflow_dispatch` 1 run と Human Gate に明記。
  - 新規 P3（blocking dialog の pre-window 動作未検証）: accept。Ledger MNT-03-D4 行に Windows 実機での pre-window 呼び出し動作確認を実装 PR1 完了条件として追記。
- 独立 Final Review（Contract Audit、Sonnet subagent = Plan Reviewer と別 context、2026-07-17、audited content = `5f7ee60`）: P1 = 0 / P2 = 0 / P3 = 2、verdict「human-confirm へ進行可」。Matrix #8 の 5 findings × 対応節の被覆を確認、Matrix #12 の既存契約非破壊（CMD 再接続 / v2 foreign_keys 復元 / D-032 / 68-ui）を実装現物と突合済み。裁定:
  - Final P3-1（§71.7 ステップ 7a の削除失敗記録の欠落）: 監査 P3-2 = 順 7 の既知ギャップで本 packet の Non-scope に明記済み。記録のみ、対応なし。
  - Final P3-2（実 WAL fixture テスト fail 時の設計再検討の明文化）: accept。22 §12.5 に一行追加（audited content 後の P3-only 差分、reviewer 再エンゲージなし）。
- state-only 遷移記録（2026-07-17、第 2）: `local-verified -> independent-review -> human-confirm` を単一 state-only commit で materialize。根拠 = content candidate `5025386` に対する L1 `local-ci.sh full` PASS/CLEAN（implementing -> local-verified、evidence は PR body）、独立 Final Reviewer の P1/P2 = 0 報告（independent-review -> human-confirm。audited content は `5f7ee60`、以降の差分は accept 済み Final P3-2 の一行追記のみ）。`Reviewed Content HEAD` は P3 反映後の content candidate `5025386` を指す。
- Codex 独立レビュー（owner 発注・relay 経由、PR #14 COMMENTED review、2026-07-17、live HEAD `0a94983` 時点）: P1 = 3 / P2 = 4 / P3 = 2。Coordinator 裁定（各 P1 と P2-2 は実物・vendored source で実証確認済み）:
  - P1-1（二重失敗時の create-capable 復旧が空 DB を recoverable に偽装）: accept・CONFIRMED（`init_database` は main 不在で新規作成、68 §68.7 は message 駆動分岐）。MNT-01-D4 新設 + §71.7 CMD パターン改訂。
  - P1-2（逐次 rename の process/power 中断非原子性）: accept。MNT-01-D5 新設（durable marker + 起動時 reconcile + reconcile→legacy 移行→init の順序固定）。attempt 毎の一意 staging は過剰として棄却、理由は D5 に記録。
  - P1-3（「旧 DB 無し」と「確認不能」未分離 + TOCTOU）: accept・CONFIRMED（lib.rs `if let Ok(cwd)` / `Path::exists` の error 潰し）。22 §12.2 改訂（try_exists 相当 + NO_CREATE open + 確認不能は D4 行き）。
  - P2-1（publish の no-clobber / single-instance）: 部分 accept。no-clobber 契約は §12.2 ステップ 6 に追加、single-instance 直列化は実発生根拠がないため Plans.md backlog（post-freeze P2 の follow-up 扱い）。
  - P2-2（blocking_show の main thread 禁止）: accept・CONFIRMED（vendored tauri-plugin-dialog 2.7.1 lib.rs:355-356）。MNT-03-D4 の機構指定を撤回し、threading 契約適合 + 実装 PR1 Contract Probe での機構確定に改訂。
  - P2-3（COMMIT 失敗が D1 から漏れ）: accept（migration.rs:111 の直接 `?` を確認）。MNT-03-D1 に COMMIT + `is_autocommit()` + FK 復元前提を追加。
  - P2-4（テスト方針の偽陽性リスク）: accept。71 §71.10 / 22 §12.5 に fixture 必須条件（WAL frame 事前 assert / failpoint / checkpoint 3 列検査）を明記。
  - P3-1（packet 内 Manual verification 矛盾）: accept。lens 行を訂正（本 amendment）。
  - P3-2（dashboard 同期 commit が live PR 未反映）: accept・原因は前回 push の失敗。`b0fb64d` push で解消済み。
- Closure 確認レビュー（Codex 受理分反映 `e80587b` に対する独立 read-only 監査、Sonnet subagent、2026-07-17）: P1 = 1 / P2 = 2 / P3 = 3、verdict「差し戻し」。全件が受理分反映 commit 自体の欠陥是正のため freeze 例外に準じて same-PR 修正。裁定:
  - Closure P1（MNT-01-D5 reconcile が「marker あり + 退避遺物なし」を未分岐 — 文字どおり実装すると main 削除 → 復元元不在で新旧両方を失う反例）: accept。D5 を 3 分岐へ改訂し、巻き戻しの削除単位を「退避側に存在するファイルごと」に限定。
  - Closure P2-a（68 §68.7 が撤回済み create-capable 復旧の記述のまま）: accept。68 §68.7 を no-create open + MNT-01-D4 参照へ更新（scope 節の「68 は non-scope」は UI 文言・画面契約を指し、D4 が変えた CMD 復旧機構の記述整合は本 PR の責務と裁定）。
  - Closure P2-b（packet の AC / Design Intent Audit / Minimum design checks / Ledger が D4/D5 未反映）: accept。本 amendment で D1〜D5 表記へ訂正、Ledger に D4/D5 の 2 行を追加。
  - Closure P3×3（成功直後〜marker 削除前中断の巻き戻り挙動を Why に文書化 / 22 §12.2 ステップ 1 の存在確認 error 処理の対称性 / FK 復元 PRAGMA 失敗の記録対象化）: すべて accept・一行追記で対応。
- state-only 遷移記録（2026-07-17、第 3）: `implementing -> local-verified -> independent-review -> human-confirm` を amendment `94fa8bc` への同乗で materialize（当初は独立 state-only commit として記録、後述の STATECAP 是正 rebase で融合）。根拠 = content candidate `d89ac6f`（+ packet amendment `94fa8bc`）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、独立 closure 再検証（Sonnet subagent、closure Reviewer とは別 context）の全 6 findings closed / 新規矛盾なし報告（independent-review -> human-confirm）。`Reviewed Content HEAD` は closure 反映後の content candidate `d89ac6f` を指す。
- Codex 再レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-17、live HEAD `48af9d0`（rebase 前 `06cf93a`） 時点）: 前回 9 findings の閉鎖確認（closed 6 / not-closed 3）+ fresh P1×3 / P2×2 / P3×1、verdict「merge blocker あり」。Coordinator 裁定（全件実証裏取り済み、`02da8ba` で human-confirm -> implementing へ backtrack）:
  - not-closed P1-1（43:206 が create-capable `init_database` 復旧のまま）: accept・CONFIRMED（drift fix の grep 漏れ）。43 の処理ステップを D4 準拠へ更新。
  - not-closed P1-2 / fresh P1-1（presence 3 分岐では旧 WAL と attempt 生成世代を区別できない — 「退避に無い元名を削除する」と退避途中中断の旧 WAL を失い、「削除しない」と restore 成功後中断の新世代 WAL が旧 main と混在する。単純規則の両側に反例）: accept。D5 を manifest 方式（attempt ID + 退避対象存在集合の記録、実在集合との一致/真部分集合で世代判定）へ全面改訂。前 round の「manifest は過剰」棄却を撤回し、Rejected alternatives に旧 marker 案を反例つきで記録。
  - fresh P1-2（durability barrier 未規定 — page cache 上の copy 完了と削除 metadata の永続順序が逆転すると reconcile のどの分岐にも入らない状態が生じる）: accept。D5 に durability 契約（manifest write→sync_all→dir sync / rename の dir sync / 新 main sync_all / manifest の durable 削除→退避削除の順序）を明文化。
  - fresh P1-3 / not-closed P2-1（固定 manifest/退避名が存在しない single-instance 保証に依存）: accept・前 round の「実発生根拠なしで backlog」裁定を転換（owner 承認済み）。single-instance ガードを MNT-01-D5 の前提条件として実装 PR1 scope へ昇格、D5 冒頭に前提として明記、22 §12.2 の backlog 参照も更新。
  - fresh P2-1（FK 復元 PRAGMA は transaction 中に成功を返す no-op があり得る）: accept。MNT-03-D1 に is_autocommit 確認後の復元 + 再読取一致検証 + 閉塞時は接続破棄必須の構造化 fatal を追加。
  - fresh P2-2（packet Scope/Trace が現 diff 未同期 — 撤回済み blocking dialog 指定・「CMD 再接続現行維持」・68 non-scope 表記の残存、Trace に D4/D5 行なし）: accept・CONFIRMED。本 amendment で Scope（63/66/71/77/93 相当行）・Trace・Ledger を同期。
  - fresh P3（Reviewed Content HEAD が AC/Ledger を変えた `94fa8bc` でなく親 `d89ac6f`）: accept。本 round の遷移時から「packet amendment を含む最新 content-bearing commit」を指す運用に統一。
- 再レビュー反映の独立検証（Sonnet subagent、別 context、2026-07-17）: Part A = 全 7 対応 closed。Part B（新 D5 契約への敵対的検証、中断ケース 20〜25 列挙）= 中核不変条件は全ケース保持、ただし P2×2 / P3×2 を検出、全件 accept・即時反映:
  - 検証 P2-a（22 §9 の v2 scopeguard「必ず復元」が D1 の is_autocommit ゲートと矛盾 — 字義どおり実装すると閉塞時契約に違反）: 22 §9 を D1 参照 + ゲート必須へ改訂。
  - 検証 P2-b（manifest 作成/削除が §71.7 の番号付きステップ本文に未統合 — D5 を読まない実装で crash-safety 全体が欠落）: ステップ 3.5（manifest 作成 + 残骸 fail-closed）/ 7a（durable 削除）/ 8c・8e（巻き戻し後削除・二重失敗時は残置）を本文へ統合。
  - 検証 P3×2（manifest パース不能時の規則未定義 / 復元成功直後の operation_log 欠落）: reconcile に第 4 規則（パース不能 + 退避なし = 削除のみ、+ 退避あり = fail-closed 起動中止）を追加、log 欠落はステップ 7c 注記で受容を文書化。
- state-only 遷移記録（2026-07-17、第 4）: `implementing -> local-verified -> independent-review -> human-confirm` を amendment `c921dd5` への同乗で materialize（当初は独立 state-only commit として記録、後述の STATECAP 是正 rebase で融合）。根拠 = content candidate `c921dd5`（再レビュー反映 `e7815b1` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、独立検証（Sonnet subagent、別 context）の Part A 全 7 対応 closed + Part B 敵対的検証（中断ケース 20+）で中核不変条件全ケース保持、検出 P2×2/P3×2 の修正も同 reviewer が差分再検証で全件 closed / 新規矛盾なしを確認（independent-review -> human-confirm）。`Reviewed Content HEAD` は packet amendment を含む最新 content-bearing commit `c921dd5` を指す（再レビュー P3 の運用統一に従う）。
- Codex 再々レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-17、live HEAD `62a223d`（rebase 前 `2f8f607`） 時点、状態機械トレース 48 系列）: 前 round 10 判定中 8 closed（fresh P1-1 は反例再実行トレースで閉鎖確認）、fresh P2-2 の packet/PR body 面 not-closed、fresh P1×2 / P2×2 / P3×1、verdict「merge blocker あり」。Coordinator 裁定（全件実証裏取り済み、`d1833b2` で human-confirm -> implementing へ backtrack）:
  - 再々 P1-1（同期巻き戻し = ステップ 8 が「存在する退避だけ戻す」旧手順のままで、部分 migration が生成した新世代 WAL/SHM を元名側に残し世代混在を作る — reconcile 一致分岐との対称性欠落）: accept・CONFIRMED（テキスト事実）。ステップ 8 を reconcile 一致分岐と同一手順（元名側全削除 + sync → 記録集合復帰 → manifest durable 削除）へ統合、§71.10 に回帰固定テスト行を追加。
  - 再々 P1-2（「manifest なし + 退避あり = 成功後掃除中断」規則が、同じ固定退避名を使う現行実装（backup.rs:263 実確認）の中断残骸 — 唯一の実データを含み得る — をアップグレード境界で削除する）: accept・CONFIRMED。manifest に phase（active/committed）を追加し、成功 commit は phase=committed の原子的 durable 更新で表現。manifest 不在 + 退避遺物は自動削除せず fail-closed 起動中止へ変更。phase なし案は Rejected alternatives に反例つきで記録。
  - 再々 P2-1（実在集合が記録集合の部分集合でない superset/mixed が 4 規則のどれにも入らない）: accept。catch-all fail-closed 分岐（遺物不変更 + operator 可視化）を追加。
  - 再々 P2-2（D4 の構造化分類が 68/frontend へ届かず message 部分一致のまま — BackupRestorePage.tsx:80 の substring 判定を実確認）: accept。68 §68.7 の遷移条件を構造化分類識別子ベースへ改訂（文言は表示専用）、D4 に CMD→UI 伝搬規定を追記、packet の「wire shape 変更なし」を識別子追加（具体形は実装 PR1、順 8 整合）へ訂正。
  - 再々 P3（ステップ 4 早期失敗の巻き戻し後 manifest 削除が本文にない）: accept。ステップ 4 に durable 削除 / 失敗時残置を明記。
  - not-closed P2-2（packet 140/159/175/273 行の残存 drift + PR body Scope 未同期）: accept・CONFIRMED。packet 4 箇所を本 amendment で是正、PR body は Scope 節を最終 diff へ全面同期。
- 再々レビュー反映の独立検証（同 Sonnet reviewer、2026-07-17）: Part A 全 6 項目 closed。Part B（phase 化 D5 への敵対的検証、中断ケース 25）= 反例・未定義状態なし、中核不変条件全ケース保持（phase rename の非耐久性は既承認の受容窓と一致、ステップ 4 巻き戻しの手順省略は元名側必空で等価と棄却理由まで確認）。検証が新規検出した「wire shape 変更なし」訂正漏れ 2 箇所（Required Design Artifacts 表 / Boundary・Wire Contract 節）+ Ledger D5 行の陳腐化（P2×1/P3×1 相当）は本 amendment で即時是正 — 159 行のみ修正して同主張の他箇所を grep しなかった drift 是正不徹底の再演として記録する。
- STATECAP 是正 rebase（owner 承認、2026-07-17）: forward `state-only遷移` commit が 4 件となり cap 3 / post-implementation cap 2 を超過（L1 STATECAP FAIL で検出 — DEV_WORKFLOW の UI-13 教訓「遷移 commit 作成直後に check-workflow-git.sh を回す」を怠った運用ミスとして記録）。規約「every other transition rides an adjacent content commit」に従い、遷移 #3（旧 `0540542`）を closure amendment `94fa8bc` へ、遷移 #4（旧 `4f0d0ca`）を再レビュー amendment `c921dd5` へ融合する rebase + force-push を owner 承認の下で実施。融合後の forward 遷移は `ac3b63d`（plan-approval）/ `0a94983`（post-impl 第 1）の 2 件で、残枠 1 は ready-hosted-final 遷移用。rebase により本記録内の当該範囲 SHA は付け替え済み（レビュー時点の旧 live HEAD は併記）。
- state-only 遷移記録（2026-07-17、第 5）: `implementing -> local-verified -> independent-review -> human-confirm` を本 commit（dashboard 同期 + rebase 帳簿更新）への同乗で materialize。根拠 = content candidate `832fc2f`（再々レビュー反映 `aebf350` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（rebase 後 HEAD で再実行、implementing -> local-verified、evidence は PR body）、再々レビュー反映の独立検証（Part A 全 6 closed + Part B 中断ケース 25 で反例なし、検出 P2/P3 是正の差分確認込み。independent-review -> human-confirm）。
- Codex 第 4 round レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-17、live HEAD `051341e` 時点、状態機械トレース 75 系列）: 前 round 7 判定 = **7/7 closed**（P1-1/P1-2 は反例再実行トレースで閉鎖確認）、fresh **P1 = 0** / P2×2 / P3×1、verdict「merge blocker あり（P2 を same-PR で）」。Coordinator 裁定（全件テキスト事実で CONFIRMED、`e528d40` で human-confirm -> implementing へ backtrack）:
  - 第 4 P2-1（committed cleanup が再中断に durable に閉じない — 退避 unlink と manifest unlink の間の dir sync 欠落で、電源断の unlink 永続順序逆転により「manifest なし + 退避あり」= fail-closed 誤爆が正常完了後に出現。cleanup 失敗の結果分類も未規定）: accept。durability 契約 (d) を「退避 unlink → dir sync → manifest unlink → dir sync」へ精密化し、(e) cleanup 失敗分類を新設（phase 更新失敗 = 新接続非公開 + 退避残置 / committed 後の cleanup 失敗 = 復元成功維持 + committed manifest 残置で次回 reconcile が冪等再処理）。ステップ 7b/7c とエラーハンドリング節へ反映。
  - 第 4 P2-2（phase 更新 temp が状態機械の遺物集合に含まれない — rename 前中断で temp 孤児が残り「遺物ゼロ」违反 + 次回 restore の原子的更新と衝突）: accept。canonical temp 名 `{db_path}.restore_manifest.tmp` を契約化し、ステップ 3.5 の残骸検査と reconcile 規則（canonical あり = 未 commit 残骸として durable 削除 / temp 単独 = 削除後 manifest なし系規則を適用）へ組込み。§71.10 に cleanup durability 順序の failpoint テスト行を追加。
  - 第 4 P3（Amendments 行の「本 amendment」が rebase 確定後も未置換で PK5 の ancestry 検証対象が件数と不一致）: accept。`832fc2f` を明記し、以後の amendment SHA は直後の状態帳簿 commit で確定追記する運用に統一（自己参照問題の恒久解）。
- 第 4 round 反映の独立検証（同 Sonnet reviewer、2026-07-17）: Part A 全 4 項目 closed（P2-1/P2-2 は Codex 反例の再実行トレースで不成立を確認 — 新 cleanup 順序では「manifest なし + 退避あり」到達経路が構造的に消滅、temp は reconcile が分岐前に無条件 durable 削除）。Part B（cleanup 経路の局所敵対検証、中断ケース 18）= 反例・誤爆・孤児・冪等性破れなし。R3「遺物不変更」と temp 削除の字面優先順位は表現精度のみの P3 と判定し是正不要。
- state-only 遷移記録（2026-07-17、第 6）: `implementing -> local-verified -> independent-review -> human-confirm` を本 commit（状態帳簿 + dashboard 同期）への同乗で materialize。根拠 = content candidate `36c9388`（第 4 round 反映 `81393bd` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、第 4 round 反映の独立検証（Part A 全 4 closed + Part B 反例なし。independent-review -> human-confirm）。
- Codex 第 5 round レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-17、live HEAD `d63eb57` 時点、状態機械トレース 38 系列）: 前 round 3 判定 = **3/3 closed**（P2-1/P2-2 は反例再実行トレースで閉鎖確認）、fresh **P1 = 0** / P2×3 / P3 = 0、verdict「merge blocker あり」。Coordinator 裁定（全件テキスト事実で CONFIRMED、`ab6c5af` で human-confirm -> implementing へ backtrack）:
  - 第 5 P2-1（temp-only 残骸が reconcile の起動条件に含まれず dispatcher から到達不能 — 規則だけ新設して入口を追加し忘れた drift）: accept。起動条件と restore 開始時残骸検査の列挙に `.restore_manifest.tmp` を追加、§71.10 に実 startup dispatcher 経由の統合テスト条件を明記。
  - 第 5 P2-2（§71.10 oracle が rename 前の中断まで committed 分岐完了を要求 — 正しい実装をテストが落とすか temp を commit signal と誤認する実装を誘導）: accept。oracle を「rename 前 = active 一致復帰 / dir sync 完了後 = committed / rename 後〜sync 前 = 回復した canonical phase に従い双方許容」へ分割。
  - 第 5 P2-3（rename 成功後の dir sync 失敗で「manifest は active のまま」と断定 — 名前空間上は committed 済みで電断後の回復先を一意に断定できない実装不能な事後状態保証）: accept。(e) を 2 分類へ精密化（rename 前 = active 確定 Err / rename 後 sync 失敗 = durability 不明・新接続非公開・退避保持・unrecoverable、再起動時は実回復 phase に従う）。manifest unlink 後の sync 失敗も「committed 残置 / absent の双方を許容し安全収束」へ緩和。ステップ 7a・エラーハンドリング節へ反映。
- 第 5 round 反映の独立検証（同 Sonnet reviewer、2026-07-17）: 3 項目全 closed（temp dispatcher 到達性 / oracle 分割と temp 規則の相互補強 / (e) 2 分類と D4 分類の整合）。ただし検証の敵対確認が**新規 P2 を検出**: (e)(ii) の精密化により「unrecoverable（失敗）表示 → 再起動 → committed 回復で実は復元成功」のケースが生まれたが、operator が遅延成功を知る手段が設計に無い（第 4 round までは単一結果だったため存在しなかったギャップ）。裁定 = accept・same-PR: (e)(ii) の文言を非断定（「復元が完了したか確定できませんでした」）へ変更（unrecoverable 分類・terminal 分岐は不変、表示専用文言の差し替え）、reconcile committed 分岐の解消後に operation_log へ復元完了（起動時確定）を記録 — ステップ 7d の log 欠落補完を兼ね、旧「監査証跡欠落の受容」を解消。68 §68.7・§71.10 へ追随。UX P2 修正の閉鎖確認も同 reviewer で全 4 項目 closed（committed / active 両分岐の operator 体験を再トレース、新規矛盾なし。指摘された log 書込み接続の確保タイミングは「reconcile は DB を開かない原則を保ち、init_database 後に記録要求を書き込む」で即時明文化）。
- state-only 遷移記録（2026-07-17、第 7）: `implementing -> local-verified -> independent-review -> human-confirm` を本 commit（状態帳簿 + dashboard 同期）への同乗で materialize。根拠 = content candidate `ad83d3b`（第 5 round 反映 `c3de2f6` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、第 5 round 反映の独立検証（3 項目 closed + UX P2 検出・是正・閉鎖確認 4 項目 closed。independent-review -> human-confirm）。
- Codex 第 6 round レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-17、live HEAD `154dfd1` 時点、論理トレース 34 系列）: 前 round 4 判定 = closed 2（P2-1/P2-2）/ **not-closed 2**（P2-3 の断定残存 / UX P2 の記録要求非永続）+ fresh P2×1 / P3×1、verdict「merge blocker あり」。Coordinator 裁定（全件 CONFIRMED、`68eceaf` で human-confirm -> implementing へ backtrack）:
  - 第 6 P2 / UX P2 not-closed（同根 — 7c manifest durable 削除後・7d INSERT 前の中断で manifest/temp/退避が全て無く reconcile 非起動 → operation_log 恒久欠落。メモリ上の記録要求も init_database 失敗で消失）: accept。**committed manifest を log 記録完了まで durable な pending marker として保持**する構造へ改訂 — ステップ 7 を「7a committed 化 → 7b 退避削除 → 7c attempt ID 冪等 INSERT → 7d manifest 削除」へ再構成し、reconcile committed 分岐は退避掃除のみ行い manifest を残し、init_database 後に冪等 INSERT → manifest 削除。init 失敗・INSERT 前後中断の全系列で「記録ちょうど 1 件 + 残骸ゼロ」へ収束（§71.10 に回帰固定）。Coordinator の先行見立て「メモリフラグで足りる（P3 級）」は誤りで、Codex の P2 判定と pending marker 方式を採用。
  - 第 6 P2-3 not-closed（ステップ本文・エラー節の「committed manifest 残置」断定が二値性契約と矛盾したまま）: accept。ステップ 7d・エラーハンドリング節を「committed 残置 / absent の二値、log は 7c で保全済み」へ統一。
  - 第 6 UX P2 not-closed の 68 面（68:179 の一覧表が失敗断定文言のまま）: accept。文言表に durability 不明ケースの行を追加（terminal 分岐同一、非断定文言 + 操作ログ確認誘導）。
  - 第 6 P3（Amendments 件数 5 vs 列挙 SHA 6 件）: accept。件数を列挙と一致させ、SHA 追記時の件数更新を運用に明記。
- 第 6 round 反映の独立検証（同 Sonnet reviewer、2026-07-17、pending marker 構造の局所敵対検証 10 ケース）: Part A 全 6 項目 closed（旧反例の構造的不成立をトレース確認）。Part B が**新規 P2×2 を検出**、全件 accept・即時反映:
  - 検証第 2 P2-a（attempt ID 突合の実現可能性 — summary 自由文字列への埋め込みでは冪等チェックの照合方法を規定できず、operation_logs スキーマの相関データ規約は detail_json）: attempt ID を `detail_json.attempt_id` へ構造化格納（summary は表示用）、冪等突合を「operation_type 絞り込み + detail_json.attempt_id 一致」で契約化。索引の要否は低頻度のため実装 PR1 判断。
  - 検証第 2 P2-b（補完 INSERT の持続失敗で manifest が残り続け、fail-closed 残骸検査が新規 restore を永久ブロックする可用性ギャップ）: 補完 INSERT 失敗は起動を中止せず warn + manifest 残置（次回再試行）。restore 開始時検査に **phase=committed のみの例外**を新設 — 最終補完試行 + warn + durable 削除して restore を開始（operator の新しい復元意図を旧 attempt の監査補完より優先。active/temp/退避の fail-closed は不変）。§71.10 に持続失敗注入の回帰固定を追加。閉鎖確認（同 reviewer）= 全 4 項目 closed、committed 例外の適用順序は一意（「committed manifest + 退避遺物の共存」は reconcile の同期的退避掃除により live 状態からは構造的に到達不能とトレース確認）。
- state-only 遷移記録（2026-07-17、第 8）: `implementing -> local-verified -> independent-review -> human-confirm` を本 commit（状態帳簿 + dashboard 同期）への同乗で materialize。根拠 = content candidate `4786f7f`（第 6 round 反映 `c13b63e` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、第 6 round 反映の独立検証（Part A 全 6 closed + 検証第 2 P2×2 検出・是正・閉鎖確認 4 項目 closed + committed 例外の一意性確認。independent-review -> human-confirm）。
- Codex 第 7 round レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-17、live HEAD `089324b` 時点、論理トレース 42 系列。修正案 + 閉鎖確認用 3 系列の指定付き）: 前 round 6 判定 = **6/6 closed**、fresh **P1 = 0** / P2×2 / P3×1、verdict「merge blocker あり」。Coordinator 裁定（`9e30020` で human-confirm -> implementing へ backtrack）:
  - 第 7 P2-1（既存 attempt row 検出時の manifest 削除条件が未定義 — 字面どおりだと AlreadyPresent で marker が残り毎起動再処理、再 INSERT すれば重複）: accept・**Codex 修正案を全面採用**。補完処理の結果を `AlreadyPresent | Inserted | Failed` の 3 値で定義し、AlreadyPresent / Inserted は補完成功として manifest durable 削除、Failed（lookup / parse / INSERT の error）のみ warn + 残置。§71.10 に既存一致 row + committed marker の専用 fixture と 3 値 oracle を明記。
  - 第 7 P2-2（escape hatch が「log 恒久欠落は構造的に発生しない」の絶対保証と矛盾 — 持続 Failed + 新規 restore の最終試行失敗で監査記録と遅延成功確認が恒久消失）: accept・**Codex 修正案を部分採用**。log 保証を best-effort へ条件付き化（欠落系列は committed 例外経由のみ、fallback = 診断ログ + データ内容確認）し 71/68 の断定を除去 — これが矛盾解消の最小手段。推奨された「DB log 非依存の起動通知」は新 UI 挙動の追加（scope 拡大）であり、必要になるのが二重障害系列のみのため Plans.md backlog へ切り出し。代替案「attempt 別 audit-pending marker」は attempt 毎一意ファイル名の再導入（D5 が 2 回棄却した複雑化）+ operation_log は規制監査ログではなく exactly-once 要求が過剰、として不採用。
  - 第 7 P3（packet / PR body の「UI 文言不変」表記が 68 文言表の新設と矛盾）: accept。非目的 / Scope / Non-scope / Design Sources / Required Design Artifacts の 5 箇所を「非断定文言 + 起動後確認契約の新設は scope 内」へ同期、PR body も追随。
- 第 7 round 反映の独立検証（同 Sonnet reviewer、2026-07-17）: **Codex 指定 3 系列すべて成立**（A: AlreadyPresent 収束で記録 1 件 + 残骸ゼロ / B: 持続 Failed + 新規 restore 非ブロック、best-effort 方針の 71/68/packet 三者一貫、絶対保証の残存なしを grep 確認 / C: active・temp・退避で committed 例外不発火の fail-closed 維持）+ 閉鎖確認 4 項目全 closed、新規矛盾なし。
- state-only 遷移記録（2026-07-17、第 9）: `implementing -> local-verified -> independent-review -> human-confirm` を本 commit（状態帳簿 + dashboard 同期）への同乗で materialize。根拠 = content candidate `debc232`（第 7 round 反映 `80f06b1` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、第 7 round 反映の独立検証（Codex 指定 3 系列成立 + 4 項目 closed。independent-review -> human-confirm）。
- Codex 第 8 round レビュー（owner 発注・relay 経由、PR #14 issue comment、2026-07-18、live HEAD `ea0539a` 時点、論理トレース 36 系列。本 round から相互修正案方式 — owner 決定）: 前 round 3 判定 = closed 1（P2-1）/ **not-closed 2**（P2-2 の 68 本文残存 / P3 の PR body 未同期）+ fresh **P1 = 0** / P2×1、**当方 2 裁定（起動通知 backlog / audit-pending 不採用）はいずれも異議なし accept**、提案 #1 = **Adopt-with-changes**（索引特化 + branch ID + §71.10 参照統一）、verdict「merge blocker あり」。Coordinator 裁定（`9884d96` で human-confirm -> implementing へ backtrack）:
  - 第 8 P2-2 not-closed（68 §68.7 本文 126 行に「operation_log に記録する」の絶対保証が残存 — 前 round は文言表 180 行のみ修正した grep 漏れ）: accept・Codex fix 採用。「確認手段は §68.11 の best-effort 契約に従う」へ置換。
  - 第 8 P3 not-closed（PR body の Non-scope / Source docs が 68 実変更と不一致 — packet のみ同期して PR body の該当表現が別文言で置換空振り）: accept。PR body を packet と同語で同期。
  - 第 8 fresh P2（旧形式 row = `detail_json NULL`（backup.rs:316-321 の実証つき）と複数 row の 3 値集約規則が未定義 — NULL 行の扱いが実装依存になる）: accept・**Codex 修正案を全面採用**。行分類（NULL / attempt_id 欠落 / 別 ID = NoMatch、malformed / 不正型 = parse failure）+ 集約順序（exact match → AlreadyPresent が最優先 / match なし + error → Failed / 全 NoMatch + error なし → INSERT）を契約化し、§71.10 に 5 fixture を追加。
  - 提案 #1（reconcile 分岐要約表）: Adopt-with-changes の条件どおり「観測条件 / branch ID（T0, R1〜R7）/ normative 散文参照 / safety 分類」の索引表として追加、T0（temp 前処理）の全分岐先行を表で固定、§71.10 の該当行に branch ID 参照を導入。
- 第 8 round 反映の独立検証（同 Sonnet reviewer、2026-07-18）: 3 項目全 closed、**分岐要約表 8 行の散文全行突合で drift 検出ゼロ**、絶対保証の残存なし（grep 確認）、敵対確認（exact match が malformed 併存に勝つ規則の安全性 — malformed は原理的に exact match になり得ず、1 attempt = 最大 1 行の idempotency で二重生成経路が契約上存在しない）も反例なし。
- state-only 遷移記録（2026-07-18、第 10）: `implementing -> local-verified -> independent-review -> human-confirm` を本 commit（状態帳簿 + dashboard 同期）への同乗で materialize。根拠 = content candidate `fa02439`（第 8 round 反映 `f3e2934` + packet amendment）に対する L1 `local-ci.sh full` PASS / start-end CLEAN / MERGE_EVIDENCE_VALID=true（implementing -> local-verified、evidence は PR body）、第 8 round 反映の独立検証（3 項目 closed + 表突合 drift ゼロ。independent-review -> human-confirm）。
- Findings Freeze: frozen after Broad Audit（Plan Gate 3 round + 独立 Final Review 完了、2026-07-17）; post-freeze exceptions: **Codex 独立レビューの P1×3 は freeze の保護対象外（candidate safety）として same-PR 修正。P2-2/P2-3/P2-4 は runtime 失敗証明ではないが、公式 API doc・SQLite 文書化挙動という決定的証拠があり、本 PR の成果物（設計正本の契約文）自体の欠陥のため same-PR 修正を選択。P2-1 の single-instance 部分は当初 follow-up（backlog）としたが、再レビュー P1-3 で MNT-01-D5 の前提条件（実装 PR1 scope）へ昇格済み**。
