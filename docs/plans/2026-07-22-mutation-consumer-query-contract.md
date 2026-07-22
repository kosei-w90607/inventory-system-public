# Plan Packet — 監査是正 順 4: mutation→consumer query 契約と回帰テストの同時整備

## Workflow State

- Phase: plan-draft
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable（main thread）
- Writer: Codex（実装発注、レビュー前に PR 作成）
- Plan Reviewer: Plan agent self rally（独立 context、新規指摘 0 まで）→ Codex plan review。順 3 実装 follow-up で試行した逆順（Codex 先行）は「正本確定済み実装 follow-up」条件付きの手法であり、本 change は契約が未正本のためオーソドックス順に戻す
- Final Reviewer: Double Audit（1 pass = Fable inline 契約突合 / 2 pass = Codex 独立 + 実 mutation testing）。R3 だが operator-visible state lifecycle（stale 表示の解消契約）に触れるため DEV_WORKFLOW Contract Audit の recommended second pass を採用
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: plan 承認 / Ready 承認。Windows native L3 は not-required — cache invalidation は視覚意匠変更を伴わず、「mutation 後に旧値が fresh 扱いで表示されない」は vitest の invalidateSpy 検査 + 実 mutation 感度実測で完結する（DEV_WORKFLOW L3 Eligibility: 自動テストで検証可能な挙動は L3 に置かない）。roadmap 1-4 受入テスト（一気通貫台本）が実機での事後検証点を兼ねる

## Owner Effort Budget

- 介入回数上限: 2
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
UI route/search state や DB スキーマは変えないが、operator workflow の中核（mutation 直後の在庫・履歴・在庫少表示の正しさ）を横断 13 mutation で変更し、UI_TECH_STACK / function-design 複数 doc の安定契約（invalidation 方針）を改訂する。stable contract の変更 + operator workflow 影響で R3。R4 要素（destructive lifecycle / migration / restore）はない。

## Goal

Goal Invariant:

### 最小完了条件

- mutation→consumer query の期待 invalidation 集合が単一 SSOT（`src/lib/invalidation-contract.ts`）として存在し、監査 findings P5-1 / P5-2 / P5-3 / P5b-1 / P5b-2 / P5b-3 の全欠落が SSOT 経由の invalidate で解消されている。
- 各 mutation のテストが「実装の invalidate 列挙の写し」ではなく SSOT 契約集合に対する検査になっており（P8-2）、契約から key を 1 つ除去する mutation で該当テストが red になることを代表経路で実測済み。
- 契約の導出原則（mutation が書く table を読む query は invalidate する。除外は明示列挙 + 理由）と除外表が設計正本（UI_TECH_STACK）に定着している。

### 失敗定義

- query key の追加だけで終わり、テストが実装列挙の写しのまま残る（裁定の Goal Invariant 指定違反）。
- 契約表が frontend の現行実装から逆算されて作られ、backend 書込み集合との突合根拠を持たない（監査が指摘した「実装を写す」構造の再生産）。
- 6 findings のどれかが「画面単位の個別修正」で処理され、SSOT を経由しない invalidate 呼び出しが新規に増える。

### 非目的

- P5-4（operation-logs / integrity latest-check の literal key 直書きの factory 収容）。ただし整合性補正の invalidation 追加（P5-3）が同一 file（IntegrityCheckPage.tsx）に触るため、latest-check literal key の invalidate を追加する場合は既存 literal 表記をそのまま参照し、factory 化はしない（P5-4 是正時の変更範囲を保全）。
- staleTime / gcTime の値の再設計。現行値は維持し、invalidation の有無のみを契約化する。
- refetch 戦略（mount 時 refetch 等)の変更。
- backend（Rust）側の変更。書込み集合は現状を正とし、frontend の invalidation を追随させる。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `src/lib/invalidation-contract.ts` 新設: mutation 識別子 → 期待 invalidation 集合（queryKeys factory 参照）の SSOT 定数 + 適用 helper。
- `src/lib/query-keys.ts`: `stockMovements` への root/prefix helper 追加（現状 helper が無く P5-2 の是正が構造的に不可能）。`productForm` の prefix helper 追加は契約表の精査結果に従う。
- 対象 13 mutation の onSuccess を SSOT 経由の invalidate へ置換（下記契約表 v1）: 商品 create / 商品 update・廃番 toggle / 商品一括 import / 入庫 / 返品 / 手動販売 / 廃棄 / 売上 CSV commit / 売上 CSV rollback / 日報 import commit・rollback / 棚卸し確定 / 整合性補正 / 閾値保存（全成功 + 部分成功）。PLU 書出しは現行維持を契約表に収載。
- 対象 mutation のテストを SSOT 契約集合に対する検査へ書換え（P8-2）。invalidation 検査が存在しない ProductFormPage / IntegrityCheckPage / ThresholdSettingsPage（部分成功分岐）へ新規追加。
- 設計正本の改訂: UI_TECH_STACK §6 invalidation 節へ導出原則 + 除外表 + SSOT 参照を正本化。function-design 51 / 55 / 60 / 61 / 62 / 63 / 64 / 66 / 69 / 73 / 75 の invalidation 記述を契約 SSOT 参照へ同期（現行列挙を残すと doc 側が新たな写しになる）。decision-log へ D-052（契約 SSOT 配置と除外原則）新設。

### 契約表 v1（backend 書込み集合からの導出。証拠 = 本 packet の Design Intent Trace 及び調査記録）

書式: mutation → 追加が必要な invalidation（現行との差分)。全量は invalidation-contract.ts に実装時確定。

| mutation | backend 書込み | 現行 invalidation | 追加（差分） |
|---|---|---|---|
| 商品 create（form） | products / inventory_movements（initial_stock>0） / stocktake_items（棚卸し中） / op_logs | productList.root のみ | lowStock, stockInquiryRoot, pluDirty, stockMovements.root, stocktake.itemsRoot |
| 商品 update・廃番 toggle | products（plu_dirty, is_discontinued 含む） / price_history / op_logs | productList.root のみ | productForm.product(id), lowStock, stockInquiryRoot, pluDirty, stockMovements.root（detail が products を読む） |
| 商品一括 import | create と同等（上書き時は products UPDATE） | productList.root, lowStock, stockInquiryRoot, pluDirty | stockMovements.root, stocktake.itemsRoot |
| 入庫 | receiving_records/items, products.stock_quantity, inventory_movements, op_logs | receivings.root, inventoryRecords.root, productList.root, lowStock, stockInquiryRoot | stockMovements.root |
| 返品 | return_records/items + （未処理時）products.stock_quantity, inventory_movements, op_logs | returns.root, inventoryRecords.root +（未処理時）productList.root, lowStock, stockInquiryRoot | （未処理時）stockMovements.root |
| 手動販売 | manual_sales/items, sale_records, products.stock_quantity, inventory_movements, op_logs | inventoryRecords.root, productList.root, lowStock, stockInquiryRoot, dailySales(date), monthlySalesRoot | stockMovements.root |
| 廃棄 | disposal_records/items, products.stock_quantity, inventory_movements, op_logs | disposals.root, inventoryRecords.root, productList.root, lowStock, stockInquiryRoot | stockMovements.root |
| 売上 CSV commit | csv_imports, sale_records, products.stock_quantity（pos_stock_sync）, inventory_movements（+上書き時 void 系） | csvImportLists, ["daily-sales"], lowStock, pluDirty, stockInquiryRoot | productList.root, monthlySalesRoot, stockMovements.root |
| 売上 CSV rollback | sale_records.is_voided, inventory_movements.is_voided, products.stock_quantity | 同上 | productList.root, monthlySalesRoot, stockMovements.root |
| 日報 import commit/rollback | daily_report_imports + summary/payment/department lines, op_logs（sale_records / products / movements 非接触 — commit.rs:98-184 / rollback.rs:30 で確認済み） | dailyReportImportLists, ["daily-sales"], monthlySalesRoot | なし（確定。dailySales は official_daily_report として daily_report 系を読む = sales_service.rs:208-216。monthlySales の daily_report 読取り有無は Ledger 精査で確認し、読まないなら monthlySalesRoot を除外表へ移す） |
| 棚卸し確定 | stocktake_items, stocktakes, products.stock_quantity（差異品）, inventory_movements（差異品）, op_logs + 確定後 integrity_check ログ | stocktake.status, itemsRoot, lastCompleted | productList.root, lowStock, stockInquiryRoot, stockMovements.root, integrity latest-check literal |
| 整合性補正 | products.stock_quantity（movement 行なし = D-051）, op_logs（integrity_fix, 同一 TX） | なし | productList.root, lowStock, stockInquiryRoot, stockMovements.root（detail の products 読み）, integrity latest-check literal |
| 閾値保存（部分成功含む） | app_settings のみ（op_logs も書かない唯一の mutation） | 全成功時のみ thresholdSettings.settings, lowStock, stockInquiryRoot | 部分成功（succeededFields≥1）でも同一集合を適用（P5b-3） |
| PLU 書出し | products.plu_dirty=false, op_logs | pluDirty, productList.root | 現行維持（契約表に収載のみ） |

### 除外表 v1（明示除外 + 理由。UI_TECH_STACK へ正本化する内容）

| 除外 | 理由 |
|---|---|
| operation_logs 系 query（operation-logs 画面の 2 literal key）を全 mutation で invalidate しない | ほぼ全 mutation が op_logs を書くため契約が全画面 invalidate に縮退する。操作ログは管理画面であり遷移時 fetch で十分。例外 = integrity latest-check literal は integrity 画面の表示に直結するため integrity check/fix と棚卸し確定（確定後チェック連動）のみ invalidate |
| 商品 master 変更（name/department）→ dailySales / monthlySales | 売上集計の数値は不変で JOIN 表示名のみ stale。staleTime 経過で自然回復を許容 |
| 閾値保存 → backupRestore.settings | 同じ app_settings を読むが backup 画面は backup 系 key しか表示せず業務影響なし |
| 新規商品 create → dailySales / monthlySales | 新規商品に売上行は存在しない |

## Non-scope

- P5-4 の literal key factory 収容（上記非目的参照。着手順序: 本 change が先、P5-4 是正は本 change の merge 後）。
- 一覧フィルタリセットボタン等の UI 変更、staleTime 再設計、refetch 戦略変更。
- backend / Rust の変更、bindings 再生成。
- E2E 追加（roadmap 1-4 で評価）。

## Acceptance Criteria

- `npx vitest run` で対象 mutation の契約遵守テストが green、かつ ProductFormPage / IntegrityCheckPage / ThresholdSettingsPage 部分成功分岐に invalidateSpy 検査が新設されている（`rg -l "invalidation-contract" src/features` が対象 feature を列挙する）。
- 契約感度の実測: `invalidation-contract.ts` の任意 1 key 除去（代表 3 mutation: 入庫 / 整合性補正 / 閾値部分成功）で該当テストが red（Matrix の M 行として記録）。
- `rg -n "invalidateQueries" src/features` の全 production ヒットが SSOT helper 経由 or 契約表収載の例外（backupRestore 系 = 対象外 domain）に分類でき、未収載の直接呼び出しが 0。
- UI_TECH_STACK §6 に導出原則 + 除外表、decision-log に D-052、function-design 対象 doc に SSOT 参照が入り、`bash scripts/doc-consistency-check.sh` pass。
- `bash scripts/local-ci.sh full` pass（hosted final は Ready 後）。

## Design Sources

- Requirements / spec: docs/research/audit-2026-07/findings/p5-state-query.md（P5-1〜P5b-3）、p8-test-quality.md（P8-2）、adjudication.md（順 4 裁定 + Goal Invariant 指定）
- Architecture: docs/UI_TECH_STACK.md §6（invalidation 方針、本 PR で改訂）
- Function / command / DTO: function-design 51 / 55 / 60 / 61 / 62 / 63 / 64 / 66 / 69 / 73 / 75（invalidation 記述の同期対象）
- DB: docs/DB_DESIGN.md（table→query 逆引きの根拠）、D-051（fix_integrity の書込み意味論）
- Screen / UI: 上記 function-design と同じ
- Decision log / ADR: D-051（BIZ-07-D1/D2）、D-052（本 PR 新設）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 変更なし（書込み集合は現状が正） | existing sufficient |
| Command / DTO / generated binding / wire shape | 変更なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | UI_TECH_STACK §6 + function-design 11 doc の invalidation 記述 | updated in this PR |
| CSV / TSV / report / import / export format | 変更なし | existing sufficient |
| Durable decision / ADR | decision-log D-052（契約 SSOT 配置 + 除外原則） | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / doc / REQ / route / 画面なし。新設は frontend module `invalidation-contract.ts` のみで、生成系検査の対象外）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| P5-1〜P5b-3 | UI_TECH_STACK §6 | D-052 | SSOT 定数方式。rejected: ①画面単位の key 追加（監査が「再発する」と明示） ②doc 側を SSOT にして表を二重管理（drift 再生産） | src/lib/invalidation-contract.ts + 13 mutation onSuccess | 各 page test の契約遵守検査 |
| P8-2 | UI_TECH_STACK §6 | D-052 | テストは契約集合から期待を導出。rejected: 実装列挙の写し（現行の tautology） | 各 page test | 契約 key 除去の実 mutation 感度実測（Matrix M 行） |
| P5-2 前提 | query-keys.ts ヘッダ D-4 | D-052 | stockMovements root/prefix helper 新設（既存 csvImportLists / stockInquiryRoot パターン踏襲） | src/lib/query-keys.ts | prefix 整合テスト（product/list が root 配下） |
| P5-3 | 36-biz §21 / 75-ui / D-051 | D-051 | fix_integrity は cache（stock_quantity）直接更新 = invalidation は D-051 invariant の UI 側追随 | IntegrityCheckPage.tsx | fix 成功時 invalidateSpy 検査 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 可（監査 findings + adjudication + D-051 + 本 PR で正本化する UI_TECH_STACK §6 / D-052）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 導出原則・除外表・SSOT 配置 → UI_TECH_STACK §6 + D-052
- Assumptions and constraints: backend 書込み集合は現状が正（Rust 変更なし）。契約表 v1 の backend 根拠は調査記録の file:line を Ledger 作成時に転記
- Deferred design gaps, risk, and follow-up target: P5-4（literal key factory 収容）は本 change merge 後。日報 import の書込み集合は確認済み（追加なしで確定、契約表 v1 参照）
- Test Design Matrix can cite design decision IDs or source doc sections: 可（D-052 / P5-x / P8-2）
- Absolute guarantee / escape hatch self-check completed: 「全 production invalidateQueries が SSOT 経由」の絶対保証に対し、例外 = backupRestore 系（対象外 domain）と stocktake 画面内の error-path invalidate（列 refresh 用途、契約対象外）を明示。AC の rg 検査で全ヒット分類を担保

## Impact Review Lenses

not applicable — 実地調査・実機・外部ツール・POS 連携・フォーマット変更を含まない frontend cache 契約の整備。Fact check / design decision split のみ適用: backend 書込み集合（fact、調査済み）と invalidate 粒度（design decision、除外表で明示）を分離済み。

## Design Readiness

- Existing design docs are sufficient because: 不十分 — UI_TECH_STACK §6 は原則のみで mutation 別契約が未定義（監査指摘の根本原因）。本 PR で正本化する
- Source docs updated in this PR: UI_TECH_STACK §6 / decision-log D-052 / function-design 11 doc の invalidation 記述同期
- Design gaps intentionally deferred: P5-4、staleTime 再設計（日報 import 行は確認済み・追加なしで確定）
- Durable decisions discovered in this plan and promoted to source docs: 導出原則（書いた table を読む query は invalidate、除外は明示列挙 + 理由）

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層のみ変更。書込み集合の fact は BIZ/IO から読取り
- Backend function design: 変更なし
- Command / DTO / data contract: 変更なし
- Persistence / transaction / audit impact: 変更なし
- Operator workflow / Japanese UI wording: 文言変更なし。mutation 直後の別画面表示が最新化される（operator に見えるのは「古い数字が出なくなる」のみ）
- Error, empty, retry, and recovery behavior: onSuccess のみ変更、エラー経路は不変（stocktake の error-path invalidate は現行維持）
- Testability and traceability IDs: 契約遵守テストは P5-x / P8-2 を test 名 or comment で参照

## Contract Probe

N/A — 外部 library / OS 挙動の未検証前提なし。TanStack Query の prefix invalidation 挙動は既存 production パターン（csvImportLists / stockInquiryRoot）で実証済み。

## Contract Coverage Ledger

plan-draft 精査で確定する（契約表 v1 の各行 = 1 契約行、backend 書込み根拠 file:line 付き。adjacent-contract sweep = UI_TECH_STACK §6 全項目 + 対象 function-design の invalidation 節）。plan-gate 前に完成させる。

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| （plan-draft 精査で契約表 v1 から転記） | | | |

## Test Plan

Test Design Matrix: docs/plans/test-matrices/2026-07-22-mutation-consumer-query-contract.md（plan-gate 前に commit）

- targeted tests: 13 mutation の契約遵守テスト（invalidateSpy 期待を SSOT から導出）、stockMovements.root prefix 整合、閾値部分成功分岐、integrity fix 成功時、ProductFormPage create/update
- negative tests: 契約 key 除去で red（代表 3 mutation の実 mutation 感度実測）、返品 register_processed=true で在庫系 invalidate が発火しないこと
- compatibility checks: 既存 test suite green 維持（invalidate 追加による副作用なし）、doc-consistency-check pass
- data safety checks: N/A（データ書込みなし）
- main wiring/integration checks: local-ci full + hosted final

## Boundary / Wire Contract

N/A — JSON API / CSV / DTO / bindings / DB スキーマ変更なし。query key は frontend 内部契約。

## Review Focus

- 契約表 v1 の各セルが backend 書込み集合から正しく導出されているか（frontend 現行実装からの逆算になっていないか）
- 除外表の 4 項目の妥当性（特に op_logs 除外と integrity latest-check 例外の境界）
- SSOT 定数がテストと実装で共有されることによる新たな tautology の有無（契約自体の正しさは Ledger + 感度実測で担保する構造が成立しているか）
- stockMovements.root 新設が既存 key shape（product/list）を prefix 配下に収められるか

## Spec Contract

Contract ID: SPEC-INV-CONTRACT-01

- 全 production mutation の成功時 invalidation は `invalidation-contract.ts` の SSOT 集合に一致し、SSOT は「mutation が書く table を読む query は invalidate、除外は UI_TECH_STACK §6 除外表に明示」の導出原則に従う。テストは SSOT から期待を導出し、契約 key の除去に感度を持つ。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-INV-CONTRACT-01 | SSOT 新設 + 13 mutation 置換 + テスト書換え | Matrix 参照（plan-gate 前に確定） | 契約表導出の正しさ | Matrix M 行の red 実測記録 |

## Data Safety

- 実店舗データの commit なし（テストは既存 synthetic fixture のみ）
- local-only paths: なし
- synthetic-only paths: 既存 test fixture のみ

## Implementation Results

（実装後に記入）

## Review Response

（レビュー後に記入)
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
