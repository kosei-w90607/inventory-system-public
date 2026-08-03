# Test Design Matrix — UI backlog 消化 batch B

## Risk

Risk: R3

## Contracts Under Test

- SPEC-UIBB-1: filter-empty reset action の表示条件（絞り込み非既定 + 0 件のみ、reset 対象 6 site 共通）
- SPEC-UIBB-2: reset 押下の全条件既定値復帰（site 別 tuple、page 含む。並び替え・表示件数は不変）
- SPEC-UIBB-3: 在庫照会 `page` search param の検証契約（>=1、invalid catch → 1）
- SPEC-UIBB-4: 条件変更 → page=1 / page 移動 → 条件維持
- SPEC-UIBB-5: 「すべて」全件ページ到達 + `TruncatedResultsAlert` 撤去
- SPEC-UIBB-6: `DepartmentOption` SSOT（patterns 1 箇所定義 + feature re-export、方式はファイル別）
- SPEC-UIBB-7: FilePicker catalog 登録の責務分離（02 = 構造/トークン/Do-Don't、§6.5.4 = behavior/API 正本、二重記述なし）
- SPEC-UIBB-8: 在庫照会の範囲外 page 回復（UI-11c-D8 同型、通常 EmptyState / reset より優先判定）
- SPEC-UIBB-9: 部門候補 = `listDepartments()` master 全件（DSR-10、page/q/dept/status 非依存）
- SPEC-UIBB-10（amendment）: 商品一覧検索欄の live 型統一（debounce 200 / Enter 即時 / IME guard / page reset — `selected` は本画面 URL schema に不在のため対象外 / 外付け UI なし）
- SPEC-UIBB-11（amendment）: EmptyState action 複数ボタンの中央揃え + 順序維持
- 02 ⑥ 適用除外の非回帰（分類表除外(a)〜(d) 19 site。packet Scope(1) の全数分類表を正とする）
- 50 §50.4 非破壊（products 画面の既存 page 挙動不変）

## Reset 対象 site 別 tuple（SPEC-UIBB-2 の個別 assert 対象）

各 site の test は tuple の**全項目**を個別 assert する（1 項目でも戻し忘れる mutant を殺す）。

| site | reset で既定値へ戻す tuple | page | 共存 action |
|---|---|---|---|
| StocktakePage | 部門フィルタ、未入力のみ表示 toggle | あり（`StocktakeSearch.page` 既存 param、既定 1。round 2 P2-1 で追加） | なし |
| StockInquiryPage | q、dept、status | あり（page=1、URL param 除去） | なし（復帰後は EmptySearchPlaceholder） |
| InventoryRecordsPage | 65 §65.4.1 の検索条件（recordType / dateFrom / dateTo / q / recordId / departmentId / status） | あり | なし |
| StockMovementsPage | dateFrom、dateTo、type | あり | なし |
| OperationLogsPage | start_date、end_date、operation_type（既存 defaultFilter 非既定側のみ表示） | あり | 範囲外 page 回復（別 semantic、優先判定） |
| ProductListPage | q、dept、discontinued（sort / dir / perPage は**戻さない**ことも assert） | あり | 「商品を登録する」常設（既定 0 件 = 登録のみ / 非既定 0 件 = 登録 + reset の 2 ボタン） |

## Failure Modes

- reset が一部フィルタのみ復帰（例: dept は戻るが status チップが残る）
- reset が既定値 0 件（真にデータなし）でも表示される
- reset 押下で page が残り、復帰後に空ページを表示
- 条件変更時に page が保持され、範囲外 page で空表示
- invalid page param が画面エラーや NaN 表示になる
- pagination が mock の固定値に結線され実 `total_count` を使わない
- truncated alert が残存し「打ち切り告知 + ページ送り」の二重表現になる
- DepartmentOption ローカル定義が残存し将来の定義 drift を許す
- receiving の明細空 EmptyState に reset が誤適用される
- 02 と §6.5.4 の二重記述で正本が分裂する

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-UIBB-1 | 非既定 + 0 件で action 不在 | unit (RTL) | 各画面 `*Page.test.tsx` `SPEC-UIBB-1 絞り込み該当なしで解除ボタンを表示する`（6 site 各 1） | action 結線漏れ・表示条件の分岐欠落 |
| SPEC-UIBB-1 | 既定 0 件で action 誤表示 | unit (RTL, negative) | 同 `SPEC-UIBB-1 既定条件の0件では解除ボタンを出さない`（6 site 各 1。ProductList は「登録のみ表示」を assert） | 非既定判定の欠落・恒真化 |
| SPEC-UIBB-2 | 一部フィルタのみ復帰 | unit (RTL) | 同 `SPEC-UIBB-2 解除で全条件が既定値に戻る`（site 別 tuple 表の全項目を個別 assert） | 復帰対象の列挙漏れ（1 条件でも戻し忘れ） |
| SPEC-UIBB-2 | page 残存 | unit (RTL) | reset 対象 6 site 全数（stocktake / stock-inquiry / inventory-records / stock-movements / operation-logs / products — 全 site が page を持つ、tuple 表参照）で同 test 内 page assert。部門 / toggle / page は同じ複合 fixture で個別 assert | page 復帰漏れ |
| SPEC-UIBB-2 | 表示設定の誤リセット | unit (RTL, negative) | `ProductListPage.test.tsx` の同 test 内で sort / dir / perPage 不変 assert | reset が絞り込み以外まで戻す過剰復帰 |
| SPEC-UIBB-1/2 | 共存 action の欠落・混入 | unit (RTL) | `ProductListPage.test.tsx` `SPEC-UIBB-1 既定0件は登録のみ・非既定0件は登録と解除の2ボタン` | 登録 action の消失 / 既定時の reset 混入 |
| SPEC-UIBB-8 | 範囲外 page で回復導線なし | unit (RTL) | `StockInquiryPage.test.tsx` `SPEC-UIBB-8 範囲外pageで先頭ページに戻る導線を表示する`（items=[] + total_count>0 + page>1 の一意 fixture、通常 EmptyState 非表示も assert） | 範囲外判定の欠落・通常 EmptyState との優先順位逆転 |
| SPEC-UIBB-8 | 回復押下の条件消失 | unit (RTL) | 同 test 内で「先頭ページに戻る」押下 → page=1 + q/dept/status 維持を assert | 回復が検索条件を落とす |
| SPEC-UIBB-9 | 候補が filtered result 由来へ退行 | unit (RTL + hook) | `useStockInquiry.test.tsx` `SPEC-UIBB-9 部門候補はlistDepartments全件で4条件に依存しない`（同一 QueryClient 上で page 2 移動・q 変更・dept 選択・status 変更〈all → low_stock → stockout〉を順に実行し、候補 assert 不変 **かつ `listDepartments` の call count = 1 のまま**を assert） | 候補 query の searchProducts 派生への退行（DSR-10 縮退）、および query key へ 4 条件を誤再導入して毎回再取得する mutant（round 2 P2-3: 候補配列 assert だけでは同一 master 応答で素通しになるため call count で殺す） |
| SPEC-UIBB-9 | query key の条件依存化 | unit | `query-keys` の unit test `SPEC-UIBB-9 departmentOptionsは無引数で一定keyを返す` | `queryKeys.stockInquiry.departmentOptions()` への引数再導入 |
| SPEC-UIBB-9 | loading 結線の欠落 | unit (RTL) | `StockInquiryPage.test.tsx` `SPEC-UIBB-9 候補ロード中はDepartmentFilterがdisabled`（候補 query を pending に固定し trigger の disabled を assert） | `disabled={false}` 固定・loading 結線削除の mutant（round 3 P2-3） |
| SPEC-UIBB-9 | error 表示と一覧独立の退行 | unit (RTL) | `StockInquiryPage.test.tsx` `SPEC-UIBB-9 候補取得失敗でも一覧は表示され失敗文言が出る`（`listDepartments` reject + list query 成功の fixture で、`role="alert"`「部門候補の取得に失敗しました」の exact 文言と商品一覧行の**同時表示**を assert。test harness は QueryClient retry を無効化して失敗状態を一意確定） | isError alert の削除・文言変更、候補失敗で一覧まで非表示にする結合退行（round 3 P2-3） |
| SPEC-UIBB-10（amendment） | commit 型残存 / live 反映欠落 | unit (RTL) | `ProductListPage.test.tsx` `SPEC-UIBB-10 検索入力が200msデバウンスでqに反映される`（入力後 debounce 経過で updater の q 反映 + page reset を assert）+ `SPEC-UIBB-10 検索ボタンとLabelを表示しない`（外付け UI 不在 + `type="search"` + aria-label 維持） | live 化の未実装・部分実装（Label / ボタン残存） |
| SPEC-UIBB-10（amendment） | Enter 即時 / IME 誤発火 | unit (RTL) | 同 `SPEC-UIBB-10 Enterで即時flushしIME変換確定Enterでは発火しない`（在庫照会 SearchBar の既存 live 型 test パターン移植、isComposing guard assert） | debounce 待ちへの退行・IME guard 欠落 |
| SPEC-UIBB-11（amendment） | 複数ボタン左寄せ回帰 | unit (RTL, DOM 構造) | `ProductListPage.test.tsx` `SPEC-UIBB-11 空状態の2ボタンは中央揃えで登録が先` （wrapper の `justify-center` class + ボタン順序を assert） | wrapper class 消失・順序逆転 |
| SPEC-UIBB-10（amendment） | clear 経路の reset 欠落 | unit (RTL) | `ProductListPage.test.tsx` `SPEC-UIBB-10 クリアでqが外れpageが既定に戻る`（q 非空 + page>1 の controlled fixture から `user.clear(input)` → debounce 経過後に updater の q undefined + page reset + 入力欄空を assert） | 非空入力のみ処理し空文字で updater を呼ばない / page を戻さない mutant（amendment round 1 P2-2） |
| SPEC-UIBB-10（amendment） | normalized 結線による再描画 trim | unit (RTL) | `ProductListPage.test.tsx` `SPEC-UIBB-10 空白込み入力が表示保持されCMDのkeywordだけがtrimされる`（controlled harness で `"  はさみ  "` を入力 → debounce 後も updater の q と表示値は空白込み、`searchProducts` の `keyword` は `"はさみ"` を assert） | controlled value の `normalizedSearch.q` 結線（trim 済み値の書き戻し、amendment round 1 P1-1） |
| SPEC-UIBB-9 | 選択中部門への縮退 | unit (RTL) | `StockInquiryPage.test.tsx` `SPEC-UIBB-9 部門選択中も他部門へ直接切替できる` | 候補縮退で他部門へ移れない行き止まり |
| SPEC-UIBB-3 | invalid param で例外/NaN | unit (schema) | `stockInquirySearchSchema` test `SPEC-UIBB-3 pageの不正値は既定1に落ちる`（0 / -1 / 1.5 / "abc" / 欠落） | catch 欠落・境界誤り |
| SPEC-UIBB-4 | 条件変更で page 保持 | unit (RTL) | `StockInquiryPage.test.tsx` `SPEC-UIBB-4 検索条件変更でpage=1に戻る` | reset 結線漏れ |
| SPEC-UIBB-4 | page 移動で条件消失 | unit (RTL) | 同 `SPEC-UIBB-4 page移動で検索条件を維持する` | navigate が search を上書き |
| SPEC-UIBB-5 | 50 件超に到達不能 | unit (RTL) | 同 `SPEC-UIBB-5 51件でpage2に到達できる`（synthetic 51 件、**非空期待**: page 2 に 1 件表示を assert） | pagination 未結線・total_count 未使用 |
| SPEC-UIBB-5 | alert 残存 | 静的 sweep | `rg -n "TruncatedResultsAlert" src` = 0 hit（Writer 完了時 + Final Review 独立再実行） | 撤去漏れ |
| SPEC-UIBB-6 | ローカル定義残存 | 静的 sweep + type check | `rg -n "export interface DepartmentOption" src` = patterns 1 hit のみ + `npx tsc --noEmit` PASS | 削除漏れ・re-export 型不整合 |
| SPEC-UIBB-7 | 二重記述 | review / doc check | `bash scripts/doc-consistency-check.sh` PASS + Final Review が 02 新節と §6.5.4 の責務分離を実読監査 | 実装規約が §6.5.4 に、方針が 02 に混入 |
| 02 ⑥ 適用除外 | receiving 誤適用 | regression + diff 監査 | 既存 `ReceivingPage` characterization PASS + PR diff に ReceivingPage の EmptyState hunk なし | 除外判定の無視 |
| 50 §50.4 非破壊 | products の page 挙動退行 | regression | 既存 `ProductListPage.test.tsx` の UI-01a-D4 系 test PASS（実在は Writer が rg で確認してから引用） | ProductPagination 共有部の破壊 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| stock-inquiry `page` param | 既定 1（URL 欠落時） | query loading | 応答 items + total_count 表示 | 条件変更で page=1 | queryKey に page 含め再取得 | URL 直開きで param 復元 | アプリ再起動で URL どおり | invalid は catch → 1 / 範囲外（items 空 + total_count>0 + page>1）は SPEC-UIBB-8 の回復導線 | query retry 既存 1 回 | schema unit + RTL |
| stock-inquiry 部門候補 | listDepartments 全件 | 候補ロード中 disabled（catalog 既定） | 全部門表示 | page/q/dept/status 変更で不変 | master query の再取得のみ | 同左 | 同左 | 取得失敗は呼び出し側文言（catalog 既定）、一覧 query と独立 | query retry 既存 | SPEC-UIBB-9 RTL + unit |
| filter reset（6 site） | フィルタ既定 = action なし（ProductList は登録 action のみ） | — | 非既定 + 0 件 = action 表示 | reset 押下で既定復帰・一覧再表示 | フィルタ既定の queryKey で再取得 | reset 後の URL は既定 param（URL 画面） | 再起動で既定 | 取得失敗時は Alert 系統（reset 非表示、既存 2 系統区分） | — | RTL 表示/非表示/復帰の 3 点 |
| `truncated` flag 撤去 | — | — | view-model から削除、参照 0 | — | — | — | — | — | — | rg 残存 0 + tsc |
| workflow state | content candidate -> L1 / independent review -> state-only human-confirm commit | | | | | | | state-only violation: file allowlist + `git diff --unified=0` hunks 監査、Scope/AC/contracts 変更は implementing へ返す | | 遷移記録 + STATECAP |
| ready 系 | owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit | | | | | | | hosted-not-required incidental failure: product/gate failure は implementing へ、infrastructure/cancel のみ owner disposition | | PR body |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| EmptyState filter-empty（catalog ⑥） | **分類確定済み**（plan-first change 内、packet Scope(1) の全数分類表 = `rg -n --glob '!**/*.test.tsx' '<EmptyState' src` の production 全 site を Coordinator が実読分類。round 1 P1-1 対応） | reset 対象 6 site | 除外(a) 範囲外 page 回復 / 除外(b) 期間主キーレポート 4 / 除外(c) 明細 0 行 4 / 除外(d) 直近実績 4 + 詳細系 6（各理由は packet 分類軸） | packet 分類表 + Final Review の独立再分類 |
| ProductPagination 結線（catalog ⑩） | products / stock-movements / operation-logs / integrity-check / inventory-records の既存 5 画面 | stock-inquiry | 在庫少経路（client filter、58 既存前提） | 既存 5 画面 test PASS + 新規 RTL |
| page=1 reset 慣行（50 §50.4） | products の条件変更 reset 実装 | stock-inquiry | perPage（在庫照会に導入しない） | RTL |
| operation-logs 既存 action「先頭ページに戻る」 | OperationLogsPage の範囲外回復 EmptyState | 共存（reset は filter-empty 側にのみ追加） | 範囲外回復 EmptyState への reset 追加はしない（semantic 相違） | RTL + 目視 |
| DepartmentOption 型参照 | `rg -n "DepartmentOption" src` 全数 | feature 3 file の re-export 化 | test file の import は patterns 直 import のまま可 | tsc + rg |

## Negative Paths

- missing input: page param 欠落 → 既定 1（schema test）
- invalid input: page 0 / 負 / 小数 / 非数値 → catch で 1（schema test）
- duplicate/ambiguous input: 同一フィルタの連続 reset 押下 → 冪等（2 回目は既定のまま、RTL で確認）
- unknown reference: 最終ページ超過の page 直 URL → 専用メッセージ +「先頭ページに戻る」（SPEC-UIBB-8 の一意 oracle: items=[] && total_count>0 && page>1。clamp はしない）
- dependency missing: query 失敗時は Alert 系統（reset 非表示、既存 2 系統区分の RTL）
- permission/write failure: 該当なし（読み取りのみの画面変更）
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: 50 件ちょうど（1 ページ、pagination 非表示 or 1 ページ表示は products 既存慣行に従う）/ 51 件（2 ページ、**非空期待で page 2 に 1 件**）
- null/default: page 欠落 → 1
- empty/non-empty: 0 件（EmptyState + 非既定なら reset）/ 非 0 件（テーブル表示）
- min/max: page=1 下限、total_count 由来の最終ページ上限
- status/policy enum: status=all のみ pagination、low/out は対象外（既存経路 test PASS）
- wire type: `ProductSearchQuery.page: number`（既存、変更なし）
- internal type: zod `number >= 1` catch 1
- producer/consumer: URL ↔ validateSearch ↔ searchProducts ↔ ProductPagination
- round-trip token: page 値が URL → query → 表示 → navigate → URL で保存される（RTL）
- precision/range: 正整数のみ
- cross-language parse: なし（Rust 側契約不変）

## Compatibility Checks

- old schema/input: page なし URL（既存ブックマーク相当）→ 従来どおり先頭 50 件
- new schema/input: page 付き URL 直開き → 該当ページ表示
- output order: 既存 sort（ProductCode Asc）不変
- optional field behavior: `truncated` 撤去は frontend view-model 内で完結（bindings 不変を L1 clean diff で確認）

## Data Safety Checks

- source-derived data: 実 POS / 実店舗データ不使用
- generated outputs: bindings / routeTree の clean diff（L1 full）
- secrets: 該当なし
- local-only files: 該当なし
- synthetic sample boundaries: RTL fixture はテストコード内 inline のみ、51 件 fixture は生成ループで作る

## Main Wiring / Integration Checks

- helper connected to main path: ProductPagination が実 query の `total_count` に結線（mock 固定値との差し替えで fail する assert、Mutation-style 参照）
- output reaches manifest/report: 該当なし
- effective config reaches runtime: 該当なし
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

- mock 値を design 期待値からずらしたとき: SPEC-UIBB-5 test は synthetic 51 件の total_count から page 2 の**非空表示**を assert する（空集合期待の oracle 衝突を避ける独立転記、production 定数から期待値を導出しない）。
- invalidate/refetch の順序: 条件変更 → page=1 → queryKey 変化 → 再取得、の順を SPEC-UIBB-4 test が URL と表示の両方で assert。
- key branch 逆転（reset 表示条件の非既定判定を恒真/恒偽化）: SPEC-UIBB-1 の表示/非表示の**対**がどちらかで fail。
- threshold 比較変更（>= 1 → > 1 等）: SPEC-UIBB-3 の page=1 境界 case が fail。
- guard 削除（catch 撤去）: SPEC-UIBB-3 の invalid case が fail。
- output field 省略（reset が 1 条件を戻し忘れ）: SPEC-UIBB-2 の全項目 assert が fail（複合条件 fixture で各条件を個別 assert）。
- tracked Workflow State に PR HEAD を書くか: 書かない（PR body のみ、D-035）。
- hosted URL/headSha の commit: しない（三点一致は PR body で判定）。
- state-only commit が Scope/AC を編集: hunk-level 監査で reject（State Lifecycle Matrix の workflow 行）。
- 出力順変更: sort 不変を既存 test が担保。
- dry-run 副作用: 該当なし。
- JSON safe integer / browser round-trip: page は正整数小値、zod catch が非数値を遮断（schema test）。

## Residual Test Gaps

- L3 でのみ検証可能: Windows native での実表示（focus 表示・ボタン視認性）は RTL で判別不能、Human Gate の L3 目視に割り当て。
- 部門候補の DSR-10 準拠は SPEC-UIBB-9 で test 対象へ昇格済み（round 1 P1-3）。listDepartments 応答自体の並び順・内容は既存 command 契約の責務で本 Matrix の対象外。
- reset ボタン文言の operator 妥当性（「絞り込みを解除」の語感）は自動 test 対象外、L3 で owner 確認。
