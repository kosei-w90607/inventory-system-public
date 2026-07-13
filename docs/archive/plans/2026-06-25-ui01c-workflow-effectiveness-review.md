# Workflow Effectiveness Review: UI-01c 商品一括インポート implementation

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-25-ui01c-implementation.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-25-ui01c-implementation.md`
- review-only sub-agent: 実施
- external review: なし
- human approval: PR #100 merge 承認、Windows native L3 owner confirmation
- gates:
  - `cargo run --bin generate_bindings`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm test`
  - `npm run build`
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - `bash scripts/doc-consistency-check.sh`
  - pre-push traceability check
  - GitHub Actions CI: Rust / Frontend / Design doc consistency

## What Worked

Which workflow step caught or prevented a real issue?

- Design Phase kept UI-01c decisions in source docs (`60-ui-product-import.md`, `SCREEN_DESIGN.md`, `UI_TECH_STACK.md`) rather than leaving route, duplicate handling, commit state, and file input policy only in the Plan Packet.
- Plan Packet contract surfaced the generated binding name collision risk early. Product import result was renamed to `ProductImportResult`, avoiding conflict with the existing sales CSV `ImportResult`.
- Test Design Matrix led to focused RTL tests for duplicate overwrite, zero-target disabled state, result counts, query invalidation, and commit pending state.
- review-only sub-agent caught a real UI contract issue: during commit, the header "商品一覧へ戻る" action still allowed false cancellation. The same PR removed the header action in `committing` state and added pending-state test coverage.
- Windows native L3 caught a platform-specific drag/drop failure that unit tests and build gates could not see. The fix was small and local: `dragDropEnabled: false` in `tauri.conf.json`, plus source doc synchronization.

## What Did Not Work

Which step was overhead, noisy, unclear, or too heavy?

- L3 checklist initially named behavior to inspect but did not provide ready-to-run synthetic CSV files. The owner could open the screen and test file input, but preview / duplicate / error checks stalled until sample CSV commands were supplied.
- The initial design said plain HTML drag/drop was acceptable, but did not include the Tauri window config requirement. That made the implementation look complete until Windows native L3.
- Commit-in-progress navigation hiding is too fast for reliable manual observation. Keeping it in the L3 checklist as a purely visual item was not useful; the better evidence is a pending-state test that controls the promise.

## Issues Caught Before Implementation

- `ProductImportResult` rename avoided a generated TypeScript type collision with sales CSV import.
- Existing BIZ/IO CSV import behavior was kept as source of truth; UI only used generated CMD calls and did not move parsing or validation into React.
- Non-scope items were explicitly bounded: `@tauri-apps/plugin-dialog`, template download, server-side preview token, bulk overwrite, import history, and cancel/resume.

## Issues Caught by Tests

- RTL confirmed valid rows can commit even when row errors exist.
- RTL confirmed zero-target preview disables commit and shows a reason.
- RTL confirmed selected duplicate rows alone are included in `commitImport` payload and `overwriteCodes`.
- RTL confirmed created / updated / skipped result counts are displayed and the four product/inventory query keys are invalidated.
- RTL confirmed commit pending state hides the header return link and disables import / reselect actions.

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Commit 中もヘッダーの「商品一覧へ戻る」リンクから離脱できる | accepted | `committing` state では `PageHeader.actions` を非表示にした |
| Result / query invalidation / committing 中 false-cancel の RTL coverage 不足 | accepted | result counts, 4 query invalidations, pending-state hidden return link, disabled import/reselect tests を追加 |
| Unrelated continuity docs plan exists as untracked work | accepted as scope note | PR #100 では除外し、merge 後に `.local/hold/plans/` へ退避 |

## Issues Caught by External Review

- なし。

## Escaped / Late Findings

What reached a later stage and should have been caught earlier?

- Windows native drag/drop did not reach the HTML dropzone until `tauri.conf.json` set `dragDropEnabled: false`. This escaped to L3 because source docs did not mention Tauri's built-in file-drop behavior.
- L3 sample CSV files were not prepared in the first L3 instruction. The checklist depended on files the owner did not yet have.
- PR body initially still said Windows native L3 was required after owner confirmation completed. It was corrected before merge, but PR closeout should include a stale-body check whenever L3 happens after PR creation.

## Test Adequacy

Strong tests:
- `ProductImportPage.test.tsx` covers the main user-visible contracts: commit payload, overwrite confirmation, result counts, invalidation, zero-target disabled state, and pending-state controls.
- `reducer.test.ts` covers state transitions for preview start, duplicate overwrite selection, and commit failure recovery.
- Full local and CI gates covered Rust command registration, generated bindings, frontend build/type/lint, docs consistency, and traceability.

Weak or missing tests:
- HTML drag/drop in Tauri WebView was not covered by automated tests. The behavior depends on native WebView/Tauri window config and remains an L3 concern.
- The L3 sample CSV flow was manual. It is acceptable for now, but future import/export screens should include explicit synthetic fixture instructions in PR/L3 evidence earlier.

Mutation-style observations:
- If `ProductImportPage` always rendered the header return link, the pending-state RTL test would fail.
- If duplicate rows were all committed regardless of checkbox state, the selected duplicate payload test would fail.
- If Tauri's built-in file drop was re-enabled, current automated tests would stay green; Windows native L3 would be needed to catch it.

## Signal / Noise

- sub-agent findings total: 3
- accepted: 3
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: R3 Plan Packet / Test Matrix / review-only sub-agent were justified. The sub-agent found a real P2 UX contract issue and missing RTL coverage before merge.
- excessive friction: none severe. The main extra cost came from L3 fixture preparation happening after the first manual pass instead of before.
- confusing steps: "commit 中" was ambiguous to the owner because it could sound like `git commit`. Future L3 wording should say "インポート処理中（取込実行を押してから結果が出るまで）".

## Recommended Workflow Adjustment

Keep:
- R3 Plan Packet / Test Matrix / review-only sub-agent default for operator-facing UI with command wire changes.
- Windows native L3 for Tauri UI that includes file input, drag/drop, Japanese input, or navigation behavior.
- Pending-state behavior in automated tests when the UI state is too fast for reliable manual observation.

Change:
- L3 instructions for import/export screens should include concrete synthetic fixture creation commands and expected visible results up front.
- Tauri HTML drag/drop designs must mention `dragDropEnabled: false` when relying on frontend `onDrop` rather than Tauri file-drop events.
- L3 checklist wording should avoid overloaded terms such as "commit 中"; use user-facing phrasing like "インポート処理中".

Follow-up:
- UI-02 Design Readiness should identify which L3 checks are manually observable and which require controlled automated pending/error-state tests.
- Workflow 自走化 第2層 remains a larger follow-up; UI-01c evidence supports it conceptually but does not justify implementing a state-machine gate in this closeout PR.

## Applied / Deferred Workflow Changes

Applied:
- `UI_TECH_STACK.md` and `60-ui-product-import.md` now record `dragDropEnabled: false` for the plain HTML file input/dropzone path.
- PR #100 body was updated before merge to reflect completed L3 and CI.
- The unrelated continuity plan was moved to `.local/hold/plans/` so active plan checks only see active work.

Deferred:
- No new machine enforcement for workflow state phases. Deferred to the existing Workflow 自走化 第2層 backlog after a dedicated Design Phase.
- No automated native drag/drop test. Deferred because current test stack does not run Tauri WebView interaction tests.

Not applied:
- No `@tauri-apps/plugin-dialog` migration. It remains a future cross-file-dialog PR candidate, not a UI-01c closeout change.
