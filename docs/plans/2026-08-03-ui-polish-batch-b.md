# Plan Packet — UI backlog 消化 batch B（filter reset / stock-inquiry pagination / DepartmentOption re-export / FilePicker catalog 登録 + 正本 drift 是正）

## Workflow State

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Claude (Fable 5)
- Writer: Claude (Sonnet 5 subagent、worktree isolation)
- Plan Reviewer: Codex (cross-vendor)
- Final Reviewer: Codex (cross-vendor、fresh context)
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: L3 Windows native 目視（filter reset 代表画面 / 在庫照会 pagination）、Ready 承認、merge

遷移記録（append-only）: 本 packet を追加する content commit で `kickoff -> spec-check -> design -> plan-draft -> plan-gate` を材料化する。evidence = task scoped + Risk R3 を本 packet に記録（kickoff→spec-check）、設計正本の更新が必要と識別 — filter-reset の規定が catalog ⑥ に存在せず、58 に pagination 設計がなく、50/58/59 に完了済み共通化を未完扱いする stale 記述が残る（spec-check→design）、design 出力を同一 plan-first change 内で source docs へ反映 — 02-component-catalog ⑥ filter-reset action 規定新設 / 58 pagination 設計新設 + §58.13 stale 2 行整理 / 59 §59.1 採用箇所 sync + §59.3 re-export 文言更新 + FilePicker 適用除外注記 / 50 非目的 stale 行整理 / 02 FilePicker パターン節新設（design→plan-draft）、packet + Test Design Matrix 完成・commit（plan-draft→plan-gate）。

2026-08-03 Codex Plan Review round 1 = FAIL（P1=5 / P2=6 / P3=0、全件 accept、裁定詳細は Review Response 参照）。P1-1（EmptyState 全 site の Adjacent Pattern Audit 未完了 + ProductList の manifest 漏れ）/ P1-2（範囲外 page 挙動の規定欠落と「50 §50.4 clamp 慣行」の事実誤認）/ P1-3（部門候補 truncate の Non-scope 化が DSR-10 違反を増幅）/ P1-4（SCREEN_DESIGN / UI_TECH_STACK が Required Design Artifacts から欠落）は design 出力の改訂を要するため、最早影響 phase = design へ backtrack する（`plan-gate -> design`）。

2026-08-03 round 1 是正 content commit で `design -> plan-draft -> plan-gate` を再材料化する。evidence = round 1 の design 出力を source docs へ反映（02 ⑥ 分類軸 + 既存 action 共存規定 + 6 site 化 / 02 ⑭ の behavior・API 縮退 / 58 UI-06a-D2 = listDepartments 部門候補 + UI-06a-D3 = 範囲外 page 回復 + `title=` 是正 / 59 の D-050 準拠化 + re-export ファイル別方式 / 50 §50.7 共存反映 / 74 の 6 site 化 / SCREEN_DESIGN 対象画面反映 / UI_TECH_STACK §6.5.4 責務分離、同一 plan-first change 内 — design→plan-draft）、packet の Scope 全数分類表・SPEC-UIBB-8/9・AC9/AC10・Boundary 是正と Matrix の site 別 tuple・一意 oracle 化を完成・commit（plan-draft→plan-gate）。`doc-consistency-check --target plan` 全チェック通過。

2026-08-03 Codex Plan Review round 2 = FAIL（P1=1 / P2=6 / P3=1、全件 accept、round 1 closure 判定 = closed 6 / not closed 5、裁定詳細は Review Response 参照）。P1-1（UI-06a-D2 が query 宣言のみで hook return / DepartmentFilter props へ未結線 = round 1 P1-3 not closed）は 58 の design 出力改訂を要し、P2-1（stocktake の `page` 実在を分類表・73 が欠落）/ P2-2（daily-sales が reset 軸と除外軸の両方に該当 = 分類軸の排他性欠落）/ P2-4（FilePicker behavior/API 正本の分裂残存 + DSR-14 の将来形記述）も design 出力の改訂を要するため、最早影響 phase = design へ backtrack する（`plan-gate -> design`。直前 backtrack `dc91ed7` とは content commit `bb5857f` を挟み隣接しない）。

2026-08-03 round 2 是正 content commit で `design -> plan-draft -> plan-gate` を再材料化する。evidence = round 2 の design 出力を source docs へ反映（58 = departmentOptions の hook return / canonical props 結線 / 失敗文言 / `queryKeys.stockInquiry.departmentOptions()` 無引数化 target〈現状 `(status, q)` 引数付きを実測確認〉/ SPEC-UIBB-9 の call count・無引数 unit 追記、73 + SCREEN_DESIGN = stocktake reset に page 追加、02 ⑥ = 除外(b) 優先規則 + stocktake page、02 ⑭ = behavior 記述の §6.5.4 移設、UI_TECH_STACK §6.5.4 = 全 props 契約集約 + 暫定例外の完了形化、01 DSR-14 = 完了形化、59 = FilePicker 帰属の visual/behavior 精密化、同一 plan-first change 内 — design→plan-draft）、packet の優先規則・stocktake tuple・SPEC-UIBB-7/9 強化・AC10・Ledger・Boundary・Risk 6 画面化・件数主張撤去と Matrix の 6 site 全数 page assert・call count oracle・無引数 key unit、Plans.md active dashboard 同期を完成・commit（plan-draft→plan-gate）。`doc-consistency-check --target plan` 全チェック通過。

2026-08-03 Codex Plan Review round 3 = FAIL（P1=0 / P2=3 / P3=0、全件 accept、round 2 closure = closed 7 / not closed 1、round 1 持ち越し 5 件 = 全 closed、裁定詳細は Review Response 参照）。P2-1（FilePicker 移行完了宣言と 5 live docs の矛盾 = round 2 P2-4 の ripple 残存）/ P2-2（58 の要約層が 2 useQuery / 4 key のまま = round 2 是正で生じた要約層 closure defect）は design 出力の改訂を要するため、最早影響 phase = design へ backtrack する（`plan-gate -> design`。直前 backtrack `33d9d68` とは content commit `018d6ad` を挟み隣接しない）。P2-3（SPEC-UIBB-9 の loading / error oracle 欠落)は Matrix / Ledger / 58 §58.9 の追補で同時に是正する。

2026-08-03 round 3 是正 content commit で `design -> plan-draft -> plan-gate` を再材料化する。evidence = round 3 の design 出力を source docs へ反映（P2-1 = FUNCTION_DESIGN 41/140 の「plain file input 暫定例外」/ SCREEN_DESIGN の plain input 開始・L3 指示 / 60 の D13・Non-scope・Test Focus / 63 の Non-scope・Test Focus / UI_TECH_STACK §6.7 `createObjectURL(file)` を FilePicker 現行方式へ同期し、historical 文脈以外の残存 0 を rg で確認。P2-2 = 58 の要約層〈冒頭判定表・§58.2・§58.3 返却値・§58.5 見出し〉と FUNCTION_DESIGN 59/136 を 3 useQuery / 5 key / 実 return 形へ同期。P2-3 = 58 §58.9 へ loading disabled / error alert+一覧同時表示の 2 test を追加、同一 plan-first change 内 — design→plan-draft）、Matrix の SPEC-UIBB-9 loading/error oracle 2 行 + retry 無効化 harness、packet の Ledger 転記 + Review Focus repo-wide sweep 追加 + relay 予算現況記録を完成・commit（plan-draft→plan-gate）。`doc-consistency-check --target plan` 全チェック通過。

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / L3 目視 + Ready 承認 / merge）
- 実働時間上限: 30分
- relay 往復上限: 4（batch A 実績 6/4 を踏まえた調整値。Plan Review 複数 round + Final Review を見込む。超過が見えた時点で Coordinator が停止し owner 承認を得る）

現況記録（2026-08-03、round 3 裁定時点）: Plan Review round 1〜3 で 3/4 消化。round 4（closure 確認）で 4/4 に達し、Final Review 以降は超過となる見込み。Final Review は独立レビューの代替が利かないため（Review Rules / batch A 前例と同判断）、超過分は本記録をもって owner へ事前明示し、owner の relay 実施をもって承認と扱う。

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
(a) 在庫照会 pagination は `page` URL search param の新設 = Risk Tiers の「route/search state」に直接該当する。(b) filter reset は分類表の 6 画面（棚卸し / 在庫照会 / 入出庫履歴一覧 / 在庫変動履歴 / 操作ログ / 商品一覧）の operator 可視挙動の新設で、いずれも URL search param または route state の書き換えを伴う（「UI route/search behavior」）。(c) batch A が Plan Review round 1 で R2→R3 再分類された前例（operator workflow の runtime 契約新設は R3）に同型。Tauri command / DTO / DB / 生成 bindings には触れない（`search_products` は既存の `page` パラメータを可変にするだけで wire shape 不変）。

## Goal

Goal Invariant:

### 最小完了条件

- filter-empty（絞り込み非既定で 0 件）の一覧 6 画面で、operator がワンクリックで絞り込みを解除して各画面の既定状態へ回復できる（在庫照会は検索前 placeholder = EmptySearchPlaceholder へ戻る。契約 I どおり）。
- 在庫照会「すべて」で 50 件超の商品にページ送りで到達でき、部門候補は page / 絞り込みに依らず master 全件から出る（DSR-10 準拠）。
- FilePicker が design-system catalog に登録され、DepartmentFilter 共通化系の正本 drift（完了済みの共通化を未完扱いする記述）が解消される。

### 失敗定義

- reset が一部のフィルタだけ戻し、絞り込み状態が残ったまま「解除した」と見える。
- pagination が page 移動時に検索条件を落とす、条件変更時に page が残って空ページを表示する、または範囲外 page で回復導線なしの空表示になる。
- 部門候補がページ移動・絞り込みで出入りする（DSR-10 の候補縮退）。
- 正本 sync が新たな drift（二重記述・自己矛盾）を作る。

### 非目的

- FilePicker の multiple 対応拡張、および daily-report-import / backup-restore / plu-export の FilePicker 統合（Non-scope 参照）。
- pagination の他画面への展開、perPage 選択 UI の追加。
- 分類表除外 19 site への reset 適用拡大（分類軸に基づく明示除外、Non-scope 参照）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

### (1) filter-empty reset action（reset 対象 6 site + 明示除外 19 site の全数分類）

分類軸（02 ⑥ へ design 出力として規定。round 1 P1-1 対応）:

- **reset 対象** = 結果集合を狭める任意の絞り込み条件（検索語・フィルタ・状態チップ・期間絞り込み）を持つ一覧画面の filter-empty。絞り込みの既定値復帰が「全件（既定）表示」という自明な回復になる画面のみ。
- **除外(a) 範囲外 page 回復** = UI-11c-D8 の専用導線（「先頭ページに戻る」）が既にある別 semantic。
- **除外(b) 期間主キーレポート** = 対象選択条件（「すべて」という既定値を持たない必須の主キー = 日報の日付、月報の月）を持つレポート画面。**優先規則（round 2 P2-2）: 副次絞り込み（日次売上の部門フィルタ等）があっても除外(b) を優先して reset 対象外とする** — reset の統一契約は「全絞り込み条件の既定復帰」だが対象選択は既定復帰の対象になり得ず、副次絞り込みだけ戻す部分 reset を許すと同じ「絞り込みを解除」ボタンが site ごとに違う挙動になるため。条件変更の案内は既存 description 文言が担い、部分 reset（「部門の絞り込みを解除」等の別文言）は要望発生時に別 change で再評価する。
- **除外(c) 業務入力の明細 0 行** = 入力明細が空なだけで絞り込み結果ではない。
- **除外(d) 直近実績サマリ / 詳細画面の関連データ不在** = 絞り込み条件を持たない、真にデータなし系。
- なお reset が戻すのは絞り込み条件のみ。並び替え（sort / dir）・表示件数（perPage）は結果集合を狭めないため対象外。

全数分類表（2026-08-03 Coordinator 実測 `rg -n --glob '!**/*.test.tsx' '<EmptyState' src`。行番号は起草時点の参考、anchor = file + title literal）:

| 画面 / site | file / anchor | 分類 | reset 対象フィルタ（正本） |
|---|---|---|---|
| 棚卸し UI-10 | `StocktakePage.tsx`「この条件に一致する商品がありません」 | reset 対象 | 部門フィルタ + 未入力のみ表示 + page（73 §73.6。`StocktakeSearch.page` は既存 param、round 2 P2-1 で追加） |
| 在庫照会 UI-06a | `StockInquiryPage.tsx`「該当する商品がありません」 | reset 対象 | q / dept / status + page（58 §58.4。復帰後は契約 I の EmptySearchPlaceholder） |
| 入出庫履歴一覧 | `InventoryRecordsPage.tsx`「入出庫履歴がありません」 | reset 対象 | 65 §65.4.1 の検索条件 + page |
| 在庫変動履歴 UI-06c | `StockMovementsPage.tsx`「在庫変動履歴がありません」 | reset 対象 | dateFrom / dateTo / type + page（66 §66.3） |
| 操作ログ UI-11c | `OperationLogsPage.tsx`「該当する操作ログがありません」 | reset 対象 | start_date / end_date / operation_type + page（74。既存 `defaultFilter` 非既定側のみ） |
| 商品一覧 UI-01a | `ProductListPage.tsx`「該当する商品がありません」 | reset 対象（round 1 P1-1 で追加） | q / dept / discontinued + page（50 §50.4。sort / dir / perPage は対象外）。既存「商品を登録する」action は常設のまま、非既定時のみ reset ボタンを横並び共存（02 ⑥ で共存規定） |
| 操作ログ範囲外 page | `OperationLogsPage.tsx`「このページには表示するログがありません」 | 除外(a) | —（UI-11c-D8 の既存回復導線） |
| 日報明細 | `daily-sales/components/ProductTable.tsx`（title は props 供給） | 除外(b) | — |
| 月報 月度 / ランキング / 部門別 | `MonthlySalesPage.tsx`「当月データなし」/ `ProductRankingTable.tsx`・`DepartmentTable.tsx`「該当する売上明細がありません」 | 除外(b) | — |
| 入庫 / 廃棄・破損 / 手動販売 / 返品・交換の明細 | `ReceivingPage.tsx`「入庫する商品がありません」/ `DisposalPage.tsx`「廃棄・破損する商品がありません」/ `ManualSalePage.tsx`「手動販売する商品がありません」/ `ReturnExchangePage.tsx`「返品・交換する商品がありません」 | 除外(c) | — |
| 同 4 画面の直近実績サマリ | `ReceivingPage.tsx`「直近の入庫はありません」/ `DisposalPage.tsx`「直近の廃棄・破損はありません」/ `ManualSalePage.tsx`「直近の手動販売出庫はありません」/ `ReturnExchangePage.tsx`「直近の返品・交換はありません」 | 除外(d) | — |
| 記録詳細 5 route の関連データ不在 | `CsvImportRecordDetailPage.tsx`「取込みエラーはありません」「関連する在庫変動がありません」/ `ManualSaleRecordDetailPage.tsx` / `ReceivingRecordDetailPage.tsx` / `DisposalRecordDetailPage.tsx` / `ReturnRecordDetailPage.tsx` | 除外(d) | — |

統一契約（02 ⑥ へ design 出力として新設）:

- 絞り込み条件が既定値以外かつ結果 0 件のとき、EmptyState の `action` に絞り込み解除ボタン（outline）を置く。
- 押下でその画面の絞り込み条件をすべて既定値へ戻す。URL search param 画面は param を既定へ、local state 画面は state を既定へ。page を持つ画面は page も既定（1）へ戻す。
- 既定値のまま 0 件（真にデータなし）のときは action を出さない。
- ボタン文言は 6 site 統一「絞り込みを解除」。
- 既存 action を持つ画面（商品一覧の「商品を登録する」）は既存 action を常設のまま維持し、非既定時のみ reset ボタンを横並びで併置する（`action` slot に 2 ボタンの flex 配置。02 ⑥ で規定）。

### (2) 在庫照会 pagination + 部門候補の DSR-10 準拠（UI-06a、58 へ design 出力）

- `page` search param 新設（50 §50.4 と同型: number >= 1、既定 1、invalid は catch で既定に落とす）。
- 対象は `status=all`（`search_products` 経路）のみ。在庫少 / 在庫切れ status は `list_low_stock` の client filter 経路のため対象外（現状維持）。
- q / dept / status の変更で `page=1` に戻す。page 移動だけは条件を維持する（50 §50.4 慣行の踏襲）。
- 既存 canonical `src/features/products/components/ProductPagination.tsx` を結線し、`total_count` から最終ページを計算する。
- **範囲外 page**（round 1 P1-2 対応）: `items` 空 かつ `total_count > 0` かつ `page > 1` のとき、通常 EmptyState ではなく専用メッセージ +「先頭ページに戻る」ボタン（`page=1` へ navigate、他条件維持）を出す。74 UI-11c-D8 と同型（clamp は採用しない — 50 / ProductPagination に clamp 契約は存在せず、既存 canonical は UI-11c-D8 のみ）。
- `TruncatedResultsAlert` と派生 flag `truncated` は、pagination により全件到達可能になるため撤去する（58 の design 出力で decision 化。stock-inquiry `types.ts` の view-model 契約更新）。
- **部門候補の DSR-10 準拠**（round 1 P1-3 対応）: 部門候補 query を検索結果由来（`searchProducts` 先頭 page からの派生）から `commands.listDepartments()` の master 全件へ切り替える。filtered result 由来の候補縮退は DSR-10 / 02 が禁止しており、pagination 導入で「現在 page の商品に含まれる部門」への縮退が増幅されるため、本 change で正本準拠に是正する。wire 変更なし（`listDepartments` は既存 command）。page / q / dept / status のいずれを変更しても候補が不変であること（`queryKeys.stockInquiry.departmentOptions()` の無引数化を含む。src/lib/query-keys.ts / hook / test が対象）、選択中部門から別部門へ直接切替できることを契約化する。hook は `Department[]` を `DepartmentOption[]` へ変換し、loading / error 状態とともに画面へ返して canonical props（options / selected / onChange / disabled）で結線する（round 2 P1-1）。候補取得失敗は一覧 query と独立で、呼び出し側文言表示（catalog ⑨ 既定）。

### (3) DepartmentOption re-export 統一

- feature 側ローカル定義 3 箇所（`src/features/products/hooks/useProductList.ts` / `src/features/daily-sales/types.ts` / `src/features/stock-inquiry/types.ts`、2026-08-03 実測 `rg -n "export interface DepartmentOption" src` = 計 4 hit 中 patterns 正定義以外の 3）を削除し、`@/components/patterns/DepartmentFilter` を SSOT とする re-export へ統一する。consumer の import path は不変。
- 方式はファイル別（round 1 P1-5 対応）: `useProductList.ts` は同一モジュール内で `DepartmentOption[]` を使用するため、`export type { X } from` 単文ではローカル binding が入らず成立しない。`import type { DepartmentOption } from "@/components/patterns/DepartmentFilter";` + `export type { DepartmentOption };` の 2 文とする。`daily-sales/types.ts` / `stock-inquiry/types.ts` はモジュール内使用の有無を Writer が確認し、使用なしなら直接 re-export 1 文、使用ありなら同じ 2 文方式。

### (4) FilePicker catalog 登録

- `docs/design-system/02-component-catalog.md` の FilePicker パターン節（⑭）は構造 / トークン / Do-Don't / 採用箇所に限定し、behavior / API 契約（入口 2 経路・出力契約 `{bytes, filename, size}`・cancel 据え置き・local input / dropzone 新設禁止）は UI_TECH_STACK §6.5.4 を正本のままリンク参照へ縮退する（round 1 P2-2 対応。59 §59.1 の既存棲み分け「catalog = DOM 構造・トークン・Do/Don't」どおり）。
- `docs/function-design/59-ui-shared-patterns.md` §59.3 へ適用除外注記: FilePicker は plugin-dialog / plugin-fs 副作用を持つため patterns/（§59.4 純表示部品規約）の対象外、`src/components/FilePicker.tsx` 配置のまま catalog 管理とする。

### (5) 正本 stale 是正（DepartmentFilter 共通化完了の追随）+ 上位設計書反映

- 58 §58.7「UI-06a 用ローカル実装」表記 → 共通 `patterns/DepartmentFilter` 使用へ更新。58 の EmptyState 疑似コードの `message=` prop を実契約 `title=` へ是正（round 1 P2-5）。
- 58 §58.13: pagination 行（本 change で実装のため削除）+ DepartmentFilter 共通化行（PR-B で完了済みのため削除）。更新履歴へ記録。
- 50 非目的の「`DepartmentFilter` / `DepartmentOption` の feature 間共通化」行を削除（同 doc §50.3 の「PR-B で統合」記述との自己矛盾解消）。50 の空状態記述へ reset action 共存（登録 action + reset）を反映。
- 59 §59.1 DepartmentFilter 行の採用箇所「daily / products / stock の 3 画面」→ stocktake を加えた 4 画面へ。EmptyState / FilePicker の採用箇所は件数断定を書かず、canonical source と正確な検索式（例: production JSX は `rg -n --glob '!**/*.test.tsx' '<EmptyState' src`）の参照とする（round 1 P2-4、D-050 準拠）。
- 59 §59.3「re-export への統一は将来 PR の対象」→ 本 change で実施済みの記述へ（ファイル別方式は Scope(3)）。
- **SCREEN_DESIGN.md**（round 1 P1-4 対応）: 在庫照会 / 棚卸し / 入出庫履歴・在庫変動 / 操作ログ / 商品一覧の該当節へ filter-empty reset 回復と在庫照会 pagination を反映。
- **UI_TECH_STACK.md §6.5.4**: FilePicker の behavior / API 正本としての位置付けを明確化（02 ⑭ との責務分離、Scope(4) と同時是正）。
- **Plans.md**（round 1 P2-3 対応): 後回し Backlog 節の旧 defer 行（pagination / DepartmentFilter 共通化）を本 batch 消化 / 完了済みへ更新。

## Non-scope

- daily-report-import / backup-restore / plu-export の FilePicker 統合。Coordinator 実査（2026-08-03）: plu-export は `save()`（書き出し先選択）、backup-restore は `open({directory: true})`（フォルダ選択）で読込み契約 `{bytes, filename, size}` の対象外。daily-report-import は `open({multiple: true})` + Z001/Z002/Z005 ちょうど 3 ファイル検証 + 直前フォルダ記憶で、統合には FilePicker の multiple 契約拡張が必要 = 別 R3 規模。将来拡張候補として Plans.md へ disposition を残す。
- UI-09b 日報 coverage 表示（DTO 変更必要、batch A から継続の別 R3）。
- DTO 由来 runtime route 文字列の構造化 DTO 化（既存 backlog、別 R3）。
- perPage 選択 UI、在庫少 / 在庫切れ status への pagination 適用。
- `EmptySearchPlaceholder` / shortcuts `emptyMessage` への reset 適用（catalog ⑥ 既存の適用除外どおり semantic 相違）。
- 分類表の除外(a)〜(d) 19 site への reset 適用（分類軸は Scope(1)。期間主キーレポートの副次絞り込みへの reset は要望が出た時点で別 change として再評価）。
- 商品一覧・入出庫履歴・在庫変動履歴・操作ログの既存 pagination 挙動の変更（reset の page 復帰と範囲外 page の既存契約は現状維持、在庫照会のみ新設）。

## Acceptance Criteria

- AC1: 分類表の reset 対象 6 site で「絞り込み非既定 + 0 件」時に reset action が表示され、押下で当該画面の絞り込み条件（site 別 tuple は Matrix）がすべて既定値へ戻る。商品一覧は既存「商品を登録する」action が常設のまま共存する。evidence = 各画面 RTL test `SPEC-UIBB-1 絞り込み該当なしで解除ボタンを表示する` / `SPEC-UIBB-2 解除で全条件が既定値に戻る`（Matrix 参照）+ L3 代表画面目視。
- AC2: 既定値のまま 0 件のとき reset action は表示されない。evidence = 各画面 RTL negative test `SPEC-UIBB-1 既定条件の0件では解除ボタンを出さない`（Matrix 参照）。
- AC9: 在庫照会の範囲外 page（`items` 空 + `total_count > 0` + `page > 1`）で専用メッセージ +「先頭ページに戻る」が表示され、押下で page=1・他条件維持。evidence = `StockInquiryPage.test.tsx` の `SPEC-UIBB-8 範囲外pageで先頭ページに戻る導線を表示する`。
- AC10: 在庫照会の部門候補が `listDepartments()` master 全件由来になり、page / q / dept / status のいずれを変更しても候補が不変（同一 QueryClient で `listDepartments` call count = 1 のまま）で、選択中部門から別部門へ直接切替できる。evidence = `useStockInquiry.test.tsx` / `StockInquiryPage.test.tsx` の `SPEC-UIBB-9` 系 test + `queryKeys.stockInquiry.departmentOptions()` 無引数 unit test（Matrix 参照）。
- AC3: 在庫照会「すべて」で 51 件以上の synthetic データのとき page 2 へ到達でき、`total_count` と表示ページが整合する。evidence = RTL test + L3。
- AC4: q / dept / status の変更で page=1 に戻り、page 移動では条件が維持される。evidence = `StockInquiryPage.test.tsx` の `SPEC-UIBB-4 検索条件変更でpage=1に戻る` / `SPEC-UIBB-4 page移動で検索条件を維持する`（Matrix 参照）。
- AC5: `TruncatedResultsAlert` の残存 0。evidence = `rg -n "TruncatedResultsAlert" src` = 0 hit。
- AC6: `rg -n "export interface DepartmentOption" src` の hit が `src/components/patterns/DepartmentFilter.tsx` の 1 件のみ、かつ `npx tsc --noEmit` PASS。
- AC7: 02 に FilePicker 節が存在し、59 §59.3 に適用除外注記、stale 是正 4 doc（50 / 58 / 59 / 02）に旧記述の残存 0。evidence = `bash scripts/doc-consistency-check.sh` PASS + Final Review の rg 監査。
- AC8: receiving の明細空 EmptyState は無変更（適用除外の回帰確認）。evidence = 既存 `ReceivingPage` characterization test PASS + `git diff --unified=0 -- src/features/receiving/ReceivingPage.tsx` の EmptyState hunk 0 件。

## Design Sources

- Requirements / spec: `docs/Plans.md` 後回し Backlog 節（一覧フィルタリセット起票 2026-07-08 / 58 §58.13 defer 転記 2026-06-08 / FilePicker 共通化起票 PR #125 L3）
- Architecture: `docs/ARCHITECTURE.md`（UI -> CMD -> BIZ -> IO 境界、本 change は UI 層のみ）
- Function / command / DTO: `docs/function-design/50-ui-product-list.md` §50.4-§50.5（page/URL State 慣行と `ProductSearchQuery` 既存契約）、58 §58.4/§58.7/§58.13、65 / 66 / 73 / 74（各画面 search 正本）、59（patterns 対応表）
- DB: 変更なし
- Screen / UI: `docs/design-system/02-component-catalog.md` ⑥（EmptyState 正典）/ ⑨ / ⑩（ProductPagination canonical）、`docs/UI_TECH_STACK.md` §6.5.4（FilePicker 方針正本）
- Decision log / ADR: D-054（共通 FilePicker）、PR-B = design-system 統合（DepartmentFilter 共通化の完了実体）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | なし（`search_products` 既存契約のまま） | existing sufficient |
| Command / DTO / generated binding / wire shape | `bindings.ts` 不変（page は既存パラメータ） | existing sufficient |
| DB / transaction / audit / rollback / migration | なし | existing sufficient |
| Screen / UI / route state / Japanese wording | `docs/SCREEN_DESIGN.md`（対象画面の empty 回復 + 在庫照会 pagination）/ `docs/UI_TECH_STACK.md` §6.5.4（FilePicker 責務分離）/ 02 ⑥ filter-reset 規定 / 58 pagination + 範囲外 page + DSR-10 準拠設計 / 59 sync / 50 sync / 65・66・73・74 の該当節追記 | updated in this PR（plan-first change 内で design 出力を反映。round 1 P1-4 で SCREEN_DESIGN / UI_TECH_STACK を追加） |
| CSV / TSV / report / import / export format | なし | existing sufficient |
| Durable decision / ADR | 58 の truncated alert 撤去 decision、02 ⑥ reset 統一契約 | updated in this PR |

## Registration / Generation Obligations

該当なし — 新規 Tauri command / function-design doc / REQ / route / 画面の新設はない。`page` search param は既存 route の validateSearch schema 拡張であり routeTree 生成物は不変（L1 full の生成系 clean diff 検査が機械確認する）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-UIBB-1/2（reset） | 02 ⑥（新設規定） | catalog ⑥ reset 規定（本 change design 出力） | EmptyState の既存 `action` slot を使い新規 primitive を作らない。画面別の独自ボタン配置は 6 site の一貫性を壊すため却下 | 分類表 reset 対象 6 site + 02 ⑥ | 各画面 RTL + L3 |
| SPEC-UIBB-3/4/5/8（pagination） | 50 §50.4（慣行元）、58（新設）、74 UI-11c-D8（範囲外 page 同型元） | UI-06a 系列新 D（58 design 出力で採番） | 50 慣行の踏襲で新規 UX を発明しない。truncated alert 併存は二重表現のため撤去。範囲外 page の clamp は既存 canonical 不在のため却下し UI-11c-D8 同型を採用 | stock-inquiry route/search + StockInquiryPage | RTL + L3 |
| SPEC-UIBB-9（部門候補） | 01 DSR-10、02 SearchBar/フィルタ節 | DSR-10 の既存規定適用（新規 decision 不要） | filtered result 由来の候補は縮退禁止規定違反。pagination が縮退を増幅するため同一 change で是正 | useStockInquiry 候補 query | RTL + unit |
| SPEC-UIBB-6（re-export） | 59 §59.3 | 59 §59.3 既存方針の実施 | 構造的サブタイプ残置は将来の定義 drift 温床。consumer import 不変の re-export が最小差分 | feature types 3 file | tsc + rg 静的 sweep |
| SPEC-UIBB-7（FilePicker catalog） | UI_TECH_STACK §6.5.4（方針正本）、02（新節） | 59 §59.4 純表示規約により patterns/ 移動は却下、components/ 直下のまま catalog 登録 | 移動は import path 変更の変更面拡大に見合う利得がない（判断は件数に依存しないため件数は記さない、D-050） | 02 新節 + 59 §59.3 注記 | doc-consistency + Final Review rg |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 実装後は 02 ⑥ / 58 / 59 / 50 の正本だけで reset 契約・pagination 契約・SSOT 配置が読める。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: reset 統一契約 → 02 ⑥、truncated alert 撤去 → 58、FilePicker patterns/ 非対象 → 59 §59.3（いずれも同一 plan-first change 内で反映）。
- Assumptions and constraints: `search_products` の page/per_page 既存契約が変わらないこと（wire 不変）。stock-inquiry の在庫少経路は client filter のため件数有限で pagination 不要という 58 既存前提。
- Deferred design gaps, risk, and follow-up target: daily-report-import の multiple FilePicker 拡張（Plans.md backlog）。部門候補 truncate は round 1 P1-3 の裁定で Scope(2) の DSR-10 準拠是正へ昇格済み。
- Test Design Matrix can cite design decision IDs or source doc sections: 可（Matrix の Contract 列は本 packet の SPEC-UIBB-n と 02 ⑥ / 58 / 50 §50.4 を引く）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: reset は既定値復帰のみで破壊的操作なし。invalid page param は catch で既定へ（escape hatch = zod catch、既存 50 慣行と同型）。

## Impact Review Lenses

not applicable — 本 change は field 調査・実機挙動・外部 tool・POS 連携・帳票形式の発見を起点とせず、既存 backlog 起票（UI-10 契約監査 / 58 §58.13 defer / PR #125 L3 feedback）の消化である。環境・再現性 lens: 新設の環境依存なし（既存 toolchain のみ）。

## Design Readiness

- Existing design docs are sufficient because: 50 §50.4（page 慣行）、02 ⑥（EmptyState 正典）、⑩（ProductPagination canonical）、UI_TECH_STACK §6.5.4（FilePicker 方針）が実装の骨格を既に規定している。
- Source docs updated in this PR: 02 ⑥ reset 規定 + FilePicker 新節、58 pagination 設計 + stale 整理、59 §59.1/§59.3 sync、50 非目的整理、65 / 66 / 73 / 74 へ reset 行追記。
- Design gaps intentionally deferred: multiple FilePicker（Plans.md backlog）。
- Durable decisions discovered in this plan and promoted to source docs: Design Intent Audit 参照。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層のみ。CMD 以下に変更なし。
- Backend function design: 変更なし。
- Command / DTO / data contract: wire 不変（AC 参照）。view-model の `truncated` flag 撤去は frontend 内契約。
- Persistence / transaction / audit impact: なし。
- Operator workflow / Japanese UI wording: reset ボタン文言は 02 ⑥ で統一確定。既存 description 文言との整合を Plan Review 観点に含める。
- Error, empty, retry, and recovery behavior: 空状態 2 系統（0 件成功 / 取得失敗）の既存区分は不変。reset は 0 件成功系のみに付く。
- Testability and traceability IDs: SPEC-UIBB-1〜9 を Matrix / test 名に付す。

## Contract Probe

N/A — 未検証の外部前提なし。TanStack Router validateSearch の param 追加（50 で実証済み）、ProductPagination 再利用（5 画面で稼働中）、EmptyState `action` slot（operation-logs で稼働中）、type re-export はいずれも repo 内で稼働実績のあるパターンの適用である。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| 02 ⑥ reset 表示条件（非既定 + 0 件のみ） | 分類表 reset 対象 6 site | 各画面 RTL（表示 / 非表示の対） | L3 代表画面 |
| 02 ⑥ reset 動作（全条件既定値復帰 + page=1、site 別 tuple） | 同上 | 各画面 RTL（複合フィルタ設定 → 全項目個別 assert） | L3 代表画面 |
| 02 ⑥ 既存 action との共存（商品一覧の登録 action 常設 + 非既定時 reset 併置） | ProductListPage | RTL（既定 0 件 = 登録のみ / 非既定 0 件 = 2 ボタン） | L3 |
| 02 ⑥ 適用除外（分類表の除外(a)〜(d) 19 site） | 変更なしの確認 | 既存 characterization PASS + PR diff 監査 | non-scope（diff 監査） |
| 58 新設: 範囲外 page 回復（UI-11c-D8 同型、通常 EmptyState より優先） | StockInquiryPage | RTL（items 空 + total_count>0 + page>1 の一意 oracle） | L3 |
| DSR-10: 部門候補 = listDepartments master 全件（縮退禁止） | useStockInquiry 候補 query + `queryKeys.stockInquiry.departmentOptions()` 無引数化 + DepartmentFilter canonical props 結線 | RTL + unit（page/q/dept/status の 4 条件変更で候補不変 + call count=1、別部門へ直接切替、無引数 key unit） | L3 |
| SPEC-UIBB-9: 候補 loading の disabled 結線 / 候補失敗文言と一覧独立 | StockInquiryPage（disabled={isLoading} / isError alert） | RTL 2 本（pending → trigger disabled / reject + list 成功 → exact alert 文言と一覧の同時表示、retry 無効化 harness。Matrix 参照、round 3 P2-3） | — |
| 58 新設: page param（>=1、invalid catch → 既定 1） | stock-inquiry search schema | schema unit test | — |
| 58 新設: 条件変更 → page=1 / page 移動 → 条件維持 | StockInquiryPage | RTL | L3 |
| 58 新設: truncated alert 撤去（全件ページ到達で代替） | stock-inquiry view-model | rg 残存 0 + RTL（51 件 synthetic で page 2 到達） | L3 |
| 58 既存: 在庫少経路は client filter（pagination 対象外） | 変更なしの確認 | 既存 test PASS | non-scope |
| 59 §59.3: DepartmentOption SSOT = patterns | feature types 3 file | rg 静的 sweep + tsc | — |
| 59 §59.1: 採用箇所表の実態一致（DepartmentFilter 4 画面 / EmptyState 実測） | 59 表 | doc-consistency + Final Review rg | — |
| 02 FilePicker 節: §6.5.4 と二重記述しない（方針は §6.5.4、実装規約は 02） | 02 新節 | Final Review 監査 | — |
| 50 §50.4 慣行の非破壊（products 画面の page 挙動不変） | 変更なしの確認 | 既存 UI-01a-D4 系 test PASS | non-scope |

隣接契約 sweep: 02 ⑥ の空状態 2 系統区分（0 件成功 / 取得失敗）と適用除外 2 件、58 §58.13 の残存非目的行（スキャンボタン / 件数バッジ等 = 本 change で触れない行）、59 §59.4 純表示規約、50 §50.4 の perPage 行（本 change は在庫照会に perPage を導入しない）を確認し、上表に含めるか non-scope として明示した。

## Test Plan

Test Design Matrix: [test-matrices/2026-08-03-ui-polish-batch-b.md](test-matrices/2026-08-03-ui-polish-batch-b.md)

- targeted tests: 各画面 RTL characterization（reset 表示 / 非表示 / 全条件復帰）、stock-inquiry schema unit + pagination RTL、静的 sweep（rg）
- negative tests: 既定値 0 件で reset 非表示、invalid page param、page 範囲外
- compatibility checks: products 画面の既存 pagination 挙動不変、receiving EmptyState 不変
- data safety checks: synthetic fixture のみ（実 POS データ不使用）
- main wiring/integration checks: ProductPagination が stock-inquiry の実 query 結果に結線されること（mock 固定値でない）
- Human Gate に L3 を含むため、Writer 完了条件に `cargo check --release` を含める（owner native build 前、CI gate ではない）

## Boundary / Wire Contract

- producer: URL search param `page`（operator のページ操作 / 直接 URL）
- consumer: `StockInquiryPage` → `commands.searchProducts({ page, per_page: 50, ... })`、部門候補は `commands.listDepartments()`（master 全件、既存 command）
- wire type: `page: number`（`ProductSearchQuery` 既存フィールド、変更なし）。部門候補は `listDepartments()` の `Department[]`（既存 wire、変更なし）
- internal type: zod schema `number >= 1`、`.catch` で既定 1。部門候補は hook 内で `Department[]` → `DepartmentOption[]` へ変換し、loading / error 状態とともに `useStockInquiry` の戻り値として画面へ伝播、`DepartmentFilter` の canonical props（options / selected / onChange / disabled）で結線（round 2 P1-1）
- precision/range: 正整数のみ。最終ページ超過（範囲外 page）は clamp せず、UI-11c-D8 同型の専用回復導線（「先頭ページに戻る」）で page=1 へ戻す
- round-trip path: URL → validateSearch → query → 応答 `total_count` → ProductPagination 表示 → navigate で URL 更新
- invalid input: 非数値 / 0 / 負数 / 小数は catch で既定 1（画面エラーにしない）
- compatibility: 既存 URL（page なし）は既定 1 で従来どおり先頭 50 件表示。`truncated` flag 撤去は frontend view-model 内で完結し、他画面・bindings に波及しない

## Review Focus

- reset の「全条件復帰」に漏れがないか（site 別 tuple を各正本 50 / 58 / 65 / 66 / 73 / 74 と突合。一部復帰は失敗定義そのもの）。
- 分類軸（Scope(1)）の一貫性 — 除外 19 site の理由が軸から導出できるか、軸に反する例外を作っていないか。
- 商品一覧の「登録 action + reset」共存 UI が operator を混乱させないか（ボタン順序・文言）。
- 在庫照会の範囲外 page 判定（SPEC-UIBB-8）と reset 表示条件（SPEC-UIBB-1）の優先順位実装。
- `listDepartments` 切替による部門候補の挙動変化（絞り込み中でも全部門が出る = DSR-10 の意図どおりだが、旧挙動との差分を L3 で owner 確認）。
- stale 是正が更新履歴を持つ doc で履歴行を欠かさないこと。
- FilePicker 移行完了形の repo-wide 整合（round 3 P2-1 の再発防止）: `rg -n "plain file input|createObjectURL\(file\)|暫定例外" docs/` の hit が historical 文脈（更新履歴・supersede 済み decision 記録・経緯引用）のみであること。current 節（Non-scope / Test Focus / L3 確認対象 / 索引）に旧方式が残っていれば blocker。

## Spec Contract

Contract ID: SPEC-UIBB

- SPEC-UIBB-1: filter-empty reset action は「絞り込み非既定 + 結果 0 件」のときのみ表示される（分類表 reset 対象 6 site 共通。商品一覧は既存登録 action と共存、reset 側のみ条件表示）。
- SPEC-UIBB-2: reset 押下で当該画面の絞り込み条件（site 別 tuple は Matrix）がすべて既定値へ戻り、page を持つ画面は page も既定へ戻る。並び替え・表示件数は変更しない。
- SPEC-UIBB-3: 在庫照会 `page` search param は number >= 1、invalid は catch で既定 1。
- SPEC-UIBB-4: q / dept / status 変更で page=1、page 移動のみでは条件維持。
- SPEC-UIBB-5: 在庫照会「すべて」は全件がページ送りで到達可能、`TruncatedResultsAlert` は撤去。
- SPEC-UIBB-6: `DepartmentOption` の定義は `patterns/DepartmentFilter.tsx` の 1 箇所のみ、feature 側は re-export（方式はファイル別、Scope(3)）。
- SPEC-UIBB-7: FilePicker の behavior / API 正本（入口 2 経路・出力契約・cancel・onError・props 既定値・禁止規定）は §6.5.4、02 ⑭ は visual（DOM 構造 / トークン / visual Do-Don't / a11y / 採用箇所）のみ（二重記述なし）。
- SPEC-UIBB-8: 在庫照会の範囲外 page（`items` 空 + `total_count > 0` + `page > 1`）は専用メッセージ +「先頭ページに戻る」（UI-11c-D8 同型）。通常 EmptyState / reset action より優先判定。
- SPEC-UIBB-9: 在庫照会の部門候補は `listDepartments()` master 全件由来で、page / q / dept / status のいずれにも依存しない（DSR-10）。hook が `Department[]` を `DepartmentOption[]` へ変換して loading / error 状態とともに画面へ返し、canonical props（options / selected / onChange / disabled）で結線する。`queryKeys.stockInquiry.departmentOptions()` は無引数・一定 key。同一 QueryClient 上で 4 条件を順に変更しても `listDepartments` の call は 1 回のまま。候補取得失敗は一覧 query と独立で、呼び出し側文言表示（catalog ⑨ 既定）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-UIBB-1 | Scope(1) | 各画面 RTL 表示/非表示対 | 表示条件の site 間一貫性 | Matrix + L3 |
| SPEC-UIBB-2 | Scope(1) | 各画面 RTL 全条件復帰 | 一部復帰の検出 | Matrix + L3 |
| SPEC-UIBB-3 | Scope(2) | schema unit | invalid 入力の握り方 | Matrix |
| SPEC-UIBB-4 | Scope(2) | pagination RTL | 条件維持 / reset の対 | Matrix |
| SPEC-UIBB-5 | Scope(2) | 51 件 synthetic RTL + rg 残存 0 | 二重表現の撤去完了 | Matrix + L3 |
| SPEC-UIBB-6 | Scope(3) | rg 静的 sweep + tsc | 定義残存 / re-export 方式のファイル別適合 | AC6 |
| SPEC-UIBB-7 | Scope(4) | doc-consistency | 二重記述 | AC7 |
| SPEC-UIBB-8 | Scope(2) | 範囲外 page RTL | 通常 EmptyState との優先判定 | AC9 |
| SPEC-UIBB-9 | Scope(2) | 候補不変 RTL + unit | 候補縮退の再発 | AC10 |

## Data Safety

- 実 POS データ・実店舗 CSV は使用しない（synthetic fixture のみ）。
- local-only paths: なし（本 change はデータファイルを扱わない）。
- synthetic-only paths: RTL fixture はテストコード内 inline 定義のみ。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Codex Plan Review round 1（2026-08-03、FAIL P1=5 / P2=6 / P3=0）

Coordinator 裁定（全件、採否前に引用 file:line を実読して裏取り済み）:

| Finding | 裁定 | 裏取りと対処方針 |
|---|---|---|
| P1-1 EmptyState 全数監査未完了 + ProductList 漏れ | accept | `ProductListPage` の filter-empty（既存「商品を登録する」action 併存）を実読確認。production 全 site の分類表を plan-first change 内で確定し、ProductList は reset 対象へ追加（登録 action と共存）。分類軸（絞り込み reset 対象 / 期間主キーレポート除外 / 明細 0 行除外 / 真にデータなし除外）を catalog ⑥ の design 出力として規定する |
| P1-2 範囲外 page 挙動の規定欠落 + clamp 慣行の事実誤認 | accept | 50 §50.4 / `ProductPagination.tsx` に clamp 契約が実在しないことを実読確認（Coordinator の起草時裏取り不足）。58 に UI-11c-D8 同型（範囲外 page = 専用メッセージ +「先頭ページに戻る」）を規定し、Matrix の二択を一意 oracle へ是正 |
| P1-3 部門候補 truncate の DSR-10 違反増幅 | accept | DSR-10（01:DSR-10 節）と 02 SearchBar/フィルタ節の「listDepartments master 全件」規定を実読確認。候補 query の `listDepartments()` 切替を Scope へ移し、Ledger / Matrix に候補不変契約を追加 |
| P1-4 SCREEN_DESIGN / UI_TECH_STACK 欠落 | accept | DEV_WORKFLOW Design artifact selection 表の該当行を実読確認。両 doc を Required Design Artifacts へ追加し反映 |
| P1-5 useProductList の単純 re-export 不成立 | accept | 同一ファイル内で `DepartmentOption[]` を使用することを実読確認。`import type` + `export type` の分離方式をファイル別に明記 |
| P2-1 reset page 復帰 assert の site 不足 | accept | site 別の全フィルタ tuple + page を Matrix に明記し個別 assert 化 |
| P2-2 FilePicker 二重記述 | accept | behavior/API 契約は §6.5.4 を正本のまま維持し、02 ⑭ を構造 / トークン / Do-Don't + リンク参照へ縮退（59 §59.1 の既存棲み分けどおり） |
| P2-3 Plans.md の stale 残存 | accept | 後回し Backlog 節の旧 defer 行を更新（sweep 範囲の指定漏れ = Coordinator 起草責任） |
| P2-4 採用数の実測説明誤り（D-050） | accept | 数値断定を撤去し、canonical source と正確な検索式の参照へ置換 |
| P2-5 58 疑似コードの `message=` prop 不一致 | accept | `title=` へ是正（既存 58 記述由来の drift、本 change で解消） |
| P2-6 Goal「一覧表示に戻れる」の契約不一致 | accept | 「各画面の既定状態へ回復（在庫照会は検索前 placeholder へ戻る）」へ修正 |

### Codex Plan Review round 2（2026-08-03、FAIL P1=1 / P2=6 / P3=1、round 1 closure = closed 6 / not closed 5）

Coordinator 裁定（全件、採否前に引用 file:line を実読して裏取り済み）:

| Finding | 裁定 | 裏取りと対処方針 |
|---|---|---|
| P1-1 UI-06a-D2 の結線空洞（hook return / props 未接続） | accept | 58 の return 行と `value=` prop（canonical 契約外）を実読確認。hook が `departmentOptions` + loading / error 状態を返し、Page が canonical props（options / selected / onChange / disabled）で結線する形へ 58 を改訂。候補取得失敗文言と一覧 query 独立、`queryKeys.stockInquiry.departmentOptions()` 無引数化を明示 target 化、Boundary へ `Department[]` → `DepartmentOption[]` 伝播を追記 |
| P2-1 stocktake の page 欠落 | accept | `stocktake/types.ts` の `page?: number` と `StocktakePage` の page=1 復帰実装を実読確認（Coordinator の検分漏れ）。分類表 tuple / 73 §73.6 / Matrix / SCREEN_DESIGN に page=1 を追加し、page assert を 6 site 全数へ |
| P2-2 daily-sales の分類軸重複 | accept | `DailySalesPage` の DepartmentFilter 実装を実読確認。優先規則を明文化して除外を維持: 対象選択条件（「すべて」という既定値を持たない必須の主キー = 日報の日付・月報の月）を持つレポート画面は、副次絞り込みがあっても reset 対象外。理由 = reset 統一契約は「全絞り込み条件の既定復帰」だが、対象選択は既定復帰の対象になり得ず、副次絞り込みだけ戻す部分 reset を許すと同じボタン文言で site ごとに挙動が変わる。部分 reset（「部門の絞り込みを解除」等の別文言）は要望発生時に別 change で再評価 |
| P2-3 SPEC-UIBB-9 oracle の query-key mutant 素通し | accept | status を 4 条件目として契約・AC・Ledger・Matrix に追加。同一 QueryClient 上で `listDepartments` call count = 1 の assert と、`queryKeys.stockInquiry.departmentOptions()` 無引数・一定 key の unit test を追加 |
| P2-4 FilePicker 正本分裂の残存 + 将来形記述 | accept | 02 ⑭ の onError フォールバック記述（behavior）残存と、§6.5.4 に props 契約（dropEnabled 等）がないこと、UI_TECH_STACK / DSR-14 の「暫定例外・移行予定」将来形を実読確認。§6.5.4 へ API 契約を集約、02 は visual に限定、59 / SPEC-UIBB-7 の Do/Don't 帰属を visual 限定へ、移行記述を完了形へ同期 |
| P2-5 Plans.md active dashboard の逆記述 | accept | 「次の行動」行の「5 site」と後回し Backlog の「未実装・いつかまとめて」行を実読確認。現行契約（6 site + 除外 19）へ同期し、backlog 行は batch B 昇格として取り消し線 + active packet link 化。FilePicker backlog 記述も完了記録と同期 |
| P2-6 数値主張の scope 不一致（Risk 5 画面 / import 8 file） | accept | Risk 節を 6 画面の実態へ更新。「import 8 file」は判断理由が件数に依存しないため件数を削除（D-050 の volatile count 回避） |
| P3-1 Design Readiness の SPEC 範囲 stale | accept | SPEC-UIBB-1〜9 へ更新 |

### Codex Plan Review round 3（2026-08-03、FAIL P1=0 / P2=3 / P3=0、round 2 closure = closed 7 / not closed 1、round 1 持ち越し = 全 closed）

Coordinator 裁定（全件、採否前に引用箇所を実読して裏取り済み — FUNCTION_DESIGN の「plain file input 暫定例外」2 箇所 / 60 UI-01c-D13 の file input L3 要求 / UI_TECH_STACK §6.7 の `createObjectURL(file)` / 58 冒頭の「2 useQuery」「4 key」を確認）:

| Finding | 裁定 | 裏取りと対処方針 |
|---|---|---|
| P2-1 FilePicker 完了宣言と 5 live docs の矛盾 | accept | round 2 是正の sweep 範囲を対象 7 file に限定した Coordinator の発注不備が原因（drift 是正は repo 全体 sweep が既定）。FUNCTION_DESIGN:41/140 / SCREEN_DESIGN の plain input 開始・L3 指示 / 60 の D13・Non-scope・Test Focus / 63 の Non-scope・Test Focus / UI_TECH_STACK §6.7 の `createObjectURL(file)` を FilePicker 現行方式（D14 / D20 参照、`PickedFile.bytes` → Blob → `createObjectURL(blob)`）へ同期。historical / superseded decision 行（60 D3 / 63 D4 の記録自体）は残置。historical 除外の repo-wide sweep を Review Focus へ追加 |
| P2-2 58 要約層の 2 query / 4 key 残存 | accept | round 2 是正で詳細（3 query / 5 key / 拡張 return）を更新した際、要約・構成表・データフロー・FUNCTION_DESIGN 索引の追随が漏れた（packet correction full sweep の同型）。58 の全要約層と FUNCTION_DESIGN:59/136 を「3 useQuery」「5 URL key」「実 return 形」へ同期し、旧表現は更新履歴のみに限定 |
| P2-3 SPEC-UIBB-9 の loading / error oracle 欠落 | accept | 契約（disabled 結線・isError alert・一覧独立）は 58 / packet に規定済みだが Matrix に殺す test がない。Matrix へ 2 行（pending → trigger disabled / reject + list 成功 → exact alert 文言と一覧の同時表示）を追加、58 §58.9 と Ledger へ転記、test harness の QueryClient retry 無効化を fixture 条件に明記 |

### Codex Plan Review round 4（2026-08-03、FAIL P1=0 / P2=1 / P3=1、round 3 の 3 件 = 全 closed）

Coordinator 裁定（採否前に引用箇所を実読して裏取り済み — 58 §58.9 の件数書き換え diff と DEV_WORKFLOW の D-038 実文言、60:138 の帰属行を確認）:

| Finding | 裁定 | 裏取りと対処方針 |
|---|---|---|
| P2-1 58 §58.9 のテスト件数転記（D-038 違反の新規混入） | accept | round 3 是正時に Writer 発注へ D-038 制約を明示しなかった Coordinator の発注不備。既存数値の書き換えは非遡及例外に当たらない。相互修正案の再発防止形を採用し「ケース数」列と合計件数・file 数を撤去、表は file / 契約・oracle 対応のみとし、見出しに D-038 参照を明記。実件数は PR body / CI 出力を正とする |
| P3-1 60 Test Focus の supersede 済み D3 帰属 | accept | 現行 Test Focus の帰属を UI-01c-D14 単独へ是正。D3 は decision table と D14 の supersede 説明にのみ残置 |

是正は表記・帰属のみで Scope / design 契約を変えないため、Workflow State 遷移表の「a plan-gate rejection corrected in place stays at plan-gate for re-review」を適用し、backtrack せず plan-gate 在留のまま本是正 content commit を積んで round 5（closure 確認）に出す。
