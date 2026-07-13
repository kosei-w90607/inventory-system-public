# UI-08 PLU書出し Implementation Test Design Matrix

## Risk

Risk: R3

## Contracts Under Test

- REQ-402 / D-027: PLUファイル生成と app-side exported confirmation are separate lifecycle steps.
- BIZ-PLU: `prepare_plu_export` returns PLU file payload and target codes without mutating PLU state.
- BIZ-PLU: `confirm_plu_export_saved` mutates only the exact saved target set.
- CMD-PLU: generated commands expose prepare/confirm/list without stale `exportPlu`.
- UI-08: native save cancel/failure does not clear dirty state; save success still requires explicit confirmation.
- UI-08-D7: saved-but-unconfirmed export recovery state survives navigation/app restart without persisting PLU file contents.
- UI-08: operator wording does not claim PC tool/register reflection.
- IO-04 / CV17 1.1.1: generated file uses `.txt`, 11-column scanning PLU header, CP932, CRLF, and `入力桁制限=無し`. Memory No. starts at normal PLU used count + 1; current observed profile uses 216 normal PLU slots, so data starts at 217.
- BIZ-04 / CV17 1.1.1: prepare rejects rows without valid 13-digit JAN/EAN-13 code and must not fallback to product_code.
- BIZ-04 / CV17 1.1.1: prepare rejects exports beyond available scanning PLU memory. SR-S4000 total PLU memory is 5000 shared by normal PLU and scanning PLU; current observed profile leaves 4,784 scanning rows.
- Dev seed / UI-08 L3: reset/reseeded demo products have valid 13-digit EAN codes so the native manual gate is not blocked by obsolete JAN8 data.

## Failure Modes

- prepare clears `plu_dirty` or sets `plu_exported_at`.
- confirm accepts empty, duplicate, or missing product codes.
- confirm partially updates before returning an error.
- diff mode includes clean products or full mode includes discontinued products incorrectly.
- 4,784件超過が拒否されず、memory No. 5001以降の行が出力される。
- generated bindings retain old `exportPlu(mode)` and UI calls it.
- save cancel/failure calls confirm.
- saved pending export target is lost after navigation/app restart.
- recovery storage persists PLU file bytes, product names, JAN, or prices instead of minimal metadata.
- invalid recovery storage blocks the page instead of clearing itself.
- confirm invalidates too early or misses `pluDirty` / product list / home notification freshness.
- UI text implies file save equals レジ反映.
- formatter keeps old 10-column / `.tsv` / memory 1 output that CV17 1.1.1 rejected.
- jan_code missing or invalid is exported with product_code fallback and later rejected by CV17.
- demo seed keeps generating obsolete JAN8 values, causing Diff PLU export to fail before the CV17 manual gate.
- exports above memory No. 5000 are generated.
- real POS/store data or generated PLU file is committed.

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| BIZ-PLU prepare | prepare mutates DB | Rust unit | `REQ-402 prepare_plu_export does not update dirty or exported_at` | dirty/exported_at changes during prepare |
| BIZ-PLU confirm | wrong exact set | Rust unit | `REQ-402 confirm_plu_export_saved updates only requested products` | unrelated dirty product is cleared or requested product remains dirty |
| BIZ-PLU confirm | invalid set accepted | Rust unit | `REQ-402 confirm_plu_export_saved rejects empty duplicate and missing products` | invalid product set succeeds |
| BIZ-PLU confirm | partial update | Rust unit | `REQ-402 confirm_plu_export_saved rolls back on missing product` | any requested product changes after failed confirm |
| BIZ-PLU limit | scanning PLU over-limit accepted | Rust unit | `REQ-402 prepare rejects targets beyond scanning PLU memory range` | 4,785 rows can be prepared or memory No. 5001 would be emitted |
| IO-04 CV17 profile | old rejected file shape | Rust unit | `REQ-402 generates CV17 1.1.1 scanning PLU txt with 11 columns and memory 217` | header is 10 columns, filename is `.tsv`, memory starts at 1, or `入力桁制限` is missing |
| constants / adapter profile | normal PLU and scanning PLU treated as separate pools | Rust unit | `REQ-402 shared total PLU memory derives scanning start and capacity from normal PLU count` | normal PLU count 250 does not produce scanning start 251 and capacity 4,750 |
| IO-04 CV17 profile | invalid code fallback | Rust unit | `REQ-402 rejects missing invalid or non-13-digit scanning codes` | formatter uses product_code fallback or accepts invalid JAN |
| BIZ-PLU validation | invalid rows reach formatter/UI save | Rust unit | `REQ-402 prepare rejects products without valid 13 digit JAN` | prepare succeeds for JANなし / invalid check digit / non-13-digit products |
| Dev seed / UI-08 L3 | obsolete JAN8 seed blocks native gate | Rust integration | `seed_products_have_valid_ean13_jan_for_plu_export` | seed products have missing, non-13-digit, or check-digit-invalid JAN |
| BIZ-PLU limit | invalid memory range exported | Rust unit | `REQ-402 prepare rejects targets beyond scanning PLU memory range` | prepare succeeds for 4,785 rows and would emit memory No. 5001 |
| CMD-PLU wire | stale command | generated/schema | `cargo run --bin generate_bindings` + diff review | `exportPlu` remains or prepare/confirm are absent |
| UI-08 save cancel | cancel clears dirty | RTL | `REQ-402 does not confirm when save dialog is cancelled` | `confirmPluExportSaved` is called on cancel |
| UI-08 save failure | failure clears dirty | RTL | `REQ-402 preserves target products when file save fails` | failure path confirms or loses target set |
| UI-08 success | missing explicit confirm | RTL | `REQ-402 confirms only after operator marks saved PLU file exported` | confirm runs before the confirmation button |
| UI-08-D7 recovery | saved target lost | RTL | `REQ-402 keeps a saved pending export recovery state without PLU file bytes` | save success does not persist recovery metadata or persists PLU file bytes |
| UI-08-D7 recovery | cannot resume after restart | RTL | `REQ-402 restores saved pending export after returning to the page` | restored state does not show top Alert or confirm with exact product codes |
| UI-08-D7 recovery | cannot discard stale saved state | RTL | `REQ-402 lets the operator discard a restored pending export and re-export` | operator cannot clear stale recovery state without confirming |
| UI-08-D7 recovery | invalid state blocks page | RTL | `REQ-402 clears an invalid saved pending export recovery state` | malformed JSON remains or crashes the page |
| UI-08-D7 recovery safety | disallowed fields accepted | RTL | `REQ-402 rejects saved pending export recovery state with non-allowed fields` | recovery JSON with PLU file bytes or product detail fields is accepted |
| UI-08 cache | wrong invalidation | RTL | `REQ-402 invalidates PLU and product queries after confirmation` | required queries are not invalidated or unrelated sales queries are invalidated |
| UI-08 wording | reflection overstated | RTL / review | `REQ-402 shows manual PC tool and register confirmation note` | text claims register reflection is automatic |
| UI-08 full mode | backup warning missing | RTL | `REQ-402 shows full export backup warning` | full mode lacks backup warning |
| UI-08 validation | no operator recovery text | RTL | `REQ-402 shows JAN correction guidance when prepare rejects invalid scanning codes` | prepare error lacks product-master/JAN recovery wording |
| integration | route/navigation stale | typecheck / route test | `npm run typecheck` / route generation | `/products/plu-export` is unreachable |
| manual | CV17 / register compatibility unknown | manual L3 / follow-up | `CV17 1.1.1 import acceptance and register read-in` | For PR #122, structural equivalence to the approved-readable field file is accepted. In the Post-UI-08 follow-up, latest app-generated `.txt` CV17 rejection, SD-card write failure, or SR-S4000 non-reflection would reopen adapter/profile investigation. |

## Negative Paths

- no dirty products in diff mode.
- no active products in full mode.
- save dialog cancelled.
- filesystem write failure.
- command failure on prepare or confirm.
- duplicate product codes on confirm.
- missing product code on confirm.
- over current observed scanning PLU capacity (4,784 export targets).
- missing JAN / non-13-digit JAN / invalid JAN check digit.
- saved pending recovery state after page navigation/app restart.
- malformed recovery JSON / schema mismatch in `localStorage`.
- recovery JSON containing disallowed fields such as `bytes_base64`, product names, JAN, or prices.
- explicit discard before re-export.

## Boundary Checks

- empty/non-empty: zero targets returns validation/empty state; non-zero targets produce PLU file bytes.
- mode enum: `full` and `diff` only.
- target identity: product_code set is preserved from prepare to confirm.
- recovery identity: restored confirm uses stored exact product_code set, not current dirty list.
- recovery storage: localStorage contains no `bytes_base64`, PLU file contents, JAN, product names, or prices.
- recovery schema: restored JSON must contain only the allowed contract keys, integer count, no duplicate target codes, and `count === targetProductCodes.length`.
- encoding: CP932 bytes are base64 transported to UI without text re-encoding.
- line ending: PLU file generation remains CRLF from IO formatter tests.
- CV17 profile: generated file extension is `.txt`; current observed profile data line starts with memory No. 217 because normal PLU uses 216 slots; every row stays within total PLU memory No. 5000.
- scanning code: generated rows use only valid 13-digit JAN/EAN-13 codes and never product_code fallback.
- timestamp: `plu_exported_at` is confirmation time, not prepare time.

## Compatibility Checks

- Existing IO formatter behavior intentionally changes from legacy CV17 2.0.1-style 10-column `.tsv` to CV17 1.1.1 11-column `.txt`.
- Existing `list_plu_dirty` consumer continues through generated binding.
- No DB migration is required.
- PLU export history table remains non-scope; recovery is local in-progress state only.
- CV17 1.1.1 import acceptance, SD-card write, SR-S4000 read-in, and representative register spot-check were confirmed for the approved-readable field file. PR #122 accepts structural equivalence to that 11-column profile; latest app-generated `.txt` real-device recheck remains Post-UI-08 follow-up.

## Data Safety Checks

- Tests use synthetic products only.
- No real PLU file, POS CSV, store DB, register backup, logs, screenshots with store data, `.env*`, keys, or certificates enter git diff.
- Manual save outputs are outside repo or ignored.
- Browser recovery state stores only minimal metadata and target product codes; it does not persist PLU file bytes or product detail fields.

## Main Wiring / Integration Checks

- `src-tauri/src/lib.rs` collects and registers prepare/confirm/list commands.
- `src/lib/bindings.ts` is regenerated.
- `/products/plu-export` route exists and navigation/home notification link points to it.
- `PluExportPage` uses generated `commands.*` only.
- `PluExportPage` restores and clears `inventory:plu-export:pending:v1` for saved-but-unconfirmed exports.
- `queryKeys.pluDirty()` and product list cache are invalidated only after confirm.

## Residual Test Gaps

- CV17 1.1.1 import acceptance cannot be automated in repo.
- Windows native save dialog and operator readability require manual L3.
- PC tool import, SD-card export, SR-S4000 read-in, and register spot-check remain outside app automation by design. PR #122 uses structural-equivalence evidence for this manual area; latest app output is a follow-up recheck.
- Actual sale and post-PLU Z004 evaluation are a later track unless explicitly promoted to this PR's manual gate.

## Execution Results

- `cargo test plu_export --lib` PASS（16 tests）
- `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（5 tests）
- `npm test` PASS（83 files / 493 tests）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm run build` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（582 lib tests + integration/doc tests）
- `cd src-tauri && cargo run --bin generate_bindings` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS
- `bash scripts/check-env-safety.sh` PASS
- Post-review: `cargo test plu_export --lib` PASS（16 tests）
- Post-review: `npm run format:check` PASS
- Post-review: `bash scripts/doc-consistency-check.sh --target plan` PASS
- Post-review: `bash scripts/check-env-safety.sh` PASS
- Post-review: `cd src-tauri && cargo fmt --check` PASS
- Post-review: `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- Post-review: `cd src-tauri && cargo test` PASS（582 lib tests + integration/doc tests）
- Post-review: `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- Post-review: `bash scripts/doc-consistency-check.sh` PASS
- L3 feedback fix: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（5 tests）
- L3 feedback fix: `npm run format:check` PASS
- L3 feedback fix: `bash scripts/doc-consistency-check.sh --target plan` PASS
- L3 feedback fix: `npm run typecheck` PASS
- L3 feedback fix: `npm run lint` PASS
- L3 feedback fix: `npm run build` PASS
- L3 feedback fix: `bash scripts/doc-consistency-check.sh` PASS
- L3 feedback fix: `npm test` PASS（83 files / 493 tests）
- Turing review response: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx src/lib/page-scroll.test.ts` PASS（2 files / 8 tests）
- Turing review response: `npm run typecheck` PASS
- Turing review response: `npm run lint` PASS
- Turing review response: `npm run format:check` PASS
- Turing review response: `bash scripts/doc-consistency-check.sh --target plan` PASS
- Turing review response: `npm run build` PASS
- Turing review response: `npm test` PASS（83 files / 494 tests）
- Turing review response: `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- Turing review response: `bash scripts/doc-consistency-check.sh` PASS
- Turing review response: `git diff --check` PASS
- Recovery-route RED: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` failed on missing pending storage / restored Alert / discard / invalid-state clearing.
- Recovery-route GREEN: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（10 tests）
- Boyle review response RED: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` failed because recovery JSON with `bytes_base64` / product detail fields was accepted.
- Boyle review response GREEN: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（11 tests）
- Field-gate Ampere review response: stale operator-facing `TSV` wording was replaced with `PLUファイル`, and the 4,784件上限 RTL was changed to the actual prepare validation failure path.
- Field-gate Ampere response verification: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（12 tests）, `npm run typecheck` PASS, `npm run lint` PASS, `npm run format:check` PASS.
- Shared PLU memory correction RED: `cargo test constants::tests::test_scanning_plu_memory_profile_req402_uses_shared_total_memory --lib` failed because shared-memory helper functions did not exist.
- Shared PLU memory correction GREEN: `cargo test constants::tests::test_scanning_plu_memory_profile_req402_uses_shared_total_memory --lib` PASS.

Manual / L3:

- Windows native UI layout/status-placement feedback fix was owner-confirmed.
- Recovery-route Windows native L3 was owner-confirmed on 2026-07-01: after app restart, the restored top Alert `保存済みで未確認のPLU書出しがあります` was visible.
- 2026-07-02 field-gate response: `cargo test plu_formatter --lib` PASS（17 tests）、`cargo test plu_export --lib` PASS（17 tests）、`npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（12 tests）。Full gates also passed: `cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`（583 lib tests + integration/doc tests）、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`（83 files / 500 tests）、`npm run build`、`cargo run --bin generate_bindings`、`cargo run --bin generate_traceability -- --check`、`bash scripts/doc-consistency-check.sh --target plan`、`bash scripts/doc-consistency-check.sh`.
- 2026-07-03 field gate confirmed the practical external flow: `CV17 TXT import -> PC tool SD settings write -> SR-S4000 設定読み -> barcode/register behavior confirmation`.
- PR #122 external gate decision on 2026-07-03:
  - Owner accepted structural equivalence to the approved-readable CV17 field file that already passed CV17 import, PC tool SD write, SR-S4000 `設定読み`, and representative barcode/register behavior.
  - Structural evidence recorded without store data: 11 header fields, 4,784 data rows, no non-11-field rows; app formatter emits the same 11-column CV17 1.1.1 profile and enforces 13-digit JAN/EAN-13.
  - Latest app-generated `.txt` real-device confirmation is deferred to Post-UI-08 follow-up, not required before PR #122 Ready/merge.
