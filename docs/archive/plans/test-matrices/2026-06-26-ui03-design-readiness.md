# Test Design Matrix: UI-03 返品・交換 Design Readiness

## Risk

Risk: R3

## Contracts Under Test

- UI-03-D1: `/inventory/return` route と navigation を有効化する。
- UI-03-D2: UI-03 は generated `commands.*` だけを使う。
- UI-03-D3: レシート画像は `saveReceiptImage` で保存し、返却された相対パスを `createReturn.receipt_image_path` に渡す。
- UI-03-D4: 画像入力は file input/drop から bytes を取得し、plugin-dialog path-only input は初回非 scope。
- UI-03-D5: 画像保存成功後の create failure retry では同じ `savedReceiptPath` を再利用し、画像を再保存しない。
- UI-03-D6: 返品では `direction="in"` のみ許可する。
- UI-03-D7: 交換では `direction="in"` と `direction="out"` の両方を要求する。
- UI-03-D8: `register_processed` true/false の在庫反映意味を日本語 text + Badge で表示する。
- UI-03-D9: 商品追加は searchProducts の 0/1/複数件を分けて扱う。
- UI-03-D10: scanner 相当入力は focused field + Enter + focus return で扱う。
- UI-03-D11: 同一 `product_code + direction` は数量加算し、同一商品でも戻り/渡しは別行にする。
- UI-03-D12: 数量/日付/種別/方向/image validation を command 呼び出し前に行う。
- UI-03-D13: 同内容 retry 時に idempotency_key を再利用し、成功/リセット/編集/画像/備考変更後は新 key にする。
- UI-03-D14: 画像保存中 / submit 中は中断可能に見せない。
- UI-03-D15: result で record_id / item count / register status / image attached / warnings / idempotent replay が読める。
- UI-03-D16: recent return list の空/成功/失敗状態を表示する。
- UI-03-D17: 保存成功時に returns query を invalidate し、stock query は `register_processed=false` の時だけ invalidate する。
- UI-03-D18: Windows native L3 で register status、image input、continuous input、focus return を確認する。

## Failure Modes

- route が別 path に置かれ、2026-04-21 の `/inventory/return` 合意とずれる。
- UI が generated binding にない return/image command を ad hoc invoke で呼ぶ。
- `create_return` / `list_returns` は runtime 登録済みだが `bindings.ts` に出ず、型なし呼び出しへ戻る。
- `saveReceiptImage` が generated binding に出ず、画像保存だけ手書き invoke になる。
- plugin-dialog の path だけを受け取って file bytes を読めず、画像保存が実行できない。
- 画像保存成功後に create が失敗し、retry のたびに同じ画像を別ファイルとして保存して orphan を増やす。
- `return_type="return"` なのに渡し行を保存でき、返品記録の業務意味が崩れる。
- `return_type="exchange"` で戻りだけ / 渡しだけを保存でき、交換記録が返品または出庫に見える。
- `register_processed=true` なのに UI が「在庫反映済み」と誤表示し、二重計上を誘発する。
- `register_processed=false` なのに在庫反映の警告が弱く、operator がレジ戻し済み返品を未処理として保存する。
- 複数候補を自動で先頭選択して誤商品が入る。
- 同じ商品を戻り/渡しで追加した時に1行へ統合され、在庫増減の意味が消える。
- 数量 0 / 負数 / decimal や不正画像形式が command まで届く。
- internal error 後の再試行で idempotency_key が変わり、二重返品になる。
- 保存失敗後に画像/備考だけを変えても idempotency_key が変わらず、BIZ fingerprint 除外項目の変更が反映されたように見える。
- 保存中に戻る/リセット/画像変更が押せるように見え、処理中断と誤認する。
- `register_processed=false` の保存後に在庫照会や商品一覧が stale のままになる。
- `register_processed=true` の保存後に不要な在庫 invalidation が走り、CSV取込み前に反映済みと誤認する UI 更新につながる。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-03-D1 | route/nav drift | route/component | `ReturnExchangePage.test.tsx: route and navigation active` | `/inventory/return` route or nav active is missing |
| UI-03-D2 | generated command gap | Rust/generated/review | `grep-bindings-ui03-commands` | `createReturn` or `listReturns` missing |
| UI-03-D3 | image command gap | Rust/generated/review | `grep-bindings-ui03-image-command` | `saveReceiptImage` / image request/result types missing |
| UI-03-D4 | path-only image input | unit/component | `receipt-image.test.ts: builds base64 from File` | implementation only stores a path and cannot call `saveReceiptImage` |
| UI-03-D5 | repeated image save after create failure | component | `ReturnExchangePage.test.tsx: retry after create failure reuses saved receipt path` | retry calls `saveReceiptImage` again for unchanged image |
| UI-03-D6 | return accepts out row | Rust BIZ + unit/component | `returns.rs: create_return_rejects_return_with_out_direction`; `return-exchange-request.test.ts: return blocks out direction` | `return_type=return` with `direction=out` is accepted by BIZ or sent by UI |
| UI-03-D7 | exchange missing side | Rust BIZ + unit/component | `returns.rs: create_return_rejects_exchange_missing_in_or_out`; `return-exchange-request.test.ts: exchange requires in and out rows` | exchange with only in or only out is accepted by BIZ or sent by UI |
| UI-03-D8 | register status color-only/misleading | component/L3 | `ReturnExchangePage.test.tsx: register processed explanation text changes` | true/false states lack explicit Japanese inventory meaning |
| UI-03-D9 | product 1-hit add drift | component | `ReturnExchangePage.test.tsx: enter adds single matching product` | 1 result does not add a row |
| UI-03-D9 | product candidates unsafe | component | `ReturnExchangePage.test.tsx: multiple results require selection` | first candidate is auto-selected |
| UI-03-D9 | product not found recovery | component | `ReturnExchangePage.test.tsx: not found shows product registration link` | 0 results dead-end the flow |
| UI-03-D10 | focus return drift | component/L3 | `ReturnExchangePage.test.tsx: focus returns after add` | focused field is lost after add |
| UI-03-D11 | direction merge bug | unit | `return-exchange-row-utils.test.ts: duplicate product increments by direction` | in/out rows for same product are merged or same direction duplicates create another row |
| UI-03-D12 | validation gap | unit/component | `return-exchange-request.test.ts` | invalid date/type/direction/quantity/image passes |
| UI-03-D13 | retry double-write or stale supplemental data | unit/component | `return-exchange-request.test.ts: idempotency key lifecycle` | same-content retry generates new key, or edit/image/note retry keeps old key |
| UI-03-D14 | pending cancel illusion | component | `ReturnExchangePage.test.tsx: pending image/save disables editing and navigation actions` | editing/reset/back/image controls remain enabled |
| UI-03-D15 | result unclear | component | `ReturnExchangePage.test.tsx: result shows saved evidence` | record_id/count/register status/image/warnings/replay are hidden |
| UI-03-D16 | recent list states | component | `ReturnExchangePage.test.tsx: recent returns states` | empty/error/success states are indistinguishable |
| UI-03-D17 | cache stale / over-invalidated | component | `ReturnExchangePage.test.tsx: successful submit invalidates return and conditional stock keys` | required query invalidations are missing or stock invalidates when register_processed=true |
| UI-03-D18 | native input/status drift | manual L3 | `Windows native UI-03 L3` | register status, image input, Enter add, focus return, save result fail in native app |

## Negative Paths

- missing input: blank return date, no item rows, no image is allowed but no rows is blocked.
- invalid input: bad return type, bad direction, return with out row, exchange missing in/out side, quantity blank / 0 / negative / decimal, unsupported image extension.
- duplicate/ambiguous input: same product same direction increments quantity; same product opposite direction remains separate; multiple product search results require explicit selection.
- unknown reference: product search returns empty and shows product registration link; createReturn not_found preserves form.
- dependency missing: `saveReceiptImage` error stops before `createReturn`; product search command failure preserves rows.
- permission/write failure: image save internal error keeps selected image and idempotency key for retry.
- dry-run side effect: none.

## Boundary Checks

- threshold: `listReturns(1, 10, null, null)` stays under per_page upper 100.
- null/default: `receipt_image_path=null` when no image, `note=null` when blank, `register_processed=true` default.
- empty/non-empty: no rows disabled; return needs in rows; exchange needs both in/out.
- min/max: quantity integer `>= 1`; generated image extension field is `string` but frontend helper validates allowlist `jpg|jpeg|png|gif|webp`; base64 string non-empty after file read.
- status/policy enum: `return_type` only `"return" | "exchange"`; `direction` only `"in" | "out"`.
- wire type: `ReturnCreateRequest`, `ReturnItemInput`, `ReturnCreateResult`, `ReturnRecordSummary`, `SaveImageRequest`, `SaveImageResponse`.
- internal type: UI rows keyed by `productCode + direction`; image state stores file signature and saved relative path.
- producer/consumer: file input/drop -> base64 builder -> `saveReceiptImage` -> `createReturn`.
- round-trip token: idempotency key survives same-content retry; saved receipt path survives create failure retry.
- precision/range: integer quantity remains JavaScript safe integer and Rust i64-compatible for expected store quantities.
- cross-language parse: generated binding compiles after `cargo run --bin generate_bindings`.

## Compatibility Checks

- Existing `commands.searchProducts` generated name remains stable.
- Existing valid return BIZ/CMD Rust tests continue to pass; new BIZ negatives cover `return` with `out` and one-sided `exchange`.
- Existing image_manager / settings_cmd tests continue to pass.
- Existing product list / stock inquiry query keys remain valid.
- No DB schema/migration change.
- No new Tauri capability is required for file input/drop initial implementation.

## Data Safety Checks

- source-derived data: no real receipt images, real POS CSV, store sales/cost data.
- generated outputs: `src/lib/bindings.ts` diff only when implementation adds generated commands/types.
- secrets: no `.env*`, tokens, keys, certificates, auth files.
- local-only files: no local DB, backups, logs, app data, saved receipt files committed.
- synthetic sample boundaries: tests use tiny synthetic image bytes and mocked File objects only.

## Main Wiring / Integration Checks

- `collect_commands!` includes `return_cmd::create_return`, `return_cmd::list_returns`, and `settings_cmd::save_receipt_image` for generated bindings.
- `tauri::generate_handler!` already includes runtime commands and remains aligned.
- `cargo run --bin generate_bindings` updates only intended command/type additions.
- `/inventory/return` appears in generated route tree/build.
- Navigation `返品・交換` points to `/inventory/return`.
- `queryKeys.returns.root()` and `queryKeys.returns.recent()` are added and used by mutation/list query.

## Mutation-style Adequacy Questions

- If `register_processed` stock invalidation condition is inverted, which test fails? `successful submit invalidates return and conditional stock keys`.
- If return/exchange validation is removed, which test fails? Rust BIZ negatives `create_return_rejects_return_with_out_direction` / `create_return_rejects_exchange_missing_in_or_out` and frontend tests `return blocks out direction` / `exchange requires in and out rows`.
- If row key changes from product+direction to product only, which test fails? `duplicate product increments by direction`.
- If image save retry always saves again, which test fails? `retry after create failure reuses saved receipt path`.
- If `receipt_image_path` is omitted from create payload after image save, which test fails? image save/create payload assertion in `ReturnExchangePage.test.tsx`.
- If generated binding omits `saveReceiptImage`, which test/check fails? `grep-bindings-ui03-image-command` and TypeScript typecheck.
- If pending state leaves image selection enabled, which test fails? `pending image/save disables editing and navigation actions`.

## Residual Test Gaps

- Global barcode detection is deferred, so no timing-threshold test is designed here.
- Saved receipt image display via `asset://` is deferred.
- Image resize/compression is deferred.
- Receipt image orphan cleanup is deferred; tests only cover retry reuse to avoid multiplying orphans.
- Return detail/edit/cancel is deferred.
- inline product creation is deferred.
- cm / m display toggle is deferred; UI-03 only covers `stock_unit='cm'` display and cm integer input.
