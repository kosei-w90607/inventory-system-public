# Plan Packet: request builder shared primitives（監査順21 / P1-4、wave 4 lane 2）

## Workflow State

- Phase: plan-gate
- Risk: R2
- Execution Mode: codex-only
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・裁定・Registry/train管理）
- Writer: Codex（plan-approved後の専用worktree / terminal W4-L2）
- Plan Reviewer: Codex fresh context（read-only、Writer非関与）
- Final Reviewer: Codex fresh context（Plan Reviewerとは別context、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending Ready / merge

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> plan-draft: ownerがwave 4 lane 2として順21 P1-4を選定（介入1/3）。4 request builderの同一primitiveだけを共通化し、payload、validation、key lifecycle、画面は不変。61〜64の既存source docsは十分で、production実装はPlan Gate前につき禁止。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix、4 consumer境界、REQ-201〜204 traceability再生成義務、generated artifact専有をCoordinatorが確認した。plan-first content commitへ固定し、fresh Codex Plan Reviewへ進む。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 4起票）、relay 0/2

## Risk

Risk: R2

4 featureを横断する内部helper refactorだが、wire、route、operator workflow、key保持/rotation、validation意味論は不変。共有APIと4 consumerの接続を扱うためtricky R2としてMatrixと独立reviewを使う。

## Goal

Goal Invariant: 入庫・手動販売・廃棄・返品交換のrequest builderに重複するprefixed idempotency key、local `YYYY-MM-DD`、strict safe integer parserを1 ownerへ集約し、4業務の外部挙動を完全に維持する。

### 最小完了条件

- `src/lib/request-helpers.ts`が3 primitiveの唯一のimplementation
- 4 request fileはfeature固有wrapper/prefixとDTO組立だけを所有
- 4 builderのpayload、拒否集合、validation文言、signature、初期日付、retry/key rotationが不変
- 新規helper testにREQ-201/202/203/204を付与し、`90-traceability.md`を本wave唯一のgenerated artifactとして更新

### 失敗定義

- prefix、fallback key shape、local date、integer grammar / min / safe rangeが変わる
- request payload、null正規化、signature、error文言、Page lifecycleが変わる
- 4 target fileのいずれかにprimitiveのlocal bodyが残る

### 非目的

- builder固有rule、row normalization、confirmation token、receipt pathの共通化
- Page側key lifecycle、CMD/BIZ/DB、wire、route、UI変更
- 他featureのdate/number/UUID helper一般化

## Scope

- add `src/lib/request-helpers.ts`
  - `createPrefixedIdempotencyKey(prefix)`
  - `getLocalDateString(date = new Date())`
  - `parseRequiredSafeInteger(value, min)`
- update four request files under receiving / manual-sale / disposal / return-exchange
- feature固有`create*IdempotencyKey` wrapperと既存`getLocalDateString` import surfaceは維持する
- add `src/lib/request-helpers.test.ts`（behavior + four-consumer ownership guard）
- run existing request/Page regression tests without weakening
- regenerate `docs/function-design/90-traceability.md`
- 本Packet / Matrix。`Plans.md`とWorkflow StateはCoordinatorのみ

## Non-scope

- 4 Page production files、feature `types.ts`、generated bindings、route tree
- source docs 61〜64の契約変更（Design Readiness引用のみ）
- row-utils、threshold parser、formatter、dependency / lockfile
- 順21 P1-3、順16

## Acceptance Criteria

- UUID pathは`${prefix}-${uuid}`、fallbackは`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`と同値
- local dateはlocal calendar getterで`YYYY-MM-DD`、UTC getterを使わない
- integer parserはtrim後ASCII digits、safe integer、inclusive `>= min`
- four request filesで`randomUUID` / calendar getter / `Number.isSafeInteger`のlocal implementationが0
- new helper testと4 existing request/Page family testsがPASS
- `cargo run --bin generate_traceability`後、`cargo run --bin generate_traceability -- --check` PASS
- bindings / route tree差分0、`90-traceability.md`だけがgenerated差分
- frontend full、docs/plan check、`bash scripts/local-ci.sh full` CLEAN

## Design Sources

- Requirements: REQ-201/202/203/204
- Function/UI: `61-ui-receiving.md`、`62-ui-manual-sale.md`、`63-ui-return-exchange.md`、`64-ui-disposal.md`
- Audit: `docs/research/audit-2026-07/report.md` 順21 P1-4、`findings/p1-reuse-boundaries.md`
- Architecture / DB / wire: unchanged

## Required Design Artifacts

| Area | Artifact | Status |
|---|---|---|
| 4 workflow validation / key lifecycle | function docs 61〜64 | existing sufficient |
| shared primitive ownership | 本planのimplementation boundary | refactor-only、durable behavior decisionなし |
| wire / DB / screen | existing docs | unchanged |

## Registration / Generation Obligations

- 新規FE testにREQ-201/202/203/204を付与する
- `cargo run --bin generate_traceability`で`90-traceability.md`を再生成する
- bindings / route treeは再生成対象外で、diff 0を確認する

## Design Intent Trace

| Spec | Source | Implementation | Test |
|---|---|---|---|
| REQ-201 | 61 | shared helper + receiving wrapper | helper + receiving tests |
| REQ-202 | 63 | shared helper + return wrapper | helper + return tests |
| REQ-203 | 62 | shared helper + manual-sale wrapper | helper + manual-sale tests |
| REQ-204 | 64 | shared helper + disposal wrapper | helper + disposal Page test |

## Design Intent Audit

- 4 source docsがinteger境界、今日、1保存試行単位keyを既に規定
- helper path/APIは内部実装判断で、source contract変更なし
- generated artifactは本laneが専有し、lane 1/3は90を触らない
- P1-3と他helper一般化はdefer

## Impact Review Lenses

not applicable — external format、実機、operator workflow、data lifecycleの変更なし。

## Design Readiness

- Existing design docs are sufficient because: 61〜64が維持対象の業務挙動を定義済み
- Source docs updated in this PR: none
- Design gaps intentionally deferred: 他primitive一般化、P1-3
- wire / persistence / wording / recovery: unchanged

## Contract Probe

- N/A: external premiseとcross-language contract変更なし

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-07-29-request-builder-primitives.md`

- targeted: new helper test + four existing families
- compatibility: exact payload/error/signature/key lifecycle
- mutation: UUID/fallback/date/integer branchとconsumer ownership
- full: frontend、traceability generation/check、docs、L1

## Boundary / Wire Contract

- producer: form strings / prefix / Date
- consumer: four generated request DTO builders
- wire type: generated DTO shape不変
- precision/range: JS safe integer、inclusive min 0/1
- compatibility: payload/null/signature/error不変

## Review Focus

- shared helperが現行edge behaviorを変えていないか
- feature固有ruleやPage lifecycleへscope creepしていないか
- static ownership guardが4 targetだけを正確に検査するか
- 90が本wave唯一のgenerated artifactか

## Spec Contract

Contract ID: SPEC-UI-REQUEST-PRIMITIVES

- 3 primitiveのsingle implementation
- four external request contractsはbyte-semantic equivalent
- feature prefixはreceiving/manual-sale/disposal/return

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-201..204 | helper extraction | request-helpers.test.ts | exact primitive behavior | targeted |
| SPEC-UI-REQUEST-PRIMITIVES | 4 consumer wiring | static ownership guard | local body 0 | targeted + rg |
| D-055 | traceability generation | generate/check | generated lane専有 | git diff |

## Data Safety

- DB / CSV / backup /実データ非接触
- rollbackはlane implementation commitのrevert
- synthetic Date/UUID/number fixtureのみ
