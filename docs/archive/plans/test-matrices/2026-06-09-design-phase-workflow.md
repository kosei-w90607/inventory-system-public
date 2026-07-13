# Test Design Matrix: Design Phase Workflow Addition

## Scope

Workflow-only R3 change that adds an explicit Design Phase before Plan Packet / implementation.

## Matrix

| Risk / Contract | Positive check | Negative check | Evidence |
|---|---|---|---|
| Workflow phase order | `DEV_WORKFLOW.md` contains `Spec Check -> Design -> Plan -> Implement` order. | Old flow `Kickoff -> 1. Plan -> 2. Implement` is not left as the canonical flow. | `rg -n "Spec Check|Design|Kickoff -> 1\\. Plan" docs/DEV_WORKFLOW.md` |
| Design source-of-truth | Plan Packet template asks for design source docs and design readiness. | Plan Packet is not described as durable design source of truth. | `docs/templates/plan-packet.md`, `docs/DEV_WORKFLOW.md` |
| Design artifact selection | Workflow maps upcoming backend, DB, UI, wire, format, and durable decision changes to required source design artifacts before Plan. | Required design artifacts are not left to unstated reviewer/operator intuition. | `docs/DEV_WORKFLOW.md`, `docs/templates/plan-packet.md` |
| Design intent traceability | Plan Packet template asks for spec IDs, source design sections, design decision IDs, implementation targets, and test targets. | Durable rationale is not allowed to live only in Plan Packet or author summary. | `docs/templates/plan-packet.md`, `docs/DEV_WORKFLOW.md`, `docs/code_review.md` |
| Business-app design depth | Design Phase checklist covers layer ownership, backend function design, command/data contracts, persistence safety, operator workflow, error/retry/recovery, and testability. | Design readiness is not limited to a vague UI-only or "looks designed" claim. | `docs/DEV_WORKFLOW.md`, `docs/templates/plan-packet.md` |
| R3/R4 gate | Workflow says R3/R4 must document design readiness before implementation. | R0/R1 are not forced into heavy design artifacts. | `docs/DEV_WORKFLOW.md`, `docs/project-profile.md` |
| Review drift coverage | Review docs / subagent packet mention source design docs. | Review-only does not rely only on author summary or Plan Packet. | `docs/code_review.md`, `docs/templates/subagent-review-packet.md` |
| Skill routing | Kickoff / implementation skills check design readiness. | Generic implementation path does not bypass inventory design source docs. | `.agents/skills/inventory-workflow-start/SKILL.md`, `.agents/skills/inventory-implementation/SKILL.md` |
| Docs integrity | Full docs check passes. | Markdown links and active Plan Packet checks do not break. | `bash scripts/doc-consistency-check.sh`, `bash scripts/doc-consistency-check.sh --target plan` |
| Data safety | Changed files are docs/workflow only. | No `src/`, `src-tauri/`, DB, POS, log, backup, receipt, or secret files are touched. | `git diff --name-only main..HEAD`, `git status --short` |
