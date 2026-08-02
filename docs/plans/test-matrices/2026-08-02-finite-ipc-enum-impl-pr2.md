# Test Design Matrix: 有限 IPC 値の generated enum contract 化 実装 PR2（domain family (2)〜(14)、監査是正 順14 最終単位）

## Risk

Risk: R3

anchor 実行規約（round C-1 P3-1）: 期待値 `0` の `rg -c` は match 0 件時に出力なし + exit 1 となるため、`rg -c --include-zero` で実行して `0` を確認する。

## Contracts Under Test

- F1: family (2)〜(14) の enum（**新設 9 + 既存 derive 追加 4** — round C-1 P2-3 で勘定是正、SPEC-P41-PR2-D1 の名前・位置・方向別 derive + round C-1 P1-1 の db 配置原則）が定義され、`bindings.ts` に 12 型の literal union が生成される（13 enum のうち SalesMode のみ既生成のため新規 12）
- F2: bindings 再生成 diff が「対象 field 型強化 + 12 型新規 export + `getMonthlySales` / `preparePluExport` シグネチャ enum 化」のみで、全 enum の wire 文字列が現行値と 1:1 完全一致する（`ProductTaxRate` の explicit rename `"10"|"8"|"0"` を含む）
- F3: 手動 parse 2 site（`parse_export_mode` / `sales_cmd.rs:58` の mode match）が廃止され、request 側不正値は serde deserialize 拒否へ統一される（wire shape は Contract Probe 実測）
- F4: family ごとの wire test が **direction 別 oracle**（D-064 (iv) — round C-1 P1-2）で追加され pass する: request を運ぶ family = serialize/deserialize 両方向の round-trip（正常全値）+ 不正値拒否、response-only family（(6)(7)(8)(12)）= serialize 出力固定 oracle（正常全値）。family (11) nullable filter の null / 省略 / 不正 literal 3 パターンを含む（SPEC-P41-D5 (iii) + PR1 P2-2 凍結義務）
- F5: DB 読出し変換（TEXT → enum）が明示 match で新設され、movement_type 不明値 = internal / reference_type 不明値 = None（REQ-303 契約 fallback）。reference_type 側は不明値→None を検証する新設 unit test を持ち、`list.rs` の既存 REQ-303 legacy 文字列 test（`test_resolve_movement_source_req303_unknown_reference`）は契約ごとこの新設 test へ移設される（round 1 P2-1。`resolve_movement_source` は `Option<ReferenceType>` の 6 variant 網羅 match となり wildcard を持たない）。NULL reference 系の既存 REQ-303 test（`list.rs:466-468`）は enum literal への書き換え（`:468`）を伴い契約不変のまま存続する（round 2 P3）。movement_type 側の `VALID_MOVEMENT_TYPES` BIZ 値域チェック（`list.rs:191-219`）は退役し、`test_list_movements_req303_invalid_movement_type` の契約は F4 の serde 拒否 test へ移設、valid 側 test は enum literal へ書き換え（round 2 P2）
- F6: 冪等 fingerprint（manual_sale / returns / disposal の 3 domain — round 4 P1-2 拡張）が enum 化前後で同一入力に対し bit 一致する（SPEC-P41-PR2-D6、D8 (f)。型検査で守られない唯一の class）
- F7: canonical wire 文字列関数を持つ全 enum — 既存 `MovementType` / `ReferenceType` + 新設 (2)(3)(4)(5)(7)(13)(14)、(6) 等は Writer sweep で確定 — の全 variant で canonical 出力 == serde 出力の parity test が常設され、serde 以外の全消費 site（DB write / IO struct / fingerprint）が canonical 関数を再利用する（SPEC-P41-PR2-D7、round 5 P1-1 で direction 追加・P1-2 で canonical 一元供給規則化。DB CHECK はドメイン内 variant 取り違えを通すため parity が唯一の機械防御。`plu_export_service.rs:149` → `map_tax_rate` の Casio 税区分接続は取り違えがエラーにならない代表例）
- F8: frontend の exhaustive 化 — `movementTypeLabels` が `Record<MovementType, string>`、`compute-summary.ts` が switch + never 網羅（D-10 comment 退役）となり、variant 増減が `tsc` で検出される
- F9: docs の future-state 注記 19 箇所が現在形化され（機械 token: `順14 実装 PR2` 0 hit 等）、30 の stock_unit guard 非対称が事実へ是正される
- F10: 手動 type alias 7 個が bindings 由来型へ置換され、mock drift 3 箇所が是正され、同種 drift の再注入が `tsc` で red になる。URL search 層（P4-2）のコードは不変
- F11: `ImportRow.tax_rate` / `stock_unit` は String 維持され、file 由来経路の挙動が bit-for-bit 不変（SPEC-P41-PR2-D2/D3）— tax_rate = 値域チェック → error row 契約、stock_unit = missing/空文字 → INSERT 時 pcs デフォルト化・非空不正値 → commit の DB CHECK 拒否（round C-1 P2-2 の 2 境界）
- F12: 廃棄の自由記述 `reason`（`DisposalItemInput.reason`）が String のまま維持される（44 §23.7 の enum 化禁止）

## Failure Modes

- G1: variant 名の serde 導出結果が現行 wire 文字列とずれる（特に `SaleAuto`/`ReceivingRecord` 等の複合語、`ProductTaxRate` の数値文字列）
- G2: bindings diff に型強化以外の変化が混入する、または一部 family の生成が漏れる
- G3: 手動 parse が残存する、または退役した validation 文言経路が file 由来経路（`product_service.rs:692-702`）まで波及する
- G4: direction 別 wire oracle が一部 family / 一部値を欠く（request 系の round-trip / response-only の serialize 固定のいずれか）、または不正値拒否の検証が request family で漏れる
- G5: reference_type の enum 変換が legacy 値で internal になり REQ-303 が退行する、または movement_type が silent catch-all になる
- G6: fingerprint 入力が enum の Debug 形式等へ変わり冪等キー互換が壊れる
- G7: `as_str()` と serde rename の二重 SSOT が drift しても検出されない
- G8: frontend の網羅性検査が機能しない（labels の key 欠落 / switch の case 欠落が素通り）
- G9: doc sweep の一部が future 形のまま残る、または 30 の是正が実測事実と食い違う
- G10: alias 置換・drift 是正が漏れる、または URL search 層へ変更が波及する
- G11: `ImportRow` が enum 化され file 不正値が serde 拒否になる（error row 契約破壊）
- G12: 廃棄 reason が enum 化され自由記述が拒否される（機能退行）

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| F1 | G1, G2 | compile + generated | `cargo build` + `rg -c '^export type (MovementType\|ReferenceType\|ProductTaxRate\|ProductStockUnit\|ReturnExchangeType\|ReturnDirection\|DisposalType\|ManualSaleReason\|DailySaleSource\|CsvImportStatus\|CsvImportErrorType\|ExportMode)' src/lib/bindings.ts` → `12`（baseline 0 実測） | 一部 family の enum 化・生成が漏れる | Y1: 代表 1 family（`ReturnExchangeType`）の `rename_all = "snake_case"` を一時削除し bindings 再生成 diff で PascalCase 化を検出、復元後 diff ゼロ |
| F2 | G1, G2 | generated contract + unit | bindings 再生成後の `git diff --stat src/lib/bindings.ts` を Review で突合 + 各 family の direction 別 wire oracle（F4）が wire 文字列の実値を固定 | `ProductTaxRate` の explicit rename がずれる、他型に diff が混入する | Y2: `#[serde(rename = "10")]` を一時的に `"ten"` へ差し替え、F4 oracle red + bindings diff 検出を確認し復元 |
| F3 | G3 | source contract + compile | `rg -c 'fn parse_export_mode' src-tauri/src/cmd/plu_export_cmd.rs` → `0`（baseline 1 実測）+ `rg -c '"by_product" => SalesMode::ByParameter' 系 anchor → `0`（baseline 1 実測、`"by_product" => SalesMode::ByProduct`）+ file 経路 validation 文言の残存確認（`rg -c "税率は '10', '8', '0'" src-tauri/src/biz/product_service.rs` → `1` 維持） | 手動 parse が残る、または file 経路文言まで消える | Y3: 是正後の `prepare_plu_export` 引数を一時的に `mode: String` へ差し戻し、`cargo build` が型不整合で fail することを確認（bindings 由来の呼び出し契約が enum 前提のため） |
| F4 | G4 | unit（direction 別 wire oracle） | request 系 family = round-trip 両方向（正常全値）+ 不正 literal 拒否、response-only family = serialize 出力固定 oracle（D-064 (iv)）+ (11) の null / 省略 / 不正 literal 3 パターン + **frontend unit test: `unwrapResult` へ生 String rejection を与え internal `InvokeError` 化を固定（round C-2 P2-1 — IPC 拒否 shape の実測経路の regression）**。test 名は実装時に `test_<family>_wire_roundtrip` / `_wire_serialize` 系で追加。(11) の不正 literal case は退役する `test_list_movements_req303_invalid_movement_type`（`list.rs:385-404`、実在を実読確認済み）の契約移設先であり、REQ-303 token を引き継ぐ（round 2 P2）。**round 3 P1-1 で移設元を全数化**: returns（invalid return_type `:511-520` / invalid direction `:522-531`）/ disposal（`:395-406`）/ manual_sale（`:561-570`）/ product_service（tax_rate `:1186-1193` / stock_unit `:1197-1204`）/ plu_export_cmd（`:196-215` の 3 test）/ sales_cmd（`:136-158`、「不正な集計モードです」文言 assert 含む）— 各 REQ token を F4 の対応 family test へ引き継ぐ（SPEC-P41-PR2-D8 (a)） | いずれかの値の wire 表現が変わる、不正値が素通りする、または移設が単なる削除になり REQ-303 の不正値契約が消える | Y4: (2) の round-trip test の期待値を `Return`↔`Exchange` で交換し red を確認し復元 |
| F5 | G5 | unit + regression | reference_type 不明値→None の**新設** unit test（TEXT→enum 変換 site。`list.rs:471-476` の legacy 文字列シナリオ `test_resolve_movement_source_req303_unknown_reference` を契約ごと移設 — 実在を実読確認済み）+ movement_type 不明値 = internal の新設 test + 存続する NULL reference 系 REQ-303 test（`list.rs:466-468`、実在確認済み。enum literal 書き換え後） | legacy 値で一覧が internal エラーになる（機能退行）、明示 match が catch-all 化する、または移設が単なる削除になり REQ-303 網羅が消える | Y5: reference_type 変換の fallback（不明値→None）を一時的に internal 返却へ差し替え、移設後の新設 REQ-303 test が red になることを確認し復元 |
| F6 | G6 | unit（idempotency） | 3 domain の fingerprint 固定値 test（manual_sale の既存冪等 test + returns / disposal の新設固定値 test。`returns.rs:149-156, 581` / `disposal.rs:72-75` の埋め込み site が対象 — round 4 P1-2）+ 既存 idempotency replay test 群の regression | いずれかの domain で fingerprint 入力が wire 文字列以外の表現になる（wire 不一致 Display でもコンパイルは通る） | Y6: returns の `i.direction` / disposal の `i.disposal_type` / manual_sale の `reason` の各連結を一時的に Debug 形式（`format!("{:?}", ...)`）へ差し替え、対応する固定値 test が各 red になることを確認し復元（3 domain 各 1 注入） |
| F7 | G7 | unit（parity） | 対象 9 enum（`MovementType` / `ReferenceType` + (2)(3)(4)(5)(7)(13)(14) の新設 canonical 関数、(6) 等は sweep 確定分を追加）の全 variant で canonical 出力 == serde_json 出力の parity test（既存 `as_str()` 全 variant test `inventory_repo.rs:322-329` を拡張 + 新設分を追加 — round 4 P1-3 / round 5 P1-1）+ **BIZ-level PLU integration test（新設 — round C-1 P2-1）: 税率 8% の商品を seed して `prepare_plu_export` 出力 bytes の税区分が `税2(内税)` になることを end-to-end で固定**（consumer の canonical 迂回・誤配線も kill する oracle）+ 既存 `map_tax_rate` 全 variant test（`plu_formatter.rs:822` 付近、実在確認済み）の regression | どちらか一方の変更が他方に追随しない、または consumer が canonical を迂回して誤値を渡す（ドメイン内取り違えは CHECK を通過し、税区分は静かに誤る） | Y7: canonical 関数の 1 arm（例 `SaleAuto => "sale_auto"` / `Damage => "other"` / `Rate8 => "10"`）を別文字列へ差し替え parity test red + **consumer site（`plu_export_service.rs:149` 相当）の受け渡しを誤 variant / 誤値へ差し替え、PLU integration test が red になることを確認**し各復元（round C-1 P2-1） |
| F8 | G8 | compile（exhaustive） | `npx tsc --noEmit` PASS + `rg -c 'literal union 化は将来 D-10' src/features/daily-sales/lib/compute-summary.ts` → `0`（baseline 1 実測） | labels の key 欠落 / switch case 欠落が素通りする | Y8: `movementTypeLabels` から 1 key を一時削除 → `tsc` red。`compute-summary.ts` の switch から 1 case を一時削除 → never 網羅で `tsc` red。各復元 |
| F9 | G9 | source contract（docs） | `rg "順14 実装 PR2" docs/function-design/ \| wc -l` → `0`（baseline 14 実測）+ `rg -c "enum 型に置換される" docs/function-design/31-biz-inventory-service.md` → `0`（baseline 2 実測）+ `rg -c "それまでの現行実装は" docs/function-design/42-cmd-sales-stocktake.md docs/function-design/44-cmd-inventory.md` → 各 `0`（baseline 1 / 2 実測）+ **round 2 P2 / round 3 P2 是正後の stale 型記述 anchor（wire DTO 行限定 — `New*` / 廃棄 reason の正確な String 記述は維持）**: packet Acceptance Criteria の doc anchor 群（21 = `', return_type: String,'` baseline 2 / `'^- disposal_type: String$'` baseline 1 / `'direction: String, quantity'` baseline 1、31 = `': String（"'` baseline 4、44 = return_type baseline 3 / direction baseline 1 / disposal_type baseline 2 / 手動販売 reason `:340` baseline 1、58 = tax_rate / stock_unit 各 baseline 1、21 追加 = `', reason: String,'` baseline 1（`:199` ManualSaleRecordDetail — round 4 P1-1））を全件 0 化。44 `:594` は pattern 弁別不能のため sweep + 独立レビュー担保 | future 形注記または stale 型記述が残る、または `New*` / 廃棄 reason の正確な記述が誤って書き換えられる | Y9: 現在形化後の 44 の 1 箇所を future 形へ一時差し戻し、anchor count が非ゼロ化することを確認し復元 |
| F10 | G10 | source contract + compile | AC の alias 7 anchor（各 baseline 1 実測 → 0）+ mock drift 3 anchor（各 baseline 1 実測 → 0）+ `npx tsc --noEmit` PASS + `git diff --stat` に `src/features/stock-movements/types.ts` の URL search 定義部が現れない | 置換・是正漏れ、または P4-2 層へ波及 | Y10: 是正後の `OtherRecordDetailPages.test.tsx` の mock を `movement_type: "manual_sale"`（元 drift 値）へ差し戻し、`tsc` が literal union 不一致で red になることを確認し復元（D-061 の目的そのものの実証） |
| F11 | G11 | negative + source contract | 既存 file 経路 validation test（invalid 税率 CSV → error row。実装時に rg で実在確認）が無変更で pass + `rg -c 'tax_rate: String' src-tauri/src/biz/product_service.rs` → `1`（`ImportRow` のみ。baseline 2 = CreateRequest + ImportRow、実装後 CreateRequest 側が enum 化して 1）+ **round C-1 P2-2 の境界分離**: `rg -c 'stock_unit: Option<String>' src-tauri/src/biz/product_service.rs` → `1`（`ImportRow` の structural anchor、baseline 1 実測）+ stock_unit の 2 境界 regression = (i) missing/空文字 CSV 行 → INSERT 時 `"pcs"` デフォルト化（既存挙動）(ii) 非空不正値（例 `"kg"`）CSV 行 → commit が DB CHECK で拒否される（新設 regression test — 既存挙動の固定であり挙動変更ではない） | `ImportRow` が enum 化され file 不正値の扱いが変わる、または stock_unit の missing/不正の境界が変わる | Y11: `ImportRow.tax_rate` を一時的に `ProductTaxRate` へ変更し file 経路 test red を確認し復元 + stock_unit の非空不正値 regression の期待を「pcs デフォルト化」へ差し替えて red を確認し復元（境界の実効性実証） |
| F12 | G12 | source contract（negative） | `rg -c 'pub reason: String' src-tauri/src/biz/inventory_service/disposal.rs` 系 anchor で `DisposalItemInput.reason` の String 維持を確認（実装時に正確な field 行 anchor を固定）+ 44 §23.7 の禁止行が現在形化後も残存 | 自由記述 reason が enum 化される | 該当なし（review-only。Non-scope の保護は diff 検査 + Final Review の突合で担保） |

（Matrix ID 対応: Packet Matrix F1〜F12 = 本 Matrix F1〜F12）

## State Lifecycle Matrix

not applicable — 本 PR は wire 型強化のみで、業務記録の作成・棚卸し・CSV import・売上集計の状態遷移を一切変更しない。利用者可視の state lifecycle が不変であることは F4（direction 別 wire oracle）/ F5（REQ-303 regression）/ F11（file 経路 negative）+ 既存 test 全量 pass で検証する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `SalesReportType`（request 直受け、Serialize + Deserialize + rename_all） | `biz/sales_service.rs:135-143` | request を運ぶ family (2)(3)(4)(5)(9)(10)(11)(13)(14) | — | F4 round-trip |
| PR1 `CmdErrorKind`（response-only、Deserialize なし） | `cmd/mod.rs` | response-only family (6)(7)(8)(12) | Deserialize 追加は存在しない round-trip の偽装のため不採用（PR1-D1 先例） | F1 + `cargo build` |
| `MovementType` の enum + `as_str()` パターン | `db/inventory_repo.rs:17-36, 41-60` | (11)(12) へ derive 追加（`as_str()` は DB 書込み用に維持） | `as_str()` 撤去は DB 書込み経路の書き換え波及が大きく、parity test 常設で drift 防御する方を採る（SPEC-P41-PR2-D7） | F7 parity test |
| 既 generated enum（`DailyReportDuplicateStatus` 等、rename_all なし PascalCase） | `biz/daily_report_import_service/mod.rs:97-101` / `io/daily_report_parser.rs:15-19` | 対象なし | wire 値の改名になるため是正しない（design packet で凍結済みの対象外） | diff 検査（非接触） |
| file 由来経路の validation guard（tax_rate） | `product_service.rs:692-695`（値域チェック実在）/ `699-702`（stock_unit は存在確認のみ） | 変更なし（維持） | stock_unit への guard 新設は挙動変更のため non-scope（SPEC-P41-PR2-D3、backlog 候補） | F11 negative |
| `New*` / DB・IO 層 struct の String 維持 + canonical 関数経由の明示変換（family (11)(12) の `as_str()` パターン） | `NewReturnRecord` / `NewReturnItem` / `NewDisposalItem` / `NewManualSale` / `NewProduct` / `ProductUpdates` / `NewCsvImport` / `PluExportRow` の構築 site（Scope D8 (c) 列挙） | family (2)(3)(4)(5)(7)(13)(14) へ水平適用 | DB/IO 層 struct 自体の enum 化は D-061 (c) の層境界（TEXT + CHECK 不変、file format 不変）に反するため不採用 | `cargo build` + F7 parity（round 3 P1-2 / round 5 P1-1・P1-2） |
| URL search 層の有限集合（P4-2 scope） | `src/features/stock-movements/types.ts:8-41` / `monthly-sales/types.ts:56` | 対象なし | 監査 P4-2 の別 scope。`useStockMovements.ts:47` は wire 側型整合のみ | F10 diff 検査 |
| `InventoryRecordQuery.record_type` の独自値集合（65 §65.4 所有、`disposal_repo.rs:44` doc comment が正典明示） | `db/disposal_repo.rs:246-276`（4 値の独立定数配列）/ `biz/inventory_service/list.rs` の REQ-206 validation | 対象なし | P4-1 監査対象外（audit findings に record_type 言及 0 hit を実測）。csv_import / stocktake は 65 §65.7.1 の別 command へ分離済みで、値集合（4 値）が `ReferenceType`（6 値）と異なるため統合不可（round 1 P3-1 の明示除外、round 2 P2 で引用節を §65.4 へ訂正） | diff 検査（非接触） |

## Negative Paths

- missing input: family (11) の filter 省略 / `null` → None 相当で全件クエリ（現行挙動維持、Probe で実測）
- invalid input: request 側 enum family の不正 literal → serde deserialize 拒否（shape は Contract Probe 実測の tauri 生 String）。生 String rejection は `typedError` → `unwrapResult`/`toCmdError` → internal `InvokeError` に正規化され、`StockMovementsPage` は固定 Alert を表示する（round C-2/C-3 P2-1）。F4 unit test で正規化を固定。UI 固定操作からは到達不能
- duplicate/ambiguous input: 冪等キー（manual_sale / returns / disposal の 3 domain）は fingerprint 不変（F6）で既存挙動維持
- unknown reference: DB 読出しの reference_type 不明値 → None（REQ-303、F5）。movement_type 不明値 → internal（CHECK により実質到達不能）
- dependency missing: `cargo run --bin generate_bindings` 失敗時は commit しない
- permission/write failure: not applicable
- dry-run side effect: not applicable

## Boundary Checks

- threshold: not applicable（enum 値は離散的）
- null/default: `MovementQuery.movement_type: Option<MovementType>` / `MovementRecord.reference_type: Option<ReferenceType>` / `ProductUpdateRequest.tax_rate: Option<ProductTaxRate>` の Option 挙動は現行 `Option<String>` と同形（Probe + F4）
- empty/non-empty: `ImportRow.stock_unit` の empty→None→pcs デフォルト化は不変（F11）
- status/policy enum: 各 family の値集合は現状凍結（追加・削除なし）
- wire type: 対象 DTO の field 構造は不変（型のみ強化）
- internal type: 新設 9 enum + 既存 4 enum（variant 追加なし。round C-1 P2-3）
- producer/consumer: Rust enum（SSOT）→ bindings literal union → frontend features
- round-trip token: request family = 双方向 / response-only family = serialize のみ
- precision/range: 変更なし
- cross-language parse: 全 family の generated literal union が Rust variant と 1:1 一致（bindings 再生成 + F4 で確認）

## Compatibility Checks

- old schema/input: DB の TEXT + CHECK は不変。既存 DB データの読出しは明示 match 変換で現行値全対応（F5）
- new schema/input: 該当なし（新規 field なし）
- output order: 該当なし
- optional field behavior: Option field の null/省略挙動は Probe で現行一致を実測

## Data Safety Checks

- source-derived data: なし（実店舗データ非接触、synthetic fixture のみ）
- generated outputs: `src/lib/bindings.ts` のみ（型強化 diff が期待値）
- secrets: 非接触
- local-only files: なし
- synthetic sample boundaries: 既存 test の synthetic データパターンを維持

## Main Wiring / Integration Checks

- helper connected to main path: 各 enum が実 `#[tauri::command]` 関数のシグネチャ / DTO 経由で到達可能（既存 production CMD test + F4）
- output reaches manifest/report: CSV export の表示変換（`translate_source` 等）は enum match 化後も同一出力（既存 test regression）
- effective config reaches runtime: not applicable
- CLI arg reaches implementation: not applicable
- `lib.rs` の `collect_commands!` 登録は変更しない（command 個数不変）ことを既存 registration 経路の回帰で確認

## Mutation-style Adequacy Questions

- いずれかの enum から 1 variant を削除したとき、参照 production コード / round-trip test / frontend exhaustive 検査のいずれかが必ず fail するか
- `rename_all` / explicit rename を 1 箇所崩したとき、bindings diff と round-trip test の両方で検知されるか（Y1/Y2）
- reference_type の REQ-303 fallback を internal 化したとき、移設後の新設 REQ-303 test が確実に red になるか（Y5）
- fingerprint 入力の表現を変えたとき、3 domain それぞれの固定値 test が red になるか（Y6 — 型検査で守られない class のため mutation 必須）
- mock drift の再注入が型検査で機械的に阻止されるか（Y10 — D-061 の本来目的）
- baseline 全量 mutation 後の oracle-only 修正は、変更 family の代表 mutation だけを再測定し、PR1 済みの CmdErrorKind 系や無変更層（mnt）の全量再実行を始めないか

## Residual Test Gaps

- serde 拒否の error shape は Tauri invoke 層の実装詳細に依存する（Contract Probe で実測固定するが、Tauri version 更新時は再検証が必要）
- `as_str()` × serde parity は test 常設で防御するが、第三の文字列表現（例: 将来の Display 実装）が追加された場合は parity test の拡張が必要
- 生成 literal union の出力順序は固定契約にしない（値集合の等価性のみ。PR1 と同判断）
- stock_unit file 経路の値域 guard 欠落は本 PR で是正しない（SPEC-P41-PR2-D3、backlog 候補として Plans.md に記録）
