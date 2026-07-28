# Test Design Matrix: SortableHeader 共通 component 抽出（順21a / P1-1、wave 3 lane 3）

## Risk

Risk: R2（tricky、packetと同値）

## Contracts Under Test

- C1: canonical implementationは `src/components/sales/SortableHeader.tsx` の1箇所で、3 consumerにlocal implementationが残らない
- C2: active columnの `aria-sort` は方向どおり `ascending` / `descending`、inactive sortable columnは `none`
- C3: active indicatorはasc `▲` / desc `▼`、inactiveは空で、indicatorは `aria-hidden="true"`
- C4: `align="right"` はheaderへ `text-right` を付け、defaultはleft alignmentを維持する
- C5: clickは受け取ったgeneric `column`をそのまま `onClick`へ渡し、daily 5列 / monthly department 3列 / monthly ranking 4列の集合を変えない
- C6: shadcn `Button`の `type="button"` / `variant="ghost"` / `size="sm"` / classと`TableHead` DOM構造は不変
- C7: generic componentはdaily/monthlyのdomain型をimportせず、各consumer固有の `SortColumn` unionを型安全に受ける
- C8: catalog / 56 / 57がcanonical path、props、consumer列集合で一致する
- C9: P1-3 / P1-4のfile footprintへ触れず、順21全体を完了扱いしない
- C10: active test commentがcanonical shared ownerを現在形で示し、inline三重定義を将来課題として残さない

## Failure Modes

- F1: 1 consumerだけinline copyを保持し、以後のa11y修正が再び分岐する
- F2: active判定またはdirection変換を誤り、screen readerへ逆 / 無状態を伝える
- F3: indicator表示とARIA方向が食い違う、または装飾文字を重複読上げする
- F4: numeric headerの右寄せが失われ、表の桁揃えが崩れる
- F5: callbackが定数 / 別column / eventを渡し、URL sort stateが誤更新される
- F6: generic型を全feature unionや`string`へ広げ、誤columnをtypecheckが検出しなくなる
- F7: extraction時のimport cleanupでButton props/classまたはTableHead構造が変わる
- F8: source docsがinline ownershipまたは異なるconsumer列集合を示す
- F9: refactorがP1-3/P1-4、sort algorithm、route/searchへ拡張する
- F10: live commentがinline三重定義または将来の別PRでの共通化を示し続ける

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | structural anchor | G1: 3 consumerに `interface SortableHeaderProps` / `function SortableHeader` hit 0、canonical fileにimplementation 1件 | local copy残存 / canonical欠落 | G1: DepartmentTableへ旧inline functionを復元しanchor red |
| C2 | F2 | component integration (Vitest) | `DepartmentTable.test.tsx` active amount desc / inactive name none、daily側active ascもcharacterization | active判定、asc/desc変換、inactive値が変わる | X1: shared `ariaSort`を常に`none`にしてred |
| C3 | F2/F3 | component integration (Vitest) | existing 3 container testsへactive asc/desc indicatorと`aria-hidden` assertionを補強 | 矢印が逆、消失、inactive表示、aria-hidden消失 | X2: asc/desc indicatorを入替えてred |
| C4 | F4 | component integration (Vitest) | Department amount / Ranking quantity等のright-aligned headerとleft defaultをassert | `align` default/branch/classが消える | X3: `alignClass`を常に空にしてred |
| C5 | F5 | component integration (Vitest) | daily 5 keys、Department 3 keys、Ranking 4 keysのbutton click順 / payload | callback未発火、別key、列集合の欠落/追加 | X4: shared onClick bodyから`onClick(column)`を除去してred |
| C6 | F7 | DOM characterization (Vitest) | representative sortable buttonのtype / class、header roleをassert。全class文字列の過剰snapshotは使わない | submit化、ghost/sm/class、TableHead構造が変わる | X5: `type="button"`を削除または`variant="outline"`へ変更してred |
| C7 | F6 | compile gate | `npm run typecheck`、3 consumerが各feature `SortColumn`を渡す | shared componentがdomain型へ依存、`any`化、callback variance破綻 | invalid daily-only column type importをshared propsへ固定してtypecheck red |
| C8 | F8 | docs gate + review | catalog §③ / 56 §56.7 / 57 §57.7 exact canonical pathと列数 | source docsが分裂 | canonical pathまたは列数の1 anchorを旧記述へ戻してdocs/review red |
| C9 | F9 | diff footprint | `git diff --name-only`がpacket Scope内だけ | P1-3/P1-4やroute/searchへ波及 | out-of-scope path出現でreview red |
| C10 | F10 | live wording sweep | archive / researchを除く`SortableHeader` comment / docsをrepo-wide `rg` | canonical化前の状態を未完了の将来として残す | `MonthlySalesPage.test.tsx`の旧commentが残ればred |

## Characterization Baseline

抽出前に既存3 container testを使って以下をgreen固定する。shared component直import専用testは作らない。

| Consumer | Existing oracle | 今回補強する不足 |
|---|---|---|
| daily `ProductTable` | product code readability、empty state | 5 sort keys click、active/inactive aria-sort、asc indicator、right alignment |
| monthly `DepartmentTable` | 3 keys click、active desc / inactive none、defensive render | desc indicator、aria-hidden、right/default alignment、representative Button DOM |
| monthly `ProductRankingTable` | 4 keys click、ranking badge追従 | active indicator / aria-sortのshared結線確認 |

既存REQ literalの件数は変更しない。追加case名は `UI-09a` / `UI-09b` tokenを使い、`90-traceability.md`を変化させない。

## State Lifecycle Matrix

| State / subject | Initial | Action | Success | Failure | Evidence |
|---|---|---|---|---|---|
| inactive sortable header | `sortBy !== column` | render | `aria-sort=none`、indicator空 | activeに見える / 読まれる | C2/C3 |
| active ascending header | `sortBy === column`, `sortDir=asc` | render | `aria-sort=ascending` + `▲` | direction不一致 | C2/C3 |
| active descending header | `sortBy === column`, `sortDir=desc` | render | `aria-sort=descending` + `▼` | direction不一致 | C2/C3 |
| sortable header click | 任意column | button click | exact columnを1回callback | no-op / wrong key / duplicate | C5 |
| right aligned numeric header | `align=right` | render | `TableHead.text-right` | alignment消失 | C4 |

query / retry / persistence lifecycleは非接触のため、header render + click stateに集約する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| inline `SortableHeader` | daily ProductTable / monthly DepartmentTable / ProductRankingTableの3件 | canonical component 1件へ集約 | 他tableは同implementation consumerでない | G1 + repo-wide rg |
| sales shared components | `src/components/sales/TabsHeader.tsx` | 同directoryへ新規component | TabsHeaderは責務非重複、変更なし | diff footprint |
| table primitive | `src/components/ui/table.tsx` | importして現行DOM維持 | primitive変更はscope外 | C6 |
| sort algorithm / URL toggle | daily/monthly page/hooks/lib | portなし | componentはcallback発火だけを所有 | C5 + existing suites |
| record detail / request helpers | P1-3 / P1-4 sites | portなし | 順21の別correction unit | C9 |

## Negative Paths

- `sortBy=null` または別columnでは全sortable headerが `aria-sort=none`、indicator空
- active columnだけがascending/descendingで、同tableの他sortable columnsはnone
- plain `TableHead`（daily部門、Department構成比、Ranking順位）はsort button/callback対象にならない
- right align指定なしのlabel headerへ `text-right` を付けない
- click時にbuttonのdefault submit behaviorを起こさない
- defensiveなmonthly `sortBy="quantity"` / Department renderは既存testどおり破綻しない

## Mutation Execution

- baseline: implementation完了後のcommit済みclean treeでX1〜X5/G1を各1回、注入→targeted red→復元→targeted green→clean確認する
- Coordinatorは同じbaseline全量を独立再実測し、survivorがあればtest oracleを修正してP1/P2 closure前に解消する
- mutationはproduction期待値をtestへimportせず、DOM role / exact callback key / explicit ARIA valueから独立判定する
- docs mutationはsource docsを一時改変してcommitせず、検証後に完全復元する

## Evidence Stop Condition

`exact-HEAD L1 + baseline全量mutation 1回 + P1/P2 closure`が揃ったら、runtime failure、Scope変更、未closure P1/P2がない限り追加の全量mutation / review証拠収集を開始しない。oracle hardening後のclosureは変更したfamilyの代表mutationだけを再実行し、unchanged X/G familyの全量再認定は行わない。

## Generated Artifact Expectations

- `src/lib/bindings.ts`: diff 0
- `src/routeTree.gen.ts`: diff 0
- `docs/function-design/90-traceability.md`: diff 0
- `cargo run --bin generate_traceability -- --check`: PASS

## Final Evidence Set

- targeted 3 container tests green
- `npm run typecheck` → `npm run lint` → `npm run format:check` → `npm test` → `npm run build` を同一worktreeで逐次実行し、全てgreen（route generationを共有するcommandの並列実行は禁止）
- docs consistency green
- generated artifact diff 0 + traceability check green
- G1 / X1〜X5 baseline全量mutationのred/green記録
- exact-HEAD `bash scripts/local-ci.sh full` CLEAN
- independent Final Review P1/P2 closure

## Compatibility Checks

- 既存daily/monthly `SortColumn` unionとcallback signatureを変更しない
- 既存3 container testを削除・skip・期待緩和せず、抽出前characterizationを維持する
- `MonthlySalesPage.test.tsx`は冒頭commentだけをcanonical shared ownerの現在形へ同期し、test logic / assertion / importを変更しない
- table列順、sort algorithm、URL search、表示文言、Button / TableHead DOMを変更しない
- `src/lib/bindings.ts`、`src/routeTree.gen.ts`、`docs/function-design/90-traceability.md` はdiff 0

## Data Safety Checks

- DB、実CSV、店舗データ、backup、secret、local-only fileへ非接触
- test fixtureは既存synthetic dataだけを使い、実データを追加しない
- mutationはclean treeへ一時注入し、各試行後に完全復元する

## Main Wiring / Integration Checks

- 3 consumerがshared componentを実importし、container testがconsumer経由でshared DOM / callbackを通る
- shared component直importだけのtestでconsumer wiringを代替しない
- G1でcanonical implementation 1件とlocal implementation 0件を確認する
- archive / researchを除くlive wording sweepで、inline三重定義と将来の別PR表現が残らないことを確認する

## Mutation-style Adequacy Questions

- `aria-sort`を常に`none`へ変えたX1でactive/inactive両oracleがredになるか
- indicatorを入れ替えたX2でARIAだけgreenのfalse-openを防げるか
- right alignmentを消したX3で数値headerのDOM assertionがredになるか
- callbackを除去したX4で3 consumerの全column payload assertionがredになるか
- Button contractを変えたX5で過剰snapshotに頼らずrepresentative DOM assertionがredになるか
- local implementationを1件戻したG1でsingle-owner contractがredになるか

## Residual Test Gaps

- CSSのpixel-level同値はVitest対象外。class / DOM / alignment契約とtypecheck/buildで閉じ、operator-visible変更がないためWindows native L3は追加しない。
- P1-3 / P1-4は意図的に未検証・未完了であり、別correction unitへ残す。
