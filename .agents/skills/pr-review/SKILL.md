---
name: pr-review
description: "Prepare or perform an external-style PR review using findings-first P1/P2/P3 output. Use for PR/diff review, not implementation."
---

# PR Review Skill

## Required Reading

- PR diff
- PR body
- Plan Packet
- relevant specs
- relevant tests
- docs touched
- project-profile
- validation claims

## Review Focus

- contract compliance
- runtime/config/schema/output compatibility
- negative/fail-fast behavior
- test adequacy
- data safety
- docs/spec drift
- scope creep
- verification gaps

## Output

```md
## Findings
- P1/P2/P3 order

## Open Questions
## Merge / Split Judgment
## Verification Gaps
## Review Notes
## Review Summary
```

## Rules

- Treat validation as claim.
- P1/P2 require concrete evidence.
- Do not block on style or explicit non-scope.
