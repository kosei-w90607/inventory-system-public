# Decision Log

## Purpose

Capture the high-value decisions and their rationale so the project does not re-litigate them after context loss.
Use concise ADR-style entries.

## D-001
- Decision: Use `Tauri 2.x + React + TypeScript + SQLite`
- Status: accepted
- Why: fits a local single-store desktop workflow with a Rust core and familiar UI stack
- Impact: all implementation planning assumes this stack
- Alternatives considered: web app, Electron, pure native app

## D-002
- Decision: Treat repository-local docs as the system of record
- Status: accepted
- Why: durable repo artifacts are more reliable than chat continuity
- Impact: `PROJECT_HANDOFF`, design docs, and memory docs must be kept current
- Alternatives considered: chat-only continuity, one giant handoff file

## D-003
- Decision: Keep root `AGENTS.md` short and move deeper memory into dedicated docs
- Status: accepted
- Why: shorter root guidance is easier for both humans and agents to maintain
- Impact: `project-memory`, `decision-log`, and `current-status` carry continuity
- Alternatives considered: putting all context in root AGENTS

## D-004
- Decision: Use an 18-table SQLite design with logical invalidation for import rollback
- Status: accepted
- Why: preserves auditability and avoids destructive rollback behavior
- Impact: `sale_records` and `inventory_movements` use `is_voided`
- Alternatives considered: physical delete on rollback

## D-005
- Decision: CSV sales import uses `Parse -> Validate -> Preview -> Commit`
- Status: accepted
- Why: separates irreversible writes from parsing and operator review
- Impact: BIZ/UI/CMD import design depends on this structure
- Alternatives considered: one-shot import

## D-006
- Decision: Parse failures are logged to `operation_logs`, not stored as failed `csv_imports`
- Status: accepted
- Why: a parse failure can happen before a meaningful import record exists
- Impact: `csv_imports` only represents committed import attempts
- Alternatives considered: persisting failed imports early

## D-007
- Decision: Multiple `jan_code` matches resolve deterministically by `ORDER BY product_code ASC`
- Status: accepted
- Why: keeps import behavior stable even if group-JAN products remain
- Impact: validation and re-run behavior stay deterministic
- Alternatives considered: arbitrary first match, new group mapping table now

## D-008
- Decision: `pos_stock_sync` is an explicit business flag
- Status: accepted
- Why: auto-decrement behavior is a business rule, not just a unit-of-measure rule
- Impact: product create/edit flows must preserve operator intent
- Alternatives considered: deriving solely from `stock_unit='cm'`

## D-009
- Decision: Register-processed returns are reflected by CSV import
- Status: accepted
- Why: avoids double-adjusting stock in both manual screens and import
- Impact: return logic distinguishes `register_processed`
- Alternatives considered: always adjusting inventory directly in return UI

## D-010
- Decision: Stocktake can proceed while CSV import remains allowed
- Status: accepted
- Why: store operation cannot freeze for a long stocktake window
- Impact: stocktake compares dynamically and adjusts at completion
- Alternatives considered: blocking CSV import during stocktake

## D-011
- Decision: PLU reflection on the register is operational, not system-detectable
- Status: accepted
- Why: there is no reliable feedback channel from the register
- Impact: `plu_exported_at` and `plu_dirty` track only app-side state
- Alternatives considered: pseudo-confirmation without real evidence

## D-012
- Decision: Tests and traceability are grown alongside implementation
- Status: accepted
- Why: executable tests are more reliable than detached prose once function design is written
- Impact: write tests with code, attach requirement/spec IDs, update traceability at stage boundaries
- Alternatives considered: full document-first test design before coding

## D-013
- Decision: Treat scoped Windows native L3 OK as evidence only for that PR scope, not as Phase completion
- Status: accepted
- Why: PR #74's operator OK covered stock inquiry high-visibility status labels, not the full Phase 2 five-screen workflow
- Impact: Phase 2 H-6 was kept separate from PR #74 and could close only after UI-00 / UI-07 / UI-09a / UI-06a / UI-09b were walked through together on Windows native
- Alternatives considered: closing H-6 from the PR #74 L3 result

## D-014
- Decision: Close Phase 2 H-6 with a non-blocking product-code readability follow-up
- Status: accepted
- Why: Windows native five-screen walkthrough found only that product code text is small; other visibility checks were OK
- Impact: H-6 is not blocked. Product-code readability is tracked with the future global text-size / display-scale option
- Alternatives considered: blocking Phase 2 completion on product-code text size alone

## D-015
- Decision: Do not make E2E or visual regression a Phase 2 tag gate
- Status: accepted
- Why: Phase 2 daily five screens are code-complete / route active, Vitest + React Testing Library already cover the implemented behavior at role / text / state / structure level, and H-6 Windows native five-screen walkthrough passed with only a non-blocking product-code readability follow-up
- Impact: `v0.8.0-ui-daily` proceeded without adding E2E / visual regression as tag gates. Smoke E2E / visual regression stay as follow-up candidates for Phase 3 / Phase 4 cross-screen regressions or global display-scale changes
- Alternatives considered: adding Playwright / Tauri E2E before the Phase 2 tag, adding screenshot regression before the Phase 2 tag

## D-016
- Decision: Retire the temporary `typedInvoke` fallback path during Phase 2 closeout
- Status: accepted
- Why: `FallbackCommand` remained `never` and `typedInvoke` call count was 0, so the fallback path had become dead migration scaffolding before the `v0.8.0-ui-daily` tag
- Impact: frontend command calls now use generated `commands.*` plus `unwrapResult` only. `src/lib/invoke-fallback.ts`, the typedInvoke count script / baseline, and fallback-only ESLint / CI / pre-push gates are removed
- Alternatives considered: keeping the 0-count guard beyond Phase 2, replacing it with a permanent grep gate

## D-017
- Decision: Treat PR #75 closeout merge `f44f99a` as the `v0.8.0-ui-daily` Phase 2 baseline
- Status: accepted
- Why: Phase 2 daily five screens, H-6 Windows native walkthrough, 8-9 E2E / visual regression decision, and ADR-004 `typedInvoke` retirement were all complete
- Impact: `v0.8.0-ui-daily` is created on `f44f99a`. The next work is post-Phase 2 follow-up selection and Phase 3 planning, not more Phase 2 tag gating
- Alternatives considered: delaying the tag for product-code readability, adding E2E / visual regression before tagging

## D-018
- Decision: Put a Design Phase between Spec Check and Plan for R2+ work when source design docs, shared behavior, workflow gates, or contracts may be affected
- Status: accepted
- Why: this is a business application; implementation must start from durable design docs that describe operator workflow, layer ownership, command/data contracts, persistence safety, error/recovery behavior, and testability before code is planned
- Impact: Plan Packets cite design sources and readiness, but do not become the only durable home for design decisions. Missing or ambiguous in-scope design returns the work to Design Phase before implementation.
- Alternatives considered: continuing to use Plan Packets as the practical design substitute, adding machine enforcement before dogfooding the manual gate

## D-019
- Decision: Continue using npm, but thaw dependency updates with explicit small-scope installs while keeping install-time dependency scripts blocked.
- Status: accepted
- Why: the Mini Shai-Hulud / TanStack incident was a supply-chain and install-script execution risk, not proof that npm itself is unusable. The current safe path is to avoid affected versions, keep `ignore-scripts=true`, and update direct packages deliberately instead of running broad `npm audit fix`.
- Impact: dependency update PRs must keep `.npmrc ignore-scripts=true`, name the updated direct packages, check advisory affected ranges when relevant, and run full frontend/docs gates. If install scripts become necessary, use an explicit allowlist policy such as npm `allowScripts` before removing the blanket block.
- Alternatives considered: banning npm entirely, migrating to pnpm immediately, removing `ignore-scripts=true`, running `npm audit fix --force`.

## D-020
- Decision: Design new capabilities from the intended finished product shape before slicing implementation PRs.
- Status: accepted
- Why: inventory-system is a commercial-use business app; designing only the first small slice can hide necessary auditability, traceability, correction, and operator workflow needs until they become expensive retrofit work.
- Impact: Design Phase should describe the complete business capability first, then explicitly mark which parts are delivered now and which are deferred. Deferral is an implementation-scope decision, not a reason to omit the finished capability from source design docs.
- Alternatives considered: designing only the immediate PR scope and discovering adjacent requirements later.

## D-021
- Decision: When adding or revising a behavior spec, temporarily raise the review risk to inspect adjacent-spec consistency and required mitigations before implementation scope is finalized.
- Status: accepted
- Why: PR #114 showed that a behavior can look like a small UX fix while actually touching route/search state, return-path semantics, input trust boundaries, and future sibling-detail consistency. Treating adjacent scenarios as "already specified" can hide missing source-design text.
- Impact: Design Phase must explicitly separate already-specified behavior, natural UX extensions, and new spec additions. If a risk is accepted or mitigated, the mitigation belongs in source design docs, not only in the active plan or chat.
- Alternatives considered: keeping the existing risk tier when the code change is small, or recording the mitigation only in the Plan Packet.

## D-022
- Decision: Split the POS field-check outcome into a SALES track and a PLU track before UI-08 implementation.
- Status: accepted
- Why: The 2026-06-30 field-check showed that current store daily report work uses CASIO PC tool / SD-card `Z001`, `Z002`, and `Z005`, while `Z004` is the PLU/product track and is not the current daily-report primary input. UI-08 also depends on installed CV17 1.1.1 behavior, while existing PLU docs were based on CV17 Ver.2.0.1.
- Impact: REQ-401 must be redesigned around `Z001`/`Z002`/`Z005` before changing sales import/report behavior. REQ-402 UI-08 must verify PLU TSV header/version acceptance and operator recovery before implementation. Existing Z004 parser docs remain implemented-current, not the whole current store workflow.
- Alternatives considered: continue directly to UI-08 using the old Z004-only premise; replace the existing Z004 parser immediately without a SALES design PR; make ECR+ the primary integration despite service-end risk.

## D-023
- Decision: Define POS integration as a replaceable adapter boundary between register-specific file/procedure details and app-internal sales/inventory models.
- Status: accepted
- Why: The project originally intended to tolerate future register replacement by changing only the register-facing integration. The 2026-06-30 field-check showed that CASIO-specific facts are not one file format but a set of coupled inputs/outputs: PLU TSV export, `Z001`/`Z002`/`Z005` daily report inputs, `Z004` product-sales output after PLU registration, PC tool behavior, SD-card workflow, and backup/retry procedures. Without an explicit boundary, CASIO names and assumptions leak into UI/BIZ contracts and make future register replacement expensive.
- Impact: Future REQ-401/REQ-402 design must separate fact checks from design decisions. Register adapters own external formats, encodings, file naming, PC-tool/register procedures, register limits, and mapping into app-internal models. The app core owns product master, inventory movements, report models, import lifecycle, rollback semantics, operator-facing concepts, and data safety. CASIO `Z001`/`Z002`/`Z004`/`Z005` and CV17 remain adapter details unless a source doc explicitly promotes a concept to an app-internal model.
- Alternatives considered: keep one generic CSV import pipeline with CASIO names in BIZ/CMD/UI; rewrite each future register integration end-to-end; model only the current CASIO workflow and postpone the adapter boundary until a register replacement happens.

## D-024
- Decision: Add Impact Review Lenses to the workflow path for field investigation, real-device confirmation, external integration, and operator workflow discovery tasks.
- Status: accepted
- Why: The owner cannot reliably remember a special prompt for "what to inspect after a heavy investigation." The workflow must surface the missed-issue lenses automatically when a task can change design assumptions.
- Impact: `docs/DEV_WORKFLOW.md` owns the canonical lens list. `inventory-workflow-start` triggers the lenses during triage, `docs/templates/plan-packet.md` records which lenses were used, and review-only sub-agent packets pass the same lenses as review prompts when present or applicable. Applicable tasks inspect adapter/core boundary, fact vs design split, lifecycle/retry, operator workflow, replacement path, data safety/evidence, reporting/accounting semantics, and manual verification before implementation and before external review.
- Alternatives considered: rely on a reusable owner prompt only; keep the lens list only inside one Plan Packet; duplicate the full lens list inside the workflow skill; leave the lenses out of sub-agent review packets and rely on reviewers to infer them from the Plan Packet.

## D-025
- Decision: Model Z001/Z002/Z005 daily report imports separately from Z004 item-level sales imports.
- Status: accepted
- Why: Z001/Z002/Z005 are aggregate daily report sources: daily summary, payment/key summary, and department totals. They do not contain product_code/JAN item rows and cannot safely drive item-level `sale_records` or inventory movements. Z004 remains the product-sales track after PLU registration and real-file confirmation.
- Impact: REQ-401 implementation adds `daily_report_imports` and `daily_report_*_lines`, plus IO-07/BIZ-08/CMD-12 contracts. UI-07 becomes "売上データ取込み" with daily report import as the current operation default and Z004 product-sales import as a separate PLU-after track. BIZ-05 reports must distinguish official daily report aggregates from item-level sales details.
- Alternatives considered: force Z001/Z002/Z005 into `sale_records`; replace the existing Z004 pipeline immediately; keep a single generic CSV import UI that hides whether inventory changes.

## D-026
- Decision: Split CI merge gates by changed area and separate Rust lint, test, and generated drift checks.
- Status: accepted
- Why: PR #119 showed GitHub hosted runner disk pressure when clippy, tests, bindings generation, and traceability generation shared one Rust workspace. Docs-only closeout PRs also paid the full Rust/frontend cost despite not changing runtime contracts.
- Impact: CI now starts with changed-area detection, keeps docs consistency running for every workflow trigger, skips heavy Rust/frontend gates when their areas are untouched, keeps env safety as an independent lightweight job, and runs workflow changes through the heavy gates. Rust fmt/clippy, Rust tests, and generated drift checks run in separate jobs with disk telemetry. The existing `Rust (fmt + clippy + test)` check name remains as an aggregate status for compatibility.
- Alternatives considered: keep one Rust job and only add `cargo clean`; use workflow-level `paths` filters that can remove required check contexts; move all checks into local pre-push only; buy more runner capacity before reducing avoidable work.
- Superseded in part by: D-033 removes per-push / `push: main` hosted execution and `src-tauri/target/` caching. Changed-area routing, the Rust three-job split, aggregate check name, and disk telemetry remain in force.

## D-027
- Decision: Split PLU TSV generation from app-side PLU export confirmation.
- Status: accepted
- Why: The app can prove that it generated a CP932 TSV and saved it locally, but it cannot prove that CV17 accepted the file or that SR-S4000 reflected it. Clearing `plu_dirty` at byte generation time weakens the operator recovery path when PC-tool import fails, because Diff mode no longer includes the same changed products.
- Impact: REQ-402 uses a two-step command and UI contract: `prepare_plu_export` generates TSV bytes and leaves `plu_dirty` unchanged; `confirm_plu_export_saved` is called only after the operator confirms that the saved file should be treated as app-side exported, and updates the exact generated product set to `plu_dirty=0` / `plu_exported_at=now`. Register reflection remains manual and non-detectable.
- Alternatives considered: keep the old single `export_plu` command that updates dirty on generation; add a dedicated PLU export history table now; clear dirty only after real register confirmation.

## D-028
- Decision: Introduce an explicit `products.plu_target` flag and a three-bucket PLU export model (target / out-of-scope / needs-fix), with same-JAN dedup and a Full-only CV17 import guard.
- Status: accepted
- Why: The store has products without JAN codes (4 field-confirmed categories: pre-JAN-era stock, group-code variants without individual codes, spot sale items, made-to-order staples), and "has a valid JAN" does not equal "sold by scanning" (group-code products have JANs the store does not scan; spot items should not consume PLU slots). Under the previous design, one JAN-less product made Full export permanently fail, left `plu_dirty=1` unrecoverable (Diff deadlock), and permanently polluted the UI-00 PLU notification. Pure derivation from JAN validity cannot express the operator's per-product decision, matching the precedent of `pos_stock_sync` (指摘#9: explicit flag over automatic derivation).
- Impact: `products.plu_target BOOLEAN NOT NULL DEFAULT 0` is added by migration v3 (ALTER TABLE + same-transaction backfill: `is_discontinued=0` and 13-digit-numeric `jan_code` → 1). `prepare_plu_export` extracts only `plu_target=1` products, returns JAN-defective and same-JAN price-mismatched products as an `excluded` needs-fix list without blocking generation, dedups same-JAN groups to one representative row (lowest product_code) while `target_product_codes` carries all group members so `confirm_plu_export_saved` clears the whole group, and drops the confirm-side count-limit check. `find_plu_dirty_products` / both `_for_plu` queries gain `plu_target=1`, which also scopes the UI-00 notification. UI-01b proposes the initial flag value from the JAN field and lets the operator change it. Because CV17 import is a memory-No.-keyed partial update (`ECRCV17.pdf` p.71-73) and the formatter renumbers from 217 every export, only Full export files may be imported into CV17 until persistent slot allocation is designed (Plans.md backlog).
- Alternatives considered: keep the all-or-nothing validation failure (Full export can never succeed with real store data); derive PLU eligibility purely from JAN validity with an operational rule "leave jan_code empty for non-scanned products" (destroys jan_code's reference value for invoice matching and Z004 lookup); in-store EAN-13 issuance with printed labels for JAN-less products (label printer plus per-item labeling is unrealistic for the elderly non-IT operator); per-JAN slot persistence in this same change (deferred to its own design to avoid scope creep).

## D-029
- Decision: Keep npm and adopt its native supply-chain hardening: enable `min-release-age=7` in `.npmrc` now, plan `allowScripts` adoption at npm 11.16+ / v12, and decline pnpm migration.
- Status: accepted
- Why: The 2026-07 npm policy spike confirmed npm itself reached parity with pnpm's defenses: `min-release-age` (npm 11.10.0+, unit=days, implemented internally as a derived `before` date pin, verified locally on npm 11.11.1 by a toggle experiment) covers the publish-cooldown defense, and `allowScripts` + `npm approve-scripts` / `deny-scripts` (npm 11.16.0+, deny-by-default enforcement planned as npm v12 default, estimated 2026-07 per GitHub Changelog 2026-06-09) covers the explicit script allowlist that D-019 required before removing the blanket block. This project has run fully green under `ignore-scripts=true` since 2026-05-13, proving no dependency needs install scripts, so the future allowScripts allowlist is empty and pnpm migration would buy no additional protection while costing a full lockfile regeneration (the single riskiest operation under the freeze), plus CI / DEV_SETUP_CHECKLIST / Windows-native-clone runbook rewrites.
- Impact: `.npmrc` gains `min-release-age=7`; it affects only future dependency-update resolution (D-019 thaw lane) and does not change lockfile-exact `npm ci --ignore-scripts`. Urgent security patches younger than 7 days require an explicit user-approved temporary `min-release-age-exclude[]` entry. `ignore-scripts=true` stays as the blanket block until the freeze lifts, and stays recommended permanently afterwards (CISA guidance). npm v12 upgrade is evaluated when released; the advisory-monitoring automation stays a separate PR (`chore/npm-advisory-monitoring`).
- Alternatives considered: migrating to pnpm 11 (minimumReleaseAge default 1440min, blockExoticSubdeps — parity now native in npm, migration cost unjustified); setting min-release-age to 1 day (pnpm default) or 14 days (7 days chosen: this project's deliberate low-frequency thaw updates make a wide margin free, while 14+ days needlessly delays security patches); adopting @lavamoat/allow-scripts as a third-party allowlist before npm 11.16 (adds a dependency to reduce dependency risk, superseded by native support); removing `ignore-scripts=true` once allowScripts enforcement lands (rejected: defense in depth, blanket block costs nothing).

## D-030
- Decision: End the npm blanket install freeze (2026-05-13 – 2026-07-05) and move to normal development with permanent standing guards: sequential per-need installs under `ignore-scripts=true` + `min-release-age=7` + `--save-exact` + lockfile-diff review in PRs.
- Status: accepted
- Why: User decision (2026-07-05): blocking needed packages indefinitely stalls the project. The supporting rationale is explicitly NOT "attacks have stopped" — same-day verification confirmed they continue roughly monthly (node-ipc 2026-05-14, dependency-confusion 33 packages 2026-05-29, Miasma @redhat-cloud-services 32 packages 2026-06-01 with a binding.gyp second wave 2026-06-04, Mastra 2026-06-17). The rationale is that the standing guards now structurally neutralize the observed attack vectors: install-script execution (preinstall / postinstall / implicit node-gyp via binding.gyp) is blocked by `ignore-scripts=true`, and freshly-published poisoned versions (which registries remove within hours-to-days) never resolve under `min-release-age=7`. This reasoning stays valid when the next incident happens, whereas "it seems calm" would force a re-freeze panic each time. The old lift conditions (GHSA-g7cv-rxg3-hmpx withdrawn + 7-day clean `npm audit`) were designed for lifting the blanket freeze itself; D-030 is a defense-mode transition rather than that lift, so it proceeds with the advisory still active — the freeze's operational cost (stalled tooling, the 7-step safety-net ceremony per install) now exceeds the residual risk (require-time runtime payloads and dependency confusion, both largely covered by the cooldown window and exact-name official-registry discipline).
- Impact: CLAUDE.md's emergency freeze section is replaced by a permanent "npm supply-chain defense rules" section. Allowed as normal operation: `npm install <pkg>@<ver> --save-exact` (add `--save-dev` for devDeps) when a package is needed, `npm ci --ignore-scripts`, deliberate named-package updates. Still forbidden: `npm audit fix --force`, blanket `npm update` / `npm upgrade` without package names, `npx <package>` without a version pin, and adding `min-release-age-exclude[]` without explicit user approval. New runtime dependencies remain a design decision to surface in plans/PRs as ordinary engineering discipline, not a security ceremony. The advisory-monitoring backlog item is repurposed from "freeze-lift notification" to standing dependency-security hygiene (daily audit + advisory watch). The PR #64 seven-step safety net is retired; its publish-timestamp check is automated by `min-release-age`.
- Alternatives considered: keeping the freeze until the original lift conditions are met (stalls needed work indefinitely while linkify-it blocks the 7-day-clean condition, and the advisory may stay technically active long after risk has passed); lifting because "attacks have calmed down" (factually wrong and fragile — rejected as the stated basis); keeping the per-install user-approval ceremony (redundant now that the guards are mechanical and lockfile diffs are PR-reviewed).
- Superseded in part by: D-033 changes the npm security monitor cadence from daily to weekly + manual dispatch. `ignore-scripts=true`, `min-release-age=7`, exact installs, and lockfile review remain unchanged.

## D-031
- Decision: Unify list pagination around a real `PAGINATION_MAX_PER_PAGE = 200` constant, while preserving the existing inventory movement / record BIZ `100` reject contract.
- Status: accepted
- Why: Fable runway P1 drift verification found that `PAGINATION_MAX_PER_PAGE` was a docs-only ghost constant. It was introduced by pre-Design-Phase docs-first wording and spread into common / IO / CMD docs without a matching implementation. At decision time the implementation was split: `stocktake_repo::list_stocktake_items` and `system_repo::list_operation_logs` clamped inline with `per_page.min(200)`; `product_repo::search_products` accepted any `per_page >= 1` and only guarded overflow; receiving / return / disposal repository lists used `inventory_common::validate_and_offset`, while `inventory_service::list_receivings` / `list_returns` / `list_disposals` / `list_inventory_records` / `list_movements` rejected `per_page > 100` in BIZ; sales import history lists (`sales_repo::list_csv_imports`, `sales_repo::list_daily_report_imports`) also rejected `per_page > 100`.
- Impact: Implementation PR #140 adds `PAGINATION_MAX_PER_PAGE = 200` to `constants.rs`, replaces the inline `200` clamps in stocktake and system repositories with that constant, and adds an IO-layer `200` clamp to `product_repo::search_products`. Source docs now describe this as implemented behavior rather than a pending follow-up.
- Exception: `inventory_service`'s `MAX_PER_PAGE = 100` reject contract stays as-is for inventory movement / record BIZ lists. Changing it to clamp would add no operator value and would risk breaking existing tests and UI-06c / traceability contracts that already verify the reject behavior.
- Alternatives considered: keeping module-specific pagination behavior and documenting the split permanently; changing the inventory BIZ `100` reject to `200` clamp; documenting `PAGINATION_MAX_PER_PAGE` as if it already existed.

## D-032
- Decision: UI-11b restore uses a forced pre-restore backup, a break-glass exception only when that backup cannot be created, two-step confirmation, post-success full query-cache clear + home transition, and restart guidance for double failure.
- Status: accepted
- Why: Restore has no true Undo: the MNT restore path deletes `.restore_backup` temporary files after success, so the UI must not imply a reversible operation. The operator is a non-IT owner who must be able to complete the flow alone. At the same time, DB-corruption recovery must remain possible when the current state cannot be backed up, so the break-glass checkbox is limited to that failure case.
- Impact: `docs/function-design/68-ui-backup-restore.md` is the UI source doc. Implementation must auto-run `createBackup` before `restoreBackup`, block the normal restore path until that backup succeeds, show checkbox text `今の状態は保存できませんが、復元を続けます` only after pre-backup failure, use a two-step selection + final AlertDialog flow, include the target datetime in the restore button label, call `queryClient.clear()` after success, navigate home, and show success feedback there. A double failure (`restoreBackup` fails and CMD cannot re-establish the DB connection) must show a full-page destructive Alert, disable page operations, and tell the operator to close and reopen the app. Backend restore semantics are unchanged.
- Alternatives considered: making the pre-restore backup only recommended (rejected: it weakens the default data-safety path for the normal case); using three confirmation steps (rejected: more dialogs become ritual and reduce attention rather than safety); requiring app restart after every successful restore (rejected: backend returns a valid new connection on success, so mandatory restart adds operator burden without safety value).

## D-033
- Decision: Move GitHub-hosted CI to completed-HEAD final-only execution and split merge evidence into L0 pre-push, L1 `scripts/local-ci.sh`, and L2 hosted final. Hosted CI uses Ready PR `opened` / `ready_for_review` events plus `workflow_dispatch`, removes `push: main` and synchronize execution, cancels superseded runs, and defaults to one hosted run per change. Pure docs-only R0/R1 changes that do not touch workflow/release contracts use zero hosted runs; eligible non-doc R0/R1 may explicitly use the PR-body `Hosted CI: skip` token only with matching Risk text and a repository-owner Ready event. Workflow/release contract changes require one hosted final even when docs-only, using explicit dispatch when event filtering applies. Manual dispatch always runs all gates, including a zero-diff dispatch on `main`.
- Status: accepted
- Why: 2026-07-10 evidence showed roughly 24 billed minutes for a representative Rust/frontend PR push, repeated PR-wide validation on every follow-up push, duplicate main validation after squash merge, and a 10GB cache ceiling reached by branch-scoped build output. At decision time the owner had disabled CI and deleted Actions caches while the repository migration was reviewed. Free private repository settings do not provide branch protection / required checks, so the design combines exact-HEAD evidence with repo-owned Ready-push blocking instead of assuming a remote merge rule that does not exist.
- Impact: `scripts/ci/classify-changes.sh` becomes the shared classifier and distinguishes Rust, frontend, docs, env, generated, traceability, workflow, and unknown paths, including deletion and both sides of rename/copy. Unknown paths or an indeterminate base route to all gates. Ready-state pushes are rejected by pre-push unless an emergency bypass is recorded. L1 full verifies lockfile installability with `npm ci` and rejects HEAD/tree mutation during the run. `src-tauri/target/` and `~/.cargo/bin/` leave actions/cache; only Cargo registry/index/cache and git DB remain. npm setup-node caching stays unchanged. npm security monitoring becomes weekly + dispatch. At 75% monthly usage R2 defaults to local full; at 90% or Actions unavailability, hosted evidence is deferred except for release/R4 exceptions and the deferral is recorded.
- Relation to D-026: changed-area routing, Rust fmt/clippy/tests/generated-drift separation, aggregate check name, and disk telemetry remain. Per-push / `push: main` execution and build-output caching are superseded.
- Relation to D-030: npm supply-chain guards remain. Only the monitor cadence changes from daily to weekly + manual dispatch.
- Required-check impact: current read-only API checks show no available branch protection/ruleset on the Free private repository. Existing job/check names are retained for compatibility. Before public/Pro migration, required checks must be redesigned around pure docs-only R0/R1 zero-run, the workflow/release docs-only dispatch exception, and final-only events.
- Revisit: on or after 2026-08-01, compare billed minutes, run count, Rust disk telemetry, cache usage, monitor latency, Ready-push bypasses, and exact-HEAD evidence misses. Reconsider Rust job consolidation, aggregate retirement, self-hosted runners, and required checks only from that evidence.
- Alternatives considered: keep every PR push and main push (budget exhaustion); dispatch-only without Ready events (weak normal workflow integration); required checks now (unavailable); keep target cache (capacity recurrence); three job-specific dependency keys (triples cache entries); eliminate hosted CI (loses clean-room evidence); immediately deploy a self-hosted runner (larger security/operations scope); merge Rust jobs without new disk evidence (repeats the D-026 failure mode).

## D-034
- Decision: Make the repository workflow model-neutral: define roles (Coordinator / Plan Reviewer / Writer / Final Reviewer / Explorer / Human Gate) and three availability modes (fable-window / dual-vendor-no-fable / codex-only) in `docs/AGENT_OPERATING_MANUAL.md`; fix one canonical reading order in `AGENTS.md` `Session Start`; add a fixed-Markdown `Workflow State` section to every R2+ Plan Packet with a 13-phase enum; make a Contract Audit (Contract Coverage Ledger, State Lifecycle Matrix, Adjacent Pattern Audit, mutation/anti-tautology, negative-space, manual verification boundary, PR body freshness) the standard R3/R4 independent-review step; and cap sub-agents by risk tier (R0/R1: 0, R2: 0-1, R3: 2, R4/workflow: 3, depth 1, one-writer).
- Status: accepted and implementation slice 1 reflected in PR #163. Skills / templates / `.claude/rules` are implemented; only PK4/PK5/checker/drift-test/hook mechanical enforcement remains follow-up slice 2. slice 2 の対象語彙にD-038新設分を追加（D-038参照）。
- Why: PR #159 showed that design-doc contracts can drop out of both implementation and tests and survive multiple code-reading reviews when the Plan Packet is authored with the implementation commit (2026-07-08 WER; a repeat of a previously corrected incident). Separately, five files carried five different session reading orders, `.claude/rules/review-workflow.md` still described a pre-D-033 review pipeline with a colliding L1/L2 vocabulary, and role assignments were hard-coded to specific models ("Codex 主実装 / Claude レビュー", "Fable exit 後"), so losing any one vendor would stall the documented workflow.
- Impact: `AGENTS.md` owns the reading order (AGENTS → DEV_WORKFLOW → Plans → project-memory → task docs); `DEV_WORKFLOW.md` owns phases, Workflow State, Subagent Budget, and Contract Audit as model-neutral norms; `AGENT_OPERATING_MANUAL.md` owns role/mode mapping with a single model-slot table as the only place concrete model names live; `CLAUDE.md` keeps only Claude-harness specifics; `.agents/skills/*` stay Codex-harness routers that link to the norms instead of restating them. Plan Packets are the tracked per-change state record; D-035 separates their reviewed-content identity from PR-body exact-HEAD merge evidence. Hosted CI execution contract (D-033 final-only, exact-HEAD, Draft-first correction) is unchanged.
- Alternatives considered: YAML frontmatter for Workflow State (rejected: doc checker and templates are Markdown-line based; a future PK4 check reuses the same bash/regex mechanism, and the repo has no frontmatter precedent in docs/); a dedicated `inventory-contract-audit` skill (rejected: a new entrypoint reproduces the reading-order drift problem; the audit is a phase step, so the ledger lives in the Plan Packet, lifecycle/adjacent/mutation checks in the Test Design Matrix template, and the audit procedure in the review packet + `inventory-code-review`); a full state machine with hooks that block all work on phase violations in one PR (rejected: mechanical enforcement is sliced — PK4-style checks and drift tests first, hooks later — because a big-bang gate risks stalling daily work and Codex has no hook support anyway).
- Revisit: after the first dogfood change (next R3 slice) completes its Workflow Effectiveness Review together with the pending D-033 CI dogfood. Revisit resolved in part (2026-07-12): see D-038 and the [WER](archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md).
- Superseded in part by: D-038
- Superseded in part by: D-039

## D-035
- Decision: Separate tracked workflow audit identity from volatile exact-HEAD merge evidence. Replace tracked `Local Full HEAD` with `Reviewed Content HEAD`, add a fixed `Final Exact-HEAD Evidence: PR body` locator, and keep tracked `Hosted CI Requirement` as merge-evidence obligation (`required | not-required`) only. `not-required` does not suppress an eligible Ready event. A later state-only transition commit may point back to the content-bearing commit reviewed by the Final Reviewer. The PR body, not the packet, stores the current PR HEAD's L1 SHA and hosted URL/headSha. Before merge, live PR HEAD, PR-body L1 SHA, and hosted `headSha` (when required) must match; `Reviewed Content HEAD` is excluded. A state-only commit may materialize multiple adjacent forward transitions only when every transition's evidence already exists and the append-only narrative records the full sequence; this compresses recording but never skips a gate. After owner authorization, the `ready-hosted-final` state-only commit is created while Draft, L1 is rerun on that exact HEAD, then Ready/dispatch runs without a further tracked commit.
- Status: accepted, including the adjacent-transition materialization amendment (fresh Plan Gate P1/P2/P3 = 0 in PR #163 follow-up).
- Why: a tracked file cannot contain its own commit SHA. Writing the current HEAD into `Local Full HEAD` creates a new commit and immediately makes the value stale; tracked `human-confirm` / `ready-hosted-final` updates repeat the loop. The split retains offline/idempotent phase resume and audit traceability while leaving volatile exact-HEAD evidence in mutable PR metadata.
- Alternatives considered: move every post-`local-verified` phase to PR metadata (rejected: offline resume and archived packet history would depend on GitHub availability); accept a one-commit-stale `Local Full HEAD` (rejected: weakens D-033 exact-HEAD); rerun and recommit until stable (rejected: a self-referential SHA has no operational fixed point).
- Impact: `docs/DEV_WORKFLOW.md` owns state-only transition, adjacent-transition materialization, and three-point-match semantics. Plan Packet / PR templates and workflow skills mirror the field split and reviewers verify that every materialized intermediate phase had prior evidence. `not-required` never excuses an observed product/gate failure; only infrastructure/cancel outcomes may receive an owner residual-risk disposition. PK4/PK5/checker/hook enforcement remains slice 2; D-033 CI execution, triggers, cache, and final-only behavior are unchanged.
- Revisit: after PR #163 closeout and the UI-11c dogfood WER, check whether state-only transition scope is too broad or PR-body evidence needs mechanical validation. Revisit resolved in part (2026-07-12): see D-038 and the [WER](archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md).
- Superseded in part by: D-038
- Superseded in part by: D-039

## D-036
- Decision: When a CMD module bundles multiple candidate business capabilities under one coarse REQ mapping in the task table (e.g. CMD-11 mapped to REQ-905 in `docs/spec/requirements.md`), test-comment REQ IDs must trace to the REQ that matches the specific behavior under test, not the module's dominant/coarse mapping. Concretely: REQ-902 (`ログ管理（操作ログ記録/一覧/自動削除）`) is confirmed canonical for operation-log record/list/auto-delete across all layers, including CMD-11's `list_logs`. The three existing CMD-layer tests `test_list_logs_req905_pagination` / `test_list_logs_req905_filter` / `test_list_logs_req905_invalid_page_to_cmderror` in `src-tauri/src/cmd/settings_cmd.rs` are traceability drift and must be corrected to `req902` (function name + comment) in the UI-11c implementation PR.
- Status: accepted
- Why: UI-11c Design Phase (2026-07-11) found that `system_repo.rs` (IO layer) already tags log functions (`insert_operation_log`, `list_operation_logs`, `delete_old_logs`) as REQ-902 and settings functions (`get_setting`, `get_all_settings`, `upsert_setting`) as REQ-905 correctly, and `docs/function-design/65-inventory-record-traceability.md` §65.11 already anchors "REQ-902 / TRACE-D3" as the canonical pair for operation-log UI/test semantics. Only the CMD-layer `list_logs` tests inherited REQ-905 by mechanically following the CMD-11 module's overall REQ table mapping, not the behavior under test.
- Impact: `docs/function-design/43-cmd-settings-log.md` §43.12.1 records the specific correction. `docs/function-design/74-ui-operation-logs.md` UI-11c-D12 cites this decision. New UI-11c Rust/frontend tests use REQ-902 (paired with TRACE-D3 where the audit-log-not-authority semantics apply). This does not change REQ-905's own scope (settings CRUD/error conversion) or its existing correctly-tagged tests (`get_settings`, `update_setting`, backup/restore, `save_receipt_image`).
- Alternatives considered: keep REQ-905 as a documented alias for `list_logs` tests (rejected: REQ-905's definition does not include log listing, and an alias would let the CMD-11 coarse mapping keep masking the actual capability under test for future contributors); retag the entire CMD-11 module test suite by capability now (rejected: out of scope for a UI-11c Design Phase that must not edit Rust code; the correction is scoped to the three drifted tests and executed in the next implementation PR).
- Revisit: if a future CMD module again bundles multiple REQs, apply the same per-test-behavior tagging rule before test-comment drift accumulates.

## D-037
- Decision: UI-11c's operation-log date-range filter uses a JST-calendar-day predicate with `start` inclusive and `end` next-day-00:00:00 exclusive (`created_at >= start T00:00:00` / `created_at < (end+1day) T00:00:00`). This is a new, stricter pattern than the existing `date_to + "T23:59:59"` same-day-end approximation used by `list_movements` (`src-tauri/src/db/inventory_repo.rs`) and the `/inventory/records` hub. The existing pattern is not changed retroactively by this decision.
- Status: accepted
- Why: UI-11c Design Phase (2026-07-11) needed an explicit boundary contract for an audit-log screen where date-range correctness matters for troubleshooting. The existing `T23:59:59` pattern is a reasonable practical approximation for business-record filtering but depends on `created_at` never carrying sub-second precision at the boundary instant; the calendar-day inclusive/exclusive form removes that dependency entirely and is simpler to reason about for a from/to range with either side optional.
- Impact: `docs/function-design/20-io-product-repo.md` §2.8 `list_operation_logs` and `docs/function-design/74-ui-operation-logs.md` §74.4 own this predicate. `list_movements` / `list_receivings` / `list_returns` / `list_disposals` / `list_inventory_records` keep their existing `date_to`-inclusive-same-day pattern; no migration or behavior change is made to them by this decision.
- Alternatives considered: retrofitting all existing date-range list commands to the same calendar-day predicate now (rejected: scope creep for a single-screen Design Phase, and the existing pattern has not shown an observed defect in production use); leaving UI-11c's predicate as loose as the existing pattern (rejected: an audit/troubleshooting screen should not inherit an approximation whose correctness assumption is undocumented).
- Revisit: if a boundary-precision defect is observed in `list_movements` or `/inventory/records` in real use, or if a future Design Phase decides to unify all date-range list commands on one predicate, treat this decision as the reference implementation to generalize from.

## D-038
- Decision: Adopt an 8-item workflow procedure change bundle originating from the PR #164 (UI-11c) Workflow Effectiveness Review: (1) retire `AGENT_OPERATING_MANUAL.md` §3's fixed model-role table and replace it with an independence-constraint list (e.g. Writer ≠ Plan Reviewer); (2) Findings Freeze — the finding set freezes once the initial Broad Audit completes; whenever two Contract Audit passes actually run (the mandatory Double Audit on R4/workflow-gate changes, or an R3 change that opted into the Contract Audit section's recommended second pass), both passes together constitute that initial Broad Audit; (3) promote the drift-fix sweep (on first receipt of a drift finding, `rg` the keyword across the whole repository and fix every hit in one commit) into the canonical Contract Audit bullet list; (4) Contract Probe — a minimal pre-Plan-Gate experiment required on R3/R4 plans that rely on an unverified external premise; (5) L3 Eligibility criteria plus retiring the practice of collecting owner hands-on evidence beyond eye confirmation and a PASS/FAIL call; (6) Owner Effort Budget — a default owner-effort ceiling (interventions, hands-on time, relay round-trips) on every R2+ Plan Packet; (7) extend Evidence Ownership (D-035) so test counts, not only exact-HEAD SHAs, are volatile evidence that stays out of tracked docs; (8) cap state-only transition commits at 3 per PR (1 for the plan-approval entry, matching the existing compression rule's canonical example, plus 2 for the required post-implementation transitions in the Workflow State table).
- Status: accepted. D-034 slice 2's future mechanical checks should additionally target this new vocabulary: the presence of an `Owner Effort Budget` section, a Findings Freeze status line, a `Contract Probe` section, and a state-only commit count ≤ 3 (of which ≤2 are post-implementation).
- Why: the [2026-07-12 UI-11c/PR #164 WER](archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md) found a 9-round post-implementation review expansion with no convergence condition; the D5 drift finding survived 3 rounds because the drift-fix sweep discipline lived only in Claude auto-memory and was invisible to the Codex Writer; 9 of PR #164's 20 commits were pure phase-transition or docs-sync commits; 6 of 9 doc-only audit rounds were never visible as GitHub review objects; and the owner was repeatedly drawn into hands-on evidence collection and waiver wording beyond eye confirmation.
- Impact: `docs/DEV_WORKFLOW.md` Review Rules (Findings Freeze), Contract Audit (drift-fix sweep bullet), Plan Packet Rules (Contract Probe), Human Visual Confirmation (L3 Eligibility), the new Owner Effort Budget section, and the Workflow State / D-035 Evidence Ownership extension (state-only commit cap); `docs/AGENT_OPERATING_MANUAL.md` §2-§3; `docs/templates/plan-packet.md` and `docs/templates/workflow-effectiveness-review.md`. The existing 13-phase enum and the exact-HEAD three-point merge match are unchanged by this decision.
- Alternatives considered: keep running a full-scope re-audit every review round (rejected: this is the direct cause of PR #164's 9-round expansion); enforce all of the above immediately via hooks/mechanical checks (deferred: D-034 slice 2 scope); drop the Contract Audit's initial independent pass to save rounds (rejected: reintroduces the PR #159-class contract-drop risk); rename the 13-phase Workflow State enum while redesigning §3 (rejected: reproduces the same ritual under a new name, per owner instruction).
- Revisit: at the next R3/R4 dogfood (UI-13 target) Workflow Effectiveness Review, verify the actual round count under Findings Freeze, the state-only commit count staying ≤ 3 (≤2 post-implementation), and actual owner hands-on time against the Owner Effort Budget.
- Superseded in part by: D-039

## D-039
- Decision: Consolidate the D-034 slice 2 mechanical-enforcement checklist — previously scattered across D-034 Appendix C, D-035, and D-038 — into a single checklist covering plan packet Scope 1-8: PK4 (`## Workflow State` presence, 13-phase enum, Risk/Execution Mode consistency, a Findings Freeze line for R3+, active-packet/`Plans.md` link match, and a plan-approved+ Phase requiring a non-`pending` `Plan Commit`); PK1 extension (`## Owner Effort Budget` required at R2+, `## Contract Probe` required at R3+); PK5 plus the original-Plan-Commit/gated-amendment reconcile model (ancestry via `git merge-base --is-ancestor`, original immutable, amendments recorded append-only); the state-only commit cap (message-regex `^docs\(plans\): state-only遷移` classification, ≤3 total / ≤2 post-implementation by transition-name token); a canonical-reading-order drift test under `scripts/tests/`; deferring the no-active-plan check entirely (it does not exist today even as WARN; introducing it — WARN first, ERROR promotion later — is left to a future slice); conditional adoption of the plan-approved-gate PreToolUse hook (logic verified, `settings.json` runtime integration deferred, scope limited to `src/**` `src-tauri/src/**`); and promoting the PK5 / gated-amendment definitions plus the checker/drift-test vocabulary out of archived Plan Packets into `docs/DEV_WORKFLOW.md` as source of truth.
- Status: accepted. PR #166.
- Why: D-034, D-035, and D-038 each independently referenced the same "PK4/PK5/checker/drift-test/hook" slice 2 follow-up bucket, and the concrete PK5 ancestry/reconcile model was defined only in `docs/archive/plans/2026-07-10-workflow-model-neutral-redesign.md` Appendix C and the [2026-07-11 effectiveness review](archive/plans/2026-07-11-workflow-model-neutral-redesign-effectiveness-review.md), both archived Plan Packets rather than source of truth. This triple reference and archive-only definition matched the exact gap the Design Intent Audit exists to catch: a future reader could not answer "what is PK5" from source docs alone.
- Impact: `docs/DEV_WORKFLOW.md` Workflow State block now defines PK5 ancestry, the gated-amendment reconcile model, the `Amendments` field, the canonical state-only commit subject, and the checker/drift-test vocabulary mapping; Plan Packet Rules' Contract Probe bullet now names example inspected artifacts. `scripts/doc-consistency-check.sh`, `scripts/pre-push.sh`, `scripts/local-ci.sh`, and `scripts/tests/` implement PK4 / the PK1 extension / PK5 / the state-only cap / the drift test per this same Plan Packet's Scope 1-5. Deferred candidates recorded here rather than reopened as new decisions: Evidence Ownership mechanical enforcement (D-038 item 7; ruled N/A for this slice because it is not named in this file's line 282 explicit slice 2 vocabulary list); introduction of the no-active-plan check (WARN first, ERROR promotion later); and whether the fable-window relay-round-trip default (currently ≤2) needs revision.
- Alternatives considered: leave the PK5/gated-amendment definitions in the archived Appendix C and effectiveness review (rejected: repeats the exact archive-dependency gap this decision exists to close); fold this consolidation into D-034 or D-038 by editing their text in place (rejected: this decision log is append-only — past entries are not rewritten; a new entry with forward references is the established pattern, e.g. D-034/D-035 → D-038).
- Revisit: when a future slice takes up Evidence Ownership mechanical enforcement, the no-active-plan check introduction, or the fable-window relay default, treat this checklist as the reference for what slice 2 already covers.

## D-040
- Decision: Publish only a sanitized parentless snapshot in a new repository, and permanently separate public writing from private-history viewing. Build the snapshot in a transient isolated repository created from the candidate archive; only that builder receives the destination as its sole remote, and the source/history-view clone never receives a public push-capable remote. The public writer clone contains only public refs and a public remote. Archive ancestry, archive access, and any local graft exist only in a history-view clone with no public push capability.
- Status: accepted. Phase A prepares the public-safe tree; Phase B remains a separately gated R4 migration.
- Why: preserving the existing object graph or combining archive refs with public push authority creates ordinary refspec leak paths. Even an exact refspec push from a source or mixed clone leaves avoidable old-object/ref exposure at the push-authority boundary. Removing only known files from the latest tree does not make prior commits public-safe, and banning `--mirror` alone does not prevent `--all`, `--tags`, wildcard, or mistaken refspec exposure.
- Impact: [PUBLIC_REPO_MIGRATION.md](PUBLIC_REPO_MIGRATION.md) is the Phase B source of truth. The initial push is limited to `public-init:main` with `--no-tags` from an isolated builder that has no source `.git`, object alternate, old ref, or old object; the destination is its sole remote, and that push authority is removed or the builder is destroyed immediately after the push. The destination is private-first and must pass fresh-clone, builder-isolation, metadata, ref, canary, and repository-surface gates before visibility changes. History continuity uses a local `git replace --graft` only in history-view clones. CI is redesigned before branch protection.
- Alternatives considered: change the current repository visibility in place (rejected: old objects remain reachable); history-filter the existing repository (rejected: broad rewrite risk and unnecessary exposure surface); keep one mixed clone and rely on operator discipline (rejected: push authority and archive refs remain co-located); defer development until hosted minutes recover or purchase additional capacity (owner rejected due time and cost constraints).
- Revisit: only if a later owner decision changes the publication goal. Do not relax clone-role separation or initial-push restrictions as an incidental workflow convenience.

## D-041
- Decision: Separate Phase B's private workflow control plane from its initial public payload. The active R4 Packet, Matrix, approvals, and detailed audit evidence remain in the owner-retained source repository; neither the active control branch nor its artifacts may be the parentless-root archive source. The parentless public root contains only a fixed sanitized source-baseline payload plus explicitly approved public governance files. Before mutation, pass the independent Plan Gate and obtain the owner R4 approval. After the private-first push creates an actual immutable final-root candidate, run two independent Contract Audit passes and bind them to one audit epoch: source baseline, final root, destination generation, approved surface state, and `H1`/`H2` hashes. Freeze the initial finding set as soon as both passes finish. Closure-only review is valid only while every epoch identity remains unchanged; any identity change requires new A/B broad passes and a new Freeze. Track the source baseline SHA and final parentless root SHA separately, and make the final root authoritative for every privacy, archive, fresh-clone, and repository-surface check.
- Status: accepted as the Phase B execution-contract clarification to D-040. The runbook-design hardening is R3 and performs no repository or GitHub mutation; the later migration execution remains R4.
- Why: a plan-first Packet in the source history cannot also exist in a one-commit parentless initial history without breaking either ancestry evidence or the one-commit gate. A Contract Audit performed before a destination candidate exists cannot inspect the object graph or repository surfaces it is supposed to approve. Treating the source baseline and final root as one SHA also leaves governance-file and commit-metadata changes outside the stated scan authority.
- Impact: `docs/PUBLIC_REPO_MIGRATION.md` defines the control-plane/payload split, the `Plan Gate -> private candidate -> Double Audit -> Findings Freeze/closure -> visibility` sequence, the source-baseline/final-root equivalence allowlist, isolated Git configuration/hooks/filters, an immutable pre-push `H1` plus `H1`-referencing post-push `H2` private evidence chain retained for both audits, pre-creation inherited-access checks, a second actual-empty-destination access/automation/surface query sealed into `H1` before any payload push, exact public-closeout/dashboard pre-push review, and just-in-time owner approvals for private push, visibility, and development-remote cutover. Every post-push candidate failure deletes and recreates the entire destination under fresh approval. Proven source-baseline content failure also invalidates the baseline and returns to the gated plan; extraction/builder/governance/destination failure may keep a proven-clean baseline; uncertain provenance stops at design/plan-gate. Force push, branch deletion, ref replacement, repair commits, and in-place destination correction are forbidden. After public visibility there is no disclosure rollback: changing visibility back, revoking access, and disabling features are containment only, followed by the incident route and a new fully gated snapshot if republishing.
- Hosted evidence: the closed exception routes live in `docs/ci.md`. The current R3 design change uses the non-release Budget Pressure route; Phase B execution separately uses the public-repository bootstrap R4 route while destination Actions is disabled and source hosted allocation is unavailable. Phase B compensating evidence is the immutable final-root fresh clone local full, privacy/public-surface gates, and both independent Contract Audit passes plus closure. Both routes require owner disposition; local product or gate failures remain blockers, and other release/R4/workflow executable changes remain `required`. This is the narrow successor to D-033's earlier absolute workflow/release hosted-required wording; `docs/DEV_WORKFLOW.md` and `docs/ci.md` now delegate only these two unavailable-hosted cases to this closed routing instead of leaving conflicting general rules.
- Owner gates: before execution, approve destination ownership/name/metadata and inherited-access boundary, public commit identity/signature, LICENSE/SECURITY/CONTRIBUTING policy, private/post-public Security & Analysis state, hosted-evidence exception, and the R4 contract. During the success path, separately approve the private-first push, visibility change, and development-remote cutover immediately before each action. Any failed candidate exhausts that four-intervention success budget and requires an amended effort budget before an additional destructive approval.
- Alternatives considered: place the active Packet in the initial public root (rejected: it cannot preserve its private plan-first ancestry and may disclose control evidence); finish both audits before repository creation (rejected: no real candidate or surface exists); repair a failed private destination in place (rejected: rejected objects or metadata may remain); call a post-public private flip rollback (rejected: it cannot retract prior copies).
- Revisit: only through a new R4 plan that proves an equally strong structural separation and public-surface audit. Do not weaken this contract to reduce owner approval count or preserve a failed destination.

## D-042
- Decision: Harden the Phase B execution evidence and mutation boundary before Plan Gate. Add an immutable post-candidate `H3` stage that binds the final-root fresh clone, local-full result, live private surface ledger, and exact `H1`/`H2` hashes; bind Double Audit and Findings Freeze to `H1`/`H2`/`H3`. Treat the root commit's complete raw header/message, not only its subject, as a closed public metadata contract. Model repository observation as `E0` empty-private, `E1` frozen private candidate, `E2` just-public before closeout, and `E3` public after the allowlisted closeout commit. Require a fifth migration-specific just-in-time approval for the exact public closeout push; normal private control-PR Ready and merge remain separate workflow Human Gates.
- Status: accepted during the Phase B R4 Design Phase, before the plan-first execution commit and before any destination mutation.
- Why: independent execution-plan exploration found four gaps that could otherwise create stale or unauthorised public evidence: post-push fresh-clone/live-surface results were outside the `H1`/`H2` integrity chain; a subject-only commit check could miss a body, trailer, co-author, unknown header, signature, or time-zone drift; the closeout push adds new public bytes after visibility but had no explicit just-in-time approval; and a new history-view clone had no closed way to obtain the public-init object without gaining a public remote. The two-state private/public model also became false after closeout because `E3` intentionally contains a second commit.
- Impact: [PUBLIC_REPO_MIGRATION.md](PUBLIC_REPO_MIGRATION.md) now defines `H3`, the four observation epochs, a raw-commit allowlist, exact-closeout-push approval, local-bundle acquisition of public-init for history-view clones, and `docs/PROJECT_HANDOFF.md` plus a local-only inventory as the Windows role-record targets. The Phase B success path budgets five migration mutation approvals (contract/create, initial push, visibility, cutover, exact closeout push) plus the normal Ready and merge gates. GitHub Actions remains disabled through `E3`; the public ledger expects dependency graph and automatic public secret scanning while every optional analyzer/update/PR generator remains off unless a separately reviewed platform-forced state is approved.
- Alternatives considered: append fresh-clone/live-surface facts to `H2` after sealing (rejected: breaks immutability); leave those facts outside the hash chain (rejected: auditors cannot prove which result set they reviewed); reuse cutover approval for a later unknown closeout commit (rejected: not just-in-time or exact-target); add a public fetch remote to history-view and remove it later (rejected: creates avoidable mixed-role authority); continue calling the whole public lifecycle one invariant (rejected: one-commit topology is correct only for `E1`/`E2`).
- Revisit: after Phase B closeout WER, decide whether generic R4 templates need `H3`/epoch/gated-public-closeout fields. Do not generalize from this one migration before execution evidence exists.

## D-045
- Decision: Preserve the task goal when adjudicating irreversible-publication findings. Failure means either the fixed candidate contains or exposes non-public information, the candidate or intended mutation cannot be revalidated safely before disclosure, or an irreversible mutation lacks current owner authorization. Evidence quality supports those decisions but is not a separate deliverable. A missing historical receipt does not reject an unchanged candidate when a non-destructive fresh-clone check can re-establish its tree, topology, privacy, and product-gate state. Before deletion, recreation, or another destructive repair, name the plausible disclosure path and run the cheapest non-destructive counterfactual check. The Owner Effort Budget is a hard stop: when likely to be exceeded, stop evidence expansion and return to the goal's minimal sufficient completion condition.
- Status: accepted during Phase B execution after goal drift was detected; this decision governs adjudication of D-041/D-042 evidence requirements while D-040 clone-role separation remains unchanged. The migration and first public hosted CI green are complete.
- Why: execution optimized proof-chain integrity until a defect in historical evidence was treated as a defect in an unchanged candidate. That classification could have justified destructive rework without changing candidate bytes or reducing demonstrated disclosure risk, while leaving the actual goal—public hosted CI—outside the immediate completion route.
- Impact: irreversible-task findings state `actual harm path / affected candidate or mutation / non-destructive revalidation / blocker reason`. Evidence-only defects are recorded in a WER or follow-up and cannot by themselves trigger destructive repair. Completion conditions include the user-visible goal, not only the migration mechanism. Generic workflow/template/skill enforcement remains a separately reviewed R3 change.
- Alternatives considered: reconstruct every historical receipt (rejected: no candidate safety gain); delete and recreate the destination (rejected: no candidate-specific disclosure path); drop all publication checks (rejected: tree, topology, privacy, product gates, and immediate authorization remain necessary); add only a broad reminder (rejected: the missing control is a concrete adjudication and budget-stop rule).
- Revisit: if publication becomes subject to a legal, regulatory, or third-party audit whose deliverable is the evidence chain itself, create a separately scoped plan and budget. Do not silently convert that audit goal into a blocker for ordinary development publication.
