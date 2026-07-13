# Test Design Matrix: UI-11b backup / restore implementation

## Risk

Risk: R3

## Contracts Under Test

- QR-05 / REQ-905: backup/restore operator UI uses generated CMD-11 bindings only.
- UI-11b-D2 / D-032: restore requires forced pre-restore backup; break-glass exists only when that backup fails.
- UI-11b-D3: final restore confirmation is an AlertDialog with target datetime in the button label.
- UI-11b-D4: restore success clears React Query cache and navigates home.
- UI-11b-D5: double failure requires restart guidance and disabled page operations.
- UI-11b-D7 / D10: manual backup success must let the operator identify the created backup file path for L3 evidence.
- UI-11b-D8: backup path is selected by native directory picker only.
- UI-11b-D9: frontend calls `checkAutoBackup` every 60 seconds.
- UI-11b-D10: Windows native L3 verifies file creation and DB switching outside automation.

## Failure Modes

- UI allows restore after pre-backup failure without explicit break-glass.
- UI treats break-glass as a normal setting or permanent skip option.
- UI calls `restoreBackup` before final confirmation.
- Restore success invalidates selected queries instead of clearing the entire cache.
- Recovered restore failure disables the screen or tells the operator to restart unnecessarily.
- Double failure leaves destructive operations available or omits restart guidance.
- Manual backup success hides the created file path, so the operator cannot find the backup evidence.
- `backup_path` can be typed manually or updateSetting is called after picker cancel.
- `checkAutoBackup` is not scheduled, is scheduled too frequently, or does not refetch the list after creating a backup.
- Generated command names drift from PR #141 bindings.
- Real DB/backup/store data is committed.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-11b-D2 / D-032 | pre-backup failure bypasses safety | RTL | `QR-05 REQ-905 shows break-glass only when pre-restore backup fails` | final restore can proceed without successful pre-backup or explicit checkbox |
| UI-11b-D3 | final confirmation omitted | RTL | `QR-05 REQ-905 includes the restore datetime in the final action label` | restore runs directly from list/detail or button lacks datetime |
| UI-11b-D4 | cache not cleared after restore | RTL | `QR-05 REQ-905 clears query cache and navigates home after restore success` | success invalidates only selected keys or stays on backup page |
| UI-11b-D5 | recovered failure treated as fatal | RTL | `QR-05 REQ-905 treats recovered restore failure as retryable` | retry wording is missing, controls stay disabled, or restart guidance is shown |
| UI-11b-D5 | double failure not terminal | RTL | `QR-05 REQ-905 shows restart guidance and disables operations on double failure` | fatal message is missing or page controls remain enabled |
| UI-11b-D7 / D10 | created file path hidden | RTL | `QR-05 REQ-905 shows created backup file path after manual backup` | manual backup success only shows a generic/default location label |
| UI-11b-D8 | path typed or cancel saves | RTL | `QR-05 REQ-905 updates backup_path only from directory picker` | free input exists or picker cancel calls `updateSetting` |
| UI-11b-D9 | interval missing | RTL / fake timers | `QR-05 REQ-905 checks auto backup every 60 seconds` | `checkAutoBackup` is not called at 60s or `true` does not refetch list |
| UI-11b-D7 | list hides operator decision data | RTL | `QR-05 REQ-905 shows latest badge japanese datetime and MB size` | list does not show `最新`, Japanese datetime, or MB size |
| route/navigation | route unreachable | typecheck / route generation | `npm run typecheck` | `/settings/backup` is absent from generated route types or sidebar item is pending |
| Windows L3 | native file/DB behavior unknown | manual L3 | `UI-11b-L3-1..5` | backup file existence, DB switch, pre-restore backup, path output, or fatal wording is not verified by owner |

## Negative Paths

- initial `getSettings` / `listBackups` failure.
- empty backup list.
- manual `createBackup` failure.
- directory picker cancel.
- `updateSetting` failure.
- pre-restore `createBackup` failure.
- final AlertDialog cancel.
- `restoreBackup` recovered failure.
- `restoreBackup` unrecoverable double failure.

## Boundary Checks

- threshold: `checkAutoBackup` interval is 60,000 ms.
- null/default: missing backup settings fall back to safe display defaults.
- empty/non-empty: empty backup list still shows manual backup action.
- status/policy enum: restore state distinguishes `ready`, `pre_backup_failed`, `restoring`, recovered failure, and unrecoverable failure.
- wire type: `BackupInfo.file_path` is the only restore input; `UpdateSettingRequest` key is one of backup-owned keys.
- producer/consumer: generated `commands.*` promises are unwrapped through `unwrapResult`.
- precision/range: `size_bytes` displays as MB without changing backend value.
- cross-language parse: `created_at` backend string formats to Japanese datetime and falls back safely if invalid.

## Compatibility Checks

- Existing generated bindings from PR #141 remain unchanged.
- No backend command, DTO, schema, migration, or retention behavior changes.
- Existing settings keys (`backup_enabled`, `backup_time`, `backup_path`, `backup_retention_days`) remain strings.
- Existing home route remains `/`.

## Data Safety Checks

- Tests use mocked generated commands and synthetic file paths.
- No real `.db`, backup, WAL/SHM, log, JAN, product name, price, or store-specific data enters git diff.
- Windows native L3 evidence is owner-run and kept out of repo except summarized pass/fail in PR body.

## Main Wiring / Integration Checks

- `src/routes/settings/backup.tsx` exists and is generated into `src/routeTree.gen.ts`.
- `src/config/navigation.ts` sets `ui-11b` to `/settings/backup` and `active`.
- `BackupRestorePage` uses generated `commands.*` only.
- Query keys are centralized in `src/lib/query-keys.ts`.
- Native dialog permission already includes `dialog:allow-open`.

## Mutation-style Adequacy Questions

- If the pre-backup success/failure branch is inverted, the break-glass RTL test fails.
- If the fatal-message substring check is removed, the double-failure RTL test fails.
- If `queryClient.clear()` is replaced with invalidate-only, the success RTL test fails.
- If picker cancel updates settings, the path picker RTL test fails.
- If interval delay changes from 60,000 ms, the fake-timer RTL test fails.
- If the route is missing, route generation/typecheck fails.

## Residual Test Gaps

- Actual file creation and DB switching require Windows native L3.
- Double failure is not required to be induced in native runtime; automated command-mock coverage for state branch, wording, disabled controls, and interval stop is the accepted gate per 68.12.
- Accessibility scan is not separately added; RTL role/name assertions and shadcn/Radix primitives cover the main dialog/checkbox paths.

## Execution Results

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
- Review-only sub-agent Maxwell: P2 accepted/fixed. Double failure terminal state now stops/skips auto-check interval.
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
