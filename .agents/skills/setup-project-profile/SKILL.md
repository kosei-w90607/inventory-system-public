---
name: setup-project-profile
description: "Create or refresh docs/project-profile.md so the AI Quality Workflow Pack can adapt to a specific repository. Use when introducing the workflow to a new repo or when project outputs, risk boundaries, or quality commands have changed."
---

# Setup Project Profile Skill

## Purpose

Create a project-specific profile that maps the common workflow to this repo.

## Inputs

Read, when available:

- README
- docs
- specs
- ADRs
- plans / roadmap
- package files
- scripts
- tests
- config samples
- gitignore
- CI or pre-push scripts

## Steps

1. Identify project type.
2. Identify outputs and artifacts.
3. Identify stable contracts.
4. Identify high-risk changes.
5. Identify data safety boundaries.
6. Identify test/lint/type/doc commands.
7. Identify source-of-truth hierarchy.
8. Fill `docs/templates/project-profile.md`.
9. Write or propose `docs/project-profile.md`.
10. List Open Questions for human confirmation.

## Output

```md
## Project Profile Draft
## Findings / Assumptions
## Open Questions
## Suggested Follow-up
```

## Rules

- Do not invent commands. Mark unknown commands as Open Questions.
- Keep project-specific terms in `docs/project-profile.md`, not common core docs.
- Do not add machine enforcement during setup.
