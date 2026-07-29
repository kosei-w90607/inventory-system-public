# Test Design Matrix: PK3 negative-glob false WARN correction

## Risk

Risk: R2

## Contracts Under Test

- valid token detection in `tests` / `src` / `src-tauri`
- gitignore-preserving missing-token WARN
- WARN-only exit 0
- two-file scope

## Failure Modes

- broken negative glob reintroduced
- one search root or token regex lost
- ignored paths searched
- WARN suppressed or promoted to failure
- PK4 fixture regression

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| C1 helper shape | syntax-equivalent negative glob returns | CLI fixture / PATH rg shim argv capture | helper-scoped all-negated-glob guard | `tests src src-tauri`呼出しの`--glob PATTERN` / `--glob=PATTERN` / `-g PATTERN` / `-gPATTERN` patternがsource上の引用符を問わず`!`で始まる |
| C2 three roots | root/regex drift | CLI fixture | valid token canaries | any real token is missed |
| C3 ignore behavior | ignored subtree searched | CLI fixture | ignored-only missing token | `--no-ignore` or equivalent is added |
| C4 WARN exit | severity drift | CLI fixture | missing WARN exit0 | WARN branch exits nonzero |
| C5 PK4 regression | collateral checker edit | regression | existing fixture suite | Workflow State checks drift |

## State Lifecycle Matrix

not applicable — checker reads a synthetic tree once and holds no runtime/persisted state.

## Adjacent Pattern Audit

| Pattern | Sites inspected | Ported sites | Exclusions | Evidence |
|---|---|---|---|---|
| rg path exclusion | `test_token_exists` + repo ignore policy | helper only | other checker searches have different contracts | helper-scoped diff |

## Negative Paths

- token absent
- token only under ignored target/node_modules/dist
- malformed packet handled by existing suite

## Boundary Checks

- quoted `it("token")`, shell/Rust `test token`, three roots
- zero vs one missing WARN
- exit 0 with WARN

## Compatibility Checks

- regex、root順、stderr suppression、WARN text、PK4 unchanged

## Data Safety Checks

- temp synthetic tree only
- cleanup by existing trap
- no local repository mutation outside test process

## Main Wiring / Integration Checks

- actual copied checker runs against synthetic packet
- local-ci workflow suite still invokes the fixture

## Mutation-style Adequacy Questions

- copied checkerへ`--glob '!x'` / `--glob="!x"` / `--glob=!x` / `-g '!x'` / `-g!x`を各々再導入: rg shimのruntime argv guard red
- remove each root or break regex: valid canary red
- add `--no-ignore`: ignored-only case red
- suppress WARN / exit 1: exact WARN or exit assertion red

## Residual Test Gaps

- historical rg 15.1 implementation bug itself is not reproduced; desired repository behavior is the oracle
