# Plan Packet: 有限 IPC 値の generated enum contract 化 実装 PR2（domain family (2)〜(14)、監査是正 順14 最終単位）

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Claude (Fable 5, main session)
- Writer: Codex (GPT-5.6, owner relay)
- Plan Reviewer: independent Claude subagent (Sonnet 5)
- Final Reviewer: independent Claude subagent (Sonnet 5)
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending

Narrative（append-only）:

- 2026-08-02 kickoff -> plan-draft: design PR（D-061、packet `2026-07-31-finite-ipc-enum-design`、archive 済み）が凍結した SPEC-P41-D1〜D5 のうち、PR2 = domain family (2)〜(14) を実装する。PR1（CmdErrorKind、PR #52 squash merge `2a1777e`）は完了済み。本 Packet は plan-draft であり production 実装は未着手。現況実測は read-only Explore subagent 2 本（backend / frontend+docs）+ Coordinator の baseline 実測で実施し、以下を確認した:
  - PR1 rally round 1 P2-2 の凍結義務（family (11) nullable filter probe の転記）を本 packet の Contract Probe / Ledger へ転記した
  - design packet が実装 PR1 の Contract Probe へ委譲した「不正値拒否の wire shape 実測」（D-061 (b)）は、PR1 が response-only family のため対象外と宣言した。request 側 enum を初めて持つ本 PR2 が probe 義務を負う
  - 実測による design 前提との差分 4 点（本 packet の SPEC-P41-PR2-D2〜D4 で吸収）: (α) `ImportRow` は file 由来 DTO だが `preview_import` response / `commit_import` request として wire も通過する（`cmd/product_cmd.rs:119-122, 143-147`）。(β) stock_unit の file 由来経路には値域チェックが実在しない（`product_service.rs:699-702` は存在確認 + `commit_import` 時 `"pcs"` デフォルト化 `product_service.rs:859` のみ。tax_rate の `692-695` と非対称）。(γ) `resolve_movement_source()`（`biz/inventory_service/list.rs:236-244`）の `_ => return None` は legacy/corrupt reference_type 行を落とさない意図的挙動で REQ-303 test（`list.rs:473`）に守られている。(δ) `MovementRecord` の DB 読出しは enum を経由しない生 String 素通し（`db/inventory_repo.rs:288-296` 付近）で、「明示 match」変換は現存しない
  - 手動販売 `reason` は冪等キー fingerprint の入力に連結される（`biz/inventory_service/manual_sale.rs:100`）— enum 化で fingerprint 入力文字列が変わると冪等性が壊れるため不変条件に昇格（SPEC-P41-PR2-D6）
  - frontend 手動 type alias は 7 個（`ReturnExchangeType` / `ReturnDirection` / `DisposalType` / `ManualSaleReason` / `ExportMode` / `ProductTaxRate` / `ProductStockUnit`）。family (10) SalesMode のみ frontend は既に bindings 由来型を再利用済みで置換不要（Rust request 方向の Deserialize 追加と CMD signature 変更のみ）
  - test mock のサイレント drift 3 箇所を実測確認: `OtherRecordDetailPages.test.tsx:146`（`movement_type: "manual_sale"`、正値は `sale_manual`）、`MovementTable.test.tsx:14`（`reference_type: "receiving"`、正値は `receiving_record`）、`StockMovementsPage.test.tsx:65`（`reference_type: "disposal"`、正値は `disposal_record`）。いずれも assertion は値そのものを検査せず現状素通し — 型強化の本来目的（PR1 の PascalCase drift と同型）
  - docs の future-state 注記は function-design 14 file 19 箇所 + `DB_DESIGN.md:90`（境界的、軽微）。`rg "順14 実装 PR2" docs/function-design/` の機械 token は 14 hit

## Owner Effort Budget

- 介入回数上限: 4
- 実働時間上限: 30分
- relay 往復上限: 3

既定値（3/30分/2）に対し、Codex owner-relay 実装 + Sonnet 独立 Plan Review + Final Review を見込み、介入・relay を各 1 回上乗せする（順12 実装 / 順14 PR1 の実績構成を踏襲）。
既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
13 family の Tauri command DTO（request / response）を横断的に型強化し、`bindings.ts` 生成物と frontend の手動 union 7 alias + 定数 + 分岐に波及する（DEV_WORKFLOW.md Risk Tiers「Tauri command DTO」該当）。返品・廃棄・手動販売・棚卸し隣接の業務記録系 wire を触るが、値・wire 表現・分岐・表示文言・冪等 fingerprint は一切変更しない（型のみ強化）。restore 系（data-safety 隣接）は PR1 で完了済みで本 PR は触れない。

Rollback は本 PR の実装 commit revert。wire 文字列・分岐・冪等意味論は不変のため、revert 時の追加復旧作業は不要。

## Goal

Goal Invariant: domain family (2)〜(14) の有限 IPC 値が「Rust enum SSOT の generated literal union」で型検査され、frontend の手動 union 7 alias・手動定数・test mock のサイレント drift 3 箇所が退役し、片側 variant 変更が typecheck で検出される。値・wire 表現・分岐・表示文言・冪等 fingerprint・利用者可視挙動は一切変更しない。本 PR の merge により監査是正（順1〜順22）の全単位が完了する。

### 最小完了条件

- family (2)〜(14) の各値が Rust enum（既存 enum への derive 追加 or 新設）経由で `bindings.ts` に literal union として生成され、該当 DTO field / command 引数が `string` から enum 型へ強化されている
- 手動 parse 2 site（`parse_export_mode` / `sales_cmd.rs` の mode 手動 match）が廃止され、request 側不正値は serde deserialize 拒否へ統一されている（D-061 (b) 実装）
- frontend 手動 type alias 7 個が bindings 由来型（import / 派生）へ置換され、mock drift 3 箇所が是正されている
- `compute-summary.ts` の source 分岐が switch + never 網羅性チェックへ移行し、D-10 code comment が退役している（56 §56.2 の凍結方針）
- function-design 14 file 19 箇所の future-state 注記が現在形化されている
- `cargo test` / `npx tsc --noEmit` / `npm test` / architecture / design compliance / local-ci full が全 pass

### 失敗定義

- wire 表現（正常値の snake_case 文字列、ProductTaxRate の `"10"|"8"|"0"` を含む）が現行と 1 文字でも異なる
- 廃棄の自由記述 `reason` field（`DisposalItemInput.reason`）を enum 化する（44 §23.7 / design Final Review P1 の明示禁止）
- `ImportRow.tax_rate` / `ImportRow.stock_unit` を enum 化し、file 由来不正値が error row 契約（32 §15）でなく serde 拒否になる
- REQ-303（legacy/corrupt reference_type 行を落とさず source なし表示）の挙動が変わる
- 冪等 fingerprint（returns / disposal / manual_sale の 3 domain — round 4 P1-2 で拡張）の入力文字列が変わる
- URL search 層（監査 P4-2 scope、`stock-movements/types.ts` の `MOVEMENT_TYPE_OPTIONS` / `stockMovementsSearchSchema` 等）のコード変更に踏み込む

### 非目的

- 新しい有限値の追加・改名（値集合は現状凍結のまま型だけ強化する）
- DB schema / CHECK 制約の変更
- URL search 系の有限集合（監査 P4-2 の scope。`useStockMovements.ts:47` の URL→wire 代入 site は wire 側型強化の影響で型検査対象になるが、URL 層の型・値・schema は変更しない）
- stock_unit の file 由来経路への値域 guard 新設（実測 (β) で欠落を確認したが、新設は「不正値行が pcs デフォルト化される」現行挙動をエラー化する挙動変更のため本 PR では行わない。30 の doc 記述を事実（非対称）へ是正し、guard 新設の要否は backlog 候補として Plans.md に記録する）
- `DailyReportDuplicateStatus` / `DailyReportSourceKind` / `DuplicateStatus` 等の既 generated enum（rename_all なし・PascalCase wire 値）の標準形への「是正」（値の改名 = wire 変更になるため対象外。design packet が「是正不要の先行事例」と凍結済み）
- 表示 label 統一等の任意の美化

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

### Rust（enum 新設 5 + 既存 enum derive 追加 4 + 適用）

enum 名は bindings.ts 生成型名になるため本 packet で凍結する（SPEC-P41-PR2-D1）:

| family | enum 名 | 定義位置 | 方向 | 備考 |
|---|---|---|---|---|
| (2) return_type | `ReturnExchangeType`（新設: Return/Exchange） | `biz/inventory_service/returns.rs` | 両方向 | TS 組込み utility `ReturnType` との名前衝突を避け frontend alias と同名にする |
| (3) direction | `ReturnDirection`（新設: In/Out） | 同上 | 両方向 | |
| (4) disposal_type | `DisposalType`（新設: Disposal/Damage/Other） | `biz/inventory_service/disposal.rs` | 両方向 | `item.reason`（自由記述）は触らない |
| (5) reason | `ManualSaleReason`（新設: PluUnregistered/Other） | `biz/inventory_service/manual_sale.rs` | 両方向 | fingerprint 不変（SPEC-P41-PR2-D6） |
| (6) source | `DailySaleSource`（新設: Auto/Manual） | `biz/sales_service.rs` | response-only | D-10 解消。`translate_source()` は enum match 化 |
| (7) status | `CsvImportStatus`（新設: Completed/CompletedPartial/RolledBack） | `db/sales_repo.rs`（`CsvImport` の所有層。MovementType 先例に従い DB 層定義 + BIZ 再利用で layer 方向を守る） | response-only | wire 露出 2 site（`ImportResult.status` / `CsvImport.status`）共有 |
| (8) error_type | `CsvImportErrorType`（新設: UnmatchedProduct/InvalidFormat/InvalidJan/InvalidNumber） | `biz/csv_import_service/` | response-only | IO `ParseErrorType` 3 variant + BIZ 1 値の合成、IO→wire は明示 match（32 §15） |
| (9) ExportMode | 既存（`biz/plu_export_service.rs:22-27`）へ derive 追加 | 既存位置 | request-only | `parse_export_mode` 廃止 |
| (10) SalesMode | 既存（`biz/sales_service.rs:19-27`）へ `serde::Deserialize` 追加 | 既存位置 | 両方向 | `get_monthly_sales(mode: SalesMode)` 直受け化、手動 match 廃止 |
| (11) movement_type | 既存 `MovementType`（`db/inventory_repo.rs:17-25`）へ derive 追加 | 既存位置 | 両方向（request filter は `Option`） | `MovementQuery.movement_type: Option<MovementType>` / `MovementRecord.movement_type: MovementType` |
| (12) reference_type | 既存 `ReferenceType`（`db/inventory_repo.rs:41-49`）へ derive 追加 | 既存位置 | response-only（`Option`） | REQ-303 fallback は SPEC-P41-PR2-D4 |
| (13) tax_rate | `ProductTaxRate`（新設: Rate10/Rate8/Rate0、**explicit `#[serde(rename = "10")]` 等**） | `biz/product_service.rs` | 両方向 | 数値文字列のため rename_all では導出不能（Contract Probe 対象） |
| (14) stock_unit | `ProductStockUnit`（新設: Pcs/Cm） | 同上 | 両方向（update request は field 自体なし） | |

- 適用対象 DTO / command: `ReturnCreateRequest` / `ReturnItemInput` / `ReturnRecordSummary` / `ReturnRecordDetail(Item)`、`DisposalItemInput` / `DisposalRecordDetailItem`、`ManualSaleCreateRequest` / `ManualSaleRecordDetail`、`DailySaleItem`、`ImportResult` / `CsvImport`、`ErrorRow`、`prepare_plu_export(mode)`、`get_monthly_sales(mode)`、`MovementQuery` / `MovementRecord`、`ProductCreateRequest` / `ProductUpdateRequest` / `Product`
- BIZ validation の置換: `returns.rs:79-99`（return_type / direction）、`disposal.rs:117-124`（disposal_type）、`manual_sale.rs:92-96`（reason）、`product_service.rs:463-466 / 515-518`（tax_rate / stock_unit の wire 経路）、**`list.rs:191-219`（`VALID_MOVEMENT_TYPES` const + movement_type 値域チェックの退役 — round 2 P2）**の値域チェックは request 型が enum になることで型検査へ移行し、validation 文言（「不正な変動種別です」を含む）は wire 契約から退役（D-061 (b)。file 由来経路 `692-702` は現状のまま維持 — SPEC-P41-PR2-D2/D3）。付随する test 処遇（round 2 P2）: `test_list_movements_req303_invalid_movement_type`（`list.rs:385-404`）は無効値が `Option<MovementType>` で型的に構築不能となるため、担う契約を family (11) 不正 literal の serde 拒否 test（Matrix F4 / Contract Probe (iii)）へ**移設**する（削除ではない）。`test_list_movements_req303_valid_movement_type`（`list.rs:406-421`）は enum literal（`Some(MovementType::Receiving)`）へ書き換えて存続
- DB 読出し変換の新設: `MovementRecord` 生成時の movement_type = 明示 match（不明値は internal、D-061 (c)、CHECK により実質到達不能）、reference_type = 明示 match + REQ-303 契約 fallback（不明値→None、SPEC-P41-PR2-D4）。`resolve_movement_source()` の入力は `Option<ReferenceType>` へ揃え、**6 variant の網羅 match とし wildcard は置かない**（網羅後の `_` は unreachable_patterns で clippy -D warnings に抵触）。REQ-303 の legacy 許容は DB 読出し変換（TEXT → `Option<ReferenceType>`、不明値→None）が担い、これを検証する新設 unit test を追加する。`list.rs` の既存 REQ-303 legacy 文字列 test（`test_resolve_movement_source_req303_unknown_reference`）は担う契約ごとこの新設 test へ**移設**する（削除ではない — 移設先と契約の対応を Matrix F5 が固定。round 1 P2-1）。NULL reference 系の既存 REQ-303 test（`list.rs:466-468`）は enum literal への書き換え（`list.rs:468` の `Some("receiving_record".to_string())` → `Some(ReferenceType::ReceivingRecord)`）を伴い契約不変のまま存続する（round 2 P3 で精緻化）
- `CsvImportStatus` / `CsvImportErrorType` の構築 site 置換: `commit.rs:134, 198` / `rollback.rs:28, 54` / `parse.rs:104, 135-141` + 既存 test の書き換え（round 2 P3、round 3 P2 で内訳分離）: wire assertion 8 箇所 = `tests/commit_tests.rs:45,79,102,208,241,274`（`ImportResult.status` 比較）+ `tests/parse_tests.rs` 2 hit（`ErrorRow.error_type` 比較）は enum literal へ書き換え。**DB INSERT fixture 4 箇所 = `commit_tests.rs:129,171,329` / `list_tests.rs:23`（`NewCsvImport.status: String` 構築）は SPEC-P41-PR2-D8 (b) により書き換え不要**
- **型変更波及の処遇（SPEC-P41-PR2-D8、round 3 P1 の実測列挙）**:
  - (a) 無効値 test の F4 移設対象: `returns.rs:511-520`（invalid return_type）/ `returns.rs:522-531`（invalid direction）/ `disposal.rs:395-406`（invalid disposal_type）/ `manual_sale.rs:561-570`（invalid reason）/ `product_service.rs:1186-1193`（tax_rate `"15"`）/ `product_service.rs:1197-1204`（stock_unit `"kg"`）/ `plu_export_cmd.rs:196-215`（`parse_export_mode` 直呼び 3 test — 関数退役と同時に移設）/ `sales_cmd.rs:136-158`（invalid mode 5 値 + 「不正な集計モードです」文言 assert — 文言退役と同時に移設）。valid 側 literal test（`sales_cmd.rs:160-184` 等）は enum literal へ書き換え
  - (c) DB 書込み site の明示変換: `returns.rs:196, 587`（`NewReturnRecord.return_type`）/ `returns.rs:238`（`NewReturnItem.direction`）/ `disposal.rs:180`（`NewDisposalItem.disposal_type`）/ `manual_sale.rs:206`（`NewManualSale.reason`）/ `product_service.rs:170, 173, 300`（`NewProduct` / `ProductUpdates` の tax_rate / stock_unit）/ **`plu_export_service.rs:149`（`PluExportRow.tax_rate` ← `Product.tax_rate`。`io/plu_formatter.rs:293-303` の `map_tax_rate` = Casio レジスター税区分決定へ接続する IO 層 site — round 5 P1-2。canonical 関数を再利用し、既存 `map_tax_rate` 全 variant test（`plu_formatter.rs:822` 付近、実在確認済み）で regression 担保）**— `New*` / IO struct 側の型は String 維持（round 4 P2 で 3 site 追加）。**ほか、Writer の rg 全数 sweep で同 class を同処遇**（(b) と同じヘッジ。型不一致は compile が捕捉するため列挙は変換一貫性レビューの参照用）
  - (d) DB 読出し site の明示 match: `return_repo.rs:166`（return_type）/ `return_repo.rs:238`（direction）/ `disposal_repo.rs:516`（disposal_type）/ `manual_sale_repo.rs:117-125`（destructure）と `:188`（構築）の reason 経路 / `product_repo.rs:195, 198`（tax_rate / stock_unit）/ `sales_service.rs:179`（source）— (11)(12) の `inventory_repo.rs` 読出しと同列（round 4 P3 で citation 精緻化）
  - (f) fingerprint 埋め込み site: `returns.rs:149-151`（return_type）/ `returns.rs:156` + test 複製 `:581`（direction）/ `disposal.rs:72-75`（disposal_type。同行の `i.reason` は自由記述 String 維持で対象外）/ `manual_sale.rs:100`（reason）— SPEC-P41-PR2-D6 の wire 同一 bit 列維持（round 4 P1-2）
  - (b) wire assert の enum literal 書き換え: `return_repo.rs:509`（`detail.return_type == "exchange"`）/ `return_repo.rs:519`（`items[0].direction == "in"`）ほか、Writer の rg 全数 sweep で同 class を同処遇
- `bindings.ts` 再生成（`cd src-tauri && cargo run --bin generate_bindings`）

### Frontend

- 手動 type alias 7 個を bindings 由来型へ置換: `return-exchange/types.ts:4-5`、`disposal/types.ts:3`、`manual-sale/types.ts:3`、`products/lib/product-form-request.ts:12-13`、`plu-export/PluExportPage.tsx:20`（互換 alias 名の維持は可、literal 直書き宣言の退役が条件）
- `compute-summary.ts:14-17`: D-10 comment 退役 + if-else → switch + never 網羅性チェック（56 §56.2 の凍結方針）
- `movement-formatters.ts:5-16`: `movementTypeLabels` を `Record<MovementType, string>`（exhaustive）へ、`formatMovementType` 入力を enum 型へ
- `ResultStep.tsx:33` / `formatErrorRow.ts:18-29` 等の literal 比較は生成 union で型検査される（値・分岐不変、書き換えは型が要求する範囲のみ）
- mock drift 3 箇所の是正: `OtherRecordDetailPages.test.tsx:146` → `sale_manual`、`MovementTable.test.tsx:14` → `receiving_record`、`StockMovementsPage.test.tsx:65` → `disposal_record`
- `useStockMovements.ts:47`（URL→wire 境界）: wire 側 `Option<MovementType>` 強化に伴う型整合のみ（URL 層の型・値は不変、P4-2 対象外の保護）

### Docs

- function-design 14 file 19 箇所の future-state 注記の現在形化（30 / 31×2 / 32×2 / 33 / 41 / 42×2 / 44×2 / 51 / 53 / 56×3 / 57 / 62 / 67。Narrative 実測の一覧どおり）+ `DB_DESIGN.md:90` の軽微是正
- **enum 化対象 DTO の field 型記述が stale になる doc の追随（round 2 P2、round 3 P1/P2 で全数へ拡張）**: 処遇は SPEC-P41-PR2-D8 (e) — wire DTO の行のみ現在形化し、`New*` / DB struct / 廃棄自由記述 reason の String 記述は維持する。実測列挙:
  - `21-io-inventory-repo.md`: wire DTO 行 = `:134, 146`（ReturnRecordSummary/Detail の return_type）/ `:152`（ReturnRecordDetailItem の direction）/ `:327`（DisposalRecordDetailItem の disposal_type）。**維持** = `:105`（NewReturnRecord）/ `:123`（NewReturnItem 系）/ `:171`（NewManualSale）/ `:239`（NewDisposalItem）— round 3 P2 で round 2 の一括 0 化 anchor の自己矛盾（正確な DB struct 記述の書き換え強制）を是正
  - `31-biz-inventory-service.md`: `:116, 125, 179, 244`（request DTO の return_type / direction / reason / disposal_type — 4 箇所とも wire、round 3 P2）
  - `44-cmd-inventory.md`: `:225, 308, 560`（return_type）/ `:234`（direction）/ `:401, 639`（disposal_type）/ `:340, 594`（手動販売 reason）— いずれも wire DTO 記述。**維持** = `:404, 642`（廃棄の自由記述 reason、44 §23.7 の enum 化禁止対象）
  - `58-ui-stock-inquiry.md`: `Product` 型記述の `tax_rate: string;` = `:49` / `stock_unit: string;` = `:52`
  - 45 / 73 / 74 / 23 / 24 は keyword 実測で該当なし（24 の reference_type 言及は SQL WHERE 句で型記述でない）。SPEC-P41-D5 (iv) の rg 全箇所 sweep を実装時に再実行して確定する
- `30-biz-product-service.md:49` の二層化記述を実測事実へ是正: 「d/e の validation を guard として維持」が stock_unit の file 経路値域チェックを含意しない非対称（実在するのは tax_rate のみ）と、`ImportRow` の DTO 境界（SPEC-P41-PR2-D2）を明記
- code comment sweep: `compute-summary.ts` D-10 comment、`db/inventory_repo.rs:5-7` の「21 では String だが」注記等、旧前提 comment の rg 全箇所追随（SPEC-P41-D5 (iv)）

## Non-scope

- 廃棄の自由記述 `reason`（`DisposalItemInput.reason`）の enum 化（44 §23.7 で禁止）
- `ImportRow.tax_rate` / `ImportRow.stock_unit` の enum 化（SPEC-P41-PR2-D2 で String 維持を凍結）
- stock_unit file 経路の値域 guard 新設（挙動変更のため。backlog 候補として記録のみ）
- URL search 層（P4-2）のコード変更
- `StocktakeProgressBiz.status` / 26-io の別種 error_type / `operation_type` / daily report 系 3 点（design packet の対象外リストどおり）
- `InventoryRecordQuery.record_type`（横断一覧 `listInventoryRecords` の request filter）: 値集合は 4 値（receiving_record / return_record / manual_sale / disposal_record、`db/disposal_repo.rs:246-276` の独立定数配列）で、正典は 65 §65.4（`disposal_repo.rs:44` の doc comment が明示。csv_import / stocktake は §65.7.1 の別 command `listCsvImportRecords` / `listStocktakeRecords` へ分離）。6 値の `ReferenceType` とは値集合自体が異なる別 SSOT で、監査 P4-1 / D-061 family 一覧の対象外（audit findings に record_type 言及 0 hit を実測。round 1 P3-1 で明示除外、round 2 P2 で引用節を §65.8.3 → §65.4 へ訂正 — §65.8.3 は操作ログの関連記録リンク（74 所有）という別契約）
- 既 generated enum（DailyReport 系 / `DuplicateStatus`）の rename_all 化・改名
- `src-tauri/src/mnt/` への変更
- `Plans.md` の active packet link 追加（Coordinator が plan-first commit で実施済み）

## Acceptance Criteria

- `rg -c '^export type (MovementType|ReferenceType|ProductTaxRate|ProductStockUnit|ReturnExchangeType|ReturnDirection|DisposalType|ManualSaleReason|DailySaleSource|CsvImportStatus|CsvImportErrorType|ExportMode)' src/lib/bindings.ts` → `12`（baseline 0 実測。SalesMode は既生成のため対象外、計 12 型）
- `rg -c 'fn parse_export_mode' src-tauri/src/cmd/plu_export_cmd.rs` → `0`（baseline 1 実測）
- `rg -c '"by_product" => SalesMode::ByProduct' src-tauri/src/cmd/sales_cmd.rs` → `0`（baseline 1 実測、`sales_cmd.rs:58`）
- `rg -c 'literal union 化は将来 D-10' src/features/daily-sales/lib/compute-summary.ts` → `0`（baseline 1 実測、`compute-summary.ts:14`）
- `rg -c '= "return" \| "exchange"' src/features/return-exchange/types.ts` → `0`（baseline 1 実測）、`rg -c '= "in" \| "out"' src/features/return-exchange/types.ts` → `0`（baseline 1 実測）、`rg -c '= "disposal" \| "damage" \| "other"' src/features/disposal/types.ts` → `0`（baseline 1 実測）、`rg -c '= "plu_unregistered" \| "other"' src/features/manual-sale/types.ts` → `0`（baseline 1 実測）、`rg -c '= "10" \| "8" \| "0"' src/features/products/lib/product-form-request.ts` → `0`（baseline 1 実測）、`rg -c '= "pcs" \| "cm"' src/features/products/lib/product-form-request.ts` → `0`（baseline 1 実測）、`rg -c 'type ExportMode = "diff" \| "full"' src/features/plu-export/PluExportPage.tsx` → `0`（baseline 1 実測）
- `rg -c 'movement_type: "manual_sale"' src/features/inventory-records/OtherRecordDetailPages.test.tsx` → `0`（baseline 1 実測）、`rg -c 'reference_type: "receiving",' src/features/stock-movements/components/MovementTable.test.tsx` → `0`（baseline 1 実測）、`rg -c 'reference_type: "disposal",' src/features/stock-movements/StockMovementsPage.test.tsx` → `0`（baseline 1 実測）
- `rg "順14 実装 PR2" docs/function-design/ | wc -l` → `0`（baseline 14 実測）
- doc の stale 型記述追随（round 2 P2、round 3 P2 で anchor を wire DTO 行限定へ是正 — `New*` / 廃棄 reason の正確な String 記述を巻き込まない）: `rg -c ', return_type: String,' docs/function-design/21-io-inventory-repo.md` → `0`（baseline 2 実測 = `:134,146`。`:105` NewReturnRecord は維持）、`rg -c '^- disposal_type: String$' docs/function-design/21-io-inventory-repo.md` → `0`（baseline 1 実測 = `:327`。`:239` NewDisposalItem は維持）、`rg -c 'direction: String, quantity' docs/function-design/21-io-inventory-repo.md` → `0`（baseline 1 実測 = `:152`）、`rg -c ', reason: String,' docs/function-design/21-io-inventory-repo.md` → `0`（baseline 1 実測 = `:199` ManualSaleRecordDetail の wire 行。round 4 P1-1。44 の `- reason: String` 形とは書式が異なり衝突しない）、`rg -c ': String（"' docs/function-design/31-biz-inventory-service.md` → `0`（baseline 4 実測）、`rg -c 'return_type: String' docs/function-design/44-cmd-inventory.md` → `0`（baseline 3 実測）、`rg -c 'direction: String' docs/function-design/44-cmd-inventory.md` → `0`（baseline 1 実測）、`rg -c 'disposal_type: String' docs/function-design/44-cmd-inventory.md` → `0`（baseline 2 実測）、`rg -c 'tax_rate: string;' docs/function-design/58-ui-stock-inquiry.md` → `0`（baseline 1 実測）、`rg -c 'stock_unit: string;' docs/function-design/58-ui-stock-inquiry.md` → `0`（baseline 1 実測）。44 の手動販売 reason `:594`（plain form で廃棄 reason と pattern 弁別不能）は anchor 対象外とし、SPEC-P41-PR2-D8 (e) の sweep + F9 独立レビューで担保（`:340` は `rg -c 'reason: String,               // "plu_unregistered"' docs/function-design/44-cmd-inventory.md` → `0`、baseline 1 実測）
- `rg -c "enum 型に置換される" docs/function-design/31-biz-inventory-service.md` → `0`（baseline 2 実測）、`rg -c "それまでの現行実装は" docs/function-design/42-cmd-sales-stocktake.md docs/function-design/44-cmd-inventory.md` → 各 `0`（baseline 42=1 / 44=2 実測）
- `cargo build` / `cargo test`（src-tauri 全体、既存 test 件数以上・削除 skip なし）/ `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test --test architecture_test` / `cargo test --test design_compliance_test` PASS
- `npx tsc --noEmit` / `npm test` / `bash scripts/doc-consistency-check.sh`（full + `--target plan`）/ `bash scripts/local-ci.sh full` PASS
- `git diff --stat main...HEAD` に `src-tauri/src/mnt/` が現れない
- bindings 再生成 diff が「対象 field の型強化 + 12 型の新規 export（+ `getMonthlySales` / `preparePluExport` シグネチャの enum 化）」のみであることを Review Focus で確認する
- Matrix F1〜F12 の mutation 全量（Y1〜Y11）を Coordinator が `cargo test` / `npx tsc --noEmit` / bindings 再生成で独立再実測し、各 red、復元後 green、survivor 0

## Design Sources

- Requirements / spec: `docs/research/audit-2026-07/report.md` 順14 / `findings/p4-type-contracts.md` P4-1
- Architecture: `docs/ARCHITECTURE.md`（wire 型変換の CMD 境界規定、D-060 層境界）
- Function / command / DTO: 30 §49 相当節 / 31 §12.4・§12.6 / 32 §15 / 33 §16.2 / 34（SalesMode/SalesReportType）/ 40 §5.3（PR1 済み、参照のみ）/ 41 §17.6 / 42 §22.5 / 44 §23.5-23.7・list_movements 節 / 51 / 53 / 55 / 56 §56.2 / 57 / 58（enum 化 DTO の型記述追随 — round 2 P2）/ 62 §62.4 / 67 §67.8 / 21（enum 化 DTO の型記述追随 — round 2 P2）・23・24（23・24 は参照のみ、実装時 rg で最終確認）/ 65 §65.4・§65.7.1（record_type 除外の正典、参照のみ）
- DB: `docs/DB_DESIGN.md` CHECK 制約方針（TEXT + CHECK 不変）、`transaction-tables.md` / `pos-tables.md`（値集合の理由所有元）
- Decision log / ADR: D-053 / D-060 / D-061（実装対象の凍結契約）
- 生成基盤: `src-tauri/src/lib.rs` `export_specta_bindings()` / `docs/UI_TECH_STACK.md` §2.5
- 実装先例: 順14 PR1 packet（`archive/plans/2026-07-31-finite-ipc-enum-impl-pr1.md`、derive 方向別判断・mutation 実測の型）、`SalesReportType`（request 直受け）/ `SalesMode`（response 直出し）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 31 / 32 / 33 / 30 / 44 / 42 / 41 の対象 §（現在形化） | updated in this PR |
| Command / DTO / generated binding / wire shape | 同上 + 51 / 53 / 56 / 57 / 62 / 67 | updated in this PR（値・分岐は不変、現在形化 + 30 の非対称是正） |
| DB / transaction / audit / rollback / migration | 変更なし（TEXT + CHECK 不変） | existing sufficient |
| Screen / UI / route state / Japanese wording | 不変（表示文言・分岐は変更しない） | existing sufficient |
| CSV / TSV / report / import / export format | 変更なし（ImportRow は String 維持、error row 契約不変） | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` D-061（既存、本 PR は実装のみ） | existing sufficient |
| Process（active packet link / backlog 記録） | `Plans.md` | Coordinator が plan-first commit / closeout で実施 |

## Registration / Generation Obligations

該当なし。本 PR は新規 command / 新規 doc file / 新規 route を追加しない（既存 DTO field / command 引数の型強化のみ）。`bindings.ts` は再生成するが `collect_commands!` 登録の変更はない。REQ 追加もないため traceability 再生成は不要（変更が生じた場合は `cargo run --bin generate_traceability` を実行し diff を確認する）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| 監査 P4-1（domain family 群） | D-061 (a)(e) / 各 family 所有 doc | SPEC-P41-PR2-D1 | enum 名・定義位置・方向別 derive を凍結（表参照）。`ReturnType` 名は TS 組込み utility との衝突で棄却。`ProductTaxRate` は数値文字列のため explicit serde rename（rename_all 導出不能）。response-only family は Deserialize を derive しない（PR1-D1 先例: 存在しない round-trip を偽装しない） | 全 family | Matrix F1, F2, F4 |
| 実装固有（実測 α） | 30 二層化記述 / 32 §15 | SPEC-P41-PR2-D2 | (13)(14) の enum 適用境界は `ProductCreateRequest` / `ProductUpdateRequest` / `Product` の 3 DTO。`ImportRow` は wire を通過する file 由来 DTO のため String 維持 — enum 化すると file 不正値が error row 契約でなく serde 拒否になり利用者可視挙動が変わるため棄却 | `product_service.rs` | Matrix F11 |
| 実装固有（実測 β） | 30 二層化記述 | SPEC-P41-PR2-D3 | stock_unit の file 経路 guard は実在しない（存在確認 + pcs デフォルト化のみ）。guard 新設は挙動変更のため非目的とし、30 の記述を事実（tax_rate のみ値域チェック実在）へ是正、新設要否は backlog 候補 | 30 doc + Plans.md | Matrix F9（doc anchor） |
| 実装固有（実測 γ・δ） | 44 list_movements 節 / D-061 (c) / REQ-303 | SPEC-P41-PR2-D4 | DB 読出し変換を新設: movement_type 不明値 = 明示 match で internal（CHECK により実質到達不能）。reference_type 不明値 = None（REQ-303 の既存契約 fallback。D-061 (c) の catch-all 禁止に対する文書化された契約的例外であり、silent catch-all ではない — test `list.rs:473` が根拠。同 test は実装時に DB 読出し変換 site の新設 test へ契約ごと移設する — round 1 P2-1、Scope 参照）。REQ-303 を internal 化する案は legacy 行で一覧全体が落ちる機能退行のため棄却 | `db/inventory_repo.rs` / `biz/inventory_service/list.rs` | Matrix F5 |
| D-061 (b) 実装 | 41 §17.6 / 42 §22.5・§125 相当節 | SPEC-P41-PR2-D5 | 手動 parse 2 site（`parse_export_mode` / sales mode match）を廃止し serde 拒否へ統一。validation 文言（「書出しモードは…」「不正な集計モードです」）は wire 契約から退役（UI 固定操作から到達不能、D-061 (b) で凍結済み）。wire shape は Contract Probe で実測 | `plu_export_cmd.rs` / `sales_cmd.rs` | Matrix F3, F4 |
| 実装固有（fingerprint、round 4 P1-2 で 3 domain へ拡張） | 44 §23.5-23.7 / 冪等契約 | SPEC-P41-PR2-D6 / D8 (f) | 冪等 fingerprint への埋め込み値（manual_sale reason / returns return_type・direction / disposal disposal_type）は enum 化後も wire 文字列と同一 bit 列を維持する。Debug 形式等の別表現を流す実装は冪等キーの互換破壊のため禁止 — 型検査で守られない唯一の class のため 3 domain 固定値 test + mutation で防御 | `manual_sale.rs` / `returns.rs` / `disposal.rs` | Matrix F6 |
| D-061 (a) 併存 SSOT | 21 / 44 | SPEC-P41-PR2-D7 | (11)(12) は既存 `as_str()`（DB 書込み用）と serde rename が文字列表現を二重所有する。DB 層 TEXT 書込みは `as_str()` 維持（D-061 (c) の層境界）とし、全 variant で `as_str()` == serde 出力の parity test を常設して drift を機械防御する | `db/inventory_repo.rs` | Matrix F7 |
| D-061 (d) 隣接 / D-10 | 56 §56.2 / 53 | D-061 (e) | `compute-summary.ts` を switch + never 網羅へ、D-10 comment 退役（56 の凍結方針どおり） | `compute-summary.ts` | Matrix F8 |
| 実装固有（round 3 P1 の一般化、round 4/5 で 6 class 化） | D-061 (c) / test-quality 削除禁止規範 | SPEC-P41-PR2-D8 | 型変更波及を 6 class（(a) 無効値 test 移設 / (b) 正値 literal 書き換え / (c) DB・IO write 変換 / (d) DB read 明示 match / (e) doc の wire 行限定更新 / (f) fingerprint 等の非 wire 埋め込み）で処遇し rg 全数 sweep を義務化。site を列挙し尽くす方式は round 1〜3 で 3 回連続の列挙漏れを生んだため、class 原則 + 実測列挙 + sweep の三層へ転換 | Scope の実測列挙 + Writer sweep | Matrix F4, F5, F6, F9, F11 + `cargo build` |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: D-061（共通 pattern + family 一覧 + 境界規則）+ 各所有 doc の現在形化で完結する
- Plan-only durable decisions promoted: なし。D-061 は確定済み。SPEC-P41-PR2-D1〜D7 は実装の内部詳細（ただし D2/D3 の DTO 境界・非対称事実は 30 の doc 是正として正本へ反映する）
- Assumptions and constraints: specta が explicit `#[serde(rename = "...")]` を literal union へ反映すること（Contract Probe で実証してから本実装）。`Option<Enum>` の serde deserialize 挙動（null / 省略 / 不正 literal）は Contract Probe で実測
- Deferred design gaps: stock_unit file guard 新設の要否（backlog 候補、Plans.md 記録）
- Test Design Matrix can cite design decision IDs: D-061 (a)-(e) / SPEC-P41-PR2-D1〜D7
- Absolute guarantee / escape hatch self-check: 絶対保証は新設しない。REQ-303 の legacy fallback は既存契約の維持であり新設 escape hatch ではない

## Impact Review Lenses

not applicable — 監査起源の design PR（D-061）凍結契約を実装するコード PR。環境・再現性 lens: 新設の環境依存なし（Node 24 pin / Rust toolchain は既存 repo-pinned 構成のまま。PR1 で実証済みの mise exec 経路を Writer 指示に含める）。

## Design Readiness

- Existing design docs are sufficient because: D-061 + design packet が family 一覧・境界規則・標準形を凍結済み。本 packet は実測差分 4 点（α〜δ）と fingerprint 不変条件を実装詳細として吸収した
- Source docs updated in this PR: function-design 14 file の現在形化 + 30 の非対称是正 + DB_DESIGN.md 軽微是正
- Design gaps intentionally deferred: stock_unit file guard 新設の要否（backlog）
- Durable decisions discovered in this plan and promoted to source docs: 30 へ DTO 境界（D2）と guard 非対称（D3）を明記

Minimum design checks for business-app work:

- Layer ownership: enum 定義位置は値の所有層（BIZ 5 + DB 3 + 既存 BIZ 2）。DB 層 TEXT + CHECK 不変、`CsvImportStatus` は DB 層定義 + BIZ 再利用で依存方向を守る（architecture_test が gate）
- Backend function design: 各 family の構築 site / validation site は Scope の実測列挙どおり
- Command / DTO / data contract: 正常値 wire 表現不変、型のみ強化。bindings 再生成 diff は型強化 + 12 型 export のみ
- Persistence / transaction / audit impact: なし（DB 書込みは `as_str()` / TEXT のまま）
- Operator workflow / Japanese UI wording: 不変（validation 文言の退役経路は利用者到達不能）
- Error, empty, retry, and recovery behavior: 値・分岐不変。REQ-303 fallback 維持。冪等 fingerprint 不変
- Testability and traceability IDs: 既存 test の REQ 番号を維持したまま assertion 対象のみ enum 比較へ移行

## Contract Probe

- **family (11) nullable filter probe（PR1 rally round 1 P2-2 の凍結転記義務）**: `MovementQuery.movement_type: Option<MovementType>` の deserialize を是正仮適用状態で end-to-end 実測する — (i) `null` 明示 (ii) field 省略 (iii) 不正 literal（例 `"bogus"`）の 3 パターンで invoke し、(i)(ii) が None 相当・(iii) が拒否になることと error shape を確認する
- **不正値拒否の wire shape（D-061 (b)、design packet から委譲された義務）**: request 側 enum family（(2)(3)(4)(5)(9)(10)(13)(14)）の代表で不正文字列を invoke し、serde deserialize 拒否の具体 shape（invoke error の形）を実測して frontend `describe-error` 既定 fallback 文言への合流を確定する。実測結果は本節へ追記し、41/42 の「serde 拒否へ統一」記述と矛盾しないことを確認する
- **specta × explicit serde rename**: `ProductTaxRate`（`#[serde(rename = "10")]` 等）が bindings に `"10" | "8" | "0"` の literal union として生成されることを是正仮適用で実証する（rename_all 導出でない唯一の family。生成が PascalCase 等へ落ちる場合は設計へ差し戻し）
- **`Option<Enum>` response の生成形**: `MovementRecord.reference_type: Option<ReferenceType>` が bindings で `ReferenceType | null` になることを確認する（既存 `string | null` との形状互換）

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-061 (a)(e) family (2)〜(14) の enum 化（SPEC-P41-PR2-D1 の名前・位置・方向凍結） | Scope 表の全 family | Matrix F1, F2, F4 | — |
| D-061 (b) 手動 parse 廃止 + serde 拒否統一（SPEC-P41-PR2-D5） | `plu_export_cmd.rs` / `sales_cmd.rs` | Matrix F3 + Probe | — |
| D-061 (c) DB 読出し明示 match（movement_type = internal / reference_type = REQ-303 fallback、SPEC-P41-PR2-D4） | `db/inventory_repo.rs` / `list.rs` | Matrix F5 | — |
| **family (11) nullable filter probe（PR1 P2-2 凍結義務の転記）** | `MovementQuery.movement_type` | Probe + Matrix F4 | — |
| SPEC-P41-PR2-D2 ImportRow String 維持（error row 契約保護） | `product_service.rs` | Matrix F11 | — |
| SPEC-P41-PR2-D3 stock_unit file guard 非対称の doc 是正 + 現状維持 | 30 doc / `product_service.rs`（無変更） | Matrix F9 + F11（negative） | 挙動変更は non-scope |
| SPEC-P41-PR2-D6 冪等 fingerprint 不変（manual_sale + returns + disposal の 3 domain — round 4 P1-2 拡張） | `manual_sale.rs:100` / `returns.rs:149-156, 581` / `disposal.rs:72-75` | Matrix F6（3 domain の固定値 test） | — |
| SPEC-P41-PR2-D7 canonical 関数 × serde parity（既存 (11)(12) + 新設 (2)(3)(4)(5)(7)(13)(14)、(6) 等は sweep で確定 — round 5 P1-1 で direction 追加） | `db/inventory_repo.rs` + 各 enum の canonical 関数 | Matrix F7（全対象 enum の全 variant parity） | — |
| frontend 手動 union 7 alias 置換 + mock drift 3 是正 + exhaustive 化（labels / compute-summary switch+never） | Scope Frontend 節 | Matrix F8, F10 | — |
| 廃棄自由記述 reason の enum 化禁止（44 §23.7） | 変更なし | Matrix F12（negative） | non-scope の保護 |
| SPEC-P41-PR2-D8 型変更波及の 6 class 別処遇（無効値 test 移設 8 本 / DB・IO write 9 site / DB read 8 site / wire assert 書き換え / doc wire 行限定 / fingerprint 埋め込み 4 site） | Scope の実測列挙 + Writer rg sweep | Matrix F4（移設先）+ F6（(f)）+ F9（doc anchor）+ `cargo build`（(b)(c)(d) は型検査が強制） | — |
| SPEC-P41-PR2-D7 canonical wire 文字列関数の一元供給（ad-hoc 変換禁止 — round 5 P1-2 で `plu_export_service.rs:149` の Casio 税区分接続 site を保護対象化） | 各 enum の canonical 関数 + 全消費 site | Matrix F7（parity）+ 既存 `map_tax_rate` 全 variant test | — |
| bindings 再生成 diff の型強化限定（SPEC-P41-D5 (ii)） | `src/lib/bindings.ts` | Matrix F2 | 生成物、L3 なし |
| 隣接 contract sweep: 現在形化 19 箇所の各 § 同居契約（31 の複合整合ルール `returns.rs:108,113` の分岐意味論 / 32 の error row 契約 / 44 §23.7 禁止行 / 56 の集計意味論 / 51 の select guard 文言）は値・意味論不変で型注記のみ更新。除外契約なし | — | 独立レビューで再確認 | — |
| URL search 層の非変更保護（P4-2 境界、`useStockMovements.ts:47` は型整合のみ） | `useStockMovements.ts` | Matrix F10 + diff 検査 | non-scope の保護 |

## Test Plan

Test Design Matrix: [test-matrices/2026-08-02-finite-ipc-enum-impl-pr2.md](test-matrices/2026-08-02-finite-ipc-enum-impl-pr2.md)

- targeted tests: family ごとの wire round-trip test（正常全値 + request family の不正値拒否、SPEC-P41-D5 (iii)）+ Matrix F1〜F12
- negative tests: F5（REQ-303 regression）、F6（fingerprint 不変）、F11（ImportRow String 維持 + file 経路挙動不変）、F12（廃棄 reason 非 enum 化）
- compatibility checks: F2（bindings diff = 型強化のみ、blob 比較）
- data safety checks: 実 artifact なし。synthetic fixture のみ
- main wiring/integration checks: `cargo test` + architecture_test + design_compliance_test + `npx tsc --noEmit` + `npm test` + doc-consistency-check + `bash scripts/local-ci.sh full`

## Boundary / Wire Contract

- producer / consumer: 各 family の Rust enum（SSOT）→ generated `bindings.ts` literal union → frontend
- wire type: 現行 snake_case string（(13) は `"10"|"8"|"0"`）と 1:1 完全一致。正常値の wire 表現不変が不変条件
- internal type: Rust enum（新設 5 + 既存 derive 追加 4。方向別 derive は SPEC-P41-PR2-D1 の表）
- precision/range: 値集合は現状凍結（追加・改名なし）
- round-trip path: request = enum 直 deserialize / response = enum 直 serialize。DB 読出しは明示 match（SPEC-P41-PR2-D4）
- invalid input: request 側は serde deserialize 拒否へ統一（shape は Contract Probe で実測）。response-only family は受信経路なし。`ImportRow` のみ String + 既存 file 経路 validation を維持（SPEC-P41-PR2-D2）
- compatibility: bindings 再生成 diff が「対象 field 型強化 + 12 型新規 export + 2 command シグネチャ enum 化」のみであることを review 必須観点とする

## Review Focus

- 各 enum の variant 名が serde rename を通じて現行 wire 文字列と厳密 1:1 か（特に `ProductTaxRate` の explicit rename と `MovementType`/`ReferenceType` の複合語 — `SaleAuto` → `sale_auto` 等。タイプミスが即 wire drift になり Rust コンパイラでは検出できない）
- SPEC-P41-PR2-D4 の裁定妥当性: reference_type の REQ-303 fallback（不明値→None）が D-061 (c) catch-all 禁止の契約的例外として妥当か、movement_type の internal 化と非対称になる理由が doc に残るか
- `ImportRow` 境界（D2）: enum 適用 DTO と String 維持 DTO の線引きが 30 の doc と実装で一致するか、file 由来不正値の error row 挙動が bit-for-bit 不変か
- 冪等 fingerprint（D6、3 domain）: enum 化前後で同一入力の fingerprint が一致するか（既存 idempotency test + F6）。format!/Display 埋め込みは型検査で守られない唯一の class（D8 (f)）— returns / disposal / manual_sale の各 site で Display（または明示変換）の出力が wire 文字列と bit 一致するかを重点確認
- validation 文言退役の範囲が D-061 (b) の凍結（wire 経路のみ）を超えていないか（file 経路 `692-702` の文言は不変）
- 既存 test assertion の enum 移行で弱体化（assert 削除・値比較の消失）がないか
- mock drift 3 箇所の是正後、同種 drift の再注入が `tsc` で red になるか（D-061 の本来目的の実証）
- `useStockMovements.ts:47` の変更が URL search 層（P4-2 対象外)へ波及していないか
- mutation kill 主張（F1〜F12）が Final Review で実注入・再現されているか（自己申告のみで採用しない）
- 本 packet と design packet SPEC-P41-D1〜D5 の凍結契約との突合（SPEC-P41-D5 (vi) の必須観点）

## Spec Contract

Contract ID: D-061 (a)(b)(c)(e)（design PR で凍結、本 PR で実装） + SPEC-P41-PR2-D1〜D7（本 PR で新規確定した実装詳細）

- SPEC-P41-PR2-D1: enum 名・定義位置・方向別 derive セットを Scope 表のとおり凍結する。request を運ぶ family は `Serialize + Deserialize + specta::Type` + `Debug, Clone, Copy, PartialEq, Eq`、response-only family は Deserialize を derive しない。`ProductTaxRate` のみ explicit `#[serde(rename)]`、他は `rename_all = "snake_case"`
- SPEC-P41-PR2-D2: (13)(14) の enum 適用境界は `ProductCreateRequest` / `ProductUpdateRequest` / `Product`。`ImportRow` は String 維持（file 由来 error row 契約の保護）
- SPEC-P41-PR2-D3: stock_unit file 経路の値域 guard は実在しない（tax_rate と非対称）。現状挙動（存在確認 + pcs デフォルト化）を維持し、30 の記述を事実へ是正する。guard 新設は backlog 候補
- SPEC-P41-PR2-D4: DB 読出し変換は明示 match。movement_type 不明値 = internal（D-061 (c)）、reference_type 不明値 = None（REQ-303 の契約的 fallback、test 根拠付き）
- SPEC-P41-PR2-D5: 手動 parse 2 site を廃止し serde 拒否へ統一（D-061 (b) 実装）。退役する validation 文言は wire 経路のみ
- SPEC-P41-PR2-D6（round 4 P1-2 で 3 domain へ拡張）: 冪等 fingerprint への埋め込み値は enum 化後も wire 文字列と同一 bit 列を維持する。対象 = manual_sale `reason`（`manual_sale.rs:100`）+ returns `return_type` / `direction`（`returns.rs:149-151, 156` の `format!` 埋め込み + test 内 fingerprint 複製 `returns.rs:581`）+ disposal `disposal_type`（`disposal.rs:72-75`。同 format! の `i.reason` は自由記述で String 維持のため対象外）。`{}` は Display を要求するため、wire 不一致の Display 実装でもコンパイルが通り fingerprint だけ静かに変わる — 型検査で守られない唯一の class（D8 (f)）であり、3 domain の fingerprint 固定値 test で防御する
- SPEC-P41-PR2-D7（round 4 P1-3 で拡張、round 5 P1-1/P1-2 で canonical 関数規則へ一般化）: serde 以外の経路で enum の wire 文字列が必要な全ての場面（D8 (c) の DB/IO 層 String struct への書込み / D8 (f) の fingerprint 埋め込み / test fixture）は、**enum ごとに 1 つの canonical wire 文字列関数（`as_str()` 相当）を唯一の供給源として再利用し、site ごとの ad-hoc 変換実装を禁止する**。canonical 関数を持つ全 enum — 既存 (11)(12) + 新設で必要な (2)(3)(4)(5)(7)(13)(14)、(6) 等の要否は Writer sweep で確定し必要なら同処遇 — に、全 variant で canonical 出力 == serde 出力の parity test を常設して drift を機械防御する。DB CHECK はドメイン外の値のみ弾き、ドメイン内の variant 取り違え（例: `Damage => "other"`、`Rate8 => "10"` — 後者は物理レジスターの税区分を静かに誤らせる）は通過するため parity test が唯一の機械防御
- SPEC-P41-PR2-D8（型変更波及の class 別処遇原則 — round 3 P1-1/P1-2/P1-3 を一般化）: String → enum の型変更が波及する既存コードは次の 6 class で処遇し、Writer は各 class を rg 全数 sweep で適用する（列挙は Scope の実測リスト。sweep で追加検出した同 class は同処遇）: **(a) 無効値 validation test** = 無効値が型的に構築不能となるため、担う契約を family 別 serde 拒否 round-trip test（Matrix F4）へ REQ token ごと移設（削除ではない）。**(b) 正値 literal の test 構築・比較** = enum literal へ機械書き換え（契約不変・弱体化禁止）。ただし DB INSERT fixture（`New*` 等 TEXT 層 struct の構築）は型不変のため書き換え不要。**(c) DB / IO 層 String struct への書込み site（round 5 P1-2 で IO 層へ拡張）** = `New*` / `ProductUpdates` 等 DB 層 struct と `PluExportRow` 等 IO 層 struct は String 維持（D-061 (c) の層境界）とし、enum 化 DTO からの構築は canonical wire 文字列関数（SPEC-P41-PR2-D7）経由の明示変換へ。**(d) DB 読出し site** = enum 化 field への `row.get` 直代入は明示 match 変換へ（不明値 = internal、reference_type のみ REQ-303 fallback — SPEC-P41-PR2-D4）。**(e) doc の DTO field 型記述** = enum 化対象（wire DTO）の行のみ現在形化し、`New*` / DB struct / 廃棄自由記述 reason の String 記述は正確なまま維持する。**(f) 非 wire 生成物への format!/Display 埋め込み（round 4 P1-2 で新設）** = 冪等 fingerprint 等、wire 以外へ値の文字列表現が流れる site は wire 文字列と同一 bit 列を維持する（SPEC-P41-PR2-D6）。型検査で強制されない唯一の class のため、固定値 test + mutation で防御する。sweep 方法: 各 family の field 名で `format!` / `to_string` / 文字列連結 site を rg し、wire 以外の消費先を列挙する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| D-061 (a)(e) / PR2-D1 | enum 新設・derive 追加 + 全適用 | Matrix F1, F2, F4 | wire 文字列 1:1 | rg token + round-trip test |
| D-061 (b) / PR2-D5 | 手動 parse 廃止 | Matrix F3 + Probe | 退役範囲の限定 | probe 実測記録 |
| D-061 (c) / PR2-D4 | DB 読出し明示 match | Matrix F5 | REQ-303 例外裁定 | 既存 test + F5 |
| PR2-D2 / PR2-D3 | ImportRow 境界 + 30 是正 | Matrix F9, F11 | file 経路挙動不変 | rg token + negative test |
| PR2-D6 | fingerprint 不変 | Matrix F6 | 冪等互換 | idempotency test |
| PR2-D7 | as_str parity | Matrix F7 | 二重 SSOT 防御 | parity test |
| SPEC-P41-D5 (iii)(iv) | round-trip + drift sweep | Matrix F4, F8, F9, F10 | sweep 網羅 | rg 全箇所 + tsc |

## Data Safety

- 実 POS / 店舗 artifact、DB file、backup、log、receipt image、secret は commit しない（コード変更は synthetic test のみ使用）
- local-only paths: なし
- synthetic-only paths: `src-tauri` 内の既存 test fixture を維持（新規 fixture は synthetic のみ）

## Implementation Results

（実装後に記入。exact-HEAD SHA / test 件数は PR body を正本とする — D-035/D-038）

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Review round 1（independent Claude subagent, Sonnet 5, fresh context）

- P1 = 0
- P2-1（Matrix F5 の REQ-303 oracle が Scope の `resolve_movement_source` シグネチャ変更後に無効化される）: **accept**。Coordinator が `list.rs:230-244`（`&Option<String>` 入力 + `_ => return None`）と `list.rs:471-476`（legacy 文字列 `"legacy_reference"` を直接渡す test）を実読再現。`Option<ReferenceType>` 化後は不正文字列を型的に構築できず、6 variant 網羅後の wildcard は unreachable_patterns で clippy -D warnings に抵触する。是正 = legacy 許容を DB 読出し変換（TEXT→enum、不明値→None）へ移し、新設 unit test + 既存 test の契約ごと移設（削除ではない）で REQ-303 網羅を維持。Scope / Matrix F5 を改訂
- P3-1（`InventoryRecordQuery.record_type` の隣接契約が除外宣言なし）: **accept**。65 §65.8.3 所有の別契約（`csv_import`/`stocktake` 除外を含む独自許可リスト、`db/disposal_repo.rs:246-276` の独立定数配列、audit P4 findings に record_type 言及 0 hit）を Coordinator も実測確認。Non-scope + Matrix Adjacent Pattern Audit へ明示除外行を追加
- reviewer が独立再現して問題なしと確認した観点: SPEC-P41-D2 family 一覧の完全一致 / 凍結義務 2 点の転記実在 / AC baseline 全件 / enum 名 12 型の衝突なし / 実測差分 α〜δ / literal 直書きの独自 sweep（(2)〜(5)(9) に漏れなし）

### Plan Review round 2（independent Claude subagent, Sonnet 5, fresh context）

- P1 = 0。round 1 是正（P2-1 の 6 variant 網羅 match / wildcard 不要）の妥当性は reviewer 実測で確認
- P2（movement_type 側の同種問題）: **accept**。`list.rs:191-219` の `VALID_MOVEMENT_TYPES` + BIZ 値域チェックと test 2 本（`:385-421`）が Scope から欠落 — round 1 P2-1 と同型の「型変更で無効値が構築不能になる」パターンの水平展開漏れ。Coordinator が実読再現し、Scope の BIZ validation 置換行 + Matrix F4/F5 へ退役・移設・書き換えを明記
- P2（record_type の引用節誤り）: **accept**。round 1 指摘文の「§65.8.3」を Coordinator が節番号まで検証せず転記していた（§65.8.3 は操作ログ関連記録リンク = 74 所有の別契約。`InventoryRecordQuery` の正典は `disposal_repo.rs:44` doc comment が示す §65.4）。除外の結論自体は正しい（4 値 vs 6 値の別 SSOT を reviewer/Coordinator 双方が実測）。Non-scope / Adjacent Pattern Audit の引用を訂正
- P2（drift sweep の 21 / 58 未網羅）: **accept**。design packet が deferred とした反復言及 doc のうち、21（`return_type: String` ×3 / `disposal_type: String` ×1）と 58（`tax_rate: string;` / `stock_unit: string;`）は enum 化対象 DTO の型記述で実装後 stale になることを Coordinator 実測で確認。Docs Scope + Matrix F9 anchor + AC へ追加（family (13)(14) 凍結対象外 DTO の `stock_unit: String` 行は正確なまま維持と明記）。Design Sources の「21 変更なし」を訂正
- P3（`list.rs:468` の存続表現）: **accept**。enum literal への書き換えを伴う存続へ精緻化 / P3（csv import test file 構築 site 未列挙）: **accept**。3 file 12 hit の baseline を実測し Scope へ追加
- reviewer が問題なしと確認: `CsvImportStatus` の DB 層定義 + BIZ 再利用は既存 `CsvImport` re-export（`biz/mod.rs:22`）と同 pattern / `PaginatedResult<T>` generic への specta 波及なし / F11 anchor 頑健性（`Option<String>` 行は非 hit）/ mock drift 3 箇所の記述一致

### Plan Review round 3（independent Claude subagent, Sonnet 5, fresh context — 同一欠陥 class の機械的全数突合を明示依頼）

- P1-1（無効値 validation test の処遇欠落が 7 family に水平残存）: **accept**。returns ×2 / disposal ×1 / manual_sale ×1 / product_service ×2 / plu_export_cmd ×3 / sales_cmd ×1（文言 assert 含む）を Coordinator が全件実読再現。Scope へ実測列挙 + F4 移設を明記
- P1-2（DB 読出し・書込み site の変換欠落が family (2)〜(6)(13)(14) に残存）: **accept**。read 8 site（return_repo :166,238 / disposal_repo :516 / manual_sale_repo :123,188 / product_repo :195,198 / sales_service :179）+ write 5 site（returns :196,587 / product_service :170,173,300）を実測再現。Scope へ列挙、処遇は D8 (c)(d)
- P1-3（`return_repo.rs:509,519` の wire assert 未処遇）: **accept**。実読再現、D8 (b) で処遇
- P2 ×4（31/44 の DTO 型記述 12 箇所欠落 / 21 の direction・reason 未 citation / **21 の一括 0 化 anchor が NewReturnRecord 等の正確な記述の書き換えを強制する自己矛盾** / csv test baseline の fixture・wire 混同）: **全 accept**。特に 3 点目は round 2 で Coordinator が入れた anchor 自体の欠陥。AC anchor を wire DTO 行限定 pattern へ全面是正（44 の廃棄 reason `:404,642` と `New*` 系は維持対象と明記）。csv test は wire assertion 8 / DB fixture 4 に内訳分離
- P3（frontend mock の正値 literal は contextual typing で書き換え不要という packet 推論の妥当性）: reviewer の spot check 10 file で反例なし（helper 引数を `string` 型にする Rust 型 pattern は frontend に不在）
- **構造的裁定（round 3 の教訓）**: round 1〜3 の findings は全て「site 列挙の漏れ」— 列挙を増やす対処は収束しないため、SPEC-P41-PR2-D8 として class 別処遇原則 + 実測列挙 + Writer rg 全数 sweep の三層契約へ転換した。round 4 は D8 の class 定義自体の穴と是正反映の検証に集中する

### Plan Review round 4（independent Claude subagent, Sonnet 5, fresh context — D8 class 定義の完全性検査を明示依頼）

- P1-1（21:199 `ManualSaleRecordDetail.reason` の wire 行が anchor 漏れ）: **accept**。`', reason: String,'` の判別可能 anchor が実在（baseline 1 を Coordinator 実測）するのに未追加だった。AC / Matrix F9 へ追加
- P1-2（冪等 fingerprint への Display 埋め込みが returns / disposal にも存在 — D8 の 5 class に無い第 6 の波及形）: **accept**。`returns.rs:149-156`（return_type / direction + test 複製 `:581`）/ `disposal.rs:72-75`（disposal_type。同行の自由記述 reason は対象外）を Coordinator 実読再現。enum の `{}` 埋め込みは wire 不一致の Display でもコンパイルが通り fingerprint だけ静かに変わる = **型検査で守られない唯一の class**。D6 を 3 domain へ拡張、D8 (f) を新設、失敗定義・F6・Y6 を拡張
- P1-3（D7 parity 義務が新設 as_str 相当変換 5 family に未展開）: **accept**。DB CHECK はドメイン内 variant 取り違え（`Damage => "other"` 等）を通すため parity test が唯一の機械防御という論理を確認。D7 / F7 / Y7 を (2)(4)(5)(13)(14) へ拡張
- P2-1（D8 (c) 列挙に 3 site 漏れ）: **accept**。`returns.rs:238` / `disposal.rs:180` / `manual_sale.rs:206` を実測確認し追加、(b) 同様の sweep ヘッジを (c) にも明記（型不一致は compile が捕捉するため列挙は変換一貫性レビュー用）
- P3 ×2（`manual_sale_repo.rs:123` の citation 精度 / F9 表現）: citation を `:117-125` + `:188` へ精緻化
- reviewer が問題なしと確認: D8 (a) 8 件・(d) 8 site・doc anchor 10 本・csv baseline 12 件の全再現 / **D8 (a) の層対応の正当性**（BIZ 無効値 test は serde test への委譲ではなく「型で state space が消滅」し、F4 が唯一の到達可能経路 = wire boundary を保護する構図）/ 44:594 の anchor 対象外判断 / HashMap key・sort・log 埋め込み等の追加波及形は fingerprint 以外に不在 / `New*` 維持行の anchor 非巻き込み

### Plan Review round 5（independent Claude subagent, Sonnet 5, fresh context — 収束判定 + D8 (f) sweep の独立再実行）

- P1-1（D7 の family 列挙から (3) direction が漏れ、同 round 4 内の D8 (c) 追加と自己矛盾）: **accept**。Coordinator が自packet の記述を突合確認。D7 / F7 / Ledger / Adjacent Audit を (2)(3)(4)(5)(7)(13)(14) へ是正（(7) CsvImportStatus の `NewCsvImport` 構築も同構造のため同時追加）
- P1-2（`plu_export_service.rs:149` の `Product.tax_rate` → `PluExportRow.tax_rate`（IO 層）変換が未列挙 — `map_tax_rate` = Casio レジスター税区分決定に接続し、variant 取り違えはエラーにならず物理レジの税区分を静かに誤らせる）: **accept**。Coordinator が `plu_export_service.rs:145-152` / `plu_formatter.rs:293-303` を実読再現、`map_tax_rate` 全 variant test の実在（`plu_formatter.rs:822` 付近）も確認。対処 = 列挙追加に加え、**D7 を「canonical wire 文字列関数の一元供給（ad-hoc 変換禁止）」規則へ一般化** — serde 以外の全消費 site（DB write / IO struct / fingerprint）が per-enum canonical 関数を再利用し、parity test が全 site を一括防御する構図に変更。D8 (c) は「DB / IO 層 String struct への書込み」へ拡張
- P2-1（D8 の「5 class」表記が 3 箇所で (f) 新設に未追随）: **accept**。313 / Trace 211 / Ledger 264 を 6 class へ統一、Ledger の site 数も現況（write 9 / fingerprint 4）へ更新
- reviewer が問題なしと確認: D6 3 domain 拡張の実読一致（disposal の同一 format! 内 reason 弁別含む）/ 21 新 anchor の一意性（44 の書式と衝突なし）/ D8 (f) sweep 独立再実行で fingerprint 4 site 以外の隠れ埋め込みなし（CSV export・mnt/restore の reason は別概念で除外正当）/ 実装未着手の確認
- **Sonnet lane 収束判定**: round 5 findings も「列挙漏れ」class の反復であり、owner 裁定（2026-08-02）の rally 天井方式に基づき Sonnet lane は本 round で終了。以降は Codex cross-vendor レビュー（相互修正案方式）で別 lens の検証を行う
