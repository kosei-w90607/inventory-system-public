# Test Design Matrix: UI-08 Field Check Impact

## Scope

Seed matrix for the design split caused by the UI-08前 PLU/実機確認調査. This matrix covers follow-up design and implementation PRs. The current PR is docs/design only.

## Matrix

| ID | Contract / decision | Failure mode | Test / evidence target | Timing |
|---|---|---|---|---|
| SALES-01 | D-022 / REQ-401 current operation uses `Z001`/`Z002`/`Z005` | UI or docs still tell operator to import current daily sales as Z004-only | Source-doc review + future UI text tests | SALES design / UI PR |
| SALES-02 | `Z001` parser contract | Pre-header rows, CP932, CRLF, 4 columns parsed incorrectly | Synthetic fixture parser unit test | SALES parser PR |
| SALES-03 | `Z002` parser contract | Raw 0x85/NEL and 4-column rows mishandled | Synthetic fixture parser unit test | SALES parser PR |
| SALES-04 | `Z005` parser contract | 2-column metadata rows and 4-column data rows confused | Synthetic fixture parser unit test | SALES parser PR |
| SALES-05 | Aggregate report data model | Aggregate sales report forced into item-level `sale_records`/`inventory_movements` and creates false stock movement | BIZ/service tests + DB design review | SALES design / implementation PR |
| SALES-06 | Multi-file import recovery | Missing one of Z001/Z002/Z005 produces unclear or partial commit behavior | BIZ negative test + UI error-state test | SALES implementation PR |
| SALES-07 | Duplicate/import rollback | Same business day import and overwrite semantics regress from current Z004 pipeline | BIZ transaction/rollback tests | SALES implementation PR |
| PLU-01 | REQ-402 / CV17 1.1.1 compatibility | Ver.2.0.1-only header labels rejected by installed PC tool | Manual PC tool import check, or documented blocker | UI-08 design readiness |
| PLU-02 | PLU TSV format | CP932/TSV/CRLF/header drift breaks PC tool import | IO golden bytes test with synthetic rows | UI-08 implementation |
| PLU-03 | PLU product name conversion | 16-byte CP932 truncation or `_` replacement corrupts TSV structure | IO formatter unit tests | UI-08 implementation |
| PLU-04 | Tax/department mapping | Tax labels or department link not accepted by PC tool | IO/BIZ tests + manual PC tool check | UI-08 implementation |
| PLU-05 | `plu_dirty` lifecycle | App resets dirty state on TSV generation, then PC tool/register import fails and operator loses diff retry path | BIZ tests and UI recovery wording check | UI-08 design / implementation |
| PLU-06 | Full/Diff selection | Diff includes clean products or excludes dirty products | BIZ tests with synthetic products | UI-08 implementation |
| PLU-07 | 5000 PLU limit | Over-limit warning hidden or treated as hard failure without design decision | BIZ/unit + UI warning test | UI-08 implementation |
| PLU-08 | Register write boundary | UI implies app confirmed register reflection | UI wording review + RTL text test | UI-08 implementation |
| Z004-01 | Z004 reclassification | Future code removes existing Z004 parser usefulness before PLU-by-sales evaluation | Regression tests for existing synthetic Z004 fixtures | SALES/PLU split PRs |
| Z004-02 | Post-PLU evaluation | Z004 is reused for stock decrement before PLU registration is proven | Manual verification evidence + design review | After UI-08 manual verification |
| ADAPT-01 | D-023 POS adapter boundary | CASIO `Z001`/`Z002`/`Z004`/`Z005` names leak into stable app-core DTOs/UI labels without rationale | Source-doc review + DTO naming review | SALES design PR |
| ADAPT-02 | Fact check vs design decision split | Field-check observations are treated as app-core contract without Design Phase decision | Plan/design review checklist | SALES and PLU design PRs |
| ADAPT-03 | App-internal daily report model | Daily report, payment/key summary, and department summary are not modeled separately from CASIO file names | DB/function design review + service tests | SALES design / implementation PR |
| ADAPT-04 | App-internal product-sales model | Z004 product-sales output is coupled directly to inventory movements before PLU registration evidence exists | BIZ tests + manual verification evidence | Post-PLU Z004 evaluation |
| ADAPT-05 | Register replacement path | New register support would require rewriting UI/BIZ/report behavior instead of adding a new adapter | Architecture review before new POS support | future POS replacement |
| SAFE-01 | Data safety | Real CSV/TSV/Excel/register backup copied into repo | `git status --short`; reviewer checks changed files | every PR |
| SAFE-02 | Data safety | Docs quote real JAN/product names/sales amounts/cell values | Review-only pass against changed docs | every PR |
| SAFE-03 | External path handling | `raw-private/**` inspected or referenced as evidence | command/history review where available; author attestation | current and future field-data tasks |

## Current PR Evidence

- Docs/design only.
- Expected local gates: `bash scripts/doc-consistency-check.sh --target plan`, `git status --short`.
- Required review: fresh review-only sub-agent focused on source-doc promotion, stale Z004 assumptions, test gaps, and data safety.
