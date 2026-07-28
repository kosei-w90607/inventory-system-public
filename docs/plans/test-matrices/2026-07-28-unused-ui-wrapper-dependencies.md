# Test Design Matrix: 未参照 UI wrapper / 専用 dependency の退役（順19 / P6-1、wave 2 lane 1）

## Risk

Risk: R2

## Contracts Under Test

- C1: 対象wrapper 3fileが退役し再導入されない
- C2: RHF専用direct dependency 2件がmanifest/lockへ再導入されない
- C3: Zodと`radix-ui`は現役dependencyとして維持される
- C4: UI_TECH_STACKが `UI-FORM-D1` を採用正本とし、RHF/Form/DropdownMenu/RadioGroupを標準component扱いしない
- C5: UI-11aのcontrolled state + Zod behaviorは不変
- C6: 新規FE testが `UI-11a` tokenを持ち、WF-TRACE-04未参照baseline 22を増やさない

## Failure Modes

- F1: 孤立export moduleが復活し、noUnusedLocalsを通過する
- F2: consumer 0のdependencyが保守対象へ復活する
- F3: lockfile transitive packageをdirect adoptionと誤認してactive `radix-ui`まで削る
- F4: source docがRHF採用を再掲し、69/implementationとの分裂が戻る
- F5: cleanupがthreshold validation/save behaviorへ波及する

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | static (vitest) | `ui-form-dependency-contract.test.ts` wrapper absence | 3fileのいずれかが存在 | X1/X2/X3: 各fileを最小stubで復元してred |
| C2 | F2 | static (vitest) | 同testのmanifest/lock root direct dependency assertion | `@hookform/resolvers` または `react-hook-form` がroot direct dependencyとして復活 | X4/X5: 各dependencyをmanifestへ復元、X6/X7: lock rootへ各dependencyだけを復元して個別red |
| C3 | F3 | static + build | 同testの`zod` / `radix-ui` presence、typecheck/build | active dependencyを巻き添え削除 | G1: `zod` expectationを満たせない変更でred |
| C4 | F4 | static + docs | 採用表row、主要component例block、`UI-FORM-D1`定義bulletを正本から導出しないexact anchorで個別検査 | source docの一面だけが旧採用へ戻る | X8: 採用表row、X9: component例blockへtarget wrapper、X10: §2.7旧RHF肯定文を個別復元してred |
| C5 | F5 | regression | `ThresholdSettingsPage.test.tsx` | validation、save、field error behaviorが変化 | existing suite red |
| C6 | — | generator check | `cargo run --bin generate_traceability -- --check` | new testにREQ/UI tokenがなくT4 baselineが22→23 | G2: `UI-11a` tokenを除去してT4 red |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| UI-11a form state | 現行controlled state | 既存どおり | 既存どおり | 既存どおり | 既存どおり | 画面再訪時既存どおり | 既存どおり | field error既存どおり | 既存どおり | existing RTL |

Cleanup自体はruntime stateを持たない。lifecycleは「既存UI-11a挙動が不変」を回帰testで固定する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| target wrapper imports | `src/` repo-wide | 退役対象3file | 他UI primitiveは順19外 | rg + structural test |
| RHF/resolver imports | repo-wide | 退役 | Zodはactive consumer多数 | rg + package assertions |
| controlled form | threshold feature + 69 | 変更なし | 他画面の横断再設計なし | existing tests |

## Negative Paths

- missing input / invalid input: UI-11a既存testで維持
- duplicate/unknown reference: not applicable
- dependency missing: active Zod/radix-ui presence + build
- permission/write failure / dry-run: not applicable

## Boundary Checks

- threshold/null/default/min/max: UI-11a既存test
- status/wire/internal/round-trip/precision: 変更なし
- producer/consumer: wrapper production consumer 0、dependency専用consumer 0

## Compatibility Checks

- old/new schema/input/output order/optional field: 変更なし
- existing active component compilation: frontend typecheck/build

## Data Safety Checks

- source-derived data / generated outputs / secrets / local-only files: 非接触
- synthetic boundaries: mutation stubはtracked commitせず毎回復元

## Main Wiring / Integration Checks

- helper connected to main path: 対象helperはmain path非接続であること自体が退役根拠
- manifest reaches runtime: npm build成功
- generated output: なし

## Mutation-style Adequacy Questions

- wrapper 3件を個別に戻すX1〜X3で、each-file absence assertionが個別redになるか
- dependency 2件をmanifestへ個別に戻すX4/X5、lock rootだけへ戻すX6/X7で各面が個別redになるか
- 採用表、主要component例block、§2.7肯定文を個別に戻すX8〜X10で各source-doc assertionがredになるか
- active Zod/radix-uiを誤削除したとき、presence assertionとbuildがredになるか
- `UI-11a` tokenを除いたG2でtraceability T4がredになるか
- 既存UI testだけでは孤立module再導入をkillできないため、structural oracleを代替せず併用しているか

## Residual Test Gaps

- npm transitive graphは将来変化しうるため、`@radix-ui/react-dropdown-menu` / `react-radio-group` nodeの完全不在は保証しない。direct dependencyとtarget source fileだけを契約化する。
