# Plan Packet: backup / migration failure contract 正本確定（監査是正 順1+2 design phase）

## Workflow State

- Phase: plan-draft
- Risk: R2
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable 5（本 session）
- Writer: Fable 5（design docs 改訂）
- Plan Reviewer: Sonnet subagent（独立 context）
- Final Reviewer: Sonnet subagent（Plan Reviewer とは別 context）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: not-required
- Human Gate: Draft PR の owner 確認 + merge

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 15分
- relay 往復上復: 1

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R2

Reason:
docs-only の design phase（source design docs + decision-log + Plans.md 同期のみ、runtime 契約の変更なし）。UI-11b backup/restore Design Phase（PR #142、R2 docs-only）と同型。ただし本改訂が確定する failure contract は後続の R4 実装 2 PR（destructive data lifecycle）の正本になるため、Plan Review / Final Review には data-safety 観点（誤削除・誤復元・部分状態の経路が契約で塞がれているか）を明示的に要求する。

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
- `docs/function-design/68-ui-backup-restore.md` の UI 文言・画面契約の変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `docs/function-design/22-mnt-migration.md`:
  - §3.2 エラーハンドリングに ROLLBACK 失敗契約を追加（MNT-03-D1）: ROLLBACK の失敗は `.ok()` で破棄せず `tracing::error!` で記録し、元エラーと併合した `DbError::MigrationFailed`（transaction 状態不明の旨を含む）を返す。migration.rs / schema_v2.rs / schema_v3.rs の全 ROLLBACK 箇所に適用する共通ヘルパー方針を明記。
  - 新節「legacy path 移行（migrate_legacy_db）」を追加: 現在コードコメントにしか存在しない移行契約の正本化。
    - MNT-03-D2: 移行方式を 3 ファイル個別コピーから「旧 DB を read-only で開き `VACUUM INTO` で一時ファイル名へ生成 → 成功後に最終名へ rename」へ変更。WAL 取込みが SQLite 保証になり、部分状態が構造的に発生しない（rejected alternative: 3 ファイルコピー + WAL 失敗致命 + 部分削除 — WAL/SHM の意味論を自前で守り続ける必要が残る）。
    - MNT-03-D3: 新パス main は「完成品しか存在しない」を不変条件とする（一時名生成 + rename、失敗時は一時ファイルを削除して Err）。
    - MNT-03-D4: lib.rs は legacy 移行 Err で起動を中止する（fail-closed）。現行の「error log + 続行」は直後の `init_database` が空 DB を新規作成して以後の移行を永久 skip し、旧データを隠蔽するため禁止と明記。
  - テスト方針: 未 checkpoint commit を含む実 SQLite WAL fixture での移行 + 新パス再 open での row 検証、失敗注入（VACUUM INTO 失敗 / rename 失敗）で部分状態ゼロ + 再試行可能、を実装 PR の完了条件として明記（P8b-3）。
- `docs/function-design/71-mnt-backup.md`:
  - §71.7 restore 契約改訂（MNT-01-D1): ステップ 2 checkpoint 失敗の非致命根拠を「退避が成功する場合に限る」と限定。ステップ 4 の退避は main / 存在する WAL / 存在する SHM のすべてで成功必須とし、いずれかの rename 失敗時は退避済みファイルを巻き戻して本体置換前に restore を中止（Err）。CMD 層の失敗時再接続契約は現行のまま維持。
  - §71.9 `resolve_backup_dir` の Result 化（MNT-01-D2): DB error は Err で返し、未設定・空文字のみ既定（`app_data/backups`）へ fallback する。現行コード例の `.ok().flatten()` は設計自体の欠陥（P3-1 補強のとおり）として書き換え。呼出し元契約: lib.rs 起動時 = warn + auto-backup skip で起動継続、settings_cmd = internal error として返す。
  - §71.8 / cleanup の保持日数確定条件（MNT-01-D3): destructive fallback 禁止。retention_days は (a) 設定読取成功かつ数値、または (b) 設定行が存在しない（未設定 = 初期既定 3 日）の場合のみ確定。DB error・parse 失敗時は cleanup を skip して warn を記録し、削除は実行しない。
  - §71.10 テスト方針: 失敗注入行を追加（WAL 退避 rename 失敗 → 元 DB 再接続可能かつ置換なし、retention 読取失敗 → 削除 0 件、等）。
- `docs/decision-log.md`: D-048 起票 — failure contract の柱（①失敗を成功・既定値へ変換しない ②main/WAL/SHM 一式の原子性と「完成品しか存在しない」不変条件 ③destructive 操作は入力を確定できた場合のみ実行）+ 実装は R4 2 PR 分割（順1 = migration/restore 原子性、順2 = 設定読取・rollback 失敗処理）。
- `docs/Plans.md`: 監査行を完了 [x] に更新し、本 design phase を進行中作業として追加。

## Non-scope

- 実装コード（src-tauri/）の変更一切。
- P3-2（順7）・P3-4（順8）・P7-1（順3）の設計と実装。ただし 71/22 に書く failure contract の一般原則（記録規律は `.claude/rules/implementation-quality.md` 準拠）を順7 が後で参照することは妨げない。
- 68-ui-backup-restore.md / 75-ui-integrity-check.md の変更。
- 監査 findings 自体の再検証（12/12 CONFIRMED 済み）。

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が ERROR 0（既存 WARN の増加なし）。
- 22-mnt-migration.md に MNT-03-D1〜D4、71-mnt-backup.md に MNT-01-D1〜D3 の decision ID が存在し、各 ID に why / rejected alternatives が付く。
- 5 findings それぞれについて、改訂後の設計書のどの節が害経路を塞ぐかを PR body の対応表で示せる。
- 独立 Final Review（設計内容 vs findings 突合）で P1/P2 = 0。

## Design Sources

- Requirements / spec: REQ-903（DB 基盤 / マイグレーション）、MNT-01 / MNT-03 の既存契約
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO/MNT）
- Function / command / DTO: `docs/function-design/71-mnt-backup.md`、`docs/function-design/22-mnt-migration.md`、`docs/function-design/43-cmd-settings-log.md`（restore CMD 呼出しパターン）
- DB: `docs/DB_DESIGN.md`（WAL mode 運用）
- Screen / UI: 変更なし（68-ui は non-scope）
- Decision log / ADR: D-032（restore 前強制バックアップ等）、新規 D-048
- 監査証拠: `docs/research/audit-2026-07/findings/p3-error-handling.md`、`findings/p8-test-quality.md`、`adjudication.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 71-mnt-backup.md / 22-mnt-migration.md | updated in this PR |
| Command / DTO / generated binding / wire shape | 変更なし（restore CMD の wire shape は不変） | existing sufficient |
| DB / transaction / audit / rollback / migration | 22-mnt-migration.md（ROLLBACK 契約 / legacy 移行） | updated in this PR |
| Screen / UI / route state / Japanese wording | 変更なし | existing sufficient |
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

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 改訂後の 71/22 が failure contract・why・rejected alternatives を自足的に持つことを Final Review で確認する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-048 として起票（本 packet には契約を残さない）。
- Assumptions and constraints: SQLite の確立済み挙動（`VACUUM INTO` は WAL 取込み済み単一ファイルを生成 / `-shm` は再 open 時に再構築される / 旧 WAL は同名 main に対して再生され得る）を前提とする。監査で 3 系統の独立検証済み。実装 PR の実 WAL fixture テストがこの前提の empirical validation を兼ねる。
- Deferred design gaps, risk, and follow-up target: 順7 の記録規律実装・順8 の error 表示統一は本改訂の一般原則を引き継いで別変更で設計する。
- Test Design Matrix can cite design decision IDs or source doc sections: 実装 PR の Matrix が MNT-03-D1〜D4 / MNT-01-D1〜D3 を引用できる粒度で ID を切った。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable — 外部 adapter なし、MNT 層内部契約のみ | — |
| Fact check / design decision split | SQLite 挙動（VACUUM INTO / SHM 再構築 / WAL 再生）= 観測事実、fail-closed 起動・destructive fallback 禁止 = 設計判断として分離して記述 | 22 / 71 / D-048 |
| Lifecycle / retry | 移行・restore・cleanup の before / during / after / after-failure を契約表で固定。失敗後の再試行可能性（部分状態ゼロ）が中核 | 22 新節 / 71 §71.7 |
| Operator workflow | 起動中止（MNT-03-D4）は operator 可視。エラーメッセージは既存の起動失敗経路に従い、本 design では文言を新設しない | 22 新節 |
| Replacement path | not applicable — 外部システム置換なし | — |
| Data safety / evidence | 実 DB / backup を commit しない。テスト方針は tempdir + 合成 fixture のみ | Test 方針節 |
| Reporting / accounting semantics | not applicable — 集計意味論に非接触 | — |
| Manual verification | 自動テストで検証可能（L3 不要）。実装 PR で failure injection をすべて自動化する方針を明記 | 71 §71.10 / 22 テスト方針 |

## Design Readiness

- Existing design docs are sufficient because: 不十分（本 PR がその是正）。71 §71.9 はコード例が握りつぶしを指定し、§71.7 は WAL 退避失敗の契約を欠き、22 は ROLLBACK 失敗時挙動と legacy 移行契約を持たない。
- Source docs updated in this PR: 71-mnt-backup.md / 22-mnt-migration.md / decision-log.md。
- Design gaps intentionally deferred: 順7・順8・順3（Non-scope 参照）。
- Durable decisions discovered in this plan and promoted to source docs: D-048。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): MNT/DB 層内部の契約変更のみ。層境界は不変。
- Backend function design: `resolve_backup_dir` のシグネチャ変更（Result 化）と `migrate_legacy_db` の方式変更を関数契約として明記。
- Command / DTO / data contract: wire shape 変更なし（restore CMD の error 表示は既存契約のまま）。
- Persistence / transaction / audit impact: ROLLBACK 失敗記録・移行原子性・cleanup 確定条件が本改訂の中核。
- Operator workflow / Japanese UI wording: 起動中止経路のみ operator 可視、新規文言なし。
- Error, empty, retry, and recovery behavior: 全 findings が error path の契約化。再試行可能性（部分状態ゼロ）を不変条件として明記。
- Testability and traceability IDs: MNT-03-D1〜D4 / MNT-01-D1〜D3 を実装 PR のテストが引用する。

## Contract Probe

- SQLite `VACUUM INTO` の WAL 取込み: 既存 `create_backup` が同一前提で本番稼働済み（71 §71.4、restore テストで検証済み）→ 追加 probe 不要。
- 未 checkpoint WAL を含む DB の file copy / 再 open 挙動: 実装 PR1 の実 WAL fixture テスト（P8b-3 完了条件）が empirical validation を兼ねる。設計段階の追加 probe は行わない（監査 3 系統検証済みの静的事実のみに依拠）。

## Contract Coverage Ledger

R2 のため必須ではないが、後続 R4 実装 PR の Ledger 原型として記録する。

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| MNT-03-D1 ROLLBACK 失敗の記録 + 併合 | 実装 PR2 | rollback 失敗注入 | non-scope（自動化） |
| MNT-03-D2/D3 legacy 移行の VACUUM INTO + 完成品不変条件 | 実装 PR1 | 実 WAL fixture + 失敗注入 | non-scope（自動化） |
| MNT-03-D4 移行失敗時の起動中止 | 実装 PR1 | lib.rs 経路（可能な範囲で自動化、残りは実装 packet で判断） | 実装 packet で判断 |
| MNT-01-D1 退避失敗での restore 中止 | 実装 PR1 | 退避 rename 失敗注入 | non-scope（自動化） |
| MNT-01-D2 resolve_backup_dir Result 化 | 実装 PR2 | DB error 時の Err 伝搬 | non-scope（自動化） |
| MNT-01-D3 cleanup 確定条件 | 実装 PR2 | 読取失敗時 削除 0 件 | non-scope（自動化） |

## Test Plan

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan` / `bash scripts/doc-consistency-check.sh`（docs-only のため設計書整合が主ゲート）。
- negative tests: 実装 PR 側（本 packet では設計書のテスト方針節として固定）。
- compatibility checks: design_compliance_test が要求する 71/22 の必須セクション（シグネチャ / 処理ステップ / エラーハンドリング）を維持。
- data safety checks: 実データ・実 backup をテスト方針に含めない（tempdir + 合成 fixture のみ）。
- main wiring/integration checks: 該当なし（docs-only）。

## Boundary / Wire Contract

該当なし — JSON / CSV / DTO / generated bindings / cache schema に非接触。`resolve_backup_dir` の Result 化は Rust 内部シグネチャで、Tauri command の wire shape（`get_effective_backup_dir` の返り値等）は不変。

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

Fill after review.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
