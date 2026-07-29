# Plan Packet: PK3 negative-glob false WARN correction（wave 4 lane 3）

## Workflow State

- Phase: plan-gate
- Risk: R2
- Execution Mode: codex-only
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・裁定・Registry/train管理）
- Writer: Codex（plan-approved後の専用worktree / terminal W4-L3）
- Plan Reviewer: Codex fresh context（read-only、Writer非関与）
- Final Reviewer: Codex fresh context（Plan Reviewerとは別context、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending Ready / merge

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> plan-draft: ownerが既存backlogのPK3偽WARNをwave 4 lane 3に選定（介入1/3）。`test_token_exists()`の壊れたnegative glob除去とdeterministic fixtureだけを扱い、PK3の探索root、regex、WARN、exit、PK4/merge判定は不変。production実装はPlan Gate前につき禁止。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix、2 content file、version非依存fixture、workflow hosted requirementをCoordinatorが確認した。plan-first content commitへ固定し、fresh Codex Plan Reviewへ進む。
- 2026-07-29 Plan Review round 1: P1=0 / P2=1。単一引用表記だけの静的guardでは`-g`や引用符違いの同義mutationが生存するため、PATH上のrg shimでhelper実行時argvを捕捉して全negated-glob表記を拒否するportable guardとsyntax-equivalent mutation tableへ補強した。Plan Gateは未通過のまま再レビューする。
- 2026-07-29 Plan Review round 2: P1=0 / P2=1 / P3=1。ripgrepが受理する`-qg PATTERN` / `-qgPATTERN` short-option clusterがargv parserから漏れ、Trace Matrixも旧static表記だった。value-taking `g`を含むshort cluster全体へparserとmutationを拡張し、runtime argv oracleへ記述を同期して再レビューする。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 4起票）、relay 0/2

## Risk

Risk: R2

local developer workflowのWARN精度だけを直す。PK3はWARN-onlyでexit codeとmerge可否を変えず、runtime contractも変えないためR2。PK3/PK4 enforcement、探索root、regex、exit semanticsへ拡張した場合はR3へ戻す。

## Goal

Goal Invariant: R3/R4 Trace Matrixに記載した実在test tokenを`tests` / `src` / `src-tauri`から検出し、ripgrep negative-glob optionに起因する偽WARNを出さない。欠落tokenは従来どおりWARN、checkerはexit 0とする。

### 最小完了条件

- `test_token_exists()`から3つのnegative `--glob`だけを除去
- valid tokenはWARNなし、ignored subtreeだけのtokenはmissing WARN、いずれも既存exit semantics
- deterministic fixtureがversion固有のrg再現に依存せず再導入mutationをkill

### 失敗定義

- 実在tokenがWARN、欠落tokenが無警告
- root / regex / ignore behavior / WARN text / exit code / PK4が変わる
- version pin、checker refactor、別PK改訂へscopeが広がる

### 非目的

- ripgrep更新・version pin
- token文法、探索root、PK3/PK4/Workflow Stateの拡張
- CI/classifier、source docs、他checkerの変更

## Scope

- `scripts/doc-consistency-check.sh`: `test_token_exists()`のnegative glob 3個削除だけ
- `scripts/tests/doc-consistency-plan-packet.test.sh`: temp PATHのrg shimがreal rgへ委譲しつつargvを記録し、末尾rootが`tests src src-tauri`のhelper呼出しについてlong optionと、`-g` / `-qg`等のvalue-taking `g`を含むshort-option cluster（pattern別token / attached双方）をripgrep option grammarとして解析し、先頭`!` patternがないことをsource上の引用符非依存で検査するguard、3 root valid canary、fixture自身が`.gitignore`を生成するignored-only missing WARN / exit 0 fixture
- 本Packet / Matrix。`Plans.md`とWorkflow StateはCoordinatorのみ

## Non-scope

- 上記2 content file以外
- `scripts/local-ci.sh`, `pre-push.sh`, classifier, workflow YAML
- PK3 message / severity / exit、PK4、other doc checks
- generated artifacts、product source docs

## Acceptance Criteria

- rg shimが捕捉したhelper実行時argvに、long option、任意short-option cluster内のvalue-taking `g`、separate/equals/attached、source上のsingle/double/unquotedを問わず先頭`!`のglob patternが0
- `tests` / `src` / `src-tauri`の固有tokenを記載したsynthetic R3 packetが各tokenのmissing WARNを出さずexit 0
- gitignored `target` / `node_modules` / `dist`だけにあるtokenはexact missing WARNを出しexit 0
- existing `scripts/tests/doc-consistency-plan-packet.test.sh`全体PASS
- `--glob '!…'` / `--glob="!…"` / `--glob=!…` / `-g '!…'` / `-g!…` / `-qg '!…'` / `-qg!…`の同義negative glob再導入、root削除、regex破壊、`--no-ignore`、WARN抑止、exit 1 mutationが対応fixtureをredにする
- `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-29-pk3-negative-glob-false-warn.md` PASS
- `bash scripts/local-ci.sh full` CLEAN、hosted final required

## Design Sources

- Workflow: `docs/DEV_WORKFLOW.md` Plan Packet / PK3 WARN semantics
- Backlog: `Plans.md` Tooling follow-up
- Executable SSOT: `scripts/doc-consistency-check.sh`
- Existing fixture harness: `scripts/tests/doc-consistency-plan-packet.test.sh`

## Required Design Artifacts

| Area | Artifact | Status |
|---|---|---|
| PK3 behavior | existing checker + DEV_WORKFLOW | existing sufficient |
| regression oracle | Test Matrix / existing fixture suite | added in plan-first |
| runtime/product/source design | N/A | unchanged |

## Registration / Generation Obligations

該当なし。新script / source doc / route / command / REQ coverageを追加しない。

## Design Intent Trace

| Contract | Source | Implementation | Test |
|---|---|---|---|
| PK3 valid token detection | checker helper | negative glob removal | valid root canaries |
| PK3 missing WARN / exit0 | checker final branch | unchanged | ignored-only token fixture |
| scope guard | Plan / D-055 | two content files | runtime argv guard + git diff |

## Design Intent Audit

- durable semanticsは既存DEV_WORKFLOW / checkerから復元可能で変更なし
- external rg bugを新しいcontractへ昇格せず、desired behaviorをfixture化する
- lane 3はsource docs / generated artifactsへ触れない

## Impact Review Lenses

not applicable — 外部premiseを実装判断に使わず、deterministic local fixtureだけで閉じる。

## Design Readiness

- Existing design docs are sufficient because: PK3はheuristic WARNでexit 0と既存checkerが定義
- Source docs updated in this PR: none
- Design gaps intentionally deferred: PK4 registry extraction gap、Workflow State field coverage gap
- Workflow effectiveness: wave 4 WERへ含め、lane 1の実R3 packetで偽WARNがないことをdogfood

## Contract Probe

- N/A: rg 15.1再現を外部premiseにせず、command shapeとobservable behaviorをfixtureで固定する

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-07-29-pk3-negative-glob-false-warn.md`

- targeted: doc-consistency plan packet fixture suite
- negative: ignored-only token / missing WARN / exit 0
- mutation: negative glob、root、regex、ignore、WARN、exit
- full: workflow classified L1 + hosted final

## Boundary / Wire Contract

not applicable — runtime wire / config / manifest不変。checker CLIのWARN/exit contractだけを既存同値で維持する。

## Review Focus

- 3 negative glob以外のhelper byte semanticsが変わっていないか
- fixtureがcurrent rgの偶然の挙動に依存していないか
- missing tokenとignored subtreeのoracleが逆転していないか
- R3へ昇格するscope creepがないか

## Spec Contract

Contract ID: SPEC-WF-PK3-TOKEN

- valid token across 3 roots => no missing WARN
- ignored-only / absent token => missing WARN
- WARN-only => exit 0

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-PK3-TOKEN | glob removal | valid canaries | false WARN 0 | fixture log |
| SPEC-WF-PK3-TOKEN | ignore preservation | ignored-only token | missing WARN + exit0 | fixture log |
| D-055 | two-file scope | runtime argv guard + git diff | footprint disjoint | fixture log + git diff |

## Data Safety

- repo外データ、secret、DB、backup非接触
- fixtureは`mktemp`配下のsynthetic repositoryだけ
- rollbackはlane implementation commitのrevert
