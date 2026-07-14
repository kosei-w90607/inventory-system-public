---
name: workflow-effectiveness-review
description: "Evaluate whether the AI workflow actually worked after an R3/R4 PR or workflow change. Use to improve Design Phase, Plan Packet, Test Design Matrix, sub-agent review, and gate design."
---

# Workflow Effectiveness Review Skill

## Purpose

Evaluate the effectiveness of the workflow used for a change.

## Required Reading

When available:

- Plan Packet
- Design Sources and Design Readiness evidence
- source design docs updated or cited by the PR
- Test Design Matrix
- sub-agent review results
- external review results
- PR body
- accepted/rejected/deferred findings
- tests added
- validation results
- final diff

## Steps

1. Identify workflow steps used.
2. Identify whether Design Phase caught or prevented design drift before Plan / implementation.
3. Identify issues caught before implementation.
4. Identify issues caught by tests.
5. Identify issues caught by sub-agent.
6. Identify issues caught by external review.
7. Identify late/escaped issues.
8. Evaluate design adequacy: whether source docs carried durable design and Plan Packet stayed implementation-scoped.
9. Evaluate test adequacy.
10. Evaluate signal/noise.
11. Evaluate cost/friction.
12. Recommend workflow adjustments.
13. Identify at least one rule/check/artifact to retire or consolidate; if none, explain why net rule growth is justified.
14. Apply actionable adjustments to the relevant workflow docs, templates, Skills, or PR evidence in the same PR when the change is small and well-supported.
15. If an adjustment is not applied immediately, record why and name the follow-up target.

## Output

Use `docs/templates/workflow-effectiveness-review.md`.

## Rules

- Do not praise workflow because it exists; evaluate actual evidence.
- Prefer concrete examples over generic process advice.
- Do not recommend machine enforcement until the benefit is demonstrated.
- Treat Design Phase as effective only when it improves source design docs, prevents implementation from starting on ambiguous design, or reduces review/test rework.
- A Workflow Effectiveness Review is not done when it only recommends improvements. It is done when actionable lessons are either applied or explicitly deferred with a concrete follow-up target.
