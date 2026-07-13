# UI-08 PLU書出し Implementation Plan

## Risk

Risk: R3

Reason:
REQ-402 の PLU書出しは BIZ/CMD contract、generated binding、native save dialog、operator-facing UI、`plu_dirty` / `plu_exported_at` 更新タイミング、CV17 1.1.1 manual compatibility gate を含む。設計は PR #121 で完了済みだが、旧実装はファイル生成時点で未反映解除しているため、二段階契約への変更は回帰リスクがある。

2026-07-02 field gate で、現在の UI-08 生成ファイルは CV17 1.1.1 / SR-S4000 外部manual gate を通過しなかった。原因は旧CV17前提の10列 `.tsv` / `メモリーNo.` / `スキャニングコード` / memory No. 1始まり / product_code fallback であり、CV17 1.1.1 `スキャニングPLU(商品)` adapter profile へのformat修正が必要になった。PLU file format、JAN validation、operator-facing error、manual gate が変わるため引き続きR3。

## Goal

UI-08 PLU書出しを実装し、商品マスタから CV17 1.1.1 向け PLUタブ区切り `.txt` を保存できるようにする。ファイル保存だけでは未反映を解除せず、保存後に利用者が「この書出しを未反映から外す」を押した exact product_code set だけを app-side exported として確定する。

## Scope

- BIZ を `prepare_plu_export` / `confirm_plu_export_saved` の二段階契約に変更する。
- `prepare_plu_export` は CP932 bytes、推奨ファイル名、対象商品コード、件数、上限警告を返し、DBを更新しない。
- `confirm_plu_export_saved` は prepare 由来の exact product_code set のみ `plu_dirty=false` / `plu_exported_at=now` に更新する。
- CMD / generated binding に `preparePluExport` / `confirmPluExportSaved` / `listPluDirty` を出す。
- `/products/plu-export` route と UI-08 画面を実装する。
- ホーム通知とナビゲーションから UI-08 へ遷移できるようにする。
- native save dialog 経由で `.txt` を保存し、保存キャンセル / 保存失敗では未反映解除しない。
- query invalidation は confirm 成功後だけ `pluDirty` / product list / home PLU通知相当へ反映する。
- automated gates と fresh review-only sub-agent を通し、manual CV17 / Windows native L3 は Draft PR gate として残す。
- CV17 1.1.1実機調査結果を source docs に昇格し、`PLU_{YYYYMMDD}.txt`、11列ヘッダ、13桁JAN必須へ修正する。PLU総枠5000は通常PLUとスキャニングPLUで共有し、現地profileでは通常PLU216枠使用により memory No. 217始まり / スキャニングPLU上限4,784件とする。
- JANなし / 13桁以外 / チェックディジット不正の商品はprepareで拒否し、UIに商品マスタ確認の日本語エラーとして出す。
- UI-08 L3 / CV17 manual gate 用のデモseedは13桁EANを生成し、古いJAN8 seedが差分PLU書出しを阻害しないようにする。
- CV17 import成功とSD/register reflection成功を分け、SR-S4000で呼び出し不可だった原因切り分けはmanual gateとして残す。

## Non-scope

- CV17 1.1.1 の実機受理を自動化すること。
- PCツール取込み、SDカード書出し、レジ読込みの成功をアプリが証明すること。
- SALES / Z004 商品別売上取込みの再評価。
- PLU export history table、PLU差分の復元、取消、監査UI。
- JANなし商品のPLU対象扱い（スキャニングPLU対象外表示、通常PLU/部門売りとの関係、商品登録/一覧での案内）は Post-UI-08 の別PRで設計する。
- 実店舗 PLUファイル、register backup、実DB、ログ、秘密情報のコミット。

## Acceptance Criteria

- `prepare_plu_export` は full / diff の PLUファイルを返し、`plu_dirty` / `plu_exported_at` を更新しない。
- `confirm_plu_export_saved` は空、重複、存在しない product_code を拒否し、失敗時に一部更新しない。
- 旧 `export_plu` command / generated `exportPlu` consumer が残らない。
- `/products/plu-export` は差分/全件モード、対象一覧、保存、保存後確認、retry、空状態、4,784件上限エラーを日本語で表示する。
- 保存キャンセル / 保存失敗では `confirmPluExportSaved` が呼ばれず、未反映件数が残る。
- 保存成功後、未反映解除前に画面遷移やアプリ再起動相当の再表示があっても、保存済み未確認状態を復帰できる。復帰状態は `localStorage` の最小メタデータのみで、PLUファイル本文や商品名/価格/JANを保存しない。
- 生成ファイルの推奨名は `PLU_{YYYYMMDD}.txt`、ヘッダはCV17 1.1.1由来の11列、memory No. は通常PLU使用数 + 1 始まり、入力桁制限は `無し` になる。現地profileでは通常PLU216枠使用により217始まり。
- JANなし / 13桁以外 / チェックディジット不正の商品を `ｽｷｬﾆﾝｸﾞｺｰﾄﾞ` にfallbackせず、prepareで拒否する。
- デモseed商品のJANは全件有効な13桁EANになり、reset/reseedした検証DBでDiff PLU書出しを通せる。
- 4,784件を超えるスキャニングPLU書出しはprepareで拒否する。
- `REQ-402 invalidates PLU and product queries after confirmation` RTL で、confirm 成功後だけ対象商品が未反映から外れ、関連 query が invalidate されることを確認できる。
- `cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`、`cargo run --bin generate_bindings` が通る。
- `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` が通る。
- `bash scripts/doc-consistency-check.sh --target plan` と `bash scripts/doc-consistency-check.sh` が ERROR なしで通る。

## Design Sources

- Design readiness evidence: `docs/archive/plans/2026-07-01-ui08-plu-design-readiness.md`
- Test matrix seed: `docs/archive/plans/test-matrices/2026-07-01-ui08-plu-design-readiness.md`
- BIZ: `docs/function-design/33-biz-plu-export-service.md`
- CMD / DTO: `docs/function-design/41-cmd-pos.md`
- UI: `docs/function-design/67-ui-plu-export.md`
- IO TSV: `docs/function-design/25-io-plu-formatter.md`
- Architecture / DB / screen: `docs/ARCHITECTURE.md`、`docs/DB_DESIGN.md`、`docs/SCREEN_DESIGN.md`
- Manual checklist: `docs/plu-export-and-real-csv-verification.md`

## Impact Review Lenses

| Lens | Application |
|---|---|
| Adapter / core boundary | CV17 1.1.1の列名、`.txt`、PLU総枠5000共有、SD/register反映手順はCASIO adapter profile。アプリcoreは「商品マスタから書出し対象を選び、保存後にapp-side exported stateを記録する」までに留める。 |
| Fact check / design decision split | 観測事実: 旧10列 `.tsv` はCV17で拒否、11列 `.txt` / 現地通常PLU216枠使用後のmemory 217+ / 有効JAN行はCV17 importまで進んだ。設計判断: UI-08出力をCV17 1.1.1 profileへ切替え、JAN不備はprepareで拒否する。 |
| Lifecycle / retry | prepare失敗（JAN不備/上限超過）はDB未変更。保存失敗/キャンセル/PCツール投入失敗は未反映を残す。confirm後の外部失敗はFull再書出しで回復する既存方針を維持。 |
| Operator workflow | operatorはアプリで `.txt` 保存、CV17 import、SD書出し、SR-S4000設定読込、代表商品呼出し、最後にアプリで未反映解除の順。CV17 import成功だけでは未反映解除しない。 |
| Replacement path | 将来CV17/レジが変わる場合は `25-io-plu-formatter.md` と IO-04 formatter / BIZ validation をadapter profileとして差し替え、UI-08の二段階lifecycleは維持する。 |
| Data safety / evidence | 実JAN、商品名、価格、PLUファイル、register backupは記録しない。PR証跡は列名、件数、memory range、匿名化エラー、手順結果のみ。 |
| Manual verification | CV17 import、PC tool SD settings write、SR-S4000 `設定読み`、representative scan-call は自動化不可。2026-07-03 field gate で店頭PC/レジ側の成功手順は確認済み。承認済み field file とアプリformatterは同じ CV17 1.1.1 11列 profile（11 header fields / 4,784 data rows / non-11-field rows なし）のため、owner判断により PR #122 external gate は構造一致で受容し、最新アプリ生成 `.txt` の同手順再確認は Post-UI-08 follow-up に切り出す。 |
| Reporting / accounting semantics | PLU書出しは売上・在庫移動・Z004取込みとは別。CV17/register確認が通っても sale_records / inventory_movements は作らない。 |

## Boundary / Wire Contract

- producer: `src-tauri/src/biz/plu_export_service.rs`、`src-tauri/src/cmd/plu_export_cmd.rs`
- consumer: `src/features/plu-export/PluExportPage.tsx`
- commands:
  - `prepare_plu_export(state, mode) -> PluExportPrepareResponse`
  - `confirm_plu_export_saved(state, product_codes) -> PluExportConfirmResponse`
  - `list_plu_dirty(state) -> Vec<PluDirtyProduct>`
- prepare output fields: `bytes_base64`, `suggested_filename`, `content_type`, `encoding`, `count`, `target_product_codes`, `over_limit_warning`
- confirm output fields: `updated_count`, `confirmed_at`
- invalid input: empty/duplicate/missing product code rejected in BIZ; UI blocks obvious empty confirm.
- persistence: prepare has no DB mutation; confirm updates exact products in one transaction and writes operation log.
- browser recovery state: `localStorage` key `inventory:plu-export:pending:v1` stores only version/mode/savedAt/savedPath/suggestedFilename/count/encoding/targetProductCodes/overLimitWarning after file save. It must not store `bytes_base64`, file contents, JAN, product names, or prices. Confirm success and explicit discard clear it.

## Test Plan

Test Design Matrix: [test-matrices/2026-07-01-ui08-plu-implementation.md](test-matrices/2026-07-01-ui08-plu-implementation.md)

- RED first: BIZ tests for prepare no mutation and confirm exact-set mutation / rollback.
- Backend contract tests: empty/duplicate/missing confirm, scanning PLU limit rejection, JAN validation, operation log.
- Generated binding checks: no stale `exportPlu`; `preparePluExport` / `confirmPluExportSaved` present.
- Frontend RTL: save cancel/failure no confirm, save success then confirm, retry wording, full backup warning, query invalidation.
- Manual gates: Windows native L3 is PR-level manual evidence. CV17 1.1.1 import acceptance, SD/register reflection, and representative barcode/register behavior are accepted for PR #122 by structural equivalence to the approved-readable field file; latest app-generated `.txt` real-device recheck is recorded as Post-UI-08 follow-up, not a PR blocker.

## Spec Contract

Contract ID: SPEC-UI08-REQ402-IMPLEMENTATION

- UI-08 must generate PLU file bytes through generated `preparePluExport` only.
- `preparePluExport` must not update `plu_dirty` or `plu_exported_at`.
- UI-08 must write the returned CP932 bytes to a native save-dialog target before any app-side exported confirmation.
- Save cancel or save failure must not call `confirmPluExportSaved`.
- UI-08 must call `confirmPluExportSaved` only after the operator explicitly chooses `この書出しを未反映から外す`.
- `confirmPluExportSaved` must update only the exact `target_product_codes` returned by prepare.
- UI-08 wording must not claim PC tool import, SD-card export, or register read-in is automatically confirmed.

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-402 | BIZ prepare split | `REQ-402 prepare_plu_export does not update dirty or exported_at` | prepare no DB mutation | Rust test output |
| REQ-402 | BIZ confirm exact set | `REQ-402 confirm_plu_export_saved updates only requested products` | exact product_code set only | Rust test output |
| REQ-402 | BIZ invalid rollback | `REQ-402 confirm_plu_export_saved rejects empty duplicate and missing products` | rollback on invalid set | Rust test output |
| REQ-402 / CV17 1.1.1 | IO formatter profile | `REQ-402 generates CV17 1.1.1 scanning PLU txt with 11 columns and memory 217` | `.txt`, 11列、PLU総枠5000共有、現地通常PLU216枠使用時はmemory No. 217始まり | Rust test output |
| REQ-402 / CV17 1.1.1 | JAN validation | `REQ-402 prepare rejects products without valid 13 digit JAN` | no product_code fallback | Rust test output |
| REQ-402 / CV17 1.1.1 | scanning PLU limit | `REQ-402 prepare rejects targets beyond scanning PLU memory range` | 4,784件超過を出力しない | Rust test output |
| REQ-402 | CMD/generated binding | `cargo run --bin generate_bindings`; `npm run typecheck` | no stale `exportPlu` | `src/lib/bindings.ts` diff |
| REQ-402 | native save cancel/failure | `REQ-402 does not confirm when the save dialog is cancelled`; `REQ-402 preserves target products when file save fails` | dirty state remains | RTL output |
| REQ-402 | explicit confirmation | `REQ-402 confirms only after operator marks saved PLU file exported` | no register-reflection claim | RTL output |
| REQ-402 / UI-08-D7 | saved pending recovery | `REQ-402 keeps a saved pending export recovery state without PLU file bytes`; `REQ-402 restores saved pending export after returning to the page`; `REQ-402 lets the operator discard a restored pending export and re-export`; `REQ-402 clears an invalid saved pending export recovery state`; `REQ-402 rejects saved pending export recovery state with non-allowed fields` | page/app close recovery, no PLU file bytes in storage, exact product_code set confirm | RTL output |
| REQ-402 | query invalidation | `REQ-402 invalidates PLU and product queries after confirmation` | invalidate only after confirm | RTL output |
| REQ-402 | full export warning | `REQ-402 shows full export backup and PLU limit warnings` | backup/CV17 risk visible | RTL output |
| REQ-402 | manual compatibility | `CV17 1.1.1 import acceptance`; Windows native L3 | Draft PR remains manual-gated | PR body / owner evidence |

## Review Focus

- `prepare_plu_export` が DB を更新していないか。
- `confirm_plu_export_saved` が exact product_code set 以外を未反映解除していないか。
- 空 / 重複 / 存在しない product_code で rollback されるか。
- UI がファイル保存成功とレジ反映成功を混同する文言になっていないか。
- UI がJAN不備時に商品マスタ確認の回復導線を示しているか。
- 保存キャンセル / 保存失敗 / retry で `plu_dirty` が残るか。
- generated binding と route/navigation/home notification が stale でないか。
- 実店舗データ、PLUファイル、register backup、ログ、DB、秘密情報が差分に入っていないか。

## Data Safety

- Synthetic product data only.
- Do not commit real POS CSV, PLU export files, store DB files, backups, logs, register backup files, screenshots with store data, or secrets.
- Native save manual checks must use disposable synthetic filenames and keep outputs outside repo.

## Implementation Results

- Added BIZ two-step PLU lifecycle:
  - `prepare_plu_export(&DbConnection, PluExportPrepareRequest)` returns CP932 bytes, count, target product codes, and compatibility warning field without mutating `plu_dirty` or `plu_exported_at`.
  - `confirm_plu_export_saved(&mut DbConnection, PluExportConfirmRequest)` rejects empty / duplicate / missing product code sets, updates exact requested products in one transaction, sets `plu_dirty=false` and `plu_exported_at=confirmed_at`, and writes a confirmation operation log.
- Replaced CMD-08 single-step `export_plu` with generated `prepare_plu_export` / `confirm_plu_export_saved` and kept `list_plu_dirty`.
- Regenerated `src/lib/bindings.ts`; stale generated `exportPlu` is absent and `preparePluExport` / `confirmPluExportSaved` are present.
- Added `@tauri-apps/plugin-fs` / `tauri-plugin-fs`, initialized the Tauri fs plugin, and granted `fs:allow-write-file`. The native save dialog adds the selected path to the fs scope for the current session, so no static `$HOME/**` scope is needed.
- Added `/products/plu-export` route, activated UI-08 navigation, and changed the home PLU notification CTA from pending disabled to a route link.
- Added `PluExportPage` with diff/full mode, dirty product table, full export backup warning, native save dialog, CP932 base64 byte write, save cancel/failure recovery, explicit app-side confirmation, manual PC tool / SD-card / register note, and confirm-only query invalidation.
- Added REQ-402 Rust tests for prepare no-mutation and confirm exact-set / invalid rollback behavior.
- Added REQ-402 RTL tests for save cancel, save failure, explicit confirm, query invalidation, full export backup warning, and PLU limit warning.
- Regenerated `docs/function-design/90-traceability.md`; REQ-402 remains WARN 0 / ERROR 0.
- Registered `67-ui-plu-export.md` as a UI-only design doc in `src-tauri/tests/design_compliance_test.rs`.

Verification:

- RED: `cargo test plu_export_service --lib` failed on missing `PluExportPrepareRequest` / `PluExportConfirmRequest` / `prepare_plu_export` / `confirm_plu_export_saved`.
- RED: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` failed on missing `PluExportPage`.
- `cargo test plu_export --lib` PASS（16 tests）
- `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（5 tests）
- `npm run generate:routes` PASS
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm test` PASS（83 files / 493 tests）
- `npm run build` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（582 lib tests + integration/doc tests）
- `cd src-tauri && cargo run --bin generate_bindings` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS
- `bash scripts/check-env-safety.sh` PASS

Windows native L3 feedback response:

- Accepted/fixed: UI-08 page lacked the existing business-screen inner spacing, making it look different from UI-02 receiving and related screens. Added the same page-level `p-6` spacing pattern.
- Accepted/fixed: after PLU file save, `この書出しを未反映から外す` appeared below the main grid and could be missed. Moved save/cancel/failure/confirm status panels to the top directly below the manual confirmation notice.
- Accepted/fixed: added page-top scroll after save cancel, save failure, save success, confirm success, and confirm failure so the operator sees the top status panel immediately.
- Source design updated: `docs/function-design/67-ui-plu-export.md` now records UI-08-D6 for top status visibility and existing-screen spacing.
- RTL updated: `PluExportPage.test.tsx` asserts page-top scroll on cancel, save failure, save success, and confirm success.

L3 feedback verification:

- `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（5 tests）
- `npm run format:check` PASS
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run build` PASS
- `bash scripts/doc-consistency-check.sh` PASS
- `npm test` PASS（83 files / 493 tests）

L3 feedback review-only sub-agent: Turing (`fork_context:false`)

- P2 accepted/fixed: confirm failure was shown inside the success-colored saved-file status, mixing PLU file save success with failed app-side exported confirmation. Added a separate `confirm_failed` state with destructive `未反映から外せませんでした` Alert and retry action.
- P3 accepted/fixed: after PLU file save, both top confirm and lower export buttons looked primary. Kept `この書出しを未反映から外す` as the primary action and changed the lower re-export action to outline while a saved export is pending.
- P3 accepted/fixed: RTL only asserted text/scroll, not that the status panel stayed above the table/settings grid. Added labelled top status/content regions and DOM-order assertions.

Turing response verification:

- `npm test -- --run src/features/plu-export/PluExportPage.test.tsx src/lib/page-scroll.test.ts` PASS（2 files / 8 tests）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `npm run build` PASS
- `npm test` PASS（83 files / 494 tests）
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `bash scripts/doc-consistency-check.sh` PASS
- `git diff --check` PASS

Recovery-route follow-up:

- Accepted/fixed: after PLU file save, the app previously kept the exact confirm target set only in page state. If the operator navigated away, the app closed, or the PC restarted before `この書出しを未反映から外す`, the operator lost the recovery path and had to re-export.
- Added lightweight browser recovery state `inventory:plu-export:pending:v1` after save success. It stores only version, mode, save metadata, count, encoding, target product codes, and warning state. It deliberately does not store `bytes_base64`, PLU file contents, JAN, product names, prices, real PLU files, PC-tool result, SD-card result, or register result.
- On returning to `/products/plu-export`, a top Alert `保存済みで未確認のPLU書出しがあります` shows save path/count/encoding/saved time and offers `この書出しを未反映から外す` or `破棄して再書出し`.
- Confirm success and explicit discard clear the recovery state. Confirm failure keeps it for retry. Invalid/malformed recovery JSON is cleared and ignored.
- Source design updated: `docs/function-design/67-ui-plu-export.md` now records UI-08-D7 and the browser recovery contract. `docs/SCREEN_DESIGN.md` and `docs/UI_TECH_STACK.md` record the operator and storage rules.

Recovery-route verification:

- RED: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` failed on missing pending storage / restored Alert / discard / invalid-state clearing.
- GREEN: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（10 tests）

Recovery-route review-only sub-agent: Boyle (`fork_context:false`)

- P2 accepted/fixed: restored `localStorage` schema accepted required fields even when disallowed payload fields such as `bytes_base64`, product names, or prices were present. Tightened schema to allow only the recovery contract keys, require integer `count`, reject duplicate target codes, and require `count === targetProductCodes.length`. Added RTL coverage for disallowed field rejection.

Boyle response verification:

- RED: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` failed because a pending recovery JSON containing `bytes_base64` / product detail fields still restored the top Alert.
- GREEN: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（11 tests）

2026-07-02 field-gate response:

- Accepted/fixed: CV17 1.1.1 import dialog defaults did not select `.tsv`; UI-08 now recommends and filters `PLU_{YYYYMMDD}.txt` only.
- Accepted/fixed: CV17 1.1.1 `スキャニングPLU(商品)` rejected the old 10-column header (`メモリーNo.` / `スキャニングコード`). IO-04 now emits the observed 11-column profile: `メモリNo.`、`ｽｷｬﾆﾝｸﾞｺｰﾄﾞ`、`名称`、`単価`、`課税方式`、`単品売り`、`負単価`、`品番PLU`、`ゼロ単価`、`入力桁制限`、`部門リンク`.
- Accepted/fixed: scanning PLU memory is not 1始まり. SR-S4000のPLU総枠5000は通常PLUとスキャニングPLUで共有されるため、IO-04 starts memory No. at 通常PLU使用数 + 1。現地profileでは通常PLU216枠使用により217始まり、BIZ rejects 4,785 rows以上.
- Accepted/fixed: CV17 rejected `product_code` fallback in `ｽｷｬﾆﾝｸﾞｺｰﾄﾞ`. IO/BIZ now require valid 13-digit JAN/EAN-13 with correct check digit and reject missing / non-13 / invalid JAN during prepare.
- Accepted/fixed: `入力桁制限` required observed value `無し`; IO-04 now writes `無し` for every row.
- Accepted/fixed: UI wording now says `PLUファイル` / `PLUファイル保存` and shows product-master/JAN correction guidance when prepare rejects invalid scanning codes.
- Manual gate status at this point: a reduced CV17-compatible file imported into CV17, but SD-card/register read-in did not make representative scanning PLU callable on SR-S4000. The remaining issue was isolated as external write/read scope, register setting, or memory mapping, not app-side confirmation. This was superseded by the 2026-07-03 field gate, where the store-laptop/register flow succeeded for the approved-readable CV17 `.txt`; PR #122 now accepts structural equivalence to that successful shape and defers latest app-generated `.txt` recheck to Post-UI-08 follow-up.

Field-gate response verification:

- RED: `cargo test plu_export --lib` failed on missing `SCANNING_PLU_EXPORT_LIMIT` / `PluFormatError::InvalidScanningCode`.
- RED: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` failed on missing prepare-failure UI, stale `.tsv` save filter, and old 5,000 warning.
- GREEN: `cargo test plu_formatter --lib` PASS（17 tests）
- GREEN: `cargo test plu_export --lib` PASS（17 tests）
- GREEN: `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（12 tests）
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（583 lib tests + integration/doc tests）
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run format:check` PASS
- `npm test` PASS（83 files / 500 tests）
- `npm run build` PASS
- `cd src-tauri && cargo run --bin generate_bindings` PASS
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/doc-consistency-check.sh` PASS

Field-gate review-only sub-agent: Ampere (`fork_context:false`)

- P2 accepted/fixed: user-facing UI and source docs still contained stale `TSV` wording (`このTSV` / `保存済みTSV` / `保存したTSV` / `全件TSV`) after the CV17 1.1.1 `.txt` switch. Replaced operator-facing wording with `PLUファイル` / `保存済みPLUファイル` and aligned `67-ui-plu-export.md` / `SCREEN_DESIGN.md`.
- P3 accepted/fixed: the RTL for 4,784 件上限 still mocked an unreachable `preparePluExport` success with `over_limit_warning=true`. Changed it to the actual BIZ contract: prepare returns validation error, save/write/confirm are not called, and the prepare-failure recovery button is shown.

Ampere response verification:

- `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（12 tests）
- `rg -n "このTSV|保存済みTSV|保存したTSV|全件TSV|TSVを保存しました|TSV本文|TSV bytes|saved TSV|TSVデータ|TSVに含めた" ...` found no matches in UI-08 implementation docs/page/test targets.

Shared PLU memory correction:

- Accepted/fixed: the previous field-gate response treated `217` as a fixed scanning PLU start. Owner clarified SR-S4000 has total PLU memory 5000 shared by normal PLU and scanning PLU; if normal PLU uses 250 slots, scanning PLU starts at 251. Updated constants and docs so `SCANNING_PLU_MEMORY_START` is derived from `OBSERVED_STANDARD_PLU_MEMORY_COUNT + 1` and `SCANNING_PLU_EXPORT_LIMIT` is derived from `5000 - OBSERVED_STANDARD_PLU_MEMORY_COUNT`.
- Current app behavior remains the observed field profile: normal PLU 216 slots used, scanning starts at 217, capacity 4,784. This is not an operator-editable UI setting; UI-08 currently keeps the observed count as a code-side adapter profile. If the normal PLU SD/CV17 write count differs, derive the scanning start from that write result before external manual gate, or implement that derivation before proceeding.

Shared PLU memory verification:

- RED: `cargo test constants::tests::test_scanning_plu_memory_profile_req402_uses_shared_total_memory --lib` failed because `scanning_plu_memory_start` / `scanning_plu_export_limit` did not exist.
- GREEN: `cargo test constants::tests::test_scanning_plu_memory_profile_req402_uses_shared_total_memory --lib` PASS.
- Targeted follow-up: `cargo test plu_formatter --lib` PASS（17 tests）, `cargo test plu_export --lib` PASS（17 tests）, `npm test -- --run src/features/plu-export/PluExportPage.test.tsx` PASS（12 tests）.
- Generated traceability refreshed after adding the REQ-402 constants test; `cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）.
- Final gates after correction: `cargo fmt --check` PASS, `cargo clippy --all-targets --all-features -- -D warnings` PASS, `cargo test` PASS（584 lib tests + integration/doc tests）, `npm run typecheck` PASS, `npm run lint` PASS, `npm run format:check` PASS, `npm test` PASS（83 files / 500 tests）, `npm run build` PASS, `bash scripts/doc-consistency-check.sh --target plan` PASS, `bash scripts/doc-consistency-check.sh` PASS.
- Review-only was not rerun for this narrow post-review correction; prior R3 review-only Ampere already completed for the field-gate response, and this change is covered by source-doc updates plus a new RED/GREEN regression test for the shared PLU memory rule.

Manual / L3 status:

- Implementation is complete for PR #122 code/docs/tests. Automated gates and review-only feedback are reflected above.
- Windows native L3 first-pass app behavior check found layout / status-placement feedback; accepted/fixed above. Owner confirmed the improved UI looked acceptable.
- Recovery-route Windows native L3 was owner-confirmed on 2026-07-01: after closing/reopening the app, PLU書出し showed the top `保存済みで未確認のPLU書出しがあります` Alert.
- 2026-07-03 field gate confirmed the store-laptop/register-side flow: CV17 TXT import, PC tool SD settings write, SR-S4000 `設定読み`, and representative barcode/register behavior confirmation.
- Owner decision on 2026-07-03: do not keep PR #122 blocked on another full SR-S4000 pass. The approved-readable CV17 `ｽｷｬﾆﾝｸﾞPLU(商品).txt` that already passed CV17 import, PC tool SD settings write, SR-S4000 `設定読み`, and representative barcode/register behavior uses the same structure as the app profile: 11 tab-delimited columns, CP932/CRLF-compatible text, 4,784 data rows, all rows with 11 fields, memory range aligned to 217..=5000, and the same CV17 1.1.1 scanning PLU contract. App formatter emits the same 11-column header/profile and enforces 13-digit JAN/EAN-13.
- PR #122 external compatibility gate is accepted by structural equivalence. Latest app-generated `.txt` real-device confirmation is deferred to Post-UI-08 follow-up, not a PR #122 blocker.
- Follow-up checks to pick up later:
  - Save a latest app-generated `.txt` from PR #122 or successor.
  - Import it into CV17 1.1.1 / カシオレジスターツール with SD card inserted if the tool requires it.
  - Confirm the tool accepts the file without error, or record the anonymized error message.
  - Confirm row count matches the app write count and the 11 columns are recognized in the expected order.
  - Spot-check representative rows in the tool: scanning code shape, name display/garbling/truncation, unit price, tax category, and department link without recording product-identifying values.
  - Write/export PLU settings from the tool to SD card without error, recording anonymized count/result only.
  - Read/apply the SD card PLU settings into SR-S4000 via `設定読み` without error, recording the sanitized register result.
  - Spot-check on the register that representative products can be called/scanned and show expected behavior.
- Actual sale and post-PLU Z004 evaluation are not required for this PR unless the owner chooses to extend the manual gate; they remain the later Post-PLU Z004 evaluation track.
- Owner direction on 2026-07-03: field investigation for the store-laptop/register side is complete enough to proceed. PR #122 may proceed based on structural equivalence; latest app-generated `.txt` CV17 / SD-card / SR-S4000 / representative barcode flow is deferred to Post-UI-08 follow-up.

## Review Response

Fresh review-only sub-agent: Kant (`fork_context:false`)

- P1 accepted / workflow fix: new route, page, RTL test, active plan, and test matrix were untracked at review time. They must be included in the implementation commit before PR creation. Verification target: `git status -sb` / `git ls-files --others --exclude-standard` after commit preparation.
- P2 accepted/fixed: `fs:allow-write-file` had a static `$HOME/**` scope, which could reject SD-card / external-drive paths and was broader than needed for dialog-selected writes. Confirmed Tauri v2 `save()` adds the selected path to the filesystem scope for the current session, then changed capability to command permission only: `"fs:allow-write-file"`.
- P3 accepted/fixed: operation log used `operation_type="plu_export_confirm"` and omitted `confirmed_at`. Changed to design contract `operation_type="plu_export"`, summary `PLU書出し済み確認を記録しました（{count}件）`, and detail `{"count":...,"confirmed_at":"..."}`. Added Rust assertions.
- P3 accepted/fixed: `confirm_plu_export_saved` lacked the design contract guard for `product_codes.len() > PLU_EXPORT_LIMIT`. Added validation and Rust coverage.

Post-review verification:

- `cargo test plu_export --lib` PASS（16 tests）
- `npm run format:check` PASS
- `bash scripts/doc-consistency-check.sh --target plan` PASS
- `bash scripts/check-env-safety.sh` PASS
- `cd src-tauri && cargo fmt --check` PASS
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` PASS
- `cd src-tauri && cargo test` PASS（582 lib tests + integration/doc tests）
- `cd src-tauri && cargo run --bin generate_traceability -- --check` PASS（ERROR 0 / WARN 0）
- `bash scripts/doc-consistency-check.sh` PASS
