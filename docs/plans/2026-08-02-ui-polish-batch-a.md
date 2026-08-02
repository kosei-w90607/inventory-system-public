# Plan Packet — UI backlog 消化 batch A（UI 小物 3 件）

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
- Human Gate: L3 Windows native 目視（sidebar focus / 復元成功 Alert / 代表画面の内部遷移）、Ready 承認、merge

遷移記録（append-only）: 本 packet を追加する content commit で `kickoff -> spec-check -> plan-draft -> plan-gate` を材料化する。evidence = task scoped + Risk R2 を本 packet に記録（kickoff→spec-check）、Design Readiness が既存設計 docs 十分を cite（spec-check→plan-draft の許可された skip）、packet 完成と commit（plan-draft→plan-gate）。

2026-08-02 Codex Plan Review round 1 = FAIL（P1=1 / P2=5 / P3=0）。P1 = 復元成功通知が新規 state 契約を伴い Risk Tiers の R3 条件（route/search state / operator workflow）に該当、R2 での plan-gate は無効。Design Readiness の focus ring「明文規範なし」も UI_TECH_STACK.md §5.4 実在により事実誤認（P2-5）。最早影響 phase = design（68 への通知契約追記と UI_TECH_STACK §5.4 の source-doc sync が必要）のため `plan-gate -> design` へ backtrack する。findings の裁定詳細は Review Response 参照。

2026-08-02 是正 content commit で `design -> plan-draft -> plan-gate` を再材料化する。evidence = design 出力を source docs へ反映（68-ui-backup-restore.md UI-11b-D11 新設 + UI_TECH_STACK.md §5.4 の実装標準同期、同一 plan-first change 内 — design→plan-draft）、R3 packet 再構成 + Test Design Matrix commit（plan-draft→plan-gate）。

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / L3 目視 + Ready 承認 / merge）
- 実働時間上限: 30分
- relay 往復上限: 4（Codex Plan Review round 1 消化済み。残 = Plan Review round 2 + Final Review + 予備 1）

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

- `src/components/layout/SidebarLink.tsx` の link class へ、UI_TECH_STACK.md §5.4（本 change で実装標準へ同期済み）の focus ring パターン `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` を追加する。active / inactive / pending の 3 状態の既存表示を壊さない
- src/ 配下の internal 遷移の生 `<a href>` 全 19 箇所（10 file）を TanStack Router `<Link>` へ統一する。2 群に分けて扱う:
  - **static 群（9 箇所）**: 遷移先が compile-time に決まる箇所。型付き `to` / `search` へ完全移行
  - **runtime 群（10 箇所）**: `returnTo` / `InventoryRecordSummary.detail_route` / `MovementSourceLink.route` 等の runtime 文字列由来。`<Link to={string}>` で SPA 遷移のみ保証し、compile-time typed navigation は主張しない（Plan Review round 1 P2-2 の選択肢②を採用）
  - `sourceHref()` / `buildDetailHref()` 等の href 組み立て helper は `<Link>` props へ渡せる形へ追随変更する（DTO は不変）
- `src/features/backup-restore/BackupRestorePage.tsx` の復元成功時（現状 `toast.success` + `navigate({ to: "/" })`）を、UI-11b-D11 の in-memory one-shot flag 機構でホーム遷移後の success Alert 表示へ是正する
- 設計正本 sync（本 plan-first change 内で実施済み）: 68-ui-backup-restore.md へ UI-11b-D11 新設 + §68.7 `restore_succeeded` 行へ D11 参照付記、UI_TECH_STACK.md §5.4 を実装標準へ同期
- 上記の test 追随（既存 test の削除・無効化なし）。Affected Surfaces 節の 9 test file を含む

## Non-scope

- UI-09b 日報 coverage 表示（DTO 変更必要 = 別 R3。UI-09a/b 将来設計検討と同系の後続 R3 へ移管）
- runtime route 文字列の構造化 DTO 化（前掲）
- pagination「すべて」/ DepartmentFilter 共通化（58 §58.13 defer、別 packet）
- FilePicker 残務（catalog 登録等、別 packet）
- Storybook / Error Boundary / unsaved changes（別 packet）
- 52 §52.3 ルーティング表の URL 陳腐化是正（docs backlog、別途）
- external link 対応（src/ に external link は 0 件と確認済み）
- `src/components/ui/` 既存 component 群の focus ring 変更（§5.4 同期は docs 側を実装標準へ合わせるもので、component 実装は不変）

## Affected Surfaces

`<Link>` 化により Router context が必要になり得る既存 test file（実在確認済み、9 file）:

- `src/features/operation-logs/OperationLogsPage.test.tsx`
- `src/features/stock-movements/StockMovementsPage.test.tsx`
- `src/features/stock-movements/components/MovementTable.test.tsx`
- `src/features/daily-report-import/DailyReportImportPage.test.tsx`
- `src/features/daily-report-import/DailyReportImportPage.flow.test.tsx`
- `src/features/inventory-records/InventoryRecordsPage.test.tsx`
- `src/features/inventory-records/DisposalRecordDetailPage.test.tsx`
- `src/features/inventory-records/OtherRecordDetailPages.test.tsx`
- `src/features/stock-inquiry/components/StockDetailContent.test.tsx`

方針: 直接 render している test は Router wrapper（memory history）または限定 mock を群ごとに割り当てる。dynamic route / search の検証は既存の real-router route test 群で行う。既存 assertion の削除・弱体化はしない。

## Acceptance Criteria

- 生 `<a href>` 検証: `rg -U --count-matches '<a\s+[^>]*href=' src --glob '*.tsx' --glob '!*.test.tsx'` が 0 件（変更前 baseline と変更後 0 件の実出力は D-038 Evidence Ownership に従い PR body へ収録し、本 packet には転記しない）
- sidebar link の class に `focus-visible:ring-[3px]` literal が含まれる（Matrix C1 の RTL class assertion が `npm test` で green + L3 で Tab 移動視認）
- 復元成功 flow の統合テスト（実 Router + memory history で producer `BackupRestorePage` → consumer ホーム画面を結線）が green: 成功 → ホーム遷移 → Alert 表示 → consume 後の再訪・再 mount で非表示
- one-shot negative: Matrix C6 / C7 / C8 の negative test が `npm test` で green（通常到達 flag なしで Alert 非表示 / 復元失敗時に flag 非生成・Alert 非表示 / store reset 後に非表示）
- `npm run lint` / `npm run typecheck` / `npm test` / L1 `local-ci.sh full` CLEAN（evidence は PR body へ）
- 既存 test suite green（既知の `ProductListPage.test.tsx` timing flake は本 change 無関係の既知事象として扱い、顕在化時は単独実行 pass を PR body に記録）

## Design Sources

- Requirements / spec: 既存画面の requirement 変更なし
- Architecture: [UI_TECH_STACK.md](../UI_TECH_STACK.md) §5.4（focus ring 実装標準、本 change で同期）、TanStack Router / Sonner 技術選定
- Function / command / DTO: 変更なし（IPC 不変。`bindings.ts` の `detail_route` / `MovementSourceLink` は読み取りのみ）
- DB: 変更なし
- Screen / UI: [function-design/68-ui-backup-restore.md](../function-design/68-ui-backup-restore.md)（UI-11b-F6 / D4 / **D11（本 change 新設）** / §68.7 状態遷移表 / §68.10）、[function-design/52-ui-shared-layout.md](../function-design/52-ui-shared-layout.md)（sidebar）
- Decision log / ADR: 変更なし（D11 は 68 内の design decision として記録）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | 該当なし |
| Command / DTO / generated binding / wire shape | 該当なし（読み取りのみ） | 該当なし |
| DB / transaction / audit / rollback / migration | 該当なし | 該当なし |
| Screen / UI / route state / Japanese wording | 68-ui-backup-restore.md UI-11b-D11 | updated in this PR（one-shot 通知契約を新設） |
| CSV / TSV / report / import / export format | 該当なし | 該当なし |
| Durable decision / ADR | UI_TECH_STACK.md §5.4 focus ring 実装標準 | updated in this PR（旧記載の乖離を実装標準へ同期） |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc / REQ の追加なし。`<Link>` 化は既存 route への遷移方法の変更のみで routeTree 生成に影響しない）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| UI-11b-F6 / UI-11b-D4 | 68 §68.5 / §68.7 / §68.10 | UI-11b-D11 | 現実装は遷移前の一時 toast のみで「遷移先で success Alert」の契約に未達。機構は in-memory one-shot flag — history.state 経由は reload / 履歴再訪で残存し one-shot 性の証明が実装依存になるため不採用。URL search param は reload 再表示で契約を破るため不採用 | `BackupRestorePage.tsx` + ホーム画面受け口 + one-shot store | 復元成功 flow 統合テスト（Matrix C5-C8） |
| PR #127 受け入れ R1 P3-2（Plans.md 起票） | Plans.md「Frontend follow-up」 | UIPOLA-D1 | static 9 箇所は型付き `<Link to/search>`、runtime 10 箇所（DTO 由来 route 文字列）は `<Link to={string}>` で SPA 遷移のみ保証（round 1 P2-2 ②採用）。DTO 構造化は別 R3 へ分離。生 `<a href>` 温存は全画面リロードで state 喪失のため不採用 | 10 file / 19 箇所 + href helper | 複数行対応 rg gate + 既存遷移 test（Matrix C2-C4） |
| PR #9 Final Review P3（Plans.md 起票） | UI_TECH_STACK.md §5.4（本 change 同期済み） | UIPOLA-D2 | `src/components/ui/` 10+ component の実装標準 `focus-visible:ring-[3px]` 系を採用し、docs 側の旧記載 `ring-2 ring-offset-2` を実装標準へ同期。SidebarLink のみ旧記載準拠にすると近接 component と視覚不整合になるため不採用 | `SidebarLink.tsx` + UI_TECH_STACK.md §5.4 | class assertion + docs anchor（Matrix C1 / C10） |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（68 D11 と UI_TECH_STACK §5.4 が本 change の設計判断を保持。packet は実装計画のみ）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-11b-D11（68 へ昇格済み）、focus ring 実装標準（§5.4 へ同期済み）
- Assumptions and constraints: Sonner toast は遷移を跨いで表示され続けるが「遷移先で success Alert」契約の充足とは見なさない（68 §68.7 が Alert を明記）。in-memory flag は再起動・reload で消滅することを one-shot 保証の根拠とする
- Deferred design gaps, risk, and follow-up target: runtime route 文字列の DTO 構造化（別 R3 候補）、UI-09b coverage 表示（R3 移管）
- Test Design Matrix can cite design decision IDs or source doc sections: yes（[Matrix](test-matrices/2026-08-02-ui-polish-batch-a.md)）
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 既存 test の削除・無効化なし、IPC/DTO 不変、`src/components/ui/` 実装不変を確認

## Impact Review Lenses

not applicable — 本 change は field 調査・実機挙動・外部 tool・POS 連携・帳票形式の発見を起点とせず、既存 backlog 起票（PR #9 / #127 / #144 レビュー所感）の消化である。環境・再現性 lens: 新設の環境依存なし（既存 toolchain のみ）。

## Design Readiness

- Existing design docs are sufficient because: 復元成功 Alert の表示先・cache 消去は 68 の既存契約（F6 / D4）。one-shot 機構と focus ring 実装標準は本 plan-first change で source docs へ反映済み（D11 / §5.4）。`<Link>` 統一は UI_TECH_STACK の既存技術選定（TanStack Router）の範囲内で契約変更なし
- Source docs updated in this PR: 68-ui-backup-restore.md（D11 新設 + §68.7 付記）、UI_TECH_STACK.md §5.4
- Design gaps intentionally deferred: runtime route 文字列の DTO 構造化
- Durable decisions discovered in this plan and promoted to source docs: D11、focus ring 実装標準同期

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
| UI-11b-D5（double failure 表示）— 隣接契約、非対象 | 変更しない | 既存 test 維持 | non-scope（成功経路のみ変更） |
| §5.4 focus ring 実装標準 | `SidebarLink.tsx` | Matrix C1 | L3: Tab 移動視認 |
| SPA 遷移統一（生 anchor 0 件） | 10 file / 19 箇所 | Matrix C2 / C3 / C4 | L3: 代表画面の遷移目視 |
| §68.7 状態遷移表 `restore_succeeded` 行 | 同上（Alert 経路） | Matrix C5 | — |
| §68.10 Query cache clear 挙動維持 | 変更しない（既存実装） | 既存 test 維持 | non-scope |

## Spec Contract

Contract ID: SPEC-UIPOLA-D1

- 復元成功通知は in-memory one-shot flag で受け渡し、ホーム初回 render で consume して Alert 表示する。reload・履歴 back/forward・通常到達・復元失敗時には表示しない（UI-11b-D11。Test: Matrix C5-C8）

Contract ID: SPEC-UIPOLA-D2

- src/ の internal 遷移に生 `<a href>` を残さない。static 遷移は型付き `<Link to/search>`、runtime 文字列遷移は `<Link to={string}>` で SPA 遷移を保証し、遷移先 URL は旧 href と同値（Test: Matrix C2-C4）

Contract ID: SPEC-UIPOLA-D3

- sidebar link は UI_TECH_STACK §5.4 の focus ring 実装標準に従い、active / inactive / pending の既存表示を変えない（Test: Matrix C1）

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
- compatibility checks: 既存 test suite 全 green（削除・無効化・skip なし = Matrix C9）。Affected Surfaces 9 file の Router wrapper 追随
- data safety checks: synthetic fixture のみ（Data Safety 節）
- main wiring/integration checks: 実 Router + memory history での producer→consumer 結線（Matrix C5）
- Human Gate に L3 を含むため、Writer 完了条件に `cargo check --release` を含める（frontend のみの変更でも native build 前提を壊していないことの確認。CI gate ではない）

## Boundary / Wire Contract

IPC / JSON / DB / URL は不変。browser state（history.state / URL search param）を**使わない**ことが本 change の契約である（UI-11b-D11）。

- producer: `BackupRestorePage.tsx`（復元成功時に in-memory flag を set して navigate）
- consumer: ホーム画面 route component（初回 render で consume して Alert 表示）
- wire type: frontend in-memory one-shot flag（module scope の store。router / history state・URL param・storage 不使用）
- internal type: boolean 相当の one-shot flag（consume で消去）
- precision/range: 該当なし
- round-trip path: 復元成功 → flag set → navigate → ホーム初回 render で consume & 表示 → 以降の re-render / 再訪 / reload で非表示
- invalid input: flag なしの通常ホーム到達では Alert を表示しない。復元失敗時は flag を set しない
- compatibility: ホーム画面の既存表示・既存 query cache clear 挙動（UI-11b-D4）・URL 構造を変えない

## Review Focus

- one-shot 契約の穴: consume 前の重複 render、React StrictMode の二重実行、consume 後の Alert 消去タイミング
- `<Link>` 化 19 箇所の遷移先 URL 同値性（特に search param 付き遷移と runtime 文字列群）、helper 構造化変更の呼び出し元波及
- Affected Surfaces 9 test file の Router wrapper 追随で既存 assertion が弱体化していないか
- focus ring が disabled / pending 状態の link 表示を壊さないこと
- 既存 test の削除・無効化・skip が紛れていないこと

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Review round 1（Codex、2026-08-02）裁定

FAIL（P1=1 / P2=5 / P3=0）。全 findings を実物照合のうえ裁定した:

- **P1（R2→R3 再分類）: accept**。Risk Tiers の R3 条件該当を DEV_WORKFLOW.md Risk Tiers 表で確認。単一 packet のまま R3 へ再分類（分割は owner gate 倍増のため不採用）。design backtrack + 68 D11 追記 + Matrix commit で再構成
- **P2-1（router state の one-shot 性）: accept + 機構逆提案**。history.state 残存の指摘は妥当。対処は state 型拡張 + consume 後 replace ではなく in-memory one-shot flag の採用（UI-11b-D11）で前提自体を除去。統合テスト要求（実 Router + memory history）は AC / Matrix C5 へ採用
- **P2-2（runtime 文字列と typed 主張の矛盾）: accept**。`bindings.ts` の `detail_route: string` / `MovementSourceLink` を実確認。選択肢②（SPA 遷移のみ保証）を採用、DTO 構造化は別 R3 へ分離
- **P2-3（rg の複数行検出漏れ）: accept、収録先のみ修正**。提案コマンド `rg -U --count-matches '<a\s+[^>]*href=' src --glob '*.tsx' --glob '!*.test.tsx'` を coordinator が 2026-08-02 に実行し 19 件 / 10 file の再現を実測確認（per-file 内訳の実出力は Matrix C2 canary 運用に従い PR body へ収録）、AC へ採用。ただし実出力の packet 収録は D-038 Evidence Ownership（volatile evidence は PR body 所有）に抵触するため PR body 収録へ変更
- **P2-4（影響 test の未列挙）: accept、実数修正**。実在確認の結果 9 file（Codex 列挙 8 + `DailyReportImportPage.flow.test.tsx` / `OtherRecordDetailPages.test.tsx` を含む）。Affected Surfaces 節を新設
- **P2-5（focus ring SSOT 衝突）: 核心 accept、細部 refute**。UI_TECH_STACK.md §5.4 の旧規範実在を確認し、docs 側を実装標準へ同期する source-doc 変更を本 packet に含めた（Non-goal 送りは取り下げ）。なお「component catalog にも規定あり」は rg 0 hit で不成立（catalog に focus ring 規範なし）
