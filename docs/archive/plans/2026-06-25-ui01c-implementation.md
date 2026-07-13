# Plan Packet: UI-01c 商品一括インポート implementation

## Risk

Risk: R3

Reason:
REQ-104 の商品マスタ CSV 取込み UI を新規実装する。Tauri command generated bindings、CSV preview / commit DTO、operator workflow、route/navigation、product/inventory query invalidation、Windows native L3 に触れるため R3。

## Goal

商品管理エリアに `/products/import` を追加し、CSV ファイル選択、プレビュー、エラー行確認、重複行の上書き/スキップ選択、確定、結果サマリまでを UI から操作できるようにする。

## Scope

- `docs/function-design/60-ui-product-import.md` を source design として追加し、`FUNCTION_DESIGN.md` / `SCREEN_DESIGN.md` / `UI_TECH_STACK.md` を同期する
- Rust 側既存 `preview_import` / `commit_import` command と import DTO に `specta::Type` / `#[specta::specta]` を追加し、商品一括インポート結果型は `ProductImportResult` に rename してから `src/lib/bindings.ts` を再生成する
- `/products/import` route、navigation active 化、`ProductImportPage` と import flow component / reducer を実装する
- preview / duplicate / commit flow の frontend tests を追加する
- commit 成功後に `queryKeys.productList.root()`, `queryKeys.lowStock(false)`, `queryKeys.stockInquiryRoot()`, `queryKeys.pluDirty()` を invalidate する
- Windows native L3 で file input / dragdrop、エラー行、重複行、上書き確認、結果導線を owner 確認する

## Non-scope

- CSV テンプレートのダウンロード
- `@tauri-apps/plugin-dialog` 導入
- preview result の server-side token / cache 化
- CSV 列マッピング UI
- 全重複行の一括上書き
- import cancel / resume
- import 履歴画面
- BIZ-01 / IO-03 の既存 CSV validation 仕様変更

## Acceptance Criteria

- `src/lib/bindings.ts` に `previewImport`, `commitImport`, `ImportRow`, `ImportErrorRow`, `ImportDuplicateRow`, `ImportPreview`, `ProductImportResult` 相当の型/command が存在し、既存 sales CSV `ImportResult` が壊れていない
- `/products/import` route が存在し、`src/config/navigation.ts` の UI-01c が `to: "/products/import"` / `status: "active"` になる
- `ProductImportPage` が `idle -> previewing -> preview -> committing -> result` と error/reset を reducer で扱う
- `ProductImportPage.test.tsx` で、重複行は既定スキップで、上書き選択が 1 件以上ある場合だけ確認ダイアログが出る
- `ProductImportPage.test.tsx` で、エラー行があっても取込対象があれば commit でき、取込対象 0 件なら commit button が disabled + 理由表示になる
- commit 成功時に `created_count` / `updated_count` / `skipped_count` を表示し、商品一覧へ戻る / 別CSVを取り込む導線が表示される
- `cargo run --bin generate_bindings` 後の `src/lib/bindings.ts` diff が意図した generated command / type だけである
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `cargo test`, `bash scripts/doc-consistency-check.sh`, `bash scripts/doc-consistency-check.sh --target plan` が green
- Windows native L3 owner confirmation が PR body / Plan Packet `Implementation Results` に記録される

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-104
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md` UI-01c, `docs/architecture/cmd-task-specs.md` CMD-01
- Function / command / DTO: `docs/function-design/26-io-product-csv-importer.md`, `docs/function-design/30-biz-product-service.md` §4.8/§4.9, `docs/function-design/40-cmd-product.md`, `docs/function-design/42-cmd-sales-stocktake.md` §22.6, `docs/function-design/60-ui-product-import.md`
- DB: `docs/db-design/master-tables.md`, `docs/DB_DESIGN.md` stock history / import assumptions
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md` §6.5.4, `docs/design-system/01-decision-rules.md`, `docs/design-system/02-component-catalog.md`
- Decision log / ADR: no new ADR; file input temporary exception is promoted to `UI_TECH_STACK.md`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `30-biz-product-service.md`, `40-cmd-product.md`, `42-cmd-sales-stocktake.md` | existing sufficient; implementation adds generated annotations only |
| Command / DTO / generated binding / wire shape | `60-ui-product-import.md` §60.4 + this packet Boundary / Wire Contract | updated in this PR |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `master-tables.md`, `30-biz-product-service.md` | existing sufficient; no schema change |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, `60-ui-product-import.md` | updated in this PR |
| CSV / TSV / report / import / export format | `26-io-product-csv-importer.md`, `60-ui-product-import.md` | existing format sufficient; UI handling updated |
| Durable decision / ADR | `UI_TECH_STACK.md` §6.5.4 | updated in this PR; no ADR needed |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-104 / UI-01c | `60-ui-product-import.md` §60.1 | UI-01c-D1 | independent import flow needs separate route | `src/routes/products/import.tsx`, navigation | `ProductImportPage.test.tsx` route/render |
| REQ-104 / CMD-01 | `60-ui-product-import.md` §60.4 | UI-01c-D2 | generated commands only; no ad hoc invoke; result type uses Rust `ProductImportResult` rename to avoid TS collision | `product_service.rs`, `product_cmd.rs`, `bindings.ts`, page hooks | Rust compile + binding existence test |
| REQ-104 / file input | `UI_TECH_STACK.md` §6.5.4 | UI-01c-D3 | avoid plugin-dialog scope expansion | `ProductImportDropzone.tsx` | dropzone/file input RTL |
| REQ-104 / UI flow | `60-ui-product-import.md` §60.3 | UI-01c-D4 | local reducer is sufficient | `product-import-reducer.ts` | reducer unit tests |
| REQ-104 / preview | `60-ui-product-import.md` §60.5 | UI-01c-D5/D8/D9 | show usable rows without blocking on row errors | preview components | preview/error/disabled tests |
| REQ-104 / duplicate | `60-ui-product-import.md` §60.5 | UI-01c-D6/D7 | avoid accidental bulk overwrite | duplicate table + dialog | duplicate/confirm tests |
| REQ-104 / post-commit | `60-ui-product-import.md` §60.7 | UI-01c-D10/D11 | avoid stale product/inventory UI with existing `queryKeys.productList.root()`, `queryKeys.lowStock(false)`, `queryKeys.stockInquiryRoot()`, `queryKeys.pluDirty()` helpers | mutation onSuccess, result screen | query invalidation + result tests |
| REQ-104 / L3 | `60-ui-product-import.md` §60.9 | UI-01c-D13 | new operator screen needs visual confirmation | PR evidence | manual Windows native L3 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, `60-ui-product-import.md`, `SCREEN_DESIGN.md`, and `UI_TECH_STACK.md` now carry route, command, state, duplicate, error, and file input decisions.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: file input temporary exception promoted to `UI_TECH_STACK.md`; UI workflow decisions promoted to `60-ui-product-import.md`.
- Assumptions and constraints: backend CSV validation and commit semantics remain as implemented; UI does not change BIZ/IO rules.
- Deferred design gaps, risk, and follow-up target: template download, plugin-dialog migration, server-side preview token, bulk overwrite, import history are deferred in `60-ui-product-import.md` §60.8.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, see `docs/archive/plans/test-matrices/2026-06-25-ui01c-implementation.md`.

## Design Readiness

- Existing design docs are sufficient because: BIZ/IO/CMD import behavior already exists and has REQ-104 backend tests; this PR only needs generated binding exposure and UI flow.
- Source docs updated in this PR: `docs/function-design/60-ui-product-import.md`, `docs/FUNCTION_DESIGN.md`, `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`.
- Design gaps intentionally deferred: listed in §60.8 and Non-scope above.
- Durable decisions discovered in this plan and promoted to source docs: UI-01c-D1 through D13; file input temporary exception.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI calls generated CMD only; CSV parsing and DB writes stay in BIZ/IO.
- Backend function design: existing `preview_import` / `commit_import` sufficient; annotations only.
- Command / DTO / data contract: generated command/type names must avoid collision with sales CSV `ImportResult`; implementation renames product import result to `ProductImportResult`.
- Persistence / transaction / audit impact: no schema change; existing single TX commit and operation log remain.
- Operator workflow / Japanese UI wording: source docs define file select, preview, duplicate, error, commit, result labels.
- Error, empty, retry, and recovery behavior: source docs define file-level error, row errors, zero-target disabled state, commit retry.
- Testability and traceability IDs: tests will cite REQ-104 / UI-01c-D*.

## Test Plan

See `docs/archive/plans/test-matrices/2026-06-25-ui01c-implementation.md`.

- targeted tests: reducer, dropzone/file input, preview rows, duplicate overwrite dialog, commit payload, result screen, query invalidation, generated binding compile
- negative tests: empty file, file-level error, row errors, duplicate default skip, zero import target, commit failure retains preview
- compatibility checks: generated command names do not collide with existing CSV import `ImportResult`; Rust product import result is renamed to `ProductImportResult`; existing product list/form tests remain green
- data safety checks: synthetic CSV fixtures only; no real POS/store data
- main wiring/integration checks: route, navigation, command registration, binding generation, mutation invalidation

## Boundary / Wire Contract

- producer: `src-tauri/src/cmd/product_cmd.rs` generated `preview_import` / `commit_import`
- consumer: `src/features/products/ProductImportPage.tsx` and import flow hooks/components
- wire type: tauri-specta typed commands returning `typedError<T, CmdError>`
- internal type: `product_service::ImportRow`, `ImportErrorRow`, `ImportDuplicateRow`, `ImportPreview`, `ProductImportResult`（existing product-service `ImportResult` is renamed）
- precision/range: counts are `usize` in Rust and number in TS; product count scale is well below JS safe integer range
- round-trip path: file bytes -> `previewImport` -> `ImportPreview` -> selected rows -> `commitImport` -> `ProductImportResult`
- invalid input: empty file returns `CmdError.kind="validation"`; parse/header errors return `CmdError` via BizError::ImportError; row validation errors remain in `error_rows`
- compatibility: existing sales CSV import `ImportResult` type name must not be shadowed or broken; product import uses `ProductImportResult`

## Review Focus

- UI does not call IO or untyped invoke directly
- Product import result type does not collide with existing sales CSV import `ImportResult`
- Duplicate overwrite payload includes only selected duplicate rows plus all valid rows
- Error rows never enter commit payload
- Commit target 0 disables action with visible reason
- `committing` state does not present cancel/resume that backend cannot honor
- Query invalidation uses existing `queryKeys.productList.root()`, `queryKeys.lowStock(false)`, `queryKeys.stockInquiryRoot()`, `queryKeys.pluDirty()` helpers and stays near mutation success
- L3 evidence covers readability and state distinction, not only happy path

## Spec Contract

Contract ID: SPEC-UI01C-REQ104

- `REQ-104`: The operator can import product master CSV through UI-01c by selecting a file, previewing valid/error/duplicate rows, choosing overwrite/skip for duplicates, committing importable rows, and seeing created/updated/skipped counts.
- `UI-01c-D2`: Frontend command calls use generated `commands.*`; no ad hoc invoke path.
- `UI-01c-D7`: Overwrite confirmation is required only when one or more duplicate rows are selected for overwrite.
- `UI-01c-D8`: Row errors do not block importing other valid rows.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-104 | generated command exposure | Rust compile + `bindings.ts` diff | no type collision | `cargo run --bin generate_bindings` |
| UI-01c-D4 | reducer implementation | `product-import-reducer.test.ts` | invalid transitions | `npm test` |
| UI-01c-D6/D7 | duplicate handling | `ProductImportPage.test.tsx` duplicate cases | overwrite payload and dialog | RTL output |
| UI-01c-D8/D9 | row errors / zero target | `ProductImportPage.test.tsx` error rows | commit disabled only when target 0 | RTL output |
| UI-01c-D10/D11 | result/invalidation | `ProductImportPage.test.tsx` commit success | stale query prevention | RTL output |
| UI-01c-D13 | owner visual confirmation | Windows native checklist | readability/state distinction | PR evidence |

## Data Safety

- Do not commit real POS CSV, store product masters, price/cost data, DB files, logs, backups, receipt images, secrets, or `.env*`.
- CSV fixtures must be synthetic and minimal; product names/codes must be fake.
- Local-only testing artifacts stay under ignored paths such as `.local/` or temp directories.
- No destructive DB cleanup, migration rollback, or generated data deletion is in scope.

## Implementation Results

- Implemented generated command exposure for REQ-104 product import:
  - added `#[specta::specta]` for `preview_import` / `commit_import`
  - added `specta::Type` to import DTOs
  - renamed product import result to `ProductImportResult` to avoid the existing sales CSV `ImportResult` TS collision
  - regenerated `src/lib/bindings.ts`
- Implemented `/products/import`:
  - route file: `src/routes/products/import.tsx`
  - navigation UI-01c active: `to: "/products/import"`
  - page / flow: `ProductImportPage`, `ProductImportDropzone`, `ProductImportPreview`, reducer, hook
  - commit payload is `preview.valid_rows + selected duplicate import_row[]`; `overwriteCodes` contains only selected duplicate `product_code`s
  - error rows are displayed but never included in commit payload
  - zero target disables commit with a visible reason
  - successful commit invalidates `queryKeys.productList.root()`, `queryKeys.lowStock(false)`, `queryKeys.stockInquiryRoot()`, and `queryKeys.pluDirty()`
- L3 follow-up fix:
  - Windows native L3 found file input works but drag/drop did not reach the HTML dropzone.
  - Fixed by setting the main Tauri window `dragDropEnabled: false`, matching the plain HTML file input/dropzone implementation.
  - Owner re-tested on Windows native after the fix: drag/drop works and immediately reads the dropped CSV contents into the preview.
- Added tests:
  - reducer tests for preview start, duplicate overwrite selection, commit failure recovery
  - page tests for successful commit, selected duplicate overwrite payload + dialog, and zero-target disabled state
- Gate evidence:
  - `cargo run --bin generate_bindings`: pass
  - `npm run typecheck`: pass
  - `npm run lint`: pass
  - `npm run format:check`: pass
  - `npm test`: pass, 60 files / 386 tests
  - `npm run build`: pass
  - `cargo fmt --check`: pass
  - `cargo clippy --all-targets --all-features -- -D warnings`: pass
  - `cargo test`: pass, including `design_compliance_test`
  - `bash scripts/doc-consistency-check.sh --target plan`: pass
  - `bash scripts/doc-consistency-check.sh`: pass
- Manual / owner gate:
  - Windows native L3 owner confirmation is partially complete:
    - `/products/import` opens from product management navigation.
    - file input selection works.
    - drag/drop works after the `dragDropEnabled: false` fix and immediately reads the dropped CSV into preview.
    - synthetic CSV checks confirmed new candidate / error row / duplicate distinction, default duplicate skip, overwrite confirmation, and created / updated / skipped result counts.
    - return-to-list flow was owner-confirmed.
    - commit-in-progress navigation hiding is too fast to reliably observe manually; `ProductImportPage.test.tsx` holds `commitImport` pending and confirms the header "商品一覧へ戻る" link is absent while import and reselect actions are disabled.
  - Remaining before merge: PR review / merge readiness final check.

## Review Response

- Design-phase review-only sub-agent:
  - P2 query invalidation drift: fixed to use existing helpers `productList.root()`, `lowStock(false)`, `stockInquiryRoot()`, `pluDirty()`
  - P2 result type collision risk: fixed by using Rust/TS `ProductImportResult`
  - P3 unrelated untracked continuity plan: acknowledged, left untouched
- Implementation review-only sub-agent:
  - P2 commit 中もヘッダーの「商品一覧へ戻る」リンクから離脱できる: accepted. `committing` state では `PageHeader.actions` を非表示にし、`UI-01c-D12` の「中断可能に見せない」を守るよう修正。
  - P2 result / query invalidation / committing 中 false-cancel の RTL coverage 不足: accepted. `ProductImportPage.test.tsx` に結果サマリ、4 query invalidation、commit pending 中の戻り導線非表示 + 再選択/実行 button disabled を追加。
  - P3 unrelated untracked continuity plan: acknowledged. `docs/plans/2026-06-13-continuity-docs-consolidation.md` は本 UI-01c scope 外として触らず、PR 作成時に除外する。
