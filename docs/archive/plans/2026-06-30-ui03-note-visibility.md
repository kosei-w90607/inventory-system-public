# UI-03 返品・交換 備考 visibility follow-up

## Risk

Risk: R3

Reason:
Operator-facing UI の表示構造、保存結果、recent list、業務記録詳細の読みやすさを変更する。DB、BIZ、CMD、generated binding、route/search state は変更しない。

## Goal

返品・交換で確認優先度が高い備考を、入力時・保存直後・直近一覧・詳細確認で独立項目として読めるようにする。

## Scope

- UI-03 作成画面の備考入力を複数行欄にする。
- 保存結果に備考を独立表示し、入力なしの場合も `備考なし` と表示する。
- 直近の返品・交換一覧の備考列を通常本文色かつ折り返し可能にする。
- 返品・交換詳細で備考をレシート画像の補足から分離し、独立 `備考` 領域で表示する。
- RTL tests を追加し、備考表示が text / label / value で検証されるようにする。
- Source docs と live dashboard を同期する。

## Non-scope

- `note` の DB schema、文字数上限、保存形式の変更。
- `ReturnCreateRequest` / `ReturnRecordSummary` / `ReturnRecordDetail` の wire shape 変更。
- 返品・交換の編集、取消、画像再表示、保存済み画像削除。
- 他画面の備考表示を横断的に変更すること。

## Acceptance Criteria

- `src/features/return-exchange/ReturnExchangePage.test.tsx` に、備考入力が複数行欄で保存 request / result / recent list に届くことを検証するテストがある。
- `src/features/inventory-records/OtherRecordDetailPages.test.tsx` に、返品・交換詳細の `備考` 領域と `備考なし` fallback を検証するテストがある。
- `docs/function-design/63-ui-return-exchange.md` に UI-03-D19 があり、入力、保存結果、recent、detail の備考 visibility 契約を説明している。
- `docs/SCREEN_DESIGN.md` と `docs/function-design/65-inventory-record-traceability.md` が UI-03-D19 と矛盾しない。
- `npm test -- ReturnExchangePage OtherRecordDetailPages` が成功する。
- `npm run typecheck`、`npm run lint`、`npm run format:check`、`bash scripts/doc-consistency-check.sh --target plan`、`bash scripts/doc-consistency-check.sh` が成功する。

## Design Sources

- Requirements / spec: `docs/spec/README.md`, `docs/spec/requirements.md` REQ-202 / REQ-206
- Architecture: `docs/ARCHITECTURE.md`
- Function / command / DTO: `docs/function-design/63-ui-return-exchange.md`, `docs/function-design/65-inventory-record-traceability.md`, `docs/function-design/44-cmd-inventory.md`
- DB: `docs/DB_DESIGN.md` existing `return_records.note`
- Screen / UI: `docs/SCREEN_DESIGN.md`, `docs/UI_TECH_STACK.md`, `docs/design-system/01-decision-rules.md` DSR-09 / DSR-12 / DSR-13, `docs/design-system/02-component-catalog.md`
- Decision log / ADR: none

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | `docs/function-design/44-cmd-inventory.md`, `docs/function-design/63-ui-return-exchange.md` | Existing sufficient. No backend behavior change. |
| Command / DTO / generated binding / wire shape | `ReturnCreateRequest.note`, `ReturnRecordSummary.note`, `ReturnRecordDetail.note` | Existing sufficient. Wire shape unchanged. |
| DB / transaction / audit / rollback / migration | `return_records.note` | Existing sufficient. Schema unchanged. |
| Screen / UI / route state / Japanese wording | `docs/function-design/63-ui-return-exchange.md`, `docs/SCREEN_DESIGN.md`, `docs/function-design/65-inventory-record-traceability.md` | Updated in this PR. |
| CSV / TSV / report / import / export format | none | Not touched. |
| Durable decision / ADR | none | Not required; this is UI-03-specific visibility behavior. |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-202 / UI-03 | `63-ui-return-exchange.md` §63.1 / §63.5 | UI-03-D19 | 備考は返品理由・交換理由・顧客対応メモとして後日読むため、薄い補足文や画像説明に混ぜない。全体 font-size の局所拡大は DSR-13 により不採用。 | `ReturnExchangePage.tsx` | `ReturnExchangePage.test.tsx` |
| REQ-202 / REQ-206 | `65-inventory-record-traceability.md` §65.5 | UI-03-D19 / TRACE-D1 | recent list は保存直後確認、detail は後日確認。両方で備考が項目として読める必要がある。 | `ReturnRecordDetailPage.tsx` | `OtherRecordDetailPages.test.tsx` |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes. UI-03-D19 and §65.5 describe the behavior.
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-03-D19 was promoted to source docs.
- Assumptions and constraints: Existing `note` field remains optional string. UI truncation must not hide the only copy of the note.
- Deferred design gaps, risk, and follow-up target: Cross-screen note display standardization is out of scope unless review finds direct inconsistency.
- Test Design Matrix can cite design decision IDs or source doc sections: yes, `docs/archive/plans/test-matrices/2026-06-30-ui03-note-visibility.md`.

## Design Readiness

State whether the design is ready for implementation.

- Existing design docs are sufficient because: backend, DB, and wire contracts already include `note` and do not need schema or DTO changes.
- Source docs updated in this PR: `docs/function-design/63-ui-return-exchange.md`, `docs/SCREEN_DESIGN.md`, `docs/function-design/65-inventory-record-traceability.md`.
- Design gaps intentionally deferred: image asset display, edit/cancel, and cross-screen note componentization.
- Durable decisions discovered in this plan and promoted to source docs: UI-03-D19.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI only. CMD/BIZ/IO remain unchanged.
- Backend function design: no change.
- Command / DTO / data contract: no change to `note` fields.
- Persistence / transaction / audit impact: no change.
- Operator workflow / Japanese UI wording: `備考`, `備考なし`, and visible note text added.
- Error, empty, retry, and recovery behavior: submit retry and idempotency unchanged; empty note has display fallback.
- Testability and traceability IDs: tests cite REQ-202 / UI-03-D19 and REQ-206.

## Test Plan

Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-30-ui03-note-visibility.md`

- targeted tests: RTL page tests for note input, result, recent list, detail.
- negative tests: detail `note=null` fallback.
- compatibility checks: command payload still uses existing `note` string/null.
- data safety checks: synthetic note text only.
- main wiring/integration checks: `createReturn` payload and mocked detail DTO rendering.

## Boundary / Wire Contract

- producer: existing `ReturnExchangePage` form state and existing backend DTOs.
- consumer: `commands.createReturn`, `commands.listReturns`, `commands.getReturnRecord`.
- wire type: unchanged `note: string | null`.
- internal type: unchanged `ReturnExchangeFormValues.note: string`.
- precision/range: existing UI max length 200 remains.
- round-trip path: form note -> `createReturn(req.note)` -> recent/detail DTO `note`.
- invalid input: no new invalid input. Empty/whitespace continues to map to `null`.
- compatibility: existing records with `note=null` display `備考なし`.

## Review Focus

- 備考が muted 補足文に戻っていないか。
- 保存結果、recent list、detail の全てで入力なし fallback があるか。
- 変更が UI 表示に閉じ、DTO/DB/backend scope を広げていないか。
- テストが色 class だけでなく label/text/value を検証しているか。

## Spec Contract

Contract ID: UI-03-NOTE-VIS-2026-06-30

- REQ-202 / UI-03-D19: 備考は入力時、保存結果、recent list、返品・交換詳細で独立項目として読める。本文は通常本文色以上の濃さで、入力なしの場合は `備考なし` を表示する。
- REQ-206 / TRACE-D1: 直近一覧と詳細画面は保存直後・後日確認の両方で備考を確認できる。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-202 / UI-03-D19 | UI-03 作成画面 result / recent 表示 | `ReturnExchangePage.test.tsx` note visibility tests | 備考が独立ラベル付きで読める | RTL output |
| REQ-202 / UI-03-D19 / REQ-206 | 返品・交換詳細表示 | `OtherRecordDetailPages.test.tsx` detail note tests | detail で備考が画像補足に埋もれない | RTL output |
| UI-03-NOTE-VIS-2026-06-30 | Docs consistency | doc consistency checks | source docs と plan の整合 | command output |

## Data Safety

- Real POS CSV、PLU export、店舗データ、DB、backup、log、receipt image、secret は読まない・commit しない。
- Local-only paths: `.local/`, app data, real receipt images.
- Synthetic-only paths: frontend tests use synthetic note text and mocked DTOs only.

## Implementation Results

- Source docs:
  - `docs/function-design/63-ui-return-exchange.md` に UI-03-D19 を追加。
  - `docs/SCREEN_DESIGN.md` と `docs/function-design/65-inventory-record-traceability.md` に備考 visibility 方針を反映。
  - `docs/function-design/90-traceability.md` を `generate_traceability` で再生成。
- UI:
  - `ReturnExchangePage` の備考入力を複数行 `textarea` に変更。
  - 保存結果に `aria-label="保存結果"` の region を追加し、備考と `備考なし` fallback を表示。
  - 直近一覧に `aria-label="直近の返品・交換"` の region を追加し、備考列を折り返し可能に変更。
  - `ReturnRecordDetailPage` でレシート画像と備考を分離し、`aria-label="備考"` の region で表示。
- Tests:
  - `ReturnExchangePage.test.tsx` に UI-03-D19 の note input / result / recent list tests を追加。
  - `OtherRecordDetailPages.test.tsx` に返品・交換 detail の note region / fallback tests を追加。
- Validation:
  - Red confirmed: `npm test -- ReturnExchangePage OtherRecordDetailPages` failed before implementation for missing `TEXTAREA` / note regions.
  - `npm test -- ReturnExchangePage OtherRecordDetailPages`: 18 tests passed.
  - `npm run format:check`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm test`: 82 files / 488 tests passed. Existing Vitest `--localstorage-file` warning appeared.
  - `npm run build`: passed.
  - `cargo run --bin generate_traceability -- --check`: passed after regeneration.
  - `bash scripts/doc-consistency-check.sh --target plan`: passed.
  - `bash scripts/doc-consistency-check.sh`: passed.

## Review Response

Review-only sub-agent `Tesla` completed after explicit user approval for a fresh review-only sub-agent.

- P1/P2 findings: none.
- P3 accepted/fixed: result panel fallback `備考なし` was not directly asserted for empty note. Added an assertion to the register-processed successful submit test so `aria-label="保存結果"` contains `備考なし`.
- Residual risk: Windows native L3 screenshot evidence was not added; owner OK accepted the residual risk before merge.
