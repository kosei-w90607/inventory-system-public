---
name: review-only-subagent
description: "Run or prepare a review-only sub-agent pass before PR/external review. Use by default for R3, required for R4, optional for tricky R2 changes."
---

# Review-only Sub-agent Skill

## Purpose

Create and use a review-only packet so a separate context can review the change before external PR review.

## Required Reading

- `docs/project-profile.md`
- `docs/templates/subagent-review-packet.md`
- Plan Packet
- Test Design Matrix if present
- changed files / diff
- relevant specs
- relevant tests
- validation claims

## Steps

1. Build Review Packet from template.
2. Include Risk, Contract ID, critical contracts, non-scope, changed files, validation claims.
3. Include Test Design Matrix summary if available.
4. Include Plan Packet `Impact Review Lenses` when present. If the task involves field investigation, real-device confirmation, external tool behavior, POS/register integration, CSV/TSV/report formats, operator workflow discoveries, or source-design assumption changes, use `docs/DEV_WORKFLOW.md` as the canonical lens list and include the applicable lenses in the review packet.
5. Instruct sub-agent:
   - review only
   - no edits
   - findings first
   - validation is claim
   - Impact Review Lenses are review prompts, not standalone product facts
6. Receive findings.
7. Classify findings:
   - accepted
   - rejected
   - deferred
   - question
8. Verify each finding independently.
9. Re-run relevant gates after accepted fixes.

## Rules

- Sub-agent edits or fix claims are untrusted suggestions.
- P1/P2 cannot be accepted or rejected without evidence.
- Do not turn scope-out improvements into blockers.
- Do not treat a missing or non-applicable Impact Review Lens as a finding unless it hides a concrete contract, data-safety, test, evidence, manual-verification, or replacement-path risk.
