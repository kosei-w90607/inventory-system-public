# Test Design Matrix: UI backlog 消化 batch A（focus ring / Link 統一 / 復元成功 Alert）

## Risk

Risk: R3（packet と同値）

## Contracts Under Test

- C1: `SidebarLink.tsx` の focusable link（active / inactive）に §5.4 系統①の focus ring class（`focus-visible:border-ring` / `focus-visible:ring-[3px]` / `focus-visible:ring-ring/50`）が付与され、active / inactive / pending の既存 class 分岐と UI-12-D1 active 判定が保持される（pending は `tabIndex={-1}` で focus 対象外のまま）
- C2: src/ の production `.tsx`（test 除外）に生 `<a href>` が 0 件（複数行属性を含む）
- C3: static 9 箇所は型付き `<Link to/search>`、runtime 10 箇所は `<Link to={string}>` で、いずれも click で SPA 遷移する（全画面リロードなし）
- C4: `<Link>` 化後の遷移先 URL（path + search）が旧 `<a href>` の href 文字列と同値
- C5: 復元成功 → flag set → ホーム遷移 → ホーム mount 時に一度だけ component-local state へ取り込み、Alert 表示（実 Router + memory history の producer→consumer 統合、StrictMode 相当の二重 mount 下で Alert 1 個）
- C6: Alert は mount 中表示維持 — 同一 mount 中の通常 re-render（他 query 更新含む）で消えない。非表示になるのは unmount 後の再訪・store reset（reload 相当）のみ
- C7: flag なしの通常ホーム到達で Alert 非表示
- C8: 復元失敗経路で flag が set されず、失敗後に実 Router で通常ホームへ遷移しても Alert 非表示。navigate reject 時は flag が消去される
- C9: 既存 test の削除・無効化・skip なし（既存 assertion の弱体化なし）
- C10: docs anchor — 68-ui-backup-restore.md に `UI-11b-D11` が 2 箇所（D11 行 + §68.7 参照）、UI_TECH_STACK.md と 52-ui-shared-layout.md に `focus-visible:ring-[3px]` literal が各 1 箇所存在する

## Failure Modes

- F1: SidebarLink の focus ring 欠落、または追加時に active/pending 分岐 class・active 判定（UI-12-D1）を壊す
- F2: 複数行属性の `<a href>` が残存し単純 grep をすり抜ける
- F3: runtime 文字列遷移が `<a>` のまま残る、または `<Link>` 化で全画面リロードが残存する
- F4: helper 構造化変更で search param が欠落・変形し遷移先が変わる
- F5: 復元成功しても Alert が出ない（flag set 漏れ / consume 結線漏れ / StrictMode の discard render が flag を先食い）
- F6: Alert が同一 mount 中の re-render で消える（query 更新直後に消えて operator が見落とす = toast 問題の再生産）
- F7: Alert が再訪・reload・通常到達で再表示される、または復元失敗・navigate reject 経路で誤表示される
- F8: test 側の Router wrapper 追随で既存 assertion を削る・弱める
- F9: 設計 anchor が消え、実装と docs の対応が追えなくなる

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | component test (Vitest/RTL) | `SidebarLink` test へ focus class assertion 追加（active / inactive で `focus-visible:ring-[3px]` を含む class を assert、pending は非 focusable を assert）+ 既存 active 判定 test 維持 | ring class 欠落 / 状態分岐・active 判定破壊 | X1: baseClass から focus-visible 群を除去して red |
| C2 | F2 | mechanical gate | `rg -U --count-matches '<a\s+[^>]*href=' src --glob '*.tsx' --glob '!*.test.tsx'` = 0 件。**空集合 oracle の canary**: 変更前 HEAD で同コマンドが 19 件 / 10 file を返すことを PR body に記録し、コマンド自体の検出能力を証明する | 変換漏れ残存 | X2: 1 箇所を複数行 `<a href>` へ戻して非 0 を確認 |
| C3 | F3 | component integration (Vitest) | 代表 static 1 箇所 + 代表 runtime 2 箇所（`detail_route` 由来 / `MovementSourceLink.route` 由来）の click 遷移を memory history で assert | `<Link>` 未結線 / SPA 遷移不成立 | X3: `<Link>` を `<a>` へ戻して red |
| C4 | F4 | component integration (Vitest) | 同上 test で遷移後 location（pathname + search）を旧 href 期待値（**test 内へ独立転記した literal**、helper から導出しない）と完全一致比較 | URL 同値性破れ / search 欠落 | X4: helper の search 組み立てから 1 param を除去して red |
| C5 | F5 | integration (実 Router + memory history) | 復元成功 flow: mock 成功応答 → flag set → home render（StrictMode 相当の二重 mount 条件）→ Alert が**ちょうど 1 個**表示 | flag set 漏れ / consume 結線漏れ / discard render の先食いで 0 個 / 二重取り込みで 2 個 | X5: navigate 前の flag set 行を除去して red（0 個）。X5b: mount 取り込みを render 中の module 直接 read へ変えて StrictMode 下 red |
| C6 | F6/F7 | integration | 同一 mount 中: query 更新を模した re-render 後も Alert 表示継続。その後 unmount → remount（再訪）で非表示、store reset（reload 相当）後も非表示 | mount 中に消える（F6）/ 再訪で残る（F7） | X6: 取り込み先を component-local state でなく毎 render の store 参照にして re-render 後 red |
| C7 | F7 | integration negative | flag 未設定で home render、Alert 非表示 | 無条件表示 | X7: 受け口の flag 判定を常 true 化して red |
| C8 | F7 | integration negative | 復元失敗応答 → flag 非 set を assert → **実 Router で通常ホームへ遷移** → Alert 非表示。navigate reject 経路: flag set 後に navigate を reject させ、flag が消去されることを assert | 失敗経路で flag set / reject 後に残存 flag で次回誤表示 | X8: 失敗 branch へ flag set を注入し、失敗後の通常ホーム遷移 render で Alert 出現 = red |
| C9 | F8 | diff review gate | `git diff` で test file の削除行を review。既存 assertion の削除・`skip`・`todo` 出現 0 | assertion 弱体化 | review red（機械 gate は lint の no-skip 慣行に従う） |
| C10 | F9 | docs gate | `rg -c 'UI-11b-D11' docs/function-design/68-ui-backup-restore.md` = 2 / `rg -c 'focus-visible:ring-\[3px\]' docs/UI_TECH_STACK.md docs/function-design/52-ui-shared-layout.md` = 各 1 | anchor 消失・重複増殖 | X9: D11 行を旧 D4 のみへ戻して red |

anchor 一意性の確認（Matrix anchor uniqueness 教訓）: `UI-11b-D11` は 68 内の新設 ID。`focus-visible:ring-[3px]` の C10 gate は UI_TECH_STACK §5.4 と 52 §52.1 の 2 file を明示 path の rg -c で個別に固定する（src 内の実装出現と、§5.4 を参照する他 doc の出現 — 74 §a11y の系統①参照 = gated amendment で旧文言 sync — は C10 の対象外）。

## State Lifecycle Matrix

対象 state: 復元成功通知 flag（in-memory）と Alert 表示 state（component-local）。UI-11b-D11 の寿命契約を行単位で固定する。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 通知 flag（in-memory） | 未設定（Alert なし、C7） | 復元実行中は未設定 | 復元成功で set → navigate → home mount 取り込み時に消去（C5） | navigate reject で消去（C8） | — | 消去済みのため再訪で再 set されない（C6） | reload / restart で消滅（in-memory、C6） | 復元失敗では set しない（C8） | 復元再試行は成功時のみ再 set | Matrix C5-C8 |
| Alert 表示 state（component-local） | 非表示 | — | mount 時取り込みで表示、**同一 mount 中は query 更新・re-render を跨いで表示維持**（C6） | — | home の query refetch は表示に影響しない（C6） | unmount 後の再訪で非表示（C6） | reload / restart で非表示（C6） | 失敗経路では生成されない（C8） | — | Matrix C5 / C6 |
| home query cache（既存挙動） | — | — | 復元成功時に全消去（UI-11b-D4、既存実装不変） | — | 遷移後に自然 refetch | — | — | — | — | 既存 test 維持（C9） |
| sidebar focus ring | 非 focus 時なし | — | focus-visible で ring 表示 | — | — | — | — | disabled/pending は非 focusable | — | Matrix C1 |

workflow-state 変更なし（本 change は product code + docs のみ）のため、template の workflow-state 追加行は該当しない。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| internal 遷移の `<Link>` 化（route/search state pattern） | 生 `<a href>` 全 19 site / 10 file — packet「Link 統一 site manifest」に file:line・static/runtime 分類・evidence 紐付けを全列挙（C2 canary で機械固定） | 19 site すべて | external link は src/ に 0 件（除外対象なし）。test fixture 内の `<a>` は遷移 pattern ではないため対象外（rg glob で分離） | C2 / C3 / C4 + packet manifest |
| focus ring（accessibility pattern） | §5.4 系統① = `src/components/ui/` shadcn primitive 群 + SidebarLink。系統② = catalog 632・646 規定の date/month input、`segmented-control.tsx:9`、`DateNavigator.tsx` / `MonthNavigator.tsx` | SidebarLink のみ（本 change の port 対象） | 系統②の既存 component は catalog 規定準拠のため変更しない（§5.4 outcome 契約で両系統とも可視性を充足。全要素 3px 統一は round 2 P2-B 裁定で不採用、将来判断） | C1 + §5.4 / 52 §52.1 anchor（C10） |
| one-shot 通知（query invalidation 隣接） | 復元成功経路の `toast.success` + navigate（既存）、UI-11b-D4 cache 全消去（既存） | Alert 受け口を home へ新設（D11） | 他画面への同型通知の横展開はしない（本 change は復元経路のみ） | C5-C8 |

## Negative Paths

- missing input: flag なしの通常ホーム到達 → Alert 非表示（C7）
- invalid input: 復元失敗応答 → flag 非 set、通常遷移後も非表示（C8）
- duplicate/ambiguous input: StrictMode 二重 mount → Alert 1 個（C5）
- unknown reference: 該当なし（新規 route / ID なし）
- dependency missing: navigate reject → flag 消去（C8）
- permission/write failure: 該当なし（storage 不使用）
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: 該当なし
- null/default: flag 未設定 = 非表示が default（C7）
- empty/non-empty: C2 の空集合 oracle は変更前 HEAD の 19 件 canary と対で運用（PR body 収録）
- min/max: 該当なし
- status/policy enum: SidebarLink の active / inactive / pending 3 分岐の表示不変（C1）
- wire type: in-memory flag のみ。history.state / URL param / storage 不使用（UI-11b-D11、実装 review で確認）
- internal type: boolean 相当 one-shot flag + component-local 表示 state
- producer/consumer: `BackupRestorePage`（set）→ home component（mount 時取り込み）（C5）
- round-trip token: 該当なし（serialize しない）
- precision/range: 該当なし
- cross-language parse: 該当なし（IPC 不変）

## Compatibility Checks

- old schema/input: IPC / DTO / DB 不変（読み取りのみ）。旧 href と遷移先 URL 同値（C4）
- new schema/input: なし
- output order: 該当なし
- optional field behavior: `MovementSourceLink | null` の null 分岐は既存挙動維持（既存 test、C9）

## Data Safety Checks

- source-derived data: 実 POS / 店舗 data 不使用、synthetic fixture のみ
- generated outputs: `bindings.ts` / routeTree 再生成なし（変更対象外）
- secrets: 該当なし
- local-only files: 該当なし
- synthetic sample boundaries: 復元統合テストは mock 応答のみ、実 DB file を作らない

## Main Wiring / Integration Checks

- helper connected to main path: href helper の構造化変更が全呼び出し元へ配線される（typecheck + C3/C4）
- output reaches manifest/report: 該当なし
- effective config reaches runtime: 該当なし
- CLI arg reaches implementation: 該当なし
- producer→consumer 結線: 実 Router + memory history で BackupRestorePage → home を 1 本の test で通す（C5、mock で分断しない）

## Mutation-style Adequacy Questions

- key branch 反転（flag 判定の常 true 化）→ C7 が fail（X7）
- guard 除去（consume 時の flag 消去除去）→ C6 再訪 case が fail（X6 系）
- 失敗 branch への flag set 注入 → C8 が fail（X8）
- mount 取り込みを render 中 module read へ変更 → C5 StrictMode case が fail（X5b）
- helper の search param 欠落 → C4 の独立転記 literal 比較が fail（X4）
- mock の accidental constant 依存: C4 期待値は helper から導出せず test 内独立転記のため、helper 側 mutation で必ず不一致になる
- 出力 field 省略・order 変更・JSON range・browser round-trip: 該当なし（serialize / IPC 不変）

## Residual Test Gaps

- StrictMode の実挙動は Vitest 環境の React バージョンに依存する。test で二重 mount を明示再現しても、将来 React の StrictMode 意味論が変わった場合は L3 で顕在化する（受容: L3 に復元成功 Alert 目視を含む）
- reload の完全再現（実ブラウザ reload）は Vitest では store reset で代替する。真の reload 挙動は L3 の復元手順内で 1 回確認する
- 一括変換される 19 箇所のうち統合 test で遷移を実 assert するのは代表 3 箇所。残りは C2 機械 gate + typecheck + 既存画面 test の render green で担保し、全 19 箇所の click-through は L3 の代表画面遷移目視に委ねる

## Characterization Baseline

実装前に green 固定する既存挙動:

| Surface | Existing oracle | 今回補強する不足 |
|---|---|---|
| `BackupRestorePage` 復元成功 | 既存 test の成功経路（toast + navigate） | ホーム側 Alert の統合 assert（C5）。既存 toast assertion は残置または Alert へ置換を packet の文言判断に従い実施 |
| Affected Surfaces 11 test file（original 9 + amendment 2） | 各画面の render / 遷移 assertion | Router wrapper 追随のみ。assertion 本体は不変（C9） |
| `SidebarLink` | active/pending 分岐の既存 test（UI-12-D1 判定含む） | focus class assertion 追加（C1） |

既存 REQ literal の件数は変更しない。新規 test case 名は `UI-11b` token を使い、`90-traceability.md` を変化させない。

## Mutation 実測の運用

Final Review で Matrix の Mutation 列（X1-X9、X5b 含む）から最低 5 件（C2 canary / C5 / X5b / C6 / C8 を必須含む）を clean tree 上で実注入し、red 化を独立再現する（mutation kill claims need reproduction / clean tree only の運用教訓に従う）。
