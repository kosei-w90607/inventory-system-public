# Source Map

## By Review Target

### UI or screen behavior

Read:
- `AGENTS.md`
- `docs/DEV_WORKFLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/SCREEN_DESIGN.md`
- `docs/FUNCTION_DESIGN.md` if UI behavior depends on a command contract

### Tauri command layer

Read:
- `AGENTS.md`
- `docs/DEV_WORKFLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/FUNCTION_DESIGN.md`

Focus on:
- thin adapter behavior
- error normalization
- no business logic leakage

### Business logic layer

Read:
- `AGENTS.md`
- `docs/DEV_WORKFLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/FUNCTION_DESIGN.md`
- `docs/DB_DESIGN.md` if persistence behavior is involved

Focus on:
- workflow correctness
- transaction boundaries
- validation and error mapping

### Repository / database layer

Read:
- `AGENTS.md`
- `docs/DEV_WORKFLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/DB_DESIGN.md`
- `docs/FUNCTION_DESIGN.md` if repository behavior supports a documented service contract

Focus on:
- schema alignment
- constraint handling
- query correctness
- migration drift
