# UI-11b backup / restore implementation

> **Status**: 完了（PR #144 squash merge `9d1b07e`、2026-07-06。Windows native L3-1〜4 owner 合格 + L3-5 自動テスト代替承認、Fable レビュー P1/P2=0、裁定 P2/P3 は同 PR 修正済み。2026-07-06 closeout で archive）

## Risk

Risk: R3

Reason:
UI-11b is an operator-facing screen for a destructive DB-wide restore workflow. The backend contract is already fixed, but this PR wires route state, generated Tauri commands, React Query cache clearing, native directory selection, and recovery wording that controls whether a non-IT operator can recover safely.

## Goal

Implement `/settings/backup` exactly as `docs/function-design/68-ui-backup-restore.md` specifies: backup settings, manual backup, backup list, pre-restore backup, break-glass exception, two-step restore confirmation, recovered/unrecoverable failure handling, and the 60-second `checkAutoBackup` interval.

## Scope

- Add the UI-11b route and activate `ui-11b` in `src/config/navigation.ts`.
- Implement `BackupRestorePage` and supporting UI for settings, manual backup, backup list, restore detail, final confirmation, and fatal recovery state.
- Use generated `commands.*` only: `getSettings`, `updateSetting`, `createBackup`, `checkAutoBackup`, `listBackups`, and `restoreBackup`.
- Use `@tauri-apps/plugin-dialog` directory picker for `backup_path`; no free path input.
- Add Vitest + RTL coverage for the main state-machine branches named in 68.7.
- Update `Plans.md` and this packet with implementation results.

## Non-scope

- Backend behavior, restore contract, migration, retention cleanup, and command signatures.
- UI-11a threshold settings and UI-11c operation logs.
- Creating a real corrupted DB for manual testing.
- Committing real DB files, backups, logs, JANs, product names, prices, or store-specific data.

## Acceptance Criteria

- `/settings/backup` renders via TanStack Router and sidebar navigation `ui-11b` is active.
- `BackupRestorePage` displays backup settings, current backup path, manual backup action, and backup list using `BackupInfo.created_at` as Japanese datetime and `size_bytes` as MB.
- `backup_path` update calls `open({ directory: true })`; cancel does not call `updateSetting`.
- `checkAutoBackup` runs every 60 seconds and refetches the backup list when it returns `true`.
- Restore flow follows 68.4 / 68.7: select row -> details -> forced `createBackup` -> break-glass only on pre-backup failure -> final AlertDialog -> `restoreBackup`.
- Restore success calls `queryClient.clear()`, navigates to `/`, and shows success feedback.
- Recovered restore failure shows `バックアップの復元に失敗しました。現在のデータには戻しています。もう一度お試しください。`, keeps operations enabled, and refetches settings/list.
- Unrecoverable restore failure shows restart guidance containing `アプリを閉じて、もう一度開いてください` and disables all page operations.
- RTL tests include `QR-05` / `REQ-905` in names or comments for pre-backup break-glass, recovered restore failure, and unrecoverable restore failure.
- Required gates pass: cargo fmt/clippy/test, `architecture_test`, `design_compliance_test`, npm typecheck/lint/test/build, traceability check, docs check, and `git diff --check`.
- Draft PR body following `.github/pull_request_template.md` includes Risk R3 and the 68.12 Windows native L3 checklist; merge remains blocked until owner L3 is complete.

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` (`REQ-905`), `docs/function-design/68-ui-backup-restore.md` (`QR-05`)
- Architecture: `docs/ARCHITECTURE.md`
- Function / command / DTO: `docs/function-design/43-cmd-settings-log.md`, `docs/function-design/71-mnt-backup.md`, `src/lib/bindings.ts`
- DB: `docs/DB_DESIGN.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/function-design/68-ui-backup-restore.md`, `docs/design-system/README.md`
- Decision log / ADR: `docs/decision-log.md` D-032, `docs/AGENT_OPERATING_MANUAL.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `43-cmd-settings-log.md`, `71-mnt-backup.md` | existing sufficient; read-only fact check |
| Command / DTO / generated binding / wire shape | `src/lib/bindings.ts`, `43-cmd-settings-log.md` | existing sufficient after PR #141 |
| DB / transaction / audit / rollback / migration | `71-mnt-backup.md`, D-032 | existing sufficient; no runtime DB change |
| Screen / UI / route state / Japanese wording | `68-ui-backup-restore.md`, `SCREEN_DESIGN.md` | existing sufficient |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | D-032 | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| QR-05 / REQ-905 | `68-ui-backup-restore.md` 68.4, 68.7, 68.11 | UI-11b-D2, D-032 | Restore has no true undo; pre-backup is mandatory except break-glass DB-corruption recovery. | restore flow state in `BackupRestorePage` | RTL pre-backup break-glass test |
| QR-05 / REQ-905 | `68-ui-backup-restore.md` 68.7, 68.10, 68.11 | UI-11b-D4, UI-11b-D5 | DB-wide restore needs cache clear on success and restart guidance only on double failure. | restore success/failure handlers | RTL recovered/unrecoverable tests |
| QR-05 | `68-ui-backup-restore.md` 68.2, 68.6, 68.8 | UI-11b-D6..D9 | Backup settings belong in UI-11b; path selection is native-only; auto-check is frontend interval. | settings panel, path picker, interval hook | RTL path cancel/update and interval behavior |
| QR-05 | `68-ui-backup-restore.md` 68.12 | UI-11b-D10 | File existence and DB switch require Windows native evidence. | PR body / manual gate | owner L3 checklist |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes; 68 and D-032 are the durable sources.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: none; this packet follows existing decisions.
- Assumptions and constraints: PR #141 bindings are present; no backend changes are allowed; Windows native L3 remains owner-run before merge.
- Deferred design gaps, risk, and follow-up target: UI-11c operation log screen and UI-11a threshold settings remain separate tracks.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, see [test-matrices/2026-07-06-ui11b-backup-restore-implementation.md](test-matrices/2026-07-06-ui11b-backup-restore-implementation.md).

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Not POS/register adapter work. | none |
| Fact check / design decision split | Backend facts come from 43/71 and generated bindings; UI choices are already in 68/D-032. | none |
| Lifecycle / retry | Restore lifecycle, break-glass, recovered failure, and double failure are the core risk. | Test Matrix B1-B5 |
| Operator workflow | Non-IT operator wording and no color-only state are required. | RTL + L3 |
| Replacement path | Restore backend contract remains unchanged. | none |
| Data safety / evidence | Restore is destructive; no real DB/backups in repo. | Data Safety section |
| Reporting / accounting semantics | Not applicable. | none |
| Manual verification | File creation, data switch, pre-restore backup, and path output need Windows native L3. | PR body checklist |

## Design Readiness

- Existing design docs are sufficient because: 68 fixes route, components, state machine, wording, query handling, error recovery, and L3; 43/71 fix command/backend facts.
- Source docs updated in this PR: none expected unless implementation reveals a source-doc contradiction.
- Design gaps intentionally deferred: UI-11a, UI-11c, backend scheduler semantics, retention behavior, real DB corruption manual gate.
- Durable decisions discovered in this plan and promoted to source docs: none.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI calls generated `commands.*`; no backend or CMD changes.
- Backend function design: unchanged and cited from 43/71.
- Command / DTO / data contract: generated bindings from PR #141.
- Persistence / transaction / audit impact: no new persistence; restore success clears client cache because DB changes wholesale.
- Operator workflow / Japanese UI wording: 68.9 is the wording source.
- Error, empty, retry, and recovery behavior: 68.7 / 68.11.
- Testability and traceability IDs: `QR-05` / `REQ-905` in RTL tests; traceability check required.

## Test Plan

Test Design Matrix: [test-matrices/2026-07-06-ui11b-backup-restore-implementation.md](test-matrices/2026-07-06-ui11b-backup-restore-implementation.md)

- targeted tests: RTL tests for pre-backup break-glass, recovered failure, unrecoverable failure, path picker, auto-check interval, route/navigation smoke through typecheck.
- negative tests: pre-backup failure blocks normal restore until checkbox; unrecoverable failure disables controls.
- compatibility checks: generated command names and DTO fields remain unchanged.
- data safety checks: synthetic command mocks only; no DB/backups committed.
- main wiring/integration checks: route file, navigation item, routeTree generation, query keys.

## Boundary / Wire Contract

- producer: existing `commands.*` generated from CMD-11.
- consumer: `BackupRestorePage`.
- wire type: generated TypeScript `AppSetting`, `BackupInfo`, `BackupResult`, `RestoreBackupRequest`.
- internal type: React component state and TanStack Query cache.
- precision/range: `size_bytes` is a JavaScript number displayed in MB; `created_at` is `YYYY-MM-DD HH:MM:SS` from backend.
- round-trip path: UI -> generated command -> Tauri CMD -> MNT/system repo -> UI.
- invalid input: restore path comes only from selected `BackupInfo.file_path`; backup path comes only from native directory picker.
- compatibility: no command signature or backend contract change.

## Review Focus

- Restore state machine exactly matches 68.7, especially break-glass and double failure.
- Success uses `queryClient.clear()`, not broad invalidation.
- `backup_path` has no free input.
- UI wording matches 68.9 and does not imply undo.
- Operations are disabled in unrecoverable state.
- No real DB, backup, JAN, product, price, or store-specific data in diff.

## Spec Contract

Contract ID: SPEC-UI11B-REQ905-IMPLEMENTATION

- UI-11b must use generated `commands.*` for backup settings, backup creation, backup listing, auto-check, and restore.
- Restore must not proceed through the normal path unless pre-restore `createBackup` succeeds.
- The only pre-backup failure exception is the explicit break-glass checkbox.
- Restore success must clear React Query cache and navigate home.
- Restore recovered failure must preserve operability and show retry guidance.
- Restore unrecoverable failure must show restart guidance and disable page operations.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| QR-05 / REQ-905 | forced pre-backup + break-glass | `QR-05 REQ-905 shows break-glass only when pre-restore backup fails` | no normal restore after pre-backup failure | RTL output |
| QR-05 / REQ-905 | recovered restore failure | `QR-05 REQ-905 treats recovered restore failure as retryable` | wording and operations enabled | RTL output |
| QR-05 / REQ-905 | unrecoverable restore failure | `QR-05 REQ-905 shows restart guidance and disables operations on double failure` | fatal Alert and disabled controls | RTL output |
| QR-05 / REQ-905 | manual backup success | `QR-05 REQ-905 shows created backup file path after manual backup` | operator can see where the backup file was written | RTL output |
| QR-05 | native-only backup path | `QR-05 REQ-905 updates backup_path only from directory picker` | no free path input | RTL output |
| QR-05 | auto backup interval | `QR-05 REQ-905 checks auto backup every 60 seconds` | interval calls command and refetches list | RTL output |
| QR-05 | route/navigation | `npm run typecheck` / route generation | `/settings/backup` reachable and sidebar active | generated route diff |
| QR-05 | Windows native behavior | L3 checklist in PR body | file existence and DB switch | owner evidence |

## Data Safety

- Synthetic command mocks only in tests.
- Do not commit real store DB files, backup files, operation logs, JANs, product names, prices, screenshots with store data, `.env*`, credentials, or certificates.
- Windows native L3 outputs must stay outside the repo or use disposable synthetic DB data.

## Implementation Results

- Added `/settings/backup` route and activated `ui-11b` navigation.
- Added `BackupRestorePage` with backup settings, current backup path display, native directory picker, manual backup, backup list, restore detail, break-glass flow, final AlertDialog, recovered failure, unrecoverable failure, and 60-second `checkAutoBackup` interval.
- Added centralized backup query keys in `src/lib/query-keys.ts`.
- Added `QR-05` / `REQ-905` RTL tests for break-glass, recovered restore failure, double failure, manual backup path visibility, restore success cache clear/navigation, native-only backup path update, and auto-check interval.
- Regenerated `src/routeTree.gen.ts` and `docs/function-design/90-traceability.md`.
- Registered `68-ui-backup-restore.md` as a UI-only design doc in `design_compliance_test` skip docs, matching existing UI-only design docs.
- Synced `docs/Plans.md` and `docs/PROJECT_HANDOFF.md` to the active UI-11b implementation PR.

Verification:

- RED: `npm test -- --run src/features/backup-restore/BackupRestorePage.test.tsx` failed on missing `BackupRestorePage`.
- `npm test -- --run src/features/backup-restore/BackupRestorePage.test.tsx` PASS（6 tests）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm test` PASS（90 files / 542 tests）
- `npm run build` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（649 lib tests + integration/doc tests）
- `cd src-tauri && cargo test --test architecture_test` PASS
- `cd src-tauri && cargo test --test design_compliance_test` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `bash scripts/doc-consistency-check.sh` PASS
- `git diff --check` PASS
- Review-only sub-agent Maxwell: P2 accepted/fixed. Double failure terminal state previously left the 60-second `checkAutoBackup` interval running; fatal state now cleans up/skips the interval and RTL covers no post-fatal auto-check call.
- Post-review: `npm test -- --run src/features/backup-restore/BackupRestorePage.test.tsx` PASS（7 tests）
- Post-review: `npm run typecheck` PASS
- Post-review: `npm run lint` PASS
- Post-review: `npm run format:check` PASS
- Post-review: `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- Post-review: `bash scripts/doc-consistency-check.sh` PASS
- Post-review: `git diff --check` PASS
- Post-review full: `npm test` PASS（90 files / 543 tests）
- Post-review full: `npm run build` PASS
- Fable裁定対応後: `npm test -- --run src/features/backup-restore/BackupRestorePage.test.tsx` PASS（8 tests）
- Fable裁定対応後: `npm run typecheck` PASS
- Fable裁定対応後: `npm run lint` PASS
- Fable裁定対応後: `npm run format:check` PASS
- Fable裁定対応後: `npm test` PASS（90 files / 544 tests）
- Fable裁定対応後: `npm run build` PASS
- Fable裁定対応後: `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- Fable裁定対応後: `bash scripts/doc-consistency-check.sh` PASS
- Fable裁定対応後: `git diff --check` PASS

## Review Response

- Review-only sub-agent Maxwell reported one P2: after unrecoverable restore, the 60-second auto-backup interval kept running even though 68.7 defines the state as terminal and restart guidance takes priority.
- Accepted. Fixed by making the interval effect depend on `fatalRestoreMessage` and return without scheduling while fatal; cleanup runs when fatal state is entered.
- Added `QR-05 REQ-905 stops auto backup checks after double failure` RTL coverage.
- Fable裁定 P2: L3で実効保存先が分からない UX gap を確認。same PR の frontend-only 最小修正として、手動 `createBackup` 成功 Alert に `BackupResult.file_path` を補助表示し、RTL coverage を追加した。実効保存先そのものを常時表示する backend contract 追加は follow-up backlog。
- Fable裁定 P3: 68.12 L3-5 を、実機誘発ではなく自動テストで状態分岐・文言・操作 disabled・60秒 interval 停止を担保する記述へ同期した。
