# Plan Packet: Home orchestration 回帰 test（監査順10 / P8b-2、wave 3 lane 1）

## Workflow State

- Phase: plan-gate
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・レビュー裁定・Registry/train管理）
- Writer: Codex（plan-approved後の別session / worktree、lane 1 branchへpin）
- Plan Reviewer: Sonnet 5 fresh context（owner relay、read-only、実装非関与）
- Final Reviewer: Sonnet 5 fresh context（Plan Reviewerとは別fresh context、owner relay、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: wave batch Ready承認、lane merge承認（lane選定は介入1/3で完了）

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> design -> plan-draft: ownerが初の3 lane waveと順10をlane 1に選定（本lane介入1/3）。productionと53設計は一致するが、実hook / QueryClientを通るorchestration testがなくP8b-2が未閉鎖と再確認した。production behaviorと画面表示は変えず、3 test fileと53のtest contractだけを追加する。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix / `UI-00-D11`を完成し、3 lane footprint分離、Workflow State 13 field、Prettier、plan consistencyをCoordinatorが確認した。plan-first content commitで固定し、fresh Sonnet Plan Reviewへ進む。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 3 / lane 1 / 順10選定）、relay 0/2

## Risk

Risk: R2

既存UI-00挙動を変更せず、実production hook / QueryClient / generated command wrapperを通すfrontend testを追加するためR2。4 query独立性、派生値、部分障害、日付またぎの接続点を同時に固定するのでtricky R2とし、Matrixとfresh reviewを使う。Hosted CIはrequired。

## Goal

Goal Invariant: UI-00の4 queryが正しい引数とkeyで独立実行され、派生値、前日未取込み境界、visible復帰時の日付更新、2つの独立error toastを、production hookを全面mockしない3 test fileで固定する。production behaviorとoperator-visible UIは変えない。

### 最小完了条件

- `useHomeSummary.test.tsx`: 実hook + QueryClient + mocked commandsで4 query、派生値、部分障害を検査
- `useYesterdayDate.test.tsx`: fake local Date + visibility eventで日付またぎを検査
- `HomePage.test.tsx`: 実 `useHomeSummary` 配線で警告と2 toastを検査
- `53-ui-home.md` に `UI-00-D11` test contractを置き、旧「Vitest未着手」を解消
- targeted / frontend full / traceability / docs / exact-HEAD L1がgreen、generated traceability差分0

### 失敗定義

- testが `useHomeSummary` またはderived値を手組みobjectへ置換し、production seamを通らない
- command引数、query key、strict `< yesterday`、visible listener、toastのどれかを壊してもgreen
- test追加を理由にproduction、DOM / wording、route、query policy、IPC、DBを変更

### 非目的

- UI-00の見た目、文言、layout、retry / staleTime / gcTimeの変更
- 既存 `SummaryCards.test.tsx` / `count-stock-status.test.ts` の削除・弱化
- 順11 FE traceability gate、他画面、E2E / visual / Windows native L3

## Scope

- add `src/features/home/hooks/useHomeSummary.test.tsx`（`UI-00` token、実hook + QueryClient、mockは`commands.*`）
- add `src/features/home/hooks/useYesterdayDate.test.tsx`（`UI-00` token、fake local Date / visibility / cleanup）
- add `src/features/home/HomePage.test.tsx`（`UI-00` token、実hook、QueryClient、commands mock、必要最小Router harness）
- update `docs/function-design/53-ui-home.md`（`UI-00-D11`、旧Vitest非目的削除、履歴）
- 本Packet / Matrix。production TypeScriptと既存testは変更しない

## Non-scope

- 上記3新規test以外の `src/features/home/`
- `src/lib/query-keys.ts`、bindings、route tree、Rust / IPC / DB
- `docs/function-design/90-traceability.md`（diff 0）
- `Plans.md`（Writer変更禁止、Coordinator管理）

## Acceptance Criteria

- `npm test -- src/features/home/hooks/useHomeSummary.test.tsx`、`npm test -- src/features/home/hooks/useYesterdayDate.test.tsx`、`npm test -- src/features/home/HomePage.test.tsx` を個別に実行しPASS
- `useHomeSummary` testが4 exact command call / literal query key、stock / PLU / settlement派生、null / equal / older境界、one-error / three-successを観測
- `useYesterdayDate` testが初期昨日、hidden不変、翌日visible更新、listener cleanupを観測
- visible復帰後に `getDailySales` が更新後の昨日を引数に再実行され、sales query keyが切り替わる接続を `useHomeSummary` testで観測
- `HomePage` testが実hook経由で「前日分が未取込みです」、toast id `plu-dirty-error` / `csv-imports-error`、healthy表示継続を観測
- 新規3fileに `UI-00` token。`cargo run --bin generate_traceability -- --check` PASS、90 diff 0
- frontendは `typecheck` → `lint` → `format:check` → `test` → `build` の順に逐次実行し、共有 `src/routeTree.gen.ts` を触るcommandを並列実行しない
- plan/docs check、`local-ci.sh full` CLEAN
- Matrix X1〜X9/G1をcommit済みclean treeでbaseline全量1回だけ注入→red→復元→greenし、Coordinatorが独立再実測

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-301/302、`docs/architecture/ui-task-specs.md` UI-00
- Architecture: UI layer不変
- Function / command / DTO: `docs/function-design/53-ui-home.md` §53.2〜§53.6 / `UI-00-D11`
- DB: 該当なし
- Screen / UI: `docs/SCREEN_DESIGN.md` ホーム（表示不変）
- Audit / workflow: P8b-2、監査report順10、wave 2 WER

## Required Design Artifacts

| Area | Artifact | Status |
|---|---|---|
| UI-00 query / derived / error / date lifecycle | 53 §53.2〜§53.6 | existing sufficient |
| test owner / mock boundary | 53 `UI-00-D11` | updated in plan-first change |
| screen / wording | SCREEN_DESIGN Home | unchanged |
| wire / DB / route | 該当なし | unchanged |

## Registration / Generation Obligations

Vitestが3fileを自動収集する。各fileの `UI-00` tokenでWF-TRACE-04を満たす。新規REQ coverageではないため90は再生成せずdiff 0を確認する。command / route / operator画面 / function-design doc新設はなく、bindings / routes生成なし。

## Design Intent Trace

| ID | Source | Decision | Implementation | Test |
|---|---|---|---|---|
| P8b-2 / D-3 / D-8 | 53 §53.2〜§53.5 | UI-00-D11-A: command boundaryだけmock | production不変 | useHomeSummary |
| D-9 | 53 §53.3 | UI-00-D11-B: fake local clock + visibility | production不変 | useYesterdayDate |
| D-3 / D-8 | 53 §53.4/5 | UI-00-D11-C: HomePageも実hook | production不変 | HomePage |
| WF-TRACE-04 | DEV_WORKFLOW | UI-00 token、90 diff 0 | test comments | generator check |

## Design Intent Audit

- Source docs aloneでwhat/whyを回答可能: 既存§53.2〜§53.6 + 新規D11。
- Plan-only durable decision: なし。mock boundaryを53へ昇格。
- Rejected: SummaryCards fixture拡張（orchestrationを通らない）、hook全面mock、E2E/native（過大）。
- Deferred: FE traceability強化は順11。
- Absolute guarantee: 「独立」はfrontend query failure非伝搬でありbackend可用性保証ではない。

## Impact Review Lenses

| Lens | Finding | Artifact |
|---|---|---|
| Adapter/core | generated command consumerまで | Matrix C1 |
| Fact/decision | productionと53一致、test ownerだけ追加 | 53 D11 |
| Lifecycle/retry | initial / one-error / visible復帰。retry policy不変 | Matrix |
| Operator workflow | 表示変更なし、既存警告/toastを固定 | HomePage test |
| Data safety/manual | syntheticのみ、L3不要 | Data Safety |

## Design Readiness

- Existing design sufficient; 53へtest ownerのみ追加。
- UI→generated CMD consumerまで、backend / DTO / persistence不変。
- query error独立性をtest client retry=falseで決定的に検査するがproduction policyは不変。
- 3fileとも `UI-00`、MatrixはD-3/D-8/D-9/P8b-2へ接続。

## Contract Probe

- `useHomeSummary.ts`: 4 independent useQuery、設計どおりのcall/key/derivedを実測。
- `useYesterdayDate.ts`: visible eventだけで再計算しcleanupすることを実測。
- `HomePage.tsx`: 2 error effectとwarning conditionへ実hookから到達可能。
- `UI-00` tokenはT4 presenceを満たし、新規REQ rowを作らない。

## Contract Coverage Ledger

tricky R2のため記載。

| Contract | Target | Test | L3/non-scope |
|---|---|---|---|
| D-3 4 independent query | production不変 | useHomeSummary exact call/key + partial error | L3なし |
| D-8 strict warning | production不変 | null/equal/older | L3なし |
| §53.2 derived | production不変 | stock/PLU/settlement | L3なし |
| D-9 visible rollover | production不変 | useYesterdayDate | L3なし |
| §53.4/5 warning + 2 toast | production不変 | HomePage | L3なし |
| WF-TRACE-04 | 3 test token | generator + 90 diff 0 | 順11 non-scope |

## Test Plan

- Matrix: [test-matrices/2026-07-29-home-orchestration-tests.md](test-matrices/2026-07-29-home-orchestration-tests.md)
- production変更なしでgreen接続し、mutationで感度をred実証
- negative: one reject、null/equal/older、hidden、2 independent toast
- main wiring: HomePageは実hookを通す

## Evidence Stop Condition

`exact-HEAD L1 + baseline全量mutation + P1/P2 closure`が揃った後は、runtime failure、Scope変更、または未closureのP1/P2がない限り追加の全量証跡収集を開始しない。証跡はGoal Invariantの判定手段であり、独立した成果として扱わない。

本laneのbaseline全量mutationは1回だけ実施する。test-only oracle hardening後は変更したoracle familyの代表mutationだけをclosure確認し、未変更familyの全量再実行をしない。

## Boundary / Wire Contract

producerは既存generated `commands.*`、consumerは `useHomeSummary`。testはpositional引数とtyped Result dataをmock boundaryで観測するが、wire / internal type / range / round-trip / compatibilityは変更しない。URL state、cache schema、CSV、DB、bindings生成も非接触。

## Review Focus

- production変更0、3 test fileだけ
- hook全面mock / hand-built derived objectを使わずQueryClient + commands mockでmain wiringを通す
- expected query keyはproduction helperから導出せずliteralで持つ
- local Date constructorでtimezone偶然依存を避ける
- null=false / equal=false / older=true、one-error / three-successを区別
- traceability generated diff 0、順11へ拡張しない
- frontend commandを逐次実行

## Spec Contract

Contract ID: UI-00-D11

- production hook + QueryClientを通し、mock boundaryをgenerated commandsに置く。
- 4 query、derived境界、visible復帰、partial error、warning/toastを3 test ownerへ分離する。

## Trace Matrix

| ID | Step | Test | Evidence |
|---|---|---|---|
| P8b-2 / D-3/D-8 | query/derived/partial | useHomeSummary | Vitest + X1〜X4 |
| D-9 | rollover | useYesterdayDate | Vitest + X5/X6 |
| §53.4/5 | main wiring | HomePage | Vitest + X7〜X9 |
| WF-TRACE-04 | UI token | 3 files | generator + G1 |

## Data Safety

DB、実CSV、店舗データ、backup、log、receipt、secretへ非接触。synthetic typed fixtureだけを使用し、mutationは各試行後に完全復元する。

## Implementation Results

（実装時に追記）

## Review Response

- Findings Freeze: not in effect（plan-draft）
- tricky R2のためfresh Sonnet Final Reviewを行い、P3-onlyでは再engagementしない。
