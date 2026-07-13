# Public repository migration runbook

## Purpose

This runbook defines Phase B: create a new repository from the sanitized Phase A tree without publishing the pre-boundary object graph or local-only evidence. Phase B is R4. It does not begin until Phase A is merged and the owner confirms the required local copies and hashes.

Failure means that information classified as non-public appears in a commit, Git ref, repository surface, PR/review evidence, command output retained as evidence, or a push-capable public working clone.

## Public-safe evidence rule

- Plan Packets, Test Design Matrices, PR bodies, review packets, and runbooks are part of the future public tree and obey the same disclosure rules as product docs.
- Never copy source statements, private repository identity or URL, local source names, real backup paths, personal email addresses, canary records, or detailed scan logs into tracked artifacts.
- Privacy checks record the immutable candidate SHA, check name, exit status, and zero/nonzero result only. Manifest records and detailed findings stay local-only.
- Any uncertainty, scanner error, missing input, metadata mismatch, or unexpected repository surface is a stop condition.

## Control plane and public payload

Phase B execution has two deliberately separate artifact sets.

1. **Private control plane**: the active R4 Plan Packet, Test Design Matrix, review records, owner approvals, and command/evidence routing remain in the owner-retained source repository until cutover closes. They are not copied into the initial public snapshot.
2. **Public payload**: the initial snapshot starts from one fixed, sanitized source-baseline commit after this runbook and its durable decisions have been reviewed and archived. The source baseline itself contains no active R4 Packet, Matrix, approval, or detailed control evidence; the active control branch is never used as the archive source. Only the owner-approved public payload and governance files are committed to the parentless root.

This separation is required because an active Packet cannot both prove plan-first ancestry in the private workflow and appear in a one-commit parentless public history. After cutover, add a public-safe closeout record to the public repository; do not transplant the active control Packet, detailed review evidence, or private ancestry.

## Persistent clone roles

Keep the two persistent roles structurally separate.

1. **Public writer clone**: contains only the public repository and public refs. It has no archive remote, old objects, or replace refs. All normal development and public pushes happen here.
2. **History-view clone**: contains the owner-retained archive ancestry and an optional local graft. It has no public push-capable remote. It is for `log`, `blame`, and investigation only.

A Windows synchronized clone must be assigned exactly one role. Never add archive refs or a graft to a public writer clone, and never add a push-capable public remote to a history-view clone.

The snapshot builder is transient, not a third persistent clone role. Create it in a fresh temporary directory from an exported candidate archive, initialize a new repository there, and destroy it after the initial push. It must not inherit the source `.git` directory, an object alternate, an old ref, or an old object.

## Phase B R4 gate

Before any repository mutation:

1. Create a Phase B R4 Plan Packet and Test Design Matrix with private-recovery/public-containment notes, immutable candidate selection, public-surface checks, and every irreversible command listed.
2. Commit the plan before implementation and pass the independent Plan Gate.
3. Obtain the owner R4 approval for the complete execution contract.

The first Contract Audit cannot finish before a real private candidate exists. After the private-first push and fresh-clone inspection, but before visibility changes, run the R4 Contract Audit against that immutable candidate in two independent contexts. Fix one audit epoch to the tuple of source baseline, final root, destination generation, approved surface-ledger state, and sealed `H1`/`H2`/`H3` hashes. Findings Freeze begins as soon as both initial broad passes for that exact epoch are complete, regardless of their finding counts, as required by `docs/DEV_WORKFLOW.md`. If the frozen set contains P1/P2 findings and closure can be proved without changing any epoch identity, keep the destination private, adjudicate them, and run closure-only verification against the same immutable candidate. Any change to an epoch identity invalidates the old Audit/Freeze authority: recreate as required below, run both independent broad passes on the new candidate, and establish a new Freeze before visibility. Visibility remains blocked until the current epoch's frozen P1/P2 closure is zero and every candidate gate has been revalidated. Obtain a separate just-in-time owner approval before each private-first push, visibility change, development-remote cutover, and exact public closeout push. These are distinct approvals; an earlier approval does not authorize a later irreversible command. Workflow Ready and merge for the private control PR remain separate Human Gates and are not silently absorbed into the migration-mutation approvals.

Use four named observation epochs. `E0` is the actual empty private destination, `E1` is the fixed private candidate after `H1`/`H2`/`H3`, `E2` is the just-public repository before the closeout push, and `E3` is the public repository after the allowlisted closeout commit. The one-commit/one-branch candidate invariant applies to `E1` and `E2`; `E3` intentionally adds exactly the reviewed closeout commit. Every query result records its epoch and target authority. Evidence from one epoch is never reused as if it described another.

The execution Packet uses the closed `docs/ci.md` public-repository Phase B bootstrap exception and classifies hosted CI as `not-required`: Actions stays disabled during migration, and the source repository has no usable hosted allocation. Compensating evidence is the fixed-final-root fresh clone running the local full gate, the public-surface/privacy gate, and the two independent Contract Audit passes plus closure. Any local product/gate failure remains a blocker, and owner disposition is required.

## Prepare the snapshot

1. Confirm Phase A candidate checks and owner copy/hash gate are complete. Do not record real paths or hash values in public artifacts.
2. Fix two different authorities in the execution Packet: the **source baseline SHA** whose sanitized payload is exported, and the **final parentless root SHA** created after approved governance files and public commit metadata are applied. The final root, not the source baseline, is authoritative for archive, privacy, fresh-clone, and repository-surface checks. Compare the two trees with an explicit owner-approved allowlist; any other difference is a stop condition.
3. Set repository-local commit identity inside the isolated snapshot builder to an owner-approved public name and GitHub noreply address. Verify both author and committer identity. The builder must use the isolated Git configuration boundary below; do not rely on or mutate source, system, global, or user Git configuration.
4. Decide LICENSE, SECURITY, and CONTRIBUTING policy before the snapshot. Any adopted file must be included in the initial snapshot so the one-commit gate remains true.
5. Before repository creation, inspect the proposed owner namespace for inherited/base permissions, default collaborators or teams, installed-app access, webhooks, rulesets, repository-creation automation, and Security & Analysis defaults. If a new private repository would be readable or mutable by any unapproved principal, or would immediately run an unapproved scanner/automation, choose an isolated namespace or stop; do not rely on the post-push audit to discover inherited access or processing.
6. Create the destination repository as **private**, standalone, and empty: no README/license initialization, import, fork relationship, template relationship, default content, issue, PR, release, discussion, Wiki, Project, Actions run/artifact/cache, Pages deployment, package, deployment, webhook, deployment key, environment, secret, variable, installed app access, or inherited ruleset beyond the pre-approved empty-repository baseline. Fix the approved name, description, homepage, topics, visibility, default branch, feature toggles, and relationship metadata. Before the initial push, disable Actions and every optional Security & Analysis automation. Record the expected private and post-public state for dependency graph/SBOM, Dependabot alerts and security/version updates, code scanning/default setup, secret scanning/push protection/partner notification, private vulnerability reporting/security advisories, and organization security policy. The migration default is: Actions stays disabled through `E3`; every optional analyzer/update/PR generator is disabled with zero output; dependency graph is expected to become enabled when public; GitHub's automatic public secret scanning is expected to process public content without a finding; Dependabot alerts/security updates/version updates, code scanning/default setup, repository push protection, and private vulnerability reporting remain disabled unless the platform forces a different public state. The R4 Packet records each feature as an exact enum for `E0` through `E3`. Any forced or observed state outside that ledger, or any alert, PR, notification, log, or artifact, requires a gated amendment and owner approval before visibility rather than an implicit acceptance.
7. After creation but before adding push credentials or pushing payload bytes, query the actual empty destination and compare every principal, inherited permission, app/webhook/automation, ruleset, metadata/feature field, Actions/Security & Analysis setting, and empty-surface inventory above with the approved baseline. An unavailable query or mismatch stops before push. Seal only status/zero-count results in private control evidence; never copy identities or settings values into public artifacts.
8. Create `public-init` as a parentless snapshot from the sanitized source baseline in the isolated snapshot builder. Its subject, author/committer names and emails, author/committer dates, and signature state must all be intentionally public. Record the resulting final root SHA in private control evidence only.

## Isolated snapshot builder

1. Fix the sanitized source baseline SHA, create an archive from that commit, and extract it into a new temporary directory. Verify that the extracted payload contains no `.git` entry before initializing anything.
2. Start the builder under a clean environment allowlist with empty temporary home/config directories, system Git configuration disabled, an explicit empty global configuration, no inherited `GIT_*` configuration variables, and an empty init template/hooks directory. Initialize with the empty template. Do not copy or move the source repository's `.git` directory.
3. Set only the owner-approved repository-local configuration. Pin line-ending conversion off, set an empty hooks path, disable signing unless the owner-approved route explicitly requires and audits a public signature, and permit no credential helper, URL rewrite, include/includeIf, clean/smudge/process filter, or other command-executing configuration. Inspect `git config --show-origin --list` against a key/value allowlist without copying values into public evidence. Any unexpected origin or key is a stop condition.
4. Verify that `.git/objects/info/alternates` is absent or empty, `.git/hooks` has no executable hook, no refs exist, and adding the extracted payload preserves the source-baseline tree byte-for-byte and mode-for-mode except for the owner-approved governance allowlist. A required attribute filter, gitlink, or LFS dependency is a stop condition unless the R4 plan separately proves it public-safe.
5. Add any owner-approved LICENSE, SECURITY, or CONTRIBUTING files required by the snapshot, then create the single parentless `public-init` commit with the approved public metadata and explicit signature state. Validate the raw commit object against a closed allowlist: zero parent headers; exact tree; exact author and committer names, emails, timestamps, and time zones; exact encoding/signature state; and an exact message byte sequence. A body, trailer, co-author line, unknown header, inherited signature, or unapproved time-zone/date difference is a stop condition, not harmless metadata.
6. Before adding a remote, verify that the builder contains one commit with zero parents, no tags, remote refs, replace refs, stash refs, notes, extra refs, submodule metadata or gitlink, LFS object dependency, alternates, old objects, or unreachable objects. Treat any unexpected `git fsck --full --no-reflogs --unreachable` output as a stop condition.
7. Add the private-first destination as the builder's only remote after verifying that no URL rewrite can change it and that its URL contains no embedded credential. Never add that remote, or any other public push-capable remote, to the source/history-view clone.
8. Inject push authentication only at the just-in-time push through an owner-approved, non-logging, least-privilege mechanism that is neither stored in the remote URL/config nor copied into the payload. Verify that no shell trace, credential helper, command argument, or retained output can expose it.
9. Before the push, seal a read-only private control-plane evidence bundle as stage `H1`. It contains the source baseline/final root authorities; effective config origins and allowlist comparison; environment-key allowlist; template/hook/filter/attribute/signing checks; byte/mode tree comparison; ref/object/fsck results; credential non-persistence controls; intended remote endpoint and refspec; the actual empty destination's post-creation principal/permission/app/automation/ruleset/metadata/feature/Actions/Security & Analysis/empty-surface comparison; and pre-push status-only command results. Store the `H1` integrity hash separately and never modify that bundle after sealing.
10. Verify that the builder has exactly the intended destination remote, then perform the one allowed explicit push below with hooks disabled by the isolated configuration. Revoke/remove the credential and push authority, destroy the builder, and create a separate read-only post-push addendum containing those status results and the exact `H1` hash. Seal this addendum as stage `H2`, whose hash therefore commits to both stages.
11. After the fixed fresh-clone, final-root local full, and complete live private-surface ledger finish, create a third immutable read-only candidate addendum `H3`. It contains check IDs, target epoch, status/digests, and the exact `H1` and `H2` hashes; raw API/config/ref/object/scanner output stays inside the private sealed evidence set and never enters tracked or public evidence. Store the `H3` hash separately. Retain the `H1`/`H2`/`H3` chain through both broad audits, closure, visibility, and cutover closeout. Both Contract Audit contexts verify all three hashes and cross-references, then reconcile them with the final-root fresh clone and live repository surfaces. Missing, mutable, mismatched, stale-epoch, or internally inconsistent evidence is a failed private candidate.

The only allowed initial push shape is a single explicit refspec with tag following disabled:

```bash
git push --no-tags <public-remote> public-init:main
```

For the destination repository, `--mirror`, `--all`, `--tags`, wildcard refspecs, and an omitted/ambiguous refspec are permanently forbidden.

## Private-first go/no-go

From a fresh clone of the destination and from the GitHub repository surfaces, verify all of the following before changing visibility:

- exactly one branch, one commit, zero parents, zero tags, and no replace ref or unexpected ref;
- the snapshot builder was created from an archive whose extracted payload had no source `.git`; its effective Git configuration, templates, hooks, filters, signing, credentials, and URL handling matched the closed allowlist; and it had no object alternate, old/unreachable object, or old/unexpected ref;
- the final root tree and its extracted archive omit every local-only input and pass the local-only canary check at the fixed final root SHA;
- the source-baseline tree and final-root tree differ only by the owner-approved public governance allowlist;
- the raw commit header and message exactly match the approved allowlist, including author/committer identity, dates/time zones, signature/encoding state, subject, zero unapproved body/trailer/co-author fields, and zero unknown header;
- the public payload, runbook, closed `docs/PUBLIC_REPO_CUTOVER.md` field schema, and repository metadata satisfy the public-safe evidence rule; active control-plane Packet, Matrix, approvals, and detailed review evidence are absent;
- no unapproved collaborator/team/base permission, fork/import/template relationship, issue, PR, release, discussion, Wiki, Project, Actions run/artifact/cache, Pages deployment, package, deployment, webhook, deployment key, environment, secret, variable, installed-app access, creation automation, or unexpected repository rule exists; approved name/description/homepage/topics/default-branch/feature metadata remains exact; and Actions remains disabled;
- Security & Analysis settings and surfaces match the approved private-state ledger: no unexpected dependency graph/SBOM, Dependabot alert/update/PR, code-scanning setup/result, secret-scanning/push-protection/partner notification, vulnerability-report/advisory, policy inheritance, log, or artifact exists;
- the fresh clone has no archive remote, old object source, graft, or unexpected remote;
- the transient builder's destination push credential/authority has been revoked or removed and the builder has been destroyed;
- local full gates and the required independent reviews are green.

If any item fails while the destination is private, keep it private and stop. Classify the authority that failed before choosing a retry:

- First prove provenance by comparing the source-baseline blobs/modes, extracted payload, governance inputs, and builder result. If the offending content or mode exists in the source baseline, invalidate that baseline. If any candidate bytes were already pushed, obtain the required destructive approval and delete the entire destination before doing anything else. Return the R4 Packet to design/plan-gate, sanitize and select a new baseline with zero active control artifacts through a gated amendment, then rebuild only after independent Plan Gate approval.
- If the source baseline remains clean and the difference/failure was introduced by extraction, builder config/filter, governance input, metadata, destination, or repository-surface state, keep the accepted baseline but obtain a new just-in-time owner approval, delete the entire destination repository, and recreate the builder and destination before retrying.
- If provenance cannot be proven, do not reuse or invalidate the baseline by guess. Stop in design/plan-gate until the authority is resolved and independently reviewed.

Do not use force push, branch deletion, ref replacement, or a repair commit: those actions do not prove that rejected objects and surfaces are gone. After the first push, every candidate failure deletes and recreates the whole destination regardless of provenance; provenance decides whether the source baseline may be retained, not whether the rejected destination may survive. Every retry rebuilds the builder, produces a new audit epoch, repeats the full candidate gate, and runs new Double Audit broad passes before a new Freeze. A failure consumes the success-path owner budget; stop and obtain an amended effort budget before requesting any additional approval.

## Visibility and development cutover

1. With the go/no-go evidence fixed, obtain the owner approval immediately before changing visibility.
2. Change the destination to public while Actions remains disabled, then verify the same branch/ref, repository-surface, and approved post-public Security & Analysis inventory again through authenticated settings and as an unauthenticated viewer. Any unexpected processing, notification, PR, log, or artifact enters the containment route below.
3. After public verification succeeds, obtain the separate development-remote cutover approval immediately before creating or configuring a push-capable public writer.
4. Create a new public writer fresh clone from the public repository. Use it for all subsequent development.
5. Retain the old source clone only as a history-view clone. Preserve its archive access and verify that it never received a public push-capable remote.
6. Do not reuse a mixed clone as the public writer, even if its current branch appears clean.

There is no true rollback after public visibility: observed data may already have been copied. If the post-public verification fails, immediately stop pushes, change visibility to private when possible, revoke tokens/keys and disable affected features as containment, preserve minimal public-safe incident evidence, and invoke the owner-approved incident route. Republishing requires a newly sanitized parentless snapshot and the complete R4 gate again; never describe containment as undoing disclosure.

## CI and branch protection

Treat CI redesign as a separate R3 change. Keep Actions disabled until the redesigned workflow has passed its local R3 gates and owner disposition. Before enabling required checks, provide a workflow that reports a stable aggregate check for open, ready, and synchronize events. Enable Actions, then verify docs-only, lightweight skip, normal R2+, and failing cases on the current commit SHA. Enable branch protection only after those probes pass. A required check that does not run on the latest SHA is a merge deadlock, not a successful skip.

## Optional local history continuity

Apply history continuity only in a history-view clone after fetching the old main ancestry from the owner-retained archive. If a new history-view clone does not already contain the public-init object, transfer that public object through a verified local Git bundle created by the public writer, fetch it from the bundle, and then delete the transient bundle after object verification. Do not add a public remote to the history-view clone merely to obtain the object.

```bash
git replace --graft <public-init> <archive-main-head>
```

This joins the public snapshot to the old main ancestry for local inspection; it does not expose commits reachable only from other refs and it does not propagate through normal clone or push. Reapply it in each new history-view clone. Never push `refs/replace/*`.

## Closeout

- Recheck that public writer clones contain only public refs/remotes and history-view clones have no public push capability.
- Recheck that the isolated snapshot builder was destroyed or has no destination push authority and is not being reused.
- Update `docs/PROJECT_HANDOFF.md` `履歴境界（public snapshot）` and the public cutover record with the public-safe clone-role/graft rule. Keep the actual Windows synchronized clone role and real path in a local-only control inventory; the tracked docs never record that path.
- After the private-first go/no-go has passed, the owner may remove redundant in-repository physical copies under a separately approved cleanup step. Verified owner-retained copies remain outside the repository.
- Complete and archive the Phase B control-plane Packet and Matrix only after cutover evidence is complete and public-safe; do not copy them into the initial public history.
- Add `docs/PUBLIC_REPO_CUTOVER.md` as the minimal public-safe closeout record in the public writer after cutover, and update `Plans.md` in the same closeout commit so Phase B is complete and only the approved next public-safe action remains. Before visibility, the Final Reviewer approves this closed schema: boundary date; statement that `main` began at a parentless sanitized snapshot; qualitative `PASS` only for privacy/tree, repository-surface, local-full, and independent-audit gates; public-writer/history-view role rule; CI/branch-protection follow-up state; and the closed `Plans.md` status/next-action shape. A failed gate follows the incident route and is never normalized into a public closeout `FAIL` field. No other field is allowed.
- Before pushing the actual closeout commit, validate the complete content of both files against their field/status allowlists, run the public-safe/privacy and docs gates on that commit, obtain an independent review of the exact content, and obtain a separate just-in-time owner approval for that exact commit push. Any extra field, stale Phase B next action, private-control evidence, or commit change after approval blocks the push and requires a new exact-content review/approval. The record and dashboard must not disclose the source repository, private review trail, owner approvals, local paths, identities beyond already-public commit metadata, sensitive literals, hashes copied from private evidence, test counts, URLs to private evidence, or detailed scan logs.
