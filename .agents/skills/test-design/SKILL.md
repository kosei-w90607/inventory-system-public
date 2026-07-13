---
name: test-design
description: "Design effective tests before implementation. Use for R2+ behavior changes, and especially R3/R4 changes that affect schema, config, runtime behavior, output, policy, metrics, or data safety."
---

# Test Design Skill

## Purpose

Create a Test Design Matrix before implementation so tests are tied to contracts and failure modes.

## Required Reading

- `docs/project-profile.md`
- source design docs cited by the Plan Packet's `Design Sources`
- Plan Packet `Design Readiness`
- Plan Packet `Design Intent Trace`
- Plan Packet
- relevant specs / contracts
- relevant existing tests
- data safety rules

## Steps

1. Extract Risk Level.
2. Extract contracts under test from source design docs first, then the Plan Packet.
3. Extract design decision IDs and source doc sections that the tests should protect.
4. List failure modes.
5. Classify needed tests:
   - contract
   - negative/fail-fast
   - boundary
   - state/policy
   - compatibility/schema
   - main wiring/integration
   - data safety
   - regression
6. Create Test Design Matrix.
7. Propose Red tests.
8. Add mutation-style adequacy questions.
9. List residual test gaps.

## Output

Use `docs/templates/test-design-matrix.md`.

## Rules

- Do not write implementation code unless explicitly asked.
- Do not invent behavior from the Plan Packet when source design docs are missing or ambiguous; return the work to Design Phase or record the design gap.
- Do not optimize for test count; optimize for test effectiveness.
- Prefer tests that cite spec IDs, design decision IDs, or source doc sections when the touched area has traceability.
- Every important test should state what broken implementation it catches.
- For accepted P1/P2 fixes, prefer adding a regression test.
