# Test Design Matrix: Home orchestration 回帰 test（順10 / P8b-2、wave 3 lane 1）

## Risk

Risk: R2（tricky）

## Contracts Under Test

- C1: 4 queryがexact command引数とdistinct literal keyで独立実行
- C2: stock / PLU / settlement派生値とstrict `< yesterday`
- C3: hidden中不変、visible復帰でlocal昨日更新、cleanup
- C4: HomePage warningと2独立toastが実hookから到達
- C5: mock boundaryはcommands、3fileは `UI-00`、90 diff 0

## Failure Modes

- 引数/key誤配線、all-or-nothing化、derived定数化、`<`→`<=`
- listener / guard / cleanup消失
- warning / toast片側消失
- hook全面mockによるfalse-green、traceability未参照file増加

## Test Matrix

| Contract | Test / oracle | Would fail if | Mutation |
|---|---|---|---|
| C1 | `useHomeSummary`: exact 4 calls + literal cache keys + one-error/three-success | date/bool/page/key/independenceが誤る | X1 sales別日、X2 lowStock=true、X3 csv=(2,1)、X4 query key衝突 |
| C2 | `useHomeSummary`: stock 3境界、PLU length、settlement null/equal/older | derived誤り、equal日に警告 | X5 `<`→`<=` またはcount定数化 |
| C3 | `useYesterdayDate`: fake local clock、hidden/visible、unmount | listener/guard/cleanupが壊れる | X6 listener除去、X7 visible guard反転 |
| C4 | `HomePage`: warning/final date、PLU toast、CSV toast、healthy表示 | main wiring/effectが消える | X8 warning除去、X9 toast effect片側除去（各toastを個別注入） |
| C5 | `UI-00` token + generator check + 90 diff 0 | T4 baseline増 / generated drift | G1 token除去 |

## State Lifecycle Matrix

| Subject | Initial/Pending | Success | Failure/Retry | Revisit/Restart | Evidence |
|---|---|---|---|---|---|
| 4 query | 同時・個別pending | 個別data | 1 error、他3維持。production retry不変 | remountは既存cache policy | hook test |
| yesterday | mountでlocal昨日 | visibleで更新 | hiddenは不変 | remount再計算 | date test |
| warning/toast | 条件UI非表示 | olderなら警告 | query別toast、他表示維持 | 再訪で再評価 | page test |

invalidate / persisted restartはbehavior変更scope外。

## Adjacent Pattern Audit

| Pattern | Sites | Port / exclusion | Evidence |
|---|---|---|---|
| QueryClient hook test | daily-report/csv/monthly/stock hooks | wrapper patternだけhomeへ | C1/C2 |
| visibility refresh | home + daily-sales date-nav | homeだけ。daily-salesは非scope | C3 |
| hand-built UseQueryResult | SummaryCards test | DOM characterizationとして維持、orchestration代替不可 | C5 review |
| FE token | generator T4 | 新規3fileへUI-00。gate改修は順11 | G1 |

## Negative Paths

- 4 commandの1つだけrejectしても他3success
- settlement null=false / equal=false / older=true
- hidden eventでは更新しない
- PLU errorはbar非表示、CSV errorはwarning非表示、toastは別id

## Boundary Checks

- local 23:59→翌日00:01、UTC literal不使用
- stock `<0` / `0` / `>0`、PLU empty/non-empty
- pagination `(1,1)`、includeDiscontinued=false

## Compatibility Checks

- generated command signature、queryKeys、Japanese wording、existing tests不変
- bindings / routeTree / 90 diff 0

## Data Safety Checks

- synthetic fixtureのみ。DB / store artifacts / secrets非接触
- mutationはcommitせず毎回復元・clean確認

## Main Wiring / Integration Checks

- HomePageはproduction `useHomeSummary`をmockしない
- expected keyはindependent literal
- visibility後の新yesterday sales callまで確認

## Mutation Execution

- commit済みclean treeでX1〜X9/G1をbaseline全量1回、各々red→復元→green
- Coordinatorが独立再実測。survivorはP1/P2 closure前に解消
- X9の2 toastは同familyの個別注入として両方記録

## Evidence Stop Condition

`exact-HEAD L1 + baseline全量mutation + P1/P2 closure`が揃った後は、runtime failure、Scope変更、または未closureのP1/P2がない限り追加の全量証跡収集を開始しない。証跡はGoal Invariantの判定手段であり、独立した成果として扱わない。

baseline全量は1回だけとし、oracle hardening後は変更familyの代表mutationだけを再実行して未変更familyを全量再認定しない。

## Generated Artifact Expectations

- bindings / routeTree / 90: diff 0
- traceability `--check`: PASS

## Final Evidence Set

- targeted 3 files
- frontend `typecheck` → `lint` → `format:check` → `test` → `build` を逐次実行
- docs / plan / traceability / exact-HEAD L1
- X1〜X9/G1 baseline、Final Review P1/P2 closure

## Mutation-style Adequacy Questions

- exact args/keyを各々壊すとredか
- `<`→`<=`をequal fixtureがkillするか
- query結合をone-error/three-successがkillするか
- listener/guard/cleanup、warning/2toastの個別削除がredか
- token除去でT4がredか

## Residual Test Gaps

- pixel-level UI、browser throttling、Tauri transportは非scope。production UI/CSS不変なのでvisual/L3なし。
- FE traceability allowlist/domain enforcementは順11。
