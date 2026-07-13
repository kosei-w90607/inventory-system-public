# Source of Truth

## Generic Hierarchy

```text
1. specs / contracts
   Current normative behavior.

2. ADRs
   Why durable decisions were made.

3. archived plans
   Task-local evidence and execution record.

4. dashboard / roadmap
   Current status, next actions, lightweight links.

5. memory / reminders
   AI operation lessons only. Not product/process contract.
```

## Rules

- Current behavior belongs in specs.
- Why a decision was made belongs in ADR.
- Task-local evidence belongs in archived plan.
- Dashboard should not become the source of product truth.
- Memory should not hold product/process contracts.

## Conflict Handling

If active plan proposes behavior that differs from current spec:

- Before merge: spec represents current behavior; active plan may propose change.
- Same PR must update spec if accepted behavior changes.
- After merge: spec must reflect accepted behavior.
- Archive plan is evidence, not normative behavior.
