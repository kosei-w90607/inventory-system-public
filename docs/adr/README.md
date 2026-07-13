# ADR Index

New durable architecture decisions should use [../templates/adr.md](../templates/adr.md) and live in this directory.

## Existing Decision Records

The project already has ADR-like records under `docs/research/`. They remain valid and are linked here instead of moved in this workflow retrofit.

| Decision | Existing record |
|---|---|
| Router selection | [../research/2026-04-20-router-adr.md](../research/2026-04-20-router-adr.md) |
| Invoke type generation | [../research/2026-04-20-invoke-type-adr.md](../research/2026-04-20-invoke-type-adr.md) |
| Invoke wrapper | [../research/2026-04-20-invoke-wrapper-adr.md](../research/2026-04-20-invoke-wrapper-adr.md) |
| Query cache strategy | [../research/2026-04-20-query-cache-adr.md](../research/2026-04-20-query-cache-adr.md) |

## Rules

- Create a new ADR when a decision changes architecture, workflow gates, data safety, UI framework direction, command wire shape, persistence strategy, or external integration policy.
- Do not move existing research ADRs as part of unrelated implementation work.
- If a research ADR is promoted later, keep redirects or links so old plan evidence remains readable.
- Reference ADRs from Plan Packets and source docs when a change depends on the decision.
