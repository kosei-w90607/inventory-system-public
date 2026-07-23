# Plan Packet — 監査是正 順6: render-phase ref access の commit / event 同期化

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: 1f98c36
- Amendments: 22f447f（P2-1: eslint explicit 3-rule config）
- Coordinator: Sol（本 thread、scope精査・design・packet・実装・検証・PR）
- Writer: Sol（plan承認後の単独writer）
- Plan Reviewer: Sonnet 5 fresh context（P1=0 / P2=1 / P3=1、P2-1反映後にowner承認）
- Final Reviewer: ownerが起動するSonnet 5 fresh context
- Reviewed Content HEAD: 06b459f52846d1edfb0add4b5a4b73005a523805
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none。Windows native L3は不要

- State Narrative（2026-07-23）: 基準HEAD `49f2c07` で環境・active packet不在・P7b-1・
  source design・production code・既存test・lint構成を再確認した。R3分類、
  source design更新、Plan Packet、Test Design Matrixを同じplan-first content
  commitにまとめ、`kickoff -> spec-check -> design -> plan-draft -> plan-gate` を
  materializeする。実装codeは存在せず、ownerのPlan承認前には着手しない。
- State Narrative（2026-07-23、state-only）: plan-first commit `1f98c36`を
  Sonnet 5 fresh contextがP1=0 / P2=1 / P3=1でreviewし、P2-1の具体lint差分を
  gated amendment `22f447f`で反映した。ownerはUI-11c / UI-05の両timing判断を承認し、
  amendment完了をもってPlan承認・実装着手を許可した。implementation commitが
  存在しない状態で`plan-gate -> plan-approved -> implementing`をmaterializeする。
- State Narrative（2026-07-23、state-only）: corrective content HEAD `06b459f`は
  exact-HEAD L1 fullがCLEAN / PASSで、PR bodyのevidence SHAと一致する。ownerは
  X4b mutantの専用test RED→復元GREENを独立再現し、X3 lint単独防御、
  X3a/X4b Matrix行、budget exceptionを実確認して案(b)とevidence訂正を承認した。
  Final Review P1是正をconfirmし、P1/P2 closureを0としたため、
  `implementing -> local-verified -> independent-review -> human-confirm`を
  recording compressionでmaterializeし、Reviewed Content HEADを`06b459f`へfreezeする。
- State Narrative（2026-07-23、state-only）: ownerはFinal Review是正確認後に
  Readyを明示承認した（介入2/3）。PRがDraftのまま
  `human-confirm -> ready-hosted-final`をmaterializeする。このstate-only commitを
  resulting exact HEADとしてL1 fullを再実行し、PR bodyの全evidenceを更新後に
  Draft解除・hosted CI exact-HEAD確認へ進む。mergeはowner判断（介入3/3）まで保留する。
- State Narrative（2026-07-23、post-merge closeout）: ownerはmergeと後処理を承認
  （介入3/3）。PR HEAD / PR bodyのLocal full evidence SHA / hosted CI run
  `30014438295`のheadShaが`998a57fa3d62019ac81c92068d1d20b5281032c7`で一致し、
  required checksが成功した状態でPR #23をsquash mergeした
  （merge `09827499e2593f716696cbbefb83333281008849`）。
  `ready-hosted-final -> merge -> archive`を外部merge eventと本closeoutで完了し、
  packet / Matrix / WERをarchive、dashboard / handoffを同期する。

## Owner Effort Budget

- 介入回数上限: 3（Plan承認 / Ready / merge）
- 実働時間上限: 30分
- relay往復上限: 2

検証・mutation・review roundの計算資源は本発注どおり制限しない。承認依頼は
`この change での介入 N 回目 / 予算 3 回` と利用者可視の完了1文を添える。
Final Review是正relayで2/2へ到達した。ownerの是正検証・Ready承認relayは3/2となり、
owner明示指示による1回超過をbudget exceptionとして記録する。

## Risk

Risk: R3

Reason:
UI-11cのURL searchからquery key / CMD引数 / paginationへ渡すstate lifecycleと、
UI-05の保存中operator workflow・非同期商品検索結果の採否タイミングを変更する。
さらに`npm run lint`でmerge可否を変える機械guardとdirect dev dependency /
lockfileを更新する。DB、Tauri DTO、generated binding、永続データは非接触だが、
`docs/DEV_WORKFLOW.md` / `docs/project-profile.md`がR3とするroute/search state、
operator workflow、merge gateに該当する。destructive data lifecycleはなくR4ではない。

## Goal

Goal Invariant:

### 最小完了条件

- UI-11cのquery/displayに使う「直前のvalid search」は、commitされなかったrenderで
  更新されず、通常のvalid filter変更は現行どおり直ちにquery keyへ反映される。
- UI-05の非同期商品検索result gateは保存/失敗/reset eventで同期され、render中に
  refを書かない。保存開始後に完了した検索結果はformへ反映しない。
- React公式ruleに沿う`react-hooks/refs` guardが、是正前の実codeを検出し、
  是正後のrepo全体ではeffect/event/DOM ref/初期化を誤検出しない。
- production componentを通す回帰testとclean committed baselineのmutationで、
  snapshot / lock timingの退行をredにする。

### 失敗定義

- 対象2fileに初期化以外のrender-phase `ref.current` accessが残る。
- valid searchの通常更新に意図的な1 render遅延を入れる、invalid draftで新規CMDを
  呼ぶ、またはuncommitted searchをquery/displayへ漏らす。
- 保存event後のlate検索が候補/message/明細を更新する、または保存失敗/reset後も
  gateがlockされたままになる。
- lint guardが是正前codeを検出しない、既存の正当なref accessを誤検出する、
  cooldown / exact pin / ignore-scriptsを破る、または広いCompiler rule群を同時導入する。
- mutationを未commit treeで行う、mutantがgreenで生存する、復元後treeがdirtyになる。

### 非目的

- P7b-2 / 監査順15のraw anchor→typed router link。
- P5-4 / 監査順17のoperation log query key factory化。key構造
  `["settings", "logs", effectiveSearch]` は維持する。
- URL search schema、表示文言、pagination構造、CMD wire、業務意味論の再設計。
- UI-05の商品検索UX、保存処理、query invalidation、validationの変更。
- `eslint-plugin-react-hooks@7`の`recommended`に含まれるrefs以外のCompiler rule群の導入。
- backend / DB / `src/lib/bindings.ts`変更、既存testの削除・skip・無効化。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

### 現HEADの対象一覧

基準HEAD: `49f2c07`。監査findingの旧lineはdrift済みであり、以下を実測した。

| Cluster / ref | 現HEAD箇所 | accessの実体 | 是正 |
|---|---|---|---|
| UI-11c `lastValidSearch` | `OperationLogsPage.tsx:212` | `useRef(normalized)`初期化（許可） | state initializerへ置換 |
| 同1 cluster | `:214` | valid render中のwrite | valid commit後effectへ移す |
| 同1 cluster | `:216` | invalid render中のread | `lastCommittedValidSearch` stateを読む |
| 同downstream | `:238`, `:242-246`, `:299`, `:476` | query key / CMD / out-of-range / paginationが`effectiveSearch`を消費 | key構造・値の意味論を維持 |
| UI-05 `isFormLockedRef` | `DisposalPage.tsx:124` | `useRef(false)`初期化（許可） | event-synchronized gateとして維持 |
| 同write 1箇所 | `:180` | render中のwrite | submit/failure/reset eventへ移す |
| 同read 1箇所目 | `:206` | candidate選択eventのread | event内readを維持 |
| 同read 2箇所目 | `:227` | async検索完了callbackのread | callback内readを維持 |
| UI-05 DOM ref | `:123`, `:211`, `:254`, `:352` | 初期化、timeout focus、JSX ref | 正当な非対象。guard false positive 0を確認 |

箇所数の実体は、操作ログ側が**1 cluster（render write + render read）**、
廃棄側が**render write 1 + event/async read 2**。finding本文の
`package.json:38`は既知の誤引用で、現HEADの`eslint-plugin-react-hooks`宣言は64行目。

### UI-11c同期設計（UI-11c-D15）

```text
valid render:
  effectiveSearch = normalized（同renderで即時反映）
  commit後 effect -> lastCommittedValidSearch stateをnormalizedへ同期

invalid render:
  effectiveSearch = lastCommittedValidSearch
  logsQuery enabled=false、query key/CMD/paginationはcommit済みsnapshotを保持
```

- 通常のvalid filter/page変更は現在の`normalized`を直接使うため、意図的な
  1 render遅延は生じない。
- passive effectの直前にinvalid更新が割り込んだ場合だけ、1 renderの間さらに前の
  commit済みsnapshotを表示し、effect反映後に最新commit済みsnapshotへ収束し得る。
  uncommitted値は使わず、新規CMDも呼ばない。
- 提案は`useEffect`。`useLayoutEffect`ならpaint前にstateを同期できるがvalid変更ごとに
  同期rerenderをblockingする。害がinvalid入力の極小timingに限定されるためpassive
  effectを推奨する。**ownerが本packetを承認することを、このtiming差の受容判断とする。**
  受容されない場合はPlan Gateで`useLayoutEffect`案へ修正し、承認前に再reviewする。

### UI-05同期設計（UI-05-D15）

- 保存button eventの先頭でgateをlockし、その後に`createMutation.mutate()`を呼ぶ。
- frontend validation失敗 / command失敗のcallbackではunlockする。success後はresult
  stateと同じくlockを維持し、`resetForm` eventでunlockする。
- candidate選択eventとasync検索完了callbackはgateを読む。DOM focus refは変更しない。
- 現行のrender同期より、保存clickからpending render commitまでの極小窓でもlate検索を
  破棄するため、可視挙動が変わり得る。これはUI-05-D10の「保存中は商品追加をlock」
  をevent開始点から決定的にする是正として推奨する。**ownerのPlan承認をこのrace差の
  受容判断とする。** steady stateの表示・文言・保存意味論は変えない。

### 機械guard

- `eslint-plugin-react-hooks`をD-030準拠で`7.1.1`へexact更新する。
  commandは`npm install eslint-plugin-react-hooks@7.1.1 --save-dev --save-exact`。
  `.npmrc`の`ignore-scripts=true` / `min-release-age=7`を維持し、lockfile diffをreviewする。
- `7.1.1`の`recommended`は現行2 ruleから複数のCompiler ruleへ拡大するため、
  `eslint.config.js`では現行severity
  `rules-of-hooks=error` / `exhaustive-deps=warn`と
  `refs=error`だけを明示する。preset spreadは外す。
- cooldownで解決不能ならinstallを強行せず停止し、TypeScript ASTのlocal CI ruleを
  gated amendmentとして再提案する。現時点のprobeでは`7.1.1`はcooldownを満たす。

## Non-scope

- `queryKey`のfactory化・prefix変更・consumer invalidation変更。
- raw `<a href>`、route title、navigation ID、他のP7 finding。
- `StocktakePage`等にあるeffect同期stateの再設計。
- refs以外のReact Compiler diagnostics導入。
- visual design、日本語copy、Windows native操作手順の変更。

## Acceptance Criteria

- AC1: `rg -n "lastValidSearch|isFormLockedRef|\\.current" <対象2file>`と
  final diffで、初期化を除くrender-phase `.current` accessが0。
- AC2: UI-11c production component testで、suspendして破棄したvalid transitionの
  searchが後続invalid renderへ漏れず、最後にcommit済みのtable/pagination/queryを保持。
- AC3: UI-11cの通常valid変更は同renderのnormalized値で次の`listLogs`を呼び、
  invalid中は呼出し件数不変。expected dates/page/per_pageはtestへ独立転記する。
- AC4: UI-05 production component testで、保存eventと競合して完了した検索結果を
  破棄し、validation/command失敗とreset後は再検索可能。
- AC5: final configの`react-hooks/refs=error`を是正前HEADの実2fileへ当ててnonzero。
  検出位置はUI-11c render write/read clusterとUI-05 render writeに限定。
- AC6: `npm run lint`がrepo全体でpassし、effect/event/async callback、
  `searchInputRef`等DOM ref、`useRef(initial)`を誤検出しない。
- AC7: packageは`"eslint-plugin-react-hooks": "7.1.1"` exact。
  `.npmrc`不変、install scripts無効、lockfile diffをPR本文で要約し、
  `npm audit --audit-level=high`結果を記録する。
- AC8: clean committed baselineでMatrixのX1〜X4を実測し、対応testまたはlintが`exit 1` / red。exact-file復元後に`git status --short`空。
  exact-file復元後にtargeted greenと`git status --short`空を各mutantで確認する。
- AC9: `npm run typecheck` / `npm run lint` / `npm test` /
  `bash scripts/local-ci.sh full`がpassし、hosted CIはexact PR HEADでpass。
- AC10: `git diff origin/main -- src/lib/bindings.ts`が空。既存testの削除、skip、
  `.only`、assertion弱化が0。
- AC11: `bash scripts/doc-consistency-check.sh --target plan`がpassし、
  independent Plan ReviewerのP1/P2=0とowner承認後だけimplementationへ進む。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-204 / REQ-902
- Architecture: `docs/ARCHITECTURE.md` UI層境界、`docs/project-profile.md`
- Function / command / DTO: `docs/function-design/64-ui-disposal.md`
  UI-05-D10/D15、`docs/function-design/74-ui-operation-logs.md`
  UI-11c-D1/D8/D10/D15
- DB: 非接触。operation_logs / disposal schema・transaction意味論不変
- Screen / UI: `docs/SCREEN_DESIGN.md` UI-05 / UI-11c、
  `docs/UI_TECH_STACK.md` §2.1 UI-REF-D1
- Decision log / ADR: D-030（npm supply-chain defense）
- Finding: `docs/research/audit-2026-07/findings/p7-readability-idioms-naming.md`
  P7b-1、`report.md`順6、`adjudication.md`裁定注記1

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend / CMD / repository | なし | 非接触 |
| DTO / generated binding | なし | shape不変、bindings diff 0 |
| DB / transaction / audit | なし | 非接触 |
| UI-05 async lifecycle | `64-ui-disposal.md` UI-05-D15 | updated in plan-first PR |
| UI-11c route/search lifecycle | `74-ui-operation-logs.md` UI-11c-D15 | updated in plan-first PR |
| cross-cutting React/ref rule | `UI_TECH_STACK.md` UI-REF-D1 | updated in plan-first PR |
| durable npm policy | decision-log D-030 | existing sufficient |

## Registration / Generation Obligations

新規command、DTO、REQ、route、source docは追加しない。bindings / route tree /
traceabilityの登録変更なし。dev dependency exact更新で`package.json` /
`package-lock.json`を同期し、L1 fullでgenerated driftとbindings diff 0を確認する。

## Design Intent Trace

| Spec / requirement ID | Source section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-902 | 74 §74.2/6/12 | UI-11c-D15 | render-refはuncommitted値を残す。valid側までstate待ちにする案は通常更新lagのため棄却 | `OperationLogsPage.tsx` | committed/discarded transition tests |
| REQ-204 | 64 §64.1/3/6 | UI-05-D15 | effectだけではevent→commit raceを閉じない | `DisposalPage.tsx` | early-lock / unlock tests |
| React UI | UI_TECH_STACK §2.1 | UI-REF-D1 | review-onlyでは再発防止不可。広いrecommended導入はscope過大 | eslint/package/lock | before-code lint oracle + full lint |
| npm policy | D-030 | D-030 | new/custom dependencyやcooldown除外を避けofficial exact releaseを採用 | package/lock | exact pin / audit / lock review |

Plan Review P2-1 gated amendmentとして、`eslint.config.js`の具体差分を次で固定する。
`reactHooks.configs.recommended.rules`は7.1.1でrefs以外のCompiler rule群まで拡大するため
削除し、現行5.2.0で有効な2 ruleのseverityを独立転記した上でrefsだけを追加する。

```diff
 rules: {
   ...react.configs.flat.recommended.rules,
   ...react.configs.flat["jsx-runtime"].rules,
-  ...reactHooks.configs.recommended.rules,
+  "react-hooks/rules-of-hooks": "error",
+  "react-hooks/exhaustive-deps": "warn",
+  "react-hooks/refs": "error",
   ...jsxA11y.flatConfigs.recommended.rules,
 },
```

`reactHooks.configs.flat.recommended` / `recommended-latest`への置換、他Compiler ruleの
個別追加、inline disableはいずれも本changeでは禁止する。

## Design Intent Audit

- Source docs can answer what/why without chat orpacket: yes。UI-REF-D1 / D15を追加。
- Plan-only durable decisions promoted: ref purityと両同期timingをsource docsへ反映。
- Assumptions: React refs ruleはevent/effectを許可しrender accessを禁止する。
  exact 7.1.1はNode/ESLint現構成と互換でcooldown済み。
- Deferred gaps: refs以外のCompiler rules、P7b-2、P5-4。
- Matrix cites source IDs: yes。
- Absolute guarantee / escape hatch self-check: lazy initialization、DOM ref、effect/event、
  async callbackを明示例外として全repo lintで互換確認する。inline disableは追加しない。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable。外部adapter非接触 | none |
| Fact check / design decision split | React公式rule・plugin releaseはprobe、同期方式はapp decision | Contract Probe / source docs |
| Lifecycle / retry | commit/discard/invalid correction、save pending/success/failure/reset | Matrix State Lifecycle |
| Operator workflow | UI-05保存event直後のlate検索採否だけが可視差候補 | UI-05-D15 / owner承認 |
| Replacement path | official lint ruleを明示設定。custom ASTはcooldown失敗時のみ | gated amendment |
| Data safety / evidence | synthetic product/logだけ、実店舗data不要 | Data Safety |
| Reporting / accounting semantics | 不変 | non-scope |
| Manual verification | visual/copy不変。concurrent raceは自動testが適切 | L3不要 |

## Design Readiness

- Existing design docs are sufficient because: query key構造、invalid range保持、
  UI-05保存中lockのoperator契約は既存D1/D10/D10で固定済み。
- Source docs updated in this PR: UI_TECH_STACK UI-REF-D1、UI-05-D15、
  UI-11c-D15。
- Design gaps intentionally deferred: refs以外のCompiler ruleと別finding。
- Durable decisions discovered: 上記3 decision IDへ昇格。
- Owner decision required: Plan承認は、UI-11c passive effectの極小snapshot lag候補と、
  UI-05 event開始時lockによるrace差を受容する判断を兼ねる。承認されなければ
  implementationへ進まずdesign/planを改訂する。

Minimum design checks:

- Layer ownership: frontend UI内だけ。UI→CMD境界不変。
- Backend function design: 非接触。
- Command / DTO / data contract: `listLogs` / `searchProducts` shape不変。
- Persistence / transaction / audit impact: none。
- Operator workflow / Japanese wording: steady stateとcopy不変。race差は上記owner判断。
- Error / empty / retry / recovery: invalid range保持、search/save failure unlockをMatrix化。
- Testability / traceability: REQ-902 / REQ-204 + production RTL + real mutation。

## Contract Probe

- React 19 ref premise: official `useRef` / `react-hooks/refs` docsを確認 ->
  初期化以外のrender read/writeは禁止、effect/eventは許可、lazy initは例外。
- plugin availability: npm metadataで`7.1.1`は2026-04-17公開、Node >=18、
  ESLint 9対応、D-030の7日cooldownを満たす。
- detection/compatibility: `/tmp`へexact 7.1.1を
  `--ignore-scripts --min-release-age=7`で隔離し、`react-hooks/refs`だけを
  HEAD `49f2c07`の全frontend sourceへ適用 -> targetは
  `OperationLogsPage.tsx:214/216`と`DisposalPage.tsx:180`だけ。他fileの
  effect/event/DOM/initial ref accessは0。repo tracked diffも0。
- preset drift: 7.1.1の`recommended`を実読 -> 現行2 ruleにrefsほか複数の
  Compiler diagnosticsが追加されるため、explicit 3-rule configが必要。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-REF-D1 render purity | target2 components | final full lint / before-code oracle | L3不要 |
| UI-REF-D1 allowed contexts | repo全`.current` sites | full lint false-positive 0 | DOM/effect/eventは非対象 |
| UI-11c-D15 commit snapshot | OperationLogsPage state/effect | discarded transition regression | visual changeなし |
| UI-11c-D1/D10 key semantics | same query config | literal CMD args / call count | factory化non-scope |
| UI-11c-D8 pagination保持 | effectiveSearch consumer | existing+concurrent pagination assert | copy不変 |
| UI-05-D10 form lock | submit UI + mutation | existing saving lock test | visual changeなし |
| UI-05-D15 event gate | submit/error/reset/search callbacks | early-lock + unlock regressions | L3不要 |
| D-030 supply-chain | package/config/lock | exact pin / npm audit / lock review | cooldown bypass禁止 |
| bindings non-impact | `src/lib/bindings.ts` | origin/main diff 0 / L1 | backend非接触 |

Adjacent-contract sweepは74 §74.2/6/10/12、64 §64.1/3/5/6/9、
UI_TECH_STACK §2.1、D-030と全repo ref sitesを対象に実施。copy、CMD、DB、
query factory、invalidation、DOM focusはexerciseされないため明示non-scope。

## Test Plan

Test Design Matrix:
[2026-07-23-render-phase-ref-sync.md](test-matrices/2026-07-23-render-phase-ref-sync.md)

- targeted: OperationLogsPage / DisposalPage production RTL。
- negative: discarded render、invalid range、save/search race、validation/command failure。
- compatibility: valid filter即時反映、existing pagination/expanded row、focus ref、exact lint rules。
- data safety: synthetic fixturesのみ。
- main wiring: production component + TanStack Query + mocked generated commands。

## Boundary / Wire Contract

- producer: TanStack Router search props / UI events / generated command promises。
- consumer: TanStack Query key+queryFn / operation log table+pagination /
  disposal candidate/message/rows。
- wire type: `OperationLogsSearch`, `LogQuery`, `ProductWithRelations` shape不変。
- internal type: committed valid search state、event-synchronized boolean ref。
- precision/range: page/per_page/date semantics不変。
- round-trip: URL search→normalize→effective search→query/CMD/display、
  submit event→gate→async search completion。
- invalid input: inverted date range、save validation error。
- compatibility: key array/command args/copy/routes/bindings不変。

## Review Focus

- `effectiveSearch`のvalid側がstate effect待ちにならず、通常filterにlagを加えないか。
- abandoned renderがsnapshotを更新できないことをtestが実際に再現するか。
- UI-05 gateがmutation呼出し前にlockされ、全failure/resetでunlockされるか。
- v7 recommended spreadを残してscope外ruleを有効化していないか。
- guard proofがsynthetic fixtureではなく是正前の実codeをoracleにしているか。
- test expected値がproduction constant/helperをimportしていないか。
- P7b-2/P5-4/backend/bindingsへ侵入していないか。

## Spec Contract

Contract ID: SPEC-UI-REF-COMMIT-EVENT-01

- render中のref accessは初期化だけを許し、query/display snapshotはcommit後、
  async result gateはevent境界で同期する。
- UI-11cはvalid searchを即時反映し、invalid draftでは最後のcommit済みquery/displayを
  保持する。
- UI-05は保存event開始後のlate検索結果を破棄し、失敗/reset後は再操作可能に戻る。
- official lint ruleがこの境界をrepo全体で機械強制する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-902 / UI-11c-D15 | ref→state/effect | concurrent discarded render | commit-only snapshot | X1/X2 red |
| REQ-902 / D1/D10 | valid immediate path | literal `listLogs` args | key semantics不変 | targeted pass |
| REQ-204 / UI-05-D15 | event gate | early-lock / failure/reset-unlock | event ordering | X3 lint、X3a/X4/X4b test red |
| UI-REF-D1 | plugin/config exact update | before-code lint + full lint | allowed contexts | lint pass/fail |
| D-030 | exact install/lock review | package/audit checks | cooldown/scripts | PR evidence |

## Data Safety

- 実店舗の商品、価格、POS CSV、DB、backup、operation/diagnostic log、receipt、secret、
  `.env*`を読まない・生成しない・commitしない。
- RTLは既存synthetic log/product fixturesだけを使う。
- `/tmp` lint probe、`node_modules`、`.local`、route treeはcommitしない。
- lockfile以外のgenerated outputは差分0。`src/lib/bindings.ts`は非接触。

## Implementation Results

- UI-11cの`lastValidSearch` render ref clusterを、
  `lastCommittedValidSearch` state + valid commit後のpassive effectへ置換した。
  valid renderは現在のnormalized searchを即時に使い、invalid renderだけが
  commit済みsnapshotを使うため、query key構造と通常filterの反映timingは不変。
- UI-05のasync result gateは、保存button eventでmutation呼出し前にlockし、
  frontend validation / command failure callbackとreset eventでunlockする。
  candidate選択 / async検索完了callbackのreadとDOM focus refはevent/callback内に維持した。
- `eslint-plugin-react-hooks@7.1.1`をexact導入し、gated amendmentどおり
  recommended spreadを現行2 rule + `react-hooks/refs=error`の明示設定へ置換した。
  是正前contentの実2fileへfinal ruleを当てると対象unique lineだけでnonzero、
  final repo全体ではfalse positive 0だった。
- production component testでdiscarded valid transition、最新commit済みsnapshot、
  保存event/search競合、validation / command failure、reset recoveryを検証した。
  `startTransition` harnessは初回REDでsuspended renderを観測して狙ったassertionまで到達し、
  実装後GREENとなった。
- clean committed baselineからX1（旧render ref）、X2（snapshot effect削除）、
  X4（failure unlock削除）をkillした。初回X3はsubmit-event lockを単に削除した
  別mutantであり、Matrix指定のrender同期mutant killの証拠にはならないため主張を撤回した。
  初回X4bは既存idempotency test経由の間接killだったため、専用reset recovery testと
  Matrix行を追加した。X3 render同期mutantはproduction component harnessではgreenとなる
  既知限界を実証し、lint guard単独防御へ訂正した。event lock完全欠落はX3aとして
  behavior testで、reset unlock欠落はX4b専用testで再実測した。
- corrective clean baseline `7178f49` でX3（event lockをrender同期へ置換）は
  `npm test -- --run src/features/disposal/DisposalPage.test.tsx`が16/16 green、
  `npx eslint src/features/disposal/DisposalPage.tsx`が`react-hooks/refs` 1 errorでred。
  X3a（event lock削除）は同test fileで2 red / 14 pass、X4b（reset unlock削除）は
  専用`-t "unlocks product search directly after a successful reset"`で
  1 red / 15 skippedとなった。各mutantをexact復元後、同test 16/16 green、
  full lint pass、`git status --short`空を確認した。
- frontend gate、build、docs整合、traceability生成checkを通し、
  `src/lib/bindings.ts` diff 0を確認した。npm auditは更新前後とも同一結果で、
  本dependency更新による新規advisory増加は0。exact SHA、test件数、L1 evidenceは
  PR bodyを正本とする。

## Review Response

- Review-only sub-agent skipped because: 本発注はSol単独サイクルを指定し、
  Plan Reviewer / Final ReviewerはownerがSonnet 5 fresh contextで実施する。
- 2026-07-23 Plan Review一次（Sonnet 5 fresh context）: P1 = 0 / P2 = 1 /
  P3 = 1、総評「承認可」。P2-1は`eslint.config.js`の具体差分
  （recommended spread削除 + 現行2 rule severityの独立転記 + refsだけ追加）を
  上記Design Intent Traceへgated amendmentとして反映した。P3-1は記録のみとし、
  test環境の`startTransition`安定性を実装時の最初のconcurrent test RED/GREENで確認する。
- ownerはUI-11c passive effect極小窓の1 render表示候補と、UI-05 lockをevent開始点で
  確定するrace差を両方承認した。P2-1 amendment完了を条件にPlan承認し、
  `plan-approved -> implementing`への遷移とSolの実装着手を許可した
  （介入1/3）。
- 2026-07-23 Final Review一次（Sonnet 5 fresh context）: P1 = 1 / P2 = 0 /
  P3 = 1、総評「修正後 Ready」。P1をacceptし、Matrix X3のrender同期mutantを
  exact HEADへ再注入するとlintは1 errorだがDisposalPage 15/15 greenを独立再現した。
  原因は`userEvent.click`の`act()` batchがmutation pending renderをsearch Promise継続より
  先にcommitするためだった。推奨案(a)をnotification scheduler遅延、deferred search +
  次event-loop turn、capture解決、deferred `onMutate`で試したが、event handler自身の
  state/external-store updateをPromise continuationより後へ送れずX3は全構成でgreenだった。
  この実証をもって案(b)を採用し、X3の防御をlint guard単独とMatrix/PR evidenceへ明記する。
  event lock完全欠落はX3a behavior mutantとして区別する。P3もacceptし、
  X4b Matrix行とreset直後のsearch gateを直接assertする専用testを追加した。
  relayは2/2へ到達し、owner指示により次回Ready relayの3/2超過予定をbudget exceptionへ
  記録した。Phaseは`implementing`のまま維持し、Readyへは遷移しない。
- 2026-07-23 owner是正検証: X4b mutantの専用test RED→復元GREENを独立再現し、
  MatrixのX3 lint単独防御、X3a/X4b行、budget exceptionを実確認した。
  案(b)とevidence訂正を承認し、Final Review P1是正をconfirmした。
  P1/P2 closure = 0としてReadyを承認した（介入2/3、relay 3/2 exception）。
- Findings Freeze: frozen at Reviewed Content HEAD
  `06b459f52846d1edfb0add4b5a4b73005a523805`; post-freeze exceptions: none。
- 2026-07-23 owner merge承認（介入3/3）: exact-HEAD三点一致とhosted required
  checks成功を再確認後、PR #23をsquash mergeした。product scopeの追加変更はなく、
  Post-Merge Closeoutだけを別docs commitとして実施する。
