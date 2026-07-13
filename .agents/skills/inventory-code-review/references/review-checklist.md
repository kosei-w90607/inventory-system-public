# Review Checklist

## 1. Architecture Boundaries

- UI writes no business logic that belongs in BIZ.
- UI does not access IO directly.
- CMD remains a thin adapter.
- BIZ owns transaction boundaries.
- IO does not silently embed business rules.

## 2. Design Alignment

- Public behavior matches `docs/FUNCTION_DESIGN.md`.
- Data access assumptions match `docs/DB_DESIGN.md`.
- New code does not bypass documented validation rules.
- Error mapping is consistent across layers.

## 3. Persistence and Schema

- SQL and repositories reflect current schema names and constraints.
- CHECK / enum assumptions are not duplicated inconsistently.
- Migration-related code does not drift from declared schema direction.
- Reads and writes preserve documented invariants.

## 4. Error Handling

- Validation errors are distinct from internal failures.
- Not-found, duplicate, and internal errors are not collapsed into one bucket too early.
- User-facing command responses do not leak low-level DB details unnecessarily.

## 5. Tests

- Tests exist for the changed behavior.
- Tests cover the primary success path.
- Tests cover key failure modes or edge cases.
- Test names make the intended behavior clear.
- Tests prove the code actually follows the design, not just that it compiles.

## 6. Practical Risks

- Hidden coupling between layers
- Missing verification after non-trivial refactor
- Partial fixes that leave a known edge case unresolved
- Changes that would be hard to maintain or reason about later
