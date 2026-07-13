---
name: inventory-implementation
description: "Implement scoped inventory-system tasks by following the canonical `AGENTS.md` `Session Start` entry and repository workflow; preserve UI->CMD->BIZ->IO/MNT boundaries; use TDD and requirement/spec IDs; run Rust/frontend/docs gates; keep POS/store data and secrets out of commits; update source-of-truth docs when behavior changes; and finish with risk-tier review. Use for inventory code, docs, workflow, UI, Tauri, SQLite, POS CSV, PLU, report, and implementation follow-up work. Do not use for review-only requests."
---

# Inventory Implementation

## Overview

Use this skill as the working mode for implementation in `inventory-system`. It routes Codex through the project workflow, source documents, gates, and data safety rules.

Start from the canonical reading order in `AGENTS.md` `Session Start`, then load only the source documents needed for the current task.

## Workflow

1. Establish scope.
   - Follow `AGENTS.md` `Session Start`; do not restate its order here.
   - Identify whether the task changes implementation, source-of-truth docs, generated bindings, workflow gates, or only local scaffolding.
   - Inspect `git status --short --branch` before editing. Do not mix unrelated user changes into the task.

2. Load the smallest source set.
   - Architecture or layer boundary: `docs/ARCHITECTURE.md` and relevant `docs/architecture/` file.
   - Function behavior, DTOs, errors: `docs/FUNCTION_DESIGN.md` and relevant `docs/function-design/` file.
   - SQLite schema or persistence: `docs/DB_DESIGN.md` and relevant `docs/db-design/` file.
   - UI behavior: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, and relevant UI function design.
   - Workflow/review: `docs/project-profile.md`, `docs/DEV_WORKFLOW.md`, `docs/code_review.md`.
   - Confirm Design Phase is complete for R2+ work: source design docs are cited as sufficient or updated in the same PR.

3. Implement with TDD when behavior changes.
   - Use exploration -> Red -> Green -> Refactor when practical.
   - Keep CMD thin and business rules in BIZ.
   - If the Plan Packet contains unresolved design questions or durable design decisions not present in source docs, stop implementation and update design docs first.
   - Do not weaken, skip, or delete existing tests to make a change pass.
   - Attach REQ, SP, UI, CMD, BIZ, IO, MNT, design decision IDs, or design section IDs to tests when applicable.

4. Preserve generated contracts.
   - For Tauri command, Rust DTO, or binding changes, run `cd src-tauri && cargo run --bin generate_bindings` and inspect `src/lib/bindings.ts`.
   - Do not hand-edit generated bindings except for an explicitly documented post-generation cleanup.

5. Preserve data safety.
   - Do not read or commit `.env*`, credentials, keys, certificates, `auth.json`, real POS CSV, PLU exports, DB files, backups, logs, receipt images, or store-specific sales/cost data.
   - Keep local app data, real register files, and generated logs under ignored/local-only paths.
   - Use synthetic fixtures for tests.

6. Verify before finalizing.
   - Run targeted tests first.
   - During implementation iteration, run `bash scripts/local-ci.sh changed` after targeted checks. This PR-wide changed gate is distinct from L0 pre-push, where `scripts/pre-push.sh` checks the push increment.
   - At the completed content candidate HEAD, run L1 `bash scripts/local-ci.sh full`; the run must start and end CLEAN and its evidence SHA must match that HEAD. Record the SHA in the PR body, not in tracked Workflow State.
   - Keep the PR Draft while implementation, review, L3, or owner checks are pending. After Final Review P1/P2 = 0, use the D-035 state-only commit to record `Reviewed Content HEAD` and `human-confirm`, then rerun L1 on that resulting exact HEAD and refresh the PR body.
   - After owner Ready authorization, create the Draft `ready-hosted-final` state-only commit first, rerun L1 on that resulting HEAD, refresh the PR body, and only then let the owner trigger Ready / required dispatch. Do not commit the L1 SHA or hosted URL back into the packet. L2 must match that exact PR HEAD.
   - If a Ready PR needs a correction, return it to Draft and the Workflow State to `implementing`, then repeat L1 and the owner Ready/L2 path on the new HEAD.
   - Follow `docs/ci.md` `Risk Routing` for hosted classification. Pure docs R0/R1 uses event-filtered 0-run; eligible non-docs R0/R1 may use the documented `Hosted CI: skip` procedure. `Hosted CI Requirement: not-required` removes the merge-evidence obligation but does not suppress an eligible Ready event. Any observed product/gate failure returns to Draft/implementing; only infrastructure/cancel outcomes on a not-required route may receive an owner residual-risk disposition. Workflow/release changes require one hosted final even when docs-only. R2+ never use the R0/R1 skip token.
   - For docs/workflow changes, run `bash scripts/doc-consistency-check.sh` and `bash scripts/doc-consistency-check.sh --target plan`.

7. Review before PR.
   - Apply `docs/code_review.md` and `docs/quality/review-checklist.md`.
   - For R3 changes, run a review-only sub-agent pass by default, or record `Review-only skipped because:` in the Plan Packet or PR body.
   - For R4 changes, do not skip review-only and do not perform destructive actions without explicit human approval.
   - Verify every review-only finding independently before fixing, rejecting, or deferring.

8. Publish a Draft PR checkpoint when the first implementation pass is complete.
   - Follow `docs/DEV_WORKFLOW.md` `Draft PR Checkpoint`.
   - After planned code/docs/tests/generated artifacts are in place, relevant automated gates have passed or blockers are recorded, and R3/R4 review-only is complete or explicitly skipped, create a Draft PR unless the user asks to keep the work local.
   - Keep the PR Draft while Windows native L3, human visual confirmation, or owner manual checks remain pending.
   - Record pending manual checks, validation, review-only result, and dashboard/archive follow-up in the PR body and `Plans.md`.
   - Do not mark Ready or merge without explicit owner direction.

## Plan-first Rule

For R2+, apply `docs/DEV_WORKFLOW.md` `Plan Packet Rules` and `Workflow State` as the normative contract. Codex-specific procedure: select the active packet from `Plans.md`, verify its Phase is `plan-approved` or `implementing`, verify `Plan Commit` is not `pending` and predates implementation, then update Phase to `implementing` before writing. If one state-only commit materializes `plan-gate -> plan-approved -> implementing`, verify that the independent P1/P2 = 0 verdict and plan-first SHA both predate that commit and that its append-only narrative records the full adjacent sequence. Fail closed and return to the owner on malformed state, packet ambiguity, unresolved design questions, or a missing Plan Gate; do not repair or approve the plan silently. R0/R1 follow the Risk table's targeted route directly and do not require an active packet, Workflow State, or Plan Commit.

## Completion Contract

Finish with:

- changed files summary
- verification commands and results
- review-only sub-agent result for R3/R4 changes, or skipped reason for R3
- Draft PR link after Verify + Review when the branch is ready for external review / Windows native L3 / owner handoff, unless the user explicitly keeps it local
- data/secret safety statement when relevant
- docs or `Plans.md` updates when source-of-truth state changed
- residual risks or skipped checks
- for R2+, tracked Workflow State and PR metadata updated under D-035: state-only file + zero-context hunk audit, `Reviewed Content HEAD` for audit traceability, final exact-HEAD evidence only in the PR body, and PR/Draft/Ready state synchronized; R0/R1 have no state-update obligation

Do not expand the current task just because nearby cleanup is visible.
