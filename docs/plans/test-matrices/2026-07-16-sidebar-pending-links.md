# Test Design Matrix: サイドバー pending 2 項目の解消

> Design Phase 出典: [active plan](../2026-07-16-sidebar-pending-links.md)、`docs/function-design/52-ui-shared-layout.md` §52.3/§52.4/§52.6、`docs/function-design/58-ui-stock-inquiry.md` §58.4/§58.10、`docs/decision-log.md` D-047
> 本 Matrix は Design Phase 完了時点で作成する。実装は禁止（React コード変更なし）。実装 PR がこの Matrix に沿ってテストを追加する。

## Risk

Risk: R3

## Contracts Under Test

- REQ-101: サイドバー「商品登録」が `/products/new` で到達可能・active
- REQ-302: サイドバー「在庫少一覧」が `/stock` + `search: { status: "low_stock" }` の deep-link で到達可能・active
- UI-12-D1: `/stock` を指す 2 nav 項目（在庫照会・在庫少一覧）の排他 active 判定。「在庫少一覧」は `pathname === "/stock" && search.status === "low_stock"` のときのみ active、「在庫照会」は `pathname === "/stock"` かつ `search.status !== "low_stock"` のときのみ active
- D-047: `navigation.ts` に `status: "pending"` の項目が 0 件（全 19 項目 active）
- 既存契約（無変更）: `58-ui-stock-inquiry.md` §58.4 `validateSearch` zod schema、既存 17 active nav 項目の active/pending 判定

## Failure Modes

- 「商品登録」または「在庫少一覧」がサイドバーからクリックしても遷移しない、または pending 表示のまま残る
- `/stock?status=low_stock` で「在庫照会」と「在庫少一覧」が両方 active になる（現在地の混乱）
- `/stock`（search なし、または `status` が `low_stock` 以外）で「在庫照会」と「在庫少一覧」が両方非 active、または両方 active になる
- 「在庫少一覧」クリックが `status=low_stock` 以外の search を付与してしまう、または既存 `q`/`dept`/`selected` 等の他 search key を意図せず上書き・混入する
- `navigation.ts` の他 17 active 項目が本変更で誤って pending 化する、または既存 `to` が変わる
- `NavItem.search` を optional にしたことで `search` を持たない既存項目の型・実行時挙動が変わる（regression）
- 排他判定が `includeSearch` 意味論（library 側デフォルト）に暗黙依存し、TanStack Router のバージョン更新で挙動が変わる

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| REQ-101 | 商品登録に到達できない | unit (vitest, `navigation.test.ts`) | `test_navigation_req101_ui01b_active_at_products_new` | `ui-01b-new` の `status` が `"active"` でない、または `to` が `/products/new` でない |
| REQ-302 | 在庫少一覧に到達できない / search 欠落 | unit (vitest, `navigation.test.ts`) | `test_navigation_req302_ui06b_active_deep_link_low_stock` | `ui-06b` の `status` が `"active"` でない、`to` が `/stock` でない、または `search.status` が `"low_stock"` でない |
| D-047 | pending 項目の残置 | unit (vitest, `navigation.test.ts`) | `test_navigation_all_items_no_pending_status` | `navigation` 配列を `flatMap` した全項目のうち 1 件でも `status === "pending"` が残る |
| UI-12-D1 | 在庫少一覧経路での二重 active / 非 active | component (vitest + RTL, `SidebarLink.test.tsx`, router search state mock `/stock?status=low_stock`) | `test_sidebarlink_ui12d1_low_stock_search_only_low_stock_entry_active` | `/stock?status=low_stock` で「在庫少一覧」リンクが active class/aria 相当を持たない、または「在庫照会」リンクが active になる |
| UI-12-D1 | 在庫照会経路での二重 active / 非 active | component (vitest + RTL, `SidebarLink.test.tsx`, router search state mock `/stock`（search なし）と `/stock?status=all`） | `test_sidebarlink_ui12d1_plain_stock_only_inquiry_entry_active` | `/stock`（search なし、または `status` が `low_stock` 以外）で「在庫照会」リンクが active にならない、または「在庫少一覧」リンクが active になる |
| UI-12-D1 | search 混入 / 上書き | component (vitest + RTL, `SidebarLink.test.tsx`) | `test_sidebarlink_ui12d1_navigates_with_status_low_stock_search_only` | 「在庫少一覧」クリックの navigate 呼び出しが `search: { status: "low_stock" }` 以外の key を含む、または `status` 以外の値になる |
| 既存契約（回帰） | 既存 17 active 項目への副作用 | component (vitest + RTL, `Sidebar.test.tsx`) | 既存 snapshot/構造テストの更新（新規テスト名は実装 PR で既存パターンに追随） | `search` を持たない既存 nav 項目の active/pending 判定・遷移先が本変更前後で変わる |
| 既存契約（無変更確認） | `/stock` の `validateSearch` schema drift | 検査（レビュー手順、テスト関数ではない） | `58-ui-stock-inquiry.md` §58.4 との対照レビュー | `src/routes/stock/index.tsx` の `searchSchema` を本変更で誤って触ってしまっている |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| サイドバー「在庫少一覧」active 状態（router search 依存） | `/` 等の他画面表示中は非 active | 該当なし（クエリなし、純 UI state） | `/stock?status=low_stock` 遷移直後に active | 該当なし | 該当なし（サーバ状態ではない） | F5 後も URL に `status=low_stock` が残るため active 復元（既存 `58-ui` §58.4 の URL state 契約を再利用） | アプリ再起動後も URL 復元があれば同様に active 復元 | 該当なし（ナビゲーションに失敗モードなし） | 該当なし | `SidebarLink.test.tsx` |
| サイドバー「商品登録」pending→active 遷移 | 本変更前は pending（disabled span） | N/A | 本変更後は常時 active（`to` 固定） | 該当なし | 該当なし | 再訪しても常に active（状態を持たない静的定義） | 同左 | 該当なし | 該当なし | `navigation.test.ts` |

For workflow-state changes, add explicit rows for:

- content candidate -> L1 / independent review -> state-only human-confirm commit: 該当なし（本 packet は workflow-state 変更ではなく operator UI 変更）
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit: 該当なし
- state-only violation: 該当なし
- hosted-not-required incidental failure: 該当なし（Hosted CI Requirement: required、通常の product/gate failure 扱い）

## Adjacent Pattern Audit

Enumerate every site of each borrowed pattern; do not sample only the nearest file. Patterns include IME composition, Enter handling, focus order, formatter, query invalidation, error-kind mapping, route/search state, and accessibility.

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `search` prop 付き `<Link>` navigation（`returnTo` 実装） | `src/routes/products/new.tsx`（`returnTo` search param 実装、既存 L3 済み） | `src/components/layout/SidebarLink.tsx`（「在庫少一覧」項目の `search={{ status: "low_stock" }}`） | 他 nav 項目（`search` を持たない 18 項目）は対象外、既存 `to`-only navigation を維持 | `SidebarLink.test.tsx` |
| router 全体の generic state 取得（`useRouterState({ select })`） | `src/components/layout/RootLayout.tsx`（§52.5 ウィンドウタイトル機構、`select: (s) => s.location.pathname`） | `SidebarLink.tsx`（`select: (s) => s.location.search` で現在 search state を取得、UI-12-D1） | 各 route の `Route.useSearch()`（型付き、route 内限定）は使わない — Sidebar は RootLayout 配下で route 非依存のため generic selector が必須 | `SidebarLink.test.tsx` |
| pending/active の a11y 分岐（`role="link"` + `aria-disabled`） | `src/components/layout/SidebarLink.tsx`（既存実装、52-ui §52.6） | 変更なし（`ui-01b-new`/`ui-06b` は pending 分岐を通らなくなるのみ、分岐ロジック自体は無変更） | 該当なし | `SidebarLink.test.tsx` 既存ケースの回帰確認 |

## Negative Paths

- missing input: `search` を持たない nav 項目（既存 18 項目）で `item.search` が `undefined` のときに `<Link>` へ `search` prop を渡さない分岐が正しく機能する
- invalid input: `/stock?status=unknown`（zod で `undefined` に fallback される既存契約）のとき、在庫照会・在庫少一覧のどちらの nav 項目も誤って active にならないこと（在庫照会が active になるべき、既存 `validateSearch` fallback 後の実効値は `"all"` 相当）
- duplicate/ambiguous input: 該当なし（nav 項目の `search` は固定値のみ、利用者入力を受けない）
- unknown reference: 該当なし
- dependency missing: 該当なし
- permission/write failure: 該当なし
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: 該当なし
- null/default: `item.search` が `undefined` の 18 項目でも `<Link>` の active 判定が既存どおり動作する
- empty/non-empty: `search` オブジェクトが空でないこと（`{ status: "low_stock" }` の 1 key のみ）
- min/max: 該当なし
- status/policy enum: `NavStatus = "active" | "pending"` は無変更。`search.status` は既存 `ListChipFilter` enum のサブセット値 `"low_stock"` のみを nav 定義側で固定使用
- wire type: URL query string `?status=low_stock`
- internal type: 既存 `ListChipFilter`（`58-ui-stock-inquiry.md` §58.2）
- producer/consumer: `SidebarLink.tsx`（producer）→ `src/routes/stock/index.tsx` `validateSearch`（consumer、既存・無変更）
- round-trip token: `status=low_stock` が URL ↔ `StatusChips` 選択状態を往復する（既存契約、`58-ui` テストで担保済み。本 PR は producer 側追加のみ）
- precision/range: 該当なし
- cross-language parse: 該当なし（Rust 側関与なし）

## Compatibility Checks

- old schema/input: `/stock`（search なし）は本変更後も従来どおり「すべて」表示で「在庫照会」が active（既存利用者のブックマーク・履歴 URL への非破壊性）
- new schema/input: `/stock?status=low_stock` へのサイドバー deep-link が新規に追加される。`status=low_stock` 自体は `58-ui-stock-inquiry.md` の既存 enum member であり schema 変更ではない
- output order: 該当なし（nav 項目の表示順は無変更、配列内の位置を変えない）
- optional field behavior: `NavItem.search` を optional にしたことで既存 18 項目の型・レンダリングが変わらないことを確認する

## Data Safety Checks

- source-derived data: 該当なし
- generated outputs: 該当なし（bindings/routes/traceability いずれも本変更で再生成対象外。traceability のみ REQ test 数変動確認のため 1 度実行）
- secrets: 該当なし
- local-only files: 該当なし
- synthetic sample boundaries: 該当なし

## Main Wiring / Integration Checks

- helper connected to main path: `SidebarLink.tsx` の新しい search 比較ロジックが実際に `Sidebar.tsx` → `SidebarArea.tsx` → `SidebarLink.tsx` の既存 render path から呼ばれること（mock ではなく実 navigation 定数を経由するテストで確認）
- output reaches manifest/report: 該当なし
- effective config reaches runtime: `navigation.ts` の `search` field が実際に `<Link search={...}>` に渡り、URL に反映されること（RTL でクリック → `window.location`/router state のアサーション）
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- If `item.search.status` の比較が `===` から `!==` に反転したら、どのテストが fail するか: `test_sidebarlink_ui12d1_low_stock_search_only_low_stock_entry_active` と `test_sidebarlink_ui12d1_plain_stock_only_inquiry_entry_active` の両方が反転結果を検出する（正逆両方向テストのペアであるため片方だけの反転は検出できるが、両方同時に反転させた場合の検出力は Review Focus で目視確認する）
- If `search` field を渡し忘れて「在庫少一覧」の `<Link>` が `to="/stock"` のみになったら、どのテストが fail するか: `test_navigation_req302_ui06b_active_deep_link_low_stock`（`navigation.ts` 定義自体の欠落）と `test_sidebarlink_ui12d1_navigates_with_status_low_stock_search_only`（実際の navigate 呼び出し欠落）の両方
- If pending→active 切替時に `to` の typo（例: `/product/new`）が入ったら、どのテストが fail するか: `test_navigation_req101_ui01b_active_at_products_new`（`to` の exact match assertion）
- If 排他判定のガードを削除し両方常時 active にしたら、どのテストが fail するか: `test_sidebarlink_ui12d1_low_stock_search_only_low_stock_entry_active` の「在庫照会が active でないこと」assertion と、その逆側テストの「在庫少一覧が active でないこと」assertion
- If `navigation.ts` の他 1 項目を誤って `status: "pending"` に戻したら、どのテストが fail するか: `test_navigation_all_items_no_pending_status`

## Residual Test Gaps

- サイドバー全体の visual regression（レイアウト崩れ等）は本 Matrix の対象外。Windows native L3（Plan Packet Human Gate）で目視確認する
- TanStack Router の将来バージョンで `useRouterState({ select })` の型/実行時挙動が変わった場合の検知は本変更の範囲外（`52-ui-shared-layout.md` §52.5 の既存機構と共通のリスクであり、UI-12 全体の横断懸念として別途扱う）
