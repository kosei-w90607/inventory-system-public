# Test Design Matrix — UI backlog 消化 batch B

## Risk

Risk: R3

## Contracts Under Test

- SPEC-UIBB-1: filter-empty reset action の表示条件（絞り込み非既定 + 0 件のみ、5 site 共通）
- SPEC-UIBB-2: reset 押下の全条件既定値復帰（page 含む）
- SPEC-UIBB-3: 在庫照会 `page` search param の検証契約（>=1、invalid catch → 1）
- SPEC-UIBB-4: 条件変更 → page=1 / page 移動 → 条件維持
- SPEC-UIBB-5: 「すべて」全件ページ到達 + `TruncatedResultsAlert` 撤去
- SPEC-UIBB-6: `DepartmentOption` SSOT（patterns 1 箇所定義 + feature re-export）
- SPEC-UIBB-7: FilePicker catalog 登録の責務分離（02 実装規約 / §6.5.4 方針、二重記述なし）
- 02 ⑥ 適用除外の非回帰（receiving 明細空 / EmptySearchPlaceholder / shortcuts emptyMessage）
- 50 §50.4 非破壊（products 画面の既存 page 挙動不変）

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
| SPEC-UIBB-1 | 非既定 + 0 件で action 不在 | unit (RTL) | 各画面 `*Page.test.tsx` `SPEC-UIBB-1 絞り込み該当なしで解除ボタンを表示する`（5 site 各 1） | action 結線漏れ・表示条件の分岐欠落 |
| SPEC-UIBB-1 | 既定 0 件で action 誤表示 | unit (RTL, negative) | 同 `SPEC-UIBB-1 既定条件の0件では解除ボタンを出さない`（5 site 各 1） | 非既定判定の欠落・恒真化 |
| SPEC-UIBB-2 | 一部フィルタのみ復帰 | unit (RTL) | 同 `SPEC-UIBB-2 解除で全条件が既定値に戻る`（複合条件を設定し全項目 assert） | 復帰対象の列挙漏れ（1 条件でも戻し忘れ） |
| SPEC-UIBB-2 | page 残存 | unit (RTL) | stock-movements / stock-inquiry の同 test 内で page assert | page 復帰漏れ |
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
| stock-inquiry `page` param | 既定 1（URL 欠落時） | query loading | 応答 items + total_count 表示 | 条件変更で page=1 | queryKey に page 含め再取得 | URL 直開きで param 復元 | アプリ再起動で URL どおり | invalid は catch → 1 | query retry 既存 1 回 | schema unit + RTL |
| filter reset（5 site） | フィルタ既定 = action なし | — | 非既定 + 0 件 = action 表示 | reset 押下で既定復帰・一覧再表示 | フィルタ既定の queryKey で再取得 | reset 後の URL は既定 param（URL 画面） | 再起動で既定 | 取得失敗時は Alert 系統（reset 非表示、既存 2 系統区分） | — | RTL 表示/非表示/復帰の 3 点 |
| `truncated` flag 撤去 | — | — | view-model から削除、参照 0 | — | — | — | — | — | — | rg 残存 0 + tsc |
| workflow state | content candidate -> L1 / independent review -> state-only human-confirm commit | | | | | | | state-only violation: file allowlist + `git diff --unified=0` hunks 監査、Scope/AC/contracts 変更は implementing へ返す | | 遷移記録 + STATECAP |
| ready 系 | owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit | | | | | | | hosted-not-required incidental failure: product/gate failure は implementing へ、infrastructure/cancel のみ owner disposition | | PR body |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| EmptyState filter-empty（catalog ⑥） | Writer が `rg -n "<EmptyState" src` 全数を実測し、manifest 6 site（packet Scope(1)）+ その他の EmptyState 使用箇所を filter-empty か否かで分類する | manifest 1〜5 | receiving（明細 0 行）、EmptySearchPlaceholder / shortcuts emptyMessage（catalog ⑥ 既存除外）、真にデータなし系（detail 系 record 不在等） | 分類表を PR body に添付 |
| ProductPagination 結線（catalog ⑩） | products / stock-movements / operation-logs / integrity-check / inventory-records の既存 5 画面 | stock-inquiry | 在庫少経路（client filter、58 既存前提） | 既存 5 画面 test PASS + 新規 RTL |
| page=1 reset 慣行（50 §50.4） | products の条件変更 reset 実装 | stock-inquiry | perPage（在庫照会に導入しない） | RTL |
| operation-logs 既存 action「先頭ページに戻る」 | OperationLogsPage の範囲外回復 EmptyState | 共存（reset は filter-empty 側にのみ追加） | 範囲外回復 EmptyState への reset 追加はしない（semantic 相違） | RTL + 目視 |
| DepartmentOption 型参照 | `rg -n "DepartmentOption" src` 全数 | feature 3 file の re-export 化 | test file の import は patterns 直 import のまま可 | tsc + rg |

## Negative Paths

- missing input: page param 欠落 → 既定 1（schema test）
- invalid input: page 0 / 負 / 小数 / 非数値 → catch で 1（schema test）
- duplicate/ambiguous input: 同一フィルタの連続 reset 押下 → 冪等（2 回目は既定のまま、RTL で確認）
- unknown reference: 最終ページ超過の page 直 URL → clamp または空ページ + 「先頭ページに戻る」系回復（50 慣行に合わせ Writer が既存 products 挙動を踏襲、RTL）
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
- 部門 options の 50 件 truncate 既知 gap は本 change の test 対象外（据え置き、Review Focus で backlog 判定）。
- reset ボタン文言の operator 妥当性（「絞り込みを解除」の語感）は自動 test 対象外、L3 で owner 確認。
