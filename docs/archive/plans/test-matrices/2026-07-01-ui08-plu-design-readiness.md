# Test Design Matrix: UI-08 PLU Design Readiness

Risk: R3

Scope: REQ-402 UI-08 PLU TSV design readiness. This matrix seeds the later implementation PR; this PR is docs/design only.

| ID | Contract / decision | Failure mode | Test / evidence type | Target PR |
|---|---|---|---|---|
| T01 | REQ-402 / `25-io-plu-formatter.md` §12.3 | CV17 TSV bytes drift: wrong encoding, delimiter, CRLF, header, tax text, or product-name byte handling | Rust IO golden-byte tests with synthetic products | UI-08 implementation |
| T02 | UI-08-D1 / D-027 / BIZ-04 prepare | `prepare_plu_export` clears `plu_dirty` or sets `plu_exported_at` before operator confirmation | BIZ unit test: prepare returns bytes and target_product_codes, products remain dirty/exported_at unchanged | UI-08 implementation |
| T03 | D-027 / BIZ-04 confirm | `confirm_plu_export_saved` updates current dirty list instead of prepare exact set, or partially updates after missing product | BIZ transaction tests: exact set update, duplicate/empty/missing product rollback | UI-08 implementation |
| T04 | UI-08-D4 / recovery | Save cancel/failure removes the Diff retry path | RTL test with mocked save dialog cancel/failure: no confirm call, dirty query not invalidated, retry text visible | UI-08 implementation |
| T05 | UI-08-D2 / D-011 | UI implies register reflection or PC-tool acceptance is confirmed by app | RTL text assertions: "アプリで確認できるのはTSV保存まで", "レジ反映は未確認" or equivalent visible | UI-08 implementation |
| T06 | UI-08-D5 / Full safety | Full export lacks backup/large-scope warning | RTL test: Full mode shows backup Alert and does not rely on color-only warning | UI-08 implementation |
| T07 | CMD-08 wire contract | Generated bindings drift or frontend calls stale `exportPlu` command | `cargo run --bin generate_bindings`; clean/intentional `src/lib/bindings.ts` diff; frontend typecheck | UI-08 implementation |
| T08 | Query invalidation | prepare invalidates PLU dirty/home state, or confirm fails to invalidate changed state | RTL mutation tests: prepare no invalidation; confirm invalidates `pluDirty`, product list, home PLU notification equivalent | UI-08 implementation |
| T09 | 5000 PLU limit | Over-limit warning hidden or treated as register success/failure incorrectly | BIZ test with 5001 synthetic products + RTL warning label | UI-08 implementation |
| T10 | CV17 1.1.1 compatibility | CV17 1.1.1 rejects the generated 10-column TSV and source docs still claim compatibility | Manual PC-tool import check; if rejected, source docs updated with adapter profile before Ready | UI-08 implementation / manual gate |
| T11 | Data safety | Real PLU TSV, real POS CSV, register backup, JAN/name/price evidence committed | `git status --short`; changed-file review; anonymized evidence only | Every PLU PR |
| T12 | Navigation / L3 | UI route inaccessible or operator cannot distinguish saved vs confirmed state | Windows native L3 checklist: route, save dialog, cancel, saved, confirm, wording | UI-08 implementation |

## Manual Checks Required Later

- CV17 1.1.1 import of generated TSV using synthetic or sanitized test products.
- SD-card / register workflow confirmation after existing PLU backup procedure is understood.
- Windows native L3 for save dialog and Japanese wording.

## Data Safety

- No real PLU export files, real POS CSV, real register backups, real app DB, logs, receipt images, secrets, or `.env*`.
- Evidence may include counts, column names, anonymous error text, hashes, and procedure notes only.
