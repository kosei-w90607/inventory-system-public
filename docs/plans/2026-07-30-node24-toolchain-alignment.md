# Plan Packet: Node 24 toolchain alignment

## Workflow State

- Phase: plan-gate
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: Claude Sonnet 5 fresh context
- Final Reviewer: Claude Sonnet 5 fresh context
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending local Node 24 installation / Ready / merge

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

内訳:

1. Node 24 一本化を先行し、Rust `cargo audit` は別 change とする方針の決定（実施済み、介入 1/3）
2. repository 外の local tool cache へ Node 24.18.0 を導入する承認（pending）
3. Ready / merge の一括承認（pending）

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
- `package.json` に Node 24 major の `engines.node` contract を追加する。
- `@types/node` を cooldown 済みの 24 系へ名指し更新し、必要な同一 dependency family の lockfile 差分だけを受け入れる。
- `.github/workflows/ci.yml` と `.github/workflows/npm-security-monitor.yml` の `actions/setup-node@v6` を `.node-version` 参照へ統一する。
- `scripts/tests/ci-workflow.test.sh` に、両 workflow と manifest が単一 pin / Node 24 contract から drift しない静的検査を追加する。
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

## Acceptance Criteria

- `.node-version` が `24.18.0` を一意に保持し、両 `setup-node@v6` が `node-version-file: .node-version` を使う。
- `package.json` の `engines.node` が Node 24 major のみを許容し、direct `@types/node` が 24 系である。
- live source（archive と退役履歴を除く）に `node-version: 20`、Node 20 CI contract、未着手 Node 22 migration backlog が残らない。
- `scripts/tests/ci-workflow.test.sh` が pin / workflow / manifest の片側 drift で red になる。
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
| TOOL-NODE24-D1 | `DEV_SETUP_CHECKLIST.md` §1.1 / §1.2 / §4.2 | TOOL-NODE24-D1 | EOL の Node 20 / 25 と major-only floating sources を退役し、現行 LTS の exact pin を単一 owner にする。Node 22 は LTS だが Node 24 より support runway が短いため不採用 | `.node-version`, `package.json`, workflows | `scripts/tests/ci-workflow.test.sh` |
| TOOL-NODE24-D2 | `docs/ci.md` Verification Ladder | TOOL-NODE24-D2 | CI routingを変えず実行runtimeだけを交換する。別 workflow やmatrix追加は scope過大 | `.github/workflows/ci.yml`, `npm-security-monitor.yml` | workflow static test + hosted final |
| TOOL-NODE24-D3 | `decision-log.md` D-030 | TOOL-NODE24-D3 | `@types/node` は24系を名指し更新し、force / blanket updateを使わない | `package.json`, `package-lock.json` | lock diff review + frontend full |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。現運用の version / setup contract は `DEV_SETUP_CHECKLIST.md` へ反映する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: exact pin と Node 24 contract を `DEV_SETUP_CHECKLIST.md` へ反映。D-030 は既存正本で十分。
- Assumptions and constraints: Node 24.18.0 は現行 LTS。`actions/setup-node@v6` は `.node-version` を `node-version-file` で読める。`@types/node@24.13.3` は7日 cooldown済み。
- Deferred design gaps, risk, and follow-up target: user-wide shell の default 切替は無断実施せず、local verification は owner承認後に repository pin を使って行う。Rust monitor は次 change。
- Test Design Matrix can cite design decision IDs or source doc sections: R2のためMatrixは作らず、本packet Test Planで3 decisionをcoverする。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: archive / 退役 Docker例の historical Node 20 は live contract sweep から除外する。

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
  - Node 24.18.0 で `npm ci --ignore-scripts`
  - `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
- negative tests:
  - workflow片側を一時的に literal Node 20へ戻す、またはmanifest majorを25へ戻す mutationでstatic testがredになることを確認し、即時復元する。
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
- precision/range: exact `24.18.0`; `package.json#engines.node` は `>=24 <25`
- round-trip path: pin -> local Node / CI Node -> npm scripts / frontend gates
- invalid input: pin欠落、非semver、workflow literal override、manifest major mismatchはstatic test failure
- compatibility: package-lock format、application output、CI routingは不変

## Review Focus

- `.node-version` が本当に単一 owner であり、workflow / manifest が独立したversion literalへ戻れないか。
- Node runtime 24、`@types/node` 24、TypeScript / Vite / Vitest の実行互換が実証されるか。
- D-030 の named update / cooldown / no-force契約を破っていないか。
- workflow差分がruntime source差替えだけで、event / permissions / gate semanticsを変えていないか。
- DEV_SETUPのlive contractとarchive / 退役履歴を正しく区別しているか。

## Implementation Results

pending

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none。

## Narrative

- 2026-07-30 owner kickoff: Node 24一本化を先行し、Dependabotで一次監視済みのRust `cargo audit`は別changeとする方針を確定。介入1/3、relay 0/2。Plan Reviewer / Final ReviewerはClaude Sonnet 5 fresh contextとする。
