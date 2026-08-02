# Test Design Matrix: CSV取込み詳細 route + get_csv_import_record（65 slice 4b）

Plan Packet: [../2026-08-03-csv-import-record-detail.md](../2026-08-03-csv-import-record-detail.md)

## Risk

Risk: R3

## Contracts Under Test

- 24 §14.13a: IO 詳細取得（ヘッダ NotFound / 明細 JOIN + is_voided 込み / movements filter / error rows 順序）
- 32 §15.6a: BIZ wire DTO 構成（NotFound 変換 / ErrorRow 写像 / enum 変換 fail-fast / source 補完共有 / file_hash 非搭載）
- 41 §17.5 / §17.9: CMD thin wrapper + 登録・生成義務
- 65 §65.3 / §65.5 / §65.6.1: route・表示項目・状態正規化
- 66 UI-06c-D7 後続: movements link click → SPA 遷移（到達導線）
- 65 §65.5 / TRACE-D11 同型: returnTo 検索条件保持 + 不正値 fallback
- D-052 C9: rollback invalidation 集合変更 + 独立転記 oracle
- D-4 / 順17: query key literal 直書き 0

## Failure Modes

- 存在しない import_id で panic / 空表示 / internal error 化（not_found に変換されない）
- rolled_back 取込みで明細が消える・movements 0 件が error 扱いになる・状態 label が raw 値のまま
- voided 明細の非表示（rollback 後に「明細数 0」と誤読させる）
- エラー行の順序不定・0 件で error 化
- error_type の enum 変換誤り・握りつぶし
- source 補完の label/route 複製 drift（inventory_service と別実装になる）
- link click が 404 のまま / href だけ正しく実遷移が壊れている
- rollback 後に詳細 cache が stale のまま表示され続ける（invalidation 欠落）
- returnTo に外部 URL / `//` 始まりが通る
- 既存 CSV flow・既存 4 詳細の回帰
- layout + index 再構成（Amendment 1）で既存 `/csv-import` 取込み画面が描画されなくなる

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- Test Name は実装時に確定するが、REQ token（REQ-206 / REQ-207）を含める既存規約に従う。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| 24 §14.13a ヘッダ NotFound | 不存在 id が Ok / panic | unit (Rust) | T1 `test_get_csv_import_record_detail_req206_not_found` | NotFound を握りつぶし空 DTO を返す実装 |
| 24 §14.13a 明細 JOIN + is_voided 込み + ORDER BY id ASC | voided 明細の脱落・順序不定 | unit (Rust) | T2 `test_get_csv_import_record_detail_req206_items_include_voided` | items query に `is_voided=0` filter を足す / ORDER BY を落とす mutant |
| 24 §14.13a movements filter | voided movement 混入 / 他 reference 混入 | unit (Rust) | T3 `test_get_csv_import_record_detail_req207_movements_filter` | `is_voided=0` / `reference_type='csv_import'` filter 除去 mutant |
| 24 §14.13a error rows | 0 件で error / 順序不定 | unit (Rust) | T4 `test_list_csv_import_error_rows_req206_order_and_empty`（0 件 case + N 件 case。**N 件 case が非空期待の主 oracle** — 空集合 oracle 衝突の回避、順22 X2 教訓） | ORDER BY 除去・0 件 error 化 mutant |
| 32 §15.6a NotFound 変換 | DatabaseError 化 / 文言喪失 | unit (Rust) | T5 `test_get_csv_import_record_req206_not_found_message` | NotFound → DatabaseError に落とす mutant |
| 32 §15.6a ErrorRow 写像 + enum 変換 | field 取り違え / 変換固定値化 | unit (Rust) | T6 `test_get_csv_import_record_req206_error_row_mapping`（4 error_type 全値 + line_no/name mapping + file_hash 非搭載 assert） | error_type を固定値にする / line_no に id を入れる mutant |
| 32 §15.6a source 補完 | label/route drift | unit (Rust) | T7 `test_get_csv_import_record_req207_movement_source`（label「CSV取込み #n」/ route `/csv-import/records/n` の独立転記 exact oracle） | resolve_movement_source 非経由の複製・label 改変 mutant |
| 41 §17.5 CMD 変換 | kind 誤り | integration (Rust, production command 実呼び — 順5 規範、mock 禁止) | T8 `test_get_csv_import_record_cmd_req206_not_found_kind` | kind="not_found" 以外を返す mutant |
| 65 §65.5 表示項目 + §65.6.1 状態正規化 | 必須項目欠落・raw status 表示 | RTL | T9 `CsvImportRecordDetailPage` 表示 test（completed / completed_partial 両状態、明細・エラー行・movements・商品 link） | 表示項目の脱落・label 正規化の欠落 |
| 66 UI-06c-D7 到達導線 | click しても遷移しない | RTL + userEvent.click | T10 movements link click → SPA 遷移後の詳細 render assert（**href assert 単独は不可** — batch A X3 survivor 教訓） | route path 改変・link 非活性化 mutant |
| NotFound UI | error が空白画面になる | RTL | T11 不存在 id での利用者向け日本語 error 表示 | describeError 非経由・error 握りつぶし |
| rolled_back 表示 | 状態・明細・movements の誤表示 | RTL | T12 rolled_back fixture で「取消済み」label + movements 0 件正常 + voided 明細表示 | is_voided 恒偽化・0 件 error 化 mutant |
| returnTo | 外部 URL 通過・条件喪失 | RTL | T13 returnTo 保持戻り + 不正値 fallback（既存 4 詳細の test pattern 踏襲） | validateSearch 除去・fallback 除去 |
| D-052 C9 oracle | invalidation 欠落・過剰 | unit (TS、独立転記 oracle、production SSOT 非 import — 既存静的 gate 継承) | T14 csvImportRollback 新集合の順序非依存・重複検出付き完全一致 | SSOT から新規行を削る / 余分な key を足す mutant |
| query key 直書き 0 | literal 復活 | unit (TS、既存 sweep pattern) | T15 csvImportDetail key の literal sweep | page/hook に生 key 配列を書く実装 |
| Amendment 1: 既存 `/csv-import` 取込み画面の index route 描画 | layout 化で既存取込み画面が描画されなくなる | RTL (runtime route test) | T16 `/csv-import` 直接進入で CsvImportPage が従来どおり描画される回帰 test | index 移設漏れ・layout の Outlet 欠落 |
| Amendment 2: ErrorRowsTable accordion の発見性（owner L3 P3 起源） | 閉時に操作部と認識できない / 開閉文言が切り替わらない / click・keyboard 操作の退行 | RTL | T17 閉状態で「エラー詳細を見る（N件）」の trigger button が可視 → click で table 展開 + 「エラー詳細を閉じる（N件）」へ切替 → 再 click で閉じる（keyboard 操作は Radix Trigger の button semantics で担保） | 文言を件数のみへ戻す・開閉切替の欠落・trigger の button role 喪失 |

## State Lifecycle Matrix

対象 state: 詳細 query（`queryKeys.inventoryRecords.csvImportDetail(importId)`）+ 画面表示

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 詳細 query / 画面 | 未 fetch（直接 URL 進入含む） | loading 表示（既存 4 詳細と同形） | §65.5 項目表示（T9） | rollback 成功で D-052 SSOT 経由 stale 化（T14） | 再表示で rolled_back 状態へ更新（T12 が終状態を固定） | returnTo 戻り→再訪で検索条件保持（T13） | アプリ再起動後も直接 URL で表示可（route 生成 AC5） | NotFound / DB error → describeError 表示（T11） | TanStack Query 既定 retry 後 error 確定（既存 4 詳細と同設定） | Matrix + PR body |

- workflow-state 行（本 packet の遷移運用）:
  - content candidate → L1 / independent review → state-only human-confirm commit（STATECAP 3/PR、correction ループ時は content commit 同乗を優先 — batch A 教訓）
  - owner authorization → Draft state-only Ready commit → exact-HEAD L1 → PR body → Ready/dispatch → merge（三点一致）
  - state-only violation: file allowlist + zero-context hunk の両検査
  - hosted failure: product/gate failure は implementing へ返す

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| returnTo validateSearch（`z.string().max(500).optional().catch(undefined)`） | `receiving.records.$recordId.tsx` / `disposal/records/$recordId.tsx` / `return.records.$recordId.tsx` / `manual-sale.records.$recordId.tsx`（4 site 全列挙） | 新 route 1 site | — | T13 |
| `queryKeys.inventoryRecords.*Detail` | receivingDetail / returnDetail / manualSaleDetail / disposalDetail（4 key） | csvImportDetail 追加 | — | T15 |
| 詳細 Page 構造（useQuery + describeError + 戻り導線 + 商品 link） | 既存 4 RecordDetailPage | CsvImportRecordDetailPage | rollback CTA は移植しない（UI-07 責務、packet 非目的） | T9 / T11 |
| internal `<Link>` 統一（batch A） | 既存 19 site 統一済み | 新規 link は `<Link>` のみ | — | T10 |
| 状態 label 正規化（65 §65.6.1） | 既存 status label 表示箇所（55 取込み履歴 recent list） | 詳細 header | recent list の label 実装と文言一致を実装時に突合（drift 防止） | T9 |
| production command 実呼び test（順5 規範） | 既存 4 詳細の CMD test | T8 | — | T8 |
| layout + index route 構造（Amendment 1） | `receiving.tsx`+`receiving/index.tsx` / `return.tsx`+`return/index.tsx` / `manual-sale.tsx`+`manual-sale/index.tsx` / `disposal.tsx`+`disposal/index.tsx`（4 site 全列挙） | `csv-import.tsx`（layout 化）+ `csv-import/index.tsx`（新設） | — | T16 / T10 |

## Negative Paths

- missing input: import_id 欠落は route param 必須のため型レベルで防止（TanStack Router）
- invalid input: 数値でない importId 文字列 → `Number()` NaN → NotFound 経路（既存 4 詳細と同挙動、T11 系）
- duplicate/ambiguous input: なし（PK 単一取得）
- unknown reference: 存在しない import_id → T1 / T5 / T8 / T11
- dependency missing: products / departments JOIN 欠損行は LEFT JOIN で name 欠落を許容するか実装時に既存 4 詳細の JOIN 方針へ揃える（canonical 踏襲）
- permission/write failure: read-only のため該当なし
- dry-run side effect: 該当なし（書込みなし）

## Boundary Checks

- threshold: なし（pagination なしの単一取得）
- null/default: normalized_jan NULL、note 系なし（CSV 詳細に note field なし）
- empty/non-empty: エラー行 0/N（T4）、movements 0/N（T3/T12）、明細 0 件は commit 契約上発生しない（total_items >= 1）が空でも panic しないこと
- min/max: 明細大量時の表示は既存 4 詳細と同様に非 pagination 全行表示（§65.5 準拠）
- status/policy enum: CsvImportStatus 3 値全 case（T9/T12）、CsvImportErrorType 4 値全 case（T6）
- wire type: CsvImportRecordDetail（AC4 bindings diff）
- internal type: CsvImportRecordDetailCore（IO）/ wire DTO（BIZ）分離
- producer/consumer: CMD → Page 単一経路
- round-trip token: 該当なし（read-only）
- precision/range: i64 金額・id、JS safe integer 内
- cross-language parse: snake_case field / enum union の bindings 生成（AC4）

## Compatibility Checks

- old schema/input: schema 変更なし。既存 csv_imports 行（過去取込み分）がそのまま表示可能
- new schema/input: なし
- output order: 明細 id ASC / エラー行 source_line_no ASC（T2/T4）
- optional field behavior: normalized_jan Option の表示（None 時は空欄 or 「—」、canonical 踏襲）

## Data Safety Checks

- source-derived data: test fixture は synthetic のみ（実 POS CSV / 実売上値の転記禁止）
- generated outputs: bindings.ts / routeTree.gen.ts / 90-traceability.md は生成コマンド経由のみ（手動編集禁止）
- secrets: 該当なし
- local-only files: `.local/ci-evidence/`
- synthetic sample boundaries: L3 fixture は synthetic Z004（既存慣行）。手順を PR body に記載

## Main Wiring / Integration Checks

- helper connected to main path: collect_commands 登録 → bindings 生成 → `commands.getCsvImportRecord` 呼出し（AC4/AC6 で end-to-end）
- output reaches manifest/report: routeTree.gen.ts に route 生成（AC5）
- effective config reaches runtime: 該当なし
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- mock 値と設計期待値の弁別: T7 の source oracle・T14 の invalidation oracle は独立転記 exact 比較で、production 定数を import しない（D-052 既存 gate + 順6 教訓）
- invalidate/refetch 順序: rollback → stale → 再表示で rolled_back へ更新（T12 + T14 の組で lifecycle を固定）
- key branch 反転: NotFound 分岐（T1/T5/T8）、is_voided filter（T2/T3）
- threshold 変更: 該当なし
- guard 除去: validateSearch returnTo guard（T13）
- output field 省略: file_hash 非搭載 assert + 表示項目（T6/T9）
- 出力順序変更: T2/T4
- JSON safe integer: 既存 wire と同等のため既存検査を継承

## 必須 mutation 注入（Final Review で clean tree 独立再実測、5 件級以上）

| ID | 注入 | red になるべき test |
|---|---|---|
| X1 | BIZ NotFound 変換を DatabaseError 化 | T5 / T8 |
| X2 | IO movements の `is_voided=0` filter 除去 | T3 |
| X3 | movements link の遷移先 route 文字列を改変 | T10（click 遷移 assert が検出。href-only assert では素通りするため不可） |
| X4 | invalidation-contract の csvImportRollback 新規 key 除去 | T14 |
| X5 | ErrorRow 写像の error_type を固定値化 | T6 |
| X6 | 明細 DTO の is_voided 恒偽化 | T12 |
| X7 | source 補完 label を別文字列へ改変 | T7 |

- 注入は commit 済み clean tree 上でのみ実施（未 commit 是正の消失防止 — PR #19 教訓）
- Writer の kill 主張は Final Review / Coordinator が Matrix どおりの実注入で独立再現する（順6 X3 / PR #27 X7 / 順22 X2 の教訓）

## Residual Test Gaps

- L3 視認（実表示の見た目・日本語 wording の適切さ）は自動 test で代替不能 → Human Gate
- 実データ規模（数百明細）での表示性能は測定しない（既存 4 詳細と同構造のため同等と推定、`未実測`）
- CSV 出力 / 印刷 / 一覧 route は slice 6 / 後続スライスへ deferred
