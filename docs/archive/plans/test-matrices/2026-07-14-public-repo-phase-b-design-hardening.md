# Test Design Matrix: Public repository Phase B runbook design hardening

## Risk

Risk: R3

## Contracts Under Test

- `PUB-BD-01`: active private workflow control artifacts do not enter the initial public payload.
- `PUB-BD-02`: Double Audit inspects the actual private candidate before visibility, and Findings Freeze starts after both broad passes regardless of count, before closure.
- `PUB-BD-03`: source baseline and final root have separate authority and a closed equivalence delta.
- `PUB-BD-04`: source-derived failure invalidates the baseline; every post-push rejected destination is deleted and recreated regardless of provenance instead of repaired in place.
- `PUB-BD-05`: post-public failure uses containment/incident response and never promises rollback.
- `PUB-BD-06`: current R3 Budget Pressure and future Phase B R4 bootstrap use separate closed `not-required` routes; all other R4/release/workflow executable changes stay required.
- `PUB-BD-07`: builder Git execution sources and sealed audit evidence, Git objects, inherited access, Security & Analysis, repository metadata/features, actual closeout content, unauthenticated surfaces, clone roles, and owner gates are covered.
- `PUB-BD-08`: the design slice is plan-first, docs-only, public-safe, and gate-green.

## Failure Modes

- The active R4 Packet or detailed control evidence is copied into the parentless root.
- Both Contract Audits are declared complete before a private destination candidate exists.
- Findings Freeze waits for P1/P2=0 instead of freezing the two-pass initial finding set and entering closure, or an old Freeze is reused after the source baseline, final root, destination generation, approved surface state, or `H1`/`H2` chain changes.
- A scan passes on the source baseline while an unscanned governance addition contaminates the final root.
- A system/global/includeIf config, init template/hook, hooksPath, line-ending/filter setting, signing default, credential helper, or URL rewrite executes inside the builder.
- An unexpected tree difference is accepted because the allowlist is implicit or open-ended.
- A source-derived failure reuses the invalid baseline or retains an already-pushed destination, or another rejected private destination is force-pushed, branch-deleted, or patched, leaving old objects or surfaces.
- A visibility flip back to private is described as undoing a disclosure.
- Actions runs during migration or hosted green is required even though Actions is deliberately disabled.
- A generic unavailable-hosted claim weakens release/R4 policy, or the current R3 design route is confused with the future destination-disabled bootstrap.
- Local full is run against a different SHA than the final root.
- Tree scans pass while inherited collaborators/teams/apps/automation, Security & Analysis jobs/notifications/PRs, commit identity, refs, hooks, secrets, variables, environments, Discussions, Wiki, Projects, Actions caches, deployments, Pages, packages, or unauthenticated metadata expose information.
- Namespace preflight passes, but the actual empty destination gains an unapproved principal, app, automation, rule, feature, or analyzer setting before the first payload push.
- A public writer obtains archive objects/remotes, or a history-view clone obtains public push authority.
- A destination mutation occurs during this design-only slice.
- A tracked plan or review artifact records a private identifier, path, identity, literal, or detailed log.
- A public closeout record accepts arbitrary fields or copies private control evidence, or the same closeout commit leaves `Plans.md` saying Phase B is still pending.
- The builder is destroyed before A/B can independently verify its configuration, tree comparison, push boundary, and credential revocation, or post-push facts are appended after the pre-push seal and invalidate its hash.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| PUB-BD-01 | control artifact in payload | docs + data safety | TDS-PUB-BD-01 control/payload separation audit | the runbook permits active Packet/Matrix/approvals/audit logs in the initial root or lacks a public-safe closeout replacement |
| PUB-BD-02 | audit/freeze order or authority wrong | lifecycle contract | TDS-PUB-BD-02 actual-candidate audit, epoch, and freeze order | Double Audit precedes private candidate inspection, Freeze waits for zero findings rather than both broad passes, an epoch identity changes without new A/B broad passes and Freeze, closure is omitted, or visibility precedes closure/revalidation |
| PUB-BD-03 | wrong SHA or open delta | data safety + contract | TDS-PUB-BD-03 dual-authority and equivalence audit | source/final SHAs are conflated, final-root scans are missing, or tree differences outside an explicit owner allowlist can pass |
| PUB-BD-04 | wrong failure authority/rejected objects retained | recovery contract | TDS-PUB-BD-04 baseline invalidation and private recreate-only audit | a source-derived failure reuses its baseline or preserves an already-pushed destination, or force push, branch deletion, ref replacement, or repair commit is allowed after another private failure |
| PUB-BD-05 | false rollback | incident contract | TDS-PUB-BD-05 public containment audit | changing visibility back is said to retract disclosure, or republish can skip a new R4 snapshot gate |
| PUB-BD-06 | unavailable/unsafe or overbroad hosted gate | workflow contract | TDS-PUB-BD-06 closed hosted exceptions audit | current R3 and future R4 routes are conflated, another release/R4/workflow executable change can use them, owner disposition is absent, or exact-candidate compensation is incomplete |
| PUB-BD-07 | inherited executable config or omitted exposure surface | coverage audit | TDS-PUB-BD-07 builder/public-surface ledger closure | any builder isolation or surface-ledger row below has no explicit runbook or future-R4 evidence owner |
| PUB-BD-07 | owner approval reused | workflow contract | TDS-PUB-BD-07B just-in-time gate audit | initial approval is treated as authorization for push, visibility, or remote cutover without a separate immediate gate |
| PUB-BD-07 | arbitrary/unreviewed public closeout | schema + data safety | TDS-PUB-BD-07C exact cutover-record/dashboard pre-push gate | actual `docs/PUBLIC_REPO_CUTOVER.md` can include a field outside the schema, a FAIL field, or private evidence; `Plans.md` stays stale; or either file can be pushed without schema/status/privacy/docs/independent review |
| PUB-BD-08 | docs-only/public-safe violation | CLI + diff + review | TDS-PUB-BD-08 scope and public-safety gate | diff contains non-doc mutation, docs gate fails, or a prohibited artifact class appears |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| R3 design hardening | plan-draft | independent Plan Gate | plan-approved docs contract | content finding | re-read source docs | final independent review | return to design/plan-draft | P1/P2 blocks | fix and re-review | Packet state + docs checks |
| R4 control plane | archived R3 contract | active private Packet/Matrix | Plan Gate + owner R4 approval | plan amendment | re-run Plan Gate | before each mutation | plan-gate | missing approval blocks | amend plan first | private control evidence |
| source baseline | accepted sanitized commit with zero active control artifacts | archive export | fixed baseline payload | any source content change | create new archive | equivalence comparison | select new baseline | missing/dirty authority blocks; delete an already-pushed destination | new Packet amendment | private SHA record |
| transient builder/final root | clean config/env and no repository | extracted payload + governance | one parentless final root + immutable pre-push `H1` / post-push `H2` hash chain under closed config allowlist | unexpected config/hook/filter/diff/ref/object, post-seal mutation, or unsealable evidence | A/B verify H1/H2 hashes/cross-reference and root/archive | before push H1; after push/revocation/destruction H2 | destroy/rebuild | any mismatch/evidence gap blocks | recreate builder | integrity-protected private chain |
| private destination candidate | empty private repository | JIT-approved explicit push | fresh-clone/surface gates green | any candidate/surface failure | query fresh clone/API | Double Audit A/B | delete whole destination | keep private and stop | owner-approved recreate only | private control evidence |
| Findings Freeze/closure | no real candidate | audit A and B on one fixed epoch: baseline/root/destination/surface-state/H1/H2 | both broad passes finish -> finding set frozen -> P1/P2 closure zero | any epoch identity change | new A/B broad passes and new Freeze on the replacement candidate | immediately before visibility | candidate stage | frozen finding blocks | closure-only only while all epoch identities stay fixed; otherwise recreate route | two broad reports + closure |
| public exposure | private and gated | JIT visibility approval | unauthenticated verification green | post-public finding | re-query public surfaces | incident route | no rollback state | contain and escalate | new sanitized R4 snapshot | minimal incident evidence |
| development cutover | old source remains history-view | JIT remote-cutover approval | new public writer only | role/remotes mixed | inspect refs/remotes/replace | Windows clone assignment | recreate correct clone | mixed authority blocks | fresh clone | role inventory |
| control PR/public closeout | cutover complete | exact closeout record plus public-safe `Plans.md` completion/next-action sync committed only in public writer, not pushed | Packet/Matrix archived privately; schema-valid PASS-only closeout and non-stale dashboard pushed after privacy/docs/independent review | missing/extra/FAIL/private field or stale Phase B action | inspect exact commit | WER/closeout | reopen control work | disclosure/review gap blocks push | fix and re-review exact content | public-safe allowlisted fields only |
| hosted exception | source unavailable / destination disabled only on matching closed route | current exact-HEAD or final-root compensation | owner disposition + compensation complete | product/gate failure or route mismatch | rerun/reclassify | before Ready/visibility | required route or candidate stage | local failure blocks | fix/re-audit | `ci.md` route + PR body |

## Public Surface Ledger

The failure-route column below governs checks performed before the first payload push. Once any candidate bytes have been pushed, every private-candidate mismatch on any row requires owner-approved deletion and recreation of the entire destination plus a new audit epoch; removing, correcting, or re-auditing an in-place destination is forbidden. After public visibility, the containment/incident route governs instead.

| Surface | Required state before public visibility | Future R4 evidence owner | Pre-push failure route |
|---|---|---|---|
| builder process environment | empty temporary home/config, system config disabled, no inherited Git configuration variables | Coordinator + Final Reviewer | destroy/recreate builder |
| effective Git config origins | closed local allowlist only; no include, URL rewrite, credential, filter, or executable config | Final Reviewer | destroy/recreate builder |
| init templates/hooks | empty template and hooks path; no executable hook | Final Reviewer | destroy/recreate builder |
| line ending/filters/tree equivalence | conversion off; no clean/smudge/process filter or LFS/gitlink dependency; mode/bytes preserved except governance allowlist | Final Reviewer | invalidate baseline or recreate builder |
| signing and identity | explicit approved author/committer and signature state; no inherited signing | owner + Final Reviewer | recreate builder/destination |
| push authentication | JIT least-privilege one-push authority; no URL/config/argument/trace/output persistence; revoked immediately | owner + Coordinator | revoke, destroy builder, and stop |
| sealed builder evidence chain | immutable `H1` contains pre-push authorities/config/env/hooks/filters/attrs/signing/tree/refs/objects/remote/refspec/credential controls plus actual empty-destination comparison; immutable `H2` contains push/revocation/destruction results and the exact H1 hash; both hashes retained through cutover | Contract Audit A + B | missing/mutable/mismatched stage or cross-reference stops before push or forces the post-push global recreate route |
| owner namespace inheritance | before repository creation, no unapproved base permission, collaborator/team, app, webhook, ruleset, or creation automation can reach a new private repository | owner + Coordinator | choose isolated namespace or stop |
| actual empty destination | after creation and before credential injection/push, actual principals, permissions, apps/webhooks/automation, rulesets, metadata/features, Actions/Security & Analysis, and empty surfaces exactly match the approved baseline | owner + Coordinator | unavailable query or mismatch stops before push; choose a new namespace/destination and re-query |
| final commit tree/archive | only approved public payload; privacy scan zero | Coordinator + Final Reviewer | recreate builder/destination |
| commit topology | one commit, zero parents, one main branch | Coordinator | recreate destination |
| author/committer metadata | approved public name/noreply/date/signature/subject | owner + Coordinator | recreate builder/destination |
| refs and reflog-like namespaces | no tag, replace, stash, remote, note, or unexpected ref | Final Reviewer | recreate destination |
| objects/alternates/fsck | no old, alternate, unreachable, or unexpected object | Final Reviewer | recreate destination |
| submodule/LFS/external object dependency | none unless explicitly owner-approved and independently public-safe | Plan Reviewer + Final Reviewer | stop and redesign/recreate |
| repository relationship | standalone; no fork/import/template lineage | owner + Coordinator | recreate destination |
| repository metadata | approved public name, description, homepage, topics, visibility, default branch, relationship, and feature toggles | owner | correct before push, then repeat the complete empty-destination query |
| issues/PRs/releases/discussions | absent before visibility unless explicitly approved in R4 plan | Coordinator | delete/recreate if migration residue exists |
| Actions/runs/artifacts/caches | Actions disabled; none created | Coordinator | delete/recreate if residue cannot be proven absent |
| dependency graph/SBOM | approved private state before push and approved forced/optional public state; no unexpected output | owner + Coordinator | stop before push or recreate/contain after processing |
| Dependabot | alerts, security updates, version updates, generated PRs, logs, and notifications match the approved private/public ledger | owner + Coordinator | stop before push and correct only through a newly verified empty destination |
| code scanning | default setup/config/results/alerts absent unless explicitly approved | owner + Coordinator | stop before push and correct only through a newly verified empty destination |
| secret scanning | scanning, push protection, partner notification, alerts/logs match approved state and platform-forced behavior | owner + Coordinator | stop before push and correct only through a newly verified empty destination |
| vulnerability/security policy | private vulnerability reporting, advisories, and organization security policy inheritance match approved state | owner + Coordinator | stop before push and correct only through a newly verified empty destination |
| Pages/packages/deployments | disabled/absent | Coordinator | delete/recreate if residue exists |
| Wiki/Projects | disabled/absent unless explicitly approved public-safe state | owner + Coordinator | disable before push and repeat the complete empty-destination query |
| collaborators/teams/webhooks/deploy keys/apps | absent unless explicit public-safe allowlist | owner | revoke/remove before push and repeat the complete empty-destination query |
| secrets/variables/environments | absent | owner | revoke/delete before push and repeat the complete empty-destination query |
| rulesets/branch protection | no inherited/unexpected rules; later CI R3 owns final policy | owner + Coordinator | correct before push and repeat the complete empty-destination query |
| unauthenticated web/API view | only approved public metadata and final root visible | independent reviewer | containment + incident route after public |
| fresh public clone | only destination remote/public refs; no graft/archive objects | Final Reviewer | discard and reclone; incident if source exposed |
| history-view clone | archive access allowed; no public push-capable remote | owner + Final Reviewer | remove authority and re-audit |
| transient builder | destination was sole remote; push authority removed or builder destroyed | Coordinator | stop before visibility |
| public closeout evidence | exact PASS-only allowlisted record and public-safe non-stale `Plans.md` pass schema/status/privacy/docs and independent review before push | Final Reviewer | block push; fix and re-review exact commit |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| plan-first/PK5 lifecycle | `DEV_WORKFLOW.md`, current Packet template, Phase A archived Packet | private Phase B control Packet only | initial public payload excluded because its root is parentless | TDS-PUB-BD-01/02 |
| D-040 clone separation | runbook persistent roles, builder, cutover, graft | D-041 control-plane split and cutover route | no mixed convenience clone | TDS-PUB-BD-07 ledger |
| hosted-not-required route | `DEV_WORKFLOW.md`, `ci.md` Budget Pressure, Phase A disposition pattern | current R3 outage route + future Phase B bootstrap exact-final-root compensation | all other release/R4/workflow executable changes remain required; product failures never dispositioned | TDS-PUB-BD-06 |
| fail-closed publication | Phase A public-safe rule, Phase B go/no-go | private recreate and public containment routes | no in-place candidate repair | TDS-PUB-BD-04/05 |

## Negative Paths

- missing input: source baseline, final root, Git-config allowlist, sealed builder evidence, Security & Analysis state ledger, or exact closeout schema/content review missing blocks progression.
- invalid input: unresolvable SHA, non-parentless root, unexpected equivalence delta, or ambiguous refspec blocks.
- duplicate/ambiguous input: multiple branches/roots/remotes or repeated approval with unclear target blocks.
- unknown reference: unexpected ref, object, relationship, app, hook, environment, or external object dependency blocks.
- dependency missing: unavailable local gate/API/authenticated setting/unauthenticated inspection fails closed; no skipped config origin or surface.
- permission/write failure: repository/API mutation failure stops before the next gate; do not retry with broader commands.
- dry-run side effect: this R3 design slice must leave refs, remotes, repositories, visibility, credentials, hooks, and Git configuration unchanged.

## Boundary Checks

- threshold: prohibited findings and unexpected surfaces are exactly zero.
- null/default: no default repository metadata, identity, signature, governance, or approval decision.
- empty/non-empty: destination starts empty; final root contains the approved non-empty payload.
- min/max: exactly one root commit, zero parents, one branch, zero tags, one destination remote during the allowed builder push.
- status/policy enum: private candidate, frozen-findings closure, publicly verified, contained incident; containment is not rollback.
- wire type: archive payload, Git commit/ref, and GitHub repository surface.
- internal type: source baseline SHA and distinct final root SHA.
- producer/consumer: private source control plane -> isolated builder -> private destination -> public writer.
- round-trip token: fixed final root verified in builder, destination, fresh clone, API, and unauthenticated view.
- precision/range: identity fields and exact ref/object sets are compared, not sampled.
- cross-language parse: not applicable.

## Compatibility Checks

- old schema/input: D-040 parentless snapshot and two persistent clone roles remain unchanged.
- new schema/input: D-041 adds control-plane separation, isolated execution, analyzer surfaces, and recovery semantics without weakening D-040.
- output order: execution order is fixed by the lifecycle; audit cannot move before candidate creation.
- optional field behavior: governance files are optional only by explicit owner decision; adopted files are in the initial root.

## Data Safety Checks

- source-derived data: never copied from private control evidence into public payload or closeout.
- generated outputs: detailed logs/manifests and the sealed builder evidence remain local/private; only aggregate status is retained publicly, while A/B can read the integrity-protected private bundle.
- secrets: repository secrets, variables, environments, keys, hooks, persistent credentials, URL rewrites, and installed apps are explicitly inventoried as absent; JIT push authority is non-logging and revoked.
- local-only files: paths/names/content never enter tracked artifacts.
- synthetic sample boundaries: feasibility probes use synthetic repositories and status-only results.

## Main Wiring / Integration Checks

- helper connected to main path: not applicable; this slice changes source docs only.
- output reaches manifest/report: runbook requirements map into the future R4 Packet surface ledger.
- effective config reaches runtime: future repository settings are independently queried after empty destination creation and before the first push, then again before visibility.
- CLI arg reaches implementation: future explicit no-tags refspec targets only `public-init:main`.
- dashboard wiring: `Plans.md` links the active Packet, Matrix, and runbook.

## Mutation-style Adequacy Questions

- If active control artifacts are added to the payload allowlist, does TDS-PUB-BD-01 reject them?
- If Double Audit is moved before private candidate creation, Freeze waits for zero findings, or an epoch identity changes while old A/B reports are reused, does TDS-PUB-BD-02 fail on lifecycle order/authority?
- If final-root scanning is replaced with baseline-only scanning, does TDS-PUB-BD-03 detect the missing authority?
- If a governance file changes outside the owner allowlist, does the equivalence gate stop?
- If a source-derived failure reuses its baseline or preserves an already-pushed destination, or another failed private candidate is force-pushed, branch-deleted, or patched, does TDS-PUB-BD-04 reject the route?
- If a post-public private flip is called rollback, does TDS-PUB-BD-05 reject the wording and incident contract?
- If the current R3 route is reused for a release/R4 executable change, or local full runs on a non-final SHA, does TDS-PUB-BD-06 reject the route/evidence?
- If H1 is mutated after sealing, H2 does not commit to the exact H1 hash, builder evidence is missing after destruction, the builder inherits a hook/filter/signing/URL rewrite, namespace preflight passes but the actual empty destination gains access/automation before push, or the tree is safe but a scanner, webhook, deploy key, app, environment, variable, discussion, Wiki, Project, Actions cache, deployment, package, notification, or unauthenticated metadata leaks, does TDS-PUB-BD-07 have a ledger row that fails?
- If an initial owner approval is reused for visibility without a fresh gate, does TDS-PUB-BD-07B fail?
- If the actual public cutover record adds a private/FAIL field, `Plans.md` still says Phase B is pending, or either file is pushed without exact-content schema/status/privacy/docs/independent review, does TDS-PUB-BD-07C fail?
- If this design slice changes a remote/ref or records a private value, does TDS-PUB-BD-08 fail?

## Residual Test Gaps

- GitHub repository settings and unauthenticated surfaces cannot be exercised until the owner creates/authorizes the private destination; the future R4 Packet must instantiate every ledger row and fail closed on unavailable queries.
- Security & Analysis forced-on public state remains unverified until the future R4 live platform probe; any unavailable setting/API blocks visibility.
- No finite scanner proves absence of every sensitive class. Two independent reviewers inspect the actual final root and repository surfaces before visibility.
- Public disclosure cannot be technically rolled back. The design reduces exposure probability and defines containment; it cannot guarantee retraction after visibility.
