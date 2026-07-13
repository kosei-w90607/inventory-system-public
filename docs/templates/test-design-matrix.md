# Test Design Matrix

## Risk

Risk: <R2|R3|R4>

## Contracts Under Test

- <contract>

## Failure Modes

- <failure mode>

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| <contract> | <failure mode> | unit / integration / CLI / schema / data safety / regression | <test name> | <what broken implementation this catches> |

## State Lifecycle Matrix

Required when the change has UI, data, cache, route/search, import/export, retry, or persisted state. Use `not applicable` with a reason only when the change has no state lifecycle.

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |

For workflow-state changes, add explicit rows for:

- content candidate -> L1 / independent review -> state-only human-confirm commit
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit
- state-only violation: inspect both the file allowlist and `git diff --unified=0` hunks; changes to Scope, AC, Design, contracts, instructions, skills, templates, tests, workflow code, or generated artifacts return to implementing
- hosted-not-required incidental failure: product/gate failure returns to implementing; only infrastructure/cancel may receive recorded owner disposition

## Adjacent Pattern Audit

Enumerate every site of each borrowed pattern; do not sample only the nearest file. Patterns include IME composition, Enter handling, focus order, formatter, query invalidation, error-kind mapping, route/search state, and accessibility.

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
|  |  |  |  |  |

## Negative Paths

- missing input:
- invalid input:
- duplicate/ambiguous input:
- unknown reference:
- dependency missing:
- permission/write failure:
- dry-run side effect:

## Boundary Checks

- threshold:
- null/default:
- empty/non-empty:
- min/max:
- status/policy enum:
- wire type:
- internal type:
- producer/consumer:
- round-trip token:
- precision/range:
- cross-language parse:

## Compatibility Checks

- old schema/input:
- new schema/input:
- output order:
- optional field behavior:

## Data Safety Checks

- source-derived data:
- generated outputs:
- secrets:
- local-only files:
- synthetic sample boundaries:

## Main Wiring / Integration Checks

- helper connected to main path:
- output reaches manifest/report:
- effective config reaches runtime:
- CLI arg reaches implementation:

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant?
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct?
- If a key branch is inverted, which test fails?
- If a threshold comparison changes, which test fails?
- If a guard is removed, which test fails?
- If an output field is omitted, which test fails?
- If tracked Workflow State stores the current PR HEAD, does a state commit make it stale immediately? The accepted design must keep current exact-HEAD evidence in PR metadata.
- If a hosted URL/headSha is committed after the run, does the merge three-point check fail because PR HEAD changed?
- If a state-only commit edits Scope/AC in the same packet file, does hunk-level review reject it even though the filename is allowlisted?
- If output order changes, which test fails?
- If dry-run performs a side effect, which test fails?
- If a JSON number crosses JavaScript safe integer range, which test fails?
- If a state token is round-tripped through browser/client code, which test fails?

## Residual Test Gaps

- <gap>
