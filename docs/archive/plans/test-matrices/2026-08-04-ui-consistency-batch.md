# Test Design Matrix — UI consistency batch（検索欄 live 統一 / 52 §52.3 / 65 §65.5）

## Risk

Risk: R3

## Contracts Under Test

- SPEC-UICB-1: 商品検索欄 = SearchBar live 型（debounceMs=200、raw `search.q` 結線）
- SPEC-UICB-2: 変換確定 Enter 誤発火なし + 確定後の最終文字列反映（変換中の中間一時反映は live 型既定として許容 — Plan Gate round 1 P1-2 裁定 a）
- SPEC-UICB-3: q 変更（クリア含む）で page 既定 reset
- SPEC-UICB-4: function-design 配下 `/pos/` 記載 0、52 §52.3 = 実 route
- SPEC-UICB-5: 65 §65.5 JAN 行 = 実装実態 + owner 裁定 A 記録
- SPEC-UICB-6: 外付け label / `id` なし、既定 aria-label「商品検索」+ 既定 placeholder 統一
- 現行維持契約: TRACE-D11（条件保持）/ SPEC-UIBB-1/2（filter-empty reset）

## Failure Modes

- SearchBar 置換時に debounce が効かず全 keystroke で query 発火（または逆に Enter 即時 flush が消える）
- value 結線を normalized（trim 済み）にしてしまい raw 契約が壊れる
- 変換確定 Enter が search flush を誤発火する / compositionend 後の最終文字列が反映されない（変換中の中間文字列の一時反映は live 型既定挙動であり failure ではない — P1-2 裁定 a）
- q 変更時の page reset 消失（範囲外 page に取り残される）
- 検索欄置換の巻き添えで他 filter（種別 / 日付 / 記録ID）や filter-empty 判定が壊れる
- 外付け label / `id="records-keyword"` の撤去漏れで `htmlFor` が宙に浮く、またはアクセシブルネーム「商品検索」が失われる
- docs 是正が実 route / 実 DTO と食い違う値を書き込む（新 drift）

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- mutation ID（M-*）は Writer 自己実測に加え、Coordinator が記録非参照の独立導出で再実測する（clean tree、commit 後）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-UICB-1 | debounce 消失 / 常時即時発火 | unit (fake timers) | 新設: live 結線 test（入力後 200ms 未満は URL 不変、経過後に `q` 反映） | M-A1: `debounceMs` を 0 または未指定へ変更 |
| SPEC-UICB-1 | Enter 即時 flush 消失 | unit | 新設: Enter flush test（debounce 経過前の Enter で即 `q` 反映） | M-A2: SearchBar の `onSearchChange` 結線を debounce 済み経路のみに変更 |
| SPEC-UICB-1 | raw 結線破壊 | unit | 新設: no-trim test（前後空白入り入力が raw のまま `q` へ、value も raw 復元） | M-A5: value 結線を `normalized.q` へ変更、または結線前に `.trim()` 挿入 |
| SPEC-UICB-2 | 確定 Enter 誤発火 / 確定後の不反映 | unit | 新設: IME test（`isComposing` Enter で flush されない + compositionend 後の最終文字列が debounce 経過で `q` へ反映）。既存の「composing 中 onChange 非発火」assert は新契約へ改稿（削除・skip でない） | M-A3: SearchBar を経ず keydown isComposing guard のない生 input へ退行 |
| SPEC-UICB-3 | page reset 消失 | unit | 新設または既存拡張: q 変更時 page reset test | M-A4: `updateKeywordSearch` の `resetPage` を false へ変更 |
| TRACE-D11 | 条件保持破壊 | regression | 既存: 一覧⇄詳細の検索条件・page 保持 test（実在を rg で確認してから引用） | M-A6: 検索欄置換で search param merge を破壊 |
| SPEC-UIBB-1/2 | filter-empty 判定破壊 | regression | 既存: filter-empty reset action test | M-A7: `isFilterDefault` から `q` 判定を欠落 |
| SPEC-UICB-6（AC10） | label 撤去漏れ / 文言 drift | unit + CLI | 既存 `findByLabelText("商品検索")` green 維持 + placeholder assert 追加 + `rg -n "records-keyword" src/` 0 hit | M-A8: aria-label を別文言へ変更、または外付け label を残置 |
| SPEC-UICB-4 | 52 是正漏れ / 新 drift | CLI (review 手順) | `rg -n "/pos/" docs/function-design/` = 0 hit + §52.3 全行を `src/routeTree.gen.ts` と突合 | M-B1: 52 の 1 行だけ旧 URL に戻す |
| SPEC-UICB-5 | 65 同期漏れ / 過剰削除 | review | §65.5 JAN 行と全 6 DTO（bindings.ts の 5 `*RecordDetailItem` 型 + `StocktakeItemDetail`）の突合 + 変更履歴の裁定記録確認 | M-B2: JAN 行を削除だけして裁定記録を残さない |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| URL `q` param | undefined | 入力中（debounce 待ち、URL 不変） | 200ms 後 or Enter で反映 | クリアで param 削除 + page reset | q 変更で一覧 query 再実行 | 詳細から戻ると raw 復元（TRACE-D11） | reload で URL から復元 | — | — | live 結線 test / 既存条件保持 test |
| SearchBar draft | `search.q ?? ""` | 入力文字列保持 | flush で URL と一致 | 外部 q 変更で draft 同期（§59.2） | — | — | — | — | — | SearchBar 単体 test（既存） |
| IME composition | 非 composing | composing 中も debounce 経由の一時反映は許容（live 型既定、商品一覧・在庫照会と同一） | compositionend + debounce 後に最終文字列反映 | — | — | — | — | 確定 Enter 誤発火なし | — | IME test |
| 一覧 page | 既定 | — | q 変更で既定へ reset | — | — | — | — | — | — | page reset test |

workflow-state 行（本 change にも適用）:

- content candidate -> L1 / independent review -> state-only human-confirm commit
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit
- state-only violation: file allowlist と `git diff --unified=0` hunks の両方を検分。Scope / AC / contracts の変更は implementing へ戻す
- hosted-not-required incidental failure: 本 change は hosted required のため該当なし

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| SearchBar live 型（UI-01a-D9 / §59.1） | 商品一覧 / 在庫照会（適用済み）、入出庫履歴（自前実装）、取引 4 画面 + 棚卸し（商品追加欄）、記録ID 入力 | 入出庫履歴の商品検索欄 1 site | 商品追加欄 5 site = UI-04-D4 / UI-05-D5 の明示 commit 型設計（scan-like flow）を維持、live 化は backlog の autocomplete 候補へ。記録ID = `type="number"` でテキスト検索でない。在庫少一覧 = 在庫照会と同一実体で適用済み | 本 matrix + packet 非目的 |
| IME composition guard | SearchBar 内部 = Enter keydown のみ（`SearchBar.tsx:89,161`）、InventoryRecordsPage 自前 guard = 全 onChange ブロック（撤去対象） | SearchBar 経由へ一本化（keydown guard のみ。onChange guard は統一のため意図的廃止 — P1-2 裁定 a） | 商品一覧・在庫照会は既に同意味論のため差分なし | IME test + 既存 IME test の改稿 |
| route/search state 更新（updateSearch + resetPage） | InventoryRecordsPage 内の各 filter | q のみ SearchBar 経由化、他 filter 不変 | 種別 / 日付 / 記録ID / 部門 / 状態は本 change 対象外 | 既存 filter regression test |

## Negative Paths

- missing input: 空文字 → `q` param 削除 + page reset（既存挙動維持）
- invalid input: 空白のみ → raw で URL に載り、normalized 側で空扱い（既存意味論、no-trim test で固定）
- duplicate/ambiguous input: 該当なし（自由テキスト filter）
- unknown reference: 該当なし
- dependency missing: 該当なし（新規依存ゼロ、npm install なし）
- permission/write failure: 該当なし
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: debounce 200ms（未満で URL 不変 / 経過で反映を fake timer で両側 assert）
- null/default: `q` undefined ↔ 空文字の畳み込み
- empty/non-empty: 空クリア時の param 削除 + filter-empty 判定復帰
- min/max: 該当なし
- status/policy enum: 該当なし
- wire type: URL `q: string | undefined`（raw）
- internal type: `normalized.q`（trim 済み、query / 既定判定専用）
- producer/consumer: SearchBar → URL → normalized → 一覧 query
- round-trip token: 前後空白入りキーワードの URL 往復（raw 保持）
- precision/range: 該当なし
- cross-language parse: 該当なし（Rust 側不変）

## Compatibility Checks

- old schema/input: 既存共有 URL（`?q=trim済み文字列`）で従来どおり絞り込み表示
- new schema/input: raw（空白入り）`q` でも normalized 経由で同一結果
- output order: 一覧の並び順不変
- optional field behavior: `q` 省略時は全件（既存）

## Data Safety Checks

- source-derived data: 実店舗データ不使用
- generated outputs: `bindings.ts` / `routeTree.gen.ts` diff ゼロ（AC9）
- secrets: 該当なし
- local-only files: `.local/ci-evidence/` は commit しない
- synthetic sample boundaries: test fixture は synthetic のみ

## Main Wiring / Integration Checks

- helper connected to main path: SearchBar が実際の route 配線（実 router harness）で URL を更新することを assert（mock の onSearchChange 単体で済ませない）
- output reaches manifest/report: 該当なし
- effective config reaches runtime: `debounceMs={200}` が props として実渡しされている（literal sweep）
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant? → live 結線 test は fake timer + 実 router で URL 実値を assert し、mock 定数に依存しない
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct? → q 変更 → page reset → 一覧 query 再実行の順序を M-A4 test が固定
- If a key branch is inverted, which test fails? → IME composing 分岐反転 = M-A3
- If a threshold comparison changes, which test fails? → debounce 200ms 境界 = M-A1（両側 assert）
- If a guard is removed, which test fails? → Enter keydown の isComposing guard 撤去 = M-A3、filter-empty q 判定欠落 = M-A7
- If an output field is omitted, which test fails? → `q` param 欠落 = M-A1/M-A2
- If output order changes, which test fails? → 一覧並び順は既存 test（regression）
- If a state token is round-tripped through browser/client code, which test fails? → no-trim round-trip = M-A5
- workflow-state 系 3 問 → 本 change は template 標準の state-only / exact-HEAD 規律に従う（packet Workflow State 参照）

## Residual Test Gaps

- docs 系 mutation（M-B1/M-B2）は自動 test でなく review 手順 + rg sweep で担保（doc-consistency-check は URL 実在突合を持たない）。恒久機械化は本 batch の非目的
- SearchBar 部品単体の挙動は既存 test 資産に依存（本 change では部品不変のため再検証しない）
