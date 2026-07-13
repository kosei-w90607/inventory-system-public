# UI-11b backup / restore Design Phase

> **Status**: 完了（PR #142 squash merge `2003400`。実装 PR #144 `9d1b07e` まで全消化、2026-07-06 closeout で archive）

## Risk

Risk: R2

Reason:
Docs-only Design Phase PR. It fixes durable source docs for a future restore UI, including data-safety wording and L3 evidence, but does not change runtime code, DB schema, command signatures, generated bindings, or tests. The later implementation remains higher-risk because restore is a destructive DB-wide operation.

## Goal

Record the UI-11b backup / restore screen design in source docs so the implementation PR can follow fixed decisions instead of chat context.

## Scope

- Create `docs/function-design/68-ui-backup-restore.md`.
- Add decision-log D-032 for restore safety.
- Sync `docs/FUNCTION_DESIGN.md`, `docs/SCREEN_DESIGN.md`, and `docs/Plans.md`.
- Verify the design text against `docs/function-design/71-mnt-backup.md`, `docs/function-design/43-cmd-settings-log.md`, generated `commands.*`, and read-only implementation inspection.

## Non-scope

- Runtime implementation.
- UI-11a threshold settings design.
- Backend `check_auto_backup` scheduler semantics.
- Backup retention behavior changes.
- Archiving already-completed active plans.

## Acceptance Criteria

- `docs/function-design/68-ui-backup-restore.md` exists and covers purpose, design decisions, route/components, state machine, command contract, wording, query invalidation, recovery, Windows native L3, and non-scope.
- D-032 records forced pre-restore backup, break-glass exception, two-step confirmation, post-restore cache clear/home transition, and double-failure restart guidance.
- `docs/FUNCTION_DESIGN.md` no longer treats UI-11b as an unwritten UI-11 screen.
- `docs/SCREEN_DESIGN.md` records the UI-11b screen-specific design pointer.
- `docs/Plans.md` reflects PR #141 as merged and this PR as the current UI-11b Design Phase.
- `bash scripts/doc-consistency-check.sh` and `git diff --check` are green.

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` (`QR-05`, `REQ-905`)
- Architecture: `docs/ARCHITECTURE.md`
- Function / command / DTO: `docs/function-design/43-cmd-settings-log.md`, `docs/function-design/71-mnt-backup.md`
- DB: `docs/DB_DESIGN.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/function-design/67-ui-plu-export.md`
- Decision log / ADR: `docs/decision-log.md`, `docs/AGENT_OPERATING_MANUAL.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `43-cmd-settings-log.md`, `71-mnt-backup.md` | existing sufficient; read-only fact check in this PR |
| Command / DTO / generated binding / wire shape | `43-cmd-settings-log.md`, generated `src/lib/bindings.ts` | existing sufficient after PR #141 |
| DB / transaction / audit / rollback / migration | `71-mnt-backup.md`, D-032 | updated in this PR through UI safety decision; no schema change |
| Screen / UI / route state / Japanese wording | new `68-ui-backup-restore.md`, `SCREEN_DESIGN.md` | updated in this PR |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | `decision-log.md` D-032 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| QR-05 / REQ-905 | `68-ui-backup-restore.md` §68.5-68.12 | UI-11b-D2..D5, D-032 | Restore has no true undo, but DB-corruption recovery must remain possible. | future `BackupRestorePage` and hooks | future Vitest + Windows native L3 |
| QR-05 | `68-ui-backup-restore.md` §68.8-68.10 | UI-11b-D6..D9 | Backup settings belong on the backup screen and auto-check is a frontend timer responsibility. | future route and query hooks | future generated command mocks / interval test |
| QR-05 | `68-ui-backup-restore.md` §68.12 | UI-11b-D10 | File creation and restore result require Windows-native evidence. | future manual gate | Windows native L3 checklist |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes; D-032 and 68 become the durable sources.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: restore safety contract promoted to D-032.
- Assumptions and constraints: PR #141 generated bindings are present; current `src/` has no `checkAutoBackup` interval implementation.
- Deferred design gaps, risk, and follow-up target: UI implementation PR must add the route, components, interval, tests, and Windows L3.
- Test Design Matrix can cite design decision IDs or source doc sections: yes; implementation PR can cite UI-11b-D2..D10 and D-032.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | Not POS/register adapter work. | none |
| Fact check / design decision split | Backend facts were checked against 43/71 and implementation; UI decisions captured in D-032/68. | D-032, 68 |
| Lifecycle / retry | Restore success, recoverable failure, and double failure are explicit states. | 68 state machine |
| Operator workflow | Non-IT owner wording, two-step confirmation, break-glass checkbox, and path picker are fixed. | 68 UI / Wording |
| Replacement path | Not applicable. | none |
| Data safety / evidence | Restore is DB-wide destructive; evidence must avoid real store data. | D-032, 68 L3 |
| Reporting / accounting semantics | Not applicable. | none |
| Manual verification | Backup file existence, restore data switch, pre-restore backup file, and path output require Windows L3. | 68 L3 |

## Design Readiness

- Existing design docs are sufficient because: backend backup/restore and CMD ownership/reconnect contracts already exist in 71 and 43.
- Source docs updated in this PR: `68-ui-backup-restore.md`, `decision-log.md`, `FUNCTION_DESIGN.md`, `SCREEN_DESIGN.md`, `Plans.md`.
- Design gaps intentionally deferred: implementation component details, route generation, tests, native dialog code, and Windows L3 execution.
- Durable decisions discovered in this plan and promoted to source docs: D-032 restore safety contract.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI uses generated `commands.*`; restore backend contract stays in CMD/MNT.
- Backend function design: unchanged; facts cited from 43/71.
- Command / DTO / data contract: generated `getSettings`, `updateSetting`, `listLogs`, `createBackup`, `checkAutoBackup`, `listBackups`, `restoreBackup`.
- Persistence / transaction / audit impact: restore success deletes temporary `.restore_backup` files; no true undo.
- Operator workflow / Japanese UI wording: fixed in 68.
- Error, empty, retry, and recovery behavior: fixed in 68 state machine and D-032.
- Testability and traceability IDs: future implementation can attach QR-05 / REQ-905 and UI-11b-D IDs.

## Test Plan

- targeted tests: docs consistency check only for this PR.
- negative tests: docs text must not claim UI implementation exists.
- compatibility checks: links and referenced docs exist.
- data safety checks: no real DB, backup, JAN, product, price, or store-specific evidence added.
- main wiring/integration checks: not applicable; runtime is unchanged.

## Boundary / Wire Contract

- producer: existing Tauri CMD-11 commands and generated `src/lib/bindings.ts`.
- consumer: future UI-11b screen.
- wire type: generated TypeScript `commands.*` functions and specta DTOs.
- internal type: Rust CMD/MNT types documented in 43 and 71.
- precision/range: file sizes are `u64` bytes displayed as MB; timestamps from backup filenames are displayed as Japanese local date/time.
- round-trip path: UI -> generated command -> CMD -> MNT/system repo -> UI.
- invalid input: restore path must be an existing backup file; backup path setting comes only from native directory picker.
- compatibility: no runtime wire change in this PR.

## Review Focus

- Whether 68 accurately reflects `71-mnt-backup.md`, `43-cmd-settings-log.md`, and PR #141 generated command names.
- Whether D-032 separates implemented backend facts from UI design decisions.
- Whether `Plans.md` reflects PR #141 merged without over-archiving unrelated active plans.

## Spec Contract

R2 docs-only: not required. UI-11b implementation PR AC: create a Test Design Matrix because restore is data-safety critical.

## Trace Matrix

R2 docs-only: not required.

## Data Safety

R2 docs-only: no runtime data touched. The new docs explicitly forbid committing real store DB files, backups, JANs, product names, prices, or backup artifacts as L3 evidence.

## Implementation Results

Pending.

## Review Response

Pending. Review-only skipped because this is an R2 docs-only Design Phase PR with fixed Fable decisions and no runtime code changes.
