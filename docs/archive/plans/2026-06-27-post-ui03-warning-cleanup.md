# Post UI-03 Warning Cleanup Plan

## Risk

Risk: R3

Reason:
This follow-up changes build chunking and traceability gate semantics. It does not change runtime business behavior, but it affects CI / pre-push signal and release build output.

## Goal

After PR #107 merge, remove two known noisy warnings before starting the next feature lane:

- Vite `npm run build` 500kB chunk warning.
- `generate_traceability --check` REQ-403 no-test WARN for a deliberately deferred requirement.

## Scope

- Add Vite `manualChunks` for large vendor groups without hiding warnings through `chunkSizeWarningLimit`.
- Extend `docs/spec/requirements.md` with `coverage=required|deferred`.
- Treat `coverage=deferred` requirements as excluded from T3 no-test WARN until implementation starts.
- Regenerate `docs/function-design/90-traceability.md`.
- Archive UI-03 active plans and add UI-03 Workflow Effectiveness Review.

## Non-scope

- Route lazy loading redesign beyond existing TanStack Router auto code splitting.
- Implementing UI-13 / REQ-403.
- Changing T2 phantom REQ or T4 FE baseline behavior.
- Deleting merged feature branches.

## Acceptance Criteria

- `npm run build` completes without the 500kB chunk warning and without manual chunk circular warnings.
- `cd src-tauri && cargo run --bin generate_traceability -- --check` completes with `WARN 0`.
- Existing traceability unit tests cover both `coverage=deferred` and `coverage=required` no-test behavior.
- `docs/Plans.md` no longer lists UI-03 as active work and names the next feature candidates.

## Test Plan

See [test-matrices/2026-06-27-post-ui03-warning-cleanup.md](test-matrices/2026-06-27-post-ui03-warning-cleanup.md).

TDD / verification order:

1. Add traceability generator tests for `coverage=deferred` and `coverage=required`.
2. Implement parser / renderer / T3 check changes.
3. Regenerate `90-traceability.md` and verify `--check` returns WARN 0.
4. Add Vite manual chunking and verify `npm run build` output has no chunk warning.
5. Run docs / frontend / generator gates.

## Verification Gates

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `cd src-tauri && cargo test --bin generate_traceability`
- `cd src-tauri && cargo run --bin generate_traceability -- --check`
- `bash scripts/doc-consistency-check.sh --target plan`
- `bash scripts/doc-consistency-check.sh`

## Review Focus

- Does `coverage=deferred` only suppress intentionally deferred requirements, while `coverage=required` still warns on no-test REQs?
- Does Vite chunk splitting remove the warning without adding circular chunk warnings or relying on `chunkSizeWarningLimit`?
- Are UI-03 plan archive links and WER links correct after moving active plans?
- Does this PR avoid implementing UI-13 / REQ-403 behavior?

## Spec Contract

Contract ID: SPEC-POST-UI03-WARNING-CLEANUP-2026-06-27

- `docs/spec/requirements.md` may mark a requirement `coverage=required` or `coverage=deferred`.
- Traceability T3 emits WARN only for no-test REQs with `coverage=required`.
- `coverage=deferred` means implementation has not started; it must be changed back to `required` when that requirement enters implementation.
- Vite build uses explicit vendor manual chunks for React, TanStack, Tauri, and UI dependencies; it does not increase `chunkSizeWarningLimit`.

## Trace Matrix

| Spec ID | Implementation | Test / Gate | Evidence |
|---|---|---|---|
| WARN-CLEANUP-1 | `vite.config.ts` manual chunks | `npm run build` | no 500kB / circular chunk warning |
| WARN-CLEANUP-2 | `CoveragePolicy` and T3 filtering | `cargo test --bin generate_traceability` | deferred excluded, required still warns |
| WARN-CLEANUP-3 | regenerated trace matrix | `cargo run --bin generate_traceability -- --check` | ERROR 0 / WARN 0 |
| WARN-CLEANUP-4 | plan archive / WER / dashboard sync | docs checks | active plan points to cleanup only |

## Data Safety

No POS CSV, PLU export, receipt image, DB, backup, log, `.env*`, credentials, or local app data is read or committed. This PR changes build configuration and repository docs/tooling only.

## Implementation Results

- `npm run build` no longer emits the 500kB chunk warning. The final chunk split keeps `vendor-react`, `vendor-tanstack`, `vendor-ui`, and `vendor-tauri` below the warning threshold and avoids circular chunk warnings.
- `docs/spec/requirements.md` now has a `coverage` column. `REQ-403` is `deferred` because UI-13 is not implemented yet.
- `generate_traceability --check` now reports `ERROR 0 / WARN 0`.
- UI-03 active plans and test matrices were moved to archive, and UI-03 WER was added.

Verification run:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `npm run build` — passed with no 500kB chunk warning.
- `cd src-tauri && cargo test --bin generate_traceability` — passed, 14 tests.
- `cd src-tauri && cargo fmt --check` — passed.
- `cd src-tauri && cargo run --bin generate_traceability -- --check` — passed, ERROR 0 / WARN 0.
- `bash scripts/doc-consistency-check.sh --target plan` — passed with WARN 1 for the intentional review-only skip record.
- `bash scripts/doc-consistency-check.sh` — passed.

Review-only skipped because:

- This follow-up does not change runtime business behavior, database behavior, command wire shape, or operator workflow.
- The risky behavior change is limited to the traceability generator and is covered by focused generator unit tests plus `--check` on the real repo.
- Vite chunking is verified by the production build output itself.
