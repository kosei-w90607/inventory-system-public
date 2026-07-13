# Project Memory

## Purpose

Durable memory for the inventory management project.
Use this to survive context loss, handoffs, and long-running work.
Keep it factual and stable.

## Stable Facts

- Product: inventory management system for a single physical handicraft store
- Users:
  - developer: family member with software background
  - operator: non-IT store owner using Excel and CASIO ECR+ daily
- Method: USDM-driven requirements and design process
- Stack: `Tauri 2.x + React + TypeScript + SQLite`
- Architecture layers: `UI / CMD / BIZ / IO / MNT`
- Public requirements source: `docs/spec/requirements.md` + `docs/spec/requirements-coverage.md` + linked design docs. Owner-retained source material stays outside the repository.

## Business Boundaries

- Single-store local desktop application
- Low concurrency, mostly one operator
- File-based POS integration, not API-based
- CSV workflows are first-class product behavior
- POS integration should preserve a replaceable adapter boundary: register-specific formats/procedures stay in the adapter, while app-internal sales, report, inventory, import lifecycle, and operator concepts stay in the core model.

## POS Facts

- Register family: `CASIO SR-S4000`
- Known CSV families: `Z001`, `Z002`, `Z004`, `Z005`
- Field-check 2026-06-30: current daily report operation uses CASIO PC tool / SD-card `Z001`, `Z002`, and `Z005` as the main report inputs. `Z004` is a PLU/product track and must not be treated as the only current sales import source without a follow-up SALES redesign.
- Confirmed `Z004` characteristics for the existing parser / future PLU-by-sales evaluation:
  - encoding: `CP932`
  - line separators may include `NEL`
  - returns can appear as negative values
- Installed field PC tool observed in 2026-06 field-check is `カシオレジスターツール for SR-S500/SR-C550/SR-S4000/SR-S200`, ProductName `CV-17`, FileVersion/ProductVersion `1.1.1.0`.
- Local field-check reference materials are kept outside the repo at `/home/kosei/Downloads/inventory-field-check` (`\\wsl.localhost\Ubuntu-22.04\home\kosei\Downloads\inventory-field-check` from Windows). Use `summaries/` and `approved-readable/ECRCV17.pdf` for CV17/register-tool facts when needed, but do not commit real CSV/XLSX/PDF outputs, screenshots, register backups, JANs, product names, prices, or store-specific sales/cost data.
- CV17 1.1.1 daily report profiles observed in 2026-07 L3: files that persist in the tool internal directory after SD import are layout A, while register-tool export output is layout B; the field operation's main route is still being clarified, so REQ-401 supports both. Layout A is CP932/CRLF with 7-row preamble, 1 header row, then 4-column data rows (`record code`, `label`, `quantity/count`, `amount`). Layout B is a concatenated export shape with leading meta fields, a header, then 4-column repeated rows. `Z001` / `Z002` dates may be `YYYY/M/D`; `Z005` and some export outputs may use `YYYY-MM-DD`.
- CV17 1.1.1 scanning PLU import/apply profile observed in 2026-07 field gate: use tab-delimited CP932/CRLF `.txt`; 11 columns `メモリNo.` / `ｽｷｬﾆﾝｸﾞｺｰﾄﾞ` / `名称` / `単価` / `課税方式` / `単品売り` / `負単価` / `品番PLU` / `ゼロ単価` / `入力桁制限` / `部門リンク`; PLU total memory is 5000 shared by normal PLU and scanning PLU; scanning PLU starts at normal PLU SD/CV17 write count + 1; UI-08 does not add an operator setting for this count and currently records the observed code-side profile of normal PLU 216 slots used, so scanning range is `217..=5000`; `入力桁制限` is `無し`; scanning code must be a valid 13-digit JAN/EAN-13 code and must not fall back to `product_code`; the practical external gate is `CV17 TXT import -> PC tool SD settings write -> SR-S4000 設定読み -> barcode/register behavior confirmation`.
- PLU export is app-to-register only; reflection cannot be auto-confirmed. UI-08 design splits PLU file generation from app-side exported confirmation so `plu_dirty` remains set until the operator explicitly marks the saved PLU file as exported after CV17 import, SD-card write, SR-S4000 read, and representative register call succeed.
- 2026-07-03 field gate: the store-laptop/register-side flow succeeded for the confirmed CV17 `.txt` shape. Treat CV17 import success alone as insufficient. For PR #122, the owner accepted structural equivalence to that confirmed shape as the external gate because the approved-readable file has the same CV17 1.1.1 11-column profile as the app formatter; latest app-generated `.txt` CV17 / SD-card / SR-S4000 / representative barcode recheck remains a Post-UI-08 follow-up, not a PR #122 blocker.

## Settled Design Facts

- DB design is materially complete for implemented backend with 18 original tables; REQ-401 redesign adds planned daily report tables (`daily_report_imports`, `daily_report_*_lines`) before SALES implementation
- Import rollback uses logical invalidation, not physical delete
- CSV import pipeline is `Parse -> Validate -> Preview -> Commit`
- Parse failures are logged to `operation_logs`, not persisted in `csv_imports`
- Multiple `jan_code` matches resolve by `ORDER BY product_code ASC`
- `pos_stock_sync` is an explicit business flag
- `plu_dirty` and `plu_exported_at` track app-side PLU sync state; `plu_exported_at` is not proof of PC-tool acceptance or register reflection
- PLU export real-device confirmation and future Z004 PLU-by-sales evaluation should be handled as one verification flow, but current SALES redesign must first account for `Z001`/`Z002`/`Z005`; checklist source: `docs/plu-export-and-real-csv-verification.md`
- POS adapter boundary is a settled architecture constraint (`D-023`): CASIO `Z001`/`Z002`/`Z004`/`Z005`, CV17, SD-card, and PC tool details are adapter facts unless a source design doc explicitly promotes a concept to the app core.
- REQ-401 daily report redesign is a settled design direction (`D-025`): `Z001`/`Z002`/`Z005` create app-internal daily report aggregates, while `Z004` remains item-level product-sales/inventory track after PLU verification. Daily reports must not be expanded into fake `sale_records` or `inventory_movements`.
- `stocktake_items.valuation_cost_price` freezes stocktake valuation
- Stocktake may proceed while CSV import remains allowed

## Key Domain Rules

- Products can use JAN-based codes or department-prefix custom codes
- Fabric may be managed in `cm`
- Some products must not auto-decrement stock from POS sales import
- Register-processed returns are reflected through CSV import
- Manual return/exchange exists for non-register cases

## Progress Snapshot

- Completed: A, B, C, D task groups
- Completed: backend layers through v0.6.0 (`UI / CMD / BIZ / IO / MNT` backend contracts implemented)
- Completed: Phase 1 UI foundation essentials and Phase 2 daily 5 UI screens
- Completed: Phase 2 H-6 Windows native 5-screen walkthrough
- Completed: Phase 2 8-9 decision; E2E and visual regression are not `v0.8.0-ui-daily` tag gates
- Completed: temporary `typedInvoke` fallback path retirement for Phase 2 closeout
- Completed: `v0.8.0-ui-daily` tag on PR #75 closeout merge `f44f99a`
- Completed: post-Phase 2 product-code readability and display-scale follow-up on PR #77 merge `62b851b`
- Completed: Phase 3 product master UI-01a / UI-01b / UI-01c through PR #100 merge `6bef4b1`
- Completed: UI-02 receiving stock Design Readiness through PR #102 merge `4f25cde`
- Completed: UI-02 receiving stock implementation through PR #103 merge `fa34a8e`
- Completed: UI-04 manual sale implementation through PR #104 merge `32c98e0`
- Completed: npm/tooling first thaw through PR #105 merge `8184097`
- Completed: tooling / parallelization map and dialog plugin foundation through PR #106 merge `a2dceff`
- Completed: UI-03 return/exchange implementation through PR #107 merge `1c8ff66`
- Completed: post-UI-03 warning cleanup through PR #108 merge `a3e775a`
- Completed: UI-05 waste/breakage implementation through PR #110 merge `0794342`
- Completed: completed-capability Design Phase for inbound/outbound business records and inventory-movement traceability through PR #111 merge `5fee926`
- Completed: DB/BIZ/CMD traceability foundation through PR #112 merge `3f9c4b1`
- Completed: UI-06c stock movement history through PR #113 merge `f175e74`
- Completed: inventory records hub and disposal detail route through PR #114 merge `97811b7`
- Completed: receiving / return-exchange / manual-sale record detail expansion through PR #115 merge `c3a4e9d`
- Completed: manual sale recent list follow-up through PR #116 merge `145330b`
- Completed: UI-03 note visibility follow-up through PR #117 merge `06bcc37`
- Completed: UI-08 pre-check field impact / POS adapter boundary / Impact Review Lenses through PR #118 merge `7fd888c`
- Completed: REQ-401 SALES daily report design through PR #119 merge `92e4592`
- Completed: UI-08 PLU design readiness through PR #121 merge `49ca55b`
- Completed: UI-08 PLU implementation through PR #122 merge `a0e11d6`
- Current phase: Phase 3 operator UI follow-up. UI-08 PLU implementation is merged against CV17 1.1.1, using the two-step `prepare_plu_export` / `confirm_plu_export_saved` contract. Next scheduled work is REQ-401 SALES implementation based on the PR #119 design.
- Current live status is in `Plans.md`
- Workflow convention: after the first implementation pass has passed automated gates and R3/R4 review-only, create a Draft PR for external review / Windows native L3 / owner handoff unless the user explicitly keeps the work local. Keep it Draft until manual checks are complete and the owner asks to mark Ready.

## Open Items

- Whether `宅急便` is in inventory scope
- `Q40` failure-handling detail
- SR-S4000 scanning PLU reflection path is confirmed at the procedure/profile level, and PR #122 external gate is accepted by structural equivalence to the confirmed CV17 1.1.1 11-column shape. Use `docs/plu-export-and-real-csv-verification.md` for the Post-UI-08 app-generated `.txt` recheck; do not treat app-side `plu_exported_at` as proof of PC-tool/register reflection.
- REQ-401 implementation: implement IO-07/BIZ-08/CMD-12 and daily_report_* migration from the archived SALES design, then update UI-07/daily/monthly reports; keep Z004 product-sales track separate until post-PLU verification proves item-level sales import semantics
- Optional future UI quality follow-up: reassess smoke E2E / visual regression at the timing recorded in `docs/UI_TECH_STACK.md` §7.2: future cross-screen typography/density changes, first Phase 3 cross-screen workflow planning, and before the `v1.0.0` candidate after Phase 4

## Companion Docs

- rationale: `docs/decision-log.md`
- live status: `Plans.md`
