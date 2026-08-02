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

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / L3 目視 + Ready 承認 / merge）
- 実働時間上限: 30分
- relay 往復上限: 4（batch A 実績 6/4 を踏まえた調整値。Plan Review 複数 round + Final Review を見込む。超過が見えた時点で Coordinator が停止し owner 承認を得る）

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
(a) 在庫照会 pagination は `page` URL search param の新設 = Risk Tiers の「route/search state」に直接該当する。(b) filter reset は 5 画面の operator 可視挙動の新設で、うち 4 画面は URL search param の書き換えを伴う（「UI route/search behavior」）。(c) batch A が Plan Review round 1 で R2→R3 再分類された前例（operator workflow の runtime 契約新設は R3）に同型。Tauri command / DTO / DB / 生成 bindings には触れない（`search_products` は既存の `page` パラメータを可変にするだけで wire shape 不変）。

## Goal

Goal Invariant:

### 最小完了条件

- filter-empty（絞り込み非既定で 0 件）の一覧 5 画面で、operator がワンクリックで絞り込みを解除して一覧表示に戻れる。
- 在庫照会「すべて」で 50 件超の商品にページ送りで到達できる（従来は先頭 50 件で打ち切り告知のみ）。
- FilePicker が design-system catalog に登録され、DepartmentFilter 共通化系の正本 drift（完了済みの共通化を未完扱いする記述）が解消される。

### 失敗定義

- reset が一部のフィルタだけ戻し、絞り込み状態が残ったまま「解除した」と見える。
- pagination が page 移動時に検索条件を落とす、または条件変更時に page が残って空ページを表示する。
- 正本 sync が新たな drift（二重記述・自己矛盾）を作る。

### 非目的

- FilePicker の multiple 対応拡張、および daily-report-import / backup-restore / plu-export の FilePicker 統合（Non-scope 参照）。
- pagination の他画面への展開、perPage 選択 UI の追加。
- 部門 options 導出の 50 件 truncate 既知 gap の解消（Review Focus 参照）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

### (1) filter-empty reset action（5 site + 適用除外 1 site）

site manifest（2026-08-03 Coordinator 実測。行番号は起草時点、anchor は EmptyState title literal）:

| # | 画面 | file / anchor | reset 対象（正本） | 判定 |
|---|---|---|---|---|
| 1 | 棚卸し UI-10 | `src/features/stocktake/StocktakePage.tsx`「この条件に一致する商品がありません」 | 部門フィルタ + 未入力のみ表示（73） | reset 対象 |
| 2 | 在庫照会 UI-06a | `src/features/stock-inquiry/StockInquiryPage.tsx`「該当する商品がありません」 | q / dept / status（58 §58.4） | reset 対象 |
| 3 | 入出庫履歴一覧 | `src/features/inventory-records/InventoryRecordsPage.tsx`「入出庫履歴がありません」 | 検索条件（65 の search 正本） | reset 対象 |
| 4 | 在庫変動履歴 UI-06c | `src/features/stock-movements/StockMovementsPage.tsx`「在庫変動履歴がありません」 | dateFrom / dateTo / type（66、page も既定へ） | reset 対象 |
| 5 | 操作ログ UI-11c | `src/features/operation-logs/OperationLogsPage.tsx`「該当する操作ログがありません」 | 期間・種別（74。既存 `defaultFilter` 判定を流用） | reset 対象 |
| 6 | 入庫 UI-04 | `src/features/receiving/ReceivingPage.tsx`「入庫する商品がありません」 | —（明細 0 行 = 絞り込み空ではない） | **適用除外**（semantic 相違を catalog ⑥ 適用除外へ明記） |

統一契約（02 ⑥ へ design 出力として新設）:

- 絞り込み条件が既定値以外かつ結果 0 件のとき、EmptyState の `action` に絞り込み解除ボタン（outline）を置く。
- 押下でその画面の絞り込み条件をすべて既定値へ戻す。URL search param 画面は param を既定へ、local state 画面は state を既定へ。page を持つ画面は page も既定（1）へ戻す。
- 既定値のまま 0 件（真にデータなし）のときは action を出さない。
- ボタン文言は 5 site 統一（具体文言は 02 ⑥ の design 出力で確定。候補「絞り込みを解除」）。

### (2) 在庫照会 pagination（UI-06a、58 へ design 出力）

- `page` search param 新設（50 §50.4 と同型: number >= 1、既定 1、invalid は catch で既定に落とす）。
- 対象は `status=all`（`search_products` 経路）のみ。在庫少 / 在庫切れ status は `list_low_stock` の client filter 経路のため対象外（現状維持）。
- q / dept / status の変更で `page=1` に戻す。page 移動だけは条件を維持する（50 §50.4 慣行の踏襲）。
- 既存 canonical `src/features/products/components/ProductPagination.tsx` を結線し、`total_count` から最終ページを計算する。
- `TruncatedResultsAlert` と派生 flag `truncated` は、pagination により全件到達可能になるため撤去する（58 の design 出力で decision 化。stock-inquiry `types.ts` の view-model 契約更新）。

### (3) DepartmentOption re-export 統一

- feature 側ローカル定義 3 箇所（`src/features/products/hooks/useProductList.ts` / `src/features/daily-sales/types.ts` / `src/features/stock-inquiry/types.ts`、2026-08-03 実測 `rg -n "export interface DepartmentOption" src` = 計 4 hit 中 patterns 正定義以外の 3）を削除し、`@/components/patterns/DepartmentFilter` からの re-export（`export type { DepartmentOption } from ...`）へ統一する。consumer の import path は不変。

### (4) FilePicker catalog 登録

- `docs/design-system/02-component-catalog.md` へ FilePicker パターン節を新設（DOM 構造 / トークン / Do-Don't / 採用箇所。方針・経緯の正本は UI_TECH_STACK §6.5.4 のままとし二重記述しない）。
- `docs/function-design/59-ui-shared-patterns.md` §59.3 へ適用除外注記: FilePicker は plugin-dialog / plugin-fs 副作用を持つため patterns/（§59.4 純表示部品規約）の対象外、`src/components/FilePicker.tsx` 配置のまま catalog 管理とする。

### (5) 正本 stale 是正（DepartmentFilter 共通化完了の追随）

- 58 §58.7「UI-06a 用ローカル実装」表記 → 共通 `patterns/DepartmentFilter` 使用へ更新。
- 58 §58.13: pagination 行（本 change で実装のため削除）+ DepartmentFilter 共通化行（PR-B で完了済みのため削除）。更新履歴へ記録。
- 50 非目的の「`DepartmentFilter` / `DepartmentOption` の feature 間共通化」行を削除（同 doc §50.3 の「PR-B で統合」記述との自己矛盾解消）。
- 59 §59.1 DepartmentFilter 行の採用箇所「daily / products / stock の 3 画面」→ stocktake を加えた 4 画面へ。EmptyState 行の採用箇所も Writer が rg 全数で再実測して sync。
- 59 §59.3「re-export への統一は将来 PR の対象」→ 本 change で実施済みの記述へ。

## Non-scope

- daily-report-import / backup-restore / plu-export の FilePicker 統合。Coordinator 実査（2026-08-03）: plu-export は `save()`（書き出し先選択）、backup-restore は `open({directory: true})`（フォルダ選択）で読込み契約 `{bytes, filename, size}` の対象外。daily-report-import は `open({multiple: true})` + Z001/Z002/Z005 ちょうど 3 ファイル検証 + 直前フォルダ記憶で、統合には FilePicker の multiple 契約拡張が必要 = 別 R3 規模。将来拡張候補として Plans.md へ disposition を残す。
- UI-09b 日報 coverage 表示（DTO 変更必要、batch A から継続の別 R3）。
- DTO 由来 runtime route 文字列の構造化 DTO 化（既存 backlog、別 R3）。
- 部門 options 導出の 50 件 truncate 既知 gap（Review Focus 参照、既存挙動据え置き）。
- perPage 選択 UI、在庫少 / 在庫切れ status への pagination 適用。
- `EmptySearchPlaceholder` / shortcuts `emptyMessage` への reset 適用（catalog ⑥ 既存の適用除外どおり semantic 相違）。

## Acceptance Criteria

- AC1: manifest 5 site で「絞り込み非既定 + 0 件」時に reset action が表示され、押下で当該画面の絞り込み条件がすべて既定値へ戻る。evidence = 各画面 RTL test `SPEC-UIBB-1 絞り込み該当なしで解除ボタンを表示する` / `SPEC-UIBB-2 解除で全条件が既定値に戻る`（Matrix 参照）+ L3 代表画面目視。
- AC2: 既定値のまま 0 件のとき reset action は表示されない。evidence = 各画面 RTL negative test `SPEC-UIBB-1 既定条件の0件では解除ボタンを出さない`（Matrix 参照）。
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
| Screen / UI / route state / Japanese wording | 02 ⑥ filter-reset 規定 / 58 pagination 設計 / 59 sync / 50 sync / 65・66・73・74 の該当節追記 | updated in this PR（plan-first change 内で design 出力を反映） |
| CSV / TSV / report / import / export format | なし | existing sufficient |
| Durable decision / ADR | 58 の truncated alert 撤去 decision、02 ⑥ reset 統一契約 | updated in this PR |

## Registration / Generation Obligations

該当なし — 新規 Tauri command / function-design doc / REQ / route / 画面の新設はない。`page` search param は既存 route の validateSearch schema 拡張であり routeTree 生成物は不変（L1 full の生成系 clean diff 検査が機械確認する）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-UIBB-1/2（reset） | 02 ⑥（新設規定） | catalog ⑥ reset 規定（本 change design 出力） | EmptyState の既存 `action` slot を使い新規 primitive を作らない。画面別の独自ボタン配置は 5 site の一貫性を壊すため却下 | manifest 5 site + 02 ⑥ | 各画面 RTL + L3 |
| SPEC-UIBB-3/4/5（pagination） | 50 §50.4（慣行元）、58（新設） | UI-06a 系列新 D（58 design 出力で採番） | 50 慣行の踏襲で新規 UX を発明しない。truncated alert 併存は「打ち切り告知 + ページ送り」の二重表現になるため撤去 | stock-inquiry route/search + StockInquiryPage | RTL + L3 |
| SPEC-UIBB-6（re-export） | 59 §59.3 | 59 §59.3 既存方針の実施 | 構造的サブタイプ残置は将来の定義 drift 温床。consumer import 不変の re-export が最小差分 | feature types 3 file | tsc + rg 静的 sweep |
| SPEC-UIBB-7（FilePicker catalog） | UI_TECH_STACK §6.5.4（方針正本）、02（新節） | 59 §59.4 純表示規約により patterns/ 移動は却下、components/ 直下のまま catalog 登録 | 移動は import 8 file の変更面拡大に見合う利得がない | 02 新節 + 59 §59.3 注記 | doc-consistency + Final Review rg |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 実装後は 02 ⑥ / 58 / 59 / 50 の正本だけで reset 契約・pagination 契約・SSOT 配置が読める。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: reset 統一契約 → 02 ⑥、truncated alert 撤去 → 58、FilePicker patterns/ 非対象 → 59 §59.3（いずれも同一 plan-first change 内で反映）。
- Assumptions and constraints: `search_products` の page/per_page 既存契約が変わらないこと（wire 不変）。stock-inquiry の在庫少経路は client filter のため件数有限で pagination 不要という 58 既存前提。
- Deferred design gaps, risk, and follow-up target: 部門 options 導出の 50 件 truncate（Review Focus）、daily-report-import の multiple FilePicker 拡張（Plans.md backlog）。
- Test Design Matrix can cite design decision IDs or source doc sections: 可（Matrix の Contract 列は本 packet の SPEC-UIBB-n と 02 ⑥ / 58 / 50 §50.4 を引く）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: reset は既定値復帰のみで破壊的操作なし。invalid page param は catch で既定へ（escape hatch = zod catch、既存 50 慣行と同型）。

## Impact Review Lenses

not applicable — 本 change は field 調査・実機挙動・外部 tool・POS 連携・帳票形式の発見を起点とせず、既存 backlog 起票（UI-10 契約監査 / 58 §58.13 defer / PR #125 L3 feedback）の消化である。環境・再現性 lens: 新設の環境依存なし（既存 toolchain のみ）。

## Design Readiness

- Existing design docs are sufficient because: 50 §50.4（page 慣行）、02 ⑥（EmptyState 正典）、⑩（ProductPagination canonical）、UI_TECH_STACK §6.5.4（FilePicker 方針）が実装の骨格を既に規定している。
- Source docs updated in this PR: 02 ⑥ reset 規定 + FilePicker 新節、58 pagination 設計 + stale 整理、59 §59.1/§59.3 sync、50 非目的整理、65 / 66 / 73 / 74 へ reset 行追記。
- Design gaps intentionally deferred: 部門 options truncate、multiple FilePicker。
- Durable decisions discovered in this plan and promoted to source docs: Design Intent Audit 参照。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層のみ。CMD 以下に変更なし。
- Backend function design: 変更なし。
- Command / DTO / data contract: wire 不変（AC 参照）。view-model の `truncated` flag 撤去は frontend 内契約。
- Persistence / transaction / audit impact: なし。
- Operator workflow / Japanese UI wording: reset ボタン文言は 02 ⑥ で統一確定。既存 description 文言との整合を Plan Review 観点に含める。
- Error, empty, retry, and recovery behavior: 空状態 2 系統（0 件成功 / 取得失敗）の既存区分は不変。reset は 0 件成功系のみに付く。
- Testability and traceability IDs: SPEC-UIBB-1〜7 を Matrix / test 名に付す。

## Contract Probe

N/A — 未検証の外部前提なし。TanStack Router validateSearch の param 追加（50 で実証済み）、ProductPagination 再利用（5 画面で稼働中）、EmptyState `action` slot（operation-logs で稼働中）、type re-export はいずれも repo 内で稼働実績のあるパターンの適用である。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| 02 ⑥ reset 表示条件（非既定 + 0 件のみ） | manifest 5 site | 各画面 RTL（表示 / 非表示の対） | L3 代表画面 |
| 02 ⑥ reset 動作（全条件既定値復帰 + page=1） | 同上 | 各画面 RTL（複合フィルタ設定 → 全戻り検証） | L3 代表画面 |
| 02 ⑥ 適用除外（receiving 明細空 / EmptySearchPlaceholder / shortcuts） | 変更なしの確認 | 既存 characterization PASS | non-scope（diff 監査） |
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
- consumer: `StockInquiryPage` → `commands.searchProducts({ page, per_page: 50, ... })`
- wire type: `page: number`（`ProductSearchQuery` 既存フィールド、変更なし）
- internal type: zod schema `number >= 1`、`.catch` で既定 1
- precision/range: 正整数のみ。最終ページ超過は `total_count` から clamp（50 §50.4 慣行）
- round-trip path: URL → validateSearch → query → 応答 `total_count` → ProductPagination 表示 → navigate で URL 更新
- invalid input: 非数値 / 0 / 負数 / 小数は catch で既定 1（画面エラーにしない）
- compatibility: 既存 URL（page なし）は既定 1 で従来どおり先頭 50 件表示。`truncated` flag 撤去は frontend view-model 内で完結し、他画面・bindings に波及しない

## Review Focus

- reset の「全条件復帰」に漏れがないか（画面ごとの条件列挙を各正本 65 / 66 / 73 / 74 / 58 と突合。一部復帰は失敗定義そのもの）。
- 既知 gap（本 change の回帰ではない、据え置き）: 在庫照会の部門 options は `per_page: 50` の先頭 page 応答から導出しており、50 件超のとき options が不完全になる既存挙動。pagination 導入で顕在化しやすくなるため、backlog 起票の要否を Plan Review で判定。
- operation-logs の既存「先頭ページに戻る」action（範囲外回復用）と reset action の共存 semantic。
- stale 是正が更新履歴を持つ doc で履歴行を欠かさないこと。

## Spec Contract

Contract ID: SPEC-UIBB

- SPEC-UIBB-1: filter-empty reset action は「絞り込み非既定 + 結果 0 件」のときのみ表示される（5 site 共通）。
- SPEC-UIBB-2: reset 押下で当該画面の絞り込み条件がすべて既定値へ戻り、page を持つ画面は page も既定へ戻る。
- SPEC-UIBB-3: 在庫照会 `page` search param は number >= 1、invalid は catch で既定 1。
- SPEC-UIBB-4: q / dept / status 変更で page=1、page 移動のみでは条件維持。
- SPEC-UIBB-5: 在庫照会「すべて」は全件がページ送りで到達可能、`TruncatedResultsAlert` は撤去。
- SPEC-UIBB-6: `DepartmentOption` の定義は `patterns/DepartmentFilter.tsx` の 1 箇所のみ、feature 側は re-export。
- SPEC-UIBB-7: FilePicker は 02 catalog に登録され、方針正本 §6.5.4 と実装規約 02 の責務分離を保つ（二重記述なし）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-UIBB-1 | Scope(1) | 各画面 RTL 表示/非表示対 | 表示条件の site 間一貫性 | Matrix + L3 |
| SPEC-UIBB-2 | Scope(1) | 各画面 RTL 全条件復帰 | 一部復帰の検出 | Matrix + L3 |
| SPEC-UIBB-3 | Scope(2) | schema unit | invalid 入力の握り方 | Matrix |
| SPEC-UIBB-4 | Scope(2) | pagination RTL | 条件維持 / reset の対 | Matrix |
| SPEC-UIBB-5 | Scope(2) | 51 件 synthetic RTL + rg 残存 0 | 二重表現の撤去完了 | Matrix + L3 |
| SPEC-UIBB-6 | Scope(3) | rg 静的 sweep + tsc | 定義残存 | AC6 |
| SPEC-UIBB-7 | Scope(4) | doc-consistency | 二重記述 | AC7 |

## Data Safety

- 実 POS データ・実店舗 CSV は使用しない（synthetic fixture のみ）。
- local-only paths: なし（本 change はデータファイルを扱わない）。
- synthetic-only paths: RTL fixture はテストコード内 inline 定義のみ。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
