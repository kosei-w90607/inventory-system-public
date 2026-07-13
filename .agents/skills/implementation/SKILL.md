---
name: implementation
description: "Generic implementation workflow for AI-assisted projects using Project Profile, Plan Packet, Test Design Matrix, and review-only sub-agent gates."
---

# Implementation Skill

## Required Reading

- `docs/project-profile.md`
- `docs/ai-workflow/core.md`
- relevant Plan Packet
- relevant specs / ADRs
- relevant tests

## Workflow

1. Confirm scope and Risk Level.
2. For R2+, use Plan Packet.
3. For R3/R4, create or read Test Design Matrix before implementation.
4. Write Red tests where practical.
5. Implement.
6. Run targeted gates.
7. Run full gates as required by Risk Level.
8. For R3/R4, run review-only sub-agent by default/requirement.
9. Verify findings.
10. Fix accepted findings.
11. Re-run relevant gates.
12. Prepare PR review packet.
13. For R3/R4 or workflow changes, run Workflow Effectiveness Review after review/merge.

## Rules

- Do not rely on self-review alone for R3/R4.
- Do not treat AI validation as fact.
- Do not commit source-derived data or secrets.
- Do not silently widen scope.
