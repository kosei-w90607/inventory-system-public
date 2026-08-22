# Test Design Matrix: 価格改定（値上げ連絡）支援の design-first

## Risk

Risk: R3

## Contracts Under Test

- SPEC-PRV-D1: `suppliers` の意味 = メーカー/ブランド（値上げ連絡の主体）
- SPEC-PRV-D2: 検索 keyword の一致対象に `maker_code` を追加
- SPEC-PRV-D3: UI-14 一括価格改定画面の絞り込みと対象
- SPEC-PRV-D4: UI-14 の一覧列と新原価案の導出
- SPEC-PRV-D5: 行単位確定 = CMD `revise_product_price`
- SPEC-PRV-D6: 取引先の漸進補完と inline 追加（`create_supplier`）
- SPEC-PRV-D7: 中断・再開 = 行単位確定 + 「最近改定」目印
- SPEC-PRV-D8: 入庫時原価差分検出（BIZ-02 拡張、`cost_diffs`）
- SPEC-PRV-D9: 価格履歴閲覧（`list_price_history`、UI-01b 第 5 セクション）
- SPEC-PRV-D10: SP-103-04 商品一覧の原価列（owner 裁定で確定）
- SPEC-PRV-D11: 要件 / coverage / traceability の露出（REQ-105 / REQ-106 / REQ-209）
- SPEC-PRV-D12: 実装 PR の分割（A / B / C）

## Failure Modes

- `suppliers` の役割文が「仕入れ先」語彙のまま残り、実装 PR で問屋チャネル属性が誤って足される。
- keyword 一致列に `maker_code` が漏れ、値上げリストのメーカー品番から商品へ到達できない（既存 3 列のみで検索が失敗する）。
- UI-14 の絞り込みが取引先必須になり、紐付け網羅率が低い初年度に母集団が空になる。
- 新原価案の導出が浮動小数演算のまま契約化され、円の再現性が崩れる。または `selling_price = 0` の fallback が未定義。
- `revise_product_price` が売価・原価とも不変でも price_history へ空更新を書く、または原価のみの変更で `plu_dirty` を誤って立てる。
- `assign_supplier_id` が既存の非 NULL `supplier_id` を上書きする経路が契約化される。
- draft 保存テーブルが設計に紛れ込む、または「最近改定」目印が永続化される。
- `cost_diffs` の検出が保存 transaction の成否に影響する設計になる、または idempotent replay 時に空配列にならない。
- `list_price_history` の並び順・limit が未確定、または新規登録モードでセクションが誤って表示される。
- SP-103-04 の裁定結果が決定 ID の衝突により 50-ui に記録されない、または既存決定を上書きする。
- REQ-105 / REQ-106 / REQ-209 が requirements.md / requirements-coverage.md の片方にしか露出せず、`generate_traceability --check` が T1/T2 で落ちる。
- 実装 PR の Ledger 予約に漏れがあり、後続 PR で契約が未テストのまま実装される。

## Test Matrix

`M-D*` は本 design-first PR の source doc amendment 検証（本発注では予約、plan-approved 後の第 2 発注で実行）。anchor oracle は「新文言 exact 存在（`rg -F -c` ≥ 1）+ 旧文言 0 hit（旧文言が存在する場合のみ）」。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-PRV-D1 [本 design-first PR] | 「仕入れ先」語彙が残る | CLI/negative rg | M-D1: `rg -F -c "メーカー/ブランド（値上げ連絡の主体）" docs/db-design/master-tables.md` ≥ 1、`rg -F -c "取引先（仕入れ先）の名前をマスタ管理" docs/db-design/master-tables.md` = 0 | §3 役割文が旧語彙のまま or 新語彙が未転記 |
| SPEC-PRV-D2 [本 design-first PR] | maker_code が漏れる | CLI/negative rg | M-D2: `rg -F -c "商品名、product_code、jan_code、maker_codeの部分一致" docs/function-design/20-io-product-repo.md` ≥ 1、`rg -F -c "商品名、product_code、jan_codeの部分一致" docs/function-design/20-io-product-repo.md` = 0、50-ui-product-list.md §50.5/§50.6 に `maker_code` 追記 anchor 存在、30-biz-product-service.md の一括 PLU 対象化の節に `maker_code` anchor ≥ 1（`ProductBulkFilter` 共有による母集団拡張の明記、SPEC-PRV-D2 隣接契約） | keyword 4 列化が 20-io / 50-ui / 30-biz 一括 PLU 節のいずれかに未反映 |
| SPEC-PRV-D3 [本 design-first PR] | 未設定含む既定 / 母集団条件が未確定 | CLI/contract review | M-D3: `docs/function-design/77-ui-bulk-price-revision.md` に `rg -F -c "取引先未設定の商品も含める"` ≥ 1、`supplier_id = X OR supplier_id IS NULL` 相当の抽出条件と「在庫ゼロ商品は常に対象」anchor が存在 | filter 既定 or ページング契約が未記載 |
| SPEC-PRV-D4 [本 design-first PR] | 導出式が未確定 or 浮動小数のまま | CLI/negative rg | M-D4: `docs/function-design/77-ui-bulk-price-revision.md` に `rg -F -c "floor(新売価 × 現原価 ÷ 現売価)"`（または本文中の同義整数除算の exact 記述）≥ 1、「新売価の自動提案はしない」anchor 存在 | 導出式が未記載 or 自動提案の否認が欠落 |
| SPEC-PRV-D5 [本 design-first PR] | no-op / plu_dirty 規則が未転記 | CLI/contract review | M-D5: `rg -F -c "revise_product_price" docs/function-design/30-biz-product-service.md docs/function-design/40-cmd-product.md` 各 ≥ 1、`rg -F -c "原価のみの変更では plu_dirty を立てない"` （文言は 30-biz に転記、旧規則文 L126/L155 の売価変更時のみ plu_dirty=1 と整合）≥ 1、`rg -F -c "product_price_revise" docs/function-design/30-biz-product-service.md` ≥ 1（operation log 慣行） | CMD 契約 / plu_dirty 継承規則 / operation log のいずれかが未記載 |
| SPEC-PRV-D6 [本 design-first PR] | NULL のときだけ規則が未転記 | CLI/negative rg | M-D6: `rg -F -c "create_supplier(name" docs/function-design/40-cmd-product.md` ≥ 1、`rg -F -c "supplier_id が NULL のときだけ"` ≥ 1（30-biz or 40-cmd）、40-cmd L144「別 Design Phase で扱う」保留文が改訂され当該保留を指す旧文言 0 hit | 公開化 or NULL 限定規則のいずれかが未記載 |
| SPEC-PRV-D7 [本 design-first PR] | draft 保存 or 目印が過剰仕様化 | CLI/negative rg | M-D7: `docs/function-design/77-ui-bulk-price-revision.md` に `rg -F -c "draft 保存テーブルは設けない"` ≥ 1、`rg -F -c "最近改定"` ≥ 1、`rg -F -c "draft 保存" docs/function-design/77-ui-bulk-price-revision.md` = 1（否認文「draft 保存テーブルは設けない」の 1 件のみ。同 file 限定、他 doc の UI state 語彙としての draft は対象外） | draft 保存が契約化される or 目印導出の永続化が明記されない |
| SPEC-PRV-D8 [本 design-first PR] | 保存成否への影響 or replay 未定義 | CLI/contract review | M-D8: `rg -F -c "cost_diffs" docs/function-design/31-biz-inventory-service.md docs/function-design/44-cmd-inventory.md` 各 ≥ 1、`rg -F -c "保存 transaction の成否に影響しない"` ≥ 1（31-biz）、61-ui-receiving.md に差分ダイアログ導線 anchor 存在 | `cost_diffs` 型 or 非依存性 or UI 導線のいずれかが未記載 |
| SPEC-PRV-D9 [本 design-first PR] | 契機カラム or 表示条件が未確定 | CLI/negative rg | M-D9: `rg -F -c "list_price_history" docs/function-design/20-io-product-repo.md docs/function-design/40-cmd-product.md` 各 ≥ 1、`rg -F -c "価格履歴" docs/function-design/51-ui-product-form.md` ≥ 1（現状 0 hit）、契機カラムを追加する記述の hit 0 | 読取り関数・CMD・UI セクションのいずれかが欠落、または契機カラムが誤って足される |
| SPEC-PRV-D10 [本 design-first PR] | 決定 ID が UI-01a-D13 で転記されない | CLI/contract review + ID 一意性 | M-D10: `rg -o "UI-01a-D[0-9]+" docs/function-design/50-ui-product-list.md \| sort -u -V \| tail -1` が amendment 後に本裁定の新 ID（現状の最大は UI-01a-D12 のため次は **UI-01a-D13**）と一致し、`rg -F -c` で同 ID が 1 回だけ出現（重複 0） | 裁定行が既存 UI-01a-D9（keyword trim, 2026-08-03）または UI-01a-D10（PLU 状態列）と ID 衝突する、または未記録 |
| SPEC-PRV-D11 [本 design-first PR] | REQ / coverage / traceability のいずれかに露出漏れ | CLI/contract review | M-D11: `rg -c "REQ-105\|REQ-106\|REQ-209" docs/spec/requirements.md` ≥ 3、`rg -c "SP-102-08\|SP-103-04" docs/spec/requirements-coverage.md` = 2、`cd src-tauri && cargo run --bin generate_traceability -- --check` exit 0 | REQ 追加漏れ、coverage 行漏れ、または traceability 再生成で T1/T2 検出 |
| SPEC-PRV-D12 [Matrix のみ] | PR 分割が Ledger に写っていない | packet/Matrix review | M-D12: 本 Matrix「実装 PR への予約」に A/B/C の 3 節が存在し、Contract Coverage Ledger の実装対象 10 行（D2〜D10 + UI-14 到達導線）がいずれか 1 節に `Dn:` 表記で写っている。D1（docs-only）/ D11（第 2 発注）/ D12（plan 事項）は予約対象外として同節末尾に明記 | 予約先未記載の実装対象 Ledger 行がある |

### M-D1〜M-D12 実行結果（第 2 発注後に実測）

| Test | Result | 実測件数 / evidence（2026-08-22） |
|---|---|---|
| M-D1 | PASS | 新文言 1 / 旧文言 0 |
| M-D2 | PASS | 20-io 新文言 1 / 旧文言 0、50-ui `maker_code` 2、30-biz `maker_code` 5 |
| M-D3 | PASS | 未設定 toggle 3、抽出条件 2、在庫ゼロ 2 |
| M-D4 | PASS | floor 式 1、自動提案否認 1 |
| M-D5 | PASS | `revise_product_price` 30-biz 2 / 40-cmd 3、原価のみ規則 2、operation type 2 |
| M-D6 | PASS | `create_supplier(name` 1、NULL 限定規則 1、旧保留文 0 |
| M-D7 | PASS | draft table 否認 1、「最近改定」6、`draft 保存` 全 hit 1 |
| M-D8 | PASS | `cost_diffs` 31-biz 4 / 44-cmd 2、保存 transaction 非依存 1、UI action 3 |
| M-D9 | PASS | `list_price_history` 20-io 2 / 40-cmd 2、51-ui「価格履歴」10、契機カラム追加 0 |
| M-D10 | PASS | `UI-01a-D13` 1、最大 ID = D13 |
| M-D11 | PASS | requirements 対象 REQ hit 4、coverage 対象 SP hit 2、`generate_traceability -- --check` exit 0 |
| M-D12 | PASS | 実装 A/B/C 3 節、D2〜D10 9 行 + UI-14 到達導線 1、予約対象外 3 件を明記 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| UI-14 行（価格改定） | 現売価 = DB 値、未確定 | 入力中（新売価 / 新原価案編集） | 確定 → `revise_product_price` 成功、現売価列が新売価に更新 | 一覧再検索で反映（D-052 系 invalidation、実装 B で確定） | 再検索 or ページ移動で再取得 | 再訪時に確定済み行は現売価 = 新売価のまま継続 | 画面遷移・再読込で未確定入力は破棄（D7 明示） | validation error（負値等）→ 行は未確定のまま | 同行を再入力して再確定可 | A-系 予約（実装 A/B） |
| `suppliers` 行（inline 追加） | 未作成 | trim 済み name で `create_supplier` 呼出し中 | 新規作成 or 既存同名行を返す | `list_suppliers` invalidate（候補一覧再取得） | UI-14 filter / UI-01b 候補で反映 | — | — | 空文字 validation error | 再入力で再試行 | 実装 A |
| `products.supplier_id`（漸進補完） | NULL | — | UI-14 確定時 `assign_supplier_id` が Some かつ既存 NULL → 設定 | 該当商品の一覧行 / 商品詳細を invalidate | — | 既存非 NULL 値は再訪後も不変 | — | — | — | 実装 A/B |
| `price_history` 行（3 契機） | 存在しない | — | 手動修正 / 一括改定 / 入庫差分承諾のいずれかで insert（TX 内） | UI-01b 価格履歴セクション invalidate | 「すべて表示」で limit 拡張 refetch | 再訪時は DESC 順で最新が先頭 | — | TX rollback 時は insert されない | — | 実装 A/C |
| `ReceivingCreateResult.cost_diffs` | 空 | 保存処理中は未確定 | 保存成功後の読取りで不一致行を返す | — | — | — | idempotent replay → 空配列 | 保存 TX 失敗時は cost_diffs 自体を返さない（TX 非依存の意味は「検出が保存を阻害しない」） | 見送り後も次回入庫で差分が残れば再提示（記録なし） | 実装 C |
| UI-01a 一覧の「原価」列（D10 裁定 (a) 時） | 非表示 | — | amendment 後は基本列に表示 | — | — | — | — | — | — | 実装 A |

For workflow-state changes, add explicit rows for:

- content candidate -> L1 / independent review -> state-only human-confirm commit: 本 PR は `Phase: plan-draft` → Plan Gate 承認 → 第 2 発注（source docs amendment）→ L1 full（`generate_traceability --check` 含む）→ human-confirm。state-only commit は本 packet に含まない（docs amendment は内容変更のため通常経路）。
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit: owner 裁定（原価列）→ Plan Gate 承認 → Ready 化 → Ready / `synchronize` 経路の hosted 自動 run（CI-TRIGGER-D1、`design_compliance_test.rs` SKIP_DOCS 1 行を含むため非 docs-only）→ 三点一致 → merge、以降 tracked commit なし。
- state-only violation: 本 packet は docs-only PR のため state-only 区分自体が非該当（全変更が Scope/AC/Design を伴う）。
- hosted-not-required incidental failure: not applicable — `Hosted CI Requirement: required`（docs-only でも generate_traceability を伴うため required）。

## Adjacent Pattern Audit

Enumerate every site of each borrowed pattern; do not sample only the nearest file. Patterns include IME composition, Enter handling, focus order, formatter, query invalidation, error-kind mapping, route/search state, and accessibility.

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `ProductSearchQuery.keyword` / `ProductBulkFilter.keyword` の一致対象 | `docs/function-design/20-io-product-repo.md` §2.6（keyword 定義）、`50-ui-product-list.md` §50.5/§50.6（q param）、`30-biz-product-service.md`（bulk filter 経路） | 20-io（4 列化）、50-ui（メーカー品番の記述） | UI-14 は同一 `ProductSearchQuery` を再利用し独自 field は追加しない（D2 却下事項） | M-D2 |
| URL search param 契約（既定値省略、範囲外回復） | `50-ui-product-list.md` §50.4（q/dept/discontinued/sort/page） | UI-14 は既存契約を踏襲（filter は取引先・部門・keyword・廃番含む、いずれも任意） | UI-14 固有の `plu` 相当 param は本 packet の scope 外（PLU packet の `plu` param とは独立） | 77-ui §URL state（第 2 発注） |
| 既存 CMD の validation / error-kind（`CmdErrorKind`） | `40-cmd-product.md`（既存 validation 系）、`44-cmd-inventory.md`（既存 not-found 系） | `revise_product_price` / `create_supplier` は既存 variant を再利用、新 variant を起こさない（Boundary/Wire Contract 節） | 新 error variant 追加は非 scope（既存 CmdErrorKind で表現可能なため） | Boundary / Wire Contract 節、M-D5/M-D6 |
| `plu_dirty` 更新規則（売価変更時のみ） | `30-biz-product-service.md` L126/L155（`update_product` の既存規則） | `revise_product_price` が同規則を再利用（原価のみ変更では立てない） | UI-14 独自の PLU 判定は追加しない | M-D5、Compatibility Checks |
| query invalidation（D-052 系） | `50-ui-product-list.md` UI-01a-D12（PLU 系 invalidation の先例） | UI-14 確定後・inline 取引先追加後の invalidation は実装 B/A で D-052 パターンに揃える | 具体的な invalidation key の確定は第 2 発注の 77-ui 記述に委譲（本 Matrix は先例参照のみ） | 実装 B（RTL） |

## Negative Paths

- missing input: `revise_product_price` に `product_code` 不存在 → `CmdError`（not-found 系）、products/price_history とも不変。
- invalid input: `new_selling_price` / `new_cost_price` が負値 → validation error、TX 未開始。`create_supplier` の空文字 name → validation error。
- duplicate/ambiguous input: `create_supplier` に既存同名 → 新規作成せず既存行を返す（重複行を作らない）。
- unknown reference: `assign_supplier_id` が不存在の supplier_id → `CmdError`（not-found 系、Boundary/Wire Contract の既存 variant 再利用）。
- dependency missing: `list_price_history` に product_code 不存在 → 空配列（packet SPEC-PRV-D9 で確定済み、not-found error にしない）。第 2 発注で 40-cmd に転記。
- permission/write failure: 該当なし（既存 DB 権限モデルに変更なし）。
- dry-run side effect: 該当なし（UI-14 に dry-run 相当の機能はない。確定は即時反映）。
- D-075 否認語の不在（negative rg、非 scope 節の否定文は除外）:
  - `rg -n "掛率を保存|掛率.*永続化" docs/function-design/ docs/db-design/ docs/spec/` — 肯定文 0 hit。第 2 発注後の実測 = 1 hit（`77-ui-bulk-price-revision.md` SPEC-PRV-D4 の却下理由「永続化や浮動小数計算は円の再現性を損なう」= 否認文脈、許容）。
  - `rg -n "上代" docs/function-design/ docs/db-design/ docs/spec/` — 肯定文 0 hit。第 2 発注後の実測 = 1 hit（`77-ui-bulk-price-revision.md` Deferred の「参考上代」言及 = 非採用の列挙、許容）。
  - `rg -n "PDF.*解析" docs/function-design/` — 肯定文 0 hit。第 2 発注後の実測 = 1 hit（`77-ui-bulk-price-revision.md` Deferred の「PDF 自動解析」= 非採用の列挙、許容）。
  - `rg -n "draft.*保存" docs/function-design/` — 現状 0 hit（77-ui 新設後も「draft 保存テーブルは設けない」という否定文以外の肯定文が現れないことを M-D7 で確認）。
  - `rg -n "新売価.*自動提案|自動.*新原価.*提案" docs/function-design/77-ui-bulk-price-revision.md` — 肯定文 0 hit（否認文「新売価の自動提案はしない」の 1 件のみ許容。51-ui の pos_stock_sync / plu_target 初期値提案の文は対象外のため docs 全域 regex は使わない）。
  - `rg -n "暫定.*フラグ|暫定原価" docs/function-design/` — 現状 0 hit。

## Boundary Checks

- threshold: 新原価案の整数除算 `(new_selling * cost_price) / selling_price` は円単位 INTEGER（10^7 未満）同士の積が 10^14 未満で i64 に収まる（Contract Probe で N/A 判定済み、境界値 10^7 直下での実装 PR 側 unit test を予約）。
- null/default: `selling_price = 0` → 新原価案の初期値は現原価そのまま（fallback）。`supplier_id = NULL` → UI-14 filter 未指定時は対象に含む。
- empty/non-empty: UI-14 絞り込み結果 0 件 → Empty 表示（既存パターン踏襲）。`cost_diffs` 空配列 = 差分なし（ダイアログ非表示）。
- min/max: 円は 0 以上（負値 reject）。`list_price_history` の `limit` は既定 10、「すべて表示」で 100（上限 100、超過は 100 に丸める。packet SPEC-PRV-D9 で確定）。
- status/policy enum: 該当なし（本 packet に新規 status enum は追加しない。取引先の状態遷移は persist しない導出値のみ）。
- wire type: `PriceRevisionInput.new_selling_price` / `new_cost_price` は `number`（i64 円、JS safe integer 範囲内、円単位で 10^7 未満のため逸脱しない）。
- internal type: Rust `i64` 円、`String` ISO 日時（既存 price_history と同型）。
- producer/consumer: producer = product_cmd / receiving_cmd、consumer = UI-14 / UI-01b / UI-01a / UI-02（Boundary/Wire Contract 節と一致）。
- round-trip token: 該当なし（UI-14 に URL token/state の round-trip は本 packet で規定していない。77-ui の URL state 定義は第 2 発注で確定）。
- precision/range: 円整数 ≥ 0、掛率は wire に乗せず UI 導出のみ（D4 却下事項）。
- cross-language parse: `changed_at` は既存 price_history と同じ ISO 日時文字列形式を踏襲（新規パース規則を追加しない）。

## Compatibility Checks

- old schema/input: `ProductSearchQuery` / `ProductBulkFilter` の既存 3 列（商品名 / product_code / jan_code）一致は maker_code 追加後も回帰しない（M-D2 の Rust 側予約: 既存 3 列の回帰テスト）。
- new schema/input: `PriceRevisionInput` / `Supplier` / `PriceHistoryEntry` / `CostDiff` は Boundary/Wire Contract 節の型定義どおり、既存 wire type との衝突なし。
- output order: `list_price_history` は `changed_at DESC, id DESC`（既存 price_history の insert 順と整合）。
- optional field behavior: `ReceivingCreateResult.cost_diffs` は field 追加のみ、既存 consumer（`record_id` / `created` / `idempotent_replay` / `stock_warnings` を参照する既存コード）は無視可能で回帰しない。`assign_supplier_id: Option<i64>` は None のとき既存 `revise_product_price` 呼出し（UI-14 以外の想定なし）に影響しない。

## Data Safety Checks

- source-derived data: `docs/evidence/issue-90/hearing-2026-08-21-22.sanitized.md` の匿名化版のみ参照。実店舗の商品名・価格・取引先名・問屋名を本 Matrix・packet に転記しない（rg で自己点検: 具体的な店名/金額の literal がないことを確認済み）。
- generated outputs: `90-traceability.md` は `generate_traceability` の再生成のみ（手動編集禁止、M-D11 で --check 確認）。
- secrets: 該当なし。
- local-only files: 該当なし。
- synthetic-only paths: 実装 PR（A/B/C）の fixture は synthetic のみ（本 PR は docs-only のため fixture 自体を持たない）。

## Main Wiring / Integration Checks

- helper connected to main path: `revise_product_price` / `create_supplier` / `list_price_history` が `40-cmd-product.md` の CMD 契約として記載され、`docs/FUNCTION_DESIGN.md` 索引・`docs/architecture/cmd-task-specs.md` に entry として現れる（M-D11 の登録義務チェックと重複確認）。
- output reaches manifest/report: `77-ui-bulk-price-revision.md` が `docs/FUNCTION_DESIGN.md` から link され、`docs/SCREEN_DESIGN.md` 画面一覧 #20 に UI-14 が現れる。
- effective config reaches runtime: 該当なし（本 packet に config 変更はない）。
- CLI arg reaches implementation: `cargo run --bin generate_traceability -- --check` が新 REQ 3 件 / 新 UI doc の `> 対応仕様:` 行を T2 phantom なしで取り込む（Contract Probe の再確認事項、第 2 発注で実測）。

## Mutation-style Adequacy Questions

- SPEC-PRV-D5: `revise_product_price` から売価変更時の `plu_dirty` 設定を削除したら、どのテストが落ちるか（reserve: `test_revise_product_price_req105_plu_dirty_on_selling_change`）。
- SPEC-PRV-D5: 売価不変・原価のみ変更で `plu_dirty` を誤って立てるよう変えたら、どのテストが落ちるか（reserve: `test_revise_product_price_req105_cost_only_no_plu_dirty`、既存 `test_update_product_req102_cost_only_no_plu_dirty` と対の契約）。
- SPEC-PRV-D6: `assign_supplier_id` が既存の非 NULL `supplier_id` を上書きするよう変えたら、どのテストが落ちるか（reserve: `test_revise_product_price_req106_keeps_existing_supplier_id`）。
- SPEC-PRV-D6: `create_supplier` の重複同名判定を外し常に新規作成するよう変えたら、どのテストが落ちるか（reserve: `test_create_supplier_req106_returns_existing_row_for_duplicate_name`）。
- SPEC-PRV-D8: 原価差分の検出比較を保存 transaction の内側に移し、差分検出失敗時に保存自体が rollback するよう変えたら、どのテストが落ちるか（reserve: `test_create_receiving_req209_cost_diff_detection_does_not_affect_save_tx`）。
- SPEC-PRV-D8: `maker_code` 追加なしで keyword 一致対象が旧 3 列のままになるよう変えたら（D2 の実装退行）、どのテストが落ちるか（reserve: `test_search_products_req105_keyword_matches_maker_code`）。
- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant?: 実装 PR の新原価案テストは `floor((new_selling * cost_price) / selling_price)` を独立転記した oracle で比較し、production 定数（`cost_price` / `selling_price` の DB 値）を共有しない（feedback: Test oracle must not share SSOT）。
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct?: UI-14 確定後の一覧再検索が新売価を反映すること（実装 B RTL、State Lifecycle Matrix の UI-14 行 Success→Invalidate→Refetch）。
- If a key branch is inverted, which test fails?: D6 の「NULL のときだけ設定」が「常に上書き」に反転した場合 `test_revise_product_price_req106_keeps_existing_supplier_id` が落ちる。
- If a threshold comparison changes, which test fails?: D8 の「完全一致比較」が「閾値以内は無視」に変わった場合、境界値（±1 円差分）を含む差分検出テストが落ちる。
- If a guard is removed, which test fails?: D5 の負値 validation guard を外した場合、`test_revise_product_price_req105_validation_*` 系が落ちる。
- If an output field is omitted, which test fails?: `ReceivingCreateResult.cost_diffs` を省略した場合、`cargo run --bin generate_bindings`（実装 PR）または既存 RTL の ReceivingPage テストで型不整合が検出される。
- If tracked Workflow State stores the current PR HEAD, does a state commit make it stale immediately? The accepted design must keep current exact-HEAD evidence in PR metadata.: 本 packet は `Reviewed Content HEAD: pending` を human-confirm 直前の commit 内でのみ確定する規律（feedback: Reviewed Content HEAD timing）に従う。
- If a hosted URL/headSha is committed after the run, does the merge three-point check fail because PR HEAD changed?: Ready / `synchronize` 経路の hosted run（CI-TRIGGER-D1）後の三点一致は Workflow State の Human Gate 定義どおり実行順を固定し、hosted URL / headSha は packet に commit しない。
- If a state-only commit edits Scope/AC in the same packet file, does hunk-level review reject it even though the filename is allowlisted?: 本 PR は state-only 区分非該当（docs-only 内容変更）のため該当セクションは適用対象外。
- If output order changes, which test fails?: `list_price_history` の順序が `changed_at DESC, id DESC` から変わった場合、実装 A の Rust DESC 順テストが落ちる。
- If dry-run performs a side effect, which test fails?: 該当なし（本 packet に dry-run 機能はない）。
- If a JSON number crosses JavaScript safe integer range, which test fails?: 円単位 10^7 未満の契約を超える入力を与えた場合、Boundary Checks の wire type 境界テスト（実装 PR 予約）が落ちる。
- If a state token is round-tripped through browser/client code, which test fails?: 該当なし（UI-14 に URL state token の round-trip は本 packet で規定していない）。

## 実装 PR への予約（本 design の Ledger 対応）

実装 A（IO/BIZ/CMD + UI-01b 価格履歴 + 取引先 inline + UI-01a 原価列 + bindings 再生成）:

- D2: `test_search_products_req105_keyword_matches_maker_code`（`src-tauri/src/io/product_repo.rs` 相当）、既存 3 列（商品名/product_code/jan_code）の回帰 `test_search_products_req103_keyword_matches_existing_three_columns`、一括 PLU 対象化の母集団回帰 `test_find_products_for_bulk_plu_target_req105_keyword_matches_maker_code`。
- D5: `test_revise_product_price_req105_no_op_when_unchanged`、`test_revise_product_price_req105_plu_dirty_on_selling_change`、`test_revise_product_price_req105_cost_only_no_plu_dirty`、`test_revise_product_price_req105_writes_price_history_four_values`、`test_revise_product_price_req105_validation_negative_selling_price`、`test_revise_product_price_req105_writes_operation_log`、`test_revise_product_price_req105_no_op_writes_no_operation_log`。`test_revise_product_price_req105_validation_negative_cost_price`、`test_revise_product_price_req105_tx_atomicity_rollback`（`src-tauri/src/biz/product_service.rs`）。
- D6: `test_create_supplier_req106_trims_and_creates`、`test_create_supplier_req106_rejects_empty_name`、`test_create_supplier_req106_returns_existing_row_for_duplicate_name`、`test_revise_product_price_req106_assigns_null_supplier_id`、`test_revise_product_price_req106_keeps_existing_supplier_id`。
- D9: `test_list_price_history_req102_desc_order`、`test_list_price_history_req102_respects_limit`（`src-tauri/src/io/product_repo.rs`）、RTL: `src/features/products/components/ProductForm.test.tsx`（修正モードのみ表示、直近 10 件 + すべて表示）。
- D6 inline: RTL `src/features/products/components/ProductForm.test.tsx`（新規取引先追加導線）。
- D10（owner 裁定 (a) 確定）: RTL `src/features/products/components/ProductTable.test.tsx` / `src/features/products/ProductListPage.test.tsx`（「原価」列ヘッダが 売価 の右隣に存在）。
- bindings 再生成: `npm run generate:bindings` 後の型整合（`PriceRevisionInput` / `PriceRevisionResult` / `Supplier` / `PriceHistoryEntry`）。

実装 B（UI-14 一括価格改定画面、A に依存）:

- D3: `src/features/products/hooks/usePriceRevisionList.test.tsx`（`supplier_id = X OR NULL` 抽出、在庫ゼロ含む）、RTL `src/features/products/PriceRevisionPage.test.tsx`（「取引先未設定の商品も含める」既定 on、toggle off 可）。
- D4: RTL `src/features/products/PriceRevisionPage.test.tsx`（新原価案 floor 導出、`selling_price = 0` の「—」表示と現原価 fallback、% 表示 小数 1 桁）。
- D7: RTL `src/features/products/PriceRevisionPage.test.tsx`（本日 `changed_at` の「最近改定」バッジ、再読込で未確定入力が消える明示）。
- UI-14 到達導線（REQ-105）: `src/config/navigation.test.ts` に `ui-14` entry の到達テストを追加。
- L3（実装 B）: UI-14 での 400 行級一覧の操作性（絞り込み → 行確定の反復速度、紙リスト転記より速いかの手動確認）。

実装 C（BIZ-02 原価差分検出 + UI-02 ダイアログ、A に依存、B とは独立）:

- D8: `test_create_receiving_req209_detects_cost_diff`、`test_create_receiving_req209_no_diff_when_cost_matches`、`test_create_receiving_req209_empty_on_idempotent_replay`、`test_create_receiving_req209_cost_diff_detection_does_not_affect_save_tx`（`src-tauri/src/biz/inventory_service.rs`）。
- D8 UI: RTL `src/features/receiving/ReceivingPage.test.tsx`（保存完了時の差分ダイアログ表示、「マスタ原価をこの実原価に更新する」→ `revise_product_price` 呼出しで新売価は現売価据え置き）。

予約対象外（実装なし）: D1 = docs-only（master-tables §3 の意味改訂のみ）/ D11 = 第 2 発注の docs 作業（requirements / coverage / 90-traceability）/ D12 = plan 事項（本節自体）。

## Residual Test Gaps

- `list_price_history` の「product_code 不存在」時の挙動は packet SPEC-PRV-D9 で空配列に確定（round 1 後）。第 2 発注で 40-cmd-product.md に転記する。
- `list_price_history` の `limit` は packet SPEC-PRV-D9 で既定 10・上限 100 に確定（round 1 後）。
- CV17 実機相当の検証は本 packet に存在しない（docs-only のため L3 は実装 B/C のみ）。UI-14 の 400 行級操作性は L3 手動確認に依存し自動化不能。
- `generate_traceability -- --check` の実測結果（T1/T2 phantom なし）は第 2 発注まで未実行。
