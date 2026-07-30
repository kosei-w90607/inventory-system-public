# Plan Packet: Node 24 toolchain alignment

## Workflow State

- Phase: ready-hosted-final
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: 2047400
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: Claude Sonnet 5 fresh context
- Final Reviewer: Claude Sonnet 5 fresh context
- Reviewed Content HEAD: d6ae17b1465005b2e9e0faa1f90c76edd979e19a
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none

## Owner Effort Budget

- 介入回数上限: 4
- 実働時間上限: 30分
- relay 往復上限: 3

内訳:

1. Node 24 一本化を先行し、Rust `cargo audit` は別 change とする方針の決定（実施済み、介入 1/4）
2. repository 外の local tool cache へ Node 24.18.0 を導入する承認（実施済み、介入 2/4）
3. Draft PR 公開と必須 Final Review 用の budget exception（実施済み、介入 3/4）
4. Ready / merge の一括承認（実施済み、介入 4/4）

## Risk

Risk: R2

Reason:
Node runtime、型定義、開発環境正本、GitHub Actions の実行環境を揃える developer-tooling change。アプリの runtime behavior、DB、wire、route、operator workflow、merge 判定ロジックは変更しない。CI workflow file は変更するため hosted final は required とするが、gate の構成・判定・event routing は変えない。

## Goal

Goal Invariant:

### 最小完了条件

- repository が Node 24 LTS の単一 pin を持ち、ローカル検証・frontend CI・npm security monitor・Node型定義が同じ major contract を使う。

### 失敗定義

- Node 20 / 25 の live contract が残る、複数の version source が独立に drift できる、Node 24 で frontend full gate が通らない、または既存 CI / npm monitor routing が変わる。

### 非目的

- npm audit change B、その他 dependency 更新、Rust dependency monitoring、Rust toolchain pin、CI job graph / event / merge gate の再設計は行わない。

## Scope

- `.node-version` を Node `24.18.0` の single version source として追加する。
- `package.json` に Node 24 major の `engines.node` contract と、通常の `npm install` / `npm ci` / `npm run` を不一致時に止める `devEngines.runtime` contract（`onFail: error`）を追加する。
- `@types/node` を cooldown 済みの 24 系へ名指し更新し、必要な同一 dependency family の lockfile 差分だけを受け入れる。
- `.github/workflows/ci.yml` と `.github/workflows/npm-security-monitor.yml` の `actions/setup-node@v6` を `.node-version` 参照へ統一する。
- `scripts/tests/ci-workflow.test.sh` に、現在の単一 `$WORKFLOW` 前提を拡張し、`ci.yml` と `npm-security-monitor.yml` の両方および manifest が単一 pin / Node 24 contract から drift しない静的検査を追加する。
- `docs/DEV_SETUP_CHECKLIST.md` の現運用 Node contract と導入手順を Node 24 / repository pin 前提へ更新する。
- `Plans.md` の active change と旧 Node 22 backlog を現況へ同期する。
- Node 24.18.0 で frontend targeted checks、L1 full、hosted final を実行する。

## Non-scope

- `npm audit fix` / `npm audit fix --force`、Audit B の advisory 解消、`@types/node` 以外の意図的 npm package 更新
- Dependabot / secret scanning の設定変更
- `cargo audit` workflow または Rust dependency 更新
- GitHub Actions の trigger、job graph、permissions、cache policy、`continue-on-error` policy の変更
- application source、Tauri / Rust source、DB、generated bindings、route tree の契約変更
- user-wide Node default の無断変更
- repository root の `Dockerfile` / `docker-compose.yml`。いずれも現行 workflow / script から参照されない退役 Docker 構成の生ファイルであり、本 change では更新・削除せず、履歴コピーとの不一致を含む整理を別 backlog とする。

## Acceptance Criteria

- `.node-version` が `24.18.0` を一意に保持し、両 `setup-node@v6` が `node-version-file: .node-version` を使う。
- `package.json` の `engines.node` と `devEngines.runtime.version` が Node 24 major のみを許容し、`devEngines.runtime.onFail` が `error`、direct `@types/node` が 24 系である。
- Node 24 以外では、`--force` を付けない通常の `npm install` / `npm ci` / `npm run` が `EBADDEVENGINES` で fail-fast する。
- live source（archive、`DEV_SETUP_CHECKLIST.md` §A.1、明示的に Non-scope とした退役 root Docker 構成を除く）に `node-version: 20`、Node 20 CI contract、未着手 Node 22 migration backlog が残らない。
- `scripts/tests/ci-workflow.test.sh` が `ci.yml` / `npm-security-monitor.yml` のどちらか一方、pin、または manifest contract の drift で red になる。
- Node 24.18.0 上で `npm ci --ignore-scripts`、frontend typecheck / lint / format / test / build が pass する。
- `bash scripts/local-ci.sh full` が exact HEAD / CLEAN で pass し、GitHub hosted final が同一 HEAD で success になる。
- `npm audit` の残件は本 change 前より増えず、既知の change B 対象だけが残る。

## Design Sources

- Requirements / spec: N/A（developer tooling only）
- Architecture: `docs/project-profile.md` Test Commands / Workflow Notes
- Function / command / DTO: N/A
- DB: N/A
- Screen / UI: N/A
- Decision log / ADR: `docs/decision-log.md` D-030
- Developer environment / CI: `docs/DEV_SETUP_CHECKLIST.md` §1.1 / §1.2 / §4.2、`docs/ci.md`
- External primary sources: Node.js Releases、`actions/setup-node@v6` README

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Developer runtime version and setup | `docs/DEV_SETUP_CHECKLIST.md` | updated in plan-first change |
| CI verification and hosted evidence | `docs/ci.md` | existing sufficient; routing / ladder unchanged |
| npm supply-chain update policy | `docs/decision-log.md` D-030 | existing sufficient; named update + cooldownを維持 |
| Backend / wire / DB / UI | N/A | intentionally out of scope |

## Registration / Generation Obligations

該当なし。command、function-design doc、REQ coverage、route、operator screen は追加しない。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| TOOL-NODE24-D1 | `DEV_SETUP_CHECKLIST.md` §1.1 / §1.2 / §4.2 | TOOL-NODE24-D1 | EOL の Node 20 / 25 と major-only floating sources を退役し、現行 LTS の exact pin を単一 owner にする。日常コマンドの継続的一致は `engines` 単独や user-wide default 変更ではなく、npm が `install` / `ci` / `run` 前に評価する `devEngines.runtime` の fail-fast で担保する。Node 22 は LTS だが Node 24 より support runway が短いため不採用 | `.node-version`, `package.json`, workflows | `scripts/tests/ci-workflow.test.sh` + runtime mismatch probe |
| TOOL-NODE24-D2 | `docs/ci.md` Verification Ladder | TOOL-NODE24-D2 | CI routingを変えず実行runtimeだけを交換する。別 workflow やmatrix追加は scope過大 | `.github/workflows/ci.yml`, `npm-security-monitor.yml` | workflow static test + hosted final |
| TOOL-NODE24-D3 | `decision-log.md` D-030 | TOOL-NODE24-D3 | `@types/node` は24系を名指し更新し、force / blanket updateを使わない | `package.json`, `package-lock.json` | lock diff review + frontend full |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。現運用の version / setup contract は `DEV_SETUP_CHECKLIST.md` へ反映する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: exact pin と Node 24 contract を `DEV_SETUP_CHECKLIST.md` へ反映。D-030 は既存正本で十分。
- Assumptions and constraints: Node 24.18.0 は現行 LTS。`actions/setup-node@v6` は `.node-version` を `node-version-file` で読める。`@types/node@24.13.3` は7日 cooldown済み。
- Deferred design gaps, risk, and follow-up target: user-wide shell の default 切替は無断実施せず、local verification は owner承認後に repository pin を使って行う。repository root の `Dockerfile` / `docker-compose.yml` は現行導線から未参照の退役資産として本 change から除外し、履歴コピーとの不一致を含む整理を別 backlog とする。Rust monitor は次 change。
- Test Design Matrix can cite design decision IDs or source doc sections: R2のためMatrixは作らず、本packet Test Planで3 decisionをcoverする。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: archive、`DEV_SETUP_CHECKLIST.md` §A.1 の退役 Docker例、現行導線から未参照で明示的に Non-scope とした root `Dockerfile` / `docker-compose.yml` の historical Node 20 は live contract sweep から除外する。`devEngines` は `--force` で警告へ降格できるが、D-030 の no-force 契約を維持する。

## Impact Review Lenses

not applicable。外部機器、POS、CSV、operator workflow、data lifecycle は変更しない。

## Design Readiness

- Existing design docs are sufficient because: `docs/ci.md` が verification ladder / hosted routing を固定し、D-030 が依存更新方法を固定している。
- Source docs updated in this PR: `docs/DEV_SETUP_CHECKLIST.md` の live Node contract。
- Design gaps intentionally deferred: Rust monitoring、user-wide shell default。
- Durable decisions discovered in this plan and promoted to source docs: Node 24 exact pin と `.node-version` single-owner 方針。

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): application layerは無変更。
- Backend function design: N/A。
- Command / DTO / data contract: N/A。
- Persistence / transaction / audit impact: N/A。
- Operator workflow / Japanese UI wording: N/A。
- Error, empty, retry, and recovery behavior: CI setup failureは既存job failureとして可視化。routingは不変。
- Testability and traceability IDs: TOOL-NODE24-D1〜D3をworkflow static test / frontend full / hosted finalへ対応付ける。

## Contract Probe

- Node release status: Node.js公式 release tableを確認 -> v24 LTS、v20 / v25 EOL。
- setup-node version file support: `actions/setup-node@v6` READMEを確認 -> `.node-version`を`node-version-file`で利用可能。
- Cargo monitoring premise: GitHub dependency graph SBOMでCargo package URL 562件を確認 -> Rust一次監視は既に成立しており本changeから除外。

## Contract Coverage Ledger

R2のため非必須。Design Intent Traceで3 contractを追跡する。

## Test Plan

- targeted tests:
  - `bash scripts/tests/ci-workflow.test.sh`
  - `ci-workflow.test.sh` の新規検査が `ci.yml` と `npm-security-monitor.yml` をループまたは個別関数で明示的に対象化していること
  - Node 25.8.2 で通常の `npm run typecheck` が `EBADDEVENGINES` で失敗し、Node 24.18.0 の `mise exec -- npm run typecheck` が pass すること
  - Node 24.18.0 で `npm ci --ignore-scripts`
  - `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
- negative tests:
  - `ci.yml` / `npm-security-monitor.yml` の片側を一時的に literal Node 20へ戻す、またはmanifestの `engines` / `devEngines` majorを25へ戻す mutationでstatic testがredになることを確認し、即時復元する。
  - `awk '/^## A\.1 / { exit } { print }' docs/DEV_SETUP_CHECKLIST.md | rg -n 'v20\.|Node 20|node 20'` が no-match であること。
- compatibility checks:
  - `@types/node` family以外の意図しない direct dependency差分がないこと。
  - CI event / job / permission / cache / audit warn-only差分がないこと。
- data safety checks:
  - secrets、`.env*`、store data、DB、backupへの接触なし。
- main wiring/integration checks:
  - `bash scripts/local-ci.sh full`
  - Ready後の exact-HEAD hosted final。

## Boundary / Wire Contract

- producer: `.node-version`
- consumer: local version manager / `actions/setup-node@v6`
- wire type: UTF-8 text、単一 exact semver行
- internal type: Node runtime version
- precision/range: exact `24.18.0`; `package.json#engines.node` / `package.json#devEngines.runtime.version` は `>=24 <25`
- round-trip path: pin -> local Node / CI Node -> npm scripts / frontend gates
- invalid input: pin欠落、非semver、workflow literal override、manifest major mismatchはstatic test failure
- compatibility: package-lock format、application output、CI routingは不変

## Review Focus

- `.node-version` が本当に単一 owner であり、workflow / manifest が独立したversion literalへ戻れないか。
- `devEngines.runtime` が Node 24 以外の日常 `npm run` を実際に止め、single owner と major contract の役割分担が静的検査で固定されるか。
- Node runtime 24、`@types/node` 24、TypeScript / Vite / Vitest の実行互換が実証されるか。
- D-030 の named update / cooldown / no-force契約を破っていないか。
- workflow差分がruntime source差替えだけで、event / permissions / gate semanticsを変えていないか。
- DEV_SETUPのlive contractとarchive / 退役履歴を正しく区別しているか。

## Implementation Results

- `.node-version`をexact Node pinのsingle ownerとし、package manifestのNode major contractと役割を分離した。
- `devEngines.runtime`の`onFail: error`により、Node 24以外の通常npm commandを実行前に拒否する。
- frontend CIとnpm security monitorは同じ`.node-version`を`actions/setup-node@v6`へ渡す。
- workflow static testはpin、manifest、`@types/node`、両workflowの片側driftを個別mutationで拒否する。
- direct `@types/node`と同一dependency familyだけをNode 24互換版へ更新した。

## Review Response

- Findings Freeze: frozen 2026-07-30; post-freeze exceptions: none。

## Narrative

- 2026-07-30 owner kickoff: Node 24一本化を先行し、Dependabotで一次監視済みのRust `cargo audit`は別changeとする方針を確定。介入1/3、relay 0/2。Plan Reviewer / Final ReviewerはClaude Sonnet 5 fresh contextとする。
- 2026-07-30 Plan Gate review（relay 1/2）: Claude Sonnet 5 fresh context が REQUEST CHANGES（P1=1 / P2=2 / P3=1）。live §4.5 の Node 20 残存を Node 24.18.0 へ是正し、追加 sweep で見つけた live Node 22 backlog 4 箇所も active Node 24 change へ同期。ローカル継続一致は npm 現行仕様と Node 25.8.2 の隔離 probe を根拠に `devEngines.runtime` fail-fast を採用し、user-wide default 変更と install 時のみの `engine-strict` 単独案を不採用。未参照の root Docker 構成は明示 Non-scope + backlog 化し、workflow static test は両 workflow を個別に覆うことを計画へ追記した。Phase は `plan-gate`、Plan Commit は `pending` のまま fresh closure review を待つ。
- 2026-07-30 Plan Gate closure（relay 2/2）: Claude Sonnet 5 / xHigh の fresh context が reviewed state HEAD `056795fd36c761d1f39d10abe2a2ece11f1b1779` を read-only closure reviewし、Verdict APPROVE、P1/P2/P3=0。Coordinator は live file、npm 11.11.1実装、公式npm CLI契約、`bash scripts/doc-consistency-check.sh --target plan`を独立再確認し、承認を妨げない evidence wording 2点（active Packet自身のNode 22説明を除外していない「hitゼロ」表現、`Plans.md`の現行行番号137→140）だけを補正して受理した。ownerはrepository外local tool cacheへのNode 24.18.0導入を介入2/3として承認。Plan-first commit `2047400` とclosure commit `056795f` が実装より先行することを確認し、`plan-gate -> plan-approved -> implementing`をmaterializeした。
- 2026-07-30 implementation: Node.js公式release-keysで署名fingerprintを照合し、user keyringを変更しない隔離GPG keyringでNode 24.18.0のGood signatureとchecksumを確認してmise local cacheへ導入した。static contract testをRED（pin不存在）から開始し、pin / manifest / workflow実装後にGREEN化。Node 25 mismatchは`EBADDEVENGINES`、Node 24 matching runtimeはfrontend targeted gatesを通過し、lock差分は`@types/node`と同一familyに限定した。
- 2026-07-30 owner budget exception: Plan Gateの初回reviewとclosureでrelay既定上限2回を消費した一方、Workflow Stateで割当済みの必須Final Reviewerが未実施だったため、ownerが介入上限を3回から4回、relay上限を2回から3回へ今回限り拡張した。介入3/4はDraft PR公開とexact content HEADへのClaude Sonnet 5 fresh-context Final Review 1往復に限定し、介入4/4はP1/P2=0後のReady / merge一括承認用に予約する。scope、実装契約、hosted requirementは変更しない。
- 2026-07-30 formal Final Review（relay 3/3）: Claude Sonnet 5 / xHigh fresh contextがDraft PR #46のcontent HEAD `d6ae17b1465005b2e9e0faa1f90c76edd979e19a`をread-only監査し、Verdict APPROVE、P1/P2/P3=0。Coordinatorはlive diff 9 file、PR headRefOid、Node contract文言、workflow/static-test差分、working tree CLEANを独立再確認して受理した。reviewer観察のNode不一致時に`npm view`も拒否される挙動は、source docが保証する`install` / `ci` / `run`の最小契約より広いfail-fastであり方針と互換。review用local branch `pr-46-review`と既存prunable worktreeはcandidate差分・current HEAD・working treeを変更していないため本changeでは削除しない。
- 2026-07-30 implementing -> local-verified -> independent-review -> human-confirm（state-only compression）: reviewed content HEADのL1 full CLEAN evidenceはPR #46 body、Final ReviewerはP1/P2=0。`Reviewed Content HEAD`を`d6ae17b1465005b2e9e0faa1f90c76edd979e19a`へ固定し、Findings Freezeを発効した。Ready / hosted final / mergeは未承認のままowner gateへ進む。
- 2026-07-30 owner Ready / merge一括承認（介入4/4）: ownerがFinal Review P1/P2=0を受け、Ready化、required hosted final、三点SHA一致後のmerge、Post-Merge Closeoutを一括承認した。追加owner判断は不要だが、各preconditionとmerge gateは省略しない。
- 2026-07-30 human-confirm -> ready-hosted-final: 本state-only commitをDraftのまま作成し、そのexact HEADでL1 fullを再実行してPR bodyを更新する。同一HEADをReady化してrequired hosted finalを起動し、live PR HEAD、PR bodyのLocal full evidence HEAD SHA、hosted run headShaの三点一致とmerge CLEANを確認してから承認済みmergeを実行する。
