# Plan Packet — UI backlog 消化 batch A（UI 小物 3 件）

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 0f66764
- Amendments: 3c103aa 69a94ec f0021d0 6fc3568
- Coordinator: Claude (Fable 5)
- Writer: Claude (Sonnet 5 subagent、worktree isolation)
- Plan Reviewer: Codex (cross-vendor)
- Final Reviewer: Codex (cross-vendor、fresh context)
- Reviewed Content HEAD: 1edf94f
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: L3 Windows native 目視（sidebar focus / 復元成功 Alert / 代表画面の内部遷移）、Ready 承認、merge

遷移記録（append-only）: 本 packet を追加する content commit で `kickoff -> spec-check -> plan-draft -> plan-gate` を材料化する。evidence = task scoped + Risk R2 を本 packet に記録（kickoff→spec-check）、Design Readiness が既存設計 docs 十分を cite（spec-check→plan-draft の許可された skip）、packet 完成と commit（plan-draft→plan-gate）。

2026-08-02 Codex Plan Review round 1 = FAIL（P1=1 / P2=5 / P3=0）。P1 = 復元成功通知が新規 state 契約を伴い Risk Tiers の R3 条件（route/search state / operator workflow）に該当、R2 での plan-gate は無効。Design Readiness の focus ring「明文規範なし」も UI_TECH_STACK.md §5.4 実在により事実誤認（P2-5）。最早影響 phase = design（68 への通知契約追記と UI_TECH_STACK §5.4 の source-doc sync が必要）のため `plan-gate -> design` へ backtrack する。findings の裁定詳細は Review Response 参照。

2026-08-02 是正 content commit で `design -> plan-draft -> plan-gate` を再材料化する。evidence = design 出力を source docs へ反映（68-ui-backup-restore.md UI-11b-D11 新設 + UI_TECH_STACK.md §5.4 の実装標準同期、同一 plan-first change 内 — design→plan-draft）、R3 packet 再構成 + Test Design Matrix commit（plan-draft→plan-gate）。

2026-08-03 Codex Plan Review round 2 = FAIL（P1=0 / P2=3 / P3=1、全件 round 1 是正で投入した content への closure defect）。P2 = D11 の one-shot 意味論が「mount 中の表示維持」を規定せず StrictMode 下で Alert 不可視の実装を許す / §5.4 の「全フォーカス可能要素で 3px」が catalog 632・646 行と既存実装（segmented-control 等）に対する新規 drift を作る / Matrix が template 必須節（State Lifecycle Matrix / Adjacent Pattern Audit / Residual Test Gaps）と Ledger 隣接契約（UI-11b-D2/D3/D10、UI-12-D1）を欠く。いずれも design 出力の改訂を要するため `plan-gate -> design` へ再 backtrack する（直前 backtrack との間に content commit 5b24aa9 があり隣接ではない）。裁定詳細は Review Response 参照。

2026-08-03 round 3 是正 content commit で `design -> plan-draft -> plan-gate` を再材料化する。evidence = round 2 closure の design 出力は commit `3578518` で source docs / Matrix へ反映済み（design→plan-draft）、本 commit の round 3 P1/P2 是正（Phase 記録の欠落是正 + Link 統一 site manifest 追加）で packet 完成・commit（plan-draft→plan-gate）。註（round 3 P1 の記録）: `3578518` の commit 件名は同遷移を宣言していたが packet の Phase 更新と遷移記録を欠いており、遷移は本 commit で初めて成立する。件名と Workflow State の不一致は本註をもって是正記録とする。

2026-08-03 state-only 遷移 commit で `plan-gate -> plan-approved -> implementing` を材料化する（圧縮記録、STATECAP 1/3）。evidence = 独立 Plan Reviewer（Codex、Writer と別 vendor）が round 4 で「Plan Review PASS P1/P2=0」を報告（plan-gate→plan-approved）、`Plan Commit` = 0f66764 を設定し、plan-first 系列（350100a〜0f66764）は全実装 commit に先行する。owner が 2026-08-03 に plan を承認し実装開始を指示（介入 1 回目/予算 3 回）（plan-approved→implementing）。

2026-08-03 state-only 遷移 commit で `implementing -> local-verified -> independent-review -> human-confirm` を材料化する（圧縮記録、STATECAP 2/3）。evidence = content candidate `1edf94f` の L1 full PASS / TREE CLEAN（PR #57 body に evidence SHA と log path 収録、implementing→local-verified）、Final Reviewer（Codex、fresh context）round 1 実施 + mutation 実注入 5 件 red（local-verified→independent-review）、closure round で P1/P2=0 確定・再注入 2 件 red 独立再現（independent-review→human-confirm）。P3（「9 file」表記残存）は Findings Freeze 規定の follow-up（非 blocker）だが commit `6fc3568` で closure 済み — 残 hit は Review Response 経緯記録 2 箇所のみ（rg 実測、closure 条件充足）。`Reviewed Content HEAD` = 1edf94f（Final Reviewer が監査した content commit。6fc3568 は packet 表記同期のみの gated amendment）。relay 実績 = 6/4（超過 2: Final Review round 1 と closure round。X3 survivor の是正確認に mutation 再注入の独立再現が代替不可のため。owner の relay 実施をもって承認）。Human Gate 残 = owner L3 目視（PR body 記載の 3 手順）+ Ready 承認 + merge。

2026-08-03 owner L3 実施（PR #57 comment）: D11 Alert 寿命契約 / SPA 遷移・検索条件維持 / focus ring 表示は PASS。指摘 2 件 — (a) sidebar 表記「バックアップ」を画面タイトルと揃う「バックアップ・復元」へ修正要（52 §52.4 の正本記述自体が「バックアップ」のため正本 sync を伴う文言 fix）、(b)「CSV取込み #1」元記録 link が 404（`/csv-import/records/*` 詳細 route 不在。UI-06c-D7 の明示契約「未実装 route でも source.route をそのまま表示」どおりで本 change の回帰ではないと Coordinator が実証 — route file 不在 + D7 文言を実読確認。対処は backlog 起票）。(a) の code fix のため `human-confirm -> implementing` へ backtrack する。

2026-08-03 state-only 遷移 commit で `implementing -> local-verified -> independent-review -> human-confirm` を再材料化する（STATECAP 3/3）。evidence = 是正 content commit `0c1f050`（navigation label + 52 正本 2 行 sync + 404 backlog 起票）の L1 full PASS / TREE CLEAN（implementing→local-verified）。Review-only skipped because: 是正は label literal 1 語と正本表記 2 行の同期のみで契約面（IPC / route / state / Ledger 行）に触れず、Coordinator が rg 残存 0・targeted test 24 pass・L1 full で機械検証済み。relay 予算超過 2 の現況で追加 relay に見合う監査面がない（local-verified→independent-review、Review Rules の R3 skip 記録）。新規 findings なし P1/P2=0 維持（independent-review→human-confirm）。`Reviewed Content HEAD` は Final Reviewer が実監査した `1edf94f` のまま維持し、`0c1f050` は上記 skip 記録に基づく post-review correction として本記録で追跡する。Human Gate 残 = owner の sidebar 表記再確認（L3 差分確認のみ）+ Ready 承認 + merge。

2026-08-03 owner が sidebar 表記「バックアップ・復元」を L3 再確認 pass とし Ready を承認（介入 3 回目/予算 3 回、budget 内で完了）。state-only 遷移 commit で `human-confirm -> ready-hosted-final` を材料化する。この commit の resulting exact HEAD で L1 full を実行し PR body を更新、owner の Ready 化 → hosted 三点一致 → merge へ進む。

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / L3 目視 + Ready 承認 / merge）
- 実働時間上限: 30分
- relay 往復上限: 4（Plan Review round 1〜3 で 3/4 消化。残 1 = Final Review。round 4 closure confirmation を挟む場合は 5/4 の超過 1 となるため、超過をここに明示し owner の relay 実施をもって承認と扱う）

実績（2026-08-03 Ready 承認時点の確定値）: 介入 3/3（plan 承認 / L3 目視 / 表記再確認 + Ready 承認）、relay 6/4（Plan Review 4 round + Final Review round 1 + closure round。超過 2 の承認経緯は Workflow State 遷移記録参照）。本実績記録と ready-hosted-final 遷移を載せる本 commit は STATECAP 上限（forward state-only 3 本消化済み）のため content commit として作成する gated amendment であり、tracked file は自身の SHA を持てない（D-035）ため本 commit の SHA は PR body の Amendments 補記で追跡する。

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
Plan Review round 1 P1 の裁定により R2 から再分類。根拠 = (a) 復元成功通知はホーム画面という遷移先画面の operator 可視挙動を新設し、one-shot 意味論という検証可能な runtime 契約を持つ（Risk Tiers R3 の「operator workflow」近傍 + R2/R3 不確実時は R3 を選ぶ規則）、(b) 生 `<a href>` の `<Link>` 統一は全画面リロード遷移から SPA 遷移への UI route 挙動の変更に当たる（同「UI route/search behavior」）。Tauri command / DTO / DB / 生成 bindings には触れない。

通知の実装機構は in-memory one-shot flag とし、router / history state・URL search param を使わない（UI-11b-D11）。これにより browser state への新規契約は発生しないが、上記 (a)(b) により Risk は R3 のまま維持する。

当初候補だった「UI-09b 日報 coverage 表示」は、`get_monthly_sales` の返却型（`MonthlySalesReport`）に取込み済み日数を導出できる情報がなく DTO 変更 = 別 R3 になるため、本 packet から除外し UI-09 設計検討系の後続 R3 へ移管した（Non-scope 参照）。

## Goal

Goal Invariant:

### 最小完了条件

- operator がキーボード操作時に sidebar link の focus 位置を視認できる
- 復元成功後、ホーム画面で成功 Alert を視認できる（68-ui-backup-restore.md UI-11b-D4 / F6 / D11 の契約どおり。現状は遷移前の一時 toast のみで契約未達）
- 一覧・詳細画面の内部遷移が TanStack Router `<Link>` に統一され、生 `<a href>` による全画面リロード遷移が残らない

### 失敗定義

- L3 で従来到達できた画面導線が壊れる、または既存画面の表示に regression が出る
- 復元成功 Alert が reload・履歴 back/forward・通常到達で表示される（UI-11b-D11 one-shot 契約の破れ）
- 既存 test の削除・無効化・skip で green を作る

### 非目的

- 新規画面・新規 Tauri command・visual design の刷新
- DTO 由来 runtime route 文字列（`detail_route` / `MovementSourceLink.route`）の構造化 DTO への変更（別 R3 候補として backlog 起票のみ）

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `src/components/layout/SidebarLink.tsx` の focusable な link（active / inactive）へ、UI_TECH_STACK.md §5.4 系統①の focus ring `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` を追加する（52 §52.1 の規定どおり。pending は `tabIndex={-1}` で focus 対象外）。active / inactive / pending の既存表示を壊さない
- src/ 配下の internal 遷移の生 `<a href>` 全 19 箇所（10 file、下記「Link 統一 site manifest」に全列挙）を TanStack Router `<Link>` へ統一する。2 群に分けて扱う:
  - **static 群（9 箇所）**: 遷移先が compile-time に決まる箇所。型付き `to` / `search` へ完全移行
  - **runtime 群（10 箇所）**: `returnTo` / `InventoryRecordSummary.detail_route` / `MovementSourceLink.route` 等の runtime 文字列由来。`<Link to={string}>` で SPA 遷移のみ保証し、compile-time typed navigation は主張しない（Plan Review round 1 P2-2 の選択肢②を採用）
  - `sourceHref()` / `buildDetailHref()` 等の href 組み立て helper は `<Link>` props へ渡せる形へ追随変更する（DTO は不変）
- `src/features/backup-restore/BackupRestorePage.tsx` の復元成功時（現状 `toast.success` + `navigate({ to: "/" })`）を、UI-11b-D11 の in-memory one-shot flag 機構でホーム遷移後の success Alert 表示へ是正する
- 設計正本 sync（本 plan-first change 内で実施済み）: 68-ui-backup-restore.md へ UI-11b-D11 新設（round 2 で mount 中表示維持の寿命契約へ改訂）+ §68.7 `restore_succeeded` 行へ D11 参照付記、UI_TECH_STACK.md §5.4 を outcome 契約 + 実装 2 系統（shadcn primitive / SidebarLink 系統①、catalog 規定の date・month input 等 系統②）へ改訂、52 §52.1 SidebarLink 行へ focus ring 規定追加（pending は focus 対象外）
- 上記の test 追随（既存 test の削除・無効化なし）。Affected Surfaces 節の 11 test file（original group + amendment 2）を含む

## Non-scope

- UI-09b 日報 coverage 表示（DTO 変更必要 = 別 R3。UI-09a/b 将来設計検討と同系の後続 R3 へ移管）
- runtime route 文字列の構造化 DTO 化（前掲）
- pagination「すべて」/ DepartmentFilter 共通化（58 §58.13 defer、別 packet）
- FilePicker 残務（catalog 登録等、別 packet）
- Storybook / Error Boundary / unsaved changes（別 packet）
- 52 §52.3 ルーティング表の URL 陳腐化是正（docs backlog、別途）
- external link 対応（src/ に external link は 0 件と確認済み）
- `src/components/ui/` 既存 component 群の focus ring 変更（§5.4 は outcome 契約 + 実装 2 系統の併記であり、既存 component 実装は系統①・②とも不変）

## Link 統一 site manifest（19 site / 10 file、2026-08-03 実測）

runtime 群 10 site（route が実行時文字列由来。`<Link to={string}>` で SPA 遷移のみ保証）:

| # | file:line | route 由来 | evidence |
|---|---|---|---|
| 1 | `src/features/inventory-records/ManualSaleRecordDetailPage.tsx:86` | `backHref = normalizeReturnTo(returnTo)` | C2 機械 gate |
| 2 | `src/features/inventory-records/ManualSaleRecordDetailPage.tsx:104` | 同上 | C2 |
| 3 | `src/features/inventory-records/ReturnRecordDetailPage.tsx:101` | 同上 | C2 |
| 4 | `src/features/inventory-records/ReturnRecordDetailPage.tsx:119` | 同上 | C2 |
| 5 | `src/features/inventory-records/DisposalRecordDetailPage.tsx:84` | 同上 | C2 |
| 6 | `src/features/inventory-records/DisposalRecordDetailPage.tsx:102` | 同上 | C2 |
| 7 | `src/features/inventory-records/ReceivingRecordDetailPage.tsx:78` | 同上 | C2 |
| 8 | `src/features/inventory-records/ReceivingRecordDetailPage.tsx:96` | 同上 | C2 |
| 9 | `src/features/inventory-records/InventoryRecordsPage.tsx:325` | `buildDetailHref(record.detail_route, returnTo)`（DTO 由来） | **C3/C4 代表（runtime）** |
| 10 | `src/features/stock-movements/components/MovementTable.tsx:79` | `sourceHref(movement.source.route, returnTo)`（DTO 由来） | **C3/C4 代表（runtime）** |

static 群 9 site（path template が compile-time に決まる。型付き `<Link to/search>` へ完全移行）:

| # | file:line | href 式 | evidence |
|---|---|---|---|
| 11 | `src/features/daily-report-import/DailyReportImportPage.tsx:297` | `` `/reports/daily?date=${...}` `` | **C3/C4 代表（static、search 付き）** |
| 12 | `src/features/stock-movements/StockMovementsPage.tsx:61` | `` `/stock?selected=${...}` `` | C2 + typecheck |
| 13 | `src/features/inventory-records/ManualSaleRecordDetailPage.tsx:146` | `` `/reports/daily?date=${...}` `` | C2 + typecheck |
| 14 | `src/features/inventory-records/ManualSaleRecordDetailPage.tsx:182` | `` `/stock/${...}` `` | C2 + typecheck |
| 15 | `src/features/inventory-records/ReturnRecordDetailPage.tsx:215` | `` `/stock/${...}` `` | C2 + typecheck |
| 16 | `src/features/inventory-records/DisposalRecordDetailPage.tsx:179` | `` `/stock/${...}` `` | C2 + typecheck |
| 17 | `src/features/inventory-records/ReceivingRecordDetailPage.tsx:172` | `` `/stock/${...}` `` | C2 + typecheck |
| 18 | `src/features/operation-logs/OperationLogsPage.tsx:175` | `` `${RELATED[recordType]}...` ``（frontend 定数 map、typed 化には map を `to` 構造へ変更） | C2 + typecheck |
| 19 | `src/features/stock-inquiry/components/StockDetailContent.tsx:68` | `ActiveCta` prop 経由（唯一の呼び出し元 :127 が `` `/stock/${...}/movements` `` 固定 template。`ActiveCta` を `<Link>` 化し props を構造化） | C2 + typecheck |

file:line は本 manifest 作成時点（HEAD `3578518`）の実測。実装時の行ずれは file 単位の同定で吸収し、site の増減があれば C2 canary との不一致として検出する。

## Affected Surfaces

`<Link>` 化により Router context が必要になり得る既存 test file（plan 時点で当初列挙した実在確認済み group）:

- `src/features/operation-logs/OperationLogsPage.test.tsx`
- `src/features/stock-movements/StockMovementsPage.test.tsx`
- `src/features/stock-movements/components/MovementTable.test.tsx`
- `src/features/daily-report-import/DailyReportImportPage.test.tsx`
- `src/features/daily-report-import/DailyReportImportPage.flow.test.tsx`
- `src/features/inventory-records/InventoryRecordsPage.test.tsx`
- `src/features/inventory-records/DisposalRecordDetailPage.test.tsx`
- `src/features/inventory-records/OtherRecordDetailPages.test.tsx`
- `src/features/stock-inquiry/components/StockDetailContent.test.tsx`

実装時発見の追加 2 file（gated amendment 2026-08-03。`StockDetailContent` を埋め込むため Router context が必要になった）:

- `src/features/stock-inquiry/StockInquiryPage.test.tsx`
- `src/features/stock-inquiry/components/ProductListTable.test.tsx`

方針: 直接 render している test は Router wrapper（memory history）または限定 mock を群ごとに割り当てる。Router bootstrap の重複を避けるため共有 helper `src/test/render-with-router.tsx` を新設（catch-all root route 方式）。dynamic route / search の検証は既存の real-router route test 群で行う。既存 assertion の削除・弱体化はしない。

## Acceptance Criteria

- 生 `<a href>` 検証: `rg -U --count-matches '<a\s+[^>]*href=' src --glob '*.tsx' --glob '!*.test.tsx'` が 0 件（変更前 baseline と変更後 0 件の実出力は D-038 Evidence Ownership に従い PR body へ収録し、本 packet には転記しない）
- sidebar link の class に `focus-visible:ring-[3px]` literal が含まれる（Matrix C1 の RTL class assertion が `npm test` で green + L3 で Tab 移動視認）
- 復元成功 flow の統合テスト（実 Router + memory history で producer `BackupRestorePage` → consumer ホーム画面を結線、StrictMode 相当の二重 mount 条件を含む）が green: ①Alert が 1 個表示 ②同一 mount 中の通常 re-render 後も表示継続 ③unmount / remount・再訪・store reset 後は非表示
- one-shot negative: Matrix C6 / C7 / C8 の negative test が `npm test` で green（通常到達 flag なしで Alert 非表示 / 復元失敗後に実 Router で通常ホーム遷移しても Alert 非表示・flag 非生成 / navigate reject 時の flag 消去）
- `npm run lint` / `npm run typecheck` / `npm test` / L1 `local-ci.sh full` CLEAN（evidence は PR body へ）
- 既存 test suite green（既知の `ProductListPage.test.tsx` timing flake は本 change 無関係の既知事象として扱い、顕在化時は単独実行 pass を PR body に記録）

## Design Sources

- Requirements / spec: 既存画面の requirement 変更なし
- Architecture: [UI_TECH_STACK.md](../../UI_TECH_STACK.md) §5.4（focus 可視性の outcome 契約 + 実装 2 系統、本 change で改訂）、[design-system/02-component-catalog.md](../../design-system/02-component-catalog.md)（系統②: date / month input 等の `focus-visible:ring-2` 規定、632・646 行）、TanStack Router / Sonner 技術選定
- Function / command / DTO: 変更なし（IPC 不変。`bindings.ts` の `detail_route` / `MovementSourceLink` は読み取りのみ）
- DB: 変更なし
- Screen / UI: [function-design/68-ui-backup-restore.md](../../function-design/68-ui-backup-restore.md)（UI-11b-F6 / D4 / **D11（本 change 新設、mount 中表示維持の寿命契約）** / §68.7 状態遷移表 / §68.10）、[function-design/52-ui-shared-layout.md](../../function-design/52-ui-shared-layout.md)（§52.1 SidebarLink 行の focus ring 規定 = 本 change 追加、UI-12-D1 active 判定契約）
- Decision log / ADR: 変更なし（D11 は 68 内の design decision として記録）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | 該当なし |
| Command / DTO / generated binding / wire shape | 該当なし（読み取りのみ） | 該当なし |
| DB / transaction / audit / rollback / migration | 該当なし | 該当なし |
| Screen / UI / route state / Japanese wording | 68-ui-backup-restore.md UI-11b-D11 / 52 §52.1 SidebarLink focus ring 規定 | updated in this PR（one-shot 通知の寿命契約 + SidebarLink focus 規定） |
| CSV / TSV / report / import / export format | 該当なし | 該当なし |
| Durable decision / ADR | UI_TECH_STACK.md §5.4 focus 可視性 outcome 契約 + 実装 2 系統 | updated in this PR（旧一律規範の実装乖離を outcome 契約 + 系統限定へ改訂） |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc / REQ の追加なし。`<Link>` 化は既存 route への遷移方法の変更のみで routeTree 生成に影響しない）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| UI-11b-F6 / UI-11b-D4 | 68 §68.5 / §68.7 / §68.10 | UI-11b-D11 | 現実装は遷移前の一時 toast のみで「遷移先で success Alert」の契約に未達。機構は in-memory one-shot flag — history.state 経由は reload / 履歴再訪で残存し one-shot 性の証明が実装依存になるため不採用。URL search param は reload 再表示で契約を破るため不採用 | `BackupRestorePage.tsx` + ホーム画面受け口 + one-shot store | 復元成功 flow 統合テスト（Matrix C5-C8） |
| PR #127 受け入れ R1 P3-2（Plans.md 起票） | Plans.md「Frontend follow-up」 | UIPOLA-D1 | static 9 箇所は型付き `<Link to/search>`、runtime 10 箇所（DTO 由来 route 文字列）は `<Link to={string}>` で SPA 遷移のみ保証（round 1 P2-2 ②採用）。DTO 構造化は別 R3 へ分離。生 `<a href>` 温存は全画面リロードで state 喪失のため不採用 | 10 file / 19 箇所 + href helper | 複数行対応 rg gate + 既存遷移 test（Matrix C2-C4） |
| PR #9 Final Review P3（Plans.md 起票） | UI_TECH_STACK.md §5.4 + 52 §52.1（本 change 改訂） | UIPOLA-D2 | §5.4 は「可視 focus 表示」の outcome 契約とし、実装は 2 系統（shadcn primitive + SidebarLink = `focus-visible:ring-[3px]` 系、date / month input・segmented-control 等 = catalog の `focus-visible:ring-2` 系）を併記。全要素の 3px 一律統一は catalog 632・646 行と既存実装への新規 drift を作るため不採用（round 2 P2 裁定）。SidebarLink のみ旧記載準拠も近接 component と視覚不整合のため不採用 | `SidebarLink.tsx` + UI_TECH_STACK.md §5.4 + 52 §52.1 | class assertion + docs anchor（Matrix C1 / C10） |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（68 D11 と UI_TECH_STACK §5.4 が本 change の設計判断を保持。packet は実装計画のみ）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-11b-D11（68 へ昇格済み）、focus 可視性 outcome 契約 + 実装 2 系統（§5.4 へ改訂済み）+ SidebarLink 規定（52 §52.1）
- Assumptions and constraints: Sonner toast は遷移を跨いで表示され続けるが「遷移先で success Alert」契約の充足とは見なさない（68 §68.7 が Alert を明記）。in-memory flag は再起動・reload で消滅することを one-shot 保証の根拠とする
- Deferred design gaps, risk, and follow-up target: runtime route 文字列の DTO 構造化（別 R3 候補）、UI-09b coverage 表示（R3 移管）
- Test Design Matrix can cite design decision IDs or source doc sections: yes（[Matrix](test-matrices/2026-08-02-ui-polish-batch-a.md)）
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 既存 test の削除・無効化なし、IPC/DTO 不変、`src/components/ui/` 実装不変を確認

## Impact Review Lenses

not applicable — 本 change は field 調査・実機挙動・外部 tool・POS 連携・帳票形式の発見を起点とせず、既存 backlog 起票（PR #9 / #127 / #144 レビュー所感）の消化である。環境・再現性 lens: 新設の環境依存なし（既存 toolchain のみ）。

## Design Readiness

- Existing design docs are sufficient because: 復元成功 Alert の表示先・cache 消去は 68 の既存契約（F6 / D4）。one-shot 寿命契約と focus 可視性 outcome 契約（実装 2 系統）は本 plan-first change で source docs へ反映済み（D11 / §5.4 / 52 §52.1）。`<Link>` 統一は UI_TECH_STACK の既存技術選定（TanStack Router）の範囲内で契約変更なし
- Source docs updated in this PR: 68-ui-backup-restore.md（D11 新設 + §68.7 付記）、UI_TECH_STACK.md §5.4
- Design gaps intentionally deferred: runtime route 文字列の DTO 構造化
- Durable decisions discovered in this plan and promoted to source docs: D11、§5.4 outcome 契約化（実装 2 系統）、52 §52.1 SidebarLink focus 規定

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層のみ。CMD 以下不変
- Backend function design: 変更なし
- Command / DTO / data contract: 変更なし（読み取りのみ）
- Persistence / transaction / audit impact: なし
- Operator workflow / Japanese UI wording: 成功 Alert 文言は既存 toast 文言「バックアップから復元しました」を基準に 68 §68.9 の文言慣習へ writer が追随（新規語彙の導入なし、最終文言は Final Review + L3 で確認）
- Error, empty, retry, and recovery behavior: 復元失敗経路は不変（成功経路の表示強化のみ）。one-shot 契約は UI-11b-D11
- Testability and traceability IDs: 既存 REQ 対応の test を維持、新規 test は該当画面の既存 test file へ追加し `90-traceability.md` を変化させない

## Contract Probe

N/A — 未検証の外部前提なし。round 1 P2-1 が指摘した TanStack Router state の history.state 残存挙動は、当該機構を採用しない（in-memory flag、UI-11b-D11）ことで前提自体を回避した。TanStack `<Link>` / Sonner / shadcn ring はいずれも本 repo で使用実績のある既知挙動。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-11b-F6 / D4（遷移先 success Alert + cache 全消去） | `BackupRestorePage.tsx` + ホーム受け口 | Matrix C5（統合テスト） | L3: 実復元での目視 |
| UI-11b-D11（one-shot 通知、in-memory、再表示禁止） | one-shot store + ホーム受け口 | Matrix C6 / C7 / C8 | L3: 復元後 reload で非表示確認 |
| UI-11b-D2（復元前の事前バックアップ強制）— 実装経路が通る隣接契約 | 変更しない | 既存 test 維持 | non-scope（成功後表示のみ変更、C9 で assertion 不変を担保） |
| UI-11b-D3（2 段確認 + ボタンラベルの対象日時）— 実装経路が通る隣接契約 | 変更しない | 既存 test 維持 | non-scope（同上） |
| UI-11b-D5（double failure 表示）— 隣接契約、非対象 | 変更しない | 既存 test 維持 | non-scope（成功経路のみ変更） |
| UI-11b-D10（L3 目視対象の所有）| L3 手順に復元成功 Alert の mount 中表示維持 + reload 後非表示を追加 | — | L3: D10 の既存目視項目に本 change 分を追記して実施 |
| UI-12-D1（SidebarLink active 判定の排他契約） | 変更しない（class 追加のみ） | 既存 active 判定 test 維持（C1 で分岐不変を確認） | non-scope（focus ring は判定 logic に触れない） |
| §5.4 outcome 契約・系統①の SidebarLink 適用（52 §52.1） | `SidebarLink.tsx` | Matrix C1 | L3: Tab 移動視認 |
| SPA 遷移統一（生 anchor 0 件） | 10 file / 19 箇所 | Matrix C2 / C3 / C4 | L3: 代表画面の遷移目視 |
| §68.7 状態遷移表 `restore_succeeded` 行 | 同上（Alert 経路） | Matrix C5 | — |
| §68.10 Query cache clear 挙動維持 | 変更しない（既存実装） | 既存 test 維持 | non-scope |

## Spec Contract

Contract ID: SPEC-UIPOLA-D1

- 復元成功通知は in-memory one-shot flag で受け渡す。ホーム component は mount 時に一度だけ flag を component-local 表示 state へ取り込み（同時に flag 消去）、その mount 中は Alert を表示し続ける。非表示は unmount 後の再訪・reload・restart・通常到達のみ。StrictMode 二重 mount で Alert は 1 個。navigate reject 時は flag を消去。復元失敗時は flag 非生成（UI-11b-D11。Test: Matrix C5-C8 + State Lifecycle Matrix）

Contract ID: SPEC-UIPOLA-D2

- src/ の internal 遷移に生 `<a href>` を残さない。static 遷移は型付き `<Link to/search>`、runtime 文字列遷移は `<Link to={string}>` で SPA 遷移を保証し、遷移先 URL は旧 href と同値（Test: Matrix C2-C4）

Contract ID: SPEC-UIPOLA-D3

- sidebar link は UI_TECH_STACK §5.4 系統①（52 §52.1 規定）の focus ring に従い、active / inactive / pending の既存表示と UI-12-D1 active 判定を変えない（pending は focus 対象外のまま。Test: Matrix C1）

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-UIPOLA-D1 | one-shot store + ホーム受け口実装 | Matrix C5-C8 | one-shot 性・誤表示経路 | 統合テスト green（PR body） |
| SPEC-UIPOLA-D2 | 19 箇所 `<Link>` 化 + helper 追随 | Matrix C2-C4 + rg gate | URL 同値性・helper 波及 | rg 出力 + test green（PR body） |
| SPEC-UIPOLA-D3 | SidebarLink class 追加 | Matrix C1 | 3 状態の表示不変 | class assertion + L3 |

## Data Safety

- 実 POS / 店舗 artifact、実 DB file、実 backup file は commit しない（既存規約どおり）
- test は synthetic fixture のみ使用。復元統合テストも in-memory / mock 経由で実 DB を作らない
- local-only paths: なし（本 change は repo 内 frontend + docs のみ）

## Test Plan

Test Design Matrix: [test-matrices/2026-08-02-ui-polish-batch-a.md](test-matrices/2026-08-02-ui-polish-batch-a.md)（R3 必須、mutation 感度列つき）

- targeted tests: Matrix C1-C8（SidebarLink focus class / rg gate / 遷移 URL 同値 / 復元成功 flow 統合 / one-shot negative 群）
- negative tests: Matrix C6-C8（再訪・通常到達・失敗時・store reset の非表示）
- compatibility checks: 既存 test suite 全 green（削除・無効化・skip なし = Matrix C9）。Affected Surfaces 11 file（original 9 + amendment 2）の Router wrapper 追随
- data safety checks: synthetic fixture のみ（Data Safety 節）
- main wiring/integration checks: 実 Router + memory history での producer→consumer 結線（Matrix C5）
- Human Gate に L3 を含むため、Writer 完了条件に `cargo check --release` を含める（frontend のみの変更でも native build 前提を壊していないことの確認。CI gate ではない）

## Boundary / Wire Contract

IPC / JSON / DB / URL は不変。browser state（history.state / URL search param）を**使わない**ことが本 change の契約である（UI-11b-D11）。

- producer: `BackupRestorePage.tsx`（復元成功時に in-memory flag を set して navigate）
- consumer: ホーム画面 route component（mount 時に一度だけ component-local state へ取り込み、mount 中は Alert 表示を維持）
- wire type: frontend in-memory one-shot flag（module scope の store。router / history state・URL param・storage 不使用）
- internal type: boolean 相当の one-shot flag（consume で消去）
- precision/range: 該当なし
- round-trip path: 復元成功 → flag set → navigate → ホーム mount 時に一度だけ component-local state へ取り込み（flag 消去）→ **その mount 中は Alert 表示を維持**（他 query 更新・再 render で消えない）→ unmount 後の再訪 / reload / restart で非表示
- invalid input: flag なしの通常ホーム到達では Alert を表示しない。復元失敗時は flag を set しない。navigate が reject された場合は flag を消去し次回到達で誤表示しない
- compatibility: ホーム画面の既存表示・既存 query cache clear 挙動（UI-11b-D4）・URL 構造を変えない

## Review Focus

- one-shot 契約の穴: consume 前の重複 render、React StrictMode の二重実行、consume 後の Alert 消去タイミング
- `<Link>` 化 19 箇所の遷移先 URL 同値性（特に search param 付き遷移と runtime 文字列群）、helper 構造化変更の呼び出し元波及
- Affected Surfaces 11 test file（original 9 + amendment 2）の Router wrapper 追随で既存 assertion が弱体化していないか
- focus ring が disabled / pending 状態の link 表示を壊さないこと
- 既存 test の削除・無効化・skip が紛れていないこと

## Implementation Results

PR #57（squash merge、2026-08-03 JST）で完了。sidebar focus ring（§5.4 系統①）、internal 遷移 19 site の `<Link>` 統一（site manifest どおり、C2 canary 19→0）、復元成功のホーム one-shot Alert（UI-11b-D11 寿命契約）を実装。owner L3 指摘の sidebar label 統一（「バックアップ・復元」+ 52 正本 sync）も同 PR 内で是正。CSV取込み元記録 404 は UI-06c-D7 既存契約と実証し Plans.md へ backlog 起票。編成 = Fable coordinator / Sonnet writer（worktree）/ Codex Plan+Final Reviewer の鏡像分担の初運用で、詳細評価は Review Response と Workflow State 遷移記録を参照。

## Review Response

- Findings Freeze: frozen after Plan Review round 1 Broad Audit（2026-08-02）; post-freeze exceptions: round 2 findings（P2×3 / P3×1）は round 1 是正で新規投入した content（D11 / §5.4 改訂 / Matrix 新設）への closure defect であり、新規観点の追加ではない。round 3 以降は closure confirmation のみ。

### Plan Review round 1（Codex、2026-08-02）裁定

FAIL（P1=1 / P2=5 / P3=0）。全 findings を実物照合のうえ裁定した:

- **P1（R2→R3 再分類）: accept**。Risk Tiers の R3 条件該当を DEV_WORKFLOW.md Risk Tiers 表で確認。単一 packet のまま R3 へ再分類（分割は owner gate 倍増のため不採用）。design backtrack + 68 D11 追記 + Matrix commit で再構成
- **P2-1（router state の one-shot 性）: accept + 機構逆提案**。history.state 残存の指摘は妥当。対処は state 型拡張 + consume 後 replace ではなく in-memory one-shot flag の採用（UI-11b-D11）で前提自体を除去。統合テスト要求（実 Router + memory history）は AC / Matrix C5 へ採用
- **P2-2（runtime 文字列と typed 主張の矛盾）: accept**。`bindings.ts` の `detail_route: string` / `MovementSourceLink` を実確認。選択肢②（SPA 遷移のみ保証）を採用、DTO 構造化は別 R3 へ分離
- **P2-3（rg の複数行検出漏れ）: accept、収録先のみ修正**。提案コマンド `rg -U --count-matches '<a\s+[^>]*href=' src --glob '*.tsx' --glob '!*.test.tsx'` を coordinator が 2026-08-02 に実行し 19 件 / 10 file の再現を実測確認（per-file 内訳の実出力は Matrix C2 canary 運用に従い PR body へ収録）、AC へ採用。ただし実出力の packet 収録は D-038 Evidence Ownership（volatile evidence は PR body 所有）に抵触するため PR body 収録へ変更
- **P2-4（影響 test の未列挙）: accept、実数修正**。実在確認の結果 9 file（Codex 列挙 8 + `DailyReportImportPage.flow.test.tsx` / `OtherRecordDetailPages.test.tsx` を含む）。Affected Surfaces 節を新設
- **P2-5（focus ring SSOT 衝突）: 核心 accept、細部 refute**。UI_TECH_STACK.md §5.4 の旧規範実在を確認し、docs 側を実装標準へ同期する source-doc 変更を本 packet に含めた（Non-goal 送りは取り下げ）。なお「component catalog にも規定あり」は rg 0 hit で不成立（catalog に focus ring 規範なし）→ **round 2 で撤回**: coordinator の rg パターン `'ring-2 ring-ring'` が `focus-visible:` prefix を跨げず false negative。catalog 632・646 行に `focus-visible:ring-2` 実在（Codex の再提示で確定、当方の refute が誤り）

### Plan Review round 2（Codex、2026-08-03）裁定

FAIL（P1=0 / P2=3 / P3=1）。全件 closure defect として accept:

- **P2-A（C6 の再 render 非表示が視認目的と衝突 + StrictMode）: accept**。src/main.tsx:41 の StrictMode 使用を実確認。D11 を「mount 時に一度だけ component-local state へ取り込み、mount 中は表示維持、非表示は unmount 後の再訪・reload・restart のみ」の寿命契約へ改訂。navigate reject 時の flag 消去と復元失敗後の実 Router 通常遷移 negative を追加
- **P2-B（§5.4 改訂自身が新規 drift）: accept、推奨案採用**。catalog 632・646 / segmented-control.tsx:9 / DateNavigator / MonthNavigator の ring-2 系実在を実確認。§5.4 を outcome 契約 + 実装 2 系統併記へ改訂、SidebarLink の exact class は 52 §52.1 へ配置
- **P2-C（Matrix の template 必須節欠落 + Ledger 隣接契約漏れ）: accept**。templates/test-design-matrix.md の State Lifecycle Matrix / Adjacent Pattern Audit / Residual Test Gaps を確認し Matrix を template 準拠へ再構成。Ledger へ UI-11b-D2 / D3 / D10 / UI-12-D1 を追加。X8 は「復元失敗後に実 Router で通常ホーム遷移して非表示 assert」へ明確化
- **P3（Freeze 未設定）: accept**。round 1 Broad Audit 完了時点で frozen と記録し、round 2 findings を closure defect と分類（上記 Freeze 行）

### Plan Review round 3（Codex、2026-08-03）裁定

FAIL（P1=1 / P2=1 / P3=1）。全件 accept（closure defect / follow-up）:

- **P1（3578518 の件名宣言と Phase 記録の不一致）: accept**。coordinator の記録ミス — commit 件名で `design -> plan-draft -> plan-gate` を宣言しながら packet の Phase 更新と遷移記録を欠いた。本 round 3 是正 content commit で Phase を plan-gate へ更新し、遷移記録に成立 commit と経緯の註を追記（STATECAP を消費する state-only commit は使わず、Codex 提案どおり文書是正と同一 content commit に統合）
- **P2（Adjacent Pattern Audit の site 列挙不足）: accept**。R3 再構成時の packet 全面書き換えで round 1 packet にあった per-file 列挙を脱落させていた。「Link 統一 site manifest」節を新設し、19 site の file:line・runtime/static 分類・evidence 紐付けを実測で全列挙（runtime 10 = backHref×8 + detail_route + MovementSourceLink.route、static 9 = 固定 template 7 + RELATED map + ActiveCta prop 経由）
- **P3（stale「実装標準」表現 + relay 実績）: accept（follow-up、非 blocker）**。Non-scope / Design Readiness / Ledger / Spec の旧表現を「outcome 契約 + 実装 2 系統」へ統一し、relay 実績を round 3 時点（3/4 消化、round 4 実施時は超過 1 を明示）へ更新

### Writer 要裁定 4 件の Coordinator 裁定（2026-08-03、gated amendment）

Plan Review round 4 PASS 後の owner 承認を経て Sonnet writer が実装。writer 報告の要裁定 4 件を以下のとおり裁定した（本節を含む packet 修正が gated amendment であり、その commit SHA は次の state-only 遷移 commit の `Amendments` 行に記録する）:

1. **復元成功の transient toast を撤去し home Alert へ一本化: accept**。D11 / F6 の契約通知は Alert であり、Characterization Baseline も置換を許容済み。既存 test に当該 toast の assertion はなく regression なし
2. **navigate reject 時の feedback: 差し戻しのうえ是正済み**。toast 撤去により reject 経路の成功 feedback が 0 になる劣化を Coordinator が指摘し、reject 分岐限定の fallback toast + test を追加（commit `ede3c78`）。flag 消去（D11）は維持
3. **Affected Surfaces へ実装時発見の 2 file 追加: accept**。`StockInquiryPage.test.tsx` / `ProductListTable.test.tsx` は `StockDetailContent` 埋め込み経由で Router context が必要になった正当な発見。上記 Affected Surfaces 節へ追記
4. **共有 test helper `src/test/render-with-router.tsx` 新設: accept**。packet の「Router wrapper を群ごとに割り当てる」方針の範囲内の実装手段

### Final Review round 1（Codex、2026-08-03）裁定

FAIL（P1=0 / P2=2 / P3=1）。mutation 実注入 5 件（X2 / X5 / X5b / X6 / X8）は全件 red を独立再現、追加 X3 が survivor となり P2-1 を実証した。全 findings accept:

- **P2-1（C3/C4 の click SPA 遷移未証明、X3 survivor）: accept、Writer へ差し戻し**。代表 3 test は href 属性 assert のみで click 経路を検証していなかった。是正 = click 後の `router.state.location`（pathname + search）を test 内独立転記 literal と比較、X3（static 代表）+ runtime 代表 1 件の再注入 red 確認まで
- **P2-2（L3 手順の観測条件不足）: accept**。PR body の Human Gate L3 手順へ「復元後ホームの各 summary 取得完了後も Alert が 1 個残存すること」の到達手順・合格基準を明記（Ledger D10 行の約束と一致させる）
- **P3（9 file 表記の残存 3 箇所）: accept**。Test Plan / Review Focus / Matrix Characterization Baseline を「11 file（original 9 + amendment 2）」へ同期（本 amendment）
