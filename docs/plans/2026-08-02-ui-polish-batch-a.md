# Plan Packet — UI backlog 消化 batch A（UI 小物 3 件）

## Workflow State

- Phase: plan-gate
- Risk: R2
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

## Owner Effort Budget

- 介入回数上限: 3（plan 承認 / L3 目視 + Ready 承認 / merge）
- 実働時間上限: 30分
- relay 往復上限: 4（Codex Plan Review + Final Review + 予備 2）

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R2

Reason:
frontend のみの変更で Tauri command / DTO / DB / CSV / 生成 bindings に触れない。runtime 契約の変更は 68-ui-backup-restore.md が既に規定する「復元成功後にホーム遷移先で success Alert」への実装追随のみで、新規契約の追加はない。ただし内部遷移の `<Link>` 統一が 10 file に横断するため R1 ではなく R2。

当初候補だった「UI-09b 日報 coverage 表示」は、`get_monthly_sales` の返却型（`MonthlySalesReport`）に取込み済み日数を導出できる情報がなく DTO 変更 = R3 になるため、本 packet から除外し UI-09 設計検討系の別 R3 へ移管した（Non-scope 参照）。

## Goal

Goal Invariant:

### 最小完了条件

- operator がキーボード操作時に sidebar link の focus 位置を視認できる
- 復元成功後、ホーム画面で成功 Alert を視認できる（68-ui-backup-restore.md UI-11b-D4 / F6 / 状態遷移表の既存契約どおり。現状は遷移前の一時 toast のみで契約未達）
- 一覧・詳細画面の内部遷移が TanStack Router `<Link>` に統一され、生 `<a href>` による全画面リロード遷移が残らない

### 失敗定義

- L3 で従来到達できた画面導線が壊れる、または既存画面の表示に regression が出る
- 復元成功 Alert が reload 等で再表示される（one-shot 契約の破れ）
- 既存 test の削除・無効化・skip で green を作る

### 非目的

- 新規画面・新規 Tauri command・visual design の刷新
- focus ring 規範の design-system docs への昇格（既存コード慣習踏襲に留める。昇格要否は Codex Plan Review の指摘があれば裁定）

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `src/components/layout/SidebarLink.tsx` の link class へ、`src/components/ui/` 配下で既に標準の shadcn focus ring パターン（`focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` 相当）を追加する
- src/ 配下の internal 遷移の生 `<a href>` 全 19 箇所（10 file: ManualSaleRecordDetailPage ×4 / ReceivingRecordDetailPage ×3 / DisposalRecordDetailPage ×3 / ReturnRecordDetailPage ×3 / InventoryRecordsPage / StockDetailContent / StockMovementsPage / MovementTable / DailyReportImportPage 日報 CTA / OperationLogsPage 各1）を TanStack Router `<Link>`（型付き `to` / `search`）へ統一する。`sourceHref()` / `buildDetailHref()` 等の href 文字列組み立て helper は `<Link>` props へ渡せる構造化された戻り値へ追随変更する
- `src/features/backup-restore/BackupRestorePage.tsx` の復元成功時（現状 `toast.success` + `navigate({ to: "/" })`）を、ホーム画面遷移後に success Alert を表示する実装へ是正する。表示は one-shot（reload 後に再表示されない）
- 上記 3 点の test 追随（既存 test の削除・無効化なし）

## Non-scope

- UI-09b 日報 coverage 表示（DTO 変更必要 = R3。UI-09a/b 将来設計検討と同系の後続 R3 へ移管）
- pagination「すべて」/ DepartmentFilter 共通化（58 §58.13 defer、別 packet）
- FilePicker 残務（catalog 登録等、別 packet）
- Storybook / Error Boundary / unsaved changes（別 packet）
- 52 §52.3 ルーティング表の URL 陳腐化是正（docs backlog、別途）
- external link 対応（src/ に external link は 0 件と確認済み）

## Acceptance Criteria

- `rg -n '<a href' src/ --glob '*.tsx'` の internal 遷移該当が 0 件（test fixture 等の非遷移用途が残る場合は件数と理由を PR body に列挙）
- sidebar link に focus-visible ring が付与される（RTL の class assertion または L3 目視。L3 では Tab 移動で視認確認）
- 復元成功 flow でホーム遷移後に成功 Alert が表示される RTL test が green、かつ reload 相当の再 render で再表示されないこと
- `npm run lint` / `npm test` / L1 `local-ci.sh full` CLEAN（evidence は PR body へ）
- 既存 test suite green（既知の `ProductListPage.test.tsx` timing flake は本 change 無関係の既知事象として扱い、顕在化時は単独実行 pass を PR body に記録）

## Design Sources

- Requirements / spec: 既存画面の requirement 変更なし
- Architecture: [UI_TECH_STACK.md](../UI_TECH_STACK.md)（TanStack Router / Sonner / shadcn 慣習）
- Function / command / DTO: 変更なし（IPC 不変）
- DB: 変更なし
- Screen / UI: [function-design/68-ui-backup-restore.md](../function-design/68-ui-backup-restore.md)（UI-11b-F6 / UI-11b-D4 / 状態遷移表 `restore_succeeded` 行 / 「復元成功後 home route へ遷移し、遷移先で success Alert」）、[function-design/52-ui-shared-layout.md](../function-design/52-ui-shared-layout.md)（sidebar）
- Decision log / ADR: 変更なし

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | 該当なし |
| Command / DTO / generated binding / wire shape | 該当なし | 該当なし |
| DB / transaction / audit / rollback / migration | 該当なし | 該当なし |
| Screen / UI / route state / Japanese wording | 68-ui-backup-restore.md | existing sufficient（成功 Alert は既存契約。本 change は実装是正） |
| CSV / TSV / report / import / export format | 該当なし | 該当なし |
| Durable decision / ADR | focus ring 規範の docs 昇格 | intentionally deferred（非目的参照） |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc / REQ の追加なし。`<Link>` 化は既存 route への遷移方法の変更のみで routeTree 生成に影響しない）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| UI-11b-F6 / UI-11b-D4 | 68 §機能一覧 / §設計判断 / §状態遷移 | （既存契約） | 現実装は遷移前の一時 toast のみで「遷移先で success Alert」の契約に未達。契約側を変えず実装を是正 | `BackupRestorePage.tsx` + ホーム側受け口 | 復元成功 flow RTL test |
| PR #127 受け入れ R1 P3-2（Plans.md 起票） | Plans.md「Frontend follow-up」 | UIPOLA-D1 | 型付き `<Link to/search>` は search param の型安全と SPA 遷移を両立。生 `<a href>` は全画面リロードで state 喪失。href helper を残して `<a>` だけ置換する案は型付けの利点を捨てるため不採用 | 10 file / 19 箇所 + href helper | rg 0 件検証 + 既存遷移 test |
| PR #9 Final Review P3（Plans.md 起票） | design-system 明文規範なし（コード慣習が事実上の標準） | UIPOLA-D2 | `src/components/ui/` の 10+ component が共有する shadcn ring パターンを踏襲。独自 style 新設は不採用 | `SidebarLink.tsx` | class assertion |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes（68 の契約文と Plans.md の backlog 起票が根拠。本 packet は実装計画のみ）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: なし（UIPOLA-D1/D2 は実装 idiom の選択で契約変更なし）
- Assumptions and constraints: Sonner toast は遷移を跨いで表示され続けるが「遷移先で success Alert」契約の充足とは見なさない（68 状態遷移表が Alert を明記）
- Deferred design gaps, risk, and follow-up target: focus ring 規範の docs 昇格（intentionally deferred）、UI-09b coverage 表示（R3 移管）
- Test Design Matrix can cite design decision IDs or source doc sections: yes（R2 につき Matrix は本 packet の Test Plan で代替）
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 既存 test の削除・無効化なし、契約変更なしを確認

## Impact Review Lenses

not applicable — 本 change は field 調査・実機挙動・外部 tool・POS 連携・帳票形式の発見を起点とせず、既存 backlog 起票（PR #9 / #127 / #144 レビュー所感）の消化である。環境・再現性 lens: 新設の環境依存なし（既存 toolchain のみ）。

## Design Readiness

- Existing design docs are sufficient because: 復元成功 Alert は 68-ui-backup-restore.md が既に契約として規定済み（実装側の未達の是正）。focus ring と `<Link>` 統一は契約変更を伴わない実装 idiom の統一で、UI_TECH_STACK.md の既存技術選定の範囲内
- Source docs updated in this PR: なし
- Design gaps intentionally deferred: focus ring 規範の docs 昇格
- Durable decisions discovered in this plan and promoted to source docs: なし

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層のみ。CMD 以下不変
- Backend function design: 変更なし
- Command / DTO / data contract: 変更なし
- Persistence / transaction / audit impact: なし
- Operator workflow / Japanese UI wording: 成功 Alert 文言は既存 toast 文言「バックアップから復元しました」を基準に、68 の文言慣習に沿って writer が具体化（新規語彙の導入なし）
- Error, empty, retry, and recovery behavior: 復元失敗経路は不変（成功経路の表示強化のみ）。Alert one-shot の担保機構は「reload 後に再表示されない」を満たすこと（Boundary / Wire Contract 参照）
- Testability and traceability IDs: 既存 REQ 対応の test を維持、新規 test は該当画面の既存 test file へ追加

## Contract Probe

N/A — 未検証の外部前提なし（TanStack Router `<Link>` / Sonner / shadcn ring はいずれも本 repo で使用実績のある既知挙動）。

## Test Plan

- targeted tests: SidebarLink の focus-visible class assertion / 復元成功 flow（成功 → ホーム遷移 → Alert 表示）の RTL test / `<Link>` 化した代表画面の遷移 test（既存 test の追随修正含む）
- negative tests: 復元失敗時に成功 Alert が表示されない / Alert one-shot（再 render・再 mount で再表示されない）
- compatibility checks: 既存 test suite 全 green（削除・無効化・skip なし）。`ProductListPage.test.tsx` の既知 timing flake は本 change 無関係として扱う
- data safety checks: 該当なし（DB / file 出力に触れない）
- main wiring/integration checks: ホーム画面の Alert 受け口が復元経路以外の通常起動で表示されないこと

## Boundary / Wire Contract

`<Link>` 統一と復元成功 flag は browser / router state に触れるため記載する。IPC / JSON / DB は不変。

- producer: `BackupRestorePage.tsx`（復元成功時の navigate）
- consumer: ホーム画面 route component（成功 Alert 受け口）
- wire type: router の ephemeral な遷移 state（TanStack Router の navigate state 等）。**URL search param の永続 flag は不採用**（reload で Alert が再表示され one-shot 契約を破るため）
- internal type: boolean 相当の one-shot flag（具体機構は writer 裁量、契約は下記 2 行）
- precision/range: 該当なし
- round-trip path: 復元成功 → navigate → ホーム初回 render で Alert 表示 → 以降の re-render / reload で非表示
- invalid input: flag なしの通常ホーム到達では Alert を表示しない
- compatibility: ホーム画面の既存表示・既存 query cache clear 挙動（UI-11b-D4）を変えない

## Review Focus

- `<Link>` 化 19 箇所の `to` / `search` 型付けの欠落・遷移先 URL の同値性（旧 href と完全一致するか、特に search param 付き遷移）
- href helper の構造化変更が呼び出し元へ波及した際の取りこぼし
- 復元成功 Alert の one-shot 性（reload / 再 mount / 通常到達での非表示）
- 既存 test の削除・無効化・skip が紛れていないこと
- focus ring が disabled / pending 状態の link 表示を壊さないこと

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
