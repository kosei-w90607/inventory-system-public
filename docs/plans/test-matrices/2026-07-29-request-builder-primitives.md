# Test Design Matrix: request builder shared primitives

## Risk

Risk: R2

## Contracts Under Test

- prefixed idempotency key
- local calendar date
- strict safe integer parser
- four consumer ownership and unchanged request behavior

## Failure Modes

- UUID/fallback shape or prefix drift
- UTC/date padding drift
- exponent/decimal/unsafe/min boundary acceptance
- one consumer retaining local copy or wrong min
- generated traceability omission

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| C1 UUID key | prefix/UUID/fallback drift | unit | request helper key cases | branch or separator changes |
| C2 local date | UTC/month/pad drift | unit | local date cases | calendar output changes |
| C3 safe integer | grammar/range/min drift | unit | integer table | exponent/unsafe/min-1 passes |
| C4 four consumers | local copy/wrong prefix | static + regression | ownership guard + existing suites | import/body/prefix drifts |
| C5 request behavior | DTO/error/signature drift | regression | 4 existing families | extraction changes output |
| C6 traceability | REQ mapping missing | generated CLI | generate_traceability check | new file is unregistered |

## State Lifecycle Matrix

| Subject | Initial | Success | Failure | Retry | Evidence |
|---|---|---|---|---|---|
| idempotency key | Page state creates key | same-content retry retains key | command failure retains existing lifecycle | edit/reset rotates in Page | existing Page tests |
| form request | strings | validated DTO | errors + null request | edit/resubmit | request tests |

## Adjacent Pattern Audit

| Pattern | Sites inspected | Ported sites | Exclusions | Evidence |
|---|---|---|---|---|
| three duplicated primitives | receiving/manual-sale/disposal/return | all four | other date/number helpers differ in meaning | exact 4-file guard |

## Negative Paths

- crypto.randomUUID unavailable
- blank/decimal/negative/scientific/unsafe integer
- min-1 for min 0 and 1
- invalid builder-specific fields remain feature-owned

## Boundary Checks

- Date month/day padding and year string
- Number 0,1,MAX_SAFE_INTEGER,MAX_SAFE_INTEGER+1
- whitespace trim; ASCII digits only
- exact four prefixes

## Compatibility Checks

- DTO fields/order/null semantics/signature/error text unchanged
- same-content retry and edit/reset rotation unchanged

## Data Safety Checks

- generated output: only 90-traceability
- secrets/local-only data: none

## Main Wiring / Integration Checks

- all four request files import/call the shared helper
- Pages continue through feature wrappers without edits
- generated matrix contains new helper test under REQ-201..204

## Mutation-style Adequacy Questions

- remove crypto branch or prefix: key test red
- use UTC getter/remove month+1/padding: date test red
- allow exponent/unsafe integer or change `>=` to `>`: parser test red
- restore one local body/change one min: ownership or existing regression red

## Residual Test Gaps

- browser crypto quality is unchanged and not re-evaluated
