# Plan Packet: 未参照 UI wrapper / 専用 dependency の退役（監査是正 順19 / P6-1、wave 2 lane 1）

## Workflow State

- Phase: plan-gate
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・レビュー裁定・main/Registry/train管理）
- Writer: Codex（plan-approved後の別session、`../inventory-worktree-lane1` とlane branchへpin）
- Plan Reviewer: Sonnet 5 fresh context（owner relay、read-only、実装非関与）
- Final Reviewer: Sonnet 5 fresh context（Plan Reviewerとは別context、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Ready承認（wave batch可）/ merge。視認・L3なし（未参照module退役、画面挙動不変）

Narrative（append-only）:

- 2026-07-28 kickoff -> spec-check -> design -> plan-draft: ownerがwave 2と順19+順20を選定（本lane介入1/3）。Coordinatorがproduction import graph、manifest/lockfile、UI-11a実装、69設計、UI_TECH_STACKの矛盾を再確認し、削除方針を `UI-FORM-D1` としてsource docへ昇格した。
- 2026-07-28 plan-draft -> plan-gate: 本packet、Matrix、source doc、Wave Registryをmain上のwave scaffoldingとして実装より先にcommitする。lane branch/worktreeはPlan Gate収束後にこのplan-first lineageから分岐する。
- 2026-07-28 Codex independent preflight（正式Sonnet review前）: P1=0 / P2=3 / P3=1。全件をCoordinatorが再実測してacceptし、FE test `UI-11a` token + traceability T4 check、manifest/lock/source-doc各面の独立mutation、component一覧の非網羅性明示、version表記を是正した。正式Plan Gateは未収束。
- 2026-07-28 formal Plan Review（Sonnet 5独立fresh context、ownerがlane別terminalでrelay）: P1=0 / P2=0 / P3=1、Verdict Approve。P3のG1注入形具体化をacceptし、MatrixへZod/radix-uiの個別root dependency削除を追記した。P3-only明確化のためre-review不要。relay 1/2。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 2 / lane選定）、relay 1/2

## Risk

Risk: R2

production consumer 0の孤立UI wrapperと、そのwrapper専用dependency、設計正本の採用表記だけを退役する。runtime behavior、route、wire、DBは変えないためR2。ただし `UI_TECH_STACK.md` を変更するため hosted CIはrequiredとする。

Rollbackはlane implementation commitのrevertで可能。永続データ・cache・wire互換への影響はない。

## Goal

Goal Invariant: productionで使われていない `DropdownMenu` / `RadioGroup` / RHF `Form` wrapperとRHF専用dependencyを退役し、フォーム採用方針を実装どおりのfeature-local controlled state + 必要箇所のZodへ一本化する。現役のZod、`radix-ui`、UI-11a挙動は維持する。

### 最小完了条件

- `src/components/ui/{dropdown-menu,form,radio-group}.tsx` が存在しない
- `package.json` / `package-lock.json` に直接dependency `@hookform/resolvers` / `react-hook-form` が存在しない
- `docs/UI_TECH_STACK.md` の採用表、component一覧、§2.7が `UI-FORM-D1` と一致する
- 構造契約testと既存UI-11a test、frontend gateがgreen

### 失敗定義

- 現役Zod、`radix-ui`、active UI primitive、route、閾値保存/validation挙動を削除・変更する
- 未参照wrapperを「将来使うかもしれない」だけで残し、採用正本の分裂を温存する
- lockfileからumbrella `radix-ui` のtransitive dropdown/radio packageまで消すことを完了条件にする

### 非目的

- 既存フォームの横断再実装、RHF採用、フォームlibrary比較の再開
- 監査順18その他の未参照asset/UI primitive整理
- UIデザイン・文言・画面構成の変更

## Scope

- delete: `src/components/ui/dropdown-menu.tsx`
- delete: `src/components/ui/form.tsx`
- delete: `src/components/ui/radio-group.tsx`
- update: `package.json` / `package-lock.json`（直接dependency 2件だけを退役）
- add: `src/lib/ui-form-dependency-contract.test.ts`（`UI-11a` token付き。孤立wrapper/dependency/採用正本の再導入防止）
- source design: `docs/UI_TECH_STACK.md` `UI-FORM-D1`
- regression: UI-11a threshold tests + frontend full gate
- packet / Matrix（state更新はCoordinatorのみ）

## Non-scope

- `zod`、`radix-ui`、`@radix-ui/*` transitive lock nodes
- `src/components/ui/` の上記3file以外
- `src/features/threshold-settings/` production code
- backend / IPC / bindings / DB / route generation
- `Plans.md`（Writer変更禁止。Coordinator管理）

## Acceptance Criteria

- `npm test -- src/lib/ui-form-dependency-contract.test.ts` green: wrapper 3file不在、manifest/lock rootの直接dependency 2件不在、`UI-FORM-D1` anchor存在
- `npm test -- src/features/threshold-settings/ThresholdSettingsPage.test.tsx` green
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（新規testの `UI-11a` tokenによりFE未参照baseline 22を維持）
- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` PASS
- `bash scripts/doc-consistency-check.sh` PASS、`bash scripts/local-ci.sh full` CLEAN
- Matrix X1〜X10をcommit済みclean treeで注入→red→復元→greenし、Coordinatorが独立再実測する

## Design Sources

- Requirements / spec: 挙動変更なし
- Architecture: `docs/UI_TECH_STACK.md` §2.3 / §2.7 (`UI-FORM-D1`)
- Function / command / DTO: `docs/function-design/69-ui-threshold-settings.md` §69.4 / §69.7
- DB: 該当なし
- Screen / UI: UI-11a実装と既存test（挙動不変oracle）
- Decision log / ADR: 監査 `docs/research/audit-2026-07/findings/p6-dead-code.md` P6-1

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Frontend dependency / standard component boundary | `docs/UI_TECH_STACK.md` | updated in plan-first scaffolding (`UI-FORM-D1`) |
| Existing operator form behavior | `docs/function-design/69-ui-threshold-settings.md` | existing sufficient、変更なし |
| Backend / command / DTO / DB / CSV | 該当なし | intentionally not applicable |
| Durable decision / ADR | UI stack source decision | `UI-FORM-D1`へ昇格済み |

## Registration / Generation Obligations

新規testはVitestが自動収集する。test内に `UI-11a` tokenを置き、`cargo run --bin generate_traceability -- --check` でWF-TRACE-04のFE未参照baseline 22が増えないことを確認する。新規REQ coverageではないため90の再生成は不要。新規command / route / operator画面 / function-design doc、bindings / routes生成は該当なし。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| P6-1 | UI_TECH_STACK §2.3 / §2.7 | UI-FORM-D1 | consumer 0のwrapperを採用候補として常設しない。RHF採用は横断移行を伴いS是正を逸脱 | wrapper 3file、package files | structural contract test |
| UI-11a | 69 §69.4 / §69.7 | 既存controlled form契約 | 現行useState + errors + Zodを維持 | production code非変更 | ThresholdSettingsPage tests |

## Design Intent Audit

- Source docs can answer what/why: `UI-FORM-D1` が採用境界、再評価条件、非採用wrapperを明記する。
- Plan-only durable decisions: なし。フォーム方針はUI_TECH_STACKへ昇格済み。
- Assumptions: fresh `rg` で3wrapperのproduction consumer 0、RHF importは孤立Formのみ、resolver import 0。
- Deferred gaps: 将来、複雑な動的反復fieldまたは実測performance問題が出た場合のlibrary再評価だけ。
- Absolute guarantee self-check: 「未使用wrapper全廃」ではなく対象3fileを明示。他の意図的primitiveへ拡張しない。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable | — |
| Fact / decision split | consumer 0は事実、退役はUI-FORM-D1 | source doc |
| Lifecycle / retry | 挙動不変 | existing UI-11a tests |
| Operator workflow / manual verification | 表示・操作変更なし、L3不要 | regression tests |
| Data safety | DB/file data非接触 | L1 |

## Design Readiness

- Existing design sufficient: 69とproduction implementationはcontrolled state + Zodで一致。
- Source docs updated: UI_TECH_STACKの誤ったRHF採用記述と未使用component一覧を `UI-FORM-D1` へ同期。
- Layer ownership: frontend-only、UI wrapper/dependency境界内。
- Command/DTO/persistence/error/operator wording: 全て不変。
- Testability: static structural oracle + existingbehavior regressionで分離。

## Contract Probe

- production consumer probe: wrapper basename/import、`react-hook-form`、`@hookform/resolvers` をrepo-wide検索 -> 対象外consumer 0。
- lockfile probe: `radix-ui` umbrellaがdropdown/radio transitive packageを保持 -> transitive node不在をACにしない。

## Contract Coverage Ledger

R2だがmutation oracleを明確にするため記載する。

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-FORM-D1-A wrapper 3file退役 | 3 deleted files | structural contract test | L3なし |
| UI-FORM-D1-B RHF専用dependency退役 | package.json / lock | structural contract test | L3なし |
| UI-FORM-D1-C Zod/radix-ui維持 | manifests + existing source | contract test + typecheck | active componentsはnon-scope |
| UI-11a挙動不変 | threshold feature | existing ThresholdSettingsPage tests | L3なし |
| source doc同期 | UI_TECH_STACK | anchor assertion + docs check | — |
| WF-TRACE-04 FE test baseline | new contract test | `generate_traceability -- --check` | 90再生成なし |

## Test Plan

- Matrix: [test-matrices/2026-07-28-unused-ui-wrapper-dependencies.md](test-matrices/2026-07-28-unused-ui-wrapper-dependencies.md)
- targeted: structural contract test、ThresholdSettingsPage test
- negative: wrapper、manifest/lock root dependency、採用表、component例、§2.7旧肯定文の各独立再導入
- compatibility: Zod/radix-uiが残りfrontend build成功
- data safety: 永続データ非接触
- main wiring: production import graph 0をrepo-wide sweep

## Boundary / Wire Contract

対象はfrontend source module / npm manifest / lockfile。IPC、JSON、cache schema、CSV、DB、generated bindingsのproducer/consumer/round-tripは変更しない。

## Review Focus

- direct dependencyだけを削除し、active `radix-ui` / Zodを巻き込まないこと
- structural testがproduction sourceから期待値を導出せず、3file/2dependencyを独立列挙すること
- lockfile transitive package残存をfalse failureにしないこと
- UI_TECH_STACKと69の方針が再び分裂していないこと

## Spec Contract

Contract ID: UI-FORM-D1

- 現行フォーム標準はfeature-local controlled state、必要箇所だけZod。未採用RHF/wrapperを標準componentとして常設しない。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-FORM-D1 | wrapper/dependency退役 | structural contract test | footprint限定 | test output + diff |
| UI-11a | behavior不変確認 | ThresholdSettingsPage tests | production code非変更 | vitest |

## Data Safety

DB、店舗artifact、実CSV、secret、backupへ非接触。npm lockfileは既存manifestから再計算し、install scriptは実行しない。

## Implementation Results

（plan-approved後にWriterが追記）

## Review Response

- Findings Freeze: 未発効
