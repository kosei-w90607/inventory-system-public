# Test Design Matrix: UI-11c 操作ログ画面

> Design Phase 出典: [archived plan](../2026-07-11-ui11c-operation-logs.md)、[docs/function-design/74-ui-operation-logs.md](../../../function-design/74-ui-operation-logs.md)
> 本 Matrix は Design Phase 完了時点で作成する。実装は禁止（Rust/React コード変更なし）。実装 PR がこの Matrix に沿ってテストを追加する。

## Risk

Risk: R3

## Contracts Under Test

- UI-11c-D1: URL search state（`start_date`/`end_date`/`operation_type`/`page`、filter変更でpage=1）
- UI-11c-D2: JST 暦日 inclusive/exclusive 期間 predicate、逆転範囲 validation
- UI-11c-D3: `LogQuery` 拡張の row/count predicate 同一性、既存呼び出し互換
- UI-11c-D4: 新規 `list_log_operation_types` + `find_distinct_operation_types`（保持中ログ全体の distinct）、frontend registry の未知値 fallback
- UI-11c-D5: 明示的な「詳細を表示／閉じる」button展開（単一展開、native Enter/Space、related-record link非toggle）
- UI-11c-D6: detail_json 安全表示（既知field要約、折りたたみraw JSON、null/空/不正JSON/巨大payload）
- UI-11c-D7: 関連業務記録リンクの明示 contract（typed許可リスト、record_id positive safe integer、安全fallback）
- UI-11c-D8: pagination（per_page=20固定、範囲外page回復）
- UI-11c-D9: empty 2系統（既定filter一致 vs filter適用中）+ error/retry（filter保持）
- UI-11c-D10: lifecycle/staleTime（`staleTime: 0`、ポーリングなし）
- UI-11c-D11: a11y（IME非適用、非色状態表示、keyboard）
- UI-11c-D12: REQ-902/905 traceability 是正（既存3テストの是正）

## Failure Modes

- 期間 filter が row query にのみ適用され count query に適用されない（total_count と表示件数の矛盾）
- 逆転範囲がエラーにならず空結果や誤った範囲で検索される
- operation_type 候補が現在ページ/現在の filter 済み結果から生成される（未出現の値が選べない）
- 展開行が複数同時に開いたままになる、または展開状態が filter/page 変更後も残る
- detail_json の不正JSON/巨大payloadでUIがクラッシュ、またはHTMLとして解釈される
- 関連記録リンクが任意JSON keyのheuristic一致で誤表示される、または`record_id<=0`でも表示される
- 範囲外pageで空白/クラッシュになり回復導線がない
- 巨大なpositive pageのoffsetを`u32`上で計算してpanicまたはwrapする
- 「ログ0件」と「filter該当0件」の文言が区別されない
- retryボタンが現在のfilterを破棄してしまう
- 既存 `test_list_logs_req905_*` が是正されないまま残り、traceability driftが継続する

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-11c-D3 | count query が期間条件を反映しない | integration (Rust, `system_repo`) | `test_list_operation_logs_req902_date_range_row_count_predicate_equivalence` | `total_count` が期間filter適用前後で変化しない、または `items` と矛盾する件数を返す |
| UI-11c-D2 | 片側指定が機能しない | integration (Rust) | `test_list_operation_logs_req902_one_sided_and_end_exclusive`（start側assertion） | `end_date` 省略時に `start_date` 以降が正しく絞られない |
| UI-11c-D2 | 片側指定が機能しない | integration (Rust) | `test_list_operation_logs_req902_one_sided_and_end_exclusive`（end側assertion） | `start_date` 省略時に `end_date` 未満（翌日境界）が正しく絞られない |
| UI-11c-D2 | JST境界がoff-by-oneになる | integration (Rust) | `test_list_operation_logs_req902_one_sided_and_end_exclusive`（end-exclusive assertion） | `end_date` 当日 `T00:00:00` ちょうどのログが含まれてしまう、または前日23:59:59.999のログが漏れる |
| UI-11c-D2/D3 | 両方省略時に既存動作が変わる | regression (Rust) | `test_list_operation_logs_req902_filter_type` | 日付を両方省略した既存operation_type filterのitems/total_countが変わる |
| UI-11c-D2 | 逆転範囲がエラーにならない | validation (Rust, CMD層) | `test_list_logs_req902_date_validation_contract`（reversed assertion） | `start_date > end_date` でvalidation errorにならない |
| UI-11c-D2 | CMDが片側だけ非strict日付を受理する | validation (Rust, CMD層) | `test_list_logs_req902_date_validation_contract`（`start_date` / `end_date` × non-zero-padded / suffix / whitespace / separator / invalid-calendar / Unicode-digit matrix） | start/endどちらか一方だけvalidationを外すmutationで該当field caseがREDにならない |
| UI-11c-D4 | distinct が重複を除去しない | integration (Rust) | `test_find_distinct_operation_types_req902_dedup_order_unknown_and_empty`（dedup/order/unknown assertions） | 同一 operation_type の複数行があるとき返り値に重複が残る、未知値が失われる、または昇順にならない |
| UI-11c-D4 | 候補が0件のログで例外になる | unit (Rust) | `test_find_distinct_operation_types_req902_dedup_order_unknown_and_empty`（empty assertion） | `operation_logs` が空のとき `Err` になる（`Ok(vec![])` であるべき） |
| UI-11c-D4 | 未知値がフィルタから除外される/クラッシュする | RTL | `UI-11c REQ-902 shows unknown operation_type as raw fallback grouped as その他` | registry 未収載の値が選択肢から消える、または展開時に例外になる |
| UI-11c-D1/D2 | 片側URLまたはclear状態が既定rangeへ戻る | RTL / route unit | `preserves explicit one-sided and fully-cleared date URL states`、`sends one-sided URL bounds to CMD without restoring the missing side`、`keeps one-sided bounds when a date input is cleared`、`keeps the start-only bound when the end date is cleared`、route `round-trips explicit one-sided and fully-cleared date states` | start only/end only/both clearがrestart/revisit後に既定rangeへ戻る、またはCMDの欠落側が`null`でない |
| UI-11c-D1 | filter変更でpageがリセットされない | RTL | `resets page and preserves other filters when 開始日 changes`、`...終了日 changes`、`resets page and preserves date filters when operation type changes` | start/end/typeの各handlerだけがpageを保持するmutationでgreenになる |
| UI-11c-D1 | 不正URL値がfallbackしない | route unit + RTL | route `drops malformed dates and invalid pages...`、`normalizes the initial search...` | 不正な非空日付がCMDに渡る、または両日付不正時に初期30日rangeへfallbackしない |
| UI-11c-D2/D10 | 逆転rangeが直前の一覧/paginationを破壊する、またはCMDを呼ぶ | RTL | `keeps the last valid list and expanded row while an inverted range is corrected`（page=3、total_count=45、per_page=20） | inline error時にCMD callが増える、table/expanded row/page番号/total_count/前後controlsが消える、`page={effectiveSearch.page}`をdraft normalized pageへ戻してもgreen、またはvalid復帰時に再取得しない |
| UI-11c-D5 | visible label / accessible name / native keyboard activationが崩れる | RTL | `toggles detail exactly once through native Enter and Space keyboard paths` | 閉状態「詳細を表示」/開状態「詳細を閉じる」の可視textまたはaccessible nameがなくなる、Enter/Spaceで一度だけtoggleしない |
| UI-11c-D5 | 複数行が同時展開される、またはrelated-record linkでtoggleする | RTL | `keeps only one row expanded and does not toggle it when its related-record link is clicked` | 2行目を展開しても1行目が残る、または行内link押下で意図せず閉じる |
| UI-11c-D6 | 不正JSONで要約が誤表示される | RTL | `UI-11c REQ-902 shows parse-failure message and raw string for invalid detail_json` | 不正JSONで例外になる、またはparseできたかのような要約が出る |
| UI-11c-D6 | nullで折りたたみが出る | RTL | `UI-11c REQ-902 handles null and invalid detail JSON safely`（null negative assertion） | `detail_json` が `null` でも「技術情報（JSON）」トグルが表示される |
| UI-11c-D6 | 巨大payloadでDOMが肥大化する | RTL | `UI-11c REQ-902 truncates known-field summary and raw JSON beyond size limits` | 20 key超/50,000文字超のpayloadで全文がDOMに描画される |
| UI-11c-D6 | HTMLとして解釈される | RTL | `UI-11c REQ-902 renders detail_json values as text only never as HTML` | `<script>` 等を含む合成値がテキストでなくHTMLとして解釈される |
| UI-11c-D6 | 既知/未知keyの区別が効かない | RTL | `UI-11c REQ-902 labels known detail_json keys in Japanese and shows unknown keys as raw key name` | 既知keyと未知keyが同じ見た目になる |
| UI-11c-D7 | invalid ID / typeでもリンクが出る | RTL parameterized | `hides the related-record link for zero / negative / fractional / numeric string / unsafe integer / unknown record_type / missing record_type / missing record_id` | `> 0`、`Number.isSafeInteger`、非coercion、typed allowlist、required-field guardのいずれかを外しても該当caseがREDにならない |
| UI-11c-D7 | 許可リスト内かつpositive safe integerでリンクが出ない | RTL | `shows the related-record link for a positive safe integer and typed allowlist value` | 正しい contract でもリンクが表示されない（機能欠落側の回帰） |
| UI-11c-D8 | 範囲外pageで回復導線が出ない | RTL | `UI-11c REQ-902 shows out-of-range page recovery when items empty but total_count positive` | `items: []` かつ `total_count > 0` かつ `page > 1` で通常のEmptyStateと区別されない |
| UI-11c-D8 | 範囲外pageの回復ボタンが機能しない | RTL | `UI-11c REQ-902 returns to page 1 when recovery button is clicked` | ボタン押下後も `page` が1に戻らない |
| UI-11c-D8 | 巨大なpositive pageでoffsetがoverflowする | integration (Rust, `system_repo`) + route unit + RTL | `test_list_operation_logs_req902_max_page_returns_empty_without_overflow`、route `round-trips the largest positive page accepted by the u32 command wire`、RTL `requests the largest positive u32 page and presents out-of-range recovery` | `page/per_page`を`i64`へ変換する前に乗算してdebug panic/release wrapする、u32 wire最大値がrouteからCMDへ届かない、または空結果の回復導線が出ない |
| UI-11c-D9 | 空系統2つが区別されない | RTL | `UI-11c REQ-902 shows different empty copy for default-range-empty versus filtered-empty` | 既定filter0件とfilter適用0件で同一文言になる |
| UI-11c-D9 | retryでfilterが失われる | RTL | `UI-11c REQ-902 retry preserves current filters and retriggers the same query` | 再試行後に `start_date`/`end_date`/`operation_type` がクリアされる、または別queryが呼ばれる |
| UI-11c-D9 | typesQuery失敗が一覧全体を止める | RTL | `UI-11c REQ-902 keeps log list functional when operation type registry query fails` | `list_log_operation_types` 失敗時に一覧本体まで表示されなくなる |
| UI-11c-D11 | 非色以外の状態伝達がない | RTL | `UI-11c REQ-902 conveys known and unknown operation types with visible badge text, not color alone` | 既知値の日本語labelまたは未知値の「その他（raw value）」がBadgeの可視textから失われる |
| UI-11c-D1/D9 | 深夜境界で検索条件と既定empty判定の「今日」がずれる | RTL | `UI-11c REQ-902 uses one captured today for the backend query and default empty-state decision` | 1 render内の2つの正規化へ同一`now`が渡されず、queryとempty-state判定が別暦日を参照する |
| UI-11c-D12 | 既存CMDテストのREQ是正漏れ | grep / traceability | `cd src-tauri && cargo run --bin generate_traceability -- --check` | `req905` を含む `list_logs` 系テスト名が実装PR後も残存する |
| route/navigation | route未到達（型は通るがnavigationが未活性） | typecheck / route generation | `npm run typecheck` | `/settings/logs` が生成route型に現れない |
| route/navigation | navigationが`pending`のまま活性化されない | unit (`navigation.ts`) | `navigation config REQ-902 marks ui-11c as active with to: "/settings/logs"` | `ui-11c` の `status` が `"pending"` のまま、または `to` が `null` のままでも `npm run typecheck` は通過してしまうため、`navigation.ts` の該当エントリを直接 assertion する専用テストで検出する |
| Windows L3 | 実機挙動が未確認 | manual L3 | `UI-11c-L3-1..8`（74-ui-operation-logs.md §74.15、L3-7 exclusive-lock / L3-8 synthetic setup） | 期間/種別filter、展開、関連リンク、範囲外page、retry、empty2系統の視認性が owner 未確認 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| ログ一覧 (`logsQuery`) | 両日付未指定なら既定filter（today-29..today、全種別、page=1）、片側/clear URLはそのまま自動取得 | Skeleton 3行 | table + pagination 表示 | validなfilter/page変更でqueryKey変化、自動再取得 | `staleTime:0` のため mount毎・valid filter変更毎に再取得 | 別filterから戻ると新しいqueryKeyで再取得（前回展開状態は破棄） | app再起動後もURLの片側/clear状態を尊重。両日付未指定だけ既定range | destructive Alert + 現在filter保持。逆転rangeはCMDなし・直前valid table/pagination/展開行を保持 | lock解除後「再試行」で同じfilterを`refetch()`。逆転rangeをvalidへ戻すと新effective keyで再取得 | RTL `keeps the last valid list...`、one-sided / retry assertions |
| operation_type 候補 (`typesQuery`) | mount時に自動取得（フィルタ非依存） | 一覧本体の表示をブロックしない | select選択肢を実在値に更新 | 明示invalidateなし（新規登録時は次回mount/再訪で自然反映） | `staleTime:0` | 再訪時に再取得 | ポーリングなし | 一覧本体は独立して表示継続、select は現在URL値を温存 | 個別retryボタンは持たない（一覧のretryとは独立） | RTL `UI-11c REQ-902 keeps log list functional when operation type registry query fails` |
| 行展開状態 | 全行のbuttonが可視text「詳細を表示」 | — | button click/native Enter/Spaceで対象行のみ開き、可視text「詳細を閉じる」 | valid filter/page変更でリセット | — | 別ページ訪問後に戻ると閉じた状態から再開 | app再起動で必ず閉じた状態 | related-record link押下ではtoggleしない | — | RTL `toggles detail exactly once...`、`keeps only one row expanded...` |
| page（範囲外） | 通常pageの範囲内 | — | — | — | — | — | — | `items:[] && total_count>0 && page>1` で回復導線表示 | 「先頭ページに戻る」で `page=1` に強制更新 | RTL `UI-11c REQ-902 shows out-of-range page recovery...` |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| URL search state（zod `.regex().optional().catch(undefined)`） | `src/routes/inventory/records.tsx`、`src/features/stock-movements/types.ts` | `src/routes/settings/logs.tsx`（実装PR）、`OperationLogsSearch` | なし（全面再利用） | route unit test |
| filter変更でpage=1 | `InventoryRecordsPage.tsx` `updateSearch(patch, resetPage=true)`、`StockMovementsPage.tsx` 同型 | `OperationLogsPage` 同型 `updateSearch` | なし | RTL `resets page to 1...` |
| pagination（`ProductPagination`固定20件） | `InventoryRecordsPage.tsx`、`StockMovementsPage.tsx` | 同一component再利用 | per-page選択肢は追加しない（siblingと同様） | 既存 `ProductPagination.test.tsx` + 本画面RTL |
| retry ボタン（Alert内`onClick={() => void query.refetch()}`） | `DailySalesPage.tsx`、`MonthlySalesPage.tsx`、`ThresholdSettingsPage.tsx`、`StocktakePage.tsx` | `OperationLogsPage`（新規適用） | `StockMovementsPage`/`InventoryRecordsPage` にはretryがなく踏襲元にしない（意図的差異、Missing UI item 9 の明示要求） | RTL `retry preserves current filters...` |
| 期間 predicate（`date_to + T23:59:59`） | `inventory_repo.rs::list_movements` | **意図的に非採用**。JST inclusive/exclusive 新規 predicate を採用（D-037） | 既存 movement/records 画面は変更しない | Rust `test_list_operation_logs_req902_one_sided_and_end_exclusive` |
| 行展開（accordion的disclosure） | 既存コードベースに踏襲元なし（`ProductListTable.tsx` コメントで `aria-expanded` 依存を明示的に避けた記述あり） | 明示的なnative button + `aria-expanded`/`aria-controls` を採用 | 行全体clickはrelated-record link競合防止のため不採用 | RTL `toggles detail exactly once through native Enter and Space keyboard paths`、`keeps only one row expanded and does not toggle it when its related-record link is clicked` |
| IME `isComposing` guard | `InventoryRecordsPage.tsx` 商品名検索欄 | **非適用**。UI-11c は自由入力欄を持たない（`<select>`のみ） | 対象入力欄が存在しないため | 該当なし（74-ui-operation-logs.md §74.13 に明記） |

## Negative Paths

- missing input: `start_date`/`end_date`/`operation_type` 全て未指定（既定30日・全種別で正常表示）、片側のみ未指定（片側CMD `null`）、両方明示clear（CMD両方`null`）
- invalid input: 不正な日付形式、逆転範囲、URL上の不正 `page`（0、負数、非数値）
- duplicate/ambiguous input: 同一 `operation_type` が distinct query で複数回登場するケース
- unknown reference: 許可リスト外 `record_type`、未収載 `operation_type`
- dependency missing: `typesQuery` 失敗時の一覧本体独立動作
- permission/write failure: 該当なし（本画面はread-onlyでwrite操作を持たない）
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: detail_json 既知field要約20 key上限、raw JSON 50,000文字上限、判定文字列長10,000文字
- null/default: `detail_json: null`、`start_date`/`end_date` 両方省略
- empty/non-empty: `operation_logs` 0件、distinct 0件
- min/max: `record_id` 0/負数/小数/正の最小値1/`Number.MAX_SAFE_INTEGER`超過/numeric string、`page` 0/1/範囲外/u32最大値（IO offsetはi64計算）
- status/policy enum: `record_type` 許可リスト4値 + 許可リスト外値
- wire type: `LogQuery.start_date`/`end_date` を `Option<String>` → 生成TS `string | null`
- internal type: `system_repo::list_operation_logs` の `Option<&str>` 引数
- producer/consumer: `find_distinct_operation_types`（producer=IO）→ `list_log_operation_types`（CMD）→ frontend registry 突合
- round-trip token: URL search ↔ `NormalizedOperationLogsSearch` ↔ `LogQuery`
- precision/range: JST暦日境界（秒精度依存の解消、D-037）
- cross-language parse: Rust `chrono` 日付parse vs frontend `YYYY-MM-DD` regex

## Compatibility Checks

- old schema/input: 既存3テスト（`test_list_logs_req905_*`）は `start_date`/`end_date` を渡さない呼び出し（`None`固定）で通過し続けること
- new schema/input: `LogQuery` に2フィールド追加後の生成binding再生成、`src/lib/bindings.ts` diffの確認
- output order: `ORDER BY created_at DESC, id DESC` は期間filter追加後も不変
- optional field behavior: `start_date`/`end_date` 両方 `None` で既存 `PaginatedResult` 出力が完全一致

## Data Safety Checks

- source-derived data: 実operation log/detail JSON/店舗データを fixture・スクリーンショット・docsに含めない
- generated outputs: `src/lib/bindings.ts` 再生成diffのみ確認、実データは含まない
- secrets: 該当なし
- local-only files: 該当なし
- synthetic sample boundaries: detail_json のnull/空/不正JSON/巨大payload/既知key/未知keyはすべてsynthetic値で構成する

## Main Wiring / Integration Checks

- helper connected to main path: `find_distinct_operation_types` → `list_log_operation_types` CMD → `commands.listLogOperationTypes()` → `typesQuery` → select選択肢
- output reaches manifest/report: 該当なし（レポート出力なし、閲覧MVP）
- effective config reaches runtime: 該当なし
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant? → `test_list_operation_logs_req902_date_range_row_count_predicate_equivalence` は実SQLite接続でtotal_countが期間変更に応じて実際に変動することを確認し、固定値モックでは検出できないようにする。
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct? → `keeps the last valid list and expanded row while an inverted range is corrected` が、page=3 / total=45のinvalid draftではCMDを呼ばずtable / expanded row / page / total / controlsを保持し、valid復帰だけで新queryを取得する。`page={normalized.page}` mutationでRED確認済み。
- If one CMD boundary field bypasses validation? → `test_list_logs_req902_date_validation_contract` のstart/end別matrixが失敗する。end側parse bypass mutationでend caseがREDになることを確認済み。
- If a threshold/safe-integer guard changes? → parameterized `hides the related-record link for ...` が失敗する。`> 0` + `Number.isSafeInteger`削除でnegative/fractional/unsafe cases、numeric string coercion mutationでnumeric-string caseがRED確認済み。
- If a guard is removed (record_type allow-list check)? → 同parameterized testのunknown `record_type` caseが失敗する。
- If an output field is omitted (detail_json known-field label)? → `labels known detail_json keys in Japanese and shows unknown keys as raw key name` が失敗する。
- If output order changes (distinct operation_type ordering)? → `test_find_distinct_operation_types_req902_dedup_order_unknown_and_empty` が失敗する。
- If a JSON number crosses JavaScript safe integer range? → unsafe integer caseが`Number.isSafeInteger`削除mutationをREDにするため、follow-upではなくactual coverage済み。
- If a state token is round-tripped through browser/client code (URL search state)? → one-sided/clear route testと`preserves explicit one-sided and fully-cleared date URL states`が失敗する。start/end/typeの各page-reset handler mutationは対応する3 RTL caseだけをREDにする。

## Current implementation / review status (2026-07-12)

- Workflow State is `implementing`; PR #164 remains Draft. Windows native L3-1..8, owner visual confirmation / Ready, hosted final, and merge are not performed.
- The latest fresh Sol High re-audit reported P1=0 / P2=1 / P3=1. Its remediation content is committed and the current exact-HEAD CLEAN full is complete; the current SHA and full evidence live only in the PR body under D-035. Closure re-audit is pending.
- D5 actual evidence remains the existing RTL coverage for visible 「詳細を表示／詳細を閉じる」text and accessible name, native Enter / Space, single expansion, and related-record link non-toggle. The active source docs are synchronized to that implemented contract; no runtime or test change is claimed here.
- L3-8 has not been executed. Every setup/cleanup/restore `sqlite3` call stores and checks `$LASTEXITCODE` immediately. Any failure after the temporary setting change flows through the outer `finally`; cleanup and restore errors are retained separately; an inner `finally` always attempts `backup_enabled` restoration even when cleanup execution/parse/assert fails. After both paths run, PowerShell throws unless `deleted_rows=1`, synthetic remaining count = 0, `backup_enabled` equals its captured original value, and the clean demo DB returns to the default-empty all-log count of 0. A failed cleanup or setting restore is not an L3 pass.

## Residual Test Gaps

- BIZ producer側（`csv_import_service`等）への `record_type`/`record_id` 付与は本 Design Phase の scope外。実装時点でこの2フィールドを書き込む producer が存在しないため、関連記録リンクの「表示される」ケースは synthetic fixture でのみ検証され、実producerとの統合テストは follow-up 実装まで存在しない。
- detail_json 既知field日本語ラベル辞書は初期実装時点で限定的（backup系中心）。商品修正等「変更前後」フィールドの辞書拡張は実装時の棚卸し対象であり、本Matrixは初期辞書の範囲のみを検証する。
- `csv_import` / `stocktake` record_type は対応詳細routeが未実装のため、許可リストに含めた場合のテストは書けない（routeが実装されてから追加する）。
