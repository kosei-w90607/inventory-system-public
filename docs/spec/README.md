# Spec Index

This directory is the workflow-facing spec index for inventory-system. It does not duplicate product truth. The current source documents remain authoritative.

## Current Source Documents

| Area | Source |
|---|---|
| Requirements inventory | [requirements.md](requirements.md) |
| Requirements coverage | [requirements-coverage.md](requirements-coverage.md) |
| REQ inventory for traceability | [requirements.md](requirements.md) |
| Architecture and task IDs | [../ARCHITECTURE.md](../ARCHITECTURE.md), `docs/architecture/` |
| Function contracts and DTOs | [../FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md), `docs/function-design/` |
| SQLite schema and persistence | [../DB_DESIGN.md](../DB_DESIGN.md), `docs/db-design/` |
| Screen behavior | [../SCREEN_DESIGN.md](../SCREEN_DESIGN.md) |
| UI technology and visual rules | [../UI_TECH_STACK.md](../UI_TECH_STACK.md) |
| Development workflow | [../DEV_WORKFLOW.md](../DEV_WORKFLOW.md) |

## Promotion Rules

- Put durable product behavior in the relevant source document, not in `Plans.md`.
- Put task-local evidence in `docs/plans/` while active, then move it to `docs/archive/plans/`.
- Put durable implementation decisions in [../adr/README.md](../adr/README.md) using [../templates/adr.md](../templates/adr.md).
- Use this directory for future split spec files only when a source document becomes too large or when a stable contract needs its own home.
- Do not copy full sections from existing design docs into this index. Link to the source instead.

## Contract Labels

Plan Packets may use existing requirement and design IDs directly:

- `REQ-*`, `SP-*`, and `QR-*` from [requirements-coverage.md](requirements-coverage.md) and the linked screen/function docs.
- `UI-*`, `CMD-*`, `BIZ-*`, `IO-*`, and `MNT-*` from architecture/function design.
- DB table and column names from DB design when the contract is schema-level.

When no existing ID fits a workflow-only contract, use a short `WF-*` label in the Plan Packet and promote it later if it becomes durable.
