# Plan Packet: D-058 Fable slot 不在編成の相談窓口役

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex
- Writer: Codex
- Plan Reviewer: Claude Sonnet 5 / xHigh fresh context
- Final Reviewer: Double Audit（Claude Sonnet 5 / xHigh fresh context + Claude Opus 5 / xHigh fresh context・D-056 §5.4低制約profile）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none（ownerはD-058方針と理由付き改定を承認済み。次のowner判断はFinal Review P1/P2=0後のReady / merge）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 4

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

relay 上限は、Plan Gate 1往復 + 必要時のclosure 1往復 + workflow gate changeのDouble Audit 2 passをownerが別sessionへ渡す必要があるため4とする。ownerのD-058採用・理由付き改定承認を介入1/3として記録する。

## Risk

Risk: R3

Reason:
docs-onlyだが、D-056でread-only claims-producerに限定した高自律・低制約適性 slotへ、条件付きのmain-thread窓口とsubagent生成権限を追加するworkflow gate change。Coordinator、Writer、state遷移、merge、finding裁定の権限境界とDEV_WORKFLOW `Subagent Budget`の実効性を誤ると、自己承認・無制限委譲・one-writer違反へ直結する。

## Goal

Goal Invariant:

### 最小完了条件

- `dual-vendor-no-fable`編成に限り、高自律・低制約適性 slotが、Coordinator作成・owner逐語relayのread-only発注書を改変せずsubagentへ投入し、結果を判定材料として集約できる。
- main-threadに置かれても、Coordinator / Writer / state遷移 / merge / findings最終裁定の権限を得ず、既存Subagent Budgetを緩和しない。

### 失敗定義

- Fable稼働編成でも本役が有効になる、発注書を起草・変更できる、出所または数値上限が曖昧な発注書を投入できる、write taskを子へ渡せる、既存per-risk / wave / depth / one-writer上限を越えられる、または集約結果を最終裁定・state遷移・mergeへ使えるように読める。

### 非目的

- 高自律・低制約適性 slotをCoordinator代役またはWriterへ昇格しない。
- DEV_WORKFLOWのSubagent Budget、Workflow State、Wave Operation、Contract Audit、owner Human Gateを変更しない。
- model slot対応表、D-056の低制約profile 5点構成、security隣接の敵対的レビュー経路を変更しない。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/decision-log.md`へD-058をappendし、owner確定判断、適用条件、許可責務、禁止権限、rollback / revisitを正本化する。
- `docs/AGENT_OPERATING_MANUAL.md`:
  - §3の高自律・低制約適性 slot項末尾へ、Fable slot不在編成では§5.5を兼ねる参照を追加する。
  - §5.4 item 5へ、§5.5だけが既定0の例外になり得ることと、Coordinator指定の数値上限が必要なことを追記する。
  - §5.5「相談窓口役（Fable slot不在編成のみ）」を新設する。
- §5.5は次を明文化する:
  - 有効条件はPlan Packet `Execution Mode: dual-vendor-no-fable`。`fable-window` / `codex-only`では無効。
  - 許可責務は全体把握、発注書への観点指摘、Coordinator作成・owner逐語relayの発注書投入、結果集約・判定材料整理、D-056既定の難所レビュー。
  - 発注書の起草・改変、レビュー対象選定、発注内容決定、優先順位付け、state遷移管理、merge、Writer作業、findings最終裁定は禁止。
  - 指摘で発注書変更が必要なら投入せず、Coordinatorが再作成しownerが再relayするまでfail-closedとする。
  - 投入対象と生成subagentはread-only。main-thread配置はwrite権限またはCoordinator権限を与えない。
  - Coordinatorがtarget changeのRisk / stageに応じた数値上限を発注書へ明記した場合だけ§5.4既定0を置換できる。生成subagentはtarget changeのDEV_WORKFLOW `Subagent Budget`へ算入し、per-risk、wave合計、depth、one-writerを超えない。
  - Fable slotが投入前に復帰した場合は投入しない。投入後に復帰した場合は既存read-only結果の集約だけを完了し、新規subagentを生成しない。
- `docs/PROJECT_HANDOFF.md`へD-058を追加し、D-056をCoordinator代役不採用のまま拡張する関係を同期する。
- `docs/Plans.md`をactive Packetとphaseへ同期する。
- Test Design Matrixのanchor / negative mutationを実測し、Double Auditとhosted finalを行う。

## Non-scope

- `docs/DEV_WORKFLOW.md`、`docs/ci.md`、scripts、hooks、skills、agent-guidance、GitHub Actionsの変更
- §2のrole定義、§3.1 design board、§3.2 Execution Mode enum、§3.3 capacity-degraded、§3.4 model slot対応表、§5.4の5点構成
- 実際の相談窓口role運用開始、subagent起動、review発注、Fable / Sonnet / Opus session生成
- application、Rust、frontend、DB、wire、UI、依存関係

## Acceptance Criteria

- `rg -F 'Fable slot 不在編成では §5.5 の相談窓口役を兼ねる（D-058）' docs/AGENT_OPERATING_MANUAL.md`がhitする。
- `rg -F '### 5.5 相談窓口役（Fable slot 不在編成のみ）' docs/AGENT_OPERATING_MANUAL.md`がhitする。
- §5.5が`dual-vendor-no-fable`だけを有効条件とし、`fable-window` / `codex-only`を明示的に除外する。
- §5.5が許可責務4群、禁止権限7群、Coordinator作成 + owner逐語relay + 改変禁止 + 再relayまでfail-closedを明示し、Matrix `A4` / `A5` / `A9` / `A10`がexit 0になる。
- §5.5がread-only子だけを許可し、write task、Writer権限、main-thread位置からのCoordinator権限導出を拒否し、Matrix `A8` / `A10`がexit 0になる。
- §5.4 item 5と§5.5が「必要な数」だけの無界表現を使わず、Coordinator明記の数値上限とDEV_WORKFLOW `Subagent Budget`への算入を要求する。
- `git diff --quiet origin/main -- docs/DEV_WORKFLOW.md docs/ci.md scripts/ .github/`がexit 0で、既存workflow gate実装に差分がない。
- `docs/plans/test-matrices/2026-07-30-d058-consultation-relay-role.md`のX1〜X10が対応anchor / guardをnon-zeroへ反転し、復元後exit 0・`git status --short`空となる。
- `bash scripts/doc-consistency-check.sh`、`bash scripts/doc-consistency-check.sh --target plan`、`bash scripts/check-workflow-git.sh`、L1 fullがPASSする。
- workflow docs changeのため、Ready後のexplicit dispatchによるhosted finalが`headSha == Local full evidence HEAD SHA`かつ`conclusion: success`になる。

## Design Sources

- Requirements / spec: N/A（workflow governance only）
- Architecture: `docs/AGENT_OPERATING_MANUAL.md` §2 / §3 / §5.4 / §6
- Function / command / DTO: N/A
- DB: N/A
- Screen / UI: N/A
- Decision log / ADR: `docs/decision-log.md` D-034 / D-038 / D-055 / D-056 / D-058 owner確定案
- Workflow: `docs/DEV_WORKFLOW.md` Workflow State / Contract Audit / Subagent Budget / Owner Effort Budget / Draft PR Checkpoint

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in PR / intentionally deferred |
|---|---|---|
| role assignment / prompt profile | `docs/AGENT_OPERATING_MANUAL.md` | updated in implementation change |
| durable owner decision | `docs/decision-log.md` D-058 | updated in implementation change |
| workflow limits | `docs/DEV_WORKFLOW.md` Subagent Budget | existing sufficient・変更禁止 |
| live handoff / dashboard | `docs/PROJECT_HANDOFF.md`, `docs/Plans.md` | updated in implementation change / plan-first |
| test design | linked Test Design Matrix | created plan-first |

## Registration / Generation Obligations

該当なし。source / workflow docの新設・改名、REQ、route、binding、function-design登録は行わない。§5.5は既存Manual内の新sectionであり、§3と§5.4から双方向に参照可能な位置へ接続する。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-D058-D1 | Manual §3 / §3.2 | D-058-D1 | Fable不在時だけownerのterminal交通整理を減らす。Fable稼働時併用とcodex-only適用は却下 | Manual §3 / §5.5 | A1/A2/A3, X1/X8 |
| SPEC-WF-D058-D2 | Manual §2 / §5.5 | D-058-D2 | 相談・逐語relay・集約だけを許し、main-thread位置から指揮権限を導出しない | Manual §5.5 | A4/A5, X2/X4 |
| SPEC-WF-D058-D3 | Manual §5.4 / §5.5 | D-058-D3 | 曖昧な「必要な数」ではなくCoordinator指定の数値上限 + 既存budget算入で閉じる | Manual §5.4 item 5 / §5.5 | A6/A7, X5/X6 |
| SPEC-WF-D058-D4 | Manual §3 D-056 boundary / §5.5 | D-058-D4 | D-056 read-only境界をroleの子へ継承し、Writerの間接委譲を許さない | Manual §5.5 | A8, X7 |
| SPEC-WF-D058-D5 | decision-log D-056 / D-058 | D-058-D5 | Coordinator代役不採用を維持した限定拡張。指摘反映はCoordinator再作成 + owner再relayのみ | decision-log D-058 / Manual §5.5 | A9/A10, X3/X9 |
| SPEC-WF-D058-D6 | decision-log D-058 rollback/revisit | D-058-D6 | 権限越境時は助言限定へ戻し、Fable復帰時は新規投入を止める | decision-log / Manual §5.5 | A11/A12, X8/X10 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: implementation後はManual §3 / §5.4 / §5.5とdecision-log D-058で復元可能。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: mode判定、逐語relay、read-only継承、数値上限、Fable復帰時のin-flight処理をD-058 / §5.5へ昇格する。
- Assumptions and constraints: D-056のroleはread-onlyのまま。`dual-vendor-no-fable`が対象編成を表し、数値閾値の正本はDEV_WORKFLOWだけ。
- Deferred design gaps, risk, and follow-up target: 実運用の有効性とowner負荷は最初のD-058実発注後にWERまたはdecision revisitで評価する。
- Test Design Matrix can cite design decision IDs or source doc sections: D-058-D1〜D6とManual sectionを直接参照する。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: §5.4既定0の唯一の例外を§5.5へ限定し、数値上限、target budget算入、depth 1、read-only、Fable復帰停止を併記する。`--force`相当のescape hatchは設けない。

## Impact Review Lenses

not applicable — external device / POS / CSV / operator workflow / data lifecycleを変えないworkflow governance docs-only change。agent authority lifecycleはMatrixのState Lifecycleで扱う。

## Design Readiness

- Existing design docs are sufficient because: Manualがrole assignmentとprompt profile、DEV_WORKFLOWが数値budgetとstate / review gate、decision-logがdurable decisionをそれぞれ単独所有する。
- Source docs updated in this PR: Manual §3 / §5.4 / §5.5、decision-log D-058、PROJECT_HANDOFF。
- Design gaps intentionally deferred: D-058 roleの実運用評価。最初の実発注をdogfood targetとする。
- Durable decisions discovered in this plan and promoted to source docs: 「必要な数」の数値化、子read-only継承、Fable復帰時の新規投入停止。

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): application非接触。
- Backend function design: N/A。
- Command / DTO / data contract: 発注書のprovenance / immutable relay / numeric capをBoundary Contractとして扱う。
- Persistence / transaction / audit impact: N/A。
- Operator workflow / Japanese UI wording: N/A。
- Error, empty, retry, and recovery behavior: 出所不明、改変、cap欠落、mode不一致、write scopeは投入せずCoordinator再発行待ち。
- Testability and traceability IDs: SPEC-WF-D058-D1〜D6をMatrix anchor / mutationへ対応付ける。

## Contract Probe

N/A — 外部library / OS / hardware premiseなし。既存repository内のrole / budget契約だけを正本化する。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-058-D1 mode限定 | Manual §3 / §5.5 | Matrix A1〜A3 / X1 / X8 | L3 non-scope |
| D-058-D2 許可責務と禁止権限 | Manual §5.5 | Matrix A4/A5 / X2/X4 | L3 non-scope |
| D-058-D3 immutable provenance / fail-closed再relay | Manual §5.5 | Matrix A9/A10 / X3/X9 | L3 non-scope |
| D-058-D4 numeric cap / existing budget | Manual §5.4 item 5 / §5.5 | Matrix A6/A7 / X5/X6 | L3 non-scope |
| D-058-D5 read-only継承 / no indirect Writer | Manual §5.5 | Matrix A8 / X7 | L3 non-scope |
| D-058-D6 Fable復帰 / rollback / revisit | Manual §5.5 / decision-log D-058 | Matrix A11/A12 / X8/X10 | 初回実発注をdogfood |
| D-056 compatibility | Manual §3 / §5.4 / decision-log D-056 | Matrix N1〜N5 / G1〜G4 | Coordinator代役化はnon-scope |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-30-d058-consultation-relay-role.md](test-matrices/2026-07-30-d058-consultation-relay-role.md)

- targeted tests: A1〜A12 anchor / cross-file connection。
- negative tests: X1〜X10をclean treeへ1件ずつ注入し、対応assertion red、復元後greenを確認。
- compatibility checks: N1〜N5とG1〜G4でDEV_WORKFLOW / D-056 / §5.4 5点 / model mapping非改変を確認。
- data safety checks: docs-only、実データ / secrets / local-only evidence非commit。
- main wiring/integration checks: docs consistency full + target plan、workflow-git、L1 full、Ready後explicit hosted final。

## Boundary / Wire Contract

- producer: Coordinator
- consumer: §5.5相談窓口役、その子のread-only subagent
- wire type: ownerが逐語relayするCoordinator作成発注書（target change / Risk / stage / numeric subagent capを識別可能）
- internal type: immutable read-only task payload + provenance + bounded delegation metadata
- precision/range: capは非負整数。上限はtarget changeのDEV_WORKFLOW `Subagent Budget`以下
- round-trip path: Coordinator起草 -> owner逐語relay -> consultation role検査 -> read-only child投入 -> raw findings集約 -> Coordinator裁定
- invalid input: Coordinator作成を確認できない、owner逐語relayでない、内容が改変された、cap欠落/非数値/超過、write scope、mode不一致なら投入しない
- compatibility: D-056のread-only / no Coordinator / no Writer、Workflow State、Wave Operation、Contract Audit、Human Gateは不変

## Review Focus

- 「相談窓口」と「Coordinator代役」の境界が、main-threadという配置語に負けず明示されているか。
- §5.4 item 5例外が無制限委譲、depth 2、wave合計超過、one-writer迂回を許さないか。
- owner逐語relayとCoordinator再発行の境界が、相談時の観点指摘を実質的な発注書改変へ変えないか。
- read-only制約がrole本人だけでなく生成subagentへも継承されるか。
- Fable復帰時のin-flight集約が新規投入のescape hatchにならないか。
- D-056、§3.1〜§3.4、§5.4 5点、DEV_WORKFLOWに意図しない改変や矛盾がないか。

## Spec Contract

Contract ID: SPEC-WF-D058-2026-07-30

- D1: `dual-vendor-no-fable`だけで§5.5を有効にし、Fable稼働編成では使用しない。
- D2: 許可責務は把握・観点指摘・逐語relay投入・集約・難所レビューだけ。指揮判断、state、merge、Writer、最終裁定は禁止。
- D3: Coordinator作成・owner逐語relayの未改変発注書だけを投入し、変更が要る場合は再作成・再relayまで停止する。
- D4: subagent capは数値で、target changeの既存budgetへ算入する。§5.5以外は§5.4既定0。
- D5: roleと生成subagentはread-only。main-thread位置またはdelegationからwrite / Coordinator権限を導出しない。
- D6: 権限越境時は助言限定へrollbackし、Fable復帰後は新規subagentを生成しない。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| D-058-D1 | Manual §3 / §5.5 | A1〜A3, X1/X8 | activation boundary | Matrix実測 / PR body |
| D-058-D2 | Manual §5.5 | A4/A5, X2/X4 | no Coordinator代役 | Matrix実測 / PR body |
| D-058-D3 | Manual §5.5 | A9/A10, X3/X9 | immutable relay | Matrix実測 / PR body |
| D-058-D4 | Manual §5.4 / §5.5 | A6/A7, X5/X6 | bounded delegation | Matrix実測 / PR body |
| D-058-D5 | Manual §5.5 | A8, X7 | read-only inheritance | Matrix実測 / PR body |
| D-058-D6 | Manual / decision-log | A11/A12, X8/X10 | recovery / rollback | Matrix実測 / PR body |
| D-056 compatibility | unchanged sections | N1〜N5, G1〜G4 | adjacent contract drift | Matrix実測 / PR body |

## Data Safety

- 実POS CSV、店舗data、DB、backup、log、receipt image、secretをcommitしない。
- `.local/ci-evidence/`とreview transcriptはlocal-only。PR bodyにはbounded summaryだけを置く。
- mutationはtracked docsのsynthetic wordingだけに行い、毎回復元とtree cleanを確認する。

## Implementation Results

Fill after implementation.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

## Narrative

- 2026-07-30 kickoff -> design -> plan-gate: ownerがD-058案と理由付き改定を承認（介入1/3）。CoordinatorはR3 workflow gate change、Plan Packet + Matrix、Double Audit、hosted requiredと判定した。「必要な数」は無界なので、Coordinator指定の数値cap + target change budget算入へ補正。D-056 read-onlyを生成subagentへ継承し、Fable復帰時は新規投入停止とした。実装前にClaude Sonnet 5 / xHigh fresh-context Plan Gateへ渡す。
