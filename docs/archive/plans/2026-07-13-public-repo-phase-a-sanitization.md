# Public repository Phase A sanitization

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: codex-only
- Plan Commit: 1a5b31b
- Amendments: 4226320
- Coordinator: root Codex; requirements, decisions, scope, and human-gate routing
- Writer: fresh Codex subagent; Phase A implementation only
- Plan Reviewer: fresh independent Codex subagent; no writing role
- Final Reviewer: separate fresh independent Codex subagent; no writing role
- Reviewed Content HEAD: 5a724f4bddd728ef3cd912e37ef5fa8d3388ea8e
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: not-required
- Human Gate: none

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

Hosted CI は `docs/ci.md` の Budget Pressure route により Phase A では要求しない。local full と独立 review を代替 evidence とし、偶発した hosted run の product/test failure は blocker のまま扱う。owner disposition の対象は infrastructure/cancel outcome に限る。

## Risk

Risk: R3

Reason:
公開要求の複合正本化は stable contract を変更し、local-only source の untrack は data safety boundary を変更する。runtime behavior は意図して変えないが、機微情報の取りこぼしは後戻り困難な公開事故になる。

## Goal

公開不可情報を candidate commit tree と将来の public snapshot から除外し、要求・履歴境界・移行手順を公開可能な正本へ移した上で、Phase B を安全に開始できる状態にする。

失敗は「公開不可情報が tracked artifact、commit tree、PR evidence、または後続の public surface に現れること」と定義する。

## Scope

- owner 聴取に由来する handoff 2 区画と POS 調査 doc 1 区画を、業務上の意味を保つ抽象表現へ変更する。
- tracked candidate tree 全域の実原価 canary を synthetic value へ置換し、fixture と期待値を整合させる。
- local-only source 2 点を index から外し、repo-local exclude へ登録する。`.gitignore` は変更しない。
- 公開要求の複合正本を定義し、source 側 40 ID と公開定義先を一対一に対応付ける coverage ledger を新設する。
- REQ-403 / SP-403 の POS 部門別売上照合と REQ-904 / UI-13 の在庫整合性を source docs 全域で分離し、前者は task 未割当の deferred、後者は UI-13 の現行責務とする。
- live doc の source 参照を複合正本へ更新する。archive 証跡は改変せず履歴境界規約で扱う。
- legacy archive の完全 URL を非リンク表記へ置換する。
- `PROJECT_HANDOFF.md` に履歴境界ノートを設け、境界日付、過去参照の読み替え、履歴閲覧専用 clone での graft 再適用規約を記す。
- public-safe な Phase B migration runbook と durable decision を新設する。
- candidate commit 専用の汎用 privacy checker と回帰テストを追加する。
- `Plans.md` を active Packet、Matrix、公開 runbook へ同期する。

## Non-scope

- Phase B の orphan commit、remote push、repository visibility 変更、remote 切替、graft 適用。
- local-only source の物理削除または owner 保管先への書込み。
- Git history rewrite、既存 private repository の issue/PR 編集。
- CI workflow 再設計、branch protection、LICENSE/SECURITY/CONTRIBUTING の owner 裁定。
- 許容裁定済みの schema 部門名、JAN、商品名、開発 path、username の変更。
- runtime behavior、DB schema、Tauri command/DTO、画面 behavior の変更。

## Acceptance Criteria

- `PUB-A-01`: candidate SHA の tree listing と archive 展開で local-only source 2 点が 0 件である。
- `PUB-A-02`: owner backup/hash confirmation 前は merge しない。working copy の実体は Phase B go/no-go まで保持し、`.gitignore` の diff は空、local exclude だけに登録される。
- `PUB-A-03`: `PROJECT_HANDOFF.md` と POS 調査 doc の対象区画に、公開不可の具体値がなく、抽象化後も運用制約と設計理由を説明できる。
- `PUB-A-04`: repo 外の非空 local manifest を使った candidate-SHA scan が `0 findings` で終了し、stdout/stderr に literal または manifest 実 path を出さない。
- `PUB-A-05`: `docs/spec/requirements-coverage.md` の ID 集合が source 側 distinct 40 ID と一致し、重複・欠番・余分 ID がない。全行に公開要約、実在する定義先、`current / partial / deferred / superseded`、差分・後続理由があり、独立 reviewer の 40/40 semantic audit が status-only evidence で pass する。
- `PUB-A-06`: live source 参照は複合正本へ更新され、archive 証跡は履歴境界規約で解釈できる。clean archive 展開で doc consistency check が成功する。
- `PUB-A-07`: candidate SHA に legacy archive の完全 URL が 0 件で、過去の PR/issue/commit 参照の意味は非リンク表記と境界ノートで保持される。
- `PUB-A-08`: `PROJECT_HANDOFF.md` の境界ノートは private URL を含まず、snapshot 日付を public 初期 commit の author date と定義し、履歴閲覧専用 clone だけの graft 手順を示す。
- `PUB-A-09`: public runbook、Packet、Matrix、review/PR evidence に、canary literal、private repository 識別子、local-only source 名、owner 保管実 path、実 email、検査 log 転載がない。
- `PUB-A-10`: 許容裁定済みの schema 部門名、JAN、path、username に意図しない diff がない。
- `PUB-A-11`: synthetic fixture 置換後に `bash scripts/local-ci.sh full` と `bash scripts/doc-consistency-check.sh` が成功する。backend arithmetic/import、frontend cost propagation/rendering、doc examples の各 class で独立 oracle を指定し、temporary mutation が対象 test/check を red にする。
- `PUB-A-12`: fresh Final Reviewer の candidate-tree negative-space audit が、既知 canary 以外を含め未分類の公開不可情報を検出しない。
- `PUB-A-13`: `git diff --check` が成功し、scope diff に Phase B mutation や local file deletion がない。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md`, `LOCAL-REQ-SOURCE`, `LOCAL-PRIVACY-INVENTORY`
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/*.md`
- Function / command / DTO: `docs/FUNCTION_DESIGN.md`, `docs/function-design/*.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/*.md`
- Screen / UI: not applicable; no behavior or layout change
- Decision log / ADR: `docs/decision-log.md`, new public migration runbook

`LOCAL-PRIVACY-INVENTORY` と `LOCAL-REQ-SOURCE` は Phase A までの private design input であり、公開側正本にはしない。耐久判断は coverage ledger、handoff、runbook、decision log へ昇格する。

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | Function docs and fixtures retain behavior; only synthetic examples change | existing sufficient; implementation must prove behavior unchanged |
| Command / DTO / generated binding / wire shape | No wire change | intentionally non-scope |
| DB / transaction / audit / rollback / migration | No schema or transaction change | intentionally non-scope |
| Screen / UI / route state / Japanese wording | Mock/example values only | existing sufficient |
| CSV / TSV / report / import / export format | POS investigation abstraction must preserve adapter contract | existing sufficient; wording updated in Phase A |
| Durable decision / ADR | public migration runbook, history-boundary decision, composite requirements SSOT | updated in Phase A |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| PUB-A-01/02 | privacy inventory owner rulings | PUB-A-D1 | Untrack only after verified copy; deleting first can remove the only readable copy in another clone | index, local exclude, Plans | TDS-PUB-A-01/02 |
| PUB-A-03 | privacy inventory abstraction rulings | PUB-A-D2 | Preserve operational constraints without publishing source-specific counts or statements | handoff, POS investigation doc | TDS-PUB-A-03 |
| PUB-A-04/11 | privacy inventory canary ruling | PUB-A-D3 | A tracked literal checker would reintroduce the values it detects; manifest stays local-only | generic checker, fixtures/docs | TDS-PUB-A-04/11 |
| PUB-A-05/06 | composite requirements ruling | PUB-A-D4 | A single short inventory cannot preserve all SP/QR meaning; count-only mapping hides semantic drift, so every row carries status/reason and receives independent source audit | coverage ledger and linked design docs | TDS-PUB-A-05A/05B/06 |
| PUB-A-07/08 | history continuity ruling | PUB-A-D5 | Full URLs disclose the archive identity; bare references require an explicit boundary convention | tracked docs, handoff | TDS-PUB-A-07/08 |
| PUB-A-08/09 | clone separation ruling | PUB-A-D6 | Co-locating archive refs and public push authority leaves ordinary refspec leak paths | handoff, public runbook, decision log | TDS-PUB-A-08/09 |
| PUB-A-09/12 | public-safe artifact invariant | PUB-A-D7 | Plans and evidence are themselves part of the public snapshot | all tracked artifacts and final audit | TDS-PUB-A-09/12 |
| PUB-A-10 | owner allowlist ruling | PUB-A-D8 | Already adjudicated public data must not be churned by a privacy sweep | scope diff | TDS-PUB-A-10 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes after the coverage ledger, handoff boundary note, migration runbook, and decision-log entry land.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: two-clone separation, exact initial push refspec, public-safe evidence invariant, boundary-date semantics.
- Assumptions and constraints: local-only manifest and owner copies remain outside tracked evidence; Phase A never mutates GitHub visibility or public remotes.
- Deferred design gaps, risk, and follow-up target: LICENSE and exact public repository identity are Phase B owner decisions; CI contract redesign is a separate R3 change after cutover.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, via `TDS-PUB-A-*` rows.

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | POS adapter behavior is unchanged; only source-derived narrative is abstracted | POS investigation doc + regression gates |
| Fact check / design decision split | Private field facts remain local; public docs retain only product decisions and constraints | coverage ledger and handoff |
| Lifecycle / retry | Candidate is tested by fixed SHA, archive extraction, and fresh review; working tree is not authoritative | Matrix lifecycle row |
| Operator workflow | Existing operator workflow meaning must survive abstraction | handoff review |
| Replacement path | New public writer clone is separate from the history-view clone | migration runbook |
| Data safety / evidence | Checker inputs and detailed logs remain local-only; tracked evidence records status only | checker contract and PR evidence rule |
| Reporting / accounting semantics | Synthetic cost replacement must not change arithmetic or assertions' intent | targeted tests + mutation-style audit |
| Manual verification | owner verifies copy/hash before merge; no L3 UI gate | Human Gate |

## Design Readiness

- Existing design docs are sufficient because: architecture, runtime behavior, schemas, commands, and UI contracts do not change.
- Source docs updated in this PR: private inventory v5、公開 requirements coverage ledger、本 Plan Packet/Matrix、REQ-403 と REQ-904 を分離する architecture / screen / requirement source docs。Phase A implementation は handoff note、runbook、decision entry と残る参照を同期する。
- Design gaps intentionally deferred: Phase B repository identity, license policy, visibility mutation, CI redesign, and branch protection.
- Durable decisions discovered in this plan and promoted to source docs: clone-role separation, boundary-date semantics, and public-safe artifact invariant are explicit implementation deliverables and Plan Gate contracts.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): unchanged.
- Backend function design: unchanged; fixture values only.
- Command / DTO / data contract: unchanged.
- Persistence / transaction / audit impact: none.
- Operator workflow / Japanese UI wording: no UI wording change; handoff meaning preserved.
- Error, empty, retry, and recovery behavior: checker fails closed for missing/empty manifest, invalid SHA, scan error, and nonzero finding.
- Testability and traceability IDs: `PUB-A-*`, `PUB-A-D*`, and `TDS-PUB-A-*`.

## Contract Probe

- Orphan snapshot and history boundary: a synthetic local repository untracked dummy private inputs, created a one-parentless snapshot, pushed one explicit ref to a local bare repository, and verified a fresh clone contained one commit and only the public file -> passed.
- Local graft continuity: the same synthetic repository applied a local graft after snapshot creation and verified the replace ref remained local and absent from the fresh clone -> passed.
- Local toolchain: Git tree/archive inspection, SHA-256, spreadsheet ID-token extraction, and fresh-clone probes are available -> passed.

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| PUB-A-D1 | index, `.git/info/exclude`, Plans | TDS-PUB-A-01/02 | owner backup/hash is Human Gate |
| PUB-A-D2 | `docs/PROJECT_HANDOFF.md`, POS investigation doc | TDS-PUB-A-03 | raw source text non-scope |
| PUB-A-D3 | generic checker, synthetic examples/fixtures | TDS-PUB-A-04/11 | literal manifest local-only |
| PUB-A-D4-CURRENT: REQ-101/102/103/104/201/202/203/204/205/301/302/303/501/502; SP-101/102/103/201/203/205/301/302/303; QR-02/04/05 | `docs/spec/requirements-coverage.md` and each row's source targets | TDS-PUB-A-05A structural + TDS-PUB-A-05B 40-row semantic audit | implementation coverage remains in traceability docs |
| PUB-A-D4-PARTIAL: SP-104/202/204/501/502; QR-03/06 | ledger status/reason and linked source targets | TDS-PUB-A-05A + TDS-PUB-A-05B | deferred portions remain explicit non-scope |
| PUB-A-D4-DEFERRED: REQ-403; SP-403; QR-01 | ledger status/reason; REQ-403/REQ-904 source separation | TDS-PUB-A-05A + TDS-PUB-A-05B | feature implementation is non-scope |
| PUB-A-D4-SUPERSEDED: REQ-401/402; SP-401/402 | ledger replacement reason and current adapter/source targets | TDS-PUB-A-05A + TDS-PUB-A-05B | old premise is not reintroduced |
| PUB-A-D5 | handoff boundary note, legacy reference rewrite | TDS-PUB-A-07/08 | archive history rewrite non-scope |
| PUB-A-D6 | `docs/PUBLIC_REPO_MIGRATION.md`, decision log | TDS-PUB-A-08/09 | Phase B execution non-scope |
| PUB-A-D7 | all tracked docs/plans/evidence | TDS-PUB-A-09/12 | detailed scan logs local-only |
| PUB-A-D8 | adjudicated schema/example fields | TDS-PUB-A-10 | owner allowlist unchanged |

## Test Plan

Test Design Matrix: [2026-07-13-public-repo-phase-a-sanitization.md](test-matrices/2026-07-13-public-repo-phase-a-sanitization.md)

- targeted tests: generic checker unit/CLI tests; requirements-ledger structural check plus independent 40-row semantic audit; backend `test_complete_req205_total_cost_multiple_products` and `test_parse_csv_req104_all_fields_present`; frontend receiving cost-propagation and record-detail total rendering tests; doc-example canary/diff invariant; doc consistency.
- negative tests: missing/empty manifest, wrong SHA, literal-output leakage, residual canary in a regular-file or symlink-target blob, readlink/search failure, extra/missing requirement ID, dangling live link, accidental scope drift.
- compatibility checks: runtime tests green, archive evidence unchanged, allowed fields unchanged.
- data safety checks: candidate SHA archive scan, clean archive doc check, fresh negative-space audit.
- main wiring/integration checks: `bash scripts/local-ci.sh full`, checker invoked against the fixed candidate SHA, Plans links resolve without local-only files.

## Boundary / Wire Contract

- producer: local-only canary manifest and fixed candidate commit.
- consumer: generic privacy checker.
- wire type: local text manifest containing opaque canary records; never committed.
- internal type: parsed non-empty record set and candidate tree bytes.
- precision/range: each manifest line is a tab-separated fixed-string conjunction; every field must occur in the same tracked blob. Regular-file contents and symlink-target blobs are scanned, and all records must be evaluated.
- round-trip path: local manifest -> candidate SHA archive/tree -> status-only result.
- invalid input: missing/empty manifest, invalid/unresolvable SHA, archive/read error all fail closed.
- compatibility: checker interface remains generic and contains no project-private literal.

## Review Focus

- Inspect negative space: what public surface is not covered by known canaries?
- Verify source meaning survives abstraction and all 40 IDs have a public definition or reasoned terminal status.
- Verify tests do not become tautological when fixtures and expected values change together.
- Verify Packet/Matrix/runbook/evidence themselves satisfy the public-safe invariant.
- Verify Phase B commands or public mutations did not enter the Phase A diff.

## Spec Contract

Contract ID: SPEC-PUB-A

- `PUB-A-01` through `PUB-A-13` in Acceptance Criteria define the complete Phase A contract.
- Public safety is fail-closed: uncertainty, scan error, missing input, or unclassified finding prevents progression.
- A status-only `0 findings` record is acceptable evidence; sensitive literals and detailed logs are not.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| PUB-A-01/02 | untrack local-only inputs after prerequisite | TDS-PUB-A-01/02 | index vs physical-copy semantics | tree/archive listing + owner confirmation |
| PUB-A-03 | abstract source-derived sections | TDS-PUB-A-03 | meaning retained, specifics removed | targeted diff + independent review |
| PUB-A-04/11 | replace canaries and add generic checker | TDS-PUB-A-04/11 | fail-closed, non-tautological tests | local status + full gate |
| PUB-A-05/06 | create composite SSOT, separate REQ-403/REQ-904, rewrite live refs | TDS-PUB-A-05A/05B/06 | complete ID set, semantic status/reason, clean-room links | structural ledger check + 40/40 audit + archive doc gate |
| PUB-A-07/08 | rewrite URLs and add boundary note | TDS-PUB-A-07/08 | no archive identity disclosure | candidate scan + doc review |
| PUB-A-09/12 | create runbook and audit all artifacts | TDS-PUB-A-09/12 | evidence cannot reintroduce private data | negative-space review |
| PUB-A-10 | preserve adjudicated fields | TDS-PUB-A-10 | scope discipline | allowlist diff audit |
| PUB-A-13 | close scope and quality gates | TDS-PUB-A-13 | no Phase B mutation | diff checks |

## Data Safety

- Must not be committed: local source workbook content, private privacy inventory after Phase A, source-derived raw statements, real cost canaries, owner backup location, private repository URL/name, real email, detailed privacy scan logs, credentials, POS/store artifacts.
- Local-only aliases: `LOCAL-REQ-SOURCE`, `LOCAL-PRIVACY-INVENTORY`, `LOCAL-CANARY-MANIFEST`, `LOCAL-BACKUP-A`, `LOCAL-BACKUP-B`.
- Synthetic-only paths: tracked fixtures, examples, mockups, and checker tests must use clearly artificial values unrelated to source canaries.
- Tool output: never enable shell trace for local manifest checks; print only record count class, status, and exit code, never literals or real paths.
- Candidate authority: privacy assertions target a fixed commit SHA/tree or its clean archive, not the mixed working tree.

## Implementation Results

- Candidate tree/archive checks, local-only canary scan, private-identity scan, clean-archive docs, and L1 local full completed with status-only green evidence.
- The two local-only sources are absent from the candidate while their working copies remain physically present and locally excluded; `.gitignore` is unchanged.
- The independent workflow-gate Double Audit completed, all frozen P2 findings were fixed in scope, and both closure contexts reported P1/P2 reopen = 0.

## Review Response

- Plan Gate round 1 (`3dafd01`): P1=0 / P2=4。source-design contradiction のため design へ戻した。accept: REQ-403/REQ-904 source 分離、ledger placeholder/status/reason 修正、40-row semantic audit protocol、原価置換の class 別 independent oracle/mutation を source docs・Packet・Matrix に追加。修正内容は implementation 前の本 content commit に収め、`design -> plan-draft -> plan-gate` を再実行して round 2 review を要求する。
- Plan Gate round 2 (`9047aa2`): P1=0 / P2=1。SP-501/502 は印刷を契約に含むが後続実装のため、SP-501 を `partial` へ変更し、両行の理由と CCL status group を同期した。prior P2×4 の closure は確認済み。round 3 で全 40 行を再確認する。
- Plan Gate round 3 (`1a5b31b`): P1=0 / P2=0、40-row semantic audit 40/40 pass。独立 reviewer の承認と plan-first ancestry が本 state-only commit より前に揃ったため、隣接遷移 `plan-gate -> plan-approved -> implementing` を materialize する。
- Findings Freeze: independent broad-audit passes A/B completed before freeze with P1=0 / P2=4. The four same-PR findings covered archive identity, CRLF manifest handling, receiving-total anti-tautology, and isolated snapshot-builder separation. Closure contexts A2/B confirmed all four closed with P1/P2 reopen = 0; post-freeze exceptions: none.
- State transition: all evidence for `implementing -> local-verified -> independent-review -> human-confirm` existed before this state-only commit, so the adjacent sequence is materialized here. Owner copy/hash confirmation, Ready authorization, and merge disposition remain pending Human Gate items.
- Human Gate confirmation (2026-07-14): owner confirmed that both local-only sources were copied and their SHA-256 values matched, without recording real paths or hashes in tracked artifacts, and explicitly authorized Ready. This state-only commit materializes `human-confirm -> ready-hosted-final`; owner merge disposition remains pending.
- Post-Merge Closeout (2026-07-14): owner accepted the exact-HEAD local full and the runner-allocation infrastructure failure disposition, and PR #167 was squash merged. The merge tree matched the reviewed final PR tree, both local-only sources remained absent, and this Packet/Matrix moved to archive. This records `ready-hosted-final -> merge -> archive`; no Phase B repository mutation occurred.
