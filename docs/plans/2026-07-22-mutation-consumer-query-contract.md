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
UI route/search state や DB スキーマは変えないが、operator workflow の中核（mutation 直後の在庫・履歴・在庫少表示の正しさ）を横断 16 mutation で変更し、UI_TECH_STACK / function-design 複数 doc の安定契約（invalidation 方針）を改訂する。stable contract の変更 + operator workflow 影響で R3。R4 要素（destructive lifecycle / migration / restore）はない。

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

- P5-4（operation-logs / integrity latest-check の literal key 直書きの factory 収容）。latest-check literal は本 change で touch しない — rally round 1 P2-1 / round 2 B の裁定で invalidate 対象から一律除外が確定しており、factory 化も P5-4 保全のため行わない（round 3 P3-E で条件文を簡略化）。
- staleTime / gcTime の値の再設計。現行値は維持し、invalidation の有無のみを契約化する。
- refetch 戦略（mount 時 refetch 等)の変更。
- backend（Rust）側の変更。書込み集合は現状を正とし、frontend の invalidation を追随させる。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `src/lib/invalidation-contract.ts` 新設: mutation 識別子 → 期待 invalidation 集合（queryKeys factory 参照）の SSOT 定数 + 適用 helper。
- 除外判断の基準（rally round 3 P2-D で明文化）: 契約からの除外は table ベースの除外表 E1〜E5 のみを根拠とする。staleTime 設定値は除外根拠にしない — Non-scope で staleTime 再設計を除外した以上、設定値を契約根拠にすると「staleTime を変えると契約が変わる」隠れ結合を作るため。latest-check の staleTime:0 議論（round 2 B）は E1（op_logs 系 table 除外）の補強論拠に位置付け、staleTime:0 の query（例: stocktake.itemsRoot）でも書込み table を読む限り契約に収載する。
- `src/lib/query-keys.ts`: `stockMovements` への root/prefix helper 追加（現状 helper が無く P5-2 の是正が構造的に不可能）。`productForm` への root/prefix helper 追加（一括 import が products を UPDATE し `productForm.product(id)` がそれを読むため、導出原則から必要 — 対象 id 群が bulk で特定不能なため prefix invalidate。rally round 1 P2-2 で確定）。`dailySales` への root/prefix helper 追加（現行の `["daily-sales"]` literal prefix invalidate 4 箇所 = csv-import commit/rollback 2 + daily-report-import commit/rollback 2 を型安全な factory 参照に置換 — SSOT が直接参照する key に literal を残すと D-4 直書き禁止規範と矛盾するため。rally round 2 A で確定、箇所数は round 3 P2-C で実測訂正。operation-logs 系 literal は P5-4 保全のため対象外を維持）。
- 対象 16 mutation の onSuccess を SSOT 経由の invalidate へ置換（下記契約表 v1）: 商品 create / 商品 update・廃番 toggle / 商品一括 import / 入庫 / 返品 / 手動販売 / 廃棄 / 売上 CSV commit / 売上 CSV rollback / 日報 import commit・rollback / 棚卸し開始 / 棚卸し明細個数更新 / 棚卸し確定 / 整合性補正 / 閾値保存（全成功 + 部分成功） / PLU 書出し。うち日報 import / PLU 書出し / 棚卸し開始 / 棚卸し明細個数更新は集合の増減なし（SSOT 経由化のみ — D-052-S1 の絶対保証を全 production mutation で成立させるため。後者 2 つは rally round 2 C で網羅漏れとして追加）。
- 対象 mutation のテストを SSOT 契約集合に対する検査へ書換え（P8-2）。invalidation 検査が存在しない ProductFormPage / IntegrityCheckPage / ThresholdSettingsPage（部分成功分岐）へ新規追加。`useCsvImportFlow` は hook 実行 test 自体が不在（page test は hook を idle mock で全置換 = P8b-1 で確認済みの構造）のため、renderHook + QueryClient wiring test を新設する（`useDailyReportImportFlow.test.tsx` パターン踏襲。rally round 1 P1-2）。
- 設計正本の改訂: UI_TECH_STACK §2.5 invalidation 節へ導出原則 + 除外表 + SSOT 参照を正本化。function-design 51 / 55 / 56 / 57 / 60 / 61 / 62 / 63 / 64 / 66 / 67 / 69 / 73 / 75 の invalidation 記述を契約 SSOT 参照へ同期（現行列挙を残すと doc 側が新たな写しになる。56 = 日報サマリ表示 / 67 = PLU 書出し — rally round 1 P3-2。57 = 月次売上は CSV/日報 mutation の consumer doc で 56 と対称 — rally round 2 E）。decision-log へ D-052（契約 SSOT 配置と除外原則）新設。

### 契約表 v1（backend 書込み集合からの導出。証拠 = 本 packet の Design Intent Trace 及び調査記録）

書式: mutation → 追加が必要な invalidation（現行との差分)。全量は invalidation-contract.ts に実装時確定。

| mutation | backend 書込み | 現行 invalidation | 追加（差分） |
|---|---|---|---|
| 商品 create（form） | products / inventory_movements（initial_stock>0） / stocktake_items（棚卸し中） / op_logs | productList.root のみ | lowStock, stockInquiryRoot, pluDirty, stockMovements.root（新規商品に既存 cache は無く実効 no-op だが、導出原則の一様性を優先して収載 — 条件分岐の場合分けが契約の検証性を下げるため。rally round 1 P3-1）, stocktake.itemsRoot（staleTime:0 だが除外判断基準どおり table ベースで収載 — round 3 P2-D の対称適用） |
| 商品 update・廃番 toggle | products（plu_dirty, is_discontinued 含む） / price_history / op_logs | productList.root のみ | productForm.product(id), lowStock, stockInquiryRoot, pluDirty, stockMovements.root（detail が products を読む） |
| 商品一括 import | create と同等（上書き時は products UPDATE） | productList.root, lowStock, stockInquiryRoot, pluDirty | stockMovements.root, stocktake.itemsRoot（staleTime:0 だが table ベースで収載 — round 3 P2-D）, productForm.root（上書き対象 id の編集 form cache が stale になるため。id 群は bulk で特定不能 → prefix invalidate。rally round 1 P2-2） |
| 入庫 | receiving_records/items, products.stock_quantity, inventory_movements, op_logs | receivings.root, inventoryRecords.root, productList.root, lowStock, stockInquiryRoot | stockMovements.root |
| 返品 | return_records/items + （未処理時）products.stock_quantity, inventory_movements, op_logs | returns.root, inventoryRecords.root +（未処理時）productList.root, lowStock, stockInquiryRoot | （未処理時）stockMovements.root |
| 手動販売 | manual_sales/items, sale_records, products.stock_quantity, inventory_movements, op_logs | inventoryRecords.root, productList.root, lowStock, stockInquiryRoot, dailySales(date), monthlySalesRoot | stockMovements.root |
| 廃棄 | disposal_records/items, products.stock_quantity, inventory_movements, op_logs | disposals.root, inventoryRecords.root, productList.root, lowStock, stockInquiryRoot | stockMovements.root |
| 売上 CSV commit | csv_imports, sale_records, products.stock_quantity（pos_stock_sync）, inventory_movements（+上書き時 void 系） | csvImportLists, ["daily-sales"], lowStock, pluDirty, stockInquiryRoot | productList.root, monthlySalesRoot, stockMovements.root |
| 売上 CSV rollback | sale_records.is_voided, inventory_movements.is_voided, products.stock_quantity | 同上 | productList.root, monthlySalesRoot, stockMovements.root |
| 日報 import commit/rollback | daily_report_imports + summary/payment/department lines, op_logs（sale_records / products / movements 非接触 — commit.rs:98-184 / rollback.rs:30 で確認済み） | dailyReportImportLists, ["daily-sales"], monthlySalesRoot | なし（確定。dailySales は official_daily_report として daily_report 系を読む = sales_service.rs:208-216。monthlySales も official_department_totals で daily_report 由来データを読む = sales_service.rs:246-249 → monthlySalesRoot は維持で確定。rally round 1 P2-3） |
| 棚卸し開始 | stocktakes（INSERT）, stocktake_items（生成、廃番 stock=0 自動確定含む） | stocktake.status, stocktake.itemsRoot | なし（現行維持、SSOT 経由化のみ — rally round 2 C。error 分岐の防御 refresh は契約対象外） |
| 棚卸し明細個数更新 | stocktake_items（actual_count） | stocktake.itemsRoot | なし（現行維持、SSOT 経由化のみ — rally round 2 C） |
| 棚卸し確定 | stocktake_items, stocktakes, products.stock_quantity（差異品）, inventory_movements（差異品）, op_logs + 確定後 integrity_check ログ | stocktake.status, itemsRoot, lastCompleted | productList.root, lowStock, stockInquiryRoot, stockMovements.root。latest-check literal は対象外 — 主根拠は E1（op_logs 系 table 除外）。staleTime:0（IntegrityCheckPage.tsx:89）による実効なし判定（rally round 2 B）は補強論拠（round 3 P2-D で位置付けを整理） |
| 整合性補正 | products.stock_quantity（movement 行なし = D-051）, op_logs（integrity_fix, 同一 TX） | なし | productList.root, lowStock, stockInquiryRoot, stockMovements.root（detail の products 読み）。latest-check literal は対象外 — 主根拠は棚卸し確定行と同じく E1（op_logs 系 table 除外、round 3 P2-D の統一基準）。round 1 P2-1 の型不一致 no-op（fix は `integrity_fix` ログ、query は `integrity_check` フィルタ = IntegrityCheckPage.tsx:83）は E1 除外の具体例としての補強論拠（round 4 P3-1 で行間の理由粒度を統一） |
| 閾値保存（部分成功含む） | app_settings のみ（op_logs も書かない唯一の mutation） | 全成功時のみ thresholdSettings.settings, lowStock, stockInquiryRoot | 部分成功（succeededFields≥1）でも同一集合を適用（P5b-3） |
| PLU 書出し | products.plu_dirty=false, op_logs | pluDirty, productList.root | 現行維持（契約表に収載のみ） |

### 除外表 v1（明示除外 + 理由。UI_TECH_STACK へ正本化する内容）

| 除外 | 理由 |
|---|---|
| operation_logs 系 query（operation-logs 画面の 2 literal key + integrity latest-check literal）を全 mutation で invalidate しない | ほぼ全 mutation が op_logs を書くため契約が全画面 invalidate に縮退する。操作ログは管理画面であり遷移時 fetch で十分。latest-check は staleTime:0（IntegrityCheckPage.tsx:89）のため invalidate 自体が実効なし（rally round 2 B で例外条項を削除し一律除外に単純化） |
| productForm.root prefix invalidate が `productForm.suppliers()` を巻き込む | 一括 import は supplier マスタを書かないが、prefix 一括の collateral invalidate として許容（害は余分な refetch のみ。id 群特定不能な bulk 上書きへの対処を優先 — rally round 2 D） |
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
- `rg -n "invalidateQueries" src/features --glob '!*.test.*'` の全 production ヒットが ①SSOT helper 経由 ②契約表収載の例外（backupRestore 系 = 対象外 domain） ③stocktake 画面内 error-path invalidate（conflict / not-in-progress 時の防御 refresh のみ。開始・明細更新の success-path は round 2 C で契約表へ収載済みのため、このバケットに success-path は残らない — rally round 1 P2-4 + round 2 C）の 3 バケットに分類でき、未収載の直接呼び出しが 0。
- UI_TECH_STACK §2.5 に導出原則 + 除外表、decision-log に D-052、function-design 対象 doc に SSOT 参照が入り、`bash scripts/doc-consistency-check.sh` pass。
- `bash scripts/local-ci.sh full` pass（hosted final は Ready 後）。

## Design Sources

- Requirements / spec: docs/research/audit-2026-07/findings/p5-state-query.md（P5-1〜P5b-3）、p8-test-quality.md（P8-2）、adjudication.md（順 4 裁定 + Goal Invariant 指定）
- Architecture: docs/UI_TECH_STACK.md §2.5 Data Fetching（invalidation 方針の実正本 = L200-251 の invalidation pattern + 補強 6 項目。本 PR で改訂。§6 は横断 UI 要素で invalidation 無関係 — rally round 1 P1-1 で節番号誤りを是正）
- Function / command / DTO: function-design 51 / 55 / 56 / 57 / 60 / 61 / 62 / 63 / 64 / 66 / 67 / 69 / 73 / 75（invalidation 記述の同期対象）
- DB: docs/DB_DESIGN.md（table→query 逆引きの根拠）、D-051（fix_integrity の書込み意味論）
- Screen / UI: 上記 function-design と同じ
- Decision log / ADR: D-051（BIZ-07-D1/D2）、D-052（本 PR 新設）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 変更なし（書込み集合は現状が正） | existing sufficient |
| Command / DTO / generated binding / wire shape | 変更なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | UI_TECH_STACK §2.5 + function-design 14 doc の invalidation 記述（列挙は Scope を正とする） | updated in this PR |
| CSV / TSV / report / import / export format | 変更なし | existing sufficient |
| Durable decision / ADR | decision-log D-052（契約 SSOT 配置 + 除外原則） | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / doc / REQ / route / 画面なし。新設は frontend module `invalidation-contract.ts` のみで、生成系検査の対象外）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| P5-1〜P5b-3 | UI_TECH_STACK §2.5 | D-052 | SSOT 定数方式。rejected: ①画面単位の key 追加（監査が「再発する」と明示） ②doc 側を SSOT にして表を二重管理（drift 再生産） | src/lib/invalidation-contract.ts + 16 mutation onSuccess | 各 page test の契約遵守検査 |
| P8-2 | UI_TECH_STACK §2.5 | D-052 | テストは契約集合から期待を導出。rejected: 実装列挙の写し（現行の tautology） | 各 page test | 契約 key 除去の実 mutation 感度実測（Matrix M 行） |
| P5-2 前提 | query-keys.ts ヘッダ D-4 | D-052 | stockMovements root/prefix helper 新設（既存 csvImportLists / stockInquiryRoot パターン踏襲） | src/lib/query-keys.ts | prefix 整合テスト（product/list が root 配下） |
| P5-3 | 36-biz §21 / 75-ui / D-051 | D-051 | fix_integrity は cache（stock_quantity）直接更新 = invalidation は D-051 invariant の UI 側追随 | IntegrityCheckPage.tsx | fix 成功時 invalidateSpy 検査 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 可（監査 findings + adjudication + D-051 + 本 PR で正本化する UI_TECH_STACK §2.5 / D-052）
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 導出原則・除外表・SSOT 配置 → UI_TECH_STACK §2.5 + D-052
- Assumptions and constraints: backend 書込み集合は現状が正（Rust 変更なし）。契約表 v1 の backend 根拠は調査記録の file:line を Ledger 作成時に転記
- Deferred design gaps, risk, and follow-up target: P5-4（literal key factory 収容）は本 change merge 後。日報 import の書込み集合は確認済み（追加なしで確定、契約表 v1 参照）
- Test Design Matrix can cite design decision IDs or source doc sections: 可（D-052 / P5-x / P8-2）
- Absolute guarantee / escape hatch self-check completed: 「全 production invalidateQueries が SSOT 経由」の絶対保証に対し、例外 = backupRestore 系（対象外 domain）と stocktake 画面内の error-path invalidate（列 refresh 用途、契約対象外）を明示。AC の rg 検査で全ヒット分類を担保

## Impact Review Lenses

not applicable — 実地調査・実機・外部ツール・POS 連携・フォーマット変更を含まない frontend cache 契約の整備。Fact check / design decision split のみ適用: backend 書込み集合（fact、調査済み）と invalidate 粒度（design decision、除外表で明示）を分離済み。

## Design Readiness

- Existing design docs are sufficient because: 不十分 — UI_TECH_STACK §2.5 は原則のみで mutation 別契約が未定義（監査指摘の根本原因）。本 PR で正本化する
- Source docs updated in this PR: UI_TECH_STACK §2.5 / decision-log D-052 / function-design 14 doc の invalidation 記述同期（列挙は Scope を正とする）
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

契約 ID は D-052 の子番号（D-052 本体は本 PR で decision-log に新設）。backend 書込み根拠: C1/C3 = product_service.rs:161-233 / 802-933（movement 挿入 196-206 / 873-887、stocktake_items 216-225）、C2 = product_service.rs:273-359、C4 = receiving.rs:135-224、C5 = returns.rs:162-260（212-237 分岐）、C6 = manual_sale.rs:202-305、C7 = disposal.rs:139-223、C8/C9 = commit.rs:92-286 / rollback.rs:15-84、C10 = daily_report_import_service/commit.rs:98-184 / rollback.rs:30、C11 = stocktake_service.rs:313-469（確定後チェック連動 455-461）、C12 = integrity_service.rs:127-213（D-051）、C13 = settings_cmd.rs:167-178 + system_repo.rs:100-108、C14 = plu_export_service.rs:185（confirm_plu_export_saved）、C15 = stocktake_service.rs:225（start_stocktake、廃番 stock=0 自動確定 257-268）、C16 = stocktake_service.rs:173-202（`update_count`、内部で repo::update_stocktake_item_count 呼出 — 関数名は round 4 P2-2 で訂正）（C14〜C16 は round 3 P2-A で追記）。

adjacent-contract sweep: UI_TECH_STACK §2.5 全項目 + 対象 function-design 14 doc の invalidation 節 + query-keys.ts ヘッダ D-4（直書き禁止）を対象済み。既存 literal key の扱いも全収載 — `["daily-sales"]` は S2 で factory 化、operation-logs 系 literal（operation-logs 画面 2 key + integrity latest-check）は P5-4 保全で非接触のまま除外表 E1 に収載（rally round 2 A で sweep 主張との不整合を是正）。

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-052-C1 商品 create の invalidation 集合（契約表 v1 行 1） | ProductFormPage.tsx create onSuccess → SSOT 経由 | ProductFormPage 契約遵守 test（新設） | 非 L3（自動テスト完結） |
| D-052-C2 商品 update・廃番 toggle の集合（行 2） | ProductFormPage.tsx update onSuccess | 同上 | 同上 |
| D-052-C3 一括 import の集合（行 3） | useProductImportFlow.ts | useProductImportFlow test 拡張 | 同上 |
| D-052-C4 入庫の集合（行 4） | ReceivingPage.tsx | ReceivingPage test 書換え + M1 | 同上 |
| D-052-C5 返品の条件付き集合（行 5、register_processed 分岐） | ReturnExchangePage.tsx | ReturnExchangePage test 書換え + F5 negative | 同上 |
| D-052-C6 手動販売の集合（行 6） | ManualSalePage.tsx | ManualSalePage test 書換え | 同上 |
| D-052-C7 廃棄の集合（行 7） | DisposalPage.tsx | DisposalPage test 書換え | 同上 |
| D-052-C8 売上 CSV commit の集合（行 8） | useCsvImportFlow.ts commit | useCsvImportFlow renderHook + QueryClient wiring test（**新設** — hook 実行 test は現状不在、page test は hook を idle mock で全置換。useDailyReportImportFlow.test.tsx パターン踏襲。rally round 1 P1-2） | 同上 |
| D-052-C9 売上 CSV rollback の集合（行 9） | useCsvImportFlow.ts rollback | 同上（新設 test に rollback 経路を含める） | 同上 |
| D-052-C10 日報 import の集合 = 現行維持（行 10） | useDailyReportImportFlow.ts（SSOT 経由化のみ） | useDailyReportImportFlow test（契約導出型へ） | 同上 |
| D-052-C11 棚卸し確定の集合（行 13。latest-check は round 2 B 裁定で対象外） | StocktakePage.tsx handleCompleteConfirm | StocktakePage test 拡張 | 同上 |
| D-052-C15 棚卸し開始 = 現行維持（行 11、SSOT 経由化のみ — round 2 C） | StocktakePage.tsx handleStart 成功時 | StocktakePage test（契約導出型へ） | 同上 |
| D-052-C16 棚卸し明細個数更新 = 現行維持（行 12、SSOT 経由化のみ — round 2 C） | StocktakePage.tsx onUpdated | 同上 | 同上 |
| D-052-C12 整合性補正の集合（行 14、D-051 追随。latest-check literal は P2-1 裁定で対象外） | IntegrityCheckPage.tsx handleFix | IntegrityCheckPage 契約遵守 test（新設） + M2 | 同上 |
| D-052-C13 閾値保存の集合・部分成功適用（行 15、P5b-3） | ThresholdSettingsPage.tsx saveMutation 両分岐 | 部分成功 test（新設） + M3 | 同上 |
| D-052-C14 PLU 書出し = 現行維持（行 16） | PluExportPage.tsx（SSOT 経由化のみ） | PluExportPage test（契約導出型へ） | 同上 |
| D-052-E1〜E5 除外表 5 項目（E1 op_logs 系 / E2 productForm.suppliers collateral / E3 売上 JOIN 表示名 / E4 backupRestore.settings / E5 新規商品売上 — round 3 P2-B で round 2 D 追加分を採番） | invalidation-contract.ts 非収載 + UI_TECH_STACK §2.5 除外表 | AC の rg 全ヒット分類 + Ledger レビュー | 非 L3 |
| D-052-S1 全 production invalidate は SSOT 経由（例外 = backupRestore 系 / stocktake error-path） | 16 mutation の onSuccess 置換 | AC の rg 分類 regression | 非 L3 |
| D-052-S2 root/prefix helper 新設 3 domain: stockMovements（product / list を prefix 配下に）+ productForm（C3 の bulk 上書きが必要とする — rally round 1 P2-2。suppliers の collateral は除外表で許容）+ dailySales（`["daily-sales"]` literal 4 箇所 = csv-import 2 + daily-report-import 2 の factory 化 — rally round 2 A、箇所数は round 3 P2-C で実測訂正） | query-keys.ts | prefix 構造検査 test（新設、3 domain） + M4 | 非 L3 |
| SPEC-INV-CONTRACT-01 テストは SSOT から期待導出（P8-2） | 対象 page test 全書換え | M1〜M4 の契約感度実測 | 非 L3 |

## Test Plan

Test Design Matrix: docs/plans/test-matrices/2026-07-22-mutation-consumer-query-contract.md（plan-gate 前に commit）

- targeted tests: 16 mutation の契約遵守テスト（invalidateSpy 期待を SSOT から導出）、prefix 整合（3 domain）、閾値部分成功分岐、integrity fix 成功時、ProductFormPage create/update
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

- 全 production mutation の成功時 invalidation は `invalidation-contract.ts` の SSOT 集合に一致し、SSOT は「mutation が書く table を読む query は invalidate、除外は UI_TECH_STACK §2.5 除外表に明示」の導出原則に従う。テストは SSOT から期待を導出し、契約 key の除去に感度を持つ。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-INV-CONTRACT-01 | SSOT 新設 + 16 mutation 置換 + テスト書換え | Matrix 参照 | 契約表導出の正しさ | Matrix M 行の red 実測記録 |

## Data Safety

- 実店舗データの commit なし（テストは既存 synthetic fixture のみ）
- local-only paths: なし
- synthetic-only paths: 既存 test fixture のみ

## Implementation Results

（実装後に記入）

## Review Response

### Plan Gate rally round 1（2026-07-22、独立 Plan Reviewer、P1×2 / P2×4 / P3×2 → 全 accept）

- P1-1（accept、CONFIRMED）: invalidation 正本の節番号誤り（§6 → §2.5）。全参照を §2.5 へ是正。Coordinator の実証 = UI_TECH_STACK 見出し構造（§2.5 Data Fetching L137 / §6 横断 UI 要素 L474）+ query-keys.ts:4 ヘッダの「§2.5 補強 1」
- P1-2（accept、CONFIRMED）: useCsvImportFlow の hook 実行 test 不在（page test は idle mock 全置換 = P8b-1 と同一構造）。C8/C9 を renderHook wiring test **新設**へ訂正、Scope に明記。Owner Effort Budget は owner 介入予算であり Writer 工数ではないため据え置き（Codex 予算は無制約運用）
- P2-1（accept、CONFIRMED）: 行 12 の latest-check literal は no-op（fix は `integrity_fix` ログ、query は `integrity_check` フィルタ = IntegrityCheckPage.tsx:83）→ 削除。行 11（棚卸し確定）は `run_integrity_check` 連動のため維持
- P2-2（accept、修正方向は削除でなく補完）: 一括 import の products UPDATE を `productForm.product(id)` が読む以上、導出原則から productForm root helper 新設 + 行 3 追加が正しい帰結。Scope の dangling 文を確定文へ置換、Ledger S2 拡張
- P2-3（accept、CONFIRMED）: 日報行の条件文を確定表記へ（monthlySales は official_department_totals で daily_report を読む = sales_service.rs:246-249、monthlySalesRoot 維持）
- P2-4（accept）: AC の rg 分類に stocktake error-path を第 3 バケットとして明記
- P3-1（accept、保持 + 理由明記）: 行 1 の stockMovements.root は実効 no-op だが導出原則の一様性を優先して収載、理由を契約表に記載
- P3-2（accept）: doc 同期対象へ 56（日報サマリ表示）/ 67（PLU 書出し）を追加（13 doc）

### Plan Gate rally round 2（2026-07-22、独立 Plan Reviewer、P2×4 / P3×1 → 全 accept。round 1 反映自体の矛盾なしを確認）

- A（部分 accept）: `["daily-sales"]` literal 3 箇所は dailySales root helper 新設で factory 化（SSOT が直接参照する key の D-4 整合）。latest-check の factory 化は rebut — Non-scope の P5-4 保全を維持（B 裁定で SSOT 参照自体が消えるため実質 moot）。Ledger sweep 完全性主張の文言も是正
- B（accept、CONFIRMED）: latest-check query は staleTime:0（IntegrityCheckPage.tsx:89）のため invalidate は実効なし。round 1 P2-1 の no-op 判定基準を対称適用し、行 13（棚卸し確定）からも削除、除外表 E1 の例外条項を撤去して一律除外に単純化
- C（accept、修正方向は文言拡張でなくバケット純化 + 契約表拡張）: StocktakePage:156-157 は棚卸し開始の success-path で error-path ではない（Coordinator 実証）。棚卸し開始・明細個数更新を「現行維持・SSOT 経由化のみ」で契約表へ収載（行 11/12、C15/C16）し、バケット③を真の error-path 防御 refresh のみに純化
- D（accept）: productForm.root の suppliers collateral invalidate を除外表に許容として明記
- E（accept）: 57-ui-monthly-sales を doc 同期対象へ追加（14 doc、56 と対称の consumer doc）

### Plan Gate rally round 3（2026-07-22、独立 Plan Reviewer、P2×4 / P3×1 → 全 accept。前 round 裁定への異議なし、R3 必須節充足を確認）

- P2-A（accept）: Ledger backend 根拠列挙に C14/C15/C16 の file:line を追記（plu_export_service.rs:185 / stocktake_service.rs:225 / 173-202）
- P2-B（accept）: 除外表の round 2 D 追加分（productForm.suppliers collateral）を E2 として採番し、Ledger を E1〜E5 の 5 項目へ更新
- P2-C（accept、CONFIRMED）: `["daily-sales"]` literal は 4 箇所（csv-import 2 + daily-report-import 2、Coordinator 実測）。「3 箇所」は round 2 反映時の Coordinator 誤カウントで、Scope / Ledger S2 を訂正
- P2-D（accept、修正方向は「除外の対称適用」でなく「除外判断基準の明文化 + 収載維持」）: staleTime 値を除外根拠にすると Non-scope で凍結した staleTime 設定への隠れ結合が生まれる。除外は table ベースの E1〜E5 のみを根拠とし、latest-check の staleTime:0（round 2 B）は E1 の補強論拠へ格下げ。stocktake.itemsRoot（staleTime:0）は導出原則どおり行 1/3 に収載維持、対称適用の基準を Scope に明文化
- P3-E（accept）: Non-scope の latest-check 条件文（round 1 P2-1 で前提消滅した死文）を無条件の記述へ簡略化

### Plan Gate rally round 4（2026-07-22、独立 Plan Reviewer、P2×2 / P3×1 → 全 accept。round 1〜3 の個別裁定への異議なし）

- P2-1（accept）: round 2 C の 16 行化が未伝播だった旧数値 7 箇所（Risk / Design Intent Trace / Ledger S1 / Test Plan / Trace Matrix / Matrix 2 箇所）を「16 mutation」「契約表 16 行」に統一
- P2-2（accept、CONFIRMED）: Ledger C16 の関数名を訂正 — biz 層 pub fn は `update_count`（stocktake_service.rs:173）、`update_stocktake_item_count` は repo 層（stocktake_repo.rs:243）
- P3-1（accept）: 整合性補正行の latest-check 除外理由を round 3 P2-D の統一基準（主根拠 = E1、型不一致 no-op は補強論拠）へ揃え、行間の理由粒度差を解消

### Plan Gate rally round 5（2026-07-22、独立 Plan Reviewer、P2×1 → accept。**表記修正のみで収束**）

- P2（accept）: doc 同期対象数「11 doc」が Required Design Artifacts / Design Readiness の 2 箇所で未伝播（round 1 P3-2 / round 2 E の doc 追加の drift、round 4 P2-1 と同型）→「14 doc（列挙は Scope を正とする）」へ統一し、以後の個数 drift を正本参照で防止
- round 4 反映の検証: 16 mutation 統一 = rg 機械確認でヒット 0 / C16 関数名 = 実コード突合一致 / 除外理由粒度 = 統一済み。前 4 round の全裁定に異議なし、実体的誤導出・矛盾・抜け道の最終確認も該当なし

**rally 収束宣言**: round 5 で新規実体指摘 0（表記 1 件のみ、同 round で反映済み）。self rally は 5 round で収束。次 = Codex plan review（Plan Reviewer 欄の定義どおり）。

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
