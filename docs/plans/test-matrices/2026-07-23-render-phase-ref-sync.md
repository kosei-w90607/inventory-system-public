# Test Design Matrix — 監査是正 順6: render-phase ref commit / event sync

Plan Packet:
[2026-07-23-render-phase-ref-sync.md](../2026-07-23-render-phase-ref-sync.md)

## Risk

Risk: R3

## Contracts Under Test

- UI-REF-D1: ref初期化以外のrender-phase `.current` accessは禁止。
- UI-11c-D15: last valid searchはcommit後だけsnapshotへ入り、valid renderは現在の
  normalized searchを即時使用、invalid renderは最後のcommit済みsnapshotを使用する。
- UI-11c-D1/D8/D10: URL search、query key/CMD args、pagination、invalid range中の
  table/expanded row保持は不変。
- UI-05-D10/D15: 保存event開始時にasync result gateをlockし、failure/resetでunlock、
  success中はlate search resultを反映しない。
- D-030: official pluginをexact/cooldown/scripts-offで更新し、refs ruleだけを追加する。
- test oracleはproductionのPER_PAGE、helper、query constant、gate helperから導出せず、
  literal dates/page/product code/visible resultを独立転記する。

## Failure Modes

- F1: suspended/discarded valid renderがsnapshotを更新し、後続invalid renderで
  uncommitted query key/list/paginationを使う。
- F2: state/effect化でvalid filter変更が1 render遅れ、旧queryを余計に保持する。
- F3: invalid range中に新しいCMDを呼ぶ、table/pagination/expanded rowを失う。
- F4: save click後、pending render前に完了した商品検索が候補/message/明細を更新する。
- F5: validation/command failureまたはreset後もgateがlockされ、再検索できない。
- F6: DOM focus refやeffect/event内refをguardが誤検出する。
- F7: refs rule/preset設定が消えてもfixed codeだけのlintがgreenになり、guard退行を
  見逃す。
- F8: plugin upgradeがrefs以外のCompiler rulesを暗黙に有効化し、scopeを拡大する。
- F9: dependency更新がexact pin/cooldown/ignore-scriptsを破る。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / command | Would fail if... |
|---|---|---|---|---|
| UI-11c-D15 | F1,F3 | RTL concurrent regression | `REQ-902 UI-11c-D15 keeps only the last committed valid search after a suspended transition is discarded` | render-ref mutantがabandoned searchを残す、invalid時にquery/dataを切替える |
| UI-11c-D15/D10 | F2 | RTL integration | `REQ-902 UI-11c-D15 queries a newly valid search without waiting for snapshot synchronization` | valid側もstate snapshotを待ち旧CMD argsを使う |
| UI-11c-D1/D8 | F3 | existing RTL regression強化 | `keeps the last valid list and expanded row while an inverted range is corrected` | invalid中CMD再実行、pagination/expanded row消失 |
| UI-11c-D15 | F1,F3 | RTL state boundary | `uses the newest committed valid search after a second invalid edit` | effect同期を削除/条件反転して古いsnapshotを保持 |
| UI-05-D15 | F4 | RTL event-order regression | `REQ-204 UI-05-D15 locks late search results before the saving render commits` | lockをrender/effectへ戻し、save event内で解決したsearchを反映 |
| UI-05-D15 | F5 | RTL recovery | `REQ-204 UI-05-D15 unlocks product search after validation or command failure` | onError/validation unlockが欠落 |
| UI-05-D15 | F5 | RTL reset recovery | `REQ-204 UI-05-D15 unlocks product search directly after a successful reset` | reset eventのunlockが欠落し、reset直後の検索resultを破棄 |
| UI-05-D10/D15 | F4 | existing RTL regression強化 | `REQ-204 ignores late product search results after the form is locked` | success/result中に候補・明細を追加 |
| UI-REF-D1 | F6,F7 | ESLint contract probe | final configでplan commitの是正前実2fileをlint | refs rule消失/無効化、target render access未検出 |
| UI-REF-D1 | F6 | CLI compatibility | `npm run lint` | event/effect/DOM/init refを誤検出、production render ref残存 |
| D-030 / F8 | F8,F9 | config/package review | exact package line + explicit 3 rules + lock diff + `npm audit --audit-level=high` | preset spread、extra Compiler rule、range pin、security/policy drift |
| bindings non-impact | scope drift | generated drift | `git diff origin/main -- src/lib/bindings.ts` | backend/DTOへ侵入 |

既存testの実在は現HEADで`rg`確認済み。新規RTLはproduction componentをrenderし、
generated `commands`だけをmockする。query key factoryやproduction constantsはimportしない。

## Concurrent Discard Harness

UI-11c-D15 testは次のproduction component経路を使う。

1. search Aとそのtable/paginationをcommitする。
2. `startTransition`でvalid search Bをscheduleする。
3. `OperationLogsPage`より後のsiblingがBでpending Promiseをthrowし、B renderを
   suspendしてcommitさせない。
4. urgent updateでinverted search Cをcommitする。
5. Aのtable/pagination/expanded rowが残り、BのCMD args/dataが採用されないことを
   literal oracleで検査する。

旧render-ref実装はstep 3までに共有refへBを書き、step 4でBを読むためredになる。
単なるStrictMode二重mountはref object自体が別でoracleにならないため採用しない。

## Disposal Event-order Harness

1. 商品Aを明細へ追加し、商品B検索をdeferredにする。
2. save click直前からTanStack Queryの実notification schedulerをtest内queueへ一時退避し、
   `createDisposal` mock内で商品B検索を解決、save Promise自体はpendingに保つ。
3. 1 microtaskを明示的に進め、保存eventは実行済みだがmutation pending通知が未flushの
   async gapで、B候補/message/明細が反映されないことを検査する。
4. schedulerをproduction defaultへ戻してpending通知をflushし、保存中表示へ到達する。
5. save failureを返した後、literal keywordで再検索できることを検査する。

通常の`userEvent.click`だけでは`act()` batchがpending re-renderをsearch継続より先に
commitし、render同期mutantでもgreenになる。scheduler queueはproduction
`DisposalPage` / `useMutation` / command経路を維持したまま、このorderingだけを
決定論的に分離する。

## Mutation 感度実測

実装・test・guardをcommitしたclean baselineだけで行う。mutantはcommitしない。
各red後はexact対象fileをHEADから復元し、対応test/lintのgreenと
`git status --short`空を確認してから次へ進む。

| ID | Production / guard mutation | 期待するred |
|---|---|---|
| X1 | UI-11c state/effectを旧`useRef` render write/readへ戻す | concurrent discarded render test + lint |
| X2 | valid commit後snapshot effectを削除または条件反転 | newest committed valid search test |
| X3 | UI-05 submit eventのgate lockをrender同期へ戻す | before-saving-render event-order test + lint |
| X4 | validation/command failureのunlockを削除 | failure recovery test |
| X4b | reset eventのunlockを削除 | reset直後のsearch gate専用test |

guard detection oracleはsynthetic fixtureでなくplan commitの実production codeを使う。
最終configで旧codeがred、同configでfixed repo全体がgreenの両方を証拠化する。

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| UI-11c valid snapshot | initial normalized | valid B render | B commit後effect同期 | N/A | valid keyで自然fetch | committed snapshot保持 | route再mountで再初期化 | B discardはsnapshot不変 | invalid修正でcurrent validへ | concurrent + newest committed tests |
| UI-11c logs query | A data | valid B fetch / invalidはdisabled | B data | N/A | filter/retry既存 | invalid中A/B latest committedを保持 | route再訪は既存Query契約 | query error既存Alert | same filter refetch | existing invalid/retry tests |
| UI-05 async gate | unlocked | submit event先頭でlocked | result中locked | disposal contract不変 | recent list既存 | resultからreset | remountでfalse | validation/command errorでunlock | same/new search可能 | early-lock + failure recovery |
| UI-05 search | empty | deferred B | unlocked時だけresult反映 | N/A | operator再検索 | form values保持 | reset clears | locked resultはdrop | failure後再実行 | component tests |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| all `useRef` / `.current` | `src/**/*.{ts,tsx}`全siteをofficial refs ruleでprobe | target 2 components | init、DOM ref、effect/event/async callbacksは正当 | before-code probe / final lint |
| state/effect search snapshot | `StocktakePage` effectiveSearch、UI-11c current code | UI-11cのみ | stocktakeはinvalid-draft snapshot scenarioでなくscope外 | code review |
| disposal scan-like flow | Receiving / ReturnExchange / ManualSale / Disposal focus/search refs | Disposal async gateのみ | focus refはrender accessなし | full lint / existing focus tests |
| query key semantics | OperationLogs literals、`query-keys.ts` | 生成箇所のみ維持 | factory化はP5-4/順17 | literal args + diff review |

## Negative Paths

- missing input: empty searchは既存early returnを維持。
- invalid input: inverted datesはCMDを呼ばずcommitted snapshot保持。
- duplicate/ambiguous input: multiple product candidatesの既存挙動不変。
- unknown reference: not applicable。
- dependency missing: exact plugin解決不能ならimplementation停止、custom ruleへ無断fallbackしない。
- permission/write failure: package install failureはlock/packageを部分採用しない。
- dry-run side effect: `/tmp` probeはtracked diff 0。mutationはcommitしない。

## Boundary Checks

- threshold: valid→invalid、discarded valid→invalid、save event→pending render。
- null/default: initial normalized search、ref initial false。
- empty/non-empty: search empty / one result / multiple result。
- min/max: page semantics不変、既存u32 max test維持。
- status/policy enum: gate unlocked/locked、workflow R3。
- wire type: command signatures不変。
- internal type: `OperationLogsSearch` state / boolean ref。
- producer/consumer: route search→query/display、submit event→async callback。
- round-trip token: literal dates/page/product code。
- precision/range: date lexical comparison既存。
- cross-language parse: none。

## Compatibility Checks

- old schema/input: unchanged。
- new schema/input: none。
- output order: unchanged。
- optional field behavior: one-sided/cleared date existing tests維持。
- query key: tuple structure・field meaning unchanged。
- lint severities: existing two rules exactly preserved、refs only added。

## Data Safety Checks

- source-derived data: 使用禁止。
- generated outputs: bindings diff 0、route tree非commit。
- secrets: `.env*` / credentials非読取。
- local-only files: `/tmp` probe / node_modules / `.local`非commit。
- synthetic sample boundaries: log/product/dateは独立synthetic literals。

## Main Wiring / Integration Checks

- helper connected to main path: production OperationLogsPage / DisposalPageをrender。
- output reaches UI: table/pagination/candidate/message/rowをassert。
- effective config reaches runtime: repo ESLint CLIでrefs ruleを実行。
- CLI arg reaches implementation: literal searchがmocked generated CMD callへ到達。

## Mutation-style Adequacy Questions

- discarded renderを本当に作るか: Suspense sibling + `startTransition`でcommit前Bを止める。
- key branchをrefへ戻すと何が落ちるか: X1。
- effectを消すと何が落ちるか: X2。
- event lockを遅らせると何が落ちるか: X3。
- failure unlockを消すと何が落ちるか: X4。
- reset unlockを消すと何が落ちるか: X4b専用test。
- guardを消すとどう検出するか: final configをplan commitの実codeへ適用するoracle。
- mock accidental constantをどう防ぐか: dates/page/per_page/product codesはtestへ独立転記。
- output/orderを何で守るか: existing table/pagination/expanded row assertionsを維持。

## Residual Test Gaps

- React scheduler内部の全interleavingを列挙しない。監査害経路である
  「child render後にsibling suspendでdiscard」を実再現し、steady stateは既存testで守る。
- passive effect commit直後の極小窓はownerがPlan Gateで受容判断する。
  testは前のcommit済みsnapshotから最新commit済みsnapshotへ収束することを固定する。
- Windows native visual差はなくL3を追加しない。raceとdiscardは自動testの方が再現可能。
