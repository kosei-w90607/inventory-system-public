# Test Design Matrix: Public repository Phase A sanitization

## Risk

Risk: R3

## Contracts Under Test

- `PUB-A-01/02`: local-only sources are absent from the candidate tree but retained locally until the owner gate.
- `PUB-A-03`: source-derived narratives are public-safe without losing product meaning.
- `PUB-A-04/11`: every real-cost canary is absent and synthetic replacement preserves behavior.
- `PUB-A-05/06`: all 40 requirement IDs resolve through the public composite SSOT.
- `PUB-A-07/08`: archive identity is not linked or disclosed, while history references remain interpretable.
- `PUB-A-09/12`: tracked process artifacts and independent review do not reintroduce private information.
- `PUB-A-10`: owner-approved public fields remain unchanged.
- `PUB-A-13`: the diff stays within Phase A and all local gates pass.

## Failure Modes

- A missing or empty local manifest is treated as a successful zero-finding scan.
- The checker prints a canary literal or the real manifest path to stdout/stderr.
- The checker scans the working tree or the wrong commit rather than the fixed candidate SHA.
- A local-only source remains in the commit tree, or a physical local copy is removed too early.
- The coverage ledger has a missing, duplicate, or extra ID, or a row without a public definition/status.
- A ledger row has a plausible file and status but its public summary, responsibility, or replacement reason disagrees with the source design.
- REQ-403 / SP-403 POS department reconciliation is conflated with REQ-904 / UI-13 inventory integrity.
- A live source link still depends on the untracked input; a local working copy masks the dangling link.
- An archive evidence reference is incorrectly rewritten as current public history.
- A legacy complete URL remains or a private identifier is introduced into a new artifact.
- Fixture and expected value change together so a tautological test misses backend arithmetic/import, frontend cost propagation/rendering, or doc-example drift.
- The privacy scan finds only known canaries and overlooks another class of source-derived detail.
- An owner-approved schema/JAN/path/username is changed during mechanical replacement.
- Phase B mutation, local file deletion, or hosted-CI policy work enters the Phase A diff.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| PUB-A-01 | local-only input tracked | data safety | TDS-PUB-A-01 candidate tree exclusion | either excluded source appears in `git ls-tree` or clean archive |
| PUB-A-02 | copy lost or ignore policy advertises it | manual + regression | TDS-PUB-A-02 retention and ignore boundary | owner hash gate is absent, physical source is removed, or `.gitignore` changes |
| PUB-A-03 | abstraction leaks or loses meaning | review | TDS-PUB-A-03 narrative abstraction audit | concrete source facts remain or operational constraints disappear |
| PUB-A-04 | canary remains / scanner leaks | CLI + regression | TDS-PUB-A-04 fail-closed candidate scanner | any record matches a regular-file or symlink-target blob, input is empty, wrong SHA is accepted, readlink/search fails open, or output contains an input token/path |
| PUB-A-05 | requirements structural drift | CLI + docs | TDS-PUB-A-05A 40-ID structural check | the ledger set differs, duplicates exist, a target is unresolved, enum is invalid, or a non-current reason is empty |
| PUB-A-05 | requirements semantic drift | independent contract audit | TDS-PUB-A-05B 40-row semantic source audit | any public summary, target responsibility, status, or reason disagrees with its source; evidence is ID/status/pass-fail only |
| PUB-A-05 | similar contracts conflated | docs + contract audit | TDS-PUB-A-05C REQ-403/REQ-904 separation sweep | any live source assigns POS department reconciliation to UI-13/BIZ-07 or assigns inventory integrity to REQ-403 |
| PUB-A-06 | dangling live source | integration | TDS-PUB-A-06 clean archive doc consistency | docs only pass while the untracked working copy is present |
| PUB-A-07 | complete archive URL remains | data safety | TDS-PUB-A-07 legacy URL zero scan | any forbidden complete URL pattern exists at candidate SHA |
| PUB-A-08 | boundary contract unsafe/incomplete | docs + review | TDS-PUB-A-08 boundary note contract | note exposes an identity, lacks date semantics, or allows graft in public writer clone |
| PUB-A-09 | tracked artifact reintroduces data | data safety | TDS-PUB-A-09 public-safe artifact scan | Packet, Matrix, runbook, plans, or evidence contains a forbidden literal/class |
| PUB-A-10 | allowed fields drift | diff audit | TDS-PUB-A-10 adjudicated-field no-diff | an explicitly allowed schema/JAN/path/username changes |
| PUB-A-11 | backend arithmetic/import becomes tautological | Rust unit + mutation | TDS-PUB-A-11A independent backend oracle | `test_complete_req205_total_cost_multiple_products` no longer proves a multi-row quantity×cost sum, or `test_parse_csv_req104_all_fields_present` no longer proves the parsed cost token; a temporary operator/field mutation must make the targeted test red |
| PUB-A-11 | frontend propagation/rendering becomes tautological | Vitest + mutation | TDS-PUB-A-11B independent frontend oracle | `receiving-row-utils.test.ts` “adds a new product row with quantity 1 and product cost” or `OtherRecordDetailPages.test.tsx` / `DisposalRecordDetailPage.test.tsx` cost-total cases stop deriving output from distinct input rows; temporarily bypassing propagation or summing only one row must make the targeted test red |
| PUB-A-11 | doc replacement hides non-cost drift or a canary | CLI + mutation | TDS-PUB-A-11C doc example invariant | non-cost text changes outside adjudicated abstraction/URL/reference lines, or inserting a dummy forbidden canary into a temporary candidate does not make the candidate checker red |
| PUB-A-12 | unknown privacy class missed | independent review | TDS-PUB-A-12 negative-space candidate audit | reviewer finds source-specific or personally identifying data outside known canaries |
| PUB-A-13 | scope/gate violation | CLI | TDS-PUB-A-13 scope diff and full gate | diff contains Phase B mutation/deletion or any required local gate fails |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Phase A candidate | mixed private working tree | implementation commit fixed | candidate SHA scans and local full pass | any content commit | inspect new SHA | independent review | return to implementing | finding/error blocks | fix, new SHA, rerun all candidate checks | PR body status-only evidence |
| local-only sources | tracked and present | untracked, still physically present | absent from candidate tree and owner copies hash-match | missing copy/hash | owner rechecks copies | Phase B go/no-go | restore from verified copy | loss/mismatch blocks merge | recopy and rehash | owner confirmation only |
| content candidate -> human-confirm | implementing | local-verified -> independent-review | state-only human-confirm commit after P1/P2=0 | content fix | rerun L1 and review | reviewer re-audit | implementing | finding returns to implementing | fix then full re-review | Packet state + PR evidence |
| owner authorization -> Ready | human-confirm | Draft state-only Ready commit | exact-HEAD L1 then PR-body evidence then Ready/dispatch | any tracked commit | rerun exact-HEAD L1 | merge three-point check | implementing | mismatch/failure blocks | repair and re-review | PR metadata owns exact SHA |
| state-only integrity | transition commit | filename and zero-context hunks inspected | only Workflow State/allowed evidence changes | scope/AC/design/test hunk | inspect diff | PK4/STATECAP | implementing | violation fails closed | content commit + required review | checker output |
| hosted not-required | local evidence ready | optional hosted event may exist | no hosted evidence required | observed product/gate failure | inspect run | owner may disposition infrastructure/cancel only | implementing for product failure | product failure blocks | fix and rerun locally | PR body reason/omitted gate |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| local-only artifact guards | env-safety checker, doc checker, existing local-ci composition | generic public-candidate checker and tests | no secret-management changes | TDS-PUB-A-04/09 |
| requirements traceability | all 40 private-source IDs, spec inventory, function/architecture design IDs, test comments | requirements coverage ledger and REQ-403/REQ-904 source split | archived packets remain historical | TDS-PUB-A-05A/05B/05C/06 |
| history reference notation | tracked complete URLs and bare PR/issue/SHA references | non-link archive notation + boundary note | archive docs are not mechanically rewritten except complete URL removal required by candidate safety | TDS-PUB-A-07/08 |
| synthetic example values | function docs, mockup, backend/frontend fixtures and assertions | all canary-matching candidate sites | owner-approved JAN/product names remain | TDS-PUB-A-04/10/11 |

## Negative Paths

- missing input: missing/empty manifest and missing candidate SHA fail closed.
- invalid input: malformed record or unresolvable SHA fails without echoing input.
- tracked symlink: its link-target blob is scanned without following the link; a target match or readlink error fails closed without echoing the target or path.
- duplicate/ambiguous input: duplicate requirement ID or canary record is rejected or normalized with explicit count-only status.
- unknown reference: live doc reference to an absent local-only source fails in clean archive.
- dependency missing: unavailable archive/search/hash tool fails the check; no silent skip.
- permission/write failure: local exclude update failure blocks untrack completion; owner-copy write is outside agent scope.
- dry-run side effect: scanner and probes must not alter index, refs, working files, remotes, or GitHub state.

## Boundary Checks

- threshold: expected privacy finding count is exactly zero.
- null/default: no default empty manifest; absence is error.
- empty/non-empty: manifest and coverage ledger must be non-empty; source ID cardinality is fixed at 40.
- min/max: every manifest record is evaluated exactly once; no truncated scan.
- status/policy enum: requirement rows use `current / partial / deferred / superseded` only and every non-current row has a reason. Expected groups are pinned in the Plan Contract Coverage Ledger.
- wire type: local manifest text and immutable candidate SHA.
- internal type: opaque records; no logging representation.
- producer/consumer: owner/local preparation -> generic checker.
- round-trip token: status and exit code only.
- precision/range: exact ID set comparison; canary records use tab-separated fixed-string conjunctions whose fields must occur in the same tracked blob, including symlink-target blobs.
- cross-language parse: not applicable.

## Compatibility Checks

- old schema/input: runtime inputs and DB schema unchanged.
- new schema/input: no new application input.
- output order: fixture and report order unchanged.
- optional field behavior: unchanged.
- archive compatibility: old PR/issue/SHA references remain interpretable through boundary convention.

## Data Safety Checks

- source-derived data: candidate tree and all new docs audited; raw source remains local-only.
- generated outputs: build/test artifacts are not added to Git.
- secrets: existing env safety plus negative-space review; no credential reads.
- local-only files: absent from candidate archive, present locally until Human Gate/Phase B gate.
- synthetic sample boundaries: replacement values are visibly artificial and do not reproduce any local canary pair.

## Main Wiring / Integration Checks

- helper connected to main path: generic checker has regression tests and is invoked against candidate SHA before human-confirm.
- output reaches manifest/report: only status summary reaches PR body; detailed output remains local-only.
- effective config reaches runtime: not applicable.
- CLI arg reaches implementation: candidate SHA and local manifest are validated before scan.
- dashboard wiring: `Plans.md` links Packet, Matrix, and public migration runbook.

## Mutation-style Adequacy Questions

- Backend oracle: `test_complete_req205_total_cost_multiple_products` derives a multi-row total from distinct quantity/cost inputs; temporary multiplication/operator mutation must fail it. Import oracle: `test_parse_csv_req104_all_fields_present` must fail when cost-field extraction is temporarily redirected/defaulted.
- Frontend oracle: receiving row propagation and receiving/disposal detail total tests use distinct input rows and assert the rendered/forwarded result; a temporary one-row/bypass mutation must fail.
- Doc oracle: a non-cost diff allowlist plus candidate canary scanner protects narrative examples; inserting a dummy forbidden canary in a temporary candidate must fail without logging the token.
- If the checker treats an empty manifest as zero findings, does TDS-PUB-A-04 fail?
- If the checker scans `HEAD` instead of the supplied candidate SHA, does a wrong-SHA fixture fail?
- TDS-PUB-A-05A fails on structural row drift; TDS-PUB-A-05B independently reads all 40 source mappings and fails on a plausible but semantically wrong target/status/reason; TDS-PUB-A-05C fails on REQ-403/REQ-904 conflation.
- If a local working copy masks a dangling Markdown link, does the clean archive test fail?
- If one complete legacy URL survives in an archived or active doc, does TDS-PUB-A-07 inspect the entire candidate tree?
- If the runbook includes a real path or copied scan log, do the public-safe artifact scan and independent reviewer both catch it?
- If public and archive remotes coexist in one writer clone, does the boundary contract review reject it even if `--mirror` is absent?
- If a state-only commit edits Scope/AC, do hunk inspection and PK4 return to implementing?
- If an incidental hosted job reports a product failure, does the lifecycle route block owner disposition?

## Residual Test Gaps

- Unknown sensitive data cannot be proven absent by finite canaries alone. A fresh independent reviewer must inspect the candidate tree by data classes and source provenance before owner authorization.
- GitHub visibility surfaces and orphan snapshot metadata are Phase B R4 gates, not executable in Phase A.
- The owner backup copy/hash is an external human prerequisite and is recorded as confirmation, never as a real path or hash in tracked artifacts.
