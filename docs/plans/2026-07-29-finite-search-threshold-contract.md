# Plan Packet: finite search / threshold descriptor contract（監査順16 / P4-2・P4-3、wave 4 lane 1）

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: codex-only
- Plan Commit: pending
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・裁定・Registry/train管理）
- Writer: Codex（plan-approved後の専用worktree / terminal W4-L1）
- Plan Reviewer: Codex fresh context（read-only、Writer非関与）
- Final Reviewer: Codex fresh context（Plan Reviewerとは別context、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending Ready / merge

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> design -> plan-draft: ownerがwave 4 lane 1として順16を選定（介入1/3）。P4-2/P4-3に既存`low_stock` SSOT backlogを統合し、UI-STATE-D2 / UI-11a-D8をsource docsへ追加した。URL値・fallback・画面・閾値保存挙動は不変。Plan Gate前でありproduction実装は禁止。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix / source-doc decisions、3 lane footprint、lane 2だけのgenerated artifact専有、既存test拡張によるtraceability差分0をCoordinatorが確認した。plan-first content commitへ固定し、fresh Codex Plan Reviewへ進む。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入1/3（wave 4起票）、relay 0/2

## Risk

Risk: R3

route/search stateの有限集合と閾値formの保存境界を変更する。operator-visible挙動は維持するが、片側変更はdeep-linkのsilent fallbackや未保存fieldを生むためR3。DB、wire、CSV、画面DOMは不変。

## Goal

Goal Invariant: URL searchの有限値をfeature-local schema/tupleからroute・型・normalizerへ導出し、UI-11aのfield集合を単一descriptorからschema・抽出・保存へ導出する。既存URL、fallback、query payload、画面、文言、保存順、部分失敗挙動は変えない。

### 最小完了条件

- product / stock movement / inventory records / daily / monthly / stock inquiryのroute schemaとfeature型が同一ownerから導出される
- `low_stock` deep-linkと排他active判定が`LOW_STOCK_FILTER`を共有する
- threshold 2 fieldの型・key・label・順序・schema・抽出・保存entryが単一descriptorへ接続される
- 既存trace ID付きtestだけを拡張し、`90-traceability.md`差分0を維持する

### 失敗定義

- routeとfeatureに同じ有限値集合が残り、片側変更がtypecheckを通る
- invalid URLの既存fallback、page reset、F5復元、CMD/query payloadが変わる
- thresholdのkey、順序、validation、dirty-only、partial failure、文言が変わる
- 新しいREQ付きtest fileまたはgenerated artifactを追加する

### 非目的

- 新filter / 新threshold、invalid deep-link通知、URL key/value変更
- route title、typed internal navigation、focus styling、順18 / 順21
- CMD / BIZ / DB、backend threshold validation / warning、UI layout / wording

## Scope

- product: `src/features/products/search.ts`, `src/routes/products/index.tsx`
- movement: `src/features/stock-movements/types.ts`, `src/routes/stock/$code.movements.tsx`
- records: `src/features/inventory-records/types.ts`, `src/routes/inventory/records.tsx`
- daily/monthly adjacent closure: `src/features/{daily-sales,monthly-sales}/types.ts`, their Page files and route files
- stock: `src/features/stock-inquiry/types.ts`, `src/routes/stock/index.tsx`, `src/config/navigation.ts`
- threshold: `extract-thresholds.ts`, `threshold-form-schema.ts`, `useSaveThresholds.ts`, `ThresholdSettingsPage.tsx`
- existing tests only: product search、movement / records / daily / monthly Page、navigation、SidebarLink、threshold Page / extract
- source docs: `UI_TECH_STACK.md`, `52-ui-shared-layout.md`, `58-ui-stock-inquiry.md`, `69-ui-threshold-settings.md`
- 本Packet / Matrix。`Plans.md`とWorkflow StateはCoordinatorのみが更新する

## Non-scope

- 新規production/test file、route追加、`src/routeTree.gen.ts`
- `src/lib/bindings.ts`, `docs/function-design/90-traceability.md`
- SidebarLink / StatusChips DOM、query hooks、command payload contract
- source docs 50/56/57/65/66の既存URL値・表示契約変更
- dependencies / lockfiles

## Acceptance Criteria

- 各routeはfeature exportのZod schemaをimportし、有限値のlocal `z.enum([...])`を持たない
- product sort/discontinued/dir/perPage、movement type、records recordType/status、daily/monthly finite値の全variantとinvalid fallbackを`npm test`で観測
- navigationの`search.status` / `activeMatch.is/isNot`は`LOW_STOCK_FILTER`を共有し、追加search付きでも排他active testがPASS
- threshold descriptor 2件からschema/extract/order/key/label/save entryが導出され、`ThresholdSettingsPage.test.tsx`のvalidation 4系統、dirty-only、固定順、部分失敗testがPASS
- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASSかつ`90-traceability.md`差分0
- `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-29-finite-search-threshold-contract.md` PASS
- `bash scripts/local-ci.sh full` CLEAN

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-101/206/301/302/303/501/502/905
- Architecture: `docs/UI_TECH_STACK.md` UI-STATE-D2 / UI-FORM-D1
- Function / UI: `50-ui-product-list.md` §50.4、`56-ui-daily-sales.md`、`57-ui-monthly-sales.md`、`58-ui-stock-inquiry.md` §58.4、`65-inventory-record-traceability.md`、`66-ui-stock-movements.md` §66.3、`69-ui-threshold-settings.md` UI-11a-D1/D2/D3/D8
- Decision: D-047 / UI-12-D1
- Audit: `docs/research/audit-2026-07/findings/p4-type-contracts.md` P4-2/P4-3

## Required Design Artifacts

| Area | Artifact | Status |
|---|---|---|
| URL finite values / fallback | UI-STATE-D2 + 各function-design URL節 | updated / existing sufficient |
| `low_stock` deep-link owner | 52 UI-12-D1 / 58 §58.4 | updated in plan-first |
| threshold field owner | 69 UI-11a-D8 | updated in plan-first |
| wire / DB / CSV / screen | existing docs | unchanged |

## Registration / Generation Obligations

- route新設なし、route tree再生成なし
- command / DTOなし、bindings再生成なし
- 新規test fileなし。既存testのtrace ID出現数を変えず、traceability生成差分0を確認する

## Design Intent Trace

| Spec / requirement ID | Source section | Decision ID | Implementation target | Test target |
|---|---|---|---|---|
| UI-01a | 50 §50.4 | UI-STATE-D2 | product search/schema | `search.test.ts` |
| REQ-303 | 66 §66.3 | UI-06c-D2 / UI-STATE-D2 | movement types/schema | existing movement test |
| REQ-206 | 65 §65.8.1 | UI-STATE-D2 | records types/schema | existing records test |
| REQ-301/302 | 52 UI-12-D1 / 58 §58.4 | D-047 | stock types/route/navigation | navigation / Sidebar tests |
| REQ-905 | 69 UI-11a-D1/D2/D3/D8 | UI-11a-D8 | threshold descriptor | threshold tests |

## Design Intent Audit

- source docsで値集合、fallback、単一所有者、維持する挙動を復元できる
- 新しいdurable decisionはUI-STATE-D2 / UI-11a-D8へ昇格済み
- daily/monthlyはP4-2本文が指摘する隣接例として同じcontractへ閉じる
- P1-4だけをgenerated artifact laneとし、本laneは生成差分0

## Impact Review Lenses

not applicable — 外部機器、実データ、CSV、operator workflow変更を含まない内部型契約是正。

## Design Readiness

- Existing design docs are sufficient because: 各URL値・fallback・表示挙動は既存function docsに固定済み
- Source docs updated in this PR: UI-STATE-D2、52/58の`low_stock` owner、UI-11a-D8
- Design gaps intentionally deferred: 新filter、新threshold、backend warning
- Layer / wire / persistence / operator behavior: すべて不変

## Contract Probe

- N/A: 外部premise、生成登録、cross-language wire変更なし

## Contract Coverage Ledger

| Design contract | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-STATE-D2 product finite/default mapping | product search + route | existing product search test | L3なし |
| UI-06c-D2 movement search | movement types + route | existing movement Page test | L3なし |
| REQ-206 records search / returnTo preservation | records types + route | existing records Page test | L3なし |
| daily/monthly finite search | sales types + routes + Pages | existing sales Page tests | L3なし |
| D-047 / UI-12-D1 `low_stock`排他active | stock types + route + navigation | navigation + SidebarLink tests | L3なし |
| UI-11a-D1/D2/D3/D8 | threshold descriptor/schema/save | Page + extract tests | L3再実施なし |
| generated lane分離 | diff / traceability check | generated diff 0 | non-scope |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-07-29-finite-search-threshold-contract.md`

- targeted: existing search / Page / navigation / threshold tests
- compatibility: URL key/value/default/fallback、query payload、DOM/wording不変
- mutation: tuple/descriptor variant、`LOW_STOCK_FILTER`、schema local literal再導入
- full: frontend、traceability、docs、L1

## Boundary / Wire Contract

- producer: URL search / threshold form
- consumer: route validation / Page normalizer / navigation / `updateSetting`
- wire: command DTO不変
- invalid input: 既存`.catch(undefined)`またはfield error
- compatibility: URL・payload・保存順・文言を変更しない

## Review Focus

- finite集合が本当に1 ownerになり、別配列/castで逃げていないか
- daily/monthlyを含む隣接familyの漏れ
- threshold descriptor追加時にschema・extract・saveが同時追従するか
- `90-traceability.md`と他lane footprintへ触れていないか

## Review Response

- Findings Freeze: pending。formal Final Reviewのinitial broad audit完了時に発効する
- Plan Review: pending
- Final Review: pending

## Spec Contract

Contract ID: SPEC-UI-FINITE-SSOT

- feature-local tuple/schema/descriptorが有限値の唯一のproduction owner
- URL / operator-visible / save lifecycleは変更しない
- generated artifactはlane 2専有

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-UI-FINITE-SSOT | route schema import | existing search/Page tests | local enum重複0 | targeted + typecheck |
| D-047 | low_stock constant | navigation / SidebarLink | 排他active | targeted |
| UI-11a-D8 | descriptor derivation | threshold Page / extract | field集合同期 | targeted |
| D-055 | generated lane分離 | traceability check | 90 diff 0 | git diff |

## Data Safety

- DB / migration / backup / CSV /実店舗データ非接触
- rollbackはlane implementation commitのrevert
- test fixtureは既存synthetic dataのみ
