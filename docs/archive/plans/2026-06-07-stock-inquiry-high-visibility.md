# Plan Packet: 在庫照会 高視認性 follow-up

## Risk

Risk: R3

Reason:
Operator-facing UI の在庫状態表示を変更する。`在庫切れ` / `在庫少` は日常の発注判断に直結し、色だけの状態符号化を廃止するため、UI contract、テスト、Windows native L3 evidence が必要。

## Goal

在庫照会テーブルで、実利用者が赤 / 黄の色差に頼らず `在庫切れ` と `在庫少` を読み分けられるようにする。

## Scope

- 在庫照会テーブルに `状態` 列を追加する。
- `StockStatus` を `Badge + lucide icon + 日本語ラベル` で表示する。
- 在庫数セルの赤 / amber 表示は二次シグナルとして残す。
- 在庫照会の `StatusChips` active tone を solid stone から中庸 stone tone へ調整する。
- `ProductListTable` / `StockInquiryPage` / `StatusChips` の Vitest coverage を追加・更新する。
- `docs/function-design/58-ui-stock-inquiry.md` と `Plans.md` を同期する。

## Non-scope

- Sidebar / sales tabs / monthly-sales tabs / shared navigation の selection tone 統一。
- 状態チップの件数バッジ。
- display scale、webview zoom、全体 font-size 変更。
- route/search schema、Tauri command DTO、generated bindings、DB、POS CSV、PLU TSV、report CSV の変更。
- `list_low_stock` の BIZ 閾値判定変更。
- 新規 npm package / crate 追加。

## Acceptance Criteria

- `src/features/stock-inquiry/components/ProductListTable.test.tsx` で `在庫切れ` / `在庫少` / `通常` の text 表示を検証する。
- `src/features/stock-inquiry/components/ProductListTable.test.tsx` の展開行 guard が `td[colspan="6"]` を検証する。
- `src/features/stock-inquiry/components/StatusChips.test.tsx` で `data-state="on"`、変更通知、空文字 deselect 無視を検証する。
- `src/features/stock-inquiry/StockInquiryPage.test.tsx` で search flow の `在庫切れ` と low-stock flow の `在庫少` が main path に到達することを検証する。
- `bash scripts/doc-consistency-check.sh --target plan` が ERROR なしで完了する。
- `bash scripts/doc-consistency-check.sh` が ERROR なしで完了する。
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` が成功する。
- Windows native L3 で、PR #70 seed data の `在庫切れ` / `在庫少` を実利用者が色差なしでも言い分けられることを確認し、evidence を記録する。

## Test Plan

Test Design Matrix: [test-matrices/2026-06-07-stock-inquiry-high-visibility.md](test-matrices/2026-06-07-stock-inquiry-high-visibility.md)

- targeted tests: `ProductListTable.test.tsx`, `StatusChips.test.tsx`, `StockInquiryPage.test.tsx`
- negative tests: `StatusChips` の deselect 空文字を無視する
- compatibility checks: route/search schema、DTO、bindings、DB、CSV/TSV schema は変更しない
- data safety checks: synthetic test fixtures のみ使用し、実 POS / 店舗 artifact は触らない
- main wiring/integration checks: `StockInquiryPage` が `ProductListTable` 経由で status label を表示する

## Boundary / Wire Contract

- producer: `useStockInquiry` の `StockInquiryListResult.source` と `ProductWithRelations.stock_quantity`
- consumer: `ProductListTable`、`StockStatusBadge`、Windows native operator demo
- wire type: existing frontend DTO (`ProductWithRelations`) and list source token (`"search" | "low_stock"`)
- internal type: `StockStatus = "ok" | "low" | "stockout"`
- precision/range: `stock_quantity <= 0` は `stockout`; `source="low_stock" && stock_quantity > 0` は `low`; `source="search" && stock_quantity > 0` は `ok`
- round-trip path: CMD result -> `useStockInquiry` normalized list -> `deriveStockState` -> table `状態` column -> operator-visible label
- invalid input: unexpected stock unit handlingは既存 `formatStockDisplay` fallback のまま; invalid search params は既存 route validator のまま
- compatibility: no DB migration, no Tauri DTO or generated binding change, no route/search schema change, no POS CSV / PLU TSV / report CSV change

## Review Focus

- `在庫切れ` / `在庫少` が色だけでなく text + icon + badge / 状態列で伝わるか。
- frontend が低在庫閾値を持たず、既存の `deriveStockState` 契約を保っているか。
- 6 列化で商品名・在庫数・売価・展開行が読みにくくなっていないか。
- `StatusChips` の tone 調整が在庫照会内に閉じており、横断 selection-tone scope に広がっていないか。
- Tests が Tailwind class ではなく text / structure / state を assert しているか。

## Spec Contract

Contract ID: UI-STOCK-VIS-2026-06-07

- 在庫照会の業務ステータスは色だけで意味を伝えない。
- `stockout` は `CircleAlertIcon` + `在庫切れ` label を表示する。
- `low` は `TriangleAlertIcon` + `在庫少` label を表示する。
- `ok` は muted `通常` label を表示する。
- 状態列追加後、選択行直下の詳細展開は table width と一致する `colSpan=6` を使う。
- 在庫照会の `StatusChips` は常に 1 つ選択を維持し、active state は data-state と非過剰な stone tone で示す。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| UI-STOCK-VIS-2026-06-07 | 状態列 + Badge/icon/text | `ProductListTable.test.tsx` | 色だけに依存しない状態表示 | `npm test` |
| UI-STOCK-VIS-2026-06-07 | main path wiring | `StockInquiryPage.test.tsx` | search / low_stock flow から label が届く | `npm test` |
| UI-STOCK-VIS-2026-06-07 | colSpan 更新 | `ProductListTable.test.tsx` | 6 列 table と detail 展開の整合 | `npm test` |
| UI-STOCK-VIS-2026-06-07 | StatusChips active behavior | `StatusChips.test.tsx` | filter selection が状態として残る | `npm test` |
| UI-STOCK-VIS-2026-06-07 | source doc sync | doc consistency | 設計-実装契約の一致 | `bash scripts/doc-consistency-check.sh` |
| UI-STOCK-VIS-2026-06-07 | Windows native L3 | L3 note | 実利用者の状態読み分け | Passed: 実利用者から OK 報告（2026-06-07） |

## Data Safety

- 実 POS CSV、PLU exports、SQLite DB files、backups、logs、receipt images、store sales/cost data は commit しない。
- Windows native demo output と app data は local-only。
- Tests は `makeMockProductWithRelations` 由来の synthetic fixture のみ使う。
- `.env*`、credentials、keys、certificates、`auth.json` は読まない・触らない。

## Implementation Results

- Added `StockStatusBadge` and a `状態` column to `ProductListTable`.
- `stockout` renders `CircleAlertIcon` + `在庫切れ`; `low` renders `TriangleAlertIcon` + `在庫少`; `ok` renders `通常`.
- Kept stock count color as a secondary signal and updated detail expansion to `colSpan=6`.
- Adjusted `StatusChips` active tone from solid stone to a medium stone tone while keeping `data-state="on"`.
- Included the adjacent app-window UI adjustment in PR #74: Tauri initial window 1280x800, minimum 1024x720, centered.
- Added/updated tests:
  - `ProductListTable.test.tsx`: stockout / low / ok labels and `td[colspan="6"]`.
  - `StatusChips.test.tsx`: selected state, click emission, empty deselect ignored.
  - `StockInquiryPage.test.tsx`: search and low_stock main-path labels scoped to product rows.
- Synced source-of-truth docs: `docs/function-design/58-ui-stock-inquiry.md`, `docs/SCREEN_DESIGN.md`, `docs/Plans.md`, and `docs/PROJECT_HANDOFF.md`.
- Windows native preliminary check: 開発者側では状態列の文字ラベルで `在庫切れ` / `在庫少` を判別可能に見えている。
- Windows native L3: 実利用者から OK 報告。`在庫切れ` / `在庫少` を状態列の文字ラベルで判別できることを確認済み（2026-06-07）。
- RED check: targeted tests failed before implementation on missing status labels and stale `colSpan=5`.
- Validation:
  - `npm test -- src/features/stock-inquiry/components/ProductListTable.test.tsx src/features/stock-inquiry/components/StatusChips.test.tsx src/features/stock-inquiry/StockInquiryPage.test.tsx` -> 17 passed.
  - `bash scripts/doc-consistency-check.sh --target plan` -> ERRORなし（WARN: R3 review-only skip 記録）。
  - `bash scripts/doc-consistency-check.sh` -> ERRORなし（WARN: 58-ui-stock-inquiry per_page 上限記述、56-ui-daily-sales DatePicker 曖昧表現、R3 review-only skip 記録）。
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed.
  - `npm run format:check` -> passed.
  - `npm test` -> 233 passed.
  - `npm run build` -> passed（既存 Vite large chunk warning あり）。

## Review Response

Review-only skipped because: this session's sub-agent tool policy permits `spawn_agent` only when the user explicitly asks for sub-agents/delegation/parallel agent work. The R3 workflow called for a review-only pass, but the user did not explicitly authorize sub-agent delegation in this turn.

Self-review followed `docs/code_review.md` and `docs/quality/review-checklist.md`.

- Accepted P2 test gap: the first `StockInquiryPage.test.tsx` integration assertions used `screen.getByText("在庫切れ")` / `screen.getByText("在庫少")`, which could pass against `StatusChips` labels instead of the product row. Fixed by scoping assertions with `within(row)` for `P-ZERO` / `P-LOW`.
- No remaining blocking findings after the accepted fix.
- Residual risk: jsdom cannot prove human readability, icon recognizability, or table density on Windows native WebView, but PR #74 scope の実利用者 L3 は 2026-06-07 に通過済み。
