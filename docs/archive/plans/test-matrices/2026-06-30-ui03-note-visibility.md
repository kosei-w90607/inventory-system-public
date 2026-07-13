# UI-03 返品・交換 備考 visibility follow-up Test Design Matrix

## Risk

Risk: R3

## Contracts Under Test

- REQ-202 / UI-03-D19: 備考は入力、保存結果、recent list、返品・交換詳細で独立項目として読める。
- REQ-206 / TRACE-D1: recent list は保存直後確認、detail は後日確認として備考を確認できる。
- Existing wire contract: `note: string | null` remains unchanged.

## Failure Modes

- 備考入力が単一行のままで、返品理由・交換理由が読みにくい。
- 保存成功後に備考が表示されず、入力内容を保存直後に確認できない。
- recent list の備考が薄い補足文、空文字、または折り返し不能なセルとして表示される。
- detail 画面で備考がレシート画像の補足文に埋もれ、項目名なしで表示される。
- `note=null` の既存記録で空白になり、備考が入力なしなのか表示漏れなのか区別できない。
- UI 変更のつもりで DTO / DB / backend scope を広げてしまう。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| REQ-202 / UI-03-D19 | 備考入力が単一行のまま | regression / RTL | `REQ-202/UI-03-D19: note field is multiline and included in the create request` | `備考` が textbox ではなく input のまま、または `createReturn(req.note)` に届かない |
| REQ-202 / UI-03-D19 | 保存結果で備考を確認できない | regression / RTL | `REQ-202/UI-03-D19: successful submit shows note in the result panel` | result panel に `備考` label と入力値が出ない |
| REQ-202 / UI-03-D19 / REQ-206 | recent list の備考が確認できない | regression / RTL | `REQ-202/REQ-206/UI-03-D19: recent list shows note text and fallback` | recent list で note が空白になる、または `備考なし` fallback がない |
| REQ-202 / UI-03-D19 / REQ-206 | detail で備考が独立項目にならない | regression / RTL | `REQ-202/UI-03-D19: return detail shows note as a labeled section` | detail の `備考` heading/label と note value が同じ領域で検出できない |
| REQ-202 / UI-03-D19 / compatibility | `note=null` が空白表示になる | negative / RTL | `REQ-202/UI-03-D19: return detail shows note fallback when note is null` | `note=null` で `備考なし` が出ない |
| Existing wire contract | DTO / DB scope が広がる | review / typecheck | `npm run typecheck` / diff review | bindings や Rust DTO に不要差分が出る |

## Negative Paths

- missing input: `note=null` / 空文字は `備考なし` 表示。
- invalid input: no new invalid input; existing max length remains UI-side.
- duplicate/ambiguous input: not applicable.
- unknown reference: detail not found behavior unchanged.
- dependency missing: mocked command errors unchanged.
- permission/write failure: not applicable.
- dry-run side effect: not applicable.

## Boundary Checks

- threshold: existing `maxLength=200` remains.
- null/default: `note=null` displays `備考なし`.
- empty/non-empty: non-empty note displays as body text; empty note does not create blank cell.
- min/max: no backend range change.
- status/policy enum: not applicable.
- wire type: unchanged `string | null`.
- internal type: unchanged `string`.
- producer/consumer: `ReturnExchangePage` produces note; `ReturnRecordDetailPage` consumes note.
- round-trip token: synthetic note text such as `サイズ交換のため確認済み`.
- precision/range: not applicable.
- cross-language parse: not applicable.

## Compatibility Checks

- old schema/input: existing records with `note=null` render fallback.
- new schema/input: no schema change.
- output order: no table sort/order change.
- optional field behavior: `note` remains optional.

## Data Safety Checks

- source-derived data: tests use synthetic note strings only.
- generated outputs: `src/lib/bindings.ts` should remain unchanged.
- secrets: none.
- local-only files: no receipt images or app data.
- synthetic sample boundaries: no real store data.

## Main Wiring / Integration Checks

- helper connected to main path: `createReturn` mock receives `note` from the UI field.
- output reaches manifest/report: not applicable.
- effective config reaches runtime: not applicable.
- CLI arg reaches implementation: not applicable.

## Mutation-style Adequacy Questions

- If a key branch is inverted, which test fails? `note=null` fallback tests fail if fallback only appears for non-empty note.
- If a threshold comparison changes, which test fails? Existing max length is not behaviorally asserted in this PR.
- If a guard is removed, which test fails? If result/recent/detail omit note guards, fallback tests fail.
- If an output field is omitted, which test fails? Result, recent, or detail note visibility tests fail.
- If output order changes, which test fails? Not sensitive to row order except the mocked recent row.
- If dry-run performs a side effect, which test fails? Not applicable.
- If a JSON number crosses JavaScript safe integer range, which test fails? Not applicable.
- If a state token is round-tripped through browser/client code, which test fails? `createReturn(req.note)` assertion fails if form note is not round-tripped.

## Residual Test Gaps

- Visual contrast is asserted by structure/text, not by computed color in jsdom. Windows native L3 screenshot evidence was not added; owner OK accepted the residual risk before merge.
- No screenshot regression gate is added for this narrow UI follow-up.
