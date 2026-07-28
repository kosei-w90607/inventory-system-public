# Plan Packet: SortableHeader 共通 component 抽出（監査是正 順21a / P1-1、wave 3 lane 3）

## Workflow State

- Phase: plan-gate
- Risk: R2
- Execution Mode: dual-vendor-no-fable
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・レビュー裁定・main/Registry/train管理）
- Writer: Codex（plan-approved後の別session / worktree、lane 3 branchへpin）
- Plan Reviewer: Sonnet 5 fresh context（owner relay、read-only、実装非関与）
- Final Reviewer: Sonnet 5 fresh context（Plan Reviewerとは別fresh context、owner relay、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: wave batch Ready承認、lane merge承認（lane選定は介入1/3で完了）

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> design -> plan-draft: ownerがwave 3候補のうち順21を再分解し、P1-1 `SortableHeader` 抽出だけをlane 3として選定した（本lane介入1/3）。Coordinatorのread-only footprint auditにより、P1-1 / P1-3 / P1-4は別々のsource contract・file footprint・Riskを持つため、順21を単一correction unitとして扱わない。P1-3 record detail shell / `returnTo` とP1-4 request基盤helperは本laneの非scopeであり、順21完了扱いにしない。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix / `UI-TABLE-D1`を完成し、3 consumerの現行DOM / ARIA / callbackと3 lane footprint分離をCoordinatorが確認した。plan-first content commitで固定し、fresh Sonnet Plan Reviewへ進む。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 3 / lane 3 / 順21a選定）、relay 0/2

## Risk

Risk: R2

3つの既存tableにbyte-equivalentで複製されたpure presentational componentを、既にbacklogで指定された `src/components/sales/SortableHeader.tsx` へ抽出する。operator-visible sort挙動、URL state、table列、callback、ARIA、wire、route、DBは変えないためR2。ただし、shared UI componentのgeneric props、3 consumerの型結線、sort accessibilityを同時に扱い、source design 3文書をcanonical pathへ同期するため **tricky R2** とする。shared component / source docs変更を含むためHosted CIはrequired。

Rollbackはlane implementation commitのrevertで可能。永続データ、cache、IPC互換への影響はない。

## Goal

Goal Invariant: 日次売上 `ProductTable`、月次売上 `DepartmentTable`、`ProductRankingTable` が、同一のgeneric `SortableHeader<T extends string>` implementationを `src/components/sales/SortableHeader.tsx` から利用する。3画面のsortable列、click payload、`aria-sort`、矢印、alignment、button classとoperator-visible表示は抽出前から不変とする。

### 最小完了条件

- canonical implementationが `src/components/sales/SortableHeader.tsx` の1箇所だけに存在する
- 3 consumerからinline `SortableHeader` interface/functionが消え、canonical componentをimportする
- 日次5列、月次部門3列、月次商品4列のsort callbackとARIA/indicator/alignment契約が既存testで固定される
- catalog、56、57がcanonical pathとconsumer範囲を同じ意味で記述する
- frontend full gate、traceability check、docs check、L1 fullがgreen

### 失敗定義

- sortable列集合、sort key、click callback、`aria-sort`、昇降順indicator、右寄せ、button variant/classのいずれかが変わる
- 3 consumerの一部だけがlocal implementationを保持または再導入し、single implementationにならない
- shared componentがdaily/monthlyのdomain型へ依存し、別featureのsort columnを受けられない
- refactorを理由にtable本体、sort algorithm、URL state、operator wordingを変更する

### 非目的

- P1-3: 入出庫4詳細画面のshell、query defaults、error/loading/recovery、`returnTo` helper共通化
- P1-4: 入庫 / 手動販売 / 廃棄 / 返品交換request builderのidempotency/date/integer helper共通化
- 順21全体の完了扱い。P1-3 / P1-4は未完了の独立correction unitとして残す
- sort algorithm、sort direction toggle、URL search schema、table列、sales DTO、monthly `product_count` backlogの変更
- generic table component化、3 table本体の統合、`TableHead` primitiveの変更

## Scope

予定file footprint（waveの互いに素条件の証明対象）:

production footprintは次の新規1file + 既存3tableだけとする。test / source doc / packetを除き、5つ目のproduction fileを追加しない。

- add: `src/components/sales/SortableHeader.tsx`
  - `<T extends string>` generic
  - props: `column`, `label`, `sortBy`, `sortDir`, `onClick`, optional `align`
  - 現行の `TableHead` / shadcn `Button` DOM、class、`aria-sort`、indicatorをbyte-semantic equivalentで移植
- update: `src/features/daily-sales/components/ProductTable.tsx`
  - inline interface/functionを削除しcanonical importへ置換
  - 日次5列の結線は不変
- update: `src/features/monthly-sales/components/DepartmentTable.tsx`
  - inline interface/functionを削除しcanonical importへ置換
  - 月次部門3列の結線は不変
- update: `src/features/monthly-sales/components/ProductRankingTable.tsx`
  - inline interface/functionを削除しcanonical importへ置換
  - 月次商品4列の結線は不変
- update existing tests:
  - `src/features/daily-sales/components/ProductTable.test.tsx`
  - `src/features/monthly-sales/components/DepartmentTable.test.tsx`
  - `src/features/monthly-sales/components/ProductRankingTable.test.tsx`
  - container import経由でclick payload、active/inactive `aria-sort`、indicator、right alignmentを固定する。shared component直import専用testは新設しない
- source design updates:
  - `docs/design-system/02-component-catalog.md` §③ table: sortable header canonical / props / accessibility variant
  - `docs/function-design/56-ui-daily-sales.md` §56.7: 日次5列がcanonical componentを使うこと
  - `docs/function-design/57-ui-monthly-sales.md` §57.7: Department 3列 / Ranking 4列がcanonical componentを使うこと
- 本Plan Packet / Test Design Matrix（state更新はCoordinatorのみ）

## Non-scope

- `src/features/daily-sales/` と `src/features/monthly-sales/` の上記3 production file・3 test file以外
- `src/components/sales/TabsHeader.tsx` とそのtest
- `src/components/ui/{table,button}.tsx`
- sales sort helper、page/hooks/types、route files、`src/routeTree.gen.ts`
- Rust、Tauri command / DTO、`src/lib/bindings.ts`、DB、migration
- `docs/function-design/90-traceability.md`（REQ reference countを変えないため再生成差分なしを期待）
- `Plans.md`（Writer変更禁止。Coordinator管理）
- P1-3 / P1-4のproduction、test、source docs

## Acceptance Criteria

- `rg -n '^(interface SortableHeaderProps|function SortableHeader)' src/features/daily-sales/components/ProductTable.tsx src/features/monthly-sales/components/DepartmentTable.tsx src/features/monthly-sales/components/ProductRankingTable.tsx` がhit 0
- `rg -n 'SortableHeader' src/components/sales/SortableHeader.tsx` と3 consumerのimport/useを目視し、implementation定義がcanonical file 1箇所だけ
- `npm test -- src/features/daily-sales/components/ProductTable.test.tsx src/features/monthly-sales/components/DepartmentTable.test.tsx src/features/monthly-sales/components/ProductRankingTable.test.tsx` PASS
- 既存testで日次5列 / 月次部門3列 / 月次商品4列のclick payload、active/inactive `aria-sort`、`▲` / `▼`、右寄せheaderを観測可能なassertionで固定
- frontend gateは `npm run typecheck` → `npm run lint` → `npm run format:check` → `npm test` → `npm run build` の順に逐次実行し、route generationを共有するcommandを並列実行しない。全command PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASSし、`docs/function-design/90-traceability.md` diff 0
- `bash scripts/doc-consistency-check.sh` PASS、`bash scripts/local-ci.sh full` CLEAN
- Matrix X1〜X5 / G1をcommit済みclean treeでbaseline全量1回だけ注入→red→復元→greenし、Coordinatorが独立再実測する

## Design Sources

- audit finding: `docs/research/audit-2026-07/findings/p1-component-reuse.md` P1-1
- prioritized order: `docs/research/audit-2026-07/report.md` 順21。ただし本laneはP1-1だけ
- existing implementation: 3 tableのinline `SortableHeader`
- established extraction direction: `docs/archive/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md`（`src/components/sales/SortableHeader.tsx`、`<T extends string>`、container test経由）
- design system: `docs/design-system/02-component-catalog.md` §③
- daily/monthly contracts: `docs/function-design/56-ui-daily-sales.md` §56.7、`57-ui-monthly-sales.md` §57.7
- workflow lesson: `docs/archive/plans/2026-07-28-wave-2-workflow-effectiveness-review.md` Evidence Stop Condition

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Shared sortable table header canonical | `docs/design-system/02-component-catalog.md` §③ | plan-firstでcanonical path / props / a11yを更新 |
| Daily sales sortable columns | `docs/function-design/56-ui-daily-sales.md` §56.7 | existing behavior sufficient、plan-firstでcanonical pathだけ同期 |
| Monthly sales sortable columns | `docs/function-design/57-ui-monthly-sales.md` §57.7 | existing behavior sufficient、plan-firstでcanonical pathだけ同期 |
| Operator workflow / wording / route / search | 既存56/57契約 | behavior不変、追加設計不要 |
| Backend / DTO / DB / persistence | 該当なし | intentionally not applicable |

## Registration / Generation Obligations

新規route / command / DTO / REQ / test fileはない。既存3 test fileの既存REQ reference countを変えず、追加test名は必要に応じて既存 `UI-09a` / `UI-09b` tokenだけを使う。したがってbindings / route tree / 90-traceabilityの生成差分は作らない。`cargo run --bin generate_traceability -- --check` と `git diff --exit-code -- src/lib/bindings.ts src/routeTree.gen.ts docs/function-design/90-traceability.md` で不変を確認する。

## Design Intent Trace

| Spec / finding ID | Source design section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| P1-1 | catalog §③ | UI-TABLE-D1 | 同一a11y/display知識を3コピーで保守しない。table全体generic化はdomain propsを肥大化するため不採用 | shared component + 3 consumers | 3 container tests + G1 |
| UI-09a / REQ-501 | 56 §56.7 | UI-TABLE-D1-A | 日次5 sortable列と現行表示を維持 | daily ProductTable | daily ProductTable test |
| UI-09b / REQ-502 | 57 §57.7 | UI-TABLE-D1-B | Department 3列 / Ranking 4列と現行表示を維持 | monthly 2 tables | monthly 2 tests |

## Design Intent Audit

- Source docs can answer what/why: 56/57がsortable列とcallbackを既に定義し、catalog §③がtable/a11y規約を持つ。今回のsource updateはcanonical implementation ownerを追加するだけでoperator contractを変えない。
- Plan-only durable decisions: なし。`UI-TABLE-D1`はcatalogへ、consumer mappingは56/57へ反映する。
- Assumptions: 2026-07-29 mainで3 inline bodyは同一。generic column型以外のDOM差分はない。
- Rejected alternatives:
  - `src/components/patterns/`: sales専用sort type familyで、既存backlogと `src/components/sales/` ownershipに反する
  - shared componentの直import unit test: consumer wiringを通らず、旧packetがcontainer test維持を明示
  - 3 table全体のgeneric化: P1-1を越えてdomain row/display責務を混ぜる
- Deferred gaps: P1-3 / P1-4。順21の別correction unitとして明示的に残す。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | pure frontend presentational component内 | shared generic props |
| Fact / decision split | 3 body同一はfact、canonical ownerはUI-TABLE-D1 | catalog + 56/57 |
| Lifecycle / retry | state / query / retry非接触 | existing container tests |
| Operator workflow / manual verification | 表示・操作の意図的変更なし | L3不要、DOM regression |
| Accessibility | `aria-sort`とvisible/hidden indicatorが主要契約 | Matrix C2/C3 |
| Data safety | persistence非接触 | L1 |

## Design Readiness

- Existing design sufficient: 56/57は列集合とsort callback、catalogはtable primitiveとa11yを定義済み。
- Source docs updated plan-first: canonical component path / props / adoption sitesだけを追記し、operator behaviorは変更しない。
- Layer ownership: `src/components/sales/` pure presentational owner、feature tablesがdomain typeをgeneric parameterとして渡す。
- Command / DTO / persistence / error wording: 全て不変。
- Testability: container testsがshared componentを実consumer経由で通し、structural `rg` がsingle implementationを独立確認する。

## Contract Probe

- duplicate probe: 3 inline `SortableHeader`は `indicator`、`alignClass`、`ariaSort`、`TableHead`、`Button` DOM/class、callbackまで同一（2026-07-29 main実測）。
- consumer probe: 対象はdaily ProductTable、monthly DepartmentTable、ProductRankingTableの3箇所だけ（repo-wide `rg` 実測）。
- prior decision probe: archived PR #66 packetがcanonical path `src/components/sales/SortableHeader.tsx`、generic `<T extends string>`、container test方針を明記。
- generation probe: route filename / command / DTO / REQ token countを変えないためgenerated artifact laneを消費しない。

## Contract Coverage Ledger

tricky R2のため記載する。

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-TABLE-D1 single implementation | shared file + 3 consumers | G1 structural anchor + typecheck | L3なし |
| UI-TABLE-D1-A daily 5-column wiring | daily ProductTable | ProductTable.test.tsx click / ARIA / indicator | L3なし |
| UI-TABLE-D1-B monthly department 3-column wiring | DepartmentTable | DepartmentTable.test.tsx | L3なし |
| UI-TABLE-D1-B monthly ranking 4-column wiring | ProductRankingTable | ProductRankingTable.test.tsx | L3なし |
| C2 `aria-sort` | shared component | active/inactive header assertions | L3なし |
| C3 indicator / alignment / class | shared component | existing container assertionsを補強 | L3なし |
| source doc canonical sync | catalog + 56 + 57 | docs consistency + Review Focus | — |
| generated artifacts unchanged | bindings / route tree / 90 | traceability check + diff 0 | non-scope |

## Test Plan

- Matrix: [test-matrices/2026-07-29-sortable-header-extraction.md](test-matrices/2026-07-29-sortable-header-extraction.md)
- TDD: 既存3 container testsに不足するARIA / indicator / alignment assertionを先に追加し、抽出前greenをcharacterization baselineとする。その後shared component抽出でもgreenを維持する。
- structural: 3 consumerのlocal interface/function hit 0、canonical implementation 1箇所。
- compatibility: generic type inferenceがdaily/monthlyの異なる `SortColumn` unionを保持し、typecheck/build成功。
- mutation: baseline全量はX1〜X5/G1を1回だけ独立再実測する。

## Evidence Stop Condition

`exact-HEAD L1 + baseline全量mutation 1回 + P1/P2 closure` が揃った後は、runtime failure、Scope変更、または未closureのP1/P2がない限り追加の全量証跡収集を開始しない。test-only oracle hardening後は変更したoracle familyの代表mutationだけをclosure確認し、未変更familyの全量再実行をしない。

## Boundary / Wire Contract

対象はfrontend module import / generic TypeScript props / rendered table-header DOMだけ。IPC、JSON、browser URL state、cache schema、CSV、DB、generated bindings、route generationのproducer / consumer / round-tripは変更しない。

## Review Focus

- shared propsが `<T extends string>` で、daily/monthlyのdomain `SortColumn`をunion拡張せず保持すること
- 3 consumer全てがcanonical importへ移り、local implementationが残らないこと
- `aria-sort`を`TableHead`に置き、active asc/descとinactive noneが抽出前と同じこと
- indicatorが装飾として `aria-hidden="true"` のまま、visible `▲` / `▼` が同じこと
- right alignment、Button `type/variant/size/class`、callback payloadが不変なこと
- catalog / 56 / 57が同じcanonical pathとconsumer列集合を指すこと
- P1-3 / P1-4、sort algorithm、route/searchへのscope creepがないこと
- frontend full / typecheck / lint / route generationを同一worktreeで並列実行せず、逐次実行の証拠になっていること

## Spec Contract

Contract ID: UI-TABLE-D1

- sortable table headerのDOM / interaction / accessibility implementation ownerは `src/components/sales/SortableHeader.tsx`。
- feature tableはcolumn unionとcallbackをgeneric propsで渡し、shared componentはdaily/monthly domain型をimportしない。
- 日次5列、月次Department 3列、月次Ranking 4列の既存契約は不変。

## Trace Matrix

| Spec / finding ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| P1-1 / UI-TABLE-D1 | shared抽出 + 3 consumer置換 | G1 + typecheck | single owner / generic boundary | rg + diff + gate |
| UI-09a / REQ-501 | daily wiring維持 | ProductTable.test.tsx | 5 keys / ARIA / indicator | Vitest |
| UI-09b / REQ-502 | monthly wiring維持 | DepartmentTable.test.tsx / ProductRankingTable.test.tsx | 3+4 keys / ARIA / alignment | Vitest |
| catalog / 56 / 57 | source docs同期 | docs check | canonical path driftなし | doc check + review |

## Data Safety

DB、店舗artifact、実CSV、secret、backup、filesystem書込み、networkへ非接触。rendered headerとfrontend import graphだけを変更する。

## Implementation Results

（実装時に追記）

## Review Response

- Findings Freeze: not in effect（plan-draft）
- P1-3 / P1-4 disposition: 本laneでは未着手・未完了。別correction unit / packetで扱う。
