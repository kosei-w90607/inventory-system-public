# UI-06c 商品別在庫変動履歴 implementation

## Risk

Risk: R3

Reason:
Operator-facing route / URL search state / generated command consumer / inventory traceability UI を追加する。DB schema と Rust DTO は PR #112 の既存 contract を使い、今回の主変更は frontend + source docs。

## Goal

在庫照会の商品詳細から商品別の在庫変動履歴を開き、いつ・何で・何個在庫が増減したかと元業務記録リンクを確認できるようにする。

## Scope

- `/stock/$code/movements` route の追加
- `commands.getStockDetail` と `commands.listMovements` を使う frontend hook / page / table
- 在庫照会詳細カードの「在庫変動履歴」導線を有効化
- `dateFrom` / `dateTo` / `type` / `page` URL search state
- UI-06c source design doc と dashboard 更新
- RTL/Vitest、route generation、typecheck/lint/format/build、docs check

## Non-scope

- DB schema / Rust BIZ/CMD/IO 変更
- `listMovements` の wire contract 変更
- 業務記録詳細 route の実装
- 取消/訂正、CSV出力、印刷、元 movement 関係表示
- `/inventory/records` 横断履歴ハブ

## Acceptance Criteria

- `src/routes/stock/$code.movements.tsx` が生成 route として有効になり、`npm run generate:routes` 後に `npm run typecheck` が通る。
- `StockDetailContent` の「在庫変動履歴」は `/stock/$code/movements` へ遷移でき、disabled 表示ではない。
- `StockMovementsPage` は `listMovements({ product_code: code, date_from, date_to, movement_type, page, per_page: 20 })` を呼ぶ。
- `MovementTable.test.tsx` で movement table が日時、種別、増減、変動後在庫、元記録、備考を表示する。
- `MovementRecord.source` がある行は `source.label` リンクを表示し、ない行は `元記録なし` を表示する。
- `StockMovementsPage.test.tsx` で product detail query 失敗時も movement list を表示できる。
- review-only sub-agent の結果を `Review Response` に記録し、P1/P2 があれば同 PR で対応する。
- Windows native L3 は owner 手動確認で実施し、結果を `Implementation Results` に記録する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-303, REQ-207
- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/ui-task-specs.md`
- Function / command / DTO: `docs/function-design/44-cmd-inventory.md`, `docs/function-design/58-ui-stock-inquiry.md`, `docs/function-design/65-inventory-record-traceability.md`, `docs/function-design/66-ui-stock-movements.md`
- DB: `docs/DB_DESIGN.md`, `docs/db-design/inventory-tables.md`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/design-system/README.md`, `docs/design-system/01-decision-rules.md`, `docs/design-system/02-component-catalog.md`
- Decision log / ADR: none

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `44-cmd-inventory.md` list_movements | existing sufficient |
| Command / DTO / generated binding / wire shape | `MovementQuery` / `MovementRecord` / `MovementSourceLink` in `44-cmd-inventory.md`, generated `bindings.ts` | existing sufficient |
| DB / transaction / audit / rollback / migration | `inventory_movements` design | existing sufficient; no schema change |
| Screen / UI / route state / Japanese wording | `SCREEN_DESIGN.md`, new `66-ui-stock-movements.md` | updated in this PR |
| CSV / TSV / report / import / export format | none | intentionally deferred |
| Durable decision / ADR | local UI decisions UI-06c-D1〜D8 | promoted to `66-ui-stock-movements.md` |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-303 | `66-ui-stock-movements.md` §66.1-66.5 | UI-06c-D1/D2 | 商品別台帳として path param + filter search state | route/page/hook | `StockMovementsPage.test.tsx` query assertion |
| REQ-303 | `66-ui-stock-movements.md` §66.5 | UI-06c-D4/D5 | 種別と増減を日本語で読める形にする | movement formatters/table | formatter/table tests |
| REQ-207 | `65` §65.8.2, `66` §66.5 | UI-06c-D6/D7 | 元記録リンクを source contract で表示する | MovementTable | source link / no source tests |
| REQ-301 | `58` StockDetailContent | UI-06c-D1 | 在庫照会詳細から movement へ遷移 | StockDetailContent | CTA href test |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes. `66-ui-stock-movements.md` に route/search/table/error/L3 を追加。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-06c-D1〜D8 を source doc に昇格。
- Assumptions and constraints: backend `listMovements` は PR #112 contract をそのまま使う。元記録詳細 route は後続実装の場合がある。
- Deferred design gaps, risk, and follow-up target: CSV出力/印刷/取消訂正/横断履歴ハブ/業務記録詳細は `65` §65.10 の後続スライス。
- Test Design Matrix can cite design decision IDs or source doc sections: yes.

## Design Readiness

- Existing design docs are sufficient because: backend command/DTO/DB contract は `44` と PR #112 で確定済み。
- Source docs updated in this PR: `docs/function-design/66-ui-stock-movements.md`, `docs/FUNCTION_DESIGN.md`, `docs/SCREEN_DESIGN.md`
- Design gaps intentionally deferred: 業務記録詳細 route 未実装時の遷移先完成は後続スライス。ただし link contract は表示する。
- Durable decisions discovered in this plan and promoted to source docs: UI-06c-D1〜D8

Minimum design checks:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated command の consumer。BIZ/IO は既存。
- Backend function design: `listMovements` / `getStockDetail` 既存。
- Command / DTO / data contract: `MovementQuery` / `MovementRecord.source` 既存 additive contract。
- Persistence / transaction / audit impact: read-only。なし。
- Operator workflow / Japanese UI wording: 在庫照会詳細から履歴、元記録リンク、増加/減少ラベル。
- Error, empty, retry, and recovery behavior: product/movement partial failure、EmptyState、filter reset through URL state。
- Testability and traceability IDs: REQ-303 / REQ-207 / UI-06c-D* を frontend tests に記載。

## Test Plan

See [test matrix](test-matrices/2026-06-27-ui06c-stock-movements.md).

- targeted tests: StockMovementsPage, MovementTable, movement formatters, StockDetailContent CTA
- negative tests: product detail fail + movement success, movement source null
- compatibility checks: generated route, typecheck, build
- data safety checks: no real POS/store files
- main wiring/integration checks: route generation, query key, command call shape

## Boundary / Wire Contract

- producer: existing Rust `list_movements` command via generated `commands.listMovements`
- consumer: `useStockMovements` frontend hook
- wire type: `MovementQuery` / `PaginatedResult<MovementRecord>`
- internal type: frontend display rows derived from `MovementRecord`
- precision/range: ids/counts are number; `page >= 1`, `per_page=20`
- round-trip path: URL search -> MovementQuery -> command -> table
- invalid input: zod fallback for invalid search params
- compatibility: no DTO changes; source is optional

## Review Focus

- URL search state and command query mapping
- `MovementRecord.source` optional handling
- operator-readable movement type and quantity direction
- no UI -> IO leakage
- tests tied to REQ-303 / REQ-207

## Spec Contract

Contract ID: SPEC-UI06C-MOVEMENTS

- 商品別在庫変動履歴は `/stock/$code/movements` で開き、`listMovements` の商品コード、日付範囲、種別、ページ指定を URL state から生成する。
- 履歴行は source link がある場合は元業務記録へリンクし、ない場合も movement 行自体は表示する。
- 増減は色だけでなく符号と日本語ラベルで表示する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-303 | route/page/hook | `StockMovementsPage.test.tsx` | command query mapping | Vitest |
| REQ-303 | table/formatter | `MovementTable.test.tsx`, formatter tests | readable rows | Vitest |
| REQ-207 | source link | `MovementTable.test.tsx` | optional source handling | Vitest |
| REQ-301 | source page link | `StockDetailContent.test.tsx` | CTA active route | Vitest |

## Data Safety

- Do not commit real POS CSV, PLU export files, store data, DB files, backups, logs, receipt images, secrets, credentials, or `.env` data.
- Local-only paths remain ignored: `.local/`, `docs/research/real-csv/`, app data, generated logs.
- Tests use synthetic fixtures only.

## Implementation Results

- Design Phase: `docs/function-design/66-ui-stock-movements.md` を追加し、`docs/SCREEN_DESIGN.md` / `docs/FUNCTION_DESIGN.md` / `docs/function-design/58-ui-stock-inquiry.md` を同期。
- Implementation: `/stock/$code/movements` route、`StockMovementsPage`、`useStockMovements`、`MovementTable`、formatters、在庫照会詳細カードの active link を追加。
- Traceability: `docs/function-design/90-traceability.md` を再生成。
- Validation so far: targeted Vitest 8 tests、full Vitest 460 tests、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`、`bash scripts/doc-consistency-check.sh`、`bash scripts/doc-consistency-check.sh --target plan`、`cd src-tauri && cargo run --bin generate_traceability -- --check` all pass.
- Manual: Windows native L3 completed by owner. Confirmed stock inquiry detail -> movement history navigation, product summary, date/type filters, pagination, movement table columns, `source=null` as `元記録なし`, and narrow-width horizontal table readability. 元記録詳細 route 自体は non-scope /後続実装。

## Review Response

- Review-only sub-agent Noether: P2 docs drift in `58-ui-stock-inquiry.md` because `StockDetailContent` active link conflicted with disabled/Phase 4 wording. Accepted and fixed in this PR.
