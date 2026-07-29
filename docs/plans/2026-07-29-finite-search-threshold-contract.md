# Plan Packet: finite search / threshold descriptor contract（監査順16 / P4-2・P4-3、wave 4 lane 1）

## Workflow State

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: d8129d9
- Amendments: none
- Coordinator: Codex（本thread。wave編成・packet起草・裁定・Registry/train管理）
- Writer: Codex（plan-approved後の専用worktree / terminal W4-L1）
- Plan Reviewer: Codex fresh context（read-only、Writer非関与）
- Final Reviewer: Claude fresh context（read-only。Codex reviewはpreflightのみ）
- Reviewed Content HEAD: 0ec5180a77c7b0e61a7c31620f7b7ee4dbad66ad
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: resolved Ready / merge（owner介入4/4。exact-HEAD L1 / hosted greenを条件に委任）

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> design -> plan-draft: ownerがwave 4 lane 1として順16を選定（介入1/3）。P4-2/P4-3に既存`low_stock` SSOT backlogを統合し、UI-STATE-D2 / UI-11a-D8をsource docsへ追加した。URL値・fallback・画面・閾値保存挙動は不変。Plan Gate前でありproduction実装は禁止。
- 2026-07-29 plan-draft -> plan-gate: Packet / Matrix / source-doc decisions、3 lane footprint、lane 2だけのgenerated artifact専有、既存test拡張によるtraceability差分0をCoordinatorが確認した。plan-first content commitへ固定し、fresh Codex Plan Reviewへ進む。
- 2026-07-29 Plan Review round 1: P1=1 / P2=2。実選択肢owner 3箇所のfootprint欠落、schema/wiring/duplicate-ownerとdescriptor mutationのoracle不足、商品検索のREQ誤参照を確認した。Plan Gateは未通過のまま、全 exercising siteと既存test内のportable source guardをScope / Ledger / Matrixへ追加して再レビューする。
- 2026-07-29 Plan Review round 2: P1=1 / P2=0。daily/monthlyの実選択肢ownerであるModeTabsと3 sortable tableがPage-only scopeから漏れ、tuple variant追加時の完全性を保証できないと確認した。feature descriptor、mode別subset、4 component / testをScope / Ledger / Matrixへ追加して再レビューする。
- 2026-07-29 formal Plan Review closure（Codex fresh context、HEAD `f929472`）: APPROVE、P1=0 / P2=0 / P3=0。product / records / StatusChips、daily ProductTable、monthly ModeTabs / ProductRankingTable / DepartmentTable、threshold descriptor、REQ-103/501/502、D-055とgenerated差分0をread-only再確認し、実装を左右する未解決判断なし。
- 2026-07-29 plan-gate -> plan-approved -> implementing（state-only compression）: 独立Plan Review closureでP1/P2=0となり、plan-first `d8129d9`とplan-gate corrections `7abfedf` / `128407c` / `f929472`は全実装commitより前に存在する。`Plan Commit`を`d8129d9`へ固定し、本state-only commit後にlane 1 Writer実装を許可する。
- 2026-07-29 independent-review preflight: Codex reviewはformal Final Reviewer席を満たさないpreflightとして扱い、owner relayのClaude fresh contextがP1=1（production descriptor自身から期待値を導出するtest oracle）/ P3=1（inventory-record formatterの`slice(1)` sentinel順序依存）を報告した。両findingをacceptしPhaseは`implementing`のまま、Final ReviewerをClaude fresh contextへ明示した。owner介入は増やさず1/3を維持する。
- 2026-07-29 finding correction: finite descriptorのvariant / order / label / payload / align期待をtest-only固定値へ独立転記し、product / records / movement / daily / monthly / stock / thresholdのcomponent oracleもproduction descriptor非依存へ変更した。`formatRecordStatus` / `formatRecordType`は全optionを位置非依存で検索しつつ`all` sentinelを値で除外する形へ直し、sentinel並替testを旧実装でRED後にGREEN化した。隔離copyでdaily `amount`削除、product `all`削除、未設計variant追加、label driftを注入し、全系列がREDになることを実証した。fresh Claude closure reviewは全local gate完了後に行う。
- 2026-07-29 correction closure review（reviewed content `0ec5180a77c7b0e61a7c31620f7b7ee4dbad66ad`）: Claude Opus 5 / Sonnet 5の相互非開示fresh context 2 passがともにAPPROVE、P1=0 / P2=0 / P3=0。自己参照oracleとsentinel順序依存をCLOSEDとし、variant削除・追加・順序・label・payload / threshold metadata drift、旧`slice(1)`復元を隔離mutationで独立再実証した。これはLane 2未統合下の是正closure evidenceであり、設計書76起因でL1 full CLEANをまだ作れないためPhaseは`implementing`、`Reviewed Content HEAD`は`pending`を維持する。Lane 2統合後のconflict-free rebase、exact-HEAD L1 full CLEAN、formal Final Reviewを経て、同一state-only commitで`local-verified -> independent-review -> human-confirm`とReviewed Content HEADをmaterializeする。
- 2026-07-30 owner-effort correction: 前項までの`介入1/3・relay 0/2`を実態へ合わせて訂正する。D-055のdecision pointはwave 4起票、review-route訂正、Claude Opus 5 / Sonnet 5 dual closure追加要請、Ready / merge承認の4件であり、ownerの本是正指示に基づき介入上限を既定3から一回限り4へ延長した。ownerが手動relayした一次reviewとclosureは2往復として実数化する。今回の記録訂正自体はscope・review route・Ready条件を新たに選び直すdecision pointではない。
- 2026-07-30 dependency attribution correction: closure時のstale `origin/main`はPR-wide changed gateのdiff windowを拡大した要因であり、起動後のRust design compliance failureはLane 2が所有した`76-ui-request-primitives.md`分類gapだった。Lane 2はPR #40 squash `4a07f7d`で統合され、最新`main=d5f8bda`には当該分類が存在する。Lane 1をこのmainへrebaseした後のL1 fullではdesign complianceを含む全gateがPASSしたため、Lane 1 regressionではなくLane 2 mergeで解消したbase dependencyとして帰属を確定する。
- 2026-07-30 merge-train rebase evidence: 旧base `be63da7` / 旧tip `4ebd3fd`のlane 1固有4 commitを`main=d5f8bda`へ競合なくrebaseし、新tip `5bbd65f`を得た。旧新4組のstable patch-id、`git range-diff`、旧全体差分`be63da7..4ebd3fd`と新全体差分`d5f8bda..5bbd65f`のstable patch-idは全て一致した。Plan Commit `d8129d9`は既にmain祖先でAmendmentsはnoneのためformal Rebase Map対象はない。Final Reviewerが監査したcontent HEAD `0ec5180`は同内容のrebased commit `aa90b7c`へ対応し、closure reviewをcarry forwardする。
- 2026-07-30 implementing -> local-verified -> independent-review -> human-confirm（state-only materialization）: rebased HEAD `5bbd65f`のL1 fullはCLEAN / PASS、Claude Opus 5 / Sonnet 5 closure reviewはP1/P2=0、上記rebase同値性も成立した。実際のreview対象`0ec5180a77c7b0e61a7c31620f7b7ee4dbad66ad`をReviewed Content HEADへ設定し、owner介入4/4の条件付きReady / merge委任を確定した。
- 2026-07-30 human-confirm -> ready-hosted-final（state-only materialization）: ownerが事前に明示したReady / merge承認（介入4/4）を執行した。本commitをfinal candidate HEADとし、Draft PR #38のままexact-HEAD L1 fullとPR body更新を行う。その後Ready化でHosted CIを起動し、PR live HEAD・PR bodyのlocal full evidence SHA・successful hosted run headShaの三点一致を確認できた場合に限り、追加tracked commitなしでsquash mergeする。

## Owner Effort Budget

- 介入回数上限: 4（既定3から一回限り延長。内訳: wave起票 / review-route訂正 / dual closure追加要請 / Ready・merge承認）
- 実働時間上限: 30分
- relay往復上限: 2
- 現況: 介入4/4、relay 2/2。追加owner decision / relayは禁止し、残りは既承認条件の機械的充足だけを行う

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

- product: `src/features/products/search.ts`, `src/features/products/ProductListPage.tsx`, `src/routes/products/index.tsx`
- movement: `src/features/stock-movements/types.ts`, `src/routes/stock/$code.movements.tsx`
- records: `src/features/inventory-records/types.ts`, `src/features/inventory-records/InventoryRecordsPage.tsx`, `src/routes/inventory/records.tsx`
- daily adjacent closure: `src/features/daily-sales/types.ts`, `DailySalesPage.tsx`, `components/ProductTable.tsx`, route file
- monthly adjacent closure: `src/features/monthly-sales/types.ts`, `MonthlySalesPage.tsx`, `components/{ModeTabs,ProductRankingTable,DepartmentTable}.tsx`, route file
- stock: `src/features/stock-inquiry/types.ts`, `src/features/stock-inquiry/components/StatusChips.tsx`, `src/routes/stock/index.tsx`, `src/config/navigation.ts`
- threshold: `extract-thresholds.ts`, `threshold-form-schema.ts`, `useSaveThresholds.ts`, `ThresholdSettingsPage.tsx`
- existing tests only: `products/search.test.ts`（all schema variants + route/owner source guard）、`ProductListPage.test.tsx`、movement / records Page tests、daily `ProductTable.test.tsx` + Page test、monthly `ModeTabs.test.tsx` / `ProductRankingTable.test.tsx` / `DepartmentTable.test.tsx` + Page test、`StatusChips.test.tsx`、navigation、SidebarLink、threshold Page / extract tests
- source docs: `UI_TECH_STACK.md`, `52-ui-shared-layout.md`, `58-ui-stock-inquiry.md`, `69-ui-threshold-settings.md`
- 本Packet / Matrix。`Plans.md`とWorkflow StateはCoordinatorのみが更新する

## Non-scope

- 新規production/test file、route追加、`src/routeTree.gen.ts`
- `src/lib/bindings.ts`, `docs/function-design/90-traceability.md`
- SidebarLink / StatusChipsのDOM・visual変更、query hooks、command payload contract
- source docs 50/56/57/65/66の既存URL値・表示契約変更
- dependencies / lockfiles

## Acceptance Criteria

- 各routeはfeature exportのZod schemaをimportし、有限値のlocal `z.enum([...])`を持たない
- product sort/discontinued/dir/perPage、movement type、records recordType/status、daily/monthly finite値、stock statusの全variantとinvalid fallbackを`src/features/products/search.test.ts`内のschema tableで観測
- dailyは全sort descriptor、monthlyはmode descriptor・全sort descriptor・by_product/by_departmentのmode別subsetを各`types.ts`が所有し、ProductTable / ModeTabs / ProductRankingTable / DepartmentTableはそこからheader / optionを導出する
- `products/search.test.ts`内のsource ownership guardが、全6 routeのfeature schema import / `validateSearch` wiringと、route・Page・ModeTabs・3 sortable table・StatusChipsへのlocal union / enum / value array再導入を検出する
- `ProductTable.test.tsx` / `ModeTabs.test.tsx` / `ProductRankingTable.test.tsx` / `DepartmentTable.test.tsx`がdescriptor全件とmode別subsetの表示順・label・click payloadを反復し、tuple variant追加/削除またはcomponent option欠落を検出する
- navigationの`search.status` / `activeMatch.is/isNot`は`LOW_STOCK_FILTER`を共有し、追加search付きでも排他active testがPASS
- threshold descriptor 2件からschema/extract/order/key/label/save entryが導出され、`ThresholdSettingsPage.test.tsx` / `extract-thresholds.test.ts`のdescriptor全件反復caseとsource ownership guardがfield追加・手書きfield-set再導入を検出する。既存validation 4系統、dirty-only、固定順、部分失敗testもPASS
- `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASSかつ`90-traceability.md`差分0
- `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-29-finite-search-threshold-contract.md` PASS
- `bash scripts/local-ci.sh full` CLEAN

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-103/206/301/302/303/501/502/905
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
| REQ-103 / UI-01a | 50 §50.4 | UI-STATE-D2 | product search/schema/options | `search.test.ts` + `ProductListPage.test.tsx` |
| REQ-501 / UI-09a | 56 URL state / table | UI-STATE-D2 | daily schema + sort descriptor + ProductTable | `search.test.ts` + `ProductTable.test.tsx` + Daily Page test |
| REQ-502 / UI-09b | 57 URL state / mode / table | UI-STATE-D2 | monthly schema + mode/sort descriptors + 3 components | `search.test.ts` + ModeTabs / ProductRankingTable / DepartmentTable tests |
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
| UI-STATE-D2 product finite/default/options mapping | product search + Page + route | `search.test.ts` + `ProductListPage.test.tsx` | L3なし |
| UI-06c-D2 movement search | movement types + route | `search.test.ts` schema/wiring table + movement Page test | L3なし |
| REQ-206 records search / returnTo preservation | records types + Page + route | `search.test.ts` schema/wiring table + records Page test | L3なし |
| daily finite search/options | daily types + route + Page + ProductTable | schema/wiring table + ProductTable / Page tests | L3なし |
| monthly finite search/options | monthly types + route + Page + ModeTabs / ProductRankingTable / DepartmentTable | schema/wiring table + 4 component/Page tests | L3なし |
| D-047 / UI-12-D1 `low_stock`排他active | stock types + route + StatusChips + navigation | `search.test.ts` schema/wiring table + StatusChips / navigation / SidebarLink tests | L3なし |
| UI-11a-D1/D2/D3/D8 | threshold descriptor/schema/save | descriptor-driven Page + extract cases + source ownership guard | L3再実施なし |
| generated lane分離 | diff / traceability check | generated diff 0 | non-scope |

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-07-29-finite-search-threshold-contract.md`

- targeted: existing `products/search.test.ts` schema/wiring/ownership table + Page / daily-monthly finite-choice components / StatusChips / navigation / threshold tests
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

- Findings Freeze: active。Claude closure reviewのP1/P2=0とconflict-free rebaseのcontent同値性、rebased HEADのL1 fullを確定済み
- Plan Review: round 1 REQUEST CHANGES（P1=1 / P2=2 / P3=0）、round 2 REQUEST CHANGES（P1=1 / P2=0 / P3=0）、closure APPROVE（P1=0 / P2=0 / P3=0）
- Final Review: correction closureはClaude Opus 5 / Sonnet 5の2 passともAPPROVE（P1=0 / P2=0 / P3=0、reviewed content `0ec5180a77c7b0e61a7c31620f7b7ee4dbad66ad`）。Lane 2統合後のconflict-free rebaseは全commit / range / 全体差分の同値性を証明し、rebased HEAD `5bbd65f`のL1 fullもPASSしたためreview evidenceをcarry forwardした

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
