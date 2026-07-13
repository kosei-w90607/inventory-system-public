# Settings / backup bindings wiring

> **Status**: 完了（PR #141 squash merge `5518477`、2026-07-06。Fable レビュー指摘ゼロ approve。2026-07-06 closeout で archive）

## Risk

Risk: R2

Reason:
CMD-11 の既存コマンドと DTO を `tauri-specta` の生成対象へ追加する小さい実装変更。Tauri runtime の `generate_handler!`、CMD 実装、restore 挙動、DB/MNT 契約は変更しないが、generated binding の wire surface が増えるため R2 とする。

## Goal

UI-11b バックアップ・復元画面の前提として、設定・ログ・バックアップ系 7 コマンドを `src/lib/bindings.ts` に出す。

## Scope

- `settings_cmd` の既存 7 コマンドに `#[specta::specta]` を付ける。
- 7 コマンドが参照する request / response DTO に `specta::Type` を derive する。
- `lib.rs` の `collect_commands!` に 7 コマンドを追加する。
- `cargo run --bin generate_bindings` で `src/lib/bindings.ts` を再生成する。
- CMD-11 source doc と `Plans.md` を最小同期する。

## Non-scope

- コマンド実装・シグネチャ・restore 契約の変更。
- UI-11b の画面実装。
- UI-11b Design Phase の D-032 / 68-ui-backup-restore 作成。

## Acceptance Criteria

- `src/lib/bindings.ts` に `getSettings` / `updateSetting` / `listLogs` / `createBackup` / `checkAutoBackup` / `listBackups` / `restoreBackup` が生成される。
- `saveReceiptImage` の既存 binding は維持される。
- Rust gates と docs check が green。

## Design Sources

- Requirements / spec: [docs/spec/requirements.md](../../spec/requirements.md)
- Architecture: [docs/ARCHITECTURE.md](../../ARCHITECTURE.md)
- Function / command / DTO: [docs/function-design/43-cmd-settings-log.md](../../function-design/43-cmd-settings-log.md), [docs/function-design/71-mnt-backup.md](../../function-design/71-mnt-backup.md)
- DB: [docs/DB_DESIGN.md](../../DB_DESIGN.md)
- Screen / UI: UI 実装は non-scope
- Decision log / ADR: [docs/research/2026-04-20-invoke-type-adr.md](../../research/2026-04-20-invoke-type-adr.md)

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 43-cmd-settings-log.md / 71-mnt-backup.md | existing sufficient |
| Command / DTO / generated binding / wire shape | 43-cmd-settings-log.md / ADR-002 | existing sufficient; 43 doc gets specta exposure note |
| DB / transaction / audit / rollback / migration | 71-mnt-backup.md | existing sufficient; no behavior change |
| Screen / UI / route state / Japanese wording | none | intentionally deferred to PR-B / UI implementation |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | ADR-002 | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-905 | 43-cmd-settings-log.md §43.2-43.11 | ADR-002 | Rust DTO を SSOT として generated binding に出す。ad hoc invoke / 手書き TS 型は採用しない。 | `settings_cmd.rs`, `system_repo.rs`, `backup.rs`, `lib.rs`, `src/lib/bindings.ts` | `cargo run --bin generate_bindings`, clippy, cargo test |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, 43-cmd and ADR-002 cover command/DTO and specta strategy.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none.
- Assumptions and constraints: runtime `generate_handler!` already exposes the 7 commands; this PR only aligns generated bindings with runtime exposure.
- Deferred design gaps, risk, and follow-up target: UI-11b Design Phase remains the next PR.
- Test Design Matrix can cite design decision IDs or source doc sections: not required for R2; gate evidence uses generated bindings and Rust checks.

## Impact Review Lenses

Not applicable: this is local generated binding exposure for existing CMD/MNT contracts, not field investigation, POS boundary, CSV/report semantics, or operator workflow design. Restore safety UI wording is deferred to UI-11b Design Phase.

## Design Readiness

- Existing design docs are sufficient because: 43-cmd lists the 8 CMD-11 residual commands, DTOs, and restore ownership/reconnect contract; ADR-002 defines specta generated bindings as the chosen invoke typing strategy.
- Source docs updated in this PR: 43-cmd specta exposure note only.
- Design gaps intentionally deferred: UI-11b route/state/error wording and D-032 restore UI safety decision.
- Durable decisions discovered in this plan and promoted to source docs: none.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): unchanged; UI will call CMD through generated bindings.
- Backend function design: unchanged.
- Command / DTO / data contract: generated bindings are additive and mirror existing Rust signatures.
- Persistence / transaction / audit impact: unchanged.
- Operator workflow / Japanese UI wording: non-scope.
- Error, empty, retry, and recovery behavior: unchanged; restore contract remains 43-cmd §43.9 / 71-mnt-backup.
- Testability and traceability IDs: REQ-905 existing tests remain the behavioral coverage; generated drift check covers wire exposure.

## Test Plan

- targeted tests: `cd src-tauri && cargo test`
- negative tests: existing CMD/MNT negative tests remain unchanged.
- compatibility checks: `cd src-tauri && cargo run --bin generate_bindings`, inspect `src/lib/bindings.ts` diff.
- data safety checks: no real backup/log/DB files committed.
- main wiring/integration checks: `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test --test architecture_test`, `cargo test --test design_compliance_test`, `bash scripts/doc-consistency-check.sh`.

## Boundary / Wire Contract

- producer: Rust CMD functions in `src-tauri/src/cmd/settings_cmd.rs`.
- consumer: frontend `commands.*` generated in `src/lib/bindings.ts`.
- wire type: tauri-specta generated TypeScript wrappers with `typedError<T, CmdError>`.
- internal type: `UpdateSettingRequest`, `LogQuery`, `RestoreBackupRequest`, `AppSetting`, `OperationLog`, `BackupResult`, `BackupInfo`, `PaginatedResult<T>`.
- precision/range: unchanged; `LogQuery.per_page` remains `u32` and IO clamps to D-031 `PAGINATION_MAX_PER_PAGE`.
- round-trip path: `collect_commands!` -> `cargo run --bin generate_bindings` -> committed `src/lib/bindings.ts`.
- invalid input: unchanged; CMD/MNT validation and `CmdError` conversion remain as implemented.
- compatibility: additive generated wrappers; existing `saveReceiptImage` remains available.

## Review Focus

- Verify only the 7 intended CMD-11 commands were added to `collect_commands!`.
- Verify DTO derives are minimal and no command signature or restore implementation changed.
- Verify generated bindings contain the expected wrappers and types.

## Implementation Results

- `settings_cmd` の 7 コマンドを `#[specta::specta]` 化し、request DTO 3 件に `specta::Type` を追加。
- `AppSetting` / `OperationLog` / `BackupResult` / `BackupInfo` に `specta::Type` を追加。
- `lib.rs::export_specta_bindings()` の `collect_commands!` に 7 コマンドを追加。
- `cargo run --bin generate_bindings` で `src/lib/bindings.ts` を再生成し、`getSettings` / `updateSetting` / `listLogs` / `createBackup` / `checkAutoBackup` / `listBackups` / `restoreBackup` と関連型の生成を確認。
- Verification:
  - `cd src-tauri && cargo fmt --check`
  - `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
  - `cd src-tauri && cargo test`
  - `cd src-tauri && cargo test --test architecture_test`
  - `cd src-tauri && cargo test --test design_compliance_test`
  - `cd src-tauri && cargo run --bin generate_bindings`
  - `bash scripts/doc-consistency-check.sh`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `git diff --check`

## Review Response

R2 narrow binding exposure; review-only subagent not required by workflow.
